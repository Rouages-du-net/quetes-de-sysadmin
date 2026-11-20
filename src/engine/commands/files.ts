// File commands: moving around, reading, creating, copying, deleting,
// permissions, archives, disk space.

import { isBsd } from '../freebsd';
import { shownOwner } from '../nfs';
import { cifsShown, cifsUsage } from '../cifs';
import type { File, Node, Rights } from '../world';
import { nowOf } from '../time';
import type { Shell } from '../shell';
import { applyMode, appendOnly, compareNames, content, glob, immutable, octal, readable, modeWithMask, options, sizeFor } from '../tools';
import { ghostPlace } from '../open-files';
import { colourise, lsColour, visibleWidth, readColour, invalidColourMessage, sgr } from '../colours';
import { COMMANDS, type Command, type Context } from './index';
import { escape } from './builtins';
import { lan } from '../lan';
import { baseLan, isDebian } from '../debian';

// Shell builtins: which doesn't find them.
const BUILT_IN = ['cd', 'exit', 'umask', 'echo', 'pwd', 'help', 'aide', 'test', 'history', 'type', 'command'];

// A file's inode number (ls -i): one per node, given on the first
// request. Two names for the same node (hard link) have the same number.
const INODES = new WeakMap<Node, number>();
let nextInode = 1_311_201;
export const inode = (n: Node) => {
  if (!INODES.has(n)) INODES.set(n, nextInode++);
  return INODES.get(n)!;
};

// tar -tv's date: 2027-01-01 09:30.
const isoMinute = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
// tar -cvv, -xvv: the long listing, like -tv (one -v alone gives the names).
const hasDoubleV = (args: string[]) => args.filter((a) => /^-[A-Za-z]+$/.test(a)).join('').split('v').length > 2;

const modeFor = (n: Node) => n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');

// The name of an ls entry, in colour if ls colours (see couleurs.ts).
type Paint = (name: string, n: Node) => string;
const withoutPainting: Paint = (name) => name;
const painting = (enabled: boolean): Paint => (enabled ? (name, n) => sgr(lsColour(name, n.type, n.type === 'file' && n.link !== undefined, modeFor(n)), name) : withoutPainting);

// ls -F: what kind of entry it is, after its name (/ place, @ link, * executable).
const classify = (n: Node) =>
  n.type === 'directory' ? '/' : n.link !== undefined ? '@' : /x/.test(modeFor(n)) ? '*' : '';

// The date of ls -l (GNU coreutils): "Nov 20 14:54" within six months
// (and not in the future), "Nov 20  2025" otherwise; in French, "20 nov.  14:54".
const SIX_MONTHS = 15_778_476_000;
export function lsDate(game: Shell, mtime: number | undefined): string {
  const now = nowOf(game);
  const ms = mtime ?? now;
  const d = new Date(ms);
  const language = game.t.language;
  const months = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2027, m, 15)));
  const width = Math.max(...months.map((m) => m.length));
  const month = months[d.getUTCMonth()].padEnd(width);
  const recent = ms <= now && now - ms < SIX_MONTHS;
  const end = recent ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : ` ${d.getUTCFullYear()}`;
  const day = String(d.getUTCDate()).padStart(2);
  return language === 'en' ? `${month} ${day} ${end}` : `${day} ${month} ${end}`;
}

// The blocks a node takes on disk (KiB), for ls's "total" and du.
const blocksOf = (game: Shell, n: Node) => (n.type === 'directory' ? 4 : n.link !== undefined ? 0 : Math.ceil(sizeFor(n, game) / 4096) * 4);

// A row of "ls -l": rights, links, owner, group, size, date, name.
interface LongRow {
  mode: string;
  links: string;
  owner: string;
  group: string;
  size: string;
  date: string;
  name: string;
}
function longRow(game: Shell, name: string, n: Node, human: boolean, numeric = false, paint: Paint = withoutPainting, mark = false): LongRow {
  // -n: the numbers (uid, gid) instead of the names.
  // Through an NFS mount: the server's numbers, with this machine's names.
  // Through a Windows share (cifs): the mount's owner, group and modes.
  const share = cifsShown(game, n);
  const remote = shownOwner(game, n) ?? share;
  const ownerName = remote?.owner ?? n.owner ?? game.player;
  const groupName = remote?.group ?? n.group ?? ownerName;
  const owner = numeric ? String(game.accounts.users[ownerName]?.uid ?? ownerName) : ownerName;
  const group = numeric ? String(game.accounts.groups[groupName]?.gid ?? groupName) : groupName;
  const bytes = n.type === 'directory' ? 4096 : sizeFor(n, game);
  const size = human ? readable(bytes, game.t.language) : String(bytes);
  // A place has two links, plus one per place inside it (their ..).
  const links = n.type === 'directory' ? 2 + Object.values(n.children).filter((c) => c.type === 'directory').length : 1;
  const date = lsDate(game, n.type === 'file' ? n.mtime : undefined);
  // A symbolic link: "l", rwxrwxrwx permissions, size = length of the target path.
  if (n.type === 'file' && n.link !== undefined)
    return { mode: 'lrwxrwxrwx', links: '1', owner, group, size: String(n.link.length), date, name: `${paint(name, n)}${mark ? '@' : ''} -> ${n.link}` };
  // The / added to places stays (like ls -F): colour is never the only sign.
  const suffix = n.type === 'directory' && name !== '.' && name !== '..' ? '/' : mark ? classify(n) : '';
  return { mode: `${n.type === 'directory' ? 'd' : '-'}${share?.mode ?? modeFor(n)}`, links: String(links), owner, group, size, date, name: `${paint(name, n)}${suffix}` };
}

/** The rows of ls -l, aligned like GNU ls: each column as wide as its widest value. */
function longLines(rows: LongRow[]): string[] {
  const w = (k: keyof LongRow) => Math.max(...rows.map((r) => r[k].length));
  const [links, owner, group, size] = [w('links'), w('owner'), w('group'), w('size')];
  return rows.map((r) => `${r.mode} ${r.links.padStart(links)} ${r.owner.padEnd(owner)} ${r.group.padEnd(group)} ${r.size.padStart(size)} ${r.date} ${r.name}`);
}

// Source → (destination place, final name), like mv and cp on Linux:
// if the destination is a place, the object keeps its name there; otherwise it's a
// new name in an existing place.
function destination(game: Shell, source: string, dest: string): string {
  const target = game.find(dest);
  return target?.type === 'directory' ? `${game.resolve(dest)}/${game.name(source)}`.replace('//', '/') : game.resolve(dest);
}

// A copy: yours (or, keeping the owner, the original's), with a new date unless `dates`.
const copy = (n: Node, owner: string, keepOwner = false, dates = true): Node => {
  const who = keepOwner ? { owner: n.owner, group: n.group } : { owner, group: undefined };
  if (n.type === 'file') {
    const c: File = { ...n, ...who, read: undefined, isProtected: undefined };
    if (!dates) delete c.mtime;
    return c;
  }
  return { type: 'directory', ...who, mode: n.mode, children: Object.fromEntries(Object.entries(n.children).map(([k, e]) => [k, copy(e, owner, keepOwner, dates)])) };
};

// The order of ls's entries (GNU ls): by name, or -S by size (largest
// first), -t by modification time (newest first; a file without a date is
// recent), -X by extension, -U as they are stored; ties by name; -r reverses.
function sortEntries(game: Shell, entries: [string, Node][], letters: Set<string>): [string, Node][] {
  const size = (n: Node) => (n.type === 'directory' ? 4096 : sizeFor(n, game));
  const time = (n: Node) => (n.type === 'file' && n.mtime !== undefined ? n.mtime : Infinity);
  const extension = (name: string) => (/\.[^./]*$/.exec(name.replace(/^\./, ''))?.[0] ?? '');
  const by = letters.has('U')
    ? null
    : letters.has('S')
      ? (a: [string, Node], b: [string, Node]) => size(b[1]) - size(a[1]) || compareNames(a[0], b[0])
      : letters.has('t')
        ? (a: [string, Node], b: [string, Node]) => (time(b[1]) === time(a[1]) ? compareNames(a[0], b[0]) : time(b[1]) > time(a[1]) ? 1 : -1)
        : letters.has('X')
          ? (a: [string, Node], b: [string, Node]) => compareNames(extension(a[0]), extension(b[0])) || compareNames(a[0], b[0])
          : (a: [string, Node], b: [string, Node]) => compareNames(a[0], b[0]);
  const sorted = by ? [...entries].sort(by) : [...entries];
  return letters.has('r') ? sorted.reverse() : sorted;
}

