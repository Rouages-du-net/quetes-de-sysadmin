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
  { id: 'debuter', chapters: ['lighthouse', 'village', 'root', 'backup', 'lost-packet', 'manuscript', 'archives'] },
  {
    id: 'securite',
    chapters: [
      'shut-the-door', 'firewall', 'sentinel', 'port', 'repeat-offenders', 'keys', 'departure', 'shared-rights', 'secret', 'updates', 'auto-updates',
      'scope', 'report', 'exposure', 'traces', 'follow-up',
      'bulletin', 'priority', 'fix', 'proof', 'routine',
    ],
  },
  {
    id: 'web',
    chapters: ['first-day', 'reboot-night', 'fire', 'certificate', 'sharing', 'concert', 'proxy', 'repair-cafe', 'postman', 'signature', 'policy', 'padlock'],
  },
  { id: 'reseau', chapters: ['lost-packet', 'works-for-me', 'jump', 'tunnel', 'vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex'] },
  { id: 'sauvegardes', chapters: ['backup', 'archives', 'versions', 'ransom', 'snapshots', 'database', 'transfers', 'web-host'] },
  {
    id: 'deploiement',
    chapters: ['manuscript', 'update', 'compose', 'firewall-hole', 'full-powers', 'bare-repo', 'rollback', 'blue-green', 'canary', 'migration', 'inventory', 'playbook', 'rehearsal'],
  },
  { id: 'production', chapters: ['reboot-night', 'full-disk', 'memory', 'inodes', 'clock', 'probe', 'post-mortem', 'bottleneck', 'tired-disk', 'new-disk', 'more-room', 'stuck-boot'] },
  { id: 'identites', chapters: ['second-day', 'departure', 'shared-rights', 'keys', 'directory', 'wifi'] },
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
