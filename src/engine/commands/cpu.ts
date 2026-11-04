// The processor: uptime and its load average, nproc, nice, renice, pgrep
// and systemd-cgtop, on the model of ../cpu.ts. Outputs and messages based
// on procps-ng (uptime(1), pgrep(1)), util-linux (renice(1)), coreutils
// (nproc(1), nice(1)) and systemd (systemd-cgtop(1)):
// https://man7.org/linux/man-pages/man1/uptime.1.html,
// https://man7.org/linux/man-pages/man1/renice.1.html,
// https://man7.org/linux/man-pages/man1/nice.1.html,
// https://man7.org/linux/man-pages/man1/pgrep.1.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd-cgtop.html
// Differences: nice runs its command at once (the game's commands are
// instant, so the niceness changes nothing); systemd-cgtop shows one snapshot (like
// --iterations=1) and only the services; renice -g is not simulated.

import type { Shell } from '../shell';
import type { Process } from './system';
import type { Command } from './index';
import { cpu, loadText, refreshCpu, serviceOf, shares } from '../cpu';
import { systemd } from '../systemd';

const processes = (game: Shell): Process[] => game.state.process ?? [];

// The machine's boot: the first line of this boot's journal (as top does).
const bootTime = (game: Shell) => {
  const sd = systemd(game)!;
  return sd.log.find((e) => e.boot === sd.boot)?.time ?? sd.clock;
};
const timeOfDay = (ms: number) => new Date(ms).toISOString().slice(11, 19);

function uptime(game: Shell, args: string[]): string {
  const sd = systemd(game)!;
  refreshCpu(game);
  const up = sd.clock - bootTime(game);
  const days = Math.floor(up / 86_400_000);
  const h = Math.floor((up % 86_400_000) / 3_600_000);
  const min = Math.floor((up % 3_600_000) / 60_000);
  // -s: since when (the boot's date and time).
  if (args.some((a) => a === '-s' || a === '--since')) return new Date(bootTime(game)).toISOString().slice(0, 19).replace('T', ' ');
  // -p: in words ("up 3 days, 2 hours, 11 minutes").
  if (args.some((a) => a === '-p' || a === '--pretty')) {
    const parts = [
      days && `${days} ${days > 1 ? 'days' : 'day'}`,
      h && `${h} ${h > 1 ? 'hours' : 'hour'}`,
      `${min} ${min === 1 ? 'minute' : 'minutes'}`,
    ].filter(Boolean);
    return `up ${parts.join(', ')}`;
  }
  const users = new Set(((game.state.sessions ?? []) as { user: string }[]).map((s) => s.user)).size || 1;
  const since = `${days ? `${days} ${days > 1 ? 'days' : 'day'}, ` : ''}${String(h).padStart(2)}:${String(min).padStart(2, '0')}`;
  return ` ${timeOfDay(sd.clock)} up ${since},  ${users} ${users > 1 ? 'users' : 'user'},  load average: ${loadText(game)}`;
}

