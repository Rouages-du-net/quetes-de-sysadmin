// System commands: processes (ps, kill, pkill) and sessions (who). Services (systemctl,
// journalctl) are in systemd.ts. Processes are simulated in the story's
// state:
//   state.process: list of { pid, user, cpu, mem, command }
//   state.onKill(game, process), state.onSystemctl(game, action, name):
//   the story's own reactions, which return an optional message.

import type { Command } from './index';
import type { Game } from '../shell';
import { dockerProcess } from '../docker';
import { refreshCpu } from '../cpu';

export interface Process {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
  // The parent, and a zombie process (finished, not reaped by its parent).
  ppid?: number;
  zombie?: boolean;
  // The nice value (-20 to 19, 0 by default; see cpu.ts), and a process
  // stopped by SIGSTOP (state T, until SIGCONT).
  nice?: number;
  stopped?: boolean;
  // Its open-files limit (see limits.ts); absent: systemd's default, 1024:524288.
  nofile?: import('../limits').Limit;
  // Signals it ignores or handles itself (a shell script's trap): TERM, HUP…
  ignores?: string[];
}

// The columns of ps -o (procps-ng's names; %cpu and pcpu are the same column).
interface PsField {
  header: string;
  width: number;
  left?: boolean;
  value: (p: Process) => string | number;
  sort?: (p: Process) => string | number;
}
const command = (p: Process) => (p.zombie ? `${p.command} <defunct>` : p.command);
const comm = (p: Process) => p.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '').slice(0, 15);
const cpuCol: PsField = { header: '%CPU', width: 4, value: (p) => p.cpu.toFixed(1), sort: (p) => p.cpu };
const memCol: PsField = { header: '%MEM', width: 4, value: (p) => p.mem.toFixed(1), sort: (p) => p.mem };
const niCol: PsField = { header: ' NI', width: 3, value: (p) => p.nice ?? 0, sort: (p) => p.nice ?? 0 };
const PS_FIELDS: Record<string, PsField> = {
  pid: { header: '    PID', width: 7, value: (p) => p.pid, sort: (p) => p.pid },
  ppid: { header: '   PPID', width: 7, value: (p) => p.ppid ?? (p.pid === 1 ? 0 : 1), sort: (p) => p.ppid ?? 1 },
  user: { header: 'USER    ', width: 8, left: true, value: (p) => p.user.slice(0, 8) },
  ni: niCol,
  nice: niCol,
  pri: { header: 'PRI', width: 3, value: (p) => 19 - (p.nice ?? 0), sort: (p) => 19 - (p.nice ?? 0) },
  '%cpu': cpuCol,
  pcpu: cpuCol,
  '%mem': memCol,
  pmem: memCol,
  stat: { header: 'STAT', width: 4, left: true, value: (p) => (p.zombie ? 'Z' : p.stopped ? 'T' : p.cpu > 0 ? 'R' : 'S') + ((p.nice ?? 0) > 0 ? 'N' : (p.nice ?? 0) < 0 ? '<' : '') },
  comm: { header: 'COMMAND', width: 15, left: true, value: comm },
  cmd: { header: 'CMD', width: 0, left: true, value: command },
  args: { header: 'COMMAND', width: 0, left: true, value: command },
  command: { header: 'COMMAND', width: 0, left: true, value: command },
};

// ——— Signals (signal(7)) ———
// Their numbers on x86-64 Linux; the default action of the common ones is to
// terminate the process. KILL and STOP can't be caught nor ignored; a
// process can ignore (or handle) the others: a shell script's trap, a daemon
// that rereads its configuration on HUP. Source: https://man7.org/linux/man-pages/man7/signal.7.html
const SIGNALS = ['HUP', 'INT', 'QUIT', 'ILL', 'TRAP', 'ABRT', 'BUS', 'FPE', 'KILL', 'USR1', 'SEGV', 'USR2', 'PIPE', 'ALRM', 'TERM', 'STKFLT', 'CHLD', 'CONT', 'STOP', 'TSTP', 'TTIN', 'TTOU', 'URG', 'XCPU', 'XFSZ', 'VTALRM', 'PROF', 'WINCH', 'POLL', 'PWR', 'SYS'];
const SIGNAL_LIST = SIGNALS.map((s, i) => `${String(i + 1).padStart(2)}) SIG${s}`).reduce((lines: string[], cell, i) => {
  if (i % 5 === 0) lines.push(cell);
  else lines[lines.length - 1] += `\t${cell}`;
  return lines;
}, []).join('\n');

/** "9", "KILL", "SIGKILL", "sigterm" → the signal's name (KILL); 0 checks the process exists; null if unknown. */
export function readSignal(text: string): string | null {
  if (/^\d+$/.test(text)) return text === '0' ? '0' : (SIGNALS[Number(text) - 1] ?? null);
  const n = text.toUpperCase().replace(/^SIG/, '');
  return SIGNALS.includes(n) ? n : null;
}

