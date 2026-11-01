// awk : un petit langage pour découper des lignes en champs, filtrer et
// compter. Debian installe mawk (awk est un lien vers lui) ; on suit POSIX
// (https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html) et
// les messages de mawk.
// Ce qui est simulé : BEGIN, END, motifs (expressions, /regex/), actions
// (print, printf, if/else, for, for…in, while, next, delete), champs ($1,
// $NF, $0), NR, NF, FS, OFS, tableaux associatifs, opérateurs (arithmétique,
// comparaisons, ~ et !~, &&, ||, !, concaténation, ++, +=…), fonctions
// length, substr, index, split, sub, gsub, tolower, toupper, int, sprintf ;
// options -F et -v.
// Écarts : pas de getline, de redirection dans print, de fonctions définies
// par l'utilisateur, ni d'opérateur ternaire.

import type { Command } from './index';

type Value = string | number;

class AwkError extends Error {}

// ——— Découpage en jetons ———

interface Token {
  type: 'number' | 'string' | 'regex' | 'name' | 'word' | 'op' | 'end';
  value: string;
}

const WORDS = ['BEGIN', 'END', 'print', 'printf', 'if', 'else', 'for', 'in', 'while', 'next', 'delete', 'getline'];
const OPS = [
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '!~',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  ';',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '!',
  '~',
  '=',
  '$',
  '\n',
];

function tokens(source: string): Token[] {
  const listing: Token[] = [];
  let i = 0;
  // Un / commence une regex là où on attend une valeur.
  const waitsValue = () => {
    const d = listing.at(-1);
    if (!d) return true;
    if (d.type === 'number' || d.type === 'string' || d.type === 'regex' || d.type === 'name') return false;
    return !(d.type === 'op' && [')', ']', '++', '--', '$'].includes(d.value));
  };
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '\\' && source[i + 1] === '\n') {
      i += 2;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/.exec(source.slice(i))!;
      listing.push({ type: 'number', value: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') {
          const e = source[++i];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
        } else s += source[i];
        i++;
      }
      if (source[i] !== '"') throw new AwkError('runaway string constant "' + s.slice(0, 10) + ' ...');
      i++;
      listing.push({ type: 'string', value: s });
      continue;
    }
    if (c === '/' && waitsValue()) {
      let r = '';
      i++;
      while (i < source.length && source[i] !== '/') {
        if (source[i] === '\\' && source[i + 1] === '/') r += source[++i];
        else r += source[i];
        i++;
      }
      if (source[i] !== '/') throw new AwkError('runaway regular expression /' + r.slice(0, 10) + ' ...');
      i++;
      listing.push({ type: 'regex', value: r });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      listing.push({ type: WORDS.includes(m[0]) ? 'word' : 'name', value: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => source.startsWith(o, i));
    if (!op) throw new AwkError(`syntax error at or near ${c}`);
    listing.push({ type: 'op', value: op });
    i += op.length;
  }
  listing.push({ type: 'end', value: 'end of file' });
  return listing;
}

// ——— Arbre ———

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'regex'; v: string }
  | { t: 'var'; name: string }
  | { t: 'champ'; e: Node }
  | { t: 'elem'; name: string; key: Node[] }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'unary'; op: string; e: Node }
  | { t: 'affect'; op: string; target: Node; e: Node }
  | { t: 'incr'; op: string; pre: boolean; target: Node }
  | { t: 'in'; key: Node[]; grid: string }
  | { t: 'appel'; name: string; args: Node[] }
  | { t: 'groupe'; e: Node };

type Instr =
  | { t: 'expr'; e: Node }
  | { t: 'print'; args: Node[] }
  | { t: 'printf'; args: Node[] }
  | { t: 'if'; cond: Node; then: Instr; otherwise?: Instr }
  | { t: 'pourDans'; variable: string; grid: string; body: Instr }
  | { t: 'for'; init?: Instr; cond?: Node; not?: Instr; body: Instr }
  | { t: 'while'; cond: Node; body: Instr }
  | { t: 'block'; body: Instr[] }
  | { t: 'next' }
  | { t: 'delete'; name: string; key?: Node[] };

interface Rule {
  when: 'BEGIN' | 'END' | 'line';
  pattern?: Node;
  action?: Instr;
}

