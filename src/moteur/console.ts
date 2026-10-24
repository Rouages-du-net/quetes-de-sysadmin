// La console : ce que voit la joueuse ou le joueur. Elle part du poste
// (poste.ts) et ouvre une session sur la machine d'une histoire quand ssh
// réussit ; exit la referme et ramène au poste. Chaque machine fait tourner
// le chapitre en cours de son histoire. Finir l'Effaceur donne les clés SSH
// des autres machines : on les apprend en jouant.

import { Shell } from './shell';
import { HISTOIRES } from './chapitres';
import { ouverte, PREMIERE } from './deverrouillage';
import { f, joueur, type Chapitre, type Histoire } from './monde';
import { MACHINES, POSTE, type Machine } from './machines';
import { config as configSsh, fichiersCle, poste } from './poste';
import { etatPort, type EtatPort } from './ports';
import { bannisPour, type EtatFail2ban } from './fail2ban';
import { noterTmux } from './commandes/tmux';
import { LANGUES, traducteur, type Langue, type Traduire } from '../textes';

export interface OptionsConsole {
  langue?: Langue;
  /** Chapitres déjà terminés (identifiants). */
  termines?: string[];
  /** Contenu sauvegardé de ~/.ssh/known_hosts. */
  hotesConnus?: string;
  /** Les fichiers de ~/.ssh créés par la joueuse ou le joueur (clés, config), et les phrases de passe. */
  ssh?: { fichiers: Record<string, string>; phrases?: Record<string, string> };
}


type Saisie = { ligne: string } | { enregistrer: string } | { quitter: true };

export class Console {
  // L'écran montre les couleurs des sorties (réglage de l'interface) ; voir couleurs.ts.
  couleurs = false;

  // L'instantané de secours : ce qu'on a saisi depuis l'ouverture du chapitre
  // (commandes, réponses, enregistrements de nano). Le moteur est
  // déterministe : rouvrir le chapitre et rejouer les n premières saisies
  // redonne exactement la machine d'alors. null : plus rejouable (on est
  // revenu au poste, ou on a repris une session laissée plus tôt). `serie`
  // change à chaque ouverture de chapitre (pas à une restauration) : un
  // instantané n'est valable que dans sa série.
  private saisies: Saisie[] | null = null;
  serie = 0;
  private enRestauration = false;
  t: Traduire;
  termines: string[];
  poste: Shell;
  distant: { machine: Machine; histoire: Histoire; shell: Shell } | null = null;
  // Les sessions ouvertes depuis la machine de l'histoire, vers son réseau
  // interne (la dernière est celle où l'on tape) ; `retour` : ouverte avec
  // ssh -J depuis le poste, exit ramène directement au poste.
  interieur: { shell: Shell; domaine: string; retour: boolean }[] = [];
  // Les machines gardent leur état tant que la partie est ouverte : se
  // reconnecter retrouve le chapitre là où on l'a laissé.
  private sessions = new Map<string, Shell>();
  // Les machines où l'on s'est connecté·e pendant cette partie (le plan du réseau les marque).
  visitees = new Set<string>(['poste']);

  constructor(private options: OptionsConsole = {}) {
    this.t = traducteur(options.langue);
    this.termines = [...(options.termines ?? [])];
    this.poste = this.nouveauPoste();
  }

