// The CUPS commands, on the model of ../cups.ts: lpstat, lp, lpr, lpq,
// cancel, lprm, cupsenable, cupsdisable, cupsaccept, cupsreject, lpadmin,
// lpoptions, lpinfo, cupsctl, cupsd (-t) and driverless; man pages for
// cupsd.conf and printers.conf.
// After the CUPS 2.4 man pages (https://www.cups.org/doc/man-lpstat.html,
// man-lp.html, man-lpr.html, man-lpq.html, man-cancel.html, man-lprm.html,
// man-cupsenable.html, man-cupsaccept.html, man-lpadmin.html,
// man-lpoptions.html, man-lpinfo.html, man-cupsctl.html, man-cupsd.html)
// and their outputs (lpstat.c, lpq.c: column widths, date as %c).
// Differences: an operation refused by the policy answers "Forbidden"
// at once (no password asked); one CUPS server, the local one (-h is
// accepted and ignored); no classes; lpoptions -l lists two options.

import type { Shell } from '../shell';
import type { Command } from './index';
import {
  FINISHED, CUPSD_CONF, VERSION, active, cDate, cups, deviceFor, directive, editCancelLimit, editLocation, finish, hasCups, isAdmin,
  editPolicyValue, log, mayCancel, models, newPrinter, parseConf, ppdText, running, sees, setDirective, testConf, uriHost, uriScheme, writePrinters,
  submit, syncSpool, type Job, type Printer,
} from '../cups';
import { start, stop, systemd } from '../systemd';

const now = (game: Shell) => systemd(game)?.clock ?? 0;

/** Splits CUPS-style options: -dprinter or -d printer; the letters that take a value. */
function options(args: string[], withValue: string): { flags: [string, string | null][]; rest: string[]; bad: string | null } {
  const flags: [string, string | null][] = [];
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--') && a.length > 2) {
      const [name, value] = a.slice(2).split(/=(.*)/s);
      flags.push([`--${name}`, value ?? null]);
      continue;
    }
    if (!a.startsWith('-') || a === '-') {
      rest.push(a);
      continue;
    }
    for (let k = 1; k < a.length; k++) {
      const letter = a[k];
      if (withValue.includes(letter)) {
        const value = k + 1 < a.length ? a.slice(k + 1) : (args[++i] ?? null);
        flags.push([letter, value]);
        break;
      }
      flags.push([letter, null]);
    }
  }
  return { flags, rest, bad: null };
}

/** The scheduler must run: otherwise the client can't connect. */
const down = (game: Shell, cmd: string) => (running(game) ? null : game.error(`${cmd}: Scheduler is not running.`, 1));

/** A job named 117, office-117 or by its printer and number. */
function jobFor(game: Shell, id: string): Job | undefined {
  const m = /^(?:(.+)-)?(\d+)$/.exec(id);
  if (!m) return undefined;
  return cups(game).jobs.find((j) => j.id === Number(m[2]) && (!m[1] || j.printer === m[1]));
}

/** The default destination: LPDEST, PRINTER, ~/.cups/lpoptions, /etc/cups/lpoptions, then the server's. */
export function defaultDest(game: Shell): string | null {
  const env = game.environment ?? {};
  if (env.LPDEST) return env.LPDEST;
  if (env.PRINTER) return env.PRINTER;
  for (const file of [`${game.home}/.cups/lpoptions`, '/etc/cups/lpoptions']) {
    const m = /^Default\s+(\S+)/m.exec(game.read(file) ?? '');
    if (m) return m[1].split('/')[0];
  }
  return cups(game).default;
}

// ——— lpstat ———

function printerLine(game: Shell, p: Printer, long: boolean): string {
  const st = cups(game);
  const since = cDate(p.stateTime);
  const lines: string[] = [];
  if (p.state === 'stopped') lines.push(`printer ${p.name} disabled since ${since} -`, `\t${p.message || 'reason unknown'}`);
  else {
    const current = active(st, p.name).find((j) => j.state === 'processing');
    lines.push(current ? `printer ${p.name} now printing ${p.name}-${current.id}.  enabled since ${since}` : `printer ${p.name} is idle.  enabled since ${since}`);
    if (p.message) lines.push(`\t${p.message}`);
  }
  if (long)
    lines.push(
      '\tForm mounted:',
      '\tContent types: any',
      '\tPrinter types: unknown',
      `\tDescription: ${p.info}`,
      '\tAlerts: none',
      `\tLocation: ${p.location}`,
      '\tConnection: direct',
      `\tInterface: ${p.driver === 'raw' ? '/dev/null' : `/etc/cups/ppd/${p.name}.ppd`}`,
      '\tOn fault: no alert',
      '\tAfter fault: continue',
      ...(p.deny?.length ? ['\tUsers denied:', ...p.deny.map((u) => `\t\t${u}`)] : ['\tUsers allowed:', ...(p.allow?.length ? p.allow : ['(all)']).map((u) => `\t\t${u}`)]),
      '\tForms allowed:',
      '\t\t(none)',
      '\tBanner required',
      '\tCharset sets:',
      '\t\t(none)',
      '\tDefault pitch:',
      '\tDefault page size:',
      '\tDefault port settings:',
    );
  return lines.join('\n');
}

// lpstat and lpq (systemv/lpstat.c, berkeley/lpq.c of cups 2.4.10) print a job's size as
// 1024 × job-k-octets (the scheduler rounds the bytes up to a kilobyte), and "unknown" for an
// owner the policy keeps private (the scheduler leaves the attribute out).
const kSize = (bytes: number) => 1024 * Math.ceil(bytes / 1024);

function jobLines(game: Shell, jobs: Job[]): string[] {
  return jobs.map((j) => {
    const user = sees(game, game.who, j, 'job-originating-user-name') ? j.user : 'unknown';
    return `${`${j.printer}-${j.id}`.padEnd(23)} ${user.padEnd(13)} ${String(kSize(j.size)).padStart(8)}   ${cDate(j.completed !== undefined && FINISHED.includes(j.state) ? j.completed : j.created)}`;
  });
}

