// jq, the JSON processor (jq 1.7): reads JSON from its input (or files),
// applies a filter and prints the results, indented by two spaces (-c:
// compact, -r: strings without quotes). The filter language's core: paths
// (.a.b, .[0], .[], ."key", optional ?), pipes and commas, array and object
// construction, string interpolation "\(.x)", comparisons, arithmetic,
// and, or, not, //, and the usual functions (select, map, length, keys,
// has, to_entries, sort_by, join, test, startswith…).
// Source: https://jqlang.org/manual/v1.7/
// Differences: no variables ($x), reduce, paths(), def, @formats except
// @text, @json and @csv, nor streaming options.

import type { Command } from './index';

type J = null | boolean | number | string | J[] | { [k: string]: J };

class JqError extends Error {}
class Syntax extends Error {}

type F =
  | { k: 'identity' }
  | { k: 'recurse' }
  | { k: 'literal'; v: J }
  | { k: 'string'; parts: (string | F)[] }
  | { k: 'field'; on: F; name: F; optional: boolean }
  | { k: 'iterate'; on: F; optional: boolean }
  | { k: 'slice'; on: F; from: F | null; to: F | null }
  | { k: 'pipe'; a: F; b: F }
  | { k: 'comma'; a: F; b: F }
  | { k: 'binop'; op: string; a: F; b: F }
  | { k: 'array'; body: F | null }
  | { k: 'object'; entries: { key: F; value: F | null }[] }
  | { k: 'call'; name: string; args: F[] }
  | { k: 'format'; name: string };

// ——— Parsing ———

function tokenize(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let depth = 0;
      while (j < s.length && (s[j] !== '"' || depth > 0)) {
        if (s[j] === '\\' && s[j + 1] === '(') {
          depth++;
          j += 2;
          continue;
        }
        if (depth > 0 && s[j] === '(') depth++;
        else if (depth > 0 && s[j] === ')') depth--;
        if (s[j] === '\\') j++;
        j++;
      }
      if (j >= s.length) throw new Syntax('$end');
      out.push(s.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '//', '?/'].includes(two) || two === '..') {
      out.push(two === '?/' ? '?' : two);
      i += two === '?/' ? 1 : 2;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i))!;
      out.push(m[0]);
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_@$]/.test(c)) {
      const m = /^[@$]?[A-Za-z_][\w]*/.exec(s.slice(i))!;
      out.push(m[0]);
      i += m[0].length;
      continue;
    }
    if ('.[]{}()|,:<>+-*/%?;'.includes(c)) {
      out.push(c);
      i++;
      continue;
    }
    throw new Syntax('INVALID_CHARACTER');
  }
  return out;
}

