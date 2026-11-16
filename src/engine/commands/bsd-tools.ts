// The BSD versions of everyday tools, on a FreeBSD machine (see ../freebsd.ts):
// where they differ from GNU's enough to catch a Debian habit.
//   - ps: BSD's options (aux works; -e shows the ENVIRONMENT, not every
//     process: ps -ef lists only your own processes with their variables;
//     -U user, -j for the parents, no --sort nor long options);
//   - ls: no GNU long options (--all…), only --color; colours with -G;
//   - grep: no -P (Perl regular expressions);
//   - find: no -printf;
//   - du: no -b (bytes: BSD's du counts blocks, -A for the apparent size).
// The checks run before the game's generic option handling (GNU's), and
// answer like the BSD tools (getopt's "illegal option", getopt_long's
// "unknown option", find's "unknown primary or operator").
// Sources: FreeBSD 14 manual pages: ps(1), ls(1), grep(1), find(1), du(1)
// (https://man.freebsd.org/).

import type { Shell } from '../shell';
import type { Process } from './system';

// ——— option checks (null: the arguments are fine for the BSD tool) ———

const LS_USAGE = 'usage: ls [-ABCFGHILPRSTUWZabcdfghiklmnopqrstuvwxy1,] [--color=when] [-D format] [file ...]';
const GREP_USAGE =
  'usage: grep [-abcdDEFGHhIiLlmnOopqRSsUVvwxz] [-A num] [-B num] [-C[num]]\n\t[-e pattern] [-f file] [--binary-files=value] [--color=when]\n\t[--context[=num]] [--directories=action] [--label] [--line-buffered]\n\t[--null] [pattern] [file ...]';
const DU_USAGE = 'usage: du [--libxo] [-Aclnx] [-H | -L | -P] [-g | -h | -k | -m] [-a | -s | -d depth] [-B blocksize] [-I mask] [-t threshold] [file ...]';
const PS_USAGE =
  'usage: ps [--libxo] [-aCcdefHhjlmrSTuvwXxZ] [-O fmt | -o fmt]\n          [-G gid[,gid...]] [-J jid[,jid...]] [-M core] [-N system]\n          [-p pid[,pid...]] [-t tty[,tty...]] [-U user[,user...]]\n       ps [--libxo] -L';

const LS_LETTERS = 'ABCDFGHILPRSTUWZabcdfghiklmnopqrstuvwxy1,';
const GREP_LETTERS = 'abcdDEFGHhIiLlmnOopqRSsUVvwxzABCef';
const DU_LETTERS = 'AclnxHLPghkmasdBIt';

/** Short options grouped in words: the first letter not in `allowed`, if any. */
function firstIllegal(args: string[], allowed: string, withValue = ''): string | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') break;
    if (!a.startsWith('-') || a === '-' || a.startsWith('--')) continue;
    for (let j = 1; j < a.length; j++) {
      if (!allowed.includes(a[j])) return a[j];
      if (withValue.includes(a[j])) {
        if (j === a.length - 1) i++;
        break;
      }
    }
  }
  return null;
}
const longOptions = (args: string[]) => args.filter((a) => a.startsWith('--') && a !== '--');

export const BSD_CHECKS: Record<string, (args: string[]) => string | null> = {
  // getopt_long (for --color): "unknown option".
  ls: (args) => {
    const long = longOptions(args).find((a) => !/^--colou?r(=|$)/.test(a));
    if (long) return `ls: unknown option -- ${long.slice(2).split('=')[0]}\n${LS_USAGE}`;
    const bad = firstIllegal(args, LS_LETTERS, 'D');
    return bad ? `ls: unknown option -- ${bad}\n${LS_USAGE}` : null;
  },
  grep: (args) => {
    const long = longOptions(args).find((a) => !/^--(colou?r|context|binary-files|directories|label|line-buffered|null|ignore-case|invert-match|count|quiet|silent|extended-regexp|fixed-strings|recursive|files-with-matches|no-filename|with-filename|line-number|word-regexp)(=|$)/.test(a));
    if (long) return `grep: unknown option -- ${long.slice(2).split('=')[0]}\n${GREP_USAGE}`;
    const bad = firstIllegal(args, GREP_LETTERS, 'ABCef');
    return bad ? `grep: unknown option -- ${bad}\n${GREP_USAGE}` : null;
  },
  find: (args) => {
    const primary = args.find((a) => ['-printf', '-fprintf', '-printf0', '-readable', '-writable', '-executable'].includes(a));
    return primary ? `find: ${primary}: unknown primary or operator` : null;
  },
  du: (args) => {
    const long = longOptions(args).find((a) => a !== '--libxo');
    if (long) return `du: illegal option -- -\n${DU_USAGE}`;
    const bad = firstIllegal(args, DU_LETTERS, 'dBIt');
    return bad ? `du: illegal option -- ${bad}\n${DU_USAGE}` : null;
  },
  // ps parses its own options (see bsdPs).
  ps: () => null,
};

