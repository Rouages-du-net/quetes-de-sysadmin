// File commands: moving around, reading, creating, copying, deleting,
// permissions, archives, disk space.

import { isBsd } from '../freebsd';
import { shownOwner } from '../nfs';
import { cifsShown, cifsUsage } from '../cifs';
import type { File, Node } from '../world';
import type { Shell } from '../shell';
import { applyMode, compareNames, content, wildcard, readable, modeWithMask, options, sizeFor } from '../tools';
import { ghostPlace } from '../open-files';
import { colourise, lsColour, visibleWidth, readColour, invalidColourMessage, sgr } from '../colours';
import { COMMANDS, type Command, type Context } from './index';
import { escape } from './builtins';

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

const modeFor = (n: Node) => n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');

// A line of "ls -l". Deliberate difference: the link count and
// the date are left out.
// The name of an ls entry, in colour if ls colours (see couleurs.ts).
type Paint = (name: string, n: Node) => string;
const withoutPainting: Paint = (name) => name;
const painting = (enabled: boolean): Paint => (enabled ? (name, n) => sgr(lsColour(name, n.type, n.type === 'file' && n.link !== undefined, modeFor(n)), name) : withoutPainting);

function longLine(game: Shell, name: string, n: Node, human: boolean, numeric = false, paint: Paint = withoutPainting): string {
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
  const suffix = n.type === 'directory' && name !== '.' && name !== '..' ? '/' : '';
  // A symbolic link: "l", rwxrwxrwx permissions, size = length of the target path.
  if (n.type === 'file' && n.link !== undefined)
    return `lrwxrwxrwx ${owner.padEnd(8)} ${group.padEnd(8)} ${String(n.link.length).padStart(6)} ${paint(name, n)} -> ${n.link}`;
  return `${n.type === 'directory' ? 'd' : '-'}${share?.mode ?? modeFor(n)} ${owner.padEnd(8)} ${group.padEnd(8)} ${size.padStart(6)} ${paint(name, n)}${suffix}`;
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
  // -d: the place itself, not its contents.
  if (n.type === 'file' || letters.has('d')) return ino(n, long ? longLine(game, target, n, letters.has('h'), letters.has('n'), paint) : paint(target, n));
  if (!game.can(n, 'r')) return game.error(game.t('ls-open-permission', { target: target }));
  // -a: every name, . and .. included; -A: every name but . and ..
  let inputs: [string, Node][] = Object.entries(n.children).filter(([name]) => letters.has('a') || letters.has('A') || !name.startsWith('.'));
  if (letters.has('a')) inputs.unshift(['.', n], ['..', game.find(target + '/..') ?? n]);
  inputs = sortEntries(game, inputs, letters);
  if (long) return inputs.map(([name, e]) => ino(e, longLine(game, name, e, letters.has('h'), letters.has('n'), paint))).join('\n');
  // The / added to places stays outside the colour (like ls -F): colour is never the only sign.
  const shows = (name: string, e: Node) => paint(name, e) + (e.type === 'directory' && name !== '.' && name !== '..' ? '/' : '');
  if (letters.has('i')) return inputs.map(([name, e]) => ino(e, last ? shows(name, e) : paint(name, e))).join(last && !one ? '    ' : '\n');
  // Like the real ls: in columns on screen, one name per line in a
  // pipe or a file (and without the / added to places), or with -1.
  if (!last) return inputs.map(([name, e]) => paint(name, e)).join('\n');
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
      const target = args[0] ?? '~';
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
        if (game.exists(target)) continue;
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
        else if (!applyMode(modeFor(n), rights)) game.error(game.t('chmod-mode-incorrect', { permissions: rights }));
        else apply(n);
      }
      return '';
    },
  },

  find: {
    launch: ({ args, game }) => {
      const departure = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const crit = args[0] && !args[0].startsWith('-') ? args.slice(1) : args;
      let name: RegExp | null = null;
      let type: string | null = null;
      let erase = false;
      // -mtime +N: modified more than N days ago (age in whole days, like find); -N: less; N: exactly.
      let age: { sign: string; days: number } | null = null;
      let depth = Infinity;
      let printf: string | undefined;
      for (let i = 0; i < crit.length; i++) {
        if (crit[i] === '-name') name = wildcard(crit[++i] ?? '');
        else if (crit[i] === '-type') type = crit[++i] ?? null;
        else if (crit[i] === '-delete') erase = true;
        else if (crit[i] === '-print') continue;
        // -printf FORMAT (GNU find): %p the path, %f the name, %s the size, %u the owner, %g the group, %m the rights in octal, \n a newline.
        else if (crit[i] === '-printf') {
          printf = crit[++i];
          if (printf === undefined) return game.error(game.t('find-argument-missing', { predicate: '-printf' }));
        }
        else if (crit[i] === '-maxdepth') {
          const v = crit[++i] ?? '';
          if (!/^\d+$/.test(v)) return game.error(game.t('find-argument-numeric', { predicate: '-maxdepth', value: v }));
          depth = Number(v);
        } else if (crit[i] === '-mtime') {
          const v = crit[++i] ?? '';
          const m = /^([+-]?)(\d+)$/.exec(v);
          if (!m) return game.error(game.t('find-argument-numeric', { predicate: '-mtime', value: v }));
          age = { sign: m[1], days: Number(m[2]) };
        } else return game.error(game.t('find-predicate-unknown', { predicate: crit[i] }));
      }
      const now: number = game.state.systemd?.clock ?? 0;
      const ageOk = (e: Node) => {
        if (!age) return true;
        const days = e.type === 'file' && e.mtime !== undefined ? Math.floor((now - e.mtime) / 86_400_000) : 0;
        return age.sign === '+' ? days > age.days : age.sign === '-' ? days < age.days : days === age.days;
      };
      const n = game.find(departure);
      if (!n) return game.error(game.t('find-missing', { target: departure }));
      const found: string[] = [];
      const walk = (path: string, e: Node, level: number) => {
        const kept = (!name || name.test(path.split('/').pop()!)) && (!type || (type === 'd') === (e.type === 'directory')) && ageOk(e);
        if (kept) found.push(path);
        if (e.type !== 'directory' || level >= depth) return;
        if (!game.can(e, 'r') || !game.can(e, 'x')) return void game.error(game.t('find-permission', { target: path }));
        for (const [k, child] of Object.entries(e.children).sort(([a], [b]) => compareNames(a, b)))
          walk(`${path.replace(/\/$/, '')}/${k}`, child, level + 1);
      };
      walk(departure, n, 0);
      if (printf !== undefined) {
        const octal = (m: string) => [0, 3, 6].map((k) => [...m.slice(k, k + 3)].reduce((t, c) => t + (({ r: 4, w: 2, x: 1 } as Record<string, number>)[c] ?? 0), 0)).join('');
        return found
          .map((path) => {
            const e = game.find(path)!;
            const mode = e.mode ?? (e.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
            const values: Record<string, string> = {
              p: path, f: path.split('/').filter(Boolean).at(-1) ?? path, s: String(e.type === 'file' ? sizeFor(e, game) : 4096),
              u: e.owner ?? game.who, g: e.group ?? e.owner ?? game.who, m: octal(mode), '%': '%',
            };
            return printf!.replace(/%([pfsugm%])/g, (_, k: string) => values[k]).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
          })
          .join('')
          .replace(/\n$/, '');
      }
      if (!erase) return found.join('\n');
      for (const path of found.reverse()) {
        const e = game.find(path)!;
        if (e.type === 'directory' && Object.keys(e.children).length) game.error(game.t('find-remove-not-empty', { target: path }));
        else if (!game.writtenIn(path)) game.error(game.t('find-remove-permission', { target: path }));
        else game.erase(path);
      }
      return '';
    },
  },

  du: {
    launch: ({ args, game }) => {
      // --inodes: count files (and places) instead of bytes; -d N (--max-depth=N): show only N levels.
      const inodes = args.includes('--inodes');
      let depth = Infinity;
      const raw: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--inodes') continue;
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
      const walk = (path: string, e: Node, level = 0): number => {
        if (e.type === 'file') {
          if (seen.has(e)) return 0;
          seen.add(e);
          return inodes ? 1 : sizeFor(e, game);
        }
        let total = inodes ? 1 : 0;
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
        if (letters.has('s') || n.type === 'file') lines.push(`${fmt(total)}\t${target}`);
      }
      return lines.join('\n');
    },
  },

  df: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const fmt = (o: number) => (letters.has('h') ? readable(o, game.t.language) : String(Math.ceil(o / 1024)));
      const mounts: { path: string; capacity: number; name: string; inodes?: number; inodesBase?: number }[] = game.state.mounts ?? [];
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
      const lines = [game.t('df-header')];
      for (const m of chosen) {
        const place = game.find(m.path);
        // Deleted files still held open by a process still take up their space.
        // Not counting the other media mounted inside (/srv/radio isn't on /).
        const inside = mounts.filter((x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')));
        const other = inside.reduce((t, x) => t + ((n) => (n ? game.size(n) : 0))(game.find(x.path)), 0);
        // A Windows share (cifs): the server's volume, as the server counts it.
        const remote = cifsUsage(game, m.path);
        const capacity = remote?.capacity ?? m.capacity;
        const inUse = remote ? Math.min(capacity, remote.used) : Math.min(m.capacity, (place ? game.size(place) : 0) - other + ghostPlace(game, m.path));
        const pct = Math.round((100 * inUse) / capacity);
        lines.push(
          `${(m.name ?? m.path).padEnd(18)} ${fmt(capacity).padStart(6)} ${fmt(inUse).padStart(7)} ${fmt(Math.max(0, capacity - inUse)).padStart(6)} ${String(pct).padStart(3)}% ${m.path}`,
        );
      }
      return lines.join('\n');
    },
  },

  tar: {
    launch: ({ args, game }) => {
      // -C place (or --directory=place): move to that place before extracting.
      let cPlace = '';
      const withoutC: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-C') cPlace = args[++i] ?? '';
        else if (args[i].startsWith('--directory=')) cPlace = args[i].slice('--directory='.length);
        else withoutC.push(args[i]);
      }
      const { letters, rest } = options(withoutC);
      if (!letters.has('f') || !rest.length) return game.error(game.t('tar-usage'));
      const [archiveName, ...sources] = rest;
      if (letters.has('c')) {
        if (!sources.length) return game.error(game.t('tar-archive-empty'));
        const files: Record<string, File> = {};
        const add = (path: string, e: Node) => {
          if (e.type === 'file') {
            if (!game.can(e, 'r')) return void game.error(game.t('error-permission', { command: 'tar', target: path }));
            files[path] = { ...e, read: undefined } as File;
          } else for (const [k, child] of Object.entries(e.children)) add(`${path.replace(/\/$/, '')}/${k}`, child);
        };
        for (const s of sources) {
          const e = game.find(s);
          if (!e) game.error(game.t('error-missing', { command: 'tar', target: s }));
          else add(s.replace(/^\.?\/+/, ''), e);
        }
        const compressed = letters.has('z');
        // Size: a 512-byte header per file; gzip shrinks text a lot
        // (to about a third) and images, sounds and videos hardly at all,
        // since they are already compressed.
        const already = /\.(png|jpe?g|gif|webp|mp3|ogg|mp4|webm|zip|gz|pdf)$/i;
        const size = Object.entries(files).reduce((t, [path, f]) => {
          const raw = sizeFor(f, game);
          return t + 512 + (compressed ? Math.round(raw * (already.test(path) ? 0.98 : 0.35)) : raw);
        }, 0);
        const archive: File = { type: 'file', content: '', size, owner: game.who, archive: { files, compressed } };
        const error = game.place('tar', archiveName, archive);
        if (error) return game.error(error);
        return letters.has('v') ? Object.keys(files).join('\n') : '';
      }
      const n = game.find(archiveName);
      if (!n) return game.error(game.t('tar-open-impossible', { target: archiveName }));
      if (n.type !== 'file' || !n.archive) return game.error(game.t('tar-not-one-archive', { target: archiveName }));
      // A truncated archive (disk full, machine turned off while writing):
      // tar reads what comes before the cut, then stops on an error.
      const { truncated } = n.archive;
      const inputs = Object.entries(n.archive.files).slice(0, truncated);
      const cut = () => {
        game.state.truncatedArchive = game.resolve(archiveName);
        game.error(game.t('tar-truncated'));
      };
      if (letters.has('t')) {
        const listing = inputs.map(([path]) => path).join('\n');
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
        for (const [path, f] of inputs) {
          const parts = path.split('/');
          let place = '';
          for (const p of parts.slice(0, -1)) {
            place = place ? `${place}/${p}` : p;
            if (!game.exists(inside(place))) game.place('tar', inside(place), { type: 'directory', children: {}, owner: game.who });
          }
          // root keeps the owner and permissions stored in the archive;
          // others become owners of what they extract.
          const error = game.place('tar', inside(path), game.who === 'root' ? { ...f } : { ...f, owner: game.who, group: undefined });
          if (error) game.error(error);
        }
        if (truncated !== undefined) cut();
        return '';
      }
      return game.error(game.t('tar-option-missing'));
    },
  },
};