function lpstat(game: Shell, args: string[]): string {
  if (!hasCups(game)) return game.error('lpstat: Scheduler is not running.', 1);
  const st = cups(game);
  const out: string[] = [];
  let which: 'not-completed' | 'completed' | 'all' = 'not-completed';
  let long = false;
  let users: string[] | null = null;
  const list = (i: number): [string[] | null, number] => (i + 1 < args.length && !args[i + 1].startsWith('-') ? [args[i + 1].split(/[\s,]+/).filter(Boolean), i + 1] : [null, i]);
  const known = (names: string[] | null) => (names ? names.filter((n) => st.printers[n] || (game.error(`lpstat: Invalid destination name in list "${n}".`, 1), false)) : Object.keys(st.printers));
  const sections: (() => void)[] = [];
  const show = {
    r: () => out.push(running(game) ? 'scheduler is running' : 'scheduler is not running'),
    d: () => out.push(st.default ? `system default destination: ${st.default}` : 'no system default destination'),
    v: (names: string[] | null) => known(names).forEach((n) => out.push(`device for ${n}: ${st.printers[n].uri}`)),
    a: (names: string[] | null) =>
      known(names).forEach((n) => {
        const p = st.printers[n];
        out.push(p.accepting ? `${n} accepting requests since ${cDate(p.acceptTime)}` : `${n} not accepting requests since ${cDate(p.acceptTime)} -\n\t${p.rejectReason || 'Rejecting Jobs'}`);
      }),
    p: (names: string[] | null) => known(names).forEach((n) => out.push(printerLine(game, st.printers[n], long))),
    o: (names: string[] | null) => {
      const jobs = st.jobs
        .filter((j) => (which === 'all' ? true : which === 'completed' ? FINISHED.includes(j.state) : !FINISHED.includes(j.state)))
        .filter((j) => !names || names.includes(j.printer) || names.includes(String(j.id)) || names.includes(`${j.printer}-${j.id}`))
        .filter((j) => !users || users.includes(j.user));
      out.push(...jobLines(game, jobs));
    },
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-W') {
      const v = args[++i] ?? '';
      if (!['completed', 'not-completed', 'all'].includes(v)) return game.error(`lpstat: Need "completed", "not-completed", or "all" after "-W" option.`, 1);
      which = v as typeof which;
      continue;
    }
    if (a === '-u') {
      const [names, next] = list(i);
      users = names;
      i = next;
      sections.push(() => show.o(null));
      continue;
    }
    if (a === '-h' || a === '-U') {
      i++;
      continue;
    }
    if (!a.startsWith('-')) {
      // A bare destination: its jobs.
      sections.push(() => show.o([a]));
      continue;
    }
    for (const letter of a.slice(1)) {
      if ('apov'.includes(letter) && a.length === 2) {
        const [names, next] = list(i);
        i = next;
        sections.push(() => (show as Record<string, (n: string[] | null) => void>)[letter](names));
      } else if ('apov'.includes(letter)) sections.push(() => (show as Record<string, (n: string[] | null) => void>)[letter](null));
      else if (letter === 'r') sections.push(show.r);
      else if (letter === 'd') sections.push(show.d);
      else if (letter === 'l') long = true;
      else if (letter === 'E') continue;
      else if (letter === 'c') continue;
      else if (letter === 's') sections.push(show.d, () => show.v(null));
      else if (letter === 't') sections.push(show.r, show.d, () => show.v(null), () => show.a(null), () => show.p(null), () => show.o(null));
      else return game.error(`lpstat: Unknown option "${letter}".\nUsage: lpstat [options]`, 1);
    }
  }
  // Without an option: the user's jobs.
  if (!sections.length) {
    users = [game.who];
    sections.push(() => show.o(null));
  }
  const needsScheduler = sections.length > 0 && !running(game);
  if (needsScheduler && !args.every((a) => a === '-r')) {
    if (args.includes('-r') || args.includes('-t')) out.push('scheduler is not running');
    if (out.length) game.error('lpstat: Scheduler is not running.', 1);
    else return game.error('lpstat: Scheduler is not running.', 1);
    return out.join('\n');
  }
  sections.forEach((s) => s());
  return out.join('\n');
}

// ——— lp, lpr ———

function print(game: Shell, cmd: 'lp' | 'lpr', args: string[], input: string | null): string {
  if (!hasCups(game) || !running(game)) return game.error(`${cmd}: Scheduler is not running.`, 1);
  const { flags, rest } = options(args, cmd === 'lp' ? 'dnthoqHPU' : 'PT#oHUJCw');
  let dest: string | null = null;
  let title: string | null = null;
  let copies = 1;
  let quiet = cmd === 'lpr';
  for (const [f, v] of flags) {
    if ((cmd === 'lp' && f === 'd') || (cmd === 'lpr' && f === 'P')) dest = v;
    else if ((cmd === 'lp' && f === 't') || (cmd === 'lpr' && (f === 'T' || f === 'J' || f === 'C'))) title = v;
    else if ((cmd === 'lp' && f === 'n') || (cmd === 'lpr' && f === '#')) copies = Math.max(1, Number(v) || 1);
    else if (cmd === 'lp' && f === 's') quiet = true;
    else if (['o', 'h', 'q', 'H', 'P', 'U', 'E', 'm', 'r', 'l', 'p', 'w'].includes(f)) continue;
    else return game.error(`${cmd}: Unknown option "${f}".`, 1);
  }
  dest ??= defaultDest(game);
  if (!dest) return game.error(`${cmd}: Error - no default destination available.`, 1);
  const st = cups(game);
  if (!st.printers[dest]) return game.error(cmd === 'lp' ? `lp: The printer or class does not exist.` : `lpr: Error - The printer or class does not exist.`, 1);
  const docs: { name: string; bytes: number }[] = [];
  for (const file of rest) {
    const text = game.read(file);
    const n = game.find(file);
    if (n?.type !== 'file' || text === null) return game.error(`${cmd}: Error - unable to access "${file}" - No such file or directory`, 1);
    docs.push({ name: file.split('/').pop()!, bytes: n.size ?? text.length });
  }
  if (!rest.length) docs.push({ name: '(stdin)', bytes: (input ?? '').length });
  const bytes = docs.reduce((t, d) => t + d.bytes, 0);
  const r = submit(game, { from: '127.0.0.1', user: game.who, printer: dest, title: title ?? docs[0].name, pages: Math.max(1, Math.ceil(bytes / 3000)) * copies, size: bytes });
  if ('status' in r) return game.error(cmd === 'lp' ? `lp: ${r.message}` : `lpr: Error - ${r.message}`, 1);
  return quiet ? '' : `request id is ${dest}-${r.job.id} (${docs.length} file(s))`;
}