// ——— ps ———

interface Row {
  pid: number;
  ppid: number;
  user: string;
  tt: string;
  stat: string;
  time: string;
  cpu: number;
  mem: number;
  command: string;
  env?: string;
}

// The player's login shell and ps itself: on a real system, they are processes too.
const SHELL_PID = 2742;
const PS_PID = 2790;

function rows(game: Shell, line: string): Row[] {
  const procs: Process[] = game.state.process ?? [];
  const env = `USER=${game.player} LOGNAME=${game.player} HOME=/home/${game.player} MAIL=/var/mail/${game.player} PATH=/sbin:/bin:/usr/sbin:/usr/bin:/usr/local/sbin:/usr/local/bin:/home/${game.player}/bin TERM=xterm SHELL=/bin/sh BLOCKSIZE=K`;
  const out: Row[] = procs.map((p) => ({
    pid: p.pid,
    ppid: p.ppid ?? (p.pid === 1 ? 0 : 1),
    user: p.user,
    tt: '-',
    stat: p.zombie ? 'Z' : p.stopped ? 'T' : p.cpu > 0 ? 'R' : p.pid === 1 ? 'ILs' : 'Ss',
    time: `${Math.floor(p.cpu / 10)}:${String(Math.round(p.mem * 7) % 60).padStart(2, '0')}.${String((p.pid * 7) % 100).padStart(2, '0')}`,
    cpu: p.cpu,
    mem: p.mem,
    command: p.command,
  }));
  out.push(
    { pid: SHELL_PID, ppid: 2741, user: game.player, tt: '0', stat: 'Ss', time: '0:00.03', cpu: 0, mem: 0.1, command: '-sh (sh)', env },
    { pid: PS_PID, ppid: SHELL_PID, user: game.who, tt: '0', stat: 'R+', time: '0:00.00', cpu: 0, mem: 0.1, command: line, env },
  );
  return out.sort((a, b) => a.pid - b.pid);
}

const KEYWORDS: Record<string, { header: string; width: number; left?: boolean; value: (r: Row) => string }> = {
  pid: { header: 'PID', width: 5, value: (r) => String(r.pid) },
  ppid: { header: 'PPID', width: 5, value: (r) => String(r.ppid) },
  user: { header: 'USER', width: 8, left: true, value: (r) => r.user },
  uid: { header: 'UID', width: 5, value: (r) => (r.user === 'root' ? '0' : '1001') },
  tt: { header: 'TT', width: 3, left: true, value: (r) => r.tt },
  stat: { header: 'STAT', width: 4, left: true, value: (r) => r.stat },
  state: { header: 'STAT', width: 4, left: true, value: (r) => r.stat },
  time: { header: 'TIME', width: 7, value: (r) => r.time },
  '%cpu': { header: '%CPU', width: 4, value: (r) => r.cpu.toFixed(1) },
  pcpu: { header: '%CPU', width: 4, value: (r) => r.cpu.toFixed(1) },
  '%mem': { header: '%MEM', width: 4, value: (r) => r.mem.toFixed(1) },
  pmem: { header: '%MEM', width: 4, value: (r) => r.mem.toFixed(1) },
  vsz: { header: 'VSZ', width: 6, value: (r) => String(Math.round(12000 + r.mem * 21000)) },
  rss: { header: 'RSS', width: 5, value: (r) => String(Math.round(1800 + r.mem * 20000)) },
  comm: { header: 'COMMAND', width: 0, left: true, value: (r) => r.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-|\)$/g, '').replace(/^\(/, '') },
  ucomm: { header: 'UCOMM', width: 0, left: true, value: (r) => r.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '') },
  command: { header: 'COMMAND', width: 0, left: true, value: (r) => r.command },
  args: { header: 'COMMAND', width: 0, left: true, value: (r) => r.command },
  started: { header: 'STARTED', width: 7, left: true, value: (r) => (r.pid >= SHELL_PID ? '10:15AM' : ' 2Sep29') },
  pgid: { header: 'PGID', width: 5, value: (r) => String(r.pid >= SHELL_PID ? SHELL_PID : r.pid) },
  sid: { header: 'SID', width: 5, value: (r) => String(r.pid >= SHELL_PID ? SHELL_PID : r.pid) },
  jobc: { header: 'JOBC', width: 4, value: (r) => (r.pid >= SHELL_PID ? '1' : '0') },
};

