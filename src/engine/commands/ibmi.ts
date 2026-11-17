// IBM i: the CL commands the stories need (on the model of ../ibmi.ts, read
// by ../cl.ts), the 5250 session (tn5250 from the workstation: sign-on, the
// main menu, the "===>" command line), and PASE's `system` and `db2`.
// Panels imitate the real displays as plain text, within 80 columns, in
// English like the system. Sources (IBM Documentation for IBM i 7.5,
// https://www.ibm.com/docs/en/i/7.5): the CL command pages (WRKACTJOB,
// DSPMSG, DSPJOBLOG, WRKOBJLCK, DSPRCDLCK, ENDJOB, SBMJOB, WRKOUTQ, WRKSPLF,
// DLTSPLF, CLROUTQ, DSPDTAARA, CHGDTAARA, SAVLIB, CRTSAVF, DSPSAVF, DSPLOG,
// ENDSBS, STRSBS, CPYTOIMPF, WRKSYSSTS), "Inquiry messages", the PASE
// `system` utility (https://www.ibm.com/docs/en/i/7.5?topic=utilities-system)
// and the tn5250 client (https://tn5250.sourceforge.net/).
// Differences (docs/SCENARIOS.md): list panels have no option column (their
// options are the equivalent commands), long lists show their first and
// last lines; an inquiry is answered at DSPMSG's "Reply" prompt (? for
// its help, like F1); `CMD ?` shows the command's help page instead of the
// F4 prompt; messages show their ID in front of the text.

import type { Shell } from '../shell';
import type { Command } from './index';
import { player } from '../world';
import { bind, elements, isError, jobName, parseCl, plain, qualified, type ClDefinition } from '../cl';
import {
  aspUsed, endJob, findJobs, history, ibmi, isIbmi, newNumber, qualifiedJob, runQueues,
  type DbTable, type Ibmi, type IbmiJob, type IbmiMessage, type Spool,
} from '../ibmi';
import { byteString, CP037, encodeEbcdic, bytesOf } from '../ebcdic';
import { MACHINES } from '../machines';
import { pageMan } from './manual';
import { COMMANDS } from './index';

const W = 79;
const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const left = (s: string | number, n: number) => String(s).padStart(n);

/** A panel's two title lines: the title centred, the system's name, the date and time. */
function header(s: Ibmi, title: string): string[] {
  const t = ' '.repeat(Math.max(1, Math.floor((W - title.length) / 2))) + title;
  return [`${pad(t, W - 10)}${left(s.system, 10)}`, left(`${s.date}  ${s.time}`, W)];
}

/** A text wrapped to the panel, its first line after a label, the next ones aligned under it. */
function wrap(text: string, width: number, indent: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && line.length + 1 + w.length > width) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out.map((l, i) => (i ? ' '.repeat(indent) + l : l));
}
const labelled = (label: string, text: string, indent = 22) => {
  const lines = wrap(text, W - indent - 1, indent);
  return [` ${pad(label, indent - 1)}${lines[0] ?? ''}`, ...lines.slice(1)];
};

/** A long list: its first and last lines, and how many were left between them. */
function page(game: Shell, rows: string[], first = 14, last = 6): string[] {
  if (rows.length <= first + last + 1) return [...rows, left('Bottom', W)];
  return [...rows.slice(0, first), game.t('ibmi-skipped', { count: rows.length - first - last }), ...rows.slice(-last), left('Bottom', W)];
}

// ——— Errors: the message, its ID in front ———

const failed = (game: Shell, id: string, text: string): string => {
  game.error(`${id}: ${text}`, 1);
  return '';
};
const notFound = (game: Shell, library: string, name: string, type: string) =>
  ibmi(game).libraries[library] ? failed(game, 'CPF2105', `Object ${name} in ${library} type ${type} not found.`) : failed(game, 'CPF2110', `Library ${library} not found.`);

/** A qualified object name, *LIBL resolved to the library that holds it. */
function resolveObject(game: Shell, value: string, type: string): { library: string; name: string } {
  const q = qualified(value);
  if (q.library !== '*LIBL' && q.library !== '*CURLIB') return q;
  const s = ibmi(game);
  const lib = Object.keys(s.libraries).find((l) => s.libraries[l].objects.some((o) => o.name === q.name && o.type === type));
  return { library: lib ?? 'QGPL', name: q.name };
}

const jobOf = (game: Shell, value: string): IbmiJob | null => {
  const n = jobName(value);
  return findJobs(game, n)[0] ?? null;
};

// ——— The commands ———

interface Cl extends ClDefinition {
  run: (game: Shell, p: Record<string, string>, interactive: boolean) => string;
}

const v = (p: Record<string, string>, k: string, d = '') => (k in p ? plain(p[k]) : d);

/** The 5250 session goes on after a command that asked a question (a reply). */
const resume = (game: Shell) => (game.state.session5250 ? loop(game) : undefined);

// ——— Jobs ———

function wrkactjob(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const only = v(p, 'SBS', '*ALL');
  const rows: string[] = [];
  for (const sbs of s.subsystems.filter((x) => x.status === 'ACTIVE' && (only === '*ALL' || only === x.name))) {
    rows.push(`      ${pad(sbs.name, 15)}${pad(sbs.library, 11)}${pad('SBS', 6)}${left('.0', 4)}  ${pad('', 16)}DEQW`);
    for (const j of s.jobs.filter((x) => x.subsystem === sbs.name))
      rows.push(`        ${pad(j.name, 13)}${pad(j.user, 11)}${pad(j.type, 6)}${left(j.cpu, 4)}  ${pad(j.function, 16)}${j.status}`);
  }
  return [
    ...header(s, 'Work with Active Jobs'),
    '',
    ` CPU %:     3.1     Elapsed time:   00:00:00     Active jobs:   ${s.jobs.length + 203}`,
    '',
    ' Opt  Subsystem/Job  User       Type  CPU %  Function        Status',
    ...page(game, rows, 30, 4),
  ].join('\n');
}

function wrksbs(game: Shell): string {
  const s = ibmi(game);
  return [
    ...header(s, 'Work with Subsystems'),
    '',
    '      Subsystem     Total     -----------Subsystem Pools------------',
    ' Opt  Description  Storage (M)  1   2   3   4   5   6   7   8   9  10',
    ...s.subsystems.filter((x) => x.status === 'ACTIVE').map((x) => `      ${pad(x.name, 13)}${left('.00', 10)}   2`),
    left('Bottom', W),
  ].join('\n');
}

function wrkjobq(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const q = qualified(v(p, 'JOBQ', '*ALL'), 'QGPL');
  if (q.name === '*ALL') {
    const queues = [...new Set(s.subsystems.map((x) => x.jobq).filter(Boolean))] as string[];
    return [
      ...header(s, 'Work with All Job Queues'),
      '',
      ' Opt  Queue       Library     Jobs  Subsystem   Status',
      ...queues.map((n) => {
        const sbs = s.subsystems.find((x) => x.jobq === n)!;
        return `      ${pad(n, 12)}${pad('QGPL', 10)}${left(s.jobq.filter((j) => j.jobq === n).length, 5)}  ${pad(sbs.status === 'ACTIVE' ? sbs.name : '', 12)}RLS`;
      }),
      left('Bottom', W),
    ].join('\n');
  }
  const sbs = s.subsystems.find((x) => x.jobq === q.name);
  if (!sbs) return notFound(game, q.library, q.name, '*JOBQ');
  const waiting = s.jobq.filter((j) => j.jobq === q.name);
  return [
    ...header(s, 'Work with Job Queue'),
    ` Queue:   ${pad(q.name, 12)}Library:   ${pad('QGPL', 12)}Status:   RLS/${sbs.status === 'ACTIVE' ? sbs.name : ''}`,
    '',
    ' Opt  Job         User        Number   Type     -----Status-----',
    ...waiting.map((j) => `      ${pad(j.name, 12)}${pad(j.user, 12)}${pad(j.number, 9)}${pad('BATCH', 9)}${j.status}`),
    ...(waiting.length ? [] : ['   (No jobs in queue)']),
    left('Bottom', W),
  ].join('\n');
}