// renice: "renice [-n] PRIORITY [-p|-g|-u] ID…" (util-linux 2.41).
function renice(game: Shell, args: string[]): string {
  const rest = [...args];
  if (rest[0] === '-n' || rest[0] === '--priority') rest.shift();
  const raw = rest.shift();
  if (raw === undefined || !/^[+-]?\d+$/.test(raw)) return game.error(`renice: invalid priority '${raw ?? ''}'\nTry 'renice --help' for more information.`);
  const wanted = Math.max(-20, Math.min(19, Number(raw)));
  let kind: 'p' | 'u' | 'g' = 'p';
  const targets: { kind: 'p' | 'u' | 'g'; id: string }[] = [];
  for (const a of rest) {
    if (a === '-p' || a === '--pid') kind = 'p';
    else if (a === '-u' || a === '--user') kind = 'u';
    else if (a === '-g' || a === '--pgrp') kind = 'g';
    else targets.push({ kind, id: a });
  }
  if (!targets.length) return game.error(`renice: no process specified\nTry 'renice --help' for more information.`);
  const lines: string[] = [];
  let failed = false;
  const change = (p: Process, label: string) => {
    const old = p.nice ?? 0;
    // Only root may lower a nice value (raise a priority), or touch another account's processes.
    if (game.who !== 'root' && (p.user !== game.who || wanted < old)) {
      game.error(`renice: failed to set priority for ${label}: Permission denied`);
      failed = true;
      return false;
    }
    p.nice = wanted;
    return old;
  };
  for (const t of targets) {
    if (t.kind === 'g') {
      game.error(`renice: failed to get priority for ${t.id} (process group ID): No such process`);
      continue;
    }
    if (t.kind === 'u') {
      const user = /^\d+$/.test(t.id) ? Object.entries(game.accounts.users).find(([, u]) => String(u.uid) === t.id)?.[0] : t.id;
      if (!user || !game.accounts.users[user]) {
        game.error(`renice: unknown user ${t.id}`);
        continue;
      }
      const theirs = processes(game).filter((p) => p.user === user && !p.zombie);
      const uid = game.accounts.users[user].uid;
      let old: number | false = 0;
      for (const p of theirs) {
        const o = change(p, `${uid} (user ID)`);
        if (o === false) {
          old = false;
          break;
        }
        old = o;
      }
      if (old !== false) lines.push(`${uid} (user ID) old priority ${old}, new priority ${wanted}`);
      continue;
    }
    if (!/^\d+$/.test(t.id)) {
      game.error(`renice: failed to parse pid: '${t.id}'`);
      continue;
    }
    const p = processes(game).find((q) => String(q.pid) === t.id && !q.zombie);
    if (!p) {
      game.error(`renice: failed to get priority for ${t.id} (process ID): No such process`);
      continue;
    }
    const old = change(p, `${t.id} (process ID)`);
    if (old !== false) lines.push(`${t.id} (process ID) old priority ${old}, new priority ${wanted}`);
  }
  if (failed || lines.length < targets.length) game.status = 1;
  refreshCpu(game);
  return lines.join('\n');
}

// pgrep: the PIDs of the processes whose name matches (-f: the whole command line).
function pgrep(game: Shell, args: string[]): string {
  let full = false;
  let list: '' | 'l' | 'a' = '';
  let user: string[] | null = null;
  let pattern: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-u' || a === '--euid') user = (args[++i] ?? '').split(',');
    else if (/^-[fla]+$/.test(a)) {
      if (a.includes('f')) full = true;
      if (a.includes('l')) list = 'l';
      if (a.includes('a')) list = 'a';
    } else if (a === '--full') full = true;
    else if (a === '--list-name') list = 'l';
    else if (a === '--list-full') list = 'a';
    else if (a.startsWith('-')) return game.error(`pgrep: invalid option -- '${a.replace(/^-+/, '')[0]}'\n\nUsage:\n pgrep [options] <pattern>\n\nFor more details see pgrep(1).`, 2);
    else pattern = a;
  }
  if (pattern === undefined && !user) return game.error('pgrep: no matching criteria specified\nTry `pgrep --help\' for more information.', 2);
  let re: RegExp | null = null;
  try {
    re = pattern !== undefined ? new RegExp(pattern) : null;
  } catch {
    return game.error(`pgrep: invalid regular expression: ${pattern}`, 2);
  }
  const name = (p: Process) => p.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '').slice(0, 15);
  const found = processes(game)
    .filter((p) => !p.zombie && (!user || user.includes(p.user)) && (!re || re.test(full ? p.command : name(p))))
    .sort((a, b) => a.pid - b.pid);
  if (!found.length) {
    game.status = 1;
    return '';
  }
  return found.map((p) => (list === 'a' ? `${p.pid} ${p.command}` : list === 'l' ? `${p.pid} ${name(p)}` : String(p.pid))).join('\n');
}

