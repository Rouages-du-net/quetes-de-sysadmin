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

import { chemin, comptesParDefaut, joueur, motDePasse, nettoyer, nom, traduireComptes, traduireNoms, type Chapitre, type Comptes, type Dossier, type Noeud } from './monde';
import { COMMANDES, type Commande } from './commandes';
import { sansCouleurs } from './couleurs';
import { aide, apropos, ligneWhatis, optionInvalide, pageMan, raccourcir } from './commandes/manuel';
import { traducteur, typographie, type Langue, type Traduire } from '../textes';
import { hoteDansLaLangue, nomMachine } from './machines';

export { decouper, appliquerMode } from './outils';
import { appliquerMode, comparerNoms, contenu, decouper, joker, modeAvecMasque, tailleDe, type Mot } from './outils';
import { lancerScript } from './commandes/scripts';
import { lire as lireSudoers, SUDOERS } from './sudoers';

// La place des arguments d'un programme (getconf ARG_MAX), et les commandes intégrées au shell, qui n'y sont pas soumises.
const ARG_MAX = 2_097_152;
const INTEGRES = ['cd', 'echo', 'pwd', 'test', 'printf'];

// Ce que le jeu (les chapitres et les commandes) peut consulter ou modifier.
// Les clins d'œil : xyzzy (le mot magique de Colossal Cave Adventure), le
// sandwich de xkcd 149 (https://xkcd.com/149/), et sl, la locomotive qui punit
// ceux qui tapent sl au lieu de ls (le paquet Debian sl).
const OEUFS: Record<string, { texte: string; succes: string }> = {
  xyzzy: { texte: 'oeuf-xyzzy', succes: 'xyzzy' },
  'make me a sandwich': { texte: 'oeuf-sandwich-refus', succes: '' },
  'sudo make me a sandwich': { texte: 'oeuf-sandwich', succes: 'sandwich' },
  sl: { texte: 'oeuf-sl', succes: 'sl' },
};

export interface Jeu {
  racine: Dossier;
  cwd: string;
  drapeaux: Set<string>;
  maison: string;
  etat: Record<string, any>;
  // Utilisateur qui agit pour la commande en cours : le joueur, ou « root » sous sudo.
  qui: string;
  // Le compte du joueur ou de la joueuse, dans la langue (« vous », « you » :
  // voir joueur() dans monde.ts). Le code compare et écrit ce nom-là, jamais 'vous'.
  joueur: string;
  // La dernière ligne exécutée (pour les événements) : commandes du tube,
  // sortie produite (avant redirection), fichier de redirection.
  derniere: { ligne: string; commandes: string[][]; sortie: string; erreurs: string[]; redirection: string | null };
  trouver(chemin: string, dernier?: boolean): Noeud | null;
  existe(chemin: string): boolean;
  lire(chemin: string): string | null;
  compter(lieu: string, prefixe: string): number;
  effacer(chemin: string): void;
  peut(n: Noeud, droit: 'r' | 'w' | 'x', utilisateur?: string): boolean;
  // Comptes et groupes de la machine ; groupes d'un compte (principal d'abord).
  comptes: Comptes;
  groupesDe(utilisateur: string): string[];
  // Les textes dans la langue du jeu (voir src/textes/).
  t: Traduire;
  // Nom de la machine (invite « joueur@nom »).
  hote: string;
  /** Le nom de la machine dans la langue (kingdom pour royaume). */
  readonly nomHote: string;
  // Pose une question (ex. « yes/no » de ssh) : la ligne suivante est la
  // réponse, passée à `repondre`, dont le texte s'affiche.
  demander(invite: string, repondre: (reponse: string) => string): void;
  // Demande d'ouvrir une session sur une autre machine (ssh) ; la console
  // (console.ts) s'en charge après la ligne en cours.
  demandeConnexion: string | null;
  redemarrage: boolean;
  edition: Edition | null;
}

export interface Edition {
  chemin: string;
  texte: string;
  root: boolean;
  // Message de la ligne d'état à l'ouverture (« Nouveau fichier »…).
  message: string;
  // À la fermeture (ex. crontab -e vérifie et installe) : message à afficher.
  apres?: () => string;
  // La fermeture change l'état (ex. systemctl edit) : elle compte comme une commande, même sans message.
  conclure?: boolean;
}