function dspjoblog(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const job = 'JOB' in p && v(p, 'JOB') !== '*' ? jobOf(game, p.JOB) : s.jobs.find((j) => j.user === s.profile && j.type === 'INT') ?? null;
  if (!job) {
    // A finished job: its log was printed (QPJOBLOG); the history log keeps its end.
    return failed(game, 'CPF1070', `Job ${v(p, 'JOB')} not found.`);
  }
  const lines: string[] = [];
  for (const m of job.log) {
    lines.push(` ${pad(m.id, 8)} ${pad(m.type, 12)} ${left(m.severity, 2)}  ${m.sent}`);
    lines.push(...wrap(m.text, W - 10, 10).map((l, i) => (i ? l : `          ${l}`)));
  }
  return [
    ...header(s, 'Display Job Log'),
    ` Job . . :   ${pad(job.name, 12)} User . . :   ${pad(job.user, 12)} Number . . . :   ${job.number}`,
    '',
    ' MSGID    TYPE         SEV  DATE      TIME',
    ...lines,
    left('Bottom', W),
  ].join('\n');
}

function wrkobjlck(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const o = resolveObject(game, p.OBJ, v(p, 'OBJTYPE'));
  const type = v(p, 'OBJTYPE');
  if (!s.libraries[o.library]?.objects.some((x) => x.name === o.name && x.type === type)) return notFound(game, o.library, o.name, type);
  const object = `${o.library}/${o.name}`;
  const holders = s.jobs.flatMap((j) => (j.locks ?? []).filter((l) => l.object === object && l.record === undefined).map((l) => ({ j, l })));
  return [
    ...header(s, 'Work with Object Locks'),
    ` Object:   ${pad(o.name, 12)}Library:   ${pad(o.library, 12)}Type:   ${type}`,
    '',
    ' Opt  Job         User        Lock      Status    Scope    Thread',
    ...holders.map(({ j, l }) => `      ${pad(j.name, 12)}${pad(j.user, 12)}${pad(l.state, 10)}${pad('HELD', 10)}${pad('*JOB', 9)}`),
    ...(holders.length ? [] : ['   (No locks)']),
    left('Bottom', W),
  ].join('\n');
}

function dsprcdlck(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const o = resolveObject(game, p.FILE, '*FILE');
  if (!s.tables[`${o.library}/${o.name}`]) return notFound(game, o.library, o.name, '*FILE');
  const object = `${o.library}/${o.name}`;
  const locks = s.jobs.flatMap((j) => (j.locks ?? []).filter((l) => l.object === object && l.record !== undefined).map((l) => ({ j, l })));
  if (!locks.length) return failed(game, 'CPF3297', `No record locks found for member ${o.name} file ${o.name} in library ${o.library}.`);
  return [
    ...header(s, 'Display Member Record Locks'),
    ` File . . . . . . . . :   ${pad(o.name, 12)}Member . . . . . . . :   ${o.name}`,
    `   Library  . . . . . :     ${o.library}`,
    '',
    ' Record      -------------Job-------------    Lock',
    ' Number      Name        User        Number   Status   Type',
    ...locks.map(({ j, l }) => ` ${left(l.record!, 6)}      ${pad(j.name, 12)}${pad(j.user, 12)}${pad(j.number, 9)}${pad(l.waiting ? 'WAIT' : 'HELD', 9)}UPDATE`),
    left('Bottom', W),
  ].join('\n');
}

function endjob(game: Shell, p: Record<string, string>): string {
  const job = jobOf(game, p.JOB);
  if (!job) return failed(game, 'CPF1321', `Job ${v(p, 'JOB')} not found.`);
  const option = v(p, 'OPTION', '*CNTRLD');
  if (!['*CNTRLD', '*IMMED'].includes(option)) return failed(game, 'CPD0084', `${option} not valid for parameter OPTION.`);
  if (job.type === 'SBS' || job.type === 'SYS') return failed(game, 'CPF1351', `Function check occurred in system arbiter's job.`);
  endJob(game, job, 50);
  game.state.ibmiEnded = [...((game.state.ibmiEnded as string[] | undefined) ?? []), qualifiedJob(job)];
  runQueues(game);
  return `Job ${qualifiedJob(job)} ended (${option}).`;
}

function sbmjob(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const cmd = p.CMD.trim();
  const call = parseCl(cmd);
  if (isError(call)) return failed(game, call.id, call.text);
  let program: string;
  if (call.name === 'CALL') {
    const pgm = resolveObject(game, call.keywords.PGM ?? call.positional[0] ?? '', '*PGM');
    if (!s.libraries[pgm.library]?.objects.some((o) => o.name === pgm.name && o.type === '*PGM')) return notFound(game, pgm.library, pgm.name, '*PGM');
    program = `${pgm.library}/${pgm.name}`;
  } else {
    if (!CL[call.name]) return failed(game, 'CPD0030', `Command ${call.name} in library *LIBL not found.`);
    program = `CMD:${cmd}`;
  }
  const jobq = qualified(v(p, 'JOBQ', 'QBATCH'), 'QGPL').name.replace('*JOBD', 'QBATCH');
  if (!s.subsystems.some((x) => x.jobq === jobq)) return notFound(game, 'QGPL', jobq, '*JOBQ');
  const name = v(p, 'JOB', '*JOBD').replace('*JOBD', 'QDFTJOBD');
  const user = v(p, 'USER', '*CURRENT').replace('*CURRENT', s.profile);
  const number = newNumber(game);
  s.jobq.push({ number, user, name, status: 'RLS', jobq, program });
  runQueues(game);
  return `CPC1221: Job ${number}/${user}/${name} submitted to job queue ${jobq} in library QGPL.`;
}

function call(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const pgm = resolveObject(game, p.PGM, '*PGM');
  if (!s.libraries[pgm.library]?.objects.some((o) => o.name === pgm.name && o.type === '*PGM')) return notFound(game, pgm.library, pgm.name, '*PGM');
  // The story's programs check how they are run (RTVJOBA TYPE): the night's work runs in batch.
  return failed(game, 'ORD0001', `Program ${pgm.name} must run in batch: submit it with SBMJOB.`);
}

function endsbs(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const name = v(p, 'SBS');
  const sbs = s.subsystems.find((x) => x.name === name);
  if (!sbs) return failed(game, 'CPF1054', `No subsystem ${name} active.`);
  if (sbs.status !== 'ACTIVE') return failed(game, 'CPF1054', `No subsystem ${name} active.`);
  if (['QINTER', 'QCTL'].includes(name)) return failed(game, 'CPF1052', `ENDSBS not allowed: the subsystem ${name} runs your own job.`);
  for (const j of s.jobs.filter((x) => x.subsystem === name)) endJob(game, j, 50);
  sbs.status = 'INACTIVE';
  history(game, 'CPF0927', `Subsystem ${name} ended.`, 'QSYS');
  return `CPF0943: ENDSBS SBS(${name}) command being processed.`;
}

