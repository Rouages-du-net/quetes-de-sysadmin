// HCL, the OpenTofu language's native syntax (a subset): what `tofu`
// reads (*.tf, *.tfvars, .terraform.lock.hcl) and how `tofu fmt` rewrites
// it. Read like HCL 2's hclsyntax package: bodies of arguments and blocks,
// literals, quoted templates with ${…} interpolations, tuples, objects,
// references (var.x, local.y, type.name.attr) and function calls; its
// syntax errors keep hclsyntax's summaries and details.
// Sources: https://opentofu.org/docs/language/syntax/configuration/,
// https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md,
// hclsyntax/parser.go (the diagnostics) and hclwrite/format.go (fmt:
// indentation by nesting, one space around "=", the "=" of consecutive
// arguments aligned).
// Differences: no heredocs, operators, conditionals, splats nor for
// expressions; fmt doesn't align trailing comments.

export interface Pos {
  line: number;
  col: number;
  offset: number;
}
export interface Range {
  file: string;
  start: Pos;
  end: Pos;
}

export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export type Expr =
  | { kind: 'literal'; value: Value; range: Range }
  | { kind: 'template'; parts: (string | Expr)[]; range: Range }
  | { kind: 'tuple'; items: Expr[]; range: Range }
  | { kind: 'object'; items: { key: string; value: Expr }[]; range: Range }
  | { kind: 'ref'; parts: string[]; range: Range }
  | { kind: 'call'; name: string; args: Expr[]; range: Range };

export interface Attribute {
  name: string;
  nameRange: Range;
  expr: Expr;
  range: Range;
}
export interface Block {
  type: string;
  labels: string[];
  typeRange: Range;
  /** From the type to the last label: what a declaration error points at. */
  headerRange: Range;
  openBrace: Range;
  body: Body;
  range: Range;
}
export interface Body {
  attributes: Attribute[];
  blocks: Block[];
  range: Range;
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  summary: string;
  detail?: string;
  subject?: Range;
  // The block the subject is in (the snippet's "in resource "x" "y"").
  context?: string;
  // "with var.x," before the snippet.
  address?: string;
}

// ——— Tokens ———

type Kind = 'ident' | 'number' | 'string' | 'punct' | 'newline' | 'comment' | 'eof' | 'invalid';
export interface Token {
  kind: Kind;
  text: string;
  range: Range;
}

const PUNCT = ['{', '}', '[', ']', '(', ')', '=', ',', '.', ':', '?', '!', '+', '-', '*', '/', '%', '<', '>', '&', '|'];

export function lex(src: string, file: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const pos = (): Pos => ({ line, col, offset: i });
  const advance = (n: number) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };
  const push = (kind: Kind, start: Pos) => tokens.push({ kind, text: src.slice(start.offset, i), range: { file, start, end: pos() } });
  while (i < src.length) {
    const c = src[i];
    const start = pos();
    if (c === '\n') {
      advance(1);
      push('newline', start);
    } else if (c === ' ' || c === '\t' || c === '\r') advance(1);
    else if (c === '#' || (c === '/' && src[i + 1] === '/')) {
      while (i < src.length && src[i] !== '\n') advance(1);
      push('comment', start);
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      advance(end < 0 ? src.length - i : end + 2 - i);
      push('comment', start);
    } else if (/[A-Za-z_]/.test(c)) {
      while (i < src.length && /[\w-]/.test(src[i])) advance(1);
      push('ident', start);
    } else if (/\d/.test(c)) {
      while (i < src.length && /[\d.eE]/.test(src[i]) && !(src[i] === '.' && !/\d/.test(src[i + 1] ?? ''))) advance(1);
      push('number', start);
    } else if (c === '"') {
      // A quoted template: up to its closing quote, ${…} nested (with their own quotes).
      advance(1);
      let depth = 0;
      let closed = false;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '\\') advance(2);
        else if (src[i] === '$' && src[i + 1] === '{') {
          depth++;
          advance(2);
        } else if (depth > 0 && src[i] === '}') {
          depth--;
          advance(1);
        } else if (depth > 0 && src[i] === '"') {
          advance(1);
          while (i < src.length && src[i] !== '"' && src[i] !== '\n') advance(src[i] === '\\' ? 2 : 1);
          advance(1);
        } else if (depth === 0 && src[i] === '"') {
          advance(1);
          closed = true;
          break;
        } else advance(1);
      }
      push(closed ? 'string' : 'invalid', start);
    } else if (PUNCT.includes(c)) {
      advance(1);
      push('punct', start);
    } else {
      advance(1);
      push('invalid', start);
    }
  }
  tokens.push({ kind: 'eof', text: '', range: { file, start: pos(), end: pos() } });
  return tokens;
}

