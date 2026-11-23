// Small everyday tools: basename, dirname, realpath, yes, tac, nl, paste
// (GNU coreutils 9.7), column (util-linux 2.41), cmp (GNU diffutils 3.10),
// whereis (util-linux), more, vmstat (procps-ng 4.0.4), lscpu, sync,
// timeout, install, chattr and lsattr (e2fsprogs 1.47), shutdown, poweroff
// and halt (systemd 257). Messages and exit codes as the real tools give
// them: https://www.gnu.org/software/coreutils/manual/coreutils.html,
// https://man7.org/linux/man-pages/man1/column.1.html,
// https://man7.org/linux/man-pages/man1/chattr.1.html,
// https://www.freedesktop.org/software/systemd/man/latest/shutdown.html
// Differences: yes on the screen stops by itself after a screenful (^C);
// timeout knows only sleep's duration; a powered-off machine comes back
// (the host's console powers it on again), like a reboot; a scheduled
// shutdown never comes.

import type { Command, Context } from './index';
import type { Shell } from '../shell';
import type { File, Node } from '../world';
import { COMMANDS } from './index';
import { applyMode, content, options } from '../tools';
import { inColumns } from './files';
import { memoryDigits } from './memory';
import { memory } from '../memory';
import { cpu } from '../cpu';
import { restart, systemd } from '../systemd';
import { nowOf } from '../time';
import { connections } from './ss';

const usage = (game: Shell, cmd: string, message: string, code = 1) => game.error(`${cmd}: ${message}\nTry '${cmd} --help' for more information.`, code);

/** The lines of the files given, or of the pipe ('-' too). */
function inputs(c: Context, cmd: string, files: string[]): { name: string; text: string }[] | null {
  if (!files.length) return [{ name: '-', text: c.input ?? '' }];
  const out: { name: string; text: string }[] = [];
  for (const f of files) {
    if (f === '-') out.push({ name: '-', text: c.input ?? '' });
    else {
      const text = c.game.readFor(cmd, f);
      if (text === null) return null;
      out.push({ name: f, text });
    }
  }
  return out;
}
const linesOf = (t: string) => (t === '' ? [] : t.replace(/\n$/, '').split('\n'));

// ——— Names ———

function basename({ args, game }: Context): string {
  let multiple = false;
  let suffix = '';
  const names: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-a' || a === '--multiple') multiple = true;
    else if (a === '-s') {
      suffix = args[++k] ?? '';
      multiple = true;
    } else if (a.startsWith('--suffix=')) {
      suffix = a.slice(9);
      multiple = true;
    } else if (a === '-z' || a === '--zero') continue;
    else if (a.startsWith('-') && a !== '-' && names.length === 0) return usage(game, 'basename', a.startsWith('--') ? `unrecognized option '${a}'` : `invalid option -- '${a[1]}'`);
    else names.push(a);
  }
  if (!names.length) return usage(game, 'basename', 'missing operand');
  if (!multiple) {
    if (names.length > 2) return usage(game, 'basename', `extra operand '${names[2]}'`);
    suffix = names[1] ?? '';
    names.splice(1);
  }
  return names
    .map((n) => {
      if (/^\/+$/.test(n)) return '/';
      const base = n.replace(/\/+$/, '').split('/').pop() ?? '';
      return suffix && base !== suffix && base.endsWith(suffix) ? base.slice(0, -suffix.length) : base;
    })
    .join('\n');
}

function dirname({ args, game }: Context): string {
  const names = args.filter((a) => a !== '-z');
  const bad = names.find((a) => a.startsWith('-') && a !== '-');
  if (bad) return usage(game, 'dirname', bad.startsWith('--') ? `unrecognized option '${bad}'` : `invalid option -- '${bad[1]}'`);
  if (!names.length) return usage(game, 'dirname', 'missing operand');
  return names
    .map((n) => {
      const trimmed = n.replace(/\/+$/, '');
      if (trimmed === '') return n.startsWith('/') ? '/' : '.';
      const i = trimmed.lastIndexOf('/');
      if (i < 0) return '.';
      return trimmed.slice(0, i).replace(/\/+$/, '') || '/';
    })
    .join('\n');
}

