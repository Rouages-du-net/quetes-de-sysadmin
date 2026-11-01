// A mini-shell that interprets real Linux commands on a chapter's world.
// The behaviours follow Linux's (messages simplified and translated); the
// deliberate differences are pointed out in comments and listed in
// docs/SCENARIOS.md.
//
// Like a real shell: the line is split into words (quotes included), the
// wildcards * and ? are expanded, commands are joined by | pipes (the
// output of one becomes the input of the next), and the final output can
// be redirected to a file (> overwrites, >> appends). Error messages do
// not go through pipes (separate error output).

import { path, accountsByDefault, player, password, clean, name, translateAccounts, translateNames, type Chapter, type Accounts, type Directory, type Node } from './world';
import { COMMANDS, type Command } from './commands';
import { withoutColours } from './colours';
import { help, apropos, whatisLine, invalidOption, pageMan, shorten } from './commands/manual';
import { translator, typography, type Language, type Translate } from '../texts';
import { hostInLanguage, machineName } from './machines';
import { live } from './activity';

export { split, applyMode } from './tools';
import { applyMode, compareNames, content, split, wildcard, modeWithMask, sizeFor, type Word } from './tools';
import { launchScript } from './commands/scripts';
import { read as readSudoers, SUDOERS } from './sudoers';

// The room for a program's arguments (getconf ARG_MAX), and the shell's built-in commands, which are not subject to it.
const ARG_MAX = 2_097_152;
const BUILT_IN = ['cd', 'echo', 'pwd', 'test', 'printf'];

// What the game (the chapters and the commands) can read or change.
// The easter eggs: xyzzy (the magic word of Colossal Cave Adventure), the
// sandwich of xkcd 149 (https://xkcd.com/149/), and sl, the locomotive that
// punishes those who type sl instead of ls (the Debian sl package).
const EGGS: Record<string, { text: string; achievements: string }> = {
  xyzzy: { text: 'egg-xyzzy', achievements: 'xyzzy' },
  'make me a sandwich': { text: 'egg-sandwich-refusal', achievements: '' },
  'sudo make me a sandwich': { text: 'egg-sandwich', achievements: 'sandwich' },
  sl: { text: 'egg-sl', achievements: 'sl' },
};

export interface Game {
  root: Directory;
  cwd: string;
  flags: Set<string>;
  home: string;
  state: Record<string, any>;
  // The user acting for the current command: the player, or "root" under sudo.
  who: string;
  // The player's account, in the language ("vous", "you": see player() in
  // world.ts). The code compares and writes that name, never 'you'.
  player: string;
  // The last line run (for events): the pipe's commands, output produced
  // (before redirection), redirection file.
  last: { line: string; commands: string[][]; output: string; errors: string[]; redirection: string | null };
  find(path: string, last?: boolean): Node | null;
  exists(path: string): boolean;
  read(path: string): string | null;
  count(place: string, prefix: string): number;
  erase(path: string): void;
  can(n: Node, right: 'r' | 'w' | 'x', user?: string): boolean;
  // The machine's accounts and groups; an account's groups (primary first).
  accounts: Accounts;
  groupsFor(user: string): string[];
  // The texts in the game's language (see src/texts/).
  t: Translate;
  // The machine's name (prompt "player@name").
  host: string;
  /** The machine's name in the language (royaume for kingdom in French). */
  readonly hostName: string;
  // Asks a question (e.g. ssh's "yes/no"): the next line is the answer,
  // passed to `answer`, whose text is displayed.
  ask(prompt: string, answer: (response: string) => string): void;
  // Request to open a session on another machine (ssh); the console
  // (console.ts) handles it after the current line.
  connectionRequest: string | null;
  reboot: boolean;
  edition: Edition | null;
  follow: { read: () => string } | null;
  history: string[];
}

export interface Edition {
  path: string;
  text: string;
  root: boolean;
  // Status-line message on opening ("New File"…).
  message: string;
  // On closing (e.g. crontab -e checks and installs): message to display.
  after?: () => string;
  // Closing changes the state (e.g. systemctl edit): it counts as a command, even without a message.
  conclude?: boolean;
}