/**
 * A signal reaches a process: KILL always ends it; STOP and CONT stop and
 * resume it; another signal ends it unless it ignores or handles it
 * (Process.ignores), in which case the story may react (state.onSignal).
 */
export function sendSignal(game: Game, p: Process, signal: string): string | undefined {
  if (signal === '0') return;
  if (signal === 'STOP' || signal === 'TSTP') {
    p.stopped = true;
    return game.state.onSignal?.(game, p, signal);
  }
  if (signal === 'CONT') {
    p.stopped = false;
    return game.state.onSignal?.(game, p, signal);
  }
  if (['CHLD', 'URG', 'WINCH'].includes(signal)) return;
  if (signal !== 'KILL' && p.ignores?.includes(signal)) return game.state.onSignal?.(game, p, signal);
  game.state.process = ((game.state.process ?? []) as Process[]).filter((q) => q !== p);
  return game.state.onKill?.(game, p, signal);
}

export const SYSTEM: Record<string, Command> = {
  ps: {
    launch: ({ args, game }) => {
      refreshCpu(game);
      // -o FORMAT (and -eo FORMAT): the columns chosen; --sort=[-]KEY.
      const io = args.findIndex((a) => /^-\w*o$/.test(a) || a === '--format');
      const format = io >= 0 ? (args[io + 1] ?? '') : args.find((a) => a.startsWith('--format='))?.slice(9) ?? null;
      const sortArg = args.find((a) => a.startsWith('--sort='))?.slice(7) ?? (args.includes('--sort') ? args[args.indexOf('--sort') + 1] : null);
      args = args.filter((a, k) => !(io >= 0 && k === io + 1) && !a.startsWith('--sort') && !(args[k - 1] === '--sort') && !a.startsWith('--format'));
      const all = args.some((a) => /^-?\w*[ae]/.test(a) && !/^-\w*u$/.test(a));
      // -p PID[,PID]: only these processes.
      const ip = args.findIndex((a) => a === '-p' || a === '--pid');
      const onlyPids = ip >= 0 ? (args[ip + 1] ?? '').split(',') : null;
      if (ip >= 0) args = args.filter((_, k) => k !== ip && k !== ip + 1);
      // -u account[,account]: only the processes of these accounts.
      const iu = args.findIndex((a) => /^-\w*u$/.test(a));
      const accounts = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const listing: Process[] = [...(game.state.process ?? []), ...dockerProcess(game)]
        .filter((p: Process) => (onlyPids ? onlyPids.includes(String(p.pid)) : accounts ? accounts.includes(p.user) : all || p.user === game.who || p.user === game.player))
        .sort((a: Process, b: Process) => a.pid - b.pid);
      // ps -p with no such process: the header only, and exit code 1.
      if (onlyPids && !listing.length) game.status = 1;
      if (sortArg) {
        const desc = sortArg.startsWith('-');
        const k = sortArg.replace(/^[-+]/, '');
        const field = PS_FIELDS[k];
        if (!field) return game.error(`error: unknown sort specifier\n\nUsage:\n ps [options]\n\n Try 'ps --help <simple|list|output|threads|misc|all>'\n  or 'ps --help <s|l|o|t|m|a>'\n for additional help text.\n\nFor more details see ps(1).`);
        const key = field.sort ?? ((p: Process) => field.value(p));
        listing.sort((a, b) => {
          const [x, y] = [key(a), key(b)];
          const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
          return desc ? -r : r;
        });
      }
      if (format !== null) {
        const keys = format.split(/[,\s]+/).filter(Boolean).map((k) => k.split('=')[0]);
        const unknown = keys.find((k) => !PS_FIELDS[k]);
        if (unknown || !keys.length)
          return game.error(`error: unknown user-defined format specifier "${unknown ?? ''}"\n\nUsage:\n ps [options]\n\n Try 'ps --help <simple|list|output|threads|misc|all>'\n  or 'ps --help <s|l|o|t|m|a>'\n for additional help text.\n\nFor more details see ps(1).`);
        const cols = keys.map((k) => PS_FIELDS[k]);
        const cell = (f: PsField, v: string, lastCol: boolean) => (lastCol ? v : f.left ? v.padEnd(f.width) : v.padStart(f.width));
        return [
          cols.map((f, k) => cell(f, f.header, k === cols.length - 1)).join(' '),
          ...listing.map((p) => cols.map((f, k) => cell(f, String(f.value(p)), k === cols.length - 1)).join(' ')),
        ].join('\n');
      }
      // -f (ps -ef): the full format, with the parent (PPID).
      if (args.some((a) => /^-\w*f/.test(a))) {
        const fLine = (p: Process) =>
          `${p.user.slice(0, 8).padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.ppid ?? (p.pid === 1 ? 0 : 1)).padStart(7)}  0 04:00 ?        00:00:00 ${p.command}`;
        return ['UID          PID    PPID  C STIME TTY          TIME CMD', ...listing.map(fLine)].join('\n');
      }
      const line = (p: Process) =>
        `${p.user.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${p.command}`;
      return ['USER          PID  %CPU  %MEM COMMAND', ...listing.map(line)].join('\n');
    },
  },

  kill: {
    launch: ({ args, game }) => {
      // kill -l: the signals' names (bash's builtin).
      if (args[0] === '-l' || args[0] === '-L' || args[0] === '--list') return SIGNAL_LIST;
      let signal = 'TERM';
      let rest = [...args];
      if ((rest[0] === '-s' || rest[0] === '-n') && rest[1] !== undefined) {
        const s = readSignal(rest[1]);
        if (!s) return game.error(`bash: kill: ${rest[1]}: invalid signal specification`);
        signal = s;
        rest = rest.slice(2);
      } else if ((rest[0] ?? '').startsWith('-') && rest[0] !== '--' && rest.length > 1) {
        const s = readSignal(rest[0].slice(1));
        if (!s) return game.error(`bash: kill: ${rest[0].slice(1)}: invalid signal specification`);
        signal = s;
        rest = rest.slice(1);
      }
      const pids = rest.filter((a) => a !== '--');
      if (!pids.length) return game.error(game.t('kill-usage'));
      const messages: string[] = [];
      for (const raw of pids) {
        const listing: Process[] = game.state.process ?? [];
        const p = listing.find((q) => String(q.pid) === raw);
        if (!p) game.error(game.t('kill-none', { pid: raw }));
        else if (game.who !== 'root' && p.user !== game.who) game.error(game.t('kill-not-allowed', { pid: raw }));
        // A zombie is already dead: no signal does anything to it, only its parent can reap it.
        else if (p.zombie) continue;
        else {
          const m = sendSignal(game, p, signal);
          if (m) messages.push(m);
        }
      }
      return messages.join('\n');
    },
  },

  // pkill: stops the processes chosen by name (pattern in the program's name) or by account (-u).
  // Exit code 1 if no process matches (procps).
  pkill: {
    ownOptions: true,
    launch: ({ args, game }) => {
      // -SIGNAL, --signal SIGNAL: another signal than TERM.
      let signal = 'TERM';
      const is = args.findIndex((a) => a === '--signal');
      if (is >= 0) {
        const s = readSignal(args[is + 1] ?? '');
        if (!s) return game.error(`pkill: Unknown signal "${args[is + 1] ?? ''}".`, 2);
        signal = s;
        args = args.filter((_, k) => k !== is && k !== is + 1);
      }
      const named = args.find((a) => /^-[A-Z0-9]+$/.test(a) && a !== '-u');
      if (named) {
        const s = readSignal(named.slice(1));
        if (!s) return game.error(`pkill: Unknown signal "${named.slice(1)}".`, 2);
        signal = s;
        args = args.filter((a) => a !== named);
      }
      // -f: the pattern is searched for in the whole command line.
      const full = args.includes('-f') || args.includes('--full');
      const iu = args.indexOf('-u');
      const accounts = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const pattern = args.filter((a, k) => !a.startsWith('-') && (iu < 0 || k !== iu + 1))[0];
      if (!pattern && !accounts) return game.error(game.t('pkill-usage'), 2);
      let re: RegExp | null = null;
      try {
        re = pattern ? new RegExp(pattern) : null;
      } catch {
        return game.error(`pkill: invalid regular expression: ${pattern}`, 2);
      }
      const listing: Process[] = game.state.process ?? [];
      // The program's name: the first word of the command, without its path (like /proc/pid/comm).
      const name = (p: Process) => p.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '');
      const chosen = listing.filter((p) => (!accounts || accounts.includes(p.user)) && (!re || re.test(full ? p.command : name(p))) && !p.zombie);
      if (!chosen.length) {
        game.status = 1;
        return '';
      }
      const messages: string[] = [];
      for (const p of chosen) {
        if (game.who !== 'root' && p.user !== game.who) {
          game.error(`pkill: killing pid ${p.pid} failed: Operation not permitted`);
          continue;
        }
        const m = sendSignal(game, p, signal);
        if (m) messages.push(m);
      }
      return messages.join('\n');
    },
  },

  // who: the open sessions (a session lives as long as its sshd process runs).
  who: {
    launch: ({ game }) => {
      const sessions: { user: string; tty: string; since: string; forEachOf: string; pid?: number }[] = game.state.sessions ?? [];
      const live = ((game.state.process ?? []) as Process[]).map((p) => p.pid);
      return sessions
        .filter((x) => x.pid === undefined || live.includes(x.pid))
        .map((x) => `${x.user.padEnd(8)} ${x.tty.padEnd(12)} ${x.since} (${x.forEachOf})`)
        .join('\n');
    },
  },
};