function parseFilter(text: string): F {
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expect = (t: string) => {
    if (next() !== t) throw new Syntax(tokens[i - 1] === undefined ? '$end' : `'${tokens[i - 1]}'`);
  };
  const isIdent = (t?: string) => !!t && /^[A-Za-z_]\w*$/.test(t);

  const pipe = (): F => {
    let a = comma();
    while (peek() === '|') {
      next();
      a = { k: 'pipe', a, b: comma() };
    }
    return a;
  };
  const comma = (): F => {
    let a = alt();
    while (peek() === ',') {
      next();
      a = { k: 'comma', a, b: alt() };
    }
    return a;
  };
  const alt = (): F => {
    let a = or();
    while (peek() === '//') {
      next();
      a = { k: 'binop', op: '//', a, b: or() };
    }
    return a;
  };
  const or = (): F => {
    let a = and();
    while (peek() === 'or') {
      next();
      a = { k: 'binop', op: 'or', a, b: and() };
    }
    return a;
  };
  const and = (): F => {
    let a = cmp();
    while (peek() === 'and') {
      next();
      a = { k: 'binop', op: 'and', a, b: cmp() };
    }
    return a;
  };
  const cmp = (): F => {
    const a = add();
    if (['==', '!=', '<', '<=', '>', '>='].includes(peek())) {
      const op = next();
      return { k: 'binop', op, a, b: add() };
    }
    return a;
  };
  const add = (): F => {
    let a = mul();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      a = { k: 'binop', op, a, b: mul() };
    }
    return a;
  };
  const mul = (): F => {
    let a = postfix();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      a = { k: 'binop', op, a, b: postfix() };
    }
    return a;
  };
  const suffix = (on: F): F => {
    for (;;) {
      const t = peek();
      if (t === '.' && (isIdent(tokens[i + 1]) || tokens[i + 1]?.startsWith('"')) && !['and', 'or'].includes(tokens[i + 1])) {
        next();
        const n = next();
        on = { k: 'field', on, name: { k: 'literal', v: n.startsWith('"') ? JSON.parse(n) : n }, optional: false };
      } else if (t === '[' || (t === '.' && tokens[i + 1] === '[')) {
        if (t === '.') next();
        next();
        if (peek() === ']') {
          next();
          on = { k: 'iterate', on, optional: false };
        } else if (peek() === ':') {
          next();
          const to = pipe();
          expect(']');
          on = { k: 'slice', on, from: null, to };
        } else {
          const idx = pipe();
          if (peek() === ':') {
            next();
            const to = peek() === ']' ? null : pipe();
            expect(']');
            on = { k: 'slice', on, from: idx, to };
          } else {
            expect(']');
            on = { k: 'field', on, name: idx, optional: false };
          }
        }
      } else if (t === '?') {
        next();
        if (on.k === 'field' || on.k === 'iterate') on = { ...on, optional: true };
      } else return on;
    }
  };
  const postfix = (): F => suffix(term());
  const term = (): F => {
    const t = next();
    if (t === undefined) throw new Syntax('$end');
    if (t === '.') {
      if (isIdent(peek()) && !['and', 'or'].includes(peek())) {
        const n = next();
        return { k: 'field', on: { k: 'identity' }, name: { k: 'literal', v: n }, optional: false };
      }
      if (peek()?.startsWith('"')) return { k: 'field', on: { k: 'identity' }, name: { k: 'literal', v: JSON.parse(next()) }, optional: false };
      return { k: 'identity' };
    }
    if (t === '..') return { k: 'recurse' };
    if (/^\d/.test(t)) return { k: 'literal', v: Number(t) };
    if (t.startsWith('"')) return stringLiteral(t);
    if (t === '-') return { k: 'binop', op: '-', a: { k: 'literal', v: 0 }, b: postfix() };
    if (t === '(') {
      const e = pipe();
      expect(')');
      return e;
    }
    if (t === '[') {
      if (peek() === ']') {
        next();
        return { k: 'array', body: null };
      }
      const body = pipe();
      expect(']');
      return { k: 'array', body };
    }
    if (t === '{') {
      const entries: { key: F; value: F | null }[] = [];
      while (peek() !== '}') {
        const kt = next();
        let key: F;
        if (kt === undefined) throw new Syntax('$end');
        if (kt === '(') {
          key = pipe();
          expect(')');
        } else if (kt.startsWith('"')) key = stringLiteral(kt);
        else if (isIdent(kt)) key = { k: 'literal', v: kt };
        else throw new Syntax(`'${kt}'`);
        let value: F | null = null;
        if (peek() === ':') {
          next();
          value = alt();
        }
        entries.push({ key, value });
        if (peek() === ',') next();
        else if (peek() !== '}') throw new Syntax(peek() === undefined ? '$end' : `'${peek()}'`);
      }
      next();
      return { k: 'object', entries };
    }
    if (t === 'true' || t === 'false') return { k: 'literal', v: t === 'true' };
    if (t === 'null') return { k: 'literal', v: null };
    if (t.startsWith('@')) return { k: 'format', name: t };
    if (isIdent(t)) {
      const args: F[] = [];
      if (peek() === '(') {
        next();
        args.push(pipe());
        while (peek() === ';') {
          next();
          args.push(pipe());
        }
        expect(')');
      }
      return { k: 'call', name: t, args };
    }
    throw new Syntax(`'${t}'`);
  };
  const stringLiteral = (raw: string): F => {
    const body = raw.slice(1, -1);
    const parts: (string | F)[] = [];
    let buf = '';
    for (let k = 0; k < body.length; k++) {
      if (body[k] === '\\' && body[k + 1] === '(') {
        let depth = 1;
        let j = k + 2;
        while (j < body.length && depth) {
          if (body[j] === '(') depth++;
          else if (body[j] === ')') depth--;
          j++;
        }
        if (buf) parts.push(JSON.parse(`"${buf}"`));
        buf = '';
        parts.push(parseFilter(body.slice(k + 2, j - 1)));
        k = j - 1;
      } else buf += body[k];
    }
    if (buf || !parts.length) parts.push(JSON.parse(`"${buf}"`));
    return { k: 'string', parts };
  };
  if (!tokens.length) return { k: 'identity' };
  const f = pipe();
  if (i < tokens.length) throw new Syntax(`'${tokens[i]}'`);
  return f;
}

