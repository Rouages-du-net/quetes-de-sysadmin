// An IBM i machine (state.os = 'ibmi'), after IBM Documentation for IBM i
// 7.5 (https://www.ibm.com/docs/en/i/7.5): a world where everything is an
// object in a library, driven by CL commands (see cl.ts and
// commands/ibmi.ts).
//   - libraries and their objects (*FILE, *PGM, *DTAARA, *SAVF, *OUTQ…),
//     DB2 for i tables being physical files (ORDERS/ORDHDR is ORDERS.ORDHDR
//     in SQL), the IFS showing them as /QSYS.LIB/ORDERS.LIB/ORDHDR.FILE;
//   - jobs (number/user/name) in subsystems (QBATCH, QINTER…), each with
//     its status (RUN, MSGW: waiting for a reply, DSPW, DEQW…), its job
//     log and its locks; job queues feeding the subsystems (one batch job
//     at a time in QBATCH);
//   - message queues (QSYSOPR, the operator's): inquiry messages wait for
//     a reply among their valid values (R C G D F), with a second-level
//     text (cause, recovery);
//   - spooled files (printed output) in output queues, and the system ASP
//     (the disk) they fill;
//   - save files (SAVLIB … DEV(*SAVF)), the history log QHST (DSPLOG).
//   - PASE: a Unix-like shell on the same machine (ssh lands there), with
//     its utilities; `system` runs a CL command from it.
// Simplifications (see docs/SCENARIOS.md): one system ASP, no real
// authorities checking (the profile has *JOBCTL and *SPLCTL), a fixed clock,
// jobs that run in one step, spooled files grouped by job.

import type { Game } from './shell';

export const isIbmi = (game: Game) => game.state.os === 'ibmi';

// What PASE doesn't have: Linux's administration tools (it has ls, cat, grep… and OpenSSH).
export const NOT_ON_IBMI = [
  'systemctl', 'journalctl', 'apt', 'apt-get', 'dpkg', 'ss', 'ip', 'ufw', 'iptables', 'nft', 'top', 'free', 'sudo', 'service', 'svcs', 'svcadm',
  'pkg', 'zfs', 'zpool', 'lsblk', 'mount', 'df', 'useradd', 'passwd', 'crontab',
];

export interface IbmiMessage {
  id: string;
  type: 'Inquiry' | 'Information' | 'Completion' | 'Diagnostic' | 'Escape' | 'Reply';
  severity: number;
  text: string;
  // The second-level text (F1 on the message: "Additional Message Information").
  cause?: string;
  recovery?: string;
  choices?: string[];
  // The job that sent it (number/user/name) and its program.
  from: string;
  program?: string;
  sent: string;
  // An inquiry: its valid replies, and the reply once given.
  replies?: string[];
  reply?: string;
  // What happens when it is answered (the job goes on, ends…): returns what to show.
  onReply?: (game: Game, reply: string) => string | void;
}

export interface Lock {
  object: string; // LIBRARY/OBJECT
  type: string; // *FILE
  state: '*SHRRD' | '*SHRUPD' | '*EXCL' | '*SHRNUP';
  // A record lock (DSPRCDLCK): its record number.
  record?: number;
  waiting?: boolean;
}

export interface IbmiJob {
  number: string;
  user: string;
  name: string;
  type: 'BCH' | 'INT' | 'SBS' | 'ASJ' | 'BCI' | 'SYS' | 'PJ';
  subsystem: string;
  status: string;
  function: string;
  cpu: string;
  log: IbmiMessage[];
  locks?: Lock[];
  // A program to run when it is released from MSGW (see `runProgram`).
  program?: string;
}

export interface QueuedJob {
  number: string;
  user: string;
  name: string;
  status: 'RLS' | 'HLD' | 'SCD';
  jobq: string;
  program: string;
}

export interface Subsystem {
  name: string;
  library: string;
  status: 'ACTIVE' | 'INACTIVE';
  jobq?: string;
  maxActive?: number;
  // The jobs it starts on its own (STRSBS): autostart jobs.
  autostart?: () => IbmiJob[];
}

export interface Spool {
  file: string;
  user: string;
  job: string; // number/user/name
  first: number; // spooled file number of the first one (SPLNBR)
  count: number;
  userData: string;
  status: 'RDY' | 'HLD' | 'SAV' | 'WTR';
  pages: number;
  outq: string;
  date: string;
  // Size of one, in megabytes (what it takes in the ASP).
  mb: number;
}

export interface Column {
  name: string;
  type: 'DECIMAL' | 'CHAR' | 'VARCHAR' | 'DATE';
  length: number;
}

export interface DbTable {
  library: string;
  name: string;
  text: string;
  columns: Column[];
  rows: (string | number)[][];
}

export interface IbmiObject {
  name: string;
  type: string; // *FILE, *PGM…
  attribute: string; // PF, LF, PRTF, RPGLE, CLLE, SAVF…
  size: number;
  text: string;
}