// ——— lpq ———

const ORDINAL = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

function lpq(game: Shell, args: string[]): string {
  if (!hasCups(game) || !running(game)) return game.error('lpq: Scheduler is not running.', 1);
  const { flags, rest } = options(args, 'PUh');
  let dest: string | null = null;
  let all = false;
  for (const [f, v] of flags) {
    if (f === 'P') dest = v;
    else if (f === 'a') all = true;
    else if (['l', 'E', 'U', 'h'].includes(f)) continue;
    else return game.error(`lpq: Unknown option "${f}".`, 1);
  }
  const st = cups(game);
  dest ??= all ? null : defaultDest(game);
  if (!all && !dest) return game.error('lpq: Error - no default destination available.', 1);
  if (dest && !st.printers[dest]) return game.error(`lpq: Unknown destination "${dest}".`, 1);
  const out: string[] = [];
  const names = all ? Object.keys(st.printers) : [dest!];
  if (!all) {
    const p = st.printers[dest!];
    out.push(p.state === 'stopped' ? `${p.name} is not ready` : p.state === 'processing' ? `${p.name} is ready and printing` : `${p.name} is ready`);
  }
  const jobs = active(st).filter((j) => names.includes(j.printer) && (!rest.length || rest.includes(String(j.id)) || rest.includes(j.user)));
  if (!jobs.length) {
    out.push('no entries');
    return out.join('\n');
  }
  out.push('Rank    Owner   Job     File(s)                         Total Size');
  let rank = 0;
  for (const j of jobs) {
    const r = j.state === 'processing' ? 'active' : ORDINAL(++rank);
    const owner = sees(game, game.who, j, 'job-originating-user-name') ? j.user : 'unknown';
    const title = sees(game, game.who, j, 'job-name') ? j.title : 'unknown';
    out.push(`${r.padEnd(7)} ${owner.slice(0, 7).padEnd(7)} ${String(j.id).padEnd(7)} ${title.slice(0, 31).padEnd(31)} ${kSize(j.size)} bytes`);
  }
  return out.join('\n');
}

// ——— cancel, lprm ———

function cancelJob(game: Shell, cmd: string, j: Job, purge: boolean): string | null {
  if (!mayCancel(game, game.who, j)) return `${cmd === 'cancel' ? 'cancel: cancel-job failed: ' : 'lprm: '}Forbidden`;
  if (FINISHED.includes(j.state)) {
    if (purge) {
      j.noFile = true;
      syncSpool(game);
      return null;
    }
    return `${cmd === 'cancel' ? 'cancel: cancel-job failed: ' : 'lprm: '}Job #${j.id} is already ${j.state} - can't cancel.`;
  }
  log(game, 'info', `Canceled by "${game.who}".`, j.id);
  finish(game, j, 'canceled', purge);
  return null;
}

function cancel(game: Shell, args: string[]): string {
  if (!hasCups(game)) return game.error('cancel: Scheduler is not running.', 1);
  const stop = down(game, 'cancel');
  if (stop !== null) return stop;
  const { flags, rest } = options(args, 'uhU');
  let all = false;
  let purge = false;
  let user: string | null = null;
  for (const [f, v] of flags) {
    if (f === 'a') all = true;
    else if (f === 'x') purge = true;
    else if (f === 'u') user = v;
    else if (['E', 'h', 'U'].includes(f)) continue;
    else return game.error(`cancel: Unknown option "${f}".`, 1);
  }
  const st = cups(game);
  const errors: string[] = [];
  const targets: Job[] = [];
  if (all || user) {
    const dests = rest.length ? rest : null;
    for (const d of dests ?? []) if (!st.printers[d]) return game.error(`cancel: Unknown destination "${d}".`, 1);
    // Cancel-Jobs (an administrator: everyone's) or Cancel-My-Jobs (one's own).
    const mine = !isAdmin(game, game.who);
    targets.push(...st.jobs.filter((j) => (!dests || dests.includes(j.printer)) && (!user || j.user === user) && (!mine || j.user === game.who) && (purge || !FINISHED.includes(j.state))));
  } else {
    const names = rest.length ? rest : [defaultDest(game) ?? ''];
    for (const n of names) {
      if (st.printers[n]) {
        const current = active(st, n)[0];
        if (current) targets.push(current);
        continue;
      }
      const j = jobFor(game, n);
      if (!j) {
        errors.push(/^(?:.+-)?\d+$/.test(n) ? `cancel: cancel-job failed: Job #${n.replace(/^.+-/, '')} does not exist.` : `cancel: Unknown destination "${n}".`);
        continue;
      }
      targets.push(j);
    }
  }
  for (const j of targets) {
    const e = cancelJob(game, 'cancel', j, purge);
    if (e) errors.push(e);
  }
  if (targets.length) writePrinters(game);
  if (errors.length) game.error(errors.join('\n'), 1);
  return '';
}

