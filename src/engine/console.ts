// The console: what the player sees. It starts from the workstation
// (workstation.ts) and opens a session on a story's machine when ssh
// succeeds; exit closes it and brings you back to the workstation. Each
// machine runs the current chapter of its story. Finishing the Eraser gives
// the SSH keys of the other machines: you learn them by playing.

import { Shell } from './shell';
import { STORIES } from './chapters';
import { isOpen, FIRST } from './unlocking';
import { f, player, type Chapter, type Story } from './world';
import { machineDomain, MACHINES, machineName, WORKSTATION, translateHosts, type Machine } from './machines';
import { keyFor, config as configSsh, keyFiles, workstation } from './workstation';
import { portState, type PortState } from './ports';
import { bannedOnPort, type Fail2banState } from './fail2ban';
import { noteTmux } from './commands/tmux';
import { inColumns } from './commands/files';
import { live } from './activity';
import { LANGUAGES, translator, type Language, type Translate } from '../texts';

export interface OptionsConsole {
  language?: Language;
  /** Chapters already finished (identifiers). */
  finished?: string[];
  /** Saved contents of ~/.ssh/known_hosts. */
  knownHosts?: string;
  /** The ~/.ssh files the player created (keys, config), and the passphrases. */
  ssh?: { files: Record<string, string>; phrases?: Record<string, string> };
}


type Input = { line: string } | { save: string } | { quit: true } | { follow: number } | { interrupt: true };

export class Console {
  // The screen shows the outputs' colours (an interface setting); see colours.ts.
  colours = false;
  // The screen's width in characters, measured by the interface (ls lays out to fit it).
  columns = 80;

  // The rescue snapshot: what was typed since the chapter was opened
  // (commands, answers, nano saves). The engine is deterministic:
  // reopening the chapter and replaying the first n inputs gives back
  // exactly the machine as it was then. null: no longer replayable (we came
  // back to the workstation, or resumed a session left earlier). `serial`
  // changes each time a chapter is opened (not on a restore): a snapshot is
  // only valid within its series.
  private inputs: Input[] | null = null;
  serial = 0;
  private inRestore = false;
  t: Translate;
  finished: string[];
  workstation: Shell;
  remote: { machine: Machine; story: Story; shell: Shell } | null = null;
  // The sessions opened from the story's machine into its internal network
  // (the last one is where you type); `back`: opened with ssh -J from the
  // workstation, exit goes straight back to the workstation.
  inside: { shell: Shell; domain: string; back: boolean }[] = [];
  // Machines keep their state while the game is open: reconnecting finds
  // the chapter where you left it.
  private sessions = new Map<string, Shell>();
  // The machines you connected to during this game (the network plan marks them).
  visited = new Set<string>(['desk']);

  constructor(private options: OptionsConsole = {}) {
    this.t = translator(options.language);
    this.finished = [...(options.finished ?? [])];
    this.workstation = this.newWorkstation();
  }

