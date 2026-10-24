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

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { majDev, saine } from '../stockage';
import { avantCommandeLabo, comptesLabo, etatLabo, M, MOT_DE_PASSE, mondeLabo, noyauLabo, st } from './labo';

const sdb = (j: Jeu) => st(j).disques.sdb;
// sdb découpé comme sda : mêmes partitions, mêmes types, mêmes tailles.
const decoupe = (j: Jeu) => {
  const a = st(j).disques.sda.partitions;
  const b = sdb(j).partitions;
  return a.length === b.length && a.every((p, i) => b[i].type === p.type && b[i].secteurs === p.secteurs && b[i].numero === p.numero);
};
const dans = (j: Jeu, grappe: string, part: string) => st(j).grappes[grappe].membres.some((m) => m.part === part && m.etat !== 'defectueux');
const ajoutes = (j: Jeu) => dans(j, 'md0', 'sdb2') && dans(j, 'md1', 'sdb3');
const reconstruit = (j: Jeu) => saine(st(j).grappes.md0) && saine(st(j).grappes.md1) && ajoutes(j);
const disqueEntier = (j: Jeu) => Object.values(st(j).grappes).some((g) => g.membres.some((m) => m.part === 'sdb'));
const grub = (j: Jeu) => st(j).grub.includes('sdb');

export const disqueNeuf: Chapitre = {
  id: 'disque-neuf',
  numero: 2,
  commandes: [
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
  maison: M,
  accueil: 'message_d_odile.txt',
  noms: true,
  final: 'fin',
  etapes: ['neuf', 'table', 'ajoutes', 'reconstruit', 'grub', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesLabo,
  etat: () => etatLabo('neuf'),
  initialiser: (j) => {
    noyauLabo(j, 'neuf');
    majDev(j);
  },
  creerMonde: (t) =>
    mondeLabo(t, {
      'message_d_odile.txt': f(t('disque-neuf-message-d-odile')),
      'procedure_hebergeur.txt': f(t('labo-procedure-hebergeur'), { lignes: true }),
    }),
  avantCommande: avantCommandeLabo,
  apresCommande: (j) => majDev(j),
  evenements: [
    {
      id: 'neuf',
      condition: (j) => /sdb\s+8:16\s+0\s+1\.8T\s+0 disk\s*$/m.test(j.derniere.sortie) || /Disk \/dev\/sdb: [^\n]*\nDisk model: [^\n]*\n(?![\s\S]*Disklabel)/.test(j.derniere.sortie),
      message: (j) => j.t('disque-neuf-evenement-neuf'),
    },
    {
      id: 'trop-tot',
      condition: (j) => j.derniere.erreurs.some((e) => /Cannot find \/dev\/sdb\d/.test(e)),
      message: (j) => j.t('disque-neuf-evenement-trop-tot'),
    },
    {
      id: 'sens',
      condition: (j) => j.derniere.erreurs.some((e) => e.includes('This disk is currently in use')),
      message: (j) => j.t('disque-neuf-evenement-sens'),
    },
    { id: 'disque-entier', condition: disqueEntier, message: (j) => j.t('disque-neuf-evenement-disque-entier') },
    { id: 'table', condition: decoupe, message: (j) => j.t('disque-neuf-evenement-table') },
    { id: 'ajoutes', condition: ajoutes, message: (j) => j.t('disque-neuf-evenement-ajoutes') },
    { id: 'reconstruit', condition: reconstruit, message: (j) => j.t('disque-neuf-evenement-reconstruit') },
    { id: 'grub', condition: grub, message: (j) => j.t('disque-neuf-evenement-grub') },
    {
      id: 'fin',
      condition: (j) => decoupe(j) && reconstruit(j) && grub(j) && !disqueEntier(j),
      message: (j) => j.t('disque-neuf-evenement-fin'),
    },
  ],
};
