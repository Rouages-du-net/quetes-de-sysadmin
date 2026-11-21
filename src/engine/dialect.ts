// The shells that run scripts, and how each one words its errors. A script
// runs under the interpreter its #! line names (or the one it was given:
// sh file, bash file): bash, or the system's /bin/sh, which is dash on
// Debian (https://manpages.debian.org/dash), the Almquist sh of FreeBSD
// (https://man.freebsd.org/cgi/man.cgi?query=sh) or the Bourne shell of
// Solaris 10. The messages were checked against dash 0.5.12 and bash 5.2.
//   bash:    script.sh: line 3: foo: command not found
//   dash:    script.sh: 3: foo: not found
//   FreeBSD: script.sh: foo: not found (no line number, except for syntax errors)
//   Solaris: script.sh: foo: not found

import type { ScriptError } from './compound';

export type ShDialect = 'bash' | 'dash' | 'bsd' | 'solaris';

/** What a running script (or sh -c line) knows about itself. */
export interface ScriptRun {
  // $0, and the name in front of its error messages.
  name: string;
  dialect: ShDialect;
  // The line of the command being run (from 1).
  line: number;
  // exit was called (or an error ended the shell): its code.
  exit: number | null;
  // Inside an if/while test, the left of && or ||, after !: set -e doesn't apply.
  noErrexit: number;
  // Files being read by . (source): return ends them; their name for messages.
  sourcing: string[];
  // getopts: the position inside a word of grouped options (-abc).
  optpos: number;
}

/** The prefix of a shell's own error messages, as the dialect writes it. */
export function prefix(s: ScriptRun | null): string {
  if (!s) return '-bash';
  const name = s.sourcing.at(-1) ?? s.name;
  if (s.dialect === 'bash') return `${name}: line ${s.line}`;
  if (s.dialect === 'dash') return `${name}: ${s.line}`;
  return name;
}

/** A word as bash shows it in an error message: $'…' when it holds a control character (a \r). */
export function ansiQuote(word: string): string {
  if (!/[\x01-\x1f\x7f]/.test(word)) return word;
  const escaped = word.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  return `$'${escaped.replace(/[\x01-\x1f\x7f]/g, (c) => `\\${c.charCodeAt(0).toString(8).padStart(3, '0')}`)}'`;
}

/** "command not found", in the dialect's words. */
export function notFound(s: ScriptRun, command: string): string {
  if (s.dialect === 'bash') return `${prefix(s)}: ${ansiQuote(command)}: command not found`;
  return `${prefix(s)}: ${command}: not found`;
}

/** A word in a trace line (set -x): bash quotes what the shell would not read back as one word. */
export function traceWord(s: ScriptRun | null, word: string): string {
  if (s && s.dialect !== 'bash') return word;
  if (/^[\w@%+=:,./-]+$/.test(word)) return word;
  return `'${word.replace(/'/g, "'\\''")}'`;
}

/** An assignment in a trace line: bash quotes the value only. */
export function traceAssignment(s: ScriptRun | null, word: string): string {
  const m = /^([A-Za-z_]\w*\+?=)(.*)$/s.exec(word);
  return m ? m[1] + traceWord(s, m[2]) : traceWord(s, word);
}

/** The shell's built-in commands: their errors carry the script's name and line. */
export const BUILTINS = new Set([
  'cd', 'echo', 'printf', 'export', 'unset', 'read', 'test', '[', 'type', 'command', 'pwd', 'alias', 'unalias', 'umask', 'kill', 'wait', 'jobs',
  'true', 'false', 'set', 'shift', 'local', 'return', 'trap', 'getopts', 'source', '.', 'exit', 'break', 'continue', 'fg', 'bg', 'disown',
]);

/**
 * An error line of a command run by a script, in the dialect's words: the
 * shell's own messages (written "-bash: …" for the interactive line, or by a
 * built-in) get the script's name and line.
 */
export function rewrite(s: ScriptRun, command: string, line: string): string {
  const p = prefix(s);
  if (line === `-bash: ${command}: command not found` || line === `${command}: not found`) return notFound(s, command);
  // A path that isn't there, or can't run (bash: "No such file or directory"; dash: "not found").
  const path = /^-?bash: (.*): (No such file or directory|Permission denied|Is a directory)$/s.exec(line);
  if (path && command.includes('/') && path[1] === command) {
    if (s.dialect !== 'bash' && path[2] === 'No such file or directory') return `${p}: ${command}: not found`;
    return `${p}: ${command}: ${path[2]}`;
  }
  if (!line.startsWith('-bash: ') && !BUILTINS.has(command)) return line;
  let rest = line.replace(/^-bash: /, '');
  if (s.dialect === 'bash') {
    // A word with a carriage return, as bash shows it: cd: $'/srv/projects\r': No such file or directory.
    rest = rest.replace(/[^ \t\n:\u00a0\u202f]*[\x01-\x08\x0b-\x1f\x7f][^ \t\n:\u00a0\u202f]*/g, ansiQuote);
    return `${p}: ${rest}`;
  }
  // dash's own wording for a few built-ins.
  const cd = /^cd: (.*): (?:No such file or directory|Not a directory.*|Permission denied)$/s.exec(rest);
  if (cd) return `${p}: cd: can't cd to ${cd[1]}`;
  if (rest === "[: missing `]'") return `${p}: [: missing ]`;
  return `${p}: ${rest}`;
}

/** A syntax error, as the dialect reports it (several lines for bash). */
export function syntaxError(s: ScriptRun, e: ScriptError, source: string): string {
  const name = s.sourcing.at(-1) ?? s.name;
  const text = source.split('\n')[e.line - 1] ?? '';
  if (s.dialect === 'bash') {
    if (e.open) return `${name}: line ${e.line}: unexpected EOF while looking for matching \`${e.open}'`;
    if (e.token === undefined) return `${name}: line ${e.line}: syntax error: unexpected end of file`;
    return `${name}: line ${e.line}: syntax error near unexpected token \`${e.token}'\n${name}: line ${e.line}: \`${text.replace(/\r$/, '')}'`;
  }
  if (s.dialect === 'solaris') {
    if (e.token === undefined) return `${name}: syntax error at line ${e.eofLine ?? e.line}: \`end of file' unexpected`;
    return `${name}: syntax error at line ${e.line}: \`${e.token}' unexpected`;
  }
  if (e.open) return `${name}: ${e.eofLine ?? e.line}: Syntax error: Unterminated quoted string`;
  if (e.badName) return `${name}: ${e.line}: Syntax error: Bad function name`;
  if (e.token === undefined) return `${name}: ${e.line}: Syntax error: end of file unexpected${e.expecting ? ` (expecting "${e.expecting}")` : ''}`;
  return `${name}: ${e.line}: Syntax error: "${e.token}" unexpected`;
}
