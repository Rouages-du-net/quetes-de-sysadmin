// A WHERE clause as PostgreSQL reads it, over the game's tables (text
// cells): comparisons (=, <>, !=, <, <=, >, >=), AND, OR, NOT, parentheses,
// IS [NOT] NULL, [NOT] LIKE / ILIKE, [NOT] IN (…), and the date arithmetic
// a retention purge needs: current_date, now(), current_timestamp,
// DATE '2029-04-07', '…'::date, ± interval '2 years' (years, months, weeks,
// days, hours). Also the values of an INSERT.
// After https://www.postgresql.org/docs/16/functions-comparison.html,
// https://www.postgresql.org/docs/16/functions-datetime.html and
// https://www.postgresql.org/docs/16/functions-matching.html#FUNCTIONS-LIKE.
// Differences: an empty cell (or \N) is NULL; dates and timestamps are
// compared as text in ISO format; no functions other than the ones above.

export type Value = string | null;

export class SqlError extends Error {}

interface Token {
  kind: 'word' | 'string' | 'number' | 'op' | 'punct';
  text: string;
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  const re = /\s*(?:'((?:[^']|'')*)'|(\d+(?:\.\d+)?)|(<>|!=|<=|>=|::|[=<>+\-*])|([(),])|("?[A-Za-z_][\w.]*"?(?:\(\))?))/y;
  let i = 0;
  while (i < text.length) {
    if (/^\s*$/.test(text.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(text);
    if (!m) throw new SqlError(`syntax error at or near "${text.slice(i).trim().split(/\s+/)[0]}"`);
    if (m[1] !== undefined) out.push({ kind: 'string', text: m[1].replace(/''/g, "'") });
    else if (m[2] !== undefined) out.push({ kind: 'number', text: m[2] });
    else if (m[3] !== undefined) out.push({ kind: 'op', text: m[3] });
    else if (m[4] !== undefined) out.push({ kind: 'punct', text: m[4] });
    else out.push({ kind: 'word', text: m[5].replace(/"/g, '') });
    i = re.lastIndex;
  }
  return out;
}

const DAY = 86_400_000;
const iso = (ms: number, time: boolean) => {
  const s = new Date(ms).toISOString();
  return time ? `${s.slice(0, 10)} ${s.slice(11, 19)}` : s.slice(0, 10);
};
const parseDate = (v: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) : null;
};

// An interval: '2 years', '18 months', '30 days', '1 year 6 months'.
function interval(text: string): { months: number; ms: number } {
  const parts = [...text.trim().matchAll(/(-?\d+)\s*([a-z]+)/gi)];
  if (!parts.length || parts.map((p) => p[0]).join(' ').replace(/\s+/g, '') !== text.replace(/\s+/g, '')) throw new SqlError(`invalid input syntax for type interval: "${text}"`);
  let months = 0;
  let ms = 0;
  for (const [, n, u] of parts) {
    const unit = u.toLowerCase();
    if (/^(y|years?)$/.test(unit)) months += 12 * Number(n);
    else if (/^(mons?|months?)$/.test(unit)) months += Number(n);
    else if (/^(w|weeks?)$/.test(unit)) ms += 7 * DAY * Number(n);
    else if (/^(d|days?)$/.test(unit)) ms += DAY * Number(n);
    else if (/^(h|hours?)$/.test(unit)) ms += 3_600_000 * Number(n);
    else throw new SqlError(`invalid input syntax for type interval: "${text}"`);
  }
  return { months, ms };
}

function shift(date: number, by: { months: number; ms: number }, sign: 1 | -1): number {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + sign * by.months);
  return d.getTime() + sign * by.ms;
}

type Operand = { kind: 'text'; value: Value } | { kind: 'date'; ms: number; time: boolean } | { kind: 'interval'; months: number; ms: number };

export interface Context {
  columns: string[];
  // The server's clock (ms): current_date and now().
  now: number;
}

class Parser {
  i = 0;
  constructor(
    private t: Token[],
    private c: Context,
    private row: string[] | null,
  ) {}
  peek(k = 0) {
    return this.t[this.i + k];
  }
  word(w: string, k = 0) {
    const x = this.peek(k);
    return !!x && x.kind === 'word' && x.text.toLowerCase() === w;
  }
  take() {
    return this.t[this.i++];
  }
  fail(): never {
    const x = this.peek();
    throw new SqlError(x ? `syntax error at or near "${x.kind === 'string' ? `'${x.text}'` : x.text}"` : 'syntax error at end of input');
  }
  expect(text: string) {
    const x = this.take();
    if (!x || x.text.toLowerCase() !== text) {
      this.i--;
      this.fail();
    }
  }
  done() {
    if (this.i < this.t.length) this.fail();
  }

  // condition := term (OR term)*
  condition(): boolean | null {
    let v = this.term();
    while (this.word('or')) {
      this.take();
      const w = this.term();
      v = v === true || w === true ? true : v === null || w === null ? null : false;
    }
    return v;
  }
  term(): boolean | null {
    let v = this.factor();
    while (this.word('and')) {
      this.take();
      const w = this.factor();
      v = v === false || w === false ? false : v === null || w === null ? null : true;
    }
    return v;
  }
  factor(): boolean | null {
    if (this.word('not')) {
      this.take();
      const v = this.factor();
      return v === null ? null : !v;
    }
    if (this.peek()?.text === '(' && !this.isValueGroup()) {
      this.take();
      const v = this.condition();
      this.expect(')');
      return v;
    }
    return this.comparison();
  }
  // "(" starting an expression such as (current_date - interval …) rather than a condition.
  isValueGroup() {
    let depth = 0;
    for (let k = this.i; k < this.t.length; k++) {
      const x = this.t[k];
      if (x.text === '(') depth++;
      else if (x.text === ')' && --depth === 0) {
        const after = this.t[k + 1];
        return !!after && (after.kind === 'op' || (after.kind === 'word' && /^(is|like|ilike|in|not|between)$/i.test(after.text) && !/^(and|or)$/i.test(after.text)));
      } else if (depth === 1 && x.kind === 'word' && /^(and|or)$/i.test(x.text)) return false;
    }
    return false;
  }
  comparison(): boolean | null {
    const a = this.expression();
    if (this.word('is')) {
      this.take();
      const not = this.word('not') ? (this.take(), true) : false;
      if (!this.word('null')) this.fail();
      this.take();
      const isNull = a.kind === 'text' && a.value === null;
      return not ? !isNull : isNull;
    }
    let not = false;
    if (this.word('not') && (this.word('like', 1) || this.word('ilike', 1) || this.word('in', 1))) {
      this.take();
      not = true;
    }
    if (this.word('like') || this.word('ilike')) {
      const insensitive = this.take().text.toLowerCase() === 'ilike';
      const p = this.expression();
      const text = this.text(a);
      const pattern = this.text(p);
      if (text === null || pattern === null) return null;
      const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, insensitive ? 'is' : 's');
      return re.test(text) !== not;
    }
    if (this.word('in')) {
      this.take();
      this.expect('(');
      const list: Operand[] = [this.expression()];
      while (this.peek()?.text === ',') {
        this.take();
        list.push(this.expression());
      }
      this.expect(')');
      if (this.text(a) === null) return null;
      return list.some((b) => compare(a, b) === 0) !== not;
    }
    const op = this.peek();
    if (!op || op.kind !== 'op' || !['=', '<>', '!=', '<', '<=', '>', '>='].includes(op.text)) this.fail();
    this.take();
    const b = this.expression();
    const r = compare(a, b);
    if (r === null) return null;
    return { '=': r === 0, '<>': r !== 0, '!=': r !== 0, '<': r < 0, '<=': r <= 0, '>': r > 0, '>=': r >= 0 }[op.text]!;
  }
  text(o: Operand): Value {
    if (o.kind === 'text') return o.value;
    if (o.kind === 'date') return iso(o.ms, o.time);
    throw new SqlError('operator does not exist: interval ~~ unknown');
  }
  // expression := primary ((+|-) primary)*
  expression(): Operand {
    let a = this.primary();
    while (this.peek()?.kind === 'op' && ['+', '-'].includes(this.peek()!.text)) {
      const sign = this.take().text === '+' ? 1 : -1;
      const b = this.primary();
      a = arithmetic(a, b, sign);
    }
    return a;
  }
  primary(): Operand {
    const x = this.take();
    if (!x) this.fail();
    let o: Operand;
    if (x.text === '(') {
      o = this.expression();
      this.expect(')');
    } else if (x.kind === 'string') o = { kind: 'text', value: x.text };
    else if (x.kind === 'number') o = { kind: 'text', value: x.text };
    else if (x.kind === 'word') {
      const w = x.text.toLowerCase();
      if (w === 'null') o = { kind: 'text', value: null };
      else if (w === 'current_date') o = { kind: 'date', ms: Math.floor(this.c.now / DAY) * DAY, time: false };
      else if (w === 'now()' || w === 'current_timestamp' || w === 'localtimestamp') o = { kind: 'date', ms: this.c.now, time: true };
      else if (w === 'date' && this.peek()?.kind === 'string') {
        const ms = parseDate(this.take().text);
        if (ms === null) throw new SqlError(`invalid input syntax for type date: "${this.t[this.i - 1].text}"`);
        o = { kind: 'date', ms, time: false };
      } else if ((w === 'timestamp' || w === 'timestamptz') && this.peek()?.kind === 'string') {
        const ms = parseDate(this.take().text);
        if (ms === null) throw new SqlError(`invalid input syntax for type timestamp: "${this.t[this.i - 1].text}"`);
        o = { kind: 'date', ms, time: true };
      } else if (w === 'interval' && this.peek()?.kind === 'string') o = { kind: 'interval', ...interval(this.take().text) };
      else {
        const k = this.c.columns.indexOf(w);
        if (k < 0) throw new SqlError(`column "${w}" does not exist`);
        const cell = this.row ? this.row[k] : '';
        o = { kind: 'text', value: cell === '' || cell === '\\N' || cell === undefined ? null : cell };
      }
    } else this.fail();
    // A cast: '2029-04-07'::date, '2 years'::interval.
    while (this.peek()?.text === '::') {
      this.take();
      const type = this.take()?.text.toLowerCase();
      const v = o.kind === 'text' ? o.value : null;
      if (type === 'date' || type === 'timestamp' || type === 'timestamptz') {
        if (o.kind === 'date') o = { ...o, time: type !== 'date' };
        else if (v !== null) {
          const ms = parseDate(v);
          if (ms === null) throw new SqlError(`invalid input syntax for type ${type === 'date' ? 'date' : 'timestamp'}: "${v}"`);
          o = { kind: 'date', ms: type === 'date' ? Math.floor(ms / DAY) * DAY : ms, time: type !== 'date' };
        }
      } else if (type === 'interval' && v !== null) o = { kind: 'interval', ...interval(v) };
      else if (type !== 'text' && type !== 'integer' && type !== 'int') this.fail();
    }
    return o;
  }
}

function arithmetic(a: Operand, b: Operand, sign: 1 | -1): Operand {
  if (a.kind === 'date' && b.kind === 'interval') return { kind: 'date', ms: shift(a.ms, b, sign), time: true };
  if (a.kind === 'interval' && b.kind === 'date' && sign === 1) return { kind: 'date', ms: shift(b.ms, a, 1), time: true };
  // date ± integer: days.
  if (a.kind === 'date' && b.kind === 'text' && b.value !== null && /^\d+$/.test(b.value)) return { kind: 'date', ms: a.ms + sign * Number(b.value) * DAY, time: a.time };
  if (a.kind === 'text' && b.kind === 'text' && a.value !== null && b.value !== null && /^-?\d+(\.\d+)?$/.test(a.value) && /^-?\d+(\.\d+)?$/.test(b.value))
    return { kind: 'text', value: String(Number(a.value) + sign * Number(b.value)) };
  if (a.kind === 'text' && a.value !== null && parseDate(a.value) !== null && b.kind === 'interval') return { kind: 'date', ms: shift(parseDate(a.value)!, b, sign), time: true };
  throw new SqlError(`operator does not exist: ${a.kind === 'date' ? 'date' : a.kind} ${sign === 1 ? '+' : '-'} ${b.kind === 'date' ? 'date' : b.kind}`);
}

/** Compares two values (dates by their date, numbers by their value, otherwise as text); null if one is NULL. */
function compare(a: Operand, b: Operand): number | null {
  const date = (o: Operand) => (o.kind === 'date' ? o.ms : o.kind === 'text' && o.value !== null ? parseDate(o.value) : null);
  if (a.kind === 'interval' || b.kind === 'interval') throw new SqlError('operator does not exist: interval = text');
  if ((a.kind === 'text' && a.value === null) || (b.kind === 'text' && b.value === null)) return null;
  if (a.kind === 'date' || b.kind === 'date') {
    const x = date(a);
    const y = date(b);
    if (x === null || y === null) throw new SqlError(`invalid input syntax for type date: "${a.kind === 'text' ? a.value : (b as { value: string }).value}"`);
    return Math.sign(x - y);
  }
  const x = a.value!;
  const y = b.value!;
  if (/^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(y)) return Math.sign(Number(x) - Number(y));
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The rows a WHERE clause keeps (all of them without one); throws SqlError with PostgreSQL's message. */
export function where(columns: string[], rows: string[][], clause: string | undefined, now: number): string[][] {
  if (!clause?.trim()) return rows;
  const t = tokens(clause);
  // Checked once on an empty row, so that a wrong column fails even on an empty table.
  const check = new Parser(t, { columns, now }, null);
  check.condition();
  check.done();
  return rows.filter((row) => {
    const p = new Parser(t, { columns, now }, row);
    return p.condition() === true;
  });
}

/** The values of an INSERT's row: (1, 'text', NULL, current_date) → cells ('' for NULL). */
export function values(list: string, now: number): string[] {
  const t = tokens(list);
  const p = new Parser(t, { columns: [], now }, null);
  const out: string[] = [];
  for (;;) {
    const o = p.expression();
    out.push(o.kind === 'text' ? (o.value ?? '') : o.kind === 'date' ? iso(o.ms, o.time) : '');
    if (p.peek()?.text === ',') p.take();
    else break;
  }
  p.done();
  return out;
}