function strsbs(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const q = qualified(p.SBSD, 'QSYS');
  const sbs = s.subsystems.find((x) => x.name === q.name);
  if (!sbs) return notFound(game, q.library === '*LIBL' ? 'QSYS' : q.library, q.name, '*SBSD');
  if (sbs.status === 'ACTIVE') return failed(game, 'CPF1010', `Subsystem name ${q.name} active.`);
  sbs.status = 'ACTIVE';
  for (const j of sbs.autostart?.() ?? []) s.jobs.push(j);
  history(game, 'CPF0918', `Subsystem ${q.name} started.`, 'QSYS');
  runQueues(game);
  return `CPC1222: Subsystem ${q.name} being started.`;
}

// ——— Messages ———

function messageHelp(m: IbmiMessage): string {
  return [
    '                         Additional Message Information',
    '',
    ` Message ID . . . . . . :   ${pad(m.id, 14)}Severity . . . . . . . :   ${m.severity}`,
    ` Message type . . . . . :   ${m.type}`,
    ` Date sent  . . . . . . :   ${m.sent}`,
    ` From job . . . . . . . :   ${m.from}`,
    ...(m.program ? [` From program . . . . . :   ${m.program}`] : []),
    '',
    ...labelled('Message . . . . :', m.text),
    ...(m.cause ? labelled('Cause . . . . . :', m.cause) : []),
    ...(m.recovery ? labelled('Recovery  . . . :', m.recovery) : []),
    ...(m.choices?.length ? [' Possible choices for replying to message . . . . . . . . . . . . . . . :', ...m.choices.flatMap((c) => wrap(c, W - 8, 8).map((l, i) => (i ? l : `   ${l}`)))] : []),
  ].join('\n');
}

const waiting = (s: Ibmi, queue: string) => (s.msgq[queue] ?? []).find((m) => m.type === 'Inquiry' && m.reply === undefined);

function dspmsg(game: Shell, p: Record<string, string>, interactive: boolean): string {
  const s = ibmi(game);
  const queue = qualified(v(p, 'MSGQ', '*WRKUSR'), 'QSYS').name.replace('*WRKUSR', s.profile).replace('*USRPRF', s.profile);
  if (queue === '*SYSOPR' || queue === 'QSYSOPR' || queue === s.profile || s.msgq[queue]) {
    const q = queue === '*SYSOPR' ? 'QSYSOPR' : queue;
    const messages = s.msgq[q] ?? [];
    const lines: string[] = [];
    for (const m of messages) {
      lines.push(...wrap(m.text, W - 6, 5).map((l, i) => (i ? l : `   ${l}`)));
      if (m.type === 'Inquiry') lines.push(`     Reply . . . :   ${m.reply ?? ''}`);
    }
    const out = [
      '                                Display Messages',
      left(`System:   ${s.system}`, W),
      ` Queue . . . . . :   ${pad(q, 20)}Program . . . . :   *DSPMSG`,
      `   Library . . . :     ${pad(q === 'QSYSOPR' ? 'QSYS' : 'QUSRSYS', 18)}  Library . . . :`,
      ` Severity  . . . :   ${pad(q === 'QSYSOPR' ? '60' : '00', 20)}Delivery  . . . :   ${q === 'QSYSOPR' ? '*HOLD' : '*NOTIFY'}`,
      '',
      ' Type reply (if required), press Enter.',
      ...(lines.length ? lines : ['   (No messages in message queue.)']),
      left('Bottom', W),
    ].join('\n');
    if (interactive && waiting(s, q)) {
      askReply(game, q);
      return `${out}\n${game.t('ibmi-reply-tip')}`;
    }
    return out;
  }
  return notFound(game, 'QUSRSYS', queue, '*MSGQ');
}

/** The reply field of the oldest unanswered inquiry: a reply, ? for its help, Enter to leave it. */
function askReply(game: Shell, queue: string): void {
  const s = ibmi(game);
  const m = waiting(s, queue);
  if (!m) {
    resume(game);
    return;
  }
  game.ask('     Reply . . . :', (answer) => {
    const r = answer.trim();
    // F3 or F12 leaves the display; a whole command (more than a reply's few letters) is typed on the command line.
    if (/^F(3|12)$/i.test(r)) {
      resume(game);
      return '';
    }
    if (game.state.session5250 && r.length > 3 && !/^'.*'$/.test(r)) return commandLine(game, r);
    const text = replied(game, queue, m, r);
    // What the answer showed counts as the last command's output (for the story's events).
    game.last = { line: answer, commands: [['REPLY', answer.trim()]], output: text, errors: [], redirection: null };
    return text;
  });
}

function replied(game: Shell, queue: string, m: IbmiMessage, r: string): string {
  const s = ibmi(game);
  {
    if (!r) {
      resume(game);
      return '';
    }
    if (r === '?' || /^F1$/i.test(r)) {
      askReply(game, queue);
      return messageHelp(m);
    }
    const reply = /^'.*'$/.test(r) ? r.slice(1, -1) : r.toUpperCase();
    if (m.replies && !m.replies.includes(reply)) {
      askReply(game, queue);
      return `CPD2420: Reply ${reply} not valid. Valid replies are ${m.replies.join(' ')}.`;
    }
    m.reply = reply;
    game.state.ibmiReplies = [...((game.state.ibmiReplies as string[] | undefined) ?? []), `${m.id}:${reply}`];
    const after = m.onReply?.(game, reply) ?? '';
    runQueues(game);
    if (waiting(s, queue)) askReply(game, queue);
    else resume(game);
    return [`Reply ${reply} sent to message ${m.id}.`, after].filter(Boolean).join('\n');
  }
}

function wrkmsgq(game: Shell, p: Record<string, string>, interactive: boolean): string {
  const s = ibmi(game);
  if (!('MSGQ' in p) || v(p, 'MSGQ') === '*ALL') {
    return [
      ...header(s, 'Work with Message Queues'),
      '',
      ' Opt  Queue       Library     Text',
      ...Object.keys(s.msgq).map((q) => `      ${pad(q, 12)}${pad(q === 'QSYSOPR' ? 'QSYS' : 'QUSRSYS', 12)}${q === 'QSYSOPR' ? 'System operator message queue' : `Messages for ${q}`}`),
      left('Bottom', W),
    ].join('\n');
  }
  return dspmsg(game, p, interactive);
}

// ——— Spooled files and output queues ———

/** Each spooled file, one by one: [the group, its number]. */
function* spooled(list: Spool[]): Generator<[Spool, number]> {
  for (const g of list) for (let i = 0; i < g.count; i++) yield [g, g.first + i];
}

const spoolRow = (g: Spool, queue = true) =>
  `      ${pad(g.file, 11)}${pad(g.user, 11)}${queue ? pad(g.outq, 11) : ''}${pad(g.userData, 11)}${pad(g.status, 5)}${left(g.pages, 6)}${left(1, 6)}`;