// ——— Parser ———

class Fail extends Error {
  constructor(public diagnostic: Diagnostic) {
    super(diagnostic.summary);
  }
}

const span = (a: Range, b: Range): Range => ({ file: a.file, start: a.start, end: b.end });

/** "\n" → newline, "\"" → quote… (the escapes of a quoted string). */
function unescape(text: string): string {
  return text.replace(/\\(["\\ntr]|u[0-9a-fA-F]{4})/g, (_, e: string) =>
    e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e.startsWith('u') ? String.fromCharCode(parseInt(e.slice(1), 16)) : e,
  );
}

class Parser {
  i = 0;
  constructor(
    public tokens: Token[],
    public src: string,
  ) {}
  get tok() {
    return this.tokens[this.i];
  }
  peek(n = 1) {
    return this.tokens[Math.min(this.i + n, this.tokens.length - 1)];
  }
  skipComments() {
    while (this.tok.kind === 'comment') this.i++;
  }
  skipBlank() {
    while (this.tok.kind === 'comment' || this.tok.kind === 'newline') this.i++;
  }
  is(text: string) {
    return this.tok.kind === 'punct' && this.tok.text === text;
  }

  body(nested: Token | null): Body {
    const attributes: Attribute[] = [];
    const blocks: Block[] = [];
    const first = this.tok.range;
    for (;;) {
      this.skipBlank();
      const t = this.tok;
      if (t.kind === 'eof') {
        if (nested)
          throw new Fail({
            severity: 'error',
            summary: 'Unclosed configuration block',
            detail: 'There is no closing brace for this block before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.',
            subject: nested.range,
          });
        return { attributes, blocks, range: span(first, t.range) };
      }
      if (this.is('}')) {
        if (nested) return { attributes, blocks, range: span(first, t.range) };
        throw new Fail({ severity: 'error', summary: 'Argument or block definition required', detail: 'An argument or block definition is required here.', subject: t.range });
      }
      if (t.kind !== 'ident')
        throw new Fail({ severity: 'error', summary: 'Argument or block definition required', detail: 'An argument or block definition is required here.', subject: t.range });
      this.i++;
      this.skipComments();
      if (this.is('=')) {
        this.i++;
        const expr = this.expression();
        this.skipComments();
        const end = this.tok;
        if (end.kind !== 'newline' && end.kind !== 'eof' && !(nested && this.is('}')))
          throw new Fail({ severity: 'error', summary: 'Missing newline after argument', detail: 'An argument definition must end with a newline.', subject: end.range });
        attributes.push({ name: t.text, nameRange: t.range, expr, range: span(t.range, expr.range) });
        continue;
      }
      // A block: labels (quoted, or bare identifiers), then "{" on the same line.
      const labels: string[] = [];
      let last = t.range;
      while (this.tok.kind === 'string' || this.tok.kind === 'ident') {
        labels.push(this.tok.kind === 'string' ? unescape(this.tok.text.slice(1, -1)) : this.tok.text);
        last = this.tok.range;
        this.i++;
      }
      if (!this.is('{')) {
        if (this.tok.kind === 'newline' || this.tok.kind === 'eof')
          throw new Fail({
            severity: 'error',
            summary: labels.length ? 'Invalid block definition' : 'Argument or block definition required',
            detail: labels.length
              ? 'A block definition must have block content delimited by "{" and "}", starting on the same line as the block header.'
              : 'An argument or block definition is required here. To set an argument, use the equals sign "=" to introduce the argument value.',
            subject: this.tok.range,
          });
        throw new Fail({ severity: 'error', summary: 'Invalid block definition', detail: 'Either a quoted string block label or an opening brace ("{") is expected here.', subject: this.tok.range });
      }
      const open = this.tok;
      this.i++;
      const inner = this.body(open);
      const close = this.tok;
      this.i++;
      this.skipComments();
      if (this.tok.kind !== 'newline' && this.tok.kind !== 'eof' && !(nested && this.is('}')))
        throw new Fail({ severity: 'error', summary: 'Missing newline after block definition', detail: 'A block definition must end with a newline.', subject: this.tok.range });
      blocks.push({ type: t.text, labels, typeRange: t.range, headerRange: span(t.range, last), openBrace: open.range, body: { ...inner, range: span(open.range, close.range) }, range: span(t.range, close.range) });
    }
  }

  expression(): Expr {
    const t = this.tok;
    let e: Expr;
    if (t.kind === 'string') {
      this.i++;
      e = this.template(t);
    } else if (t.kind === 'number') {
      this.i++;
      if (!/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t.text)) throw new Fail({ severity: 'error', summary: 'Invalid number literal', detail: 'Failed to recognize the value of this number literal.', subject: t.range });
      e = { kind: 'literal', value: Number(t.text), range: t.range };
    } else if (this.is('-') && this.peek().kind === 'number') {
      this.i += 2;
      e = { kind: 'literal', value: -Number(this.peek(-1).text), range: span(t.range, this.peek(-1).range) };
    } else if (t.kind === 'ident' && ['true', 'false', 'null'].includes(t.text) && !(this.peek().kind === 'punct' && this.peek().text === '.')) {
      this.i++;
      e = { kind: 'literal', value: t.text === 'null' ? null : t.text === 'true', range: t.range };
    } else if (this.is('[')) e = this.tuple();
    else if (this.is('{')) e = this.object();
    else if (t.kind === 'ident' && this.peek().kind === 'punct' && this.peek().text === '(') e = this.call();
    else if (t.kind === 'ident') {
      this.i++;
      const parts = [t.text];
      let end = t.range;
      while (this.is('.') || this.is('[')) {
        if (this.is('.')) {
          this.i++;
          if (this.tok.kind !== 'ident' && this.tok.kind !== 'number')
            throw new Fail({ severity: 'error', summary: 'Invalid attribute name', detail: 'An attribute name is required after a dot.', subject: this.tok.range });
          parts.push(this.tok.text);
          end = this.tok.range;
          this.i++;
        } else {
          this.i++;
          const index = this.expression();
          if (!this.is(']')) throw new Fail({ severity: 'error', summary: 'Missing close bracket on index', detail: 'The index operator must end with a closing bracket ("]").', subject: this.tok.range });
          end = this.tok.range;
          this.i++;
          parts.push(index.kind === 'literal' ? String(index.value) : '?');
        }
      }
      e = { kind: 'ref', parts, range: span(t.range, end) };
    } else if (t.kind === 'eof') throw new Fail({ severity: 'error', summary: 'Missing expression', detail: 'Expected the start of an expression, but found the end of the file.', subject: t.range });
    else if (t.kind === 'invalid' && t.text.startsWith('"'))
      throw new Fail({ severity: 'error', summary: 'Unterminated template string', detail: 'No closing marker was found for the string.', subject: t.range });
    else throw new Fail({ severity: 'error', summary: 'Invalid expression', detail: 'Expected the start of an expression, but found an invalid expression token.', subject: t.range });
    return e;
  }

  // "text ${expr} text": the parts between the quotes.
  template(t: Token): Expr {
    const raw = t.text.slice(1, -1);
    const parts: (string | Expr)[] = [];
    let k = 0;
    let text = '';
    while (k < raw.length) {
      if (raw[k] === '\\') {
        text += raw.slice(k, k + 2);
        k += 2;
      } else if (raw[k] === '$' && raw[k + 1] === '{') {
        let depth = 1;
        let j = k + 2;
        while (j < raw.length && depth) {
          if (raw[j] === '{') depth++;
          else if (raw[j] === '}') depth--;
          if (depth) j++;
        }
        if (text) parts.push(unescape(text));
        text = '';
        const offset = t.range.start.offset + 1 + k + 2;
        const inner = lex(raw.slice(k + 2, j), t.range.file).map((x) => ({
          ...x,
          range: { ...x.range, start: { line: t.range.start.line, col: t.range.start.col + 1 + k + 2 + x.range.start.offset, offset: offset + x.range.start.offset }, end: { line: t.range.start.line, col: t.range.start.col + 1 + k + 2 + x.range.end.offset, offset: offset + x.range.end.offset } },
        }));
        const p = new Parser(inner, this.src);
        parts.push(p.expression());
        k = j + 1;
      } else {
        text += raw[k];
        k++;
      }
    }
    if (text) parts.push(unescape(text));
    if (parts.every((x) => typeof x === 'string')) return { kind: 'literal', value: parts.join(''), range: t.range };
    return { kind: 'template', parts, range: t.range };
  }

  tuple(): Expr {
    const open = this.tok;
    this.i++;
    const items: Expr[] = [];
    for (;;) {
      this.skipBlank();
      if (this.is(']')) break;
      if (this.tok.kind === 'eof')
        throw new Fail({
          severity: 'error',
          summary: 'Unterminated tuple constructor expression',
          detail: 'There is no corresponding closing bracket before the end of the file. This may be caused by incorrect bracket nesting elsewhere in this file.',
          subject: open.range,
        });
      items.push(this.expression());
      this.skipBlank();
      if (this.is(',')) this.i++;
      else if (!this.is(']')) throw new Fail({ severity: 'error', summary: 'Missing item separator', detail: 'Expected a comma to mark the beginning of the next item.', subject: this.tok.range });
    }
    const close = this.tok;
    this.i++;
    return { kind: 'tuple', items, range: span(open.range, close.range) };
  }

  object(): Expr {
    const open = this.tok;
    this.i++;
    const items: { key: string; value: Expr }[] = [];
    for (;;) {
      this.skipBlank();
      if (this.is('}')) break;
      if (this.tok.kind === 'eof')
        throw new Fail({
          severity: 'error',
          summary: 'Unterminated object constructor expression',
          detail: 'There is no corresponding closing brace before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.',
          subject: open.range,
        });
      const k = this.tok;
      if (k.kind !== 'ident' && k.kind !== 'string') throw new Fail({ severity: 'error', summary: 'Invalid expression', detail: 'Expected the start of an expression, but found an invalid expression token.', subject: k.range });
      this.i++;
      if (!this.is('=') && !this.is(':'))
        throw new Fail({ severity: 'error', summary: 'Missing key/value separator', detail: 'Expected an equals sign ("=") to mark the beginning of the attribute value.', subject: this.tok.range });
      this.i++;
      items.push({ key: k.kind === 'string' ? unescape(k.text.slice(1, -1)) : k.text, value: this.expression() });
      this.skipComments();
      if (this.is(',')) this.i++;
      else if (this.tok.kind !== 'newline' && !this.is('}'))
        throw new Fail({ severity: 'error', summary: 'Missing attribute separator', detail: 'Expected a newline or comma to mark the beginning of the next attribute.', subject: this.tok.range });
    }
    const close = this.tok;
    this.i++;
    return { kind: 'object', items, range: span(open.range, close.range) };
  }

  call(): Expr {
    const name = this.tok;
    this.i += 2;
    const args: Expr[] = [];
    for (;;) {
      this.skipBlank();
      if (this.is(')')) break;
      if (this.tok.kind === 'eof')
        throw new Fail({
          severity: 'error',
          summary: 'Unterminated function call',
          detail: 'There is no closing parenthesis for this function call before the end of the file. This may be caused by incorrect parenthesis nesting elsewhere in this file.',
          subject: name.range,
        });
      args.push(this.expression());
      this.skipBlank();
      if (this.is(',')) this.i++;
      else if (!this.is(')')) throw new Fail({ severity: 'error', summary: 'Missing argument separator', detail: 'A comma is required to separate each function argument from the next.', subject: this.tok.range });
    }
    const close = this.tok;
    this.i++;
    return { kind: 'call', name: name.text, args, range: span(name.range, close.range) };
  }
}

/** A file's body, or its first syntax error (hclsyntax stops there). */
export function parse(src: string, file: string): { body: Body | null; diagnostics: Diagnostic[] } {
  const tokens = lex(src, file);
  const p = new Parser(tokens, src);
  try {
    return { body: p.body(null), diagnostics: [] };
  } catch (e) {
    if (e instanceof Fail) return { body: null, diagnostics: [e.diagnostic] };
    throw e;
  }
}

/** The value of an expression that only holds literals (a .tfvars file, the lock file). */
export function literal(e: Expr): Value | undefined {
  if (e.kind === 'literal') return e.value;
  if (e.kind === 'tuple') {
    const items = e.items.map(literal);
    return items.some((x) => x === undefined) ? undefined : (items as Value[]);
  }
  if (e.kind === 'object') {
    const out: Record<string, Value> = {};
    for (const it of e.items) {
      const v = literal(it.value);
      if (v === undefined) return undefined;
      out[it.key] = v;
    }
    return out;
  }
  return undefined;
}

// ——— fmt ———

const OPENERS = ['{', '[', '('];
const CLOSERS = ['}', ']', ')'];

/** The space hclwrite puts between two tokens of a line. */
function spaceBetween(a: Token, b: Token): string {
  const pa = a.kind === 'punct' ? a.text : '';
  const pb = b.kind === 'punct' ? b.text : '';
  if (b.kind === 'comment') return ' ';
  if ([',', ')', ']', '.'].includes(pb)) return '';
  if (['(', '[', '.'].includes(pa)) return '';
  if (pa === '!' || (pa === '-' && b.kind === 'number' && !['ident', 'number'].includes(a.kind))) return '';
  if (pb === '(' && a.kind === 'ident') return '';
  if (pb === '[' && (a.kind === 'ident' || pa === ']' || pa === ')')) return '';
  if (pa === '{' && pb === '}') return '';
  return ' ';
}

/** The text `tofu fmt` writes for a file (its syntax must be valid). */
export function format(src: string): string {
  const tokens = lex(src, 'fmt').filter((t) => t.kind !== 'eof');
  const lines: Token[][] = [[]];
  for (const t of tokens) {
    if (t.kind === 'newline') lines.push([]);
    else lines[lines.length - 1].push(t);
  }
  let depth = 0;
  const out: { indent: number; tokens: Token[] }[] = [];
  for (const line of lines) {
    const leading = line.length && line[0].kind === 'punct' && CLOSERS.includes(line[0].text) ? 1 : 0;
    out.push({ indent: Math.max(0, depth - leading), tokens: line });
    for (const t of line) {
      if (t.kind !== 'punct') continue;
      if (OPENERS.includes(t.text)) depth++;
      if (CLOSERS.includes(t.text)) depth = Math.max(0, depth - 1);
    }
  }
  const rendered = out.map(({ indent, tokens: ts }) => {
    if (!ts.length) return { indent, key: null as string | null, rest: '' };
    let text = ts[0].text;
    for (let k = 1; k < ts.length; k++) text += spaceBetween(ts[k - 1], ts[k]) + ts[k].text;
    // An argument (or an object's key = value): its name, then the rest from "=".
    const assign = ts.length > 2 && (ts[0].kind === 'ident' || ts[0].kind === 'string') && ts[1].kind === 'punct' && ts[1].text === '=';
    if (assign) {
      let rest = '=';
      for (let k = 2; k < ts.length; k++) rest += spaceBetween(ts[k - 1], ts[k]) + ts[k].text;
      return { indent, key: ts[0].text, rest };
    }
    return { indent, key: null, rest: text };
  });
  // Consecutive arguments at the same indentation: their "=" aligned.
  const result: string[] = [];
  for (let k = 0; k < rendered.length; ) {
    const r = rendered[k];
    if (r.key === null) {
      result.push(r.rest ? '  '.repeat(r.indent) + r.rest : '');
      k++;
      continue;
    }
    let end = k;
    while (end < rendered.length && rendered[end].key !== null && rendered[end].indent === r.indent) end++;
    const width = Math.max(...rendered.slice(k, end).map((x) => x.key!.length));
    for (let m = k; m < end; m++) result.push('  '.repeat(r.indent) + rendered[m].key!.padEnd(width) + ' ' + rendered[m].rest);
    k = end;
  }
  while (result.length && result[result.length - 1] === '') result.pop();
  // The file's last newline as it was (the game's files keep none).
  return result.join('\n') + (src.endsWith('\n') ? '\n' : '');
}
