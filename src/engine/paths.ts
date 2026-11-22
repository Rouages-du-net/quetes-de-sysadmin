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
      'alarm', 'containment', 'eradication', 'hardening', 'dormant-accounts', 'lost-disk',
      'expiry-date', 'chain-of-trust', 'stolen-laptop', 'who-can-push', 'leaky-pipeline', 'signed-release',
    ],
  },
  {
    id: 'web',
    chapters: ['first-day', 'reboot-night', 'fire', 'certificate', 'sharing', 'concert', 'proxy', 'repair-cafe', 'postman', 'signature', 'policy', 'padlock', 'expiry-date', 'chain-of-trust'],
  },
  { id: 'network', chapters: ['lost-packet', 'works-for-me', 'jump', 'tunnel', 'vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex', 'new-card', 'other-door', 'both-ways', 'new-printer', 'wrong-side', 'split-brain'] },
  { id: 'backups', chapters: ['backup', 'archives', 'versions', 'ransom', 'snapshots', 'database', 'transfers', 'web-host', 'silent-backup', 'lost-disk', 'spare-key', 'restore-drill'] },
  {
    id: 'deployment',
    chapters: ['manuscript', 'update', 'compose', 'firewall-hole', 'full-powers', 'bare-repo', 'rollback', 'blue-green', 'canary', 'migration', 'inventory', 'playbook', 'rehearsal', 'wont-start', 'front-desk', 'locker-room', 'deep-end', 'who-can-push', 'leaky-pipeline', 'signed-release'],
  },
  { id: 'production', chapters: ['portable-script', 'rc-services', 'last-rule', 'read-first', 'byte-order', 'switch-over', 'copybook', 'return-code', 'late-file', 'inquiry', 'spooled', 'save-file', 'line-endings', 'service-logon', 'log-flood', 'reboot-night', 'full-disk', 'memory', 'inodes', 'clock', 'probe', 'post-mortem', 'bottleneck', 'tired-disk', 'new-disk', 'more-room', 'stuck-boot', 'boot-order', 'restart-loop', 'slow-boot', 'late-disk', 'heavy-load', 'quota', 'too-many-files', 'stuck-process', 'too-many-clients', 'slow-query', 'read-only', 'failover', 'central-logs', 'journal-full', 'ssh-alerts', 'blind-spot', 'threshold', 'quiet-hours', 'stuck-queue', 'paper-trail', 'cold-start', 'wrong-side', 'tight-fit', 'no-failover', 'sick-server', 'split-brain'] },
  { id: 'identities', chapters: ['second-day', 'departure', 'shared-rights', 'keys', 'directory', 'wifi', 'nfs-export', 'nfs-owners', 'samba-share', 'smb-mount', 'full-volume', 'two-locks', 'service-logon', 'comings-and-goings', 'stale-password', 'unapplied-policy', 'dormant-accounts'] },
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
