// La mémoire : free, top (un instantané, comme top -b -n 1) et dmesg (les
// messages du noyau, dont ceux de l'OOM killer), sur le modèle de
// ../memoire.ts. Sorties d'après procps-ng (free(1), top(1)) et
// util-linux (dmesg(1)) : https://man7.org/linux/man-pages/man1/free.1.html,
// https://man7.org/linux/man-pages/man1/top.1.html,
// https://man7.org/linux/man-pages/man1/dmesg.1.html
// Écarts : top n'est pas interactif (il affiche un instantané et rend la
// main) ; pas de swap ; la colonne available vaut free (le cache ne se
// libère pas dans le jeu).

import { diskState, io } from '../disk-io';
import type { Shell } from '../shell';
import type { Process } from './system';
import { memory, process, freeSize, used } from '../memory';
import { systemd } from '../systemd';
import { dockerProcess } from '../docker';
import type { Command } from './index';

// Le noyau lui-même, hors cache (le reste de « noyau » est du cache disque).
const ONLY_KERNEL = 150 * 1024 * 1024;

function memoryDigits(game: Shell) {
  const m = memory(game)!;
  const total = m.total;
  const busy = Math.min(total, used(game));
  const cache = Math.max(0, m.kernel - ONLY_KERNEL);
  const freeMem = total - busy;
  return { total, used: busy - cache, free: freeMem, shared: 12 * 1024 * 1024, cache, available: freeMem };
}

// Le démarrage de la machine : la première ligne du journal de ce démarrage.
const boot = (game: Shell) => {
  const sd = systemd(game)!;
  return sd.log.find((e) => e.boot === sd.boot)?.time ?? sd.clock;
};

const shortName = (p: Process) =>
  p.zombie ? p.command.replace(/^\[(.*)\].*$/, '$1') : p.command.split(/\s+/)[0].split('/').at(-1)!.replace(/:$/, '');

function free(game: Shell, args: string[]): string {
  const c = memoryDigits(game);
  const options = args.join('');
  const unit = (o: number) =>
    /h/.test(options)
      ? freeSize(o)
      : /g/.test(options)
        ? String(Math.floor(o / 1024 ** 3))
        : /m/.test(options)
          ? String(Math.floor(o / 1024 ** 2))
          : /b/.test(options)
            ? String(o)
            : String(Math.floor(o / 1024));
  const line = (name: string, values: number[]) => name.padEnd(8) + values.map((v) => unit(v).padStart(12)).join('');
  return [
    ' '.repeat(8) + ['total', 'used', 'free', 'shared', 'buff/cache', 'available'].map((x) => x.padStart(12)).join(''),
    line('Mem:', [c.total, c.used, c.free, c.shared, c.cache, c.available]),
    line('Swap:', [0, 0, 0]),
  ].join('\n');
}

const timeOfDay = (ms: number) => new Date(ms).toISOString().slice(11, 19);

