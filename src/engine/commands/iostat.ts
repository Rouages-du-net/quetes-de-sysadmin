// iostat et pidstat (sysstat), ionice (util-linux), sur le modèle de
// ../entrees-sorties.ts. Sorties en anglais, colonnes de sysstat 12.7.
// Sources : https://man7.org/linux/man-pages/man1/iostat.1.html,
// https://man7.org/linux/man-pages/man1/pidstat.1.html,
// https://man7.org/linux/man-pages/man1/ionice.1.html
// Écarts : iostat -c, -d, -x, -k, -m, -y, -z et un intervalle ; pidstat -d,
// -u et un intervalle ; ionice -p (lire), -c, -n, -p (régler) ; tous les
// rapports donnent les chiffres de l'instant.

import type { Shell } from '../shell';
import { systemd } from '../systemd';
import { diskState, io } from '../disk-io';
import { help } from './manual';
import type { Command } from './index';

const f2 = (n: number) => n.toFixed(2);

// L'en-tête de sysstat : noyau, machine, date (au format de la langue), architecture, processeurs.
function header(game: Shell): string {
  const sd = systemd(game)!;
  const date = new Date(sd.clock);
  const day =
    game.t.language === 'fr'
      ? date.toISOString().slice(0, 10).split('-').reverse().join('/')
      : `${date.toISOString().slice(5, 7)}/${date.toISOString().slice(8, 10)}/${date.getUTCFullYear()}`;
  return `Linux 6.12.0-quetes (${sd.host}) \t${day} \t_x86_64_\t(${io(game)!.cpus} CPU)`;
}

// Intervalle et nombre de rapports (iostat 1 3).
function repetitions(args: string[]): { count: number; interval: boolean } | null {
  const numbers = args.filter((a) => /^\d+$/.test(a)).map(Number);
  if (numbers.some((n) => n === 0) && numbers[0] === 0) return null;
  return { count: numbers.length === 0 ? 1 : (numbers[1] ?? 2), interval: numbers.length > 0 };
}

function iostat(game: Shell, args: string[]): string {
  if (!io(game)) return header(game);
  const options = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const unknown = [...options].find((o) => !'cdxkmyzh'.includes(o));
  if (unknown)
    return game.error(
      `Usage: iostat [ options ] [ <interval> [ <count> ] ]\nOptions are:\n[ -c ] [ -d ] [ -h ] [ -k | -m ] [ -t ] [ -V ] [ -x ] [ -y ] [ -z ]`,
      1,
    );
  if (options.has('h')) return help('iostat', IOSTAT.iostat, game.t);
  const rep = repetitions(args);
  if (!rep) return game.error('Usage: iostat [ options ] [ <interval> [ <count> ] ]', 1);
  const { e, debits: rates, utilisation, attente: waiting, iowait } = diskState(game);
  const cpu = !options.has('d') || options.has('c');
  const disks = !options.has('c') || options.has('d');
  const unit = options.has('m') ? 1024 : 1;
  const name = unit === 1 ? 'kB' : 'MB';
  const read = rates.reduce((t, d) => t + d.read, 0);
  const write = rates.reduce((t, d) => t + d.write, 0);
  // Des requêtes d'environ 240 ko (lecture séquentielle), le compte des opérations s'en déduit.
  const rs = read / 236;
  const ws = write / 240;
  const system = Math.min(9, 1.2 + utilisation / 40);
  const report = () => {
    const lines: string[] = [];
    if (cpu)
      lines.push(
        'avg-cpu:  %user   %nice %system %iowait  %steal   %idle',
        `         ${f2(3.4).padStart(6)}  ${f2(0).padStart(6)}  ${f2(system).padStart(6)}  ${f2(iowait).padStart(6)}  ${f2(0).padStart(6)}  ${f2(Math.max(0, 100 - 3.4 - system - iowait)).padStart(6)}`,
        '',
      );
    if (disks) {
      if (options.has('x')) {
        lines.push(
          `Device            r/s     r${name}/s   rrqm/s  %rrqm r_await rareq-sz     w/s     w${name}/s   wrqm/s  %wrqm w_await wareq-sz     d/s     d${name}/s   drqm/s  %drqm d_await dareq-sz     f/s f_await  aqu-sz  %util`,
          [
            e.disk.padEnd(12),
            f2(rs).padStart(8),
            f2(read / unit).padStart(9),
            f2(0).padStart(8),
            f2(0).padStart(6),
            f2(waiting).padStart(7),
            f2(rs ? 236 : 0).padStart(8),
            f2(ws).padStart(7),
            f2(write / unit).padStart(9),
            f2(ws * 0.04).padStart(8),
            f2(ws ? 3.83 : 0).padStart(6),
            f2(ws ? waiting * 1.6 : 0).padStart(7),
            f2(ws ? 240 : 0).padStart(8),
            ...['0.00', '0.00', '0.00', '0.00', '0.00', '0.00'].map((v, i) => v.padStart([7, 9, 8, 6, 7, 8][i])),
            f2(0).padStart(7),
            f2(0).padStart(7),
            f2(((rs + ws) * waiting) / 1000).padStart(7),
            f2(utilisation).padStart(6),
          ].join(' '),
          '',
        );
      } else {
        lines.push(
          `Device             tps    ${name}_read/s    ${name}_wrtn/s    ${name}_dscd/s    ${name}_read    ${name}_wrtn    ${name}_dscd`,
          `${e.disk.padEnd(12)} ${f2(rs + ws).padStart(9)} ${f2(read / unit).padStart(12)} ${f2(write / unit).padStart(12)} ${f2(0).padStart(12)} ${String(Math.round((read * 3600) / unit)).padStart(10)} ${String(Math.round((write * 3600) / unit)).padStart(10)} ${'0'.padStart(10)}`,
          '',
        );
      }
    }
    return lines;
  };
  const rapports = Array.from({ length: options.has('y') && rep.interval ? Math.max(1, rep.count - 1) : rep.count }, report);
  return [header(game), '', ...rapports.flat()].join('\n').trimEnd();
}

