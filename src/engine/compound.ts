// bash's grammar beyond a simple list (man bash, "SHELL GRAMMAR"): the
// compound commands for, for ((…)), if, while, until, case, { …; } and
// ( … ), the arithmetic command ((…)), pipelines that hold them, "&" (a
// job in the background), newlines as separators, comments, and
// here-documents (<<EOF, <<-EOF, <<'EOF'). The parser reads a whole input,
// which may span several lines: an input that stops in the middle of a
// construct is `incomplete` (bash then shows its secondary prompt, PS2,
// "> ", and reads on). A simple command is kept as the text it was typed
// with: the shell (shell.ts) expands and runs it as if typed alone.

import { redirectionAt } from './tools';

export interface HereDoc {
  // The delimiter, without its quotes; quoted: the body is not expanded.
  delimiter: string;
  quoted: boolean;
  // <<-: leading tabs are removed from the body's lines and the delimiter's.
  strip: boolean;
  body: string;
  // The input ended before the delimiter (only when allowed: Ctrl-D, a script's end).
  unterminated?: boolean;
}

// A compound's own redirection: its input (<, <<<, a here-document), its output (>, >>).
export interface Redirect {
  op: string;
  target: string;
  heredoc?: HereDoc;
}

export type Node =
  // line: where it starts in the input (a script's error messages give it).
  | { kind: 'simple'; text: string; heredoc?: HereDoc; line?: number }
  // name() compound, or bash's function name { …; }: a shell function.
  | { kind: 'function'; name: string; body: Node; line?: number }
  // bash's [[ … ]]: a conditional expression, kept as typed.
  | { kind: 'cond'; expr: string; redirects: Redirect[]; line?: number }
  | { kind: 'pipeline'; parts: Node[]; negate: boolean }
  | { kind: 'andor'; first: Node; rest: { op: '&&' | '||'; node: Node }[] }
  | { kind: 'for'; name: string; words: string[] | null; body: List; redirects: Redirect[] }
  | { kind: 'cfor'; init: string; test: string; step: string; body: List; redirects: Redirect[] }
  | { kind: 'if'; branches: { test: List; body: List }[]; otherwise: List | null; redirects: Redirect[] }
  | { kind: 'while'; until: boolean; test: List; body: List; redirects: Redirect[] }
  | { kind: 'case'; word: string; arms: { patterns: string[]; body: List; end: ';;' | ';&' | ';;&' }[]; redirects: Redirect[] }
  | { kind: 'group'; body: List; subshell: boolean; redirects: Redirect[] }
  | { kind: 'arith'; expr: string; redirects: Redirect[] };

export interface ListEntry {
  node: Node;
  // Followed by "&": run in the background.
  background: boolean;
  // The text of this entry, as typed (for jobs: "[1]+  Done   sleep 5").
  text: string;
}
export type List = ListEntry[];

export type Parsed = { list: List } | { incomplete: true } | { error: string; eof?: boolean };

interface Tok {
  t: 'word' | 'op' | 'nl' | 'arith' | 'cond';
  text: string;
  start: number;
  end: number;
  // A word with a quote or a backslash in it: never a reserved word.
  quoted?: boolean;
  heredoc?: HereDoc;
}

const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'while', 'until', 'do', 'done', 'case', 'esac', '{', '}', '!']);

// What the lexer and the parser read: a script keeps a carriage return in its
// words (a file saved on Windows), and only bash knows [[ … ]] and `function`.
export interface Dialect {
  // \r is part of a word (in a script), not a blank (on the interactive line).
  cr: boolean;
  bash: boolean;
}
const INTERACTIVE: Dialect = { cr: false, bash: true };

class Incomplete extends Error {
  // The word the input stops before (dash: "end of file unexpected (expecting "fi")").
  constructor(public expecting?: string) {
    super('incomplete');
  }
}
class Syntax extends Error {
  // pos: where the unexpected token starts in the input; bad: a function's name dash refuses.
  constructor(
    public token: string,
    public pos = -1,
    public bad = false,
  ) {
    super(token);
  }
}