function rowsOf(game: Shell, list: Spool[], queue = true): string[] {
  const count = list.reduce((t, g) => t + g.count, 0);
  const rows: string[] = [];
  const it = spooled(list);
  // The first lines, and the last ones (a list of thousands is never built whole).
  const first = 14;
  const last = 6;
  if (count <= first + last + 1) {
    for (const [g] of it) rows.push(spoolRow(g, queue));
    return [...rows, left('Bottom', W)];
  }
  let i = 0;
  const tail: string[] = [];
  for (const g of list) {
    for (let k = 0; k < g.count; k++, i++) {
      if (i < first) rows.push(spoolRow(g, queue));
      else if (i >= count - last) tail.push(spoolRow(g, queue));
      else {
        // Skip to the group's last ones.
        const jump = Math.min(g.count - k - 1, count - last - 1 - i);
        k += jump;
        i += jump;
      }
    }
  }
  return [...rows, game.t('ibmi-skipped', { count: count - first - last }), ...tail, left('Bottom', W)];
}

function wrksplf(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const sel = 'SELECT' in p ? elements(p.SELECT).map(plain) : ['*CURRENT'];
  const user = (sel[0] ?? '*CURRENT').replace('*CURRENT', s.profile);
  const device = sel[1] ?? '*ALL';
  const userData = sel[3] ?? '*ALL';
  const list = s.spool.filter((g) => (user === '*ALL' || g.user === user) && (device === '*ALL' || g.outq === device) && (userData === '*ALL' || g.userData === userData));
  return [
    ...header(s, 'Work with All Spooled Files'),
    '',
    '                                 Device or                     Total     Cur',
    ' Opt  File       User       Queue      User Data  Sts    Pages    Copy',
    ...(list.length ? rowsOf(game, list) : ['   (No spooled files)', left('Bottom', W)]),
  ].join('\n');
}

function wrkoutq(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const q = qualified(v(p, 'OUTQ', '*ALL'), 'QGPL');
  if (q.name === '*ALL') {
    return [
      ...header(s, 'Work with All Output Queues'),
      '',
      ' Opt  Queue       Library       Files  Writer      Status',
      ...s.outq.map((o) => `      ${pad(o.name, 12)}${pad(o.library, 12)}${left(s.spool.filter((g) => g.outq === o.name).reduce((t, g) => t + g.count, 0), 7)}  ${pad(o.writer, 12)}${o.status}`),
      left('Bottom', W),
    ].join('\n');
  }
  const o = s.outq.find((x) => x.name === q.name);
  if (!o) return notFound(game, q.library === '*LIBL' ? 'QGPL' : q.library, q.name, '*OUTQ');
  const list = s.spool.filter((g) => g.outq === o.name);
  return [
    ...header(s, 'Work with Output Queue'),
    ` Queue:   ${pad(o.name, 12)}Library:   ${pad(o.library, 12)}Status:   ${o.status}${o.writer ? `/${o.writer}` : ''}`,
    '',
    ' Opt  File       User       User Data  Sts    Pages    Copy',
    ...(list.length ? rowsOf(game, list, false) : ['   (No spooled output files)', left('Bottom', W)]),
  ].join('\n');
}

/** Removes spooled files from the groups that match; returns how many. */
function remove(game: Shell, match: (g: Spool) => boolean, number?: number): number {
  const s = ibmi(game);
  let n = 0;
  const kept: Spool[] = [];
  for (const g of s.spool) {
    if (!match(g)) kept.push(g);
    else if (number === undefined) n += g.count;
    else if (number >= g.first && number < g.first + g.count) {
      n += 1;
      // One spooled file out of a group: the group splits around it.
      if (number > g.first) kept.push({ ...g, count: number - g.first });
      if (number < g.first + g.count - 1) kept.push({ ...g, first: number + 1, count: g.first + g.count - 1 - number });
    } else kept.push(g);
  }
  s.spool = kept;
  return n;
}

function dltsplf(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const file = v(p, 'FILE');
  if (file === '*SELECT') {
    const sel = 'SELECT' in p ? elements(p.SELECT).map(plain) : ['*CURRENT'];
    const user = (sel[0] ?? '*CURRENT').replace('*CURRENT', s.profile);
    const device = sel[1] ?? '*ALL';
    const form = sel[2] ?? '*ALL';
    const data = sel[3] ?? '*ALL';
    const n = remove(game, (g) => (user === '*ALL' || g.user === user) && (device === '*ALL' || device === '*OUTQ' || g.outq === device) && (form === '*ALL' || form === '*STD') && (data === '*ALL' || g.userData === data));
    if (!n) return failed(game, 'CPF3303', `File ${file} not found in job.`);
    return `CPC3301: ${n} spooled files deleted.`;
  }
  const job = v(p, 'JOB', '*');
  const number = v(p, 'SPLNBR', '*ONLY');
  if (job === '*') {
    const mine = s.spool.filter((g) => g.file === file && g.user === s.profile);
    if (!mine.length) return failed(game, 'CPF3303', `File ${file} not found in job.`);
  }
  const n = jobName(job);
  const matches = (g: Spool) => {
    const [num, user, name] = g.job.split('/');
    return g.file === file && (job === '*' ? g.user === s.profile : name === n.name && (!n.user || user === n.user) && (!n.number || num === n.number));
  };
  const all = s.spool.filter(matches);
  if (!all.length) return failed(game, 'CPF3303', `File ${file} not found in job ${job}.`);
  if (number === '*ONLY' && all.reduce((t, g) => t + g.count, 0) > 1) return failed(game, 'CPF3340', `More than one file with specified name found in job ${job}.`);
  const deleted = number === '*ALL' || number === '*ONLY' ? remove(game, matches) : number === '*LAST' ? remove(game, matches, Math.max(...all.map((g) => g.first + g.count - 1))) : remove(game, matches, Number(number));
  if (!deleted) return failed(game, 'CPF3309', `No files named ${file} are active.`);
  return deleted === 1 ? `Spooled file ${file} number ${number} deleted.` : `CPC3301: ${deleted} spooled files deleted.`;
}

function clroutq(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const q = qualified(p.OUTQ, 'QGPL');
  if (!s.outq.some((o) => o.name === q.name)) return notFound(game, q.library === '*LIBL' ? 'QGPL' : q.library, q.name, '*OUTQ');
  const n = remove(game, (g) => g.outq === q.name);
  game.state.ibmiCleared = [...((game.state.ibmiCleared as string[] | undefined) ?? []), q.name];
  return `CPC3308: ${n} entries deleted from output queue ${q.name} in ${q.library === '*LIBL' ? 'QGPL' : q.library}.`;
}

function wrksyssts(game: Shell): string {
  const s = ibmi(game);
  const used = aspUsed(game);
  return [
    ...header(s, 'Work with System Status'),
    '',
    ` % CPU used . . . . . . . :        3.1    Auxiliary storage:`,
    ` % DB capability  . . . . :         .4      System ASP . . . . . . :   ${left(s.asp.capacity.toFixed(2), 7)} G`,
    ` Elapsed time . . . . . . :   00:00:01      % system ASP used  . . :   ${left(used.toFixed(4), 8)}`,
    ` Jobs in system . . . . . :       ${left(s.jobs.length + 1416, 4)}      Total  . . . . . . . . :   ${left(s.asp.capacity.toFixed(2), 7)} G`,
    ` % perm addresses . . . . :       .007      Current unprotect used :      3402 M`,
    ` % temp addresses . . . . :       .015      Maximum unprotect  . . :      3610 M`,
    '',
    ` System ASP threshold . . . . . . . . . . . . . . . . . . :   ${s.asp.threshold} %`,
  ].join('\n');
}

// ——— Data areas, libraries ———

