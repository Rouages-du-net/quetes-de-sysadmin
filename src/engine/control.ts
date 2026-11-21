// Running what compound.ts parsed, on the interactive line (man bash,
// "Compound Commands", "Pipelines", "Lists"): each simple command runs as if
// typed alone (the story's events and afterCommand after each one, $?), so
// a loop is a way to type many commands at once. The run is a generator: a
// command that asks a question (sudo's password, a yes/no, nano) pauses it,
// and the shell resumes it once answered.
//
// Like bash: a loop's variable stays set afterwards; a pipeline's parts run
// in subshells (what `cmd | while read x; do n=…; done` assigns is lost, as
// with bash's lastpipe off); ( … ) is a subshell (its cd and variables don't
// last), { …; } is not. Simplified: inside a compound, only `read` takes from
// the compound's input (< file, a here-document, a pipe); its other commands
// read nothing. A compound's 2> is ignored. A guard stops a loop that runs
// too long (a page would freeze where bash would loop forever).
//
// The same runner runs scripts (script.ts): with a ScriptRun on the shell
// (sh.script), each simple command runs without the story's events, its
// errors in the words of the script's shell (dialect.ts), with set -e, -u,
// -x and pipefail. Functions (name() { …; }), return, exit, source and "."
// change the flow: they are answered here, on the line and in scripts.

import type { Shell } from './shell';
import { parseScript, type HereDoc, type List, type Node, type Redirect } from './compound';
import { arithmetic, ArithError } from './arith';
import { glob, listRuns, split, type Word } from './tools';
import { notFound, rewrite, syntaxError, traceAssignment, traceWord } from './dialect';
import { conditional } from './commands/shell-builtins';

/** Loop iterations on one input, past which the game stops the loop. */
export const MAX_ITERATIONS = 10_000;

/** What a run has shown and recorded so far. */
export interface Run {
  outputs: string[];
  // clear ran: the screen is wiped (outputs before it are dropped).
  cleared: boolean;
  // Every command it ran, for the notebook (a loop's commands only once).
  commands: string[][];
  // Loop iterations so far (the guard), and how many enclosing loops are past their first round.
  steps: number;
  repeat: number;
  // Enclosing loops (break and continue need one), and a break or continue on its way out.
  loops: number;
  jump: { kind: 'break' | 'continue' | 'return'; levels: number; code?: number } | null;
  // The run is over: the session is left (exit, ssh, reboot, tail -f) or the guard stopped it.
  stopped: boolean;
}

// A compound's input: lines that read takes one by one.
interface Stream {
  lines: string[];
}

interface IO {
  stdin: Stream | null;
  // Where the standard output goes when it is not the screen (a pipe, a file).
  capture: string[] | null;
}

export type Steps = Generator<void, number, void>;

export const newRun = (): Run => ({ outputs: [], cleared: false, commands: [], steps: 0, repeat: 0, loops: 0, jump: null, stopped: false });

const stream = (text: string | null): Stream | null => (text === null ? null : { lines: text === '' ? [] : text.replace(/\n$/, '').split('\n') });

/** A run's shown text since last time ('' if nothing), or null when clear wiped the screen. */
export function flush(run: Run): string | null {
  const text = run.outputs.filter(Boolean).join('\n');
  const cleared = run.cleared;
  run.outputs = [];
  run.cleared = false;
  return cleared && !text ? null : text;
}

/** Shows what a command printed (null: clear). */
export function show(run: Run, output: string | null): void {
  if (output === null) {
    run.outputs = [];
    run.cleared = true;
  } else if (output) run.outputs.push(output);
}

