// Windows PowerShell 5.1's language, the part an administrator types at the
// prompt: a parser from a line to statements. PowerShell reads a line in two
// modes (about_Parsing): a command's arguments in ARGUMENT mode (barewords
// are strings, C:\Users and Name,Length need no quotes, -Name is a
// parameter), the rest in EXPRESSION mode (numbers, strings, variables,
// operators). Supported:
//   - statements separated by ; or a new line; if/elseif/else, foreach,
//     exit, throw; assignments ($x = …, +=, -=, $env:NAME = …, $x.Prop = …);
//   - pipelines (|) whose first element may be an expression, redirections
//     (> >> 2> 2>&1 *> to a file or $null);
//   - numbers (10, 1.5, 0x1F, 1GB), 'single' and "double" strings ($var,
//     ${var}, $env:X, $(…) and the backtick escapes expanded in the second),
//     variables, arrays (1,2,3; @(…)), hashtables (@{ k = v; … }), script
//     blocks ({ … }), sub-expressions $(…), (…), type literals ([int],
//     [datetime], [math]::Round(…)) and casts;
//   - operators by precedence: member access, index and method call;
//     comma; unary -not ! - and casts; .. ranges; -f; * / %; + -;
//     comparisons (-eq -ne -gt -ge -lt -le -like -notlike -match -notmatch
//     -contains -notcontains -in -notin -replace -split -join -is -isnot
//     -as, with c/i prefixes); -and -or -xor.
// Sources (Microsoft Learn, PowerShell 5.1): about_Parsing,
// about_Operator_Precedence, about_Quoting_Rules, about_Special_Characters,
// about_Comparison_Operators, about_Hash_Tables, about_Script_Blocks,
// about_Redirection, about_Assignment_Operators, about_If, about_Foreach,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_parsing?view=powershell-5.1
// Simplifications (docs/SCENARIOS.md): no functions, no while/for/switch,
// no here-strings, no splatting, no classes; one line at a time.

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'xstr'; parts: (string | Expr)[] }
  | { k: 'var'; name: string }
  | { k: 'arr'; items: Expr[] }
  | { k: 'sub'; body: Statement[]; array: boolean }
  | { k: 'paren'; body: Statement }
  | { k: 'hash'; entries: { key: Expr; value: Statement }[] }
  | { k: 'block'; body: Statement[]; text: string }
  | { k: 'member'; obj: Expr; name: Expr; isStatic?: boolean }
  | { k: 'call'; obj: Expr; name: string; args: Expr[]; isStatic?: boolean }
  | { k: 'index'; obj: Expr; index: Expr }
  | { k: 'type'; name: string }
  | { k: 'cast'; type: string; e: Expr }
  | { k: 'unary'; op: string; e: Expr }
  | { k: 'bin'; op: string; l: Expr; r: Expr; pos: number }
  | { k: 'range'; from: Expr; to: Expr };

export interface Arg {
  // A parameter (-Name, -Name:value) or a value.
  param?: string;
  value?: Expr;
  // Written -Name:value (the value belongs to the parameter even if it starts with -).
  colon?: boolean;
  text: string;
  pos: number;
}
export interface Element {
  // A command (its name, or & expr) or an expression.
  name?: string;
  call?: Expr;
  args: Arg[];
  expr?: Expr;
  pos: number;
  end: number;
}
export interface Redirect {
  stream: '1' | '2' | '*';
  file: Expr | null;
  append: boolean;
  // 2>&1: errors go with the output.
  merge?: boolean;
}
export interface Pipeline {
  elements: Element[];
  redirects: Redirect[];
  pos: number;
  end: number;
}
export type Statement =
  | { k: 'pipe'; p: Pipeline }
  | { k: 'assign'; target: Expr; op: '=' | '+=' | '-='; value: Statement; pos: number }
  | { k: 'if'; clauses: { cond: Statement; body: Statement[] }[]; otherwise?: Statement[] }
  | { k: 'foreach'; name: string; source: Statement; body: Statement[] }
  | { k: 'exit'; e?: Expr }
  | { k: 'throw'; e?: Expr; pos: number };

