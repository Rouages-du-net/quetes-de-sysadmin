// The shell's built-ins that scripts lean on (man bash, "SHELL BUILTIN
// COMMANDS"; man dash, "Builtins"): set (the options -e, -u, -x, -o
// pipefail, and the positional parameters), shift, local, trap, getopts,
// return and source (the last two change the flow: control.ts runs them;
// here, what they answer outside a function or a script). And [[ … ]],
// bash's conditional expression (https://www.gnu.org/software/bash/manual/html_node/Bash-Conditional-Expressions.html).
// Messages checked against bash 5.2 and dash 0.5.12.

import type { Shell } from '../shell';
import type { Command } from './index';
import { glob, split } from '../tools';
import { content } from '../tools';

const LONG: Record<string, 'e' | 'u' | 'x' | 'pipefail'> = { errexit: 'e', nounset: 'u', xtrace: 'x', pipefail: 'pipefail' };
const BASH_SET_USAGE = 'set: usage: set [-abefhkmnptuvxBCEHPT] [-o option-name] [--] [-] [arg ...]';

const dash = (game: Shell) => !!game.script && game.script.dialect !== 'bash';

/** A special built-in's error in dash: the shell stops (code 2). */
function fatal(game: Shell, message: string): '' {
  game.error(message, 2);
  if (game.script) game.script.exit = 2;
  return '';
}

// set [-eux] [+eux] [-o option] [--] [arg…]
function set(game: Shell, args: string[]): string {
  if (!args.length) {
    // Every variable, quoted as the shell would read it back.
    const names = Object.keys(game.vars).sort();
    return names.map((n) => `${n}=${/^[\w@%+=:,./-]*$/.test(game.vars[n]) ? game.vars[n] : `'${game.vars[n].replace(/'/g, "'\\''")}'`}`).join('\n');
  }
  const o = game.options;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      game.positional = args.slice(i + 1);
      return '';
    }
    if (a === '-' || a === '+') {
      game.positional = args.slice(i + 1);
      o.x = false;
      return '';
    }
    if (a === '-o' || a === '+o') {
      const name = args[++i];
      if (name === undefined) {
        // set -o: the options, one per line.
        return Object.entries(LONG)
          .filter(([n]) => !(n === 'pipefail' && dash(game)))
          .map(([n, k]) => (dash(game) ? `${n.padEnd(16)}${o[k] ? 'on' : 'off'}` : `${n.padEnd(15)}\t${o[k] ? 'on' : 'off'}`))
          .join('\n');
      }
      const k = LONG[name];
      if (!k || (k === 'pipefail' && dash(game))) {
        if (dash(game)) return fatal(game, `set: Illegal option -o ${name}`);
        return game.error(`-bash: set: ${name}: invalid option name`, 1);
      }
      o[k] = a === '-o';
      continue;
    }
    if (/^[-+][A-Za-z]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (l === 'e' || l === 'u' || l === 'x') o[l] = a[0] === '-';
        else if (!'abfhkmnptvBCEHPT'.includes(l)) {
          if (dash(game)) return fatal(game, `set: Illegal option ${a[0]}${l}`);
          return game.error(`-bash: set: ${a[0]}${l}: invalid option\n${BASH_SET_USAGE}`, 2);
        }
      }
      continue;
    }
    // The first word that is no option: the positional parameters from there.
    game.positional = args.slice(i);
    return '';
  }
  return '';
}

// shift [n]
function shift(game: Shell, args: string[]): string {
  const n = args[0] === undefined ? 1 : Number(args[0]);
  if (!Number.isInteger(n) || n < 0) {
    if (dash(game)) return fatal(game, `shift: Illegal number: ${args[0]}`);
    return game.error(`-bash: shift: ${args[0]}: numeric argument required`, 1);
  }
  if (n > game.positional.length) {
    if (dash(game)) return fatal(game, "shift: can't shift that many");
    // bash: nothing shifted, code 1 (the message only with shopt -s shift_verbose).
    game.status = 1;
    return '';
  }
  game.positional = game.positional.slice(n);
  return '';
}