/** Runs a program to its end (a script, a substitution: nothing waits for an answer there). */
export function drain(steps: Steps): number {
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

const paused = (sh: Shell) => !!(sh.waiting || sh.question || sh.edition);
const leaving = (sh: Shell) => !!(sh.output || sh.cut || sh.reboot || sh.connectionRequest || sh.sessionRequest || sh.follow);

/** A here-document's text: expanded unless its delimiter was quoted. */
function heredocText(sh: Shell, h: HereDoc, run: Run): string {
  if (h.quoted) return h.body;
  const r = sh.expandLine(h.body, true);
  if (r.errors.length) show(run, r.errors.join('\n'));
  return r.line;
}

/** The shell's own messages: "-bash: …" on the line, the script's name and line in a script. */
const pre = (sh: Shell) => sh.errorPrefix();

// The words that change the flow, answered here.
const FLOW = new Set(['return', 'exit', 'source', '.']);

/** A simple command: read, break and continue are the shell's own; anything else runs as if typed. */
function* simple(sh: Shell, run: Run, text: string, heredoc: HereDoc | undefined, io: IO, input: string | null, line?: number): Steps {
  if (sh.script && line !== undefined) sh.script.line = line;
  const first = split(text)[0];
  const word = first && !first.city ? first.text : '';
  // exit on the interactive line closes the session (shell.ts); in a script, it ends the script.
  if (word && ((FLOW.has(word) && (word !== 'exit' || sh.script)) || Object.hasOwn(sh.functions, word))) return yield* flow(sh, run, text, word, io);
  if (word === 'break' || word === 'continue') {
    const arg = split(sh.expandLine(text).line)[1]?.text;
    const levels = arg === undefined ? 1 : Number(arg);
    if (!Number.isInteger(levels) || levels < 1) {
      show(run, `${pre(sh)}: ${word}: ${arg}: ${Number.isInteger(levels) ? 'loop count out of range' : 'numeric argument required'}`);
      return 1;
    }
    if (!run.loops) {
      show(run, sh.t('shell-loop-only', { command: word }));
      return 0;
    }
    run.jump = { kind: word, levels: Math.min(levels, run.loops) };
    return 0;
  }
  if (word === 'read' && io.stdin && !heredoc && !/[<>]/.test(text)) {
    const status = sh.readLine(split(sh.expandLine(text).line).slice(1).map((w) => w.text), io.stdin.lines.length ? io.stdin.lines.shift()! : null);
    show(run, sh.recoverErrors().join('\n'));
    return status;
  }
  const stdin = heredoc ? heredocText(sh, heredoc, run) : input;
  if (sh.script) return scriptCommand(sh, run, text, stdin, io);
  sh.repeating = run.repeat > 0;
  const before = sh.last;
  let output: string | null;
  try {
    output = sh.runSimple(text, stdin, !!io.capture);
  } finally {
    sh.repeating = false;
  }
  if (sh.last !== before && !run.repeat) run.commands.push(...sh.last.commands);
  show(run, output);
  if (paused(sh)) {
    yield;
    // The shell resumed us once answered: the command's output is already shown.
  }
  if (io.capture && sh.piped !== null) io.capture.push(sh.piped);
  sh.piped = null;
  if (leaving(sh) || sh.aborted) run.stopped = true;
  return sh.lastStatus;
}

/** The script's shell stops (exit, set -e, an expansion error): its code. */
function stop(sh: Shell, run: Run, code: number): number {
  if (sh.script) sh.script.exit = code;
  run.stopped = true;
  return code;
}

/** An expansion that failed in a script: bash goes on after an arithmetic error; otherwise the shell stops. */
function expansionFailed(sh: Shell, run: Run, errors: string[], arithmeticOnly: boolean): number {
  show(run, errors.join('\n'));
  const s = sh.script!;
  if (s.dialect === 'bash' && arithmeticOnly) return 1;
  return stop(sh, run, s.dialect === 'bash' ? 1 : 2);
}

/** set -x: the command as it runs, on the error output. */
function trace(sh: Shell, run: Run, words: string[]): void {
  if (!sh.script || !sh.options.x) return;
  const plus = sh.script.dialect === 'bash' ? '+'.repeat(sh.captureDepth + 1) : '+';
  let assigning = true;
  const shown = words.map((w) => {
    assigning &&= /^[A-Za-z_]\w*\+?=/.test(w);
    return assigning ? traceAssignment(sh.script, w) : traceWord(sh.script, w);
  });
  show(run, `${plus} ${shown.join(' ')}`);
}

/** A command of a script: expanded, traced, run without the story's events, its errors in the script shell's words. */
function scriptCommand(sh: Shell, run: Run, text: string, stdin: string | null, io: IO): number {
  const s = sh.script!;
  sh.substitution = null;
  const expanded = sh.expandLine(text);
  if (expanded.failed) return expansionFailed(sh, run, expanded.errors, !!expanded.arithmetic);
  if (expanded.errors.length) show(run, expanded.errors.join('\n'));
  const { args, redirects } = sh.argsOf(expanded.line);
  const assignments: string[] = [];
  while (args.length && /^[A-Za-z_]\w*=/.test(args[0])) assignments.push(args.shift()!);
  trace(sh, run, [...assignments, ...args]);
  if (!args.length && !redirects.length) {
    // Assignments alone: the script's variables; their code is the last substitution's.
    for (const a of assignments) {
      const k = a.indexOf('=');
      sh.vars[a.slice(0, k)] = a.slice(k + 1);
    }
    return sh.substitution ?? (assignments.length ? 0 : sh.lastStatus);
  }
  const cmd = args[0] ?? '';
  // A command the system doesn't have: the shell's own answer (dash: "not found").
  const exists = (c: string) =>
    c === '' || c === 'sudo' || c === ':' || c.includes('/') || c === '[' || (sh.isCommand(c) && !(c === 'source' && s.dialect !== 'bash') && !(c === 'local' && s.dialect === 'solaris'));
  if (!exists(cmd)) {
    show(run, notFound(s, cmd));
    sh.lastStatus = 127;
    return 127;
  }
  // [ a == b ]: == is bash's; dash's test knows only =.
  if (s.dialect !== 'bash' && (cmd === '[' || cmd === 'test') && args[2] === '==') {
    show(run, `${sh.errorPrefix()}: ${cmd}: ${args[1]}: unexpected operator`);
    sh.lastStatus = 2;
    return 2;
  }
  const r = sh.pipeline(expanded.line, stdin, !!io.capture);
  const command = cmd === 'sudo' ? (args.slice(1).find((a) => !a.startsWith('-')) ?? cmd) : cmd;
  // getopts writes its own complaint ("script: illegal option -- d"); a usage line stays as it is.
  const words = (e: string) => e.split('\n').map((l, k) => (command === 'getopts' || (k > 0 && !l.startsWith('-bash: ')) ? l : rewrite(s, command, l)));
  show(run, r.errors.map((e) => words(e).join('\n')).join('\n'));
  if (io.capture) io.capture.push(r.output);
  else show(run, r.output);
  if (leaving(sh)) run.stopped = true;
  // A special built-in's error stops dash (set, shift, local…).
  if (s.exit !== null) run.stopped = true;
  const status = sh.options.pipefail && s.dialect === 'bash' ? ([...r.statuses].reverse().find((x) => x !== 0) ?? 0) : r.status;
  sh.lastStatus = status;
  return status;
}

/** Functions, return, exit, source and ".": what changes the flow of the program. */
function* flow(sh: Shell, run: Run, text: string, word: string, io: IO): Steps {
  const expanded = sh.expandLine(text);
  if (expanded.failed) {
    if (sh.script) return expansionFailed(sh, run, expanded.errors, !!expanded.arithmetic);
    show(run, expanded.errors.join('\n'));
    return 1;
  }
  if (expanded.errors.length) show(run, expanded.errors.join('\n'));
  const { args, redirects } = sh.argsOf(expanded.line);
  trace(sh, run, args);
  const s = sh.script;
  if (!FLOW.has(word)) return yield* call(sh, run, word, args.slice(1), redirects, io);
  const code = (arg: string | undefined, fallback: number): number | null => {
    if (arg === undefined) return fallback;
    if (/^-?\d+$/.test(arg)) return ((Number(arg) % 256) + 256) % 256;
    if (s && s.dialect !== 'bash') show(run, `${pre(sh)}: ${word}: Illegal number: ${arg}`);
    else show(run, `${pre(sh)}: ${word}: ${arg}: numeric argument required`);
    return null;
  };
  if (word === 'exit') return stop(sh, run, code(args[1], sh.lastStatus) ?? 2);
  if (word === 'return') {
    if (!sh.locals.length && !s?.sourcing.length) {
      // dash: return outside a function ends the script.
      if (s && s.dialect !== 'bash') return stop(sh, run, code(args[1], sh.lastStatus) ?? 2);
      show(run, `${pre(sh)}: return: can only \`return' from a function or sourced script`);
      return 1;
    }
    const c = code(args[1], sh.lastStatus);
    if (c === null && s && s.dialect !== 'bash') return stop(sh, run, 2);
    run.jump = { kind: 'return', levels: 1, code: c ?? 2 };
    return c ?? 2;
  }
  // source is bash's; sh has only "." .
  if (word === 'source' && s && s.dialect !== 'bash') {
    show(run, notFound(s, 'source'));
    return 127;
  }
  return yield* source(sh, run, word, args.slice(1), io);
}

/** A shell function: its arguments become $1…, its locals come back when it returns. */
function* call(sh: Shell, run: Run, name: string, args: string[], redirects: { op: string; target: string }[], io: IO): Steps {
  if (sh.locals.length >= 1000) {
    show(run, `${pre(sh)}: ${name}: maximum function nesting level exceeded (1000)`);
    run.stopped = true;
    return 1;
  }
  const r = redirections(sh, run, redirects.filter((x) => x.op !== '2>&1' && x.op !== '>&2'), io);
  if (!r) return 1;
  const positional = sh.positional;
  sh.positional = args;
  const frame: Record<string, string | undefined> = {};
  sh.locals.push(frame);
  let status = 0;
  try {
    status = yield* node(sh, run, sh.functions[name], r.io);
    if (run.jump?.kind === 'return') {
      status = run.jump.code ?? status;
      run.jump = null;
    }
  } finally {
    sh.locals.pop();
    for (const [k, v] of Object.entries(frame)) {
      if (v === undefined) delete sh.vars[k];
      else sh.vars[k] = v;
    }
    sh.positional = positional;
  }
  if (r.out) {
    const error = sh.writeOutput(r.out.file, r.io.capture!.join('\n'), r.out.append);
    if (error) {
      show(run, error);
      return 1;
    }
  }
  return status;
}

/** . file and source file: read and run in the current shell (its variables and functions stay). */
function* source(sh: Shell, run: Run, word: string, args: string[], io: IO): Steps {
  const s = sh.script;
  const [file, ...rest] = args;
  if (file === undefined) {
    if (s && s.dialect !== 'bash') return 0;
    show(run, `${pre(sh)}: ${word}: filename argument required\n${word}: usage: ${word} filename [arguments]`);
    return 2;
  }
  // Without a /: looked for in the PATH (and, by bash only, here).
  let found: string | null = null;
  if (file.includes('/')) found = sh.find(file)?.type === 'file' ? file : null;
  else {
    for (const dir of (sh.variable('PATH') ?? '').split(':').filter(Boolean)) if (!found && sh.find(`${dir}/${file}`)?.type === 'file') found = `${dir}/${file}`;
    if (!found && (!s || s.dialect === 'bash') && sh.find(file)?.type === 'file') found = file;
  }
  const text = found ? sh.readFor(word, found) : null;
  if (text === null) {
    const errors = sh.recoverErrors();
    if (s && s.dialect !== 'bash') {
      show(run, `${pre(sh)}: ${word}: ${file}: not found`);
      return stop(sh, run, 2);
    }
    show(run, found ? errors.join('\n') : `${pre(sh)}: ${file}: No such file or directory`);
    return 1;
  }
  const parsed = parseScript(text, !s || s.dialect === 'bash');
  const positional = sh.positional;
  if (rest.length) sh.positional = rest;
  s?.sourcing.push(file);
  let status = 0;
  try {
    for (const chunk of parsed.chunks) {
      status = yield* list(sh, run, chunk, io);
      if (run.stopped || run.jump) break;
    }
    if (run.jump?.kind === 'return') {
      status = run.jump.code ?? status;
      run.jump = null;
    } else if (parsed.error && !run.stopped && !run.jump) {
      status = 2;
      if (s) {
        show(run, syntaxError(s, parsed.error, text));
        if (s.dialect !== 'bash') stop(sh, run, 2);
      } else {
        const e = parsed.error;
        show(run, e.token ? `-bash: ${file}: line ${e.line}: syntax error near unexpected token \`${e.token}'` : `-bash: ${file}: line ${e.line}: syntax error: unexpected end of file`);
      }
    }
  } finally {
    s?.sourcing.pop();
    if (rest.length) sh.positional = positional;
  }
  return status;
}

/** Runs a list (commands separated by ;, & or newlines); returns the last exit code. */
export function* list(sh: Shell, run: Run, l: List, io: IO): Steps {
  let status = sh.lastStatus;
  for (const entry of l) {
    if (entry.background) {
      status = yield* sh.background(run, entry, () => node(sh, run, entry.node, io));
    } else status = yield* node(sh, run, entry.node, io);
    sh.lastStatus = status;
    if (run.stopped || run.jump) break;
  }
  return status;
}

/** Saves what a subshell may change, and gives it back after. */
export function subshell(sh: Shell): () => void {
  const saved = {
    vars: { ...sh.vars },
    exported: new Set(sh.exported),
    aliases: { ...sh.aliases },
    cwd: sh.cwd,
    old: sh.old,
    mask: sh.mask,
    functions: { ...sh.functions },
    positional: sh.positional,
    options: { ...sh.options },
    traps: { ...sh.traps },
  };
  return () => {
    sh.vars = saved.vars;
    sh.exported = saved.exported;
    sh.aliases = saved.aliases;
    sh.cwd = saved.cwd;
    sh.old = saved.old;
    sh.mask = saved.mask;
    sh.functions = saved.functions;
    sh.positional = saved.positional;
    sh.options = saved.options;
    sh.traps = saved.traps;
  };
}

/** A subshell: exit (or set -e) in a script ends the subshell only. */
function* inSubshell(sh: Shell, run: Run, body: () => Steps): Steps {
  const restore = subshell(sh);
  const exit = sh.script?.exit ?? null;
  try {
    const status = yield* body();
    if (sh.script && sh.script.exit !== null) {
      const code = sh.script.exit;
      sh.script.exit = exit;
      run.stopped = false;
      return code;
    }
    return status;
  } finally {
    restore();
  }
}

/** A compound's redirections: its input and where its output goes; null if a file can't be opened. */
function redirections(sh: Shell, run: Run, redirects: Redirect[], io: IO): { io: IO; out: { file: string; append: boolean } | null } | null {
  let stdin = io.stdin;
  let out: { file: string; append: boolean } | null = null;
  for (const r of redirects) {
    if (r.heredoc) stdin = stream(heredocText(sh, r.heredoc, run));
    else if (r.op === '<<<') stdin = stream(sh.expandWord(r.target));
    else if (r.op === '<') {
      const file = sh.expandWord(r.target);
      const text = sh.resolve(file) === '/dev/null' ? '' : sh.readFor('bash', file);
      if (text === null) {
        show(run, sh.recoverErrors().map((e) => e.replace(/^bash:/, '-bash:')).join('\n'));
        return null;
      }
      stdin = stream(text);
    } else if (r.op === '>' || r.op === '>>' || r.op === '&>' || r.op === '&>>') out = { file: sh.expandWord(r.target), append: r.op.endsWith('>>') };
  }
  return { io: { stdin, capture: out ? [] : io.capture }, out };
}

/** One iteration's bookkeeping: the guard, and whether the loop goes on after a break or continue. */
function iterate(sh: Shell, run: Run): boolean {
  if (++run.steps > MAX_ITERATIONS) {
    show(run, sh.t('shell-loop-limit', { count: String(MAX_ITERATIONS) }));
    run.stopped = true;
    return false;
  }
  return true;
}

/** After a loop's body: false when the loop must end (break, or the run stopped). */
function after(run: Run): boolean {
  if (run.stopped) return false;
  const j = run.jump;
  if (!j) return true;
  // return leaves every loop of the function.
  if (j.kind === 'return') return false;
  if (j.levels > 1) {
    j.levels--;
    return false;
  }
  run.jump = null;
  return j.kind === 'continue';
}

/** A loop: its rounds (from the second one, its commands don't go to the notebook nor the summary). */
function* loop(run: Run, rounds: (round: (i: number) => void) => Steps): Steps {
  const base = run.repeat;
  run.loops++;
  try {
    return yield* rounds((i) => (run.repeat = base + (i > 0 ? 1 : 0)));
  } finally {
    run.loops--;
    run.repeat = base;
  }
}

function* compound(sh: Shell, run: Run, n: Exclude<Node, { kind: 'simple' | 'pipeline' | 'andor' | 'function' }>, io: IO): Steps {
  switch (n.kind) {
    case 'group': {
      if (!n.subshell) return yield* list(sh, run, n.body, io);
      return yield* inSubshell(sh, run, () => list(sh, run, n.body, io));
    }
    case 'arith': {
      try {
        const expr = sh.expandArith(n.expr);
        trace(sh, run, ['((', expr, '))']);
        const v = arithmetic(expr, sh.arithVars());
        return v !== 0 ? 0 : 1;
      } catch (e) {
        if (!(e instanceof ArithError)) throw e;
        show(run, `${pre(sh)}: ((: ${e.message}`);
        return 1;
      }
    }
    case 'cond': {
      if (sh.script && n.line !== undefined) sh.script.line = n.line;
      if (sh.script && sh.options.x) trace(sh, run, ['[[', ...sh.argsOf(sh.expandLine(n.expr).line).args, ']]']);
      const status = conditional(sh, n.expr);
      const errors = sh.recoverErrors().map((e) => e.replace(/^-bash/, pre(sh)));
      show(run, errors.join('\n'));
      return status;
    }
    case 'if': {
      for (const b of n.branches) {
        const test = yield* tested(sh, () => list(sh, run, b.test, io));
        if (run.stopped || run.jump) return test;
        if (test === 0) return yield* list(sh, run, b.body, io);
      }
      return n.otherwise ? yield* list(sh, run, n.otherwise, io) : 0;
    }
    case 'case': {
      const word = sh.expandWord(n.word);
      let fall = false;
      for (const arm of n.arms) {
        if (!fall && !arm.patterns.some((p) => matches(sh, p, word))) continue;
        const status = yield* list(sh, run, arm.body, io);
        if (arm.end === ';;' || run.stopped || run.jump) return status;
        fall = arm.end === ';&';
        if (!fall && arm === n.arms.at(-1)) return status;
      }
      return 0;
    }
    case 'for': {
      // for NAME without in: the positional parameters ("$@").
      const { words, errors } = n.words === null ? { words: [...sh.positional], errors: [] } : sh.expandWords(n.words);
      if (errors.length) show(run, errors.join('\n'));
      return yield* loop(run, function* (round) {
        let status = 0;
        for (const [i, w] of words.entries()) {
          if (!iterate(sh, run)) break;
          round(i);
          // bash's trace shows each round (dash's doesn't).
          if (sh.script?.dialect === 'bash' && sh.options.x) show(run, `${'+'.repeat(sh.captureDepth + 1)} for ${n.name} in ${words.map((x) => traceWord(sh.script, x)).join(' ')}`);
          sh.vars[n.name] = w;
          status = yield* list(sh, run, n.body, io);
          if (!after(run)) break;
        }
        return status;
      });
    }
    case 'cfor': {
      const vars = sh.arithVars();
      const evaluate = (expr: string): number | null => {
        try {
          return expr.trim() ? arithmetic(sh.expandArith(expr), vars) : 1;
        } catch (e) {
          if (!(e instanceof ArithError)) throw e;
          show(run, `${pre(sh)}: ((: ${e.message}`);
          return null;
        }
      };
      return yield* loop(run, function* (round) {
        let status = 0;
        if (n.init.trim() && evaluate(n.init) === null) return 1;
        for (let i = 0; ; i++) {
          const test = evaluate(n.test);
          if (test === null) return 1;
          if (test === 0 || !iterate(sh, run)) break;
          round(i);
          status = yield* list(sh, run, n.body, io);
          if (!after(run)) break;
          if (n.step.trim() && evaluate(n.step) === null) return 1;
        }
        return status;
      });
    }
    case 'while': {
      return yield* loop(run, function* (round) {
        let status = 0;
        for (let i = 0; ; i++) {
          round(i);
          const test = yield* tested(sh, () => list(sh, run, n.test, io));
          if (run.stopped) break;
          if (run.jump) {
            if (!after(run)) break;
            continue;
          }
          if ((test === 0) === n.until) break;
          if (!iterate(sh, run)) break;
          status = yield* list(sh, run, n.body, io);
          if (!after(run)) break;
        }
        return status;
      });
    }
  }
}

/** A test (if, while, the left of && or ||, after !): set -e doesn't stop the script there. */
function* tested(sh: Shell, body: () => Steps): Steps {
  if (!sh.script) return yield* body();
  sh.script.noErrexit++;
  try {
    return yield* body();
  } finally {
    sh.script.noErrexit--;
  }
}

/** A case pattern (quoted parts are literal) against the word. */
function matches(sh: Shell, pattern: string, word: string): boolean {
  const expanded = sh.expandLine(pattern).line;
  const words: Word[] = split(expanded);
  const text = words.map((w) => w.text).join(' ');
  if (words.some((w) => w.city)) return text === word || (!/[*?[]/.test(pattern) ? false : glob(text).test(word));
  return glob(text).test(word);
}

/** Runs one node of the tree; returns its exit code. set -e stops a script at a command that fails (outside a test). */
export function* node(sh: Shell, run: Run, n: Node, io: IO): Steps {
  const status = yield* nodeOnly(sh, run, n, io);
  const s = sh.script;
  if (s && status !== 0 && sh.options.e && !s.noErrexit && n.kind !== 'andor' && !(n.kind === 'pipeline' && n.negate) && !run.stopped && !run.jump) stop(sh, run, status);
  return status;
}

function* nodeOnly(sh: Shell, run: Run, n: Node, io: IO): Steps {
  if (n.kind === 'simple') return yield* simple(sh, run, n.text, n.heredoc, io, null, n.line);
  if (n.kind === 'function') {
    sh.functions[n.name] = n.body;
    return 0;
  }
  if (n.kind === 'andor') {
    // Only the last command of && and || stops the script under set -e.
    const last = n.rest.length;
    let status = yield* tested(sh, () => node(sh, run, n.first, io));
    for (const [k, r] of n.rest.entries()) {
      if (run.stopped || run.jump) break;
      if (!listRuns(r.op, status)) continue;
      status = k === last - 1 ? yield* node(sh, run, r.node, io) : yield* tested(sh, () => node(sh, run, r.node, io));
    }
    return status;
  }
  if (n.kind === 'pipeline') return n.negate ? yield* tested(sh, () => pipeline(sh, run, n.parts, n.negate, io)) : yield* pipeline(sh, run, n.parts, n.negate, io);
  const r = redirections(sh, run, n.redirects, io);
  if (!r) return 1;
  const status = yield* compound(sh, run, n, r.io);
  if (r.out) {
    const error = sh.writeOutput(r.out.file, r.io.capture!.join('\n'), r.out.append);
    if (error) {
      show(run, error);
      return 1;
    }
  }
  return status;
}

/** Whether a simple command calls a shell function. */
const isFunction = (sh: Shell, text: string) => Object.hasOwn(sh.functions, split(text)[0]?.text ?? '');

/** A pipeline: its simple commands run together as the shell's usual pipe; a compound in it gets the text before it as input. */
function* pipeline(sh: Shell, run: Run, parts: Node[], negate: boolean, io: IO): Steps {
  // Consecutive simple commands (without a here-document after the first) form one pipe.
  const groups: Node[] = [];
  for (const p of parts) {
    const prev = groups.at(-1);
    if (p.kind === 'simple' && prev?.kind === 'simple' && !p.heredoc && !isFunction(sh, p.text) && !isFunction(sh, prev.text))
      groups[groups.length - 1] = { kind: 'simple', text: `${prev.text} | ${p.text}`, ...(prev.heredoc ? { heredoc: prev.heredoc } : {}), line: prev.line };
    else groups.push(p);
  }
  let input: string | null = null;
  let status = 0;
  for (const [i, g] of groups.entries()) {
    const last = i === groups.length - 1;
    const capture: string[] | null = last ? io.capture : [];
    const sub: IO = { stdin: i === 0 ? io.stdin : stream(input), capture };
    // Each part of a real pipeline runs in a subshell: what it assigns or cd's is lost.
    const restore = groups.length > 1 && (g.kind !== 'simple' || isFunction(sh, g.text)) ? subshell(sh) : null;
    try {
      status = g.kind === 'simple' ? yield* simple(sh, run, g.text, g.heredoc, sub, i === 0 ? null : input, g.line) : yield* node(sh, run, g, sub);
    } finally {
      restore?.();
    }
    if (run.stopped) break;
    if (!last) input = capture!.join('\n');
  }
  return negate ? (status === 0 ? 1 : 0) : status;
}