  private nouveauPoste(hotesConnus = this.options.hotesConnus): Shell {
    const cles = MACHINES.filter((m) => this.ouverte(m.histoire!) && !m.sansCle);
    const s = new Shell(poste(cles), this.t.langue, 'poste');
    // ssh demande au serveur d'en face sa configuration appliquée (sshd).
    // (celui du chapitre qu'ouvrirait la connexion : un chapitre peut commencer avec SSH sur un autre port).
    s.etat.sshdDistant = (nom: string) => this.sessionDe(nom).etat.sshd?.charge ?? null;
    // … et son pare-feu (ufw), qui peut bloquer la connexion avant même sshd.
    s.etat.pareFeuDistant = (nom: string) => this.sessions.get(nom)?.etat.ufw ?? null;
    // … et les adresses que son fail2ban a bannies (pour ce port, s'il est donné : la prison ne bloque que les siens).
    s.etat.bannisDistant = (nom: string, port?: number): string[] => {
      const f2b: EtatFail2ban | undefined = this.sessions.get(nom)?.etat.fail2ban;
      if (!f2b) return [];
      return port === undefined ? f2b.bannis : bannisPour(f2b, port);
    };
    // … et l'état d'un de ses ports, vu d'ici (nc -zv machine port).
    s.etat.portDistant = (nom: string, port: number): EtatPort => etatPort(this.sessionDe(nom), port, false, POSTE.adresse);
    // … et sa clé d'hôte, qui change quand la machine a été réinstallée.
    s.etat.cleDistante = (nom: string): string => this.chapitreDeConnexion(nom).cleHote ?? '';
    // … et la session elle-même (ssh -J, scp, ssh-copy-id, sur les machines qui gèrent leurs clés).
    s.etat.sessionDistante = (nom: string): Shell => this.sessionDe(nom);
    if (hotesConnus) s.placer('ssh', '~/.ssh/known_hosts', f(hotesConnus, { lignes: true }));
    // Les clés créées et la config modifiée, gardées d'une visite à l'autre.
    // La sauvegarde sert à toutes les langues : une config restée celle du jeu
    // (dans n'importe quelle langue) laisse la place à celle de la partie, et
    // une config modifiée se connecte avec le compte de la langue (User vous → you).
    const dejaDonnees = LANGUES.map((l) => configSsh(traducteur(l)));
    const comptes = LANGUES.map((l) => joueur(traducteur(l)));
    for (const [nom, sauve] of Object.entries(this.options.ssh?.fichiers ?? {})) {
      if (nom === 'config' && dejaDonnees.includes(sauve.trim())) continue;
      const contenu =
        nom === 'config'
          ? sauve.replace(/^(\s*User\s+)(\S+)(\s*)$/gim, (ligne, debut: string, compte: string, fin: string) =>
              comptes.includes(compte) ? `${debut}${joueur(this.t)}${fin}` : ligne,
            )
          : sauve;
      const ancien = s.trouver(`~/.ssh/${nom}`);
      const prive = /^id_/.test(nom) && !nom.endsWith('.pub');
      if (ancien?.type === 'fichier') ancien.contenu = contenu;
      else s.placer('ssh', `~/.ssh/${nom}`, f(contenu, { lignes: true, mode: prive ? 'rw-------' : 'rw-r--r--' }));
    }
    if (this.options.ssh?.phrases) s.etat.phrasesDePasse = { ...this.options.ssh.phrases };
    return s;
  }

  /** Ce qu'il faut garder de ~/.ssh du poste : ce que la joueuse ou le joueur a créé ou modifié. */
  ssh(): { fichiers: Record<string, string>; phrases?: Record<string, string> } {
    const dossier = this.poste.trouver('~/.ssh');
    const donnees = new Set(MACHINES.filter((m) => !m.sansCle).flatMap((m) => [`id_${m.nom}`, `id_${m.nom}.pub`]));
    const fichiers: Record<string, string> = {};
    if (dossier?.type === 'dossier')
      for (const nom of Object.keys(dossier.enfants))
        if (nom !== 'known_hosts' && !donnees.has(nom) && dossier.enfants[nom].type === 'fichier')
          fichiers[nom] = this.poste.lire(`~/.ssh/${nom}`) ?? '';
    // La config que le jeu a donnée, pas modifiée : rien à garder.
    if (fichiers.config?.trim() === configSsh(this.t)) delete fichiers.config;
    return { fichiers, phrases: this.poste.etat.phrasesDePasse };
  }