function lprm(game: Shell, args: string[]): string {
  if (!hasCups(game)) return game.error('lprm: Scheduler is not running.', 1);
  const stop = down(game, 'lprm');
  if (stop !== null) return stop;
  const { flags, rest } = options(args, 'PUh');
  let dest: string | null = null;
  for (const [f, v] of flags) {
    if (f === 'P') dest = v;
    else if (['E', 'U', 'h'].includes(f)) continue;
    else return game.error(`lprm: Unknown option "${f}".`, 1);
  }
  const st = cups(game);
  dest ??= defaultDest(game);
  if (dest && !st.printers[dest]) return game.error(`lprm: The printer or class does not exist.`, 1);
  const errors: string[] = [];
  if (rest.includes('-')) {
    const admin = isAdmin(game, game.who);
    for (const j of active(st, dest ?? undefined).filter((x) => admin || x.user === game.who)) cancelJob(game, 'lprm', j, false);
  } else if (!rest.length) {
    const j = active(st, dest ?? undefined)[0];
    if (j) {
      const e = cancelJob(game, 'lprm', j, false);
      if (e) errors.push(e);
    }
  } else
    for (const n of rest) {
      const j = st.jobs.find((x) => x.id === Number(n));
      if (!j) {
        errors.push(`lprm: Job #${n} does not exist.`);
        continue;
      }
      const e = cancelJob(game, 'lprm', j, false);
      if (e) errors.push(e);
    }
  writePrinters(game);
  if (errors.length) game.error(errors.join('\n'), 1);
  return '';
}

// ——— cupsenable, cupsdisable, cupsaccept, cupsreject ———

function queueState(game: Shell, cmd: 'cupsenable' | 'cupsdisable' | 'cupsaccept' | 'cupsreject', args: string[]): string {
  if (!hasCups(game) || !running(game)) return game.error(`${cmd}: Operation failed: Scheduler is not running.`, 1);
  const { flags, rest } = options(args, 'rhU');
  let reason: string | null = null;
  let purge = false;
  for (const [f, v] of flags) {
    if (f === 'r') reason = v;
    else if (f === 'c') purge = true;
    else if (['E', 'h', 'U', '--hold', '--release'].includes(f)) continue;
    else return game.error(`${cmd}: Unknown option "${f}".\nUsage: ${cmd} [options] [destination(s)]`, 1);
  }
  if (!rest.length) return game.error(`Usage: ${cmd} [options] [destination(s)]`, 1);
  const st = cups(game);
  if (!isAdmin(game, game.who)) return game.error(`${cmd}: Operation failed: client-error-forbidden`, 1);
  for (const n of rest) {
    const p = st.printers[n];
    if (!p) return game.error(`${cmd}: Operation failed: client-error-not-found`, 1);
    const t = now(game);
    if (cmd === 'cupsenable') {
      p.state = 'idle';
      p.message = '';
      p.stateTime = t;
    } else if (cmd === 'cupsdisable') {
      p.state = 'stopped';
      p.message = reason ?? 'Paused';
      p.stateTime = t;
    } else if (cmd === 'cupsaccept') {
      p.accepting = true;
      p.rejectReason = undefined;
      p.acceptTime = t;
    } else {
      p.accepting = false;
      p.rejectReason = reason ?? 'Rejecting Jobs';
      p.acceptTime = t;
    }
    if (purge) for (const j of active(st, n)) finish(game, j, 'canceled', true);
  }
  writePrinters(game);
  return '';
}

// ——— lpadmin ———

