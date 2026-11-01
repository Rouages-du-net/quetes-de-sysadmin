// Les parcours thématiques : des chapitres de plusieurs histoires, rangés
// autour d'un thème (sécuriser un serveur, le web, le réseau…). Un parcours
// ne change pas les règles : dans une histoire, un chapitre s'ouvre quand le
// précédent est fini, et une histoire sans sa clé reste fermée. Le parcours
// dit seulement par où passer, et montre ce qui reste à faire.
// Textes : parcours-<id> et son attribut .description (interface.ftl).

import { STORIES } from './chapters';

export interface Path {
  id: string;
  chapters: string[];
}

export const PATH: Path[] = [
  { id: 'debuter', chapters: ['eveil', 'bourg', 'racine', 'sauvegarde', 'paquet-perdu', 'manuscrit', 'archives'] },
  {
    id: 'securite',
    chapters: [
      'fermer-la-porte', 'pare-feu', 'sentinelle', 'port', 'recidive', 'cles', 'depart', 'droits', 'secret', 'mises-a-jour', 'automatiques',
      'perimetre', 'rapport', 'exposition', 'traces', 'contre-visite',
      'bulletin', 'priorite', 'correctif', 'preuve', 'routine',
    ],
  },
  {
    id: 'web',
    chapters: ['premier-jour', 'redemarrage', 'incendie', 'certificat', 'colocation', 'concert', 'proxy', 'atelier', 'facteur', 'signature', 'politique', 'cadenas'],
  },
  { id: 'reseau', chapters: ['paquet-perdu', 'chez-moi', 'rebond', 'tunnel', 'vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe'] },
  { id: 'sauvegardes', chapters: ['sauvegarde', 'archives', 'versions', 'rancon', 'instantanes', 'base', 'transferts', 'hebergeur'] },
  {
    id: 'deploiement',
    chapters: ['manuscrit', 'mise-a-jour', 'composition', 'contournement', 'pleins-pouvoirs', 'depot-nu', 'retour-arriere', 'bleu-vert', 'canari', 'migration', 'inventaire', 'playbook', 'repetition'],
  },
  { id: 'production', chapters: ['redemarrage', 'disque-plein', 'memoire', 'inodes', 'horloge', 'sonde', 'post-mortem', 'goulot', 'fatigue', 'disque-neuf', 'agrandir', 'secours'] },
  { id: 'identites', chapters: ['deuxieme-jour', 'depart', 'droits', 'cles', 'annuaire', 'wifi'] },
];

export type StepState = 'fait' | 'ouvert' | 'verrouille' | 'sans-cle';

export interface PathStep {
  chapter: string;
  story: string;
  // Indices dans HISTOIRES et dans les chapitres de l'histoire (pour l'ouvrir).
  h: number;
  c: number;
  state: StepState;
  // Pour un chapitre verrouillé : le chapitre à finir d'abord dans son histoire.
  before: string | null;
}

/** Où en est-on dans ce parcours : chaque chapitre, son état, et le prochain à faire. */
export function pathSteps(p: Path, finished: string[], isOpen: (story: string) => boolean): { steps: PathStep[]; next: number } {
  const steps = p.chapters.map((id) => {
    const h = STORIES.findIndex((x) => x.chapters.some((c) => c.id === id));
    const story = STORIES[h];
    const c = story.chapters.findIndex((x) => x.id === id);
    const missing = story.chapters.slice(0, c).find((x) => !finished.includes(x.id));
    const state: StepState = finished.includes(id) ? 'fait' : !isOpen(story.id) ? 'sans-cle' : missing ? 'verrouille' : 'ouvert';
    return { chapter: id, story: story.id, h, c, state, before: state === 'verrouille' ? missing!.id : null };
  });
  return { steps, next: steps.findIndex((e) => e.state !== 'fait') };
}