  /** Remet le poste à neuf, en gardant les hôtes connus. */
  reinitialiserPoste(): string {
    this.poste = this.nouveauPoste(this.hotesConnus());
    return this.poste.executer(`cat ${this.poste.accueil}`) ?? '';
  }

  /** Une histoire est ouverte si l'on a sa clé : la première d'emblée, les autres peu à peu (deverrouillage.ts). */
  ouverte(histoire: string): boolean {
    return ouverte(histoire, this.termines);
  }

  hotesConnus(): string {
    return this.poste.lire('~/.ssh/known_hosts') ?? '';
  }

  get shell(): Shell {
    return this.interieur.at(-1)?.shell ?? this.distant?.shell ?? this.poste;
  }

  invite(): string {
    return this.shell.invite();
  }

  completer(ligne: string): string {
    return this.shell.completer(ligne);
  }

  titre(h: Histoire, c: Chapitre): string {
    const histoire = this.t(`histoire-${h.id}`);
    const titre =
      h.chapitres.length > 1 ? this.t('chapitre-titre-complet', { histoire, numero: c.numero, titre: this.t(`chapitre-${c.id}`) }) : histoire;
    return `— ${titre} —`;
  }

  /** Le premier chapitre pas encore terminé d'une histoire (ou le dernier). */
  chapitreCourant(h: Histoire): Chapitre {
    return h.chapitres.find((c) => !this.termines.includes(c.id)) ?? h.chapitres.at(-1)!;
  }

  // La session d'une machine : celle qui existe, sinon une neuve, sur le
  // chapitre que trouverait une connexion (pour tester ses ports de loin).
  private sessionDe(nom: string): Shell {
    const ancienne = this.sessions.get(nom);
    const chapitre = this.chapitreDeConnexion(nom);
    if (ancienne?.chapitre === chapitre) return ancienne;
    const s = this.nouvelleSession(MACHINES.find((m) => m.nom === nom)!, chapitre);
    s.etat.preparee = true;
    return s;
  }

  // Le chapitre que trouvera une connexion à cette machine (voir connecter).
  private chapitreDeConnexion(nom: string): Chapitre {
    const machine = MACHINES.find((m) => m.nom === nom)!;
    const c = this.chapitreCourant(HISTOIRES.find((h) => h.id === machine.histoire)!);
    const ancienne = this.sessions.get(nom);
    return ancienne && (ancienne.chapitre === c || !ancienne.termine) ? ancienne.chapitre : c;
  }

  /**
   * Ouvre une session sur une machine ; renvoie la bannière et le début du
   * chapitre. Sans chapitre imposé, reprend la session laissée sur cette
   * machine si elle est toujours sur le chapitre en cours.
   */
  connecter(nom: string, chapitre?: Chapitre, rebond = false, port = 22): string {
    this.interieur = [];
    const machine = MACHINES.find((m) => m.nom === nom)!;
    const histoire = HISTOIRES.find((h) => h.id === machine.histoire)!;
    const c = chapitre ?? this.chapitreCourant(histoire);
    const ancienne = this.sessions.get(nom);
    // La bannière donne le noyau qui tourne (celui de la session, s'il en a un).
    const noyau = (ancienne?.etat.noyau as { courant: string } | undefined)?.courant ?? '6.12.0-quetes';
    const banniere = [`Linux ${machine.nom} ${noyau} #1 SMP x86_64 GNU/Linux`, this.t(`machine-${machine.nom}-motd`)];
    // Une session créée de loin (un port testé avec nc) : la première vraie
    // connexion ouvre le chapitre, avec son texte d'accueil.
    if (!chapitre && ancienne?.etat.preparee && ancienne.chapitre === c) {
      delete ancienne.etat.preparee;
      ancienne.etat.portSession = port;
      this.distant = { machine, histoire, shell: ancienne };
      return [...(rebond ? [] : banniere), this.ouvrirChapitre(c)].join('\n\n');
    }
    if (!chapitre && ancienne && (ancienne.chapitre === c || !ancienne.termine)) {
      // Comme une nouvelle connexion : on repart de sa maison. Se reconnecter
      // peut être un objectif (ex. vérifier qu'on ne s'est pas enfermé dehors).
      ancienne.cwd = ancienne.maison;
      ancienne.etat.connexions = (ancienne.etat.connexions ?? 1) + 1;
      // Le port de la connexion (ss la montre ; la session survit à un changement de port de sshd).
      ancienne.etat.portSession = port;
      this.distant = { machine, histoire, shell: ancienne };
      const dejaFini = ancienne.termine;
      // Une session reprise : on ne sait plus ce qui y a été tapé, l'instantané n'est plus possible.
      this.saisies = null;
      const suite = ancienne.evenements();
      // Un chapitre en cours : rappeler où relire ses consignes.
      const rappel = ancienne.termine ? '' : this.t('reprise-chapitre', { fichier: ancienne.accueil });
      // Un simple rebond (ssh -J) n'ouvre pas de session sur la passerelle : ni bannière ni rappel.
      const entete = rebond ? [] : [...banniere, this.titre(histoire, ancienne.chapitre), rappel];
      return [...entete, suite, this.noterFin(ancienne, dejaFini)].filter(Boolean).join('\n\n');
    }
    this.distant = { machine, histoire, shell: this.nouvelleSession(machine, c) };
    this.distant.shell.etat.portSession = port;
    return [...(rebond ? [] : banniere), this.ouvrirChapitre(c)].join('\n\n');
  }

