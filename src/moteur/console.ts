// La console : ce que voit la joueuse ou le joueur. Elle part du poste
// (poste.ts) et ouvre une session sur la machine d'une histoire quand ssh
// réussit ; exit la referme et ramène au poste. Chaque machine fait tourner
// le chapitre en cours de son histoire. Finir l'Effaceur donne les clés SSH
// des autres machines : on les apprend en jouant.

import { Shell } from './shell';
import { HISTOIRES } from './chapitres';
import { f, type Chapitre, type Histoire } from './monde';
import { MACHINES, POSTE, type Machine } from './machines';
import { fichiersCle, poste } from './poste';
import { etatPort, type EtatPort } from './ports';
import { noterTmux } from './commandes/tmux';
import { traducteur, type Langue, type Traduire } from '../textes';

export interface OptionsConsole {
  langue?: Langue;
  /** Chapitres déjà terminés (identifiants). */
  termines?: string[];
  /** Contenu sauvegardé de ~/.ssh/known_hosts. */
  hotesConnus?: string;
  /** Les fichiers de ~/.ssh créés par la joueuse ou le joueur (clés, config), et les phrases de passe. */
  ssh?: { fichiers: Record<string, string>; phrases?: Record<string, string> };
}

// L'histoire à finir pour recevoir les autres clés.
const PREMIERE = 'effaceur';
// Le chapitre qui donne les clés : la fin de l'histoire d'origine (les
// chapitres ajoutés ensuite ne doivent pas reprendre les clés déjà données).
const CHAPITRE_DES_CLES = 'racine';

export class Console {
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

  constructor(private options: OptionsConsole = {}) {
    this.t = traducteur(options.langue);
    this.termines = [...(options.termines ?? [])];
    this.poste = this.nouveauPoste();
  }

