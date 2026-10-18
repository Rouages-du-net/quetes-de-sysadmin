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

import { nettoyer, type Chapitre, type Dossier, type Noeud } from './monde';
import { COMMANDES, type Commande } from './commandes';
import { aide, apropos, ligneWhatis, optionInvalide, pageMan } from './commandes/manuel';

export { decouper, appliquerMode } from './outils';
import { contenu, decouper, joker, tailleDe, type Mot } from './outils';

// Ce que le jeu (les chapitres et les commandes) peut consulter ou modifier.
export interface Jeu {
  racine: Dossier;
  cwd: string;
  drapeaux: Set<string>;
  maison: string;
  etat: Record<string, any>;
  // Utilisateur qui agit pour la commande en cours : « vous », ou « root » sous sudo.
  qui: string;
  // La dernière ligne exécutée (pour les événements) : commandes du tube,
  // sortie produite (avant redirection), fichier de redirection.
  derniere: { ligne: string; commandes: string[][]; sortie: string; erreurs: string[]; redirection: string | null };
  trouver(chemin: string): Noeud | null;
  existe(chemin: string): boolean;
  lire(chemin: string): string | null;
  compter(lieu: string, prefixe: string): number;
  effacer(chemin: string): void;
  peut(n: Noeud, droit: 'r' | 'w' | 'x', utilisateur?: string): boolean;
}

// Message que sudo affiche la première fois qu'on l'utilise (traduit).
const SERMON = `Nous espérons que vous avez reçu les instructions habituelles de l'administrateur système local. Cela se résume généralement à ces trois choses :

    #1) Respectez la vie privée des autres.
    #2) Réfléchissez avant de taper.
    #3) De grands pouvoirs confèrent de grandes responsabilités.`;


export class Shell implements Jeu {
  racine: Dossier;
  cwd: string;
  maison: string;
  drapeaux = new Set<string>();
  etat: Record<string, any>;
  termine = false;
  qui = 'vous';
  derniere: Jeu['derniere'] = { ligne: '', commandes: [], sortie: '', erreurs: [], redirection: null };
  // sudo : mot de passe déjà donné ? ligne en attente du mot de passe ?
  private authentifie = false;
  private sermonFait = false;
  attente: { ligne: string; essais: number } | null = null;
  // Sortie d'erreur et remarques de la ligne en cours.
  private erreurs: string[] = [];

