// Command-line highlighting, like fish or zsh-syntax-highlighting: the
// command in green if it exists, in red otherwise (you see the typo before
// pressing Enter), the options, the quoted strings, the operators, and the
// existing paths underlined. It follows the game's shell (split() in
// tools.ts): pipes and redirections (|, >, >>), quotes, wildcards, sudo;
// nothing that shell doesn't understand (no && nor $VARIABLE) is
// highlighted. The split line joins back exactly (spaces included), so the
// interface can draw it under the input field.

import type { Shell } from './shell';
import { COMMANDS } from './commands';

export type Kind = 'command' | 'unknown' | 'option' | 'string' | 'operator' | 'path' | 'glob' | 'text';

export interface Token {
  text: string;
  kind: Kind;
}

// A word of the line: its pieces (quoted or not), its position.
interface Word {
  chunks: { text: string; city: boolean }[];
  // The word as the shell will read it (without the quotes).
  value: string;
  op?: '|' | '>' | '>>';
}

/** The line in pieces: words, operators and spaces, in order. */
function lexer(line: string): (Word | string)[] {
  const output: (Word | string)[] = [];
  let word: Word | null = null;
  let quote = '';
  const finish = () => {
    if (word) output.push(word);
    word = null;
  };
  const add = (c: string, city: boolean) => {
    word ??= { chunks: [], value: '' };
    const last = word.chunks.at(-1);
    if (last && last.city === city) last.text += c;
    else word.chunks.push({ text: c, city });
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      add(c, true);
      if (c === quote) quote = '';
      else word!.value += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      // A new string begins: a piece of its own.
      word ??= { chunks: [], value: '' };
      word.chunks.push({ text: c, city: true });
    } else if (/\s/.test(c)) {
      finish();
      if (typeof output.at(-1) === 'string') output[output.length - 1] += c;
      else output.push(c);
    } else if (c === '|' || c === '>') {
      finish();
      const double = c === '>' && line[i + 1] === '>';
      if (double) i++;
      const op = double ? '>>' : (c as '|' | '>');
      output.push({ chunks: [{ text: op, city: false }], value: op, op });
    } else {
      add(c, false);
      word!.value += c;
    }
  }
  finish();
  return output;
}

/** Does the command exist here (would the shell run it)? */
function exists(sh: Shell, name: string): boolean {
  if (!name) return false;
  if (name.includes('/')) {
    // /usr/bin/ls: the full path of one of the game's commands.
    const only = name.split('/').at(-1)!;
    if (/^\/(usr\/)?s?bin\/[\w.-]+$/.test(name) && COMMANDS[only] && !COMMANDS[only].directory) return sh.known().includes(only);
    if (COMMANDS[only]?.directory && name === `${COMMANDS[only].directory}/${only}`) return sh.known().includes(only);
    // A script: it must exist and be executable.
    const n = sh.find(name);
    return !!n && n.type === 'file' && sh.can(n, 'x');
  }
  if (COMMANDS[name]?.section === 5) return false;
  // !!, !12, !cat: the history, which the shell expands before running the command.
  if (/^!(!|-?\d+|[A-Za-z_./])/.test(name)) return true;
  // help is built into the shell: it always answers.
  return name === 'help' || sh.known().includes(name);
}

/** An argument naming an existing file or directory (like zsh's underlining). */
function path(sh: Shell, value: string): boolean {
  if (!value || value.startsWith('-')) return false;
  try {
    return sh.find(value) !== null;
  } catch {
    return false;
  }
}

/** The line split into coloured tokens; their texts joined back give the line. */
export function colourise(sh: Shell, line: string): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: Kind) => {
    if (!text) return;
    const last = tokens.at(-1);
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  };
  // Where we are in the command: expecting its name, a sudo option, or arguments.
  let expected: 'command' | 'sudo' | 'sudo-value' | 'argument' | 'target' = 'command';
  for (const x of lexer(line)) {
    if (typeof x === 'string') {
      push(x, 'text');
      continue;
    }
    if (x.op) {
      push(x.value, 'operator');
      // After a redirection comes a file; after a pipe, a command.
      expected = x.op === '|' ? 'command' : 'target';
      continue;
    }
    let kind: Kind;
    const notCity = x.chunks.every((m) => !m.city);
    if (expected === 'command' || expected === 'sudo') {
      if (expected === 'sudo' && x.value.startsWith('-')) {
        kind = 'option';
        if (x.value === '-u' || x.value === '-g') expected = 'sudo-value';
      } else {
        kind = exists(sh, x.value) ? 'command' : 'unknown';
        expected = x.value === 'sudo' && kind === 'command' ? 'sudo' : 'argument';
      }
    } else if (expected === 'sudo-value') {
      kind = 'text';
      expected = 'sudo';
    } else if (notCity && /^-./.test(x.value) && expected === 'argument') kind = 'option';
    else if (notCity && /[*?]/.test(x.value)) kind = sh.expand(x.value)[0] !== x.value ? 'glob' : 'text';
    else kind = path(sh, x.value) ? 'path' : 'text';
    if (expected === 'target') expected = 'argument';
    // Quoted pieces stay strings, except for the command's name.
    for (const m of x.chunks) push(m.text, m.city && kind !== 'command' && kind !== 'unknown' && kind !== 'path' ? 'string' : kind);
  }
  return tokens;
}