// ls of a single place (or file).
function list({ args, game, last }: Context, paint: Paint = withoutPainting, one = false): string {
  const { letters, rest } = options(args);
  const target = rest[0] ?? '.';
  // ls -l of a link shows the link itself; without -l, ls enters the target place.
  const link = game.find(target, false);
  const n = (letters.has('l') || letters.has('n')) && link?.type === 'file' && link.link !== undefined ? link : game.find(target);
  if (!n) return game.error(game.t('ls-access-missing', { target: target }));
  const reason = game.block(target);
  if (reason) return game.error(reason);
  if (!game.traverses(target)) return game.error(game.t('ls-access-permission', { target: target }));
  // -n is a -l that shows the numbers.
  const long = letters.has('l') || letters.has('n');
  // -i: the inode number in front of each name.
  const ino = (e: Node, text: string) => (letters.has('i') ? `${String(inode(e)).padStart(7)} ${text}` : text);
  // -F: each name followed by its kind (/, @, *).
  const mark = letters.has('F');
  const row = (name: string, e: Node) => longRow(game, name, e, letters.has('h'), letters.has('n'), paint, mark);
  // -d: the place itself, not its contents.
  if (n.type === 'file' || letters.has('d')) return ino(n, long ? longLines([row(target, n)])[0] : paint(target, n) + (mark ? classify(n) : ''));
  if (!game.can(n, 'r')) return game.error(game.t('ls-open-permission', { target: target }));
  // -a: every name, . and .. included; -A: every name but . and ..
  let inputs: [string, Node][] = Object.entries(n.children).filter(([name]) => letters.has('a') || letters.has('A') || !name.startsWith('.'));
  if (letters.has('a')) inputs.unshift(['.', n], ['..', game.find(target + '/..') ?? n]);
  inputs = sortEntries(game, inputs, letters);
  if (long) {
    // First the blocks the entries take (KiB, like GNU ls), then one line each.
    const blocks = inputs.reduce((t, [, e]) => t + blocksOf(game, e), 0);
    const total = `total ${letters.has('h') ? readable(blocks * 1024, game.t.language) : blocks}`;
    const lines = longLines(inputs.map(([name, e]) => row(name, e)));
    return [total, ...inputs.map(([, e], k) => ino(e, lines[k]))].join('\n');
  }
  // The / added to places stays outside the colour (like ls -F): colour is never the only sign.
  const shows = (name: string, e: Node) => paint(name, e) + (e.type === 'directory' && name !== '.' && name !== '..' ? '/' : mark ? classify(e) : '');
  if (letters.has('i')) return inputs.map(([name, e]) => ino(e, last ? shows(name, e) : paint(name, e))).join(last && !one ? '    ' : '\n');
  // Like the real ls: in columns on screen, one name per line in a
  // pipe or a file (and without the / added to places), or with -1.
  if (!last) return inputs.map(([name, e]) => paint(name, e) + (mark ? classify(e) : '')).join('\n');
  if (one) return inputs.map(([name, e]) => shows(name, e)).join('\n');
  return inColumns(inputs.map(([name, e]) => shows(name, e)), game.columns);
}

// ls -R: a place, then each of its sub-places, each under its name.
function recursive(ctx: Context, target: string, list_: (c: Context) => string, letters: string[], first: boolean): string[] {
  const { game } = ctx;
  const block = list_({ ...ctx, args: [...letters, target] });
  const blocks = [`${target}:${block ? `\n${block}` : ''}`];
  const n = game.find(target);
  if (n?.type !== 'directory' || !game.can(n, 'r') || game.block(target)) return first && !blocks[0] ? [] : blocks;
  const all = letters.some((l) => /a|A/.test(l));
  const names = Object.keys(n.children)
    .filter((name) => (all || !name.startsWith('.')) && n.children[name].type === 'directory')
    .sort(compareNames);
  for (const name of names) blocks.push(...recursive(ctx, target === '/' ? `/${name}` : `${target.replace(/\/$/, '')}/${name}`, list_, letters, false));
  return blocks;
}

/**
 * Like GNU ls in a terminal: as many columns as possible within the
 * screen's width ($COLUMNS), filled top to bottom, each column
 * as wide as its longest name, plus two spaces.
 */
export function inColumns(names: string[], screenWidth: number): string {
  const sizes = names.map((n) => visibleWidth(n));
  for (let trial = names.length; trial >= 1; trial--) {
    const ranks = Math.ceil(names.length / trial);
    const columns = Math.ceil(names.length / ranks);
    const widths = Array.from({ length: columns }, (_, c) => Math.max(...sizes.slice(c * ranks, (c + 1) * ranks)) + (c < columns - 1 ? 2 : 0));
    if (columns > 1 && widths.reduce((a, b) => a + b, 0) > screenWidth) continue;
    const lines: string[] = [];
    for (let r = 0; r < ranks; r++) {
      let line = '';
      for (let c = 0; c < columns && r + c * ranks < names.length; c++) {
        const i = r + c * ranks;
        line += names[i] + ' '.repeat(Math.max(0, widths[c] - sizes[i]));
      }
      lines.push(line.trimEnd());
    }
    return lines.join('\n');
  }
  return names.join('\n');
}

// A yes to coreutils' questions: y, or the language's own (o for oui, like rpmatch in French).
const yes = (game: Shell, answer: string) => /^y/i.test(answer.trim()) || (game.t.language === 'fr' && /^o/i.test(answer.trim()));

// One move or copy of mv and cp: returns an error, or what -v prints.
type One = (game: Shell, source: string, dest: string, letters: Set<string>) => string | null;

// The sources one after the other; -i asks before replacing a file (the
// next ones wait for the answer), -n never replaces one.
function overwriting(game: Shell, sources: string[], dest: string, letters: Set<string>, command: 'cp' | 'mv', one: One): string {
  const said: string[] = [];
  const go = (rest: string[]): string => {
    for (let k = 0; k < rest.length; k++) {
      const source = rest[k];
      const target = game.find(source) ? destination(game, source, dest) : null;
      const exists = target !== null && game.find(target)?.type === 'file' && game.resolve(source) !== target;
      if (exists && letters.has('n')) continue;
      // -u (update): only when the source is newer than the destination (a file without a date is recent).
      if (exists && letters.has('u')) {
        const time = (n: Node | null) => (n?.type === 'file' && n.mtime !== undefined ? n.mtime : nowOf(game));
        if (time(game.find(source)) <= time(game.find(target!))) continue;
      }
      if (exists && letters.has('i') && !(command === 'mv' && letters.has('f'))) {
        const shown = game.find(dest)?.type === 'directory' ? `${dest.replace(/\/$/, '')}/${game.name(source)}` : dest;
        // The question ends with a space (Fluent trims it from the text).
        game.ask(`${game.t(`${command}-overwrite`, { target: shown })} `, (answer) => {
          if (yes(game, answer)) {
            const r = one(game, source, dest, letters);
            if (r) said.push(r);
          }
          return [said.splice(0).join('\n'), go(rest.slice(k + 1))].filter(Boolean).join('\n');
        });
        return said.splice(0).join('\n');
      }
      const r = one(game, source, dest, letters);
      if (r) said.push(r);
    }
    return said.splice(0).join('\n');
  };
  return go(sources);
}

// What -v shows of a destination: the place joined with the name, or the name given.
const shownDestination = (game: Shell, source: string, dest: string) =>
  game.find(dest)?.type === 'directory' ? `${dest.replace(/\/$/, '')}/${game.name(source)}` : dest;

const moveOne: One = (game, source, dest, letters) => {
  const n = game.find(source);
  if (!n) return game.error(game.t('mv-missing', { target: source })) || null;
  // Game simplification: objects are moved, never places.
  if (n.type === 'directory') return game.error(game.t('mv-place', { target: source })) || null;
  if (n.isProtected?.mv) return game.error(n.isProtected.mv) || null;
  const target = destination(game, source, dest);
  const reason = game.block(source) ?? game.block(target + '/..');
  if (reason) return game.error(reason) || null;
  if (game.resolve(source) === target) return null;
  if (immutable(n) || appendOnly(n) || immutable(game.find(source + '/..'))) return game.error(`mv: cannot move '${source}' to '${target}': Operation not permitted`, 1) || null;
  if (!game.writtenIn(source)) return game.error(game.t('mv-permission', { target: source })) || null;
  const error = game.place('mv', target, n);
  if (error) return game.error(error) || null;
  game.erase(source);
  return letters.has('v') ? game.t('mv-renamed', { source, destination: shownDestination(game, source, dest) }) : null;
};