// ——— Evaluation ———

const typeOf = (v: J): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v);
const show = (v: J) => {
  const s = JSON.stringify(v);
  return s.length > 11 ? `${s.slice(0, 10)}...` : s;
};
const truthy = (v: J) => v !== null && v !== false;

function compare(a: J, b: J): number {
  const order = ['null', 'boolean', 'number', 'string', 'array', 'object'];
  const ta = order.indexOf(typeOf(a));
  const tb = order.indexOf(typeOf(b));
  if (ta !== tb) return ta - tb;
  if (typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean') return a < (b as typeof a) ? -1 : a > (b as typeof a) ? 1 : 0;
  return JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0;
}

function run(f: F, v: J): J[] {
  switch (f.k) {
    case 'identity':
      return [v];
    case 'recurse': {
      const out: J[] = [];
      const walk = (x: J) => {
        out.push(x);
        if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === 'object') Object.values(x).forEach(walk);
      };
      walk(v);
      return out;
    }
    case 'literal':
      return [v === undefined ? null : f.v];
    case 'string': {
      let results = [''];
      for (const p of f.parts) {
        if (typeof p === 'string') results = results.map((r) => r + p);
        else {
          const next: string[] = [];
          for (const r of results) for (const x of run(p, v)) next.push(r + (typeof x === 'string' ? x : JSON.stringify(x)));
          results = next;
        }
      }
      return results;
    }
    case 'field': {
      const out: J[] = [];
      for (const base of run(f.on, v))
        for (const key of run(f.name, v)) {
          if (base === null) out.push(null);
          else if (typeof key === 'string' && typeof base === 'object' && !Array.isArray(base)) out.push(base[key] ?? null);
          else if (typeof key === 'number' && Array.isArray(base)) out.push(base[key < 0 ? base.length + key : key] ?? null);
          else if (!f.optional) throw new JqError(`Cannot index ${typeOf(base)} with ${typeof key === 'string' ? `"${key}"` : typeOf(key)}`);
        }
      return out;
    }
    case 'iterate': {
      const out: J[] = [];
      for (const base of run(f.on, v)) {
        if (Array.isArray(base)) out.push(...base);
        else if (base && typeof base === 'object') out.push(...Object.values(base));
        else if (!f.optional) throw new JqError(`Cannot iterate over ${typeOf(base)}${base === null ? '' : ` (${show(base)})`}`);
      }
      return out;
    }
    case 'slice': {
      const out: J[] = [];
      for (const base of run(f.on, v)) {
        const from = f.from ? (run(f.from, v)[0] as number) : 0;
        const to = f.to ? (run(f.to, v)[0] as number) : undefined;
        if (typeof base === 'string' || Array.isArray(base)) out.push(base.slice(from, to) as J);
        else if (base === null) out.push(null);
        else throw new JqError(`Cannot index ${typeOf(base)} with object`);
      }
      return out;
    }
    case 'pipe':
      return run(f.a, v).flatMap((x) => run(f.b, x));
    case 'comma':
      return [...run(f.a, v), ...run(f.b, v)];
    case 'array':
      return [f.body ? run(f.body, v) : []];
    case 'object': {
      let results: Record<string, J>[] = [{}];
      for (const e of f.entries) {
        const keys = run(e.key, v);
        const next: Record<string, J>[] = [];
        for (const r of results)
          for (const k of keys) {
            if (typeof k !== 'string') throw new JqError(`Object keys must be strings`);
            const values = e.value ? run(e.value, v) : [v && typeof v === 'object' && !Array.isArray(v) ? (v[k] ?? null) : null];
            for (const x of values) next.push({ ...r, [k]: x });
          }
        results = next;
      }
      return results;
    }
    case 'binop':
      return binop(f, v);
    case 'format':
      return [format(f.name, v)];
    case 'call':
      return call(f, v);
  }
}

