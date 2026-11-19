// PromQL, the query language of Prometheus: a parser and an evaluator over
// a storage of time series. Enough of the language for the game's stories:
// selectors with label matchers (=, !=, =~, !~), range vectors and offset,
// the counter functions (rate, irate, increase, delta), deriv and
// predict_linear, the *_over_time functions, abs, absent, time, vector,
// scalar, clamp_min, clamp_max, round; aggregations (sum, avg, min, max,
// count, by and without); arithmetic, comparisons (filtering, or with bool)
// and the set operators (and, or, unless), with one-to-one vector matching
// (on, ignoring). Values and messages follow Prometheus 2.53.
// Sources: https://prometheus.io/docs/prometheus/latest/querying/basics/,
// https://prometheus.io/docs/prometheus/latest/querying/operators/,
// https://prometheus.io/docs/prometheus/latest/querying/functions/
// (rate's extrapolation: promql/functions.go, extrapolatedRate).
// Differences: no subqueries, group_left/group_right, topk, quantiles,
// histogram_quantile, @ modifier nor native histograms.

export type Labels = Record<string, string>;
export interface Sample {
  t: number;
  v: number;
  // A staleness marker: the series ended here (its target is gone or down).
  stale?: boolean;
}
export interface StoredSeries {
  labels: Labels;
  samples: Sample[];
}
export interface Matcher {
  name: string;
  op: '=' | '!=' | '=~' | '!~';
  value: string;
}
/** What the evaluator reads: the series matching, with their samples between two times (ms). */
export interface Storage {
  select(matchers: Matcher[], start: number, end: number): StoredSeries[];
}

export type Node =
  | { kind: 'number'; value: number; pos: number }
  | { kind: 'string'; value: string; pos: number }
  | { kind: 'selector'; name: string | null; matchers: Matcher[]; range: number | null; offset: number; pos: number }
  | { kind: 'call'; fn: string; args: Node[]; pos: number }
  | { kind: 'aggregate'; op: string; expr: Node; grouping: string[]; without: boolean; pos: number }
  | { kind: 'binary'; op: string; lhs: Node; rhs: Node; bool: boolean; on: string[] | null; ignoring: string[] | null; pos: number }
  | { kind: 'unary'; op: '-' | '+'; expr: Node; pos: number }
  | { kind: 'paren'; expr: Node; pos: number };

export type ValueType = 'scalar' | 'vector' | 'matrix' | 'string';

export class PromQLError extends Error {}

// ——— Durations ———

const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000, y: 31_536_000_000 };

/** A Prometheus duration (5m, 1h30m, 90s) in ms; null if it isn't one. */
export function parseDuration(text: string): number | null {
  if (!/^(\d+(ms|s|m|h|d|w|y))+$/.test(text)) return null;
  let total = 0;
  for (const m of text.matchAll(/(\d+)(ms|s|m|h|d|w|y)/g)) total += Number(m[1]) * UNITS[m[2]];
  return total;
}

/** A duration as Prometheus writes it (model.Duration): 5m, 1h30m, 15s. */
export function formatDuration(ms: number): string {
  if (ms === 0) return '0s';
  let rest = ms;
  let out = '';
  for (const [u, v] of [['y', UNITS.y], ['w', UNITS.w], ['d', UNITS.d], ['h', UNITS.h], ['m', UNITS.m], ['s', UNITS.s], ['ms', 1]] as [string, number][]) {
    const n = Math.floor(rest / v);
    if (n) {
      out += `${n}${u}`;
      rest -= n * v;
    }
  }
  return out;
}

// ——— Lexer ———

interface Token {
  type: 'ident' | 'number' | 'duration' | 'string' | 'op' | 'lparen' | 'rparen' | 'lbrace' | 'rbrace' | 'lbracket' | 'rbracket' | 'comma' | 'eof';
  text: string;
  pos: number;
}

const KEYWORDS_AGG = ['sum', 'avg', 'min', 'max', 'count'];
const OPERATORS = ['==', '!=', '>=', '<=', '=~', '!~', '+', '-', '*', '/', '%', '^', '>', '<', '='];