const BAD_NAME = /[\s/\\'"?#]/;

function lpadmin(game: Shell, args: string[]): string {
  if (!hasCups(game) || !running(game)) return game.error('lpadmin: Unable to connect to server: Connection refused', 1);
  const st = cups(game);
  const usage = 'Usage:\n    lpadmin [options] -d destination\n    lpadmin [options] -p destination\n    lpadmin [options] -p destination -c class\n    lpadmin [options] -p destination -r class\n    lpadmin [options] -x destination';
  if (!args.length) return game.error(usage, 1);
  let name: string | null = null;
  let remove: string | null = null;
  let setDefault: string | null = null;
  let enable = false;
  let uri: string | null = null;
  let model: string | null = null;
  let ppdFile: string | null = null;
  let info: string | null = null;
  let location: string | null = null;
  const opts: [string, string][] = [];
  const users: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = (glued: string) => (a.length > 2 ? a.slice(2) : (args[++i] ?? glued));
    if (!a.startsWith('-')) return game.error(usage, 1);
    const letter = a[1];
    switch (letter) {
      case 'p': name = value(''); break;
      case 'x': remove = value(''); break;
      case 'd': setDefault = value(''); break;
      // Before -p, -E asks for encryption; after it, it enables the queue.
      case 'E': if (name) enable = true; break;
      case 'v': uri = value(''); break;
      case 'm': model = value(''); break;
      case 'P': ppdFile = value(''); break;
      case 'D': info = value(''); break;
      case 'L': location = value(''); break;
      case 'o': {
        const [k, v] = value('').split(/=(.*)/s);
        opts.push([k, v ?? '']);
        break;
      }
      case 'u': users.push(value('')); break;
      case 'U': case 'h': value(''); break;
      case 'c': case 'r': return game.error(game.t('cups-classes-not-simulated'), 1);
      default: return game.error(`lpadmin: Unknown option "${letter}".\n${usage}`, 1);
    }
  }
  if (!isAdmin(game, game.who)) return game.error('lpadmin: Forbidden', 1);
  const target = name ?? remove ?? setDefault;
  if (target !== null && (!target || BAD_NAME.test(target) || target.length > 127)) return game.error('lpadmin: Printer name can only contain printable characters.', 1);
  if (remove) {
    if (!st.printers[remove]) return game.error('lpadmin: The printer or class does not exist.', 1);
    for (const j of active(st, remove)) finish(game, j, 'canceled', true);
    delete st.printers[remove];
    if (st.default === remove) st.default = null;
    game.erase(`/etc/cups/ppd/${remove}.ppd`);
    log(game, 'info', `Printer "${remove}" deleted by "${game.who}".`);
    writePrinters(game);
    return '';
  }
  if (setDefault && !name) {
    if (!st.printers[setDefault]) return game.error('lpadmin: The printer or class does not exist.', 1);
    st.default = setDefault;
    writePrinters(game);
    return '';
  }
  if (!name) return game.error(usage, 1);
  const existing = st.printers[name];
  const p: Printer = existing ? { ...existing } : { ...newPrinter(st, name, 'file:///dev/null', 'raw', 'Local Raw Printer'), stateTime: now(game), acceptTime: now(game) };
  if (uri !== null) p.uri = uri;
  const warnings: string[] = [];
  let ppd: string | null = null;
  if (model !== null) {
    if (model === 'everywhere') {
      const scheme = uriScheme(p.uri);
      const device = deviceFor(st, p.uri);
      if (!['ipp', 'ipps', 'dnssd', 'http', 'https'].includes(scheme)) return game.error('lpadmin: IPP Everywhere driver requires an IPP connection.', 1);
      if (!device || !device.online) return game.error(`lpadmin: Unable to connect to "${uriHost(p.uri)}:631": No route to host`, 1);
      if (!device.ipp) return game.error('lpadmin: Printer does not support required IPP attributes or document formats.', 1);
      p.driver = 'everywhere';
      p.makeModel = `${device.makeModel} - IPP Everywhere`;
    } else if (model === 'raw') {
      warnings.push('lpadmin: Raw queues are deprecated and will stop working in a future version of CUPS.');
      p.driver = 'raw';
      p.makeModel = 'Local Raw Printer';
    } else {
      const m = models(game).find((x) => x.name === model);
      // scheduler/ipp.c (copy_model) of cups 2.4.10: cups-driverd finds no such model.
      if (!m) {
        log(game, 'error', 'copy_model: empty PPD file');
        return game.error('lpadmin: cups-driverd failed to get PPD file - see error_log for details.', 1);
      }
      warnings.push('lpadmin: Printer drivers are deprecated and will stop working in a future version of CUPS.');
      p.driver = m.name;
      p.makeModel = m.makeModel;
    }
    if (p.driver !== 'raw') ppd = ppdText(p);
  }
  if (ppdFile !== null) {
    const text = game.read(ppdFile);
    if (text === null) return game.error(`lpadmin: Unable to open PPD file "${ppdFile}" - No such file or directory`, 1);
    const nick = /^\*NickName:\s*"([^"]*)"/m.exec(text);
    if (!text.startsWith('*PPD-Adobe') || !nick) return game.error(`lpadmin: Unable to open PPD file "${ppdFile}" - Missing PPD-Adobe-4.x header`, 1);
    warnings.push('lpadmin: Printer drivers are deprecated and will stop working in a future version of CUPS.');
    p.driver = `file:${ppdFile}`;
    p.makeModel = nick[1];
    ppd = text;
  }
  if (info !== null) p.info = info;
  if (location !== null) p.location = location;
  for (const [k, v] of opts) {
    if (k === 'printer-is-shared') p.shared = /^(true|yes|on|1)$/i.test(v);
    else if (k === 'printer-error-policy') p.errorPolicy = v;
  }
  for (const u of users) {
    const m = /^(allow|deny):(.*)$/i.exec(u);
    if (!m) return game.error(`lpadmin: Unknown allow/deny option "${u}".`, 1);
    const list = m[2].split(',').map((x) => x.trim()).filter(Boolean);
    const none = list.length === 1 && ['all', 'none'].includes(list[0].toLowerCase());
    if (m[1].toLowerCase() === 'allow') {
      p.allow = none ? undefined : list;
      p.deny = undefined;
    } else {
      p.deny = none ? undefined : list;
      p.allow = undefined;
    }
  }
  if (enable) {
    p.state = p.state === 'stopped' ? 'idle' : p.state;
    p.message = '';
    p.accepting = true;
    p.stateTime = now(game);
    p.acceptTime = now(game);
  }
  if (!existing) st.nextPrinter++;
  st.printers[name] = p;
  if (ppd !== null) {
    const dir = game.find('/etc/cups/ppd');
    if (dir?.type === 'directory') dir.children[`${name}.ppd`] = { type: 'file', content: ppd, lines: true, owner: 'root', group: 'lp', mode: 'rw-r-----' };
  } else if (model === 'raw') game.erase(`/etc/cups/ppd/${name}.ppd`);
  if (setDefault) {
    if (!st.printers[setDefault]) return game.error('lpadmin: The printer or class does not exist.', 1);
    st.default = setDefault;
  }
  log(game, 'info', `Printer "${name}" ${existing ? 'modified' : 'added'} by "${game.who}".`);
  writePrinters(game);
  if (warnings.length) game.error(warnings.join('\n'));
  return '';
}

// ——— lpoptions ———

function lpoptions(game: Shell, args: string[]): string {
  if (!hasCups(game) || !running(game)) return game.error('lpoptions: Scheduler is not running.', 1);
  const st = cups(game);
  const { flags } = options(args, 'dpoxrhUE');
  let dest = defaultDest(game);
  let list = false;
  const file = game.who === 'root' ? '/etc/cups/lpoptions' : `${game.home}/.cups/lpoptions`;
  const write = (line: string | null) => {
    const old = (game.read(file) ?? '').split('\n').filter((l) => l && !/^Default\s/.test(l));
    const text = [...(line ? [line] : []), ...old].join('\n');
    if (game.who !== 'root' && !game.find(`${game.home}/.cups`)) game.place('lpoptions', `${game.home}/.cups`, { type: 'directory', children: {}, owner: game.who, mode: 'rwx------' });
    const parent = game.find(file.replace(/\/[^/]+$/, ''));
    if (parent?.type === 'directory') parent.children.lpoptions = { type: 'file', content: text, lines: true, owner: game.who, mode: 'rw-r--r--' };
  };
  let changed = false;
  for (const [f, v] of flags) {
    if (f === 'd' || f === 'p') {
      if (!v || !st.printers[v.split('/')[0]]) return game.error('lpoptions: Unknown printer or class.', 1);
      dest = v;
      if (f === 'd') {
        write(`Default ${v}`);
        changed = true;
      }
    } else if (f === 'l') list = true;
    else if (f === 'x') {
      write(null);
      changed = true;
    } else if (['o', 'r', 'h', 'U', 'E'].includes(f)) changed = changed || f === 'o' || f === 'r';
    else return game.error(`lpoptions: Unknown option "${f}".`, 1);
  }
  if (!dest) return game.error('lpoptions: No printers.', 1);
  const p = st.printers[dest.split('/')[0]];
  if (!p) return game.error('lpoptions: Unknown printer or class.', 1);
  if (list) return p.driver === 'raw' ? '' : 'PageSize/Media Size: *A4 Letter Legal A5\nDuplex/2-Sided Printing: *None DuplexNoTumble DuplexTumble';
  if (changed) return '';
  return [
    'copies=1',
    `device-uri=${p.uri}`,
    'finishings=3',
    'job-cancel-after=10800',
    'job-hold-until=no-hold',
    'job-priority=50',
    'job-sheets=none,none',
    'marker-change-time=0',
    'number-up=1',
    `printer-info='${p.info}'`,
    `printer-is-accepting-jobs=${p.accepting}`,
    `printer-is-shared=${p.shared}`,
    'printer-is-temporary=false',
    `printer-location='${p.location}'`,
    `printer-make-and-model='${p.makeModel}'`,
    `printer-state=${p.state === 'stopped' ? 5 : p.state === 'processing' ? 4 : 3}`,
    `printer-state-change-time=${Math.floor(p.stateTime / 1000)}`,
    `printer-state-reasons=${p.state === 'stopped' ? 'paused' : 'none'}`,
    `printer-type=${8392780 + (p.shared ? 0 : 8)}`,
    `printer-uri-supported=ipp://localhost/printers/${p.name}`,
  ].join(' ');
}

