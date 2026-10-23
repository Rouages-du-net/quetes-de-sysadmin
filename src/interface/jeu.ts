// L'interface du jeu : le terminal simulé (une console qui part du poste et
// se connecte en ssh aux machines des histoires), le menu des histoires et
// des chapitres (des raccourcis), la progression gardée dans le navigateur.
// monter() construit tout dans un conteneur (un élément ou la racine
// fantôme d'un composant), sans rien supposer de la page qui l'accueille.

import { Console } from '../moteur/console';
import type { Shell } from '../moteur/shell';
import { HISTOIRES } from '../moteur/chapitres';
import { machineDeHistoire, POSTE } from '../moteur/machines';
import { description, enMarkdown, noter, type Carnet } from '../moteur/carnet';
import { liensRouages } from '../moteur/rouages';
import { carte, type Lieu } from '../moteur/carte';
import { disposer, reperes as reperesPlan, type ElementPlan } from '../moteur/plan';
import { grade, GRADES, nouveauxSucces, SUCCES } from '../moteur/succes';
import { indice, NIVEAUX, type Niveau } from '../moteur/indices';
import { bilan } from '../moteur/bilan';
import { etapesParcours, PARCOURS } from '../moteur/parcours';
import { codeDeProgression, fichierDeSauvegarde, lireCode, lireFichier, nettoyerNom, type Sauvegarde } from '../moteur/progression';
import { colorer, type Jeton } from '../moteur/coloration';
import { morceaux, sansCouleurs } from '../moteur/couleurs';
import { editeur } from './editeur';
import { traducteur, typographie, type Langue } from '../textes';

export interface Options {
  langue?: Langue;
  /** Histoire à ouvrir au départ (identifiant, ex. « datacenter »), même sans sa clé. */
  histoire?: string;
  /** Clé de sauvegarde dans localStorage (à changer si plusieurs jeux partagent un site). */
  cle?: string;
}


function el<K extends keyof HTMLElementTagNameMap>(nom: K, attrs: Record<string, string> = {}, ...enfants: (Node | string)[]) {
  const e = document.createElement(nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...enfants);
  return e;
}

// Les lignes gardées à l'écran pour une seule sortie.
const MAX_LIGNES = 2000;