  constructor(public chapitre: Chapitre) {
    this.racine = chapitre.creerMonde();
    this.maison = chapitre.maison;
    this.cwd = chapitre.maison;
    this.etat = chapitre.etat?.() ?? {};
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

  trouver(chemin: string): Noeud | null {
    let n: Noeud = this.racine;
    for (const p of this.resoudre(chemin).split('/').filter(Boolean)) {
      if (n.type !== 'dossier' || !Object.hasOwn(n.enfants, p)) return null;
      n = n.enfants[p];
    }
    return n;
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

  // Permissions Unix simplifiées : on ne gère pas les groupes (tu n'es dans
  // le groupe de personne), seulement le propriétaire et « les autres ».
  // root a tous les droits.
  peut(n: Noeud, droit: 'r' | 'w' | 'x', utilisateur = this.qui): boolean {
    if (utilisateur === 'root') return true;
    const mode = n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--');
    const triplet = (n.proprio ?? 'vous') === utilisateur ? mode.slice(0, 3) : mode.slice(6, 9);
    return triplet.includes(droit);
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

  // Droit d'écrire dans le lieu qui contient ce chemin (créer, effacer, déplacer).
  ecritDans(chemin: string): boolean {
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
    if (!n) return this.erreur(`${cmd} : ${cible} : aucun fichier ou dossier de ce nom`), null;
    if (n.type === 'dossier') return this.erreur(`${cmd} : ${cible} : est un dossier`), null;
    const raison = this.blocage(cible);
    if (raison) return this.erreur(raison), null;
    if (!this.traverse(cible) || !this.peut(n, 'r')) return this.erreur(`${cmd} : ${cible} : Permission non accordée`), null;
    if (n.archive) return this.erreur(`${cmd} : ${cible} : fichier binaire (une archive : pour voir ce qu'elle contient, tar -tf ${cible})`), null;
    return contenu(n, this);
  }

  // Place un nœud dans un lieu (création, copie, déplacement), en vérifiant
  // les droits et la place disponible sur le support. Renvoie une erreur.
  placer(cmd: string, chemin: string, n: Noeud): string | null {
    const parent = this.trouver(chemin + '/..');
    if (parent?.type !== 'dossier') return `${cmd} : ${chemin} : aucun fichier ou dossier de ce nom`;
    const raison = this.blocage(chemin + '/..');
    if (raison) return raison;
    if (!this.ecritDans(chemin)) return `${cmd} : impossible de créer '${chemin}' : Permission non accordée`;
    const nom = this.nom(chemin);
    const ancien = parent.enfants[nom];
    if (this.placeManquante(this.resoudre(chemin), n, ancien)) return `${cmd} : erreur d'écriture : Aucun espace disponible sur le périphérique`;
    parent.enfants[nom] = n;
    return null;
  }

  // Taille d'un nœud en octets (un lieu : la somme de son contenu).
  taille(n: Noeud): number {
    if (n.type === 'fichier') return tailleDe(n, this);
    return Object.values(n.enfants).reduce((t, e) => t + this.taille(e), 0);
  }

  // Les supports montés (clé USB…) ont une capacité : etat.montages.
  montage(absolu: string): { chemin: string; capacite: number } | null {
    const montages: { chemin: string; capacite: number }[] = this.etat.montages ?? [];
    return montages.find((m) => absolu === m.chemin || absolu.startsWith(m.chemin + '/')) ?? null;
  }

  private placeManquante(absolu: string, n: Noeud, ancien?: Noeud): boolean {
    const m = this.montage(absolu);
    if (!m) return false;
    const lieu = this.trouver(m.chemin);
    const utilise = lieu ? this.taille(lieu) : 0;
    return utilise - (ancien ? this.taille(ancien) : 0) + this.taille(n) > m.capacite;
  }

  // ——— Sorties ———

  erreur(message: string): '' {
    this.erreurs.push(message);
    return '';
  }

  invite(): string {
    if (this.attente) return '[sudo] Mot de passe de vous :';
    const ici =
      this.cwd === this.maison ? '~' : this.cwd.startsWith(this.maison + '/') ? '~' + this.cwd.slice(this.maison.length) : this.cwd;
    return `vous@sysadmin:${ici}$`;
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
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .map((n) => base + n);
    return trouves.length ? trouves : [mot];
  }

  // Complétion par Tab du dernier mot.
  completer(ligne: string): string {
    const mots = ligne.split(' ');
    const dernier = mots.pop() ?? '';
    const avant = mots.filter(Boolean);
    if (avant.length === 0 || avant.at(-1) === 'sudo' || avant.at(-1) === '|') {
      const cmds = this.connues().filter((c) => c.startsWith(dernier));
      return cmds.length === 1 ? [...mots, cmds[0] + ' '].join(' ') : ligne;
    }
    const i = dernier.lastIndexOf('/');
    const base = i >= 0 ? dernier.slice(0, i + 1) : '';
    const debut = dernier.slice(i + 1);
    const lieu = this.trouver(base || '.');
    if (!lieu || lieu.type !== 'dossier') return ligne;
    const choix = Object.keys(lieu.enfants).filter(
      (n) => n.startsWith(debut) && (debut.startsWith('.') || !n.startsWith('.')),
    );
    if (choix.length === 0) return ligne;
    if (choix.length > 1) {
      // Comme bash : on complète jusqu'au plus long début commun.
      let commun = choix[0];
      for (const c of choix) while (!c.startsWith(commun)) commun = commun.slice(0, -1);
      return [...mots, base + commun].join(' ');
    }
    const suffixe = lieu.enfants[choix[0]].type === 'dossier' ? '/' : ' ';
    return [...mots, base + choix[0] + suffixe].join(' ');
  }

  connues(): string[] {
    return [...this.chapitre.commandes, 'man', 'apropos', 'whatis', 'clear', 'aide'];
  }

  manuel(cmd: string): string | null {
    return this.connues().includes(cmd) ? (COMMANDES[cmd]?.manuel ?? null) : null;
  }

  // man, apropos, whatis : le manuel couvre toutes les commandes du jeu,
  // même celles qu'on n'a pas encore dans ce chapitre (comme sur un vrai
  // système, où le manuel décrit aussi ce qu'on n'a pas le droit de lancer).
  private consulter(cmd: string, reste: string[]): string {
    const toutes = Object.entries(COMMANDES).filter(([n]) => n !== 'aide').sort(([a], [b]) => a.localeCompare(b));
    const pasEncore = (n: string) => (this.connues().includes(n) ? '' : '\n\n(Tu n’as pas encore cette commande dans ce chapitre.)');
    if (cmd === 'apropos' || (cmd === 'man' && reste[0] === '-k')) {
      const mot = cmd === 'apropos' ? reste[0] : reste[1];
      if (!mot) return this.erreur(`${cmd === 'apropos' ? 'apropos' : 'man -k'} : que faut-il chercher ?`);
      const lignes = apropos(mot, toutes);
      return lignes.length ? lignes.join('\n') : this.erreur(`${mot} : rien d'approprié.`);
    }
    if (!reste.length)
      return this.erreur(cmd === 'man' ? 'Quelle page de manuel voulez-vous ?\nPar exemple, essayez « man man ».' : 'whatis : que faut-il chercher ?');
    const sorties: string[] = [];
    for (const nom of reste) {
      const c = COMMANDES[nom];
      if (!c || nom === 'aide') {
        this.erreur(cmd === 'man' ? `Il n'y a pas de page de manuel pour ${nom}.` : `${nom} : rien d'approprié.`);
        continue;
      }
      sorties.push(cmd === 'man' ? pageMan(nom, c) + pasEncore(nom) : ligneWhatis(nom, c));
    }
    return sorties.join(cmd === 'man' ? '\n\n' : '\n');
  }

  // ——— Exécution ———

  // Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ».
  // Si sudo attend un mot de passe, la ligne est ce mot de passe.
  executer(ligne: string): string | null {
    if (this.attente) return this.motDePasse(ligne);
    const mots = decouper(ligne);
    if (!mots.length) return '';
    if (mots.length === 1 && mots[0].texte === 'clear' && !mots[0].cite) return null;
    // sudo demande le mot de passe avant de lancer quoi que ce soit.
    const avecSudo = mots.some((m, i) => !m.cite && m.texte === 'sudo' && (i === 0 || mots[i - 1].op === '|'));
    if (avecSudo && this.connues().includes('sudo') && !this.authentifie) {
      this.attente = { ligne, essais: 0 };
      const sermon = this.sermonFait ? '' : SERMON;
      this.sermonFait = true;
      return sermon;
    }
    return this.conclure(this.tube(ligne, mots), true);
  }

  private motDePasse(saisie: string): string {
    const attente = this.attente!;
    if (saisie === this.chapitre.motDePasse) {
      this.attente = null;
      this.authentifie = true;
      return this.conclure(this.tube(attente.ligne, decouper(attente.ligne)), true);
    }
    attente.essais++;
    if (attente.essais < 3) return 'Désolé, essayez de nouveau.';
    this.attente = null;
    return 'sudo : 3 saisies de mots de passe incorrectes';
  }

  private conclure(sortie: string, compte: boolean): string {
    const suite = compte ? this.chapitre.apresCommande?.(this) : undefined;
    return [sortie, suite ? nettoyer(suite) : '', ...this.verifierEvenements()].filter(Boolean).join('\n\n');
  }

  // Une ligne complète : commandes reliées par des tubes, redirection finale.
  private tube(ligne: string, mots: Mot[]): string {
    this.erreurs = [];
    const segments: Mot[][] = [[]];
    let redirection: { fichier: string; ajout: boolean } | null = null;
    for (let i = 0; i < mots.length; i++) {
      const m = mots[i];
      if (m.op === '|') segments.push([]);
      else if (m.op === '>' || m.op === '>>') {
        const cible = mots[i + 1];
        if (!cible || cible.op) return 'erreur de syntaxe : il manque un nom de fichier après ' + m.op;
        redirection = { fichier: cible.texte, ajout: m.op === '>>' };
        i++;
      } else segments.at(-1)!.push(m);
    }
    if (segments.some((s) => !s.length)) return 'erreur de syntaxe près du symbole « | »';

    let entree: string | null = null;
    const commandes: string[][] = [];
    segments.forEach((segment, i) => {
      // Comme le shell : les jokers ne sont pas développés entre guillemets.
      let args = segment.flatMap((m) => (m.cite ? [m.texte] : this.developper(m.texte)));
      let root = false;
      if (args[0] === 'sudo') {
        args = args.slice(1);
        root = true;
      }
      commandes.push(args);
      const dernier = i === segments.length - 1 && !redirection;
      entree = this.lancer(args, entree, root, dernier);
    });
    let sortie: string = entree ?? '';
    this.derniere = { ligne, commandes, sortie, erreurs: this.erreurs, redirection: redirection ? this.resoudre(redirection.fichier) : null };

    if (redirection) {
      // La redirection est faite par TON shell, avant sudo : même avec sudo
      // devant la commande, c'est « vous » qui écrit dans le fichier.
      const erreur = this.rediriger(redirection.fichier, sortie, redirection.ajout);
      if (erreur) {
        this.erreur(erreur);
        if (/(^|\|)\s*sudo\s/.test(ligne))
          this.erreur(
            '(La redirection > est faite par ton propre shell, pas par sudo. Astuce : envoie le texte dans « sudo tee -a fichier », qui écrit en tant que root.)',
          );
      }
      sortie = '';
    }
    return [...this.erreurs, sortie].filter(Boolean).join('\n');
  }

  private rediriger(fichier: string, texte: string, ajout: boolean): string | null {
    const n = this.trouver(fichier);
    if (n?.type === 'dossier') return `${fichier} : est un dossier`;
    if (n) {
      if (!this.traverse(fichier) || !this.peut(n, 'w')) return `${fichier} : Permission non accordée`;
      const avant = contenu(n, this);
      n.contenu = ajout && avant ? `${avant}\n${texte}` : texte;
      n.lignes = true;
      delete n.taille;
      return null;
    }
    const erreur = this.placer('bash', fichier, { type: 'fichier', contenu: texte, proprio: this.qui, lignes: true });
    return erreur ? erreur.replace(/^bash : impossible de créer '[^']*' : /, `${fichier} : `) : null;
  }

  // Lance une commande. `dernier` : sa sortie s'affiche à l'écran (sinon elle
  // part dans un tube ou un fichier).
  private lancer(args: string[], entree: string | null, root: boolean, dernier: boolean): string {
    const [cmd, ...reste] = args;
    if (!cmd) return '';
    if (root && !this.connues().includes('sudo')) return this.erreur(`sudo : tu n’as pas encore cette commande dans ce chapitre.`);
    // Vrai comportement : cd est intégré au shell, ce n'est pas un programme.
    if (root && cmd === 'cd')
      return this.erreur(
        'sudo : cd : commande introuvable\n(cd fait partie du shell lui-même, sudo ne peut pas le lancer. Avec sudo, on regarde et on agit à distance : sudo ls lieu, sudo cat fichier…)',
      );
    if (cmd === 'help' || cmd === 'aide')
      return `Commandes connues : ${this.connues().join(', ')}.\nPour en savoir plus : « man commande » (le manuel complet), « commande --help » (un résumé), « man -k mot » (trouver une commande par mot-clé).`;
    if (cmd === 'man' || cmd === 'apropos' || cmd === 'whatis') return this.consulter(cmd, reste);
    const commande: Commande | undefined = COMMANDES[cmd];
    if (!this.connues().includes(cmd) || !commande)
      return this.erreur(
        commande || cmd === 'sudo'
          ? `${cmd} : tu n’as pas encore cette commande dans ce chapitre. Tape « aide » pour la liste.`
          : `${cmd} : commande introuvable. Tape « aide » pour la liste.`,
      );
    // Les réflexes d'auto-dépannage : --help et les options inconnues.
    if (reste.includes('--help')) return aide(cmd, commande);
    const invalide = optionInvalide(cmd, commande, reste);
    if (invalide) return this.erreur(invalide);
    const avant = this.qui;
    if (root) this.qui = 'root';
    try {
      return commande.lancer({ args: reste, entree, jeu: this, dernier });
    } finally {
      this.qui = avant;
    }
  }

  private verifierEvenements(): string[] {
    const messages: string[] = [];
    for (const e of this.chapitre.evenements) {
      if (this.drapeaux.has(e.id) || !e.condition(this)) continue;
      this.drapeaux.add(e.id);
      e.action?.(this);
      messages.push(nettoyer(typeof e.message === 'function' ? e.message(this) : e.message));
      if (e.id === this.chapitre.final) this.termine = true;
    }
    return messages;
  }
}