function format(name: string, v: J): J {
  if (name === '@text') return typeof v === 'string' ? v : JSON.stringify(v);
  if (name === '@json') return JSON.stringify(v);
  if (name === '@csv') {
    if (!Array.isArray(v)) throw new JqError(`${typeOf(v)} (${show(v)}) cannot be csv-formatted, only an array can be`);
    return v.map((x) => (typeof x === 'string' ? `"${x.replace(/"/g, '""')}"` : String(x))).join(',');
  }
  if (name === '@tsv') {
    if (!Array.isArray(v)) throw new JqError(`${typeOf(v)} (${show(v)}) cannot be tsv-formatted, only an array can be`);
    return v.map((x) => (typeof x === 'string' ? x : String(x))).join('\t');
  }
  throw new JqError(`${name.slice(1)} is not a valid format`);
}

function binop(f: Extract<F, { k: 'binop' }>, v: J): J[] {
  if (f.op === 'and' || f.op === 'or') {
    const out: J[] = [];
    for (const a of run(f.a, v)) {
      if (f.op === 'and' && !truthy(a)) out.push(false);
      else if (f.op === 'or' && truthy(a)) out.push(true);
      else for (const b of run(f.b, v)) out.push(truthy(b));
    }
    return out;
  }
  if (f.op === '//') {
    let left: J[] = [];
    try {
      left = run(f.a, v).filter(truthy);
    } catch {
      left = [];
    }
    return left.length ? left : run(f.b, v);
  }
  const out: J[] = [];
  for (const b of run(f.b, v))
    for (const a of run(f.a, v)) {
      switch (f.op) {
        case '==':
          out.push(compare(a, b) === 0);
          break;
        case '!=':
          out.push(compare(a, b) !== 0);
          break;
        case '<':
          out.push(compare(a, b) < 0);
          break;
        case '<=':
          out.push(compare(a, b) <= 0);
          break;
        case '>':
          out.push(compare(a, b) > 0);
          break;
        case '>=':
          out.push(compare(a, b) >= 0);
          break;
        case '+':
          if (a === null) out.push(b);
          else if (b === null) out.push(a);
          else if (typeof a === 'number' && typeof b === 'number') out.push(a + b);
          else if (typeof a === 'string' && typeof b === 'string') out.push(a + b);
          else if (Array.isArray(a) && Array.isArray(b)) out.push([...a, ...b]);
          else if (typeOf(a) === 'object' && typeOf(b) === 'object') out.push({ ...(a as object), ...(b as object) } as J);
          else throw new JqError(`${typeOf(a)} (${show(a)}) and ${typeOf(b)} (${show(b)}) cannot be added`);
          break;
        default: {
          if (typeof a !== 'number' || typeof b !== 'number') {
            const verb = f.op === '-' ? 'subtracted' : f.op === '*' ? 'multiplied' : f.op === '/' ? 'divided' : 'divided';
            throw new JqError(`${typeOf(a)} (${show(a)}) and ${typeOf(b)} (${show(b)}) cannot be ${verb}`);
          }
          if ((f.op === '/' || f.op === '%') && b === 0) throw new JqError(`${typeOf(a)} (${show(a)}) and ${typeOf(b)} (${show(b)}) cannot be divided because the divisor is zero`);
          out.push(f.op === '-' ? a - b : f.op === '*' ? a * b : f.op === '/' ? a / b : Math.trunc(a) % Math.trunc(b));
        }
      }
    }
  return out;
}

