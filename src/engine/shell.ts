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

import { packedSize, unpack } from './compression';
import { onUtf8Terminal } from './charset';
import { binaryOnTerminal, isBinary } from './ebcdic';
import { runProgram } from './cobol';
import { isBsd, LINUX_ONLY } from './freebsd';
import { BSD_CHECKS } from './commands/bsd-tools';
import { SOLARIS_CHECKS, XPG4_CHECKS, OTHER_BINS } from './commands/solaris-tools';
import { isSolaris, NOT_ON_SOLARIS } from './solaris';
import { isIbmi, NOT_ON_IBMI } from './ibmi';
import { access as nfsAccess, ownForServer } from './nfs';
import { cifsAccess, cifsUsage } from './cifs';
import { currentShell, isWindows, windowsPrompt } from './windows';
import { psCandidates, psComplete, runPowerShell } from './commands/powershell';
import { runCmd } from './commands/cmd';

import { path, accountsByDefault, player, password, clean, name, translateAccounts, translateNames, type Chapter, type Accounts, type Directory, type Node } from './world';
import { COMMANDS, type Command } from './commands';
import { withoutColours } from './colours';
import { help, apropos, whatisLine, invalidOption, pageMan, shorten } from './commands/manual';
import { translator, typography, type Language, type Translate } from '../texts';
import { hostInLanguage, machineName } from './machines';
import { live } from './activity';

export { split, applyMode } from './tools';
import { applyMode, appendOnly, braces, immutable, compareNames, content, glob, hasGlob, listRuns, split, splitList, takesTarget, modeWithMask, sizeFor, type ListItem, type Word } from './tools';
import { launchScript } from './commands/scripts';
import { runScript } from './script';
import { parse, parseScript, plainList, unterminated, type ListEntry, type List, type Node as TreeNode } from './compound';
import { drain, flush, list as runTree, newRun, show, subshell, type Run, type Steps } from './control';
import { prefix as dialectPrefix, type ScriptRun } from './dialect';
import { arithmetic, ArithError, type ArithVars } from './arith';
import { addJob, notices, type Job } from './jobs';
import { inherited, inheritedHere } from './availability';
import { permitted, read as readSudoers, sudoersFile } from './sudoers';
import { debianDefaults } from './debian';

// bash's builtins that change nothing, there in every chapter (commands/builtins.ts).
// The job tools come with them (jobs.ts): nohup and watch too, there on every Debian.
const ALWAYS_THERE = ['true', 'false', 'type', 'command', 'test', 'alias', 'unalias', 'read', 'break', 'continue', 'jobs', 'fg', 'bg', 'wait', 'disown', 'nohup', 'watch', 'set', 'shift', 'local', 'return', 'trap', 'getopts', 'source'];
// The everyday companions a chapter's command brings with it: a sysadmin who
// may use find reaches for xargs, one who may use echo for printf…
export const COMPANIONS: Record<string, string[]> = {
  echo: ['printf', 'seq', 'yes'],
  sudo: ['su', 'passwd'],
  find: ['xargs'],
  mkdir: ['rmdir'],
  export: ['env', 'printenv'],
  hostname: ['hostnamectl'],
  usermod: ['useradd', 'adduser', 'passwd', 'getent'],
  userdel: ['useradd', 'adduser'],
  id: ['getent'],
  who: ['w'],
  last: ['lastlog2'],
  apt: ['apt-get', 'apt-cache', 'dpkg', 'lsb_release'],
  dpkg: ['apt-cache'],
  uname: ['hostnamectl'],
  // Compressed files (commands/compress.ts): tar's compressors, rotated logs read with zcat, zgrep, zless.
  tar: ['gzip', 'gunzip', 'zcat', 'bzip2', 'bunzip2', 'bzcat', 'xz', 'unxz', 'xzcat', 'zip', 'unzip'],
  logrotate: ['gzip', 'gunzip', 'zcat', 'zgrep', 'zless', 'zmore'],
  grep: ['zgrep'],
  less: ['zless', 'zmore'],
  diff: ['zdiff', 'cmp'],
  // Small tools (commands/small-tools.ts), brought by their nearest cousin.
  ls: ['basename', 'dirname', 'realpath'],
  cat: ['tac', 'nl', 'more'],
  cut: ['paste', 'column'],
  sha256sum: ['md5sum', 'sha1sum'],
  which: ['whereis'],
  free: ['vmstat'],
  nproc: ['lscpu'],
  reboot: ['shutdown', 'poweroff', 'halt', 'sync'],
  chmod: ['chattr', 'lsattr', 'install'],
  sleep: ['timeout'],
  // Network clients (commands/net-clients.ts).
  curl: ['wget'],
  dig: ['nslookup', 'host'],
  host: ['nslookup'],
};

// Editors the game doesn't simulate: typing one points to nano.
// Commands Debian 13 no longer ships, and their replacement (trixie's release notes: lastlog isn't year-2038 safe).
const REPLACED: Record<string, string> = { lastlog: 'lastlog2' };
const OTHER_EDITORS = ['vi', 'vim', 'vim.tiny', 'vim.basic', 'nvim', 'view', 'emacs', 'micro', 'joe', 'mcedit', 'ed'];

// The room for a program's arguments (getconf ARG_MAX), and the shell's built-in commands, which are not subject to it.
const ARG_MAX = 2_097_152;
const BUILT_IN = ['cd', 'echo', 'pwd', 'test', 'printf', 'export', 'unset'];
// The tools that read a file's bytes themselves (its charset matters to them, see charset.ts).
const RAW_READERS = ['psql', 'iconv', 'file'];
// Commands whose BSD version answers its own way (see freebsd.ts).
const BSD_TOOLS = ['date', 'sed', 'stat', 'service', 'sysrc', 'pkg', 'sockstat', 'pfctl', 'freebsd-version'];

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
  follow: { read: () => string; screen?: boolean } | null;
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
  // The file was in DOS format (CR LF): nano writes it back so (like nano without M-D).
  dos?: boolean;
  // Closing changes the state (e.g. systemctl edit): it counts as a command, even without a message.
  conclude?: boolean;
}

/** Where the parenthesis opened at i closes (its index), quotes skipped; -1 if it doesn't. */
function closing(line: string, i: number): number {
  let depth = 0;
  let q = '';
  for (let j = i; j < line.length; j++) {
    const x = line[j];
    if (q) {
      if (x === q) q = '';
    } else if (x === '"' || x === "'") q = x;
    else if (x === '(') depth++;
    else if (x === ')' && --depth === 0) return j;
  }
  return -1;
}

/** Where the $'…' starting at i ends (its closing quote), or -1. */
function ansiEnd(line: string, i: number): number {
  for (let j = i; j < line.length; j++) {
    if (line[j] === '\\') j++;
    else if (line[j] === "'") return j;
  }
  return -1;
}

const ANSI: Record<string, string> = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };

/** bash's ANSI-C quoting (man bash, "QUOTING"): the escapes of $'…'. */
function decodeAnsi(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== '\\' || i + 1 >= text.length) {
      out += c;
      continue;
    }
    const n = text[i + 1];
    const octal = /^[0-7]{1,3}/.exec(text.slice(i + 1));
    const hex = /^x([0-9a-fA-F]{1,2})/.exec(text.slice(i + 1));
    const uni = /^[uU]([0-9a-fA-F]{1,8})/.exec(text.slice(i + 1));
    if (ANSI[n] !== undefined) {
      out += ANSI[n];
      i++;
    } else if (octal) {
      out += String.fromCharCode(parseInt(octal[0], 8) & 0xff);
      i += octal[0].length;
    } else if (hex) {
      out += String.fromCharCode(parseInt(hex[1], 16));
      i += hex[0].length;
    } else if (uni) {
      out += String.fromCodePoint(parseInt(uni[1], 16));
      i += uni[0].length;
    } else if (n === 'c' && i + 2 < text.length) {
      out += String.fromCharCode(text.charCodeAt(i + 2) & 0x1f);
      i += 2;
    } else out += c;
  }
  return out;
}

/**
 * How bash keeps an input of several lines in its history (cmdhist): one
 * entry, the lines joined by "; " (or a space after do, then, a pipe…);
 * with a here-document, the lines as they are.
 */
