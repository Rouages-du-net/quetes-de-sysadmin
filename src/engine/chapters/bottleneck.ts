// Histoire « L'Astreinte » — chapitre « Le goulot » : chaque jour à 16 h,
// le direct de Radio Quartier hoquette. La machine semble lente, mais le
// processeur ne fait presque rien : il attend le disque (iowait). L'archivage
// du jour (radio-archives, un rsync lancé par un timer) recopie les
// enregistrements sur le même disque aussi vite qu'il peut, et le relais du
// direct n'obtient plus ses lectures à temps.
//   - comprendre : top (wa), iostat -x (%util, r_await), pidstat -d (qui) ;
//   - piège réel : ionice -c3 est accepté… et ne change rien, l'ordonnanceur
//     du disque virtuel (none, /sys/block/vda/queue/scheduler) ignore les
//     priorités ;
//   - limiter le débit de l'archivage avec systemd (IOWriteBandwidthMax=,
//     cgroup v2 io.max), pour aujourd'hui et pour demain, sans l'arrêter :
//     les émissions du jour doivent être archivées.
// Objectif vérifié sur l'état : le relais du direct est servi à temps,
// l'archivage tourne toujours, avec une limite de débit enregistrée (dans
// /etc) sur le bon disque, ni trop basse ni trop haute.
// Sources : https://man7.org/linux/man-pages/man1/iostat.1.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#IOReadBandwidthMax=device%20bytes,
// https://docs.kernel.org/admin-guide/cgroup-v2.html#io

import { path, d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { writeLog, newSystemd, systemd, type Service } from '../systemd';
import { diskState, io, activesPriorities, timeAServed, targetsPartition, type IoState } from '../disk-io';
import type { Process } from '../commands/system';

const M = '/home/you';
const Mo = 1024 * 1024;
const ARCHIVES = 2190;
// La copie du jour (rsync), dans la langue : /srv/radio/recordings/… en anglais.
const copyOf = (t: Translate) => `rsync -a ${path(t, '/srv/radio/recordings')}/ /srv/archives/2027-09-20/`;
// Le relais lit le direct ici.
const buffer = (t: Translate) => path(t, '/srv/radio/live/buffer.ts');
const FLUX = 1730;
// Lundi 20 septembre 2027, 16 h 14 : l'émission de l'après-midi est en direct.
const NOW = Date.UTC(2027, 8, 20, 16, 14, 0);
const CAPACITY = 150_000;

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    radio: { uid: 996, group: 'radio', home: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    zoe: { uid: 1001, group: 'zoe' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'zoe'] },
    sudo: { gid: 27, members: ['you', 'zoe'] },
    radio: { gid: 996, members: [] },
    you: { gid: 1000, members: [] },
    zoe: { gid: 1001, members: [] },
  },
});

const proc = (pid: number, user: string, command: string, cpu = 0): Process => ({ pid, user, cpu, mem: 0.4, command });
const sd = (j: Game) => systemd(j)!;
const archives = (j: Game): Service => sd(j).services['radio-archives'];
const running = (j: Game) => archives(j).state === 'active' && (j.state.processus ?? []).some((p: Process) => p.pid === archives(j).process[0]?.pid);
const limit = (j: Game) => [archives(j).writeIo, archives(j).readIo].filter((l) => l && targetsPartition(l.device, (io(j) as IoState).disk));
// Assez lente pour laisser le direct, assez rapide pour finir dans la soirée (au moins 5 Mio/s).
const reasonable = (j: Game) => limit(j).length > 0 && limit(j).every((l) => l!.bytes >= 5 * Mo) && timeAServed(j);