// Where the lexer is (the start of the token it reads): an input that stops
// inside a quote stops there.
let lexAt = 0;
// Words that a command may follow (for [[, which only starts a command).
const STARTERS = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', '{', '}', 'time']);
const STARTER_OPS = new Set(['&&', '||', ';', ';;', ';&', ';;&', '&', '|', '|&', '(', ')']);

/** Where a $( … ), ${ … } or `…` starting at i ends (the index after it), or -1 if the input stops first. */
function skipExpansion(s: string, i: number): number {
  if (s[i] === '`') {
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === '\\') j++;
      else if (s[j] === '`') return j + 1;
    }
    return -1;
  }
  const open = s[i + 1];
  const close = open === '(' ? ')' : '}';
  let depth = 0;
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === "'" && open === '(') {
      const k = s.indexOf("'", j + 1);
      if (k < 0) return -1;
      j = k;
      continue;
    }
    if (c === '"') {
      const k = skipDouble(s, j);
      if (k < 0) return -1;
      j = k - 1;
      continue;
    }
    if (c === '$' && (s[j + 1] === '(' || s[j + 1] === '{')) {
      const k = skipExpansion(s, j);
      if (k < 0) return -1;
      j = k - 1;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  return -1;
}

/** Where a "…" string starting at i ends (after its closing quote), or -1. */
function skipDouble(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') j++;
    else if (c === '"') return j + 1;
    else if ((c === '$' && (s[j + 1] === '(' || s[j + 1] === '{')) || c === '`') {
      const k = skipExpansion(s, j);
      if (k < 0) return -1;
      j = k - 1;
    }
  }
  return -1;
}

