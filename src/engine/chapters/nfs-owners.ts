// Story "The Photo Club", chapter 2 — "Whose Files?": Sam scanned his films
// on the darkroom computer and copied them into the NAS's share; on the NAS
// they belong to Nora. NFS (sec=sys) only carries numbers: Sam is 1001 on the
// darkroom computer, and 1001 is Nora on the NAS (Sam is 1002 there). From
// the darkroom computer, Sam's own albums show as owned by "1002" and he
// can't change them; and sudo doesn't help, since root becomes nobody on the
// NAS (root_squash).
// The fix: the same uid for the same person everywhere. On the darkroom
// computer, Sam's session closed, usermod -u 1002 sam; on the NAS, the
// scans given back to Sam (chown). root_squash stays.
// Objective checked on the state: Sam has the same uid on both machines,
// the scans belong to Sam on the NAS, Sam (on the darkroom computer) can
// change his albums, and root is still squashed.
// Sources: https://man7.org/linux/man-pages/man5/exports.5.html (User ID
// Mapping), https://man7.org/linux/man-pages/man8/usermod.8.html

import type { Chapter, Directory, Node } from '../world';
import type { Game, Shell } from '../shell';
import { access, lookup } from '../nfs';
import { DARKROOM, EXPORTS_CLUB, HOME, MOUNT, PASSWORD, PHOTOS, darkroom, darkroomHost, mountOnDarkroom, nasAccounts, nasState, nasWorld, photos, prepareNas, seenOnDarkroom, withNfs, FSTAB_NFS } from './photo-club';

const BOOT = Date.UTC(2028, 8, 1, 7, 0, 0);
const NOW = Date.UTC(2028, 8, 12, 18, 40, 0);
const SCANS = `${PHOTOS}/2028-film-scans`;
const OUTINGS = `${PHOTOS}/2028-outings`;

const COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'mkdir', 'touch', 'cp', 'mv', 'chown', 'chmod', 'df', 'mount', 'umount', 'ssh', 'exit', 'ps', 'pkill', 'who', 'usermod', 'find'];

const served = (j: Game) => lookup(j as never, PHOTOS, DARKROOM, ['darkroom', 'darkroom.internal']);
const sameUid = (j: Game) => {
  const s = darkroom(j);
  return !!s && s.accounts.users.sam?.uid === j.accounts.users.sam?.uid;
};
const nodes = (n: Node | null): Node[] => (!n ? [] : n.type === 'directory' ? [n, ...Object.values((n as Directory).children).flatMap(nodes)] : [n]);
const scansBackToSam = (j: Game) => {
  const all = nodes(j.find(SCANS));
  return all.length > 0 && all.every((n) => n.owner === 'sam' && n.group !== 'nora');
};
// Sam, on the darkroom computer, can change one of his own photos.
const samWrites = (j: Game) => {
  const s = darkroom(j) as Shell | null;
  const n = s?.find(`${MOUNT}/2028-outings/heron.jpg`);
  return !!s && !!n && access(s, n, 'w', 'sam') === true;
};

export const nfsOwners: Chapter = {
  id: 'nfs-owners',
  number: 2,
  commands: [...COMMANDS, 'exportfs'],
  home: HOME,
  welcome: 'message_from_margot.txt',
  names: true,
  final: 'end',
  steps: ['numbers', 'squash', 'uid', 'end'],
  password: PASSWORD,
  accounts: nasAccounts,
  hosts: { darkroom: darkroomHost({ mountPoint: true, fstab: FSTAB_NFS, samSession: true, commands: COMMANDS }) },
  state: () => nasState({ boot: BOOT, now: NOW, firewall: withNfs() }),
  initialise: (j) => {
    prepareNas(j);
    mountOnDarkroom(j);
  },
  createWorld: (t) =>
    nasWorld({ welcome: { 'message_from_margot.txt': t('nfs-owners-message-margot') }, exports: EXPORTS_CLUB, photos: photos({ scans: { owner: 'nora', group: 'nora' } }) }),
  events: [
    {
      id: 'numbers',
      condition: (j) => seenOnDarkroom(j, ' 1002 ') || (j.last.output.includes('nora') && /2028-film-scans|roll-0/.test(j.last.line)),
      message: (j) => j.t('nfs-owners-event-numbers'),
    },
    {
      id: 'squash',
      condition: (j) => {
        const s = darkroom(j);
        return !!s && /^sudo /.test(s.last.line) && s.last.line.includes(MOUNT) && s.last.errors.some(Boolean);
      },
      message: (j) => j.t('nfs-owners-event-squash'),
    },
    {
      id: 'no-root-squash',
      condition: (j) => !!served(j)?.options.includes('no_root_squash'),
      message: (j) => j.t('nfs-owners-event-no-root-squash'),
    },
    {
      id: 'busy',
      condition: (j) => seenOnDarkroom(j, j.t('usermod-used', { user: 'sam', pid: '2210' })) || seenOnDarkroom(j, j.t('usermod-used', { user: 'sam', pid: '2241' })),
      message: (j) => j.t('nfs-owners-event-busy'),
    },
    {
      id: 'taken',
      condition: (j) => seen(j, j.t('usermod-uid-exists', { uid: '1001' })) || seenOnDarkroom(j, j.t('usermod-uid-exists', { uid: '1001' })),
      message: (j) => j.t('nfs-owners-event-taken'),
    },
    {
      id: 'uid',
      condition: sameUid,
      message: (j) => j.t('nfs-owners-event-uid'),
    },
    {
      id: 'end',
      condition: (j) => sameUid(j) && scansBackToSam(j) && samWrites(j) && !!served(j)?.options.includes('root_squash'),
      message: (j) => j.t('nfs-owners-event-end'),
    },
  ],
};

const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