function dspdtaara(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const raw = elements(p.DTAARA)[0] ?? '';
  const q = resolveObject(game, raw, '*DTAARA');
  const a = s.dataAreas[`${q.library}/${q.name}`];
  if (!a) return notFound(game, q.library, q.name, '*DTAARA');
  return [
    '                               Display Data Area',
    left(`System:   ${s.system}`, W),
    ` Data area . . . . . . . :   ${q.name}`,
    `   Library . . . . . . . :     ${q.library}`,
    ' Type  . . . . . . . . . :   *CHAR',
    ` Length  . . . . . . . . :   ${a.length}`,
    ` Text  . . . . . . . . . :   ${a.text}`,
    '',
    '            Value',
    ' Offset      *...+....1....+....2....+....3....+....4....+....5',
    `     0      '${a.value.padEnd(a.length)}'`,
  ].join('\n');
}

function chgdtaara(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const parts = elements(p.DTAARA);
  const q = resolveObject(game, parts[0] ?? '', '*DTAARA');
  const a = s.dataAreas[`${q.library}/${q.name}`];
  if (!a) return notFound(game, q.library, q.name, '*DTAARA');
  // (start length): a substring; *ALL (the default): the whole data area.
  const sub = parts[1] ? elements(parts[1].replace(/^\(|\)$/g, '')) : ['*ALL'];
  const value = plain(p.VALUE);
  if (sub[0].toUpperCase() === '*ALL') a.value = value.slice(0, a.length).padEnd(a.length);
  else {
    const start = Number(sub[0]);
    const length = Number(sub[1] ?? '1');
    if (!(start >= 1 && start + length - 1 <= a.length)) return failed(game, 'CPF1088', `Starting position outside of data area.`);
    a.value = a.value.padEnd(a.length).slice(0, start - 1) + value.slice(0, length).padEnd(length) + a.value.padEnd(a.length).slice(start - 1 + length);
  }
  return `Data area ${q.name} in ${q.library} changed.`;
}

function dsplib(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const name = v(p, 'LIB');
  const lib = s.libraries[name];
  if (!lib) return failed(game, 'CPF2110', `Library ${name} not found.`);
  return [
    '                                Display Library',
    left(`System:   ${s.system}`, W),
    ` Library  . . . . . . :   ${pad(name, 20)}Number of objects . :   ${lib.objects.length}`,
    ` Type . . . . . . . . :   ${pad(name.startsWith('Q') ? 'SYS' : 'PROD', 20)}Library ASP number  :   1`,
    ` Create authority . . :   *SYSVAL`,
    ` Text description . . :   ${lib.text}`,
    '',
    ' Object      Type      Attribute          Size  Text',
    ...lib.objects.map((o) => ` ${pad(o.name, 12)}${pad(o.type, 10)}${pad(o.attribute, 10)}${left(o.size, 12)}  ${o.text}`.slice(0, W)),
    left('Bottom', W),
  ].join('\n');
}

function dsplog(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const id = v(p, 'MSGID', '*ALL');
  const job = 'JOB' in p ? jobName(p.JOB) : null;
  const entries = s.history.filter((h) => (id === '*ALL' || h.id === id) && (!job || h.job.split('/').at(-1) === job.name));
  return [
    '                         Display History Log Contents',
    '',
    ...(entries.length ? entries.flatMap((h) => wrap(`${h.id}: ${h.text}`, W - 4, 4).map((l, i) => (i ? l : ` ${l}`))) : ['   (No messages selected.)']),
    '',
    left('Bottom', W),
  ].join('\n');
}

// ——— Save files ———

function crtsavf(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const q = qualified(p.FILE, 'QGPL');
  const library = q.library === '*CURLIB' || q.library === '*LIBL' ? 'QGPL' : q.library;
  if (!s.libraries[library]) return failed(game, 'CPF2110', `Library ${library} not found.`);
  if (s.libraries[library].objects.some((o) => o.name === q.name && o.type === '*FILE')) return failed(game, 'CPF5813', `File ${q.name} in library ${library} already exists.`);
  s.libraries[library].objects.push({ name: q.name, type: '*FILE', attribute: 'SAVF', size: 8192, text: v(p, 'TEXT', '') });
  s.savf[`${library}/${q.name}`] = null;
  return `CPC9801: Object ${q.name} type *FILE created in library ${library}.`;
}

function dspsavf(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const q = resolveObject(game, p.FILE, '*FILE');
  const key = `${q.library}/${q.name}`;
  if (!(key in s.savf)) return failed(game, 'CPF9812', `File ${q.name} in library ${q.library} not found.`);
  const saved = s.savf[key];
  if (!saved) return failed(game, 'CPF3781', `Save file ${q.name} in ${q.library} contains no data.`);
  return [
    '                             Display Saved Objects',
    left(`System:   ${s.system}`, W),
    ` Library saved  . . . :   ${pad(saved.library, 14)}Save while active . . :   ${saved.savact}`,
    ` Objects displayed  . :   ${pad(String(saved.objects.length), 14)}Records . . . . . . . :   ${saved.objects.reduce((t, o) => t + Math.ceil(o.size / 512), 0)}`,
    ` Save date/time . . . :   ${saved.date}  ${saved.time}`,
    '',
    ' Object      Type      Attribute   Owner          Size (K)  Data',
    ...saved.objects.map((o) => ` ${pad(o.name, 12)}${pad(o.type, 10)}${pad(o.attribute, 12)}${pad('ORDOWNER', 12)}${left(Math.ceil(o.size / 1024), 9)}  YES`),
    left('Bottom', W),
  ].join('\n');
}

function savlib(game: Shell, p: Record<string, string>, interactive: boolean): string {
  const s = ibmi(game);
  const libs = elements(p.LIB).map(plain);
  const dev = v(p, 'DEV');
  if (dev !== '*SAVF') return failed(game, 'CPF9814', `Device ${dev} not found.`);
  if (!('SAVF' in p)) return failed(game, 'CPD0071', 'Parameter SAVF required.');
  if (libs.length > 1) return failed(game, 'CPF3812', 'Only one library can be saved to a save file.');
  const lib = libs[0];
  if (!s.libraries[lib]) return failed(game, 'CPF3781', `Library ${lib} not found.`);
  const q = resolveObject(game, p.SAVF, '*FILE');
  const key = `${q.library}/${q.name}`;
  if (!(key in s.savf)) return failed(game, 'CPF9812', `File ${q.name} in library ${q.library} not found.`);
  const clear = v(p, 'CLEAR', '*NONE');
  const savact = v(p, 'SAVACT', '*NO');
  if (!['*NO', '*LIB', '*SYSDEFN', '*SYNCLIB'].includes(savact)) return failed(game, 'CPD0084', `${savact} not valid for parameter SAVACT.`);
  const doSave = (): string => {
    const objects = s.libraries[lib].objects;
    const inUse = (name: string) => s.jobs.some((j) => j.locks?.some((l) => l.object === `${lib}/${name}` && ['*SHRUPD', '*EXCL', '*SHRNUP'].includes(l.state)));
    const saved = objects.filter((o) => savact !== '*NO' || !inUse(o.name));
    const missed = objects.filter((o) => !saved.includes(o));
    s.savf[key] = { library: lib, objects: saved.map((o) => ({ ...o })), date: s.date, time: s.time, savact };
    const out = [
      ...(savact !== '*NO' ? [`CPI3712: Library ${lib} reached checkpoint.`] : []),
      ...missed.flatMap((o) => [`CPF3202: File ${o.name} in library ${lib} in use.`, `CPF3741: ${o.type.slice(1)} ${o.name} in ${lib} not saved.`]),
      missed.length ? `CPF3771: ${saved.length} objects saved from ${lib}. ${missed.length} not saved.` : `CPC3722: ${saved.length} objects saved from library ${lib}.`,
    ];
    history(game, missed.length ? 'CPF3771' : 'CPC3722', out.at(-1)!.replace(/^\w+: /, ''), `${s.profile}`);
    if (missed.length) game.error(out.join('\n'), 1);
    return missed.length ? '' : out.join('\n');
  };
  if (s.savf[key] && !['*ALL', '*REPLACE', '*AFTER'].includes(clear)) {
    // The save file holds a save: an inquiry, C (cancel) or G (clear it and go on).
    if (!interactive) return failed(game, 'CPF3794', `Save or restore operation ended unsuccessfully: save file ${q.name} in ${q.library} contains data (default reply C to CPA4067).`);
    game.ask(`CPA4067: Save file ${q.name} in ${q.library} contains data. (C G)  Reply . . . :`, (r) => {
      const reply = r.trim().toUpperCase();
      const out = reply === 'G' ? doSave() : `CPF3794: Save or restore operation ended unsuccessfully.`;
      const errors = game.recoverErrors();
      resume(game);
      return [...errors, out].filter(Boolean).join('\n');
    });
    return '';
  }
  return doSave();
}