/** Splits the input into tokens; reads here-document bodies after their line. */
function lex(src: string, eofOk: boolean, dialect: Dialect = INTERACTIVE): Tok[] {
  const toks: Tok[] = [];
  const pending: HereDoc[] = [];
  let i = 0;
  const readBodies = (from: number): number => {
    // The bodies start on the line after the operator, in order.
    let at = from;
    for (const h of pending) {
      const lines: string[] = [];
      let found = false;
      while (at < src.length) {
        const nl = src.indexOf('\n', at);
        const line = src.slice(at, nl < 0 ? src.length : nl);
        at = nl < 0 ? src.length : nl + 1;
        const bare = h.strip ? line.replace(/^\t+/, '') : line;
        if (bare === h.delimiter) {
          found = true;
          break;
        }
        lines.push(bare);
      }
      if (!found) {
        if (!eofOk) throw new Incomplete();
        h.unterminated = true;
      }
      h.body = lines.join('\n');
    }
    pending.length = 0;
    return at;
  };
  while (i < src.length) {
    const c = src[i];
    lexAt = i;
    if (c === ' ' || c === '\t' || (c === '\r' && !dialect.cr)) {
      i++;
      continue;
    }
    // A backslash-newline joins the lines.
    if (c === '\\' && src[i + 1] === '\n') {
      i += 2;
      continue;
    }
    if (c === '\n') {
      toks.push({ t: 'nl', text: '\n', start: i, end: i + 1 });
      i = pending.length ? readBodies(i + 1) : i + 1;
      continue;
    }
    // A comment, from a # that starts a word to the end of the line.
    if (c === '#') {
      const nl = src.indexOf('\n', i);
      i = nl < 0 ? src.length : nl;
      continue;
    }
    // ((…)): an arithmetic command, read up to its matching )).
    if (c === '(' && src[i + 1] === '(') {
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')' && --depth === 0) break;
      }
      if (j >= src.length) throw new Incomplete();
      if (src[j - 1] === ')') {
        toks.push({ t: 'arith', text: src.slice(i + 2, j - 1), start: i, end: j + 1 });
        i = j + 1;
        continue;
      }
    }
    // Here-documents: << and <<- (but not <<<).
    if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
      const strip = src[i + 2] === '-';
      const opEnd = i + (strip ? 3 : 2);
      let j = opEnd;
      while (src[j] === ' ' || src[j] === '\t') j++;
      const word = readWord(src, j, dialect);
      if (!word) throw new Syntax(src[j] === undefined || src[j] === '\n' ? 'newline' : src[j], j);
      const quoted = /['"\\]/.test(word.text);
      const h: HereDoc = { delimiter: word.text.replace(/\\(.)/g, '$1').replace(/['"]/g, ''), quoted, strip, body: '' };
      pending.push(h);
      toks.push({ t: 'op', text: strip ? '<<-' : '<<', start: i, end: word.end, heredoc: h });
      i = word.end;
      continue;
    }
    const startOfWord = true;
    const redirection = (c === '>' || c === '<' || c === '&' || /\d/.test(c)) && redirectionAt(src, i, startOfWord);
    if (redirection) {
      const typed = /^(1>&2|1>>|1>)/.exec(src.slice(i))?.[0] ?? redirection;
      toks.push({ t: 'op', text: redirection, start: i, end: i + typed.length });
      i += typed.length;
      continue;
    }
    // bash's [[ … ]], where a command starts: read up to the ]] that ends it.
    if (dialect.bash && c === '[' && src[i + 1] === '[' && /[ \t\n]/.test(src[i + 2] ?? '') && startsCommand(toks)) {
      const end = condEnd(src, i + 2);
      if (end < 0) throw new Incomplete(']]');
      toks.push({ t: 'cond', text: src.slice(i + 2, end).trim(), start: i, end: end + 2 });
      i = end + 2;
      continue;
    }
    const op = ['&&', '||', ';;&', ';;', ';&', '|&', ';', '&', '|', '(', ')'].find((o) => src.startsWith(o, i));
    if (op) {
      toks.push({ t: 'op', text: op, start: i, end: i + op.length });
      i += op.length;
      continue;
    }
    const word = readWord(src, i, dialect);
    if (!word) throw new Syntax(c, i);
    toks.push({ t: 'word', text: word.text, start: i, end: word.end, quoted: word.quoted });
    i = word.end;
  }
  if (pending.length) {
    if (!eofOk) throw new Incomplete();
    for (const h of pending) {
      h.unterminated = true;
      h.body = '';
    }
  }
  return toks;
}

/** Whether the next token starts a command (after an operator, a newline or a reserved word). */
function startsCommand(toks: Tok[]): boolean {
  const last = toks.at(-1);
  if (!last || last.t === 'nl') return true;
  if (last.t === 'op') return STARTER_OPS.has(last.text);
  return last.t === 'word' && !last.quoted && STARTERS.has(last.text);
}

/** Where the ]] closing a [[ starts (outside quotes and expansions), or -1. */
function condEnd(src: string, i: number): number {
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') j++;
    else if (c === "'") {
      const k = src.indexOf("'", j + 1);
      if (k < 0) return -1;
      j = k;
    } else if (c === '"') {
      const k = skipDouble(src, j);
      if (k < 0) return -1;
      j = k - 1;
    } else if ((c === '$' && (src[j + 1] === '(' || src[j + 1] === '{')) || c === '`') {
      const k = skipExpansion(src, j);
      if (k < 0) return -1;
      j = k - 1;
    } else if (c === ']' && src[j + 1] === ']' && /[ \t]/.test(src[j - 1]) && (j + 2 >= src.length || /[\s;&|)]/.test(src[j + 2]))) return j;
  }
  return -1;
}

