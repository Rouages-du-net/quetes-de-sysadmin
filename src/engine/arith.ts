// bash's arithmetic (man bash, "ARITHMETIC EVALUATION"): $((…)), ((…)) and
// for ((…; …; …)). Integers only (a 64-bit value in bash; here JavaScript's
// safe integers), the C operators with bash's precedence, variables named
// without $ (an unset or empty one is 0; a value that is not a number is read
// as an expression, like bash), assignments (=, +=, ++…), decimal, octal
// (0755), hexadecimal (0x1F) and base#digits numbers.
// The messages are bash's: "division by 0 (error token is "0")",
// "syntax error: operand expected (error token is "+")".

export interface ArithVars {
  get(name: string): string | null;
  set(name: string, value: string): void;
}

export class ArithError extends Error {}

type Tok = { kind: 'num'; value: number; text: string } | { kind: 'id'; name: string } | { kind: 'op'; op: string };

// The operators, longest first (so that <<= is read before << and <).
const OPS = ['<<=', '>>=', '**', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|=', '+', '-', '*', '/', '%', '<', '>', '&', '^', '|', '!', '~', '?', ':', '=', ',', '(', ')'];

function lex(text: string): { toks: Tok[]; starts: number[] } {
  const toks: Tok[] = [];
  const starts: number[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    starts.push(i);
    const number = /^(?:(\d+)#([0-9A-Za-z@_]+)|0[xX][0-9a-fA-F]+|\d+)/.exec(text.slice(i));
    if (number) {
      const t = number[0];
      let value: number;
      if (number[1]) {
        const base = Number(number[1]);
        value = parseInt(number[2], base);
        if (base < 2 || base > 64 || Number.isNaN(value)) throw new ArithError(`${t}: invalid number (error token is "${t}")`);
      } else if (/^0[xX]/.test(t)) value = parseInt(t, 16);
      else if (/^0\d/.test(t)) {
        if (/[89]/.test(t)) throw new ArithError(`${t}: value too great for base (error token is "${t}")`);
        value = parseInt(t, 8);
      } else value = Number(t);
      // A number glued to letters (12abc) is no number.
      if (/^[A-Za-z_]/.test(text.slice(i + t.length))) {
        const word = /^\w+/.exec(text.slice(i))![0];
        throw new ArithError(`${word}: value too great for base (error token is "${word}")`);
      }
      toks.push({ kind: 'num', value, text: t });
      i += t.length;
      continue;
    }
    const id = /^[A-Za-z_]\w*/.exec(text.slice(i));
    if (id) {
      toks.push({ kind: 'id', name: id[0] });
      i += id[0].length;
      continue;
    }
    const op = OPS.find((o) => text.startsWith(o, i));
    if (!op) throw new ArithError(`${text.trim()}: syntax error: invalid arithmetic operator (error token is "${text.slice(i)}")`);
    toks.push({ kind: 'op', op });
    i += op.length;
  }
  return { toks, starts };
}

// An lvalue (a variable) or a value.
type Val = { value: number; name?: string };

/** Evaluates an arithmetic expression; throws ArithError with bash's message. */
export function arithmetic(text: string, vars: ArithVars, depth = 0): number {
  if (depth > 32) throw new ArithError(`${text}: expression recursion level exceeded`);
  const source = text;
  const { toks, starts } = lex(text);
  if (!toks.length) return 0;
  let p = 0;
  const rest = () => (p < toks.length ? source.slice(starts[p]).trim() : '');
  const peek = (): Tok | undefined => toks[p];
  const isOp = (op: string) => {
    const t = peek();
    return t?.kind === 'op' && t.op === op;
  };
  const operandError = (): never => {
    const r = rest();
    throw new ArithError(`${source.trim()}: syntax error: operand expected (error token is "${r || source.trim().split(/\s+/).at(-1)}")`);
  };
  const read = (name: string): number => {
    const v = vars.get(name);
    if (v === null || v.trim() === '') return 0;
    if (/^\s*-?\d+\s*$/.test(v)) return Number(v);
    return arithmetic(v, vars, depth + 1);
  };
  const value = (v: Val) => (v.name !== undefined ? read(v.name) : v.value);
  const assign = (v: Val, n: number): Val => {
    if (v.name === undefined) throw new ArithError(`${source.trim()}: attempted assignment to non-variable (error token is "${rest()}")`);
    const x = Math.trunc(n);
    vars.set(v.name, String(x));
    return { value: x };
  };
  // Short-circuit operators evaluate only what they need: `skip` counts the levels where nothing is evaluated.
  let skip = 0;
  const divide = (a: number, b: number, op: string, at: number): number => {
    if (b === 0) {
      if (skip) return 0;
      throw new ArithError(`${source.trim()}: division by 0 (error token is "${source.slice(at).trim()}")`);
    }
    return op === '/' ? Math.trunc(a / b) : a % b;
  };

  const primary = (): Val => {
    const t = peek();
    if (!t) return operandError();
    if (t.kind === 'num') {
      p++;
      return { value: t.value };
    }
    if (t.kind === 'id') {
      p++;
      // Post-increment and post-decrement.
      if (isOp('++') || isOp('--')) {
        const op = (toks[p++] as { op: string }).op;
        const old = skip ? 0 : read(t.name);
        if (!skip) vars.set(t.name, String(old + (op === '++' ? 1 : -1)));
        return { value: old };
      }
      return { value: 0, name: t.name };
    }
    if (t.op === '(') {
      p++;
      const v = comma();
      if (!isOp(')')) throw new ArithError(`${source.trim()}: missing \`)' (error token is "${rest()}")`);
      p++;
      return { value: value(v) };
    }
    return operandError();
  };
  const unary = (): Val => {
    const t = peek();
    if (t?.kind === 'op' && (t.op === '++' || t.op === '--')) {
      p++;
      const v = unary();
      if (v.name === undefined) operandError();
      return skip ? { value: 0 } : assign(v, read(v.name!) + (t.op === '++' ? 1 : -1));
    }
    if (t?.kind === 'op' && ['-', '+', '!', '~'].includes(t.op)) {
      p++;
      const n = value(unary());
      return { value: t.op === '-' ? -n : t.op === '+' ? n : t.op === '!' ? Number(!n) : ~n };
    }
    return primary();
  };
  const power = (): Val => {
    const base = unary();
    if (!isOp('**')) return base;
    p++;
    const exp = value(power());
    if (exp < 0) throw new ArithError(`${source.trim()}: exponent less than 0 (error token is "${rest()}")`);
    return { value: Math.trunc(value(base) ** exp) };
  };
  // A binary level: its operators and the next level's parser.
  const level = (ops: string[], next: () => Val, apply: (a: number, b: number, op: string, at: number) => number) => (): Val => {
    let left = next();
    for (;;) {
      const t = peek();
      if (t?.kind !== 'op' || !ops.includes(t.op)) return left;
      p++;
      const at = p < toks.length ? starts[p] : source.length;
      const right = value(next());
      left = { value: apply(value(left), right, t.op, at) };
    }
  };
  const multiplicative = level(['*', '/', '%'], power, (a, b, op, at) => (op === '*' ? a * b : divide(a, b, op, at)));
  const additive = level(['+', '-'], multiplicative, (a, b, op) => (op === '+' ? a + b : a - b));
  const shift = level(['<<', '>>'], additive, (a, b, op) => (op === '<<' ? a * 2 ** b : Math.floor(a / 2 ** b)));
  const relational = level(['<=', '>=', '<', '>'], shift, (a, b, op) => Number(op === '<=' ? a <= b : op === '>=' ? a >= b : op === '<' ? a < b : a > b));
  const equality = level(['==', '!='], relational, (a, b, op) => Number(op === '==' ? a === b : a !== b));
  const bitAnd = level(['&'], equality, (a, b) => a & b);
  const bitXor = level(['^'], bitAnd, (a, b) => a ^ b);
  const bitOr = level(['|'], bitXor, (a, b) => a | b);
  const logical = (op: '&&' | '||', next: () => Val) => (): Val => {
    let left = next();
    while (isOp(op)) {
      p++;
      const l = value(left) !== 0;
      const decided = op === '&&' ? !l : l;
      if (decided) skip++;
      const r = value(next()) !== 0;
      if (decided) skip--;
      left = { value: Number(op === '&&' ? l && r : l || r) };
    }
    return left;
  };
  const logicalAnd = logical('&&', bitOr);
  const logicalOr = logical('||', logicalAnd);
  const conditional = (): Val => {
    const c = logicalOr();
    if (!isOp('?')) return c;
    p++;
    const yes = value(c) !== 0;
    if (!yes) skip++;
    const a = value(assignment());
    if (!yes) skip--;
    if (!isOp(':')) throw new ArithError(`${source.trim()}: \`:' expected for conditional expression (error token is "${rest()}")`);
    p++;
    if (yes) skip++;
    const b = value(conditional());
    if (yes) skip--;
    return { value: yes ? a : b };
  };
  const ASSIGN = ['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|='];
  const assignment = (): Val => {
    const left = conditional();
    const t = peek();
    if (t?.kind !== 'op' || !ASSIGN.includes(t.op)) return left;
    if (left.name === undefined) throw new ArithError(`${source.trim()}: attempted assignment to non-variable (error token is "${rest()}")`);
    p++;
    const at = p < toks.length ? starts[p] : source.length;
    const right = value(assignment());
    if (skip) return { value: 0 };
    const old = t.op === '=' ? 0 : read(left.name);
    const op = t.op.slice(0, -1);
    const n =
      t.op === '='
        ? right
        : op === '+' ? old + right
        : op === '-' ? old - right
        : op === '*' ? old * right
        : op === '/' || op === '%' ? divide(old, right, op, at)
        : op === '<<' ? old * 2 ** right
        : op === '>>' ? Math.floor(old / 2 ** right)
        : op === '&' ? old & right
        : op === '^' ? old ^ right
        : old | right;
    return assign(left, n);
  };
  const comma = (): Val => {
    let v = assignment();
    while (isOp(',')) {
      p++;
      v = assignment();
    }
    return v;
  };
  const result = value(comma());
  if (p < toks.length) throw new ArithError(`${source.trim()}: syntax error in expression (error token is "${rest()}")`);
  return result;
}
