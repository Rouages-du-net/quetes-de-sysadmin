// Story "The Photo Club", chapter 1 — "The Shared Folder": the club wants the
// darkroom computer to see the NAS's /srv/photos as one of its own folders.
// On the NAS: an export in /etc/exports for the darkroom computer only,
// loaded with exportfs -ra, and the firewall opened to it for NFS (2049).
// On the darkroom computer: mount -t nfs nas.internal:/srv/photos
// /mnt/photos (after creating the mount point), and a line in /etc/fstab so
// that it comes back after a reboot.
// Objective checked on the state: the darkroom computer has the export
// mounted at /mnt/photos, read-write, root squashed, not exported to the
// whole world, and fstab describes the same mount. Several right answers:
// the darkroom's address or name, or the club's network; exportfs -ra or a
// restart of nfs-server; ufw for 2049 or for the darkroom's address.
// Sources: https://man7.org/linux/man-pages/man5/exports.5.html,
// https://man7.org/linux/man-pages/man8/exportfs.8.html,
// https://man7.org/linux/man-pages/man5/nfs.5.html

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { lookup, nfsMounts, readExports, server, serverFor } from '../nfs';
import { readFstab } from '../fstab';
import { DARKROOM, EXPORTS_DEBIAN, HOME, MOUNT, NAS, PASSWORD, PHOTOS, darkroom, darkroomHost, nasAccounts, nasState, nasWorld, photos, prepareNas, seen, seenOnDarkroom, sshOnly } from './photo-club';

const BOOT = Date.UTC(2028, 8, 1, 7, 0, 0);
const NOW = Date.UTC(2028, 8, 5, 19, 10, 0);

const COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'mkdir', 'touch', 'df', 'mount', 'umount', 'showmount', 'ssh', 'exit', 'systemctl', 'journalctl'];

// What the NAS serves the darkroom computer now (the table, not the file).
const served = (j: Game) => lookup(j as never, PHOTOS, DARKROOM, ['darkroom', 'darkroom.internal']);
const inFile = (j: Game) => readExports(j as never).exports.some((e) => e.path === PHOTOS);
const toEveryone = (j: Game) => server(j as never).table.some((e) => e.path === PHOTOS && e.clients.some((c) => c.spec === '*' || c.spec === '0.0.0.0/0'));
const mounted = (j: Game) => {
  const s = darkroom(j);
  return !!s && nfsMounts(s).some((m) => m.path === MOUNT && serverFor(s, (m as { nfs: { host: string } }).nfs.host)?.address === NAS && (m as { nfs: { export: string } }).nfs.export.replace(/\/$/, '') === PHOTOS);
};
// fstab on the darkroom computer describes this mount (mount -a would bring it back).
const inFstab = (j: Game) => {
  const s = darkroom(j);
  if (!s) return false;
  return readFstab(s.read('/etc/fstab') ?? '').inputs.some((e) => {
    const m = /^([^:]+):(\/.*)$/.exec(e.source);
    return e.target === MOUNT && e.type.startsWith('nfs') && !!m && serverFor(s, m[1])?.address === NAS && m[2].replace(/\/$/, '') === PHOTOS && !e.options.includes('noauto');
  });
};

export const nfsExport: Chapter = {
  id: 'nfs-export',
  number: 1,
  commands: [...COMMANDS, 'exportfs', 'ufw', 'ss'],
  home: HOME,
  welcome: 'message_from_margot.txt',
  names: true,
  final: 'end',
  steps: ['exports', 'loaded', 'firewall', 'mounted', 'end'],
  password: PASSWORD,
  accounts: nasAccounts,
  hosts: { darkroom: darkroomHost({ mountPoint: false, commands: COMMANDS }) },
  state: () => nasState({ boot: BOOT, now: NOW, firewall: sshOnly() }),
  initialise: prepareNas,
  createWorld: (t) => nasWorld({ welcome: { 'message_from_margot.txt': t('nfs-export-message-margot') }, exports: EXPORTS_DEBIAN, photos: photos() }),
  events: [
    {
      id: 'exports',
      condition: (j) => !served(j) && (seen(j, '# /etc/exports: the access control list') || seen(j, 'Export list for')),
      message: (j) => j.t('nfs-export-event-exports'),
    },
    {
      id: 'not-loaded',
      condition: (j) => inFile(j) && !served(j),
      message: (j) => j.t('nfs-export-event-not-loaded'),
    },
    {
      id: 'loaded',
      condition: (j) => !!served(j),
      message: (j) => j.t('nfs-export-event-loaded'),
    },
    {
      id: 'too-open',
      condition: (j) => toEveryone(j) || !!served(j)?.options.includes('no_root_squash'),
      message: (j) => j.t('nfs-export-event-too-open'),
    },
    {
      id: 'no-mount-point',
      condition: (j) => seenOnDarkroom(j, `mount point ${MOUNT} does not exist`),
      message: (j) => j.t('nfs-export-event-no-mount-point'),
    },
    {
      id: 'firewall',
      condition: (j) => seenOnDarkroom(j, 'mount.nfs: Connection timed out') || seenOnDarkroom(j, 'clnt_create: RPC: Timed out'),
      message: (j) => j.t('nfs-export-event-firewall'),
    },
    {
      id: 'denied',
      condition: (j) => seenOnDarkroom(j, 'access denied by server while mounting'),
      message: (j) => j.t('nfs-export-event-denied'),
    },
    {
      id: 'mounted',
      condition: mounted,
      message: (j) => j.t('nfs-export-event-mounted'),
    },
    {
      id: 'read-only',
      condition: (j) => mounted(j) && !!served(j)?.options.includes('ro'),
      message: (j) => j.t('nfs-export-event-read-only'),
    },
    {
      id: 'end',
      condition: (j) => {
        const s = served(j);
        return mounted(j) && inFstab(j) && !!s && s.options.includes('rw') && s.options.includes('root_squash') && !toEveryone(j);
      },
      message: (j) => j.t('nfs-export-event-end'),
    },
  ],
};
