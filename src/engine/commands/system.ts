// System commands: processes (ps, kill, pkill) and sessions (who). Services (systemctl,
// journalctl) are in systemd.ts. Processes are simulated in the story's
// state:
//   state.process: list of { pid, user, cpu, mem, command }
//   state.onKill(game, process), state.onSystemctl(game, action, name):
//   the story's own reactions, which return an optional message.

import type { Command } from './index';
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
      // -u account[,account]: only the processes of these accounts.
      const iu = args.findIndex((a) => /^-\w*u$/.test(a));
      const accounts = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const listing: Process[] = [...(game.state.process ?? []), ...dockerProcess(game)]
        .filter((p: Process) => (accounts ? accounts.includes(p.user) : all || p.user === game.who || p.user === game.player))
        .sort((a: Process, b: Process) => a.pid - b.pid);
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
      const pids = args.filter((a) => !a.startsWith('-'));
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
          game.state.process = listing.filter((q) => q !== p);
          const m = game.state.onKill?.(game, p);
          if (m) messages.push(m);
        }
      }
      return messages.join('\n');
    },
  },

  // pkill: stops the processes chosen by name (pattern in the program's name) or by account (-u).
  // Exit code 1 if no process matches (procps).
  pkill: {
    launch: ({ args, game }) => {
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
      const chosen = listing.filter((p) => (!accounts || accounts.includes(p.user)) && (!re || re.test(name(p))) && !p.zombie);
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
        game.state.process = (game.state.process as Process[]).filter((q) => q !== p);
        const m = game.state.onKill?.(game, p);
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
