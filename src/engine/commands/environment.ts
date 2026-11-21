// export and unset, built into bash: the session's variables, and the ones
// passed to the programs it starts (their environment). After bash(1),
// SHELL BUILTIN COMMANDS (https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html).
// The shell itself (shell.ts) expands $NAME and reads NAME=value before a
// command. Differences: no arrays, no -f (functions), no -n; a few
// variables only (the game does not fill PATH, HOME… in advance).

import type { Shell } from '../shell';
import type { Command } from './index';

const quoted = (v: string) => `"${v.replace(/(["\\$`])/g, '\\$1')}"`;

function exportCommand(game: Shell, args: string[]): string {
  const names = args.filter((a) => a !== '-p');
  if (!names.length)
    return [...game.exported]
      .sort()
      .map((n) => (n in game.vars ? `declare -x ${n}=${quoted(game.vars[n])}` : `declare -x ${n}`))
      .join('\n');
  for (const a of names) {
    const m = /^([A-Za-z_]\w*)(?:=(.*))?$/s.exec(a);
    if (!m) {
      game.error(`-bash: export: \`${a}': not a valid identifier`, 1);
      continue;
    }
    if (m[2] !== undefined) game.vars[m[1]] = m[2];
    game.exported.add(m[1]);
  }
  return '';
}

// unset NAME: the variable (or, without one, the function); -f: the function, -v: the variable.
function unset(game: Shell, args: string[]): string {
  const functions = args.includes('-f');
  const variables = args.includes('-v');
  for (const n of args.filter((a) => !a.startsWith('-'))) {
    if (functions || (!variables && !Object.hasOwn(game.vars, n) && Object.hasOwn(game.functions, n))) {
      delete game.functions[n];
      continue;
    }
    delete game.vars[n];
    game.exported.delete(n);
  }
  return '';
}

export const ENVIRONMENT: Record<string, Command> = {
  export: { ownOptions: true, launch: ({ args, game }) => exportCommand(game, args) },
  unset: { ownOptions: true, launch: ({ args, game }) => unset(game, args) },
};