  private newWorkstation(knownHosts = this.options.knownHosts): Shell {
    const keys = MACHINES.filter((m) => this.isOpen(m.story!) && !m.withoutKey);
    const s = new Shell(workstation(keys), this.t.language, 'desk');
    // ssh asks the server on the other side for its applied configuration (sshd)
    // (that of the chapter the connection would open: a chapter may start with SSH on another port).
    s.state.remoteSshd = (name: string) => this.sessionFor(name).state.sshd?.load ?? null;
    // … and its firewall (ufw), which can block the connection before sshd even sees it.
    s.state.remoteFirewall = (name: string) => this.sessions.get(name)?.state.ufw ?? null;
    // … and the addresses its fail2ban has banned (for this port, if given: the jail only blocks its own ports).
    s.state.remoteBanned = (name: string, port?: number): string[] => {
      const f2b: Fail2banState | undefined = this.sessions.get(name)?.state.fail2ban;
      if (!f2b) return [];
      return port === undefined ? f2b.banned : bannedOnPort(f2b, port);
    };
    // … and the state of one of its ports, seen from here (nc -zv machine port).
    s.state.remotePort = (name: string, port: number): PortState => portState(this.sessionFor(name), port, false, WORKSTATION.address);
    // … and its host key, which changes when the machine has been reinstalled.
    s.state.remoteKey = (name: string): string => this.connectionChapter(name).hostKey ?? '';
    // … and the session itself (ssh -J, scp, ssh-copy-id, on machines that manage their keys).
    s.state.remoteSession = (name: string): Shell => this.sessionFor(name);
    // Machine names follow the game's language (royaume.internal → kingdom.internal).
    const other = LANGUAGES.filter((l) => l !== this.t.language).map((l) => translator(l));
    if (knownHosts) s.place('ssh', '~/.ssh/known_hosts', f(translateHosts(knownHosts, this.t, other), { lines: true }));
    // The keys created and the modified config, kept from one visit to the next.
    // The save serves every language: a config still as the game gave it
    // (in any language) gives way to the game's current one, and a modified
    // config connects with the language's account (User vous → you).
    const alreadyData = LANGUAGES.map((l) => configSsh(translator(l)));
    const accounts = LANGUAGES.map((l) => player(translator(l)));
    for (const [name, saved] of Object.entries(this.options.ssh?.files ?? {})) {
      if (name === 'config' && alreadyData.includes(saved.trim())) continue;
      const content =
        name === 'config'
          ? translateHosts(saved, this.t, other).replace(/^(\s*User\s+)(\S+)(\s*)$/gim, (line, start: string, account: string, end: string) =>
              accounts.includes(account) ? `${start}${player(this.t)}${end}` : line,
            )
          : saved;
      const old = s.find(`~/.ssh/${name}`);
      const isPrivate = /^id_/.test(name) && !name.endsWith('.pub');
      if (old?.type === 'file') old.content = content;
      else s.place('ssh', `~/.ssh/${name}`, f(content, { lines: true, mode: isPrivate ? 'rw-------' : 'rw-r--r--' }));
    }
    if (this.options.ssh?.phrases) s.state.passPhrases = { ...this.options.ssh.phrases };
    return s;
  }

  /** What to keep of the workstation's ~/.ssh: what the player created or modified. */
  ssh(): { files: Record<string, string>; phrases?: Record<string, string> } {
    const directory = this.workstation.find('~/.ssh');
    const data = new Set(MACHINES.filter((m) => !m.withoutKey).flatMap((m) => [keyFor(this.t, m), `${keyFor(this.t, m)}.pub`]));
    const files: Record<string, string> = {};
    if (directory?.type === 'directory')
      for (const name of Object.keys(directory.children))
        if (name !== 'known_hosts' && !data.has(name) && directory.children[name].type === 'file')
          files[name] = this.workstation.read(`~/.ssh/${name}`) ?? '';
    // The config the game gave, unmodified: nothing to keep.
    if (files.config?.trim() === configSsh(this.t)) delete files.config;
    return { files, phrases: this.workstation.state.passPhrases };
  }

  /** Resets the workstation, keeping the known hosts. */
  resetWorkstation(): string {
    this.workstation = this.newWorkstation(this.knownHosts());
    return this.workstation.execute(`cat ${this.workstation.welcome}`) ?? '';
  }

  /** A story is open if you have its key: the first one from the start, the others little by little (unlocking.ts). */
  isOpen(story: string): boolean {
    return isOpen(story, this.finished);
  }

  knownHosts(): string {
    return this.workstation.read('~/.ssh/known_hosts') ?? '';
  }

  get shell(): Shell {
    return this.inside.at(-1)?.shell ?? this.remote?.shell ?? this.workstation;
  }

  prompt(): string {
    return this.shell.prompt();
  }

  complete(line: string): string {
    return this.shell.complete(line);
  }

  /** On the second Tab: the possibilities, laid out in columns as bash does ('' if there are none). */
  suggestions(line: string): string {
    const names = this.shell.suggestions(line);
    return names.length ? inColumns(names, this.columns) : '';
  }

  title(h: Story, c: Chapter): string {
    const story = this.t(`story-${h.id}`);
    const title =
      h.chapters.length > 1 ? this.t('chapter-title-complete', { story: story, number: c.number, title: this.t(`chapter-${c.id}`) }) : story;
    return `— ${title} —`;
  }

  /** The first chapter of a story not yet finished (or the last one). */
  currentChapter(h: Story): Chapter {
    return h.chapters.find((c) => !this.finished.includes(c.id)) ?? h.chapters.at(-1)!;
  }

  // A machine's session: the existing one, otherwise a new one, on the
  // chapter a connection would find (to test its ports from afar).
  private sessionFor(name: string): Shell {
    const old = this.sessions.get(name);
    const chapter = this.connectionChapter(name);
    if (old?.chapter === chapter) return old;
    const s = this.newSession(MACHINES.find((m) => m.name === name)!, chapter);
    s.state.prepared = true;
    return s;
  }

