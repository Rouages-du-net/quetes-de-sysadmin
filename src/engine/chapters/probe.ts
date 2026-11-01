// Histoire « L'Astreinte » — chapitre « La sonde » : après quatre nuits à
// réparer après coup, Zoé veut être prévenue avant que ça casse. Elle a
// commencé une sonde (/usr/local/bin/probe) qui lance des plugins de
// supervision (monitoring-plugins : check_disk, check_http, check_procs) et
// envoie par courrier tout ce qui n'est pas OK. À compléter (le volume des
// données et ses inodes, le direct) et à planifier toutes les 5 minutes
// (un timer systemd, ou cron). Puis Zoé organise un exercice : cette nuit,
// elle provoquera deux pannes (le relais qui tombe, des milliers de petits
// fichiers qui épuisent les inodes du volume des données).
// Objectif vérifié sur l'état, après la nuit simulée : chaque panne a donné
// une alerte à temps (le relais en moins de 15 minutes, les inodes avant
// d'être épuisés), et aucune alerte n'est partie quand tout allait bien.
// Sources : https://www.monitoring-plugins.org/doc/guidelines.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html

import { path, d, f, accountsFiles, name, type Chapter, type Accounts, type Directory, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import { start, writeLog, newSystemd, systemd } from '../systemd';
import { passTime } from '../timers';
import { mails, PLUGINS } from '../commands/monitoring';

const M = '/home/you';
const DATA = '/srv/radio';
const THUMBNAILS = '/srv/radio/podcasts/thumbnails';
const MINUTE = 60_000;
const INODES = 16_384;
// Lundi 6 septembre 2027, 18 h 30.
const NOW = Date.UTC(2027, 8, 6, 18, 30, 0);
// Les deux pannes de l'exercice, en minutes après minuit, et le délai pour réagir.
const RELAY_FAILURE = 70; // 1 h 10
const RELAY_DELAY = 15;
const INODES_FAILURE = 100; // 1 h 40 : l'import commence
const BY_MINUTE = 120;

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
    mail: { gid: 8, members: [] },
    sudo: { gid: 27, members: ['you', 'zoe'] },
    radio: { gid: 996, members: [] },
    you: { gid: 1000, members: [] },
    zoe: { gid: 1001, members: [] },
  },
});

const sd = (j: Game) => systemd(j)!;
const shell = (j: Game) => j as Shell;
const relay = (j: Game) => sd(j).services['radio-stream'];
const volume = (j: Game) => shell(j).mount(DATA)!;
const timeOfDay = (ms: number) => new Date(ms).toISOString().slice(11, 16);
// Les alertes que Zoé reçoit (directement, ou par l'alias de root).
const alertsForZoe = (j: Game) => mails(shell(j)).filter((c) => c.a === 'zoe');

// Ce qui décide d'une nouvelle nuit : la sonde, les crontabs, et les timers tels que systemd les a chargés.
function fingerprint(j: Game): string {
  const timers = Object.entries(sd(j).timers ?? {}).map(([n, m]) => [
    n,
    m.state,
    m.unit,
    m.calendar,
    m.afterBoot,
    m.afterActivation,
    m.afterLast,
  ]);
  const services = Object.entries(sd(j).services)
    .filter(([, x]) => x.file)
    .map(([n, x]) => [n, x.file]);
  return JSON.stringify([j.read('/usr/local/bin/probe'), j.state.crontabs, timers, services]);
}

// Quelque chose est-il planifié (un timer actif, une ligne de crontab) ?
const scheduled = (j: Game) =>
  Object.values(sd(j).timers ?? {}).some((m) => m.state === 'active' && m.file.startsWith('/etc/')) ||
  Object.values((j.state.crontabs ?? {}) as Record<string, string>).some((t) => t.split('\n').some((l) => l.trim() && !l.trim().startsWith('#')));