  /** (Re)commence un chapitre sur la machine où l'on est. */
  ouvrir(chapitre: Chapitre): string {
    this.interieur = [];
    this.distant!.shell = this.nouvelleSession(this.distant!.machine, chapitre);
    return this.ouvrirChapitre(chapitre);
  }

  // Mode examen : pas d'indice dans les chapitres (les sessions ouvertes le suivent aussi).
  private _examen = false;
  get examen(): boolean {
    return this._examen;
  }
  set examen(oui: boolean) {
    this._examen = oui;
    for (const s of this.sessions.values()) s.examen = oui;
  }

  private nouvelleSession(machine: Machine, chapitre: Chapitre): Shell {
    const s = new Shell(chapitre, this.t.langue, machine.nom);
    this.visitees.add(machine.nom);
    s.examen = this.examen;
    // Le chapitre peut regarder le poste (sa config ssh, ce qu'on y a copié).
    s.etat.poste = () => this.poste;
    this.sessions.set(machine.nom, s);
    return s;
  }

  private ouvrirChapitre(c: Chapitre): string {
    this.saisies = [];
    if (!this.enRestauration) this.serie++;
    return [this.titre(this.distant!.histoire, c), this.distant!.shell.executer(`cat ${this.distant!.shell.accueil}`) ?? ''].join('\n\n');
  }

  deconnecter(): string {
    const { machine } = this.distant!;
    this.distant = null;
    this.interieur = [];
    return `logout\nConnection to ${machine.domaine} closed.`;
  }

  // exit sur une machine interne : on revient d'un cran (ou au poste, après ssh -J).
  private quitterInterieur(): string {
    const e = this.interieur.pop()!;
    const message = `logout\nConnection to ${e.domaine} closed.`;
    if (e.retour) {
      this.interieur = [];
      this.distant = null;
    }
    return message;
  }

  // Une session sur une machine interne (ssh depuis la machine de l'histoire, ou ssh -J depuis le poste).
  private ouvrirInterieur(d: { shell: Shell; domaine: string; via?: string }): string {
    const morceaux: string[] = [];
    const depuisPoste = !this.distant || !!d.via;
    // ssh -J depuis le poste : la machine de l'histoire s'ouvre (son chapitre commence s'il le faut).
    if (d.via && this.distant?.machine.nom !== d.via) morceaux.push(this.connecter(d.via, undefined, true));
    d.shell.cwd = d.shell.maison;
    this.interieur.push({ shell: d.shell, domaine: d.domaine, retour: depuisPoste && !!d.via });
    this.visitees.add(d.shell.hote);
    morceaux.push(`Linux ${d.shell.hote} 6.12.0-quetes #1 SMP x86_64 GNU/Linux`);
    return morceaux.join('\n\n');
  }

