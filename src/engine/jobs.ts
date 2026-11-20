// bash's job control (man bash, "JOB CONTROL"): `cmd &` starts a job in the
// background ("[1] 4521"), jobs lists them, fg brings one back, bg lets a
// stopped one run on, Ctrl-Z stops the command in the foreground, kill %1
// signals one, wait waits for them, disown forgets them; bash reports a job
// that ended ("[1]+  Done                    cmd") after the next command.
//
// Deterministic: a command run in the background runs at once (its output
// shows straight away, as a quick job's would) and is reported Done after
// the next command; sleep and the follows (tail -f, journalctl -f, watch)
// keep running until killed, waited for or brought back, as time in the
// game only passes while following. A running follow's lines are not
// printed in the background.

import type { Shell } from './shell';

export type JobState = 'Running' | 'Stopped' | 'Done' | 'Exit' | 'Terminated' | 'Killed';

export interface Job {
  id: number;
  pid: number;
  // The command as typed, without its &.
  text: string;
  state: JobState;
  // Exit code (Exit N), for a job that ended.
  code: number;
  // A follow put in the background or stopped (tail -f): fg resumes it.
  follow?: { read: () => string; screen?: boolean } | null;
  // The input during which it was started (it is reported after a later one).
  since: number;
}

/** How bash writes a job's line: "[1]+  Running                 sleep 50 &". */
export function jobLine(job: Job, mark: string, pid = false): string {
  const state = job.state === 'Exit' ? `Exit ${job.code}` : job.state;
  return `[${job.id}]${mark} ${pid ? String(job.pid).padStart(5) + ' ' : ' '}${state.padEnd(24)}${job.text}${job.state === 'Running' ? ' &' : ''}`;
}

/** The marks: + for the current job (the last one), - for the previous one. */
export function mark(sh: Shell, job: Job): string {
  const list = sh.jobs;
  return job === list.at(-1) ? '+' : job === list.at(-2) ? '-' : ' ';
}

/** A job by its spec: %N, %%, %+, %-, %name (the start of its command), or a PID; null: none. */
export function jobFor(sh: Shell, spec: string | undefined): Job | null {
  const list = sh.jobs;
  if (spec === undefined || spec === '%%' || spec === '%+' || spec === '%') return list.at(-1) ?? null;
  if (spec === '%-') return list.at(-2) ?? null;
  if (/^%\d+$/.test(spec)) return list.find((j) => j.id === Number(spec.slice(1))) ?? null;
  if (spec.startsWith('%')) return list.find((j) => j.text.startsWith(spec.slice(1))) ?? null;
  if (/^\d+$/.test(spec)) return list.find((j) => j.pid === Number(spec)) ?? null;
  return null;
}

/** A new job in the table: the next number after the highest (1 when the table is empty). */
export function addJob(sh: Shell, text: string, state: JobState): Job {
  const id = Math.max(0, ...sh.jobs.map((j) => j.id)) + 1;
  const job: Job = { id, pid: sh.nextPid(), text, state, code: 0, since: sh.inputCount };
  sh.jobs.push(job);
  sh.lastBackground = job.pid;
  return job;
}

/** The jobs that ended since they were last reported, written as bash reports them; they leave the table. */
export function notices(sh: Shell): string {
  const ended = sh.jobs.filter((j) => j.state !== 'Running' && j.state !== 'Stopped' && j.since < sh.inputCount);
  if (!ended.length) return '';
  const lines = ended.map((j) => jobLine(j, mark(sh, j)));
  sh.jobs = sh.jobs.filter((j) => !ended.includes(j));
  return lines.join('\n');
}

/** A signal sent to a job (kill %1): TERM and the others end it, KILL too, STOP stops it, CONT lets it run. */
export function signalJob(sh: Shell, job: Job, signal: string): void {
  if (signal === 'STOP' || signal === 'TSTP') job.state = 'Stopped';
  else if (signal === 'CONT') job.state = job.state === 'Stopped' ? 'Running' : job.state;
  else if (signal === '0') return;
  else {
    job.state = signal === 'KILL' ? 'Killed' : 'Terminated';
    job.follow = null;
    // Reported after the next command, like bash.
    job.since = sh.inputCount;
  }
}

