// La console : ce que voit la joueuse ou le joueur. Elle part du poste
// (poste.ts) et ouvre une session sur la machine d'une histoire quand ssh
// réussit ; exit la referme et ramène au poste. Chaque machine fait tourner
// le chapitre en cours de son histoire. Finir l'Effaceur donne les clés SSH
// des autres machines : on les apprend en jouant.

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
  /** Chapitres déjà terminés (identifiants). */
  finished?: string[];
  /** Contenu sauvegardé de ~/.ssh/known_hosts. */
  knownHosts?: string;
  /** Les fichiers de ~/.ssh créés par la joueuse ou le joueur (clés, config), et les phrases de passe. */
  ssh?: { files: Record<string, string>; phrases?: Record<string, string> };
}


type Input = { line: string } | { save: string } | { quit: true } | { follow: number } | { interrupt: true };

export class Console {
  // L'écran montre les couleurs des sorties (réglage de l'interface) ; voir couleurs.ts.
  colours = false;
  // La largeur de l'écran en caractères, mesurée par l'interface (ls s'y range).
  columns = 80;

  // L'instantané de secours : ce qu'on a saisi depuis l'ouverture du chapitre
  // (commandes, réponses, enregistrements de nano). Le moteur est
  // déterministe : rouvrir le chapitre et rejouer les n premières saisies
  // redonne exactement la machine d'alors. null : plus rejouable (on est
  // revenu au poste, ou on a repris une session laissée plus tôt). `serie`
  // change à chaque ouverture de chapitre (pas à une restauration) : un
  // instantané n'est valable que dans sa série.
  private inputs: Input[] | null = null;
  serial = 0;
  private inRestore = false;
  t: Translate;
  finished: string[];
  workstation: Shell;
  remote: { machine: Machine; story: Story; shell: Shell } | null = null;
  // Les sessions ouvertes depuis la machine de l'histoire, vers son réseau
  // interne (la dernière est celle où l'on tape) ; `retour` : ouverte avec
  // ssh -J depuis le poste, exit ramène directement au poste.
  inside: { shell: Shell; domain: string; back: boolean }[] = [];
  // Les machines gardent leur état tant que la partie est ouverte : se
  // reconnecter retrouve le chapitre là où on l'a laissé.
  private sessions = new Map<string, Shell>();
  // Les machines où l'on s'est connecté·e pendant cette partie (le plan du réseau les marque).
  visited = new Set<string>(['desk']);

  constructor(private options: OptionsConsole = {}) {
    this.t = translator(options.language);
    this.finished = [...(options.finished ?? [])];
    this.workstation = this.newWorkstation();
  }

