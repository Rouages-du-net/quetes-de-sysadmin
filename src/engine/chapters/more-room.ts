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

import { f, type Chapitre } from '../world';
import type { Jeu, Shell } from '../shell';
import { majDev } from '../storage';
import { lvm, pvsDe, tailleLv } from '../lvm';
import { uuidMdadm } from '../commands/storage';
import { avantCommandeLabo, comptesLabo, etatLabo, M, MOT_DE_PASSE, mondeLabo, noyauLabo, st } from './lab';

const CONF = '/etc/mdadm/mdadm.conf';
const BESOIN = 1.5e12;

const photos = (j: Jeu) => lvm(st(j)).vgs.labo.lvs.photos;
// La place libre sur /srv, comme df : la taille du système de fichiers moins ce qu'il contient.
const libre = (j: Jeu) => photos(j).fs - (j as Shell).taille(j.trouver('/srv')!);
// Les grappes créées pendant le chapitre.
const nouvelles = (j: Jeu) => Object.entries(st(j).grappes).filter(([n]) => n !== 'md0' && n !== 'md1');
// Un disque seul (pas une grappe) dans le groupe labo : la redondance est perdue.
const seuls = (j: Jeu) => pvsDe(st(j), 'labo').filter((pv) => !st(j).grappes[pv]);
const etendu = (j: Jeu) => pvsDe(st(j), 'labo').some((pv) => nouvelles(j).some(([n]) => n === pv));
const lignesArray = (j: Jeu) => (j.lire(CONF) ?? '').split('\n').filter((l) => /^\s*ARRAY\b/.test(l));
const compte = (j: Jeu, uuid: string) => lignesArray(j).filter((l) => l.includes(uuidMdadm(uuid))).length;
const doublons = (j: Jeu) => Object.values(st(j).grappes).some((g) => compte(j, g.uuid) > 1);
const conf = (j: Jeu) => nouvelles(j).length > 0 && nouvelles(j).every(([, g]) => compte(j, g.uuid) === 1) && !doublons(j);
const initramfs = (j: Jeu) => conf(j) && j.etat.initramfs?.mdadm === j.lire(CONF);
const agrandi = (j: Jeu) => libre(j) >= BESOIN;

export const agrandir: Chapitre = {
  id: 'agrandir',
  numero: 3,
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
  maison: M,
  accueil: 'message_d_odile.txt',
  noms: true,
  final: 'fin',
  etapes: ['plein', 'lvm', 'grappe', 'etendu', 'agrandi', 'conf', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesLabo,
  etat: () => etatLabo('place'),
  initialiser: (j) => {
    noyauLabo(j, 'place');
    majDev(j);
  },
  creerMonde: (t) => mondeLabo(t, { 'message_d_odile.txt': f(t('agrandir-message-d-odile')) }, { hiver: true }),
  avantCommande: avantCommandeLabo,
  apresCommande: (j) => majDev(j),
  evenements: [
    {
      id: 'plein',
      condition: (j) => /\b9\d% \/srv$/m.test(j.derniere.sortie),
      message: (j) => j.t('agrandir-evenement-plein'),
    },
    {
      id: 'lvm',
      condition: (j) => /VFree|PFree|LSize/.test(j.derniere.sortie),
      message: (j) => j.t('agrandir-evenement-lvm'),
    },
    { id: 'seul', condition: (j) => seuls(j).length > 0, message: (j) => j.t('agrandir-evenement-seul', { disque: `/dev/${seuls(j)[0]}` }) },
    {
      id: 'grappe',
      condition: (j) => nouvelles(j).some(([, g]) => g.membres.length === 2),
      message: (j) => j.t('agrandir-evenement-grappe', { grappe: `/dev/${nouvelles(j)[0][0]}` }),
    },
    { id: 'etendu', condition: etendu, message: (j) => j.t('agrandir-evenement-etendu') },
    {
      id: 'lv-seul',
      condition: (j) => tailleLv(photos(j)) - photos(j).fs > 1e9,
      message: (j) => j.t('agrandir-evenement-lv-seul'),
    },
    {
      id: 'agrandi',
      condition: (j) => agrandi(j) && seuls(j).length === 0,
      message: (j) => j.t('agrandir-evenement-agrandi'),
    },
    { id: 'doublons', condition: doublons, message: (j) => j.t('agrandir-evenement-doublons') },
    { id: 'conf', condition: conf, message: (j) => j.t('agrandir-evenement-conf') },
    {
      id: 'fin',
      condition: (j) => agrandi(j) && seuls(j).length === 0 && etendu(j) && initramfs(j),
      message: (j) => j.t('agrandir-evenement-fin'),
    },
  ],
};
