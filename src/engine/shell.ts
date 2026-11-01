// Un mini-shell qui interprète de vraies commandes Linux sur le monde d'un
// chapitre. Les comportements suivent ceux de Linux (messages simplifiés et
// traduits) ; les écarts volontaires sont signalés en commentaire et listés
// dans docs/SCENARIOS.md.
//
// Comme un vrai shell : la ligne est découpée en mots (guillemets compris),
// les jokers * et ? sont développés, les commandes reliées par des tubes |
// (la sortie de l'une devient l'entrée de la suivante), et la sortie finale
// peut être redirigée dans un fichier (> écrase, >> ajoute). Les messages
// d'erreur ne passent pas dans les tubes (sortie d'erreur séparée).

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

// La place des arguments d'un programme (getconf ARG_MAX), et les commandes intégrées au shell, qui n'y sont pas soumises.
const ARG_MAX = 2_097_152;
const BUILT_IN = ['cd', 'echo', 'pwd', 'test', 'printf'];

// Ce que le jeu (les chapitres et les commandes) peut consulter ou modifier.
// Les clins d'œil : xyzzy (le mot magique de Colossal Cave Adventure), le
// sandwich de xkcd 149 (https://xkcd.com/149/), et sl, la locomotive qui punit
// ceux qui tapent sl au lieu de ls (le paquet Debian sl).
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
  // Utilisateur qui agit pour la commande en cours : le joueur, ou « root » sous sudo.
  who: string;
  // Le compte du joueur ou de la joueuse, dans la langue (« vous », « you » :
  // voir joueur() dans monde.ts). Le code compare et écrit ce nom-là, jamais 'vous'.
  player: string;
  // La dernière ligne exécutée (pour les événements) : commandes du tube,
  // sortie produite (avant redirection), fichier de redirection.
  last: { line: string; commands: string[][]; output: string; errors: string[]; redirection: string | null };
  find(path: string, last?: boolean): Node | null;
  exists(path: string): boolean;
  read(path: string): string | null;
  count(place: string, prefix: string): number;
  erase(path: string): void;
  can(n: Node, right: 'r' | 'w' | 'x', user?: string): boolean;
  // Comptes et groupes de la machine ; groupes d'un compte (principal d'abord).
  accounts: Accounts;
  groupsFor(user: string): string[];
  // Les textes dans la langue du jeu (voir src/texts/).
  t: Translate;
  // Nom de la machine (invite « joueur@nom »).
  host: string;
  /** Le nom de la machine dans la langue (kingdom pour royaume). */
  readonly hostName: string;
  // Pose une question (ex. « yes/no » de ssh) : la ligne suivante est la
  // réponse, passée à `repondre`, dont le texte s'affiche.
  ask(prompt: string, answer: (response: string) => string): void;
  // Demande d'ouvrir une session sur une autre machine (ssh) ; la console
  // (console.ts) s'en charge après la ligne en cours.
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
  // Message de la ligne d'état à l'ouverture (« Nouveau fichier »…).
  message: string;
  // À la fermeture (ex. crontab -e vérifie et installe) : message à afficher.
  after?: () => string;
  // La fermeture change l'état (ex. systemctl edit) : elle compte comme une commande, même sans message.
  conclude?: boolean;
}