/** The canonical path: absolute, links followed, . and .. gone (realpath, readlink -f). */
export function canonical(game: Shell, path: string): string {
  let current = game.resolve(path);
  for (let i = 0; i < 40; i++) {
    const parts = current.split('/').filter(Boolean);
    let built = '';
    let changed = false;
    for (let k = 0; k < parts.length; k++) {
      const next = `${built}/${parts[k]}`;
      const n = game.find(next, false);
      if (n?.type === 'file' && n.link !== undefined) {
        const target = n.link.startsWith('/') ? n.link : `${built || '/'}/${n.link}`;
        current = game.resolve([target, ...parts.slice(k + 1)].join('/'));
        changed = true;
        break;
      }
      built = next;
    }
    if (!changed) return built || '/';
  }
  return current;
}

function realpath({ args, game }: Context): string {
  const { letters, rest } = options(args.filter((a) => a !== '--canonicalize-existing' && a !== '--canonicalize-missing' && a !== '--no-symlinks'));
  const existing = letters.has('e') || args.includes('--canonicalize-existing');
  const missing = letters.has('m') || args.includes('--canonicalize-missing');
  const plain = letters.has('s') || args.includes('--no-symlinks');
  if (!rest.length) return usage(game, 'realpath', 'missing operand');
  const out: string[] = [];
  for (const p of rest) {
    const full = plain ? game.resolve(p) : canonical(game, p);
    const parent = full.replace(/\/[^/]*$/, '') || '/';
    // The last part may be missing (not with -e); its directory may not (except with -m).
    if (!missing && ((existing && !game.find(full)) || (!existing && game.find(parent)?.type !== 'directory'))) {
      game.error(`realpath: ${p}: No such file or directory`, 1);
      continue;
    }
    out.push(full);
  }
  return out.join('\n');
}

// ——— Text ———

function yes({ args, last, game }: Context): string {
  const word = args.length ? args.join(' ') : 'y';
  // Through a pipe, the reader stops it (SIGPIPE): enough lines for any reader.
  if (!last) return Array(2000).fill(word).join('\n');
  // On the screen it never ends: a screenful, then Ctrl-C.
  game.status = 130;
  return [...Array(40).fill(word), '^C'].join('\n');
}

function tac(c: Context): string {
  const files = c.args.filter((a) => !a.startsWith('-') || a === '-');
  const all = inputs(c, 'tac', files);
  if (!all) return '';
  return all.map((t) => linesOf(t.text).reverse().join('\n')).filter(Boolean).join('\n');
}

function nl(c: Context): string {
  const { args, game } = c;
  let body = 't';
  let format = 'rn';
  let width = 6;
  let separator = '\t';
  let start = 1;
  let step = 1;
  const files: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    const value = (flag: string) => (a.length > 2 ? a.slice(2) : args[++k] ?? '');
    if (a.startsWith('-b')) body = value('b');
    else if (a.startsWith('-n')) format = value('n');
    else if (a.startsWith('-w')) width = Number(value('w'));
    else if (a.startsWith('-s')) separator = value('s');
    else if (a.startsWith('-v')) start = Number(value('v'));
    else if (a.startsWith('-i')) step = Number(value('i'));
    else if (a.startsWith('-') && a !== '-') return usage(game, 'nl', `invalid option -- '${a[1]}'`);
    else files.push(a);
  }
  if (!['a', 't', 'n'].includes(body)) return game.error(`nl: invalid body numbering style: '${body}'`, 1);
  if (!['ln', 'rn', 'rz'].includes(format)) return game.error(`nl: invalid line numbering format: '${format}'`, 1);
  const all = inputs(c, 'nl', files);
  if (!all) return '';
  let n = start;
  const out: string[] = [];
  for (const t of all)
    for (const line of linesOf(t.text)) {
      if (body === 'n' || (body === 't' && line.trim() === '')) {
        out.push(' '.repeat(width + separator.length) + line);
        continue;
      }
      const num = format === 'ln' ? String(n).padEnd(width) : format === 'rz' ? String(n).padStart(width, '0') : String(n).padStart(width);
      out.push(`${num}${separator}${line}`);
      n += step;
    }
  return out.join('\n');
}