export class ParseError {
  constructor(
    public message: string,
    public pos: number,
    public id: string,
  ) {}
}

// The comparison operators (with their case-sensitive and -insensitive forms).
const COMPARISON = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'like', 'notlike', 'match', 'notmatch', 'contains', 'notcontains', 'in', 'notin', 'replace', 'split', 'join', 'is', 'isnot', 'as'];
const LOGICAL = ['and', 'or', 'xor'];
export const OPERATORS = new Set([...COMPARISON, ...COMPARISON.flatMap((o) => [`c${o}`, `i${o}`]), ...LOGICAL, 'not', 'f', 'band', 'bor', 'bxor', 'bnot']);

const NUMBER = /^(?:0x[0-9a-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)(kb|mb|gb|tb|pb)?(?![\w]|\.(?!\.))/i;
const SUFFIX: Record<string, number> = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4, pb: 1024 ** 5 };

/** A number literal's value (12, 1.5GB, 0x1F). */
export function numberValue(text: string): number {
  const m = /^(0x[0-9a-f]+|[\d.]+(?:e[+-]?\d+)?)(kb|mb|gb|tb|pb)?$/i.exec(text)!;
  const base = m[1].toLowerCase().startsWith('0x') ? parseInt(m[1], 16) : Number(m[1]);
  return base * (m[2] ? SUFFIX[m[2].toLowerCase()] : 1);
}