const FUNCTIONS = ['length', 'substr', 'index', 'split', 'sub', 'gsub', 'tolower', 'toupper', 'int', 'sprintf', 'match'];

function parse(source: string): Rule[] {
  const j = tokens(source);
  let p = 0;
  const see = (v?: string) => (v === undefined ? j[p] : j[p].value === v && j[p].type !== 'string' ? j[p] : null);
  const error = (): never => {
    throw new AwkError(`syntax error at or near ${j[p].type === 'end' ? 'end of file' : j[p].value === '\n' ? 'end of line' : j[p].value}`);
  };
  const wait = (v: string) => (see(v) ? j[p++] : error());
  const skipLines = () => {
    while (see('\n') || see(';')) p++;
  };
  const skipNl = () => {
    while (see('\n')) p++;
  };

  // Expressions, de la priorité la plus basse à la plus haute.
  const expression = (withoutSup = false): Node => affectation(withoutSup);
  const affectation = (withoutSup: boolean): Node => {
    const gauche = or(withoutSup);
    const op = ['=', '+=', '-=', '*=', '/=', '%='].find((o) => see(o));
    if (op && (gauche.t === 'var' || gauche.t === 'champ' || gauche.t === 'elem')) {
      p++;
      return { t: 'affect', op, target: gauche, e: affectation(withoutSup) };
    }
    return gauche;
  };
  const or = (s: boolean): Node => {
    let a = and(s);
    while (see('||')) {
      p++;
      skipNl();
      a = { t: 'bin', op: '||', a, b: and(s) };
    }
    return a;
  };
  const and = (s: boolean): Node => {
    let a = inside(s);
    while (see('&&')) {
      p++;
      skipNl();
      a = { t: 'bin', op: '&&', a, b: inside(s) };
    }
    return a;
  };
  const inside = (s: boolean): Node => {
    const a = correspond(s);
    if (see('in') && j[p + 1].type === 'name') {
      p++;
      return { t: 'in', key: [a], grid: j[p++].value };
    }
    return a;
  };
  const correspond = (s: boolean): Node => {
    let a = comparison(s);
    while (see('~') || see('!~')) {
      const op = j[p++].value;
      a = { t: 'bin', op, a, b: comparison(s) };
    }
    return a;
  };
  const comparison = (s: boolean): Node => {
    const a = concat();
    // Dans print, > serait une redirection (non simulée) : pas une comparaison.
    const op = ['==', '!=', '<=', '>=', '<', '>'].find((o) => see(o) && !(s && o === '>'));
    if (op) {
      p++;
      return { t: 'bin', op, a, b: concat() };
    }
    return a;
  };
  // Deux valeurs côte à côte : concaténation.
  const valueStart = () => {
    const t = j[p];
    if (t.type === 'number' || t.type === 'string' || t.type === 'regex' || t.type === 'name') return true;
    // (+ et - entre deux valeurs sont des opérations, pas une concaténation.)
    return t.type === 'op' && ['$', '(', '++', '--'].includes(t.value);
  };
  const concat = (): Node => {
    let a = additive();
    while (valueStart() && !see('in')) a = { t: 'bin', op: 'concat', a, b: additive() };
    return a;
  };
  const additive = (): Node => {
    let a = multiplicative();
    while (see('+') || see('-')) {
      const op = j[p++].value;
      a = { t: 'bin', op, a, b: multiplicative() };
    }
    return a;
  };
  const multiplicative = (): Node => {
    let a = unary();
    while (see('*') || see('/') || see('%')) {
      const op = j[p++].value;
      a = { t: 'bin', op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (see('!')) {
      p++;
      return { t: 'unary', op: '!', e: unary() };
    }
    if (see('-') || see('+')) {
      const op = j[p++].value;
      return { t: 'unary', op, e: unary() };
    }
    return increment();
  };
  const increment = (): Node => {
    if (see('++') || see('--')) {
      const op = j[p++].value;
      return { t: 'incr', op, pre: true, target: primary() };
    }
    const e = primary();
    if ((see('++') || see('--')) && (e.t === 'var' || e.t === 'champ' || e.t === 'elem'))
      return { t: 'incr', op: j[p++].value, pre: false, target: e };
    return e;
  };
  const primary = (): Node => {
    const t = j[p];
    if (t.type === 'number') return (p++, { t: 'num', v: Number(t.value) });
    if (t.type === 'string') return (p++, { t: 'str', v: t.value });
    if (t.type === 'regex') return (p++, { t: 'regex', v: t.value });
    if (see('$')) {
      p++;
      return { t: 'champ', e: incrementWithoutPostfix() };
    }
    if (see('(')) {
      p++;
      const e = expression();
      // (a, b) in tableau
      wait(')');
      return { t: 'groupe', e };
    }
    if (t.type === 'name') {
      p++;
      if (FUNCTIONS.includes(t.value)) {
        const args: Node[] = [];
        if (see('(')) {
          p++;
          if (!see(')')) {
            args.push(expression());
            while (see(',')) {
              p++;
              args.push(expression());
            }
          }
          wait(')');
        }
        return { t: 'appel', name: t.value, args };
      }
      if (see('[')) {
        p++;
        const key = [expression()];
        while (see(',')) {
          p++;
          key.push(expression());
        }
        wait(']');
        return { t: 'elem', name: t.value, key };
      }
      return { t: 'var', name: t.value };
    }
    return error();
  };
  // Après $ : un nombre, une variable, ou (expression).
  const incrementWithoutPostfix = (): Node => {
    if (see('-')) {
      p++;
      return { t: 'unary', op: '-', e: primary() };
    }
    return primary();
  };

  const expressionsList = (): Node[] => {
    const args: Node[] = [];
    if (see(';') || see('\n') || see('}') || j[p].type === 'end') return args;
    // print (a, b) : les parenthèses entourent la liste.
    args.push(expression(true));
    while (see(',')) {
      p++;
      skipNl();
      args.push(expression(true));
    }
    if (args.length === 1 && args[0].t === 'groupe') return [args[0].e];
    return args;
  };

  const instruction = (): Instr => {
    skipNl();
    if (see('{')) return block();
    if (see('if')) {
      p++;
      wait('(');
      const cond = expression();
      wait(')');
      const then = instruction();
      const before = p;
      skipLines();
      if (see('else')) {
        p++;
        return { t: 'if', cond, then, otherwise: instruction() };
      }
      p = before;
      return { t: 'if', cond, then };
    }
    if (see('while')) {
      p++;
      wait('(');
      const cond = expression();
      wait(')');
      return { t: 'while', cond, body: instruction() };
    }
    if (see('for')) {
      p++;
      wait('(');
      if (j[p].type === 'name' && j[p + 1].value === 'in' && j[p + 2].type === 'name' && j[p + 3].value === ')') {
        const variable = j[p].value;
        const grid = j[p + 2].value;
        p += 4;
        return { t: 'pourDans', variable, grid, body: instruction() };
      }
      const init = see(';') ? undefined : ({ t: 'expr', e: expression() } as Instr);
      wait(';');
      const cond = see(';') ? undefined : expression();
      wait(';');
      const not = see(')') ? undefined : ({ t: 'expr', e: expression() } as Instr);
      wait(')');
      return { t: 'for', init, cond, not, body: instruction() };
    }
    let i: Instr;
    if (see('print')) {
      p++;
      i = { t: 'print', args: expressionsList() };
    } else if (see('printf')) {
      p++;
      i = { t: 'printf', args: expressionsList() };
    } else if (see('next')) {
      p++;
      i = { t: 'next' };
    } else if (see('delete')) {
      p++;
      const name = j[p].type === 'name' ? j[p++].value : error();
      let key: Node[] | undefined;
      if (see('[')) {
        p++;
        key = [expression()];
        wait(']');
      }
      i = { t: 'delete', name, key };
    } else if (see(';')) {
      i = { t: 'block', body: [] };
    } else i = { t: 'expr', e: expression() };
    if (see(';') || see('\n')) p++;
    else if (!see('}') && j[p].type !== 'end') error();
    return i;
  };
  const block = (): Instr => {
    wait('{');
    const body: Instr[] = [];
    skipLines();
    while (!see('}')) {
      if (j[p].type === 'end') error();
      body.push(instruction());
      skipLines();
    }
    p++;
    return { t: 'block', body };
  };

  const rules: Rule[] = [];
  skipLines();
  while (j[p].type !== 'end') {
    if (see('BEGIN') || see('END')) {
      const when = j[p++].value as 'BEGIN' | 'END';
      skipNl();
      rules.push({ when, action: block() });
    } else if (see('{')) rules.push({ when: 'line', action: block() });
    else {
      const pattern = expression();
      rules.push({ when: 'line', pattern, action: see('{') ? block() : undefined });
    }
    skipLines();
  }
  return rules;
}

// ——— Exécution ———

class Next {}

const isCount = (v: Value) => typeof v === 'number' || /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(v);
const count = (v: Value): number => (typeof v === 'number' ? v : parseFloat(v) || 0);
// Un nombre affiché : entier tel quel, sinon %.6g (CONVFMT).
const text = (v: Value): string => {
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(6)));
};