// ——— lpinfo ———

function lpinfo(game: Shell, args: string[]): string {
  if (!hasCups(game) || !running(game)) return game.error('lpinfo: Scheduler is not running.', 1);
  const { flags } = options(args, 'hU');
  let devices = false;
  let mods = false;
  let long = false;
  let filter: string | null = null;
  for (const [f, v] of flags) {
    if (f === 'v') devices = true;
    else if (f === 'm') mods = true;
    else if (f === 'l') long = true;
    else if (f === '--make-and-model') {
      filter = v;
      mods = true;
    } else if (['--include-schemes', '--exclude-schemes', '--device-id', '--language', '--product', '--timeout', 'E', 'h', 'U'].includes(f)) continue;
    else return game.error(`lpinfo: Unknown option "${f}".`, 1);
  }
  if (!devices && !mods) return game.error('Usage: lpinfo -m [options]\n       lpinfo -v [options]', 1);
  const st = cups(game);
  if (devices) {
    if (!isAdmin(game, game.who)) return game.error('lpinfo: Forbidden', 1);
    const found = st.devices
      .filter((d) => d.online)
      .flatMap((d) => (d.ipp && d.dnssd ? [[`dnssd://${encodeURIComponent(d.dnssd)}._ipp._tcp.local/?uuid=${uuidOf(d.dnssd)}`, d]] : [[`socket://${d.address}`, d]]) as [string, typeof d][]);
    const backends = ['network lpd', 'network beh', 'network ipps', 'network ipp', 'network https', 'network http', 'network socket', 'file cups-brf:/', 'direct hp', 'serial serial:/dev/ttyS0?baud=115200'];
    if (!long) return [...backends, ...found.map(([u]) => `network ${u}`)].join('\n');
    return found.map(([u, d]) => `Device: uri = ${u}\n        class = network\n        info = ${d.makeModel}\n        make-and-model = ${d.makeModel}\n        device-id = MFG:${d.makeModel.split(' ')[0]};MDL:${d.makeModel.split(' ').slice(1).join(' ')};\n        location = `).join('\n');
  }
  const all = [{ name: 'everywhere', makeModel: 'IPP Everywhere' }, ...models(game)].filter((m) => !filter || m.makeModel.toLowerCase().includes(filter.toLowerCase()));
  if (!all.length) return game.error('lpinfo: No drivers found.', 1);
  return long ? all.map((m) => `Model:  name = ${m.name}\n        natural_language = en\n        make-and-model = ${m.makeModel}\n        device-id = `).join('\n') : all.map((m) => `${m.name} ${m.makeModel}`).join('\n');
}

const uuidOf = (seed: string) => {
  let h = 0x811c9dc5;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  const x = (k: number) => (((Math.imul(h, k) >>> 0) ^ (h >>> k)) >>> 0).toString(16).padStart(8, '0');
  return `${x(3)}-${x(5).slice(0, 4)}-${x(7).slice(0, 4)}-${x(9).slice(0, 4)}-${x(11)}${x(13).slice(0, 4)}`;
};

// ——— cupsctl ———