function call(f: Extract<F, { k: 'call' }>, v: J): J[] {
  const arg = (n: number) => run(f.args[n], v);
  const need = (n: number) => {
    if (f.args.length !== n) throw new Syntax(`${f.name}/${f.args.length} is not defined`);
  };
  const len = (x: J): number => {
    if (x === null) return 0;
    if (typeof x === 'string' || Array.isArray(x)) return [...(x as string)].length;
    if (typeof x === 'object') return Object.keys(x).length;
    if (typeof x === 'number') return Math.abs(x);
    throw new JqError(`boolean (${x}) has no length`);
  };
  switch (f.name) {
    case 'empty':
      need(0);
      return [];
    case 'not':
      need(0);
      return [!truthy(v)];
    case 'length':
      need(0);
      return [len(v)];
    case 'keys':
      need(0);
      if (Array.isArray(v)) return [v.map((_, i) => i)];
      if (v && typeof v === 'object') return [Object.keys(v).sort()];
      throw new JqError(`${typeOf(v)} (${show(v)}) has no keys`);
    case 'type':
      need(0);
      return [typeOf(v)];
    case 'tostring':
      need(0);
      return [typeof v === 'string' ? v : JSON.stringify(v)];
    case 'tonumber': {
      need(0);
      const n = typeof v === 'number' ? v : Number(v);
      if (typeof v !== 'number' && (typeof v !== 'string' || !Number.isFinite(n))) throw new JqError(`Cannot parse '${String(v)}' as JSON`);
      return [n];
    }
    case 'ascii_downcase':
    case 'ascii_upcase':
      need(0);
      if (typeof v !== 'string') throw new JqError(`${f.name} input must be a string`);
      return [f.name === 'ascii_downcase' ? v.toLowerCase() : v.toUpperCase()];
    case 'select':
      need(1);
      return arg(0).some(truthy) ? [v] : [];
    case 'map':
      need(1);
      if (!Array.isArray(v) && !(v && typeof v === 'object')) throw new JqError(`Cannot iterate over ${typeOf(v)}`);
      return [Object.values(v as object).flatMap((x: J) => run(f.args[0], x))];
    case 'has': {
      need(1);
      return arg(0).map((k) => (Array.isArray(v) ? typeof k === 'number' && k < v.length : !!v && typeof v === 'object' && typeof k === 'string' && k in v));
    }
    case 'to_entries':
      need(0);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new JqError(`${typeOf(v)} (${show(v)}) has no keys`);
      return [Object.entries(v).map(([key, value]) => ({ key, value }))];
    case 'from_entries':
      need(0);
      return [Object.fromEntries((v as { key?: J; name?: J; k?: J; value?: J; v?: J }[]).map((e) => [String(e.key ?? e.name ?? e.k), e.value ?? e.v ?? null]))];
    case 'add':
      need(0);
      if (!Array.isArray(v)) throw new JqError(`Cannot iterate over ${typeOf(v)}`);
      return [v.reduce<J>((a, b) => binop({ k: 'binop', op: '+', a: { k: 'literal', v: a }, b: { k: 'literal', v: b } }, null)[0], null)];
    case 'join': {
      need(1);
      const sep = arg(0)[0] as string;
      if (!Array.isArray(v)) throw new JqError(`Cannot iterate over ${typeOf(v)}`);
      return [v.map((x) => (x === null ? '' : typeof x === 'string' ? x : JSON.stringify(x))).join(sep)];
    }
    case 'sort':
      need(0);
      if (!Array.isArray(v)) throw new JqError(`${typeOf(v)} (${show(v)}) cannot be sorted, as it is not an array`);
      return [[...v].sort(compare)];
    case 'sort_by':
    case 'unique_by':
    case 'group_by':
    case 'min_by':
    case 'max_by': {
      need(1);
      if (!Array.isArray(v)) throw new JqError(`Cannot index ${typeOf(v)} with number`);
      const keyed = v.map((x) => ({ x, key: run(f.args[0], x) as J }));
      keyed.sort((a, b) => compare(a.key, b.key));
      if (f.name === 'sort_by') return [keyed.map((e) => e.x)];
      if (f.name === 'min_by') return [keyed[0]?.x ?? null];
      if (f.name === 'max_by') return [keyed.at(-1)?.x ?? null];
      const groups: J[][] = [];
      for (const e of keyed) {
        const last = groups.at(-1);
        if (last && compare(run(f.args[0], last[0]) as J, e.key) === 0) last.push(e.x);
        else groups.push([e.x]);
      }
      return [f.name === 'group_by' ? groups : groups.map((g) => g[0])];
    }
    case 'unique':
      need(0);
      return [[...new Map((v as J[]).map((x) => [JSON.stringify(x), x])).values()].sort(compare)];
    case 'min':
    case 'max':
      need(0);
      if (!Array.isArray(v)) throw new JqError(`Cannot index ${typeOf(v)} with number`);
      return [v.length ? [...v].sort(compare)[f.name === 'min' ? 0 : v.length - 1] : null];
    case 'first':
    case 'last':
      if (f.args.length) {
        const all = arg(0);
        return all.length ? [f.name === 'first' ? all[0] : all.at(-1)!] : [];
      }
      return [Array.isArray(v) ? ((f.name === 'first' ? v[0] : v.at(-1)) ?? null) : null];
    case 'test':
    case 'startswith':
    case 'endswith':
    case 'contains':
    case 'ltrimstr':
    case 'rtrimstr': {
      need(1);
      return arg(0).map((a) => {
        if (f.name === 'contains') return typeof v === 'string' && typeof a === 'string' ? v.includes(a) : JSON.stringify(v).includes(JSON.stringify(a).replace(/^[[{]|[\]}]$/g, ''));
        if (typeof v !== 'string' || typeof a !== 'string') {
          if (f.name === 'ltrimstr' || f.name === 'rtrimstr') return v;
          throw new JqError(`${typeOf(v)} (${show(v)}) cannot be matched, as it is not a string`);
        }
        if (f.name === 'test') return new RegExp(a).test(v);
        if (f.name === 'startswith') return v.startsWith(a);
        if (f.name === 'endswith') return v.endsWith(a);
        if (f.name === 'ltrimstr') return v.startsWith(a) ? v.slice(a.length) : v;
        return v.endsWith(a) ? v.slice(0, -a.length) : v;
      });
    }
    case 'split':
      need(1);
      return arg(0).map((a) => (typeof v === 'string' ? v.split(String(a)) : null));
    case 'values':
      need(0);
      return truthy(v) || v === false ? (v === null ? [] : [v]) : [];
    case 'tojson':
      need(0);
      return [JSON.stringify(v)];
    case 'fromjson':
      need(0);
      return [JSON.parse(String(v))];
    case 'floor':
    case 'sqrt':
    case 'round':
    case 'ceil':
      need(0);
      return [(Math as unknown as Record<string, (x: number) => number>)[f.name](v as number)];
    case 'error':
      throw new JqError(f.args.length ? String(arg(0)[0]) : `${show(v)} (not a string)`);
    case 'any':
      need(0);
      return [Array.isArray(v) && v.some(truthy)];
    case 'all':
      need(0);
      return [Array.isArray(v) && v.every(truthy)];
  }
  throw new Syntax(`${f.name}/${f.args.length} is not defined`);
}