  // The chapter a connection to this machine will find (see connect).
  private connectionChapter(name: string): Chapter {
    const machine = MACHINES.find((m) => m.name === name)!;
    const c = this.currentChapter(STORIES.find((h) => h.id === machine.story)!);
    const old = this.sessions.get(name);
    return old && (old.chapter === c || !old.finished) ? old.chapter : c;
  }

  /**
   * Opens a session on a machine; returns the banner and the start of the
   * chapter. Without a forced chapter, resumes the session left on this
   * machine if it is still on the current chapter.
   */
  connect(name: string, chapter?: Chapter, jump = false, port = 22): string {
    this.inside = [];
    const machine = MACHINES.find((m) => m.name === name)!;
    const story = STORIES.find((h) => h.id === machine.story)!;
    const c = chapter ?? this.currentChapter(story);
    const old = this.sessions.get(name);
    // The banner gives the running kernel (the session's, if it has one).
    const kernel = (old?.state.kernel as { active: string } | undefined)?.active ?? '6.12.0-quetes';
    const banner = [`Linux ${machineName(this.t, machine.name)} ${kernel} #1 SMP x86_64 GNU/Linux`, this.t(`machine-${machine.name}-motd`)];
    // A session created from afar (a port tested with nc): the first real
    // connection opens the chapter, with its welcome text.
    if (!chapter && old?.state.prepared && old.chapter === c) {
      delete old.state.prepared;
      old.state.portSession = port;
      this.remote = { machine, story, shell: old };
      return [...(jump ? [] : banner), this.openChapter(c)].join('\n\n');
    }
    if (!chapter && old && (old.chapter === c || !old.finished)) {
      // Like a new connection: start again from your home. Reconnecting
      // can be an objective (e.g. checking you haven't locked yourself out).
      old.cwd = old.home;
      old.state.connections = (old.state.connections ?? 1) + 1;
      // The connection's port (ss shows it; the session survives a change of sshd's port).
      old.state.portSession = port;
      this.remote = { machine, story, shell: old };
      const alreadyFinished = old.finished;
      // A resumed session: we no longer know what was typed there, a snapshot is no longer possible.
      this.inputs = null;
      const next = old.events();
      // A chapter in progress: remind where to reread its instructions.
      const rappel = old.finished ? '' : this.t('resumed-chapter', { file: old.welcome });
      // A mere jump (ssh -J) opens no session on the gateway: no banner, no reminder.
      const header = jump ? [] : [...banner, this.title(story, old.chapter), rappel];
      return [...header, next, this.noteEnd(old, alreadyFinished)].filter(Boolean).join('\n\n');
    }
    this.remote = { machine, story, shell: this.newSession(machine, c) };
    this.remote.shell.state.portSession = port;
    return [...(jump ? [] : banner), this.openChapter(c)].join('\n\n');
  }

  /** (Re)starts a chapter on the current machine. */
  open(chapter: Chapter): string {
    this.inside = [];
    this.remote!.shell = this.newSession(this.remote!.machine, chapter);
    return this.openChapter(chapter);
  }

  // Exam mode: no hints in the chapters (the sessions opened follow it too).
  private _exam = false;
  get exam(): boolean {
    return this._exam;
  }
  set exam(yes: boolean) {
    this._exam = yes;
    for (const s of this.sessions.values()) s.exam = yes;
  }

  private newSession(machine: Machine, chapter: Chapter): Shell {
    const s = new Shell(chapter, this.t.language, machine.name);
    this.visited.add(machine.name);
    s.exam = this.exam;
    // The chapter may look at the workstation (its ssh config, what was copied there).
    s.state.workstation = () => this.workstation;
    this.sessions.set(machine.name, s);
    return s;
  }

  private openChapter(c: Chapter): string {
    this.inputs = [];
    if (!this.inRestore) this.serial++;
    return [this.title(this.remote!.story, c), this.remote!.shell.execute(`cat ${this.remote!.shell.welcome}`) ?? ''].join('\n\n');
  }

  disconnect(): string {
    const { machine } = this.remote!;
    this.remote = null;
    this.inside = [];
    return `logout\nConnection to ${machineDomain(this.t, machine)} closed.`;
  }

  // exit on an internal machine: go back one step (or to the workstation, after ssh -J).
  private quitInside(): string {
    const e = this.inside.pop()!;
    const message = `logout\nConnection to ${e.domain} closed.`;
    if (e.back) {
      this.inside = [];
      this.remote = null;
    }
    return message;
  }