/** A word from i: up to a blank or an operator outside quotes and expansions. */
function readWord(src: string, i: number, dialect: Dialect = INTERACTIVE): { text: string; end: number; quoted: boolean } | null {
  let j = i;
  let quoted = false;
  let text = '';
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') {
      if (src[j + 1] === '\n') {
        j += 2;
        continue;
      }
      if (j + 1 >= src.length) throw new Incomplete();
      quoted = true;
      text += c + src[j + 1];
      j += 2;
      continue;
    }
    if (c === "'") {
      const k = src.indexOf("'", j + 1);
      if (k < 0) throw new Incomplete();
      quoted = true;
      text += src.slice(j, k + 1);
      j = k + 1;
      continue;
    }
    if (c === '"') {
      const k = skipDouble(src, j);
      if (k < 0) throw new Incomplete();
      quoted = true;
      text += src.slice(j, k);
      j = k;
      continue;
    }
    if ((c === '$' && (src[j + 1] === '(' || src[j + 1] === '{')) || c === '`') {
      const k = skipExpansion(src, j);
      if (k < 0) throw new Incomplete();
      text += src.slice(j, k);
      j = k;
      continue;
    }
    if (/[ \t\n\f\v;&|()<>]/.test(c) || (c === '\r' && !dialect.cr)) {
      // A > or < glued to a word (a>b): the word stops there; a redirection follows.
      break;
    }
    text += c;
    j++;
  }
  return j > i ? { text, end: j, quoted } : null;
}

class Parser {
  p = 0;
  // Where each line starts in the input (for a node's line number).
  private starts: number[] = [0];
  constructor(
    private toks: Tok[],
    private src: string,
    private dialect: Dialect = INTERACTIVE,
  ) {
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') this.starts.push(i + 1);
  }