  private nouveauPoste(hotesConnus = this.options.hotesConnus): Shell {
    const cles = MACHINES.filter((m) => this.ouverte(m.histoire!) && !m.sansCle);
    const s = new Shell(poste(cles), this.t.langue, 'poste');
    // ssh demande au serveur d'en face sa configuration appliquée (sshd).
    s.etat.sshdDistant = (nom: string) => this.sessions.get(nom)?.etat.sshd?.charge ?? null;
    // … et son pare-feu (ufw), qui peut bloquer la connexion avant même sshd.
    s.etat.pareFeuDistant = (nom: string) => this.sessions.get(nom)?.etat.ufw ?? null;
    // … et les adresses que son fail2ban a bannies.
    s.etat.bannisDistant = (nom: string): string[] => this.sessions.get(nom)?.etat.fail2ban?.bannis ?? [];
    // … et l'état d'un de ses ports, vu d'ici (nc -zv machine port).
    s.etat.portDistant = (nom: string, port: number): EtatPort => etatPort(this.sessionDe(nom), port, false, POSTE.adresse);
    // … et sa clé d'hôte, qui change quand la machine a été réinstallée.
    s.etat.cleDistante = (nom: string): string => this.chapitreDeConnexion(nom).cleHote ?? '';
    // … et la session elle-même (ssh -J, scp, ssh-copy-id, sur les machines qui gèrent leurs clés).
    s.etat.sessionDistante = (nom: string): Shell => this.sessionDe(nom);
    if (hotesConnus) s.placer('ssh', '~/.ssh/known_hosts', f(hotesConnus, { lignes: true }));
    // Les clés créées et la config modifiée, gardées d'une visite à l'autre.
    for (const [nom, contenu] of Object.entries(this.options.ssh?.fichiers ?? {})) {
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
    return { fichiers, phrases: this.poste.etat.phrasesDePasse };
  }

  /** Remet le poste à neuf, en gardant les hôtes connus. */
  reinitialiserPoste(): string {
    this.poste = this.nouveauPoste(this.hotesConnus());
    return this.poste.executer(`cat ${this.poste.chapitre.accueil}`) ?? '';
  }

  /** Une histoire est ouverte si l'on a sa clé : la première, puis toutes une fois celle-ci finie. */
  ouverte(histoire: string): boolean {
    if (histoire === PREMIERE) return true;
    return this.termines.includes(CHAPITRE_DES_CLES);
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
  connecter(nom: string, chapitre?: Chapitre, rebond = false): string {
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
      this.distant = { machine, histoire, shell: ancienne };
      return [...(rebond ? [] : banniere), this.ouvrirChapitre(c)].join('\n\n');
    }
    if (!chapitre && ancienne && (ancienne.chapitre === c || !ancienne.termine)) {
      // Comme une nouvelle connexion : on repart de sa maison. Se reconnecter
      // peut être un objectif (ex. vérifier qu'on ne s'est pas enfermé dehors).
      ancienne.cwd = ancienne.maison;
      ancienne.etat.connexions = (ancienne.etat.connexions ?? 1) + 1;
      this.distant = { machine, histoire, shell: ancienne };
      const dejaFini = ancienne.termine;
      const suite = ancienne.evenements();
      // Un chapitre en cours : rappeler où relire ses consignes.
      const rappel = ancienne.termine ? '' : this.t('reprise-chapitre', { fichier: ancienne.chapitre.accueil });
      // Un simple rebond (ssh -J) n'ouvre pas de session sur la passerelle : ni bannière ni rappel.
      const entete = rebond ? [] : [...banniere, this.titre(histoire, ancienne.chapitre), rappel];
      return [...entete, suite, this.noterFin(ancienne, dejaFini)].filter(Boolean).join('\n\n');
    }
    this.distant = { machine, histoire, shell: this.nouvelleSession(machine, c) };
    return [...(rebond ? [] : banniere), this.ouvrirChapitre(c)].join('\n\n');
  }

  /** (Re)commence un chapitre sur la machine où l'on est. */
  ouvrir(chapitre: Chapitre): string {
    this.interieur = [];
    this.distant!.shell = this.nouvelleSession(this.distant!.machine, chapitre);
    return this.ouvrirChapitre(chapitre);
  }

  private nouvelleSession(machine: Machine, chapitre: Chapitre): Shell {
    const s = new Shell(chapitre, this.t.langue, machine.nom);
    // Le chapitre peut regarder le poste (sa config ssh, ce qu'on y a copié).
    s.etat.poste = () => this.poste;
    this.sessions.set(machine.nom, s);
    return s;
  }

  private ouvrirChapitre(c: Chapitre): string {
    return [this.titre(this.distant!.histoire, c), this.distant!.shell.executer(`cat ${c.accueil}`) ?? ''].join('\n\n');
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
    morceaux.push(`Linux ${d.shell.hote} 6.12.0-quetes #1 SMP x86_64 GNU/Linux`);
    return morceaux.join('\n\n');
  }

  // Les clés des histoires qui viennent de s'ouvrir, posées dans ~/.ssh du poste.
  private donnerCles(avant: string[]): string {
    const nouvelles = MACHINES.filter((m) => this.ouverte(m.histoire!) && !avant.includes(m.histoire!) && !m.sansCle);
    if (!nouvelles.length) return '';
    const ssh = this.poste.trouver('~/.ssh');
    if (ssh?.type === 'dossier') for (const m of nouvelles) Object.assign(ssh.enfants, fichiersCle(m));
    return this.t('poste-cles-recues', { cles: nouvelles.map((m) => `~/.ssh/id_${m.nom}`).join(', ') });
  }

  /** Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ». */
  executer(ligne: string): string | null {
    const sh = this.shell;
    const dejaFini = sh.termine;
    // Dans tmux, ce qui s'affiche reste dans la session (pour tmux attach).
    const tmuxAvant = sh.tmux;
    const invite = sh.invite();
    const sortie = sh.executer(ligne);
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
      morceaux.push(this.connecter(nom));
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
    return morceaux.filter(Boolean).join('\n\n');
  }

  // Après une commande sur le poste : les chapitres qui le regardent vérifient leurs événements.
  private surveillerPoste(): string {
    const morceaux: string[] = [];
    for (const s of this.sessions.values()) if (s.chapitre.surveillePoste && !s.termine) morceaux.push(s.evenements(), this.noterFin(s, false));
    return morceaux.filter(Boolean).join('\n\n');
  }

  // Un chapitre vient de se terminer : progression, et clés éventuelles.
  private noterFin(sh: Shell, dejaFini: boolean): string {
    if (dejaFini || !sh.termine || sh === this.poste) return '';
    const ouvertes = HISTOIRES.filter((h) => this.ouverte(h.id)).map((h) => h.id);
    if (!this.termines.includes(sh.chapitre.id)) this.termines.push(sh.chapitre.id);
    return this.donnerCles(ouvertes);
  }

  // ——— Éditeur (nano), sur la machine où l'on est ———

  private finiAvantEdition = false;

  get edition() {
    return this.shell.edition;
  }

  /** ^O : écrit le fichier ; renvoie le message de nano, et si c'est écrit. */
  enregistrer(texte: string): { message: string; ecrit: boolean } {
    const message = this.shell.enregistrerEdition(texte);
    return { message, ecrit: this.shell.edition?.texte === texte };
  }

  /** ^X : ferme l'éditeur ; renvoie les messages de l'histoire déclenchés. */
  quitterEdition(): string {
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
