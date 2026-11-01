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

import { path, f, name, type Chapter } from '../world';
import type { Game } from '../shell';
import { active, arrayFor, devUpdate } from '../storage';
import { machineName } from '../machines';
import { beforeLabCommand, smartdBox, labAccounts, labState, M, PASSWORD, labWorld, labKernel, SERIES, st } from './lab';

const TICKET = `${M}/ticket.txt`;

// Les partitions de sdb encore dans une grappe (défectueuses comprises).
const sdbRemains = (j: Game) => Object.values(st(j).arrays).flatMap((g) => g.members.filter((m) => m.part.startsWith('sdb')));
const outSdb = (j: Game) => sdbRemains(j).length === 0;
// Les deux grappes tournent toujours sur sda.
const sdaIntact = (j: Game) => Object.values(st(j).arrays).every((g) => active(g).some((m) => m.part.startsWith('sda')));
const keySda = (j: Game) => Object.values(st(j).arrays).some((g) => g.members.some((m) => m.part.startsWith('sda') && m.state !== 'actif'));
const ticket = (j: Game) => j.read(path(j.t, TICKET)) ?? '';
const ticketOk = (j: Game) => ticket(j).includes(SERIES.sdb) && !ticket(j).includes(SERIES.sda);

export const fatigue: Chapter = {
  id: 'tired-disk',
  number: 1,
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
  ],
  home: M,
  welcome: 'message_from_odile.txt',
  names: true,
  final: 'end',
  steps: ['alert', 'arrays', 'smart', 'removed', 'ticket', 'end'],
  password: PASSWORD,
  accounts: labAccounts,
  state: () => labState('fatigue'),
  initialise: (j) => {
    labKernel(j, 'fatigue');
    devUpdate(j);
  },
  createWorld: (t) =>
    labWorld(
      t,
      {
        'message_from_odile.txt': f(t('tired-disk-message-odile')),
        'host_procedure.txt': f(t('lab-procedure-host'), { lines: true }),
      },
      { mail: smartdBox(machineName(t, 'lab')) },
    ),
  beforeCommand: beforeLabCommand,
  afterCommand: (j) => devUpdate(j),
  events: [
    {
      id: 'alert',
      condition: (j) => /Currently unreadable|CurrentPendingSector|I\/O error, dev sdb/.test(j.last.output),
      message: (j) => j.t('tired-disk-event-alert'),
    },
    {
      id: 'arrays',
      condition: (j) => /md1 : active raid1|Raid Level : raid1/.test(j.last.output),
      message: (j) => j.t('tired-disk-event-arrays'),
    },
    {
      id: 'smart',
      condition: (j) => j.last.output.includes(`Serial Number:    ${SERIES.sdb}`) && j.last.output.includes('Current_Pending_Sector'),
      message: (j) => j.t('tired-disk-event-smart'),
    },
    {
      id: 'busy',
      condition: (j) => j.last.errors.some((e) => /hot remove failed for \/dev\/sdb\d: Device or resource busy/.test(e)),
      message: (j) => j.t('tired-disk-event-busy'),
    },
    { id: 'healthy', condition: keySda, message: (j) => j.t('tired-disk-event-healthy') },
    {
      id: 'half',
      condition: (j) => !outSdb(j) && Object.values(st(j).arrays).some((g) => !g.members.some((m) => m.part.startsWith('sdb'))),
      message: (j) => {
        const rest = sdbRemains(j)[0].part;
        return j.t('tired-disk-event-half', { partition: `/dev/${rest}`, grappe: `/dev/${arrayFor(st(j), rest)![0]}` });
      },
    },
    { id: 'removed', condition: (j) => outSdb(j) && sdaIntact(j), message: (j) => j.t('tired-disk-event-removed') },
    {
      id: 'ticket-false',
      condition: (j) => ticket(j).includes(SERIES.sda),
      message: (j) => j.t('tired-disk-event-ticket-false', { fichier: name(j.t, 'ticket.txt') }),
    },
    { id: 'ticket', condition: ticketOk, message: (j) => j.t('tired-disk-event-ticket') },
    {
      id: 'end',
      condition: (j) => outSdb(j) && sdaIntact(j) && !keySda(j) && ticketOk(j),
      message: (j) => j.t('tired-disk-event-end'),
    },
  ],
};