// local name[=value]…: only in a function; the value before comes back when it returns.
function local(game: Shell, args: string[]): string {
  const frame = game.locals.at(-1);
  if (!frame) {
    if (game.script?.dialect === 'solaris') return game.error(`${game.script.name}: local: not found`, 127);
    if (dash(game)) return fatal(game, 'local: not in a function');
    return game.error('-bash: local: can only be used in a function', 1);
  }
  for (const a of args) {
    const m = /^([A-Za-z_]\w*)(?:=(.*))?$/s.exec(a);
    if (!m) {
      game.error(`-bash: local: \`${a}': not a valid identifier`, 1);
      continue;
    }
    if (!Object.hasOwn(frame, m[1])) frame[m[1]] = Object.hasOwn(game.vars, m[1]) ? game.vars[m[1]] : undefined;
    // bash: a local without a value is unset in the function; dash keeps the value it had.
    if (m[2] !== undefined) game.vars[m[1]] = m[2];
    else if (!dash(game)) delete game.vars[m[1]];
  }
  return '';
}

const SIGNALS = ['EXIT', 'HUP', 'INT', 'QUIT', 'TERM', 'USR1', 'USR2', 'ERR'];
const signalName = (s: string) => {
  const u = s.toUpperCase().replace(/^SIG/, '');
  return u === '0' ? 'EXIT' : u === '1' ? 'HUP' : u === '2' ? 'INT' : u === '3' ? 'QUIT' : u === '15' ? 'TERM' : u;
};

// trap ['action'] signal… ; trap - signal ; trap (the list).
function trap(game: Shell, args: string[]): string {
  const list = args.filter((a) => a !== '--');
  if (!list.length || (list.length === 1 && list[0] === '-p'))
    return Object.entries(game.traps)
      .map(([s, a]) => `trap -- '${a.replace(/'/g, "'\\''")}' ${s}`)
      .join('\n');
  // One word only: a signal to reset (POSIX: trap 0 or trap INT).
  const [action, ...signals] = list.length === 1 ? ['-', list[0]] : list;
  for (const s of signals) {
    const name = signalName(s);
    if (!SIGNALS.includes(name)) {
      if (dash(game)) return fatal(game, `trap: ${s}: bad trap`);
      game.error(`-bash: trap: ${s}: invalid signal specification`, 1);
      continue;
    }
    if (action === '-') delete game.traps[name];
    else game.traps[name] = action;
  }
  return '';
}

// getopts optstring name [arg…]: the next option of the positional parameters (or of the args).
function getopts(game: Shell, args: string[]): string {
  const [spec, name, ...given] = args;
  if (spec === undefined || name === undefined) {
    if (dash(game)) return fatal(game, 'Usage: getopts optstring var [arg...]');
    return game.error('-bash: getopts: usage: getopts optstring name [arg ...]', 2);
  }
  const words = given.length ? given : game.positional;
  const silent = spec.startsWith(':');
  const s = game.script;
  let index = Number(game.vars.OPTIND ?? '1') || 1;
  let pos = s?.optpos ?? 1;
  if (pos < 1) pos = 1;
  const word = words[index - 1];
  const done = () => {
    game.vars[name] = '?';
    if (s) s.optpos = 1;
    game.vars.OPTIND = String(index);
    game.status = 1;
    return '';
  };
  if (word === undefined || !word.startsWith('-') || word === '-') return done();
  if (word === '--') {
    index++;
    return done();
  }
  const letter = word[pos];
  let next = pos + 1;
  const advance = () => {
    if (next >= word.length) {
      index++;
      next = 1;
    }
  };
  const at = spec.indexOf(letter);
  const script = s?.name ?? '-bash';
  delete game.vars.OPTARG;
  if (at < 0 || letter === ':') {
    advance();
    if (silent) {
      game.vars[name] = '?';
      game.vars.OPTARG = letter;
    } else {
      game.vars[name] = '?';
      game.error(dash(game) ? `Illegal option -${letter}` : `${script}: illegal option -- ${letter}`);
    }
  } else if (spec[at + 1] === ':') {
    // The value: the rest of this word, or the next word.
    if (next < word.length) {
      game.vars.OPTARG = word.slice(next);
      index++;
      next = 1;
    } else if (words[index] !== undefined) {
      game.vars.OPTARG = words[index];
      index += 2;
      next = 1;
    } else {
      index++;
      next = 1;
      if (silent) {
        game.vars[name] = ':';
        game.vars.OPTARG = letter;
      } else {
        game.vars[name] = '?';
        game.error(dash(game) ? `No arg for -${letter} option` : `${script}: option requires an argument -- ${letter}`);
      }
      game.vars.OPTIND = String(index);
      if (s) s.optpos = next;
      game.status = 0;
      return '';
    }
    game.vars[name] = letter;
  } else {
    game.vars[name] = letter;
    advance();
  }
  game.vars.OPTIND = String(index);
  if (s) s.optpos = next;
  game.status = 0;
  return '';
}