  private newWorkstation(knownHosts = this.options.knownHosts): Shell {
    const keys = MACHINES.filter((m) => this.isOpen(m.story!) && !m.withoutKey);
    const s = new Shell(workstation(keys), this.t.language, 'desk');
    // ssh demande au serveur d'en face sa configuration appliquée (sshd).
    // (celui du chapitre qu'ouvrirait la connexion : un chapitre peut commencer avec SSH sur un autre port).
    s.state.sshdDistant = (name: string) => this.sessionFor(name).state.sshd?.load ?? null;
    // … et son pare-feu (ufw), qui peut bloquer la connexion avant même sshd.
    s.state.pareFeuDistant = (name: string) => this.sessions.get(name)?.state.ufw ?? null;
    // … et les adresses que son fail2ban a bannies (pour ce port, s'il est donné : la prison ne bloque que les siens).
    s.state.bannisDistant = (name: string, port?: number): string[] => {
      const f2b: Fail2banState | undefined = this.sessions.get(name)?.state.fail2ban;
      if (!f2b) return [];
      return port === undefined ? f2b.banned : bannedOnPort(f2b, port);
    };
    // … et l'état d'un de ses ports, vu d'ici (nc -zv machine port).
    s.state.portDistant = (name: string, port: number): PortState => portState(this.sessionFor(name), port, false, WORKSTATION.address);
    // … et sa clé d'hôte, qui change quand la machine a été réinstallée.
    s.state.cleDistante = (name: string): string => this.connectionChapter(name).hostKey ?? '';
    // … et la session elle-même (ssh -J, scp, ssh-copy-id, sur les machines qui gèrent leurs clés).
    s.state.sessionDistante = (name: string): Shell => this.sessionFor(name);
    // Les noms des machines suivent la langue de la partie (royaume.internal → kingdom.internal).
    const other = LANGUAGES.filter((l) => l !== this.t.language).map((l) => translator(l));
    if (knownHosts) s.place('ssh', '~/.ssh/known_hosts', f(translateHosts(knownHosts, this.t, other), { lines: true }));
    // Les clés créées et la config modifiée, gardées d'une visite à l'autre.
    // La sauvegarde sert à toutes les langues : une config restée celle du jeu
    // (dans n'importe quelle langue) laisse la place à celle de la partie, et
    // une config modifiée se connecte avec le compte de la langue (User vous → you).
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
      if (old?.type === 'fichier') old.content = content;
      else s.place('ssh', `~/.ssh/${name}`, f(content, { lines: true, mode: isPrivate ? 'rw-------' : 'rw-r--r--' }));
    }
    if (this.options.ssh?.phrases) s.state.phrasesDePasse = { ...this.options.ssh.phrases };
    return s;
  }

  /** Ce qu'il faut garder de ~/.ssh du poste : ce que la joueuse ou le joueur a créé ou modifié. */
  ssh(): { files: Record<string, string>; phrases?: Record<string, string> } {
    const directory = this.workstation.find('~/.ssh');
    const data = new Set(MACHINES.filter((m) => !m.withoutKey).flatMap((m) => [keyFor(this.t, m), `${keyFor(this.t, m)}.pub`]));
    const files: Record<string, string> = {};
    if (directory?.type === 'dossier')
      for (const name of Object.keys(directory.children))
        if (name !== 'known_hosts' && !data.has(name) && directory.children[name].type === 'fichier')
          files[name] = this.workstation.read(`~/.ssh/${name}`) ?? '';
    // La config que le jeu a donnée, pas modifiée : rien à garder.
    if (files.config?.trim() === configSsh(this.t)) delete files.config;
    return { files, phrases: this.workstation.state.phrasesDePasse };
  }

  /** Remet le poste à neuf, en gardant les hôtes connus. */
  resetWorkstation(): string {
    this.workstation = this.newWorkstation(this.knownHosts());
    return this.workstation.execute(`cat ${this.workstation.welcome}`) ?? '';
  }

  /** Une histoire est ouverte si l'on a sa clé : la première d'emblée, les autres peu à peu (deverrouillage.ts). */
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

  /** Au deuxième Tab : les possibilités, rangées en colonnes comme le fait bash ('' s'il n'y en a pas). */
  suggestions(line: string): string {
    const names = this.shell.suggestions(line);
    return names.length ? inColumns(names, this.columns) : '';
  }

  title(h: Story, c: Chapter): string {
    const story = this.t(`story-${h.id}`);
    const title =
      h.chapters.length > 1 ? this.t('chapter-title-complete', { histoire: story, numero: c.number, titre: this.t(`chapter-${c.id}`) }) : story;
    return `— ${title} —`;
  }

  /** Le premier chapitre pas encore terminé d'une histoire (ou le dernier). */
  currentChapter(h: Story): Chapter {
    return h.chapters.find((c) => !this.finished.includes(c.id)) ?? h.chapters.at(-1)!;
  }

  // La session d'une machine : celle qui existe, sinon une neuve, sur le
  // chapitre que trouverait une connexion (pour tester ses ports de loin).
  private sessionFor(name: string): Shell {
    const old = this.sessions.get(name);
    const chapter = this.connectionChapter(name);
    if (old?.chapter === chapter) return old;
    const s = this.newSession(MACHINES.find((m) => m.name === name)!, chapter);
    s.state.preparee = true;
    return s;
  }

  // Le chapitre que trouvera une connexion à cette machine (voir connecter).
  private connectionChapter(name: string): Chapter {
    const machine = MACHINES.find((m) => m.name === name)!;
    const c = this.currentChapter(STORIES.find((h) => h.id === machine.story)!);
    const old = this.sessions.get(name);
    return old && (old.chapter === c || !old.finished) ? old.chapter : c;
  }

  /**
   * Ouvre une session sur une machine ; renvoie la bannière et le début du
   * chapitre. Sans chapitre imposé, reprend la session laissée sur cette
   * machine si elle est toujours sur le chapitre en cours.
   */
  connect(name: string, chapter?: Chapter, jump = false, port = 22): string {
    this.inside = [];
    const machine = MACHINES.find((m) => m.name === name)!;
    const story = STORIES.find((h) => h.id === machine.story)!;
    const c = chapter ?? this.currentChapter(story);
    const old = this.sessions.get(name);
    // La bannière donne le noyau qui tourne (celui de la session, s'il en a un).
    const kernel = (old?.state.noyau as { active: string } | undefined)?.active ?? '6.12.0-quetes';
    const banner = [`Linux ${machineName(this.t, machine.name)} ${kernel} #1 SMP x86_64 GNU/Linux`, this.t(`machine-${machine.name}-motd`)];
    // Une session créée de loin (un port testé avec nc) : la première vraie
    // connexion ouvre le chapitre, avec son texte d'accueil.
    if (!chapter && old?.state.preparee && old.chapter === c) {
      delete old.state.preparee;
      old.state.portSession = port;
      this.remote = { machine, story, shell: old };
      return [...(jump ? [] : banner), this.openChapter(c)].join('\n\n');
    }
    if (!chapter && old && (old.chapter === c || !old.finished)) {
      // Comme une nouvelle connexion : on repart de sa maison. Se reconnecter
      // peut être un objectif (ex. vérifier qu'on ne s'est pas enfermé dehors).
      old.cwd = old.home;
      old.state.connexions = (old.state.connexions ?? 1) + 1;
      // Le port de la connexion (ss la montre ; la session survit à un changement de port de sshd).
      old.state.portSession = port;
      this.remote = { machine, story, shell: old };
      const alreadyFinished = old.finished;
      // Une session reprise : on ne sait plus ce qui y a été tapé, l'instantané n'est plus possible.
      this.inputs = null;
      const next = old.events();
      // Un chapitre en cours : rappeler où relire ses consignes.
      const rappel = old.finished ? '' : this.t('resumed-chapter', { fichier: old.welcome });
      // Un simple rebond (ssh -J) n'ouvre pas de session sur la passerelle : ni bannière ni rappel.
      const header = jump ? [] : [...banner, this.title(story, old.chapter), rappel];
      return [...header, next, this.noteEnd(old, alreadyFinished)].filter(Boolean).join('\n\n');
    }
    this.remote = { machine, story, shell: this.newSession(machine, c) };
    this.remote.shell.state.portSession = port;
    return [...(jump ? [] : banner), this.openChapter(c)].join('\n\n');
  }

  /** (Re)commence un chapitre sur la machine où l'on est. */
  open(chapter: Chapter): string {
    this.inside = [];
    this.remote!.shell = this.newSession(this.remote!.machine, chapter);
    return this.openChapter(chapter);
  }

  // Mode examen : pas d'indice dans les chapitres (les sessions ouvertes le suivent aussi).
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
    // Le chapitre peut regarder le poste (sa config ssh, ce qu'on y a copié).
    s.state.poste = () => this.workstation;
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

  // exit sur une machine interne : on revient d'un cran (ou au poste, après ssh -J).
  private quitInside(): string {
    const e = this.inside.pop()!;
    const message = `logout\nConnection to ${e.domain} closed.`;
    if (e.back) {
      this.inside = [];
      this.remote = null;
    }
    return message;
  }

  // Une session sur une machine interne (ssh depuis la machine de l'histoire, ou ssh -J depuis le poste).
  private openInside(d: { shell: Shell; domain: string; via?: string }): string {
    const chunks: string[] = [];
    const sinceWorkstation = !this.remote || !!d.via;
    // ssh -J depuis le poste : la machine de l'histoire s'ouvre (son chapitre commence s'il le faut).
    if (d.via && this.remote?.machine.name !== d.via) chunks.push(this.connect(d.via, undefined, true));
    d.shell.cwd = d.shell.home;
    this.inside.push({ shell: d.shell, domain: d.domain, back: sinceWorkstation && !!d.via });
    this.visited.add(d.shell.host);
    chunks.push(`Linux ${d.shell.hostName} 6.12.0-quetes #1 SMP x86_64 GNU/Linux`);
    return chunks.join('\n\n');
  }

  // Les clés des histoires qui viennent de s'ouvrir, posées dans ~/.ssh du poste.
  private giveKeys(before: string[]): string {
    const fresh = MACHINES.filter((m) => this.isOpen(m.story!) && !before.includes(m.story!) && !m.withoutKey);
    if (!fresh.length) return '';
    const ssh = this.workstation.find('~/.ssh');
    if (ssh?.type === 'dossier') for (const m of fresh) Object.assign(ssh.children, keyFiles(this.t, m));
    // La première vague (après La Racine) explique où trouver les clés ; les suivantes les annoncent.
    const first = !before.some((h) => h !== FIRST);
    return this.t(first ? 'workstation-keys-received' : 'workstation-keys-received-next', { cles: fresh.map((m) => `~/.ssh/${keyFor(this.t, m)}`).join(', ') });
  }

  /** Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ». */
  execute(line: string): string | null {
    const sh = this.shell;
    sh.colours = this.colours;
    sh.columns = this.columns;
    // Une saisie sur la machine du chapitre (ou ses machines internes) se rejoue ; une saisie sur le poste, non.
    if (this.remote) this.inputs?.push({ line });
    else this.inputs = null;
    const alreadyFinished = sh.finished;
    // Une nouvelle commande : un suivi oublié (chapitre quitté pendant tail -f) est fini.
    sh.follow = null;
    // Dans tmux, ce qui s'affiche reste dans la session (pour tmux attach).
    const tmuxBefore = sh.tmux;
    const prompt = sh.prompt();
    const before = { tapees: sh.typedCommands, errors: sh.commandsInError };
    const output = sh.execute(line);
    // Sur une machine interne, les commandes comptent pour le bilan du chapitre (voir bilan.ts).
    if (sh.parent) {
      sh.principal.typedCommands += sh.typedCommands - before.tapees;
      sh.principal.commandsInError += sh.commandsInError - before.errors;
      sh.principal.commandLine = sh.commandLine;
    }
    if (output === null) return null;
    if (tmuxBefore && sh.tmux === tmuxBefore) noteTmux(sh, tmuxBefore, [`${prompt.trimEnd()} ${line}`, output].filter(Boolean).join('\n'));
    const chunks = [output];
    if (sh.cut && this.remote) {
      // Le réseau a coupé : la connexion tombe (ce qui tourne dans tmux, lui, continue).
      sh.cut = false;
      sh.tmux = null;
      this.inside = [];
      this.remote = null;
      chunks.push('client_loop: send disconnect: Broken pipe');
    } else if (sh.output) {
      sh.output = false;
      chunks.push(this.inside.length ? this.quitInside() : this.remote ? this.disconnect() : this.t('workstation-exit'));
    } else if (sh.reboot && sh.state.consoleHebergeur) {
      // La console de l'hébergeur (l'écran du serveur) ne coupe pas : on voit le démarrage.
      sh.reboot = false;
      if (sh.state.secours && sh.state.banniereSecours) chunks.push(sh.state.banniereSecours as string);
    } else if (sh.reboot && this.remote) {
      // La machine redémarre : le serveur coupe la connexion.
      sh.reboot = false;
      const { domain } = this.remote.machine;
      this.remote = null;
      chunks.push(`Connection to ${domain} closed by remote host.\nConnection to ${domain} closed.`);
    } else if (sh.connectionRequest) {
      const name = sh.connectionRequest;
      sh.connectionRequest = null;
      chunks.push(this.connect(name, undefined, false, sh.state.portConnexion ?? 22));
    } else if (sh.sessionRequest) {
      const d = sh.sessionRequest;
      sh.sessionRequest = null;
      chunks.push(this.openInside(d));
    }
    // Sur une machine interne : les événements du chapitre se vérifient sur la machine de l'histoire.
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

  // Après une commande sur le poste : les chapitres qui le regardent vérifient leurs événements.
  private watchWorkstation(): string {
    const chunks: string[] = [];
    for (const s of this.sessions.values())
      if (s.chapter.watchesWorkstation && !s.finished) {
        // Une étape franchie depuis le poste : le bilan note la commande tapée sur le poste.
        s.commandLine = this.workstation.commandLine;
        chunks.push(s.events(), this.noteEnd(s, false));
      }
    return chunks.filter(Boolean).join('\n\n');
  }

  // Un chapitre vient de se terminer : progression, et clés éventuelles.
  private noteEnd(sh: Shell, alreadyFinished: boolean): string {
    if (alreadyFinished || !sh.finished || sh === this.workstation) return '';
    const openOnes = STORIES.filter((h) => this.isOpen(h.id)).map((h) => h.id);
    if (!this.finished.includes(sh.chapter.id)) this.finished.push(sh.chapter.id);
    return this.giveKeys(openOnes);
  }

  // ——— L'instantané de secours ———

  /** Le nombre de saisies rejouables depuis l'ouverture du chapitre ; null : pas d'instantané possible. */
  get not(): number | null {
    return this.remote ? (this.inputs?.length ?? null) : null;
  }

  /**
   * Rouvre le chapitre en cours et rejoue ses n premières saisies, sans rien
   * afficher : la machine revient exactement à cet instant. Les indices déjà
   * demandés restent comptés. Renvoie false si ce n'est pas possible.
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

  // ——— Suivi (tail -f, journalctl -f) : la commande garde la main jusqu'à Ctrl-C ———

  /** Vrai pendant un suivi : l'écran appelle suivre() à son rythme, Ctrl-C appelle interrompre(). */
  get follows(): boolean {
    return !!this.shell.follow;
  }

  /** Fait passer quelques secondes sur la machine (son activité, voir activite.ts) ; renvoie ce qui s'est ajouté. */
  follow(seconds = 2): string {
    const sh = this.shell;
    if (!sh.follow) return '';
    if (this.remote) this.inputs?.push({ follow: seconds });
    else this.inputs = null;
    live(sh.principal, seconds);
    const before = sh.principal.finished;
    return [sh.follow.read(), sh.principal.events(), this.noteEnd(sh.principal, before)].filter(Boolean).join('\n\n');
  }

  /** Ctrl-C : arrête le suivi. */
  interrupt(): string {
    if (!this.shell.follow) return '';
    if (this.remote) this.inputs?.push({ interrupt: true });
    else this.inputs = null;
    this.shell.follow = null;
    return '^C';
  }

  // ——— Éditeur (nano), sur la machine où l'on est ———

  private finishedBeforeEdition = false;

  get edition() {
    return this.shell.edition;
  }

  /** ^O : écrit le fichier ; renvoie le message de nano, et si c'est écrit. */
  save(text: string): { message: string; written: boolean } {
    if (this.remote) this.inputs?.push({ save: text });
    else this.inputs = null;
    const message = this.shell.saveEdition(text);
    return { message, written: this.shell.edition?.text === text };
  }

  /** ^X : ferme l'éditeur ; renvoie les messages de l'histoire déclenchés. */
  quitEdition(): string {
    if (this.remote) this.inputs?.push({ quit: true });
    else this.inputs = null;
    const sh = this.shell;
    const principal = sh.parent ? sh.principal : null;
    const before = principal?.finished ?? false;
    const chunks = [sh.quitEdition(), this.noteEnd(sh, this.finishedBeforeEdition)];
    // Un fichier écrit sur une machine interne peut finir le chapitre.
    if (principal) chunks.push(principal.events(), this.noteEnd(principal, before));
    if (sh === this.workstation) chunks.push(this.watchWorkstation());
    return chunks.filter(Boolean).join('\n\n');
  }
}
