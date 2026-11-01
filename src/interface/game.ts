// L'interface du jeu : le terminal simulé (une console qui part du poste et
// se connecte en ssh aux machines des histoires), le menu des histoires et
// des chapitres (des raccourcis), la progression gardée dans le navigateur.
// monter() construit tout dans un conteneur (un élément ou la racine
// fantôme d'un composant), sans rien supposer de la page qui l'accueille.

import { difficulty, stars, storyDifficulty, type Level } from '../engine/difficulty';
import { Console } from '../engine/console';
import type { Shell } from '../engine/shell';
import { STORIES } from '../engine/chapters';
import { machineDomain, storyMachine, WORKSTATION, type Machine } from '../engine/machines';
import { description, inMarkdown, note, type Notebook } from '../engine/notebook';
import { rouagesLinks } from '../engine/rouages';
import { map, type Place } from '../engine/map';
import { layOut, landmarks as planLandmarks, type ElementPlan } from '../engine/plan';
import { grade, GRADES, newAchievements, ACHIEVEMENTS } from '../engine/achievements';
import { hint, HINT_LEVELS, type HintLevel } from '../engine/hints';
import { summary } from '../engine/summary';
import { pathSteps, PATH } from '../engine/paths';
import { missing } from '../engine/unlocking';
import { remainingBudget, dayIncident, gauge, placeFor, percent } from '../engine/on-call';
import { progressCode, backupFile, readCode, readFile, cleanName, type Backup } from '../engine/progress';
import { colourise, type Token } from '../engine/highlighting';
import { chunks, withoutColours } from '../engine/colours';
import { editor } from './editor';
import { translator, typography, type Language } from '../texts';

export interface Options {
  language?: Language;
  /** Histoire à ouvrir au départ (identifiant, ex. « datacenter »), même sans sa clé. */
  story?: string;
  /** Clé de sauvegarde dans localStorage (à changer si plusieurs jeux partagent un site). */
  saveKey?: string;
}