export class Shell implements Game {
  root: Directory;
  cwd: string;
  /** Le dossier d'avant ($OLDPWD), pour cd -. */
  old: string | null = null;
  home: string;
  flags = new Set<string>();
  state: Record<string, any>;
  finished = false;
  // Mode examen : les étapes sont vérifiées, mais seul le message final (le débrief) s'affiche.
  exam = false;
  // Le terminal montre les couleurs (l'interface, si le réglage est allumé) :
  // ls, grep… colorent alors ce qui va à l'écran (voir couleurs.ts).
  colours = false;
  // La largeur du terminal, en caractères ($COLUMNS) : ls range ses colonnes dedans.
  columns = 80;
  who: string;
  last: Game['last'] = { line: '', commands: [], output: '', errors: [], redirection: null };
  // Le compte sous lequel sudo lance la commande en cours (sudo -u).
  private as = 'root';
  // sudo : mot de passe déjà donné ? ligne en attente du mot de passe ?
  private authenticated = false;
  private doneLecture = false;
  waiting: { line: string; attempts: number } | null = null;
  // Question en cours (ssh : « Are you sure you want to continue connecting? »).
  // secret : la réponse ne s'affiche pas (un mot de passe demandé par ssh).
  question: { prompt: string; answer: (response: string) => string; secret?: boolean } | null = null;
  // Une session à ouvrir sur une autre machine (ssh -J, ssh depuis une
  // machine vers son réseau interne), traitée par la console.
  sessionRequest: { shell: Shell; domain: string; via?: string; address: string } | null = null;
  // La machine principale de l'histoire, pour une machine interne.
  parent: Shell | null = null;
  private internals = new Map<string, Shell>();
  // exit tapé : la console ferme la session (voir console.ts).
  output = false;
  // La machine vient de redémarrer (reboot) : la console coupe la session.
  reboot = false;
  // Fichier ouvert dans l'éditeur (nano) : l'interface l'affiche à la place
  // de la ligne de commande. `root` : ouvert avec sudo.
  edition: Edition | null = null;
  // Un suivi en cours (tail -f, journalctl -f) : lire() donne les lignes
  // arrivées depuis la dernière fois. Ctrl-C l'arrête (Console.interrompre).
  follow: { read: () => string } | null = null;
  // Les commandes tapées sur cette machine (history, !!).
  history: string[] = [];
  // Messages de l'histoire déclenchés pendant l'édition, affichés à la sortie.
  private inWaiting: string[] = [];
  connectionRequest: string | null = null;
  accounts: Accounts;
  // Sortie d'erreur et remarques de la ligne en cours.
  private errors: string[] = [];
  // Le code de retour de la dernière commande, quand elle le donne elle-même
  // (un plugin de supervision : 0 OK, 1 WARNING, 2 CRITICAL) ; sinon, il
  // vaut 1 si elle a écrit une erreur, 0 sinon.
  status: number | null = null;
  // Le masque des droits des fichiers créés (umask), propre à cette session.
  mask = '0022';
  // Le fichier où part la sortie de la commande en cours (> fichier), s'il y en a un : wg genkey le regarde.
  outputTo: string | null = null;
  // La session tmux où l'on tape (null : hors de tmux) ; les sessions vivent dans etat.tmux.
  tmux: string | null = null;
  // La connexion vient de tomber (le réseau a coupé) : la console ramène au poste.
  cut = false;
  // Les lieux où l'on est entré (cd), pour la carte (voir carte.ts).
  visits = new Set<string>();
  // Les messages de l'histoire déjà affichés dans ce chapitre (le panneau « Mission » les relit).
  log: string[] = [];
  // Les clins d'œil trouvés dans cette session (voir OEUFS et succes.ts).
  eggs = new Set<string>();
  // Les indices demandés dans ce chapitre (« étape:niveau », voir indices.ts) : le débrief les compte.
  requestsHints = new Set<string>();
  // Pour le bilan de fin de chapitre (voir bilan.ts) : les commandes tapées,
  // celles qui ont échoué, et la ligne qui a franchi chaque étape. Une
  // réponse à une question (yes, mot de passe) n'est pas une commande : une
  // étape franchie par une réponse est notée avec la commande qui l'a posée.
  typedCommands = 0;
  commandsInError = 0;
  passed: Record<string, string> = {};
  commandLine = '';

  t: Translate;

  // hote : l'identifiant de la machine (royaume) ; nomHote, son nom dans la langue (kingdom).
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

  // Les chapitres écrivent le nom de leur machine en français (/etc/hostname,
  // journal, noms que nginx ou docker reconnaissent) ; il prend celui de la
  // langue (royaume → kingdom, voir machines.ftl).
  private nameMachine(): void {
    // /etc/hosts : chaque nom (aussi sur les machines internes : wiki.maison.internal).
    const hosts = this.find('/etc/hosts');
    if (hosts?.type === 'fichier' && typeof hosts.content === 'string')
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
    if (file?.type === 'fichier' && typeof file.content === 'string' && file.content.trim() === id) file.content = file.content.replace(id, name);
    for (const service of ['nginx', 'docker']) {
      const e = this.state[service] as { names?: string[] } | undefined;
      if (Array.isArray(e?.names)) e.names = e.names.map(translate);
    }
  }

  /** Le compte du joueur ou de la joueuse, sous son nom dans la langue (vous, you…). */
  get player(): string {
    return this.chapter.names ? player(this.t) : 'you';
  }

  /** Le fichier d'accueil du chapitre, sous son nom dans la langue. */
  get welcome(): string {
    return this.chapter.names ? name(this.t, this.chapter.welcome) : this.chapter.welcome;
  }

