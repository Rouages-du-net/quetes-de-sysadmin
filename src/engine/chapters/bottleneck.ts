// Story "L'Astreinte" — chapter "The bottleneck": every day at 4 pm,
// Radio Quartier's live stream stutters. The machine seems slow, but the
// processor does almost nothing: it waits for the disk (iowait). The day's
// archiving (radio-archives, an rsync started by a timer) copies the
// recordings onto the same disk as fast as it can, and the live stream's
// relay no longer gets its reads in time.
//   - understand: top (wa), iostat -x (%util, r_await), pidstat -d (who);
//   - a real trap: ionice -c3 is accepted… and changes nothing, the virtual
//     disk's scheduler (none, /sys/block/vda/queue/scheduler) ignores
//     priorities;
//   - limit the archiving's bandwidth with systemd (IOWriteBandwidthMax=,
//     cgroup v2 io.max), for today and tomorrow, without stopping it:
//     the day's programmes must be archived.
// Objective checked on the state: the live relay is served in time,
// the archiving still runs, with a bandwidth limit saved (in
// /etc) on the right disk, neither too low nor too high.
// Sources: https://man7.org/linux/man-pages/man1/iostat.1.html,
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
// The day's copy (rsync), in the language: /srv/radio/recordings/… in English.
const copyOf = (t: Translate) => `rsync -a ${path(t, '/srv/radio/recordings')}/ /srv/archives/2027-09-20/`;
// The relay reads the live stream here.
const buffer = (t: Translate) => path(t, '/srv/radio/live/buffer.ts');
const FLUX = 1730;
// Monday 20 September 2027, 4:14 pm: the afternoon programme is live.
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
const running = (j: Game) => archives(j).state === 'active' && (j.state.process ?? []).some((p: Process) => p.pid === archives(j).process[0]?.pid);
const limit = (j: Game) => [archives(j).writeIo, archives(j).readIo].filter((l) => l && targetsPartition(l.device, (io(j) as IoState).disk));
// Slow enough to leave room for the live stream, fast enough to finish in the evening (at least 5 MiB/s).
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
  final: 'end',
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
    process: [
      proc(1, 'root', '/sbin/init'),
      proc(312, 'root', '[jbd2/vda1-8]'),
      proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'),
      proc(FLUX, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', 3.2),
      proc(ARCHIVES, 'root', copyOf(t), 6.1),
    ],
    memory: { total: 2048 * Mo, kernel: 380 * Mo, rss: { 1: 12 * Mo, 312: 0, 598: 8 * Mo, [FLUX]: 180 * Mo, [ARCHIVES]: 40 * Mo } },
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
    // The archiving started at 4 pm (by its timer), and the live stream has stuttered since.
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
  // Each command, half a minute: as long as the disk is saturated, the live stream keeps stuttering.
  afterCommand: (j) => {
    const s = sd(j);
    s.clock += 30_000;
    if (!timeAServed(j))
      writeLog(
        s,
        'radio-stream.service',
        'stream',
        FLUX,
        `relay: read stall on ${buffer(j.t)}: waited ${Math.round(diskState(j).waiting)} ms, listeners hear a gap`,
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
      home: place({ you: d({ 'message_from_zoe.txt': f(t('bottleneck-message-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
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
      message: (j) => j.t('bottleneck-event-iowait'),
    },
    {
      id: 'ionice',
      condition: (j) => (io(j) as IoState).classes[ARCHIVES]?.cls === 3 && !activesPriorities(io(j) as IoState),
      message: (j) => j.t('bottleneck-event-ionice'),
    },
    { id: 'stop', condition: (j) => !running(j), message: (j) => j.t('bottleneck-event-stop') },
    {
      id: 'bad-disk',
      condition: (j) => [archives(j).writeIo, archives(j).readIo].some((l) => l && !targetsPartition(l.device, 'vda')),
      message: (j) => j.t('bottleneck-event-bad-disk'),
    },
    { id: 'too-slow', condition: (j) => limit(j).some((l) => l!.bytes < 5 * Mo), message: (j) => j.t('bottleneck-event-too-slow') },
    { id: 'end', condition: (j) => running(j) && reasonable(j), message: (j) => j.t('bottleneck-event-end') },
  ],
};
