// Windows PowerShell 5.1's language, the part an administrator types at the
// prompt: a parser from a line to statements. PowerShell reads a line in two
// modes (about_Parsing): a command's arguments in ARGUMENT mode (barewords
// are strings, C:\Users and Name,Length need no quotes, -Name is a
// parameter), the rest in EXPRESSION mode (numbers, strings, variables,
// operators). Supported:
//   - statements separated by ; or a new line; if/elseif/else, foreach,
//     while, do/while, do/until, for (init; cond; step), switch (values,
//     -Wildcard, -Regex, -Exact, -CaseSensitive, script-block conditions,
//     default), break, continue, return, try/catch/finally (catch [Type]),
//     exit, throw; functions (function Name { param(...) ... } and
//     function Name($a, $b) { ... }, typed parameters with defaults,
//     [switch], [CmdletBinding()], [Parameter(Mandatory, Position,
//     ValueFromPipeline)], [ValidateSet()], [Alias()], begin/process/end
//     blocks); assignments ($x = …, +=, -=, *=, /=, $x++, $x--, $env:NAME = …, $x.Prop = …);
//     <# block comments #>;
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
// about_Redirection, about_Assignment_Operators, about_If, about_Foreach, about_Try_Catch_Finally,
// about_While, about_Do, about_For, about_Switch, about_Break, about_Continue, about_Return,
// about_Functions, about_Functions_Advanced_Parameters, about_Functions_CmdletBindingAttribute,
// about_Comment_Based_Help,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_parsing?view=powershell-5.1
// Simplifications (docs/SCENARIOS.md): no loop labels, no switch -File,
// no here-strings, no splatting, no classes, no filter keyword; one line at a time.

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
  // A command (its name, or & expr / . expr) or an expression.
  name?: string;
  call?: Expr;
  // . script.ps1: dot-sourced (runs in the caller's scope).
  dot?: boolean;
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
/** A function's parameter (param(...) or Name($a, $b)). */
export interface FnParam {
  name: string;
  // [string], [int], [switch], [string[]]… as typed.
  type?: string;
  default?: Expr;
  mandatory?: boolean;
  position?: number;
  fromPipeline?: boolean;
  byPropertyName?: boolean;
  aliases?: string[];
  validateSet?: string[];
}
export interface FnDef {
  name: string;
  params: FnParam[];
  // [CmdletBinding()] or a [Parameter()] attribute: an advanced function (common parameters, strict binding).
  advanced: boolean;
  begin?: Statement[];
  process?: Statement[];
  end: Statement[];
  // Its source (Get-Command's Definition) and its comment-based help.
  text: string;
  synopsis?: string;
  description?: string;
}
export interface SwitchClause {
  // A value, a script block condition, or default.
  pattern: Expr | null;
  body: Statement[];
}
export type Statement =
  | { k: 'pipe'; p: Pipeline }
  | { k: 'assign'; target: Expr; op: '=' | '+=' | '-=' | '*=' | '/='; value: Statement; pos: number }
  | { k: 'if'; clauses: { cond: Statement; body: Statement[] }[]; otherwise?: Statement[] }
  | { k: 'foreach'; name: string; source: Statement; body: Statement[] }
  | { k: 'while'; cond: Statement; body: Statement[] }
  | { k: 'do'; body: Statement[]; cond: Statement; until: boolean }
  | { k: 'for'; init?: Statement; cond?: Statement; step?: Statement; body: Statement[] }
  | { k: 'switch'; subject: Statement; clauses: SwitchClause[]; wildcard: boolean; regex: boolean; sensitive: boolean; pos: number }
  | { k: 'break' }
  | { k: 'continue' }
  | { k: 'return'; e?: Expr }
  | { k: 'function'; def: FnDef }
  | { k: 'exit'; e?: Expr }
  | { k: 'throw'; e?: Expr; pos: number }
  | { k: 'try'; body: Statement[]; catches: { types: string[]; body: Statement[] }[]; final?: Statement[] };