export class Shell implements Jeu {
  racine: Dossier;
  cwd: string;
  /** Le dossier d'avant ($OLDPWD), pour cd -. */
  ancien: string | null = null;
  maison: string;
  drapeaux = new Set<string>();
  etat: Record<string, any>;
  termine = false;
  // Mode examen : les étapes sont vérifiées, mais seul le message final (le débrief) s'affiche.
  examen = false;
  // Le terminal montre les couleurs (l'interface, si le réglage est allumé) :
  // ls, grep… colorent alors ce qui va à l'écran (voir couleurs.ts).
  couleurs = false;
  // La largeur du terminal, en caractères ($COLUMNS) : ls range ses colonnes dedans.
  colonnes = 80;
  qui: string;
  derniere: Jeu['derniere'] = { ligne: '', commandes: [], sortie: '', erreurs: [], redirection: null };
  // Le compte sous lequel sudo lance la commande en cours (sudo -u).
  private comme = 'root';
  // sudo : mot de passe déjà donné ? ligne en attente du mot de passe ?
  private authentifie = false;
  private sermonFait = false;
  attente: { ligne: string; essais: number } | null = null;
  // Question en cours (ssh : « Are you sure you want to continue connecting? »).
  // secret : la réponse ne s'affiche pas (un mot de passe demandé par ssh).
  question: { invite: string; repondre: (reponse: string) => string; secret?: boolean } | null = null;
  // Une session à ouvrir sur une autre machine (ssh -J, ssh depuis une
  // machine vers son réseau interne), traitée par la console.
  demandeSession: { shell: Shell; domaine: string; via?: string; adresse: string } | null = null;
  // La machine principale de l'histoire, pour une machine interne.
  parent: Shell | null = null;
  private internes = new Map<string, Shell>();
  // exit tapé : la console ferme la session (voir console.ts).
  sortie = false;
  // La machine vient de redémarrer (reboot) : la console coupe la session.
  redemarrage = false;
  // Fichier ouvert dans l'éditeur (nano) : l'interface l'affiche à la place
  // de la ligne de commande. `root` : ouvert avec sudo.
  edition: Edition | null = null;
  // Messages de l'histoire déclenchés pendant l'édition, affichés à la sortie.
  private enAttente: string[] = [];
  demandeConnexion: string | null = null;
  comptes: Comptes;
  // Sortie d'erreur et remarques de la ligne en cours.
  private erreurs: string[] = [];
  // Le code de retour de la dernière commande, quand elle le donne elle-même
  // (un plugin de supervision : 0 OK, 1 WARNING, 2 CRITICAL) ; sinon, il
  // vaut 1 si elle a écrit une erreur, 0 sinon.
  statut: number | null = null;
  // Le masque des droits des fichiers créés (umask), propre à cette session.
  masque = '0022';
  // Le fichier où part la sortie de la commande en cours (> fichier), s'il y en a un : wg genkey le regarde.
  sortieVers: string | null = null;
  // La session tmux où l'on tape (null : hors de tmux) ; les sessions vivent dans etat.tmux.
  tmux: string | null = null;
  // La connexion vient de tomber (le réseau a coupé) : la console ramène au poste.
  coupure = false;
  // Les lieux où l'on est entré (cd), pour la carte (voir carte.ts).
  visites = new Set<string>();
  // Les messages de l'histoire déjà affichés dans ce chapitre (le panneau « Mission » les relit).
  journal: string[] = [];
  // Les clins d'œil trouvés dans cette session (voir OEUFS et succes.ts).
  oeufs = new Set<string>();
  // Les indices demandés dans ce chapitre (« étape:niveau », voir indices.ts) : le débrief les compte.
  indicesDemandes = new Set<string>();
  // Pour le bilan de fin de chapitre (voir bilan.ts) : les commandes tapées,
  // celles qui ont échoué, et la ligne qui a franchi chaque étape. Une
  // réponse à une question (yes, mot de passe) n'est pas une commande : une
  // étape franchie par une réponse est notée avec la commande qui l'a posée.
  commandesTapees = 0;
  commandesEnErreur = 0;
  franchies: Record<string, string> = {};
  ligneCommande = '';

  t: Traduire;

  // hote : l'identifiant de la machine (royaume) ; nomHote, son nom dans la langue (kingdom).
  constructor(
    public chapitre: Chapitre,
    langue?: Langue,
    public hote = 'sysadmin',
  ) {
    this.t = traducteur(langue);
    this.racine = chapitre.noms ? traduireNoms(this.t, chapitre.creerMonde(this.t)) : chapitre.creerMonde(this.t);
    this.maison = chapitre.noms ? chemin(this.t, chapitre.maison) : chapitre.maison;
    this.cwd = this.maison;
    this.visites.add(this.maison);
    this.etat = chapitre.etat?.(this.t) ?? {};
    const comptes = chapitre.comptes?.() ?? comptesParDefaut();
    this.comptes = chapitre.noms ? traduireComptes(this.t, comptes) : comptes;
    this.qui = this.joueur;
    this.nommerMachine();
    chapitre.initialiser?.(this);
  }

  // Les chapitres écrivent le nom de leur machine en français (/etc/hostname,
  // journal, noms que nginx ou docker reconnaissent) ; il prend celui de la
  // langue (royaume → kingdom, voir machines.ftl).
  private nommerMachine(): void {
    // /etc/hosts : chaque nom (aussi sur les machines internes : wiki.maison.internal).
    const hosts = this.trouver('/etc/hosts');
    if (hosts?.type === 'fichier' && typeof hosts.contenu === 'string')
      hosts.contenu = hosts.contenu
        .split('\n')
        .map((l) => (l.trimStart().startsWith('#') ? l : l.replace(/[^\s]+/g, (n) => hoteDansLaLangue(this.t, n))))
        .join('\n');
    const id = this.hote;
    const nom = this.nomHote;
    const traduire = (n: string) => hoteDansLaLangue(this.t, n);
    const scan = this.etat.scan as { hotes?: { noms: string[] }[] } | undefined;
    for (const h of scan?.hotes ?? []) h.noms = h.noms.map(traduire);
    if (nom === id) return;
    const sd = this.etat.systemd as { hote: string; journal: { message: string }[] } | undefined;
    if (sd?.hote === id) {
      sd.hote = nom;
      for (const e of sd.journal) e.message = e.message.replace(`(${id})`, `(${nom})`);
    }
    const fichier = this.trouver('/etc/hostname');
    if (fichier?.type === 'fichier' && typeof fichier.contenu === 'string' && fichier.contenu.trim() === id) fichier.contenu = fichier.contenu.replace(id, nom);
    for (const service of ['nginx', 'docker']) {
      const e = this.etat[service] as { noms?: string[] } | undefined;
      if (Array.isArray(e?.noms)) e.noms = e.noms.map(traduire);
    }
  }

  /** Le compte du joueur ou de la joueuse, sous son nom dans la langue (vous, you…). */
  get joueur(): string {
    return this.chapitre.noms ? joueur(this.t) : 'vous';
  }

  /** Le fichier d'accueil du chapitre, sous son nom dans la langue. */
  get accueil(): string {
    return this.chapitre.noms ? nom(this.t, this.chapitre.accueil) : this.chapitre.accueil;
  }

  // ——— Chemins et fichiers ———