// systemd-cgtop: the services' control groups, by CPU (one snapshot).
function cgtop(game: Shell): string {
  const sd = systemd(game)!;
  refreshCpu(game);
  const s = shares(game);
  const mem = game.state.memory?.rss ?? {};
  const live = processes(game).filter((p) => !p.zombie);
  const rows = Object.entries(sd.services)
    .filter(([, x]) => x.state === 'active' && x.process.length)
    .map(([name, x]) => {
      const pids = live.filter((p) => serviceOf(sd, p.pid) === name);
      return { path: `/system.slice/${name}.service`, tasks: pids.length, cpu: pids.reduce((t, p) => t + (s[p.pid] ?? 0), 0) * 100, mem: pids.reduce((t, p) => t + (mem[p.pid] ?? 0), 0), quota: x.cpuQuota };
    });
  const others = live.filter((p) => !serviceOf(sd, p.pid));
  const users = { path: '/user.slice', tasks: others.length, cpu: others.reduce((t, p) => t + (s[p.pid] ?? 0), 0) * 100, mem: others.reduce((t, p) => t + (mem[p.pid] ?? 0), 0) };
  const system = { path: '/system.slice', tasks: rows.reduce((t, r) => t + r.tasks, 0), cpu: rows.reduce((t, r) => t + r.cpu, 0), mem: rows.reduce((t, r) => t + r.mem, 0) };
  const all = { path: '/', tasks: system.tasks + users.tasks, cpu: system.cpu + users.cpu, mem: system.mem + users.mem };
  const size = (o: number) => (o ? (o >= 1024 ** 3 ? `${(o / 1024 ** 3).toFixed(1)}G` : `${(o / 1024 ** 2).toFixed(1)}M`) : '-');
  const line = (r: { path: string; tasks: number; cpu: number; mem: number }) =>
    `${r.path.padEnd(40)} ${String(r.tasks).padStart(5)} ${r.cpu.toFixed(1).padStart(6)} ${size(r.mem).padStart(8)}        -        -`;
  return [
    `CGroup                                   Tasks   %CPU   Memory  Input/s Output/s`,
    ...[all, system, ...rows.sort((a, b) => b.cpu - a.cpu), users].map(line),
  ].join('\n');
}

export const CPU: Record<string, Command> = {
  uptime: {
    launch: ({ args, game }) => (cpu(game) && systemd(game) ? uptime(game, args) : ` ${timeOfDay(systemd(game)?.clock ?? 0)} up 12 days,  3:04,  1 user,  load average: 0.08, 0.05, 0.01`),
  },
  nproc: {
    launch: ({ game }) => String(cpu(game)?.cores ?? 2),
  },
  nice: {
    ownOptions: true,
    launch: ({ args, game, input, last }) => {
      // Without a command: the current niceness (the shell's).
      if (!args.length) return String(game.state.shellNice ?? 0);
      let rest = [...args];
      let n = 10;
      if (rest[0] === '-n' || rest[0] === '--adjustment') {
        n = Number(rest[1]);
        rest = rest.slice(2);
      } else if (/^--adjustment=/.test(rest[0])) {
        n = Number(rest[0].split('=')[1]);
        rest = rest.slice(1);
      } else if (/^-[+-]?\d+$/.test(rest[0])) {
        n = Number(rest[0].slice(1));
        rest = rest.slice(1);
      }
      if (Number.isNaN(n)) return game.error(`nice: invalid adjustment '${args[1]}'`, 125);
      if (!rest.length) return game.error(`nice: a command must be given with an adjustment\nTry 'nice --help' for more information.`, 125);
      // Without root, a negative adjustment is refused, but the command still runs (at niceness 0).
      if (n < 0 && game.who !== 'root') game.error('nice: cannot set niceness: Permission denied');
      // The command itself runs at once (the game has no long-running commands to slow down).
      return game['launch'](rest, input, game.who === 'root', last);
    },
  },
  renice: { ownOptions: true, launch: ({ args, game }) => renice(game, args) },
  pgrep: { ownOptions: true, launch: ({ args, game }) => pgrep(game, args) },
  // Manual page only (the systemd settings), see pages.ts.
  'systemd.resource-control': { section: 5, launch: () => '' },
  'systemd.exec': { section: 5, launch: () => '' },
  signal: { section: 7, launch: () => '' },
  'systemd-cgtop': {
    ownOptions: true,
    launch: ({ game }) => (systemd(game) && cpu(game) ? cgtop(game) : game.error('Failed to access control groups: No such file or directory')),
  },
};
