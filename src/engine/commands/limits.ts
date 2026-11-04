// Resource limits: ulimit (the shell's own, a bash builtin) and prlimit
// (another process's, util-linux), on the model of ../limits.ts (open
// files only). Outputs based on bash(1) ("ulimit") and prlimit(1):
// https://www.gnu.org/software/bash/manual/html_node/Bash-Builtins.html#index-ulimit,
// https://man7.org/linux/man-pages/man1/prlimit.1.html
// Differences: ulimit and prlimit only know the open-files limit (-n,
// NOFILE); ulimit -a lists Debian's usual values for the others.

import type { Shell } from '../shell';
import type { Process } from './system';
import type { Command } from './index';
import { SHELL_NOFILE, nofileOf, readLimit, showLimit, type Limit } from '../limits';

const shellLimit = (game: Shell): Limit => (game.state.shellNofile ??= { ...SHELL_NOFILE });

function ulimit(game: Shell, args: string[]): string {
  let hard = false;
  let soft = false;
  let all = false;
  let value: string | undefined;
  for (const a of args) {
    if (/^-[HSna]+$/.test(a)) {
      if (a.includes('H')) hard = true;
      if (a.includes('S')) soft = true;
      if (a.includes('a')) all = true;
    } else if (/^-/.test(a)) return game.error(`bash: ulimit: ${a}: invalid option\nulimit: usage: ulimit [-SHabcdefiklmnpqrstuvxPRT] [limit]`, 2);
    else value = a;
  }
  const l = shellLimit(game);
  if (all)
    return [
      'real-time non-blocking time  (microseconds, -R) unlimited',
      'core file size              (blocks, -c) 0',
      'data seg size               (kbytes, -d) unlimited',
      'scheduling priority                 (-e) 0',
      'file size                   (blocks, -f) unlimited',
      'pending signals                     (-i) 15391',
      'max locked memory           (kbytes, -l) 8192',
      'max memory size             (kbytes, -m) unlimited',
      `open files                          (-n) ${showLimit(hard ? l.hard : l.soft)}`,
      'pipe size                (512 bytes, -p) 8',
      'POSIX message queues         (bytes, -q) 819200',
      'real-time priority                  (-r) 0',
      'stack size                  (kbytes, -s) 8192',
      'cpu time                   (seconds, -t) unlimited',
      'max user processes                  (-u) 15391',
      'virtual memory              (kbytes, -v) unlimited',
      'file locks                          (-x) unlimited',
    ].join('\n');
  if (value === undefined) return showLimit(hard ? l.hard : l.soft);
  const n = value === 'unlimited' ? Infinity : /^\d+$/.test(value) ? Number(value) : null;
  if (n === null) return game.error(`bash: ulimit: ${value}: invalid number`, 1);
  // Without -H or -S, bash sets both. Raising the hard limit needs root; the soft one stays under the hard one.
  const newHard = hard || !soft ? n : l.hard;
  const newSoft = soft || !hard ? n : Math.min(l.soft, n);
  if ((newHard > l.hard && game.who !== 'root') || newSoft > newHard)
    return game.error('bash: ulimit: open files: cannot modify limit: Operation not permitted', 1);
  game.state.shellNofile = { soft: newSoft, hard: newHard };
  return '';
}

function prlimit(game: Shell, args: string[]): string {
  let pid: string | undefined;
  let nofile: string | null | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--pid') pid = args[++i];
    else if (a.startsWith('--pid=')) pid = a.slice(6);
    else if (a === '-n' || a === '--nofile') nofile = null;
    else if (a.startsWith('--nofile=')) nofile = a.slice(9);
    else if (/^-n.+/.test(a)) nofile = a.slice(2);
    else if (a === '--noheadings' || a === '-o' || a.startsWith('--output')) continue;
    else return game.error(`prlimit: unrecognized option '${a}'\nTry 'prlimit --help' for more information.`);
  }
  const listing: Process[] = game.state.process ?? [];
  const p = pid === undefined ? null : listing.find((q) => String(q.pid) === pid && !q.zombie);
  if (pid !== undefined && !p) return game.error(`prlimit: failed to get the NOFILE resource limit: No such process`);
  const current = p ? nofileOf(p) : shellLimit(game);
  // --nofile=SOFT:HARD: change it (the hard one only goes up for root; another account's process needs root).
  if (typeof nofile === 'string') {
    const wanted = readLimit(nofile, current);
    if (!wanted) return game.error(`prlimit: failed to parse NOFILE limit`);
    if (game.who !== 'root' && ((p && p.user !== game.who) || wanted.hard > current.hard))
      return game.error(`prlimit: failed to set the NOFILE resource limit: Operation not permitted`);
    if (p) p.nofile = wanted;
    else game.state.shellNofile = wanted;
    game.state.onLimits?.(game);
    return '';
  }
  const line = (name: string, description: string, soft: string, hard: string, units: string) =>
    `${name.padEnd(10)}${description.padEnd(35)}${soft.padStart(9)} ${hard.padStart(9)} ${units}`;
  const nofileLine = line('NOFILE', 'max number of open files', showLimit(current.soft), showLimit(current.hard), 'files');
  const header = line('RESOURCE', 'DESCRIPTION', 'SOFT', 'HARD', 'UNITS');
  if (nofile === null) return [header, nofileLine].join('\n');
  return [
    header,
    line('AS', 'address space limit', 'unlimited', 'unlimited', 'bytes'),
    line('CORE', 'max core file size', '0', 'unlimited', 'bytes'),
    line('CPU', 'CPU time', 'unlimited', 'unlimited', 'seconds'),
    line('DATA', 'max data size', 'unlimited', 'unlimited', 'bytes'),
    line('FSIZE', 'max file size', 'unlimited', 'unlimited', 'bytes'),
    line('LOCKS', 'max number of file locks held', 'unlimited', 'unlimited', 'locks'),
    line('MEMLOCK', 'max locked-in-memory address space', '8388608', '8388608', 'bytes'),
    line('NICE', 'max nice prio allowed to raise', '0', '0', ''),
    nofileLine,
    line('NPROC', 'max number of processes', '15391', '15391', 'processes'),
    line('STACK', 'max stack size', '8388608', 'unlimited', 'bytes'),
  ].join('\n');
}

export const LIMITS: Record<string, Command> = {
  ulimit: { ownOptions: true, launch: ({ args, game }) => ulimit(game, args) },
  prlimit: { ownOptions: true, launch: ({ args, game }) => prlimit(game, args) },
};