/** The settings cupsctl shows, read from cupsd.conf's text. */
export function cupsctlSettings(text: string): Record<string, string> {
  const c = testConfText(text);
  const root = c.locations.find((l) => l.path === '/');
  const admin = c.locations.find((l) => l.path === '/admin');
  const remote = (l: typeof root) => !!l && l.allow.some((v) => !['localhost', '127.0.0.1', 'none'].includes(v.toLowerCase()));
  const any = (l: typeof root) => !!l && l.allow.some((v) => ['all', '*'].includes(v.toLowerCase()));
  const cancelLimit = c.policies.default?.limits.find((l) => l.ops.includes('Cancel-Job'));
  return {
    _debug_logging: /^debug/i.test(directive(c, 'LogLevel')) ? '1' : '0',
    _remote_admin: remote(admin) ? '1' : '0',
    _remote_any: any(root) ? '1' : '0',
    _share_printers: remote(root) && c.listen.some((l) => !/localhost|127\.0\.0\.1|^\//.test(l)) ? '1' : '0',
    _user_cancel_any: cancelLimit && !cancelLimit.require ? '1' : '0',
    BrowseLocalProtocols: directive(c, 'BrowseLocalProtocols') || 'dnssd',
    DefaultAuthType: directive(c, 'DefaultAuthType') || 'Basic',
    ErrorPolicy: directive(c, 'ErrorPolicy'),
    IdleExitTimeout: directive(c, 'IdleExitTimeout') || '60',
    JobPrivateAccess: c.policies.default?.values.jobprivateaccess ?? 'default',
    JobPrivateValues: c.policies.default?.values.jobprivatevalues ?? 'default',
    MaxLogSize: directive(c, 'MaxLogSize'),
    PageLogFormat: directive(c, 'PageLogFormat'),
    PreserveJobFiles: directive(c, 'PreserveJobFiles'),
    PreserveJobHistory: directive(c, 'PreserveJobHistory'),
    WebInterface: directive(c, 'WebInterface'),
  };
}
const testConfText = (text: string) => parseConf(text);

const dropAllow = (body: string[], values: string[]) => body.filter((l) => !new RegExp(`^\\s*Allow\\s+(from\\s+)?(${values.join('|')})\\s*$`, 'i').test(l));
const addAllow = (body: string[], value: string) => {
  const at = body.findIndex((l) => /^\s*Order\b/i.test(l));
  const out = [...body];
  out.splice(at < 0 ? out.length : at + 1, 0, `  Allow ${value}`);
  return out;
};

function cupsctl(game: Shell, args: string[]): string {
  if (!hasCups(game) || !running(game)) return game.error('cupsctl: Unable to connect to server: Connection refused', 1);
  let text = game.read(CUPSD_CONF);
  if (text === null) return game.error('cupsctl: Unable to get server settings: Forbidden', 1);
  const settings = cupsctlSettings(text);
  const changes = args.filter((a) => !['-E', '-h', '-U'].includes(a));
  if (!changes.length) return Object.entries(settings).map(([k, v]) => `${k}=${v}`).join('\n');
  if (!isAdmin(game, game.who)) return game.error('cupsctl: Unable to change server settings: Forbidden', 1);
  const any = (t: string) => cupsctlSettings(t)._remote_any === '1';
  const listenRemote = (t: string, on: boolean) => {
    if (on) return setDirective(t.replace(/^\s*Listen\s+(localhost|127\.0\.0\.1):631\s*$/gim, '').replace(/\n{3,}/g, '\n\n'), 'Port', '631');
    const s = cupsctlSettings(t);
    return s._share_printers === '1' || s._remote_admin === '1' ? t : setDirective(setDirective(t, 'Port', null), 'Listen localhost:631', '');
  };
  for (const a of changes) {
    const m = /^--(no-)?(share-printers|remote-admin|remote-any|user-cancel-any|debug-logging)$/.exec(a);
    const kv = /^([A-Za-z_]+)=(.*)$/.exec(a);
    if (m) {
      const on = !m[1];
      if (m[2] === 'debug-logging') text = setDirective(text, 'LogLevel', on ? 'debug' : 'warn');
      else if (m[2] === 'user-cancel-any') text = editCancelLimit(text, on ? null : '@OWNER @SYSTEM');
      else if (m[2] === 'share-printers') {
        text = editLocation(text, '/', (b) => (on ? addAllow(dropAllow(b, ['@LOCAL', 'all']), any(text!) ? 'all' : '@LOCAL') : dropAllow(b, ['@LOCAL', 'all'])));
        text = listenRemote(text, on);
      } else if (m[2] === 'remote-admin') {
        for (const path of ['/admin', '/admin/conf', '/admin/log']) text = editLocation(text, path, (b) => (on ? addAllow(dropAllow(b, ['@LOCAL', 'all']), any(text!) ? 'all' : '@LOCAL') : dropAllow(b, ['@LOCAL', 'all'])));
        text = listenRemote(text, on);
      } else {
        // --remote-any: "all" where @LOCAL was, and the other way round.
        for (const path of ['/', '/admin', '/admin/conf', '/admin/log'])
          text = editLocation(text, path, (b) => b.map((l) => (on ? l.replace(/^(\s*Allow\s+(?:from\s+)?)@LOCAL\s*$/i, '$1all') : l.replace(/^(\s*Allow\s+(?:from\s+)?)all\s*$/i, '$1@LOCAL'))));
      }
    } else if (kv) text = kv[1].startsWith('_') ? text : /^JobPrivate(Values|Access)$/i.test(kv[1]) ? editPolicyValue(text, kv[1], kv[2]) : setDirective(text, kv[1], kv[2]);
    else return game.error(`cupsctl: Unknown option "${a}"\nUsage: cupsctl [options] [param=value ... paramN=valueN]`, 1);
  }
  const n = game.find(CUPSD_CONF);
  if (n?.type === 'file') n.content = text;
  // cupsd restarts with the new configuration.
  const sd = systemd(game)!;
  stop(game, sd, 'cups');
  start(game, sd, 'cups');
  return '';
}

// ——— cupsd, driverless ———

function cupsd(game: Shell, args: string[]): string {
  if (args.includes('-h') || args.includes('--help'))
    return 'Usage: cupsd [options]\nOptions:\n  -c cupsd.conf           Set cupsd.conf file to use.\n  -f                      Run in the foreground.\n  -F                      Run in the foreground but detach from console.\n  -h                      Show this usage message.\n  -l                      Run cupsd on demand.\n  -s cups-files.conf      Set cups-files.conf file to use.\n  -t                      Test the configuration file.';
  if (!args.includes('-t')) return game.error(game.t('cups-cupsd-run'), 1);
  const n = game.find(CUPSD_CONF);
  if (!n || !game.can(n, 'r')) return game.error(`Unable to open "${CUPSD_CONF}": Permission denied`, 1);
  const c = testConf(game);
  for (const w of c.warnings) game.error(w);
  if (c.errors.length) return game.error(c.errors.join('\n'), 1);
  return `"${CUPSD_CONF}" is OK.`;
}

function driverless(game: Shell, args: string[]): string {
  if (!hasCups(game)) return game.error('driverless: command not found', 127);
  const st = cups(game);
  const ipp = st.devices.filter((d) => d.ipp && d.online);
  if (!args.length || args[0] === 'list' || args[0] === '--std-ipp-uris')
    return ipp.map((d) => (args[0] === '--std-ipp-uris' ? d.uri : `ipp://${encodeURIComponent(d.dnssd ?? d.names[0])}._ipp._tcp.local/`)).join('\n');
  if (args[0] === '--version') return 'driverless 2.0.1';
  const uri = args[0] === 'cat' ? args[1] : args[0];
  const d = uri ? deviceFor(st, uri) : null;
  if (!d || !d.ipp) return game.error(`ERROR: Unable to create PPD file: Could not poll sufficient capability info from the printer (${uri ?? ''}, ${uri ?? ''}) via IPP!`, 1);
  return ppdText({ makeModel: `${d.makeModel}, driverless, cups-filters 2.0.1` } as Printer);
}

// ——— The web interface (port 631) ———

/** What cupsd answers on its port to a GET from this machine (curl localhost:631/...). */
export function webAnswer(game: Shell, path: string): { code: number; body: string; headers?: string[] } {
  const st = cups(game);
  const page = (title: string, body: string) => `<!DOCTYPE HTML>\n<html>\n<head>\n<title>${title} - CUPS ${VERSION}</title>\n</head>\n<body>\n${body}\n</body>\n</html>`;
  const p = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (directive(st.conf, 'WebInterface').toLowerCase() !== 'yes' && p !== '/') return { code: 200, body: page('Web Interface is Disabled', '<p>The web interface is currently disabled. Run "cupsctl WebInterface=yes" to enable it.</p>') };
  if (p === '/') return { code: 200, body: page('Home', '<h1>CUPS 2.4.10</h1>\n<p>CUPS is the standards-based, open source printing system.</p>\n<ul><li><a href="/printers/">Printers</a></li><li><a href="/jobs/">Jobs</a></li><li><a href="/admin">Administration</a></li></ul>') };
  if (p === '/printers') return { code: 200, body: page('Printers', ['<table>', '<tr><th>Queue Name</th><th>Description</th><th>Location</th><th>Make and Model</th><th>Status</th></tr>', ...Object.values(st.printers).map((x) => `<tr><td><a href="/printers/${x.name}">${x.name}</a></td><td>${x.info}</td><td>${x.location}</td><td>${x.makeModel}</td><td>${x.state === 'stopped' ? 'Paused' : x.state === 'processing' ? 'Processing' : 'Idle'}${x.accepting ? '' : ', Rejecting Jobs'}</td></tr>`), '</table>'].join('\n')) };
  const one = /^\/printers\/(.+)$/.exec(p);
  if (one) {
    const x = st.printers[decodeURIComponent(one[1])];
    if (!x) return { code: 404, body: page('Not Found', '<h1>Not Found</h1>') };
    return { code: 200, body: page(x.name, `<h2>${x.name} (${x.state === 'stopped' ? 'Paused' : 'Idle'}, ${x.accepting ? 'Accepting Jobs' : 'Rejecting Jobs'}, ${x.shared ? 'Shared' : 'Not Shared'}${st.default === x.name ? ', Server Default' : ''})</h2>\n<p>Description: ${x.info}<br>Location: ${x.location}<br>Driver: ${x.makeModel}<br>Connection: ${x.uri}</p>`) };
  }
  if (p === '/jobs') return { code: 200, body: page('Jobs', ['<table>', '<tr><th>ID</th><th>Name</th><th>User</th><th>Size</th><th>Pages</th><th>State</th></tr>', ...active(st).map((j) => `<tr><td>${j.printer}-${j.id}</td><td>${sees(game, game.who, j, 'job-name') ? j.title : '&nbsp;'}</td><td>${j.user}</td><td>${Math.ceil(j.size / 1024)}k</td><td>${j.pages}</td><td>${j.state}</td></tr>`), '</table>'].join('\n')) };
  if (p === '/admin' || p.startsWith('/admin/')) return { code: 200, body: page('Administration', '<h2>Printers</h2>\n<p><a href="/admin?op=add-printer">Add Printer</a></p>\n<h2>Server</h2>\n<p><a href="/admin?op=config-server">Edit Configuration File</a></p>') };
  return { code: 404, body: page('Not Found', '<h1>Not Found</h1>') };
}

export const CUPS: Record<string, Command> = {
  lpstat: { ownOptions: true, launch: ({ args, game }) => lpstat(game, args) },
  lp: { ownOptions: true, launch: ({ args, game, input }) => print(game, 'lp', args, input) },
  lpr: { ownOptions: true, launch: ({ args, game, input }) => print(game, 'lpr', args, input) },
  lpq: { ownOptions: true, launch: ({ args, game }) => lpq(game, args) },
  cancel: { ownOptions: true, launch: ({ args, game }) => cancel(game, args) },
  lprm: { ownOptions: true, launch: ({ args, game }) => lprm(game, args) },
  cupsenable: { section: 8, ownOptions: true, launch: ({ args, game }) => queueState(game, 'cupsenable', args) },
  cupsdisable: { section: 8, ownOptions: true, launch: ({ args, game }) => queueState(game, 'cupsdisable', args) },
  cupsaccept: { section: 8, ownOptions: true, launch: ({ args, game }) => queueState(game, 'cupsaccept', args) },
  cupsreject: { section: 8, ownOptions: true, launch: ({ args, game }) => queueState(game, 'cupsreject', args) },
  lpadmin: { section: 8, ownOptions: true, launch: ({ args, game }) => lpadmin(game, args) },
  lpoptions: { ownOptions: true, launch: ({ args, game }) => lpoptions(game, args) },
  lpinfo: { section: 8, ownOptions: true, launch: ({ args, game }) => lpinfo(game, args) },
  cupsctl: { section: 8, ownOptions: true, launch: ({ args, game }) => cupsctl(game, args) },
  cupsd: { section: 8, ownOptions: true, launch: ({ args, game }) => cupsd(game, args) },
  driverless: { ownOptions: true, launch: ({ args, game }) => driverless(game, args) },
  // Manual pages only (configuration files).
  'cupsd.conf': { section: 5, launch: () => '' },
  'printers.conf': { section: 5, launch: () => '' },
};

