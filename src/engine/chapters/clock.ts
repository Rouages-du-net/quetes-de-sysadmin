// Story "On Call" — chapter "The clock": Monday morning, the morning show
// (6–9 a.m.) was only recorded from 8:09. The server, migrated this
// weekend, lives on UTC time (cron starts the recording at 6:00 UTC, 8:00
// in Paris) and its clock is late: NTP is stopped, and timesyncd's
// configuration points to the former host's NTP server, which doesn't
// answer. Set the time zone, give the right NTP server, enable
// synchronization, and restart cron (which reads the time zone at start).
// Objective checked on the state: time zone Europe/Paris, clock synchronized
// by timesyncd (enabled at boot), cron restarted after the change.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html,
// https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html,
// https://wiki.debian.org/TimeZoneChanges

import { d, f, name, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { desync, timeOfDay, displayUpdate, synchronise } from '../time';

const M = '/home/you';
// The real time: Monday 30 August 2027, 9:12 a.m. in Paris (local time read as UTC).
const NOW = Date.UTC(2027, 7, 30, 9, 12, 0);

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    radio: { uid: 996, group: 'radio', home: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    'systemd-timesync': { uid: 997, group: 'systemd-timesync', home: '/', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    zoe: { uid: 1001, group: 'zoe' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'zoe'] },
    sudo: { gid: 27, members: ['you', 'zoe'] },
    radio: { gid: 996, members: [] },
    'systemd-timesync': { gid: 997, members: [] },
    you: { gid: 1000, members: [] },
    zoe: { gid: 1001, members: [] },
  },
});

const sd = (j: Game) => systemd(j)!;
const h = (j: Game) => timeOfDay(j)!;
const timesyncd = (j: Game) => sd(j).services['systemd-timesyncd'];
const aParis = (j: Game) => h(j).zone === 'Europe/Paris';
// cron reads the time zone at start: has it restarted since the change?
const dayACron = (j: Game) =>
  h(j).changeZone !== undefined && sd(j).services.cron.state === 'active' && sd(j).services.cron.since >= h(j).changeZone!;
const commands = (j: Game, ...names: string[]) => j.last.commands.some((c) => names.includes(c[0]) || (c[0] === 'sudo' && names.includes(c[1])));

export const clock: Chapter = {
  id: 'clock',
  number: 4,
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
    'find',
    'echo',
    'id',
    'whoami',
    'ps',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'crontab',
    'date',
    'timedatectl',
  ],
  home: M,
  welcome: 'message_from_zoe.txt',
  names: true,
  final: 'end',
  password: 'antenna-2027',
  accounts,
  state: (t) => ({
    systemd: newSystemd('radio', Date.UTC(2027, 7, 28, 22, 40, 0), NOW, {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      'radio-stream': {
        description: t('radio-unit-stream'),
        active: true,
        executable: 'stream',
        process: [{ pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' }],
      },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' }],
      },
      'systemd-timesyncd': {
        description: 'Network Time Synchronization',
        active: false,
        state: 'inactive',
        executable: 'systemd-timesyncd',
        process: [{ pid: 702, user: 'systemd-timesync', cpu: 0, mem: 0.1, command: '/lib/systemd/systemd-timesyncd' }],
        load: synchronise,
        stop: desync,
      },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' },
    ],
    // The machine: on UTC, and its clock is 9 minutes late.
    clockTime: {
      zone: 'Etc/UTC',
      offset: -9 * 60_000 - 17_000,
      synchronised: false,
      servers: { 'ntp.hosting.example': '192.0.2.123' },
      // Public NTP servers are filtered by the host; the former one no longer answers.
      muted: {
        'ntp.old-hosting.example': '198.51.100.7',
        '0.debian.pool.ntp.org': '203.0.113.10',
        '1.debian.pool.ntp.org': '203.0.113.11',
        '2.debian.pool.ntp.org': '203.0.113.12',
        '3.debian.pool.ntp.org': '203.0.113.13',
      },
    },
    crontabs: {
      radio: `# m h  dom mon dow   command\n0 6 * * 1-5 /usr/local/bin/record ${name(t, 'morning-show')} 180\n0 23 * * * /usr/local/bin/record ${name(t, 'night-show')} 240\n`,
    },
  }),
  initialise: (j) => displayUpdate(j),
  // With each command, a few seconds pass; without NTP, the clock falls further behind.
  afterCommand: (j) => {
    sd(j).clock += 5000;
    if (!h(j).synchronised) h(j).offset -= 1000;
    displayUpdate(j);
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('radio'),
        timezone: file('Etc/UTC'),
        localtime: f('', { owner: 'root', link: '/usr/share/zoneinfo/Etc/UTC' }),
        systemd: place({ 'timesyncd.conf': file(t('clock-timesyncd-conf')), system: place({}) }),
      }),
      home: place({
        you: d({ 'message_from_zoe.txt': f(t('clock-message-zoe')), 'mail_hosting.txt': f(t('clock-mail-host')) }),
        zoe: place({}, { owner: 'zoe', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: place({ local: place({ bin: place({ record: file(t('clock-script-save'), { owner: 'root', mode: 'rwxr-xr-x' }) }) }) }),
      var: place({
        log: place({
          radio: place(
            { 'record.log': f(t('clock-journal-save'), { lines: true, owner: 'radio', group: 'adm', mode: 'rw-r-----' }) },
            { owner: 'radio', group: 'adm', mode: 'rwxr-x---' },
          ),
        }),
      }),
    });
  },
  events: [
    {
      id: 'utc',
      condition: (j) => commands(j, 'date', 'timedatectl') && /\bUTC\b/.test(j.last.output) && !aParis(j),
      message: (j) => j.t('clock-event-utc'),
    },
    {
      id: 'late',
      condition: (j) => commands(j, 'timedatectl') && /synchronized: no/.test(j.last.output),
      message: (j) => j.t('clock-event-late'),
    },
    { id: 'manual', condition: (j) => !!h(j).manual && !h(j).synchronised, message: (j) => j.t('clock-event-manual') },
    { id: 'silent', condition: (j) => timesyncd(j).state === 'active' && !h(j).synchronised, message: (j) => j.t('clock-event-silent') },
    { id: 'synced', condition: (j) => h(j).synchronised, message: (j) => j.t('clock-event-synced') },
    { id: 'not-active', condition: (j) => h(j).synchronised && !timesyncd(j).active, message: (j) => j.t('clock-event-not-active') },
    {
      id: 'cron',
      condition: (j) => aParis(j) && !dayACron(j) && commands(j, 'timedatectl', 'date', 'systemctl', 'crontab'),
      message: (j) => j.t('clock-event-cron'),
    },
    {
      id: 'end',
      condition: (j) => aParis(j) && h(j).synchronised && timesyncd(j).state === 'active' && timesyncd(j).active && dayACron(j),
      message: (j) => j.t('clock-event-end'),
    },
  ],
};