export class ParseError {
  constructor(
    public message: string,
    public pos: number,
    public id: string,
    // How many characters the error underlines (~), when more than one.
    public length = 1,
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
  private fail(message: string, id: string, pos = this.i, length = 1): never {
    throw new ParseError(message, pos, id, length);
  }
  /**
   * && and || here: pipeline chain operators came with PowerShell 7;
   * Windows PowerShell 5.1's parser refuses them (InvalidEndOfLine).
   * https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_pipeline_chain_operators
   */
  private chainOperator(): void {
    if (this.at('&&') || this.at('||')) this.fail(`The token '${this.s.slice(this.i, this.i + 2)}' is not a valid statement separator in this version.`, 'InvalidEndOfLine', this.i, 2);
  }
  /** Spaces and tabs (a backtick at the end of a line continues it). */
  private ws() {
    while (this.i < this.s.length) {
      if (this.ch() === ' ' || this.ch() === '\t') this.i++;
      else if (this.ch() === '`' && this.s[this.i + 1] === '\n') this.i += 2;
      else if (this.ch() === '<' && this.s[this.i + 1] === '#') {
        const end = this.s.indexOf('#>', this.i + 2);
        this.i = end < 0 ? this.s.length : end + 2;
      } else if (this.ch() === '#') {
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
      this.chainOperator();
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

  private block(missing = "Missing statement block after if ( condition ).", id = 'MissingStatementBlock'): Statement[] {
    this.wsn();
    if (this.ch() !== '{') this.fail(missing, id);
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
    if (this.keyword('try')) {
      const body = this.block('The Try statement is missing its statement block.', 'MissingTryStatementBlock');
      const catches: { types: string[]; body: Statement[] }[] = [];
      let final: Statement[] | undefined;
      for (;;) {
        const save = this.i;
        this.wsn();
        if (this.keyword('catch')) {
          const types: string[] = [];
          for (;;) {
            this.ws();
            const m = /^\[([\w.]+)\]/.exec(this.s.slice(this.i));
            if (!m) break;
            types.push(m[1]);
            this.i += m[0].length;
            this.ws();
            if (this.ch() !== ',') break;
            this.i++;
          }
          catches.push({ types, body: this.block('The Catch block is missing its statement block.', 'MissingCatchBlock') });
        } else if (this.keyword('finally')) {
          final = this.block('The Finally block is missing its statement block.', 'MissingFinallyStatementBlock');
          break;
        } else {
          this.i = save;
          break;
        }
      }
      if (!catches.length && !final) this.fail('The Try statement is missing its Catch or Finally block.', 'MissingCatchOrFinally');
      return { k: 'try', body, catches, final };
    }
    if (this.keyword('exit')) {
      this.ws();
      const e = this.i < this.s.length && !';\n})'.includes(this.ch()) ? this.expression() : undefined;
      return { k: 'exit', e };
    }
    if (this.keyword('return')) {
      this.ws();
      const e = this.i < this.s.length && !';\n})'.includes(this.ch()) ? this.expression() : undefined;
      return { k: 'return', e };
    }
    if (this.keyword('break')) return { k: 'break' };
    if (this.keyword('continue')) return { k: 'continue' };
    if (this.keyword('while')) {
      const cond = this.loopCondition('while');
      return { k: 'while', cond, body: this.block("Missing statement body in while loop.", 'MissingLoopStatement') };
    }
    if (this.keyword('do')) {
      const body = this.block("Missing statement block after 'do'.", 'MissingLoopStatement');
      this.wsn();
      const until = this.keyword('until');
      if (!until && !this.keyword('while')) this.fail("Missing while or until keyword in do loop.", 'MissingWhileOrUntilInDoWhile');
      return { k: 'do', body, cond: this.loopCondition(until ? 'until' : 'while'), until };
    }
    if (this.keyword('for')) {
      this.ws();
      if (this.ch() !== '(') this.fail("Missing opening '(' after keyword 'for'.", 'MissingOpenParenthesisAfterKeyword');
      this.i++;
      const part = (last: boolean): Statement | undefined => {
        this.wsn();
        const st = this.ch() === (last ? ')' : ';') ? undefined : this.statement();
        this.wsn();
        if (this.ch() !== (last ? ')' : ';')) this.fail(last ? "Missing closing ')' after expression in 'for' statement." : "Missing ';' in 'for' statement.", last ? 'MissingEndParenthesisAfterStatement' : 'MissingSemicolonInForStatement');
        this.i++;
        return st;
      };
      const init = part(false);
      const cond = part(false);
      const step = part(true);
      return { k: 'for', init, cond, step, body: this.block("Missing statement body in for loop.", 'MissingLoopStatement') };
    }
    if (this.keyword('switch')) return this.switchStatement(start);
    if (this.keyword('function')) return { k: 'function', def: this.functionDefinition(start) };
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
        const settable = target.k === 'var' || target.k === 'member' || target.k === 'index';
        // $i++ and $i-- (statements): about_Assignment_Operators.
        if (settable && (this.at('++') || this.at('--'))) {
          const op = this.at('++') ? '+=' : '-=';
          const pos = this.i;
          this.i += 2;
          const one: Statement = { k: 'pipe', p: { elements: [{ expr: { k: 'num', v: 1 }, args: [], pos, end: pos }], redirects: [], pos, end: pos } };
          return { k: 'assign', target, op, value: one, pos: start };
        }
        const op = this.at('+=') ? '+=' : this.at('-=') ? '-=' : this.at('*=') ? '*=' : this.at('/=') ? '/=' : this.ch() === '=' && this.s[this.i + 1] !== '=' ? '=' : null;
        if (op && settable) {
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

  /** while (…), until (…): the loop's condition. */
  private loopCondition(word: string): Statement {
    this.ws();
    if (this.ch() !== '(') this.fail(`Missing opening '(' after keyword '${word}'.`, 'MissingOpenParenthesisAfterKeyword');
    this.i++;
    this.wsn();
    const cond = this.statement();
    this.wsn();
    if (this.ch() !== ')') this.fail(`Missing closing ')' after expression in '${word}' statement.`, 'MissingEndParenthesisAfterStatement');
    this.i++;
    return cond;
  }

  /** switch [-Wildcard|-Regex|-Exact|-CaseSensitive] (value) { pattern { … } … default { … } } (about_Switch). */
  private switchStatement(pos: number): Statement {
    const flags = { wildcard: false, regex: false, sensitive: false };
    for (;;) {
      this.ws();
      const m = /^-(\w+)/.exec(this.s.slice(this.i));
      if (!m) break;
      const f = m[1].toLowerCase();
      if (f === 'wildcard') flags.wildcard = true;
      else if (f === 'regex') flags.regex = true;
      else if (f === 'casesensitive') flags.sensitive = true;
      else if (f !== 'exact') this.fail(`Unexpected token '-${m[1]}' in expression or statement.`, 'InvalidSwitchFlag');
      this.i += m[0].length;
    }
    this.ws();
    if (this.ch() !== '(') this.fail("Missing '(' after 'switch' in switch statement.", 'MissingOpenParenthesisInSwitchStatement');
    this.i++;
    this.wsn();
    const subject = this.statement();
    this.wsn();
    if (this.ch() !== ')') this.fail("Missing ')' after expression in switch statement.", 'MissingEndParenthesisInSwitchStatement');
    this.i++;
    this.wsn();
    if (this.ch() !== '{') this.fail("Missing condition in switch statement clause.", 'MissingSwitchConditionExpression');
    this.i++;
    const clauses: { pattern: Expr | null; body: Statement[] }[] = [];
    for (;;) {
      this.wsn();
      while (this.ch() === ';') {
        this.i++;
        this.wsn();
      }
      if (this.ch() === '}') {
        this.i++;
        break;
      }
      if (this.i >= this.s.length) this.fail("Missing closing '}' in statement block or type definition.", 'MissingEndCurlyBrace');
      let pattern: Expr | null;
      if (this.keyword('default')) pattern = null;
      else if (this.ch() === '{') pattern = this.primary();
      else pattern = this.argumentValue();
      clauses.push({ pattern, body: this.block('Missing statement block in switch statement clause.', 'MissingSwitchStatementClause') });
    }
    return { k: 'switch', subject, clauses, ...flags, pos };
  }

  /** A parameter list, after its '(' (param(…) or Name(…)), up to its ')'. */
  private paramList(): { params: FnParam[]; advanced: boolean } {
    const params: FnParam[] = [];
    let advanced = false;
    for (;;) {
      this.wsn();
      if (this.ch() === ')') {
        this.i++;
        return { params, advanced };
      }
      const p: Partial<FnParam> = {};
      while (this.ch() === '[') {
        const attr = /^\[(\w+)\s*\(/.exec(this.s.slice(this.i));
        if (attr) {
          // [Parameter(Mandatory=$true, Position=0)]: up to the matching ')' then ']'.
          let depth = 0;
          let j = this.i + attr[0].length - 1;
          for (; j < this.s.length; j++) {
            if (this.s[j] === '(') depth++;
            else if (this.s[j] === ')' && --depth === 0) break;
          }
          const inner = this.s.slice(this.i + attr[0].length, j);
          if (this.s[j + 1] !== ']') this.fail("Missing closing ']' in attribute.", 'EndSquareBracketExpectedAtEndOfAttribute', j);
          this.i = j + 2;
          const name = attr[1].toLowerCase();
          const flag = (key: string) => new RegExp(`\\b${key}\\b(?!\\s*=\\s*\\$false)`, 'i').test(inner);
          if (name === 'parameter') {
            advanced = true;
            if (flag('Mandatory')) p.mandatory = true;
            if (flag('ValueFromPipeline')) p.fromPipeline = true;
            if (flag('ValueFromPipelineByPropertyName')) p.byPropertyName = true;
            const pos = /\bPosition\s*=\s*(\d+)/i.exec(inner);
            if (pos) p.position = Number(pos[1]);
          } else if (name === 'validateset') p.validateSet = [...inner.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
          else if (name === 'alias') p.aliases = [...inner.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
        } else {
          const t = /^\[([A-Za-z_][\w.]*(?:\[\])?)\]/.exec(this.s.slice(this.i));
          if (!t) this.fail("Missing type name after '['.", 'MissingTypename');
          this.i += t[0].length;
          p.type = t[1];
        }
        this.wsn();
      }
      const v = /^\$([A-Za-z_]\w*)/.exec(this.s.slice(this.i));
      if (!v) this.fail("Missing ')' in function parameter list.", 'MissingEndParenthesisInFunctionParameterList');
      this.i += v[0].length;
      p.name = v[1];
      this.ws();
      if (this.ch() === '=') {
        this.i++;
        this.wsn();
        this.noComma++;
        try {
          p.default = this.expression();
        } finally {
          this.noComma--;
        }
      }
      params.push(p as FnParam);
      this.wsn();
      if (this.ch() === ',') {
        this.i++;
        continue;
      }
      if (this.ch() !== ')') this.fail("Missing ')' in function parameter list.", 'MissingEndParenthesisInFunctionParameterList');
    }
  }

  /** function Name [(params)] { [<# help #>] [[CmdletBinding()]] [param(…)] body | begin {} process {} end {} } (about_Functions). */
  private functionDefinition(start: number): FnDef {
    this.ws();
    const m = /^[A-Za-z_][\w-]*(?::[\w-]+)?/.exec(this.s.slice(this.i));
    if (!m) this.fail('Missing name after function keyword.', 'MissingNameAfterKeyword');
    this.i += m[0].length;
    const name = m[0].replace(/^(global|script|local):/i, '');
    this.ws();
    let params: FnParam[] = [];
    let advanced = false;
    if (this.ch() === '(') {
      this.i++;
      ({ params, advanced } = this.paramList());
    }
    this.wsn();
    if (this.ch() !== '{') this.fail('Missing function body in function declaration.', 'MissingFunctionBody');
    const open = this.i;
    this.i++;
    // Comment-based help (.SYNOPSIS, .DESCRIPTION) at the start of the body.
    const help = /^\s*<#([\s\S]*?)#>/.exec(this.s.slice(this.i));
    const section = (key: string) => help && new RegExp(`\\.${key}\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\.[A-Z]|$)`, 'i').exec(help[1])?.[1].trim().replace(/\s+/g, ' ');
    this.wsn();
    if (/^\[CmdletBinding\s*\(/i.test(this.s.slice(this.i))) {
      advanced = true;
      this.i = this.s.indexOf(']', this.i) + 1;
      this.wsn();
    }
    if (/^param\s*\(/i.test(this.s.slice(this.i))) {
      this.i = this.s.indexOf('(', this.i) + 1;
      const list = this.paramList();
      params = list.params;
      advanced ||= list.advanced;
    }
    const def: FnDef = { name, params, advanced, end: [], text: '', synopsis: section('SYNOPSIS') ?? undefined, description: section('DESCRIPTION') ?? undefined };
    this.wsn();
    const named = /^(begin|process|end)\s*\{/i.exec(this.s.slice(this.i));
    if (named) {
      for (;;) {
        this.wsn();
        const b = /^(begin|process|end)(?=\s*\{)/i.exec(this.s.slice(this.i));
        if (!b) break;
        this.i += b[0].length;
        def[b[1].toLowerCase() as 'begin' | 'process' | 'end'] = this.block();
      }
    } else def.end = this.statements('}');
    this.wsn();
    if (this.ch() !== '}') this.fail("Missing closing '}' in statement block or type definition.", 'MissingEndCurlyBrace', open);
    this.i++;
    def.text = this.s.slice(open + 1, this.i - 1);
    void start;
    return def;
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
    const dot = this.ch() === '.';
    this.chainOperator();
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
      if (this.at('&&')) break;
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
    return { name, call, args, pos, end: this.i, ...(call && dot ? { dot: true } : {}) };
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