// ——— DB2 for i ———

const tableOf = (game: Shell, value: string): DbTable | null => {
  const q = resolveObject(game, value, '*FILE');
  return ibmi(game).tables[`${q.library}/${q.name}`] ?? null;
};

/** One field as CPYTOIMPF writes it: numbers and dates as they are, strings between the delimiters. */
const field = (value: string | number, type: string, strdlm: string) => (type === 'DECIMAL' || type === 'DATE' ? String(value) : `${strdlm}${String(value).split(strdlm).join(strdlm + strdlm)}${strdlm}`);

/** A stream file's bytes in a CCSID: 37 (EBCDIC), 819 or 1252 (one byte per character), 1208 (UTF-8). */
function encodeStmf(text: string, ccsid: number): { content: string; charset?: 'binary' | 'latin1' } {
  if (ccsid === 37) return { content: byteString(encodeEbcdic(text)), charset: 'binary' };
  if (ccsid === 819 || ccsid === 1252) return /[\u0080-\u00ff]/.test(text) ? { content: text, charset: 'latin1' } : { content: text };
  return { content: text };
}
const decodeStmf = (content: string, ccsid: number) => (ccsid === 37 ? bytesOf(content).map((b) => String.fromCharCode(CP037[b])).join('') : content);

function cpytoimpf(game: Shell, p: Record<string, string>): string {
  const s = ibmi(game);
  const table = tableOf(game, p.FROMFILE);
  if (!table) {
    const q = resolveObject(game, p.FROMFILE, '*FILE');
    return notFound(game, q.library, q.name, '*FILE');
  }
  if (!('TOSTMF' in p) && !('TOFILE' in p)) return failed(game, 'CPD0071', 'Parameter TOSTMF required.');
  if ('TOFILE' in p) return failed(game, 'CPF2817', 'Copy command ended because of error.');
  const path = plain(p.TOSTMF);
  const mbropt = v(p, 'MBROPT', '*ADD');
  const rcddlm = v(p, 'RCDDLM', '*EOR');
  const strdlm = v(p, 'STRDLM', '*DBLQUOTE').replace('*DBLQUOTE', '"').replace('*NONE', '');
  const flddlm = v(p, 'FLDDLM', ',').replace('*TAB', '\t');
  const ccsidParam = v(p, 'STMFCCSID', '*STMF');
  const newline = ({ '*EOR': '\r\n', '*CRLF': '\r\n', '*LF': '\n', '*CR': '\r', '*LFCR': '\n\r' } as Record<string, string>)[rcddlm];
  if (newline === undefined) return failed(game, 'CPD0084', `${rcddlm} not valid for parameter RCDDLM.`);
  if (!['*ADD', '*REPLACE'].includes(mbropt)) return failed(game, 'CPD0084', `${mbropt} not valid for parameter MBROPT.`);
  const absolute = game.resolve(path);
  const old = game.find(absolute);
  if (old?.type === 'directory') return failed(game, 'CPFA0DB', `Object ${absolute} is a directory.`);
  // *STMF: an existing file keeps its CCSID; a new one takes the database file's (37, EBCDIC).
  const known = { '*STMF': 37, '*STDASCII': 819, '*PCASCII': 1252 } as Record<string, number>;
  let ccsid = known[ccsidParam] ?? Number(ccsidParam);
  if (![37, 819, 1208, 1252].includes(ccsid)) return failed(game, 'CPDA08A', `CCSID ${ccsidParam} not supported.`);
  if (old && mbropt === '*ADD') ccsid = s.stmf[absolute] ?? (old.type === 'file' && old.charset === 'binary' ? 37 : 1208);
  const head = v(p, 'ADDCOLNAM', '*NONE') !== '*NONE' ? [table.columns.map((c) => `${strdlm}${c.name}${strdlm}`).join(flddlm)] : [];
  const lines = [...head, ...table.rows.map((r) => r.map((x, i) => field(x, table.columns[i].type, strdlm)).join(flddlm))];
  let text = lines.map((l) => l + newline).join('');
  if (old?.type === 'file' && mbropt === '*ADD') text = decodeStmf(typeof old.content === 'string' ? old.content : '', ccsid) + text;
  const { content, charset } = encodeStmf(text, ccsid);
  if (old?.type === 'file') {
    old.content = content;
    old.lines = false;
    if (charset) old.charset = charset;
    else delete old.charset;
    delete old.size;
  } else {
    const refused = game.place('cpytoimpf', path, { type: 'file', content, owner: game.who, mode: 'rw-r-----', ...(charset ? { charset } : {}) });
    if (refused) return failed(game, 'CPFA0A9', `Object not found.  Object is ${absolute}.`);
  }
  s.stmf[absolute] = ccsid;
  return `CPC2957: Number of records copied ${table.rows.length}.`;
}

// ——— The table of commands ———