function lex(input: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    const start = i;
    if (c === '"' || c === "'" || c === '`') {
      i++;
      let value = '';
      while (i < input.length && input[i] !== c) {
        if (input[i] === '\\' && c !== '`') {
          const n = input[i + 1];
          value += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          i += 2;
        } else value += input[i++];
      }
      if (i >= input.length) throw new PromQLError(`${position(input, start)}: parse error: unterminated quoted string ${c}`);
      i++;
      out.push({ type: 'string', text: value, pos: start });
      continue;
    }
    if (/[0-9.]/.test(c) && (c !== '.' || /[0-9]/.test(input[i + 1] ?? ''))) {
      const m = /^(?:0x[0-9a-fA-F]+|(?:\d+(?:ms|s|m|h|d|w|y))+(?![\w.])|\d*\.?\d+(?:[eE][+-]?\d+)?)/.exec(input.slice(i));
      const text = m ? m[0] : c;
      const word = /^[\w.]+/.exec(input.slice(i))![0];
      if (word.length > text.length && !/^\d*\.?\d+[eE]/.test(word)) throw new PromQLError(`${position(input, start)}: parse error: bad number or duration syntax: "${word}"`);
      i += text.length;
      out.push({ type: parseDuration(text) !== null && !/^\d+$/.test(text) ? 'duration' : 'number', text, pos: start });
      continue;
    }
    if (/[A-Za-z_:]/.test(c)) {
      const m = /^[A-Za-z_:][\w:]*/.exec(input.slice(i))!;
      i += m[0].length;
      out.push({ type: 'ident', text: m[0], pos: start });
      continue;
    }
    const pairs: Record<string, Token['type']> = { '(': 'lparen', ')': 'rparen', '{': 'lbrace', '}': 'rbrace', '[': 'lbracket', ']': 'rbracket', ',': 'comma' };
    if (pairs[c]) {
      out.push({ type: pairs[c], text: c, pos: start });
      i++;
      continue;
    }
    const op = OPERATORS.find((o) => input.startsWith(o, i));
    if (op) {
      out.push({ type: 'op', text: op, pos: start });
      i += op.length;
      continue;
    }
    throw new PromQLError(`${position(input, start)}: parse error: unexpected character: '${c}'`);
  }
  out.push({ type: 'eof', text: '', pos: input.length });
  return out;
}

/** Line:column of an offset, as Prometheus writes them (1:5). */
function position(input: string, offset: number): string {
  const before = input.slice(0, offset).split('\n');
  return `${before.length}:${before.at(-1)!.length + 1}`;
}

// ——— Parser ———

const PRECEDENCE: Record<string, number> = { or: 1, and: 2, unless: 2, '==': 3, '!=': 3, '<=': 3, '<': 3, '>=': 3, '>': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5, '^': 6 };
const COMPARISONS = ['==', '!=', '<=', '<', '>=', '>'];
const SET_OPS = ['and', 'or', 'unless'];

export const FUNCTIONS: Record<string, { args: ValueType[]; optional?: number; returns: ValueType }> = {
  rate: { args: ['matrix'], returns: 'vector' },
  irate: { args: ['matrix'], returns: 'vector' },
  increase: { args: ['matrix'], returns: 'vector' },
  delta: { args: ['matrix'], returns: 'vector' },
  deriv: { args: ['matrix'], returns: 'vector' },
  predict_linear: { args: ['matrix', 'scalar'], returns: 'vector' },
  avg_over_time: { args: ['matrix'], returns: 'vector' },
  min_over_time: { args: ['matrix'], returns: 'vector' },
  max_over_time: { args: ['matrix'], returns: 'vector' },
  sum_over_time: { args: ['matrix'], returns: 'vector' },
  count_over_time: { args: ['matrix'], returns: 'vector' },
  last_over_time: { args: ['matrix'], returns: 'vector' },
  abs: { args: ['vector'], returns: 'vector' },
  absent: { args: ['vector'], returns: 'vector' },
  clamp_min: { args: ['vector', 'scalar'], returns: 'vector' },
  clamp_max: { args: ['vector', 'scalar'], returns: 'vector' },
  round: { args: ['vector', 'scalar'], optional: 1, returns: 'vector' },
  time: { args: [], returns: 'scalar' },
  vector: { args: ['scalar'], returns: 'vector' },
  scalar: { args: ['vector'], returns: 'scalar' },
};

const typeName = (t: ValueType) => (t === 'matrix' ? 'range vector' : t === 'vector' ? 'instant vector' : t);

/** The type an expression gives. */
export function typeOf(n: Node): ValueType {
  switch (n.kind) {
    case 'number':
      return 'scalar';
    case 'string':
      return 'string';
    case 'selector':
      return n.range !== null ? 'matrix' : 'vector';
    case 'call':
      return FUNCTIONS[n.fn].returns;
    case 'aggregate':
      return 'vector';
    case 'binary':
      return typeOf(n.lhs) === 'scalar' && typeOf(n.rhs) === 'scalar' ? 'scalar' : 'vector';
    case 'unary':
    case 'paren':
      return typeOf(n.expr);
  }
}