  // Les clés des histoires qui viennent de s'ouvrir, posées dans ~/.ssh du poste.
  private donnerCles(avant: string[]): string {
    const nouvelles = MACHINES.filter((m) => this.ouverte(m.histoire!) && !avant.includes(m.histoire!) && !m.sansCle);
    if (!nouvelles.length) return '';
    const ssh = this.poste.trouver('~/.ssh');
    if (ssh?.type === 'dossier') for (const m of nouvelles) Object.assign(ssh.enfants, fichiersCle(this.t, m));
    // La première vague (après La Racine) explique où trouver les clés ; les suivantes les annoncent.
    const premiere = !avant.some((h) => h !== PREMIERE);
    return this.t(premiere ? 'poste-cles-recues' : 'poste-cles-recues-suite', { cles: nouvelles.map((m) => `~/.ssh/id_${m.nom}`).join(', ') });
  }

  /** Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ». */
  executer(ligne: string): string | null {
    const sh = this.shell;
    sh.couleurs = this.couleurs;
    // Une saisie sur la machine du chapitre (ou ses machines internes) se rejoue ; une saisie sur le poste, non.
    if (this.distant) this.saisies?.push({ ligne });
    else this.saisies = null;
    const dejaFini = sh.termine;
    // Dans tmux, ce qui s'affiche reste dans la session (pour tmux attach).
    const tmuxAvant = sh.tmux;
    const invite = sh.invite();
    const avant = { tapees: sh.commandesTapees, erreurs: sh.commandesEnErreur };
    const sortie = sh.executer(ligne);
    // Sur une machine interne, les commandes comptent pour le bilan du chapitre (voir bilan.ts).
    if (sh.parent) {
      sh.principal.commandesTapees += sh.commandesTapees - avant.tapees;
      sh.principal.commandesEnErreur += sh.commandesEnErreur - avant.erreurs;
      sh.principal.ligneCommande = sh.ligneCommande;
    }
    if (sortie === null) return null;
    if (tmuxAvant && sh.tmux === tmuxAvant) noterTmux(sh, tmuxAvant, [`${invite.trimEnd()} ${ligne}`, sortie].filter(Boolean).join('\n'));
    const morceaux = [sortie];
    if (sh.coupure && this.distant) {
      // Le réseau a coupé : la connexion tombe (ce qui tourne dans tmux, lui, continue).
      sh.coupure = false;
      sh.tmux = null;
      this.interieur = [];
      this.distant = null;
      morceaux.push('client_loop: send disconnect: Broken pipe');
    } else if (sh.sortie) {
      sh.sortie = false;
      morceaux.push(this.interieur.length ? this.quitterInterieur() : this.distant ? this.deconnecter() : this.t('poste-exit'));
    } else if (sh.redemarrage && this.distant) {
      // La machine redémarre : le serveur coupe la connexion.
      sh.redemarrage = false;
      const { domaine } = this.distant.machine;
      this.distant = null;
      morceaux.push(`Connection to ${domaine} closed by remote host.\nConnection to ${domaine} closed.`);
    } else if (sh.demandeConnexion) {
      const nom = sh.demandeConnexion;
      sh.demandeConnexion = null;
      morceaux.push(this.connecter(nom, undefined, false, sh.etat.portConnexion ?? 22));
    } else if (sh.demandeSession) {
      const d = sh.demandeSession;
      sh.demandeSession = null;
      morceaux.push(this.ouvrirInterieur(d));
    }
    // Sur une machine interne : les événements du chapitre se vérifient sur la machine de l'histoire.
    const principal = sh.parent ? sh.principal : null;
    if (principal) {
      const avant = principal.termine;
      morceaux.push(principal.evenements(), this.noterFin(principal, avant));
    }
    morceaux.push(this.noterFin(sh, dejaFini));
    if (sh === this.poste) morceaux.push(this.surveillerPoste());
    if (sh.edition) this.finiAvantEdition = sh.termine;
    if (!this.distant) this.saisies = null;
    return morceaux.filter(Boolean).join('\n\n');
  }

