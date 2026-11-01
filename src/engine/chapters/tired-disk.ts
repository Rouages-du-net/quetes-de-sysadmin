// Story "The Lab", chapter "The tired disk": for two days smartd has been
// writing that disk sdb has unreadable sectors, and the kernel had to reread
// blocks from the other mirror. Yet SMART says "PASSED": the overall
// verdict only flips at the manufacturer's threshold, the attributes
// (reallocated, pending sectors) tell the truth. You compare the two disks,
// take sdb out of its two arrays (--fail then --remove, in md0 and in md1),
// and write the host's ticket with the serial number of the disk to
// replace, and not the other one's.
// Objective checked on the state: no partition of sdb left in an array,
// sda's members still active, and ~/ticket.txt giving sdb's serial number
// (and not sda's).
// Sources: https://www.smartmontools.org/wiki/FAQ, smartctl(8), mdadm(8),
// https://raid.wiki.kernel.org/index.php/Replacing_a_failed_drive

import { path, f, name, type Chapter } from '../world';
import type { Game } from '../shell';
import { active, arrayFor, devUpdate } from '../storage';
import { machineName } from '../machines';
import { beforeLabCommand, smartdBox, labAccounts, labState, M, PASSWORD, labWorld, labKernel, SERIES, st } from './lab';

const TICKET = `${M}/ticket.txt`;

// sdb's partitions still in an array (faulty ones included).
const sdbRemains = (j: Game) => Object.values(st(j).arrays).flatMap((g) => g.members.filter((m) => m.part.startsWith('sdb')));
const outSdb = (j: Game) => sdbRemains(j).length === 0;
// Both arrays still run on sda.
const sdaIntact = (j: Game) => Object.values(st(j).arrays).every((g) => active(g).some((m) => m.part.startsWith('sda')));
const keySda = (j: Game) => Object.values(st(j).arrays).some((g) => g.members.some((m) => m.part.startsWith('sda') && m.state !== 'active'));
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
  state: () => labState('tired'),
  initialise: (j) => {
    labKernel(j, 'tired');
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
        return j.t('tired-disk-event-half', { partition: `/dev/${rest}`, array: `/dev/${arrayFor(st(j), rest)![0]}` });
      },
    },
    { id: 'removed', condition: (j) => outSdb(j) && sdaIntact(j), message: (j) => j.t('tired-disk-event-removed') },
    {
      id: 'ticket-false',
      condition: (j) => ticket(j).includes(SERIES.sda),
      message: (j) => j.t('tired-disk-event-ticket-false', { file: name(j.t, 'ticket.txt') }),
    },
    { id: 'ticket', condition: ticketOk, message: (j) => j.t('tired-disk-event-ticket') },
    {
      id: 'end',
      condition: (j) => outSdb(j) && sdaIntact(j) && !keySda(j) && ticketOk(j),
      message: (j) => j.t('tired-disk-event-end'),
    },
  ],
};