export interface SavedLibrary {
  library: string;
  objects: IbmiObject[];
  date: string;
  time: string;
  savact: string;
}

export interface HistoryEntry {
  id: string;
  text: string;
  date: string;
  time: string;
  job: string;
}

export interface Ibmi {
  system: string;
  date: string;
  time: string;
  // The signed-on profile and its job (5250 or ssh).
  profile: string;
  jobs: IbmiJob[];
  jobq: QueuedJob[];
  subsystems: Subsystem[];
  msgq: Record<string, IbmiMessage[]>;
  spool: Spool[];
  outq: { name: string; library: string; writer: string; status: string }[];
  libraries: Record<string, { text: string; objects: IbmiObject[] }>;
  tables: Record<string, DbTable>; // LIBRARY/FILE
  dataAreas: Record<string, { value: string; length: number; text: string }>;
  savf: Record<string, SavedLibrary | null>; // LIBRARY/SAVF
  history: HistoryEntry[];
  // The system ASP: its capacity, and what is used apart from spooled files (GB).
  asp: { capacity: number; base: number; threshold: number };
  // The programs the story's jobs run (SBMJOB CMD(CALL PGM(…)), a job released from MSGW).
  programs: Record<string, (game: Game, job: IbmiJob) => void>;
  // The CCSID of the stream files CPYTOIMPF wrote (path → CCSID).
  stmf: Record<string, number>;
  nextJob: number;
}

export const ibmi = (game: Game): Ibmi => game.state.ibmi as Ibmi;

export const qualifiedJob = (j: { number: string; user: string; name: string }) => `${j.number}/${j.user}/${j.name}`;

/** The jobs a job name designates (number/user/name, user/name or name). */
export function findJobs(game: Game, n: { number?: string; user?: string; name: string }): IbmiJob[] {
  return ibmi(game).jobs.filter((j) => j.name === n.name && (!n.user || j.user === n.user) && (!n.number || j.number === n.number));
}

/** A record lock held by another job than this one, on this object and record. */
export function lockHolder(game: Game, object: string, record: number, except: IbmiJob): IbmiJob | undefined {
  return ibmi(game).jobs.find((j) => j !== except && j.locks?.some((l) => l.object === object && l.record === record && !l.waiting));
}

/** A new job number (deterministic: they follow each other). */
export function newNumber(game: Game): string {
  const s = ibmi(game);
  return String(s.nextJob++).padStart(6, '0');
}

/** A message sent to a queue (QSYSOPR…) and to the history log. */
export function send(game: Game, queue: string, m: IbmiMessage): void {
  const s = ibmi(game);
  (s.msgq[queue] ??= []).push(m);
}

export function history(game: Game, id: string, text: string, job: string): void {
  const s = ibmi(game);
  s.history.push({ id, text, date: s.date, time: s.time, job });
}

/** The share of the system ASP in use, in percent: its base, and the spooled files. */
export function aspUsed(game: Game): number {
  const s = ibmi(game);
  const spool = s.spool.reduce((t, x) => t + x.count * x.mb, 0) / 1024;
  return ((s.asp.base + spool) / s.asp.capacity) * 100;
}

/** A job ends: it leaves the active jobs; the history log records it. */
export function endJob(game: Game, job: IbmiJob, code: number): void {
  const s = ibmi(game);
  s.jobs = s.jobs.filter((j) => j !== job);
  const text =
    code === 0
      ? `Job ${qualifiedJob(job)} completed normally on ${s.date} at ${s.time}.`
      : `Job ${qualifiedJob(job)} ended abnormally on ${s.date} at ${s.time}; end code ${code}.`;
  history(game, code === 0 ? 'CPF1241' : 'CPF1164', text, qualifiedJob(job));
}

/** Starts the jobs waiting in a subsystem's job queue, while it has room. */
export function runQueues(game: Game): void {
  const s = ibmi(game);
  for (const sbs of s.subsystems) {
    if (sbs.status !== 'ACTIVE' || !sbs.jobq) continue;
    for (;;) {
      const active = s.jobs.filter((j) => j.subsystem === sbs.name && j.type === 'BCH').length;
      if (active >= (sbs.maxActive ?? Infinity)) break;
      const next = s.jobq.find((q) => q.jobq === sbs.jobq && q.status === 'RLS');
      if (!next) break;
      s.jobq = s.jobq.filter((q) => q !== next);
      const job: IbmiJob = { number: next.number, user: next.user, name: next.name, type: 'BCH', subsystem: sbs.name, status: 'RUN', function: `PGM-${next.program.split('/').at(-1)}`, cpu: '.0', log: [], program: next.program };
      s.jobs.push(job);
      const run = s.programs[next.program];
      if (run) run(game, job);
      else endJob(game, job, 0);
    }
  }
}