function el<K extends keyof HTMLElementTagNameMap>(name: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

// Les lignes gardées à l'écran pour une seule sortie.
const LINES_MAX = 2000;
// Pendant un suivi (tail -f), les secondes qui passent sur la machine à chaque seconde réelle.
const SECONDS_FOLLOW = 3;

export function mount(root: HTMLElement | ShadowRoot, options: Options = {}) {
  const t = translator(options.language);
  const typo = (text: string) => typography(text, t.language);
  const storyTitle = (h: number) => t(`story-${STORIES[h].id}`);
  const KEY = options.saveKey ?? 'quetes-de-sysadmin';
  const chapters = (h: number) => STORIES[h].chapters;
  // L'affichage (thème, taille, vue du menu, couleurs) : un réglage de ce navigateur seulement.
  const DISPLAY_KEY = `${KEY}-affichage`;
  const SIZES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
  let display = { theme: 'phosphore', size: 2, vue: 'reseau', colours: true, parcours: PATH[0].id };
  try {
    display = { ...display, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') };
  } catch {}

  // ——— Construction ———
  // Le nom et l'adresse de la machine, montrés sur la carte du réseau (des identifiants techniques, jamais traduits).
  const host = (m: Machine | undefined) => el('span', { class: 'hote' }, m ? `${machineDomain(t, m)} ${m.address}` : '');
  // The difficulty: stars for the eye, the level in words for screen readers (see difficulty.ts).
  const level = (min: Level, max: Level = min) =>
    el(
      'span',
      { class: 'difficulty' },
      el('span', { 'aria-hidden': 'true' }, min === max ? stars(min) : `${'★'.repeat(min)} – ${'★'.repeat(max)}`),
      el('span', { class: 'visually-hidden' }, min === max ? t('difficulty', { level: min }) : t('difficulty-tidy', { min, max })),
    );
  const storiesBoutons = STORIES.map((h, i) =>
    el('button', { type: 'button', 'data-histoire': String(i) },
      el('span', { class: 'titre' }, storyTitle(i)),
      host(storyMachine(h.id)),
      el('span', { class: 'resume' }, typo(t(`story-${h.id}.resume`))),
      level(storyDifficulty(h.id).min, storyDifficulty(h.id).max),
      el('span', { class: 'etat' }),
      // Une diode par chapitre, comme sur une baie de serveur (l'état en toutes lettres est dans .etat).
      el('span', { class: 'diodes', 'aria-hidden': 'true' }, ...h.chapters.map(() => el('span', { class: 'diode' })))),
  );
  const workstationButton = el('button', { type: 'button', 'data-poste': '' }, el('span', { class: 'titre' }, t('workstation-title')), host(WORKSTATION));
  const keyHelp = el('p', { class: 'cle-aide' }, typo(t('key-help')));
  // Deux vues du menu : la carte du réseau (le poste, internet, puis une
  // machine par histoire, branchée sur le même câble, qui s'allume à mesure
  // qu'on avance) et les baies (les mêmes boutons, en grille, avec leur
  // résumé). Ce sont les mêmes boutons dans la même liste : seule la mise en
  // page change, et les lecteurs d'écran lisent la même chose.
  const VIEWS = ['reseau', 'baies', 'parcours'] as const;
  const viewBoutons = Object.fromEntries(
    VIEWS.map((v) => [v, el('button', { type: 'button', class: 'bouton-vue', 'aria-pressed': 'false', 'data-vue': v }, t(`view-${v}`))]),
  ) as Record<(typeof VIEWS)[number], HTMLButtonElement>;
  const viewChoice = el('p', { class: 'choix-vue', role: 'group', 'aria-label': t('view-title') }, ...VIEWS.map((v) => viewBoutons[v]));
  const storiesList = el(
    'ol',
    {},
    el('li', { class: 'noeud-poste' }, workstationButton),
    // Internet, entre le poste et les machines : un repère, pas un bouton.
    el('li', { class: 'noeud-internet', 'aria-hidden': 'true' }, el('span', {}, t('view-internet'))),
    ...storiesBoutons.map((b, i) => el('li', { class: 'noeud', 'data-cote': i % 2 ? 'droite' : 'gauche' }, b)),
  );
  // La vue « Parcours » : un thème, et ses chapitres pris dans plusieurs histoires (voir parcours.ts).
  const pathId = `qds-parcours-${Math.random().toString(36).slice(2, 8)}`;
  const pathChoice = el(
    'select',
    { id: pathId },
    ...PATH.map((p) => el('option', { value: p.id }, t(`path-${p.id}`))),
  ) as HTMLSelectElement;
  const descriptionPath = el('p', { class: 'parcours-description' });
  const progressPath = el('p', { class: 'parcours-avancee' });
  const pathList = el('ol', { class: 'parcours-liste' });
  const pathBlock = el(
    'div',
    { class: 'parcours', hidden: '' },
    el('p', { class: 'parcours-choix' }, el('label', { for: pathId }, t('path-choice')), ' ', pathChoice),
    descriptionPath,
    progressPath,
    pathList,
  );
  // L'incident du jour (voir astreinte.ts) : le même chapitre pour tout le monde, à rejouer d'astreinte.
  const incidentButton = el('button', { type: 'button', class: 'bouton-incident', 'aria-haspopup': 'dialog' }, t('on-call-button'));
  const incidentText = el('span', { class: 'incident-texte' });
  const incidentBlock = el('p', { class: 'incident' }, incidentButton, ' ', incidentText);
  const storiesNav = el('nav', { class: 'histoires', 'aria-label': t('stories-title') }, viewChoice, incidentBlock, storiesList, pathBlock, keyHelp);

  const chaptersNavs = STORIES.map((h, i) =>
    el('nav', { class: 'chapitres', 'aria-label': t('chapters-title', { histoire: storyTitle(i) }), 'data-chapitres': String(i) },
      el('ol', {}, ...h.chapters.map((c, j) =>
        el('li', {}, el('button', { type: 'button', 'data-chapitre': String(j) },
          el('span', { class: 'num' }, t('chapter-number', { numero: c.number })),
          el('span', { class: 'titre' }, t(`chapter-${c.id}`)),
          el('span', { class: 'resume' }, typo(t(`chapter-${c.id}.resume`))),
          level(difficulty(c.id)),
          el('span', { class: 'etat' })))))),
  );

  // Le mode examen : pas d'indice, un chrono ; la case recommence le chapitre en cours.
  const examCase = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const stopwatch = el('span', { class: 'chrono', role: 'timer' });
  // La carte : un bouton à côté du terminal ouvre, dans une fenêtre, les lieux
  // connus de la machine où l'on est (voir carte.ts).
  const mapButton = el('button', { type: 'button', class: 'bouton-carte', 'aria-haspopup': 'dialog' }, t('map-button'));
  // L'affichage du terminal : thème, taille du texte, plein écran (réglages de ce navigateur).
  const THEMES = ['phosphore', 'ambre', 'contraste', 'papier'];
  const themeChoice = el(
    'select',
    { 'aria-label': t('display-theme') },
    ...THEMES.map((x) => el('option', { value: x }, t(`display-theme-${x}`))),
  ) as HTMLSelectElement;
  const moreSmall = el('button', { type: 'button', class: 'bouton-reglage', 'aria-label': t('display-more-small') }, 'A−');
  const moreGrand = el('button', { type: 'button', class: 'bouton-reglage', 'aria-label': t('display-more-big') }, 'A+');
  const focusButton = el('button', { type: 'button', class: 'bouton-reglage', 'aria-pressed': 'false' }, t('display-focus'));
  const coloursButton = el('button', { type: 'button', class: 'bouton-reglage', 'aria-pressed': 'true' }, t('display-colours'));
  const settings = el('span', { class: 'reglages' }, themeChoice, moreSmall, moreGrand, coloursButton, focusButton);
  // La mission : l'objectif du chapitre, ses consignes, et ce qui s'est déjà passé.
  const missionButton = el('button', { type: 'button', class: 'bouton-mission', 'aria-haspopup': 'dialog' }, t('mission-button'));
  const onCallGauge = el('span', { class: 'jauge-astreinte', role: 'timer', hidden: '' });
  const examBar = el(
    'p',
    { class: 'examen' },
    el('label', {}, examCase, el('span', {}, t('exam-case'))),
    stopwatch,
    onCallGauge,
    el('span', { class: 'outils' }, missionButton, mapButton, settings),
  );
  const idMission = `qds-mission-${Math.random().toString(36).slice(2, 8)}`;
  const titleMission = el('h2', { id: idMission });
  const goalMission = el('p', { class: 'carte-legende' });
  const instructionsMission = el('pre', { class: 'mission-texte' });
  const logMission = el('ol', { class: 'mission-journal' });
  const emptyMission = el('p', { class: 'carte-legende' }, typo(t('mission-nothing')));
  const closeMission = el('button', { type: 'button', class: 'bouton' }, t('map-close'));
  // Besoin d'aide ? Trois niveaux, l'un après l'autre (voir indices.ts) ; rien en mode examen.
  const hintBoutons = Object.fromEntries(
    HINT_LEVELS.map((n) => [n, el('button', { type: 'button', class: 'bouton-indice', 'data-niveau': n }, t(`hint-button-${n}`))]),
  ) as Record<HintLevel, HTMLButtonElement>;
  const hintText = el('div', { class: 'indice-texte', 'aria-live': 'polite' });
  const help = el(
    'section',
    { class: 'aide' },
    el('h3', {}, t('hint-title')),
    el('p', { class: 'carte-legende' }, typo(t('hint-intro'))),
    el('p', { class: 'indice-boutons' }, ...HINT_LEVELS.map((n) => hintBoutons[n])),
    hintText,
  );
  // L'instantané de secours (voir Console.restaurer) : comme celui d'une machine virtuelle.
  const takeSnapshot = el('button', { type: 'button', class: 'bouton-secours' }, t('rescue-take'));
  const goBackSnapshot = el('button', { type: 'button', class: 'bouton-secours' }, t('rescue-go-back'));
  const cancelInput = el('button', { type: 'button', class: 'bouton-secours' }, t('rescue-cancel'));
  const rescueState = el('p', { class: 'carte-legende secours-etat', role: 'status' });
  const rescue = el(
    'section',
    { class: 'secours' },
    el('h3', {}, t('rescue-title')),
    el('p', { class: 'carte-legende' }, typo(t('rescue-intro'))),
    el('p', { class: 'indice-boutons' }, takeSnapshot, goBackSnapshot, cancelInput),
    rescueState,
  );
  const missionWindow = el(
    'dialog',
    { class: 'fenetre-mission', 'aria-labelledby': idMission },
    titleMission,
    goalMission,
    el('h3', {}, t('mission-instructions')),
    instructionsMission,
    el('h3', {}, t('mission-journal')),
    emptyMission,
    logMission,
    help,
    rescue,
    el('p', { class: 'carte-actions' }, closeMission),
  ) as HTMLDialogElement;
  const mapId = `qds-carte-${Math.random().toString(36).slice(2, 8)}`;
  const titleMap = el('h2', { id: mapId });
  const treeMap = el('div', { class: 'carte-arbre' });
  const closeMap = el('button', { type: 'button', class: 'bouton' }, t('map-close'));
  // Deux onglets quand l'histoire a un réseau : les lieux de la machine, et le plan du réseau (voir plan.ts).
  const tab = (suffix: string, text: string) =>
    el('button', { type: 'button', role: 'tab', id: `${mapId}-onglet-${suffix}`, 'aria-controls': `${mapId}-${suffix}` }, text);
  const placesTab = tab('lieux', t('map-tab-places'));
  const networkTab = tab('reseau', t('map-tab-network'));
  const tabs = el('div', { role: 'tablist', class: 'carte-onglets' }, placesTab, networkTab);
  const placesPanel = el(
    'div',
    { role: 'tabpanel', id: `${mapId}-lieux`, 'aria-labelledby': placesTab.id },
    el('p', { class: 'carte-legende' }, typo(t('map-caption'))),
    treeMap,
  );
  const planSchema = el('div', { class: 'plan-schema' });
  const listPlan = el('div', { class: 'carte-arbre' });
  const textPlan = el('details', { class: 'plan-texte' }, el('summary', {}, t('plan-version-text')), listPlan);
  const networkPanel = el(
    'div',
    { role: 'tabpanel', id: `${mapId}-reseau`, 'aria-labelledby': networkTab.id },
    el('p', { class: 'carte-legende' }, typo(t('plan-caption'))),
    planSchema,
    textPlan,
  );
  const mapWindow = el(
    'dialog',
    { class: 'fenetre-carte', 'aria-labelledby': mapId },
    titleMap,
    tabs,
    placesPanel,
    networkPanel,
    el('p', { class: 'carte-actions' }, closeMap),
  ) as HTMLDialogElement;
  const output = el('div', { class: 'sortie', role: 'log', 'aria-live': 'polite' });
  const id = `qds-saisie-${Math.random().toString(36).slice(2, 8)}`;
  const prompt = el('label', { class: 'invite', for: id });
  const input = el('input', {
    id, type: 'text', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
    'aria-label': t('input-label'),
  }) as HTMLInputElement;
  // Ctrl-R : la recherche dans l'historique, comme bash ; la commande trouvée s'affiche sous la ligne.
  const match = el('p', { class: 'recherche', 'aria-live': 'polite' });
  // La coloration de la ligne (voir coloration.ts) : une copie colorée du
  // texte, dessinée exactement sous le champ, qui reste un champ ordinaire
  // (clavier, complétion, lecteurs d'écran) au texte rendu transparent.
  const coloration = el('div', { class: 'coloration', 'aria-hidden': 'true' });
  const field = el('span', { class: 'champ' }, coloration, input);
  const form = el('form', { autocomplete: 'off' }, prompt, field, match);
  // tail -f, journalctl -f : la commande garde la main jusqu'à Ctrl-C (ce bouton, le clavier ou la barre de touches).
  const followStop = el('button', { type: 'button', class: 'arret-suivi', hidden: '' }, el('kbd', {}, '^C'), ` ${t('follow-stop')}`);
  const terminal = el('div', { class: 'terminal' }, output, form, followStop);
  const quitFocus = el('button', { type: 'button', class: 'quitter-focus' }, t('display-quit-focus'));
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
    ['_', '_'],
    ['.', '.'],
    ['*', '*'],
    ['>', '>'],
  ];
  const touchesBar = el(
    'div',
    { class: 'touches', role: 'toolbar', 'aria-label': t('keys-title') },
    ...TOUCHES.map(([text, pressedKey]) =>
      el('button', { type: 'button', 'data-touche': pressedKey, ...(pressedKey.startsWith('Arrow') ? { 'aria-label': t(`key-${pressedKey === 'ArrowUp' ? 'haut' : 'bas'}`) } : {}) }, text),
    ),
    // Pendant nano : ses raccourcis, qu'un téléphone ne sait pas taper (pas de touche Ctrl).
    el('button', { type: 'button', class: 'pour-nano', 'data-touche': 'ctrl-o' }, `^O ${t('nano-write')}`),
    el('button', { type: 'button', class: 'pour-nano', 'data-touche': 'ctrl-x' }, `^X ${t('nano-quit')}`),
  );
  const following = el('button', { type: 'button', class: 'bouton principal' }, t('button-next'));
  const end = el('div', { class: 'fin', hidden: '' }, following);
  // Après un chapitre : la page de Les rouages du net qui explique son concept.
  const rouagesList = el('ul', {});
  const forUnderstand = el('aside', { class: 'pour-comprendre', hidden: '' }, el('p', {}, typo(t('rouages-intro'))), rouagesList);
  // Le carnet du sysadmin : les commandes déjà lancées, avec leur ligne du manuel.
  const accountNotebook = el('span', { class: 'compte' });
  const titleNotebook = el('span', {});
  const listNotebook = el('dl', {});
  const emptyNotebook = el('p', {}, typo(t('notebook-empty')));
  const exported = el('button', { type: 'button', class: 'lien' }, t('notebook-export'));
  const copyNotebook = el('button', { type: 'button', class: 'lien' }, t('notebook-copy-button'));
  const stateNotebook = el('span', { class: 'carnet-etat', role: 'status' });
  const actionsNotebook = el('p', { class: 'carnet-actions' }, exported, ' · ', copyNotebook, ' ', stateNotebook);
  const notebookPanel = el(
    'details',
    { class: 'carnet' },
    el('summary', {}, titleNotebook, ' ', accountNotebook),
    el('p', { class: 'carnet-aide' }, typo(t('notebook-help'))),
    emptyNotebook,
    listNotebook,
    actionsNotebook,
  );
  const restart = el('button', { type: 'button', class: 'lien' }, t('button-restart'));
  // Ma progression : un nom pour le carnet, et de quoi continuer sur une autre
  // machine (le code court, ou le fichier ; voir progression.ts).
  const progressButton = el('button', { type: 'button', class: 'lien', 'aria-haspopup': 'dialog' }, t('progress-button'));
  // Les succès et le grade : une fenêtre (voir succes.ts).
  const achievementsButton = el('button', { type: 'button', class: 'lien', 'aria-haspopup': 'dialog' });
  const tips = el('p', { class: 'astuces' }, typo(t('tips')), ' ', restart, ' · ', progressButton, ' · ', achievementsButton);
  const achievementsId = `qds-succes-${Math.random().toString(36).slice(2, 8)}`;
  const gradeAchievements = el('p', { class: 'succes-grade' });
  const listAchievements = el('ul', { class: 'succes-liste' });
  const closeAchievements = el('button', { type: 'button', class: 'bouton' }, t('map-close'));
  const achievementsWindow = el(
    'dialog',
    { class: 'fenetre-succes', 'aria-labelledby': achievementsId },
    el('h2', { id: achievementsId }, t('achievements-title')),
    gradeAchievements,
    listAchievements,
    el('p', { class: 'carte-actions' }, closeAchievements),
  ) as HTMLDialogElement;
  // L'astreinte : la fenêtre qui la propose, et celle de la carte de score à la fin.
  const onCallId = `qds-astreinte-${Math.random().toString(36).slice(2, 8)}`;
  const titleOnCall = el('h2', { id: onCallId });
  const chapterOnCall = el('p', { class: 'astreinte-chapitre' });
  const takeOnCall = el('button', { type: 'button', class: 'bouton' }, t('on-call-take'));
  const cancelOnCall = el('button', { type: 'button', class: 'bouton bouton-second' }, t('on-call-cancel'));
  const onCallWindow = el(
    'dialog',
    { class: 'fenetre-astreinte', 'aria-labelledby': onCallId },
    titleOnCall,
    el('p', { class: 'carte-legende' }, typo(t('on-call-intro'))),
    chapterOnCall,
    el('p', { class: 'carte-legende' }, typo(t('on-call-rules'))),
    el('p', { class: 'carte-actions' }, cancelOnCall, ' ', takeOnCall),
  ) as HTMLDialogElement;
  const onCallEndId = `qds-fin-astreinte-${Math.random().toString(36).slice(2, 8)}`;
  const scoreMap = el('pre', { class: 'carte-score' });
  const copyMap = el('button', { type: 'button', class: 'bouton' }, t('on-call-copy'));
  const mapState = el('p', { class: 'carte-legende', role: 'status' });
  const closeOnCallEnd = el('button', { type: 'button', class: 'bouton bouton-second' }, t('map-close'));
  const onCallEndWindow = el(
    'dialog',
    { class: 'fenetre-astreinte', 'aria-labelledby': onCallEndId },
    el('h2', { id: onCallEndId }, t('on-call-end-title')),
    el('p', { class: 'carte-legende' }, typo(t('on-call-end-intro'))),
    scoreMap,
    mapState,
    el('p', { class: 'carte-actions' }, closeOnCallEnd, ' ', copyMap),
  ) as HTMLDialogElement;
  // Le bilan de fin de chapitre : le détail, étape par étape (voir bilan.ts).
  const summaryId = `qds-bilan-${Math.random().toString(36).slice(2, 8)}`;
  const titleSummary = el('h2', { id: summaryId });
  const mapCaption = el('p', { class: 'carte-legende' });
  const tableSummary = el('div', { class: 'bilan-tableau', tabindex: '0', role: 'region', 'aria-labelledby': summaryId });
  const encourageSummary = el('p', { class: 'carte-legende' });
  const closeSummary = el('button', { type: 'button', class: 'bouton' }, t('map-close'));
  const summaryWindow = el(
    'dialog',
    { class: 'fenetre-bilan', 'aria-labelledby': summaryId },
    titleSummary,
    mapCaption,
    el('p', { class: 'carte-legende' }, typo(t('summary-intro'))),
    tableSummary,
    encourageSummary,
    el('p', { class: 'carte-actions' }, closeSummary),
  ) as HTMLDialogElement;
  const progressId = `qds-progression-${Math.random().toString(36).slice(2, 8)}`;
  const nameField = el('input', { type: 'text', id: `${progressId}-nom`, maxlength: '60', autocomplete: 'name', spellcheck: 'false' }) as HTMLInputElement;
  const currentCode = el('code', { class: 'code-progression' });
  const copyCode = el('button', { type: 'button', class: 'lien' }, t('progress-copy'));
  const codeField = el('input', { type: 'text', id: `${progressId}-code`, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', placeholder: 'QDS-…' }) as HTMLInputElement;
  const resumeCode = el('button', { type: 'button', class: 'bouton' }, t('progress-resume'));
  const download = el('button', { type: 'button', class: 'bouton' }, t('progress-download'));
  const fileField = el('input', { type: 'file', id: `${progressId}-fichier`, accept: '.json,application/json' }) as HTMLInputElement;
  const progressState = el('p', { class: 'progression-etat', role: 'status' });
  const closeProgress = el('button', { type: 'button', class: 'bouton' }, t('map-close'));
  const progressWindow = el(
    'dialog',
    { class: 'fenetre-progression', 'aria-labelledby': progressId },
    el('h2', { id: progressId }, t('progress-title')),
    el('p', { class: 'carte-legende' }, typo(t('progress-intro'))),
    el('h3', {}, el('label', { for: nameField.id }, t('progress-name'))),
    el('p', {}, nameField),
    el('p', { class: 'carte-legende' }, typo(t('progress-name-help'))),
    el('h3', {}, t('progress-code-title')),
    el('p', { class: 'carte-legende' }, typo(t('progress-code-help'))),
    el('p', {}, currentCode, ' ', copyCode),
    el('p', { class: 'progression-saisie' }, el('label', { for: codeField.id }, t('progress-code-input')), ' ', codeField, ' ', resumeCode),
    el('h3', {}, t('progress-file-title')),
    el('p', { class: 'carte-legende' }, typo(t('progress-file-help'))),
    el('p', {}, download),
    el('p', { class: 'progression-saisie' }, el('label', { for: fileField.id }, t('progress-file-input')), ' ', fileField),
    progressState,
    el('p', { class: 'carte-actions' }, closeProgress),
  ) as HTMLDialogElement;
  const credit = el('p', { class: 'credit' }, typo(t('credit')), ' ',
    el('a', { href: 'https://github.com/Rouages-du-net/quetes-de-sysadmin' }, t('credit-link-project')), ' · ',
    el('a', { href: 'https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html', hreflang: 'en' }, t('credit-link-original')));

  // Le terminal et sa barre de touches : ensemble en plein écran.
  const screen = el('div', { class: 'ecran' }, quitFocus, terminal, touchesBar);
  // La confirmation du mode examen : il fait recommencer le chapitre en cours.
  const examId = `qds-examen-${Math.random().toString(36).slice(2, 8)}`;
  const titleExam = el('h2', { id: examId });
  const textExam = el('p', { class: 'carte-legende' });
  const yesExam = el('button', { type: 'button', class: 'bouton' });
  const notExam = el('button', { type: 'button', class: 'bouton bouton-second' }, t('exam-cancel'));
  const examWindow = el(
    'dialog',
    { class: 'fenetre-examen', 'aria-labelledby': examId },
    titleExam,
    textExam,
    el('p', { class: 'carte-actions' }, notExam, ' ', yesExam),
  ) as HTMLDialogElement;
  const game = el('div', { class: 'qds', lang: t.language }, storiesNav, ...chaptersNavs, examBar, screen, end, forUnderstand, notebookPanel, tips, credit, mapWindow, progressWindow, missionWindow, achievementsWindow, summaryWindow, onCallWindow, onCallEndWindow, examWindow);
  root.append(game);

  // ——— Progression gardée dans ce navigateur ———
  // Meilleurs temps en mode examen (records, en ms) ; nom mis en tête du carnet (voir progression.ts).
  let saved: Backup = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {}
  const gameTerminal = new Console({ language: t.language, finished: saved.finished, knownHosts: saved.known, ssh: saved.ssh });
  // La largeur du terminal en caractères ($COLUMNS) : ls range ses colonnes dedans,
  // pour qu'un écran de téléphone n'ait pas à défiler de côté.
  const measure = el('span', { class: 'mesure', 'aria-hidden': 'true' }, '0'.repeat(20));
  output.appendChild(measure);
  const columnsUpdate = () => {
    const character = measure.getBoundingClientRect().width / 20;
    const width = output.clientWidth - parseFloat(getComputedStyle(output).paddingLeft) - parseFloat(getComputedStyle(output).paddingRight);
    if (character > 0 && width > 0) gameTerminal.columns = Math.max(20, Math.floor(width / character));
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(columnsUpdate).observe(output);
  const finished = gameTerminal.finished;
  const notebook: Notebook = saved.notebook && typeof saved.notebook === 'object' ? saved.notebook : {};
  const records: Record<string, number> = saved.records && typeof saved.records === 'object' ? saved.records : {};
  let playerName = typeof saved.name === 'string' ? cleanName(saved.name) : '';
  const achievements: Record<string, string> = saved.achievements && typeof saved.achievements === 'object' ? { ...saved.achievements } : {};
  gameTerminal.exam = saved.exam === true;
  examCase.checked = gameTerminal.exam;
  // Le début du chapitre en cours, en mode examen (null : pas de chrono).
  let examStart: number | null = null;
  // Histoire et chapitre en cours (-1 : sur le poste).
  const story = () => (gameTerminal.remote ? STORIES.indexOf(gameTerminal.remote.story) : -1);
  const active = () => (gameTerminal.remote ? gameTerminal.remote.story.chapters.indexOf(gameTerminal.remote.shell.chapter) : -1);
  const backupState = (): Backup => ({
    finished,
    story: gameTerminal.remote?.story.id ?? null,
    known: gameTerminal.knownHosts(),
    ssh: gameTerminal.ssh(),
    notebook,
    exam: gameTerminal.exam,
    records,
    ...(playerName ? { name: playerName } : {}),
    achievements,
  });
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(backupState()));
    } catch {}
  };
  const open = (h: number, c: number) => c === 0 || finished.includes(chapters(h)[c - 1].id);
  // L'attribut histoire ouvre son histoire même sans la clé (intégration dans un cours).
  const accessible = (h: number) => gameTerminal.isOpen(STORIES[h].id) || STORIES[h].id === options.story;

  const history: string[] = [];
  // La ligne après le dernier Tab (pour le double Tab de bash).
  let previousTab: string | null = null;
  let position = 0;

  // Les tableaux d'au moins trois colonnes (ls -l, ufw status, ss, ps…) ne
  // se replient pas : sur un petit écran, le bloc défile de côté. Le reste,
  // paragraphes et consignes (« tape :   ls »), passe à la ligne. Les traits
  // qui soulignent un tableau (------, ======) restent aussi d'un seul tenant.
  // Une tabulation sépare aussi des colonnes (dig).
  const inColumns = (line: string) => (line.match(/\S(?: {2,}|\t)(?=\S)/g) ?? []).length >= 2 || /^[-=]{20,}$/.test(line);
  const show = (text: string, cls?: string) => {
    if (!text) return;
    const pre = document.createElement('pre');
    let lines = text.split('\n');
    // Une sortie géante (ls d'un lieu de 60 000 fichiers) : comme l'historique
    // d'un terminal, on n'en garde que la fin, pour que la page reste fluide.
    if (lines.length > LINES_MAX) {
      const coupees = lines.length - LINES_MAX;
      lines = lines.slice(-LINES_MAX);
      output.appendChild(el('p', { class: 'coupure' }, t('output-cut', { lignes: coupees })));
    }
    // Une ligne soulignée par ^~~~ (sudo, compilateurs) : la ligne et son soulignement ne se replient pas.
    const underlined = (i: number) => /^\s*\^~*\s*$/.test(lines[i] ?? '');
    // Les couleurs des outils (séquences ANSI, voir couleurs.ts) deviennent des spans.
    const inColours = (line: string): (Node | string)[] =>
      line.includes('\x1b')
        ? chunks(line).map((m) => {
            const classes = [m.bold ? 'a-gras' : '', m.before !== null ? `a-${m.before}` : '', m.background !== null ? `a-${m.background}` : ''].filter(Boolean);
            return classes.length ? el('span', { class: classes.join(' ') }, m.text) : m.text;
          })
        : [line];
    lines.forEach((line, i) => {
      const end = i < lines.length - 1 ? '\n' : '';
      const visible = withoutColours(line);
      if (inColumns(visible) || /^\s*\^~*\s*$/.test(visible) || underlined(i + 1)) pre.append(el('span', { class: 'colonnes' }, ...inColours(line), end));
      else pre.append(...inColours(line), end);
    });
    if (cls) pre.className = cls;
    output.appendChild(pre);
  };

  // Ctrl-R : null hors recherche ; sinon ce que contenait la ligne avant, et la commande trouvée.
  let query: { before: string; match: string } | null = null;
  const promptUpdate = () => {
    prompt.textContent = gameTerminal.prompt();
    input.type = gameTerminal.shell.maskedInput() ? 'password' : 'text';
    colourInput();
  };

  // Les jetons colorés d'une ligne ; rien pour une réponse à une question
  // (yes/no, mot de passe, sftp>) ni quand la coloration est coupée.
  const tokens = (line: string): Token[] | null => {
    const sh = gameTerminal.shell;
    if (!display.colours || sh.maskedInput() || sh.question || sh.waiting) return null;
    return colourise(sh, line);
  };
  const inSpans = (js: Token[]) => js.map((j) => (j.kind === 'texte' ? j.text : el('span', { class: `c-${j.kind}` }, j.text)));
  const colourInput = () => {
    const js = query ? null : tokens(input.value);
    field.classList.toggle('colore', js !== null);
    coloration.replaceChildren(...(js ? inSpans(js) : []));
    coloration.scrollLeft = input.scrollLeft;
  };
  // La commande recopiée au-dessus de sa sortie, colorée comme pendant la frappe.
  const showCommand = (line: string, js: Token[] | null) => {
    if (!js) return show(`${prompt.textContent} ${line}`, 'cmd');
    output.appendChild(el('pre', { class: 'cmd' }, `${prompt.textContent} `, ...inSpans(js)));
  };

  // Le parcours choisi : chaque chapitre, son histoire, son état ; le prochain à faire est mis en avant.
  const pathUpdate = () => {
    const p = PATH.find((x) => x.id === display.parcours) ?? PATH[0];
    const { steps, next } = pathSteps(p, finished, (id) => accessible(STORIES.findIndex((x) => x.id === id)));
    const done = steps.filter((e) => e.state === 'fait').length;
    descriptionPath.textContent = typo(t(`path-${p.id}.description`));
    progressPath.textContent = done === steps.length ? t('path-finished') : t('path-progress', { faits: done, total: steps.length });
    pathList.replaceChildren(
      ...steps.map((e, i) => {
        const state =
          e.state === 'fait'
            ? t('path-done')
            : e.state === 'sans-cle'
              ? t('path-without-key')
              : e.state === 'verrouille'
                ? t('path-locked', { chapitre: t(`chapter-${e.before}`) })
                : i === next
                  ? t('path-next')
                  : t('path-open');
        const b = el(
          'button',
          { type: 'button', 'data-h': String(e.h), 'data-c': String(e.c), 'data-etat': e.state },
          el('span', { class: 'titre' }, t(`chapter-${e.chapter}`)),
          el('span', { class: 'resume' }, t('path-in', { histoire: storyTitle(e.h) })),
          level(difficulty(e.chapter)),
          el('span', { class: 'etat' }, state),
        );
        b.disabled = e.state === 'verrouille' || e.state === 'sans-cle';
        b.toggleAttribute('data-prochain', i === next);
        b.setAttribute('aria-current', String(e.h === story() && e.c === active()));
        return el('li', {}, b);
      }),
    );
  };

  const navUpdate = () => {
    workstationButton.setAttribute('aria-current', String(story() === -1));
    storiesBoutons.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === story()));
      b.disabled = !accessible(h);
      // Les histoires sans leur clé sont grisées : on avance de l'une à l'autre.
      b.toggleAttribute('data-verrouillee', !accessible(h));
      const done = chapters(h).filter((c) => finished.includes(c.id)).length;
      const next = chapters(h).findIndex((c) => !finished.includes(c.id));
      b.querySelectorAll('.diode').forEach((d, c) => {
        d.classList.toggle('allumee', finished.includes(chapters(h)[c].id));
        d.classList.toggle('en-cours', accessible(h) && c === next);
      });
      const total = chapters(h).length;
      // L'état de la machine sur la carte : son câble et son cadre s'allument.
      b.parentElement!.dataset.etat = !accessible(h) ? 'verrouillee' : done === chapters(h).length ? 'terminee' : done > 0 || h === story() ? 'en-cours' : 'ouverte';
      // Verrouillée : les chapitres qui manquent encore pour en recevoir la clé.
      const rest = missing(STORIES[h].id, finished);
      b.querySelector('.etat')!.textContent = !accessible(h)
        ? rest.length
          ? t('state-key-after', { chapitres: new Intl.ListFormat(t.language, { type: 'conjunction' }).format(rest.map((c) => t('state-key-chapter', { titre: t(`chapter-${c}`) }))) })
          : t('state-key-missing')
        : done === total
          ? t('state-story-finished')
          : total > 1
            ? t('state-chapters-done', { faits: done, total })
            : '';
    });
    keyHelp.hidden = storiesBoutons.every((b) => !b.disabled) || display.vue === 'parcours';
    pathUpdate();
    chaptersNavs.forEach((nav, h) => {
      nav.hidden = h !== story() || chapters(h).length < 2;
      nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) => {
        b.disabled = !open(h, c);
        b.setAttribute('aria-current', String(h === story() && c === active()));
        b.querySelector('.etat')!.textContent = finished.includes(chapters(h)[c].id)
          ? t('state-chapter-finished')
          : open(h, c)
            ? ''
            : t('state-locked');
      });
    });
    // « Chapitre suivant » : après un chapitre fini, s'il en reste un.
    const h = story();
    end.hidden = !(h >= 0 && gameTerminal.remote!.shell.finished && active() < chapters(h).length - 1);
    const links = h >= 0 && gameTerminal.remote!.shell.finished ? rouagesLinks(gameTerminal.remote!.shell.chapter.id) : [];
    forUnderstand.hidden = links.length === 0;
    rouagesList.replaceChildren(
      ...links.map((l) => el('li', {}, el('a', { href: l.address, hreflang: 'fr', target: '_blank', rel: 'noopener' }, typo(t(`rouages-link-${l.id}`))))),
    );
  };

  const notebookUpdate = () => {
    const names = Object.keys(notebook).sort((a, b) => a.localeCompare(b));
    titleNotebook.textContent = playerName ? t('notebook-title-of', { nom: playerName }) : t('notebook-title');
    accountNotebook.textContent = t('notebook-account', { nombre: names.length });
    emptyNotebook.hidden = names.length > 0;
    actionsNotebook.hidden = names.length === 0;
    listNotebook.replaceChildren(
      ...names.flatMap((name) => [
        el('dt', {}, el('code', {}, name)),
        el('dd', {}, typo(description(name, t)), ' ', el('code', { class: 'exemple' }, notebook[name].line)),
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
  const timerUpdate = () => {
    stopwatch.textContent = examStart === null ? '' : t('exam-timer', { temps: minutes(Date.now() - examStart) });
  };
  const timer = setInterval(() => {
    if (examStart !== null) timerUpdate();
    if (onCall) onCallUpdate();
  }, 1000);
  // Fin du chapitre en mode examen : le temps, et le record de ce navigateur.
  const examEnd = () => {
    if (examStart === null || !gameTerminal.remote?.shell.finished) return;
    const id = gameTerminal.remote.shell.chapter.id;
    const time = Date.now() - examStart;
    const old = records[id];
    if (old === undefined || time < old) records[id] = time;
    show(t(old === undefined || time < old ? 'exam-finished-record' : 'exam-finished', { temps: minutes(time), record: minutes(records[id]) }), 'examen-resultat');
    examStart = null;
    timerUpdate();
  };

  // Les succès obtenus par la dernière ligne (sh : sa session ; null : hors d'une ligne).
  const checkAchievements = (sh: Shell | null) => {
    for (const id of newAchievements({ sh, finished, notebook, records }, achievements)) {
      achievements[id] = new Date().toISOString();
      show(t('achievements-obtained', { nom: t(`achievements-${id}`) }), 'succes');
    }
    achievementsUpdate();
  };
  const achievementsUpdate = () => {
    achievementsButton.textContent = t('achievements-button', { obtenus: Object.keys(achievements).length, total: ACHIEVEMENTS.length });
  };
  // Le bilan : le temps passé se compte depuis la première fois qu'on voit le chapitre en cours.
  const debuts = new WeakMap<Shell, number>();
  const inCourse = new WeakSet<Shell>();
  const doneSummary = new WeakSet<Shell>();
  const summaryText = (sh: Shell) => {
    const b = summary(sh);
    return t('summary-summary', { temps: minutes(Date.now() - (debuts.get(sh) ?? Date.now())), commandes: b.commands, erreurs: b.errors, indices: b.hints });
  };
  const openSummary = (sh: Shell, recap: string) => {
    const b = summary(sh);
    titleSummary.textContent = t('summary-title', { chapitre: t(`chapter-${sh.chapter.id}`) });
    mapCaption.textContent = recap;
    encourageSummary.textContent = t('summary-encourage', { indices: b.hints });
    tableSummary.replaceChildren(
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...['summary-col-step', 'summary-col-you', 'summary-col-reference'].map((k) => el('th', { scope: 'col' }, t(k))))),
        el(
          'tbody',
          {},
          ...b.steps.map((e, i) =>
            el(
              'tr',
              {},
              el('th', { scope: 'row' }, String(i + 1)),
              el('td', { 'data-titre': t('summary-col-you') }, e.line === null ? el('span', { class: 'bilan-autrement' }, t('summary-otherwise')) : el('code', {}, e.line)),
              el('td', { 'data-titre': t('summary-col-reference') }, typo(e.solution)),
            ),
          ),
        ),
      ),
    );
    summaryWindow.showModal();
  };
  const noteSummary = () => {
    const sh = gameTerminal.remote?.shell;
    if (!sh) return;
    if (!debuts.has(sh)) debuts.set(sh, Date.now());
    if (!sh.finished) inCourse.add(sh);
    // Un chapitre qu'on a vu en cours et qui vient de finir : son bilan, une fois.
    if (!sh.finished || !inCourse.has(sh) || doneSummary.has(sh)) return;
    doneSummary.add(sh);
    const recap = summaryText(sh);
    const detail = el('button', { type: 'button', class: 'lien bouton-bilan', 'aria-haspopup': 'dialog' }, t('summary-button'));
    detail.addEventListener('click', () => openSummary(sh, recap));
    output.appendChild(el('p', { class: 'bilan' }, recap, ' ', detail));
  };
  closeSummary.addEventListener('click', () => summaryWindow.close());
  summaryWindow.addEventListener('close', () => setTimeout(() => input.focus()));

  const after = (sh: Shell | null = null) => {
    noteSummary();
    onCallUpdate();
    examEnd();
    checkAchievements(sh);
    notebookUpdate();
    promptUpdate();
    navUpdate();
    save();
    terminal.scrollTop = terminal.scrollHeight;
  };

  // Les raccourcis du menu : un écran neuf, directement sur la bonne machine.
  const goWorkstation = () => {
    followEnd();
    examStart = null;
    timerUpdate();
    output.replaceChildren(measure);
    if (gameTerminal.remote) gameTerminal.disconnect();
    show(`— ${t('workstation-title')} —`);
    show(gameTerminal.resetWorkstation());
    after();
  };
  const launch = (h: number, c?: number) => {
    followEnd();
    output.replaceChildren(measure);
    const chapter = c === undefined ? undefined : chapters(h)[c];
    if (gameTerminal.remote?.story === STORIES[h] && chapter) show(gameTerminal.open(chapter));
    else show(gameTerminal.connect(storyMachine(STORIES[h].id)!.name, chapter));
    // En mode examen, un chapitre qui (re)commence lance le chrono ; un chapitre déjà fini, non.
    examStart = gameTerminal.exam && !gameTerminal.remote?.shell.finished ? Date.now() : null;
    if (examStart !== null) show(t('exam-start'), 'examen-resultat');
    timerUpdate();
    after();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value;
    // Un mot de passe ne s'affiche pas et ne va pas dans l'historique.
    const secret = gameTerminal.shell.maskedInput();
    const response = secret || gameTerminal.shell.question !== null;
    if (secret) show(prompt.textContent ?? '', 'cmd');
    else showCommand(line, response ? null : tokens(line));
    if (line.trim() && !response) history.push(line);
    position = history.length;
    const shell = gameTerminal.shell;
    const hostBefore = shell.host;
    // La taille du texte a pu changer (A+, A−) : la largeur en caractères aussi.
    columnsUpdate();
    const result = gameTerminal.execute(line);
    // Une réponse à une question (un mot de passe…) n'est pas une commande pour le carnet.
    if (!response) note(notebook, shell);
    const lineFor = response ? null : shell;
    if (result === null) output.replaceChildren(measure);
    else show(result);
    // Les mises en scène : la connexion à une autre machine, le redémarrage.
    if (gameTerminal.shell.host !== hostBefore) putInScene(shell.last.commands.some((c) => c.includes('reboot')) ? 'reboot' : 'connexion');
    input.value = '';
    after(lineFor);
    openEditor();
    openFollow();
  });

  // Un suivi (tail -f, journalctl -f) : l'écran fait passer le temps sur la
  // machine (SUIVI_SECONDES par seconde réelle) et affiche ce qui arrive.
  let followTimer: number | null = null;
  const followEnd = () => {
    if (followTimer !== null) clearInterval(followTimer);
    followTimer = null;
    followStop.hidden = true;
    form.hidden = false;
    if (touchesBar.dataset.mode === 'suivi') delete touchesBar.dataset.mode;
  };
  const stopFollow = () => {
    if (followTimer === null) return;
    followEnd();
    show(gameTerminal.interrupt());
    after();
    input.focus();
  };
  const openFollow = () => {
    if (!gameTerminal.follows) return;
    form.hidden = true;
    touchesBar.dataset.mode = 'suivi';
    followStop.hidden = false;
    followStop.focus();
    followTimer = window.setInterval(() => {
      const fresh = gameTerminal.follow(SECONDS_FOLLOW);
      if (!fresh) return;
      show(fresh, 'suivi');
      after();
    }, 1000);
  };
  followStop.addEventListener('click', stopFollow);
  followStop.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'c') || e.key === 'Escape') {
      e.preventDefault();
      stopFollow();
    }
  });

  // nano : l'éditeur prend la place de la ligne de commande jusqu'à ^X.
  const openEditor = () => {
    const edition = gameTerminal.edition;
    if (!edition) return;
    form.hidden = true;
    touchesBar.dataset.mode = 'nano';
    terminal.append(
      editor({
        t,
        path: edition.path,
        text: edition.text,
        message: edition.message,
        save: (text) => gameTerminal.save(text),
        close: () => {
          show(gameTerminal.quitEdition());
          form.hidden = false;
          delete touchesBar.dataset.mode;
          after();
          input.focus();
        },
      }),
    );
    terminal.scrollTop = terminal.scrollHeight;
  };

  const search = (moreOld = false) => {
    if (!query) return;
    const since = moreOld ? history.lastIndexOf(query.match) - 1 : history.length - 1;
    let found = '';
    for (let i = since; i >= 0; i--)
      if (history[i].includes(input.value)) {
        found = history[i];
        break;
      }
    if (found || !moreOld) query.match = found;
    match.textContent = t('search-history', { motif: input.value, commande: query.match });
  };
  const finishSearch = (keep: boolean) => {
    if (!query) return;
    input.value = keep ? query.match || input.value : query.before;
    query = null;
    match.textContent = '';
  };
  input.addEventListener('input', () => {
    search();
    colourInput();
  });
  // Après une touche (Tab, ↑, Ctrl-R…), la ligne a pu changer ; le champ a pu défiler.
  input.addEventListener('keydown', () => setTimeout(colourInput));
  for (const event of ['scroll', 'select', 'keyup', 'click']) input.addEventListener(event, () => (coloration.scrollLeft = input.scrollLeft));
  input.addEventListener('keydown', (e) => {
    if (gameTerminal.shell.waiting || gameTerminal.shell.question) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      if (query) search(true);
      else {
        query = { before: input.value, match: '' };
        input.value = '';
        search();
      }
      return;
    }
    if (query) {
      if (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        finishSearch(false);
        return;
      }
      if (e.key === 'Enter' || e.key.startsWith('Arrow') || e.key === 'Tab') finishSearch(true);
      if (e.key === 'Enter') return;
    }
    // Ctrl-C sans rien de sélectionné : la ligne est abandonnée, comme dans bash.
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      show(`${prompt.textContent} ${input.value}^C`, 'cmd');
      input.value = '';
      position = history.length;
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const before = input.value;
      input.value = gameTerminal.complete(before);
      // Comme bash : un deuxième Tab sans rien de plus à compléter montre les possibilités.
      if (input.value === before && previousTab === before) {
        const listing = gameTerminal.suggestions(before);
        if (listing) {
          show(`${prompt.textContent} ${before}`, 'cmd');
          show(listing, 'suggestions');
          terminal.scrollTop = terminal.scrollHeight;
        }
      }
      previousTab = input.value;
      return;
    }
    previousTab = null;
    if (e.key === 'ArrowUp' && position > 0) {
      e.preventDefault();
      input.value = history[--position];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      position = Math.min(position + 1, history.length);
      input.value = history[position] ?? '';
    }
  });

  // Copier-coller comme dans la plupart des terminaux Linux : le texte
  // sélectionné est copié, le clic droit (ou celui du milieu) le colle.
  // Maj + clic droit garde le menu du navigateur. Au doigt (ou au stylet),
  // l'appui long sélectionne le texte et ouvre le menu du téléphone : le jeu
  // n'y touche pas (un appui long envoie lui aussi contextmenu).
  let pointer = 'mouse';
  terminal.addEventListener('pointerdown', (e) => (pointer = e.pointerType), { passive: true });
  const mouse = (e: MouseEvent) => ((e as PointerEvent).pointerType || pointer) === 'mouse';
  const selection = () => ((root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? window.getSelection())?.toString() ?? '';
  let copyOf = '';
  terminal.addEventListener('mouseup', (e) => {
    if (!mouse(e)) return;
    const text = selection();
    if (!text) return;
    copyOf = text;
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  const paste = async (e: MouseEvent) => {
    e.preventDefault();
    let text = copyOf;
    if (!text) text = (await navigator.clipboard?.readText().catch(() => '')) ?? '';
    if (!text) return;
    const nano = terminal.querySelector('textarea');
    // Dans nano, le texte garde ses lignes ; sur la ligne de commande, il tient sur une ligne.
    const target = nano ?? input;
    if (!nano) text = text.replace(/\s*\n\s*/g, ' ').trim();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, 'end');
    target.focus();
    colourInput();
  };
  terminal.addEventListener('contextmenu', (e) => {
    if (!e.shiftKey && mouse(e)) paste(e);
  });
  terminal.addEventListener('auxclick', (e) => {
    if (e.button === 1) paste(e);
  });
  terminal.addEventListener('click', () => {
    if (!form.hidden && !selection()) input.focus();
  });
  pathList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-h]');
    if (!b || b.disabled) return;
    launch(Number(b.dataset.h), Number(b.dataset.c));
    input.focus();
  });
  pathChoice.addEventListener('change', () => {
    display.parcours = pathChoice.value;
    applyDisplay();
  });
  workstationButton.addEventListener('click', () => {
    goWorkstation();
    input.focus();
  });
  storiesBoutons.forEach((b, h) =>
    b.addEventListener('click', () => {
      launch(h);
      input.focus();
    }),
  );
  chaptersNavs.forEach((nav, h) =>
    nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) =>
      b.addEventListener('click', () => {
        launch(h, c);
        input.focus();
      }),
    ),
  );
  following.addEventListener('click', () => {
    launch(story(), active() + 1);
    input.focus();
  });
  // Le carnet s'emporte : un fichier Markdown, ou le presse-papiers.
  const markdown = () => inMarkdown(notebook, t, finished, playerName);
  exported.addEventListener('click', () => {
    const link = el('a', { href: URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' })), download: t('notebook-file') });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  copyNotebook.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(markdown())
      .then(() => (stateNotebook.textContent = t('notebook-copy')))
      .catch(() => (stateNotebook.textContent = t('notebook-copy-impossible')));
  });
  // ——— L'astreinte ———
  // Les résultats des jours passés, dans ce navigateur (le meilleur de chaque jour).
  const ON_CALL_KEY = `${KEY}-astreinte`;
  type Result = { chapter: string; remaining: number; time: number; hints: number; errors: number };
  let results: Record<string, Result> = {};
  try {
    results = JSON.parse(localStorage.getItem(ON_CALL_KEY) ?? '{}') ?? {};
  } catch {}
  // La date du jour (AAAA-MM-JJ, heure locale) : la même partout le même jour.
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const longDate = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'long' }).format(new Date(`${iso}T12:00:00`));
  let onCall: { date: string; chapter: string; start: number; sh: Shell | null; epuise: boolean } | null = null;
  // L'incident du jour est tiré parmi les histoires déjà ouvertes (null : aucune encore).
  const incident = (date = today()) => dayIncident(date, (h) => gameTerminal.isOpen(h));
  const incidentUpdate = () => {
    const id = incident();
    incidentButton.disabled = !id || onCall !== null;
    const done = results[today()];
    incidentText.textContent = !id
      ? t('on-call-locked')
      : done
        ? t('on-call-already', { pourcent: percent(done.remaining) })
        : t('on-call-today', { chapitre: t(`chapter-${id}`), histoire: storyTitle(placeFor(id).h) });
  };
  incidentButton.addEventListener('click', () => {
    const id = incident();
    if (!id) return;
    titleOnCall.textContent = t('on-call-title', { date: longDate(today()) });
    chapterOnCall.textContent = t('on-call-today', { chapitre: t(`chapter-${id}`), histoire: storyTitle(placeFor(id).h) });
    onCallWindow.showModal();
  });
  cancelOnCall.addEventListener('click', () => onCallWindow.close());
  onCallWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  takeOnCall.addEventListener('click', () => {
    onCallWindow.close();
    const date = today();
    const chapter = incident(date);
    if (!chapter) return;
    // D'astreinte, les indices sont permis (ils coûtent) : pas de mode examen.
    examCase.checked = false;
    gameTerminal.exam = false;
    const { h, c } = placeFor(chapter);
    launch(h, c);
    onCall = { date, chapter, start: Date.now(), sh: gameTerminal.remote?.shell ?? null, epuise: false };
    // Pendant l'astreinte, pas de seconde astreinte : le bouton revient à la fin (ou à l'abandon).
    incidentButton.disabled = true;
    show(t('on-call-start'), 'succes');
    onCallUpdate();
    input.focus();
  });
  // À chaque seconde et après chaque commande : la jauge, l'abandon, la fin.
  const onCallUpdate = () => {
    if (!onCall) {
      onCallGauge.hidden = true;
      incidentUpdate();
      return;
    }
    const here = gameTerminal.remote?.shell;
    // Un autre chapitre ouvert : l'astreinte est abandonnée (passer par le poste, non).
    if (here && here.chapter.id !== onCall.chapter) {
      onCall = null;
      show(t('on-call-abandon'));
      return onCallUpdate();
    }
    if (here) onCall.sh = here;
    const sh = onCall.sh;
    if (!sh) return;
    const elapsed = Date.now() - onCall.start;
    const remaining = remainingBudget(elapsed, sh.requestsHints.size, sh.commandsInError);
    onCallGauge.hidden = false;
    onCallGauge.textContent = t('on-call-gauge', { temps: minutes(remaining), pourcent: percent(remaining) });
    onCallGauge.classList.toggle('bas', remaining < 5 * 60 * 1000);
    if (remaining === 0 && !onCall.epuise) {
      onCall.epuise = true;
      show(t('on-call-exhausted'), 'examen-resultat');
    }
    if (!sh.finished) return;
    // L'incident est réglé : le résultat (le meilleur du jour est gardé), puis la carte de score.
    const r: Result = { chapter: onCall.chapter, remaining, time: elapsed, hints: sh.requestsHints.size, errors: sh.commandsInError };
    const before = results[onCall.date];
    if (!before || r.remaining > before.remaining) results[onCall.date] = r;
    try {
      localStorage.setItem(ON_CALL_KEY, JSON.stringify(results));
    } catch {}
    scoreMap.textContent = t('on-call-map', {
      date: onCall.date,
      chapitre: t(`chapter-${r.chapter}`),
      temps: minutes(r.time),
      jauge: gauge(r.remaining),
      pourcent: percent(r.remaining),
      indices: r.hints,
      erreurs: r.errors,
      adresse: 'https://sysadmin.rouages.net',
    });
    mapState.textContent = '';
    onCall = null;
    onCallUpdate();
    onCallEndWindow.showModal();
  };
  copyMap.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(scoreMap.textContent ?? '')
      .then(() => (mapState.textContent = t('on-call-copied')))
      .catch(() => {});
  });
  closeOnCallEnd.addEventListener('click', () => onCallEndWindow.close());
  onCallEndWindow.addEventListener('close', () => setTimeout(() => input.focus()));

  const applyExam = (yes: boolean) => {
    examCase.checked = yes;
    gameTerminal.exam = yes;
    // Le chapitre en cours recommence : en examen, sur une machine neuve et chrono à zéro.
    if (story() >= 0) launch(story(), active());
    else after();
  };
  let wantedExam = false;
  examCase.addEventListener('change', () => {
    const wanted = examCase.checked;
    const sh = gameTerminal.remote?.shell;
    // Un chapitre commencé et pas fini : on demande avant de le faire recommencer.
    const inCourse = !!sh && !sh.finished && (gameTerminal.not ?? 1) > 0;
    if (!inCourse) return applyExam(wanted);
    examCase.checked = !wanted;
    wantedExam = wanted;
    titleExam.textContent = t(wanted ? 'exam-confirm-title' : 'exam-quit-title');
    textExam.textContent = typo(t(wanted ? 'exam-confirm-text' : 'exam-quit-text'));
    yesExam.textContent = t(wanted ? 'exam-confirm' : 'exam-quit');
    examWindow.showModal();
    notExam.focus();
  });
  yesExam.addEventListener('click', () => {
    examWindow.close();
    applyExam(wantedExam);
  });
  notExam.addEventListener('click', () => examWindow.close());
  examWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // Un lieu de la carte : son nom, ses repères en toutes lettres (lus aussi
  // par les lecteurs d'écran), puis les lieux qu'il contient.
  const drawPlace = (l: Place): HTMLElement => {
    const landmarks = [l.home && t('map-home'), l.closed && t('map-closed'), !l.visit && t('map-preview')].filter(Boolean).join(', ');
    return el(
      'li',
      { class: [l.visit ? 'visite' : 'apercu', l.here ? 'ici' : ''].join(' ').trim(), ...(l.here ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'nom' }, l.name === '/' ? '/' : `${l.name}/`),
      ...(landmarks ? [' ', el('span', { class: 'reperes' }, `(${landmarks})`)] : []),
      ...(l.here ? [' ', el('strong', { class: 'vous-etes-ici' }, t('map-here'))] : []),
      ...(l.children.length ? [el('ul', {}, ...l.children.map(drawPlace))] : []),
    );
  };
  // Le plan du réseau : un schéma (arbre couché, une colonne par niveau) et la même chose en liste.
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (name: string, attrs: Record<string, string>, ...children: (Node | string)[]) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...children);
    return e;
  };
  const WIDTH = 176;
  const HEIGHT = 54;
  const X_DIFFERENCE = 36;
  const Y_DIFFERENCE = 22;
  const classesPlan = (e: ElementPlan, here: string, visited: Set<string>) => {
    const r = planLandmarks(e, here, visited);
    return [e.role, r.here ? 'ici' : '', e.host && !r.visit ? 'pas-visite' : ''].filter(Boolean).join(' ');
  };
  const drawPlan = (root: ElementPlan, here: string, visited: Set<string>) => {
    const { places, columns, lines } = layOut(root);
    const x = (c: number) => 2 + c * (WIDTH + X_DIFFERENCE);
    const y = (l: number) => Y_DIFFERENCE + l * (HEIGHT + Y_DIFFERENCE);
    const width = x(columns) - X_DIFFERENCE + 2;
    const height = y(lines);
    const links = places
      .filter((p) => p.parent)
      .map((p) => {
        const forEachOf = p.parent!;
        const middle = x(forEachOf.column) + WIDTH + X_DIFFERENCE / 2;
        return svg('path', {
          class: p.element.tunnel ? 'lien tunnel' : 'lien',
          d: `M${x(forEachOf.column) + WIDTH} ${y(forEachOf.line) + HEIGHT / 2} H${middle} V${y(p.line) + HEIGHT / 2} H${x(p.column)}`,
        });
      });
    const boites = places.map((p) => {
      const e = p.element;
      const bx = x(p.column);
      const by = y(p.line);
      return svg(
        'g',
        { class: `boite ${classesPlan(e, here, visited)}` },
        svg('rect', { x: String(bx), y: String(by), width: String(WIDTH), height: String(HEIGHT), rx: e.role === 'internet' ? '27' : '6' }),
        // Un nom seul (Internet) se centre dans sa boîte.
        svg('text', { x: String(bx + 10), y: String(by + (e.address || e.note ? 19 : HEIGHT / 2 + 5)), class: 'nom' }, e.name),
        ...(e.address ? [svg('text', { x: String(bx + 10), y: String(by + 34), class: 'adresse' }, e.address)] : []),
        ...(e.note ? [svg('text', { x: String(bx + 10), y: String(by + 48), class: 'note' }, e.note)] : []),
        ...(planLandmarks(e, here, visited).here ? [svg('text', { x: String(bx), y: String(by - 6), class: 'repere-ici' }, `▼ ${t('plan-here')}`)] : []),
      );
    });
    return svg('svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), 'aria-hidden': 'true', focusable: 'false' }, ...links, ...boites);
  };
  const drawElement = (e: ElementPlan, here: string, visited: Set<string>): HTMLElement => {
    const r = planLandmarks(e, here, visited);
    const notes = [e.note, e.tunnel && t('plan-tunnel'), e.host && (r.visit ? t('plan-visit') : t('plan-not-visit'))].filter(Boolean).join(', ');
    return el(
      'li',
      { class: classesPlan(e, here, visited), ...(r.here ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'nom' }, e.name),
      ...(e.address ? [' ', el('code', {}, e.address)] : []),
      ...(notes ? [' ', el('span', { class: 'reperes' }, `(${notes})`)] : []),
      ...(r.here ? [' ', el('strong', { class: 'vous-etes-ici' }, `← ${t('plan-here')}`)] : []),
      ...(e.children?.length ? [el('ul', {}, ...e.children.map((x) => drawElement(x, here, visited)))] : []),
    );
  };
  const chooseTab = (network: boolean) => {
    placesTab.setAttribute('aria-selected', String(!network));
    networkTab.setAttribute('aria-selected', String(network));
    placesTab.tabIndex = network ? -1 : 0;
    networkTab.tabIndex = network ? 0 : -1;
    placesPanel.hidden = network;
    networkPanel.hidden = !network;
  };
  placesTab.addEventListener('click', () => chooseTab(false));
  networkTab.addEventListener('click', () => chooseTab(true));
  // Les flèches passent d'un onglet à l'autre (comme dans toute liste d'onglets).
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const network = placesTab.getAttribute('aria-selected') === 'true';
    chooseTab(network);
    (network ? networkTab : placesTab).focus();
    e.preventDefault();
  });
  mapButton.addEventListener('click', () => {
    const sh = gameTerminal.shell;
    titleMap.textContent = t('map-title', { machine: sh.host });
    treeMap.replaceChildren(el('ul', { class: 'arbre' }, drawPlace(map(sh))));
    const plan = gameTerminal.remote?.shell.chapter.plan?.(t);
    tabs.hidden = !plan;
    if (plan) {
      planSchema.replaceChildren(drawPlan(plan, sh.host, gameTerminal.visited));
      listPlan.replaceChildren(el('ul', { class: 'arbre' }, drawElement(plan, sh.host, gameTerminal.visited)));
      // Sur un petit écran, le schéma défile dans sa boîte : la liste s'ouvre d'office.
      textPlan.open = matchMedia('(max-width: 40rem)').matches;
    }
    chooseTab(false);
    mapWindow.showModal();
    mapWindow.querySelector('.ici')?.scrollIntoView({ block: 'center' });
  });
  // La fenêtre fermée (bouton ou Échap), on reprend la ligne de commande :
  // après que le navigateur a rendu le focus au bouton qui l'avait ouverte.
  closeMap.addEventListener('click', () => mapWindow.close());
  mapWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // La barre de touches : chaque bouton agit sur la ligne sans lui prendre le
  // focus (le clavier du téléphone reste ouvert).
  touchesBar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  });
  touchesBar.addEventListener('click', (e) => {
    const pressedKey = (e.target as HTMLElement).closest('button')?.dataset.touche;
    if (!pressedKey) return;
    // Pendant un suivi (tail -f), Ctrl-C l'arrête.
    if (followTimer !== null) {
      if (pressedKey === 'ctrl-c') stopFollow();
      return;
    }
    // Dans nano, ^O, ^X et ^C vont à l'éditeur, comme tapés au clavier.
    const zone = terminal.querySelector<HTMLTextAreaElement>('.nano-texte');
    if (form.hidden) {
      if (zone && pressedKey.startsWith('ctrl-')) zone.dispatchEvent(new KeyboardEvent('keydown', { key: pressedKey.slice(5), ctrlKey: true, bubbles: true, cancelable: true }));
      return;
    }
    if (pressedKey.length === 1) {
      // Comme une frappe : le clavier du téléphone (et sa saisie en cours) le voit passer,
      // et la ligne colorée est redessinée tout de suite (événement input).
      input.focus();
      if (!document.execCommand?.('insertText', false, pressedKey)) {
        input.setRangeText(pressedKey, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    else {
      const [ctrl, key] = pressedKey === 'ctrl-c' ? [true, 'c'] : [false, pressedKey];
      input.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, cancelable: true }));
    }
    input.focus();
  });
  // La mission du chapitre en cours.
  missionButton.addEventListener('click', () => {
    const sh = gameTerminal.remote?.shell;
    const c = sh?.chapter;
    titleMission.textContent = c ? t('mission-title', { chapitre: t('chapter-number', { numero: c.number }), titre: t(`chapter-${c.id}`) }) : t('workstation-title');
    goalMission.textContent = c ? typo(t(`chapter-${c.id}.resume`)) : '';
    instructionsMission.textContent = (sh ?? gameTerminal.workstation).read(`${(sh ?? gameTerminal.workstation).home}/${(sh ?? gameTerminal.workstation).welcome}`) ?? '';
    const log = sh?.log ?? [];
    emptyMission.hidden = log.length > 0;
    logMission.replaceChildren(...log.map((m) => el('li', {}, el('pre', { class: 'mission-texte' }, m))));
    helpUpdate();
    rescueUpdate();
    missionWindow.showModal();
  });
  closeMission.addEventListener('click', () => missionWindow.close());
  // L'instantané pris : sa série (l'ouverture du chapitre) et le nombre de saisies rejouées.
  let snapshot: { serial: number; not: number } | null = null;
  const rescueUpdate = () => {
    const sh = gameTerminal.remote?.shell;
    rescue.hidden = !sh;
    if (!sh) return;
    const not = gameTerminal.not;
    if (snapshot && snapshot.serial !== gameTerminal.serial) snapshot = null;
    const possible = not !== null && !gameTerminal.exam;
    takeSnapshot.disabled = !possible;
    goBackSnapshot.disabled = !possible || !snapshot || snapshot.not > not!;
    cancelInput.disabled = !possible || not === 0;
    rescueState.textContent = gameTerminal.exam
      ? t('rescue-exam')
      : not === null
        ? t('rescue-impossible')
        : snapshot
          ? t('rescue-taken', { pas: snapshot.not })
          : t('rescue-none');
  };
  takeSnapshot.addEventListener('click', () => {
    const not = gameTerminal.not;
    if (not === null) return;
    snapshot = { serial: gameTerminal.serial, not };
    rescueUpdate();
  });
  // Revenir en arrière : la machine du chapitre est rejouée jusqu'à ce point ; le temps du bilan continue.
  const restore = (not: number) => {
    const old = gameTerminal.remote?.shell;
    followEnd();
    if (!old || !gameTerminal.restore(not)) return;
    const fresh = gameTerminal.remote!.shell;
    if (debuts.has(old)) debuts.set(fresh, debuts.get(old)!);
    if (inCourse.has(old)) inCourse.add(fresh);
    if (doneSummary.has(old) && fresh.finished) doneSummary.add(fresh);
    missionWindow.close();
    output.replaceChildren(measure);
    show(t('rescue-restored', { pas: not }), 'succes');
    after();
    // Revenu au milieu d'un tail -f : il continue.
    openFollow();
  };
  goBackSnapshot.addEventListener('click', () => snapshot && restore(snapshot.not));
  cancelInput.addEventListener('click', () => {
    const not = gameTerminal.not;
    if (not) restore(not - 1);
  });
  // L'aide du chapitre en cours : les niveaux déjà ouverts pour cette étape restent visibles.
  const helpUpdate = () => {
    const sh = gameTerminal.remote?.shell;
    help.hidden = !sh || gameTerminal.exam || sh.finished;
    if (help.hidden || !sh) return;
    const i = hint(sh);
    const openSet = HINT_LEVELS.filter((n) => sh.requestsHints.has(`${i.step ?? ''}:${n}`) || (n === 'manuel' && sh.requestsHints.has(`:${n}`)));
    const blocks: HTMLElement[] = [];
    if (openSet.includes('manuel')) blocks.push(el('p', {}, t('hint-manual', { pages: i.manual.map((c) => `man ${c}`).join(', ') })));
    if (openSet.includes('piste') && i.lead) blocks.push(el('p', {}, typo(i.lead)));
    if (openSet.includes('solution') && i.solution) blocks.push(el('pre', { class: 'mission-texte' }, i.solution));
    if (!i.step && openSet.length < 3) blocks.push(el('p', { class: 'carte-legende' }, typo(t('hint-more-nothing'))));
    hintText.replaceChildren(...blocks);
    // Un niveau à la fois : le suivant s'ouvre quand le précédent a été lu.
    HINT_LEVELS.forEach((n, k) => {
      const b = hintBoutons[n];
      b.hidden = openSet.includes(n) || (k > 0 && !openSet.includes(HINT_LEVELS[k - 1])) || (n !== 'manuel' && !i.step);
    });
  };
  help.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).closest('button')?.dataset.niveau as HintLevel | undefined;
    const sh = gameTerminal.remote?.shell;
    if (!n || !sh) return;
    sh.requestsHints.add(`${n === 'manuel' ? '' : (hint(sh).step ?? '')}:${n}`);
    helpUpdate();
    hintText.lastElementChild?.scrollIntoView({ block: 'nearest' });
  });
  missionWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // ——— L'affichage du terminal ———
  // Un réglage de ce navigateur seulement (pas de la progression).
  const applyDisplay = () => {
    if (!THEMES.includes(display.theme)) display.theme = 'phosphore';
    display.size = Math.max(0, Math.min(SIZES.length - 1, Math.round(display.size) || 0));
    terminal.dataset.theme = display.theme;
    terminal.style.setProperty('--qds-taille-terminal', `${SIZES[display.size]}rem`);
    themeChoice.value = display.theme;
    if (!(VIEWS as readonly string[]).includes(display.vue)) display.vue = 'reseau';
    storiesNav.dataset.vue = display.vue;
    storiesList.hidden = display.vue === 'parcours';
    pathBlock.hidden = display.vue !== 'parcours';
    if (!PATH.some((p) => p.id === display.parcours)) display.parcours = PATH[0].id;
    pathChoice.value = display.parcours;
    navUpdate();
    display.colours = display.colours !== false;
    gameTerminal.colours = display.colours;
    coloursButton.setAttribute('aria-pressed', String(display.colours));
    colourInput();
    VIEWS.forEach((v) => viewBoutons[v].setAttribute('aria-pressed', String(v === display.vue)));
    moreSmall.disabled = display.size === 0;
    moreGrand.disabled = display.size === SIZES.length - 1;
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
    } catch {}
  };
  VIEWS.forEach((v) =>
    viewBoutons[v].addEventListener('click', () => {
      display.vue = v;
      applyDisplay();
    }),
  );
  themeChoice.addEventListener('change', () => {
    display.theme = themeChoice.value;
    applyDisplay();
  });
  coloursButton.addEventListener('click', () => {
    display.colours = !display.colours;
    applyDisplay();
  });
  moreSmall.addEventListener('click', () => {
    display.size--;
    applyDisplay();
  });
  moreGrand.addEventListener('click', () => {
    display.size++;
    applyDisplay();
  });
  // Le plein écran : le terminal (et sa barre de touches) prend toute la fenêtre ; Échap en sort.
  const toggleFocus = (enabled: boolean) => {
    screen.classList.toggle('focus', enabled);
    focusButton.setAttribute('aria-pressed', String(enabled));
    input.focus();
  };
  focusButton.addEventListener('click', () => toggleFocus(!screen.classList.contains('focus')));
  quitFocus.addEventListener('click', () => toggleFocus(false));
  screen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && screen.classList.contains('focus') && !query) toggleFocus(false);
  });
  applyDisplay();
  // Les mises en scène (sauf si le système demande moins d'animations) : une
  // connexion qui s'établit, un écran qui s'éteint au redémarrage.
  const putInScene = (what: 'connexion' | 'reboot') => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    terminal.classList.remove('scene-connexion', 'scene-reboot');
    void terminal.offsetWidth;
    terminal.classList.add(`scene-${what}`);
  };
  terminal.addEventListener('animationend', () => terminal.classList.remove('scene-connexion', 'scene-reboot'));
  // ——— Les succès et le grade ———
  achievementsButton.addEventListener('click', () => {
    const current = grade(finished);
    const following = GRADES.find((g) => g.chapters > finished.length);
    gradeAchievements.replaceChildren(
      el('strong', {}, t('achievements-grade', { grade: t(`grade-${current}`) })),
      ...(current === 'sre' ? [] : [' ', t('achievements-grade-next', { grade: t(`grade-${following?.id ?? 'sre'}`), chapitres: following?.chapters ?? finished.length })]),
    );
    const date = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'medium' }).format(new Date(iso));
    listAchievements.replaceChildren(
      ...ACHIEVEMENTS.map((x) => {
        const obtained = achievements[x.id];
        const visible = obtained || !x.cache;
        return el(
          'li',
          { class: obtained ? 'obtenu' : 'a-obtenir' },
          el('span', { class: 'succes-nom' }, `${obtained ? '🏆' : '·'} ${visible ? t(`achievements-${x.id}`) : t('achievements-cache')}`),
          ' ',
          el('span', { class: 'succes-description' }, visible ? typo(t(`achievements-${x.id}.description`)) : typo(t('achievements-cache.description'))),
          ...(obtained ? [' ', el('span', { class: 'succes-date' }, t('achievements', { date: date(obtained) }))] : []),
        );
      }),
    );
    achievementsWindow.showModal();
  });
  closeAchievements.addEventListener('click', () => achievementsWindow.close());
  achievementsWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // ——— Ma progression ———
  // Une sauvegarde reprise (code ou fichier) : on l'écrit, puis le jeu repart d'elle.
  const resume = (s: Backup) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    progressWindow.close();
    clearInterval(timer);
    root.replaceChildren();
    mount(root, options);
  };
  const progressUpdate = () => {
    nameField.value = playerName;
    currentCode.textContent = progressCode(finished);
    progressState.textContent = '';
  };
  progressButton.addEventListener('click', () => {
    progressUpdate();
    progressWindow.showModal();
  });
  closeProgress.addEventListener('click', () => progressWindow.close());
  progressWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  nameField.addEventListener('change', () => {
    playerName = cleanName(nameField.value);
    nameField.value = playerName;
    notebookUpdate();
    save();
  });
  copyCode.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(currentCode.textContent ?? '')
      .then(() => (progressState.textContent = t('notebook-copy')))
      .catch(() => (progressState.textContent = t('notebook-copy-impossible')));
  });
  // Le code ne donne que des chapitres terminés : on les ajoute, sans rien perdre d'ici.
  const tryCode = () => {
    const read = readCode(codeField.value);
    if ('error' in read) {
      progressState.textContent = t(`progress-${read.error}`);
      codeField.focus();
      return;
    }
    const fresh = read.finished.filter((id) => !finished.includes(id));
    if (!fresh.length) {
      progressState.textContent = t('progress-nothing-new');
      return;
    }
    resume({ ...backupState(), finished: [...finished, ...fresh] });
  };
  resumeCode.addEventListener('click', tryCode);
  codeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryCode();
  });
  download.addEventListener('click', () => {
    const link = el('a', {
      href: URL.createObjectURL(new Blob([backupFile(backupState(), new Date())], { type: 'application/json' })),
      download: t('progress-name-file'),
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    progressState.textContent = t('progress-downloaded');
  });
  // Le fichier remplace tout ce qui est gardé ici : on demande d'abord.
  fileField.addEventListener('change', async () => {
    const file = fileField.files?.[0];
    if (!file) return;
    const read = readFile(await file.text());
    fileField.value = '';
    if ('error' in read) {
      progressState.textContent = t(`progress-${read.error}`);
      return;
    }
    if (!confirm(t('progress-confirm', { nombre: read.backup.finished?.length ?? 0 }))) return;
    resume(read.backup);
  });
  restart.addEventListener('click', () => {
    if (story() === -1) goWorkstation();
    else launch(story(), active());
    input.focus();
  });

  // Au départ : l'histoire demandée par l'attribut, sinon celle où l'on
  // s'était arrêté, sinon le poste.
  const departure = STORIES.findIndex((h) => h.id === (options.story ?? saved.story));
  if (departure >= 0 && accessible(departure)) launch(departure);
  else goWorkstation();
  return { root: game };
}