  /** The line (from 1) of a position in the input. */
  lineOf(pos: number): number {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  peek(): Tok | undefined {
    return this.toks[this.p];
  }
  isWord(text: string): boolean {
    const t = this.peek();
    return t?.t === 'word' && !t.quoted && t.text === text;
  }
  isOp(text: string): boolean {
    const t = this.peek();
    return t?.t === 'op' && t.text === text;
  }
  newlines(): void {
    while (this.peek()?.t === 'nl') this.p++;
  }
  expectWord(text: string): void {
    this.newlines();
    const t = this.peek();
    if (!t) throw new Incomplete(text);
    if (t.t !== 'word' || t.quoted || t.text !== text) throw new Syntax(t.t === 'nl' ? 'newline' : t.t === 'cond' ? '[[' : t.text, t.start);
    this.p++;
  }
  fail(expecting?: string): never {
    const t = this.peek();
    if (!t) throw new Incomplete(expecting);
    throw new Syntax(t.t === 'nl' ? 'newline' : t.t === 'arith' ? '((' : t.t === 'cond' ? '[[' : t.text, t.start);
  }

  // One line of a script: its commands, up to the newline that ends them (a
  // shell reads, then runs, a script line by line: a syntax error further
  // down doesn't stop what comes before).
  chunk(): List {
    const items: List = [];
    for (;;) {
      const t = this.peek();
      if (!t || t.t === 'nl') return items;
      const start = t.start;
      const node = this.andOr();
      const last = this.toks[this.p - 1];
      const entry: ListEntry = { node, background: false, text: this.src.slice(start, last.end).replace(/\\\n/g, '').trim() };
      items.push(entry);
      const sep = this.peek();
      if (!sep || sep.t === 'nl') return items;
      if (sep.t === 'op' && (sep.text === ';' || sep.text === '&')) {
        entry.background = sep.text === '&';
        this.p++;
        continue;
      }
      this.fail();
    }
  }

  // A list, up to one of the reserved words (or ")" or a case terminator) that end it.
  list(ends: string[], top = false): List {
    const items: List = [];
    for (;;) {
      this.newlines();
      const t = this.peek();
      if (!t) {
        if (top) return items;
        throw new Incomplete(ends.find((e) => e !== ';;'));
      }
      if (t.t === 'word' && !t.quoted && ends.includes(t.text)) return items;
      if (t.t === 'op' && (ends.includes(t.text) || ((t.text === ';;' || t.text === ';&' || t.text === ';;&') && ends.includes(';;')))) return items;
      const start = t.start;
      const node = this.andOr();
      const last = this.toks[this.p - 1];
      const entry: ListEntry = { node, background: false, text: this.src.slice(start, last.end).replace(/\\\n/g, '').trim() };
      items.push(entry);
      const sep = this.peek();
      if (!sep) continue;
      if (sep.t === 'op' && (sep.text === ';' || sep.text === '&')) {
        entry.background = sep.text === '&';
        this.p++;
        continue;
      }
      if (sep.t === 'nl') continue;
      if (sep.t === 'word' && !sep.quoted && ends.includes(sep.text)) continue;
      if (sep.t === 'op' && (ends.includes(sep.text) || ((sep.text === ';;' || sep.text === ';&' || sep.text === ';;&') && ends.includes(';;')))) continue;
      this.fail();
    }
  }

  andOr(): Node {
    const first = this.pipeline();
    const rest: { op: '&&' | '||'; node: Node }[] = [];
    while (this.isOp('&&') || this.isOp('||')) {
      const op = this.peek()!.text as '&&' | '||';
      this.p++;
      this.newlines();
      if (!this.peek()) throw new Incomplete();
      rest.push({ op, node: this.pipeline() });
    }
    return rest.length ? { kind: 'andor', first, rest } : first;
  }

  pipeline(): Node {
    let negate = false;
    if (this.isWord('!')) {
      negate = true;
      this.p++;
    }
    const parts = [this.command()];
    while (this.isOp('|') || this.isOp('|&')) {
      // |& is 2>&1 |: the errors go down the pipe too.
      const last = parts.at(-1)!;
      if (this.peek()!.text === '|&' && last.kind === 'simple') last.text += ' 2>&1';
      this.p++;
      this.newlines();
      if (!this.peek()) throw new Incomplete();
      parts.push(this.command());
    }
    return parts.length > 1 || negate ? { kind: 'pipeline', parts, negate } : parts[0];
  }

  command(): Node {
    const t = this.peek();
    if (!t) throw new Incomplete();
    if (t.t === 'cond') {
      this.p++;
      return { kind: 'cond', expr: t.text, redirects: this.redirects(), line: this.lineOf(t.start) };
    }
    if (t.t === 'word' && !t.quoted && t.text === 'function' && this.dialect.bash) return this.functionKeyword();
    if (t.t === 'arith') {
      this.p++;
      return { kind: 'arith', expr: t.text, redirects: this.redirects() };
    }
    if (t.t === 'op' && t.text === '(') {
      this.p++;
      const body = this.list([')']);
      if (!this.isOp(')')) this.fail(')');
      this.p++;
      if (!body.length) throw new Syntax(')', this.toks[this.p - 1].start);
      return { kind: 'group', body, subshell: true, redirects: this.redirects() };
    }
    if (t.t === 'word' && !t.quoted) {
      switch (t.text) {
        case 'if':
          return this.ifClause();
        case 'for':
          return this.forClause();
        case 'while':
        case 'until':
          return this.whileClause(t.text === 'until');
        case 'case':
          return this.caseClause();
        case '{': {
          this.p++;
          const body = this.list(['}']);
          this.expectWord('}');
          if (!body.length) throw new Syntax('}', this.toks[this.p - 1].start);
          return { kind: 'group', body, subshell: false, redirects: this.redirects() };
        }
        case 'then':
        case 'elif':
        case 'else':
        case 'fi':
        case 'do':
        case 'done':
        case 'esac':
        case '}':
        case 'in':
          throw new Syntax(t.text, t.start);
      }
    }
    // name ( ): a function definition, its body a compound command.
    const next = this.toks[this.p + 1];
    if (t.t === 'word' && next?.t === 'op' && next.text === '(' && this.toks[this.p + 2]?.t === 'op' && this.toks[this.p + 2].text === ')') {
      if (t.quoted || (!this.dialect.bash && !/^[A-Za-z_]\w*$/.test(t.text))) throw new Syntax(t.text, t.start, true);
      this.p += 3;
      return this.functionBody(t.text, t.start);
    }
    return this.simple();
  }

  // bash: function name [()] compound.
  functionKeyword(): Node {
    const start = this.peek()!.start;
    this.p++;
    const name = this.peek();
    if (!name) throw new Incomplete();
    if (name.t !== 'word') this.fail();
    this.p++;
    if (this.isOp('(')) {
      this.p++;
      if (!this.isOp(')')) this.fail();
      this.p++;
    }
    return this.functionBody(name.text, start);
  }

  functionBody(name: string, start: number): Node {
    this.newlines();
    const t = this.peek();
    if (!t) throw new Incomplete();
    const body = this.command();
    if (body.kind === 'simple' || body.kind === 'function') throw new Syntax(t.t === 'word' ? t.text : t.text, t.start);
    return { kind: 'function', name, body, line: this.lineOf(start) };
  }

  // The words and redirections of a simple command, kept as typed.
  simple(): Node {
    const parts: string[] = [];
    let heredoc: HereDoc | undefined;
    const line = this.lineOf(this.peek()!.start);
    for (;;) {
      const t = this.peek();
      if (!t || t.t === 'nl') break;
      if (t.t === 'word') {
        parts.push(t.text);
        this.p++;
        continue;
      }
      if (t.t === 'op' && t.heredoc) {
        heredoc = t.heredoc;
        this.p++;
        continue;
      }
      if (t.t === 'op' && /[<>]/.test(t.text)) {
        parts.push(t.text);
        this.p++;
        // 2>&1 and >&2 take no file.
        if (t.text === '2>&1' || t.text === '>&2') continue;
        const target = this.peek();
        if (!target || target.t === 'nl') throw new Syntax('newline', target?.start ?? this.src.length);
        if (target.t !== 'word') throw new Syntax(target.text, target.start);
        parts.push(target.text);
        this.p++;
        continue;
      }
      break;
    }
    if (!parts.length && !heredoc) this.fail();
    // Words, then "(": not a function definition (one name, then "()").
    if (this.isOp('(')) this.fail();
    return { kind: 'simple', text: parts.join(' '), ...(heredoc ? { heredoc } : {}), line };
  }

  redirects(): Redirect[] {
    const out: Redirect[] = [];
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op') return out;
      if (t.heredoc) {
        out.push({ op: t.text, target: '', heredoc: t.heredoc });
        this.p++;
        continue;
      }
      if (!/[<>]/.test(t.text)) return out;
      this.p++;
      if (t.text === '2>&1' || t.text === '>&2') {
        out.push({ op: t.text, target: '' });
        continue;
      }
      const target = this.peek();
      if (!target || target.t === 'nl') throw new Syntax('newline', target?.start ?? this.src.length);
      if (target.t !== 'word') throw new Syntax(target.text, target.start);
      this.p++;
      out.push({ op: t.text, target: target.text });
    }
  }