// Several JSON values one after the other (what curl gave, or a file).
function readJsonValues(text: string): J[] {
  const out: J[] = [];
  let i = 0;
  const s = text;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    let depth = 0;
    let inString = false;
    let j = i;
    for (; j < s.length; j++) {
      const c = s[j];
      if (inString) {
        if (c === '\\') j++;
        else if (c === '"') {
          inString = false;
          if (depth === 0) {
            j++;
            break;
          }
        }
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      } else if (depth === 0 && /\s/.test(c)) break;
    }
    const chunk = s.slice(i, j);
    try {
      out.push(JSON.parse(chunk));
    } catch {
      const before = s.slice(0, j);
      const line = before.split('\n').length;
      const col = before.length - before.lastIndexOf('\n') - 1;
      throw new Error(`jq: error (at <stdin>:${line}): Cannot parse input: Invalid literal at line ${line}, column ${col}`.replace(/^jq: error \(at <stdin>:\d+\): Cannot parse input: /, 'jq: parse error: '));
    }
    i = j;
  }
  return out;
}

function print(v: J, compact: boolean, raw: boolean): string {
  if (raw && typeof v === 'string') return v;
  return compact ? JSON.stringify(v) : JSON.stringify(v, null, 2) ?? 'null';
}

export const JQ: Record<string, Command> = {
  jq: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      const flags = new Set<string>();
      const rest: string[] = [];
      for (const a of args) {
        if (a === '--raw-output') flags.add('r');
        else if (a === '--compact-output') flags.add('c');
        else if (a === '--null-input') flags.add('n');
        else if (a === '--sort-keys') flags.add('S');
        else if (a === '--raw-input') flags.add('R');
        else if (a === '--slurp') flags.add('s');
        else if (a === '--exit-status') flags.add('e');
        else if (a === '--color-output' || a === '--monochrome-output') continue;
        else if (a === '--version') return 'jq-1.7.1';
        else if (/^-[a-zA-Z]+$/.test(a) && !rest.length) {
          for (const l of a.slice(1)) {
            if (!'rcnSeMCjRs'.includes(l)) return game.error(`jq: Unknown option: ${a}\nUse jq --help for help with command-line options,\nor see the jq manpage, or online docs  at https://jqlang.org`, 2);
            flags.add(l);
          }
        } else if (a.startsWith('--') && a.length > 2) return game.error(`jq: Unknown option: ${a}\nUse jq --help for help with command-line options,\nor see the jq manpage, or online docs  at https://jqlang.org`, 2);
        else rest.push(a);
      }
      const filterText = rest.length ? rest[0] : '.';
      if (!rest.length && input === null) return game.error(game.t('jq-usage'), 2);
      let filter: F;
      try {
        filter = parseFilter(filterText);
      } catch (e) {
        const what = (e as Error).message;
        const message = / is not defined$/.test(what) ? `jq: error: ${what} at <top-level>, line 1:` : `jq: error: syntax error, unexpected ${what === '$end' ? 'end of file' : what}${what === 'INVALID_CHARACTER' || what === '$end' ? ' (Unix shell quoting issues?)' : ''} at <top-level>, line 1:`;
        return game.error(`${message}\n${filterText}\njq: 1 compile error`, 3);
      }
      let text = input ?? '';
      for (const file of rest.slice(1)) {
        const content = game.read(file);
        if (content === null) return game.error(`jq: error: Could not open ${file}: No such file or directory`, 2);
        text += content;
      }
      let values: J[];
      try {
        // -R: each line is a string (with -s, the whole input is one string); -s: all the values in one array.
        values = flags.has('n')
          ? [null]
          : flags.has('R')
            ? flags.has('s')
              ? [text]
              : text.replace(/\n$/, '').split('\n')
            : flags.has('s')
              ? [readJsonValues(text)]
              : readJsonValues(text);
      } catch (e) {
        return game.error((e as Error).message, 2);
      }
      const out: string[] = [];
      let last: J = null;
      for (const value of values) {
        try {
          for (const r of run(filter, value)) {
            const sorted = flags.has('S') ? sortKeys(r) : r;
            out.push(print(sorted, flags.has('c'), flags.has('r')));
            last = r;
          }
        } catch (e) {
          if (e instanceof JqError) {
            game.error(`jq: error (at <stdin>:${text.split('\n').length - (text.endsWith('\n') ? 1 : 0)}): ${e.message}`, 5);
            return out.join('\n');
          }
          if (e instanceof Syntax) return game.error(`jq: error: ${e.message} at <top-level>, line 1:\n${filterText}\njq: 1 compile error`, 3);
          throw e;
        }
      }
      if (flags.has('e') && !truthy(last)) game.status = 1;
      return out.join('\n');
    },
  },
};

function sortKeys(v: J): J {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}