function formatValue(format: string, args: Value[]): string {
  let i = 0;
  return format.replace(
    /%([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([a-zA-Z%])/g,
    (all, flags: string, rawWidth: string | undefined, precision: string | undefined, conv: string) => {
      if (conv === '%') return '%';
      const width = rawWidth === '*' ? count(args[i++] ?? 0) : Number(rawWidth ?? 0);
      const v = args[i++] ?? '';
      let s: string;
      if (conv === 'd' || conv === 'i') s = String(Math.trunc(count(v)));
      else if (conv === 'f') s = count(v).toFixed(precision === undefined ? 6 : Number(precision));
      else if (conv === 'c') s = typeof v === 'number' ? String.fromCharCode(v) : v.charAt(0);
      else if (conv === 'x') s = Math.trunc(count(v)).toString(16);
      else if (conv === 's') s = precision === undefined ? text(v) : text(v).slice(0, Number(precision));
      else return all;
      if (s.length < width)
        s = flags.includes('-') ? s.padEnd(width) : s.padStart(width, flags.includes('0') && conv !== 's' ? '0' : ' ');
      return s;
    },
  );
}

function execute(rules: Rule[], lines: string[], variables: Record<string, Value>): string {
  const output: string[] = [];
  const tableaux: Record<string, Map<string, Value>> = {};
  const v: Record<string, Value> = { FS: ' ', OFS: ' ', ORS: '\n', NR: 0, NF: 0, SUBSEP: '\u001c', RSTART: 0, RLENGTH: -1, ...variables };
  let fields: string[] = [''];
  let not = 0;
  const split = (line: string) => {
    const fs = text(v.FS);
    const parts =
      fs === ' '
        ? line
            .trim()
            .split(/[ \t]+/)
            .filter(Boolean)
        : fs.length === 1
          ? line.split(fs)
          : line.split(new RegExp(fs));
    fields = [line, ...(line === '' ? [] : parts)];
    v.NF = fields.length - 1;
  };
  const rebuild = () => {
    fields[0] = fields.slice(1).join(text(v.OFS));
  };
  const grid = (name: string) => (tableaux[name] ??= new Map());
  const keyFor = (key: Node[]) => key.map((c) => text(evaluate(c))).join(text(v.SUBSEP));
  const regex = (n: Node): RegExp => new RegExp(n.t === 'regex' ? n.v : text(evaluate(n)));
  const read = (n: Node): Value => evaluate(n);
  const write = (target: Node, value: Value) => {
    if (target.t === 'var') {
      v[target.name] = value;
      if (target.name === 'NF') {
        fields = fields.slice(0, count(value) + 1);
        rebuild();
      }
    } else if (target.t === 'elem') grid(target.name).set(keyFor(target.key), value);
    else if (target.t === 'champ') {
      const k = Math.trunc(count(evaluate(target.e)));
      if (k === 0) split(text(value));
      else {
        while (fields.length <= k) fields.push('');
        fields[k] = text(value);
        v.NF = fields.length - 1;
        rebuild();
      }
    }
  };
  function evaluate(n: Node): Value {
    if (++not > 2_000_000) throw new AwkError('program too long to run here');
    switch (n.t) {
      case 'num':
        return n.v;
      case 'str':
        return n.v;
      case 'regex':
        return new RegExp(n.v).test(fields[0]) ? 1 : 0;
      case 'groupe':
        return evaluate(n.e);
      case 'var':
        return v[n.name] ?? '';
      case 'champ': {
        const k = Math.trunc(count(evaluate(n.e)));
        if (k < 0) throw new AwkError(`negative field index $${k}`);
        return fields[k] ?? '';
      }
      case 'elem':
        return grid(n.name).get(keyFor(n.key)) ?? (grid(n.name).set(keyFor(n.key), ''), '');
      case 'in':
        return grid(n.grid).has(keyFor(n.key)) ? 1 : 0;
      case 'unary': {
        if (n.op === '!') return yes(evaluate(n.e)) ? 0 : 1;
        const x = count(evaluate(n.e));
        return n.op === '-' ? -x : x;
      }
      case 'incr': {
        const before = count(read(n.target));
        const after = n.op === '++' ? before + 1 : before - 1;
        write(n.target, after);
        return n.pre ? after : before;
      }
      case 'affect': {
        const value = evaluate(n.e);
        if (n.op === '=') {
          write(n.target, value);
          return value;
        }
        const a = count(read(n.target));
        const b = count(value);
        const r = n.op === '+=' ? a + b : n.op === '-=' ? a - b : n.op === '*=' ? a * b : n.op === '/=' ? a / b : a % b;
        write(n.target, r);
        return r;
      }
      case 'bin': {
        if (n.op === '&&') return yes(evaluate(n.a)) && yes(evaluate(n.b)) ? 1 : 0;
        if (n.op === '||') return yes(evaluate(n.a)) || yes(evaluate(n.b)) ? 1 : 0;
        if (n.op === '~' || n.op === '!~') {
          const ok = regex(n.b).test(text(evaluate(n.a)));
          return (n.op === '~') === ok ? 1 : 0;
        }
        const a = evaluate(n.a);
        const b = evaluate(n.b);
        if (n.op === 'concat') return text(a) + text(b);
        if (['==', '!=', '<', '>', '<=', '>='].includes(n.op)) {
          // Comparaison numérique si les deux ressemblent à des nombres.
          const num = isCount(a) && isCount(b);
          const x = num ? count(a) : text(a);
          const y = num ? count(b) : text(b);
          const r = n.op === '==' ? x === y : n.op === '!=' ? x !== y : n.op === '<' ? x < y : n.op === '>' ? x > y : n.op === '<=' ? x <= y : x >= y;
          return r ? 1 : 0;
        }
        const x = count(a);
        const y = count(b);
        if ((n.op === '/' || n.op === '%') && y === 0) throw new AwkError('division by zero');
        return n.op === '+' ? x + y : n.op === '-' ? x - y : n.op === '*' ? x * y : n.op === '/' ? x / y : x % y;
      }
      case 'appel':
        return call(n.name, n.args);
    }
  }
  const yes = (x: Value) => (typeof x === 'number' ? x !== 0 : x !== '');
  function call(name: string, args: Node[]): Value {
    const a = (i: number) => evaluate(args[i]);
    switch (name) {
      case 'length':
        if (args[0]?.t === 'var' && tableaux[args[0].name]) return tableaux[args[0].name].size;
        return text(args.length ? a(0) : fields[0]).length;
      case 'substr': {
        const s = text(a(0));
        const start = Math.round(count(a(1)));
        const length = args.length > 2 ? Math.round(count(a(2))) : Infinity;
        const forEachOf = Math.max(1, start);
        const until = Math.min(s.length + 1, start + length);
        return until > forEachOf ? s.slice(forEachOf - 1, until - 1) : '';
      }
      case 'index':
        return text(a(0)).indexOf(text(a(1))) + 1;
      case 'split': {
        const s = text(a(0));
        const tableName = args[1]?.t === 'var' ? args[1].name : '';
        const sep = args.length > 2 ? (args[2].t === 'regex' ? new RegExp(args[2].v) : text(a(2))) : text(v.FS);
        const parts =
          sep === ' '
            ? s
                .trim()
                .split(/[ \t]+/)
                .filter(Boolean)
            : s.split(sep);
        const t = grid(tableName);
        t.clear();
        parts.forEach((x, i) => t.set(String(i + 1), x));
        return parts.length;
      }
      case 'sub':
      case 'gsub': {
        const re = new RegExp(args[0].t === 'regex' ? args[0].v : text(a(0)), name === 'gsub' ? 'g' : '');
        // Dans le remplacement, & est le texte trouvé, et \& un vrai &.
        const template = text(a(1));
        const target: Node = args[2] ?? { t: 'champ', e: { t: 'num', v: 0 } };
        const before = text(read(target));
        let n = 0;
        const after = before.replace(re, (found: string) => (n++, template.replace(/\\&|&/g, (x) => (x === '&' ? found : '&'))));
        if (n) write(target, after);
        return n;
      }
      case 'match': {
        const m = new RegExp(args[1].t === 'regex' ? args[1].v : text(a(1))).exec(text(a(0)));
        v.RSTART = m ? m.index + 1 : 0;
        v.RLENGTH = m ? m[0].length : -1;
        return v.RSTART;
      }
      case 'tolower':
        return text(a(0)).toLowerCase();
      case 'toupper':
        return text(a(0)).toUpperCase();
      case 'int':
        return Math.trunc(count(a(0)));
      case 'sprintf':
        return formatValue(
          text(a(0)),
          args.slice(1).map((x) => evaluate(x)),
        );
    }
    return '';
  }
  function run(i: Instr): void {
    switch (i.t) {
      case 'expr':
        evaluate(i.e);
        return;
      case 'print':
        output.push(i.args.length ? i.args.map((x) => text(evaluate(x))).join(text(v.OFS)) : fields[0]);
        return;
      case 'printf': {
        const [format, ...rest] = i.args.map((x) => evaluate(x));
        output.push('\u0001' + formatValue(text(format ?? ''), rest));
        return;
      }
      case 'if':
        if (yes(evaluate(i.cond))) run(i.then);
        else if (i.otherwise) run(i.otherwise);
        return;
      case 'while':
        while (yes(evaluate(i.cond))) run(i.body);
        return;
      case 'for':
        for (i.init && run(i.init); i.cond ? yes(evaluate(i.cond)) : true; i.not && run(i.not)) run(i.body);
        return;
      case 'pourDans':
        for (const key of [...grid(i.grid).keys()]) {
          v[i.variable] = key;
          run(i.body);
        }
        return;
      case 'block':
        i.body.forEach(run);
        return;
      case 'next':
        throw new Next();
      case 'delete':
        if (i.key) grid(i.name).delete(keyFor(i.key));
        else grid(i.name).clear();
    }
  }
  for (const r of rules.filter((x) => x.when === 'BEGIN')) run(r.action!);
  for (const line of lines) {
    v.NR = count(v.NR) + 1;
    split(line);
    try {
      for (const r of rules.filter((x) => x.when === 'line')) {
        if (r.pattern && !yes(evaluate(r.pattern))) continue;
        if (r.action) run(r.action);
        else output.push(fields[0]);
      }
    } catch (e) {
      if (!(e instanceof Next)) throw e;
    }
  }
  for (const r of rules.filter((x) => x.when === 'END')) run(r.action!);
  // printf n'ajoute pas de fin de ligne : on recolle avec ce qui précède.
  let outputText = '';
  for (const s of output) outputText += s.startsWith('\u0001') ? s.slice(1) : s + '\n';
  return outputText.replace(/\n$/, '');
}

export const AWK: Record<string, Command> = {
  awk: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      const variables: Record<string, Value> = {};
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-F') variables.FS = args[++i] ?? ' ';
        else if (a.startsWith('-F')) variables.FS = a.slice(2);
        else if (a === '-v') {
          const [name, ...value] = (args[++i] ?? '').split('=');
          variables[name] = value.join('=');
        } else rest.push(a);
      }
      if (variables.FS === '\\t') variables.FS = '\t';
      const [program, ...files] = rest;
      if (program === undefined) return game.error(game.t('awk-usage'));
      let rules: Rule[];
      try {
        rules = parse(program);
      } catch (e) {
        if (e instanceof AwkError) return game.error(`awk: line 1: ${e.message}`);
        throw e;
      }
      const lines: string[] = [];
      if (!files.length) lines.push(...(input ?? '').split('\n').filter((l, i, t) => l !== '' || i < t.length - 1));
      for (const f of files) {
        const t = game.readFor('awk', f);
        if (t === null) return '';
        lines.push(...t.split('\n'));
      }
      try {
        return execute(rules, lines, variables);
      } catch (e) {
        if (e instanceof AwkError) return game.error(`awk: run time error: ${e.message}`);
        if (e instanceof SyntaxError) return game.error(`awk: line 1: regular expression compile failed (${e.message})`);
        throw e;
      }
    },
  },
};
