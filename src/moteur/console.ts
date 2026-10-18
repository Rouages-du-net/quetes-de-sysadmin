// La console : ce que voit la joueuse ou le joueur. Elle part du poste
// (poste.ts) et ouvre une session sur la machine d'une histoire quand ssh
// réussit ; exit la referme et ramène au poste. Chaque machine fait tourner
// le chapitre en cours de son histoire. Finir l'Effaceur donne les clés SSH
// des autres machines : on les apprend en jouant.

import { Shell } from './shell';
import { HISTOIRES } from './chapitres';
import { f, type Chapitre, type Histoire } from './monde';
import { MACHINES, type Machine } from './machines';
import { fichiersCle, poste } from './poste';
import { traducteur, type Langue, type Traduire } from '../textes';

export interface OptionsConsole {
  langue?: Langue;
  /** Chapitres déjà terminés (identifiants). */
  termines?: string[];
  /** Contenu sauvegardé de ~/.ssh/known_hosts. */
  hotesConnus?: string;
}

// L'histoire à finir pour recevoir les autres clés.
const PREMIERE = 'effaceur';

export class Console {
  t: Traduire;
  termines: string[];
  poste: Shell;
  distant: { machine: Machine; histoire: Histoire; shell: Shell } | null = null;
  // Les machines gardent leur état tant que la partie est ouverte : se
  // reconnecter retrouve le chapitre là où on l'a laissé.
  private sessions = new Map<string, Shell>();

  constructor(private options: OptionsConsole = {}) {
    this.t = traducteur(options.langue);
    this.termines = [...(options.termines ?? [])];
    this.poste = this.nouveauPoste();
  }

  private nouveauPoste(hotesConnus = this.options.hotesConnus): Shell {
    const cles = MACHINES.filter((m) => this.ouverte(m.histoire!));
    const s = new Shell(poste(cles), this.t.langue, 'poste');
    // ssh demande au serveur d'en face sa configuration appliquée (sshd).
    s.etat.sshdDistant = (nom: string) => this.sessions.get(nom)?.etat.sshd?.charge ?? null;
    if (hotesConnus) s.placer('ssh', '~/.ssh/known_hosts', f(hotesConnus, { lignes: true }));
    return s;
  }

  /** Remet le poste à neuf, en gardant les hôtes connus. */
  reinitialiserPoste(): string {
    this.poste = this.nouveauPoste(this.hotesConnus());
    return this.poste.executer(`cat ${this.poste.chapitre.accueil}`) ?? '';
  }

  /** Une histoire est ouverte si l'on a sa clé : la première, puis toutes une fois celle-ci finie. */
  ouverte(histoire: string): boolean {
    if (histoire === PREMIERE) return true;
    return HISTOIRES.find((h) => h.id === PREMIERE)!.chapitres.every((c) => this.termines.includes(c.id));
  }

  hotesConnus(): string {
    return this.poste.lire('~/.ssh/known_hosts') ?? '';
  }

  get shell(): Shell {
    return this.distant?.shell ?? this.poste;
  }

  invite(): string {
    return this.shell.invite();
  }

  completer(ligne: string): string {
    return this.shell.completer(ligne);
  }

  titre(h: Histoire, c: Chapitre): string {
    const histoire = this.t(`histoire-${h.id}`);
    const titre = h.chapitres.length > 1 ? this.t('chapitre-titre-complet', { histoire, numero: c.numero, titre: this.t(`chapitre-${c.id}`) }) : histoire;
    return `— ${titre} —`;
  }

  /** Le premier chapitre pas encore terminé d'une histoire (ou le dernier). */
  chapitreCourant(h: Histoire): Chapitre {
    return h.chapitres.find((c) => !this.termines.includes(c.id)) ?? h.chapitres.at(-1)!;
  }

  /**
   * Ouvre une session sur une machine ; renvoie la bannière et le début du
   * chapitre. Sans chapitre imposé, reprend la session laissée sur cette
   * machine si elle est toujours sur le chapitre en cours.
   */
  connecter(nom: string, chapitre?: Chapitre): string {
    const machine = MACHINES.find((m) => m.nom === nom)!;
    const histoire = HISTOIRES.find((h) => h.id === machine.histoire)!;
    const c = chapitre ?? this.chapitreCourant(histoire);
    const banniere = [`Linux ${machine.nom} 6.12.0-quetes #1 SMP x86_64 GNU/Linux`, this.t(`machine-${machine.nom}-motd`)];
    const ancienne = this.sessions.get(nom);
    if (!chapitre && ancienne && (ancienne.chapitre === c || !ancienne.termine)) {
      // Comme une nouvelle connexion : on repart de sa maison. Se reconnecter
      // peut être un objectif (ex. vérifier qu'on ne s'est pas enfermé dehors).
      ancienne.cwd = ancienne.maison;
      ancienne.etat.connexions = (ancienne.etat.connexions ?? 1) + 1;
      this.distant = { machine, histoire, shell: ancienne };
      const dejaFini = ancienne.termine;
      const suite = ancienne.evenements();
      return [...banniere, this.titre(histoire, ancienne.chapitre), suite, this.noterFin(ancienne, dejaFini)].filter(Boolean).join('\n\n');
    }
    this.distant = { machine, histoire, shell: this.nouvelleSession(machine, c) };
    return [...banniere, this.ouvrirChapitre(c)].join('\n\n');
  }

  /** (Re)commence un chapitre sur la machine où l'on est. */
  ouvrir(chapitre: Chapitre): string {
    this.distant!.shell = this.nouvelleSession(this.distant!.machine, chapitre);
    return this.ouvrirChapitre(chapitre);
  }

  private nouvelleSession(machine: Machine, chapitre: Chapitre): Shell {
    const s = new Shell(chapitre, this.t.langue, machine.nom);
    this.sessions.set(machine.nom, s);
    return s;
  }

  private ouvrirChapitre(c: Chapitre): string {
    return [this.titre(this.distant!.histoire, c), this.distant!.shell.executer(`cat ${c.accueil}`) ?? ''].join('\n\n');
  }

  deconnecter(): string {
    const { machine } = this.distant!;
    this.distant = null;
    return `logout\nConnection to ${machine.domaine} closed.`;
  }

  // Les clés des histoires qui viennent de s'ouvrir, posées dans ~/.ssh du poste.
  private donnerCles(avant: string[]): string {
    const nouvelles = MACHINES.filter((m) => this.ouverte(m.histoire!) && !avant.includes(m.histoire!));
    if (!nouvelles.length) return '';
    const ssh = this.poste.trouver('~/.ssh');
    if (ssh?.type === 'dossier') for (const m of nouvelles) Object.assign(ssh.enfants, fichiersCle(m));
    return this.t('poste-cles-recues', { cles: nouvelles.map((m) => `~/.ssh/id_${m.nom}`).join(', ') });
  }

  /** Exécute une ligne ; renvoie le texte à afficher, ou null pour « clear ». */
  executer(ligne: string): string | null {
    const sh = this.shell;
    const dejaFini = sh.termine;
    const sortie = sh.executer(ligne);
    if (sortie === null) return null;
    const morceaux = [sortie];
    if (sh.sortie) {
      sh.sortie = false;
      morceaux.push(this.distant ? this.deconnecter() : this.t('poste-exit'));
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
    }
    morceaux.push(this.noterFin(sh, dejaFini));
    if (sh.edition) this.finiAvantEdition = sh.termine;
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
    return [sh.quitterEdition(), this.noterFin(sh, this.finiAvantEdition)].filter(Boolean).join('\n\n');
  }
}