  ifClause(): Node {
    this.p++;
    const branches: { test: List; body: List }[] = [];
    let otherwise: List | null = null;
    for (;;) {
      const test = this.list(['then']);
      if (!test.length) this.fail('then');
      this.expectWord('then');
      const body = this.list(['elif', 'else', 'fi']);
      if (!body.length) this.fail('fi');
      branches.push({ test, body });
      if (this.isWord('elif')) {
        this.p++;
        continue;
      }
      if (this.isWord('else')) {
        this.p++;
        otherwise = this.list(['fi']);
        if (!otherwise.length) this.fail('fi');
      }
      this.expectWord('fi');
      return { kind: 'if', branches, otherwise, redirects: this.redirects() };
    }
  }

  doGroup(): List {
    this.expectWord('do');
    const body = this.list(['done']);
    if (!body.length) this.fail('done');
    this.expectWord('done');
    return body;
  }

  forClause(): Node {
    this.p++;
    const t = this.peek();
    if (!t) throw new Incomplete();
    // for ((init; test; step))
    if (t.t === 'arith') {
      this.p++;
      const parts = t.text.split(';');
      if (parts.length !== 3) throw new Syntax('((', t.start);
      if (this.isOp(';')) this.p++;
      this.newlines();
      const body = this.doGroup();
      return { kind: 'cfor', init: parts[0], test: parts[1], step: parts[2], body, redirects: this.redirects() };
    }
    if (t.t !== 'word' || !/^[A-Za-z_]\w*$/.test(t.text)) {
      if (t.t === 'word') throw new Syntax(t.text, t.start);
      this.fail();
    }
    const name = t.text;
    this.p++;
    let words: string[] | null = null;
    this.newlines();
    if (this.isWord('in')) {
      this.p++;
      words = [];
      while (this.peek()?.t === 'word') words.push(this.toks[this.p++].text);
      if (!this.peek()) throw new Incomplete();
      if (this.isOp(';')) this.p++;
      else if (this.peek()?.t !== 'nl') this.fail();
    } else if (this.isOp(';')) this.p++;
    this.newlines();
    const body = this.doGroup();
    return { kind: 'for', name, words, body, redirects: this.redirects() };
  }