  // A session on an internal machine (ssh from the story's machine, or ssh -J from the workstation).
  private openInside(d: { shell: Shell; domain: string; via?: string }): string {
    const chunks: string[] = [];
    const sinceWorkstation = !this.remote || !!d.via;
    // ssh -J from the workstation: the story's machine opens (its chapter starts if needed).
    if (d.via && this.remote?.machine.name !== d.via) chunks.push(this.connect(d.via, undefined, true));
    d.shell.cwd = d.shell.home;
    this.inside.push({ shell: d.shell, domain: d.domain, back: sinceWorkstation && !!d.via });
    this.visited.add(d.shell.host);
    chunks.push(`Linux ${d.shell.hostName} 6.12.0-quetes #1 SMP x86_64 GNU/Linux`);
    return chunks.join('\n\n');
  }

  // The keys of the stories that just opened, placed in the workstation's ~/.ssh.
  private giveKeys(before: string[]): string {
    const fresh = MACHINES.filter((m) => this.isOpen(m.story!) && !before.includes(m.story!) && !m.withoutKey);
    if (!fresh.length) return '';
    const ssh = this.workstation.find('~/.ssh');
    if (ssh?.type === 'directory') for (const m of fresh) Object.assign(ssh.children, keyFiles(this.t, m));
    // The first wave (after The Root) explains where to find the keys; the next ones announce them.
    const first = !before.some((h) => h !== FIRST);
    return this.t(first ? 'workstation-keys-received' : 'workstation-keys-received-next', { keys: fresh.map((m) => `~/.ssh/${keyFor(this.t, m)}`).join(', ') });
  }

  /** Runs a line; returns the text to display, or null for "clear". */
  execute(line: string): string | null {
    const sh = this.shell;
    sh.colours = this.colours;
    sh.columns = this.columns;
    // An input on the chapter's machine (or its internal machines) is replayed; one on the workstation is not.
    if (this.remote) this.inputs?.push({ line });
    else this.inputs = null;
    const alreadyFinished = sh.finished;
    // A new command: a forgotten follow (chapter left during tail -f) is over.
    sh.follow = null;
    // In tmux, what is displayed stays in the session (for tmux attach).
    const tmuxBefore = sh.tmux;
    const prompt = sh.prompt();
    const before = { tapees: sh.typedCommands, errors: sh.commandsInError };
    const output = sh.execute(line);
    // On an internal machine, commands count for the chapter's summary (see summary.ts).
    if (sh.parent) {
      sh.principal.typedCommands += sh.typedCommands - before.tapees;
      sh.principal.commandsInError += sh.commandsInError - before.errors;
      sh.principal.commandLine = sh.commandLine;
    }
    if (output === null) return null;
    if (tmuxBefore && sh.tmux === tmuxBefore) noteTmux(sh, tmuxBefore, [`${prompt.trimEnd()} ${line}`, output].filter(Boolean).join('\n'));
    const chunks = [output];
    if (sh.cut && this.remote) {
      // The network was cut: the connection drops (what runs in tmux keeps going).
      sh.cut = false;
      sh.tmux = null;
      this.inside = [];
      this.remote = null;
      chunks.push('client_loop: send disconnect: Broken pipe');
    } else if (sh.output) {
      sh.output = false;
      chunks.push(this.inside.length ? this.quitInside() : this.remote ? this.disconnect() : this.t('workstation-exit'));
    } else if (sh.reboot && sh.state.hostConsole) {
      // The host's console (the server's screen) does not drop: you see the boot.
      sh.reboot = false;
      if (sh.state.rescue && sh.state.rescueBanner) chunks.push(sh.state.rescueBanner as string);
    } else if (sh.reboot && this.remote) {
      // The machine reboots: the server closes the connection.
      sh.reboot = false;
      const { domain } = this.remote.machine;
      this.remote = null;
      chunks.push(`Connection to ${domain} closed by remote host.\nConnection to ${domain} closed.`);
    } else if (sh.connectionRequest) {
      const name = sh.connectionRequest;
      sh.connectionRequest = null;
      chunks.push(this.connect(name, undefined, false, sh.state.connectionPort ?? 22));
    } else if (sh.sessionRequest) {
      const d = sh.sessionRequest;
      sh.sessionRequest = null;
      chunks.push(this.openInside(d));
    }
    // On an internal machine: the chapter's events are checked on the story's machine.
    const principal = sh.parent ? sh.principal : null;
    if (principal) {
      const before = principal.finished;
      chunks.push(principal.events(), this.noteEnd(principal, before));
    }
    chunks.push(this.noteEnd(sh, alreadyFinished));
    if (sh === this.workstation) chunks.push(this.watchWorkstation());
    if (sh.edition) this.finishedBeforeEdition = sh.finished;
    if (!this.remote) this.inputs = null;
    return chunks.filter(Boolean).join('\n\n');
  }