export const bottleneck: Chapter = {
  id: 'bottleneck',
  number: 7,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'id',
    'whoami',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'ps',
    'top',
    'free',
    'kill',
    'df',
    'iostat',
    'pidstat',
    'ionice',
  ],
  home: M,
  welcome: 'message_from_zoe.txt',
  names: true,
  final: 'fin',
  password: 'antenna-2027',
  accounts,
  state: (t) => ({
    systemd: (() => {
      const s = newSystemd('radio', Date.UTC(2027, 8, 14, 7, 2, 0), NOW, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')],
        },
        'radio-stream': {
          description: 'Radio Quartier stream relay',
          active: true,
          executable: 'stream',
          process: [proc(FLUX, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', 3.2)],
        },
        'radio-archives': {
          description: "Radio Quartier: archive the day's recordings",
          active: false,
          executable: 'rsync',
          process: [proc(ARCHIVES, 'root', copyOf(t), 6.1)],
        },
      });
      s.timers = {
        'radio-archives': {
          description: "Archive the day's recordings",
          unit: 'radio-archives',
          calendar: ['*-*-* 16:00'],
          active: true,
          state: 'active',
          since: s.clock,
          file: '/usr/lib/systemd/system/radio-archives.timer',
          last: Date.UTC(2027, 8, 20, 16, 0, 0),
        },
      };
      return s;
    })(),
    processus: [
      proc(1, 'root', '/sbin/init'),
      proc(312, 'root', '[jbd2/vda1-8]'),
      proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'),
      proc(FLUX, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', 3.2),
      proc(ARCHIVES, 'root', copyOf(t), 6.1),
    ],
    memoire: { total: 2048 * Mo, kernel: 380 * Mo, rss: { 1: 12 * Mo, 312: 0, 598: 8 * Mo, [FLUX]: 180 * Mo, [ARCHIVES]: 40 * Mo } },
    io: {
      disk: 'vda',
      scheduler: 'none',
      capacity: CAPACITY,
      cpus: 2,
      classes: {},
      requests: [
        { service: 'radio-archives', read: 70_000, write: 70_000, copyOf: true },
        { service: 'radio-stream', read: 2048, write: 0, sensible: true },
        { pid: 312, read: 0, write: 180 },
      ],
    } satisfies IoState,
  }),
  initialise: (j) => {
    const s = sd(j);
    // L'archivage a démarré à 16 h (par son timer), et le direct hoquette depuis.
    s.services['radio-archives'].state = 'active';
    s.clock = Date.UTC(2027, 8, 20, 16, 0, 0);
    writeLog(s, 'radio-archives.service', 'systemd', 1, "Started radio-archives.service - Radio Quartier: archive the day's recordings.");
    for (let i = 0; i < 9; i++) {
      s.clock = Date.UTC(2027, 8, 20, 16, 1 + i * 1.5, 7 * i);
      writeLog(
        s,
        'radio-stream.service',
        'stream',
        FLUX,
        `relay: read stall on ${buffer(j.t)}: waited ${610 + ((i * 97) % 300)} ms, listeners hear a gap`,
        4,
        false,
      );
    }
    s.clock = NOW;
  },
  // Chaque commande, une demi-minute : tant que le disque est saturé, le direct hoquette encore.
  afterCommand: (j) => {
    const s = sd(j);
    s.clock += 30_000;
    if (!timeAServed(j))
      writeLog(
        s,
        'radio-stream.service',
        'stream',
        FLUX,
        `relay: read stall on ${buffer(j.t)}: waited ${Math.round(diskState(j).attente)} ms, listeners hear a gap`,
        4,
        false,
      );
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    return place({
      etc: place({ ...accountsFiles(), hostname: file('radio'), systemd: place({ system: place({}) }) }),
      home: place({ you: d({ 'message_from_zoe.txt': f(t('bottleneck-message-de-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
      sys: place({ block: place({ vda: place({ queue: place({ scheduler: file('[none] mq-deadline'), rotational: file('0') }) }) }) }),
      srv: place({ radio: place({ recordings: place({}), live: place({}) }, { owner: 'radio' }), archives: place({}) }),
      usr: place({
        lib: place({
          systemd: place({
            system: place({
              'radio-stream.service': file(
                '[Unit]\nDescription=Radio Quartier stream relay\nAfter=network.target\n\n[Service]\nUser=radio\nExecStart=/usr/local/bin/stream --config /etc/radio/stream.conf\n\n[Install]\nWantedBy=multi-user.target',
              ),
              'radio-archives.service': file(
                `[Unit]\nDescription=Radio Quartier: archive the day's recordings\n\n[Service]\nType=oneshot\nExecStart=/bin/sh -c 'rsync -a ${path(t, '/srv/radio/recordings')}/ /srv/archives/$(date +%%F)/'`,
              ),
              'radio-archives.timer': file(
                "[Unit]\nDescription=Archive the day's recordings\n\n[Timer]\nOnCalendar=*-*-* 16:00\n\n[Install]\nWantedBy=timers.target",
              ),
            }),
          }),
        }),
      }),
    });
  },
  events: [
    {
      id: 'iowait',
      condition: (j) => !timeAServed(j) && j.last.commands.some((c) => c.includes('top')),
      message: (j) => j.t('bottleneck-evenement-iowait'),
    },
    {
      id: 'ionice',
      condition: (j) => (io(j) as IoState).classes[ARCHIVES]?.cls === 3 && !activesPriorities(io(j) as IoState),
      message: (j) => j.t('bottleneck-evenement-ionice'),
    },
    { id: 'arret', condition: (j) => !running(j), message: (j) => j.t('bottleneck-evenement-arret') },
    {
      id: 'mauvais-disque',
      condition: (j) => [archives(j).writeIo, archives(j).readIo].some((l) => l && !targetsPartition(l.device, 'vda')),
      message: (j) => j.t('bottleneck-evenement-mauvais-disque'),
    },
    { id: 'trop-lent', condition: (j) => limit(j).some((l) => l!.bytes < 5 * Mo), message: (j) => j.t('bottleneck-evenement-trop-lent') },
    { id: 'fin', condition: (j) => running(j) && reasonable(j), message: (j) => j.t('bottleneck-evenement-fin') },
  ],
};
