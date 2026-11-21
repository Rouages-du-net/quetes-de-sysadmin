// Shell scripts: a file run by sh or bash (./deploy.sh, sh tests.sh, a git
// hook, logrotate's postrotate, a cron line). The script is read like the
// interactive line (compound.ts: for, while, until, if, case, functions,
// here-documents…) and run by the same runner (control.ts), without the
// story's events, in a child shell: its variables, functions and cd don't
// come back to the session; it starts from the exported variables.
//
// Its interpreter decides the dialect (dialect.ts): #!/bin/bash (or a file
// without #!, which bash runs itself, or bash file) gets bash; #!/bin/sh and
// sh file get the system's /bin/sh: dash on Debian
// (https://manpages.debian.org/dash), without [[ … ]], the function keyword,
// arrays, $'…' nor source, with an echo that reads backslashes, and its own
// error messages ("script: 3: [[: not found", "Syntax error: "(" unexpected").
// FreeBSD's sh and Solaris's /bin/sh word their errors their way.
//
// A script saved with Windows line endings (CR LF) shows the real symptoms:
// the \r stays in the last word of each line (an empty line is the command
// $'\r', a variable keeps it, cd says so).
// Simplified: a command's exit code is 0 if it wrote no error (unless it
// sets its own); errors and output come out mixed, in order; only read
// takes the script's input; arrays are not simulated.

import type { Shell } from './shell';
import { parseScript, type List } from './compound';
import { drain, list, newRun, flush, show } from './control';
import { syntaxError, type ShDialect } from './dialect';
import { isBsd } from './freebsd';
import { isSolaris } from './solaris';

export interface ScriptResult {
  output: string;
  code: number;
}

export interface OptionsScript {
  // The starting place (for a git hook: the repository).
  cwd: string;
  // Standard input (for a pre-receive hook: "old new ref").
  input?: string;
  // $1, $2…
  arguments?: string[];
  // $0: the script's name, for error messages (dash: "name: 3: …").
  name: string;
  // The interpreter: bash, or sh (the system's /bin/sh). Default: sh.
  shell?: 'sh' | 'bash';
  // Options given to the interpreter (sh -e, -u, -x).
  options?: Partial<Shell['options']>;
  // The environment it starts with (default: the environment of the command that runs it).
  environment?: Record<string, string>;
  // sh -n: only read it (syntax errors), run nothing.
  check?: boolean;
}

/** The system's /bin/sh: dash on Debian, FreeBSD's sh, Solaris's Bourne shell. */
export function systemShell(game: Shell): ShDialect {
  return isBsd(game) ? 'bsd' : isSolaris(game) ? 'solaris' : 'dash';
}

/** The interpreter a #! line names: bash, or sh (none: bash runs the file itself; FreeBSD's and Solaris's shells too). */
export function interpreterOf(game: Shell, text: string): 'sh' | 'bash' {
  const m = /^#!\s*(\S+)(?:[ \t]+(\S+))?/.exec(text);
  if (!m) return isBsd(game) || isSolaris(game) ? 'sh' : 'bash';
  const program = (m[1].endsWith('/env') ? (m[2] ?? '') : m[1]).split('/').at(-1)!.replace(/\r$/, '');
  return program === 'bash' ? 'bash' : 'sh';
}

/** Runs a script; returns what it wrote (output and errors mixed, in order) and its exit code. */
export function runScript(game: Shell, text: string, options: OptionsScript): ScriptResult {
  const dialect: ShDialect = options.shell === 'bash' ? 'bash' : systemShell(game);
  return game.isolated(options.cwd, () => {
    const environment = options.environment ?? game.environment;
    game.vars = { ...environment };
    game.exported = new Set(Object.keys(environment));
    game.functions = {};
    game.positional = [...(options.arguments ?? [])];
    game.locals = [];
    game.options = { e: false, u: false, x: false, pipefail: false, ...options.options };
    game.traps = {};
    game.aliases = {};
    game.lastStatus = 0;
    game.script = { name: options.name, dialect, line: 1, exit: null, noErrexit: 0, sourcing: [], optpos: 1 };
    const parsed = parseScript(text, dialect === 'bash');
    const run = newRun();
    const io = { stdin: { lines: (options.input ?? '') === '' ? [] : options.input!.replace(/\n$/, '').split('\n') }, capture: null };
    const s = game.script;
    let status = 0;
    if (!options.check) {
      status = chunks(game, run, parsed.chunks, io);
      if (s.exit !== null) status = s.exit;
    }
    if (parsed.error && (options.check || (!run.stopped && s.exit === null))) {
      show(run, syntaxError(s, parsed.error, text));
      status = 2;
    }
    // trap '…' EXIT: its action runs as the script ends ($? is the script's code).
    const action = game.traps.EXIT;
    if (action !== undefined && !options.check) {
      delete game.traps.EXIT;
      game.lastStatus = status;
      s.exit = null;
      run.stopped = false;
      const trap = parseScript(action, dialect === 'bash');
      chunks(game, run, trap.chunks, io);
      if (s.exit !== null) status = s.exit;
    }
    return { output: flush(run) ?? '', code: status };
  });
}

/** A script's lines, one after the other, until one stops the shell. */
function chunks(game: Shell, run: ReturnType<typeof newRun>, lists: List[], io: Parameters<typeof list>[3]): number {
  let status = game.lastStatus;
  for (const chunk of lists) {
    status = drain(list(game, run, chunk, io));
    if (run.stopped || game.script?.exit !== null) break;
  }
  return status;
}