  // Après une commande sur le poste : les chapitres qui le regardent vérifient leurs événements.
  private surveillerPoste(): string {
    const morceaux: string[] = [];
    for (const s of this.sessions.values())
      if (s.chapitre.surveillePoste && !s.termine) {
        // Une étape franchie depuis le poste : le bilan note la commande tapée sur le poste.
        s.ligneCommande = this.poste.ligneCommande;
        morceaux.push(s.evenements(), this.noterFin(s, false));
      }
    return morceaux.filter(Boolean).join('\n\n');
  }

  // Un chapitre vient de se terminer : progression, et clés éventuelles.
  private noterFin(sh: Shell, dejaFini: boolean): string {
    if (dejaFini || !sh.termine || sh === this.poste) return '';
    const ouvertes = HISTOIRES.filter((h) => this.ouverte(h.id)).map((h) => h.id);
    if (!this.termines.includes(sh.chapitre.id)) this.termines.push(sh.chapitre.id);
    return this.donnerCles(ouvertes);
  }

  // ——— L'instantané de secours ———

  /** Le nombre de saisies rejouables depuis l'ouverture du chapitre ; null : pas d'instantané possible. */
  get pas(): number | null {
    return this.distant ? (this.saisies?.length ?? null) : null;
  }

  /**
   * Rouvre le chapitre en cours et rejoue ses n premières saisies, sans rien
   * afficher : la machine revient exactement à cet instant. Les indices déjà
   * demandés restent comptés. Renvoie false si ce n'est pas possible.
   */
  restaurer(n: number): boolean {
    const avant = this.saisies;
    if (!this.distant || !avant || n < 0 || n > avant.length) return false;
    const ancienne = this.distant.shell;
    this.enRestauration = true;
    try {
      this.ouvrir(ancienne.chapitre);
      for (const s of avant.slice(0, n)) {
        if ('ligne' in s) this.executer(s.ligne);
        else if ('enregistrer' in s) this.enregistrer(s.enregistrer);
        else this.quitterEdition();
      }
    } finally {
      this.enRestauration = false;
    }
    for (const i of ancienne.indicesDemandes) this.distant?.shell.indicesDemandes.add(i);
    return true;
  }

  // ——— Éditeur (nano), sur la machine où l'on est ———

  private finiAvantEdition = false;

  get edition() {
    return this.shell.edition;
  }

  /** ^O : écrit le fichier ; renvoie le message de nano, et si c'est écrit. */
  enregistrer(texte: string): { message: string; ecrit: boolean } {
    if (this.distant) this.saisies?.push({ enregistrer: texte });
    else this.saisies = null;
    const message = this.shell.enregistrerEdition(texte);
    return { message, ecrit: this.shell.edition?.texte === texte };
  }

  /** ^X : ferme l'éditeur ; renvoie les messages de l'histoire déclenchés. */
  quitterEdition(): string {
    if (this.distant) this.saisies?.push({ quitter: true });
    else this.saisies = null;
    const sh = this.shell;
    const principal = sh.parent ? sh.principal : null;
    const avant = principal?.termine ?? false;
    const morceaux = [sh.quitterEdition(), this.noterFin(sh, this.finiAvantEdition)];
    // Un fichier écrit sur une machine interne peut finir le chapitre.
    if (principal) morceaux.push(principal.evenements(), this.noterFin(principal, avant));
    if (sh === this.poste) morceaux.push(this.surveillerPoste());
    return morceaux.filter(Boolean).join('\n\n');
  }
}