function describe(t: Token): string {
  if (t.type === 'eof') return 'end of input';
  if (t.type === 'ident') return SET_OPS.includes(t.text) || ['by', 'without', 'on', 'ignoring', 'bool', 'offset'].includes(t.text) ? `<${t.text}>` : `identifier "${t.text}"`;
  if (t.type === 'number') return `number "${t.text}"`;
  if (t.type === 'duration') return `duration "${t.text}"`;
  if (t.type === 'string') return `string "${t.text}"`;
  if (t.type === 'rparen') return "right parenthesis ')'";
  if (t.type === 'lparen') return "left parenthesis '('";
  if (t.type === 'rbrace') return "'}'";
  if (t.type === 'lbrace') return "'{'";
  if (t.type === 'rbracket') return "']'";
  if (t.type === 'lbracket') return "'['";
  if (t.type === 'comma') return '","';
  return `<op:${t.text}>`;
}

/** Parses a PromQL expression; throws PromQLError with Prometheus's message ("1:7: parse error: …"). */
export function parse(input: string): Node {
  const tokens = lex(input);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const fail = (t: Token, message: string): never => {
    throw new PromQLError(`${position(input, t.pos)}: parse error: ${message}`);
  };
  const unexpected = (t: Token, context = ''): never => fail(t, `unexpected ${describe(t)}${context}`);
  const expect = (type: Token['type'], context: string) => {
    const t = next();
    if (t.type !== type) unexpected(t, context);
    return t;
  };

  const labelList = (): string[] => {
    expect('lparen', ' in grouping opts, expected "("');
    const out: string[] = [];
    while (peek().type !== 'rparen') {
      const t = next();
      if (t.type !== 'ident') unexpected(t, ' in grouping opts, expected label');
      out.push(t.text);
      if (peek().type === 'comma') next();
      else if (peek().type !== 'rparen') unexpected(peek(), ' in grouping opts, expected "," or ")"');
    }
    next();
    return out;
  };

  const matchers = (): Matcher[] => {
    const out: Matcher[] = [];
    while (peek().type !== 'rbrace') {
      const name = next();
      if (name.type !== 'ident') unexpected(name, ' in label matching, expected label');
      const op = next();
      if (op.type !== 'op' || !['=', '!=', '=~', '!~'].includes(op.text)) unexpected(op, ' in label matching, expected one of "=", "!=", "=~" or "!~"');
      const value = next();
      if (value.type !== 'string') unexpected(value, ' in label matching, expected string');
      if (op.text === '=~' || op.text === '!~') {
        try {
          new RegExp(`^(?:${value.text})$`);
        } catch {
          fail(value, `error parsing regexp: invalid or unsupported Perl syntax: \`${value.text}\``);
        }
      }
      out.push({ name: name.text, op: op.text as Matcher['op'], value: value.text });
      if (peek().type === 'comma') next();
      else if (peek().type !== 'rbrace') unexpected(peek(), ' in label matching, expected "," or "}"');
    }
    next();
    return out;
  };

  const suffixes = (n: Node): Node => {
    let node = n;
    for (;;) {
      const t = peek();
      if (t.type === 'lbracket') {
        next();
        const d = next();
        if (d.type !== 'duration' && d.type !== 'number') unexpected(d, ' in subquery or range selector, expected duration');
        const ms = d.type === 'number' ? Number(d.text) * 1000 : parseDuration(d.text)!;
        if (peek().type === 'op' && peek().text === ':') fail(peek(), 'subqueries are not supported in this game');
        expect('rbracket', ' in range selector, expected "]"');
        if (node.kind !== 'selector' || node.range !== null) fail(t, 'ranges only allowed for vector selectors');
        node = { ...(node as Extract<Node, { kind: 'selector' }>), range: ms };
        continue;
      }
      if (t.type === 'ident' && t.text === 'offset') {
        next();
        const sign = peek().type === 'op' && peek().text === '-' ? (next(), -1) : 1;
        const d = next();
        if (d.type !== 'duration') unexpected(d, ', expected duration');
        if (node.kind !== 'selector') fail(t, 'offset modifier must be preceded by an instant vector selector or range vector selector or a subquery');
        node = { ...(node as Extract<Node, { kind: 'selector' }>), offset: sign * parseDuration(d.text)! };
        continue;
      }
      return node;
    }
  };

  const primary = (): Node => {
    const t = next();
    if (t.type === 'number') return suffixes({ kind: 'number', value: Number(t.text), pos: t.pos });
    if (t.type === 'duration') return fail(t, `unexpected duration "${t.text}"`);
    if (t.type === 'string') return { kind: 'string', value: t.text, pos: t.pos };
    if (t.type === 'op' && (t.text === '-' || t.text === '+')) {
      const e = unary();
      if (e.kind === 'number') return { ...e, value: t.text === '-' ? -e.value : e.value };
      return { kind: 'unary', op: t.text as '-' | '+', expr: e, pos: t.pos };
    }
    if (t.type === 'lparen') {
      const e = expression(0);
      if (peek().type !== 'rparen') {
        if (peek().type === 'eof') fail(peek(), 'unclosed left parenthesis');
        unexpected(peek(), ', expected ")"');
      }
      next();
      return suffixes({ kind: 'paren', expr: e, pos: t.pos });
    }
    if (t.type === 'lbrace') {
      const ms = matchers();
      if (!ms.some((m) => !matches({}, [m]))) fail(t, 'vector selector must contain at least one non-empty matcher');
      const name = ms.find((m) => m.name === '__name__' && m.op === '=')?.value ?? null;
      return suffixes({ kind: 'selector', name, matchers: ms, range: null, offset: 0, pos: t.pos });
    }
    if (t.type === 'ident') {
      const word = t.text;
      if (KEYWORDS_AGG.includes(word) && (peek().type === 'lparen' || (peek().type === 'ident' && ['by', 'without'].includes(peek().text)))) {
        let grouping: string[] = [];
        let without = false;
        let grouped = false;
        if (peek().type === 'ident') {
          without = next().text === 'without';
          grouping = labelList();
          grouped = true;
        }
        expect('lparen', ` in aggregation, expected "("`);
        const inner = expression(0);
        if (peek().type === 'comma') fail(peek(), `wrong number of arguments for aggregate expression provided, expected 1, got 2`);
        if (peek().type !== 'rparen') {
          if (peek().type === 'eof') fail(peek(), 'unclosed left parenthesis');
          unexpected(peek(), ', expected ")"');
        }
        next();
        if (!grouped && peek().type === 'ident' && ['by', 'without'].includes(peek().text)) {
          without = next().text === 'without';
          grouping = labelList();
        }
        if (typeOf(inner) !== 'vector') fail(t, `expected type instant vector in aggregation expression, got ${typeName(typeOf(inner))}`);
        return { kind: 'aggregate', op: word, expr: inner, grouping, without, pos: t.pos };
      }
      if (peek().type === 'lparen' && !SET_OPS.includes(word)) {
        if (!FUNCTIONS[word]) fail(t, `unknown function with name "${word}"`);
        next();
        const args: Node[] = [];
        while (peek().type !== 'rparen') {
          if (peek().type === 'eof') fail(peek(), 'unclosed left parenthesis');
          args.push(expression(0));
          if (peek().type === 'comma') next();
          else if (peek().type !== 'rparen') {
            if (peek().type === 'eof') fail(peek(), 'unclosed left parenthesis');
            unexpected(peek(), ', expected "," or ")"');
          }
        }
        next();
        const f = FUNCTIONS[word];
        const min = f.args.length - (f.optional ?? 0);
        if (args.length < min || args.length > f.args.length) fail(t, `expected ${f.args.length} argument(s) in call to "${word}", got ${args.length}`);
        args.forEach((a, k) => {
          const got = typeOf(a);
          if (got !== f.args[k]) fail({ type: 'eof', text: '', pos: a.pos }, `expected type ${typeName(f.args[k])} in call to function "${word}", got ${typeName(got)}`);
        });
        return { kind: 'call', fn: word, args, pos: t.pos };
      }
      if (['by', 'without', 'on', 'ignoring', 'bool', 'offset', ...SET_OPS].includes(word)) unexpected(t);
      if (word === 'inf' || word === 'Inf' || word === 'NaN' || word === 'nan') return { kind: 'number', value: word.toLowerCase() === 'nan' ? NaN : Infinity, pos: t.pos };
      const ms: Matcher[] = [{ name: '__name__', op: '=', value: word }];
      if (peek().type === 'lbrace') {
        next();
        ms.push(...matchers());
      }
      return suffixes({ kind: 'selector', name: word, matchers: ms, range: null, offset: 0, pos: t.pos });
    }
    return unexpected(t);
  };

  // A unary minus binds tighter than every binary operator except ^.
  const unary = (): Node => {
    const base = primary();
    if (peek().type === 'op' && peek().text === '^') {
      next();
      return { kind: 'binary', op: '^', lhs: base, rhs: unary(), bool: false, on: null, ignoring: null, pos: base.pos };
    }
    return base;
  };

  const opOf = (t: Token): string | null => {
    if (t.type === 'op' && PRECEDENCE[t.text] !== undefined) return t.text;
    if (t.type === 'ident' && SET_OPS.includes(t.text)) return t.text;
    return null;
  };

  const expression = (min: number): Node => {
    let lhs = unary();
    for (;;) {
      const t = peek();
      if (t.type === 'op' && t.text === '=') fail(t, `unexpected <op:=>, expected label matching operator in a selector`);
      const op = opOf(t);
      if (!op || op === '^' || PRECEDENCE[op] < min) break;
      next();
      let bool = false;
      let on: string[] | null = null;
      let ignoring: string[] | null = null;
      if (peek().type === 'ident' && peek().text === 'bool') {
        next();
        bool = true;
      }
      if (peek().type === 'ident' && ['on', 'ignoring'].includes(peek().text)) {
        const which = next().text;
        const list = labelList();
        if (which === 'on') on = list;
        else ignoring = list;
        if (peek().type === 'ident' && ['group_left', 'group_right'].includes(peek().text)) fail(peek(), `${peek().text} is not supported in this game`);
      }
      const rhs = expression(PRECEDENCE[op] + 1);
      if (rhs.kind === 'string' || lhs.kind === 'string') fail(t, 'binary expression must contain only scalar and instant vector types');
      const lt = typeOf(lhs);
      const rt = typeOf(rhs);
      if (lt === 'matrix' || rt === 'matrix') fail(t, 'binary expression must contain only scalar and instant vector types');
      if (bool && !COMPARISONS.includes(op)) fail(t, 'bool modifier can only be used on comparison operators');
      if (COMPARISONS.includes(op) && lt === 'scalar' && rt === 'scalar' && !bool) fail(t, 'comparisons between scalars must use BOOL modifier');
      if (SET_OPS.includes(op) && (lt !== 'vector' || rt !== 'vector')) fail(t, `set operator "${op}" not allowed in binary scalar expression`);
      lhs = { kind: 'binary', op, lhs, rhs, bool, on, ignoring, pos: lhs.pos };
    }
    return lhs;
  };

  if (tokens[0].type === 'eof') throw new PromQLError('1:1: parse error: no expression found in input');
  const root = expression(0);
  if (peek().type !== 'eof') unexpected(peek());
  return root;
}