  whileClause(until: boolean): Node {
    this.p++;
    const test = this.list(['do']);
    if (!test.length) this.fail('do');
    const body = this.doGroup();
    return { kind: 'while', until, test, body, redirects: this.redirects() };
  }

  caseClause(): Node {
    this.p++;
    const w = this.peek();
    if (!w) throw new Incomplete();
    if (w.t !== 'word') this.fail();
    this.p++;
    this.expectWord('in');
    const arms: { patterns: string[]; body: List; end: ';;' | ';&' | ';;&' }[] = [];
    for (;;) {
      this.newlines();
      if (!this.peek()) throw new Incomplete();
      if (this.isWord('esac')) {
        this.p++;
        return { kind: 'case', word: w.text, arms, redirects: this.redirects() };
      }
      if (this.isOp('(')) this.p++;
      const patterns: string[] = [];
      for (;;) {
        const t = this.peek();
        if (!t) throw new Incomplete();
        if (t.t !== 'word') this.fail();
        patterns.push(t.text);
        this.p++;
        if (this.isOp('|')) {
          this.p++;
          continue;
        }
        if (this.isOp(')')) {
          this.p++;
          break;
        }
        this.fail();
      }
      const body = this.list(['esac', ';;']);
      let end: ';;' | ';&' | ';;&' = ';;';
      const t = this.peek();
      if (!t) throw new Incomplete();
      if (t.t === 'op' && (t.text === ';;' || t.text === ';&' || t.text === ';;&')) {
        end = t.text;
        this.p++;
      } else if (!this.isWord('esac')) this.fail();
      arms.push({ patterns, body, end });
    }
  }
}

/**
 * Parses an input (one or more lines). `eofOk`: the input is over (Ctrl-D,
 * the end of a script): a here-document without its delimiter ends there,
 * as bash does with a warning.
 */
export function parse(src: string, eofOk = false): Parsed {
  try {
    const toks = lex(src, eofOk);
    const parser = new Parser(toks, src);
    const list = parser.list([], true);
    if (parser.p < toks.length) parser.fail();
    return { list };
  } catch (e) {
    if (e instanceof Incomplete) return eofOk ? { error: '', eof: true } : { incomplete: true };
    if (e instanceof Syntax) return { error: e.token };
    throw e;
  }
}

/** A syntax error in a script, where the shell found it. */
export interface ScriptError {
  line: number;
  // The unexpected token ("fi", "newline", "("), or none: the file ended too soon.
  token?: string;
  // What the parser was waiting for at the end of the file ("fi", "done", ")").
  expecting?: string;
  // The file ended inside quotes or an expansion: the character that was never closed.
  open?: string;
  // dash: a function's name it refuses ("Bad function name").
  badName?: boolean;
  // Where the file ended (dash gives it for an unterminated quote; bash, where the quote opened).
  eofLine?: number;
}

/** What could not be closed in a word starting at i: a quote, $( or ${, a backquote. */
function opened(src: string, i: number): string {
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') j++;
    else if (c === "'") {
      const k = src.indexOf("'", j + 1);
      if (k < 0) return "'";
      j = k;
    } else if (c === '"') {
      const k = skipDouble(src, j);
      if (k < 0) return '"';
      j = k - 1;
    } else if ((c === '$' && (src[j + 1] === '(' || src[j + 1] === '{')) || c === '`') {
      const k = skipExpansion(src, j);
      if (k < 0) return c === '`' ? '`' : src[j + 1] === '(' ? ')' : '}';
      j = k - 1;
    }
  }
  return '"';
}