  // After a command on the workstation: the chapters watching it check their events.
  private watchWorkstation(): string {
    const chunks: string[] = [];
    for (const s of this.sessions.values())
      if (s.chapter.watchesWorkstation && !s.finished) {
        // A step passed from the workstation: the summary records the command typed on the workstation.
        s.commandLine = this.workstation.commandLine;
        chunks.push(s.events(), this.noteEnd(s, false));
      }
    return chunks.filter(Boolean).join('\n\n');
  }

  // A chapter has just ended: progress, and keys if any.
  private noteEnd(sh: Shell, alreadyFinished: boolean): string {
    if (alreadyFinished || !sh.finished || sh === this.workstation) return '';
    const openOnes = STORIES.filter((h) => this.isOpen(h.id)).map((h) => h.id);
    if (!this.finished.includes(sh.chapter.id)) this.finished.push(sh.chapter.id);
    return this.giveKeys(openOnes);
  }

  // ——— The rescue snapshot ———

  /** The number of replayable inputs since the chapter was opened; null: no snapshot possible. */
  get not(): number | null {
    return this.remote ? (this.inputs?.length ?? null) : null;
  }

  /**
   * Reopens the current chapter and replays its first n inputs, displaying
   * nothing: the machine returns exactly to that moment. Hints already
   * asked for stay counted. Returns false if it isn't possible.
   */
  restore(n: number): boolean {
    const before = this.inputs;
    if (!this.remote || !before || n < 0 || n > before.length) return false;
    const old = this.remote.shell;
    this.inRestore = true;
    try {
      this.open(old.chapter);
      for (const s of before.slice(0, n)) {
        if ('line' in s) this.execute(s.line);
        else if ('save' in s) this.save(s.save);
        else if ('follow' in s) this.follow(s.follow);
        else if ('interrupt' in s) this.interrupt();
        else this.quitEdition();
      }
    } finally {
      this.inRestore = false;
    }
    for (const i of old.requestsHints) this.remote?.shell.requestsHints.add(i);
    return true;
  }

  // ——— Following (tail -f, journalctl -f): the command keeps control until Ctrl-C ———

  /** True during a follow: the screen calls follow() at its own pace, Ctrl-C calls interrupt(). */
  get follows(): boolean {
    return !!this.shell.follow;
  }

  /** Lets a few seconds pass on the machine (its activity, see activity.ts); returns what was added. */
  follow(seconds = 2): string {
    const sh = this.shell;
    if (!sh.follow) return '';
    if (this.remote) this.inputs?.push({ follow: seconds });
    else this.inputs = null;
    live(sh.principal, seconds);
    const before = sh.principal.finished;
    return [sh.follow.read(), sh.principal.events(), this.noteEnd(sh.principal, before)].filter(Boolean).join('\n\n');
  }

  /** Ctrl-C: stops following. */
  interrupt(): string {
    if (!this.shell.follow) return '';
    if (this.remote) this.inputs?.push({ interrupt: true });
    else this.inputs = null;
    this.shell.follow = null;
    return '^C';
  }

  // ——— Editor (nano), on the current machine ———

  private finishedBeforeEdition = false;

  get edition() {
    return this.shell.edition;
  }

  /** ^O: writes the file; returns nano's message, and whether it was written. */
  save(text: string): { message: string; written: boolean } {
    if (this.remote) this.inputs?.push({ save: text });
    else this.inputs = null;
    const message = this.shell.saveEdition(text);
    return { message, written: this.shell.edition?.text === text };
  }

  /** ^X: closes the editor; returns the story messages triggered. */
  quitEdition(): string {
    if (this.remote) this.inputs?.push({ quit: true });
    else this.inputs = null;
    const sh = this.shell;
    const principal = sh.parent ? sh.principal : null;
    const before = principal?.finished ?? false;
    const chunks = [sh.quitEdition(), this.noteEnd(sh, this.finishedBeforeEdition)];
    // A file written on an internal machine can end the chapter.
    if (principal) chunks.push(principal.events(), this.noteEnd(principal, before));
    if (sh === this.workstation) chunks.push(this.watchWorkstation());
    return chunks.filter(Boolean).join('\n\n');
  }
}