  // ——— Chemins et fichiers ———

  // Chemin (relatif, absolu, ~, ..) → chemin absolu normalisé.
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

  // Suit les liens symboliques (comme stat) ; `dernier: false` s'arrête sur
  // un lien en fin de chemin (comme lstat : ls -l, rm, ln).
  find(path: string, last = true, depth = 0): Node | null {
    let n: Node = this.root;
    const parts = this.resolve(path).split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (n.type !== 'dossier' || !Object.hasOwn(n.children, p)) return null;
      n = n.children[p];
      const end = i === parts.length - 1;
      if (n.type === 'fichier' && n.link !== undefined && (!end || last)) {
        // Trop de liens en chaîne : ELOOP, comme le noyau.
        if (depth > 8) return null;
        const here = '/' + parts.slice(0, i).join('/');
        const target = n.link.startsWith('/') ? n.link : `${here}/${n.link}`;
        return this.find([target, ...parts.slice(i + 1)].join('/'), last, depth + 1);
      }
    }
    return n;
  }

  /** Le chemin absolu atteint en suivant un lien symbolique (ou le chemin lui-même). */
  realPath(path: string): string {
    const absolute = this.resolve(path);
    const n = this.find(absolute, false);
    if (n?.type !== 'fichier' || n.link === undefined) return absolute;
    const here = absolute.slice(0, absolute.lastIndexOf('/')) || '/';
    return this.resolve(n.link.startsWith('/') ? n.link : `${here}/${n.link}`);
  }

  exists(path: string): boolean {
    return this.find(path) !== null;
  }

  read(path: string): string | null {
    const n = this.find(path);
    return n?.type === 'fichier' ? content(n, this) : null;
  }

  count(place: string, prefix: string): number {
    const n = this.find(place);
    return n?.type === 'dossier' ? Object.keys(n.children).filter((k) => k.startsWith(prefix)).length : 0;
  }

  erase(path: string): void {
    const absolute = this.resolve(path);
    const parent = this.find(absolute + '/..');
    if (parent?.type === 'dossier') delete parent.children[absolute.split('/').pop()!];
  }

  name(path: string): string {
    return this.resolve(path).split('/').pop()!;
  }

  // ——— Permissions ———

  // Groupe principal, puis groupes secondaires (par numéro), comme id(1).
  groupsFor(user: string): string[] {
    const principal = this.accounts.users[user]?.group ?? user;
    const other = Object.entries(this.accounts.groups)
      .filter(([name, g]) => name !== principal && g.members.includes(user))
      .sort(([, a], [, b]) => a.gid - b.gid)
      .map(([name]) => name);
    return [principal, ...other];
  }

  // Permissions Unix : le propriétaire n'a que les droits du propriétaire,
  // un membre du groupe que ceux du groupe, les autres ceux des autres
  // (même si le groupe ou les autres ont plus). root a tous les droits.
  can(n: Node, right: 'r' | 'w' | 'x', user = this.who): boolean {
    if (user === 'root') return true;
    const mode = n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--');
    const owner = n.owner ?? this.player;
    const triplet =
      owner === user ? mode.slice(0, 3) : this.groupsFor(user).includes(n.group ?? owner) ? mode.slice(3, 6) : mode.slice(6, 9);
    // s et t (setuid, setgid, sticky) en dernière position valent aussi x.
    return triplet.includes(right) || (right === 'x' && /[st]$/.test(triplet));
  }

  // Droit de traverser (x) chaque lieu qui mène à ce chemin (sans le dernier).
  traverses(path: string): boolean {
    let n: Node | undefined = this.root;
    for (const p of this.resolve(path).split('/').filter(Boolean)) {
      if (!n || n.type !== 'dossier') return true;
      if (!this.can(n, 'x')) return false;
      n = n.children[p];
    }
    return true;
  }

  /** Ce chemin est-il sur un support monté en lecture seule (mount -o ro) ? */
  onlyRead(path: string): boolean {
    return !!(this.mount(this.resolve(path)) as { onlyRead?: boolean } | null)?.onlyRead;
  }

  // Droit d'écrire dans le lieu qui contient ce chemin (créer, effacer, déplacer).
  writtenIn(path: string): boolean {
    if (this.onlyRead(path)) return false;
    const parent = this.find(path + '/..');
    return !!parent && this.traverses(path + '/..') && this.can(parent, 'x') && this.can(parent, 'w');
  }

  // Raison du premier lieu bloqué traversé par ce chemin, sinon null.
  block(path: string): string | null {
    let n: Node = this.root;
    for (const p of this.resolve(path).split('/').filter(Boolean)) {
      if (n.type !== 'dossier' || !Object.hasOwn(n.children, p)) return null;
      n = n.children[p];
      const reason = n.type === 'dossier' ? n.blocked?.(this) : null;
      if (reason) return reason;
    }
    return null;
  }

  // Lit un fichier pour une commande, avec les vérifications d'usage ; en
  // cas de problème, écrit l'erreur et renvoie null.
  readFor(cmd: string, target: string): string | null {
    const n = this.find(target);
    const v = { command: cmd, target: target };
    if (!n) return this.error(this.t('error-missing', v)), null;
    if (n.type === 'dossier') return this.error(this.t('error-is-one-directory', v)), null;
    const reason = this.block(target);
    if (reason) return this.error(reason), null;
    if (!this.traverses(target) || !this.can(n, 'r')) return this.error(this.t('error-permission', v)), null;
    if (n.archive) return this.error(this.t('error-binary', v)), null;
    return content(n, this);
  }

  // Place un nœud dans un lieu (création, copie, déplacement), en vérifiant
  // les droits et la place disponible sur le support. Renvoie une erreur.
  // Pour une redirection (cmd = « bash »), le refus a la forme courte de bash.
  place(cmd: string, path: string, n: Node): string | null {
    const v = { command: cmd, target: path };
    const parent = this.find(path + '/..');
    if (parent?.type !== 'dossier') return this.t('error-missing', v);
    const reason = this.block(path + '/..');
    if (reason) return reason;
    if (this.onlyRead(path)) return this.t('error-read-only', v);
    if (!this.writtenIn(path)) return this.t(cmd === 'bash' ? 'redirection-permission' : 'error-creation-permission', v);
    const name = this.name(path);
    const old = parent.children[name];
    // Écrire dans un lien, c'est écrire dans le fichier qu'il vise.
    if (old?.type === 'fichier' && old.link !== undefined && n.type === 'fichier' && n.link === undefined) return this.place(cmd, this.realPath(path), n);
    if (this.missingPlace(this.resolve(path), n, old)) return this.t('error-space', v);
    if (!old) {
      // Un nouveau fichier prend les droits permis par le masque (umask) ;
      // dans un dossier setgid, il prend le groupe du dossier (et un dossier, le setgid).
      if (n.mode === undefined && this.mask !== '0022') n.mode = modeWithMask(n.type === 'dossier', this.mask);
      if (/[sS]/.test(parent.mode?.[5] ?? '') && n.group === undefined) {
        n.group = parent.group ?? parent.owner ?? this.player;
        if (n.type === 'dossier') n.mode = applyMode(n.mode ?? modeWithMask(true, this.mask), 'g+s')!;
      }
    }
    parent.children[name] = n;
    return null;
  }

  // Taille d'un nœud en octets (un lieu : la somme de son contenu).
  size(n: Node): number {
    if (n.type === 'fichier') return sizeFor(n, this);
    return Object.values(n.children).reduce((t, e) => t + this.size(e), 0);
  }

  // Les supports montés (clé USB…) ont une capacité : etat.montages.
  // Le support le plus précis qui contient ce chemin (/srv/radio avant /).
  mount(absolute: string): { path: string; capacity: number; inodes?: number; inodesBase?: number } | null {
    const mounts: { path: string; capacity: number; inodes?: number }[] = this.state.mounts ?? [];
    return (
      mounts
        .filter((m) => m.path === '/' || absolute === m.path || absolute.startsWith(m.path + '/'))
        .sort((a, b) => b.path.length - a.path.length)[0] ?? null
    );
  }

  /** Les inodes occupés sur un support : chaque fichier et chaque lieu, plus ceux du système (inodesBase). */
  usedInodes(m: { path: string; inodesBase?: number }): number {
    const other: string[] = (this.state.mounts ?? []).map((x: { path: string }) => x.path).filter((c: string) => c !== m.path);
    const count = (path: string, n: Node): number => {
      if (other.includes(path)) return 0;
      if (n.type === 'fichier') return 1;
      let total = 1;
      // Seuls les lieux ont besoin de leur chemin (pour reconnaître un autre support monté dedans).
      for (const k in n.children) {
        const e = n.children[k];
        total += e.type === 'fichier' ? 1 : count(`${path === '/' ? '' : path}/${k}`, e);
      }
      return total;
    };
    const place = this.find(m.path);
    return (m.inodesBase ?? 0) + (place ? count(m.path, place) : 0);
  }

  private missingPlace(absolute: string, n: Node, old?: Node): boolean {
    const m = this.mount(absolute);
    if (!m) return false;
    // Plus d'inode libre : plus moyen de créer un fichier, même vide (« No space left on device »).
    if (m.inodes && !old && this.usedInodes(m) >= m.inodes) return true;
    const place = this.find(m.path);
    // Sans les autres supports montés dedans (/srv n'est pas sur /), comme df.
    const inside = ((this.state.mounts ?? []) as { path: string }[]).filter(
      (x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')),
    );
    const other = inside.reduce((t, x) => t + ((d) => (d ? this.size(d) : 0))(this.find(x.path)), 0);
    const inUse = (place ? this.size(place) : 0) - other;
    return inUse - (old ? this.size(old) : 0) + this.size(n) > m.capacity;
  }

  // ——— Sorties ———

  error(message: string, code?: number): '' {
    this.errors.push(message);
    // Le code de retour du vrai outil (ex. userdel : 6 pour un compte inconnu), sinon 1.
    if (code !== undefined) this.status = code;
    return '';
  }

  /** Les erreurs écrites jusqu'ici (et on les efface) : pour une réponse à une question. */
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
    // Dans tmux, la barre d'état montre le nom de la session : on le met devant l'invite.
    // root (la console de secours d'un chapitre) a son invite à lui, avec #, comme bash.
    const root = this.who === 'root';
    return `${this.tmux ? `[${this.tmux}] ` : ''}${root ? 'root' : this.player}@${this.hostName}:${here}${root ? '#' : '$'}`;
  }

  ask(prompt: string, answer: (response: string) => string, secret = false): void {
    this.question = { prompt, answer, secret };
  }

  /** La saisie en cours ne doit pas s'afficher (mot de passe de sudo ou de ssh). */
  maskedInput(): boolean {
    return this.waiting !== null || !!this.question?.secret;
  }

  /** La machine principale de l'histoire (elle-même, ou celle dont dépend une machine interne). */
  get principal(): Shell {
    return this.parent ? this.parent.principal : this;
  }

  /** Une machine du réseau interne de l'histoire, créée à la première connexion. */
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
      // Renommée comme la machine principale (le compte vous, /home/vous…).
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

  /** Les machines internes de l'histoire : nom, adresse, domaine. */
  internal_(): { name: string; address: string; domain: string }[] {
    return Object.entries(this.principal.chapter.hosts ?? {}).map(([name, h]) => ({ name, address: h.address, domain: hostInLanguage(this.t, h.domain) }));
  }

  // Développe * et ? comme le fait le shell, avant la commande. Les fichiers
  // cachés ne sont pris que si le motif commence par un point.
  expand(word: string): string[] {
    if (!/[*?]/.test(word)) return [word];
    const i = word.lastIndexOf('/');
    const base = i >= 0 ? word.slice(0, i + 1) : '';
    const pattern = word.slice(i + 1);
    const place = this.find(base || '.');
    if (place?.type !== 'dossier' || this.block(base || '.') || !this.can(place, 'r')) return [word];
    const re = wildcard(pattern);
    const found = Object.keys(place.children)
      .filter((n) => re.test(n) && (pattern.startsWith('.') || !n.startsWith('.')))
      .sort(compareNames)
      .map((n) => base + n);
    return found.length ? found : [word];
  }

  // Complétion par Tab du dernier mot.
  // Ce que Tab peut compléter au bout de la ligne : les candidats (tels
  // qu'affichés au double Tab : les lieux avec un /), et ce qu'on y ajoute.
  private candidates(line: string): { words: string[]; base: string; names: string[]; directories: Set<string> } | null {
    const words = line.split(' ');
    const last = words.pop() ?? '';
    const before = words.filter(Boolean);
    if (before.length === 0 || before.at(-1) === 'sudo' || before.at(-1) === '|')
      return { words, base: '', names: [...new Set(this.known())].filter((c) => c.startsWith(last)).sort(), directories: new Set() };
    // Comme bash-completion : après ssh, les machines de ~/.ssh/config.
    if (before[0] === 'ssh' && !last.startsWith('-') && !last.includes('/') && before.at(-1) !== '-i') {
      const hosts = [...(this.read('~/.ssh/config') ?? '').matchAll(/^Host\s+(\S+)/gm)].map((m) => m[1]).filter((h) => h.startsWith(last) && !/[*?]/.test(h));
      return { words, base: '', names: hosts, directories: new Set() };
    }
    const i = last.lastIndexOf('/');
    const base = i >= 0 ? last.slice(0, i + 1) : '';
    const start = last.slice(i + 1);
    const place = this.find(base || '.');
    if (!place || place.type !== 'dossier') return null;
    const names = Object.keys(place.children)
      .filter((n) => n.startsWith(start) && (start.startsWith('.') || !n.startsWith('.')))
      .sort();
    return { words, base, names, directories: new Set(names.filter((n) => place.children[n].type === 'dossier')) };
  }

  complete(line: string): string {
    const c = this.candidates(line);
    if (!c || c.names.length === 0) return line;
    if (c.names.length > 1) {
      // Comme bash : on complète jusqu'au plus long début commun.
      let common = c.names[0];
      for (const n of c.names) while (!n.startsWith(common)) common = common.slice(0, -1);
      return [...c.words, c.base + common].join(' ');
    }
    const suffix = c.directories.has(c.names[0]) ? '/' : ' ';
    return [...c.words, c.base + c.names[0] + suffix].join(' ');
  }

  /** Les possibilités, quand Tab ne peut pas choisir (bash les montre au deuxième Tab) ; vide sinon. */
  suggestions(line: string): string[] {
    const c = this.candidates(line);
    if (!c || c.names.length < 2) return [];
    return c.names.map((n) => (c.directories.has(n) ? `${n}/` : n));
  }

  /** Le nom de la machine dans la langue : l'invite, hostname, les journaux. */
  get hostName(): string {
    return machineName(this.t, this.host);
  }

  known(): string[] {
    // La commande qui liste les autres a le nom de la langue (aide en français) ;
    // help, comme le builtin de bash, marche dans toutes les langues.
    return [...this.chapter.commands, 'man', 'apropos', 'whatis', 'clear', 'exit', 'history', this.t('command-help')];
  }


  // man, apropos, whatis : le manuel couvre toutes les commandes du jeu,
  // même celles qu'on n'a pas encore dans ce chapitre (comme sur un vrai
  // système, où le manuel décrit aussi ce qu'on n'a pas le droit de lancer).
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

  // ——— Exécution ———

  // Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ».
  // Si sudo attend un mot de passe, la ligne est ce mot de passe.
  execute(line: string): string | null {
    if (this.waiting) return this.password(line);
    if (this.question) {
      const { answer } = this.question;
      this.question = null;
      return this.conclude(answer(line.trim()), true);
    }
    // L'historique, comme bash : !! (la dernière commande), !n, !-n, !début.
    // La ligne développée s'affiche avant de s'exécuter, et c'est elle qui est gardée.
    const expanded = this.expandHistory(line);
    if (expanded.error) {
      this.typedCommands++;
      this.commandsInError++;
      this.status = 1;
      return expanded.error;
    }
    const echo = expanded.line !== line ? expanded.line : '';
    line = expanded.line;
    // Comme HISTCONTROL=ignoreboth (le ~/.bashrc de Debian) : ni les lignes qui commencent par une espace, ni les doublons qui se suivent.
    if (line.trim() && !/^\s/.test(line) && this.history.at(-1) !== line) this.history.push(line);
    if (!echo) return this.runLine(line);
    const output = this.runLine(line);
    return output === null ? null : [echo, output].filter(Boolean).join('\n');
  }

  // !! et ses cousins, hors des apostrophes.
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

  // La ligne, une fois l'historique développé.
  private runLine(line: string): string | null {
    const words = split(line);
    if (!words.length) return '';
    this.typedCommands++;
    this.commandLine = line.trim();
    // Quelques clins d'œil de la culture du terminal : une réponse, et un succès caché.
    const egg = EGGS[line.trim().replace(/\s+/g, ' ')];
    if (egg) {
      if (egg.achievements) this.eggs.add(egg.achievements);
      return this.t(egg.text);
    }
    if (words.length === 1 && words[0].text === 'clear' && !words[0].city) return null;
    // exit est intégré au shell : la console ferme la session.
    if (words[0].text === 'exit' && !words[0].city && words.length <= 2) {
      // Dans tmux, exit ferme le shell de la session (et la session avec), pas la connexion.
      if (this.tmux) {
        delete (this.state.tmux as Record<string, unknown>)[this.tmux];
        this.tmux = null;
        return '[exited]';
      }
      // Le shell du mode secours : exit reprend le démarrage (voir fstab.ts).
      const rescue = this.state.continueBoot as ((j: Shell) => string) | undefined;
      if (this.state.rescue && rescue) return this.conclude(rescue(this), true);
      this.output = true;
      return '';
    }
    // sudo demande le mot de passe avant de lancer quoi que ce soit.
    const withSudo = words.some((m, i) => !m.city && m.text === 'sudo' && (i === 0 || words[i - 1].op === '|'));
    // Une erreur dans la politique de sudo (un fichier de /etc/sudoers.d écrit sans visudo) : sudo refuse tout.
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

  // Une ligne finie en erreur (un message d'erreur, ou un code de retour non nul) compte pour le bilan.
  private countLine(output: string): string {
    if (this.errors.length || (this.status ?? 0) !== 0) this.commandsInError++;
    return output;
  }

  /** Le mot de passe du joueur ou de la joueuse, dans la langue (tournesol → sunflower, voir passwords.ftl). */
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
   * Lance une ligne de commande comme le ferait cron : depuis la maison, sans
   * événements de l'histoire ; renvoie tout ce qu'elle a écrit (sortie et
   * erreurs), que cron enverrait par courrier.
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
   * Lance une ligne pour un script (script.ts : crochet de git, script de
   * déploiement), depuis ce lieu, sans toucher à la ligne en cours : renvoie
   * ce qu'elle a écrit, si elle a réussi (aucune erreur) et le lieu où le
   * script se trouve ensuite (cd).
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

  /** Vérifie les événements de l'histoire hors d'une commande (ex. à la reconnexion). */
  events(): string {
    return this.conclude('', false);
  }

  private conclude(output: string, account: boolean): string {
    const next = account ? this.chapter.afterCommand?.(this) : undefined;
    return [output, next ? this.prose(next) : '', ...this.checkEvents()].filter(Boolean).join('\n\n');
  }

  // Un texte de l'histoire (événement, remarque) : paragraphes et typographie.
  private prose(text: string): string {
    return typography(clean(text), this.t.language);
  }

  // Une ligne complète : commandes reliées par des tubes, redirection finale.
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
      // Comme le shell : les jokers ne sont pas développés entre guillemets.
      let args = segment.flatMap((m) => (m.city ? [m.text] : this.expand(m.text)));
      let root = false;
      // sudo -u compte : agir sous ce compte plutôt que root.
      let as = 'root';
      // sudo -l : c'est sudo lui-même qui répond (la liste des commandes permises).
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
    // Les événements lisent la sortie telle qu'on la lit, sans les codes de couleur.
    this.last = { line, commands, output: withoutColours(output), errors: this.errors, redirection: redirection ? this.resolve(redirection.file) : null };

    if (redirection) {
      // La redirection est faite par TON shell, avant sudo : même avec sudo
      // devant la commande, c'est « vous » qui écrit dans le fichier.
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
    if (n?.type === 'dossier') return this.t('redirection-is-one-directory', { target: file });
    if (n) {
      if (this.onlyRead(file)) return this.t('error-read-only', { command: 'bash', target: file });
      if (!this.traverses(file) || !this.can(n, 'w')) return this.t('redirection-permission', { target: file });
      const before = content(n, this);
      n.content = addition && before ? `${before}\n${text}` : text;
      n.lines = true;
      delete n.size;
      return null;
    }
    return this.place('bash', file, { type: 'fichier', content: text, owner: this.who, lines: true });
  }

  // Lance une commande. `dernier` : sa sortie s'affiche à l'écran (sinon elle
  // part dans un tube ou un fichier).
  private launch(args: string[], input: string | null, root: boolean, last: boolean): string {
    // Dans un tube, c'est le code de la dernière commande qui compte.
    this.status = null;
    const [raw, ...rest] = args;
    // /usr/bin/rsnapshot, /bin/ls… : le chemin complet d'une commande du jeu
    // (et /usr/lib/nagios/plugins/check_disk pour celles qui sont hors du PATH).
    const onlyName = raw?.split('/').at(-1) ?? '';
    const outsidePath = COMMANDS[onlyName]?.directory;
    const cmd =
      raw && ((/^\/(usr\/)?s?bin\/[\w.-]+$/.test(raw) && COMMANDS[onlyName] && !outsidePath) || (outsidePath && raw === `${outsidePath}/${onlyName}`))
        ? onlyName
        : raw;
    if (cmd && COMMANDS[cmd]?.directory && cmd === raw) return this.error(this.t('command-missing', { command: cmd }));
    if (!cmd) return '';
    if (root && !this.known().includes('sudo')) return this.error(this.t('sudo-not-still'));
    // Vrai comportement : cd est intégré au shell, ce n'est pas un programme.
    if (root && cmd === 'cd') return this.error(this.t('sudo-cd'));
    if (cmd === 'help' || cmd === this.t('command-help')) return this.t('help-commands', { commands: this.known().join(', ') });
    if (cmd === 'man' || cmd === 'apropos' || cmd === 'whatis') return this.consulter(cmd, rest);
    // Un chemin (./deployer.sh, /srv/site/deployer.sh) : un script, s'il est exécutable.
    if (cmd.includes('/')) {
      const n = this.find(cmd);
      if (!n) return this.error(this.t('script-missing', { command: cmd }));
      if (n.type === 'dossier') return this.error(this.t('script-directory', { command: cmd }));
      if (!this.traverses(cmd) || !this.can(n, 'x') || !this.can(n, 'r')) return this.error(this.t('script-permission', { command: cmd }));
      const before = this.who;
      if (root) this.who = this.as;
      try {
        return launchScript(this, cmd, rest);
      } finally {
        this.who = before;
      }
    }
    // Une page de manuel de fichier (section 5, ex. sshd_config) n'est pas une commande.
    const command: Command | undefined = COMMANDS[cmd]?.section === 5 ? undefined : COMMANDS[cmd];
    // Sur une machine interne d'une histoire, un programme absent l'est vraiment (bash, code 127).
    if (this.parent && !this.known().includes(cmd)) {
      const output = this.error(`-bash: ${cmd}: command not found`);
      this.status = 127;
      return output;
    }
    if (!this.known().includes(cmd) || !command)
      return this.error(this.t(command || cmd === 'sudo' ? 'command-not-still' : 'command-missing', { command: cmd }));
    // Un programme reçoit ses arguments dans une zone limitée (ARG_MAX, 2 Mio
    // sous Linux) : un joker qui donne des dizaines de milliers de noms
    // dépasse. echo, intégré au shell, n'a pas cette limite.
    if (!BUILT_IN.includes(cmd) && args.reduce((t, a) => t + a.length + 1, 0) > ARG_MAX) {
      this.state.argumentsTooLong = (this.state.argumentsTooLong ?? 0) + 1;
      return this.error(this.t(root ? 'sudo-list-arguments-too-long' : 'list-arguments-too-long', { program: `/usr/bin/${cmd}` }));
    }
    // Les réflexes d'auto-dépannage : --help et les options inconnues.
    if (rest.includes('--help')) return help(cmd, command, this.t);
    const invalid = invalidOption(cmd, command, rest, this.t);
    if (invalid) return this.error(invalid);
    // --all → -a : la commande ne lit que ses options courtes.
    const options = command.ownOptions ? rest : shorten(command, rest);
    const before = this.who;
    if (root) this.who = this.as;
    try {
      return command.launch({ args: options, input, game: this, last });
    } finally {
      this.who = before;
    }
  }

  // ——— Éditeur (nano) ———

  /**
   * Écrit le texte de l'éditeur dans le fichier, avec les droits de celui ou
   * celle qui l'a ouvert (root sous sudo) ; renvoie le message de nano.
   * Les événements de l'histoire sont vérifiés, et leurs messages gardés pour
   * la fermeture de l'éditeur.
   */
  saveEdition(text: string): string {
    const e = this.edition!;
    const before = this.who;
    if (e.root) this.who = 'root';
    try {
      const n = this.find(e.path);
      const lines = text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;
      if (n?.type === 'fichier') {
        if (!this.traverses(e.path) || !this.can(n, 'w')) return this.t('nano-error-write', { path: e.path });
        n.content = text.replace(/\n$/, '');
        n.lines = true;
        delete n.size;
      } else {
        const error = this.place('nano', e.path, { type: 'fichier', content: text.replace(/\n$/, ''), owner: this.who, lines: true });
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

  /** Ferme l'éditeur ; renvoie les messages de l'histoire en attente. */
  quitEdition(): string {
    const after = this.edition?.after?.() ?? '';
    const conclude = this.edition?.conclude;
    this.edition = null;
    // Ce que la fermeture a changé (ex. une crontab installée) compte comme une commande.
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