/**
 * Parses a script (sh, bash, a cron line): its lines, each a list the shell
 * runs before it reads the next one, up to the first syntax error, if any
 * (the lines before it still run, as with dash and bash). A carriage return
 * stays in the words; `bash`: [[ … ]] and the function keyword exist.
 */
export function parseScript(src: string, bash: boolean): { chunks: List[]; error?: ScriptError } {
  const dialect: Dialect = { cr: true, bash };
  // The line after the last one (where the shells say the file ended).
  const lines = src.replace(/\n$/, '').split('\n').length + 1;
  let toks: Tok[];
  let lexError: ScriptError | null = null;
  try {
    toks = lex(src, true, dialect);
  } catch (e) {
    if (!(e instanceof Incomplete) && !(e instanceof Syntax)) throw e;
    // The input stopped inside a word (or a token the lexer refused): what comes
    // before that word's line still runs.
    const at = lexAt;
    const lineStart = src.lastIndexOf('\n', at - 1) + 1;
    const before = src.slice(0, lineStart);
    const startLine = before.split('\n').length;
    lexError = e instanceof Syntax ? { line: startLine, token: e.token } : { line: startLine, eofLine: lines, open: opened(src, at) };
    try {
      toks = lex(before, true, dialect);
    } catch {
      return { chunks: [], error: lexError };
    }
  }
  const parser = new Parser(toks, src, dialect);
  const chunks: List[] = [];
  for (;;) {
    parser.newlines();
    if (!parser.peek()) break;
    const from = parser.p;
    try {
      chunks.push(parser.chunk());
    } catch (e) {
      if (lexError) return { chunks, error: lexError };
      if (e instanceof Incomplete) return { chunks, error: { line: lines, expecting: e.expecting } };
      if (e instanceof Syntax) {
        const pos = e.pos >= 0 ? e.pos : (toks[from]?.start ?? 0);
        return { chunks, error: { line: parser.lineOf(pos), token: e.token, ...(e.bad ? { badName: true } : {}) } };
      }
      throw e;
    }
  }
  return lexError ? { chunks, error: lexError } : { chunks };
}

/** Whether a parsed input is only a plain list (simple commands and pipelines joined by ;, && or ||, on one line), which the shell runs its usual way. */
export function plainList(list: List): boolean {
  const plain = (n: Node): boolean =>
    n.kind === 'simple' ? !n.heredoc : n.kind === 'pipeline' ? !n.negate && n.parts.every(plain) : n.kind === 'andor' ? plain(n.first) && n.rest.every((r) => plain(r.node)) : false;
  return list.every((e) => !e.background && plain(e.node));
}

/** The here-documents of an input still waiting for their delimiter (the warning bash gives at the end of the input). */
export function unterminated(list: List): HereDoc[] {
  const out: HereDoc[] = [];
  const visit = (n: Node) => {
    if (n.kind === 'simple') {
      if (n.heredoc?.unterminated) out.push(n.heredoc);
      return;
    }
    if (n.kind === 'pipeline') return n.parts.forEach(visit);
    if (n.kind === 'andor') return [n.first, ...n.rest.map((r) => r.node)].forEach(visit);
    if (n.kind === 'function') return visit(n.body);
    for (const r of n.redirects) if (r.heredoc?.unterminated) out.push(r.heredoc);
    const lists: List[] =
      n.kind === 'if' ? [...n.branches.flatMap((b) => [b.test, b.body]), ...(n.otherwise ? [n.otherwise] : [])]
      : n.kind === 'case' ? n.arms.map((a) => a.body)
      : n.kind === 'while' ? [n.test, n.body]
      : n.kind === 'arith' || n.kind === 'cond' ? []
      : [n.body];
    lists.forEach((l) => l.forEach((e) => visit(e.node)));
  };
  list.forEach((e) => visit(e.node));
  return out;
}