const copyOne: One = (game, source, dest, letters) => {
  const n = game.find(source);
  if (!n) return game.error(game.t('cp-missing', { target: source })) || null;
  if (n.type === 'directory' && !letters.has('r')) return game.error(game.t('cp-directory', { target: source })) || null;
  const target = destination(game, source, dest);
  const reason = game.block(source) ?? game.block(target + '/..');
  if (reason) return game.error(reason) || null;
  if (game.resolve(source) === target) return game.error(game.t('cp-same-file', { source, destination: dest })) || null;
  if (!game.traverses(source) || !game.can(n, 'r')) return game.error(game.t('cp-read-permission', { target: source })) || null;
  // -p (and -a): the date stays, and root keeps the owner; otherwise the copy is new, and yours.
  const keep = letters.has('p');
  const error = game.place('cp', target, copy(n, game.who, keep && game.who === 'root', keep));
  if (error) return game.error(error) || null;
  return letters.has('v') ? `'${source}' -> '${shownDestination(game, source, dest)}'` : null;
};

// ——— find (GNU findutils 4.9: https://www.gnu.org/software/findutils/manual/html_mono/find.html) ———

type FindNode =
  | { op: 'and' | 'or'; left: FindNode; right: FindNode }
  | { op: 'not'; inner: FindNode }
  | { op: 'test'; test: (path: string, e: Node) => boolean; action?: boolean };

// The size units of -size: c bytes, w two-byte words, b 512-byte blocks (the default), k, M, G.
const FIND_UNITS: Record<string, number> = { c: 1, w: 2, b: 512, k: 1024, M: 1024 ** 2, G: 1024 ** 3 };