  // Chemin (relatif, absolu, ~, ..) → chemin absolu normalisé.
  resoudre(chemin: string): string {
    if (chemin === '~' || chemin.startsWith('~/')) chemin = this.maison + chemin.slice(1);
    const parts = (chemin.startsWith('/') ? chemin : `${this.cwd}/${chemin}`).split('/');
    const pile: string[] = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') pile.pop();
      else pile.push(p);
    }
    return '/' + pile.join('/');
  }

  // Suit les liens symboliques (comme stat) ; `dernier: false` s'arrête sur
  // un lien en fin de chemin (comme lstat : ls -l, rm, ln).
  trouver(chemin: string, dernier = true, profondeur = 0): Noeud | null {
    let n: Noeud = this.racine;
    const parties = this.resoudre(chemin).split('/').filter(Boolean);
    for (let i = 0; i < parties.length; i++) {
      const p = parties[i];
      if (n.type !== 'dossier' || !Object.hasOwn(n.enfants, p)) return null;
      n = n.enfants[p];
      const fin = i === parties.length - 1;
      if (n.type === 'fichier' && n.lien !== undefined && (!fin || dernier)) {
        // Trop de liens en chaîne : ELOOP, comme le noyau.
        if (profondeur > 8) return null;
        const ici = '/' + parties.slice(0, i).join('/');
        const cible = n.lien.startsWith('/') ? n.lien : `${ici}/${n.lien}`;
        return this.trouver([cible, ...parties.slice(i + 1)].join('/'), dernier, profondeur + 1);
      }
    }
    return n;
  }

  /** Le chemin absolu atteint en suivant un lien symbolique (ou le chemin lui-même). */
  cheminReel(chemin: string): string {
    const absolu = this.resoudre(chemin);
    const n = this.trouver(absolu, false);
    if (n?.type !== 'fichier' || n.lien === undefined) return absolu;
    const ici = absolu.slice(0, absolu.lastIndexOf('/')) || '/';
    return this.resoudre(n.lien.startsWith('/') ? n.lien : `${ici}/${n.lien}`);
  }

  existe(chemin: string): boolean {
    return this.trouver(chemin) !== null;
  }

  lire(chemin: string): string | null {
    const n = this.trouver(chemin);
    return n?.type === 'fichier' ? contenu(n, this) : null;
  }

  compter(lieu: string, prefixe: string): number {
    const n = this.trouver(lieu);
    return n?.type === 'dossier' ? Object.keys(n.enfants).filter((k) => k.startsWith(prefixe)).length : 0;
  }

  effacer(chemin: string): void {
    const absolu = this.resoudre(chemin);
    const parent = this.trouver(absolu + '/..');
    if (parent?.type === 'dossier') delete parent.enfants[absolu.split('/').pop()!];
  }

  nom(chemin: string): string {
    return this.resoudre(chemin).split('/').pop()!;
  }

  // ——— Permissions ———

  // Groupe principal, puis groupes secondaires (par numéro), comme id(1).
  groupesDe(utilisateur: string): string[] {
    const principal = this.comptes.utilisateurs[utilisateur]?.groupe ?? utilisateur;
    const autres = Object.entries(this.comptes.groupes)
      .filter(([nom, g]) => nom !== principal && g.membres.includes(utilisateur))
      .sort(([, a], [, b]) => a.gid - b.gid)
      .map(([nom]) => nom);
    return [principal, ...autres];
  }

  // Permissions Unix : le propriétaire n'a que les droits du propriétaire,
  // un membre du groupe que ceux du groupe, les autres ceux des autres
  // (même si le groupe ou les autres ont plus). root a tous les droits.
  peut(n: Noeud, droit: 'r' | 'w' | 'x', utilisateur = this.qui): boolean {
    if (utilisateur === 'root') return true;
    const mode = n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--');
    const proprio = n.proprio ?? this.joueur;
    const triplet =
      proprio === utilisateur ? mode.slice(0, 3) : this.groupesDe(utilisateur).includes(n.groupe ?? proprio) ? mode.slice(3, 6) : mode.slice(6, 9);
    // s et t (setuid, setgid, sticky) en dernière position valent aussi x.
    return triplet.includes(droit) || (droit === 'x' && /[st]$/.test(triplet));
  }

  // Droit de traverser (x) chaque lieu qui mène à ce chemin (sans le dernier).
  traverse(chemin: string): boolean {
    let n: Noeud | undefined = this.racine;
    for (const p of this.resoudre(chemin).split('/').filter(Boolean)) {
      if (!n || n.type !== 'dossier') return true;
      if (!this.peut(n, 'x')) return false;
      n = n.enfants[p];
    }
    return true;
  }

  /** Ce chemin est-il sur un support monté en lecture seule (mount -o ro) ? */
  lectureSeule(chemin: string): boolean {
    return !!(this.montage(this.resoudre(chemin)) as { lectureSeule?: boolean } | null)?.lectureSeule;
  }

  // Droit d'écrire dans le lieu qui contient ce chemin (créer, effacer, déplacer).
  ecritDans(chemin: string): boolean {
    if (this.lectureSeule(chemin)) return false;
    const parent = this.trouver(chemin + '/..');
    return !!parent && this.traverse(chemin + '/..') && this.peut(parent, 'x') && this.peut(parent, 'w');
  }

  // Raison du premier lieu bloqué traversé par ce chemin, sinon null.
  blocage(chemin: string): string | null {
    let n: Noeud = this.racine;
    for (const p of this.resoudre(chemin).split('/').filter(Boolean)) {
      if (n.type !== 'dossier' || !Object.hasOwn(n.enfants, p)) return null;
      n = n.enfants[p];
      const raison = n.type === 'dossier' ? n.bloque?.(this) : null;
      if (raison) return raison;
    }
    return null;
  }

  // Lit un fichier pour une commande, avec les vérifications d'usage ; en
  // cas de problème, écrit l'erreur et renvoie null.
  lirePour(cmd: string, cible: string): string | null {
    const n = this.trouver(cible);
    const v = { commande: cmd, cible };
    if (!n) return this.erreur(this.t('erreur-introuvable', v)), null;
    if (n.type === 'dossier') return this.erreur(this.t('erreur-est-un-dossier', v)), null;
    const raison = this.blocage(cible);
    if (raison) return this.erreur(raison), null;
    if (!this.traverse(cible) || !this.peut(n, 'r')) return this.erreur(this.t('erreur-permission', v)), null;
    if (n.archive) return this.erreur(this.t('erreur-binaire', v)), null;
    return contenu(n, this);
  }

  // Place un nœud dans un lieu (création, copie, déplacement), en vérifiant
  // les droits et la place disponible sur le support. Renvoie une erreur.
  // Pour une redirection (cmd = « bash »), le refus a la forme courte de bash.
  placer(cmd: string, chemin: string, n: Noeud): string | null {
    const v = { commande: cmd, cible: chemin };
    const parent = this.trouver(chemin + '/..');
    if (parent?.type !== 'dossier') return this.t('erreur-introuvable', v);
    const raison = this.blocage(chemin + '/..');
    if (raison) return raison;
    if (this.lectureSeule(chemin)) return this.t('erreur-lecture-seule', v);
    if (!this.ecritDans(chemin)) return this.t(cmd === 'bash' ? 'redirection-permission' : 'erreur-creation-permission', v);
    const nom = this.nom(chemin);
    const ancien = parent.enfants[nom];
    // Écrire dans un lien, c'est écrire dans le fichier qu'il vise.
    if (ancien?.type === 'fichier' && ancien.lien !== undefined && n.type === 'fichier' && n.lien === undefined) return this.placer(cmd, this.cheminReel(chemin), n);
    if (this.placeManquante(this.resoudre(chemin), n, ancien)) return this.t('erreur-espace', v);
    if (!ancien) {
      // Un nouveau fichier prend les droits permis par le masque (umask) ;
      // dans un dossier setgid, il prend le groupe du dossier (et un dossier, le setgid).
      if (n.mode === undefined && this.masque !== '0022') n.mode = modeAvecMasque(n.type === 'dossier', this.masque);
      if (/[sS]/.test(parent.mode?.[5] ?? '') && n.groupe === undefined) {
        n.groupe = parent.groupe ?? parent.proprio ?? this.joueur;
        if (n.type === 'dossier') n.mode = appliquerMode(n.mode ?? modeAvecMasque(true, this.masque), 'g+s')!;
      }
    }
    parent.enfants[nom] = n;
    return null;
  }

  // Taille d'un nœud en octets (un lieu : la somme de son contenu).
  taille(n: Noeud): number {
    if (n.type === 'fichier') return tailleDe(n, this);
    return Object.values(n.enfants).reduce((t, e) => t + this.taille(e), 0);
  }

  // Les supports montés (clé USB…) ont une capacité : etat.montages.
  // Le support le plus précis qui contient ce chemin (/srv/radio avant /).
  montage(absolu: string): { chemin: string; capacite: number; inodes?: number; inodesBase?: number } | null {
    const montages: { chemin: string; capacite: number; inodes?: number }[] = this.etat.montages ?? [];
    return (
      montages
        .filter((m) => m.chemin === '/' || absolu === m.chemin || absolu.startsWith(m.chemin + '/'))
        .sort((a, b) => b.chemin.length - a.chemin.length)[0] ?? null
    );
  }

  /** Les inodes occupés sur un support : chaque fichier et chaque lieu, plus ceux du système (inodesBase). */
  inodesUtilises(m: { chemin: string; inodesBase?: number }): number {
    const autres: string[] = (this.etat.montages ?? []).map((x: { chemin: string }) => x.chemin).filter((c: string) => c !== m.chemin);
    const compter = (chemin: string, n: Noeud): number => {
      if (autres.includes(chemin)) return 0;
      if (n.type === 'fichier') return 1;
      let total = 1;
      // Seuls les lieux ont besoin de leur chemin (pour reconnaître un autre support monté dedans).
      for (const k in n.enfants) {
        const e = n.enfants[k];
        total += e.type === 'fichier' ? 1 : compter(`${chemin === '/' ? '' : chemin}/${k}`, e);
      }
      return total;
    };
    const lieu = this.trouver(m.chemin);
    return (m.inodesBase ?? 0) + (lieu ? compter(m.chemin, lieu) : 0);
  }

  private placeManquante(absolu: string, n: Noeud, ancien?: Noeud): boolean {
    const m = this.montage(absolu);
    if (!m) return false;
    // Plus d'inode libre : plus moyen de créer un fichier, même vide (« No space left on device »).
    if (m.inodes && !ancien && this.inodesUtilises(m) >= m.inodes) return true;
    const lieu = this.trouver(m.chemin);
    // Sans les autres supports montés dedans (/srv n'est pas sur /), comme df.
    const dedans = ((this.etat.montages ?? []) as { chemin: string }[]).filter(
      (x) => x.chemin !== m.chemin && (m.chemin === '/' || x.chemin.startsWith(m.chemin + '/')),
    );
    const autres = dedans.reduce((t, x) => t + ((d) => (d ? this.taille(d) : 0))(this.trouver(x.chemin)), 0);
    const utilise = (lieu ? this.taille(lieu) : 0) - autres;
    return utilise - (ancien ? this.taille(ancien) : 0) + this.taille(n) > m.capacite;
  }

  // ——— Sorties ———

  erreur(message: string, code?: number): '' {
    this.erreurs.push(message);
    // Le code de retour du vrai outil (ex. userdel : 6 pour un compte inconnu), sinon 1.
    if (code !== undefined) this.statut = code;
    return '';
  }

  /** Les erreurs écrites jusqu'ici (et on les efface) : pour une réponse à une question. */
  recupererErreurs(): string[] {
    const e = this.erreurs;
    this.erreurs = [];
    return e;
  }

  invite(): string {
    if (this.attente) return this.t('sudo-invite', { utilisateur: this.joueur });
    if (this.question) return this.question.invite;
    const ici =
      this.cwd === this.maison ? '~' : this.cwd.startsWith(this.maison + '/') ? '~' + this.cwd.slice(this.maison.length) : this.cwd;
    // Dans tmux, la barre d'état montre le nom de la session : on le met devant l'invite.
    // root (la console de secours d'un chapitre) a son invite à lui, avec #, comme bash.
    const root = this.qui === 'root';
    return `${this.tmux ? `[${this.tmux}] ` : ''}${root ? 'root' : this.joueur}@${this.nomHote}:${ici}${root ? '#' : '$'}`;
  }

  demander(invite: string, repondre: (reponse: string) => string, secret = false): void {
    this.question = { invite, repondre, secret };
  }

  /** La saisie en cours ne doit pas s'afficher (mot de passe de sudo ou de ssh). */
  saisieMasquee(): boolean {
    return this.attente !== null || !!this.question?.secret;
  }

  /** La machine principale de l'histoire (elle-même, ou celle dont dépend une machine interne). */
  get principal(): Shell {
    return this.parent ? this.parent.principal : this;
  }

  /** Une machine du réseau interne de l'histoire, créée à la première connexion. */
  interne(nom: string): Shell | null {
    const p = this.principal;
    const def = p.chapitre.hotes?.[nom];
    if (!def) return null;
    const deja = p.internes.get(nom);
    if (deja) return deja;
    const chapitre: Chapitre = {
      id: `${p.chapitre.id}:${nom}`,
      numero: p.chapitre.numero,
      commandes: def.commandes ?? p.chapitre.commandes,
      maison: '/home/vous',
      // Renommée comme la machine principale (le compte vous, /home/vous…).
      noms: p.chapitre.noms,
      accueil: '',
      final: '',
      evenements: [],
      motDePasse: p.chapitre.motDePasse,
      creerMonde: def.creerMonde,
      comptes: def.comptes,
      etat: def.etat,
      initialiser: def.initialiser,
    };
    const s = new Shell(chapitre, this.t.langue, nom);
    s.parent = p;
    p.internes.set(nom, s);
    return s;
  }

  /** Les machines internes de l'histoire : nom, adresse, domaine. */
  internes_(): { nom: string; adresse: string; domaine: string }[] {
    return Object.entries(this.principal.chapitre.hotes ?? {}).map(([nom, h]) => ({ nom, adresse: h.adresse, domaine: hoteDansLaLangue(this.t, h.domaine) }));
  }

  // Développe * et ? comme le fait le shell, avant la commande. Les fichiers
  // cachés ne sont pris que si le motif commence par un point.
  developper(mot: string): string[] {
    if (!/[*?]/.test(mot)) return [mot];
    const i = mot.lastIndexOf('/');
    const base = i >= 0 ? mot.slice(0, i + 1) : '';
    const motif = mot.slice(i + 1);
    const lieu = this.trouver(base || '.');
    if (lieu?.type !== 'dossier' || this.blocage(base || '.') || !this.peut(lieu, 'r')) return [mot];
    const re = joker(motif);
    const trouves = Object.keys(lieu.enfants)
      .filter((n) => re.test(n) && (motif.startsWith('.') || !n.startsWith('.')))
      .sort(comparerNoms)
      .map((n) => base + n);
    return trouves.length ? trouves : [mot];
  }

  // Complétion par Tab du dernier mot.
  // Ce que Tab peut compléter au bout de la ligne : les candidats (tels
  // qu'affichés au double Tab : les lieux avec un /), et ce qu'on y ajoute.
  private candidats(ligne: string): { mots: string[]; base: string; noms: string[]; dossiers: Set<string> } | null {
    const mots = ligne.split(' ');
    const dernier = mots.pop() ?? '';
    const avant = mots.filter(Boolean);
    if (avant.length === 0 || avant.at(-1) === 'sudo' || avant.at(-1) === '|')
      return { mots, base: '', noms: [...new Set(this.connues())].filter((c) => c.startsWith(dernier)).sort(), dossiers: new Set() };
    // Comme bash-completion : après ssh, les machines de ~/.ssh/config.
    if (avant[0] === 'ssh' && !dernier.startsWith('-') && !dernier.includes('/') && avant.at(-1) !== '-i') {
      const hotes = [...(this.lire('~/.ssh/config') ?? '').matchAll(/^Host\s+(\S+)/gm)].map((m) => m[1]).filter((h) => h.startsWith(dernier) && !/[*?]/.test(h));
      return { mots, base: '', noms: hotes, dossiers: new Set() };
    }
    const i = dernier.lastIndexOf('/');
    const base = i >= 0 ? dernier.slice(0, i + 1) : '';
    const debut = dernier.slice(i + 1);
    const lieu = this.trouver(base || '.');
    if (!lieu || lieu.type !== 'dossier') return null;
    const noms = Object.keys(lieu.enfants)
      .filter((n) => n.startsWith(debut) && (debut.startsWith('.') || !n.startsWith('.')))
      .sort();
    return { mots, base, noms, dossiers: new Set(noms.filter((n) => lieu.enfants[n].type === 'dossier')) };
  }

  completer(ligne: string): string {
    const c = this.candidats(ligne);
    if (!c || c.noms.length === 0) return ligne;
    if (c.noms.length > 1) {
      // Comme bash : on complète jusqu'au plus long début commun.
      let commun = c.noms[0];
      for (const n of c.noms) while (!n.startsWith(commun)) commun = commun.slice(0, -1);
      return [...c.mots, c.base + commun].join(' ');
    }
    const suffixe = c.dossiers.has(c.noms[0]) ? '/' : ' ';
    return [...c.mots, c.base + c.noms[0] + suffixe].join(' ');
  }

  /** Les possibilités, quand Tab ne peut pas choisir (bash les montre au deuxième Tab) ; vide sinon. */
  suggestions(ligne: string): string[] {
    const c = this.candidats(ligne);
    if (!c || c.noms.length < 2) return [];
    return c.noms.map((n) => (c.dossiers.has(n) ? `${n}/` : n));
  }

  /** Le nom de la machine dans la langue : l'invite, hostname, les journaux. */
  get nomHote(): string {
    return nomMachine(this.t, this.hote);
  }

  connues(): string[] {
    // La commande qui liste les autres a le nom de la langue (aide en français) ;
    // help, comme le builtin de bash, marche dans toutes les langues.
    return [...this.chapitre.commandes, 'man', 'apropos', 'whatis', 'clear', 'exit', this.t('commande-aide')];
  }


  // man, apropos, whatis : le manuel couvre toutes les commandes du jeu,
  // même celles qu'on n'a pas encore dans ce chapitre (comme sur un vrai
  // système, où le manuel décrit aussi ce qu'on n'a pas le droit de lancer).
  private consulter(cmd: string, reste: string[]): string {
    const toutes = Object.entries(COMMANDES).filter(([n]) => n !== 'aide').sort(([a], [b]) => a.localeCompare(b));
    const pasEncore = (n: string) => (this.connues().includes(n) ? '' : '\n\n' + this.t('manuel-pas-encore'));
    if (cmd === 'apropos' || (cmd === 'man' && reste[0] === '-k')) {
      const mot = cmd === 'apropos' ? reste[0] : reste[1];
      if (!mot) return this.erreur(this.t('manuel-quoi-chercher', { commande: cmd === 'apropos' ? 'apropos' : 'man -k' }));
      const lignes = apropos(mot, toutes.map(([n]) => n), this.t);
      return lignes.length ? lignes.join('\n') : this.erreur(this.t('manuel-rien', { mot }));
    }
    if (!reste.length)
      return this.erreur(cmd === 'man' ? this.t('manuel-quelle-page') : this.t('manuel-quoi-chercher', { commande: 'whatis' }));
    const sorties: string[] = [];
    for (const nom of reste) {
      const c = COMMANDES[nom];
      if (!c || nom === 'aide') {
        this.erreur(cmd === 'man' ? this.t('manuel-pas-de-page', { commande: nom }) : this.t('manuel-rien', { mot: nom }));
        continue;
      }
      sorties.push(cmd === 'man' ? pageMan(nom, c, this.t) + pasEncore(nom) : ligneWhatis(nom, this.t));
    }
    return sorties.join(cmd === 'man' ? '\n\n' : '\n');
  }

  // ——— Exécution ———

  // Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ».
  // Si sudo attend un mot de passe, la ligne est ce mot de passe.
  executer(ligne: string): string | null {
    if (this.attente) return this.motDePasse(ligne);
    if (this.question) {
      const { repondre } = this.question;
      this.question = null;
      return this.conclure(repondre(ligne.trim()), true);
    }
    const mots = decouper(ligne);
    if (!mots.length) return '';
    this.commandesTapees++;
    this.ligneCommande = ligne.trim();
    // Quelques clins d'œil de la culture du terminal : une réponse, et un succès caché.
    const oeuf = OEUFS[ligne.trim().replace(/\s+/g, ' ')];
    if (oeuf) {
      if (oeuf.succes) this.oeufs.add(oeuf.succes);
      return this.t(oeuf.texte);
    }
    if (mots.length === 1 && mots[0].texte === 'clear' && !mots[0].cite) return null;
    // exit est intégré au shell : la console ferme la session.
    if (mots[0].texte === 'exit' && !mots[0].cite && mots.length <= 2) {
      // Dans tmux, exit ferme le shell de la session (et la session avec), pas la connexion.
      if (this.tmux) {
        delete (this.etat.tmux as Record<string, unknown>)[this.tmux];
        this.tmux = null;
        return '[exited]';
      }
      // Le shell du mode secours : exit reprend le démarrage (voir fstab.ts).
      const secours = this.etat.continuerDemarrage as ((j: Shell) => string) | undefined;
      if (this.etat.secours && secours) return this.conclure(secours(this), true);
      this.sortie = true;
      return '';
    }
    // sudo demande le mot de passe avant de lancer quoi que ce soit.
    const avecSudo = mots.some((m, i) => !m.cite && m.texte === 'sudo' && (i === 0 || mots[i - 1].op === '|'));
    // Une erreur dans la politique de sudo (un fichier de /etc/sudoers.d écrit sans visudo) : sudo refuse tout.
    if (avecSudo && this.connues().includes('sudo') && this.existe(SUDOERS)) {
      const { erreur } = lireSudoers(this);
      if (erreur) {
        this.statut = 1;
        return [
          `${erreur.fichier}:${erreur.ligne}:${erreur.colonne}: ${this.t(erreur.cle)}`,
          erreur.texte,
          `${' '.repeat(erreur.colonne - 1)}^${'~'.repeat(erreur.longueur - 1)}`,
          this.t('sudo-sources-invalides'),
        ].join('\n');
      }
    }
    if (avecSudo && this.connues().includes('sudo') && !this.authentifie) {
      this.attente = { ligne, essais: 0 };
      const sermon = this.sermonFait ? '' : this.t('sudo-sermon');
      this.sermonFait = true;
      return sermon;
    }
    this.chapitre.avantCommande?.(this);
    return this.conclure(this.compterLigne(this.tube(ligne, mots)), true);
  }

  // Une ligne finie en erreur (un message d'erreur, ou un code de retour non nul) compte pour le bilan.
  private compterLigne(sortie: string): string {
    if (this.erreurs.length || (this.statut ?? 0) !== 0) this.commandesEnErreur++;
    return sortie;
  }

  /** Le mot de passe du joueur ou de la joueuse, dans la langue (tournesol → sunflower, voir mots-de-passe.ftl). */
  motDePasseDuJoueur(): string | undefined {
    const m = this.chapitre.motDePasse;
    return m && motDePasse(this.t, m);
  }

  private motDePasse(saisie: string): string {
    const attente = this.attente!;
    if (saisie === this.motDePasseDuJoueur()) {
      this.attente = null;
      this.authentifie = true;
      this.chapitre.avantCommande?.(this);
      return this.conclure(this.compterLigne(this.tube(attente.ligne, decouper(attente.ligne))), true);
    }
    attente.essais++;
    if (attente.essais < 3) return this.t('sudo-mauvais-mot-de-passe');
    this.attente = null;
    return this.t('sudo-trois-echecs');
  }

  /**
   * Lance une ligne de commande comme le ferait cron : depuis la maison, sans
   * événements de l'histoire ; renvoie tout ce qu'elle a écrit (sortie et
   * erreurs), que cron enverrait par courrier.
   */
  executerTache(ligne: string): string {
    const cwd = this.cwd;
    this.cwd = this.maison;
    try {
      return this.tube(ligne, decouper(ligne));
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
  sousCommande(ligne: string, cwd: string): { sortie: string; ok: boolean; code: number; cwd: string } {
    const avant = { cwd: this.cwd, erreurs: this.erreurs, derniere: this.derniere };
    this.cwd = cwd;
    try {
      const sortie = this.tube(ligne, decouper(ligne));
      const code = this.statut ?? (this.erreurs.length ? 1 : 0);
      return { sortie, ok: code === 0, code, cwd: this.cwd };
    } finally {
      this.cwd = avant.cwd;
      this.erreurs = avant.erreurs;
      this.derniere = avant.derniere;
    }
  }

  /** Vérifie les événements de l'histoire hors d'une commande (ex. à la reconnexion). */
  evenements(): string {
    return this.conclure('', false);
  }

  private conclure(sortie: string, compte: boolean): string {
    const suite = compte ? this.chapitre.apresCommande?.(this) : undefined;
    return [sortie, suite ? this.prose(suite) : '', ...this.verifierEvenements()].filter(Boolean).join('\n\n');
  }

  // Un texte de l'histoire (événement, remarque) : paragraphes et typographie.
  private prose(texte: string): string {
    return typographie(nettoyer(texte), this.t.langue);
  }

  // Une ligne complète : commandes reliées par des tubes, redirection finale.
  private tube(ligne: string, mots: Mot[]): string {
    this.erreurs = [];
    this.statut = null;
    const segments: Mot[][] = [[]];
    let redirection: { fichier: string; ajout: boolean } | null = null;
    for (let i = 0; i < mots.length; i++) {
      const m = mots[i];
      if (m.op === '|') segments.push([]);
      else if (m.op === '>' || m.op === '>>') {
        const cible = mots[i + 1];
        if (!cible || cible.op) return this.t('syntaxe-redirection', { operateur: m.op });
        redirection = { fichier: cible.texte, ajout: m.op === '>>' };
        i++;
      } else segments.at(-1)!.push(m);
    }
    if (segments.some((s) => !s.length)) return this.t('syntaxe-tube');

    let entree: string | null = null;
    const commandes: string[][] = [];
    segments.forEach((segment, i) => {
      // Comme le shell : les jokers ne sont pas développés entre guillemets.
      let args = segment.flatMap((m) => (m.cite ? [m.texte] : this.developper(m.texte)));
      let root = false;
      // sudo -u compte : agir sous ce compte plutôt que root.
      let comme = 'root';
      // sudo -l : c'est sudo lui-même qui répond (la liste des commandes permises).
      if (args[0] === 'sudo' && /^-l+$/.test(args[1] ?? '')) args = ['sudo', ...args.slice(1)];
      else if (args[0] === 'sudo') {
        args = args.slice(1);
        root = true;
        if (args[0] === '-u') {
          comme = args[1] ?? '';
          args = args.slice(2);
          if (!this.comptes.utilisateurs[comme]) {
            this.erreur(this.t('sudo-compte-inconnu', { compte: comme }));
            entree = '';
            return;
          }
        }
      }
      commandes.push(args);
      const dernier = i === segments.length - 1 && !redirection;
      this.comme = comme;
      this.sortieVers = i === segments.length - 1 && redirection ? this.resoudre(redirection.fichier) : null;
      entree = this.lancer(args, entree, root, dernier);
      this.sortieVers = null;
    });
    let sortie: string = entree ?? '';
    // Les événements lisent la sortie telle qu'on la lit, sans les codes de couleur.
    this.derniere = { ligne, commandes, sortie: sansCouleurs(sortie), erreurs: this.erreurs, redirection: redirection ? this.resoudre(redirection.fichier) : null };

    if (redirection) {
      // La redirection est faite par TON shell, avant sudo : même avec sudo
      // devant la commande, c'est « vous » qui écrit dans le fichier.
      const erreur = this.rediriger(redirection.fichier, sortie, redirection.ajout);
      if (erreur) {
        this.erreur(erreur);
        if (/(^|\|)\s*sudo\s/.test(ligne)) this.erreur(this.t('redirection-sudo'));
      }
      sortie = '';
    }
    return [...this.erreurs, sortie].filter(Boolean).join('\n');
  }

  private rediriger(fichier: string, texte: string, ajout: boolean): string | null {
    const n = this.trouver(fichier);
    if (n?.type === 'dossier') return this.t('redirection-est-un-dossier', { cible: fichier });
    if (n) {
      if (this.lectureSeule(fichier)) return this.t('erreur-lecture-seule', { commande: 'bash', cible: fichier });
      if (!this.traverse(fichier) || !this.peut(n, 'w')) return this.t('redirection-permission', { cible: fichier });
      const avant = contenu(n, this);
      n.contenu = ajout && avant ? `${avant}\n${texte}` : texte;
      n.lignes = true;
      delete n.taille;
      return null;
    }
    return this.placer('bash', fichier, { type: 'fichier', contenu: texte, proprio: this.qui, lignes: true });
  }

  // Lance une commande. `dernier` : sa sortie s'affiche à l'écran (sinon elle
  // part dans un tube ou un fichier).
  private lancer(args: string[], entree: string | null, root: boolean, dernier: boolean): string {
    // Dans un tube, c'est le code de la dernière commande qui compte.
    this.statut = null;
    const [brut, ...reste] = args;
    // /usr/bin/rsnapshot, /bin/ls… : le chemin complet d'une commande du jeu
    // (et /usr/lib/nagios/plugins/check_disk pour celles qui sont hors du PATH).
    const nomSeul = brut?.split('/').at(-1) ?? '';
    const horsPath = COMMANDES[nomSeul]?.dossier;
    const cmd =
      brut && ((/^\/(usr\/)?s?bin\/[\w.-]+$/.test(brut) && COMMANDES[nomSeul] && !horsPath) || (horsPath && brut === `${horsPath}/${nomSeul}`))
        ? nomSeul
        : brut;
    if (cmd && COMMANDES[cmd]?.dossier && cmd === brut) return this.erreur(this.t('commande-introuvable', { commande: cmd }));
    if (!cmd) return '';
    if (root && !this.connues().includes('sudo')) return this.erreur(this.t('sudo-pas-encore'));
    // Vrai comportement : cd est intégré au shell, ce n'est pas un programme.
    if (root && cmd === 'cd') return this.erreur(this.t('sudo-cd'));
    if (cmd === 'help' || cmd === this.t('commande-aide')) return this.t('aide-commandes', { commandes: this.connues().join(', ') });
    if (cmd === 'man' || cmd === 'apropos' || cmd === 'whatis') return this.consulter(cmd, reste);
    // Un chemin (./deployer.sh, /srv/site/deployer.sh) : un script, s'il est exécutable.
    if (cmd.includes('/')) {
      const n = this.trouver(cmd);
      if (!n) return this.erreur(this.t('script-introuvable', { commande: cmd }));
      if (n.type === 'dossier') return this.erreur(this.t('script-dossier', { commande: cmd }));
      if (!this.traverse(cmd) || !this.peut(n, 'x') || !this.peut(n, 'r')) return this.erreur(this.t('script-permission', { commande: cmd }));
      const avant = this.qui;
      if (root) this.qui = this.comme;
      try {
        return lancerScript(this, cmd, reste);
      } finally {
        this.qui = avant;
      }
    }
    // Une page de manuel de fichier (section 5, ex. sshd_config) n'est pas une commande.
    const commande: Commande | undefined = COMMANDES[cmd]?.section === 5 ? undefined : COMMANDES[cmd];
    // Sur une machine interne d'une histoire, un programme absent l'est vraiment (bash, code 127).
    if (this.parent && !this.connues().includes(cmd)) {
      const sortie = this.erreur(`-bash: ${cmd}: command not found`);
      this.statut = 127;
      return sortie;
    }
    if (!this.connues().includes(cmd) || !commande)
      return this.erreur(this.t(commande || cmd === 'sudo' ? 'commande-pas-encore' : 'commande-introuvable', { commande: cmd }));
    // Un programme reçoit ses arguments dans une zone limitée (ARG_MAX, 2 Mio
    // sous Linux) : un joker qui donne des dizaines de milliers de noms
    // dépasse. echo, intégré au shell, n'a pas cette limite.
    if (!INTEGRES.includes(cmd) && args.reduce((t, a) => t + a.length + 1, 0) > ARG_MAX) {
      this.etat.argumentsTropLongs = (this.etat.argumentsTropLongs ?? 0) + 1;
      return this.erreur(this.t(root ? 'sudo-liste-arguments-trop-longue' : 'liste-arguments-trop-longue', { programme: `/usr/bin/${cmd}` }));
    }
    // Les réflexes d'auto-dépannage : --help et les options inconnues.
    if (reste.includes('--help')) return aide(cmd, commande, this.t);
    const invalide = optionInvalide(cmd, commande, reste, this.t);
    if (invalide) return this.erreur(invalide);
    // --all → -a : la commande ne lit que ses options courtes.
    const options = commande.propresOptions ? reste : raccourcir(commande, reste);
    const avant = this.qui;
    if (root) this.qui = this.comme;
    try {
      return commande.lancer({ args: options, entree, jeu: this, dernier });
    } finally {
      this.qui = avant;
    }
  }

  // ——— Éditeur (nano) ———

  /**
   * Écrit le texte de l'éditeur dans le fichier, avec les droits de celui ou
   * celle qui l'a ouvert (root sous sudo) ; renvoie le message de nano.
   * Les événements de l'histoire sont vérifiés, et leurs messages gardés pour
   * la fermeture de l'éditeur.
   */
  enregistrerEdition(texte: string): string {
    const e = this.edition!;
    const avant = this.qui;
    if (e.root) this.qui = 'root';
    try {
      const n = this.trouver(e.chemin);
      const lignes = texte === '' ? 0 : texte.replace(/\n$/, '').split('\n').length;
      if (n?.type === 'fichier') {
        if (!this.traverse(e.chemin) || !this.peut(n, 'w')) return this.t('nano-erreur-ecriture', { chemin: e.chemin });
        n.contenu = texte.replace(/\n$/, '');
        n.lignes = true;
        delete n.taille;
      } else {
        const erreur = this.placer('nano', e.chemin, { type: 'fichier', contenu: texte.replace(/\n$/, ''), proprio: this.qui, lignes: true });
        if (erreur) return this.t(this.trouver(e.chemin + '/..') ? 'nano-erreur-ecriture' : 'nano-erreur-dossier', { chemin: e.chemin });
      }
      e.texte = texte;
      const suite = this.conclure('', true);
      if (suite) this.enAttente.push(suite);
      return this.t('nano-lignes-ecrites', { lignes });
    } finally {
      this.qui = avant;
    }
  }

  /** Ferme l'éditeur ; renvoie les messages de l'histoire en attente. */
  quitterEdition(): string {
    const apres = this.edition?.apres?.() ?? '';
    const conclure = this.edition?.conclure;
    this.edition = null;
    // Ce que la fermeture a changé (ex. une crontab installée) compte comme une commande.
    const suite = apres || conclure ? this.conclure('', true) : '';
    const messages = [apres, ...this.enAttente, suite].filter(Boolean).join('\n\n');
    this.enAttente = [];
    return messages;
  }

  private verifierEvenements(): string[] {
    const messages: string[] = [];
    for (const e of this.chapitre.evenements) {
      if (this.drapeaux.has(e.id) || !e.condition(this)) continue;
      this.drapeaux.add(e.id);
      this.franchies[e.id] = this.ligneCommande;
      e.action?.(this);
      if (!this.examen || e.id === this.chapitre.final) {
        messages.push(this.prose(typeof e.message === 'function' ? e.message(this) : e.message));
        this.journal.push(messages.at(-1)!);
      }
      if (e.id === this.chapitre.final) this.termine = true;
    }
    return messages;
  }
}