export const CL: Record<string, Cl> = {
  SIGNOFF: { params: ['LOG'], run: (game, _p, interactive) => (interactive ? signoff(game) : failed(game, 'CPD0031', 'Command SIGNOFF not allowed in this setting.')) },
  WRKACTJOB: { params: ['OUTPUT', 'SBS'], maxPos: 1, run: (g, p) => wrkactjob(g, p) },
  WRKSBS: { params: ['OUTPUT'], run: (g) => wrksbs(g) },
  WRKJOBQ: { params: ['JOBQ', 'OUTPUT'], run: (g, p) => wrkjobq(g, p) },
  WRKSYSSTS: { params: ['OUTPUT', 'RESET', 'ASTLVL'], maxPos: 1, run: (g) => wrksyssts(g) },
  DSPMSG: { params: ['MSGQ', 'OUTPUT', 'MSGTYPE', 'START', 'SEV'], maxPos: 2, run: (g, p, i) => dspmsg(g, p, i) },
  WRKMSGQ: { params: ['MSGQ'], run: (g, p, i) => wrkmsgq(g, p, i) },
  DSPJOBLOG: { params: ['JOB', 'OUTPUT', 'MSGF'], maxPos: 2, run: (g, p) => dspjoblog(g, p) },
  WRKOBJLCK: { params: ['OBJ', 'OBJTYPE', 'MBR'], maxPos: 3, required: ['OBJ', 'OBJTYPE'], run: (g, p) => wrkobjlck(g, p) },
  DSPRCDLCK: { params: ['FILE', 'MBR', 'RCDNBR', 'OUTPUT'], maxPos: 4, required: ['FILE'], run: (g, p) => dsprcdlck(g, p) },
  ENDJOB: { params: ['JOB', 'OPTION', 'DELAY', 'SPLFILE', 'LOGLMT'], maxPos: 3, required: ['JOB'], run: (g, p) => endjob(g, p) },
  SBMJOB: { params: ['CMD', 'JOB', 'JOBD', 'JOBQ', 'USER'], maxPos: 4, required: ['CMD'], run: (g, p) => sbmjob(g, p) },
  CALL: { params: ['PGM', 'PARM'], required: ['PGM'], run: (g, p) => call(g, p) },
  ENDSBS: { params: ['SBS', 'OPTION', 'DELAY'], maxPos: 3, required: ['SBS'], run: (g, p) => endsbs(g, p) },
  STRSBS: { params: ['SBSD'], required: ['SBSD'], run: (g, p) => strsbs(g, p) },
  WRKOUTQ: { params: ['OUTQ', 'OUTPUT'], maxPos: 2, run: (g, p) => wrkoutq(g, p) },
  WRKSPLF: { params: ['SELECT', 'ASTLVL', 'OUTPUT'], maxPos: 3, run: (g, p) => wrksplf(g, p) },
  DLTSPLF: { params: ['FILE', 'JOB', 'SPLNBR', 'JOBSYSNAME', 'CRTDATE', 'SELECT'], maxPos: 3, required: ['FILE'], run: (g, p) => dltsplf(g, p) },
  CLROUTQ: { params: ['OUTQ'], required: ['OUTQ'], run: (g, p) => clroutq(g, p) },
  DSPDTAARA: { params: ['DTAARA', 'OUTPUT', 'OUTFMT'], maxPos: 3, required: ['DTAARA'], run: (g, p) => dspdtaara(g, p) },
  CHGDTAARA: { params: ['DTAARA', 'VALUE'], required: ['DTAARA', 'VALUE'], run: (g, p) => chgdtaara(g, p) },
  DSPLIB: { params: ['LIB', 'OUTPUT'], maxPos: 2, required: ['LIB'], run: (g, p) => dsplib(g, p) },
  DSPLOG: { params: ['LOG', 'PERIOD', 'OUTPUT', 'JOB', 'MSGID'], maxPos: 3, run: (g, p) => dsplog(g, p) },
  CRTSAVF: { params: ['FILE', 'TEXT', 'AUT'], maxPos: 1, required: ['FILE'], run: (g, p) => crtsavf(g, p) },
  DSPSAVF: { params: ['FILE', 'OBJ', 'OUTPUT'], maxPos: 1, required: ['FILE'], run: (g, p) => dspsavf(g, p) },
  SAVLIB: { params: ['LIB', 'DEV', 'SAVF', 'SAVACT', 'SAVACTWAIT', 'CLEAR'], maxPos: 2, required: ['LIB', 'DEV'], run: (g, p, i) => savlib(g, p, i) },
  CPYTOIMPF: {
    params: ['FROMFILE', 'TOFILE', 'TOSTMF', 'MBROPT', 'FROMCCSID', 'STMFCCSID', 'RCDDLM', 'DTAFMT', 'STRDLM', 'FLDDLM', 'ADDCOLNAM'],
    maxPos: 3,
    required: ['FROMFILE'],
    run: (g, p) => cpytoimpf(g, p),
  },
};

/** Runs one CL command line (5250 or PASE's system); its errors are written with game.error. */
export function runCl(game: Shell, line: string, interactive: boolean): string {
  const call = parseCl(line);
  if (isError(call)) return call.id ? failed(game, call.id, call.text) : '';
  // CMD ? (or ?CMD): the command's help, instead of the F4 prompt.
  if (call.positional[0] === '?' || call.name.startsWith('?')) {
    const name = call.name.replace(/^\?/, '');
    const c = COMMANDS[name];
    if (c?.cl) return pageMan(name, c, game.t);
  }
  const def = CL[call.name];
  if (!def || (call.library && !['QSYS', '*LIBL'].includes(call.library)))
  {
    failed(game, 'CPD0030', `Command ${call.name} in library ${call.library ?? '*LIBL'} not found.`);
    return failed(game, 'CPF0006', 'Errors occurred in command.');
  }
  const p = bind(call, def);
  if (isError(p)) {
    failed(game, p.id, p.text);
    return failed(game, 'CPF0001', `Error found on ${call.name} command.`);
  }
  const s = ibmi(game);
  // SBMJOB CMD(…) other than CALL: the command runs when the job starts.
  s.programs['*CMD'] ??= (g, job) => {
    runCl(g as Shell, job.program!.replace(/^CMD:/, ''), false);
    endJob(g, job, 0);
  };
  return def.run(game, p, interactive);
}

// ——— The 5250 session: sign-on, main menu, command line ———

const MENU = [
  ' MAIN                          IBM i Main Menu',
  '',
  ' Select one of the following:',
  '',
  '      1. User tasks',
  '      2. Office tasks',
  '      3. General system tasks',
  '      4. Files, libraries, and folders',
  '      5. Programming',
  '      6. Communications',
  '      7. Define or change the system',
  '      8. Problem handling',
  '      9. Display a menu',
  '     10. Information Assistant options',
  '     11. IBM i Access tasks',
  '',
  '     90. Sign off',
  '',
  ' Selection or command',
];

/** tn5250 has connected: the sign-on display. */
export function signOn(game: Shell): string {
  const s = ibmi(game);
  game.state.session5250 = true;
  askUser(game);
  return [
    '                                    Sign On',
    `                                           System  . . . . . :   ${s.system}`,
    '                                           Subsystem . . . . :   QINTER',
    '                                           Display . . . . . :   QPADEV0007',
    '',
    '                    (C) COPYRIGHT IBM CORP. 1980, 2024.',
  ].join('\n');
}

function askUser(game: Shell): void {
  game.ask('                 User  . . . . . . . . . . . . . .', (u) => {
    askPassword(game, u.trim());
    return '';
  });
}

function askPassword(game: Shell, user: string): void {
  game.ask(
    '                 Password  . . . . . . . . . . . .',
    (pw) => {
      const s = ibmi(game);
      if (user.toUpperCase() !== s.profile) {
        askUser(game);
        return `CPF1120: User ${user.toUpperCase()} does not exist.`;
      }
      if (pw !== game.playerPassword()) {
        askUser(game);
        return 'CPF1107: Password not correct for user profile.';
      }
      if (!s.jobs.some((j) => j.name === 'QPADEV0007'))
        s.jobs.push({ number: newNumber(game), user: s.profile, name: 'QPADEV0007', type: 'INT', subsystem: 'QINTER', status: 'RUN', function: 'MNU-MAIN', cpu: '.0', log: [] });
      loop(game);
      return [...MENU, '', game.t('ibmi-signon-tip')].join('\n');
    },
    true,
  );
}

function signoff(game: Shell): string {
  const s = ibmi(game);
  s.jobs = s.jobs.filter((j) => j.name !== 'QPADEV0007');
  // The console sees false: tn5250 closes without ssh's "logout".
  game.state.session5250 = false;
  game.output = true;
  return '';
}

/** The command line: each line is a CL command, until SIGNOFF. */
export function loop(game: Shell): void {
  game.ask('===>', (line) => commandLine(game, line));
}