function find(game: Shell, args: string[]): string {
  const starts: string[] = [];
  let k = 0;
  while (k < args.length && !/^[-!(]/.test(args[k]) && args[k] !== ')') starts.push(args[k++]);
  if (!starts.length) starts.push('.');
  const tokens = args.slice(k);
  let maxDepth = Infinity;
  let minDepth = 0;
  // What the actions write, and what runs at the end (-exec … +, -delete).
  const out: string[] = [];
  const batches: { command: string[]; paths: string[] }[] = [];
  const toDelete: string[] = [];
  let hasAction = false;
  let failed = false;
  // -prune: don't go into the directory being looked at; -xdev: stay on the starting file system.
  let pruned = false;
  let xdev = false;
  const clock: number | undefined = game.state.systemd?.clock;
  const now = clock ?? 0;
  // A file without a date is recent: as old as the clock, or newer than any dated one.
  const mtime = (e: Node) => (e.type === 'file' && e.mtime !== undefined ? e.mtime : (clock ?? Infinity));
  const age = (e: Node) => (e.type === 'file' && e.mtime !== undefined ? now - e.mtime : 0);
  const fail = (message: string): never => {
    throw new FindError(message);
  };
  const need = (i: number, predicate: string) => (tokens[i] === undefined ? fail(game.t('find-argument-missing', { predicate })) : tokens[i]);
  const numeric = (v: string, predicate: string) => {
    const m = /^([+-]?)(\d+)$/.exec(v);
    if (!m) fail(game.t('find-argument-numeric', { predicate, value: v }));
    return { sign: m![1], n: Number(m![2]) };
  };
  const compare = (value: number, c: { sign: string; n: number }) => (c.sign === '+' ? value > c.n : c.sign === '-' ? value < c.n : value === c.n);
  const modeOf = (e: Node) => parseInt(octal(e.mode ?? (e.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--')), 8);

  let i = 0;
  // primary: a test, an action, ( expr ), ! primary.
  const primary = (): FindNode => {
    const t = tokens[i++];
    if (t === '(') {
      const inner = orExpr();
      if (tokens[i] !== ')') fail("find: invalid expression; I was expecting to find a ')' somewhere but did not see one.");
      i++;
      return inner;
    }
    if (t === '!' || t === '-not') return { op: 'not', inner: primary() };
    const test = (fn: (path: string, e: Node) => boolean, action = false): FindNode => ({ op: 'test', test: fn, action });
    switch (t) {
      case '-name':
      case '-iname': {
        const v = need(i++, t);
        const re = t === '-iname' ? new RegExp(glob(v).source, 'i') : glob(v);
        return test((path) => re.test(path.replace(/\/+$/, '').split('/').pop() || path));
      }
      case '-path':
      case '-wholename': {
        const re = glob(need(i++, t));
        return test((path) => re.test(path));
      }
      case '-type': {
        const v = need(i++, t);
        if (!/^[fdl](,[fdl])*$/.test(v)) fail(`find: Unknown argument to -type: ${v}`);
        const kinds = v.split(',');
        return test((path, e) => kinds.some((x) => (x === 'd' ? e.type === 'directory' : x === 'l' ? game.find(path, false)?.type === 'file' && (game.find(path, false) as File).link !== undefined : e.type === 'file' && (game.find(path, false) as File)?.link === undefined)));
      }
      case '-mtime': {
        const c = numeric(need(i++, t), t);
        // The age in whole days, rounded down (find's rule: -mtime +30 is "31 days or more").
        return test((_, e) => compare(Math.floor(age(e) / 86_400_000), c));
      }
      case '-mmin': {
        const c = numeric(need(i++, t), t);
        return test((_, e) => compare(Math.ceil(age(e) / 60_000), c));
      }
      case '-newer': {
        const v = need(i++, t);
        const ref = game.find(v);
        if (!ref) fail(game.t('find-missing', { target: v }));
        return test((_, e) => mtime(e) > mtime(ref!));
      }
      case '-size': {
        const v = need(i++, t);
        const m = /^([+-]?)(\d+)([cwbkMG]?)$/.exec(v);
        if (!m) fail(/^[+-]?\d+/.test(v) ? `find: invalid -size type \`${v.replace(/^[+-]?\d+/, '')}'` : game.t('find-argument-numeric', { predicate: t, value: v }));
        const unit = FIND_UNITS[m![3] || 'b'];
        // Sizes are rounded up to the unit: -size -1M only finds empty files.
        return test((_, e) => compare(Math.ceil((e.type === 'directory' ? 4096 : sizeFor(e, game)) / unit), { sign: m![1], n: Number(m![2]) }));
      }
      case '-perm': {
        const v = need(i++, t);
        const m = /^([-/]?)([0-7]{1,4})$/.exec(v);
        if (!m) fail(`find: invalid mode '${v}'`);
        const want = parseInt(m![2], 8);
        return test((_, e) => (m![1] === '-' ? (modeOf(e) & want) === want : m![1] === '/' ? want === 0 || (modeOf(e) & want) !== 0 : modeOf(e) === want));
      }
      case '-user': {
        const v = need(i++, t);
        if (!game.accounts.users[v] && !/^\d+$/.test(v)) fail(`find: '${v}' is not the name of a known user`);
        return test((_, e) => (e.owner ?? game.player) === v || String(game.accounts.users[e.owner ?? game.player]?.uid) === v);
      }
      case '-group': {
        const v = need(i++, t);
        if (!game.accounts.groups[v] && !/^\d+$/.test(v)) fail(`find: '${v}' is not the name of an existing group`);
        return test((_, e) => (e.group ?? e.owner ?? game.player) === v);
      }
      case '-empty':
        return test((_, e) => (e.type === 'directory' ? !Object.keys(e.children).length : sizeFor(e, game) === 0));
      case '-prune':
        return test((_, e) => {
          if (e.type === 'directory') pruned = true;
          return true;
        });
      case '-xdev':
      case '-mount':
        xdev = true;
        return test(() => true);
      // -ls: like ls -dils (inode, blocks in KiB, rights, links, owner, group, size, date, path).
      case '-ls':
        hasAction = true;
        return test((path, e) => {
          const r = longRow(game, path, game.find(path, false) ?? e, false);
          const blocks = e.type === 'directory' ? 4 : Math.ceil(sizeFor(e, game) / 4096) * 4;
          const name = r.name.replace(/\/$/, '');
          out.push(`${String(inode(e)).padStart(9)} ${String(blocks).padStart(6)} ${r.mode} ${r.links.padStart(3)} ${r.owner.padEnd(8)} ${r.group.padEnd(8)} ${r.size.padStart(8)} ${r.date} ${name}\n`);
          return true;
        }, true);
      case '-true':
        return test(() => true);
      case '-false':
        return test(() => false);
      case '-maxdepth':
      case '-mindepth': {
        const v = need(i++, t);
        if (!/^\d+$/.test(v)) fail(t === '-maxdepth' ? game.t('find-argument-numeric', { predicate: t, value: v }) : `find: Expected a positive decimal integer argument to ${t}, but got '${v}'`);
        if (t === '-maxdepth') maxDepth = Number(v);
        else minDepth = Number(v);
        return test(() => true);
      }
      case '-print':
      case '-print0':
        hasAction = true;
        return test((path) => (out.push(path + (t === '-print0' ? '\0' : '\n')), true), true);
      case '-delete':
        hasAction = true;
        return test((path) => (toDelete.push(path), true), true);
      // -printf FORMAT (GNU find): %p the path, %f the name, %s the size, %u the owner, %g the group, %m the rights in octal, \n a newline.
      case '-printf': {
        const format = need(i++, t);
        hasAction = true;
        return test((path, e) => {
          const values: Record<string, string> = {
            p: path, f: path.split('/').filter(Boolean).at(-1) ?? path, s: String(e.type === 'file' ? sizeFor(e, game) : 4096),
            u: e.owner ?? game.who, g: e.group ?? e.owner ?? game.who, m: octal(e.mode ?? (e.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--')).replace(/^(\d{3})$/, '$1'), '%': '%',
          };
          out.push(format.replace(/%([pfsugm%])/g, (_, x: string) => values[x]).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\0/g, '\0'));
          return true;
        }, true);
      }
      // -exec command {} ; (once per file) or -exec command {} + (once, with every file).
      case '-exec': {
        hasAction = true;
        const start = i;
        while (i < tokens.length && tokens[i] !== ';' && tokens[i] !== '\;' && !(tokens[i] === '+' && tokens[i - 1] === '{}')) i++;
        if (i >= tokens.length || i === start) fail(game.t('find-argument-missing', { predicate: '-exec' }));
        const command = tokens.slice(start, i);
        const plus = tokens[i++] === '+';
        if (plus) {
          const batch = { command: command.slice(0, -1), paths: [] as string[] };
          batches.push(batch);
          return test((path) => (batch.paths.push(path), true), true);
        }
        return test((path) => {
          const before = game.errorCount();
          const r = game.run(command.map((a) => a.replace(/\{\}/g, path)), null);
          if (r) out.push(r + '\n');
          const ok = (game.status ?? (game.errorCount() > before ? 1 : 0)) === 0;
          game.status = null;
          return ok;
        }, true);
      }
      default:
        return fail(t === undefined ? 'find: invalid expression' : t.startsWith('-') ? game.t('find-predicate-unknown', { predicate: t }) : `find: paths must precede expression: \`${t}'`);
    }
  };
  // and: primaries side by side (or -a, -and); or: -o, -or (weaker).
  const andExpr = (): FindNode => {
    let left = primary();
    while (i < tokens.length && tokens[i] !== ')' && tokens[i] !== '-o' && tokens[i] !== '-or') {
      if (tokens[i] === '-a' || tokens[i] === '-and') {
        i++;
        if (i >= tokens.length) fail(`find: expected an expression after '${tokens[i - 1]}'`);
      }
      left = { op: 'and', left, right: primary() };
    }
    return left;
  };
  const orExpr = (): FindNode => {
    let left = andExpr();
    while (tokens[i] === '-o' || tokens[i] === '-or') {
      i++;
      if (i >= tokens.length) fail(`find: expected an expression after '${tokens[i - 1]}'`);
      left = { op: 'or', left, right: andExpr() };
    }
    return left;
  };
  let expression: FindNode | null;
  try {
    expression = tokens.length ? orExpr() : null;
    if (i < tokens.length) fail(tokens[i] === ')' ? "find: invalid expression; you have too many ')'" : game.t('find-predicate-unknown', { predicate: tokens[i] }));
  } catch (e) {
    if (e instanceof FindError) return game.error(e.message);
    throw e;
  }
  const evaluate = (x: FindNode, path: string, e: Node): boolean => {
    if (x.op === 'test') return x.test(path, e);
    if (x.op === 'not') return !evaluate(x.inner, path, e);
    return x.op === 'and' ? evaluate(x.left, path, e) && evaluate(x.right, path, e) : evaluate(x.left, path, e) || evaluate(x.right, path, e);
  };

  const device = (path: string) => game.mount(game.resolve(path))?.path;
  let startDevice: string | undefined;
  const walk = (path: string, e: Node, level: number) => {
    pruned = false;
    if (level >= minDepth) {
      const kept = expression ? evaluate(expression, path, e) : true;
      // Without an action, the default one: -print, of what the whole expression keeps.
      if (kept && !hasAction) out.push(path + '\n');
    }
    if (e.type !== 'directory' || level >= maxDepth || pruned) return;
    // -xdev: a mount point is listed, not entered.
    if (xdev && level > 0 && device(path) !== startDevice) return;
    if (!game.can(e, 'r') || !game.can(e, 'x')) return void game.error(game.t('find-permission', { target: path }));
    for (const [name, child] of Object.entries(e.children).sort(([a], [b]) => compareNames(a, b))) walk(`${path.replace(/\/$/, '')}/${name}`, child, level + 1);
  };
  for (const start of starts) {
    const n = game.find(start);
    if (!n) {
      game.error(game.t('find-missing', { target: start }));
      failed = true;
      continue;
    }
    startDevice = device(start);
    walk(start, n, 0);
  }
  for (const b of batches) {
    if (!b.paths.length) continue;
    const r = game.run([...b.command, ...b.paths], null);
    if (r) out.push(r + '\n');
  }
  // -delete: the deepest first (-delete implies -depth).
  for (const path of toDelete.reverse()) {
    const e = game.find(path, false)!;
    if (e.type === 'directory' && Object.keys(e.children).length) game.error(game.t('find-remove-not-empty', { target: path }));
    else if (!game.writtenIn(path)) game.error(game.t('find-remove-permission', { target: path }));
    else game.erase(path);
  }
  if (failed || game.errorCount()) game.status = 1;
  return out.join('').replace(/\n$/, '');
}

class FindError extends Error {}

export const FILES: Record<string, Command> = {
  pwd: {
    launch: ({ game }) => game.cwd,
  },

  whoami: {
    launch: ({ game }) => game.who,
  },

  // umask: the permission mask of created files (a bash builtin).
  // With no argument, shows it (-S: in symbolic form); otherwise, changes it for this session.
  // history, like bash's: the commands typed on this machine, numbered
  // (!n reruns one, !! the last: see Shell.developperHistorique).
  history: {
    launch: ({ args, game }) => {
      if (args[0] === '-c') {
        game.history.length = 0;
        return '';
      }
      if (args[0] !== undefined && !/^\d+$/.test(args[0])) return game.error(`-bash: history: ${args[0]}: numeric argument required`);
      const lines = game.history.map((l, i) => `${String(i + 1).padStart(5)}  ${l}`);
      return (args[0] === undefined ? lines : lines.slice(-Number(args[0]))).join('\n');
    },
  },

  umask: {
    launch: ({ args, game }) => {
      const value = args.find((a) => !a.startsWith('-'));
      if (value) {
        if (!/^[0-7]{1,4}$/.test(value)) return game.error(`-bash: umask: ${value}: octal number out of range`);
        game.mask = value.padStart(4, '0');
        return '';
      }
      if (!args.includes('-S')) return game.mask;
      const permitted = modeWithMask(true, game.mask);
      return ['u', 'g', 'o'].map((q, i) => `${q}=${permitted.slice(i * 3, i * 3 + 3).replace(/-/g, '')}`).join(',');
    },
  },

  // which: the full path of a command (the first found in the PATH);
  // nothing, and exit code 1, for a shell builtin or an unknown command.
  which: {
    launch: ({ args, game }) => {
      const names = args.filter((a) => !a.startsWith('-'));
      const found = names.map((n) => {
        const c = COMMANDS[n];
        if (!c || c.directory || c.section === 5 || BUILT_IN.includes(n)) return null;
        return `${c.section === 8 ? '/usr/sbin' : '/usr/bin'}/${n}`;
      });
      if (found.some((x) => x === null)) game.status = 1;
      return found.filter(Boolean).join('\n');
    },
  },

  // hostname: the machine's name; -f, the full name (the first one /etc/hosts gives).
  hostname: {
    launch: ({ args, game }) => {
      const name = game.read('/etc/hostname')?.trim() || game.hostName;
      // -I: every address of the machine but loopback and link-local ones (hostname(1), net-tools 2.10).
      if (args.includes('-I') || args.includes('--all-ip-addresses')) {
        const l = lan(game) ?? (isDebian(game) ? baseLan(game) : undefined);
        if (!l) return '';
        return `${l.order.map((n) => l.interfaces[n]).filter((i) => i && i.up && i.name !== 'lo').flatMap((i) => i.addresses.map((a) => a.split('/')[0])).join(' ')} `;
      }
      // -i: the addresses the name resolves to (/etc/hosts gives Debian's 127.0.1.1).
      if (args.includes('-i') || args.includes('--ip-address')) {
        const line = (game.read('/etc/hosts') ?? '').split('\n').find((l) => l.replace(/#.*/, '').trim().split(/\s+/).slice(1).includes(name));
        return line?.trim().split(/\s+/)[0] ?? game.error(`hostname: Name or service not known`);
      }
      if (!args.includes('-f')) return name;
      const line = (game.read('/etc/hosts') ?? '').split('\n').find((l) => l.replace(/#.*/, '').trim().split(/\s+/).slice(1).includes(name));
      return line?.trim().split(/\s+/)[1] ?? name;
    },
  },

  ls: {
    launch: (raw) => {
      // --color: like the "ls --color=auto" alias of Debian's ~/.bashrc, ls colours on screen by default.
      // BSD's ls (FreeBSD) only colours with -G (or --color): no alias there.
      const bsd = isBsd(raw.game);
      const { when, args, invalid } = readColour(
        bsd ? raw.args.map((a) => (/^-[A-Za-z1,]*G/.test(a) && !a.startsWith('--') ? a.replace('G', '') : a)).filter((a) => a !== '-') : raw.args,
        bsd && !raw.args.some((a) => /^-[A-Za-z1,]*G/.test(a) && !a.startsWith('--')) ? 'never' : 'auto',
      );
      if (invalid !== undefined) return raw.game.error(invalidColourMessage(raw, 'ls', invalid));
      // -1 (one name per line) and --sort=WORD become letters the listing reads.
      const sorts: Record<string, string> = { none: 'U', time: 't', size: 'S', extension: 'X', name: '' };
      const own: string[] = [];
      for (const a of args) {
        const sort = /^--sort=(.*)$/.exec(a);
        if (sort) {
          if (!(sort[1] in sorts)) {
            raw.game.status = 2;
            return raw.game.error(`ls: invalid argument '${sort[1]}' for '--sort'\nValid arguments are:\n  - 'none'\n  - 'time'\n  - 'size'\n  - 'extension'\n  - 'version'\n  - 'width'\nTry 'ls --help' for more information.`);
          }
          if (sorts[sort[1]]) own.push(`-${sorts[sort[1]]}`);
        } else own.push(a);
      }
      // -1 is read here (the letters of options() are only letters).
      const one = own.some((a) => /^-[A-Za-z1]*1[A-Za-z1]*$/.test(a));
      const c = { ...raw, args: own.map((a) => (/^-[A-Za-z1]+$/.test(a) ? a.replace(/1/g, '') : a)).filter((a) => a !== '-' || !own.includes('-1')) };
      const paint = painting(colourise(c, when));
      const list_ = (ctx: Context) => list(ctx, paint, one);
      const { letters: set, rest } = options(c.args);
      const letters = c.args.filter((a) => /^-[A-Za-z]+$/.test(a));
      // -R: the place and every place below it.
      if (set.has('R') && !set.has('d')) {
        const targets = rest.length ? rest : ['.'];
        const files = targets.filter((r) => c.game.find(r)?.type !== 'directory');
        const blocks: string[] = files.map((f) => list_({ ...c, args: [...letters, f] })).filter(Boolean);
        for (const t of targets.filter((r) => c.game.find(r)?.type === 'directory')) blocks.push(...recursive(c, t, list_, letters, true));
        return blocks.join('\n\n');
      }
      if (rest.length <= 1) return list_(c);
      // Several targets: the files together (in columns, like the names of a place;
      // with -d, places too), then one block per place, with its name (like GNU ls).
      const isPlace = (r: string) => c.game.find(r)?.type === 'directory' && !set.has('d');
      const sortedTargets = (targets: string[]) =>
        sortEntries(
          c.game,
          targets.map((r) => [r, c.game.find(r, false) ?? ({ type: 'file', content: '' } as Node)] as [string, Node]),
          set,
        ).map(([r]) => r);
      const files = sortedTargets(rest.filter((r) => !isPlace(r)));
      const places = sortedTargets(rest.filter(isPlace));
      const shown = files.map((f) => list_({ ...c, args: [...letters, f], last: false })).filter(Boolean);
      const long = set.has('l') || set.has('n');
      const blocks: string[] = [];
      if (shown.length) blocks.push(long || one || !c.last ? shown.join('\n') : inColumns(shown, c.game.columns));
      for (const l of places) blocks.push(`${l}:\n${list_({ ...c, args: [...letters, l] })}`);
      return blocks.join('\n\n');
    },
  },

  cd: {
    launch: ({ args, game }) => {
      // cd -: back to the previous directory ($OLDPWD), which bash prints.
      if (args[0] === '-') {
        if (game.old === null) return game.error(game.t('cd-old-missing'));
        const old = game.old;
        if (game.find(old)?.type !== 'directory') return game.error(game.t('error-missing', { command: 'cd', target: old }));
        game.old = game.cwd;
        game.cwd = old;
        game.visits.add(old);
        return old;
      }
      // Without an argument: the shell's home ($HOME: /root after sudo -i).
      const target = args[0] ?? game.shellHome;
      const n = game.find(target);
      if (!n) return game.error(game.t('error-missing', { command: 'cd', target: target }));
      if (n.type !== 'directory') return game.error(game.t('cd-not-one-directory', { target: target }));
      const reason = game.block(target);
      if (reason) return game.error(reason);
      if (!game.traverses(target) || !game.can(n, 'x')) return game.error(game.t('error-permission', { command: 'cd', target: target }));
      game.old = game.cwd;
      game.cwd = game.resolve(target);
      game.visits.add(game.cwd);
      return '';
    },
  },

  cat: {
    launch: ({ args, input, game }) => {
      // -A (-vET), -E ($ at the end of each line), -T (tabs as ^I), -v (^M for a carriage return), -n (numbers).
      const { letters, rest } = options(args);
      if (letters.has('A')) ['v', 'E', 'T'].forEach((l) => letters.add(l));
      const shown = (text: string) => {
        let lines = text.split('\n');
        if (letters.has('v')) lines = lines.map((l) => l.replace(/\r/g, '^M'));
        if (letters.has('T')) lines = lines.map((l) => l.replace(/\t/g, '^I'));
        if (letters.has('E')) lines = lines.map((l) => `${l}$`);
        if (letters.has('n')) lines = lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`);
        return lines.join('\n');
      };
      if (!rest.length) return input === null ? game.error(game.t('cat-usage')) : letters.size ? shown(input) : input;
      return rest
        .map((target) => {
          const text = game.readFor('cat', target);
          if (text === null) return null;
          const n = game.find(target) as File;
          const effect = n.read?.(game);
          return [letters.size ? shown(text) : text, effect].filter(Boolean).join('\n\n');
        })
        .filter((t) => t !== null)
        .join('\n');
    },
  },

  echo: {
    // -n: no newline at the end (what follows in a pipe, base64 for one, sees the difference).
    // -e: backslash escapes (\n, \t…; \c stops the output), -E: none (the default). Like bash,
    // only leading words made of n, e and E are options.
    ownOptions: true,
    launch: ({ args }) => {
      let k = 0;
      let escapes = false;
      for (; k < args.length && /^-[neE]+$/.test(args[k]); k++) for (const l of args[k].slice(1)) if (l !== 'n') escapes = l === 'e';
      const text = args.slice(k).join(' ');
      if (!escapes) return text;
      let out = '';
      for (let i = 0; i < text.length; i++) {
        if (text[i] !== '\\') {
          out += text[i];
          continue;
        }
        if (text[i + 1] === 'c') break;
        // echo -e reads \0NNN (octal with a leading 0) and \xHH.
        const e = /^0[0-7]{0,3}/.test(text.slice(i + 1)) || !/[0-7]/.test(text[i + 1] ?? '') ? escape(text, i) : { text: '\\', end: i };
        out += e.text;
        i = e.end;
      }
      return out;
    },
  },

  tee: {
    launch: ({ args, input, game }) => {
      const { letters, rest } = options(args);
      const text = input ?? '';
      for (const target of rest) {
        const n = game.find(target);
        if (n?.type === 'file') {
          if (!game.traverses(target) || !game.can(n, 'w')) {
            game.error(game.t('error-permission', { command: 'tee', target: target }));
            continue;
          }
          if (immutable(n) || (appendOnly(n) && !letters.has('a'))) {
            game.error(`tee: ${target}: Operation not permitted`, 1);
            continue;
          }
          const before = content(n, game);
          n.content = letters.has('a') && before ? `${before}\n${text}` : text;
          n.lines = true;
          delete n.size;
        } else {
          const error = game.place('tee', target, { type: 'file', content: text, owner: game.who, lines: true });
          if (error) game.error(error);
        }
      }
      return text;
    },
  },

  // mv [-i|-n|-f] [-v] source… destination: several sources go into a place.
  mv: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      if (rest.length < 2) return game.error(game.t('mv-usage'));
      const dest = rest.at(-1)!;
      const sources = rest.slice(0, -1);
      if (sources.length > 1 && game.find(dest)?.type !== 'directory') return game.error(game.t(game.find(dest) ? 'target-not-directory' : 'target-missing', { command: 'mv', target: dest }));
      return overwriting(game, sources, dest, letters, 'mv', moveOne);
    },
  },

  // cp [-r|-R|-a] [-p] [-i|-n] [-v] source… destination.
  cp: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      // -a (archive): recursive, and keeps the rights, the dates (and the owner, for root).
      if (letters.has('a')) ['r', 'p'].forEach((l) => letters.add(l));
      if (letters.has('R')) letters.add('r');
      if (rest.length < 2) return game.error(game.t('cp-usage'));
      const dest = rest.at(-1)!;
      const sources = rest.slice(0, -1);
      if (sources.length > 1 && game.find(dest)?.type !== 'directory') return game.error(game.t(game.find(dest) ? 'target-not-directory' : 'target-missing', { command: 'cp', target: dest }));
      return overwriting(game, sources, dest, letters, 'cp', copyOne);
    },
  },

  // rm [-f] [-i] [-v] file…: -f says nothing of what is missing and never asks.
  rm: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      if (!rest.length) return letters.has('f') ? '' : game.error(game.t('rm-usage'));
      const done: string[] = [];
      const remove = (targets: string[]): string => {
        for (let k = 0; k < targets.length; k++) {
          const target = targets[k];
          // rm deletes the link itself, never its target.
          const n = game.find(target, false);
          if (!n) {
            if (!letters.has('f')) game.error(game.t('rm-missing', { target: target }));
          } else if (n.type === 'directory') {
            // -d: an empty place, like rmdir.
            if (letters.has('d') && !Object.keys(n.children).length && !letters.has('r') && !letters.has('R')) {
              if (!game.writtenIn(target)) game.error(game.t('rm-permission', { target: target }));
              else {
                game.erase(target);
                if (letters.has('v')) done.push(game.t('rm-removed-directory', { target: target }));
              }
            } else game.error(game.t('rm-directory', { target: target }));
          } else if (n.isProtected?.rm) game.error(n.isProtected.rm);
          else if (game.block(target)) game.error(game.block(target)!);
          // chattr +i or +a (on it or on its place): even root may not.
          else if (immutable(n) || appendOnly(n) || immutable(game.find(target + '/..'))) game.error(`rm: cannot remove '${target}': Operation not permitted`, 1);
          // Deleting a file means changing the place that holds it: it takes
          // write permission on that place, not on the file.
          else if (!game.writtenIn(target)) game.error(game.t('rm-permission', { target: target }));
          else if (letters.has('i') && !letters.has('f')) {
            const empty = n.type === 'file' && n.link === undefined && sizeFor(n, game) === 0;
            const key = n.type === 'file' && n.link !== undefined ? 'rm-ask-link' : empty ? 'rm-ask-empty' : 'rm-ask';
            game.ask(`${game.t(key, { target: target })} `, (answer) => {
              if (yes(game, answer)) {
                game.erase(target);
                if (letters.has('v')) done.push(game.t('rm-removed', { target: target }));
              }
              return [done.splice(0).join('\n'), remove(targets.slice(k + 1))].filter(Boolean).join('\n');
            });
            return done.splice(0).join('\n');
          } else {
            game.erase(target);
            if (letters.has('v')) done.push(game.t('rm-removed', { target: target }));
          }
        }
        return done.splice(0).join('\n');
      };
      return remove(rest);
    },
  },

  // rmdir [-p] [-v] place…: removes empty places only.
  rmdir: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args.filter((a) => a !== '--ignore-fail-on-non-empty'));
      const ignore = args.includes('--ignore-fail-on-non-empty');
      if (!rest.length) return game.error(game.t('rmdir-usage'));
      const out: string[] = [];
      const one = (target: string): boolean => {
        const n = game.find(target, false);
        const fail = (reason: string) => (game.error(game.t('rmdir-failed', { target: target, reason: game.t(reason) })), false);
        if (letters.has('v')) out.push(game.t('rmdir-removing', { target: target }));
        if (!n) return fail('rmdir-missing');
        if (n.type !== 'directory') return fail('rmdir-not-directory');
        if (Object.keys(n.children).length) return ignore ? false : fail('rmdir-not-empty');
        const reason = game.block(target);
        if (reason) return (game.error(reason), false);
        if (!game.writtenIn(target)) return fail('rmdir-permission');
        game.erase(target);
        return true;
      };
      for (const target of rest) {
        if (!one(target) || !letters.has('p')) continue;
        // -p: then each parent named in the path, as long as it is empty.
        const parts = target.replace(/\/+$/, '').split('/');
        for (let k = parts.length - 1; k > 0; k--) if (!one(parts.slice(0, k).join('/') || '/')) break;
      }
      return out.join('\n');
    },
  },

  // ln: symbolic (-s) or hard link. Like coreutils: if the
  // destination is a place, the link takes the target's name there; the target
  // path is stored as is (relative to the link's place, not the current place).
  ln: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      if (!rest.length) return game.error(game.t('ln-operand-missing'));
      const [target, dest = '.'] = rest;
      // -n: if the destination is a link to a place, the link is replaced
      // instead of entering the place (ln -sfn, to switch a "current" link).
      const place = letters.has('n') ? game.find(dest, false) : game.find(dest);
      const path = place?.type === 'directory' ? `${game.resolve(dest)}/${target.replace(/\/$/, '').split('/').at(-1)}` : game.resolve(dest);
      const shows = place?.type === 'directory' ? path : dest;
      const symbolic = letters.has('s');
      const what = symbolic ? 'ln-impossible-symbolic' : 'ln-impossible-physical';
      if (game.find(path, false)) {
        if (!letters.has('f')) return game.error(game.t(what, { target: shows, reason: game.t('ln-exists') }));
        if (!game.writtenIn(path)) return game.error(game.t(what, { target: shows, reason: game.t('ln-permission') }));
        game.erase(path);
      }
      if (!symbolic) {
        const source = game.find(target);
        if (!source) return game.error(game.t('ln-access-impossible', { target: target }));
        if (source.type === 'directory') return game.error(game.t('ln-physical-directory', { target: target }));
      }
      if (game.find(path + '/..')?.type !== 'directory') return game.error(game.t(what, { target: shows, reason: game.t('ln-missing') }));
      if (!game.writtenIn(path)) return game.error(game.t(what, { target: shows, reason: game.t('ln-permission') }));
      // A hard link is a second name for the same file: the same node.
      const node: Node = symbolic ? { type: 'file', content: '', link: target, owner: game.who } : game.find(target)!;
      const parent = game.find(path + '/..');
      if (parent?.type === 'directory') parent.children[game.name(path)] = node;
      return letters.has('v') ? `'${shows}' -> '${target}'` : '';
    },
  },

  touch: {
    launch: ({ args, game }) => {
      if (!args.length) return game.error(game.t('touch-usage'));
      for (const target of args) {
        const there = game.find(target);
        if (there && (immutable(there) || appendOnly(there))) game.error(`touch: cannot touch '${target}': Operation not permitted`, 1);
        else if (there && game.who !== 'root' && !game.can(there, 'w') && (there.owner ?? game.player) !== game.who) game.error(`touch: cannot touch '${target}': Permission denied`, 1);
        // An existing file: its date becomes now.
        else if (there?.type === 'file') there.mtime = nowOf(game);
        if (there) continue;
        const error = game.place('touch', target, { type: 'file', content: '', owner: game.who });
        if (error) game.error(error);
      }
      return '';
    },
  },

  mkdir: {
    launch: ({ args, game }) => {
      // -p: also creates the parent places, with no error if they already exist.
      const parents = args.includes('-p') || args.includes('--parents');
      const targets = args.filter((a) => a !== '-p' && a !== '--parents');
      if (!targets.length) return game.error(game.t('mkdir-usage'));
      for (const target of targets) {
        if (parents) {
          const chunks = game.resolve(target).split('/').filter(Boolean);
          for (let i = 1; i <= chunks.length; i++) {
            const path = '/' + chunks.slice(0, i).join('/');
            const n = game.find(path);
            if (n?.type === 'directory') continue;
            const error = n ? game.t('mkdir-exists', { target: path }) : game.place('mkdir', path, { type: 'directory', children: {}, owner: game.who });
            if (error) {
              game.error(error);
              break;
            }
          }
        } else if (game.exists(target)) game.error(game.t('mkdir-exists', { target: target }));
        else {
          const error = game.place('mkdir', target, { type: 'directory', children: {}, owner: game.who });
          if (error) game.error(error);
        }
      }
      return '';
    },
  },

  chmod: {
    // -R (recursive); the other arguments starting with "-" are
    // modes (chmod -w file), as with the real chmod.
    ownOptions: true,
    launch: ({ args, game }) => {
      const recursive = args.some((a) => a === '-R' || a === '--recursive');
      const [rights, ...targets] = args.filter((a) => a !== '-R' && a !== '--recursive');
      if (!rights || !targets.length) return game.error(game.t('chmod-usage'));
      const apply = (n: Node) => {
        const fresh = applyMode(modeFor(n), rights);
        if (fresh) n.mode = fresh;
        if (recursive && n.type === 'directory') Object.values(n.children).forEach(apply);
        return fresh;
      };
      for (const target of targets) {
        const n = game.find(target);
        if (!n) game.error(game.t('chmod-access-missing', { target: target }));
        else if (!game.traverses(target)) game.error(game.t('chmod-access-permission', { target: target }));
        else if (game.who !== 'root' && (n.owner ?? game.player) !== game.who) game.error(game.t('chmod-not-allowed', { target: target }));
        else if (immutable(n) || appendOnly(n)) game.error(`chmod: changing permissions of '${target}': Operation not permitted`, 1);
        else if (!applyMode(modeFor(n), rights)) game.error(game.t('chmod-mode-incorrect', { permissions: rights }));
        else apply(n);
      }
      return '';
    },
  },

  // find [place…] [expression]: GNU find's tests, actions and operators (see findExpression).
  find: { ownOptions: true, launch: ({ args, game }) => find(game, args) },

  du: {
    launch: ({ args, game }) => {
      // --inodes: count files (and places) instead of bytes; -d N (--max-depth=N): show only N levels.
      const inodes = args.includes('--inodes');
      // --apparent-size (and -b): the bytes the files hold, not the 4 KiB blocks they take on the disk.
      const apparent = args.includes('--apparent-size');
      let depth = Infinity;
      const raw: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--inodes' || args[i] === '--apparent-size') continue;
        if (args[i] === '-d') depth = Number(args[++i]);
        else if (args[i].startsWith('--max-depth=')) depth = Number(args[i].slice(12));
        else raw.push(args[i]);
      }
      if (Number.isNaN(depth)) return game.error(game.t('depth'));
      const { letters, rest } = options(raw);
      // -b (GNU): the apparent size in bytes.
      const fmt = (o: number) => (inodes || letters.has('b') ? String(o) : letters.has('h') ? readable(o, game.t.language) : String(Math.ceil(o / 1024)));
      const lines: string[] = [];
      // Like du: a file with several names (hard links) is counted only once.
      const seen = new Set<Node>();
      let grand = 0;
      const walk = (path: string, e: Node, level = 0): number => {
        if (e.type === 'file') {
          if (seen.has(e)) return 0;
          seen.add(e);
          const bytes = sizeFor(e, game);
          // Like GNU du on ext4: whole 4 KiB blocks (an empty file takes none, a symbolic link none here).
          const size = inodes ? 1 : apparent || letters.has('b') ? bytes : e.link !== undefined ? 0 : Math.ceil(bytes / 4096) * 4096;
          // -a: every file too, not only places.
          if (letters.has('a') && !letters.has('s') && level > 0 && level <= depth) lines.push(`${fmt(size)}\t${path}`);
          return size;
        }
        // A directory takes its own block.
        let total = inodes ? 1 : 4096;
        for (const [k, child] of Object.entries(e.children)) total += walk(`${path.replace(/\/$/, '')}/${k}`, child, level + 1);
        if (!letters.has('s') && level <= depth) lines.push(`${fmt(total)}\t${path}`);
        return total;
      };
      for (const target of rest.length ? rest : ['.']) {
        const n = game.find(target);
        if (!n) {
          game.error(game.t('missing', { target: target }));
          continue;
        }
        const total = walk(target, n);
        grand += total;
        if (letters.has('s') || n.type === 'file') lines.push(`${fmt(total)}\t${target}`);
      }
      // -c: a grand total at the end.
      if (letters.has('c')) lines.push(`${fmt(grand)}\ttotal`);
      return lines.join('\n');
    },
  },

  df: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const fmt = (o: number) => (letters.has('h') ? readable(o, game.t.language) : String(Math.ceil(o / 1024)));
      const mounts: { path: string; capacity: number; name: string; inodes?: number; inodesBase?: number; bytesBase?: number; pseudo?: boolean }[] = (game.state.mounts ?? []).filter((m: { pseudo?: boolean }) => !m.pseudo);
      const chosen = (rest.length ? rest.map((r) => game.mount(game.resolve(r))).filter(Boolean) : mounts) as typeof mounts;
      // -i: inodes (one per file or place) instead of bytes.
      if (letters.has('i')) {
        // -h with -i: 64K rather than 65536, like GNU df -ih.
        const n = (v: number) => (letters.has('h') ? readable(v, game.t.language) : String(v));
        const iLines = [game.t('df-header-inodes')];
        for (const m of chosen) {
          const total = m.inodes ?? Math.round(m.capacity / 16384);
          const taken = Math.min(total, game.usedInodes(m));
          const pct = Math.ceil((100 * taken) / total);
          iLines.push(
            `${(m.name ?? m.path).padEnd(18)} ${n(total).padStart(7)} ${n(taken).padStart(7)} ${n(total - taken).padStart(7)} ${String(pct).padStart(4)}% ${m.path}`,
          );
        }
        return iLines.join('\n');
      }
      // -T: the file system's type, after its name.
      const typed = (line: string, type: string) => (letters.has('T') ? `${line.slice(0, 19)}${type.padEnd(7)} ${line.slice(19)}` : line);
      const lines = [typed(game.t('df-header'), game.t('df-type'))];
      for (const m of chosen as (typeof mounts[number] & { system?: string })[]) {
        const place = game.find(m.path);
        // Deleted files still held open by a process still take up their space.
        // Not counting the other media mounted inside (/srv/radio isn't on /).
        const inside = mounts.filter((x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')));
        const other = inside.reduce((t, x) => t + ((n) => (n ? game.size(n) : 0))(game.find(x.path)), 0);
        // A Windows share (cifs): the server's volume, as the server counts it.
        const remote = cifsUsage(game, m.path);
        const capacity = remote?.capacity ?? m.capacity;
        const inUse = remote ? Math.min(capacity, remote.used) : Math.min(m.capacity, (place ? game.size(place) : 0) - other + ghostPlace(game, m.path) + (m.bytesBase ?? 0));
        const pct = Math.round((100 * inUse) / capacity);
        lines.push(
          typed(`${(m.name ?? m.path).padEnd(18)} ${fmt(capacity).padStart(6)} ${fmt(inUse).padStart(7)} ${fmt(Math.max(0, capacity - inUse)).padStart(6)} ${String(pct).padStart(3)}% ${m.path}`, remote ? 'cifs' : (m.system ?? 'ext4')),
        );
      }
      return lines.join('\n');
    },
  },

  tar: {
    launch: ({ args: typed, game }) => {
      // The old style (tar czf archive.tgz place, tar xvf archive.tar): a first word
      // without a dash holds the letters (GNU tar, "Old Options").
      const args = typed.length && /^[A-Za-z]+$/.test(typed[0]) && /[ctx]/.test(typed[0]) ? [`-${typed[0]}`, ...typed.slice(1)] : typed;
      // -C place (or --directory=place): move to that place before extracting.
      let cPlace = '';
      const withoutC: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-C') cPlace = args[++i] ?? '';
        else if (args[i].startsWith('--directory=')) cPlace = args[i].slice('--directory='.length);
        else if (args[i] === '--gzip' || args[i] === '--gunzip') withoutC.push('-z');
        else if (args[i] === '--bzip2') withoutC.push('-j');
        else if (args[i] === '--xz') withoutC.push('-J');
        else if (args[i] === '--auto-compress') withoutC.push('-a');
        else withoutC.push(args[i]);
      }
      const { letters, rest } = options(withoutC);
      if (!letters.has('f') || !rest.length) return game.error(game.t('tar-usage'));
      const [archiveName, ...sources] = rest;
      // The compression asked: -z (gzip), -j (bzip2), -J (xz); -a guesses it from the archive's suffix.
      const bySuffix = /\.(tgz|tar\.gz)$/.test(archiveName) ? 'gzip' : /\.(tbz2?|tar\.bz2)$/.test(archiveName) ? 'bzip2' : /\.(txz|tar\.xz)$/.test(archiveName) ? 'xz' : null;
      const asked: 'gzip' | 'bzip2' | 'xz' | null = letters.has('z') ? 'gzip' : letters.has('j') ? 'bzip2' : letters.has('J') ? 'xz' : letters.has('a') ? bySuffix : null;
      const now = nowOf(game);
      // A line of tar -tv: rights, owner/group, size, date, name (GNU tar's widths).
      const long = (path: string, r: Rights & { mtime?: number }, directory: boolean, bytes: number) => {
        const ug = `${r.owner ?? game.player}/${r.group ?? r.owner ?? game.player}`;
        const width = Math.max(19, ug.length + 1 + String(bytes).length);
        return `${directory ? 'd' : '-'}${r.mode ?? (directory ? 'rwxr-xr-x' : 'rw-r--r--')} ${ug}${String(bytes).padStart(width - ug.length)} ${isoMinute(r.mtime ?? now)} ${path}`;
      };
      if (letters.has('c')) {
        if (!sources.length) return game.error(game.t('tar-archive-empty'));
        const files: Record<string, File> = {};
        const dirs: Record<string, Rights & { mtime?: number }> = {};
        const entries: string[] = [];
        const add = (path: string, e: Node) => {
          if (e.type === 'file') {
            if (!game.can(e, 'r')) return void game.error(game.t('error-permission', { command: 'tar', target: path }));
            files[path] = { ...e, read: undefined, mtime: e.mtime ?? now } as File;
            entries.push(path);
          } else {
            const dir = `${path.replace(/\/$/, '')}/`;
            dirs[dir] = { owner: e.owner, group: e.group, mode: e.mode, mtime: now };
            entries.push(dir);
            for (const [k, child] of Object.entries(e.children)) add(`${path.replace(/\/$/, '')}/${k}`, child);
          }
        };
        for (const s of sources) {
          const e = game.find(s);
          if (!e) game.error(game.t('error-missing', { command: 'tar', target: s }));
          else add(s.replace(/^\.?\/+/, ''), e);
        }
        const compressed = asked !== null;
        // Size: a 512-byte header per entry; gzip shrinks text a lot
        // (to about a third) and images, sounds and videos hardly at all,
        // since they are already compressed.
        const already = /\.(png|jpe?g|gif|webp|mp3|ogg|mp4|webm|zip|gz|pdf)$/i;
        const size = Object.entries(files).reduce((t, [path, f]) => {
          const raw = sizeFor(f, game);
          return t + 512 + (compressed ? Math.round(raw * (already.test(path) ? 0.98 : asked === 'gzip' ? 0.35 : 0.3)) : raw);
        }, 512 * Object.keys(dirs).length);
        const archive: File = {
          type: 'file',
          content: '',
          size,
          owner: game.who,
          mtime: now,
          archive: { files, compressed, ...(asked && asked !== 'gzip' ? { format: asked } : {}), dirs, entries },
        };
        const error = game.place('tar', archiveName, archive);
        if (error) return game.error(error);
        return letters.has('v') ? entries.map((p) => (!hasDoubleV(withoutC) ? p : Object.hasOwn(dirs, p) ? long(p, dirs[p], true, 0) : long(p, files[p], false, sizeFor(files[p], game)))).join('\n') : '';
      }
      const n = game.find(archiveName);
      if (!n) return game.error(game.t('tar-open-impossible', { target: archiveName }));
      if (n.type !== 'file' || !n.archive) return game.error(game.t('tar-not-one-archive', { target: archiveName }));
      // Reading, tar recognises the compression by itself; a wrong -z/-j/-J makes the decompressor fail.
      const real = n.archive.compressed ? (n.archive.format ?? 'gzip') : null;
      if (asked && asked !== real) {
        const complaint = asked === 'gzip' ? 'gzip: stdin: not in gzip format' : asked === 'bzip2' ? 'bzip2: (stdin) is not a bzip2 file.' : 'xz: (stdin): File format not recognized';
        return game.error(`\n${complaint}\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now`, 2);
      }
      // A truncated archive (disk full, machine turned off while writing):
      // tar reads what comes before the cut, then stops on an error.
      const { truncated } = n.archive;
      const dirs = n.archive.dirs ?? {};
      const fileEntries = Object.entries(n.archive.files).slice(0, truncated);
      const order = (n.archive.entries ?? Object.keys(n.archive.files)).filter((p) => Object.hasOwn(dirs, p) || fileEntries.some(([f]) => f === p));
      const verbose = (p: string) => {
        if (!letters.has('v')) return p;
        if (Object.hasOwn(dirs, p)) return long(p, dirs[p], true, 0);
        const f = n.archive!.files[p];
        return long(p, f, false, sizeFor(f, game));
      };
      const cut = () => {
        game.state.truncatedArchive = game.resolve(archiveName);
        game.error(game.t('tar-truncated'));
      };
      if (letters.has('t')) {
        const listing = order.map(verbose).join('\n');
        if (truncated === undefined) return listing;
        // The list, then the error where the archive was cut.
        game.state.truncatedArchive = game.resolve(archiveName);
        return game.error([listing, game.t('tar-truncated')].filter(Boolean).join('\n'));
      }
      if (letters.has('x')) {
        const base = cPlace || '.';
        if (cPlace) {
          const l = game.find(cPlace);
          if (!l || l.type !== 'directory') return game.error(game.t('tar-place-missing', { target: cPlace }));
        }
        const inside = (path: string) => `${base.replace(/\/$/, '')}/${path}`;
        const makeDir = (place: string) => {
          if (!game.exists(inside(place))) {
            const r = dirs[`${place}/`];
            game.place('tar', inside(place), { type: 'directory', children: {}, owner: game.who, ...(r?.mode ? { mode: r.mode } : {}) });
          }
        };
        for (const p of order) {
          if (Object.hasOwn(dirs, p)) {
            makeDir(p.replace(/\/$/, ''));
            continue;
          }
          const f = n.archive.files[p];
          const parts = p.split('/');
          let place = '';
          for (const part of parts.slice(0, -1)) {
            place = place ? `${place}/${part}` : part;
            makeDir(place);
          }
          // root keeps the owner and permissions stored in the archive;
          // others become owners of what they extract.
          const error = game.place('tar', inside(p), game.who === 'root' ? { ...f } : { ...f, owner: game.who, group: undefined });
          if (error) game.error(error);
        }
        if (truncated !== undefined) cut();
        // -v: each entry, as it comes out (-vv: the long listing).
        return letters.has('v') ? order.map((p) => (hasDoubleV(withoutC) ? verbose(p) : p)).join('\n') : '';
      }
      return game.error(game.t('tar-option-missing'));
    },
  },
};