export function monter(racine: HTMLElement | ShadowRoot, options: Options = {}) {
  const t = traducteur(options.langue);
  const typo = (texte: string) => typographie(texte, t.langue);
  const titreHistoire = (h: number) => t(`histoire-${HISTOIRES[h].id}`);
  const CLE = options.cle ?? 'quetes-de-sysadmin';
  const chapitres = (h: number) => HISTOIRES[h].chapitres;
  // L'affichage (thème, taille, vue du menu, couleurs) : un réglage de ce navigateur seulement.
  const CLE_AFFICHAGE = `${CLE}-affichage`;
  const TAILLES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
  let affichage = { theme: 'phosphore', taille: 2, vue: 'reseau', couleurs: true, parcours: PARCOURS[0].id };
  try {
    affichage = { ...affichage, ...JSON.parse(localStorage.getItem(CLE_AFFICHAGE) ?? '{}') };
  } catch {}

  // ——— Construction ———
  // Le nom et l'adresse de la machine, montrés sur la carte du réseau (des identifiants techniques, jamais traduits).
  const hote = (m: { domaine: string; adresse: string } | undefined) => el('span', { class: 'hote' }, m ? `${m.domaine} ${m.adresse}` : '');
  const boutonsHistoires = HISTOIRES.map((h, i) =>
    el('button', { type: 'button', 'data-histoire': String(i) },
      el('span', { class: 'titre' }, titreHistoire(i)),
      hote(machineDeHistoire(h.id)),
      el('span', { class: 'resume' }, typo(t(`histoire-${h.id}.resume`))),
      el('span', { class: 'etat' }),
      // Une diode par chapitre, comme sur une baie de serveur (l'état en toutes lettres est dans .etat).
      el('span', { class: 'diodes', 'aria-hidden': 'true' }, ...h.chapitres.map(() => el('span', { class: 'diode' })))),
  );
  const boutonPoste = el('button', { type: 'button', 'data-poste': '' }, el('span', { class: 'titre' }, t('poste-titre')), hote(POSTE));
  const aideCle = el('p', { class: 'cle-aide' }, typo(t('cle-aide')));
  // Deux vues du menu : la carte du réseau (le poste, internet, puis une
  // machine par histoire, branchée sur le même câble, qui s'allume à mesure
  // qu'on avance) et les baies (les mêmes boutons, en grille, avec leur
  // résumé). Ce sont les mêmes boutons dans la même liste : seule la mise en
  // page change, et les lecteurs d'écran lisent la même chose.
  const VUES = ['reseau', 'baies', 'parcours'] as const;
  const boutonsVue = Object.fromEntries(
    VUES.map((v) => [v, el('button', { type: 'button', class: 'bouton-vue', 'aria-pressed': 'false', 'data-vue': v }, t(`vue-${v}`))]),
  ) as Record<(typeof VUES)[number], HTMLButtonElement>;
  const choixVue = el('p', { class: 'choix-vue', role: 'group', 'aria-label': t('vue-titre') }, ...VUES.map((v) => boutonsVue[v]));
  const listeHistoires = el(
    'ol',
    {},
    el('li', { class: 'noeud-poste' }, boutonPoste),
    // Internet, entre le poste et les machines : un repère, pas un bouton.
    el('li', { class: 'noeud-internet', 'aria-hidden': 'true' }, el('span', {}, t('vue-internet'))),
    ...boutonsHistoires.map((b, i) => el('li', { class: 'noeud', 'data-cote': i % 2 ? 'droite' : 'gauche' }, b)),
  );
  // La vue « Parcours » : un thème, et ses chapitres pris dans plusieurs histoires (voir parcours.ts).
  const idParcours = `qds-parcours-${Math.random().toString(36).slice(2, 8)}`;
  const choixParcours = el(
    'select',
    { id: idParcours },
    ...PARCOURS.map((p) => el('option', { value: p.id }, t(`parcours-${p.id}`))),
  ) as HTMLSelectElement;
  const parcoursDescription = el('p', { class: 'parcours-description' });
  const parcoursAvancee = el('p', { class: 'parcours-avancee' });
  const listeParcours = el('ol', { class: 'parcours-liste' });
  const blocParcours = el(
    'div',
    { class: 'parcours', hidden: '' },
    el('p', { class: 'parcours-choix' }, el('label', { for: idParcours }, t('parcours-choix')), ' ', choixParcours),
    parcoursDescription,
    parcoursAvancee,
    listeParcours,
  );
  const navHistoires = el('nav', { class: 'histoires', 'aria-label': t('histoires-titre') }, choixVue, listeHistoires, blocParcours, aideCle);

  const navsChapitres = HISTOIRES.map((h, i) =>
    el('nav', { class: 'chapitres', 'aria-label': t('chapitres-titre', { histoire: titreHistoire(i) }), 'data-chapitres': String(i) },
      el('ol', {}, ...h.chapitres.map((c, j) =>
        el('li', {}, el('button', { type: 'button', 'data-chapitre': String(j) },
          el('span', { class: 'num' }, t('chapitre-numero', { numero: c.numero })),
          el('span', { class: 'titre' }, t(`chapitre-${c.id}`)),
          el('span', { class: 'resume' }, typo(t(`chapitre-${c.id}.resume`))),
          el('span', { class: 'etat' })))))),
  );

  // Le mode examen : pas d'indice, un chrono ; la case recommence le chapitre en cours.
  const caseExamen = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const chrono = el('span', { class: 'chrono', role: 'timer' });
  // La carte : un bouton à côté du terminal ouvre, dans une fenêtre, les lieux
  // connus de la machine où l'on est (voir carte.ts).
  const boutonCarte = el('button', { type: 'button', class: 'bouton-carte', 'aria-haspopup': 'dialog' }, t('carte-bouton'));
  // L'affichage du terminal : thème, taille du texte, plein écran (réglages de ce navigateur).
  const THEMES = ['phosphore', 'ambre', 'contraste', 'papier'];
  const choixTheme = el(
    'select',
    { 'aria-label': t('affichage-theme') },
    ...THEMES.map((x) => el('option', { value: x }, t(`affichage-theme-${x}`))),
  ) as HTMLSelectElement;
  const plusPetit = el('button', { type: 'button', class: 'bouton-reglage', 'aria-label': t('affichage-plus-petit') }, 'A−');
  const plusGrand = el('button', { type: 'button', class: 'bouton-reglage', 'aria-label': t('affichage-plus-grand') }, 'A+');
  const boutonFocus = el('button', { type: 'button', class: 'bouton-reglage', 'aria-pressed': 'false' }, t('affichage-focus'));
  const boutonCouleurs = el('button', { type: 'button', class: 'bouton-reglage', 'aria-pressed': 'true' }, t('affichage-couleurs'));
  const reglages = el('span', { class: 'reglages' }, choixTheme, plusPetit, plusGrand, boutonCouleurs, boutonFocus);
  // La mission : l'objectif du chapitre, ses consignes, et ce qui s'est déjà passé.
  const boutonMission = el('button', { type: 'button', class: 'bouton-mission', 'aria-haspopup': 'dialog' }, t('mission-bouton'));
  const barreExamen = el(
    'p',
    { class: 'examen' },
    el('label', {}, caseExamen, el('span', {}, t('examen-case'))),
    chrono,
    el('span', { class: 'outils' }, boutonMission, boutonCarte, reglages),
  );
  const idMission = `qds-mission-${Math.random().toString(36).slice(2, 8)}`;
  const missionTitre = el('h2', { id: idMission });
  const missionObjectif = el('p', { class: 'carte-legende' });
  const missionConsignes = el('pre', { class: 'mission-texte' });
  const missionJournal = el('ol', { class: 'mission-journal' });
  const missionVide = el('p', { class: 'carte-legende' }, typo(t('mission-rien')));
  const fermerMission = el('button', { type: 'button', class: 'bouton' }, t('carte-fermer'));
  // Besoin d'aide ? Trois niveaux, l'un après l'autre (voir indices.ts) ; rien en mode examen.
  const boutonsIndice = Object.fromEntries(
    NIVEAUX.map((n) => [n, el('button', { type: 'button', class: 'bouton-indice', 'data-niveau': n }, t(`indice-bouton-${n}`))]),
  ) as Record<Niveau, HTMLButtonElement>;
  const texteIndice = el('div', { class: 'indice-texte', 'aria-live': 'polite' });
  const aide = el(
    'section',
    { class: 'aide' },
    el('h3', {}, t('indice-titre')),
    el('p', { class: 'carte-legende' }, typo(t('indice-intro'))),
    el('p', { class: 'indice-boutons' }, ...NIVEAUX.map((n) => boutonsIndice[n])),
    texteIndice,
  );
  // L'instantané de secours (voir Console.restaurer) : comme celui d'une machine virtuelle.
  const prendreInstantane = el('button', { type: 'button', class: 'bouton-secours' }, t('secours-prendre'));
  const revenirInstantane = el('button', { type: 'button', class: 'bouton-secours' }, t('secours-revenir'));
  const annulerSaisie = el('button', { type: 'button', class: 'bouton-secours' }, t('secours-annuler'));
  const etatSecours = el('p', { class: 'carte-legende secours-etat', role: 'status' });
  const secours = el(
    'section',
    { class: 'secours' },
    el('h3', {}, t('secours-titre')),
    el('p', { class: 'carte-legende' }, typo(t('secours-intro'))),
    el('p', { class: 'indice-boutons' }, prendreInstantane, revenirInstantane, annulerSaisie),
    etatSecours,
  );
  const fenetreMission = el(
    'dialog',
    { class: 'fenetre-mission', 'aria-labelledby': idMission },
    missionTitre,
    missionObjectif,
    el('h3', {}, t('mission-consignes')),
    missionConsignes,
    el('h3', {}, t('mission-journal')),
    missionVide,
    missionJournal,
    aide,
    secours,
    el('p', { class: 'carte-actions' }, fermerMission),
  ) as HTMLDialogElement;
  const idCarte = `qds-carte-${Math.random().toString(36).slice(2, 8)}`;
  const carteTitre = el('h2', { id: idCarte });
  const carteArbre = el('div', { class: 'carte-arbre' });
  const fermerCarte = el('button', { type: 'button', class: 'bouton' }, t('carte-fermer'));
  // Deux onglets quand l'histoire a un réseau : les lieux de la machine, et le plan du réseau (voir plan.ts).
  const onglet = (suffixe: string, texte: string) =>
    el('button', { type: 'button', role: 'tab', id: `${idCarte}-onglet-${suffixe}`, 'aria-controls': `${idCarte}-${suffixe}` }, texte);
  const ongletLieux = onglet('lieux', t('carte-onglet-lieux'));
  const ongletReseau = onglet('reseau', t('carte-onglet-reseau'));
  const onglets = el('div', { role: 'tablist', class: 'carte-onglets' }, ongletLieux, ongletReseau);
  const panneauLieux = el(
    'div',
    { role: 'tabpanel', id: `${idCarte}-lieux`, 'aria-labelledby': ongletLieux.id },
    el('p', { class: 'carte-legende' }, typo(t('carte-legende'))),
    carteArbre,
  );
  const planSchema = el('div', { class: 'plan-schema' });
  const planListe = el('div', { class: 'carte-arbre' });
  const planTexte = el('details', { class: 'plan-texte' }, el('summary', {}, t('plan-version-texte')), planListe);
  const panneauReseau = el(
    'div',
    { role: 'tabpanel', id: `${idCarte}-reseau`, 'aria-labelledby': ongletReseau.id },
    el('p', { class: 'carte-legende' }, typo(t('plan-legende'))),
    planSchema,
    planTexte,
  );
  const fenetreCarte = el(
    'dialog',
    { class: 'fenetre-carte', 'aria-labelledby': idCarte },
    carteTitre,
    onglets,
    panneauLieux,
    panneauReseau,
    el('p', { class: 'carte-actions' }, fermerCarte),
  ) as HTMLDialogElement;
  const sortie = el('div', { class: 'sortie', role: 'log', 'aria-live': 'polite' });
  const id = `qds-saisie-${Math.random().toString(36).slice(2, 8)}`;
  const invite = el('label', { class: 'invite', for: id });
  const saisie = el('input', {
    id, type: 'text', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
    'aria-label': t('saisie-etiquette'),
  }) as HTMLInputElement;
  // Ctrl-R : la recherche dans l'historique, comme bash ; la commande trouvée s'affiche sous la ligne.
  const trouvee = el('p', { class: 'recherche', 'aria-live': 'polite' });
  // La coloration de la ligne (voir coloration.ts) : une copie colorée du
  // texte, dessinée exactement sous le champ, qui reste un champ ordinaire
  // (clavier, complétion, lecteurs d'écran) au texte rendu transparent.
  const coloration = el('div', { class: 'coloration', 'aria-hidden': 'true' });
  const champ = el('span', { class: 'champ' }, coloration, saisie);
  const form = el('form', { autocomplete: 'off' }, invite, champ, trouvee);
  const terminal = el('div', { class: 'terminal' }, sortie, form);
  const quitterFocus = el('button', { type: 'button', class: 'quitter-focus' }, t('affichage-quitter-focus'));
  // Les touches qui manquent aux claviers des téléphones (affichées sur les écrans tactiles).
  const TOUCHES: [string, string][] = [
    ['Tab', 'Tab'],
    ['↑', 'ArrowUp'],
    ['↓', 'ArrowDown'],
    ['Ctrl-C', 'ctrl-c'],
    ['|', '|'],
    ['~', '~'],
    ['/', '/'],
    ['-', '-'],
    ['.', '.'],
    ['*', '*'],
    ['>', '>'],
  ];
  const barreTouches = el(
    'div',
    { class: 'touches', role: 'toolbar', 'aria-label': t('touches-titre') },
    ...TOUCHES.map(([texte, touche]) =>
      el('button', { type: 'button', 'data-touche': touche, ...(touche.startsWith('Arrow') ? { 'aria-label': t(`touche-${touche === 'ArrowUp' ? 'haut' : 'bas'}`) } : {}) }, texte),
    ),
  );
  const suivant = el('button', { type: 'button', class: 'bouton principal' }, t('bouton-suivant'));
  const fin = el('div', { class: 'fin', hidden: '' }, suivant);
  // Après un chapitre : la page de Les rouages du net qui explique son concept.
  const listeRouages = el('ul', {});
  const pourComprendre = el('aside', { class: 'pour-comprendre', hidden: '' }, el('p', {}, typo(t('rouages-intro'))), listeRouages);
  // Le carnet du sysadmin : les commandes déjà lancées, avec leur ligne du manuel.
  const carnetCompte = el('span', { class: 'compte' });
  const carnetTitre = el('span', {});
  const carnetListe = el('dl', {});
  const carnetVide = el('p', {}, typo(t('carnet-vide')));
  const exporter = el('button', { type: 'button', class: 'lien' }, t('carnet-exporter'));
  const copierCarnet = el('button', { type: 'button', class: 'lien' }, t('carnet-copier'));
  const carnetEtat = el('span', { class: 'carnet-etat', role: 'status' });
  const carnetActions = el('p', { class: 'carnet-actions' }, exporter, ' · ', copierCarnet, ' ', carnetEtat);
  const panneauCarnet = el(
    'details',
    { class: 'carnet' },
    el('summary', {}, carnetTitre, ' ', carnetCompte),
    el('p', { class: 'carnet-aide' }, typo(t('carnet-aide'))),
    carnetVide,
    carnetListe,
    carnetActions,
  );
  const recommencer = el('button', { type: 'button', class: 'lien' }, t('bouton-recommencer'));
  // Ma progression : un nom pour le carnet, et de quoi continuer sur une autre
  // machine (le code court, ou le fichier ; voir progression.ts).
  const boutonProgression = el('button', { type: 'button', class: 'lien', 'aria-haspopup': 'dialog' }, t('progression-bouton'));
  // Les succès et le grade : une fenêtre (voir succes.ts).
  const boutonSucces = el('button', { type: 'button', class: 'lien', 'aria-haspopup': 'dialog' });
  const astuces = el('p', { class: 'astuces' }, typo(t('astuces')), ' ', recommencer, ' · ', boutonProgression, ' · ', boutonSucces);
  const idSucces = `qds-succes-${Math.random().toString(36).slice(2, 8)}`;
  const succesGrade = el('p', { class: 'succes-grade' });
  const succesListe = el('ul', { class: 'succes-liste' });
  const fermerSucces = el('button', { type: 'button', class: 'bouton' }, t('carte-fermer'));
  const fenetreSucces = el(
    'dialog',
    { class: 'fenetre-succes', 'aria-labelledby': idSucces },
    el('h2', { id: idSucces }, t('succes-titre')),
    succesGrade,
    succesListe,
    el('p', { class: 'carte-actions' }, fermerSucces),
  ) as HTMLDialogElement;
  // Le bilan de fin de chapitre : le détail, étape par étape (voir bilan.ts).
  const idBilan = `qds-bilan-${Math.random().toString(36).slice(2, 8)}`;
  const bilanTitre = el('h2', { id: idBilan });
  const bilanResume = el('p', { class: 'carte-legende' });
  const bilanTableau = el('div', { class: 'bilan-tableau', tabindex: '0', role: 'region', 'aria-labelledby': idBilan });
  const bilanEncourager = el('p', { class: 'carte-legende' });
  const fermerBilan = el('button', { type: 'button', class: 'bouton' }, t('carte-fermer'));
  const fenetreBilan = el(
    'dialog',
    { class: 'fenetre-bilan', 'aria-labelledby': idBilan },
    bilanTitre,
    bilanResume,
    el('p', { class: 'carte-legende' }, typo(t('bilan-intro'))),
    bilanTableau,
    bilanEncourager,
    el('p', { class: 'carte-actions' }, fermerBilan),
  ) as HTMLDialogElement;
  const idProgression = `qds-progression-${Math.random().toString(36).slice(2, 8)}`;
  const champNom = el('input', { type: 'text', id: `${idProgression}-nom`, maxlength: '60', autocomplete: 'name', spellcheck: 'false' }) as HTMLInputElement;
  const codeActuel = el('code', { class: 'code-progression' });
  const copierCode = el('button', { type: 'button', class: 'lien' }, t('progression-copier'));
  const champCode = el('input', { type: 'text', id: `${idProgression}-code`, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', placeholder: 'QDS-…' }) as HTMLInputElement;
  const reprendreCode = el('button', { type: 'button', class: 'bouton' }, t('progression-reprendre'));
  const telecharger = el('button', { type: 'button', class: 'bouton' }, t('progression-telecharger'));
  const champFichier = el('input', { type: 'file', id: `${idProgression}-fichier`, accept: '.json,application/json' }) as HTMLInputElement;
  const etatProgression = el('p', { class: 'progression-etat', role: 'status' });
  const fermerProgression = el('button', { type: 'button', class: 'bouton' }, t('carte-fermer'));
  const fenetreProgression = el(
    'dialog',
    { class: 'fenetre-progression', 'aria-labelledby': idProgression },
    el('h2', { id: idProgression }, t('progression-titre')),
    el('p', { class: 'carte-legende' }, typo(t('progression-intro'))),
    el('h3', {}, el('label', { for: champNom.id }, t('progression-nom'))),
    el('p', {}, champNom),
    el('p', { class: 'carte-legende' }, typo(t('progression-nom-aide'))),
    el('h3', {}, t('progression-code-titre')),
    el('p', { class: 'carte-legende' }, typo(t('progression-code-aide'))),
    el('p', {}, codeActuel, ' ', copierCode),
    el('p', { class: 'progression-saisie' }, el('label', { for: champCode.id }, t('progression-code-saisie')), ' ', champCode, ' ', reprendreCode),
    el('h3', {}, t('progression-fichier-titre')),
    el('p', { class: 'carte-legende' }, typo(t('progression-fichier-aide'))),
    el('p', {}, telecharger),
    el('p', { class: 'progression-saisie' }, el('label', { for: champFichier.id }, t('progression-fichier-saisie')), ' ', champFichier),
    etatProgression,
    el('p', { class: 'carte-actions' }, fermerProgression),
  ) as HTMLDialogElement;
  const credit = el('p', { class: 'credit' }, typo(t('credit')), ' ',
    el('a', { href: 'https://github.com/Rouages-du-net/quetes-de-sysadmin' }, t('credit-lien-projet')), ' · ',
    el('a', { href: 'https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html', hreflang: 'en' }, t('credit-lien-original')));

  // Le terminal et sa barre de touches : ensemble en plein écran.
  const ecran = el('div', { class: 'ecran' }, quitterFocus, terminal, barreTouches);
  const jeu = el('div', { class: 'qds', lang: t.langue }, navHistoires, ...navsChapitres, barreExamen, ecran, fin, pourComprendre, panneauCarnet, astuces, credit, fenetreCarte, fenetreProgression, fenetreMission, fenetreSucces, fenetreBilan);
  racine.append(jeu);

  // ——— Progression gardée dans ce navigateur ———
  // Meilleurs temps en mode examen (records, en ms) ; nom mis en tête du carnet (voir progression.ts).
  let sauve: Sauvegarde = {};
  try {
    sauve = JSON.parse(localStorage.getItem(CLE) ?? '{}');
  } catch {}
  const terminalJeu = new Console({ langue: t.langue, termines: sauve.termines, hotesConnus: sauve.connus, ssh: sauve.ssh });
  const termines = terminalJeu.termines;
  const carnet: Carnet = sauve.carnet && typeof sauve.carnet === 'object' ? sauve.carnet : {};
  const records: Record<string, number> = sauve.records && typeof sauve.records === 'object' ? sauve.records : {};
  let nomJoueur = typeof sauve.nom === 'string' ? nettoyerNom(sauve.nom) : '';
  const succes: Record<string, string> = sauve.succes && typeof sauve.succes === 'object' ? { ...sauve.succes } : {};
  terminalJeu.examen = sauve.examen === true;
  caseExamen.checked = terminalJeu.examen;
  // Le début du chapitre en cours, en mode examen (null : pas de chrono).
  let debutExamen: number | null = null;
  // Histoire et chapitre en cours (-1 : sur le poste).
  const histoire = () => (terminalJeu.distant ? HISTOIRES.indexOf(terminalJeu.distant.histoire) : -1);
  const courant = () => (terminalJeu.distant ? terminalJeu.distant.histoire.chapitres.indexOf(terminalJeu.distant.shell.chapitre) : -1);
  const etatSauvegarde = (): Sauvegarde => ({
    termines,
    histoire: terminalJeu.distant?.histoire.id ?? null,
    connus: terminalJeu.hotesConnus(),
    ssh: terminalJeu.ssh(),
    carnet,
    examen: terminalJeu.examen,
    records,
    ...(nomJoueur ? { nom: nomJoueur } : {}),
    succes,
  });
  const sauver = () => {
    try {
      localStorage.setItem(CLE, JSON.stringify(etatSauvegarde()));
    } catch {}
  };
  const ouvert = (h: number, c: number) => c === 0 || termines.includes(chapitres(h)[c - 1].id);
  // L'attribut histoire ouvre son histoire même sans la clé (intégration dans un cours).
  const accessible = (h: number) => terminalJeu.ouverte(HISTOIRES[h].id) || HISTOIRES[h].id === options.histoire;

  const historique: string[] = [];
  let position = 0;

  // Les tableaux d'au moins trois colonnes (ls -l, ufw status, ss, ps…) ne
  // se replient pas : sur un petit écran, le bloc défile de côté. Le reste,
  // paragraphes et consignes (« tape :   ls »), passe à la ligne. Les traits
  // qui soulignent un tableau (------, ======) restent aussi d'un seul tenant.
  // Une tabulation sépare aussi des colonnes (dig).
  const enColonnes = (ligne: string) => (ligne.match(/\S(?: {2,}|\t)(?=\S)/g) ?? []).length >= 2 || /^[-=]{20,}$/.test(ligne);
  const afficher = (texte: string, classe?: string) => {
    if (!texte) return;
    const pre = document.createElement('pre');
    let lignes = texte.split('\n');
    // Une sortie géante (ls d'un lieu de 60 000 fichiers) : comme l'historique
    // d'un terminal, on n'en garde que la fin, pour que la page reste fluide.
    if (lignes.length > MAX_LIGNES) {
      const coupees = lignes.length - MAX_LIGNES;
      lignes = lignes.slice(-MAX_LIGNES);
      sortie.appendChild(el('p', { class: 'coupure' }, t('sortie-coupee', { lignes: coupees })));
    }
    // Une ligne soulignée par ^~~~ (sudo, compilateurs) : la ligne et son soulignement ne se replient pas.
    const souligne = (i: number) => /^\s*\^~*\s*$/.test(lignes[i] ?? '');
    // Les couleurs des outils (séquences ANSI, voir couleurs.ts) deviennent des spans.
    const enCouleurs = (ligne: string): (Node | string)[] =>
      ligne.includes('\x1b')
        ? morceaux(ligne).map((m) => {
            const classes = [m.gras ? 'a-gras' : '', m.avant !== null ? `a-${m.avant}` : '', m.fond !== null ? `a-${m.fond}` : ''].filter(Boolean);
            return classes.length ? el('span', { class: classes.join(' ') }, m.texte) : m.texte;
          })
        : [ligne];
    lignes.forEach((ligne, i) => {
      const fin = i < lignes.length - 1 ? '\n' : '';
      const visible = sansCouleurs(ligne);
      if (enColonnes(visible) || /^\s*\^~*\s*$/.test(visible) || souligne(i + 1)) pre.append(el('span', { class: 'colonnes' }, ...enCouleurs(ligne), fin));
      else pre.append(...enCouleurs(ligne), fin);
    });
    if (classe) pre.className = classe;
    sortie.appendChild(pre);
  };

  // Ctrl-R : null hors recherche ; sinon ce que contenait la ligne avant, et la commande trouvée.
  let recherche: { avant: string; trouvee: string } | null = null;
  const majInvite = () => {
    invite.textContent = terminalJeu.invite();
    saisie.type = terminalJeu.shell.saisieMasquee() ? 'password' : 'text';
    colorerSaisie();
  };

  // Les jetons colorés d'une ligne ; rien pour une réponse à une question
  // (yes/no, mot de passe, sftp>) ni quand la coloration est coupée.
  const jetons = (ligne: string): Jeton[] | null => {
    const sh = terminalJeu.shell;
    if (!affichage.couleurs || sh.saisieMasquee() || sh.question || sh.attente) return null;
    return colorer(sh, ligne);
  };
  const enSpans = (js: Jeton[]) => js.map((j) => (j.genre === 'texte' ? j.texte : el('span', { class: `c-${j.genre}` }, j.texte)));
  const colorerSaisie = () => {
    const js = recherche ? null : jetons(saisie.value);
    champ.classList.toggle('colore', js !== null);
    coloration.replaceChildren(...(js ? enSpans(js) : []));
    coloration.scrollLeft = saisie.scrollLeft;
  };
  // La commande recopiée au-dessus de sa sortie, colorée comme pendant la frappe.
  const afficherCommande = (ligne: string, js: Jeton[] | null) => {
    if (!js) return afficher(`${invite.textContent} ${ligne}`, 'cmd');
    sortie.appendChild(el('pre', { class: 'cmd' }, `${invite.textContent} `, ...enSpans(js)));
  };

  // Le parcours choisi : chaque chapitre, son histoire, son état ; le prochain à faire est mis en avant.
  const majParcours = () => {
    const p = PARCOURS.find((x) => x.id === affichage.parcours) ?? PARCOURS[0];
    const { etapes, prochain } = etapesParcours(p, termines, (id) => accessible(HISTOIRES.findIndex((x) => x.id === id)));
    const faits = etapes.filter((e) => e.etat === 'fait').length;
    parcoursDescription.textContent = typo(t(`parcours-${p.id}.description`));
    parcoursAvancee.textContent = faits === etapes.length ? t('parcours-fini') : t('parcours-avancee', { faits, total: etapes.length });
    listeParcours.replaceChildren(
      ...etapes.map((e, i) => {
        const etat =
          e.etat === 'fait'
            ? t('parcours-fait')
            : e.etat === 'sans-cle'
              ? t('parcours-sans-cle')
              : e.etat === 'verrouille'
                ? t('parcours-verrouille', { chapitre: t(`chapitre-${e.avant}`) })
                : i === prochain
                  ? t('parcours-prochain')
                  : t('parcours-ouvert');
        const b = el(
          'button',
          { type: 'button', 'data-h': String(e.h), 'data-c': String(e.c), 'data-etat': e.etat },
          el('span', { class: 'titre' }, t(`chapitre-${e.chapitre}`)),
          el('span', { class: 'resume' }, t('parcours-dans', { histoire: titreHistoire(e.h) })),
          el('span', { class: 'etat' }, etat),
        );
        b.disabled = e.etat === 'verrouille' || e.etat === 'sans-cle';
        b.toggleAttribute('data-prochain', i === prochain);
        b.setAttribute('aria-current', String(e.h === histoire() && e.c === courant()));
        return el('li', {}, b);
      }),
    );
  };

  const majNav = () => {
    boutonPoste.setAttribute('aria-current', String(histoire() === -1));
    boutonsHistoires.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === histoire()));
      b.disabled = !accessible(h);
      // Les histoires sans leur clé sont grisées : on avance de l'une à l'autre.
      b.toggleAttribute('data-verrouillee', !accessible(h));
      const faits = chapitres(h).filter((c) => termines.includes(c.id)).length;
      const prochain = chapitres(h).findIndex((c) => !termines.includes(c.id));
      b.querySelectorAll('.diode').forEach((d, c) => {
        d.classList.toggle('allumee', termines.includes(chapitres(h)[c].id));
        d.classList.toggle('en-cours', accessible(h) && c === prochain);
      });
      const total = chapitres(h).length;
      // L'état de la machine sur la carte : son câble et son cadre s'allument.
      b.parentElement!.dataset.etat = !accessible(h) ? 'verrouillee' : faits === chapitres(h).length ? 'terminee' : faits > 0 || h === histoire() ? 'en-cours' : 'ouverte';
      b.querySelector('.etat')!.textContent = !accessible(h)
        ? t('etat-cle-manquante')
        : faits === total
          ? t('etat-histoire-terminee')
          : total > 1
            ? t('etat-chapitres-faits', { faits, total })
            : '';
    });
    aideCle.hidden = boutonsHistoires.every((b) => !b.disabled) || affichage.vue === 'parcours';
    majParcours();
    navsChapitres.forEach((nav, h) => {
      nav.hidden = h !== histoire() || chapitres(h).length < 2;
      nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) => {
        b.disabled = !ouvert(h, c);
        b.setAttribute('aria-current', String(h === histoire() && c === courant()));
        b.querySelector('.etat')!.textContent = termines.includes(chapitres(h)[c].id)
          ? t('etat-chapitre-termine')
          : ouvert(h, c)
            ? ''
            : t('etat-verrouille');
      });
    });
    // « Chapitre suivant » : après un chapitre fini, s'il en reste un.
    const h = histoire();
    fin.hidden = !(h >= 0 && terminalJeu.distant!.shell.termine && courant() < chapitres(h).length - 1);
    const liens = h >= 0 && terminalJeu.distant!.shell.termine ? liensRouages(terminalJeu.distant!.shell.chapitre.id) : [];
    pourComprendre.hidden = liens.length === 0;
    listeRouages.replaceChildren(
      ...liens.map((l) => el('li', {}, el('a', { href: l.adresse, hreflang: 'fr', target: '_blank', rel: 'noopener' }, typo(t(`rouages-lien-${l.id}`))))),
    );
  };

  const majCarnet = () => {
    const noms = Object.keys(carnet).sort((a, b) => a.localeCompare(b));
    carnetTitre.textContent = nomJoueur ? t('carnet-titre-de', { nom: nomJoueur }) : t('carnet-titre');
    carnetCompte.textContent = t('carnet-compte', { nombre: noms.length });
    carnetVide.hidden = noms.length > 0;
    carnetActions.hidden = noms.length === 0;
    carnetListe.replaceChildren(
      ...noms.flatMap((nom) => [
        el('dt', {}, el('code', {}, nom)),
        el('dd', {}, typo(description(nom, t)), ' ', el('code', { class: 'exemple' }, carnet[nom].ligne)),
      ]),
    );
  };

  // mm:ss (ou h:mm:ss) : des chiffres, comme un chronomètre.
  const minutes = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const mmss = `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return h ? `${h}:${mmss}` : mmss;
  };
  const majChrono = () => {
    chrono.textContent = debutExamen === null ? '' : t('examen-chrono', { temps: minutes(Date.now() - debutExamen) });
  };
  const minuterie = setInterval(() => debutExamen !== null && majChrono(), 1000);
  // Fin du chapitre en mode examen : le temps, et le record de ce navigateur.
  const finExamen = () => {
    if (debutExamen === null || !terminalJeu.distant?.shell.termine) return;
    const id = terminalJeu.distant.shell.chapitre.id;
    const temps = Date.now() - debutExamen;
    const ancien = records[id];
    if (ancien === undefined || temps < ancien) records[id] = temps;
    afficher(t(ancien === undefined || temps < ancien ? 'examen-fini-record' : 'examen-fini', { temps: minutes(temps), record: minutes(records[id]) }), 'examen-resultat');
    debutExamen = null;
    majChrono();
  };

  // Les succès obtenus par la dernière ligne (sh : sa session ; null : hors d'une ligne).
  const verifierSucces = (sh: Shell | null) => {
    for (const id of nouveauxSucces({ sh, termines, carnet, records }, succes)) {
      succes[id] = new Date().toISOString();
      afficher(t('succes-obtenu', { nom: t(`succes-${id}`) }), 'succes');
    }
    majSucces();
  };
  const majSucces = () => {
    boutonSucces.textContent = t('succes-bouton', { obtenus: Object.keys(succes).length, total: SUCCES.length });
  };
  // Le bilan : le temps passé se compte depuis la première fois qu'on voit le chapitre en cours.
  const debuts = new WeakMap<Shell, number>();
  const enCours = new WeakSet<Shell>();
  const bilanFait = new WeakSet<Shell>();
  const resumeBilan = (sh: Shell) => {
    const b = bilan(sh);
    return t('bilan-resume', { temps: minutes(Date.now() - (debuts.get(sh) ?? Date.now())), commandes: b.commandes, erreurs: b.erreurs, indices: b.indices });
  };
  const ouvrirBilan = (sh: Shell, resume: string) => {
    const b = bilan(sh);
    bilanTitre.textContent = t('bilan-titre', { chapitre: t(`chapitre-${sh.chapitre.id}`) });
    bilanResume.textContent = resume;
    bilanEncourager.textContent = t('bilan-encourager', { indices: b.indices });
    bilanTableau.replaceChildren(
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...['bilan-col-etape', 'bilan-col-toi', 'bilan-col-reference'].map((k) => el('th', { scope: 'col' }, t(k))))),
        el(
          'tbody',
          {},
          ...b.etapes.map((e, i) =>
            el(
              'tr',
              {},
              el('th', { scope: 'row' }, String(i + 1)),
              el('td', { 'data-titre': t('bilan-col-toi') }, e.ligne === null ? el('span', { class: 'bilan-autrement' }, t('bilan-autrement')) : el('code', {}, e.ligne)),
              el('td', { 'data-titre': t('bilan-col-reference') }, typo(e.solution)),
            ),
          ),
        ),
      ),
    );
    fenetreBilan.showModal();
  };
  const noterBilan = () => {
    const sh = terminalJeu.distant?.shell;
    if (!sh) return;
    if (!debuts.has(sh)) debuts.set(sh, Date.now());
    if (!sh.termine) enCours.add(sh);
    // Un chapitre qu'on a vu en cours et qui vient de finir : son bilan, une fois.
    if (!sh.termine || !enCours.has(sh) || bilanFait.has(sh)) return;
    bilanFait.add(sh);
    const resume = resumeBilan(sh);
    const detail = el('button', { type: 'button', class: 'lien bouton-bilan', 'aria-haspopup': 'dialog' }, t('bilan-bouton'));
    detail.addEventListener('click', () => ouvrirBilan(sh, resume));
    sortie.appendChild(el('p', { class: 'bilan' }, resume, ' ', detail));
  };
  fermerBilan.addEventListener('click', () => fenetreBilan.close());
  fenetreBilan.addEventListener('close', () => setTimeout(() => saisie.focus()));

  const apres = (sh: Shell | null = null) => {
    noterBilan();
    finExamen();
    verifierSucces(sh);
    majCarnet();
    majInvite();
    majNav();
    sauver();
    terminal.scrollTop = terminal.scrollHeight;
  };

  // Les raccourcis du menu : un écran neuf, directement sur la bonne machine.
  const allerPoste = () => {
    debutExamen = null;
    majChrono();
    sortie.replaceChildren();
    if (terminalJeu.distant) terminalJeu.deconnecter();
    afficher(`— ${t('poste-titre')} —`);
    afficher(terminalJeu.reinitialiserPoste());
    apres();
  };
  const demarrer = (h: number, c?: number) => {
    sortie.replaceChildren();
    const chapitre = c === undefined ? undefined : chapitres(h)[c];
    if (terminalJeu.distant?.histoire === HISTOIRES[h] && chapitre) afficher(terminalJeu.ouvrir(chapitre));
    else afficher(terminalJeu.connecter(machineDeHistoire(HISTOIRES[h].id)!.nom, chapitre));
    // En mode examen, un chapitre qui (re)commence lance le chrono ; un chapitre déjà fini, non.
    debutExamen = terminalJeu.examen && !terminalJeu.distant?.shell.termine ? Date.now() : null;
    if (debutExamen !== null) afficher(t('examen-debut'), 'examen-resultat');
    majChrono();
    apres();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ligne = saisie.value;
    // Un mot de passe ne s'affiche pas et ne va pas dans l'historique.
    const secret = terminalJeu.shell.saisieMasquee();
    const reponse = secret || terminalJeu.shell.question !== null;
    if (secret) afficher(invite.textContent ?? '', 'cmd');
    else afficherCommande(ligne, reponse ? null : jetons(ligne));
    if (ligne.trim() && !reponse) historique.push(ligne);
    position = historique.length;
    const shell = terminalJeu.shell;
    const hoteAvant = shell.hote;
    const resultat = terminalJeu.executer(ligne);
    // Une réponse à une question (un mot de passe…) n'est pas une commande pour le carnet.
    if (!reponse) noter(carnet, shell);
    const ligneDe = reponse ? null : shell;
    if (resultat === null) sortie.replaceChildren();
    else afficher(resultat);
    // Les mises en scène : la connexion à une autre machine, le redémarrage.
    if (terminalJeu.shell.hote !== hoteAvant) mettreEnScene(shell.derniere.commandes.some((c) => c.includes('reboot')) ? 'reboot' : 'connexion');
    saisie.value = '';
    apres(ligneDe);
    ouvrirEditeur();
  });

  // nano : l'éditeur prend la place de la ligne de commande jusqu'à ^X.
  const ouvrirEditeur = () => {
    const edition = terminalJeu.edition;
    if (!edition) return;
    form.hidden = true;
    terminal.append(
      editeur({
        t,
        chemin: edition.chemin,
        texte: edition.texte,
        message: edition.message,
        enregistrer: (texte) => terminalJeu.enregistrer(texte),
        fermer: () => {
          afficher(terminalJeu.quitterEdition());
          form.hidden = false;
          apres();
          saisie.focus();
        },
      }),
    );
    terminal.scrollTop = terminal.scrollHeight;
  };

  const chercher = (plusVieille = false) => {
    if (!recherche) return;
    const depuis = plusVieille ? historique.lastIndexOf(recherche.trouvee) - 1 : historique.length - 1;
    let trouve = '';
    for (let i = depuis; i >= 0; i--)
      if (historique[i].includes(saisie.value)) {
        trouve = historique[i];
        break;
      }
    if (trouve || !plusVieille) recherche.trouvee = trouve;
    trouvee.textContent = t('recherche-historique', { motif: saisie.value, commande: recherche.trouvee });
  };
  const finirRecherche = (garder: boolean) => {
    if (!recherche) return;
    saisie.value = garder ? recherche.trouvee || saisie.value : recherche.avant;
    recherche = null;
    trouvee.textContent = '';
  };
  saisie.addEventListener('input', () => {
    chercher();
    colorerSaisie();
  });
  // Après une touche (Tab, ↑, Ctrl-R…), la ligne a pu changer ; le champ a pu défiler.
  saisie.addEventListener('keydown', () => setTimeout(colorerSaisie));
  for (const evenement of ['scroll', 'select', 'keyup', 'click']) saisie.addEventListener(evenement, () => (coloration.scrollLeft = saisie.scrollLeft));
  saisie.addEventListener('keydown', (e) => {
    if (terminalJeu.shell.attente || terminalJeu.shell.question) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      if (recherche) chercher(true);
      else {
        recherche = { avant: saisie.value, trouvee: '' };
        saisie.value = '';
        chercher();
      }
      return;
    }
    if (recherche) {
      if (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        finirRecherche(false);
        return;
      }
      if (e.key === 'Enter' || e.key.startsWith('Arrow') || e.key === 'Tab') finirRecherche(true);
      if (e.key === 'Enter') return;
    }
    // Ctrl-C sans rien de sélectionné : la ligne est abandonnée, comme dans bash.
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && saisie.selectionStart === saisie.selectionEnd) {
      e.preventDefault();
      afficher(`${invite.textContent} ${saisie.value}^C`, 'cmd');
      saisie.value = '';
      position = historique.length;
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      saisie.value = terminalJeu.completer(saisie.value);
    } else if (e.key === 'ArrowUp' && position > 0) {
      e.preventDefault();
      saisie.value = historique[--position];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      position = Math.min(position + 1, historique.length);
      saisie.value = historique[position] ?? '';
    }
  });

  // Copier-coller comme dans la plupart des terminaux Linux : le texte
  // sélectionné est copié, le clic droit (ou celui du milieu) le colle.
  // Maj + clic droit garde le menu du navigateur.
  const selection = () => ((racine as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? window.getSelection())?.toString() ?? '';
  let copie = '';
  terminal.addEventListener('mouseup', () => {
    const texte = selection();
    if (!texte) return;
    copie = texte;
    navigator.clipboard?.writeText(texte).catch(() => {});
  });
  const coller = async (e: MouseEvent) => {
    e.preventDefault();
    let texte = copie;
    if (!texte) texte = (await navigator.clipboard?.readText().catch(() => '')) ?? '';
    if (!texte) return;
    const nano = terminal.querySelector('textarea');
    // Dans nano, le texte garde ses lignes ; sur la ligne de commande, il tient sur une ligne.
    const cible = nano ?? saisie;
    if (!nano) texte = texte.replace(/\s*\n\s*/g, ' ').trim();
    const debut = cible.selectionStart ?? cible.value.length;
    const fin = cible.selectionEnd ?? debut;
    cible.setRangeText(texte, debut, fin, 'end');
    cible.focus();
    colorerSaisie();
  };
  terminal.addEventListener('contextmenu', (e) => {
    if (!e.shiftKey) coller(e);
  });
  terminal.addEventListener('auxclick', (e) => {
    if (e.button === 1) coller(e);
  });
  terminal.addEventListener('click', () => {
    if (!form.hidden && !selection()) saisie.focus();
  });
  listeParcours.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-h]');
    if (!b || b.disabled) return;
    demarrer(Number(b.dataset.h), Number(b.dataset.c));
    saisie.focus();
  });
  choixParcours.addEventListener('change', () => {
    affichage.parcours = choixParcours.value;
    appliquerAffichage();
  });
  boutonPoste.addEventListener('click', () => {
    allerPoste();
    saisie.focus();
  });
  boutonsHistoires.forEach((b, h) =>
    b.addEventListener('click', () => {
      demarrer(h);
      saisie.focus();
    }),
  );
  navsChapitres.forEach((nav, h) =>
    nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) =>
      b.addEventListener('click', () => {
        demarrer(h, c);
        saisie.focus();
      }),
    ),
  );
  suivant.addEventListener('click', () => {
    demarrer(histoire(), courant() + 1);
    saisie.focus();
  });
  // Le carnet s'emporte : un fichier Markdown, ou le presse-papiers.
  const markdown = () => enMarkdown(carnet, t, termines, nomJoueur);
  exporter.addEventListener('click', () => {
    const lien = el('a', { href: URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' })), download: t('carnet-fichier') });
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  });
  copierCarnet.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(markdown())
      .then(() => (carnetEtat.textContent = t('carnet-copie')))
      .catch(() => (carnetEtat.textContent = t('carnet-copie-impossible')));
  });
  caseExamen.addEventListener('change', () => {
    terminalJeu.examen = caseExamen.checked;
    // Le chapitre en cours recommence : en examen, sur une machine neuve et chrono à zéro.
    if (histoire() >= 0) demarrer(histoire(), courant());
    else apres();
  });
  // Un lieu de la carte : son nom, ses repères en toutes lettres (lus aussi
  // par les lecteurs d'écran), puis les lieux qu'il contient.
  const dessinerLieu = (l: Lieu): HTMLElement => {
    const reperes = [l.maison && t('carte-maison'), l.ferme && t('carte-ferme'), !l.visite && t('carte-apercu')].filter(Boolean).join(', ');
    return el(
      'li',
      { class: [l.visite ? 'visite' : 'apercu', l.ici ? 'ici' : ''].join(' ').trim(), ...(l.ici ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'nom' }, l.nom === '/' ? '/' : `${l.nom}/`),
      ...(reperes ? [' ', el('span', { class: 'reperes' }, `(${reperes})`)] : []),
      ...(l.ici ? [' ', el('strong', { class: 'vous-etes-ici' }, t('carte-ici'))] : []),
      ...(l.enfants.length ? [el('ul', {}, ...l.enfants.map(dessinerLieu))] : []),
    );
  };
  // Le plan du réseau : un schéma (arbre couché, une colonne par niveau) et la même chose en liste.
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (nom: string, attrs: Record<string, string>, ...enfants: (Node | string)[]) => {
    const e = document.createElementNS(SVG, nom);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...enfants);
    return e;
  };
  const LARGEUR = 176;
  const HAUTEUR = 54;
  const ECART_X = 36;
  const ECART_Y = 22;
  const classesPlan = (e: ElementPlan, ici: string, visitees: Set<string>) => {
    const r = reperesPlan(e, ici, visitees);
    return [e.role, r.ici ? 'ici' : '', e.hote && !r.visite ? 'pas-visite' : ''].filter(Boolean).join(' ');
  };
  const dessinerPlan = (racine: ElementPlan, ici: string, visitees: Set<string>) => {
    const { places, colonnes, lignes } = disposer(racine);
    const x = (c: number) => 2 + c * (LARGEUR + ECART_X);
    const y = (l: number) => ECART_Y + l * (HAUTEUR + ECART_Y);
    const largeur = x(colonnes) - ECART_X + 2;
    const hauteur = y(lignes);
    const liens = places
      .filter((p) => p.parent)
      .map((p) => {
        const de = p.parent!;
        const milieu = x(de.colonne) + LARGEUR + ECART_X / 2;
        return svg('path', {
          class: p.element.tunnel ? 'lien tunnel' : 'lien',
          d: `M${x(de.colonne) + LARGEUR} ${y(de.ligne) + HAUTEUR / 2} H${milieu} V${y(p.ligne) + HAUTEUR / 2} H${x(p.colonne)}`,
        });
      });
    const boites = places.map((p) => {
      const e = p.element;
      const bx = x(p.colonne);
      const by = y(p.ligne);
      return svg(
        'g',
        { class: `boite ${classesPlan(e, ici, visitees)}` },
        svg('rect', { x: String(bx), y: String(by), width: String(LARGEUR), height: String(HAUTEUR), rx: e.role === 'internet' ? '27' : '6' }),
        // Un nom seul (Internet) se centre dans sa boîte.
        svg('text', { x: String(bx + 10), y: String(by + (e.adresse || e.note ? 19 : HAUTEUR / 2 + 5)), class: 'nom' }, e.nom),
        ...(e.adresse ? [svg('text', { x: String(bx + 10), y: String(by + 34), class: 'adresse' }, e.adresse)] : []),
        ...(e.note ? [svg('text', { x: String(bx + 10), y: String(by + 48), class: 'note' }, e.note)] : []),
        ...(reperesPlan(e, ici, visitees).ici ? [svg('text', { x: String(bx), y: String(by - 6), class: 'repere-ici' }, `▼ ${t('plan-ici')}`)] : []),
      );
    });
    return svg('svg', { viewBox: `0 0 ${largeur} ${hauteur}`, width: String(largeur), height: String(hauteur), 'aria-hidden': 'true', focusable: 'false' }, ...liens, ...boites);
  };
  const dessinerElement = (e: ElementPlan, ici: string, visitees: Set<string>): HTMLElement => {
    const r = reperesPlan(e, ici, visitees);
    const notes = [e.note, e.tunnel && t('plan-tunnel'), e.hote && (r.visite ? t('plan-visite') : t('plan-pas-visite'))].filter(Boolean).join(', ');
    return el(
      'li',
      { class: classesPlan(e, ici, visitees), ...(r.ici ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'nom' }, e.nom),
      ...(e.adresse ? [' ', el('code', {}, e.adresse)] : []),
      ...(notes ? [' ', el('span', { class: 'reperes' }, `(${notes})`)] : []),
      ...(r.ici ? [' ', el('strong', { class: 'vous-etes-ici' }, `← ${t('plan-ici')}`)] : []),
      ...(e.enfants?.length ? [el('ul', {}, ...e.enfants.map((x) => dessinerElement(x, ici, visitees)))] : []),
    );
  };
  const choisirOnglet = (reseau: boolean) => {
    ongletLieux.setAttribute('aria-selected', String(!reseau));
    ongletReseau.setAttribute('aria-selected', String(reseau));
    ongletLieux.tabIndex = reseau ? -1 : 0;
    ongletReseau.tabIndex = reseau ? 0 : -1;
    panneauLieux.hidden = reseau;
    panneauReseau.hidden = !reseau;
  };
  ongletLieux.addEventListener('click', () => choisirOnglet(false));
  ongletReseau.addEventListener('click', () => choisirOnglet(true));
  // Les flèches passent d'un onglet à l'autre (comme dans toute liste d'onglets).
  onglets.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const reseau = ongletLieux.getAttribute('aria-selected') === 'true';
    choisirOnglet(reseau);
    (reseau ? ongletReseau : ongletLieux).focus();
    e.preventDefault();
  });
  boutonCarte.addEventListener('click', () => {
    const sh = terminalJeu.shell;
    carteTitre.textContent = t('carte-titre', { machine: sh.hote });
    carteArbre.replaceChildren(el('ul', { class: 'arbre' }, dessinerLieu(carte(sh))));
    const plan = terminalJeu.distant?.shell.chapitre.plan?.(t);
    onglets.hidden = !plan;
    if (plan) {
      planSchema.replaceChildren(dessinerPlan(plan, sh.hote, terminalJeu.visitees));
      planListe.replaceChildren(el('ul', { class: 'arbre' }, dessinerElement(plan, sh.hote, terminalJeu.visitees)));
      // Sur un petit écran, le schéma défile dans sa boîte : la liste s'ouvre d'office.
      planTexte.open = matchMedia('(max-width: 40rem)').matches;
    }
    choisirOnglet(false);
    fenetreCarte.showModal();
    fenetreCarte.querySelector('.ici')?.scrollIntoView({ block: 'center' });
  });
  // La fenêtre fermée (bouton ou Échap), on reprend la ligne de commande :
  // après que le navigateur a rendu le focus au bouton qui l'avait ouverte.
  fermerCarte.addEventListener('click', () => fenetreCarte.close());
  fenetreCarte.addEventListener('close', () => setTimeout(() => saisie.focus()));
  // La barre de touches : chaque bouton agit sur la ligne sans lui prendre le
  // focus (le clavier du téléphone reste ouvert).
  barreTouches.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  });
  barreTouches.addEventListener('click', (e) => {
    const touche = (e.target as HTMLElement).closest('button')?.dataset.touche;
    if (!touche || form.hidden) return;
    if (touche.length === 1) saisie.setRangeText(touche, saisie.selectionStart ?? saisie.value.length, saisie.selectionEnd ?? saisie.value.length, 'end');
    else {
      const [ctrl, key] = touche === 'ctrl-c' ? [true, 'c'] : [false, touche];
      saisie.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, cancelable: true }));
    }
    saisie.focus();
  });
  // La mission du chapitre en cours.
  boutonMission.addEventListener('click', () => {
    const sh = terminalJeu.distant?.shell;
    const c = sh?.chapitre;
    missionTitre.textContent = c ? t('mission-titre', { chapitre: t('chapitre-numero', { numero: c.numero }), titre: t(`chapitre-${c.id}`) }) : t('poste-titre');
    missionObjectif.textContent = c ? typo(t(`chapitre-${c.id}.resume`)) : '';
    missionConsignes.textContent = (sh ?? terminalJeu.poste).lire(`${(sh ?? terminalJeu.poste).maison}/${(sh ?? terminalJeu.poste).accueil}`) ?? '';
    const journal = sh?.journal ?? [];
    missionVide.hidden = journal.length > 0;
    missionJournal.replaceChildren(...journal.map((m) => el('li', {}, el('pre', { class: 'mission-texte' }, m))));
    majAide();
    majSecours();
    fenetreMission.showModal();
  });
  fermerMission.addEventListener('click', () => fenetreMission.close());
  // L'instantané pris : sa série (l'ouverture du chapitre) et le nombre de saisies rejouées.
  let instantane: { serie: number; pas: number } | null = null;
  const majSecours = () => {
    const sh = terminalJeu.distant?.shell;
    secours.hidden = !sh;
    if (!sh) return;
    const pas = terminalJeu.pas;
    if (instantane && instantane.serie !== terminalJeu.serie) instantane = null;
    const possible = pas !== null && !terminalJeu.examen;
    prendreInstantane.disabled = !possible;
    revenirInstantane.disabled = !possible || !instantane || instantane.pas > pas!;
    annulerSaisie.disabled = !possible || pas === 0;
    etatSecours.textContent = terminalJeu.examen
      ? t('secours-examen')
      : pas === null
        ? t('secours-impossible')
        : instantane
          ? t('secours-pris', { pas: instantane.pas })
          : t('secours-aucun');
  };
  prendreInstantane.addEventListener('click', () => {
    const pas = terminalJeu.pas;
    if (pas === null) return;
    instantane = { serie: terminalJeu.serie, pas };
    majSecours();
  });
  // Revenir en arrière : la machine du chapitre est rejouée jusqu'à ce point ; le temps du bilan continue.
  const restaurer = (pas: number) => {
    const ancienne = terminalJeu.distant?.shell;
    if (!ancienne || !terminalJeu.restaurer(pas)) return;
    const nouvelle = terminalJeu.distant!.shell;
    if (debuts.has(ancienne)) debuts.set(nouvelle, debuts.get(ancienne)!);
    if (enCours.has(ancienne)) enCours.add(nouvelle);
    if (bilanFait.has(ancienne) && nouvelle.termine) bilanFait.add(nouvelle);
    fenetreMission.close();
    sortie.replaceChildren();
    afficher(t('secours-restaure', { pas }), 'succes');
    apres();
  };
  revenirInstantane.addEventListener('click', () => instantane && restaurer(instantane.pas));
  annulerSaisie.addEventListener('click', () => {
    const pas = terminalJeu.pas;
    if (pas) restaurer(pas - 1);
  });
  // L'aide du chapitre en cours : les niveaux déjà ouverts pour cette étape restent visibles.
  const majAide = () => {
    const sh = terminalJeu.distant?.shell;
    aide.hidden = !sh || terminalJeu.examen || sh.termine;
    if (aide.hidden || !sh) return;
    const i = indice(sh);
    const ouverts = NIVEAUX.filter((n) => sh.indicesDemandes.has(`${i.etape ?? ''}:${n}`) || (n === 'manuel' && sh.indicesDemandes.has(`:${n}`)));
    const blocs: HTMLElement[] = [];
    if (ouverts.includes('manuel')) blocs.push(el('p', {}, t('indice-manuel', { pages: i.manuel.map((c) => `man ${c}`).join(', ') })));
    if (ouverts.includes('piste') && i.piste) blocs.push(el('p', {}, typo(i.piste)));
    if (ouverts.includes('solution') && i.solution) blocs.push(el('pre', { class: 'mission-texte' }, i.solution));
    if (!i.etape && ouverts.length < 3) blocs.push(el('p', { class: 'carte-legende' }, typo(t('indice-plus-rien'))));
    texteIndice.replaceChildren(...blocs);
    // Un niveau à la fois : le suivant s'ouvre quand le précédent a été lu.
    NIVEAUX.forEach((n, k) => {
      const b = boutonsIndice[n];
      b.hidden = ouverts.includes(n) || (k > 0 && !ouverts.includes(NIVEAUX[k - 1])) || (n !== 'manuel' && !i.etape);
    });
  };
  aide.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).closest('button')?.dataset.niveau as Niveau | undefined;
    const sh = terminalJeu.distant?.shell;
    if (!n || !sh) return;
    sh.indicesDemandes.add(`${n === 'manuel' ? '' : (indice(sh).etape ?? '')}:${n}`);
    majAide();
    texteIndice.lastElementChild?.scrollIntoView({ block: 'nearest' });
  });
  fenetreMission.addEventListener('close', () => setTimeout(() => saisie.focus()));
  // ——— L'affichage du terminal ———
  // Un réglage de ce navigateur seulement (pas de la progression).
  const appliquerAffichage = () => {
    if (!THEMES.includes(affichage.theme)) affichage.theme = 'phosphore';
    affichage.taille = Math.max(0, Math.min(TAILLES.length - 1, Math.round(affichage.taille) || 0));
    terminal.dataset.theme = affichage.theme;
    terminal.style.setProperty('--qds-taille-terminal', `${TAILLES[affichage.taille]}rem`);
    choixTheme.value = affichage.theme;
    if (!(VUES as readonly string[]).includes(affichage.vue)) affichage.vue = 'reseau';
    navHistoires.dataset.vue = affichage.vue;
    listeHistoires.hidden = affichage.vue === 'parcours';
    blocParcours.hidden = affichage.vue !== 'parcours';
    if (!PARCOURS.some((p) => p.id === affichage.parcours)) affichage.parcours = PARCOURS[0].id;
    choixParcours.value = affichage.parcours;
    majNav();
    affichage.couleurs = affichage.couleurs !== false;
    terminalJeu.couleurs = affichage.couleurs;
    boutonCouleurs.setAttribute('aria-pressed', String(affichage.couleurs));
    colorerSaisie();
    VUES.forEach((v) => boutonsVue[v].setAttribute('aria-pressed', String(v === affichage.vue)));
    plusPetit.disabled = affichage.taille === 0;
    plusGrand.disabled = affichage.taille === TAILLES.length - 1;
    try {
      localStorage.setItem(CLE_AFFICHAGE, JSON.stringify(affichage));
    } catch {}
  };
  VUES.forEach((v) =>
    boutonsVue[v].addEventListener('click', () => {
      affichage.vue = v;
      appliquerAffichage();
    }),
  );
  choixTheme.addEventListener('change', () => {
    affichage.theme = choixTheme.value;
    appliquerAffichage();
  });
  boutonCouleurs.addEventListener('click', () => {
    affichage.couleurs = !affichage.couleurs;
    appliquerAffichage();
  });
  plusPetit.addEventListener('click', () => {
    affichage.taille--;
    appliquerAffichage();
  });
  plusGrand.addEventListener('click', () => {
    affichage.taille++;
    appliquerAffichage();
  });
  // Le plein écran : le terminal (et sa barre de touches) prend toute la fenêtre ; Échap en sort.
  const basculerFocus = (actif: boolean) => {
    ecran.classList.toggle('focus', actif);
    boutonFocus.setAttribute('aria-pressed', String(actif));
    saisie.focus();
  };
  boutonFocus.addEventListener('click', () => basculerFocus(!ecran.classList.contains('focus')));
  quitterFocus.addEventListener('click', () => basculerFocus(false));
  ecran.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ecran.classList.contains('focus') && !recherche) basculerFocus(false);
  });
  appliquerAffichage();
  // Les mises en scène (sauf si le système demande moins d'animations) : une
  // connexion qui s'établit, un écran qui s'éteint au redémarrage.
  const mettreEnScene = (quoi: 'connexion' | 'reboot') => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    terminal.classList.remove('scene-connexion', 'scene-reboot');
    void terminal.offsetWidth;
    terminal.classList.add(`scene-${quoi}`);
  };
  terminal.addEventListener('animationend', () => terminal.classList.remove('scene-connexion', 'scene-reboot'));
  // ——— Les succès et le grade ———
  boutonSucces.addEventListener('click', () => {
    const actuel = grade(termines);
    const suivant = GRADES.find((g) => g.chapitres > termines.length);
    succesGrade.replaceChildren(
      el('strong', {}, t('succes-grade', { grade: t(`grade-${actuel}`) })),
      ...(actuel === 'sre' ? [] : [' ', t('succes-grade-suivant', { grade: t(`grade-${suivant?.id ?? 'sre'}`), chapitres: suivant?.chapitres ?? termines.length })]),
    );
    const date = (iso: string) => new Intl.DateTimeFormat(t.langue, { dateStyle: 'medium' }).format(new Date(iso));
    succesListe.replaceChildren(
      ...SUCCES.map((x) => {
        const obtenu = succes[x.id];
        const visible = obtenu || !x.cache;
        return el(
          'li',
          { class: obtenu ? 'obtenu' : 'a-obtenir' },
          el('span', { class: 'succes-nom' }, `${obtenu ? '🏆' : '·'} ${visible ? t(`succes-${x.id}`) : t('succes-cache')}`),
          ' ',
          el('span', { class: 'succes-description' }, visible ? typo(t(`succes-${x.id}.description`)) : typo(t('succes-cache.description'))),
          ...(obtenu ? [' ', el('span', { class: 'succes-date' }, t('succes-le', { date: date(obtenu) }))] : []),
        );
      }),
    );
    fenetreSucces.showModal();
  });
  fermerSucces.addEventListener('click', () => fenetreSucces.close());
  fenetreSucces.addEventListener('close', () => setTimeout(() => saisie.focus()));
  // ——— Ma progression ———
  // Une sauvegarde reprise (code ou fichier) : on l'écrit, puis le jeu repart d'elle.
  const reprendre = (s: Sauvegarde) => {
    try {
      localStorage.setItem(CLE, JSON.stringify(s));
    } catch {}
    fenetreProgression.close();
    clearInterval(minuterie);
    racine.replaceChildren();
    monter(racine, options);
  };
  const majProgression = () => {
    champNom.value = nomJoueur;
    codeActuel.textContent = codeDeProgression(termines);
    etatProgression.textContent = '';
  };
  boutonProgression.addEventListener('click', () => {
    majProgression();
    fenetreProgression.showModal();
  });
  fermerProgression.addEventListener('click', () => fenetreProgression.close());
  fenetreProgression.addEventListener('close', () => setTimeout(() => saisie.focus()));
  champNom.addEventListener('change', () => {
    nomJoueur = nettoyerNom(champNom.value);
    champNom.value = nomJoueur;
    majCarnet();
    sauver();
  });
  copierCode.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(codeActuel.textContent ?? '')
      .then(() => (etatProgression.textContent = t('carnet-copie')))
      .catch(() => (etatProgression.textContent = t('carnet-copie-impossible')));
  });
  // Le code ne donne que des chapitres terminés : on les ajoute, sans rien perdre d'ici.
  const essayerCode = () => {
    const lu = lireCode(champCode.value);
    if ('erreur' in lu) {
      etatProgression.textContent = t(`progression-${lu.erreur}`);
      champCode.focus();
      return;
    }
    const nouveaux = lu.termines.filter((id) => !termines.includes(id));
    if (!nouveaux.length) {
      etatProgression.textContent = t('progression-rien-de-neuf');
      return;
    }
    reprendre({ ...etatSauvegarde(), termines: [...termines, ...nouveaux] });
  };
  reprendreCode.addEventListener('click', essayerCode);
  champCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') essayerCode();
  });
  telecharger.addEventListener('click', () => {
    const lien = el('a', {
      href: URL.createObjectURL(new Blob([fichierDeSauvegarde(etatSauvegarde(), new Date())], { type: 'application/json' })),
      download: t('progression-nom-fichier'),
    });
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
    etatProgression.textContent = t('progression-telechargee');
  });
  // Le fichier remplace tout ce qui est gardé ici : on demande d'abord.
  champFichier.addEventListener('change', async () => {
    const fichier = champFichier.files?.[0];
    if (!fichier) return;
    const lu = lireFichier(await fichier.text());
    champFichier.value = '';
    if ('erreur' in lu) {
      etatProgression.textContent = t(`progression-${lu.erreur}`);
      return;
    }
    if (!confirm(t('progression-confirmer', { nombre: lu.sauvegarde.termines?.length ?? 0 }))) return;
    reprendre(lu.sauvegarde);
  });
  recommencer.addEventListener('click', () => {
    if (histoire() === -1) allerPoste();
    else demarrer(histoire(), courant());
    saisie.focus();
  });

  // Au départ : l'histoire demandée par l'attribut, sinon celle où l'on
  // s'était arrêté, sinon le poste.
  const depart = HISTOIRES.findIndex((h) => h.id === (options.histoire ?? sauve.histoire));
  if (depart >= 0 && accessible(depart)) demarrer(depart);
  else allerPoste();
  return { racine: jeu };
}