export function historyLine(whole: string): string {
  if (!whole.includes('\n')) return whole;
  if (/<<-?\s*['"]?\w/.test(whole)) return whole;
  const lines = whole.split('\n').map((l) => l.trim()).filter(Boolean);
  let out = '';
  for (const l of lines) {
    if (!out) out = l;
    else out += /(^|\s)(do|then|else|in|\{)$|[|&;(]$/.test(out) ? ` ${l}` : `; ${l}`;
  }
  return out;
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
  waiting: { line: string; attempts: number; stdin: string | null; capture: boolean } | null = null;
  // The lines typed so far of an input that isn't over (an open if, quote or
  // here-document…): bash shows its secondary prompt (PS2, "> ") and reads on.
  continuation: string | null = null;
  // A compound input (for, if, while…) paused by a question: the rest runs once it is answered (see control.ts).
  private program: { steps: Steps; run: Run; line: string } | null = null;
  // A loop past its first round: its commands don't count again for the summary.
  repeating = false;
  // A command whose output goes down a compound's pipe: what it wrote (see control.ts).
  piped: string | null = null;
  // The command runs in a pipeline of several commands (read there sets nothing: a subshell).
  inPipeline = false;
  // An expansion failed ($((1/0)), ${X:?}): bash drops the rest of the input.
  aborted = false;
  // The shells opened on top of the login one (sudo -i, sudo -s, su -), innermost last:
  // their account, whether it is a login shell, and what the shell below had.
  shells: { user: string; login: boolean; saved: { cwd: string; old: string | null; vars: Record<string, string>; exported: Set<string>; aliases: Record<string, string>; mask: string; who: string } }[] = [];
  // A shell to open once the current command is over (sudo -i, su).
  private opening: { user: string; login: boolean } | null = null;
  // The jobs (cmd &, Ctrl-Z): see jobs.ts.
  jobs: Job[] = [];
  // A job brought back with fg: Ctrl-Z stops it again under its own name.
  foreground: { text: string; pid: number } | null = null;
  // The inputs typed so far: a job is reported after an input later than the one that started it.
  inputCount = 0;
  // The PID of the last job put in the background ($!).
  lastBackground: number | null = null;
  // A command list (a && b; c) whose run stopped at a question (sudo's
  // password, a yes/no, nano): the rest runs once it is answered.
  private pendingList: { items: ListItem[]; line: string; commands: string[][] } | null = null;
  // The items still to come in the list being run (see listContinues).
  private listAfter: ListItem[] = [];
  // The last line typed, when it was a list: every command it ran (the notebook
  // records them; `last` stays the last command's, as the events saw it).
  listRun: { line: string; commands: string[][] } | null = null;
  // Current question (ssh: "Are you sure you want to continue connecting?").
  // secret: the answer is not displayed (a password asked by ssh).
  question: { prompt: string; answer: (response: string) => string; secret?: boolean } | null = null;
  // A session to open on another machine (ssh -J, ssh from a machine to its
  // internal network), handled by the console.
  sessionRequest: { shell: Shell; domain: string; via?: string; address: string } | null = null;
  // The story's main machine, for an internal machine.
  parent: Shell | null = null;
  // The story's internal machines created so far (see internal()).
  readonly internals = new Map<string, Shell>();
  // exit typed: the console closes the session (see console.ts).
  output = false;
  // The machine has just rebooted (reboot): the console cuts the session.
  reboot = false;
  // File open in the editor (nano): the interface shows it in place of the
  // command line. `root`: opened with sudo.
  edition: Edition | null = null;
  // A follow in progress (tail -f, journalctl -f): read() gives the lines
  // that arrived since last time. Ctrl-C stops it (Console.interrupt).
  // screen: the whole screen is redrawn (watch), rather than lines added.
  follow: { read: () => string; screen?: boolean } | null = null;
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
  // The charset the last command of a line wrote in (pg_dump of a LATIN1 database), for a redirection.
  outputCharset: 'latin1' | 'binary' | null = null;
  // The exit code of the previous line ($? in the next one).
  lastStatus = 0;
  // The permission mask of created files (umask), specific to this session.
  mask = '0022';
  // The session's variables (NAME=value) and those exported (export): a
  // program sees the exported ones, and the NAME=value written before it.
  vars: Record<string, string> = {};
  // The aliases defined in this session (alias ll='ls -l'); Debian's colour aliases are in builtins.ts.
  aliases: Record<string, string> = {};
  exported = new Set<string>();
  // Shell functions (name() { …; }): their bodies, as parsed (compound.ts).
  functions: Record<string, TreeNode> = {};
  // The positional parameters ($1, $2…, $#, $@): a script's arguments, or a function's.
  positional: string[] = [];
  // The functions being run: each one's local variables, with the value they hid (undefined: unset).
  locals: Record<string, string | undefined>[] = [];
  // set -e, -u, -x, -o pipefail (they act in scripts: script.ts, control.ts).
  options = { e: false, u: false, x: false, pipefail: false };
  // trap 'action' SIGNAL: EXIT's action runs when a script ends.
  traps: Record<string, string> = {};
  // The script (or sh -c line) running now: its name, its shell's dialect, its line (dialect.ts).
  script: ScriptRun | null = null;
  // Each command's exit code in the last pipeline (set -o pipefail).
  pipeStatus: number[] = [];
  // The exit code of the last command substitution (an assignment alone takes it: X=$(false) fails).
  substitution: number | null = null;
  // Nested command substitutions (set -x writes ++ for bash).
  captureDepth = 0;
  // What the last pipeline wrote on its standard output (without its errors).
  private tubeOutput = '';
  // The environment of the command running now (restic reads RESTIC_* there).
  // sudo resets it (env_reset): only NAME=value written after sudo, or -E, pass.
  environment: Record<string, string> = {};
  // The file the current command's output goes to (> file), if there is one: wg genkey looks at it.
  outputTo: string | null = null;
  // A command substitution is running: its output goes into the line, not to the screen.
  private capturing = false;
  // The errors the last pipeline wrote on screen (not those sent to a file).
  private shownErrors: string[] = [];
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
    // What every Debian machine has, when the chapter didn't model it (debian.ts).
    debianDefaults(this);
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

  /** The PID of the login shell ($$): after the machine's processes (state.process), deterministic. */
  get shellPid(): number {
    if (typeof this.state.bashPid !== 'number') {
      const pids = ((this.state.process ?? []) as { pid: number }[]).map((p) => p.pid);
      this.state.bashPid = Math.max(2417, ...pids.filter((p) => p < 30000)) + 1;
    }
    return this.state.bashPid as number;
  }

  /** The account of the shell typed in: the player's, or root's after sudo -i. */
  get shellUser(): string {
    return this.shells.at(-1)?.user ?? this.player;
  }

  /** That shell's home ($HOME, ~, cd): /root for root. */
  get shellHome(): string {
    const user = this.shells.at(-1)?.user;
    if (!user) return this.home;
    return this.accounts.users[user]?.home ?? (user === 'root' ? '/root' : `/home/${user}`);
  }

  /**
   * Opens a shell as this account once the current command is over (sudo -i,
   * sudo -s, sudo su, su -): `login` (-i, su -) starts it in its home, with a
   * fresh environment; otherwise it stays here. exit (or Ctrl-D) goes back.
   */
  openShell(user: string, login: boolean): void {
    this.opening = { user, login };
  }

  // The shell asked for by the command that just ran.
  private enterShell(): void {
    const o = this.opening;
    if (!o) return;
    this.opening = null;
    this.shells.push({ user: o.user, login: o.login, saved: { cwd: this.cwd, old: this.old, vars: this.vars, exported: this.exported, aliases: this.aliases, mask: this.mask, who: this.who } });
    this.who = o.user;
    // sudo resets the environment (env_reset): the variables and aliases of the shell below are not there.
    this.vars = {};
    this.exported = new Set();
    this.aliases = {};
    if (!o.login) return;
    const home = this.shellHome;
    // Debian always has /root (rwx------): a world that didn't describe it gets it now.
    if (!this.exists(home) && o.user === 'root') {
      const parent = this.find('/');
      if (parent?.type === 'directory') parent.children.root = { type: 'directory', children: {}, owner: 'root', group: 'root', mode: 'rwx------' };
    }
    if (this.find(home)?.type === 'directory') {
      this.old = null;
      this.cwd = home;
      this.visits.add(home);
    }
  }

  /** Leaves the innermost shell (exit, Ctrl-D): bash says logout for a login shell, exit otherwise. */
  private leaveShell(): string {
    const s = this.shells.pop()!;
    Object.assign(this, s.saved);
    return s.login ? 'logout' : 'exit';
  }

  /** Back to the login shell (a new connection, a reboot). */
  closeShells(): void {
    while (this.shells.length) this.leaveShell();
    this.opening = null;
  }

  /** A new process's PID, after the login shell's (the jobs). */
  nextPid(): number {
    const pid = (typeof this.state.nextPid === 'number' ? this.state.nextPid : this.shellPid + 100) as number;
    this.state.nextPid = pid + 1;
    return pid;
  }

  /** Ctrl-Z: the follow in the foreground (tail -f, watch) stops and becomes a job. */
  suspend(): string {
    if (!this.follow) return '';
    const text = this.foreground?.text ?? this.commandLine;
    const job = addJob(this, text, 'Stopped');
    if (this.foreground) job.pid = this.foreground.pid;
    job.follow = this.follow;
    this.follow = null;
    this.foreground = null;
    this.lastStatus = 148;
    return `^Z\n[${job.id}]+  ${'Stopped'.padEnd(24)}${text}`;
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
    // Through an NFS mount, the server decides, with this machine's numbers (see nfs.ts).
    const remote = nfsAccess(this, n, right, user) ?? cifsAccess(this, n, right, user);
    if (remote !== null) return remote;
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
    // A LATIN1 file read by a tool that only passes bytes on to a UTF-8 terminal: � for each accent.
    if (n.charset === 'latin1' && !RAW_READERS.includes(cmd)) return onUtf8Terminal(content(n, this));
    // Debian's ~/.bashrc sets up lesspipe: less shows a compressed file's text (less syslog.2.gz).
    if (n.charset === 'binary' && cmd === 'less') {
      const u = unpack(content(n, this));
      if (u) {
        if (u.charset) this.outputCharset = u.charset;
        return u.text;
      }
    }
    // Raw bytes (an EBCDIC file): passed on as they are; the terminal shows them its own way (see tube).
    if (n.charset === 'binary') this.outputCharset = 'binary';
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
    // chattr +i on the place, or on what is there: even root may not.
    if (immutable(parent) || immutable(parent.children[this.name(path)]) || appendOnly(parent.children[this.name(path)]))
      return `${cmd === 'bash' ? '-bash' : cmd}: ${path}: Operation not permitted`;
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
      ownForServer(this, parent, n);
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
    const mounts: { path: string; capacity: number; inodes?: number; pseudo?: boolean }[] = this.state.mounts ?? [];
    return (
      mounts
        .filter((m) => !m.pseudo)
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
    // A Windows share: the server's volume, files outside the share included.
    const remote = cifsUsage(this, m.path);
    if (remote) return remote.used - (old ? this.size(old) : 0) + this.size(n) > remote.capacity;
    // No free inode left: no way to create a file, even an empty one ("No space left on device").
    if (m.inodes && !old && this.usedInodes(m) >= m.inodes) return true;
    const place = this.find(m.path);
    // Without the other media mounted inside it (/srv is not on /), like df.
    const inside = ((this.state.mounts ?? []) as { path: string }[]).filter(
      (x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')),
    );
    const other = inside.reduce((t, x) => t + ((d) => (d ? this.size(d) : 0))(this.find(x.path)), 0);
    const inUse = (place ? this.size(place) : 0) - other + ((m as { bytesBase?: number }).bytesBase ?? 0);
    return inUse - (old ? this.size(old) : 0) + this.size(n) > m.capacity;
  }

  // ——— Outputs ———

  error(message: string, code?: number): '' {
    this.errors.push(message);
    // The real tool's exit code (e.g. userdel: 6 for an unknown account), otherwise 1.
    if (code !== undefined) this.status = code;
    return '';
  }

  /** How many errors were written so far in this command (to stop at the first failure, like psql -c). */
  errorCount(): number {
    return this.errors.length;
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
    // bash's secondary prompt (PS2): the input goes on.
    if (this.continuation !== null) return '>';
    // A Windows Server's PowerShell (see powershell.ts).
    if (isWindows(this)) return windowsPrompt(this);
    const home = this.shellHome;
    const here = this.cwd === home ? '~' : this.cwd.startsWith(home + '/') ? '~' + this.cwd.slice(home.length) : this.cwd;
    // In tmux, the status bar shows the session's name: we put it in front of the prompt.
    // root (sudo -i, or a chapter's rescue console) has its own prompt, with #, like bash.
    const root = this.who === 'root';
    const user = this.shells.length ? this.shellUser : root ? 'root' : this.player;
    return `${this.tmux ? `[${this.tmux}] ` : ''}${user}@${this.hostName}:${here}${root ? '#' : '$'}`;
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
      home: def.home ?? '/home/you',
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
      afterCommand: def.afterCommand,
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

  // Expands *, ? and [...] as the shell does, before the command, in every
  // part of a path (*/*.conf; a final / keeps only places). Hidden files are
  // only matched if the pattern starts with a dot. No match: the word stays.
  expand(word: string): string[] {
    if (!hasGlob(word)) return [word];
    const absolute = word.startsWith('/');
    const parts = word.split('/');
    // The paths found so far, as typed (relative or absolute).
    let found: string[] = [absolute ? '/' : ''];
    for (let k = absolute ? 1 : 0; k < parts.length; k++) {
      const part = parts[k];
      const lastPart = k === parts.length - 1;
      const join = (base: string, name: string) => (base === '' ? name : base.endsWith('/') ? base + name : `${base}/${name}`);
      if (part === '') {
        // A final / (*/): only places; a double // stays.
        if (lastPart) found = found.filter((f) => this.find(f || '.')?.type === 'directory').map((f) => f + '/');
        continue;
      }
      if (!hasGlob(part)) {
        found = found.map((f) => join(f, part));
        continue;
      }
      const re = glob(part);
      found = found.flatMap((base) => {
        const place = this.find(base || '.');
        if (place?.type !== 'directory' || this.block(base || '.') || !this.can(place, 'r')) return [];
        return Object.keys(place.children)
          .filter((n) => re.test(n) && (part.startsWith('.') || !n.startsWith('.')))
          .sort(compareNames)
          .map((n) => join(base, n));
      });
      if (!found.length) return [word];
    }
    return found.length ? found : [word];
  }

  /**
   * A word's tilde (man bash, "Tilde Expansion"): ~ and ~/… are your home,
   * ~account that account's (as /etc/passwd gives it), ~+ the current place, ~- the previous one.
   */
  tilde(word: string): string {
    const m = /^~([^/]*)(\/.*)?$/.exec(word);
    if (!m) return word;
    const [, who, rest = ''] = m;
    const home = who === '' ? this.shellHome : who === '+' ? this.cwd : who === '-' ? this.old : this.accounts.users[who] ? (this.accounts.users[who].home ?? (who === 'root' ? '/root' : `/home/${who}`)) : null;
    return home === null ? word : home + rest;
  }

  /**
   * The value of a variable (man bash, "Shell Variables"): the session's, then
   * those a Debian login sets (HOME, USER, LOGNAME, SHELL, PATH from
   * /etc/profile, PWD, OLDPWD, HOSTNAME, UID, TERM). Undefined: null.
   */
  variable(name: string): string | null {
    // The special parameters: $? the last exit code, $$ the shell's PID, $! the last
    // background job's, $0 the login shell, $1… $# $@ $* (no arguments on the line), $- its options.
    if (name === '?') return String(this.lastStatus);
    if (name === '$') return String(this.shellPid);
    if (name === '!') return this.lastBackground === null ? null : String(this.lastBackground);
    if (name === '0') return this.script?.name ?? '-bash';
    if (name === '#') return String(this.positional.length);
    if (name === '-') return this.script ? `${this.options.e ? 'e' : ''}${this.options.u ? 'u' : ''}${this.options.x ? 'x' : ''}${this.script.dialect === 'bash' ? 'hB' : ''}` : 'himBHs';
    if (/^\d+$/.test(name)) return this.positional[Number(name) - 1] ?? null;
    if (name === '@' || name === '*') return this.positional.length ? this.positional.join(' ') : null;
    if (Object.hasOwn(this.vars, name)) return this.vars[name];
    // bash's own variables, not in the environment.
    if (name === 'HOSTNAME') return this.read('/etc/hostname')?.trim() || this.hostName;
    if (name === 'UID' || name === 'EUID') return String(this.shellUser === 'root' ? 0 : (this.accounts.users[this.shellUser]?.uid ?? 1000));
    return this.defaults()[name] ?? null;
  }

  /** The environment a login gives the player (env, printenv, $HOME…). */
  defaults(): Record<string, string> {
    const user = this.shellUser;
    const v: Record<string, string> = {
      HOME: this.shellHome,
      LANG: 'C.UTF-8',
      LOGNAME: user,
      // root's PATH: sudo's secure_path (Debian's /etc/sudoers), with the sbin directories.
      PATH: user === 'root' ? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' : '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games',
      PWD: this.cwd,
      SHELL: this.accounts.users[user]?.shell ?? '/bin/bash',
      TERM: 'xterm-256color',
      USER: user,
    };
    if (this.old !== null) v.OLDPWD = this.old;
    return v;
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
    // PowerShell: cmdlet names, parameters, Windows paths (commands/powershell.ts).
    if (isWindows(this)) return psComplete(this, line);
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
    if (isWindows(this)) {
      const { names } = psCandidates(this, line);
      return names.length > 1 ? names : [];
    }
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
    // bash's harmless builtins are always there, and a command brings its
    // everyday companions (find brings xargs, mkdir rmdir…: see COMPANIONS).
    const { own, kept } = this.commandSets();
    return [...own, ...kept];
  }

  /**
   * The chapter's own commands (with their companions and the shell's), and
   * those it keeps from the chapters it assumes, when they exist on this
   * machine (see availability.ts).
   */
  private commandSets(): { own: string[]; kept: string[] } {
    const mine = this.chapter.commands;
    const own = [...new Set([...mine, ...mine.flatMap((c) => COMPANIONS[c] ?? []), 'man', 'apropos', 'whatis', 'clear', 'exit', 'history', ...ALWAYS_THERE, this.t('command-help')])];
    const source = this.inheritsFrom;
    const inherited = source ? inheritedHere(this, source) : [];
    const kept = [...new Set([...inherited, ...inherited.flatMap((c) => COMPANIONS[c] ?? [])])].filter((c) => !own.includes(c));
    return { own, kept };
  }

  /**
   * The chapter whose assumed chapters this machine inherits commands from:
   * its own; on an internal host, the story's chapter unless the host lists
   * what is installed on it (InternalHost.commands).
   */
  private get inheritsFrom(): Chapter | null {
    if (!this.parent) return this.chapter;
    return this.principal.chapter.hosts?.[this.host]?.commands ? null : this.principal.chapter;
  }

  /** An inherited command this machine doesn't have (another system's, or a tool not installed here). */
  private notHere(cmd: string): boolean {
    const source = this.inheritsFrom;
    return !!source && !this.chapter.commands.includes(cmd) && inherited(source).includes(cmd) && !inheritedHere(this, source).includes(cmd);
  }

  /** Runs one of the game's commands from another (command ls, xargs grep): its output, as in a pipe unless `last`. */
  run(args: string[], input: string | null, last = false): string {
    return this.launch(args, input, false, last);
  }


  // man, apropos, whatis: the manual covers every command of the game, even
  // those not yet available in this chapter (as on a real system, where the
  // manual also describes what you are not allowed to run).
  private consulter(cmd: string, rest: string[]): string {
    const all = Object.entries(COMMANDS).filter(([n]) => n !== 'aide').sort(([a], [b]) => a.localeCompare(b));
    // Files (section 5) and overviews (section 7) are not commands: no note for them.
    const notStill = (n: string) => (this.known().includes(n) || COMMANDS[n]?.cl || COMMANDS[n]?.cmdlet || COMMANDS[n]?.winexe || [5, 7].includes(COMMANDS[n]?.section ?? 1) ? '' : '\n\n' + this.t('manual-not-still'));
    if (cmd === 'apropos' || (cmd === 'man' && rest[0] === '-k')) {
      const word = cmd === 'apropos' ? rest[0] : rest[1];
      if (!word) return this.error(this.t('manual-what-search', { command: cmd === 'apropos' ? 'apropos' : 'man -k' }));
      const lines = apropos(word, all.map(([n]) => n), this.t);
      return lines.length ? lines.join('\n') : this.error(this.t('manual-nothing', { word: word }));
    }
    if (!rest.length)
      return this.error(cmd === 'man' ? this.t('manual-which-page') : this.t('manual-what-search', { command: 'whatis' }));
    const outputs: string[] = [];
    for (const asked of rest) {
      // IBM i's CL commands are written in capitals, but man wrkactjob finds them too.
      // PowerShell's cmdlets too, whatever the case (man get-childitem).
      const cmdlet = !COMMANDS[asked] ? Object.keys(COMMANDS).find((k) => (COMMANDS[k]?.cmdlet || COMMANDS[k]?.winexe) && k.toLowerCase() === asked.toLowerCase()) : undefined;
      const name = cmdlet ?? (!COMMANDS[asked] && COMMANDS[asked.toUpperCase()]?.cl ? asked.toUpperCase() : asked);
      const c = COMMANDS[name];
      if (!c || name === 'aide') {
        this.error(cmd === 'man' ? this.t('manual-not-page', { command: name }) : this.t('manual-nothing', { word: name }));
        continue;
      }
      const flavour = isBsd(this) ? 'bsd' : isSolaris(this) ? 'solaris' : '';
      outputs.push(cmd === 'man' ? pageMan(name, c, this.t, flavour) + notStill(name) : whatisLine(name, this.t, flavour));
    }
    return outputs.join(cmd === 'man' ? '\n\n' : '\n');
  }

  // ——— Execution ———

  // Runs a line; returns the text to display, or null for "clear".
  // If sudo is waiting for a password, the line is that password.
  // The jobs that ended since are reported after it, like bash before its prompt.
  execute(line: string): string | null {
    this.inputCount++;
    const output = this.executeLine(line);
    if (output === null || this.continuation !== null || this.waiting || this.question || !this.jobs.length) return output;
    return [output, notices(this)].filter(Boolean).join('\n');
  }

  private executeLine(line: string): string | null {
    this.listRun = null;
    if (this.waiting) return this.password(line);
    if (this.question) {
      const { answer } = this.question;
      this.question = null;
      const reply = answer(line.trim());
      // An answer may open a shell (su's password).
      this.enterShell();
      const answered = this.conclude(reply, true);
      return this.resumeList(answered, this.status ?? 0);
    }
    // A Windows Server's PowerShell: its own syntax, its cmdlets (commands/powershell.ts).
    if (isWindows(this)) {
      if (line.trim() && !/^\s/.test(line) && this.history.at(-1) !== line) this.history.push(line);
      const output = currentShell(this) === 'cmd' ? runCmd(this, line) : runPowerShell(this, line);
      return output === null ? null : this.conclude(this.countLine(output), true);
    }
    // Ctrl-D (the interface sends the end-of-transmission character).
    if (line === '\u0004') return this.endOfInput();
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
    // The next line of an input that wasn't over (PS2).
    const whole = this.continuation === null ? line : `${this.continuation}\n${line}`;
    const parsed = parse(whole);
    if ('incomplete' in parsed) {
      this.continuation = whole;
      return echo;
    }
    this.continuation = null;
    // Like HISTCONTROL=ignoreboth (Debian's ~/.bashrc): neither lines starting with a space, nor consecutive duplicates.
    const kept = historyLine(whole);
    if (kept.trim() && !/^\s/.test(whole) && this.history.at(-1) !== kept) this.history.push(kept);
    const output = this.runInput(whole, parsed);
    if (!echo) return output;
    return output === null ? null : [echo, output].filter(Boolean).join('\n');
  }

  /**
   * Ctrl-D: on an empty line, the end of the input (bash leaves the shell, as
   * exit does); in the middle of an input (PS2), bash's "unexpected end of
   * file" (a here-document ends there, with a warning).
   */
  endOfInput(): string | null {
    if (this.continuation === null) return this.execute('exit');
    const whole = this.continuation;
    this.continuation = null;
    const parsed = parse(whole, true);
    if ('error' in parsed && parsed.eof) {
      this.typedCommands++;
      this.commandsInError++;
      this.status = 2;
      this.lastStatus = 2;
      return this.t('syntax-eof');
    }
    if ('error' in parsed || 'incomplete' in parsed) return this.runInput(whole, parsed);
    const lines = whole.split('\n').length;
    const warnings = unterminated(parsed.list).map((h) => this.t('heredoc-eof', { line: String(lines), delimiter: h.delimiter }));
    const kept = historyLine(whole);
    if (kept.trim() && this.history.at(-1) !== kept) this.history.push(kept);
    const output = this.runInput(whole, parsed);
    return output === null ? null : [...warnings, output].filter(Boolean).join('\n');
  }

  /** Ctrl-C at the secondary prompt: the input is dropped. */
  dropInput(): boolean {
    if (this.continuation === null) return false;
    this.continuation = null;
    return true;
  }

  // A whole input, parsed: a plain list runs the usual way; for, if, while… through control.ts.
  private runInput(whole: string, parsed: ReturnType<typeof parse>): string | null {
    if ('error' in parsed) {
      this.pendingList = null;
      this.program = null;
      this.typedCommands++;
      this.commandsInError++;
      // bash: a syntax error is exit code 2.
      this.status = 2;
      this.lastStatus = 2;
      return parsed.error === '' ? this.t('syntax-end') : this.t('syntax-token', { token: parsed.error });
    }
    if ('incomplete' in parsed) return '';
    if (!whole.includes('\n') && plainList(parsed.list) && !this.flowIn(parsed.list)) return this.runLine(whole);
    return this.runProgram(parsed.list, whole);
  }

  /** Whether a plain list calls a function, source or ".": those run through control.ts. */
  private flowIn(list: List): boolean {
    const first = (n: TreeNode): boolean =>
      n.kind === 'simple'
        ? ((w) => w === 'source' || w === '.' || Object.hasOwn(this.functions, w))(split(n.text)[0]?.text ?? '')
        : n.kind === 'pipeline' ? n.parts.some(first) : n.kind === 'andor' ? first(n.first) || n.rest.some((r) => first(r.node)) : false;
    return list.some((e) => first(e.node));
  }

  /** Runs a parsed input (control.ts), from the start. */
  private runProgram(tree: List, line: string): string | null {
    this.pendingList = null;
    this.aborted = false;
    const run = newRun();
    return this.drive({ steps: runTree(this, run, tree, { stdin: null, capture: null }), run, line });
  }

  // Runs a program until it ends or a question pauses it.
  private drive(p: { steps: Steps; run: Run; line: string }): string | null {
    const step = p.steps.next();
    if (!step.done) {
      this.program = p;
      return flush(p.run);
    }
    this.program = null;
    this.lastStatus = step.value;
    this.listRun = { line: historyLine(p.line), commands: p.run.commands };
    return flush(p.run);
  }

  /** A job in the background (cmd &): see jobs. */
  *background(run: Run, entry: ListEntry, go: () => Steps): Steps {
    const job = addJob(this, entry.text, 'Running');
    show(run, `[${job.id}] ${job.pid}`);
    const first = entry.node.kind === 'simple' ? split(entry.node.text).map((w) => w.text).find((w) => !/^[A-Za-z_]\w*=/.test(w) && w !== 'nohup') : '';
    // sleep runs on: time only passes in the game while following.
    if (first === 'sleep' && this.known().includes('sleep')) return 0;
    const status = yield* go();
    if (this.follow) {
      // A follow (tail -f): it goes on in the background, out of sight.
      job.follow = this.follow;
      this.follow = null;
      run.stopped = this.output || this.cut || this.reboot || !!this.connectionRequest || !!this.sessionRequest;
    } else {
      job.state = status === 0 ? 'Done' : 'Exit';
      job.code = status;
    }
    this.lastBackground = job.pid;
    return 0;
  }

  /**
   * One command (or a pipeline) of a compound input, as if typed alone; its
   * input, if it has one (a here-document, the pipe before it); capture: its
   * output goes down a pipe (into `piped`) rather than to the screen.
   */
  runSimple(line: string, stdin: string | null, capture: boolean): string | null {
    return this.runCommand(line, stdin, capture);
  }

  /** read [-r] [-p prompt] [name…] with a line of input (null: none left); returns its exit code. */
  readLine(words: string[], line: string | null): number {
    let raw = false;
    const names: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === '-p' || w === '-t' || w === '-n' || w === '-d' || w === '-u') i++;
      else if (/^-[rsea]+$/.test(w)) raw ||= w.includes('r');
      else if (/^-/.test(w)) {
        this.error(`-bash: read: ${w.slice(0, 2)}: invalid option\nread: usage: read [-ers] [-a array] [-d delim] [-i text] [-n nchars] [-N nchars] [-p prompt] [-t timeout] [-u fd] [name ...]`, 2);
        return 2;
      } else if (!/^[A-Za-z_]\w*$/.test(w)) {
        this.error(`-bash: read: \`${w}': not a valid identifier`);
        return 1;
      } else names.push(w);
    }
    if (!names.length) names.push('REPLY');
    let text = line ?? '';
    // Without -r, a backslash protects the next character (and is removed).
    if (!raw) text = text.replace(/\\(.)/g, '$1').replace(/\\$/, '');
    if (names.length === 1 && names[0] === 'REPLY') this.vars.REPLY = text;
    else {
      // Split on blanks (IFS): one field per name, the rest of the line for the last one.
      let rest = text.replace(/^[ \t]+/, '');
      names.forEach((n, i) => {
        if (i === names.length - 1) this.vars[n] = rest.replace(/[ \t]+$/, '');
        else {
          const m = /^(\S*)[ \t]*/.exec(rest)!;
          this.vars[n] = m[1];
          rest = rest.slice(m[0].length);
        }
      });
    }
    return line === null ? 1 : 0;
  }

  /** Expands words as a command's arguments are (for's list): variables, $(…), braces, ~, wildcards. */
  expandWords(raw: string[]): { words: string[]; errors: string[] } {
    const words: string[] = [];
    const errors: string[] = [];
    for (const r of raw) {
      const e = this.expandLine(r);
      errors.push(...e.errors);
      for (const w of split(e.line)) words.push(...(w.city ? [w.text] : braces(w.text).flatMap((x) => this.expand(this.tilde(x)))));
    }
    return { words, errors };
  }

  /** A word expanded into one string (case's word, a redirection's file): no splitting, no wildcards. */
  expandWord(raw: string): string {
    return split(this.expandLine(raw).line)
      .map((w) => (w.city ? w.text : this.tilde(w.text)))
      .join(' ');
  }

  /** The variables as arithmetic sees them (assignments go to the session). */
  arithVars(): ArithVars {
    return { get: (n) => this.variable(n), set: (n, v) => (this.vars[n] = v) };
  }

  /** An arithmetic expression's $NAME, ${…} and $(…), expanded first (like bash). */
  expandArith(expr: string): string {
    return this.expandLine(expr, true).line;
  }

  /** Writes a compound's output to a file (> or >>); returns an error. */
  writeOutput(file: string, text: string, append: boolean): string | null {
    return this.redirect(file, text, append);
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
      const m = /^(!|\$|\^|\*|-?\d+|[A-Za-z_./][^\s;|&<>()]*)/.exec(rest);
      if (!m) {
        output += c;
        continue;
      }
      const h = this.history;
      const pattern = m[1];
      // !$, !^, !*: the previous line's last word, first argument, all arguments (as typed, quotes kept).
      const previous = h.at(-1);
      const typed = previous === undefined ? [] : (previous.match(/(?:[^\s'"]+|'[^']*'|"[^"]*")+/g) ?? []);
      const word = pattern === '$' ? typed.at(-1) : pattern === '^' ? typed[1] : pattern === '*' ? typed.slice(1).join(' ') : null;
      if (word !== null) {
        if (previous === undefined) return { line, error: `-bash: !${pattern}: event not found` };
        if (word === undefined) return { line, error: `-bash: !${pattern}: bad word specifier` };
        output += word;
        i += 1;
        continue;
      }
      const match =
        pattern === '!' ? h.at(-1) : /^-?\d+$/.test(pattern) ? (Number(pattern) < 0 ? h.at(Number(pattern)) : h[Number(pattern) - 1]) : [...h].reverse().find((l) => l.startsWith(pattern));
      if (match === undefined) return { line, error: `-bash: !${pattern}: event not found` };
      output += match;
      i += pattern.length;
    }
    return { line: output };
  }

  // The line, once history is expanded: a command list (a && b || c; d),
  // like bash (man bash, "Lists"). Each command runs as if typed alone (the
  // story's events, afterCommand, $?); the history keeps the whole line.
  private runLine(line: string): string | null {
    // A new line: a list left paused (a question abandoned) is over.
    this.pendingList = null;
    this.program = null;
    this.aborted = false;
    const list = splitList(line);
    if ('error' in list) {
      this.typedCommands++;
      this.commandsInError++;
      // bash: a syntax error is exit code 2.
      this.status = 2;
      this.lastStatus = 2;
      return list.token ? this.t('syntax-token', { token: list.token }) : this.t('syntax-end');
    }
    if (list.items.length <= 1) return this.runCommand(list.items[0]?.command ?? line);
    return this.runList(list.items, line, [], []);
  }

  /**
   * Runs the items of a list, from the first: "a && b" runs b only if a
   * succeeded, "a || b" only if it failed (a skipped command leaves $? as
   * it was), ";" always. A command that leaves the session (exit, ssh,
   * reboot, a cut network, tail -f) ends the list there: the rest is
   * dropped (bash would run it after, on this machine). A question (sudo's
   * password, a confirmation, nano) pauses it until it is answered.
   */
  private runList(items: ListItem[], line: string, outputs: string[], commands: string[][]): string | null {
    let cleared = false;
    for (let k = 0; k < items.length; k++) {
      const item = items[k];
      if (!listRuns(item.before, this.lastStatus)) continue;
      this.listAfter = items.slice(k + 1);
      const lastBefore = this.last;
      let output: string | null;
      try {
        output = this.runCommand(item.command.trim());
      } finally {
        this.listAfter = [];
      }
      if (this.last !== lastBefore) commands.push(...this.last.commands);
      // clear in a list: what came before is wiped.
      if (output === null) {
        outputs = [];
        cleared = true;
      } else outputs.push(output);
      if (this.waiting || this.question || this.edition) {
        this.pendingList = { items: items.slice(k + 1), line, commands };
        break;
      }
      if (this.output || this.cut || this.reboot || this.connectionRequest || this.sessionRequest || this.follow || this.aborted) break;
    }
    // For the notebook: every command the line ran, under the whole line.
    if (!this.pendingList) this.listRun = { line: line.trim(), commands };
    const text = outputs.filter(Boolean).join('\n');
    return cleared && !text ? null : text;
  }

  /** After a question is answered: the rest of the list it paused, if any. */
  private resumeList(output: string | null, status: number): string | null {
    // A compound input (for, while…) paused by the question: it goes on.
    const program = this.program;
    if (program && !this.waiting && !this.question && !this.edition) {
      this.lastStatus = status;
      show(program.run, output);
      return this.drive(program);
    }
    const pending = this.pendingList;
    if (!pending || this.waiting || this.question || this.edition) return output;
    this.pendingList = null;
    this.lastStatus = status;
    return this.runList(pending.items, pending.line, output === null ? [] : [output], pending.commands);
  }

  /** Whether another command of the list being run will run right after this one (a chapter's afterCommand may wait for it). */
  get listContinues(): boolean {
    return this.listAfter.some((i) => listRuns(i.before, this.lastStatus));
  }

  // One command of the line (a pipeline, with its redirection).
  private runCommand(line: string, stdin: string | null = null, capture = false): string | null {
    const expanded = this.expandLine(this.withAliases(line));
    line = expanded.line;
    const words = split(line);
    // An expansion that failed ($((1/0)), ${X:?}): bash doesn't run the command.
    if (expanded.failed) {
      this.aborted = true;
      this.typedCommands++;
      this.commandsInError++;
      this.status = 1;
      this.lastStatus = 1;
      return expanded.errors.join('\n');
    }
    if (!words.length) {
      // A line of expansions only ($EMPTY): $? stays as it was, the substitution's errors show.
      return expanded.errors.join('\n');
    }
    if (!this.repeating) this.typedCommands++;
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
      // A shell opened with sudo -i, sudo -s or su: back to the one below.
      if (this.shells.length) return this.conclude(this.leaveShell(), true);
      // The emergency-mode shell: exit resumes booting (see fstab.ts).
      const rescue = this.state.continueBoot as ((j: Shell) => string) | undefined;
      if (this.state.rescue && rescue) return this.conclude(rescue(this), true);
      this.output = true;
      return '';
    }
    // sudo asks for the password before running anything.
    const withSudo = words.some((m, i) => !m.city && m.text === 'sudo' && (i === 0 || words[i - 1].op === '|'));
    // An error in sudo's policy (a file in /etc/sudoers.d written without visudo): sudo refuses everything.
    if (withSudo && this.known().includes('sudo') && this.exists(sudoersFile(this))) {
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
    if (withSudo && this.known().includes('sudo') && !this.authenticated && this.who !== 'root') {
      this.waiting = { line, attempts: 0, stdin, capture };
      const lecture = this.doneLecture ? '' : this.t('sudo-lecture');
      this.doneLecture = true;
      return lecture;
    }
    this.chapter.beforeCommand?.(this);
    if (this.chapter.activity) live(this, this.chapter.activity.not);
    const output = this.countLine(this.tube(line, words, stdin, capture));
    this.enterShell();
    // What went down the pipe, kept while the chapter looks at the command.
    const piped = this.piped;
    try {
      return this.conclude([...expanded.errors, output].filter(Boolean).join('\n'), true);
    } finally {
      this.piped = piped;
    }
  }

  /**
   * Aliases (man bash, "ALIASES"): the first word of each command of the
   * pipeline, unquoted, replaced by its alias's text (once: an alias that
   * starts with its own name, alias ls='ls -F', is not expanded again).
   */
  withAliases(line: string): string {
    if (!Object.keys(this.aliases).length) return line;
    let out = '';
    let quote = '';
    let start = true;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === quote) quote = '';
        out += c;
        continue;
      }
      if (start && /\S/.test(c)) {
        start = false;
        const m = /^[^\s|;&<>()'"\\]+(?=[\s|;&<>()]|$)/.exec(line.slice(i));
        if (m && Object.hasOwn(this.aliases, m[0])) {
          out += this.aliases[m[0]];
          i += m[0].length - 1;
          continue;
        }
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === '|') start = true;
      out += c;
    }
    return out;
  }

  /**
   * Expands a command's line before it is split (man bash, "EXPANSION"),
   * outside single quotes: $? and ${?} (the last exit code), $NAME and
   * ${NAME} (an unset variable is empty, like bash), the special parameters
   * ($$, $!, $#, $0, $1…), parameter expansion (${NAME:-word}, ${#NAME},
   * ${NAME%suffix}, ${NAME/a/b}…, see parameter()), arithmetic $((…)) and
   * command substitution, $(…) and `…`: the command's output, without its
   * final newlines; unquoted, its words stay words (an operator in them is no
   * operator). The errors of the substituted commands go to the screen; an
   * arithmetic or ${NAME:?} error fails the command (`failed`).
   * `heredoc`: a here-document's body (or an arithmetic expression), where
   * quotes are ordinary characters and values go in as they are.
   */
  expandLine(line: string, heredoc = false): { line: string; errors: string[]; failed?: boolean; arithmetic?: boolean } {
    let out = '';
    let quote = '';
    const errors: string[] = [];
    let failed = false;
    // Not only an arithmetic error ($((1/0))): an unset variable under set -u, ${X:?}: a script's shell stops there.
    let fatal = false;
    // A value put into the line: quoted or in a here-document, as it is; unquoted, its words, each kept a word.
    const put = (value: string) => {
      if (heredoc) out += value;
      // Inside double quotes, the value stays one piece of the word (its quotes and backslashes are text).
      else if (quote) out += value.replace(/[\\"$`]/g, '\\$&');
      else out += value.split(/[ \t\n]+/).filter(Boolean).map((w) => (/[|&;<>"'\s]/.test(w) ? (w.includes("'") ? `"${w}"` : `'${w}'`) : w)).join(' ');
    };
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote === "'") {
        if (c === "'") quote = '';
        out += c;
        continue;
      }
      // bash's $'…' (ANSI-C quoting): \n, \t, \r… decoded, as a single-quoted word. Not in sh.
      if (c === '$' && line[i + 1] === "'" && !quote && !heredoc && (this.script?.dialect ?? 'bash') === 'bash') {
        const end = ansiEnd(line, i + 2);
        if (end > 0) {
          out += `'${decodeAnsi(line.slice(i + 2, end)).replace(/'/g, `'"'"'`)}'`;
          i = end;
          continue;
        }
      }
      if (c === "'" && !quote && !heredoc) {
        quote = "'";
        out += c;
        continue;
      }
      if (c === '"' && !heredoc) {
        quote = quote === '"' ? '' : '"';
        out += c;
        continue;
      }
      // \$ and \` stay as typed (split() drops the backslash); in a here-document, the backslash goes.
      if (c === '\\' && i + 1 < line.length) {
        if (heredoc) out += /[$`\\]/.test(line[i + 1]) ? line[++i] : c;
        else out += c + line[++i];
        continue;
      }
      // $((…)): arithmetic.
      if (c === '$' && line.startsWith('$((', i)) {
        const end = closing(line, i + 1);
        if (end > 0 && line[end - 1] === ')') {
          const expr = line.slice(i + 3, end - 1);
          i = end;
          try {
            out += String(arithmetic(this.expandLine(expr, true).line, this.arithVars()));
          } catch (e) {
            if (!(e instanceof ArithError)) throw e;
            // dash words it its way (only division by zero is told apart here).
            const dash = !!this.script && this.script.dialect !== 'bash';
            errors.push(`${this.errorPrefix()}: ${dash ? (/division by 0/.test(e.message) ? `arithmetic expression: division by zero: "${expr}"` : `arithmetic expression: expecting primary: "${expr}"`) : e.message}`);
            failed = true;
          }
          continue;
        }
      }
      // $(…) and `…`: the command inside, up to its closing parenthesis or backtick.
      let inner: string | null = null;
      if (c === '$' && line[i + 1] === '(') {
        const j = closing(line, i + 1);
        if (j > 0) {
          inner = line.slice(i + 2, j);
          i = j;
        }
      } else if (c === '`') {
        const j = line.indexOf('`', i + 1);
        if (j > 0) {
          inner = line.slice(i + 1, j);
          i = j;
        }
      }
      if (inner !== null) {
        const r = this.capture(inner);
        errors.push(...r.errors);
        put(r.output.replace(/\n+$/, ''));
        continue;
      }
      // ${…}: parameter expansion.
      if (c === '$' && line[i + 1] === '{') {
        let depth = 0;
        let j = i + 1;
        for (; j < line.length; j++) {
          if (line[j] === '\\') j++;
          else if (line[j] === '{') depth++;
          else if (line[j] === '}' && --depth === 0) break;
        }
        if (j < line.length) {
          const r = this.parameter(line.slice(i + 2, j));
          i = j;
          if ('error' in r) {
            errors.push(r.error);
            failed = true;
            fatal = true;
          } else put(r.value);
          continue;
        }
      }
      const m = c === '$' ? /^\$(?:([?$!#@*0-9-])|([A-Za-z_]\w*))/.exec(line.slice(i)) : null;
      if (!m) {
        out += c;
        continue;
      }
      const name = m[1] ?? m[2];
      // "$@": each positional parameter its own word ("" when there are none: no word at all).
      if (name === '@' && quote === '"' && !heredoc) {
        if (!this.positional.length) {
          if (line[i - 1] === '"' && line[i + 2] === '"' && out.endsWith('"')) {
            out = out.slice(0, -1);
            quote = '';
            i += 2;
          } else i += 1;
          continue;
        }
        out += this.positional.map((a) => a.replace(/[\\"$`]/g, '\\$&')).join('" "');
        i += 1;
        continue;
      }
      const value = this.variable(name);
      if (value === null && this.unbound(name)) {
        errors.push(this.unboundMessage(name));
        failed = true;
        fatal = true;
      }
      put(value ?? '');
      i += m[0].length - 1;
    }
    return { line: out, errors, ...(failed ? { failed } : {}), ...(failed && !fatal ? { arithmetic: true } : {}) };
  }

  /**
   * ${…} (man bash, "Parameter Expansion"): ${NAME}, ${#NAME} (its length),
   * ${NAME:-word} (word if unset or empty), ${NAME-word} (if unset),
   * ${NAME:=word} (and assigns it), ${NAME:+word} (word if set),
   * ${NAME:?message} (an error if unset or empty), ${NAME#pattern} and
   * ${NAME##pattern} (without the shortest/longest matching prefix),
   * ${NAME%pattern} and ${NAME%%pattern} (suffix), ${NAME/pattern/text}
   * (the first match replaced; // all of them, /# at the start, /% at the
   * end), ${NAME:offset:length}, ${NAME^^} and ${NAME,,} (case).
   */
  private parameter(inner: string): { value: string } | { error: string } {
    const length = /^#([A-Za-z_]\w*|\d+|[?$!#@*])$/.exec(inner);
    if (length) {
      if (this.variable(length[1]) === null && this.unbound(length[1])) return { error: this.unboundMessage(length[1]) };
      return { value: String([...(this.variable(length[1]) ?? '')].length) };
    }
    const m = /^([A-Za-z_]\w*|\d+|[?$!#@*-])(.*)$/s.exec(inner);
    if (!m) return { error: `${this.errorPrefix()}: \${${inner}}: bad substitution` };
    const [, name, rest] = m;
    const value = this.variable(name);
    // A word inside: its variables expanded, its quotes removed.
    const word = (w: string) => this.expandLine(w, true).line.replace(/^(["'])(.*)\1$/s, '$2');
    if (!rest) {
      if (value === null && this.unbound(name)) return { error: this.unboundMessage(name) };
      return { value: value ?? '' };
    }
    const op = /^(:?[-=+?])(.*)$/s.exec(rest);
    if (op) {
      const unset = op[1].startsWith(':') ? !value : value === null;
      const kind = op[1].slice(-1);
      if (kind === '-') return { value: unset ? word(op[2]) : value! };
      if (kind === '+') return { value: unset ? '' : word(op[2]) };
      if (kind === '=') {
        if (!unset) return { value: value! };
        if (!/^[A-Za-z_]/.test(name)) return { error: `${this.errorPrefix()}: $${name}: cannot assign in this way` };
        this.vars[name] = word(op[2]);
        return { value: this.vars[name] };
      }
      if (unset) return { error: `${this.errorPrefix()}: ${name}: ${op[2] ? word(op[2]) : this.script && this.script.dialect !== 'bash' ? (op[1].startsWith(':') ? 'parameter null or not set' : 'parameter not set') : 'parameter null or not set'}` };
      return { value: value! };
    }
    const v = value ?? '';
    // A pattern as a regular expression, whole (glob() anchors it).
    const whole = (p: string) => glob(word(p));
    const strip = /^(##?|%%?)(.*)$/s.exec(rest);
    if (strip) {
      const re = whole(strip[2]);
      const longest = strip[1].length === 2;
      const ks = [...Array(v.length + 1).keys()];
      if (strip[1][0] === '#') {
        // The shortest (or longest) prefix that matches.
        for (const k of longest ? ks.reverse() : ks) if (re.test(v.slice(0, k))) return { value: v.slice(k) };
        return { value: v };
      }
      for (const k of longest ? ks : ks.reverse()) if (re.test(v.slice(k))) return { value: v.slice(0, k) };
      return { value: v };
    }
    const sub = /^\/([/#%]?)((?:\\.|[^/])*)(?:\/(.*))?$/s.exec(rest);
    if (sub) {
      const [, mode, p, replacement = ''] = sub;
      if (!p) return { value: v };
      const re = whole(p);
      const by = word(replacement);
      // The leftmost match, the longest there (like bash); /# at the start, /% at the end.
      const at = (from: number): [number, number] | null => {
        for (let a = from; a <= v.length; a++) {
          if (mode === '#' && a > 0) return null;
          for (let b = v.length; b >= a; b--) {
            if (mode === '%' && b !== v.length) continue;
            if (b > a && re.test(v.slice(a, b))) return [a, b];
          }
        }
        return null;
      };
      let result = '';
      let from = 0;
      for (;;) {
        const hit = at(from);
        if (!hit) break;
        result += v.slice(from, hit[0]) + by;
        from = hit[1];
        if (mode !== '/') break;
      }
      return { value: result + v.slice(from) };
    }
    const slice = /^:(\s*-?\d+)(?::(-?\d+))?$/.exec(rest);
    if (slice) {
      const chars = [...v];
      let from = Number(slice[1].trim());
      if (from < 0) from = Math.max(0, chars.length + from);
      const count = slice[2] === undefined ? chars.length : Number(slice[2]);
      const to = count < 0 ? chars.length + count : from + count;
      return { value: chars.slice(from, Math.max(from, to)).join('') };
    }
    if (rest === '^^') return { value: v.toUpperCase() };
    if (rest === ',,') return { value: v.toLowerCase() };
    if (rest === '^') return { value: v.charAt(0).toUpperCase() + v.slice(1) };
    if (rest === ',') return { value: v.charAt(0).toLowerCase() + v.slice(1) };
    return { error: `${this.errorPrefix()}: \${${inner}}: bad substitution` };
  }

  /** Where the shell's own messages come from: -bash on the line, the script's name and line in a script. */
  errorPrefix(): string {
    return dialectPrefix(this.script);
  }

  /** set -u: an unset variable is an error (in a script), except $@ and $*. */
  private unbound(name: string): boolean {
    return !!this.script && this.options.u && name !== '@' && name !== '*';
  }

  private unboundMessage(name: string): string {
    return `${this.errorPrefix()}: ${name}: ${this.script?.dialect === 'bash' ? 'unbound variable' : 'parameter not set'}`;
  }

  /** Whether a name is one of the game's commands (a man page for a file is not). */
  isCommand(name: string): boolean {
    return !!COMMANDS[name] && COMMANDS[name].section !== 5;
  }

  /** A command's words, as tube expands them: braces, ~, wildcards (nothing inside quotes). */
  argsOf(line: string): { args: string[]; redirects: { op: string; target: string }[] } {
    const args: string[] = [];
    const redirects: { op: string; target: string }[] = [];
    const words = split(line, !!this.script);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.op) {
        redirects.push({ op: w.op, target: takesTarget(w.op) ? (words[++i]?.text ?? '') : '' });
        continue;
      }
      args.push(...(w.city ? [w.text] : braces(w.text).flatMap((x) => this.expand(this.tilde(x)))));
    }
    return { args, redirects };
  }

  /**
   * A pipeline run for a script (control.ts): its errors and its output apart,
   * its exit code (and each command's, for pipefail); toPipe: the output goes
   * on to a pipe or a capture, not to the screen.
   */
  pipeline(line: string, stdin: string | null, toPipe: boolean): { errors: string[]; output: string; status: number; statuses: number[] } {
    this.pipeStatus = [];
    this.tube(line, split(line, !!this.script), stdin, toPipe);
    const output = toPipe ? (this.piped ?? '') : this.tubeOutput;
    this.piped = null;
    const status = this.status ?? (this.errors.length ? 1 : 0);
    this.lastStatus = status;
    return { errors: this.shownErrors, output, status, statuses: this.pipeStatus.length ? this.pipeStatus : [status] };
  }

  // Runs a command substitution's commands, without the story's events: their output (as in a pipe) and their errors.
  private capture(line: string): { output: string; errors: string[] } {
    const before = { last: this.last, status: this.status, errors: this.errors };
    this.capturing = true;
    this.captureDepth++;
    try {
      // A script's substitution, a compound or a function: run by control.ts, in a subshell.
      if (this.script || !this.plainCapture(line)) return this.captureProgram(line);
      const list = splitList(line);
      if ('error' in list) return { output: '', errors: [list.token ? this.t('syntax-token', { token: list.token }) : this.t('syntax-end')] };
      const outputs: string[] = [];
      const errors: string[] = [];
      let status = 0;
      for (const item of list.items) {
        if (!listRuns(item.before, status)) continue;
        const sub = this.expandLine(item.command);
        errors.push(...sub.errors);
        this.tube(sub.line, split(sub.line));
        errors.push(...this.shownErrors);
        if (this.last.output && !this.last.redirection) outputs.push(this.last.output);
        status = this.status ?? (this.errors.length ? 1 : 0);
      }
      this.substitution = status;
      return { output: outputs.join('\n'), errors };
    } finally {
      this.capturing = false;
      this.captureDepth--;
      Object.assign(this, before);
    }
  }

  /** Whether a substitution's text is a plain list of known commands (no compound, no function). */
  private plainCapture(line: string): boolean {
    if (!Object.keys(this.functions).length && !/\b(for|while|until|if|case|function)\b|[{}()\n]/.test(line)) return true;
    const parsed = parse(line, true);
    if (!('list' in parsed)) return true;
    const uses = (n: TreeNode): boolean =>
      n.kind === 'simple' ? Object.hasOwn(this.functions, split(n.text)[0]?.text ?? '') : n.kind === 'pipeline' ? n.parts.some(uses) : n.kind === 'andor' ? uses(n.first) || n.rest.some((r) => uses(r.node)) : true;
    return plainList(parsed.list) && !parsed.list.some((e) => uses(e.node));
  }

  /** A substitution run by control.ts, in a subshell: what it wrote on its output, its errors. */
  private captureProgram(line: string): { output: string; errors: string[] } {
    const s = this.script;
    const chunks = s ? parseScript(line, s.dialect === 'bash') : null;
    const parsed = chunks ? null : parse(line, true);
    if (parsed && !('list' in parsed)) {
      this.substitution = 2;
      return { output: '', errors: ['error' in parsed && parsed.error ? this.t('syntax-token', { token: parsed.error }) : this.t('syntax-end')] };
    }
    const lists = chunks ? chunks.chunks : [(parsed as { list: List }).list];
    const run = newRun();
    const out: string[] = [];
    const restore = subshell(this);
    const saved = { exit: s?.exit ?? null, lastStatus: this.lastStatus };
    let status = 0;
    try {
      for (const l of lists) {
        status = drain(runTree(this, run, l, { stdin: null, capture: out }));
        if (run.stopped || s?.exit != null) break;
      }
      if (s && s.exit !== null) status = s.exit;
      if (chunks?.error && !run.stopped && s?.exit == null) status = 2;
    } finally {
      restore();
      if (s) s.exit = saved.exit;
    }
    this.substitution = status;
    this.lastStatus = saved.lastStatus;
    const errors = run.outputs.filter(Boolean);
    return { output: out.filter((x) => x !== '').join('\n'), errors };
  }

  // A line that ended in error (an error message, or a non-zero exit code) counts for the summary.
  private countLine(output: string): string {
    this.lastStatus = this.status ?? (this.errors.length ? 1 : 0);
    if (this.errors.length || (this.status ?? 0) !== 0) this.commandsInError++;
    return output;
  }

  /** The player's password, in the language (sunflower → tournesol in French, see passwords.ftl). */
  playerPassword(): string | undefined {
    // Changed with passwd: the new one (see commands/accounts.ts).
    const changed = (this.state.passwords as Record<string, string> | undefined)?.[this.player];
    if (changed !== undefined) return changed;
    const m = this.chapter.password;
    return m && password(this.t, m);
  }

  private password(input: string): string | null {
    const waiting = this.waiting!;
    if (input === this.playerPassword()) {
      this.waiting = null;
      this.authenticated = true;
      this.chapter.beforeCommand?.(this);
      if (this.chapter.activity) live(this, this.chapter.activity.not);
      const result = this.countLine(this.tube(waiting.line, split(waiting.line), waiting.stdin, waiting.capture));
      this.enterShell();
      const piped = this.piped;
      const output = this.conclude(result, true);
      this.piped = piped;
      return this.resumeList(output, this.lastStatus);
    }
    waiting.attempts++;
    if (waiting.attempts < 3) return this.t('sudo-bad-password');
    this.waiting = null;
    // Three wrong passwords: sudo fails (code 1), and the list goes on from there.
    return this.resumeList(this.t('sudo-three-failures'), 1);
  }

  /**
   * Runs a command line the way cron would (/bin/sh -c, with cron's small
   * environment: HOME, LOGNAME, SHELL, PATH=/usr/bin:/bin), from the home
   * directory, without story events; returns everything it wrote (output
   * and errors), which cron would send by mail. login: as su -c runs it,
   * with the account's login shell and the session's exported variables.
   */
  runTask(line: string, login = false): string {
    const user = this.who;
    const home = this.accounts.users[user]?.home ?? (user === 'root' ? '/root' : `/home/${user}`);
    if (login) {
      const shell = (this.accounts.users[user]?.shell ?? '/bin/bash').endsWith('/bash') ? 'bash' : 'sh';
      return runScript(this, line, { cwd: this.home, name: shell, shell, environment: this.exportedVars() }).output;
    }
    const environment = { HOME: home, LOGNAME: user, SHELL: '/bin/sh', PATH: '/usr/bin:/bin' };
    return runScript(this, line, { cwd: this.home, name: '/bin/sh', shell: 'sh', environment }).output;
  }

  /** The session's exported variables (what a program it starts receives). */
  exportedVars(): Record<string, string> {
    return Object.fromEntries([...this.exported].filter((n) => n in this.vars).map((n) => [n, this.vars[n]]));
  }

  /**
   * Runs `body` as a child process would (a script): from `cwd`, and
   * everything a command or a shell may change (place, variables, functions,
   * options, the last command and its errors) given back afterwards.
   */
  isolated<T>(cwd: string, body: () => T): T {
    const saved = {
      cwd: this.cwd, old: this.old, errors: this.errors, last: this.last, status: this.status, piped: this.piped, environment: this.environment,
      outputTo: this.outputTo, vars: this.vars, exported: this.exported, functions: this.functions, positional: this.positional, locals: this.locals,
      options: this.options, traps: this.traps, script: this.script, aliases: this.aliases, lastStatus: this.lastStatus, substitution: this.substitution,
      captureDepth: this.captureDepth, tubeOutput: this.tubeOutput, shownErrors: this.shownErrors, pipeStatus: this.pipeStatus, inPipeline: this.inPipeline,
      outputCharset: this.outputCharset,
    };
    this.cwd = cwd;
    this.errors = [];
    this.captureDepth = 0;
    try {
      return body();
    } finally {
      Object.assign(this, saved);
    }
  }

  /**
   * Runs a line as sh -c would (a service's ExecStart=, an Ansible shell
   * task, an ssh remote command with shell 'bash'…), from this place,
   * without the story's events and without touching the current line:
   * returns what it wrote and its exit code (see script.ts).
   */
  underCommand(line: string, cwd: string, shell: 'sh' | 'bash' = 'sh'): { output: string; ok: boolean; code: number } {
    const { output, code } = runScript(this, line, { cwd, name: shell, shell, environment: this.exportedVars() });
    return { output, ok: code === 0, code };
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
  private tube(line: string, words: Word[], stdin: string | null = null, toPipe = false): string {
    this.errors = [];
    this.status = null;
    this.piped = null;
    const segments: Word[][] = [[]];
    // Each command's redirections, read from left to right like bash (man bash,
    // "REDIRECTION"): where its output goes (a file, or "err" with >&2), where
    // its errors go (a file, "out": wherever the output goes, with 2>&1), its input.
    type Target = { file: string; addition: boolean };
    type Routes = { out?: Target; err?: Target | 'out' | 'screen'; outToErr?: boolean; input?: { file: string } | { text: string } };
    const routes: Routes[] = [{}];
    for (let i = 0; i < words.length; i++) {
      const m = words[i];
      if (m.op === '|') {
        segments.push([]);
        routes.push({});
        continue;
      }
      if (!m.op) {
        segments.at(-1)!.push(m);
        continue;
      }
      const r = routes.at(-1)!;
      if (!takesTarget(m.op)) {
        // 2>&1: the errors go where the output goes now (>f 2>&1: the file; 2>&1 >f: the screen).
        if (m.op === '2>&1') r.err = r.out ?? 'out';
        else r.outToErr = true;
        continue;
      }
      const target = words[i + 1];
      if (!target || target.op) return this.t('syntax-redirection', { operator: m.op });
      i++;
      const t = { file: target.text, addition: m.op.endsWith('>>') };
      if (m.op === '<') r.input = { file: target.text };
      // A here-string: the word, with a newline.
      else if (m.op === '<<<') r.input = { text: target.text };
      else if (m.op === '2>' || m.op === '2>>') r.err = t;
      else {
        r.out = t;
        r.outToErr = false;
        if (m.op.startsWith('&')) r.err = t;
      }
    }
    if (segments.some((s) => !s.length)) return this.t('syntax-pipe');
    // The last command's output redirection (the file that events and commands see).
    const redirection = routes.at(-1)!.out ?? null;
    // The errors not shown on screen (redirected elsewhere: they still make the command fail),
    // and the outputs sent with the errors (>&2).
    const hidden = new Set<number>();
    const toErrors: string[] = [];
    // What the last command wrote, even into a file (events read it).
    let written: string | null = null;

    let input: string | null = stdin;
    const commands: string[][] = [];
    this.inPipeline = segments.length > 1;
    segments.forEach((segment, i) => {
      // Like the shell: wildcards are not expanded inside quotes.
      // Like the shell: braces, then the tilde, then wildcards; nothing inside quotes.
      let args = segment.flatMap((m) => (m.city ? [m.text] : braces(m.text).flatMap((w) => this.expand(this.tilde(w)))));
      let root = false;
      let keepEnv = false;
      // sudo -u account: act as that account rather than root.
      let as = 'root';
      // sudo -l: sudo itself answers (the list of allowed commands).
      if (args[0] === 'sudo' && /^-l+$/.test(args[1] ?? '')) args = ['sudo', ...args.slice(1)];
      else if (args[0] === 'sudo') {
        args = args.slice(1);
        root = true;
        // sudo -E keeps the environment (the user may: ALL implies SETENV).
        if (args[0] === '-E' || args[0] === '--preserve-env') {
          keepEnv = true;
          args = args.slice(1);
        }
        if (args[0] === '-u') {
          as = args[1] ?? '';
          args = args.slice(2);
          if (!this.accounts.users[as] && as !== 'root') {
            this.error(this.t('sudo-account-unknown', { account: as }));
            input = '';
            return;
          }
        }
        // sudo -i, sudo -s (or sudo bash): a shell as root (or -u's account); with a command, the command alone.
        const shellFlag = ['-i', '--login', '-s', '--shell'].includes(args[0] ?? '') ? args[0] : null;
        if (shellFlag) args = args.slice(1);
        if ((shellFlag && !args.length) || (args.length === 1 && args[0] === 'bash' && segments.length === 1)) {
          const login = shellFlag === '-i' || shellFlag === '--login';
          const shellPath = this.accounts.users[as]?.shell ?? '/bin/bash';
          commands.push(['sudo', ...(shellFlag ? [shellFlag] : args)]);
          input = '';
          if (!this.known().includes('sudo')) {
            this.error(this.t('sudo-not-still'));
            return;
          }
          // sudo's policy decides (Debian without /etc/sudoers in the world: the sudo group may).
          if (this.exists(sudoersFile(this)) && this.who !== 'root' && !permitted(this, this.player, shellPath, as)) {
            this.error(this.t('sudo-not-allowed', { user: this.player, command: shellPath, account: as, host: this.hostName }), 1);
            return;
          }
          this.openShell(as, login);
          return;
        }
      }
      // NAME=value before the command: for its environment only (alone on the line: a session variable).
      const assigned: Record<string, string> = {};
      while (args.length && /^[A-Za-z_]\w*=/.test(args[0])) {
        const [n, ...v] = args[0].split('=');
        assigned[n] = v.join('=');
        args = args.slice(1);
      }
      if (!args.length && Object.keys(assigned).length && !root) {
        if (segments.length === 1) Object.assign(this.vars, assigned);
        commands.push([]);
        input = '';
        return;
      }
      // [ condition ] is test, whose last argument must be ].
      if (args[0] === '[') {
        if (args.at(-1) !== ']') {
          this.error("-bash: [: missing `]'", 2);
          input = '';
          return;
        }
        args = ['test', ...args.slice(1, -1)];
      }
      const exportedEnv = Object.fromEntries([...this.exported].filter((n) => n in this.vars).map((n) => [n, this.vars[n]]));
      this.environment = root && !keepEnv ? assigned : { ...exportedEnv, ...assigned };
      commands.push(args);
      const r = routes[i];
      const final = i === segments.length - 1;
      const last = final && !r.out && !r.outToErr && !this.capturing && !toPipe;
      this.as = as;
      const before = this.errors.length;
      // < file: bash opens it before running the command; if it can't, the command doesn't run.
      if (r.input && 'file' in r.input) {
        const text = this.resolve(r.input.file) === '/dev/null' ? '' : this.readFor('bash', r.input.file);
        if (text === null) {
          this.status = 1;
          input = '';
          return;
        }
        input = text;
      } else if (r.input) input = r.input.text;
      this.outputTo = r.out && this.resolve(r.out.file) !== '/dev/null' ? this.resolve(r.out.file) : null;
      let produced = this.launch(args, input, root, last);
      this.outputTo = null;
      this.pipeStatus[i] = this.status ?? (this.errors.length > before ? 1 : 0);
      // This command's errors, sent where its redirections say.
      const errors = this.errors.slice(before);
      const err = r.err ?? 'screen';
      const hide = () => errors.forEach((_, k) => hidden.add(before + k));
      // 2>&1 in a pipe: the errors go down the pipe with the output.
      if (err === 'out' && !final) {
        hide();
        produced = [...errors, produced].filter(Boolean).join('\n');
      }
      if (r.outToErr) {
        if (produced) toErrors.push(produced);
        produced = '';
      }
      if (final) written = produced;
      if (r.out) {
        // With &> or >f 2>&1, the errors go into the same file, before the output.
        if (err === r.out) hide();
        const text = err === r.out ? [...errors, produced].filter(Boolean).join('\n') : produced;
        // The redirection is done by YOUR shell, before sudo: even with sudo in
        // front of the command, it is "you" who writes to the file.
        const error = this.redirect(r.out.file, text, r.out.addition);
        if (error) {
          this.error(error);
          if (/(^|\|)\s*sudo\s/.test(line)) this.error(this.t('redirection-sudo'));
        } else this.keepCharset(r.out);
        produced = '';
      }
      if (typeof err === 'object' && err !== r.out) {
        hide();
        const error = this.redirect(err.file, errors.join('\n'), err.addition);
        if (error) this.error(error);
      }
      input = produced;
    });
    let output: string = input ?? '';
    const charset = this.outputCharset;
    this.outputCharset = null;
    // On screen, LATIN1 bytes show as � on the UTF-8 terminal.
    if (charset === 'latin1') output = onUtf8Terminal(output);
    // Raw bytes on the terminal: � above 0x7F, control bytes unseen.
    if (charset === 'binary') output = binaryOnTerminal(output);
    // Events read the output as the player reads it, without colour codes.
    this.last = { line, commands, output: withoutColours(redirection ? (written ?? '') : output), errors: this.errors, redirection: redirection ? this.resolve(redirection.file) : null };
    this.shownErrors = [...this.errors.filter((_, k) => !hidden.has(k)), ...toErrors].filter(Boolean);
    this.inPipeline = false;
    this.tubeOutput = output;
    // Down a compound's pipe: the output goes on to the next command, not to the screen.
    if (toPipe) {
      this.piped = redirection ? '' : output;
      return this.shownErrors.join('\n');
    }
    return [...this.shownErrors, output].filter(Boolean).join('\n');
  }

  // A command that wrote LATIN1 (pg_dump of a LATIN1 database) into a file: the file keeps those bytes.
  private keepCharset(target: { file: string; addition: boolean }): void {
    const charset = this.outputCharset;
    const written = this.find(target.file);
    if (written?.type !== 'file') return;
    if (charset === 'latin1') written.charset = 'latin1';
    else if (charset === 'binary' && isBinary(content(written, this))) {
      written.charset = 'binary';
      // gzip -c f > f.gz: the file takes the compressed size.
      const u = target.addition ? null : unpack(content(written, this));
      if (u) written.size = packedSize(u.format, u.isize, { name: u.name });
    }
    else if (!target.addition) delete written.charset;
    this.outputCharset = null;
  }

  private redirect(file: string, text: string, addition: boolean): string | null {
    // /dev/null swallows everything (the world doesn't need to have a /dev).
    if (this.resolve(file) === '/dev/null') return null;
    const n = this.find(file);
    if (n?.type === 'directory') return this.t('redirection-is-one-directory', { target: file });
    if (n) {
      if (this.onlyRead(file)) return this.t('error-read-only', { command: 'bash', target: file });
      if (!this.traverses(file) || !this.can(n, 'w')) return this.t('redirection-permission', { target: file });
      if (immutable(n) || (appendOnly(n) && !addition)) return `-bash: ${file}: Operation not permitted`;
      const before = content(n, this);
      // Appending nothing (2>> f with no error) leaves the file as it was, as in bash.
      if (addition && text === '') return null;
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
    // On Solaris, the POSIX (/usr/xpg4/bin), BSD (/usr/ucb) and add-on versions of a tool.
    const otherBin = isSolaris(this) && !!raw && OTHER_BINS.test(raw) && !!COMMANDS[onlyName];
    const cmd =
      raw && ((/^\/(usr\/)?s?bin\/[\w.-]+$/.test(raw) && COMMANDS[onlyName] && !outsidePath) || (outsidePath && raw === `${outsidePath}/${onlyName}`) || otherBin)
        ? onlyName
        : raw;
    if (cmd && COMMANDS[cmd]?.directory && cmd === raw) return this.error(this.t('command-missing', { command: cmd }));
    if (!cmd) return '';
    // : does nothing, successfully (its arguments are expanded all the same).
    if (cmd === ':') return '';
    if (root && !this.known().includes('sudo')) return this.error(this.t('sudo-not-still'));
    // Real behaviour: cd is built into the shell, it is not a program.
    if (root && cmd === 'cd') return this.error(this.t('sudo-cd'));
    if (cmd === 'help' || cmd === this.t('command-help')) {
      // The chapter's own commands first, then those it keeps from the chapters it assumes.
      const { own, kept } = this.commandSets();
      return [this.t('help-commands', { commands: own.join(', ') }), ...(kept.length ? [this.t('help-inherited', { commands: kept.join(', ') })] : []), this.t('help-more')].join('\n');
    }
    if (cmd === 'man' || cmd === 'apropos' || cmd === 'whatis') return this.consulter(cmd, rest);
    // A FreeBSD machine: what only a Debian system has is simply not there
    // (sh: "systemctl: not found"), and bash only after pkg install bash.
    if (isBsd(this) && (LINUX_ONLY.includes(cmd) || (cmd === 'bash' && !this.exists('/usr/local/bin/bash')))) {
      this.status = 127;
      return this.error(`${cmd}: not found`);
    }
    // Solaris 10: neither Linux's tools nor FreeBSD's.
    if (isSolaris(this) && NOT_ON_SOLARIS.includes(cmd) && !otherBin) {
      this.status = 127;
      return this.error(`${cmd}: not found`);
    }
    // IBM i's PASE: a bash, Unix utilities, but no Linux administration.
    // A CL command is no PASE program (system "WRKACTJOB" runs it), and tn5250 is a client of the workstation.
    if (isIbmi(this) && (NOT_ON_IBMI.includes(cmd) || COMMANDS[cmd]?.cl || cmd === 'tn5250')) {
      this.status = 127;
      return this.error(`-bash: ${cmd}: command not found`);
    }
    // A path (./deployer.sh, /srv/site/deployer.sh): a script, if it is executable.
    if (cmd.includes('/')) {
      const n = this.find(cmd);
      if (!n) return this.error(this.t('script-missing', { command: cmd }), 127);
      if (n.type === 'directory') return this.error(this.t('script-directory', { command: cmd }), 126);
      if (!this.traverses(cmd) || !this.can(n, 'x') || !this.can(n, 'r')) return this.error(this.t('script-permission', { command: cmd }), 126);
      // FreeBSD checks the #! line: an interpreter that doesn't exist (#!/bin/bash,
      // when bash lives in /usr/local/bin) makes sh say the SCRIPT is not found.
      const interpreter = isBsd(this) && n.type === 'file' ? /^#!\s*(\S+)/.exec(content(n, this))?.[1] : undefined;
      if (interpreter && !this.exists(interpreter)) {
        this.status = 127;
        return this.error(`${cmd}: not found`);
      }
      // A #! line saved on Windows ends with \r: the kernel looks for "/bin/bash\r" (bash shows it as ^M).
      const first = n.type === 'file' && !n.program ? content(n, this).split('\n')[0] : '';
      if (first.startsWith('#!') && first.endsWith('\r')) {
        this.status = 126;
        return this.error(`-bash: ${cmd}: ${first.slice(2).trim().split(/\s+/)[0]}^M: bad interpreter: No such file or directory`);
      }
      const before = this.who;
      if (root) this.who = this.as;
      try {
        // A compiled program (cobc): it runs, it doesn't go through sh.
        if (n.type === 'file' && n.program) return runProgram(this, n.program, rest);
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
    // Another editor (vim, vi, emacs…): the game's is nano, which it points to.
    // A command Debian 13 dropped for another: the shell's answer, and the game's pointer to it.
    if (!command && REPLACED[cmd] && this.known().includes(REPLACED[cmd])) {
      this.status = 127;
      return this.error(this.t('command-replaced', { command: cmd, replacement: REPLACED[cmd] }));
    }
    if (!command && OTHER_EDITORS.includes(cmd) && this.known().includes('nano')) {
      this.status = 127;
      return this.error(this.t('editor-only-nano', { command: cmd, file: rest.find((a) => !a.startsWith('-') && !a.startsWith('+')) ?? this.t('editor-file') }));
    }
    // An inherited command missing from this machine: the system's own answer.
    if (command && !this.known().includes(cmd) && this.notHere(cmd)) {
      this.status = 127;
      return this.error(isBsd(this) || isSolaris(this) ? `${cmd}: not found` : `-bash: ${cmd}: command not found`);
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
    // On FreeBSD, the tools whose BSD version takes other options check them first, BSD's way.
    const bsdCheck = isBsd(this) ? BSD_CHECKS[cmd] : isSolaris(this) && !otherBin ? SOLARIS_CHECKS[cmd] : otherBin && raw.startsWith('/usr/xpg4/bin/') ? XPG4_CHECKS[cmd] : undefined;
    if (bsdCheck) {
      const refused = bsdCheck(rest);
      if (refused) {
        this.status = cmd === 'grep' ? 2 : 1;
        if (cmd === 'ps' && isSolaris(this)) this.status = 1;
        return this.error(refused);
      }
    }
    // BSD tools have no --help: their own option parsing answers (illegal option -- -).
    if (rest.includes('--help') && !(isBsd(this) && (BSD_TOOLS.includes(cmd) || bsdCheck)) && !(isSolaris(this) && bsdCheck)) return help(cmd, command, this.t);
    const invalid = bsdCheck ? null : invalidOption(cmd, command, rest, this.t);
    if (invalid) return this.error(invalid);
    // --all → -a: the command only reads its short options.
    const options = command.ownOptions || bsdCheck ? rest : shorten(command, rest);
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
        if (!this.traverses(e.path) || !this.can(n, 'w') || immutable(n) || appendOnly(n)) return this.t('nano-error-write', { path: e.path });
        n.content = e.dos ? text.replace(/\n$/, '').replace(/\r?\n/g, '\r\n') : text.replace(/\n$/, '');
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
    // nano in a list (nano f && cat f): the rest runs once it is closed.
    if (this.pendingList) return [messages, this.resumeList('', this.lastStatus)].filter(Boolean).join('\n\n');
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
