// Building blocks of the game world: a real miniature file system.
// A directory = a place, a file = an object or a character.
// Each chapter (see chapters/) builds its own world.

import type { Game } from './shell';
import type { Activity } from './activity';
import type { Translate } from '../texts';
import type { ElementPlan } from './plan';

export type File = {
  type: 'file';
  content: string | ((game: Game) => string);
  // Effect of reading (cat), e.g. pulling a lever. Returns an extra message.
  read?: (game: Game) => string | void;
  // If present, the object refuses to be moved or deleted, with this message.
  isProtected?: { mv?: string; rm?: string };
  // "Line by line" file (log, list, configuration): every
  // line counts (for grep in particular), paragraphs are not joined.
  lines?: boolean;
  // Written text (story, dialogue): gets the language's typography when
  // displayed (see typographie() in src/texts/).
  prose?: boolean;
  // Simulated size in bytes (images, videos…), otherwise the text's.
  size?: number;
  // Contents of a tar archive: relative paths → copies of the files.
  // `tronquee`: the archive was cut off while being written; only its
  // first `tronquee` files are readable.
  archive?: { files: Record<string, File>; compressed: boolean; truncated?: number };
  // Symbolic link (ln -s): the target path, as it was written (relative
  // to the link's place, or absolute). It is followed to read, write, enter.
  link?: string;
  // Last modification date (ms, local time read as UTC, like
  // systemd's clock); without it, the file is considered recent.
  mtime?: number;
} & Rights;
// Unix owner, group and permissions (rwx for the owner, the
// group, the others). By default: "you", the group named after the
// owner, rw-r--r-- (file), rwxr-xr-x (place).
export type Rights = { owner?: string; group?: string; mode?: string };

// A machine's accounts, like /etc/passwd and /etc/group: each
// user has a primary group and can be a member of other
// groups (supplementary groups).
export interface Accounts {
  // expire: end of the account's validity (YYYY-MM-DD, usermod -e, chage -E).
  users: Record<string, { uid: number; group: string; home?: string; shell?: string; expires?: string }>;
  groups: Record<string, { gid: number; members: string[] }>;
}

// The accounts of every machine that declares none: root, and
// "you", member of the sudo group (like the first account on Debian).
export const accountsByDefault = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] } },
});
export type Directory = {
  type: 'directory';
  children: Record<string, Node>;
  // Why it is blocked if it can't be entered yet, otherwise null.
  blocked?: (game: Game) => string | null;
} & Rights;
export type Node = File | Directory;

// A machine on a story's internal network: its world, its accounts,
// its state; its events are the chapter's (checked on the
// main machine).
export interface InternalHost {
  address: string;
  domain: string;
  createWorld: (t: Translate) => Directory;
  accounts?: () => Accounts;
  state?: (t: Translate) => Record<string, unknown>;
  initialise?: (game: Game) => void;
  // Known commands (by default, the chapter's).
  commands?: string[];
}

// A story event: when `condition` becomes true (checked
// after each command), `action` changes the world and `message` is shown.
// Each event happens only once.
export interface Event {
  id: string;
  condition: (game: Game) => boolean;
  action?: (game: Game) => void;
  message: string | ((game: Game) => string);
}

