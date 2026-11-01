// Histoire « Le Labo » — chapitre « Le disque neuf » : l'hébergeur a
// remplacé sdb dans la nuit. Le nouveau disque est vierge, et les deux
// grappes tournent sur sda seul ([U_]) : si sda lâchait maintenant, tout
// serait perdu. On recopie la table de partitions de sda sur sdb (sfdisk -d
// /dev/sda | sfdisk /dev/sdb : attention au sens), on ajoute chaque nouvelle
// partition à sa grappe (--add), on suit la reconstruction dans
// /proc/mdstat (une grappe à la fois), et on installe GRUB sur sdb pour que
// le serveur sache démarrer sur l'un ou l'autre disque.
// Objectif vérifié sur l'état : sdb découpé comme sda (avec sa partition
// BIOS boot), md0 et md1 de nouveau complètes et à jour ([UU]), et GRUB
// installé sur sdb.
// Sources : https://raid.wiki.kernel.org/index.php/Replacing_a_failed_drive,
// sfdisk(8), mdadm(8), https://www.gnu.org/software/grub/manual/grub/html_node/BIOS-installation.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { devUpdate, healthy } from '../storage';
import { beforeLabCommand, labAccounts, labState, M, PASSWORD, labWorld, labKernel, st } from './lab';

const sdb = (j: Game) => st(j).disks.sdb;
// sdb découpé comme sda : mêmes partitions, mêmes types, mêmes tailles.
const split = (j: Game) => {
  const a = st(j).disks.sda.partitions;
  const b = sdb(j).partitions;
  return a.length === b.length && a.every((p, i) => b[i].type === p.type && b[i].sectors === p.sectors && b[i].number === p.number);
};
const inside = (j: Game, array: string, part: string) => st(j).arrays[array].members.some((m) => m.part === part && m.state !== 'defectueux');
const added = (j: Game) => inside(j, 'md0', 'sdb2') && inside(j, 'md1', 'sdb3');
const rebuilt = (j: Game) => healthy(st(j).arrays.md0) && healthy(st(j).arrays.md1) && added(j);
const wholeDisk = (j: Game) => Object.values(st(j).arrays).some((g) => g.members.some((m) => m.part === 'sdb'));
const grub = (j: Game) => st(j).grub.includes('sdb');

export const newDisk: Chapter = {
  id: 'disque-neuf',
  number: 2,
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
    'nano',
    'id',
    'whoami',
    'sudo',
    'df',
    'lsblk',
    'dmesg',
    'mail',
    'smartctl',
    'mdadm',
    'sfdisk',
    'grub-install',
  ],
  home: M,
  welcome: 'message_d_odile.txt',
  names: true,
  final: 'fin',
  steps: ['neuf', 'table', 'ajoutes', 'reconstruit', 'grub', 'fin'],
  password: PASSWORD,
  accounts: labAccounts,
  state: () => labState('neuf'),
  initialise: (j) => {
    labKernel(j, 'neuf');
    devUpdate(j);
  },
  createWorld: (t) =>
    labWorld(t, {
      'message_d_odile.txt': f(t('disque-neuf-message-d-odile')),
      'procedure_hebergeur.txt': f(t('labo-procedure-hebergeur'), { lines: true }),
    }),
  beforeCommand: beforeLabCommand,
  afterCommand: (j) => devUpdate(j),
  events: [
    {
      id: 'neuf',
      condition: (j) => /sdb\s+8:16\s+0\s+1\.8T\s+0 disk\s*$/m.test(j.last.output) || /Disk \/dev\/sdb: [^\n]*\nDisk model: [^\n]*\n(?![\s\S]*Disklabel)/.test(j.last.output),
      message: (j) => j.t('disque-neuf-evenement-neuf'),
    },
    {
      id: 'trop-tot',
      condition: (j) => j.last.errors.some((e) => /Cannot find \/dev\/sdb\d/.test(e)),
      message: (j) => j.t('disque-neuf-evenement-trop-tot'),
    },
    {
      id: 'sens',
      condition: (j) => j.last.errors.some((e) => e.includes('This disk is currently in use')),
      message: (j) => j.t('disque-neuf-evenement-sens'),
    },
    { id: 'disque-entier', condition: wholeDisk, message: (j) => j.t('disque-neuf-evenement-disque-entier') },
    { id: 'table', condition: split, message: (j) => j.t('disque-neuf-evenement-table') },
    { id: 'ajoutes', condition: added, message: (j) => j.t('disque-neuf-evenement-ajoutes') },
    { id: 'reconstruit', condition: rebuilt, message: (j) => j.t('disque-neuf-evenement-reconstruit') },
    { id: 'grub', condition: grub, message: (j) => j.t('disque-neuf-evenement-grub') },
    {
      id: 'fin',
      condition: (j) => split(j) && rebuilt(j) && grub(j) && !wholeDisk(j),
      message: (j) => j.t('disque-neuf-evenement-fin'),
    },
  ],
};
