// Histoire « L'Astreinte » — chapitre « L'horloge » : lundi matin, la
// matinale (6 h – 9 h) ne s'est enregistrée qu'à partir de 8 h 09. Le
// serveur, migré ce week-end, vit à l'heure UTC (cron lance l'enregistrement
// à 6 h UTC, 8 h à Paris) et son horloge retarde : NTP est arrêté, et la
// configuration de timesyncd vise le serveur NTP de l'ancien hébergeur, qui
// ne répond pas. On règle le fuseau, on donne le bon serveur NTP, on active
// la synchronisation, et on redémarre cron (qui lit le fuseau au démarrage).
// Objectif vérifié sur l'état : fuseau Europe/Paris, horloge synchronisée
// par timesyncd (activé au démarrage), cron redémarré après le changement.
// Sources : https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html,
// https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html,
// https://wiki.debian.org/TimeZoneChanges

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { desync, timeOfDay, displayUpdate, synchronise } from '../time';

const M = '/home/vous';
// La vraie heure : lundi 30 août 2027, 9 h 12 à Paris (heure locale lue comme UTC).
const NOW = Date.UTC(2027, 7, 30, 9, 12, 0);

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    radio: { uid: 996, group: 'radio', home: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    'systemd-timesync': { uid: 997, group: 'systemd-timesync', home: '/', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, group: 'vous' },
    zoe: { uid: 1001, group: 'zoe' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['vous', 'zoe'] },
    sudo: { gid: 27, members: ['vous', 'zoe'] },
    radio: { gid: 996, members: [] },
    'systemd-timesync': { gid: 997, members: [] },
    vous: { gid: 1000, members: [] },
    zoe: { gid: 1001, members: [] },
  },
});

const sd = (j: Game) => systemd(j)!;
const h = (j: Game) => timeOfDay(j)!;
const timesyncd = (j: Game) => sd(j).services['systemd-timesyncd'];
const aParis = (j: Game) => h(j).zone === 'Europe/Paris';
// cron lit le fuseau à son démarrage : a-t-il redémarré depuis le changement ?
const dayACron = (j: Game) =>
  h(j).changeZone !== undefined && sd(j).services.cron.state === 'active' && sd(j).services.cron.since >= h(j).changeZone!;
const commands = (j: Game, ...names: string[]) => j.last.commands.some((c) => names.includes(c[0]) || (c[0] === 'sudo' && names.includes(c[1])));

export const clock: Chapter = {
  id: 'horloge',
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
  welcome: 'message_de_zoe.txt',
  names: true,
  final: 'fin',
  password: 'antenne-2027',
  accounts,
  state: () => ({
    systemd: newSystemd('radio', Date.UTC(2027, 7, 28, 22, 40, 0), NOW, {
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
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' },
    ],
    // La machine : en UTC, et son horloge retarde de 9 minutes.
    heure: {
      zone: 'Etc/UTC',
      offset: -9 * 60_000 - 17_000,
      synchronised: false,
      servers: { 'ntp.hosting.example': '192.0.2.123' },
      // Les serveurs NTP publics sont filtrés par l'hébergeur ; l'ancien ne répond plus.
      muted: {
        'ntp.old-hosting.example': '198.51.100.7',
        '0.debian.pool.ntp.org': '203.0.113.10',
        '1.debian.pool.ntp.org': '203.0.113.11',
        '2.debian.pool.ntp.org': '203.0.113.12',
        '3.debian.pool.ntp.org': '203.0.113.13',
      },
    },
    crontabs: {
      radio: '# m h  dom mon dow   command\n0 6 * * 1-5 /usr/local/bin/record matinale 180\n0 23 * * * /usr/local/bin/record nuit 240\n',
    },
  }),
  initialise: (j) => displayUpdate(j),
  // Chaque commande, quelques secondes passent ; sans NTP, l'horloge prend encore du retard.
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
        systemd: place({ 'timesyncd.conf': file(t('horloge-timesyncd-conf')), system: place({}) }),
      }),
      home: place({
        vous: d({ 'message_de_zoe.txt': f(t('horloge-message-de-zoe')), 'mail_hebergeur.txt': f(t('horloge-mail-hebergeur')) }),
        zoe: place({}, { owner: 'zoe', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: place({ local: place({ bin: place({ record: file(t('horloge-script-enregistrer'), { owner: 'root', mode: 'rwxr-xr-x' }) }) }) }),
      var: place({
        log: place({
          radio: place(
            { 'record.log': f(t('horloge-journal-enregistrer'), { lines: true, owner: 'radio', group: 'adm', mode: 'rw-r-----' }) },
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
      message: (j) => j.t('horloge-evenement-utc'),
    },
    {
      id: 'retard',
      condition: (j) => commands(j, 'timedatectl') && /synchronized: no/.test(j.last.output),
      message: (j) => j.t('horloge-evenement-retard'),
    },
    { id: 'manuel', condition: (j) => !!h(j).manual && !h(j).synchronised, message: (j) => j.t('horloge-evenement-manuel') },
    { id: 'muet', condition: (j) => timesyncd(j).state === 'active' && !h(j).synchronised, message: (j) => j.t('horloge-evenement-muet') },
    { id: 'synchro', condition: (j) => h(j).synchronised, message: (j) => j.t('horloge-evenement-synchro') },
    { id: 'non-active', condition: (j) => h(j).synchronised && !timesyncd(j).active, message: (j) => j.t('horloge-evenement-non-active') },
    {
      id: 'cron',
      condition: (j) => aParis(j) && !dayACron(j) && commands(j, 'timedatectl', 'date', 'systemctl', 'crontab'),
      message: (j) => j.t('horloge-evenement-cron'),
    },
    {
      id: 'fin',
      condition: (j) => aParis(j) && h(j).synchronised && timesyncd(j).state === 'active' && timesyncd(j).active && dayACron(j),
      message: (j) => j.t('horloge-evenement-fin'),
    },
  ],
};
