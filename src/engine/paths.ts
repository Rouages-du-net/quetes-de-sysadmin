// Thematic learning paths: chapters from several stories, grouped
// around a theme (securing a server, the web, the network…). A path
// doesn't change the rules: within a story, a chapter opens when the
// previous one is finished, and a story without its key stays closed. The
// path only says which way to go, and shows what remains to do.
// Texts: path-<id> and its .description attribute (interface.ftl).

import { STORIES } from './chapters';

export interface Path {
  id: string;
  chapters: string[];
}

export const PATH: Path[] = [
  { id: 'start', chapters: ['lighthouse', 'village', 'root', 'backup', 'lost-packet', 'manuscript', 'archives'] },
  {
    id: 'security',
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
  { id: 'network', chapters: ['lost-packet', 'works-for-me', 'jump', 'tunnel', 'vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex'] },
  { id: 'backups', chapters: ['backup', 'archives', 'versions', 'ransom', 'snapshots', 'database', 'transfers', 'web-host'] },
  {
    id: 'deployment',
    chapters: ['manuscript', 'update', 'compose', 'firewall-hole', 'full-powers', 'bare-repo', 'rollback', 'blue-green', 'canary', 'migration', 'inventory', 'playbook', 'rehearsal'],
  },
  { id: 'production', chapters: ['reboot-night', 'full-disk', 'memory', 'inodes', 'clock', 'probe', 'post-mortem', 'bottleneck', 'tired-disk', 'new-disk', 'more-room', 'stuck-boot', 'boot-order', 'restart-loop', 'slow-boot'] },
  { id: 'identities', chapters: ['second-day', 'departure', 'shared-rights', 'keys', 'directory', 'wifi'] },
];

export type StepState = 'done' | 'open' | 'locked' | 'no-key';

export interface PathStep {
  chapter: string;
  story: string;
  // Indexes in STORIES and in the story's chapters (to open it).
  h: number;
  c: number;
  state: StepState;
  // For a locked chapter: the chapter to finish first in its story.
  before: string | null;
}

/** Where the player stands in this path: each chapter, its state, and the next one to do. */
export function pathSteps(p: Path, finished: string[], isOpen: (story: string) => boolean): { steps: PathStep[]; next: number } {
  const steps = p.chapters.map((id) => {
    const h = STORIES.findIndex((x) => x.chapters.some((c) => c.id === id));
    const story = STORIES[h];
    const c = story.chapters.findIndex((x) => x.id === id);
    const missing = story.chapters.slice(0, c).find((x) => !finished.includes(x.id));
    const state: StepState = finished.includes(id) ? 'done' : !isOpen(story.id) ? 'no-key' : missing ? 'locked' : 'open';
    return { chapter: id, story: story.id, h, c, state, before: state === 'locked' ? missing!.id : null };
  });
  return { steps, next: steps.findIndex((e) => e.state !== 'done') };
}