/** La nuit d'exercice : de maintenant à 6 h, deux pannes ; Zoé réagit aux alertes qu'elle reçoit. */
function night(j: Game): string {
  const s = sd(j);
  const startTime = s.clock;
  const midnight = (Math.floor(startTime / 86_400_000) + 1) * 86_400_000;
  const end = midnight + 6 * 60 * MINUTE;
  const alreadyReceived = alertsForZoe(j).length;
  const place = () => j.find(path(j.t, THUMBNAILS)) as Directory | null;
  // Les fenêtres où une alerte est attendue : [début, réparation + 15 min].
  const fallsRelay = midnight + RELAY_FAILURE * MINUTE;
  const startImport = midnight + INODES_FAILURE * MINUTE;
  let alertRelay: number | null = null;
  let repairedRelay: number | null = null;
  let alertInodes: number | null = null;
  let stoppedInodes: number | null = null;
  let fullInodes: number | null = null;
  let no = 0;
  let views = alreadyReceived;
  let number = 0;
  const during = (t: number, failureStart: number, repaired: number | null) => t >= failureStart && t <= (repaired ?? Infinity) + 15 * MINUTE;
  const launches = passTime(shell(j), startTime, end, (t) => {
    // Les courriers arrivés depuis la minute d'avant : Zoé les lit.
    const received = alertsForZoe(j);
    for (const c of received.slice(views)) {
      const relayInFailure = during(c.time, fallsRelay, repairedRelay);
      const inodesInFailure = during(c.time, startImport, stoppedInodes);
      if (relayInFailure && alertRelay === null && relay(j).state !== 'active') alertRelay = c.time;
      if (inodesInFailure && alertInodes === null && stoppedInodes === null) alertInodes = c.time;
      if (!relayInFailure && !inodesInFailure) no++;
    }
    views = received.length;
    // Panne 1 : le relais tombe.
    if (t === fallsRelay) {
      relay(j).state = 'failed';
      relay(j).result = 'signal';
      relay(j).since = t;
      j.state.process = (j.state.process ?? []).filter((p: { pid: number }) => p.pid !== 1730);
      writeLog(s, 'radio-stream.service', 'systemd', 1, 'radio-stream.service: Main process exited, code=killed, status=11/SEGV', 4, false);
      writeLog(s, 'radio-stream.service', 'systemd', 1, "radio-stream.service: Failed with result 'signal'.", 4, false);
    }
    // Zoé relance le relais 10 minutes après l'alerte (ou à son réveil, à 6 h).
    if (alertRelay !== null && repairedRelay === null && t >= alertRelay + 10 * MINUTE) {
      start(j, s, 'radio-stream');
      repairedRelay = t;
    }
    // Panne 2 : l'import des vignettes crée des milliers de petits fichiers, jusqu'à ce que Zoé l'arrête.
    if (t >= startImport && stoppedInodes === null && fullInodes === null) {
      const v = place();
      const free = INODES - shell(j).usedInodes(volume(j));
      const howMany = Math.min(BY_MINUTE, free);
      if (v)
        for (let k = 0; k < howMany; k++)
          v.children[`${name(j.t, 'thumbnail')}-${String(++number).padStart(5, '0')}.jpg`] = { type: 'file', content: '', size: 0, owner: 'radio' };
      if (free <= BY_MINUTE) {
        fullInodes = t;
        writeLog(s, 'radio-stream.service', 'stream', 1730, `record: cannot create ${path(j.t, '/srv/radio/shows')}/nuit.ogg: No space left on device`, 3, false);
      }
    }
    // Zoé arrête l'import et efface les vignettes en trop, 10 minutes après l'alerte.
    if (alertInodes !== null && stoppedInodes === null && t >= alertInodes + 10 * MINUTE) {
      stoppedInodes = t;
      const v = place();
      if (v) v.children = {};
    }
  });
  // Au matin, Zoé remet tout d'aplomb (et note ce qui s'est passé).
  if (relay(j).state !== 'active') start(j, s, 'radio-stream');
  const v = place();
  if (v) v.children = {};
  const r: string[] = [j.t('probe-night', { runs: launches })];
  r.push(
    alertRelay !== null
      ? j.t('probe-night-relay-seen', {
          alert: timeOfDay(alertRelay),
          repaired: timeOfDay(repairedRelay ?? alertRelay),
          minutes: Math.round(((repairedRelay ?? alertRelay) - fallsRelay) / MINUTE),
        })
      : j.t('probe-night-relay-missed'),
  );
  r.push(
    alertInodes !== null && (fullInodes === null || alertInodes < fullInodes)
      ? j.t('probe-night-inodes-seen', { alert: timeOfDay(alertInodes) })
      : j.t('probe-night-inodes-missed', { full: timeOfDay(fullInodes ?? end) }),
  );
  if (no) r.push(j.t('probe-night-false', { count: no }));
  if (!launches) r.push(j.t('probe-night-never'));
  const okRelay = alertRelay !== null && alertRelay - fallsRelay <= RELAY_DELAY * MINUTE;
  const inodesOk = alertInodes !== null && (fullInodes === null || alertInodes < fullInodes);
  if (okRelay && inodesOk && !no) j.state.drillSucceeded = true;
  else if (alertRelay !== null && !okRelay) r.push(j.t('probe-night-relay-slow'));
  // Le matin : 7 h.
  s.clock = end + 60 * MINUTE;
  return r.join('\n\n');
}