// A chapter's texts are in src/texts/<language>/<story>.ftl:
// its title (chapitre-<id>, with the .resume attribute) and everything it
// displays, under identifiers that start with its own.
export interface Chapter {
  id: string;
  number: number;
  // Commands known in this chapter (the others are "not learned yet").
  commands: string[];
  // The "home" directory (~), where you start.
  home: string;
  // The story's network plan at this chapter (the planned network, see plan.ts).
  plan?: (t: Translate) => ElementPlan;
  // Names of places and objects are translated (see nom() and chemin()):
  // the world is created with the French names, then each is replaced by
  // the language's. Event paths then go through chemin().
  names?: boolean;
  // File in the home directory shown at the start of the chapter.
  welcome: string;
  createWorld: (t: Translate) => Directory;
  events: Event[];
  // The chapter is passed when this event has happened.
  final: string;
  // The order of the steps in the game, for hints (see indices.ts), when
  // it differs from the events' order.
  steps?: string[];
  // Called after each command (e.g. the Eraser moving forward); returns a message.
  afterCommand?: (game: Game) => string | void;
  // Called just before running each command (e.g. time passing: the
  // command already sees the world as it has become since the previous one).
  beforeCommand?: (game: Game) => void;
  // The machine living while you play (visitors, bots, attacks): see activite.ts.
  activity?: Activity;
  // "you"'s password for sudo (absent: sudo not learned yet).
  password?: string;
  // The machine's accounts and groups (by default: comptesParDefaut).
  accounts?: () => Accounts;
  // Called once the world and state are created (e.g. to load a service's
  // configuration from the world's files).
  initialise?: (game: Game) => void;
  // The story's own state (processes, network, git repositories…), recreated
  // for each game. The specialised commands read and change it.
  state?: (t: Translate) => Record<string, unknown>;
  // The machine was reinstalled for this chapter: new SSH host key
  // (see machines.ts), which the workstation's known_hosts doesn't know yet.
  hostKey?: string;
  // The machines of the story's internal network (behind the main
  // machine), reached over ssh from it (or with ssh -J).
  hosts?: Record<string, InternalHost>;
  // The workstation's public keys are copied to the story's machines
  // on each connection (a coordinator who keeps the keys up to date).
  playerKeys?: boolean;
  // Events are also checked after commands typed on the
  // workstation (the chapter watches what you do there: ~/.ssh/config, tunnels…).
  watchesWorkstation?: boolean;
}

// A story: a sequence of chapters. Stories are independent.
// Title and summary: histoire-<id> in src/texts/<language>/stories.ftl.
export interface Story {
  id: string;
  chapters: Chapter[];
  // The chapters (of other stories) to finish before receiving its key:
  // stories open little by little (see deverrouillage.ts). Without it: the
  // first story, open from the start.
  after?: string[];
}

// Texts are written with line breaks to be readable in the
// code; the lines of a paragraph are joined so that the terminal
// wraps them according to the screen's width. Indented lines and
// tables (aligned with double spaces) are kept as they are.
// A title in capitals ("WHAT HAPPENED") also stays on its own line.
const title = (l: string) => /\p{Lu}/u.test(l) && l === l.toUpperCase();
// A numbered list ("1.", "2)") keeps one item per line.
const number = (l: string) => /^\d+[.)] /.test(l);
const raw = (l: string) => l === '' || l.startsWith(' ') || l.startsWith('- ') || l.includes('  ') || title(l) || number(l);
export const clean = (t: string) =>
  t
    .replace(/^\n+|\s+$/g, '')
    .split('\n')
    .reduce<string[]>((lines, l) => {
      const prec = lines.at(-1);
      if (prec !== undefined && !raw(prec) && !raw(l)) lines[lines.length - 1] = `${prec} ${l}`;
      else lines.push(l);
      return lines;
    }, [])
    .join('\n');

export const f = (content: File['content'], options: Omit<File, 'type' | 'content'> = {}): File => ({
  type: 'file',
  content: typeof content !== 'string' ? content : options.lines ? content.replace(/^\n+|\s+$/g, '') : clean(content),
  prose: typeof content === 'string' && !options.lines,
  ...options,
});

// The names of a story's places and objects (the directories and
// files you type): the French name is the identifier, each language
// gives its own in src/texts/<language>/names.ftl, under nom-<name> (the
// leading dot becomes "point-", the other dots hyphens). A missing name
// stays as it is (home, etc, the names of real tools).
const nameKey = (id: string) => `name-${id.replace(/^\./, 'point-').replace(/\./g, '-')}`;
/** A password given by a story, in the language (passwords.ftl: farine-2028 → flour-2028). */
export const password = (t: Translate, id: string) => (t.exists(`password-${id}`) ? t(`password-${id}`) : id);
export const name = (t: Translate, french: string) => (t.exists(nameKey(french)) ? t(nameKey(french)) : french);
/** A path of the world, translated name by name: /Cabane/Jetee/filet → /Hut/Pier/net. */
export const path = (t: Translate, english: string) =>
  english
    .split('/')
    .map((m, i, all) => (m && !systemDirectory(all.slice(0, i + 1).join('/')) ? name(t, m) : m))
    .join('/');