function column(c: Context): string {
  const { args, game } = c;
  let table = false;
  let separator: string | null = null;
  let output = '  ';
  const files: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-t' || a === '--table') table = true;
    else if (a === '-s' || a === '--separator') separator = args[++k] ?? '';
    else if (a.startsWith('-s') && a.length > 2) separator = a.slice(2);
    else if (a === '-o' || a === '--output-separator') output = args[++k] ?? '  ';
    else if (/^-t[s]/.test(a)) {
      table = true;
      separator = a.slice(3) || args[++k] || '';
    } else if (a.startsWith('-') && a !== '-') return game.error(`column: invalid option -- '${a[1]}'\nTry 'column --help' for more information.`, 1);
    else files.push(a);
  }
  const all = inputs(c, 'column', files);
  if (!all) return '';
  const lines = all.flatMap((t) => linesOf(t.text)).filter((l) => l.trim() !== '');
  if (!table) return inColumns(lines, 80);
  // -t: a table; the cells are split on blanks (or on each character of -s), aligned on the widest.
  const rows = lines.map((l) => (separator === null ? l.trim().split(/\s+/) : l.split(new RegExp(`[${separator.replace(/[\]\\^-]/g, '\\$&')}]`))));
  const widths: number[] = [];
  for (const r of rows) r.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, [...cell].length)));
  return rows.map((r) => r.map((cell, i) => (i < r.length - 1 ? cell.padEnd(widths[i]) + output : cell)).join('')).join('\n');
}

function paste(c: Context): string {
  const { args, game } = c;
  let delimiters = '\t';
  let serial = false;
  const files: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-s' || a === '--serial') serial = true;
    else if (a === '-d') delimiters = args[++k] ?? '';
    else if (a.startsWith('--delimiters=')) delimiters = a.slice(13);
    else if (/^-s?d/.test(a) && a !== '-') {
      if (a.startsWith('-s')) serial = true;
      delimiters = a.slice(a.indexOf('d') + 1) || args[++k] || '';
    } else if (a.startsWith('-') && a !== '-') return usage(game, 'paste', `invalid option -- '${a[1]}'`);
    else files.push(a);
  }
  delimiters = delimiters.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\0/g, '') || '';
  const all = inputs(c, 'paste', files.length ? files : ['-']);
  if (!all) return '';
  const delim = (i: number) => (delimiters.length ? delimiters[i % delimiters.length] : '');
  const join = (cells: string[]) => cells.reduce((s, cell, i) => (i === 0 ? cell : s + delim(i - 1) + cell), '');
  if (serial) return all.map((t) => join(linesOf(t.text))).join('\n');
  const columns = all.map((t) => linesOf(t.text));
  const height = Math.max(0, ...columns.map((l) => l.length));
  return Array.from({ length: height }, (_, r) => join(columns.map((col) => col[r] ?? ''))).join('\n');
}