/**
 * [[ expression ]] (bash): no word splitting nor wildcards; == and != match a
 * pattern (quoted: literal), =~ a regular expression (POSIX ERE, read as
 * JavaScript's), && || ! and parentheses; the test operators otherwise.
 * Returns the exit code (2 for an error, written with game.error).
 */
export function conditional(game: Shell, expr: string): number {
  // The words, with their quotes kept (for the right side of == and =~).
  const raw: string[] = [];
  for (let i = 0; i < expr.length; ) {
    while (expr[i] === ' ' || expr[i] === '\t' || expr[i] === '\n') i++;
    if (i >= expr.length) break;
    if (expr.startsWith('&&', i) || expr.startsWith('||', i)) {
      raw.push(expr.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (expr[i] === '(' || expr[i] === ')') {
      raw.push(expr[i++]);
      continue;
    }
    let j = i;
    let w = '';
    while (j < expr.length && !/[ \t\n()]/.test(expr[j]) && !expr.startsWith('&&', j) && !expr.startsWith('||', j)) {
      const c = expr[j];
      if (c === '\\') {
        w += expr.slice(j, j + 2);
        j += 2;
      } else if (c === "'" || c === '"') {
        let k = j + 1;
        while (k < expr.length && expr[k] !== c) k += expr[k] === '\\' && c === '"' ? 2 : 1;
        w += expr.slice(j, k + 1);
        j = k + 1;
      } else if (c === '$' && expr[j + 1] === '(') {
        let depth = 0;
        let k = j + 1;
        for (; k < expr.length; k++) {
          if (expr[k] === '(') depth++;
          else if (expr[k] === ')' && --depth === 0) break;
        }
        w += expr.slice(j, k + 1);
        j = k + 1;
      } else {
        w += c;
        j++;
      }
    }
    raw.push(w);
    i = j;
  }
  const value = (w: string) => {
    const e = game.expandLine(w);
    return split(e.line)
      .map((x) => (x.city ? x.text : game.tilde(x.text)))
      .join(' ');
  };
  // A pattern: its quoted (or backslashed) parts literal.
  const pattern = (w: string): RegExp => {
    const e = game.expandLine(w).line;
    const literal = (c: string) => (/[*?[\]]/.test(c) ? `[${c}]` : c);
    let p = '';
    let quote = '';
    for (let i = 0; i < e.length; i++) {
      const c = e[i];
      if (quote) {
        if (c === quote) quote = '';
        else if (c === '\\' && quote === '"' && /[$`"\\]/.test(e[i + 1] ?? '')) p += literal(e[++i]);
        else p += literal(c);
      } else if (c === "'" || c === '"') quote = c;
      else if (c === '\\' && i + 1 < e.length) p += literal(e[++i]);
      else p += c;
    }
    return glob(p);
  };
  let k = 0;
  const err = (message: string): never => {
    throw new Error(message);
  };
  const primary = (): boolean => {
    const w = raw[k];
    if (w === undefined) return err('-bash: unexpected argument to conditional unary operator');
    if (w === '!') {
      k++;
      return !primary();
    }
    if (w === '(') {
      k++;
      const r = or();
      if (raw[k] !== ')') err("-bash: syntax error in conditional expression: unexpected token `)'");
      k++;
      return r;
    }
    const op = raw[k + 1];
    if (op !== undefined && ['==', '=', '!=', '=~', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '-nt', '-ot'].includes(op)) {
      const left = value(w);
      const right = raw[k + 2];
      if (right === undefined) err(`-bash: unexpected argument \`${op}' to conditional binary operator`);
      k += 3;
      if (op === '==' || op === '=') return pattern(right).test(left);
      if (op === '!=') return !pattern(right).test(left);
      if (op === '=~') {
        try {
          return new RegExp(value(right)).test(left);
        } catch {
          return false;
        }
      }
      if (op === '<') return left < value(right);
      if (op === '>') return left > value(right);
      const a = Number(left) || 0;
      const b = Number(value(right)) || 0;
      return op === '-eq' ? a === b : op === '-ne' ? a !== b : op === '-lt' ? a < b : op === '-le' ? a <= b : op === '-gt' ? a > b : op === '-ge' ? a >= b : false;
    }
    if (/^-[a-zA-Z]$/.test(w) && raw[k + 1] !== undefined && raw[k + 1] !== '&&' && raw[k + 1] !== '||' && raw[k + 1] !== ')') {
      const x = value(raw[k + 1]);
      k += 2;
      const n = game.find(x);
      switch (w) {
        case '-n':
          return x !== '';
        case '-z':
          return x === '';
        case '-e':
        case '-a':
          return !!n;
        case '-f':
          return n?.type === 'file';
        case '-d':
          return n?.type === 'directory';
        case '-s':
          return n?.type === 'file' && content(n, game) !== '';
        case '-r':
        case '-w':
        case '-x':
          return !!n && game.can(n, w[1] as 'r' | 'w' | 'x');
        case '-L':
        case '-h':
          return !!(game.find(x, false) as { link?: string } | null)?.link;
        case '-v':
          return game.variable(x) !== null;
      }
      return err(`-bash: unexpected argument \`${w}' to conditional unary operator`);
    }
    k++;
    return value(w) !== '';
  };
  const and = (): boolean => {
    let r = primary();
    while (raw[k] === '&&') {
      k++;
      const s = primary();
      r = r && s;
    }
    return r;
  };
  const or = (): boolean => {
    let r = and();
    while (raw[k] === '||') {
      k++;
      const s = and();
      r = r || s;
    }
    return r;
  };
  try {
    if (!raw.length) err("-bash: syntax error near `]]'");
    const r = or();
    if (k < raw.length) err(`-bash: syntax error in conditional expression: unexpected token \`${raw[k]}'`);
    return r ? 0 : 1;
  } catch (e) {
    game.error((e as Error).message);
    return 2;
  }
}

export const SCRIPT_BUILTINS: Record<string, Command> = {
  set: { ownOptions: true, launch: ({ args, game }) => set(game, args) },
  shift: { ownOptions: true, launch: ({ args, game }) => shift(game, args) },
  local: { ownOptions: true, launch: ({ args, game }) => local(game, args) },
  trap: { ownOptions: true, launch: ({ args, game }) => trap(game, args) },
  getopts: { ownOptions: true, launch: ({ args, game }) => getopts(game, args) },
  // Outside a function or a sourced file (control.ts answers them inside).
  return: {
    ownOptions: true,
    launch: ({ game }) => game.error("-bash: return: can only `return' from a function or sourced script", 1),
  },
  // source file: control.ts reads it in the current shell; here only when it can't (in a pipe).
  source: {
    ownOptions: true,
    launch: ({ args, game }) => (args.length ? '' : game.error('-bash: source: filename argument required\nsource: usage: source filename [arguments]', 2)),
  },
};