export const probe: Chapter = {
  id: 'probe',
  number: 5,
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
    'chmod',
    'touch',
    'mkdir',
    'cp',
    'df',
    'du',
    'curl',
    'systemctl',
    'journalctl',
    'crontab',
    'date',
    'mail',
    'check_disk',
    'check_http',
    'check_procs',
    'systemd-analyze',
  ],
  home: M,
  welcome: 'message_from_zoe.txt',
  names: true,
  final: 'end',
  password: 'antenna-2027',
  accounts,
  state: () => ({
    systemd: (() => {
      const s = newSystemd('radio', Date.UTC(2027, 7, 30, 9, 30, 0), NOW, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [{ pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        'radio-stream': {
          description: 'Radio Quartier stream relay',
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
        logrotate: { description: 'Rotate log files', active: false, state: 'inactive', executable: 'logrotate', oneshot: true },
      });
      // Les timers livrés avec Debian.
      s.timers = {
        logrotate: {
          description: 'Daily rotation of log files',
          unit: 'logrotate',
          calendar: ['daily'],
          active: true,
          state: 'active',
          since: s.clock,
          file: '/usr/lib/systemd/system/logrotate.timer',
          last: Date.UTC(2027, 8, 6, 0, 0, 0),
        },
      };
      return s;
    })(),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' },
    ],
    // Le relais sert le direct sur le port 8000.
    apps: { '127.0.0.1:8000': { service: 'radio-stream', pages: { '/live': 'OggS', '/': 'Radio Quartier relay' } } },
    listening: [{ proto: 'tcp', address: '0.0.0.0', port: 8000, process: 'stream', pid: 1730 }],
    mounts: [
      { path: '/', capacity: 20_000_000_000, name: '/dev/vda1', system: 'ext4', inodes: 1_310_720, inodesBase: 61_204 },
      { path: DATA, capacity: 268_435_456, name: '/dev/vdb1', system: 'ext4', inodes: INODES, inodesBase: 11 },
    ],
    crontabs: {},
  }),
  afterCommand: (j) => {
    sd(j).clock += 20_000;
    if (j.state.drillSucceeded || !scheduled(j) || j.state.nightFingerprint === fingerprint(j)) return;
    j.state.nightFingerprint = fingerprint(j);
    return night(j);
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const plugin = () => f('', { owner: 'root', mode: 'rwxr-xr-x', size: 180_000 });
    const radio: Rights = { owner: 'radio' };
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('radio'),
        aliases: file('# See man 5 aliases for format\npostmaster:    root\nroot: zoe'),
        systemd: place({ system: place({}) }),
      }),
      home: place({ you: d({ 'message_from_zoe.txt': f(t('probe-message-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
      srv: place({
        radio: place(
          {
            'lost+found': place({}, { owner: 'root', mode: 'rwx------' }),
            shows: place(
              {
                'matinale-2027-09-06.ogg': f('', { owner: 'radio', size: 92_000_000 }),
                'nuit-2027-09-06.ogg': f('', { owner: 'radio', size: 48_000_000 }),
              },
              radio,
            ),
            podcasts: place({ thumbnails: place({}, radio), 'README.txt': file(t('probe-podcasts-readme'), radio) }, radio),
          },
          radio,
        ),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: place({
        lib: place({
          nagios: place({ plugins: place({ check_disk: plugin(), check_http: plugin(), check_procs: plugin() }) }),
          modules: f('', { owner: 'root', size: 9_000_000_000 }),
        }),
        local: place({
          bin: place({
            probe: file(t('probe-script'), { owner: 'root', mode: 'rwxr-xr-x' }),
            stream: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 8_400_000 }),
          }),
        }),
      }),
      var: place({ mail: place({}, { owner: 'root', group: 'mail', mode: 'rwxrwsr-x' }), lib: place({ radio: place({}, radio) }) }),
    });
  },
  events: [
    {
      id: 'plugin-outside-path',
      condition: (j) => j.last.commands.some((c) => /^check_/.test(c[0]) || (c[0] === 'sudo' && /^check_/.test(c[1] ?? ''))),
      message: (j) => j.t('probe-event-plugin-outside-path', { directory: PLUGINS }),
    },
    {
      id: 'first-alert',
      condition: (j) => !j.state.nightFingerprint && alertsForZoe(j).length > 0,
      message: (j) => j.t('probe-event-first-alert'),
    },
    { id: 'end', condition: (j) => !!j.state.drillSucceeded, message: (j) => j.t('probe-event-end') },
  ],
};
