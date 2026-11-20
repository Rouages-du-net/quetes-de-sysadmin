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

import type { Shell } from './shell';
import type { HereDoc, List, Node, Redirect } from './compound';
import { arithmetic, ArithError } from './arith';
import { glob, listRuns, split, type Word } from './tools';

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
  jump: { kind: 'break' | 'continue'; levels: number } | null;
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

const paused = (sh: Shell) => !!(sh.waiting || sh.question || sh.edition);
const leaving = (sh: Shell) => !!(sh.output || sh.cut || sh.reboot || sh.connectionRequest || sh.sessionRequest || sh.follow);

/** A here-document's text: expanded unless its delimiter was quoted. */
function heredocText(sh: Shell, h: HereDoc, run: Run): string {
  if (h.quoted) return h.body;
  const r = sh.expandLine(h.body, true);
  if (r.errors.length) show(run, r.errors.join('\n'));
  return r.line;
}

/** A simple command: read, break and continue are the shell's own; anything else runs as if typed. */
function* simple(sh: Shell, run: Run, text: string, heredoc: HereDoc | undefined, io: IO, input: string | null): Steps {
  const first = split(text)[0];
  const word = first && !first.city ? first.text : '';
  if (word === 'break' || word === 'continue') {
    const arg = split(sh.expandLine(text).line)[1]?.text;
    const levels = arg === undefined ? 1 : Number(arg);
    if (!Number.isInteger(levels) || levels < 1) {
      show(run, `-bash: ${word}: ${arg}: ${Number.isInteger(levels) ? 'loop count out of range' : 'numeric argument required'}`);
      return 1;
    }
    if (!run.loops) {
      show(run, sh.t('shell-loop-only', { command: word }));
      return 0;
    }
    run.jump = { kind: word, levels: Math.min(levels, run.loops) };
    return 0;
  }
  if (word === 'read' && io.stdin && !heredoc) {
    const status = sh.readLine(split(sh.expandLine(text).line).slice(1).map((w) => w.text), io.stdin.lines.length ? io.stdin.lines.shift()! : null);
    show(run, sh.recoverErrors().join('\n'));
    return status;
  }
  const stdin = heredoc ? heredocText(sh, heredoc, run) : input;
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
function subshell(sh: Shell): () => void {
  const saved = { vars: { ...sh.vars }, exported: new Set(sh.exported), aliases: { ...sh.aliases }, cwd: sh.cwd, old: sh.old, mask: sh.mask };
  return () => {
    sh.vars = saved.vars;
    sh.exported = saved.exported;
    sh.aliases = saved.aliases;
    sh.cwd = saved.cwd;
    sh.old = saved.old;
    sh.mask = saved.mask;
  };
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

function* compound(sh: Shell, run: Run, n: Exclude<Node, { kind: 'simple' | 'pipeline' | 'andor' }>, io: IO): Steps {
  switch (n.kind) {
    case 'group': {
      if (!n.subshell) return yield* list(sh, run, n.body, io);
      const restore = subshell(sh);
      try {
        return yield* list(sh, run, n.body, io);
      } finally {
        restore();
      }
    }
    case 'arith': {
      try {
        const v = arithmetic(sh.expandArith(n.expr), sh.arithVars());
        return v !== 0 ? 0 : 1;
      } catch (e) {
        if (!(e instanceof ArithError)) throw e;
        show(run, `-bash: ((: ${e.message}`);
        return 1;
      }
    }
    case 'if': {
      for (const b of n.branches) {
        const test = yield* list(sh, run, b.test, io);
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
      const { words, errors } = sh.expandWords(n.words ?? []);
      if (errors.length) show(run, errors.join('\n'));
      return yield* loop(run, function* (round) {
        let status = 0;
        for (const [i, w] of words.entries()) {
          if (!iterate(sh, run)) break;
          round(i);
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
          show(run, `-bash: ((: ${e.message}`);
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
          const test = yield* list(sh, run, n.test, io);
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

/** A case pattern (quoted parts are literal) against the word. */
function matches(sh: Shell, pattern: string, word: string): boolean {
  const expanded = sh.expandLine(pattern).line;
  const words: Word[] = split(expanded);
  const text = words.map((w) => w.text).join(' ');
  if (words.some((w) => w.city)) return text === word || (!/[*?[]/.test(pattern) ? false : glob(text).test(word));
  return glob(text).test(word);
}

/** Runs one node of the tree; returns its exit code. */
export function* node(sh: Shell, run: Run, n: Node, io: IO): Steps {
  if (n.kind === 'simple') return yield* simple(sh, run, n.text, n.heredoc, io, null);
  if (n.kind === 'andor') {
    let status = yield* node(sh, run, n.first, io);
    for (const r of n.rest) {
      if (run.stopped || run.jump) break;
      if (!listRuns(r.op, status)) continue;
      status = yield* node(sh, run, r.node, io);
    }
    return status;
  }
  if (n.kind === 'pipeline') return yield* pipeline(sh, run, n.parts, n.negate, io);
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

/** A pipeline: its simple commands run together as the shell's usual pipe; a compound in it gets the text before it as input. */
function* pipeline(sh: Shell, run: Run, parts: Node[], negate: boolean, io: IO): Steps {
  // Consecutive simple commands (without a here-document after the first) form one pipe.
  const groups: Node[] = [];
  for (const p of parts) {
    const prev = groups.at(-1);
    if (p.kind === 'simple' && prev?.kind === 'simple' && !p.heredoc) groups[groups.length - 1] = { kind: 'simple', text: `${prev.text} | ${p.text}`, ...(prev.heredoc ? { heredoc: prev.heredoc } : {}) };
    else groups.push(p);
  }
  let input: string | null = null;
  let status = 0;
  for (const [i, g] of groups.entries()) {
    const last = i === groups.length - 1;
    const capture: string[] | null = last ? io.capture : [];
    const sub: IO = { stdin: i === 0 ? io.stdin : stream(input), capture };
    // Each part of a real pipeline runs in a subshell: what it assigns or cd's is lost.
    const restore = groups.length > 1 && g.kind !== 'simple' ? subshell(sh) : null;
    try {
      status = g.kind === 'simple' ? yield* simple(sh, run, g.text, g.heredoc, sub, i === 0 ? null : input) : yield* node(sh, run, g, sub);
    } finally {
      restore?.();
    }
    if (run.stopped) break;
    if (!last) input = capture!.join('\n');
  }
  return negate ? (status === 0 ? 1 : 0) : status;
}