function cmp({ args, game }: Context): string {
  const { letters, rest } = options(args.filter((a) => a !== '--silent' && a !== '--quiet'));
  const silent = letters.has('s') || args.includes('--silent') || args.includes('--quiet');
  if (!rest.length) return game.error("cmp: missing operand after 'cmp'\ncmp: Try 'cmp --help' for more information.", 2);
  const [a, b = '-'] = rest;
  const read = (p: string): string | null => {
    const n = game.find(p);
    if (!n) return game.error(`cmp: ${p}: No such file or directory`, 2), null;
    if (n.type === 'directory') return game.error(`cmp: ${p}: Is a directory`, 2), null;
    if (!game.can(n, 'r')) return game.error(`cmp: ${p}: Permission denied`, 2), null;
    // The bytes as the file holds them (a text ends with a newline).
    const t = content(n, game);
    return n.charset === 'binary' || t === '' ? t : `${t}\n`;
  };
  const x = read(a);
  const y = read(b);
  if (x === null || y === null) {
    game.status = 2;
    return '';
  }
  let line = 1;
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) {
      game.status = 1;
      return silent ? '' : `${a} ${b} differ: char ${i + 1}, line ${line}`;
    }
    if (x[i] === '\n') line++;
  }
  if (x.length === y.length) {
    game.status = 0;
    return '';
  }
  game.status = 1;
  if (silent) return '';
  const shorter = x.length < y.length ? a : b;
  const n = Math.min(x.length, y.length);
  const lines = (x.length < y.length ? x : y).split('\n').length - 1;
  return game.error(n === 0 ? `cmp: EOF on ${shorter} which is empty` : `cmp: EOF on ${shorter} after byte ${n}, line ${lines}`, 1);
}

function whereis({ args, game }: Context): string {
  const names = args.filter((a) => !a.startsWith('-'));
  if (!names.length) return game.error('whereis: not enough arguments\nTry \'whereis --help\' for more information.', 1);
  return names
    .map((n) => {
      const c = COMMANDS[n];
      const there = c && !c.directory && c.section !== 5 && !c.cmdlet && !c.cl && !c.winexe && game.known().includes(n);
      if (!there) return `${n}:`;
      const section = c.section ?? 1;
      return `${n}: ${section === 8 ? '/usr/sbin' : '/usr/bin'}/${n} /usr/share/man/man${section}/${n}.${section}.gz`;
    })
    .join('\n');
}

function more(c: Context): string {
  const files = c.args.filter((a) => !a.startsWith('-') || a === '-');
  if (!files.length) return c.input ?? c.game.error('more: bad usage\nTry \'more --help\' for more information.', 1);
  const all = inputs(c, 'more', files);
  if (!all) return '';
  // Several files: each announced between lines of colons.
  if (all.length > 1) return all.map((t) => `::::::::::::::\n${t.name}\n::::::::::::::\n${t.text}`).join('\n');
  return all[0].text;
}

// ——— The machine ———

function vmstat({ args, game }: Context): string {
  const m = memory(game) ? memoryDigits(game) : { total: 2_062_000 * 1024, used: 210_000 * 1024, free: 1_520_000 * 1024, cache: 330_000 * 1024 };
  const k = (b: number) => Math.floor(b / 1024);
  if (args.includes('-s') || args.includes('--stats'))
    return [
      `${String(k(m.total)).padStart(13)} K total memory`,
      `${String(k(m.used)).padStart(13)} K used memory`,
      `${String(k(m.free)).padStart(13)} K free memory`,
      `${String(k(m.cache)).padStart(13)} K buffer memory`,
      `${String(0).padStart(13)} K total swap`,
      `${String(0).padStart(13)} K used swap`,
      `${String(0).padStart(13)} K free swap`,
    ].join('\n');
  const bad = args.find((a) => a.startsWith('-') && !['-w', '-S', '-a', '-n', '-t'].includes(a) && !/^-S/.test(a));
  if (bad) return game.error(`vmstat: invalid option -- '${bad.replace(/^-+/, '')[0]}'\n\nUsage:\n vmstat [options] [delay [count]]`, 1);
  const busy = (cpu(game)?.load?.[0] ?? 0.05) * 100 / (cpu(game)?.cores ?? 2);
  const us = Math.min(99, Math.round(busy));
  const row = [1, 0, 0, k(m.free), 2348, k(m.cache), 0, 0, 12, 8, 50, 80, us, 1, Math.max(0, 99 - us - 1), 0, 0, 0];
  const widths = [2, 2, 6, 6, 6, 6, 4, 4, 5, 5, 4, 4, 2, 2, 2, 2, 2, 2];
  return [
    'procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------',
    ' r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu',
    row.map((v, i) => String(v).padStart(widths[i])).join(' '),
  ].join('\n');
}