/** Does a label set match these matchers? (An absent label is the empty string.) */
export function matches(labels: Labels, ms: Matcher[]): boolean {
  return ms.every((m) => {
    const v = labels[m.name] ?? '';
    switch (m.op) {
      case '=':
        return v === m.value;
      case '!=':
        return v !== m.value;
      case '=~':
        return new RegExp(`^(?:${m.value})$`).test(v);
      case '!~':
        return !new RegExp(`^(?:${m.value})$`).test(v);
    }
  });
}

/** Prometheus's way of writing a label set: {a="1", b="2"}, sorted, __name__ in front. */
export function labelsText(l: Labels): string {
  const name = l.__name__ ?? '';
  const rest = Object.keys(l)
    .filter((k) => k !== '__name__')
    .sort()
    .map((k) => `${k}="${l[k].replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
  return `${name}{${rest.join(', ')}}`;
}
export const signature = (l: Labels) => labelsText(l);

// ——— Evaluation ———

export interface VectorSample {
  labels: Labels;
  v: number;
}
export type Value =
  | { type: 'scalar'; v: number }
  | { type: 'string'; v: string }
  | { type: 'vector'; samples: VectorSample[] }
  | { type: 'matrix'; series: { labels: Labels; samples: Sample[] }[] };

export interface Evaluation {
  value: Value;
  // Prometheus's annotations ("PromQL info: metric might not be a counter…").
  infos: string[];
}

const LOOKBACK = 5 * 60_000;
const withoutName = (l: Labels): Labels => {
  const { __name__: _, ...rest } = l;
  void _;
  return rest;
};

/** Evaluates an expression at time t (ms). Throws PromQLError on an execution error. */
export function evaluate(node: Node, storage: Storage, t: number, input = ''): Evaluation {
  const infos: string[] = [];
  const at = (n: Node) => (input ? ` (${position(input, n.pos)})` : '');

  const instant = (n: Extract<Node, { kind: 'selector' }>): VectorSample[] => {
    const end = t - n.offset;
    const out: VectorSample[] = [];
    for (const s of storage.select(n.matchers, end - LOOKBACK, end)) {
      const last = lastBefore(s.samples, end);
      if (!last || last.t <= end - LOOKBACK || last.stale) continue;
      out.push({ labels: { ...s.labels }, v: last.v });
    }
    return out;
  };
  const range = (n: Extract<Node, { kind: 'selector' }>) => {
    const end = t - n.offset;
    const start = end - (n.range ?? 0);
    return storage
      .select(n.matchers, start, end)
      .map((s) => ({ labels: { ...s.labels }, samples: s.samples.filter((x) => x.t >= start && x.t <= end && !x.stale) }))
      .filter((s) => s.samples.length);
  };

  const ev = (n: Node): Value => {
    switch (n.kind) {
      case 'number':
        return { type: 'scalar', v: n.value };
      case 'string':
        return { type: 'string', v: n.value };
      case 'paren':
        return ev(n.expr);
      case 'unary': {
        const v = ev(n.expr);
        if (n.op === '+') return v;
        if (v.type === 'scalar') return { type: 'scalar', v: -v.v };
        if (v.type === 'vector') return { type: 'vector', samples: v.samples.map((s) => ({ labels: withoutName(s.labels), v: -s.v })) };
        return v;
      }
      case 'selector':
        return n.range !== null ? { type: 'matrix', series: range(n) } : { type: 'vector', samples: instant(n) };
      case 'call':
        return call(n);
      case 'aggregate':
        return aggregate(n);
      case 'binary':
        return binary(n);
    }
  };

  const counterCheck = (n: Node) => {
    const sel = n.kind === 'selector' ? n : null;
    const name = sel?.name;
    if (name && !/(_total|_sum|_count|_bucket)$/.test(name)) infos.push(`PromQL info: metric might not be a counter, name does not end in _total/_sum/_count/_bucket: "${name}"${at(n)}`);
  };

  const call = (n: Extract<Node, { kind: 'call' }>): Value => {
    const args = n.args.map(ev);
    const matrix = () => (args[0] as Extract<Value, { type: 'matrix' }>).series;
    const rangeOf = () => (n.args[0] as Extract<Node, { kind: 'selector' }>).range ?? 0;
    const offsetOf = () => (n.args[0] as Extract<Node, { kind: 'selector' }>).offset ?? 0;
    const each = (f: (s: Sample[]) => number | null): Value => ({
      type: 'vector',
      samples: matrix()
        .map((s) => ({ labels: withoutName(s.labels), v: f(s.samples) }))
        .filter((x): x is VectorSample => x.v !== null),
    });
    switch (n.fn) {
      case 'rate':
      case 'increase':
      case 'delta': {
        if (n.fn !== 'delta') counterCheck(n.args[0]);
        const end = t - offsetOf();
        return each((s) => extrapolatedRate(s, end - rangeOf(), end, n.fn !== 'delta', n.fn === 'rate'));
      }
      case 'irate':
        counterCheck(n.args[0]);
        return each((s) => {
          if (s.length < 2) return null;
          const [a, b] = s.slice(-2);
          const dv = b.v < a.v ? b.v : b.v - a.v;
          return dv / ((b.t - a.t) / 1000);
        });
      case 'deriv':
        return each((s) => (s.length < 2 ? null : regression(s, t)[0]));
      case 'predict_linear': {
        const ahead = (args[1] as Extract<Value, { type: 'scalar' }>).v;
        return each((s) => {
          if (s.length < 2) return null;
          const [slope, intercept] = regression(s, t);
          return slope * ahead + intercept;
        });
      }
      case 'avg_over_time':
        return each((s) => s.reduce((a, x) => a + x.v, 0) / s.length);
      case 'min_over_time':
        return each((s) => Math.min(...s.map((x) => x.v)));
      case 'max_over_time':
        return each((s) => Math.max(...s.map((x) => x.v)));
      case 'sum_over_time':
        return each((s) => s.reduce((a, x) => a + x.v, 0));
      case 'count_over_time':
        return each((s) => s.length);
      case 'last_over_time':
        return { type: 'vector', samples: matrix().map((s) => ({ labels: s.labels, v: s.samples.at(-1)!.v })) };
      case 'abs':
      case 'clamp_min':
      case 'clamp_max':
      case 'round': {
        const v = args[0] as Extract<Value, { type: 'vector' }>;
        const k = args[1] ? (args[1] as Extract<Value, { type: 'scalar' }>).v : 1;
        const f = (x: number) => (n.fn === 'abs' ? Math.abs(x) : n.fn === 'clamp_min' ? Math.max(x, k) : n.fn === 'clamp_max' ? Math.min(x, k) : Math.floor(x / k + 0.5) * k);
        return { type: 'vector', samples: v.samples.map((s) => ({ labels: withoutName(s.labels), v: f(s.v) })) };
      }
      case 'absent': {
        const v = args[0] as Extract<Value, { type: 'vector' }>;
        if (v.samples.length) return { type: 'vector', samples: [] };
        const sel = n.args[0].kind === 'selector' ? n.args[0] : null;
        const labels: Labels = {};
        for (const m of sel?.matchers ?? []) if (m.op === '=' && m.name !== '__name__') labels[m.name] = m.value;
        return { type: 'vector', samples: [{ labels, v: 1 }] };
      }
      case 'time':
        return { type: 'scalar', v: t / 1000 };
      case 'vector':
        return { type: 'vector', samples: [{ labels: {}, v: (args[0] as Extract<Value, { type: 'scalar' }>).v }] };
      case 'scalar': {
        const v = args[0] as Extract<Value, { type: 'vector' }>;
        return { type: 'scalar', v: v.samples.length === 1 ? v.samples[0].v : NaN };
      }
    }
    throw new PromQLError(`unknown function "${n.fn}"`);
  };

  const aggregate = (n: Extract<Node, { kind: 'aggregate' }>): Value => {
    const v = ev(n.expr) as Extract<Value, { type: 'vector' }>;
    const groups = new Map<string, { labels: Labels; values: number[] }>();
    for (const s of v.samples) {
      const base = withoutName(s.labels);
      const labels: Labels = n.without
        ? Object.fromEntries(Object.entries(base).filter(([k]) => !n.grouping.includes(k)))
        : Object.fromEntries(n.grouping.filter((k) => s.labels[k] !== undefined && s.labels[k] !== '').map((k) => [k, s.labels[k]]));
      const key = labelsText(labels);
      const g = groups.get(key) ?? { labels, values: [] };
      g.values.push(s.v);
      groups.set(key, g);
    }
    const samples: VectorSample[] = [];
    for (const g of groups.values()) {
      const xs = g.values;
      const v =
        n.op === 'sum'
          ? xs.reduce((a, b) => a + b, 0)
          : n.op === 'avg'
            ? xs.reduce((a, b) => a + b, 0) / xs.length
            : n.op === 'min'
              ? xs.reduce((a, b) => (Number.isNaN(a) || b < a ? b : a))
              : n.op === 'max'
                ? xs.reduce((a, b) => (Number.isNaN(a) || b > a ? b : a))
                : xs.length;
      samples.push({ labels: g.labels, v });
    }
    return { type: 'vector', samples };
  };

  const compare = (op: string, a: number, b: number): boolean => {
    switch (op) {
      case '==':
        return a === b;
      case '!=':
        return a !== b;
      case '>':
        return a > b;
      case '<':
        return a < b;
      case '>=':
        return a >= b;
      case '<=':
        return a <= b;
    }
    return false;
  };
  const arith = (op: string, a: number, b: number): number => {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return a / b;
      case '%':
        return a % b;
      case '^':
        return a ** b;
    }
    return NaN;
  };

  const binary = (n: Extract<Node, { kind: 'binary' }>): Value => {
    const l = ev(n.lhs);
    const r = ev(n.rhs);
    const cmp = COMPARISONS.includes(n.op);
    if (l.type === 'scalar' && r.type === 'scalar') return { type: 'scalar', v: cmp ? (compare(n.op, l.v, r.v) ? 1 : 0) : arith(n.op, l.v, r.v) };
    if (l.type === 'vector' && r.type === 'scalar') return { type: 'vector', samples: scalarOp(l.samples, r.v, false) };
    if (l.type === 'scalar' && r.type === 'vector') return { type: 'vector', samples: scalarOp(r.samples, l.v, true) };
    const lv = (l as Extract<Value, { type: 'vector' }>).samples;
    const rv = (r as Extract<Value, { type: 'vector' }>).samples;
    const sig = (s: Labels) => {
      const base = withoutName(s);
      if (n.on) return labelsText(Object.fromEntries(n.on.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])));
      if (n.ignoring) return labelsText(Object.fromEntries(Object.entries(base).filter(([k]) => !n.ignoring!.includes(k))));
      return labelsText(base);
    };
    if (SET_OPS.includes(n.op)) {
      const rs = new Set(rv.map((s) => sig(s.labels)));
      if (n.op === 'and') return { type: 'vector', samples: lv.filter((s) => rs.has(sig(s.labels))) };
      if (n.op === 'unless') return { type: 'vector', samples: lv.filter((s) => !rs.has(sig(s.labels))) };
      const ls = new Set(lv.map((s) => sig(s.labels)));
      return { type: 'vector', samples: [...lv, ...rv.filter((s) => !ls.has(sig(s.labels)))] };
    }
    const right = new Map<string, VectorSample>();
    for (const s of rv) {
      const k = sig(s.labels);
      if (right.has(k))
        throw new PromQLError(
          `found duplicate series for the match group ${k} on the right hand-side of the operation: [${labelsText(right.get(k)!.labels)}, ${labelsText(s.labels)}];many-to-many matching not allowed: matching labels must be unique on one side`,
        );
      right.set(k, s);
    }
    const seen = new Set<string>();
    const out: VectorSample[] = [];
    for (const s of lv) {
      const k = sig(s.labels);
      const o = right.get(k);
      if (!o) continue;
      if (seen.has(k))
        throw new PromQLError(`found duplicate series for the match group ${k} on the left hand-side of the operation: [${labelsText(s.labels)}];many-to-many matching not allowed: matching labels must be unique on one side`);
      seen.add(k);
      let labels = !cmp || n.bool ? withoutName(s.labels) : { ...s.labels };
      if (n.on) labels = Object.fromEntries(n.on.filter((x) => s.labels[x] !== undefined).map((x) => [x, s.labels[x]]));
      else if (n.ignoring) labels = Object.fromEntries(Object.entries(labels).filter(([x]) => !n.ignoring!.includes(x)));
      if (cmp) {
        const ok = compare(n.op, s.v, o.v);
        if (n.bool) out.push({ labels, v: ok ? 1 : 0 });
        else if (ok) out.push({ labels, v: s.v });
      } else out.push({ labels, v: arith(n.op, s.v, o.v) });
    }
    return { type: 'vector', samples: out };

    function scalarOp(samples: VectorSample[], k: number, swap: boolean): VectorSample[] {
      const res: VectorSample[] = [];
      for (const s of samples) {
        const [a, b] = swap ? [k, s.v] : [s.v, k];
        if (cmp) {
          const ok = compare(n.op, a, b);
          if (n.bool) res.push({ labels: withoutName(s.labels), v: ok ? 1 : 0 });
          else if (ok) res.push({ labels: s.labels, v: s.v });
        } else res.push({ labels: withoutName(s.labels), v: arith(n.op, a, b) });
      }
      return res;
    }
  };

  const value = ev(node);
  return { value, infos: [...new Set(infos)] };
}

/** The last sample at or before t (binary search). */
export function lastBefore(samples: Sample[], t: number): Sample | null {
  let lo = 0;
  let hi = samples.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found >= 0 ? samples[found] : null;
}

/** Prometheus's rate/increase/delta: the change over the range, extrapolated to its edges. */
function extrapolatedRate(s: Sample[], rangeStart: number, rangeEnd: number, isCounter: boolean, isRate: boolean): number | null {
  if (s.length < 2) return null;
  const first = s[0];
  const last = s.at(-1)!;
  let result = last.v - first.v;
  if (isCounter) for (let k = 1; k < s.length; k++) if (s[k].v < s[k - 1].v) result += s[k - 1].v;
  let toStart = (first.t - rangeStart) / 1000;
  const toEnd = (rangeEnd - last.t) / 1000;
  const sampled = (last.t - first.t) / 1000;
  const average = sampled / (s.length - 1);
  if (isCounter && result > 0 && first.v >= 0) {
    const toZero = sampled * (first.v / result);
    if (toZero < toStart) toStart = toZero;
  }
  const threshold = average * 1.1;
  let interval = sampled;
  interval += toStart < threshold ? toStart : average / 2;
  interval += toEnd < threshold ? toEnd : average / 2;
  result *= interval / sampled;
  if (isRate) result /= (rangeEnd - rangeStart) / 1000;
  return result;
}

/** Least squares over the samples, time relative to t: [slope per second, value at t]. */
function regression(s: Sample[], t: number): [number, number] {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sx2 = 0;
  for (const p of s) {
    const x = (p.t - t) / 1000;
    n++;
    sx += x;
    sy += p.v;
    sxy += x * p.v;
    sx2 += x * x;
  }
  const cov = sxy - (sx * sy) / n;
  const varx = sx2 - (sx * sx) / n;
  const slope = cov / varx;
  return [slope, sy / n - (slope * sx) / n];
}

// ——— Writing values as Prometheus does ———

/** A float as Go's strconv.FormatFloat(v, 'f', -1, 64): 0.05, 1715505600.123, NaN, +Inf. */
export function formatValue(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return '+Inf';
  if (v === -Infinity) return '-Inf';
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return v.toFixed(0);
  const s = String(v);
  if (!s.includes('e')) return s;
  // Small numbers: Go writes them without an exponent.
  const [mantissa, exp] = s.split('e');
  const e = Number(exp);
  const digits = mantissa.replace('-', '').replace('.', '');
  const sign = v < 0 ? '-' : '';
  if (e < 0) return `${sign}0.${'0'.repeat(-e - 1)}${digits}`;
  return `${sign}${digits}${'0'.repeat(Math.max(0, e - (digits.length - 1)))}`;
}

/** A float as Go's strconv.FormatFloat(v, 'e', -1, 64): 7.2e-02 (the alerts' value). */
export function formatExp(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (!Number.isFinite(v)) return v > 0 ? '+Inf' : '-Inf';
  const [m, e] = v.toExponential().split('e');
  const n = Number(e);
  return `${m}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`;
}

/** A timestamp (ms) as Prometheus's API writes it: seconds, with milliseconds if any. */
export const seconds = (t: number) => Math.round(t) / 1000;