function top(game: Shell, args: string[]): string {
  const sd = systemd(game)!;
  const m = memory(game)!;
  const c = memoryDigits(game);
  const i = args.indexOf('-o');
  const sort = i >= 0 ? args[i + 1] : '%CPU';
  const complete = args.includes('-c');
  const listing: Process[] = [...process(game), ...dockerProcess(game)];
  const zombies = listing.filter((p) => p.zombie).length;
  const rss = (p: Process) => Math.round((m.rss[p.pid] ?? 0) / 1024);
  // RES : en Kio, puis en Mio (m) ou Gio (g) quand la colonne déborderait.
  const kio = (k: number) => (k >= 10_000_000 ? `${(k / 1024 ** 2).toFixed(1)}g` : k >= 1_000_000 ? `${(k / 1024).toFixed(1)}m` : String(k));
  const key = (p: Process) => (sort === '%MEM' || sort === 'RES' ? rss(p) : sort === 'PID' ? -p.pid : p.cpu);
  const trie = [...listing].sort((a, b) => key(b) - key(a) || a.pid - b.pid);
  const available = Math.round(c.available / 1024 / 102.4) / 10;
  const inMio = (o: number) => (o / 1024 / 1024).toFixed(1).padStart(8);
  const uptime = sd.clock - boot(game);
  const days = Math.floor(uptime / 86_400_000);
  const h = Math.floor((uptime % 86_400_000) / 3_600_000);
  const min = String(Math.floor((uptime % 3_600_000) / 60_000)).padStart(2, '0');
  // Le disque (s'il est suivi) : l'attente des entrées-sorties (wa) et la charge.
  const disk = io(game) ? diskState(game) : null;
  const wa = disk ? Math.min(95.7, disk.iowait) : 0.2;
  const load = disk ? [disk.load, disk.load * 0.85, disk.load * 0.6].map((x) => x.toFixed(2)).join(', ') : '0.42, 0.38, 0.35';
  return [
    `top - ${timeOfDay(sd.clock)} up ${days ? `${days} days, ` : ''}${String(h).padStart(2)}:${min},  1 user,  load average: ${load}`,
    `Tasks: ${String(listing.length).padStart(3)} total,   1 running, ${String(listing.length - 1 - zombies).padStart(3)} sleeping,   0 stopped, ${String(zombies).padStart(3)} zombie`,
    `%Cpu(s):  3.1 us,  1.0 sy,  0.0 ni, ${(100 - 4.2 - wa).toFixed(1).padStart(4)} id, ${wa.toFixed(1).padStart(4)} wa,  0.0 hi,  0.1 si,  0.0 st`,
    `MiB Mem : ${inMio(c.total)} total, ${inMio(c.free)} free, ${inMio(c.used)} used, ${inMio(c.cache)} buff/cache`,
    `MiB Swap:      0.0 total,      0.0 free,      0.0 used. ${String(available.toFixed(1)).padStart(8)} avail Mem`,
    '',
    '    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND',
    ...trie.map((p) => {
      const r = rss(p);
      const virt = p.zombie ? 0 : r + 180_000;
      const state = p.zombie ? 'Z' : 'S';
      const command = complete ? p.command : shortName(p);
      const time = `${Math.floor(p.pid / 97)}:${String((p.pid * 7) % 60).padStart(2, '0')}.${String(p.pid % 100).padStart(2, '0')}`;
      return `${String(p.pid).padStart(7)} ${p.user.slice(0, 8).padEnd(8)}  20   0 ${kio(virt).padStart(7)} ${kio(r).padStart(6)} ${String(p.zombie ? 0 : Math.min(r, 9800)).padStart(6)} ${state} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${time.padStart(9)} ${command}`;
    }),
  ].join('\n');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dmesg(game: Shell, args: string[]): string {
  // Debian règle kernel.dmesg_restrict = 1 : seul root lit les messages du noyau.
  if (game.who !== 'root') return game.error('dmesg: read kernel buffer failed: Operation not permitted');
  const start = boot(game);
  const readable = args.some((a) => /^-\w*T/.test(a) || a === '--ctime');
  const lines: { time: number; text: string }[] = (game.state.kernel ?? []).filter((l: { time: number }) => l.time >= start);
  return lines
    .map(({ time, text }) => {
      if (readable) {
        const d = new Date(time);
        const date = `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${timeOfDay(time)} ${d.getUTCFullYear()}`;
        return `[${date}] ${text}`;
      }
      const s = (time - start) / 1000;
      return `[${s.toFixed(6).padStart(12)}] ${text}`;
    })
    .join('\n');
}

export const MEMORY: Record<string, Command> = {
  free: { launch: ({ args, game }) => (memory(game) ? free(game, args) : game.error('free: Unable to create meminfo structure')) },
  top: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const unknown = args.find((a) => a.startsWith('-') && !['-b', '-c', '-o', '-n'].includes(a));
      if (unknown)
        return game.error(
          `top: unknown option '${unknown.replace(/^-+/, '')}'\nUsage:\n  top -hv | -bcEeHiOSs1 -d secs -n max -u|U user -p pid(s) -o field -w [cols]`,
        );
      if (!memory(game) || !systemd(game)) return game.error('top: failed tty get');
      return top(game, args);
    },
  },
  dmesg: { launch: ({ args, game }) => dmesg(game, args) },
};
