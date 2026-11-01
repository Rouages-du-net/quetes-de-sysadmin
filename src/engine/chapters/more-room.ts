// Story "The Lab" — chapter "Running out of room": the winter contest is
// coming, and /srv is 97 % full. The photos are in a logical volume (LVM)
// on the md1 array, whose group has no room left.
// The host has plugged in two new 4 TB disks (sdc, sdd). First make them a
// RAID 1 array (mdadm --create), give it to LVM (pvcreate, vgextend); grow
// the volume, then its file system (lvextend -r, or lvextend then
// resize2fs). Finally, the new array goes into /etc/mdadm/mdadm.conf, and
// the initramfs is rebuilt so that boot knows it.
// Objective checked on the state: at least 1.5 TB free on /srv, no bare
// disk in the labo group (each PV is an array), each new array once and
// only once in mdadm.conf, and the initramfs rebuilt since.
// Sources: lvm(8), lvextend(8), resize2fs(8), mdadm(8),
// https://manpages.debian.org/trixie/mdadm/mdadm.conf.5.en.html,
// https://wiki.debian.org/SoftwareRAID

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { devUpdate } from '../storage';
import { lvm, pvsFor, lvSize } from '../lvm';
import { uuidMdadm } from '../commands/storage';
import { beforeLabCommand, labAccounts, labState, M, PASSWORD, labWorld, labKernel, st } from './lab';

const CONF = '/etc/mdadm/mdadm.conf';
const NEED = 1.5e12;

const photos = (j: Game) => lvm(st(j)).vgs.labo.lvs.photos;
// The free space on /srv, like df: the file system's size minus what it contains.
const freeMem = (j: Game) => photos(j).fs - (j as Shell).size(j.find('/srv')!);
// The arrays created during the chapter.
const fresh = (j: Game) => Object.entries(st(j).arrays).filter(([n]) => n !== 'md0' && n !== 'md1');
// A bare disk (not an array) in the labo group: redundancy is lost.
const only = (j: Game) => pvsFor(st(j), 'labo').filter((pv) => !st(j).arrays[pv]);
const extended = (j: Game) => pvsFor(st(j), 'labo').some((pv) => fresh(j).some(([n]) => n === pv));
const arrayLines = (j: Game) => (j.read(CONF) ?? '').split('\n').filter((l) => /^\s*ARRAY\b/.test(l));
const account = (j: Game, uuid: string) => arrayLines(j).filter((l) => l.includes(uuidMdadm(uuid))).length;
const duplicates = (j: Game) => Object.values(st(j).arrays).some((g) => account(j, g.uuid) > 1);
const conf = (j: Game) => fresh(j).length > 0 && fresh(j).every(([, g]) => account(j, g.uuid) === 1) && !duplicates(j);
const initramfs = (j: Game) => conf(j) && j.state.initramfs?.mdadm === j.read(CONF);
const grown = (j: Game) => freeMem(j) >= NEED;

export const grow: Chapter = {
  id: 'more-room',
  number: 3,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'echo',
    'tee',
    'nano',
    'id',
    'whoami',
    'sudo',
    'df',
    'du',
    'lsblk',
    'dmesg',
    'smartctl',
    'mdadm',
    'pvs',
    'vgs',
    'lvs',
    'pvcreate',
    'vgextend',
    'vgreduce',
    'pvmove',
    'pvremove',
    'lvextend',
    'resize2fs',
    'update-initramfs',
  ],
  home: M,
  welcome: 'message_from_odile.txt',
  names: true,
  final: 'end',
  steps: ['full', 'lvm', 'array', 'extended', 'grown', 'conf', 'end'],
  password: PASSWORD,
  accounts: labAccounts,
  state: () => labState('replaced'),
  initialise: (j) => {
    labKernel(j, 'replaced');
    devUpdate(j);
  },
  createWorld: (t) => labWorld(t, { 'message_from_odile.txt': f(t('more-room-message-odile')) }, { winter: true }),
  beforeCommand: beforeLabCommand,
  afterCommand: (j) => devUpdate(j),
  events: [
    {
      id: 'full',
      condition: (j) => /\b9\d% \/srv$/m.test(j.last.output),
      message: (j) => j.t('more-room-event-full'),
    },
    {
      id: 'lvm',
      condition: (j) => /VFree|PFree|LSize/.test(j.last.output),
      message: (j) => j.t('more-room-event-lvm'),
    },
    { id: 'only', condition: (j) => only(j).length > 0, message: (j) => j.t('more-room-event-only', { disk: `/dev/${only(j)[0]}` }) },
    {
      id: 'array',
      condition: (j) => fresh(j).some(([, g]) => g.members.length === 2),
      message: (j) => j.t('more-room-event-array', { array: `/dev/${fresh(j)[0][0]}` }),
    },
    { id: 'extended', condition: extended, message: (j) => j.t('more-room-event-extended') },
    {
      id: 'lv-only',
      condition: (j) => lvSize(photos(j)) - photos(j).fs > 1e9,
      message: (j) => j.t('more-room-event-lv-only'),
    },
    {
      id: 'grown',
      condition: (j) => grown(j) && only(j).length === 0,
      message: (j) => j.t('more-room-event-grown'),
    },
    { id: 'duplicates', condition: duplicates, message: (j) => j.t('more-room-event-duplicates') },
    { id: 'conf', condition: conf, message: (j) => j.t('more-room-event-conf') },
    {
      id: 'end',
      condition: (j) => grown(j) && only(j).length === 0 && extended(j) && initramfs(j),
      message: (j) => j.t('more-room-event-end'),
    },
  ],
};
