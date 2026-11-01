// Histoire « Le Labo » — chapitre « La place qui manque » : le concours
// d'hiver arrive, et /srv est plein à 97 %. Les photos sont dans un volume
// logique (LVM) sur la grappe md1, dont le groupe n'a plus de place.
// L'hébergeur a branché deux disques neufs de 4 To (sdc, sdd). On en fait
// d'abord une grappe RAID 1 (mdadm --create), qu'on donne à LVM (pvcreate,
// vgextend) ; on agrandit le volume, puis son système de fichiers
// (lvextend -r, ou lvextend puis resize2fs). Enfin, la nouvelle grappe
// entre dans /etc/mdadm/mdadm.conf, et l'initramfs est refait pour que le
// démarrage la connaisse.
// Objectif vérifié sur l'état : au moins 1,5 To libres sur /srv, aucun
// disque seul dans le groupe labo (chaque PV est une grappe), chaque
// nouvelle grappe une fois et une seule dans mdadm.conf, et l'initramfs
// refait depuis.
// Sources : lvm(8), lvextend(8), resize2fs(8), mdadm(8),
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
// La place libre sur /srv, comme df : la taille du système de fichiers moins ce qu'il contient.
const freeMem = (j: Game) => photos(j).fs - (j as Shell).size(j.find('/srv')!);
// Les grappes créées pendant le chapitre.
const fresh = (j: Game) => Object.entries(st(j).arrays).filter(([n]) => n !== 'md0' && n !== 'md1');
// Un disque seul (pas une grappe) dans le groupe labo : la redondance est perdue.
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
