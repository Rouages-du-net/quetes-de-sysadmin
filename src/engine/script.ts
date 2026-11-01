// A small shell script interpreter (/bin/sh), for git hooks
// and deployment scripts. Each line is run by the game's shell
// (shell.ts), from the script's place.
//
// What it understands, like dash (Debian's /bin/sh, https://manpages.debian.org/dash):
// comments and the #! line, lines split with "\", set -e
// (stop at the first command that fails), exit N, variables
// (NAME=value, export, $NAME, ${NAME}, $1…, $?), $(command), read (one line
// of input), cd, true, false, :, [ … ] (the test command), and the sequences
// "a && b", "a || b".
// An assignment in front of a command (GIT_WORK_TREE=… git …) only applies
// to git, which reads it as the matching option.
// Differences: no if, for, while, case nor functions (an error says so),
// and a command's exit code is 0 if it wrote no error
// (unless it sets its own, like monitoring plugins or grep).

import type { Shell } from './shell';

export interface ScriptResult {
  output: string;
  code: number;
}

export interface OptionsScript {
  // The starting place (for a git hook: the repository).
  cwd: string;
  // Standard input (for a pre-receive hook: "old new ref").
  input?: string;
  // $0, $1, $2…
  arguments?: string[];
  // The script's name, for error messages (like sh: "name: 3: …").
  name: string;
}

// Splits a line on && and || (outside quotes).
function chain(line: string): { command: string; before: '&&' | '||' | null }[] {
  const chunks: { command: string; before: '&&' | '||' | null }[] = [];
  let active = '';
  let before: '&&' | '||' | null = null;
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = '';
      active += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      active += c;
    } else if ((c === '&' || c === '|') && line[i + 1] === c) {
      chunks.push({ command: active.trim(), before });
      before = c === '&' ? '&&' : '||';
      active = '';
      i++;
    } else active += c;
  }
  chunks.push({ command: active.trim(), before });
  return chunks;
}

const RESERVES_WORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function'];

/** Runs a script; returns what it wrote (output and errors mixed) and its exit code. */
export function runScript(game: Shell, text: string, options: OptionsScript): ScriptResult {
  const variables: Record<string, string> = { '?': '0', '0': options.name };
  (options.arguments ?? []).forEach((a, i) => (variables[String(i + 1)] = a));
  const input = (options.input ?? '').split('\n');
  let cwd = options.cwd;
  let stopOnError = false;
  const outputs: string[] = [];

  // $NAME, ${NAME}, $1, $? and $(command); nothing inside single quotes.
  const expand = (s: string): string => {
    let result = '';
    let simple = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !simple) {
        simple = true;
        result += c;
      } else if (c === "'" && simple) {
        simple = false;
        result += c;
      } else if (c === '$' && !simple) {
        if (s[i + 1] === '(') {
          let depth = 1;
          let j = i + 2;
          for (; j < s.length && depth; j++) depth += s[j] === '(' ? 1 : s[j] === ')' ? -1 : 0;
          const inside = s.slice(i + 2, j - 1);
          result += game.underCommand(expand(inside), cwd).output.trim();
          i = j - 1;
        } else {
          const m = /^\{([A-Za-z_][A-Za-z0-9_]*|\d+|\?)\}|^([A-Za-z_][A-Za-z0-9_]*|\d|\?)/.exec(s.slice(i + 1));
          if (!m) result += c;
          else {
            result += variables[m[1] ?? m[2]] ?? '';
            i += m[0].length;
          }
        }
      } else result += c;
    }
    return result;
  };

  // A simple command; returns its exit code.
  const launch = (rawValue: string, number: number): number => {
    let line = expand(rawValue).trim();
    if (!line || line === ':' || line === 'true') return 0;
    if (line === 'false') return 1;
    // [ condition ] is the test command (its last argument must be "]").
    if (/^\[(\s|$)/.test(line)) {
      if (!/\s\]$/.test(line)) {
        outputs.push(game.t('test-hook-missing', { script: options.name, number: number }));
        return 2;
      }
      line = `test ${line.slice(1, -1).trim()}`;
    }
    const first = line.split(/\s+/)[0];
    if (RESERVES_WORDS.includes(first)) {
      outputs.push(game.t('script-not-simulated', { script: options.name, number: number, word: first }));
      return 2;
    }
    const set = /^set\s+(.*)$/.exec(line);
    if (set) {
      if (/-\w*e/.test(set[1])) stopOnError = true;
      return 0;
    }
    const read = /^read\s+(.*)$/.exec(line);
    if (read) {
      const names = read[1].split(/\s+/).filter((n) => !n.startsWith('-'));
      const values = (input.shift() ?? '').trim().split(/\s+/);
      names.forEach((n, i) => (variables[n] = i === names.length - 1 ? values.slice(i).join(' ') : (values[i] ?? '')));
      return 0;
    }
    // NAME=value (alone): a variable; in front of a command: its environment.
    const assignments: Record<string, string> = {};
    for (;;) {
      const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S*)\s*/.exec(line);
      if (!m) break;
      assignments[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
      line = line.slice(m[0].length);
    }
    if (!line) {
      Object.assign(variables, assignments);
      return 0;
    }
    if (line.startsWith('git ')) {
      const options = [
        ...(assignments.GIT_DIR ? [`--git-dir=${assignments.GIT_DIR}`] : []),
        ...(assignments.GIT_WORK_TREE ? [`--work-tree=${assignments.GIT_WORK_TREE}`] : []),
      ];
      if (options.length) line = `git ${options.join(' ')} ${line.slice(4)}`;
    }
    const r = game.underCommand(line, cwd);
    cwd = r.cwd;
    if (r.output) outputs.push(r.output);
    return r.code;
  };

  // The lines, joined after a trailing "\".
  const lines = text.replace(/\\\n/g, ' ').split('\n');
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line || line.startsWith('#')) continue;
    const exit = /^exit(?:\s+(\S+))?$/.exec(line);
    if (exit) return { output: outputs.join('\n'), code: Number(expand(exit[1] ?? '$?')) || 0 };
    let code = 0;
    for (const { command, before } of chain(line)) {
      if ((before === '&&' && code !== 0) || (before === '||' && code === 0)) continue;
      const end = /^exit(?:\s+(\S+))?$/.exec(command);
      if (end) return { output: outputs.join('\n'), code: Number(expand(end[1] ?? String(code))) || 0 };
      code = launch(command, n + 1);
    }
    variables['?'] = String(code);
    if (code !== 0 && stopOnError) return { output: outputs.join('\n'), code };
  }
  return { output: outputs.join('\n'), code: Number(variables['?']) };
}
