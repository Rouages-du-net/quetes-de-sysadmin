// Histoire « Le Labo » — chapitre « Le disque qui fatigue » : smartd écrit
// depuis deux jours que le disque sdb a des secteurs illisibles, et le noyau
// a dû relire des blocs sur l'autre miroir. SMART dit pourtant « PASSED » :
// le verdict global ne bascule qu'au seuil du fabricant, les attributs
// (secteurs réalloués, en attente) disent la vérité. On compare les deux
// disques, on sort sdb de ses deux grappes (--fail puis --remove, dans md0
// et dans md1), et on écrit le ticket de l'hébergeur avec le numéro de série
// du disque à remplacer, et pas celui de l'autre.
// Objectif vérifié sur l'état : plus aucune partition de sdb dans une
// grappe, les membres de sda toujours actifs, et ~/ticket.txt qui donne le
// numéro de série de sdb (et pas celui de sda).
// Sources : https://www.smartmontools.org/wiki/FAQ, smartctl(8), mdadm(8),
// https://raid.wiki.kernel.org/index.php/Replacing_a_failed_drive

import { chemin, f, nom, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { actifs, grappeDe, majDev } from '../storage';
import { nomMachine } from '../machines';
import { avantCommandeLabo, boiteSmartd, comptesLabo, etatLabo, M, MOT_DE_PASSE, mondeLabo, noyauLabo, SERIES, st } from './lab';

const TICKET = `${M}/ticket.txt`;

// Les partitions de sdb encore dans une grappe (défectueuses comprises).
const restesSdb = (j: Jeu) => Object.values(st(j).grappes).flatMap((g) => g.membres.filter((m) => m.part.startsWith('sdb')));
const sdbSorti = (j: Jeu) => restesSdb(j).length === 0;
// Les deux grappes tournent toujours sur sda.
const sdaIntact = (j: Jeu) => Object.values(st(j).grappes).every((g) => actifs(g).some((m) => m.part.startsWith('sda')));
const sdaTouche = (j: Jeu) => Object.values(st(j).grappes).some((g) => g.membres.some((m) => m.part.startsWith('sda') && m.etat !== 'actif'));
const ticket = (j: Jeu) => j.lire(chemin(j.t, TICKET)) ?? '';
const ticketOk = (j: Jeu) => ticket(j).includes(SERIES.sdb) && !ticket(j).includes(SERIES.sda);

export const fatigue: Chapitre = {
  id: 'fatigue',
  numero: 1,
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
  ],
  maison: M,
  accueil: 'message_d_odile.txt',
  noms: true,
  final: 'fin',
  etapes: ['alerte', 'grappes', 'smart', 'retire', 'ticket', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesLabo,
  etat: () => etatLabo('fatigue'),
  initialiser: (j) => {
    noyauLabo(j, 'fatigue');
    majDev(j);
  },
  creerMonde: (t) =>
    mondeLabo(
      t,
      {
        'message_d_odile.txt': f(t('fatigue-message-d-odile')),
        'procedure_hebergeur.txt': f(t('labo-procedure-hebergeur'), { lignes: true }),
      },
      { mail: boiteSmartd(nomMachine(t, 'labo')) },
    ),
  avantCommande: avantCommandeLabo,
  apresCommande: (j) => majDev(j),
  evenements: [
    {
      id: 'alerte',
      condition: (j) => /Currently unreadable|CurrentPendingSector|I\/O error, dev sdb/.test(j.derniere.sortie),
      message: (j) => j.t('fatigue-evenement-alerte'),
    },
    {
      id: 'grappes',
      condition: (j) => /md1 : active raid1|Raid Level : raid1/.test(j.derniere.sortie),
      message: (j) => j.t('fatigue-evenement-grappes'),
    },
    {
      id: 'smart',
      condition: (j) => j.derniere.sortie.includes(`Serial Number:    ${SERIES.sdb}`) && j.derniere.sortie.includes('Current_Pending_Sector'),
      message: (j) => j.t('fatigue-evenement-smart'),
    },
    {
      id: 'occupe',
      condition: (j) => j.derniere.erreurs.some((e) => /hot remove failed for \/dev\/sdb\d: Device or resource busy/.test(e)),
      message: (j) => j.t('fatigue-evenement-occupe'),
    },
    { id: 'sain', condition: sdaTouche, message: (j) => j.t('fatigue-evenement-sain') },
    {
      id: 'moitie',
      condition: (j) => !sdbSorti(j) && Object.values(st(j).grappes).some((g) => !g.membres.some((m) => m.part.startsWith('sdb'))),
      message: (j) => {
        const reste = restesSdb(j)[0].part;
        return j.t('fatigue-evenement-moitie', { partition: `/dev/${reste}`, grappe: `/dev/${grappeDe(st(j), reste)![0]}` });
      },
    },
    { id: 'retire', condition: (j) => sdbSorti(j) && sdaIntact(j), message: (j) => j.t('fatigue-evenement-retire') },
    {
      id: 'ticket-faux',
      condition: (j) => ticket(j).includes(SERIES.sda),
      message: (j) => j.t('fatigue-evenement-ticket-faux', { fichier: nom(j.t, 'ticket.txt') }),
    },
    { id: 'ticket', condition: ticketOk, message: (j) => j.t('fatigue-evenement-ticket') },
    {
      id: 'fin',
      condition: (j) => sdbSorti(j) && sdaIntact(j) && !sdaTouche(j) && ticketOk(j),
      message: (j) => j.t('fatigue-evenement-fin'),
    },
  ],
};