const table = (keys: string[], list: Row[], withEnv: boolean) => {
  const cols = keys.map((k) => KEYWORDS[k]);
  const cell = (k: number, v: string) => {
    const c = cols[k];
    if (k === cols.length - 1) return v;
    return c.left ? v.padEnd(Math.max(c.width, c.header.length)) : v.padStart(Math.max(c.width, c.header.length));
  };
  return [
    cols.map((c, k) => cell(k, c.header)).join(' '),
    ...list.map((r) => cols.map((c, k) => cell(k, k === cols.length - 1 && withEnv && r.env && (c === KEYWORDS.command || c === KEYWORDS.args) ? `${r.env} ${c.value(r)}` : c.value(r))).join(' ')),
  ].join('\n');
};

/** BSD ps: its options (BSD style "aux" or with dashes), selection and formats. */
export function bsdPs(game: Shell, args: string[]): string {
  const flags = new Set<string>();
  let format: string[] | null = null;
  let extra: string[] = [];
  let pids: string[] | null = null;
  let users: string[] | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    // "aux" without a dash: BSD style, the same letters.
    const word = a.startsWith('-') ? a.slice(1) : i === 0 ? a : null;
    if (word === null) return game.error(`ps: ${a}: illegal argument\n${PS_USAGE}`, 1);
    if (a.startsWith('--')) return game.error(`ps: illegal option -- -\n${PS_USAGE}`, 1);
    for (let j = 0; j < word.length; j++) {
      const l = word[j];
      if ('oOpUtG'.includes(l)) {
        const value = word.slice(j + 1) || args[++i];
        if (value === undefined) return game.error(`ps: option requires an argument -- ${l}\n${PS_USAGE}`, 1);
        const list = value.split(/[,\s]+/).filter(Boolean);
        if (l === 'o') format = [...(format ?? []), ...list];
        else if (l === 'O') extra = [...extra, ...list];
        else if (l === 'p') pids = list;
        else if (l === 'U') users = list;
        break;
      }
      if (!'aCcdefHhjlmrSTuvwXxZA'.includes(l)) return game.error(`ps: illegal option -- ${l}\n${PS_USAGE}`, 1);
      flags.add(l);
    }
  }
  const line = ['ps', ...args].join(' ');
  let list = rows(game, line);
  // Selection: without -a, only your processes; without -x, only those with a terminal.
  if (pids) list = list.filter((r) => pids!.includes(String(r.pid)));
  else if (users) list = list.filter((r) => users!.includes(r.user));
  else {
    if (!flags.has('a') && !flags.has('A')) list = list.filter((r) => r.user === game.who || r.user === game.player);
    if (!flags.has('x') && !flags.has('A')) list = list.filter((r) => r.tt !== '-');
  }
  if (pids && !list.length) game.status = 1;
  // -e: the environment, visible for your own processes only.
  const env = flags.has('e');
  if (env) for (const r of list) if (r.user !== game.who && game.who !== 'root') delete r.env;
  if (!env) for (const r of list) delete r.env;
  if (format) {
    const unknown = format.find((k) => !KEYWORDS[k.split('=')[0].toLowerCase()]);
    if (unknown) return game.error(`ps: ${unknown}: keyword not found\nps: no valid keywords; valid keywords:\n${Object.keys(KEYWORDS).sort().join(' ')}`, 1);
    return table(format.map((k) => k.split('=')[0].toLowerCase()), list, env);
  }
  let keys: string[];
  if (flags.has('u')) keys = ['user', 'pid', '%cpu', '%mem', 'vsz', 'rss', 'tt', 'stat', 'started', 'time', 'command'];
  else if (flags.has('j')) keys = ['user', 'pid', 'ppid', 'pgid', 'sid', 'jobc', 'stat', 'tt', 'time', 'command'];
  else if (flags.has('l')) keys = ['uid', 'pid', 'ppid', '%cpu', 'vsz', 'rss', 'stat', 'tt', 'time', 'command'];
  else keys = ['pid', 'tt', 'stat', 'time', 'command'];
  if (extra.length) keys.splice(keys.length - 1, 0, ...extra.filter((k) => KEYWORDS[k]));
  return table(keys, list, env);
}