function lscpu({ game }: Context): string {
  const n = cpu(game)?.cores ?? 2;
  const rows: [string, string][] = [
    ['Architecture:', 'x86_64'],
    ['CPU op-mode(s):', '32-bit, 64-bit'],
    ['Address sizes:', '40 bits physical, 48 bits virtual'],
    ['Byte Order:', 'Little Endian'],
    ['CPU(s):', String(n)],
    ['On-line CPU(s) list:', n > 1 ? `0-${n - 1}` : '0'],
    ['Vendor ID:', 'AuthenticAMD'],
    ['Model name:', 'AMD EPYC Processor'],
    ['CPU family:', '23'],
    ['Model:', '49'],
    ['Thread(s) per core:', '1'],
    ['Core(s) per socket:', String(n)],
    ['Socket(s):', '1'],
    ['BogoMIPS:', '5988.75'],
    ['Hypervisor vendor:', 'KVM'],
    ['Virtualization type:', 'full'],
    ['L1d cache:', `${32 * n} KiB (${n} instance${n > 1 ? 's' : ''})`],
    ['L2 cache:', `${512 * n} KiB (${n} instance${n > 1 ? 's' : ''})`],
    ['NUMA node(s):', '1'],
    ['NUMA node0 CPU(s):', n > 1 ? `0-${n - 1}` : '0'],
  ];
  return rows.map(([a, b]) => `${a.padEnd(41)}${b}`).join('\n');
}

function timeout({ args, game, input, last }: Context): string {
  let k = 0;
  let signal = 'TERM';
  for (; k < args.length && args[k].startsWith('-'); k++) {
    if (args[k] === '-s' || args[k] === '--signal') signal = args[++k] ?? 'TERM';
    else if (args[k] === '-k' || args[k] === '--kill-after') k++;
    else if (args[k] === '--preserve-status' || args[k] === '--foreground' || args[k] === '-v' || args[k] === '--verbose') continue;
    else return usage(game, 'timeout', `invalid option -- '${args[k][1]}'`, 125);
  }
  const [limit, ...command] = args.slice(k);
  if (!limit) return usage(game, 'timeout', 'missing operand', 125);
  const seconds = duration(limit);
  if (seconds === null) return usage(game, 'timeout', `invalid time interval '${limit}'`, 125);
  if (!command.length) return usage(game, 'timeout', `missing operand after '${limit}'`, 125);
  const [name] = command;
  if (!COMMANDS[name] || !game.known().includes(name)) return game.error(`timeout: failed to run command '${name}': No such file or directory`, 127);
  // sleep longer than the limit: killed when time is up (124; 137 for KILL).
  if (name === 'sleep' && seconds > 0) {
    const wanted = command.slice(1).reduce((t, a) => t + (duration(a) ?? 0), 0);
    if (wanted > seconds) {
      game.status = signal === 'KILL' || signal === '9' ? 137 : 124;
      return '';
    }
  }
  const out = game.run(command, input, last);
  return out;
}

/** A duration as timeout and sleep read it: a number, then s, m, h or d. */
function duration(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2]]!;
}