/** One line typed at ===> (or instead of a reply): a CL command, or a menu option. */
function commandLine(game: Shell, line: string): string {
  const l = line.trim();
  if (!l) {
    loop(game);
    return '';
  }
  game.typedCommands++;
  game.commandLine = l;
  if (game.history.at(-1) !== l) game.history.push(l);
  let out: string;
  const before = game.errorCount();
  if (l === '90') out = signoff(game);
  else if (/^\d+$/.test(l)) out = game.t('ibmi-menu-option');
  else {
    const job = ibmi(game).jobs.find((j) => j.name === 'QPADEV0007');
    const name = l.split(/[\s(]/)[0].toUpperCase();
    if (job) job.function = `CMD-${name.split('/').at(-1)}`;
    out = runCl(game, l, true);
  }
  const errors = game.recoverErrors();
  if (errors.length > before) game.commandsInError++;
  game.last = { line: l, commands: [l.split(/\s+/)], output: out, errors, redirection: null };
  if (game.state.session5250 && !game.question) loop(game);
  return [...errors, out].filter(Boolean).join('\n');
}

// ——— tn5250 (workstation), system and db2 (PASE) ———

function tn5250(game: Shell, args: string[]): string {
  const host = args.filter((a) => !a.startsWith('-') && !a.includes('=')).at(-1);
  if (!host) return game.error('Usage: tn5250 [options] HOST[:port]', 1);
  const name = host.replace(/:\d+$/, '').replace(/\.internal$/, '');
  let address: string | null = /^\d+\.\d+\.\d+\.\d+$/.test(name) ? name : null;
  for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
    const [a, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (names.includes(host.replace(/:\d+$/, '')) || names.includes(name)) address = a;
  }
  if (!address) return game.error(`Could not start session: ${host}: Name or service not known`, 1);
  const m = MACHINES.find((x) => x.address === address);
  // Only an IBM i answers on the telnet port with a 5250 server.
  if (!m || m.os !== 'ibmi') return game.error(`Could not start session: Connection refused`, 1);
  game.connectionRequest = m.name;
  game.state.connectionPort = 23;
  game.state.connectionTerminal = '5250';
  return '';
}

function system(game: Shell, args: string[]): string {
  if (!isIbmi(game)) {
    game.status = 127;
    return game.error(`-bash: system: command not found`);
  }
  const flags = args.filter((a) => /^-[a-z]+$/.test(a)).join('');
  const bad = [...flags.replace(/-/g, '')].find((l) => !'bikvnqs'.includes(l));
  if (bad) return game.error(`system: illegal option -- ${bad}\nUsage: system [-bOiKkqnsv] CLcommand`, 2);
  const line = args.filter((a) => !/^-[a-z]+$/.test(a)).join(' ');
  if (!line) return game.error('Usage: system [-bOiKkqnsv] CLcommand', 2);
  const before = game.errorCount();
  const out = runCl(game, line, false);
  if (game.errorCount() > before) game.status = 1;
  return [flags.includes('v') ? line : '', out].filter(Boolean).join('\n');
}

/** db2 (PASE's DB2 for i command line): a SELECT on one table. */
function db2(game: Shell, args: string[]): string {
  if (!isIbmi(game)) {
    game.status = 127;
    return game.error(`-bash: db2: command not found`);
  }
  const sql = args.join(' ').trim().replace(/;$/, '');
  if (!sql) return game.error('Usage: db2 [-v] "SQL statement"', 1);
  const m = /^select\s+(.+?)\s+from\s+([\w#@$]+)[./]([\w#@$]+)(?:\s+where\s+(\w+)\s*(=|<>|>|<)\s*('[^']*'|[\w.-]+))?(?:\s+order\s+by\s+(\w+))?(?:\s+fetch\s+first\s+(\d+)\s+rows?\s+only)?$/i.exec(sql);
  if (!/^select\b/i.test(sql)) return game.error('SQL0104  An unexpected token was found. Only SELECT is available here.', 4);
  if (!m) return game.error(`SQL0104  Token was not valid.`, 4);
  const table = ibmi(game).tables[`${m[2].toUpperCase()}/${m[3].toUpperCase()}`];
  if (!table) return game.error(`SQL0204  ${m[3].toUpperCase()} in ${m[2].toUpperCase()} type *FILE not found.`, 4);
  const index = (c: string) => table.columns.findIndex((x) => x.name === c.toUpperCase());
  let rows = table.rows;
  if (m[4]) {
    const i = index(m[4]);
    if (i < 0) return game.error(`SQL0206  Column or global variable ${m[4].toUpperCase()} not found.`, 4);
    const value = m[6].replace(/^'|'$/g, '');
    const cmp = (x: string | number) => (typeof x === 'number' ? x - Number(value) : String(x).localeCompare(value));
    rows = rows.filter((r) => ({ '=': cmp(r[i]) === 0, '<>': cmp(r[i]) !== 0, '>': cmp(r[i]) > 0, '<': cmp(r[i]) < 0 })[m[5]]);
  }
  if (m[7]) {
    const i = index(m[7]);
    if (i < 0) return game.error(`SQL0206  Column or global variable ${m[7].toUpperCase()} not found.`, 4);
    rows = [...rows].sort((a, b) => (typeof a[i] === 'number' ? (a[i] as number) - (b[i] as number) : String(a[i]).localeCompare(String(b[i]))));
  }
  if (m[8]) rows = rows.slice(0, Number(m[8]));
  const what = m[1].trim();
  if (/^count\(\s*\*\s*\)$/i.test(what)) return ['', '00001', '-----------', left(rows.length, 11), '', '  1 RECORD(S) SELECTED.'].join('\n');
  const cols = what === '*' ? table.columns.map((_, i) => i) : what.split(',').map((c) => index(c.trim()));
  const unknown = what === '*' ? undefined : what.split(',').find((c) => index(c.trim()) < 0);
  if (unknown) return game.error(`SQL0206  Column or global variable ${unknown.trim().toUpperCase()} not found.`, 4);
  const widths = cols.map((i) => Math.max(table.columns[i].name.length, table.columns[i].type === 'DATE' ? 10 : table.columns[i].length));
  const cell = (x: string | number, i: number, w: number) => (table.columns[i].type === 'DECIMAL' ? left(x, w) : pad(String(x), w));
  return [
    '',
    cols.map((i, k) => pad(table.columns[i].name, widths[k])).join(' ').trimEnd(),
    widths.map((w) => '-'.repeat(w)).join(' '),
    ...rows.map((r) => cols.map((i, k) => cell(r[i], i, widths[k])).join(' ').trimEnd()),
    '',
    `  ${rows.length} RECORD(S) SELECTED.`,
  ].join('\n');
}

const notHere = (cl: string) => ({ game }: { game: Shell }) => {
  game.status = 127;
  return game.error(isIbmi(game) ? `-bash: ${cl}: command not found` : `-bash: ${cl}: command not found`);
};

export const IBMI: Record<string, Command> = {
  tn5250: { ownOptions: true, launch: ({ args, game }) => tn5250(game, args) },
  system: { ownOptions: true, launch: ({ args, game }) => system(game, args) },
  db2: { ownOptions: true, launch: ({ args, game }) => db2(game, args) },
  // The CL commands: their manual pages (man WRKACTJOB); they run on the
  // 5250 command line or through system, not as programs of PASE.
  ...Object.fromEntries(Object.keys(CL).map((name) => [name, { cl: true, launch: notHere(name) } as Command])),
};

export const playerProfile = (game: Shell) => player(game.t).toUpperCase();