export class Shell implements Game {
  root: Directory;
  cwd: string;
  /** The previous directory ($OLDPWD), for cd -. */
  old: string | null = null;
  home: string;
  flags = new Set<string>();
  state: Record<string, any>;
  finished = false;
  // Exam mode: the steps are checked, but only the final message (the debrief) is shown.
  exam = false;
  // The terminal shows colours (the interface, if the setting is on): ls,
  // grep… then colour what goes to the screen (see colours.ts).
  colours = false;
  // The terminal's width, in characters ($COLUMNS): ls fits its columns into it.
  columns = 80;
  who: string;
  last: Game['last'] = { line: '', commands: [], output: '', errors: [], redirection: null };
  // The account under which sudo runs the current command (sudo -u).
  private as = 'root';
  // sudo: password already given? line waiting for the password?
  private authenticated = false;
  private doneLecture = false;
  waiting: { line: string; attempts: number } | null = null;
  // Current question (ssh: "Are you sure you want to continue connecting?").
  // secret: the answer is not displayed (a password asked by ssh).
  question: { prompt: string; answer: (response: string) => string; secret?: boolean } | null = null;
  // A session to open on another machine (ssh -J, ssh from a machine to its
  // internal network), handled by the console.
  sessionRequest: { shell: Shell; domain: string; via?: string; address: string } | null = null;
  // The story's main machine, for an internal machine.
  parent: Shell | null = null;
  private internals = new Map<string, Shell>();
  // exit typed: the console closes the session (see console.ts).
  output = false;
  // The machine has just rebooted (reboot): the console cuts the session.
  reboot = false;
  // File open in the editor (nano): the interface shows it in place of the
  // command line. `root`: opened with sudo.
  edition: Edition | null = null;
  // A follow in progress (tail -f, journalctl -f): read() gives the lines
  // that arrived since last time. Ctrl-C stops it (Console.interrupt).
  follow: { read: () => string } | null = null;
  // The commands typed on this machine (history, !!).
  history: string[] = [];
  // Story messages triggered while editing, shown on exit.
  private inWaiting: string[] = [];
  connectionRequest: string | null = null;
  accounts: Accounts;
  // Error output and remarks of the current line.
  private errors: string[] = [];
  // The exit code of the last command, when it sets it itself (a
  // monitoring plugin: 0 OK, 1 WARNING, 2 CRITICAL); otherwise, it is 1 if
  // it wrote an error, 0 otherwise.
  status: number | null = null;
  // The permission mask of created files (umask), specific to this session.
  mask = '0022';
  // The file the current command's output goes to (> file), if there is one: wg genkey looks at it.
  outputTo: string | null = null;
  // The tmux session being typed in (null: outside tmux); the sessions live in state.tmux.
  tmux: string | null = null;
  // The connection has just dropped (the network went down): the console brings you back to the workstation.
  cut = false;
  // The places entered (cd), for the map (see map.ts).
  visits = new Set<string>();
  // The story messages already shown in this chapter (the "Mission" panel rereads them).
  log: string[] = [];
  // The easter eggs found in this session (see EGGS and achievements.ts).
  eggs = new Set<string>();
  // The hints asked for in this chapter ("step:level", see hints.ts): the debrief counts them.
  requestsHints = new Set<string>();
  // For the end-of-chapter summary (see summary.ts): the commands typed, those
  // that failed, and the line that passed each step. An answer to a question
  // (yes, password) is not a command: a step passed by an answer is recorded
  // with the command that asked it.
  typedCommands = 0;
  commandsInError = 0;
  passed: Record<string, string> = {};
  commandLine = '';

  t: Translate;

  // host: the machine's identifier (kingdom); hostName, its name in the language (royaume in French).
  constructor(
    public chapter: Chapter,
    language?: Language,
    public host = 'sysadmin',
  ) {
    this.t = translator(language);
    this.root = chapter.names ? translateNames(this.t, chapter.createWorld(this.t)) : chapter.createWorld(this.t);
    this.home = chapter.names ? path(this.t, chapter.home) : chapter.home;
    this.cwd = this.home;
    this.visits.add(this.home);
    this.state = chapter.state?.(this.t) ?? {};
    const accounts = chapter.accounts?.() ?? accountsByDefault();
    this.accounts = chapter.names ? translateAccounts(this.t, accounts) : accounts;
    this.who = this.player;
    this.nameMachine();
    chapter.initialise?.(this);
  }

  // The chapters write their machine's name in English (/etc/hostname,
  // journal, names nginx or docker recognise); it takes the language's name
  // (kingdom → royaume in French, see machines.ftl).
  private nameMachine(): void {
    // /etc/hosts: each name (also on internal machines: wiki.community.internal).
    const hosts = this.find('/etc/hosts');
    if (hosts?.type === 'file' && typeof hosts.content === 'string')
      hosts.content = hosts.content
        .split('\n')
        .map((l) => (l.trimStart().startsWith('#') ? l : l.replace(/[^\s]+/g, (n) => hostInLanguage(this.t, n))))
        .join('\n');
    const id = this.host;
    const name = this.hostName;
    const translate = (n: string) => hostInLanguage(this.t, n);
    const scan = this.state.scan as { hosts?: { names: string[] }[] } | undefined;
    for (const h of scan?.hosts ?? []) h.names = h.names.map(translate);
    if (name === id) return;
    const sd = this.state.systemd as { host: string; log: { message: string }[] } | undefined;
    if (sd?.host === id) {
      sd.host = name;
      for (const e of sd.log) e.message = e.message.replace(`(${id})`, `(${name})`);
    }
    const file = this.find('/etc/hostname');
    if (file?.type === 'file' && typeof file.content === 'string' && file.content.trim() === id) file.content = file.content.replace(id, name);
    for (const service of ['nginx', 'docker']) {
      const e = this.state[service] as { names?: string[] } | undefined;
      if (Array.isArray(e?.names)) e.names = e.names.map(translate);
    }
  }

  /** The player's account, under its name in the language (vous, you…). */
  get player(): string {
    return this.chapter.names ? player(this.t) : 'you';
  }

  /** The chapter's home directory, under its name in the language. */
  get welcome(): string {
    return this.chapter.names ? name(this.t, this.chapter.welcome) : this.chapter.welcome;
  }

  // ——— Paths and files ———

  // Path (relative, absolute, ~, ..) → normalised absolute path.
  resolve(path: string): string {
    if (path === '~' || path.startsWith('~/')) path = this.home + path.slice(1);
    const parts = (path.startsWith('/') ? path : `${this.cwd}/${path}`).split('/');
    const stack: string[] = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    return '/' + stack.join('/');
  }