const ESCAPES: Record<string, string> = { '0': '\0', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

export class Parser {
  i = 0;
  // Inside a method call's arguments, commas separate the arguments.
  private noComma = 0;
  constructor(public s: string) {}

  // The current character (a method: TypeScript would narrow a property between two reads).
  private ch(): string {
    return this.s[this.i];
  }
  private at(text: string) {
    return this.s.startsWith(text, this.i);
  }
  private fail(message: string, id: string, pos = this.i): never {
    throw new ParseError(message, pos, id);
  }
  /** Spaces and tabs (a backtick at the end of a line continues it). */
  private ws() {
    while (this.i < this.s.length) {
      if (this.ch() === ' ' || this.ch() === '\t') this.i++;
      else if (this.ch() === '`' && this.s[this.i + 1] === '\n') this.i += 2;
      else if (this.ch() === '#') {
        while (this.i < this.s.length && this.ch() !== '\n') this.i++;
      } else break;
    }
  }
  /** Spaces and new lines (inside parentheses, after an operator or a pipe). */
  private wsn() {
    for (;;) {
      this.ws();
      if (this.ch() === '\n' || this.ch() === '\r') this.i++;
      else break;
    }
  }

  // ——— Statements ———

  /** A whole line (or script). */
  script(): Statement[] {
    const out = this.statements('');
    if (this.i < this.s.length) this.fail(`Unexpected token '${this.s.slice(this.i).split(/\s/)[0]}' in expression or statement.`, 'UnexpectedToken');
    return out;
  }

  /** Statements until `close` (')' or '}', or the end). */
  private statements(close: string): Statement[] {
    const out: Statement[] = [];
    for (;;) {
      this.ws();
      while (this.ch() === ';' || this.ch() === '\n' || this.ch() === '\r') {
        this.i++;
        this.ws();
      }
      if (this.i >= this.s.length || (close && this.ch() === close)) return out;
      if (this.ch() === ')' || this.ch() === '}') return out;
      out.push(this.statement());
      this.ws();
      if (this.i < this.s.length && !';\n\r'.includes(this.ch()) && this.ch() !== close && this.ch() !== ')' && this.ch() !== '}')
        this.fail(`Unexpected token '${this.s.slice(this.i).split(/[\s;]/)[0]}' in expression or statement.`, 'UnexpectedToken');
    }
  }

  private keyword(word: string): boolean {
    const m = new RegExp(`^${word}(?![\\w-])`, 'i').exec(this.s.slice(this.i));
    if (!m) return false;
    this.i += m[0].length;
    return true;
  }

  private block(): Statement[] {
    this.wsn();
    if (this.ch() !== '{') this.fail("Missing statement block after if ( condition ).", 'MissingStatementBlock');
    this.i++;
    const body = this.statements('}');
    this.wsn();
    if (this.ch() !== '}') this.fail("Missing closing '}' in statement block or type definition.", 'MissingEndCurlyBrace');
    this.i++;
    return body;
  }

  private condition(): Statement {
    this.ws();
    if (this.ch() !== '(') this.fail("Missing '(' after 'if' in if statement.", 'MissingOpenParenthesisInIfStatement');
    this.i++;
    this.wsn();
    const cond = this.statement();
    this.wsn();
    if (this.ch() !== ')') this.fail("Missing closing ')' after expression in 'if' statement.", 'MissingEndParenthesisAfterStatement');
    this.i++;
    return cond;
  }

  statement(): Statement {
    this.ws();
    const start = this.i;
    if (this.keyword('if')) {
      const clauses = [{ cond: this.condition(), body: this.block() }];
      let otherwise: Statement[] | undefined;
      for (;;) {
        const save = this.i;
        this.wsn();
        if (this.keyword('elseif')) clauses.push({ cond: this.condition(), body: this.block() });
        else if (this.keyword('else')) {
          otherwise = this.block();
          break;
        } else {
          this.i = save;
          break;
        }
      }
      return { k: 'if', clauses, otherwise };
    }
    if (this.keyword('foreach')) {
      this.ws();
      if (this.ch() !== '(') this.fail("Missing opening '(' after keyword 'foreach'.", 'MissingOpenParenthesisAfterKeyword');
      this.i++;
      this.ws();
      const v = /^\$(\w+)/.exec(this.s.slice(this.i));
      if (!v) this.fail("Missing variable name after foreach.", 'MissingVariableNameAfterForeach');
      this.i += v[0].length;
      this.ws();
      if (!this.keyword('in')) this.fail("Missing 'in' after variable in foreach loop.", 'MissingInInForeach');
      this.wsn();
      const source = this.statement();
      this.wsn();
      if (this.ch() !== ')') this.fail("Missing closing ')' after expression in 'foreach' statement.", 'MissingEndParenthesisAfterForeach');
      this.i++;
      return { k: 'foreach', name: v[1], source, body: this.block() };
    }
    if (this.keyword('exit') || this.keyword('return')) {
      this.ws();
      const e = this.i < this.s.length && !';\n})'.includes(this.ch()) ? this.expression() : undefined;
      return { k: 'exit', e };
    }
    if (this.keyword('throw')) {
      this.ws();
      const e = this.i < this.s.length && !';\n})'.includes(this.ch()) ? this.expression() : undefined;
      return { k: 'throw', e, pos: start };
    }
    // An assignment: $x = …, $env:X += …, $x.Prop = …
    if (this.ch() === '$') {
      const save = this.i;
      try {
        const target = this.postfix(this.primary());
        this.ws();
        const op = this.at('+=') ? '+=' : this.at('-=') ? '-=' : this.ch() === '=' && this.s[this.i + 1] !== '=' ? '=' : null;
        if (op && (target.k === 'var' || target.k === 'member' || target.k === 'index')) {
          this.i += op.length;
          this.wsn();
          return { k: 'assign', target, op, value: this.statement(), pos: start };
        }
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
      }
      this.i = save;
    }
    return { k: 'pipe', p: this.pipeline() };
  }

  // ——— Pipelines and commands ———

  pipeline(): Pipeline {
    const pos = this.i;
    const elements: Element[] = [];
    const redirects: Redirect[] = [];
    for (;;) {
      this.ws();
      const at = this.i;
      if (this.i >= this.s.length || this.ch() === '|' || ';\n)}'.includes(this.ch())) this.fail('An empty pipe element is not allowed.', 'EmptyPipeElement', at);
      const el = elements.length === 0 && this.expressionStart() ? this.expressionElement() : this.command();
      elements.push(el);
      this.ws();
      this.redirections(redirects);
      this.ws();
      if (this.ch() === '|' && this.s[this.i + 1] !== '|') {
        this.i++;
        this.wsn();
        continue;
      }
      break;
    }
    return { elements, redirects, pos, end: this.i };
  }

  private redirections(out: Redirect[]) {
    for (;;) {
      this.ws();
      const m = /^([12*]?)(>>|>)(&1)?/.exec(this.s.slice(this.i));
      if (!m) return;
      this.i += m[0].length;
      const stream = (m[1] || '1') as Redirect['stream'];
      if (m[3]) {
        out.push({ stream, file: null, append: false, merge: true });
        continue;
      }
      this.ws();
      if (this.i >= this.s.length || '|;\n'.includes(this.ch())) this.fail('Missing file specification after redirection operator.', 'MissingFileSpecification');
      out.push({ stream, file: this.argumentValue(), append: m[2] === '>>' });
    }
  }

  /** Does an expression (rather than a command) start here? */
  private expressionStart(): boolean {
    const c = this.ch();
    if ('$\'"([@!'.includes(c) || /[0-9]/.test(c)) return true;
    if (c === '.' && /[0-9]/.test(this.s[this.i + 1] ?? '')) return true;
    if (c === '-' && (/[0-9.]/.test(this.s[this.i + 1] ?? '') || /^-not\b/i.test(this.s.slice(this.i)))) return true;
    if (c === '{') return true;
    return false;
  }

  private expressionElement(): Element {
    const pos = this.i;
    const expr = this.expression();
    return { expr, args: [], pos, end: this.i };
  }

  /** A command: its name (or & / . and an expression), then its arguments. */
  private command(): Element {
    const pos = this.i;
    let name: string | undefined;
    let call: Expr | undefined;
    if (this.ch() === '&' || (this.ch() === '.' && /\s/.test(this.s[this.i + 1] ?? ''))) {
      this.i++;
      this.ws();
      call = this.argumentValue();
    } else {
      const m = /^[^\s|;(){},]+/.exec(this.s.slice(this.i));
      if (!m) this.fail(`Unexpected token '${this.ch()}' in expression or statement.`, 'UnexpectedToken');
      name = m[0];
      this.i += m[0].length;
      // cd.. and cd\ are commands of their own (functions PowerShell defines).
    }
    const args: Arg[] = [];
    for (;;) {
      this.ws();
      if (this.i >= this.s.length || '|;\n\r)}'.includes(this.ch())) break;
      if (/^[12*]?>/.test(this.s.slice(this.i))) break;
      const at = this.i;
      const p = /^-([A-Za-z_?][\w?]*)(:?)/.exec(this.s.slice(this.i));
      if (p && !/^-\d/.test(this.s.slice(this.i))) {
        this.i += p[0].length;
        if (p[2]) {
          const value = this.argumentList();
          args.push({ param: p[1], value, colon: true, text: this.s.slice(at, this.i), pos: at });
        } else args.push({ param: p[1], text: p[0], pos: at });
        continue;
      }
      if (this.at('--%')) this.fail('The stop-parsing symbol (--%) is not supported here.', 'UnexpectedToken');
      const value = this.argumentList();
      args.push({ value, text: this.s.slice(at, this.i), pos: at });
    }
    return { name, call, args, pos, end: this.i };
  }

  /** A value in argument mode, with its comma list (Name,Length). */
  private argumentList(): Expr {
    const first = this.argumentValue();
    const items = [first];
    for (;;) {
      const save = this.i;
      this.ws();
      if (this.ch() !== ',') {
        this.i = save;
        break;
      }
      this.i++;
      this.wsn();
      items.push(this.argumentValue());
    }
    return items.length > 1 ? { k: 'arr', items } : first;
  }

  /** One value in argument mode: a string, a variable, (…), {…}, @(…), a number, or a bareword. */
  private argumentValue(): Expr {
    const c = this.ch();
    if (c === '$') {
      // $env:TEMP\file.txt: a variable followed by more text is one expandable word.
      const save = this.i;
      const e = this.postfix(this.primary(), false);
      if (this.i >= this.s.length || /[\s|;),}]/.test(this.ch())) return e;
      this.i = save;
    } else if (c === "'" || c === '"' || c === '(' || c === '@' || c === '{') return this.postfix(this.primary(), false);
    const num = NUMBER.exec(this.s.slice(this.i)) ?? (c === '-' ? NUMBER.exec(this.s.slice(this.i + 1)) : null);
    if (num) {
      const neg = c === '-';
      const end = this.i + (neg ? 1 : 0) + num[0].length;
      if (end >= this.s.length || /[\s|;),}]/.test(this.s[end])) {
        this.i = end;
        const v = numberValue(num[0]);
        return { k: 'num', v: neg ? -v : v };
      }
    }
    // A bareword: until a space or | ; ) } , ; $var inside expands.
    const start = this.i;
    const parts: (string | Expr)[] = [];
    let text = '';
    // A parenthesis ends a bareword (alice:(R) is alice: then the expression (R), as in PowerShell).
    while (this.i < this.s.length && !/[\s|;),}]/.test(this.ch()) && !(this.ch() === '(' && (text || parts.length))) {
      if (this.ch() === '`' && this.i + 1 < this.s.length) {
        text += ESCAPES[this.s[this.i + 1]] ?? this.s[this.i + 1];
        this.i += 2;
      } else if (this.ch() === '$' && /[\w{(]/.test(this.s[this.i + 1] ?? '')) {
        if (text) parts.push(text);
        text = '';
        parts.push(this.variableInString());
      } else if (this.ch() === '"' || this.ch() === "'") {
        // A quoted part inside a bareword (-Filter Name='x').
        const q = this.ch();
        const end = this.s.indexOf(q, this.i + 1);
        if (end < 0) this.fail(`The string is missing the terminator: ${q}.`, 'TerminatorExpectedAtEndOfString', this.i);
        text += this.s.slice(this.i + 1, end);
        this.i = end + 1;
      } else text += this.s[this.i++];
    }
    if (this.i === start) this.fail(`Unexpected token '${this.ch()}' in expression or statement.`, 'UnexpectedToken');
    if (text) parts.push(text);
    if (parts.every((p) => typeof p === 'string')) return { k: 'str', v: parts.join('') };
    return { k: 'xstr', parts };
  }

  // ——— Expressions ———

  expression(): Expr {
    return this.logical();
  }

  /** -and, -or, -xor (same precedence, left to right). */
  private logical(): Expr {
    let l = this.comparison();
    for (;;) {
      const op = this.operator(LOGICAL);
      if (!op) return l;
      this.wsn();
      const r = this.comparison();
      l = { k: 'bin', op: op.op, l, r, pos: op.pos };
    }
  }

  /** An operator -name among `names` ahead (after spaces); consumed if found. */
  private operator(names: string[]): { op: string; pos: number } | null {
    const save = this.i;
    this.ws();
    const m = /^-([a-z]+)(?![\w])/i.exec(this.s.slice(this.i));
    if (m && names.includes(m[1].toLowerCase())) {
      const pos = this.i;
      this.i += m[0].length;
      return { op: m[1].toLowerCase(), pos };
    }
    this.i = save;
    return null;
  }

  private comparison(): Expr {
    let l = this.additive();
    const names = [...COMPARISON, ...COMPARISON.flatMap((o) => [`c${o}`, `i${o}`]), 'band', 'bor', 'bxor'];
    for (;;) {
      const op = this.operator(names);
      if (!op) return l;
      this.wsn();
      if (this.i >= this.s.length || '|;)}'.includes(this.ch())) this.fail(`You must provide a value expression following the '-${op.op}' operator.`, 'ExpectedValueExpression');
      const r = this.additive();
      l = { k: 'bin', op: op.op, l, r, pos: op.pos };
    }
  }

  private additive(): Expr {
    let l = this.multiplicative();
    for (;;) {
      const save = this.i;
      this.ws();
      const c = this.ch();
      // A minus followed by a letter is an operator (-eq…), not a subtraction.
      if ((c === '+' || c === '-') && this.s[this.i + 1] !== '=' && !(c === '-' && /[a-z]/i.test(this.s[this.i + 1] ?? ''))) {
        const pos = this.i;
        this.i++;
        this.wsn();
        if (this.i >= this.s.length || '|;)}'.includes(this.ch())) this.fail(`You must provide a value expression following the '${c}' operator.`, 'ExpectedValueExpression');
        l = { k: 'bin', op: c, l, r: this.multiplicative(), pos };
        continue;
      }
      this.i = save;
      return l;
    }
  }

  private multiplicative(): Expr {
    let l = this.format();
    for (;;) {
      const save = this.i;
      this.ws();
      const c = this.ch();
      if ((c === '*' || c === '/' || c === '%') && this.s[this.i + 1] !== '=' && !(c === '*' && this.s[this.i + 1] === '>')) {
        const pos = this.i;
        this.i++;
        this.wsn();
        l = { k: 'bin', op: c, l, r: this.format(), pos };
        continue;
      }
      this.i = save;
      return l;
    }
  }

  private format(): Expr {
    let l = this.unary();
    for (;;) {
      const op = this.operator(['f']);
      if (!op) return l;
      this.wsn();
      l = { k: 'bin', op: 'f', l, r: this.unary(), pos: op.pos };
    }
  }

  private unary(): Expr {
    this.ws();
    if (/^-not(?![\w])/i.test(this.s.slice(this.i))) {
      this.i += 4;
      this.ws();
      return { k: 'unary', op: 'not', e: this.unary() };
    }
    if (/^-(join|split)(?![\w])/i.test(this.s.slice(this.i))) {
      const op = this.s.slice(this.i + 1, this.i + 5).toLowerCase() === 'join' ? 'join' : 'split';
      this.i += op.length + 1;
      this.ws();
      return { k: 'unary', op, e: this.unary() };
    }
    if (this.ch() === '!') {
      this.i++;
      return { k: 'unary', op: 'not', e: this.unary() };
    }
    if (this.ch() === '-' && !/[a-z]/i.test(this.s[this.i + 1] ?? '')) {
      this.i++;
      return { k: 'unary', op: 'neg', e: this.unary() };
    }
    if (this.ch() === '[') {
      const t = /^\[([A-Za-z_][\w.]*(?:\[\])?)\]/.exec(this.s.slice(this.i));
      if (t && !this.s.startsWith('::', this.i + t[0].length)) {
        this.i += t[0].length;
        this.ws();
        // A type alone is a value ([int]); followed by a value, a cast.
        if (this.i >= this.s.length || '|;)},'.includes(this.ch()) || /^-[a-z]/i.test(this.s.slice(this.i))) return { k: 'type', name: t[1] };
        return { k: 'cast', type: t[1], e: this.unary() };
      }
    }
    return this.range();
  }

  private range(): Expr {
    const from = this.array();
    if (this.s.startsWith('..', this.i)) {
      this.i += 2;
      return { k: 'range', from, to: this.array() };
    }
    return from;
  }

  /** The comma operator: 1,2,3 (it binds tighter than arithmetic). */
  private array(): Expr {
    const first = this.postfix(this.primary());
    const items = [first];
    while (!this.noComma) {
      const save = this.i;
      this.ws();
      if (this.ch() !== ',') {
        this.i = save;
        break;
      }
      this.i++;
      this.wsn();
      items.push(this.postfix(this.primary()));
    }
    return items.length > 1 ? { k: 'arr', items } : first;
  }

  /** Member access, method calls, indexes (no space before . or [). */
  private postfix(e: Expr, spaced = true): Expr {
    void spaced;
    for (;;) {
      if (this.s.startsWith('::', this.i)) {
        this.i += 2;
        const name = /^\w+/.exec(this.s.slice(this.i));
        if (!name) this.fail("Missing property name after reference operator.", 'MissingPropertyName');
        this.i += name[0].length;
        if (this.ch() === '(') e = { k: 'call', obj: e, name: name[0], args: this.callArgs(), isStatic: true };
        else e = { k: 'member', obj: e, name: { k: 'str', v: name[0] }, isStatic: true };
        continue;
      }
      if (this.ch() === '.' && this.s[this.i + 1] !== '.') {
        const m = /^\.(\w+)/.exec(this.s.slice(this.i));
        if (!m) {
          if (this.s[this.i + 1] === '$' || this.s[this.i + 1] === '(') {
            this.i++;
            e = { k: 'member', obj: e, name: this.primary() };
            continue;
          }
          return e;
        }
        this.i += m[0].length;
        if (this.ch() === '(') e = { k: 'call', obj: e, name: m[1], args: this.callArgs() };
        else e = { k: 'member', obj: e, name: { k: 'str', v: m[1] } };
        continue;
      }
      if (this.ch() === '[' && e.k !== 'type') {
        this.i++;
        this.wsn();
        const index = this.expression();
        this.wsn();
        if (this.ch() !== ']') this.fail("Array index expression is missing or not valid.", 'MissingArrayIndexExpression');
        this.i++;
        e = { k: 'index', obj: e, index };
        continue;
      }
      return e;
    }
  }

  private callArgs(): Expr[] {
    this.i++;
    const out: Expr[] = [];
    this.wsn();
    if (this.ch() === ')') {
      this.i++;
      return out;
    }
    for (;;) {
      this.wsn();
      this.noComma++;
      try {
        out.push(this.expression());
      } finally {
        this.noComma--;
      }
      this.wsn();
      if (this.ch() === ',') {
        this.i++;
        continue;
      }
      if (this.ch() !== ')') this.fail("Missing ')' in method call.", 'MissingEndParenthesisInMethodCall');
      this.i++;
      return out;
    }
  }

  primary(): Expr {
    const saved = this.noComma;
    this.noComma = 0;
    try {
      return this.primaryInner();
    } finally {
      this.noComma = saved;
    }
  }

  private primaryInner(): Expr {
    this.ws();
    const c = this.ch();
    const start = this.i;
    if (c === undefined) this.fail('You must provide a value expression.', 'ExpectedExpression');
    if (c === "'") {
      let v = '';
      this.i++;
      for (;;) {
        if (this.i >= this.s.length) this.fail("The string is missing the terminator: '.", 'TerminatorExpectedAtEndOfString', start);
        if (this.ch() === "'" && this.s[this.i + 1] === "'") {
          v += "'";
          this.i += 2;
        } else if (this.ch() === "'") {
          this.i++;
          break;
        } else v += this.s[this.i++];
      }
      return { k: 'str', v };
    }
    if (c === '"') return this.doubleQuoted();
    if (c === '$') {
      if (this.s[this.i + 1] === '(') {
        this.i += 2;
        const body = this.statements(')');
        this.wsn();
        if (this.ch() !== ')') this.fail("Missing closing ')' in subexpression.", 'MissingEndParenthesisInSubexpression');
        this.i++;
        return { k: 'sub', body, array: false };
      }
      return this.variable();
    }
    if (c === '@' && this.s[this.i + 1] === '(') {
      this.i += 2;
      const body = this.statements(')');
      this.wsn();
      if (this.ch() !== ')') this.fail("Missing closing ')' in subexpression.", 'MissingEndParenthesisInSubexpression');
      this.i++;
      return { k: 'sub', body, array: true };
    }
    if (c === '@' && this.s[this.i + 1] === '{') return this.hashtable();
    if (c === '(') {
      this.i++;
      this.wsn();
      if (this.ch() === ')') {
        this.i++;
        return { k: 'sub', body: [], array: false };
      }
      const body = this.statement();
      this.wsn();
      if (this.ch() !== ')') this.fail("Missing closing ')' in expression.", 'MissingEndParenthesisInExpression');
      this.i++;
      return { k: 'paren', body };
    }
    if (c === '{') {
      this.i++;
      const body = this.statements('}');
      this.wsn();
      if (this.ch() !== '}') this.fail("Missing closing '}' in statement block or type definition.", 'MissingEndCurlyBrace', start);
      this.i++;
      return { k: 'block', body, text: this.s.slice(start + 1, this.i - 1) };
    }
    if (c === '[') {
      const t = /^\[([A-Za-z_][\w.]*(?:\[\])?)\]/.exec(this.s.slice(this.i));
      if (!t) this.fail("Missing type name after '['.", 'MissingTypename');
      this.i += t[0].length;
      return { k: 'type', name: t[1] };
    }
    const num = NUMBER.exec(this.s.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return { k: 'num', v: numberValue(num[0]) };
    }
    const word = /^[^\s|;(){},=]+/.exec(this.s.slice(this.i))?.[0] ?? c;
    this.fail(`Unexpected token '${word}' in expression or statement.`, 'UnexpectedToken');
  }

  private variable(): Expr {
    const rest = this.s.slice(this.i);
    const braced = /^\$\{([^}]+)\}/.exec(rest);
    if (braced) {
      this.i += braced[0].length;
      return { k: 'var', name: braced[1] };
    }
    const m = /^\$(?:([A-Za-z_]\w*:[\w]+)|([A-Za-z_]\w*)|(_|\?|\$|\^))/.exec(rest);
    if (!m) this.fail("Variable reference is not valid. '$' was not followed by a valid variable name character. Consider using ${} to delimit the name.", 'InvalidVariableReference');
    this.i += m[0].length;
    return { k: 'var', name: m[1] ?? m[2] ?? m[3] };
  }

  /** $var, ${var}, $env:X or $(…) inside a string or a bareword. */
  private variableInString(): Expr {
    if (this.s[this.i + 1] === '(') {
      const start = this.i;
      this.i += 2;
      const body = this.statements(')');
      if (this.ch() !== ')') this.fail("Missing closing ')' in subexpression.", 'MissingEndParenthesisInSubexpression', start);
      this.i++;
      return { k: 'sub', body, array: false };
    }
    return this.variable();
  }

  private doubleQuoted(): Expr {
    const start = this.i;
    this.i++;
    const parts: (string | Expr)[] = [];
    let text = '';
    for (;;) {
      if (this.i >= this.s.length) this.fail('The string is missing the terminator: ".', 'TerminatorExpectedAtEndOfString', start);
      const c = this.ch();
      if (c === '"' && this.s[this.i + 1] === '"') {
        text += '"';
        this.i += 2;
      } else if (c === '"') {
        this.i++;
        break;
      } else if (c === '`' && this.i + 1 < this.s.length) {
        text += ESCAPES[this.s[this.i + 1]] ?? this.s[this.i + 1];
        this.i += 2;
      } else if (c === '$' && /[\w{(_?]/.test(this.s[this.i + 1] ?? '')) {
        if (text) parts.push(text);
        text = '';
        parts.push(this.variableInString());
      } else text += this.s[this.i++];
    }
    if (text || !parts.length) parts.push(text);
    if (parts.every((p) => typeof p === 'string')) return { k: 'str', v: parts.join('') };
    return { k: 'xstr', parts };
  }

  private hashtable(): Expr {
    const start = this.i;
    this.i += 2;
    const entries: { key: Expr; value: Statement }[] = [];
    for (;;) {
      this.wsn();
      while (this.ch() === ';') {
        this.i++;
        this.wsn();
      }
      if (this.ch() === '}') {
        this.i++;
        return { k: 'hash', entries };
      }
      if (this.i >= this.s.length) this.fail("Missing closing '}' in statement block or type definition.", 'MissingEndCurlyBrace', start);
      let key: Expr;
      const bare = /^[A-Za-z_][\w-]*/.exec(this.s.slice(this.i));
      if (bare) {
        this.i += bare[0].length;
        key = { k: 'str', v: bare[0] };
      } else key = this.postfix(this.primary());
      this.ws();
      if (this.ch() !== '=') this.fail("Missing '=' operator after key in hash literal.", 'MissingEqualsInHashLiteral');
      this.i++;
      this.wsn();
      const value = this.statement();
      entries.push({ key, value });
      this.ws();
      if (this.ch() !== ';' && this.ch() !== '\n' && this.ch() !== '}' && this.ch() !== '\r')
        this.fail("Missing statement after '=' in hash literal.", 'MissingStatementInHashLiteral');
    }
  }
}

/** Parses a line (or a script): statements, or the parser's error. */
export function parse(text: string): Statement[] | ParseError {
  try {
    return new Parser(text).script();
  } catch (e) {
    if (e instanceof ParseError) return e;
    throw e;
  }
}