// Real system directories whose name is also a translated name of the world
// (/usr/share, /var/backups, /proc/sys/net, /etc/letsencrypt/live), and the
// Lab's /srv/scans, a mount point fstab names: they keep their name.
const SYSTEM_DIRECTORIES = ['/usr/share', '/var/backups', '/proc/sys/net', '/etc/letsencrypt/live', '/srv/scans'];
export const systemDirectory = (p: string) => SYSTEM_DIRECTORIES.includes(p) || p.endsWith('/.local/share');

// The accounts that are translated: the player's
// ("vous" in French, you in English) and the Eraser's system user. The
// other accounts (root, www-data, the characters: malo, yasmine…) keep
// their name. Like places, chapters are written with the French
// name; the world (owners, /home/vous) and the accounts are
// renamed on creation, and the code refers to the player's account as
// `jeu.joueur` (or `joueur(t)` before the game exists).
const TRANSLATED_ACCOUNTS = [
  'you',
  'eraser',
  // The Audit: the orders app's service account (commandes in French).
  'orders',
];
export const account = (t: Translate, french: string) => (TRANSLATED_ACCOUNTS.includes(french) ? name(t, french) : french);
/** The player's account in the language: vous, you… */
export const player = (t: Translate) => account(t, 'you');

/** The world in the language: each directory and each file takes its translated name, and so do its owners. */
export function translateNames(t: Translate, directory: Directory, at = ''): Directory {
  const rights = (n: Node) => {
    if (n.owner) n.owner = account(t, n.owner);
    if (n.group) n.group = account(t, n.group);
    return n;
  };
  rights(directory);
  directory.children = Object.fromEntries(
    Object.entries(directory.children).map(([n, e]) => [systemDirectory(`${at}/${n}`) ? n : name(t, n), e.type === 'directory' ? translateNames(t, e, `${at}/${n}`) : rights(e)]),
  );
  return directory;
}

/** The accounts in the language: names of users and groups, members, homes. */
export const translateAccounts = (t: Translate, c: Accounts): Accounts => ({
  users: Object.fromEntries(
    Object.entries(c.users).map(([n, u]) => [account(t, n), { ...u, group: account(t, u.group), ...(u.home ? { home: path(t, u.home) } : {}) }]),
  ),
  groups: Object.fromEntries(Object.entries(c.groups).map(([n, g]) => [account(t, n), { ...g, members: g.members.map((m) => account(t, m)) }])),
});

export const d = (children: Record<string, Node>, blocked?: Directory['blocked'], rights: Rights = {}): Directory => ({
  type: 'directory',
  children,
  blocked,
  ...rights,
});

// /etc/passwd and /etc/group, kept up to date from the machine's
// accounts (usermod changes them): to put in a world's /etc.
export const accountsFiles = (): Record<string, File> => ({
  passwd: f(
    (game) =>
      Object.entries(game.accounts.users)
        .map(([name, u]) =>
          [name, 'x', u.uid, game.accounts.groups[u.group]?.gid ?? u.uid, '', u.home ?? `/home/${name}`, u.shell ?? '/bin/bash'].join(':'),
        )
        .join('\n'),
    { lines: true, owner: 'root' },
  ),
  group: f(
    (game) =>
      Object.entries(game.accounts.groups)
        .map(([name, g]) => `${name}:x:${g.gid}:${g.members.join(',')}`)
        .join('\n'),
    { lines: true, owner: 'root' },
  ),
});