function pidstat(game: Shell, args: string[]): string {
  if (!io(game)) return header(game);
  const options = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const unknown = [...options].find((o) => !'duh'.includes(o));
  if (unknown) return game.error('Usage: pidstat [ options ] [ <interval> [ <count> ] ]\nOptions are:\n[ -d ] [ -h ] [ -u ]', 1);
  const rep = repetitions(args);
  if (!rep) return game.error('Usage: pidstat [ options ] [ <interval> [ <count> ] ]', 1);
  const sd = systemd(game)!;
  const { debits: rates } = diskState(game);
  const timeOfDay = (offset: number) => new Date(sd.clock + offset * 1000).toISOString().slice(11, 19);
  const disk = options.has('d');
  const title = disk
    ? '      UID       PID   kB_rd/s   kB_wr/s kB_ccwr/s iodelay  Command'
    : '      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command';
  const lines = (start: string) =>
    disk
      ? rates.map(
          (d) =>
            `${start} ${String(d.uid).padStart(5)} ${String(d.pid).padStart(9)} ${f2(d.read).padStart(9)} ${f2(d.write).padStart(9)} ${f2(0).padStart(9)} ${String(Math.round(d.waiting / 4)).padStart(7)}  ${d.command}`,
        )
      : (game.state.processus ?? [])
          .filter((p: { cpu: number }) => p.cpu > 0)
          .map(
            (p: { pid: number; cpu: number; user: string; command: string }) =>
              `${start} ${String(p.user === 'root' ? 0 : (game.accounts.users[p.user]?.uid ?? 1000)).padStart(5)} ${String(p.pid).padStart(9)} ${f2(p.cpu * 0.7).padStart(7)} ${f2(p.cpu * 0.3).padStart(7)} ${f2(0).padStart(7)} ${f2(rates.find((d) => d.pid === p.pid && d.waiting > 50) ? 41 : 0).padStart(7)} ${f2(p.cpu).padStart(7)} ${'1'.padStart(5)}  ${p.command.split(/\s+/)[0].split('/').at(-1)}`,
          );
  const blocks: string[] = [];
  for (let i = 0; i < rep.count; i++) blocks.push('', `${timeOfDay(i)}${title}`, ...lines(timeOfDay(i + 1)));
  if (rep.interval && rep.count > 1) blocks.push('', `Average: ${title.trimStart().padStart(title.length - 1)}`, ...lines('Average:'));
  return [header(game), ...blocks].join('\n');
}

const CLASSES = ['none', 'realtime', 'best-effort', 'idle'];

function ionice(game: Shell, args: string[]): string {
  let cls: number | null = null;
  let prio: number | null = null;
  const pids: number[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = /^-[cn]\d$/.test(a) ? a.slice(2) : a === '-c' || a === '-n' || a === '--class' || a === '--classdata' ? args[++i] : null;
    if (a.startsWith('-c') || a === '--class') cls = Number(value);
    else if (a.startsWith('-n') || a === '--classdata') prio = Number(value);
    else if (a === '-p' || a === '--pid') {
      while (/^\d+$/.test(args[i + 1] ?? '')) pids.push(Number(args[++i]));
    } else if (a === '-h' || a === '--help') return help('ionice', IOSTAT.ionice, game.t);
    else if (a.startsWith('-'))
      return game.error(`ionice: invalid option -- '${a.replace(/^-+/, '')}'\nTry 'ionice --help' for more information.`, 1);
    else return game.error(game.t('ionice-command'), 1);
  }
  const e = io(game);
  const live = new Set((game.state.processus ?? []).map((p: { pid: number }) => p.pid));
  if (!pids.length) return cls === null ? 'none: prio 0' : game.error("ionice: bad usage\nTry 'ionice --help' for more information.", 1);
  if (cls !== null && (Number.isNaN(cls) || cls < 0 || cls > 3)) return game.error(`ionice: unknown scheduling class: '${cls}'`, 1);
  const outputs: string[] = [];
  for (const pid of pids) {
    if (!live.has(pid)) return game.error(`ionice: ioprio_get failed: No such process`, 1);
    if (cls === null) {
      const c = e?.classes[pid];
      outputs.push(!c || c.cls === 2 ? `best-effort: prio ${c?.prio ?? 4}` : c.cls === 3 ? 'idle' : `${CLASSES[c.cls]}: prio ${c.prio}`);
      continue;
    }
    const owner = (game.state.processus ?? []).find((p: { pid: number }) => p.pid === pid)?.user;
    // Le temps réel est réservé à root ; changer la classe d'un processus d'un autre compte aussi.
    if (game.who !== 'root' && (cls === 1 || owner !== game.who)) return game.error('ionice: ioprio_set failed: Operation not permitted', 1);
    if (e) e.classes[pid] = { cls, prio: cls === 3 ? 0 : (prio ?? 4) };
  }
  return outputs.join('\n');
}

export const IOSTAT: Record<string, Command> = {
  iostat: { ownOptions: true, launch: ({ args, game }) => iostat(game, args) },
  pidstat: { ownOptions: true, launch: ({ args, game }) => pidstat(game, args) },
  ionice: { ownOptions: true, launch: ({ args, game }) => ionice(game, args) },
};