  // Follows symbolic links (like stat); `last: false` stops on a link at the
  // end of the path (like lstat: ls -l, rm, ln).
  find(path: string, last = true, depth = 0): Node | null {
    let n: Node = this.root;
    const parts = this.resolve(path).split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (n.type !== 'directory' || !Object.hasOwn(n.children, p)) return null;
      n = n.children[p];
      const end = i === parts.length - 1;
      if (n.type === 'file' && n.link !== undefined && (!end || last)) {
        // Too many links in a chain: ELOOP, like the kernel.
        if (depth > 8) return null;
        const here = '/' + parts.slice(0, i).join('/');
        const target = n.link.startsWith('/') ? n.link : `${here}/${n.link}`;
        return this.find([target, ...parts.slice(i + 1)].join('/'), last, depth + 1);
      }
    }
    return n;
  }

  /** The absolute path reached by following a symbolic link (or the path itself). */
  realPath(path: string): string {
    const absolute = this.resolve(path);
    const n = this.find(absolute, false);
    if (n?.type !== 'file' || n.link === undefined) return absolute;
    const here = absolute.slice(0, absolute.lastIndexOf('/')) || '/';
    return this.resolve(n.link.startsWith('/') ? n.link : `${here}/${n.link}`);
  }

  exists(path: string): boolean {
    return this.find(path) !== null;
  }

  read(path: string): string | null {
    const n = this.find(path);
    return n?.type === 'file' ? content(n, this) : null;
  }

  count(place: string, prefix: string): number {
    const n = this.find(place);
    return n?.type === 'directory' ? Object.keys(n.children).filter((k) => k.startsWith(prefix)).length : 0;
  }

  erase(path: string): void {
    const absolute = this.resolve(path);
    const parent = this.find(absolute + '/..');
    if (parent?.type === 'directory') delete parent.children[absolute.split('/').pop()!];
  }

  name(path: string): string {
    return this.resolve(path).split('/').pop()!;
  }

  // ——— Permissions ———

  // Primary group, then supplementary groups (by number), like id(1).
  groupsFor(user: string): string[] {
    const principal = this.accounts.users[user]?.group ?? user;
    const other = Object.entries(this.accounts.groups)
      .filter(([name, g]) => name !== principal && g.members.includes(user))
      .sort(([, a], [, b]) => a.gid - b.gid)
      .map(([name]) => name);
    return [principal, ...other];
  }

  // Unix permissions: the owner only has the owner's rights, a group member
  // only the group's, others only the others' (even if the group or others
  // have more). root has every right.
  can(n: Node, right: 'r' | 'w' | 'x', user = this.who): boolean {
    if (user === 'root') return true;
    const mode = n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
    const owner = n.owner ?? this.player;
    const triplet =
      owner === user ? mode.slice(0, 3) : this.groupsFor(user).includes(n.group ?? owner) ? mode.slice(3, 6) : mode.slice(6, 9);
    // s and t (setuid, setgid, sticky) in the last position also count as x.
    return triplet.includes(right) || (right === 'x' && /[st]$/.test(triplet));
  }

  // Right to traverse (x) each place leading to this path (not the last one).
  traverses(path: string): boolean {
    let n: Node | undefined = this.root;
    for (const p of this.resolve(path).split('/').filter(Boolean)) {
      if (!n || n.type !== 'directory') return true;
      if (!this.can(n, 'x')) return false;
      n = n.children[p];
    }
    return true;
  }

  /** Is this path on a medium mounted read-only (mount -o ro)? */
  onlyRead(path: string): boolean {
    return !!(this.mount(this.resolve(path)) as { onlyRead?: boolean } | null)?.onlyRead;
  }

  // Right to write in the place containing this path (create, delete, move).
  writtenIn(path: string): boolean {
    if (this.onlyRead(path)) return false;
    const parent = this.find(path + '/..');
    return !!parent && this.traverses(path + '/..') && this.can(parent, 'x') && this.can(parent, 'w');
  }

  // Reason for the first blocked place this path goes through, otherwise null.
  block(path: string): string | null {
    let n: Node = this.root;
    for (const p of this.resolve(path).split('/').filter(Boolean)) {
      if (n.type !== 'directory' || !Object.hasOwn(n.children, p)) return null;
      n = n.children[p];
      const reason = n.type === 'directory' ? n.blocked?.(this) : null;
      if (reason) return reason;
    }
    return null;
  }

  // Reads a file for a command, with the usual checks; if there is a
  // problem, writes the error and returns null.
  readFor(cmd: string, target: string): string | null {
    const n = this.find(target);
    const v = { command: cmd, target: target };
    if (!n) return this.error(this.t('error-missing', v)), null;
    if (n.type === 'directory') return this.error(this.t('error-is-one-directory', v)), null;
    const reason = this.block(target);
    if (reason) return this.error(reason), null;
    if (!this.traverses(target) || !this.can(n, 'r')) return this.error(this.t('error-permission', v)), null;
    if (n.archive) return this.error(this.t('error-binary', v)), null;
    return content(n, this);
  }

  // Puts a node in a place (creation, copy, move), checking the rights and
  // the space available on the medium. Returns an error.
  // For a redirection (cmd = "bash"), the refusal has bash's short form.
  place(cmd: string, path: string, n: Node): string | null {
    const v = { command: cmd, target: path };
    const parent = this.find(path + '/..');
    if (parent?.type !== 'directory') return this.t('error-missing', v);
    const reason = this.block(path + '/..');
    if (reason) return reason;
    if (this.onlyRead(path)) return this.t('error-read-only', v);
    if (!this.writtenIn(path)) return this.t(cmd === 'bash' ? 'redirection-permission' : 'error-creation-permission', v);
    const name = this.name(path);
    const old = parent.children[name];
    // Writing to a link is writing to the file it points to.
    if (old?.type === 'file' && old.link !== undefined && n.type === 'file' && n.link === undefined) return this.place(cmd, this.realPath(path), n);
    if (this.missingPlace(this.resolve(path), n, old)) return this.t('error-space', v);
    if (!old) {
      // A new file gets the permissions the mask (umask) allows; in a setgid
      // directory, it gets the directory's group (and a directory, the setgid bit).
      if (n.mode === undefined && this.mask !== '0022') n.mode = modeWithMask(n.type === 'directory', this.mask);
      if (/[sS]/.test(parent.mode?.[5] ?? '') && n.group === undefined) {
        n.group = parent.group ?? parent.owner ?? this.player;
        if (n.type === 'directory') n.mode = applyMode(n.mode ?? modeWithMask(true, this.mask), 'g+s')!;
      }
    }
    parent.children[name] = n;
    return null;
  }

  // A node's size in bytes (a place: the sum of its contents).
  size(n: Node): number {
    if (n.type === 'file') return sizeFor(n, this);
    return Object.values(n.children).reduce((t, e) => t + this.size(e), 0);
  }

  // Mounted media (USB stick…) have a capacity: state.mounts.
  // The most specific medium containing this path (/srv/radio before /).
  mount(absolute: string): { path: string; capacity: number; inodes?: number; inodesBase?: number } | null {
    const mounts: { path: string; capacity: number; inodes?: number }[] = this.state.mounts ?? [];
    return (
      mounts
        .filter((m) => m.path === '/' || absolute === m.path || absolute.startsWith(m.path + '/'))
        .sort((a, b) => b.path.length - a.path.length)[0] ?? null
    );
  }

  /** The inodes used on a medium: each file and each place, plus the system's (inodesBase). */
  usedInodes(m: { path: string; inodesBase?: number }): number {
    const other: string[] = (this.state.mounts ?? []).map((x: { path: string }) => x.path).filter((c: string) => c !== m.path);
    const count = (path: string, n: Node): number => {
      if (other.includes(path)) return 0;
      if (n.type === 'file') return 1;
      let total = 1;
      // Only places need their path (to recognise another medium mounted inside).
      for (const k in n.children) {
        const e = n.children[k];
        total += e.type === 'file' ? 1 : count(`${path === '/' ? '' : path}/${k}`, e);
      }
      return total;
    };
    const place = this.find(m.path);
    return (m.inodesBase ?? 0) + (place ? count(m.path, place) : 0);
  }

  private missingPlace(absolute: string, n: Node, old?: Node): boolean {
    const m = this.mount(absolute);
    if (!m) return false;
    // No free inode left: no way to create a file, even an empty one ("No space left on device").
    if (m.inodes && !old && this.usedInodes(m) >= m.inodes) return true;
    const place = this.find(m.path);
    // Without the other media mounted inside it (/srv is not on /), like df.
    const inside = ((this.state.mounts ?? []) as { path: string }[]).filter(
      (x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')),
    );
    const other = inside.reduce((t, x) => t + ((d) => (d ? this.size(d) : 0))(this.find(x.path)), 0);
    const inUse = (place ? this.size(place) : 0) - other;
    return inUse - (old ? this.size(old) : 0) + this.size(n) > m.capacity;
  }

  // ——— Outputs ———

  error(message: string, code?: number): '' {
    this.errors.push(message);
    // The real tool's exit code (e.g. userdel: 6 for an unknown account), otherwise 1.
    if (code !== undefined) this.status = code;
    return '';
  }

  /** The errors written so far (and clears them): for an answer to a question. */
  recoverErrors(): string[] {
    const e = this.errors;
    this.errors = [];
    return e;
  }

  prompt(): string {
    if (this.waiting) return this.t('sudo-prompt', { user: this.player });
    if (this.question) return this.question.prompt;
    const here =
      this.cwd === this.home ? '~' : this.cwd.startsWith(this.home + '/') ? '~' + this.cwd.slice(this.home.length) : this.cwd;
    // In tmux, the status bar shows the session's name: we put it in front of the prompt.
    // root (a chapter's rescue console) has its own prompt, with #, like bash.
    const root = this.who === 'root';
    return `${this.tmux ? `[${this.tmux}] ` : ''}${root ? 'root' : this.player}@${this.hostName}:${here}${root ? '#' : '$'}`;
  }

  ask(prompt: string, answer: (response: string) => string, secret = false): void {
    this.question = { prompt, answer, secret };
  }

  /** The current input must not be displayed (sudo's or ssh's password). */
  maskedInput(): boolean {
    return this.waiting !== null || !!this.question?.secret;
  }

  /** The story's main machine (itself, or the one an internal machine depends on). */
  get principal(): Shell {
    return this.parent ? this.parent.principal : this;
  }

  /** A machine of the story's internal network, created on the first connection. */
  internal(name: string): Shell | null {
    const p = this.principal;
    const def = p.chapter.hosts?.[name];
    if (!def) return null;
    const already = p.internals.get(name);
    if (already) return already;
    const chapter: Chapter = {
      id: `${p.chapter.id}:${name}`,
      number: p.chapter.number,
      commands: def.commands ?? p.chapter.commands,
      home: '/home/you',
      // Renamed like the main machine (the account you, /home/you…).
      names: p.chapter.names,
      welcome: '',
      final: '',
      events: [],
      password: p.chapter.password,
      createWorld: def.createWorld,
      accounts: def.accounts,
      state: def.state,
      initialise: def.initialise,
    };
    const s = new Shell(chapter, this.t.language, name);
    s.parent = p;
    p.internals.set(name, s);
    return s;
  }

  /** The story's internal machines: name, address, domain. */
  internal_(): { name: string; address: string; domain: string }[] {
    return Object.entries(this.principal.chapter.hosts ?? {}).map(([name, h]) => ({ name, address: h.address, domain: hostInLanguage(this.t, h.domain) }));
  }

  // Expands * and ? as the shell does, before the command. Hidden files are
  // only matched if the pattern starts with a dot.
  expand(word: string): string[] {
    if (!/[*?]/.test(word)) return [word];
    const i = word.lastIndexOf('/');
    const base = i >= 0 ? word.slice(0, i + 1) : '';
    const pattern = word.slice(i + 1);
    const place = this.find(base || '.');
    if (place?.type !== 'directory' || this.block(base || '.') || !this.can(place, 'r')) return [word];
    const re = wildcard(pattern);
    const found = Object.keys(place.children)
      .filter((n) => re.test(n) && (pattern.startsWith('.') || !n.startsWith('.')))
      .sort(compareNames)
      .map((n) => base + n);
    return found.length ? found : [word];
  }

  // Tab completion of the last word.
  // What Tab can complete at the end of the line: the candidates (as shown
  // on double Tab: places with a /), and what gets added.
  private candidates(line: string): { words: string[]; base: string; names: string[]; directories: Set<string> } | null {
    const words = line.split(' ');
    const last = words.pop() ?? '';
    const before = words.filter(Boolean);
    if (before.length === 0 || before.at(-1) === 'sudo' || before.at(-1) === '|')
      return { words, base: '', names: [...new Set(this.known())].filter((c) => c.startsWith(last)).sort(), directories: new Set() };
    // Like bash-completion: after ssh, the machines of ~/.ssh/config.
    if (before[0] === 'ssh' && !last.startsWith('-') && !last.includes('/') && before.at(-1) !== '-i') {
      const hosts = [...(this.read('~/.ssh/config') ?? '').matchAll(/^Host\s+(\S+)/gm)].map((m) => m[1]).filter((h) => h.startsWith(last) && !/[*?]/.test(h));
      return { words, base: '', names: hosts, directories: new Set() };
    }
    const i = last.lastIndexOf('/');
    const base = i >= 0 ? last.slice(0, i + 1) : '';
    const start = last.slice(i + 1);
    const place = this.find(base || '.');
    if (!place || place.type !== 'directory') return null;
    const names = Object.keys(place.children)
      .filter((n) => n.startsWith(start) && (start.startsWith('.') || !n.startsWith('.')))
      .sort();
    return { words, base, names, directories: new Set(names.filter((n) => place.children[n].type === 'directory')) };
  }

  complete(line: string): string {
    const c = this.candidates(line);
    if (!c || c.names.length === 0) return line;
    if (c.names.length > 1) {
      // Like bash: complete up to the longest common prefix.
      let common = c.names[0];
      for (const n of c.names) while (!n.startsWith(common)) common = common.slice(0, -1);
      return [...c.words, c.base + common].join(' ');
    }
    const suffix = c.directories.has(c.names[0]) ? '/' : ' ';
    return [...c.words, c.base + c.names[0] + suffix].join(' ');
  }

  /** The possibilities, when Tab cannot choose (bash shows them on the second Tab); empty otherwise. */
  suggestions(line: string): string[] {
    const c = this.candidates(line);
    if (!c || c.names.length < 2) return [];
    return c.names.map((n) => (c.directories.has(n) ? `${n}/` : n));
  }

  /** The machine's name in the language: the prompt, hostname, the logs. */
  get hostName(): string {
    return machineName(this.t, this.host);
  }

  known(): string[] {
    // The command that lists the others has the language's name (aide in
    // French); help, like bash's builtin, works in every language.
    return [...this.chapter.commands, 'man', 'apropos', 'whatis', 'clear', 'exit', 'history', this.t('command-help')];
  }


  // man, apropos, whatis: the manual covers every command of the game, even
  // those not yet available in this chapter (as on a real system, where the
  // manual also describes what you are not allowed to run).
  private consulter(cmd: string, rest: string[]): string {
    const all = Object.entries(COMMANDS).filter(([n]) => n !== 'aide').sort(([a], [b]) => a.localeCompare(b));
    const notStill = (n: string) => (this.known().includes(n) ? '' : '\n\n' + this.t('manual-not-still'));
    if (cmd === 'apropos' || (cmd === 'man' && rest[0] === '-k')) {
      const word = cmd === 'apropos' ? rest[0] : rest[1];
      if (!word) return this.error(this.t('manual-what-search', { command: cmd === 'apropos' ? 'apropos' : 'man -k' }));
      const lines = apropos(word, all.map(([n]) => n), this.t);
      return lines.length ? lines.join('\n') : this.error(this.t('manual-nothing', { word: word }));
    }
    if (!rest.length)
      return this.error(cmd === 'man' ? this.t('manual-which-page') : this.t('manual-what-search', { command: 'whatis' }));
    const outputs: string[] = [];
    for (const name of rest) {
      const c = COMMANDS[name];
      if (!c || name === 'aide') {
        this.error(cmd === 'man' ? this.t('manual-not-page', { command: name }) : this.t('manual-nothing', { word: name }));
        continue;
      }
      outputs.push(cmd === 'man' ? pageMan(name, c, this.t) + notStill(name) : whatisLine(name, this.t));
    }
    return outputs.join(cmd === 'man' ? '\n\n' : '\n');
  }

  // ——— Execution ———

  // Runs a line; returns the text to display, or null for "clear".
  // If sudo is waiting for a password, the line is that password.
  execute(line: string): string | null {
    if (this.waiting) return this.password(line);
    if (this.question) {
      const { answer } = this.question;
      this.question = null;
      return this.conclude(answer(line.trim()), true);
    }
    // History, like bash: !! (the last command), !n, !-n, !prefix.
    // The expanded line is shown before it runs, and it is the one kept.
    const expanded = this.expandHistory(line);
    if (expanded.error) {
      this.typedCommands++;
      this.commandsInError++;
      this.status = 1;
      return expanded.error;
    }
    const echo = expanded.line !== line ? expanded.line : '';
    line = expanded.line;
    // Like HISTCONTROL=ignoreboth (Debian's ~/.bashrc): neither lines starting with a space, nor consecutive duplicates.
    if (line.trim() && !/^\s/.test(line) && this.history.at(-1) !== line) this.history.push(line);
    if (!echo) return this.runLine(line);
    const output = this.runLine(line);
    return output === null ? null : [echo, output].filter(Boolean).join('\n');
  }

  // !! and its cousins, outside single quotes.
  private expandHistory(line: string): { line: string; error?: string } {
    if (!line.includes('!')) return { line };
    let output = '';
    let apostrophe = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'") apostrophe = !apostrophe;
      if (c !== '!' || apostrophe) {
        output += c;
        continue;
      }
      const rest = line.slice(i + 1);
      const m = /^(!|-?\d+|[A-Za-z_./][^\s;|&<>()]*)/.exec(rest);
      if (!m) {
        output += c;
        continue;
      }
      const h = this.history;
      const pattern = m[1];
      const match =
        pattern === '!' ? h.at(-1) : /^-?\d+$/.test(pattern) ? (Number(pattern) < 0 ? h.at(Number(pattern)) : h[Number(pattern) - 1]) : [...h].reverse().find((l) => l.startsWith(pattern));
      if (match === undefined) return { line, error: `-bash: !${pattern}: event not found` };
      output += match;
      i += pattern.length;
    }
    return { line: output };
  }

  // The line, once history is expanded.
  private runLine(line: string): string | null {
    const words = split(line);
    if (!words.length) return '';
    this.typedCommands++;
    this.commandLine = line.trim();
    // A few easter eggs from terminal culture: an answer, and a hidden achievement.
    const egg = EGGS[line.trim().replace(/\s+/g, ' ')];
    if (egg) {
      if (egg.achievements) this.eggs.add(egg.achievements);
      return this.t(egg.text);
    }
    if (words.length === 1 && words[0].text === 'clear' && !words[0].city) return null;
    // exit is built into the shell: the console closes the session.
    if (words[0].text === 'exit' && !words[0].city && words.length <= 2) {
      // In tmux, exit closes the session's shell (and the session with it), not the connection.
      if (this.tmux) {
        delete (this.state.tmux as Record<string, unknown>)[this.tmux];
        this.tmux = null;
        return '[exited]';
      }
      // The emergency-mode shell: exit resumes booting (see fstab.ts).
      const rescue = this.state.continueBoot as ((j: Shell) => string) | undefined;
      if (this.state.rescue && rescue) return this.conclude(rescue(this), true);
      this.output = true;
      return '';
    }
    // sudo asks for the password before running anything.
    const withSudo = words.some((m, i) => !m.city && m.text === 'sudo' && (i === 0 || words[i - 1].op === '|'));
    // An error in sudo's policy (a file in /etc/sudoers.d written without visudo): sudo refuses everything.
    if (withSudo && this.known().includes('sudo') && this.exists(SUDOERS)) {
      const { error } = readSudoers(this);
      if (error) {
        this.status = 1;
        return [
          `${error.file}:${error.line}:${error.column}: ${this.t(error.key)}`,
          error.text,
          `${' '.repeat(error.column - 1)}^${'~'.repeat(error.length - 1)}`,
          this.t('sudo-sources-invalid'),
        ].join('\n');
      }
    }
    if (withSudo && this.known().includes('sudo') && !this.authenticated) {
      this.waiting = { line, attempts: 0 };
      const lecture = this.doneLecture ? '' : this.t('sudo-lecture');
      this.doneLecture = true;
      return lecture;
    }
    this.chapter.beforeCommand?.(this);
    if (this.chapter.activity) live(this, this.chapter.activity.not);
    return this.conclude(this.countLine(this.tube(line, words)), true);
  }

  // A line that ended in error (an error message, or a non-zero exit code) counts for the summary.
  private countLine(output: string): string {
    if (this.errors.length || (this.status ?? 0) !== 0) this.commandsInError++;
    return output;
  }

  /** The player's password, in the language (sunflower → tournesol in French, see passwords.ftl). */
  playerPassword(): string | undefined {
    const m = this.chapter.password;
    return m && password(this.t, m);
  }

  private password(input: string): string {
    const waiting = this.waiting!;
    if (input === this.playerPassword()) {
      this.waiting = null;
      this.authenticated = true;
      this.chapter.beforeCommand?.(this);
      if (this.chapter.activity) live(this, this.chapter.activity.not);
      return this.conclude(this.countLine(this.tube(waiting.line, split(waiting.line))), true);
    }
    waiting.attempts++;
    if (waiting.attempts < 3) return this.t('sudo-bad-password');
    this.waiting = null;
    return this.t('sudo-three-failures');
  }

  /**
   * Runs a command line the way cron would: from the home directory, without
   * story events; returns everything it wrote (output and errors), which
   * cron would send by mail.
   */
  runTask(line: string): string {
    const cwd = this.cwd;
    this.cwd = this.home;
    try {
      return this.tube(line, split(line));
    } finally {
      this.cwd = cwd;
    }
  }

  /**
   * Runs a line for a script (script.ts: git hook, deployment script), from
   * this place, without touching the current line: returns what it wrote,
   * whether it succeeded (no error) and the place the script is in
   * afterwards (cd).
   */
  underCommand(line: string, cwd: string): { output: string; ok: boolean; code: number; cwd: string } {
    const before = { cwd: this.cwd, errors: this.errors, last: this.last };
    this.cwd = cwd;
    try {
      const output = this.tube(line, split(line));
      const code = this.status ?? (this.errors.length ? 1 : 0);
      return { output, ok: code === 0, code, cwd: this.cwd };
    } finally {
      this.cwd = before.cwd;
      this.errors = before.errors;
      this.last = before.last;
    }
  }

  /** Checks the story's events outside a command (e.g. on reconnection). */
  events(): string {
    return this.conclude('', false);
  }

  private conclude(output: string, account: boolean): string {
    const next = account ? this.chapter.afterCommand?.(this) : undefined;
    return [output, next ? this.prose(next) : '', ...this.checkEvents()].filter(Boolean).join('\n\n');
  }

  // A story text (event, remark): paragraphs and typography.
  private prose(text: string): string {
    return typography(clean(text), this.t.language);
  }

  // A complete line: commands joined by pipes, final redirection.
  private tube(line: string, words: Word[]): string {
    this.errors = [];
    this.status = null;
    const segments: Word[][] = [[]];
    let redirection: { file: string; addition: boolean } | null = null;
    for (let i = 0; i < words.length; i++) {
      const m = words[i];
      if (m.op === '|') segments.push([]);
      else if (m.op === '>' || m.op === '>>') {
        const target = words[i + 1];
        if (!target || target.op) return this.t('syntax-redirection', { operator: m.op });
        redirection = { file: target.text, addition: m.op === '>>' };
        i++;
      } else segments.at(-1)!.push(m);
    }
    if (segments.some((s) => !s.length)) return this.t('syntax-pipe');

    let input: string | null = null;
    const commands: string[][] = [];
    segments.forEach((segment, i) => {
      // Like the shell: wildcards are not expanded inside quotes.
      let args = segment.flatMap((m) => (m.city ? [m.text] : this.expand(m.text)));
      let root = false;
      // sudo -u account: act as that account rather than root.
      let as = 'root';
      // sudo -l: sudo itself answers (the list of allowed commands).
      if (args[0] === 'sudo' && /^-l+$/.test(args[1] ?? '')) args = ['sudo', ...args.slice(1)];
      else if (args[0] === 'sudo') {
        args = args.slice(1);
        root = true;
        if (args[0] === '-u') {
          as = args[1] ?? '';
          args = args.slice(2);
          if (!this.accounts.users[as]) {
            this.error(this.t('sudo-account-unknown', { account: as }));
            input = '';
            return;
          }
        }
      }
      commands.push(args);
      const last = i === segments.length - 1 && !redirection;
      this.as = as;
      this.outputTo = i === segments.length - 1 && redirection ? this.resolve(redirection.file) : null;
      input = this.launch(args, input, root, last);
      this.outputTo = null;
    });
    let output: string = input ?? '';
    // Events read the output as the player reads it, without colour codes.
    this.last = { line, commands, output: withoutColours(output), errors: this.errors, redirection: redirection ? this.resolve(redirection.file) : null };

    if (redirection) {
      // The redirection is done by YOUR shell, before sudo: even with sudo in
      // front of the command, it is "you" who writes to the file.
      const error = this.redirect(redirection.file, output, redirection.addition);
      if (error) {
        this.error(error);
        if (/(^|\|)\s*sudo\s/.test(line)) this.error(this.t('redirection-sudo'));
      }
      output = '';
    }
    return [...this.errors, output].filter(Boolean).join('\n');
  }

  private redirect(file: string, text: string, addition: boolean): string | null {
    const n = this.find(file);
    if (n?.type === 'directory') return this.t('redirection-is-one-directory', { target: file });
    if (n) {
      if (this.onlyRead(file)) return this.t('error-read-only', { command: 'bash', target: file });
      if (!this.traverses(file) || !this.can(n, 'w')) return this.t('redirection-permission', { target: file });
      const before = content(n, this);
      n.content = addition && before ? `${before}\n${text}` : text;
      n.lines = true;
      delete n.size;
      return null;
    }
    return this.place('bash', file, { type: 'file', content: text, owner: this.who, lines: true });
  }

  // Runs a command. `last`: its output is shown on screen (otherwise it goes
  // into a pipe or a file).
  private launch(args: string[], input: string | null, root: boolean, last: boolean): string {
    // In a pipe, it is the last command's exit code that counts.
    this.status = null;
    const [raw, ...rest] = args;
    // /usr/bin/rsnapshot, /bin/ls…: the full path of a game command
    // (and /usr/lib/nagios/plugins/check_disk for those outside the PATH).
    const onlyName = raw?.split('/').at(-1) ?? '';
    const outsidePath = COMMANDS[onlyName]?.directory;
    const cmd =
      raw && ((/^\/(usr\/)?s?bin\/[\w.-]+$/.test(raw) && COMMANDS[onlyName] && !outsidePath) || (outsidePath && raw === `${outsidePath}/${onlyName}`))
        ? onlyName
        : raw;
    if (cmd && COMMANDS[cmd]?.directory && cmd === raw) return this.error(this.t('command-missing', { command: cmd }));
    if (!cmd) return '';
    if (root && !this.known().includes('sudo')) return this.error(this.t('sudo-not-still'));
    // Real behaviour: cd is built into the shell, it is not a program.
    if (root && cmd === 'cd') return this.error(this.t('sudo-cd'));
    if (cmd === 'help' || cmd === this.t('command-help')) return this.t('help-commands', { commands: this.known().join(', ') });
    if (cmd === 'man' || cmd === 'apropos' || cmd === 'whatis') return this.consulter(cmd, rest);
    // A path (./deployer.sh, /srv/site/deployer.sh): a script, if it is executable.
    if (cmd.includes('/')) {
      const n = this.find(cmd);
      if (!n) return this.error(this.t('script-missing', { command: cmd }));
      if (n.type === 'directory') return this.error(this.t('script-directory', { command: cmd }));
      if (!this.traverses(cmd) || !this.can(n, 'x') || !this.can(n, 'r')) return this.error(this.t('script-permission', { command: cmd }));
      const before = this.who;
      if (root) this.who = this.as;
      try {
        return launchScript(this, cmd, rest);
      } finally {
        this.who = before;
      }
    }
    // A man page for a file (section 5, e.g. sshd_config) is not a command.
    const command: Command | undefined = COMMANDS[cmd]?.section === 5 ? undefined : COMMANDS[cmd];
    // On a story's internal machine, a missing program really is missing (bash, code 127).
    if (this.parent && !this.known().includes(cmd)) {
      const output = this.error(`-bash: ${cmd}: command not found`);
      this.status = 127;
      return output;
    }
    if (!this.known().includes(cmd) || !command)
      return this.error(this.t(command || cmd === 'sudo' ? 'command-not-still' : 'command-missing', { command: cmd }));
    // A program receives its arguments in a limited area (ARG_MAX, 2 MiB on
    // Linux): a wildcard that gives tens of thousands of names exceeds it.
    // echo, built into the shell, does not have this limit.
    if (!BUILT_IN.includes(cmd) && args.reduce((t, a) => t + a.length + 1, 0) > ARG_MAX) {
      this.state.argumentsTooLong = (this.state.argumentsTooLong ?? 0) + 1;
      return this.error(this.t(root ? 'sudo-list-arguments-too-long' : 'list-arguments-too-long', { program: `/usr/bin/${cmd}` }));
    }
    // Self-help reflexes: --help and unknown options.
    if (rest.includes('--help')) return help(cmd, command, this.t);
    const invalid = invalidOption(cmd, command, rest, this.t);
    if (invalid) return this.error(invalid);
    // --all → -a: the command only reads its short options.
    const options = command.ownOptions ? rest : shorten(command, rest);
    const before = this.who;
    if (root) this.who = this.as;
    try {
      return command.launch({ args: options, input, game: this, last });
    } finally {
      this.who = before;
    }
  }

  // ——— Editor (nano) ———

  /**
   * Writes the editor's text to the file, with the rights of whoever opened
   * it (root under sudo); returns nano's message.
   * The story's events are checked, and their messages kept for when the
   * editor closes.
   */
  saveEdition(text: string): string {
    const e = this.edition!;
    const before = this.who;
    if (e.root) this.who = 'root';
    try {
      const n = this.find(e.path);
      const lines = text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;
      if (n?.type === 'file') {
        if (!this.traverses(e.path) || !this.can(n, 'w')) return this.t('nano-error-write', { path: e.path });
        n.content = text.replace(/\n$/, '');
        n.lines = true;
        delete n.size;
      } else {
        const error = this.place('nano', e.path, { type: 'file', content: text.replace(/\n$/, ''), owner: this.who, lines: true });
        if (error) return this.t(this.find(e.path + '/..') ? 'nano-error-write' : 'nano-error-directory', { path: e.path });
      }
      e.text = text;
      const next = this.conclude('', true);
      if (next) this.inWaiting.push(next);
      return this.t('nano-lines-written', { lines: lines });
    } finally {
      this.who = before;
    }
  }

  /** Closes the editor; returns the pending story messages. */
  quitEdition(): string {
    const after = this.edition?.after?.() ?? '';
    const conclude = this.edition?.conclude;
    this.edition = null;
    // What closing changed (e.g. a crontab installed) counts as a command.
    const next = after || conclude ? this.conclude('', true) : '';
    const messages = [after, ...this.inWaiting, next].filter(Boolean).join('\n\n');
    this.inWaiting = [];
    return messages;
  }

  private checkEvents(): string[] {
    const messages: string[] = [];
    for (const e of this.chapter.events) {
      if (this.flags.has(e.id) || !e.condition(this)) continue;
      this.flags.add(e.id);
      this.passed[e.id] = this.commandLine;
      e.action?.(this);
      if (!this.exam || e.id === this.chapter.final) {
        messages.push(this.prose(typeof e.message === 'function' ? e.message(this) : e.message));
        this.log.push(messages.at(-1)!);
      }
      if (e.id === this.chapter.final) this.finished = true;
    }
    return messages;
  }
}