// install: copies with chosen rights, owner and group; -d creates directories.
function install({ args, game }: Context): string {
  let mode: string | null = null;
  let owner: string | undefined;
  let group: string | undefined;
  let directories = false;
  let leading = false;
  const operands: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-m' || a === '--mode') mode = args[++k] ?? '';
    else if (a.startsWith('--mode=')) mode = a.slice(7);
    else if (a === '-o' || a === '--owner') owner = args[++k];
    else if (a === '-g' || a === '--group') group = args[++k];
    else if (/^-[dDvpCc]+$/.test(a)) {
      if (a.includes('d')) directories = true;
      if (a.includes('D')) leading = true;
    } else if (a.startsWith('-') && a !== '-') return usage(game, 'install', `invalid option -- '${a[1]}'`);
    else operands.push(a);
  }
  if (!operands.length) return usage(game, 'install', 'missing file operand');
  if ((owner || group) && game.who !== 'root') return game.error(`install: cannot change ownership of '${operands.at(-1)}': Operation not permitted`, 1);
  if (owner && !game.accounts.users[owner]) return game.error(`install: invalid user '${owner}'`, 1);
  if (group && !game.accounts.groups[group]) return game.error(`install: invalid group '${group}'`, 1);
  const rights = (n: Node, fallback: string) => {
    const m = mode === null ? fallback : (applyMode(n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--', mode) ?? fallback);
    n.mode = m;
    n.owner = owner ?? game.who;
    n.group = group;
  };
  if (mode !== null && !applyMode('rw-r--r--', mode)) return game.error(`install: invalid mode '${mode}'`, 1);
  const makeDirs = (path: string) => {
    const parts = game.resolve(path).split('/').filter(Boolean);
    let p = '';
    for (const part of parts) {
      p += `/${part}`;
      if (!game.find(p)) {
        const n: Node = { type: 'directory', children: {} };
        rights(n, 'rwxr-xr-x');
        const error = game.place('install', p, n);
        if (error) return void game.error(`install: cannot create directory '${path}': Permission denied`, 1);
      }
    }
  };
  if (directories) {
    for (const d of operands) makeDirs(d);
    return '';
  }
  if (operands.length < 2) return usage(game, 'install', `missing destination file operand after '${operands[0]}'`);
  const dest = operands.at(-1)!;
  const sources = operands.slice(0, -1);
  if (leading) makeDirs(sources.length > 1 ? dest : dest.replace(/\/[^/]*$/, '') || '/');
  const destNode = game.find(dest);
  if (sources.length > 1 && destNode?.type !== 'directory') return game.error(`install: target '${dest}' is not a directory`, 1);
  for (const s of sources) {
    const n = game.find(s);
    if (!n) {
      game.error(`install: cannot stat '${s}': No such file or directory`, 1);
      continue;
    }
    if (n.type === 'directory') {
      game.error(`install: omitting directory '${s}'`, 1);
      continue;
    }
    if (!game.can(n, 'r')) {
      game.error(`install: cannot open '${s}' for reading: Permission denied`, 1);
      continue;
    }
    const target = destNode?.type === 'directory' ? `${dest.replace(/\/$/, '')}/${game.name(s)}` : dest;
    const copy: File = { type: 'file', content: content(n, game), lines: n.lines, ...(n.charset ? { charset: n.charset } : {}), ...(n.size !== undefined ? { size: n.size } : {}), mtime: nowOf(game) };
    rights(copy, 'rwxr-xr-x');
    if (game.find(target)) game.erase(target);
    const error = game.place('install', target, copy);
    if (error) game.error(`install: cannot create regular file '${target}': Permission denied`, 1);
  }
  return '';
}

// ——— File attributes: chattr, lsattr ———

// lsattr's 22 columns (e2fsprogs 1.47): i in the 5th, a in the 6th, e (extents) in the 15th.
const FLAGS = 'suSDiadAcEjItTeCxFNPVm';
const attributeLine = (n: Node) => {
  const set = new Set([...(n.attributes ?? ''), 'e']);
  return [...FLAGS.slice(0, 22)].map((f) => (set.has(f) ? f : '-')).join('');
};

function chattr({ args, game }: Context): string {
  const changes = args.filter((a) => /^[-+=][a-zA-Z]+$/.test(a) && !/^-[RVf]+$/.test(a));
  const recursive = args.some((a) => /^-[RVf]*R[RVf]*$/.test(a));
  const files = args.filter((a) => !changes.includes(a) && !/^-[RVf]+$/.test(a));
  if (!changes.length || !files.length) return game.error('Usage: chattr [-RVf] [-+=aAcCdDeijPsStTuFx] [-p project] [-v version] files...', 1);
  const unknown = changes.flatMap((c) => [...c.slice(1)]).find((l) => !'aAcCdDeijPsStTuFxm'.includes(l));
  if (unknown) return game.error(`chattr: invalid attribute character -- '${unknown}'\nUsage: chattr [-RVf] [-+=aAcCdDeijPsStTuFx] [-p project] [-v version] files...`, 1);
  const apply = (n: Node, path: string) => {
    // Setting i or a takes CAP_LINUX_IMMUTABLE: root only; the owner may change the others.
    const special = changes.some((c) => /[ia]/.test(c.slice(1)) || c[0] === '=');
    if (game.who !== 'root' && (special || (n.owner ?? game.player) !== game.who)) return void game.error(`chattr: Operation not permitted while setting flags on ${path}`, 1);
    let set = new Set(n.attributes ?? '');
    for (const c of changes) {
      const letters = [...c.slice(1)].filter((l) => l !== 'e');
      if (c[0] === '=') set = new Set(letters);
      else for (const l of letters) c[0] === '+' ? set.add(l) : set.delete(l);
    }
    n.attributes = [...set].join('') || undefined;
    if (!n.attributes) delete n.attributes;
    if (recursive && n.type === 'directory') for (const [k, child] of Object.entries(n.children)) apply(child, `${path}/${k}`);
  };
  for (const f of files) {
    const n = game.find(f);
    if (!n) game.error(`chattr: No such file or directory while trying to stat ${f}`, 1);
    else apply(n, f);
  }
  return '';
}

function lsattr({ args, game }: Context): string {
  const { letters, rest } = options(args);
  const bad = [...letters].find((l) => !'dRa'.includes(l));
  if (bad) return game.error(`lsattr: invalid option -- '${bad}'\nUsage: lsattr [-RVadlpv] [files...]`, 1);
  const out: string[] = [];
  const show = (path: string) => {
    const n = game.find(path);
    if (!n) return void game.error(`lsattr: No such file or directory while trying to stat ${path}`, 1);
    if (n.type === 'directory' && !letters.has('d')) {
      for (const [k, child] of Object.entries(n.children)) {
        if (k.startsWith('.') && !letters.has('a')) continue;
        out.push(`${attributeLine(child)} ${path === '.' ? '.' : path.replace(/\/$/, '')}/${k}`);
      }
      return;
    }
    out.push(`${attributeLine(n)} ${path}`);
  };
  for (const p of rest.length ? rest : ['.']) show(p);
  return out.join('\n');
}

// ——— Stopping the machine ———

function powerOff(game: Shell, verb: 'poweroff' | 'halt' | 'reboot'): string {
  if (game.who !== 'root') return game.error(game.t(`${verb === 'reboot' ? 'reboot' : 'poweroff'}-refuse`), 1);
  const sd = systemd(game);
  // The game's machines come back: the host's console powers them on again.
  if (sd) restart(game, sd);
  game.state.poweredOff = ((game.state.poweredOff as number | undefined) ?? 0) + 1;
  game.reboot = true;
  return '';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const stamp = (ms: number) => {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
};

function shutdown({ args, game }: Context): string {
  const flags = args.filter((a) => a.startsWith('-'));
  const words = args.filter((a) => !a.startsWith('-'));
  const reboot = flags.some((f) => f === '-r' || f === '--reboot');
  const cancel = flags.includes('-c');
  const bad = flags.find((f) => !['-r', '--reboot', '-h', '-H', '--halt', '-P', '--poweroff', '-c', '-k', '--no-wall'].includes(f));
  if (bad) return game.error(`shutdown: invalid option -- '${bad.replace(/^-+/, '')[0]}'`, 1);
  if (game.who !== 'root') return game.error(game.t('shutdown-refuse'), 1);
  if (cancel) {
    delete game.state.shutdownScheduled;
    return '';
  }
  const when = words[0] ?? '+1';
  if (when === 'now' || when === '+0') return powerOff(game, reboot ? 'reboot' : flags.some((f) => f === '-H' || f === '--halt') ? 'halt' : 'poweroff');
  const now = nowOf(game);
  const m = /^\+(\d+)$/.exec(when);
  const hm = /^(\d{1,2}):(\d{2})$/.exec(when);
  if (!m && !hm) return game.error(`Failed to parse time specification: ${when}`, 1);
  let at = m ? now + Number(m[1]) * 60_000 : now - (now % 86_400_000) + (Number(hm![1]) * 60 + Number(hm![2])) * 60_000;
  if (at <= now) at += 86_400_000;
  at -= at % 1000;
  game.state.shutdownScheduled = { at, reboot };
  return game.error(`${reboot ? 'Reboot' : 'Shutdown'} scheduled for ${stamp(at)}, use 'shutdown -c' to cancel.`, 0);
}

// ss -s: the sockets' summary.
function ssSummary(game: Shell): string {
  const all = connections(game, { listening: true, established: true, tcp: true, udp: true });
  const tcp = all.filter((c) => c.proto === 'tcp');
  const udp = all.filter((c) => c.proto === 'udp');
  const v6 = (list: typeof all) => list.filter((c) => c.local.address.includes(':') || c.local.address === '*').length;
  const estab = tcp.filter((c) => c.state === 'ESTAB').length;
  const row = (name: string, total: number, six: number) => `${name}\t  ${String(total).padEnd(10)}${String(total - six).padEnd(10)}${String(six).padEnd(9)}`;
  return [
    `Total: ${all.length + 98}`,
    `TCP:   ${tcp.length} (estab ${estab}, closed 0, orphaned 0, timewait 0)`,
    '',
    'Transport Total     IP        IPv6',
    row('RAW', 0, 0),
    row('UDP', udp.length, v6(udp)),
    row('TCP', tcp.length, v6(tcp)),
    row('INET', all.length, v6(all)),
    row('FRAG', 0, 0),
  ].join('\n');
}

export const SMALL_TOOLS: Record<string, Command> = {
  // sleep: the story decides what the wait means (state.slept: The Bike Share's Prometheus, The Pool's cluster).
  sleep: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (!args.length) return game.error("sleep: missing operand\nTry 'sleep --help' for more information.");
      let total = 0;
      for (const a of args) {
        const m = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(a);
        if (!m) return game.error(`sleep: invalid time interval '${a}'\nTry 'sleep --help' for more information.`);
        total += Number(m[1]) * { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2]]! * 1000;
      }
      // The story decides what the wait means (state.onSleep: time passes); elsewhere, it returns at once.
      game.state.slept = (game.state.slept ?? 0) + total;
      return '';
    },
  },

  basename: { ownOptions: true, launch: basename },
  dirname: { ownOptions: true, launch: dirname },
  realpath: { ownOptions: true, launch: realpath },
  yes: { ownOptions: true, launch: yes },
  tac: { launch: tac },
  nl: { ownOptions: true, launch: nl },
  column: { ownOptions: true, launch: column },
  paste: { ownOptions: true, launch: paste },
  cmp: { ownOptions: true, launch: cmp },
  whereis: { launch: whereis },
  more: { launch: more },
  vmstat: { ownOptions: true, launch: vmstat },
  lscpu: { launch: lscpu },
  sync: { launch: () => '' },
  timeout: { ownOptions: true, launch: timeout },
  install: { ownOptions: true, launch: install },
  chattr: { ownOptions: true, section: 1, launch: chattr },
  lsattr: { launch: lsattr },
  shutdown: { ownOptions: true, section: 8, launch: shutdown },
  poweroff: { section: 8, launch: ({ game }) => powerOff(game, 'poweroff') },
  halt: { section: 8, launch: ({ game }) => powerOff(game, 'halt') },
};

export { ssSummary };