/** jobs [-l] [-p]: the table. */
export function jobsCommand(sh: Shell, args: string[]): string {
  const bad = args.find((a) => a.startsWith('-') && !/^-[lpr s]+$/.test(a));
  if (bad) return sh.error(`-bash: jobs: ${bad.slice(0, 2)}: invalid option\njobs: usage: jobs [-lnprs] [jobspec ...] or jobs -x command [args]`, 2);
  const flags = args.filter((a) => a.startsWith('-')).join('');
  const specs = args.filter((a) => !a.startsWith('-'));
  const chosen: Job[] = [];
  for (const s of specs) {
    const j = jobFor(sh, s);
    if (!j) sh.error(`-bash: jobs: ${s}: no such job`, 1);
    else chosen.push(j);
  }
  let list = specs.length ? chosen : [...sh.jobs];
  if (flags.includes('r')) list = list.filter((j) => j.state === 'Running');
  if (flags.includes('s')) list = list.filter((j) => j.state === 'Stopped');
  if (flags.includes('p')) return list.map((j) => String(j.pid)).join('\n');
  const out = list.map((j) => jobLine(j, mark(sh, j), flags.includes('l')));
  // The ended jobs listed here are not reported again.
  sh.jobs = sh.jobs.filter((j) => !list.includes(j) || j.state === 'Running' || j.state === 'Stopped');
  return out.join('\n');
}

/** fg [job]: the job comes back to the foreground. */
export function fgCommand(sh: Shell, args: string[]): string {
  const job = jobFor(sh, args[0]);
  if (!job) return sh.error(`-bash: fg: ${args[0] ?? 'current'}: no such job`, 1);
  sh.jobs = sh.jobs.filter((j) => j !== job);
  if (job.state !== 'Running' && job.state !== 'Stopped') return job.text;
  // A follow takes the screen again until Ctrl-C (or Ctrl-Z); sleep and the others end at once.
  if (job.follow) sh.follow = job.follow;
  sh.foreground = job.follow ? { text: job.text, pid: job.pid } : null;
  return job.text;
}

/** bg [job]: a stopped job runs on in the background. */
export function bgCommand(sh: Shell, args: string[]): string {
  const job = jobFor(sh, args[0]);
  if (!job) return sh.error(`-bash: bg: ${args[0] ?? 'current'}: no such job`, 1);
  if (job.state === 'Running') return sh.error(`-bash: bg: job ${job.id} already in background`, 0);
  if (job.state !== 'Stopped') return sh.error(`-bash: bg: job has terminated`, 1);
  job.state = 'Running';
  return `[${job.id}]${mark(sh, job)} ${job.text} &`;
}

/** wait [job…]: waits for jobs; one that never ends (a follow) holds the prompt until Ctrl-C. */
export function waitCommand(sh: Shell, args: string[]): string {
  const specs = args.filter((a) => a !== '-n' && a !== '-f');
  const chosen: Job[] = [];
  for (const s of specs) {
    const j = jobFor(sh, s);
    if (!j) {
      sh.error(`-bash: wait: ${s}: no such job`, 127);
      continue;
    }
    chosen.push(j);
  }
  const list = specs.length ? chosen : sh.jobs.filter((j) => j.state === 'Running');
  let code = sh.status ?? 0;
  for (const j of list) {
    if (j.state === 'Running' && j.follow) {
      // tail -f never ends: wait waits forever (Ctrl-C).
      sh.follow = { read: () => '' };
      return '';
    }
    if (j.state === 'Running') {
      j.state = 'Done';
      j.since = sh.inputCount;
    }
    code = j.state === 'Exit' ? j.code : j.state === 'Terminated' ? 143 : j.state === 'Killed' ? 137 : 0;
    // A job waited for is reaped: bash doesn't report it.
    sh.jobs = sh.jobs.filter((x) => x !== j);
  }
  if (sh.status === null) sh.status = code;
  return '';
}

/** disown [-a] [job…]: the job leaves the table (it goes on running, out of the shell's hands). */
export function disownCommand(sh: Shell, args: string[]): string {
  if (args.includes('-a')) {
    sh.jobs = [];
    return '';
  }
  const specs = args.filter((a) => !a.startsWith('-'));
  for (const s of specs.length ? specs : [undefined]) {
    const j = jobFor(sh, s);
    if (!j) sh.error(`-bash: disown: ${s ?? 'current'}: no such job`, 1);
    else sh.jobs = sh.jobs.filter((x) => x !== j);
  }
  return '';
}
