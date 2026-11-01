// Histoire « L'Astreinte » — chapitre « Le post-mortem » : dimanche nuit,
// Théo était d'astreinte et le direct a coupé 45 minutes. Pour
// l'association, on écrit un post-mortem sans reproche. Les notes de Théo
// sont approximatives : les vraies heures et la vraie cause sont dans les
// journaux (journalctl --since/--until, last, l'historique d'apt, le
// courrier d'alerte). La mise à jour automatique (unattended-upgrades, avec
// needrestart) a relancé le relais à 2 h 13 ; il n'a pas pu repartir à
// cause d'une option inconnue écrite dans sa configuration le 20 août, et
// jamais appliquée depuis.
// Objectif vérifié sur l'état : le fichier ~/postmortem.md, complété (plus
// de « à compléter »), avec les heures exactes (2 h 13, 2 h 15, 2 h 58),
// l'impact (45 minutes), le déclencheur et la cause (stream.conf, depuis le
// 20 août), au moins deux actions, ce qui a marché, et sans reproche.
// Source : https://sre.google/sre-book/postmortem-culture/

import { path, d, f, accountsFiles, player, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { writeLog, newSystemd, systemd } from '../systemd';

const M = '/home/you';
const FILE = `${M}/postmortem.md`;
// Lundi 13 septembre 2027, 10 h.
const NOW = Date.UTC(2027, 8, 13, 10, 0, 0);
const NIGHT = (h: number, m: number, s = 0) => Date.UTC(2027, 8, 12, h, m, s);

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    radio: { uid: 996, group: 'radio', home: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    zoe: { uid: 1001, group: 'zoe' },
    theo: { uid: 1002, group: 'theo' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'zoe', 'theo'] },
    mail: { gid: 8, members: [] },
    sudo: { gid: 27, members: ['you', 'zoe', 'theo'] },
    radio: { gid: 996, members: [] },
    you: { gid: 1000, members: [] },
    zoe: { gid: 1001, members: [] },
    theo: { gid: 1002, members: [] },
  },
});

const sd = (j: Game) => systemd(j)!;

// Le texte du post-mortem, section par section (titres « ## », dans la langue du jeu).
function sections(j: Game, text: string): Record<string, string> {
  const names = ['resume', 'chronologie', 'impact', 'causes', 'marche', 'actions'];
  const titres = Object.fromEntries(names.map((n) => [j.t(`post-mortem-section-${n}`).toLowerCase(), n]));
  const r: Record<string, string> = {};
  let current = '';
  for (const line of text.split('\n')) {
    const title = /^##\s+(.*)$/.exec(line);
    if (title) {
      current = titres[title[1].trim().toLowerCase()] ?? '';
      continue;
    }
    if (current) r[current] = `${r[current] ?? ''}${line}\n`;
  }
  return r;
}

// Une heure, écrite 02:13, 2:13, 2 h 13 ou 2h13.
const timeOfDay = (h: number, m: number) => new RegExp(`\\b0?${h}\\s*(?::|h)\\s*${String(m).padStart(2, '0')}\\b`, 'i');
const words = (j: Game, key: string) =>
  j
    .t(key)
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
const containsOne = (text: string, listing: string[]) => listing.some((m) => text.toLowerCase().includes(m));

/** Ce qui manque encore au post-mortem (identifiants de messages), vide s'il est complet. */
export function missing(j: Game): string[] {
  const text = j.read(path(j.t, FILE)) ?? '';
  const s = sections(j, text);
  const full = (n: string) => (s[n] ?? '').trim().length > 0;
  const m: string[] = [];
  if (text.includes(j.t('post-mortem-a-complete'))) m.push('template');
  const timer = s.chronologie ?? '';
  if (!timeOfDay(2, 13).test(timer) || !timeOfDay(2, 15).test(timer) || !timeOfDay(2, 58).test(timer)) m.push('timeline');
  if (!/\b45\b/.test(s.impact ?? '')) m.push('impact');
  const causes = s.causes ?? '';
  if (!/stream\.conf|bitrate_max/i.test(causes) || !containsOne(causes, words(j, 'post-mortem-words-trigger'))) m.push('cause');
  if (!containsOne(causes, words(j, 'post-mortem-words-origin'))) m.push('origin');
  if ((s.actions ?? '').split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l)).length < 2) m.push('actions');
  if (!full('marche') || !full('resume')) m.push('works');
  return m;
}

// Un mot qui cherche un coupable, dans les sections (pas dans l'en-tête du modèle).
const blame = (j: Game) => {
  const text = Object.values(sections(j, j.read(path(j.t, FILE)) ?? ''))
    .join('\n')
    .toLowerCase();
  return words(j, 'post-mortem-words-blame').find((word) => text.includes(word));
};

export const postMortem: Chapter = {
  id: 'post-mortem',
  number: 6,
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
    'cp',
    'systemctl',
    'journalctl',
    'last',
    'mail',
    'diff',
  ],
  home: M,
  welcome: 'message_from_zoe.txt',
  names: true,
  final: 'end',
  password: 'antenna-2027',
  accounts,
  state: (t) => ({
    systemd: newSystemd('radio', Date.UTC(2027, 7, 1, 6, 0, 0), NOW, {
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
        process: [{ pid: 25232, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' }],
      },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' }],
      },
      'apt-daily-upgrade': {
        description: 'Daily apt upgrade and clean activities',
        active: false,
        state: 'inactive',
        executable: 'unattended-upgrade',
        oneshot: true,
      },
      probe: { description: 'Radio Quartier probe', active: false, state: 'inactive', executable: 'probe', oneshot: true },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 25232, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' },
    ],
    pastConnections: [
      { account: 'zoe', tty: 'pts/1', since: '198.51.100.80', start: Date.UTC(2027, 7, 20, 21, 16), end: Date.UTC(2027, 7, 20, 21, 54) },
      { account: player(t), tty: 'pts/0', since: '198.51.100.23', start: Date.UTC(2027, 8, 6, 18, 25), end: Date.UTC(2027, 8, 6, 19, 40) },
      { account: 'theo', tty: 'pts/0', since: '203.0.113.45', start: NIGHT(2, 41), end: NIGHT(3, 5) },
      { account: player(t), tty: 'pts/0', since: '198.51.100.23', start: NOW - 60_000, end: null },
    ],
  }),
  // La nuit du 11 au 12 septembre, telle que le journal l'a gardée.
  initialise: (j) => {
    const s = sd(j);
    const now = s.clock;
    const line = (ms: number, unit: string, ident: string, pid: number, message: string, priority = 6) => {
      s.clock = ms;
      writeLog(s, unit, ident, pid, message, priority, false);
    };
    const flux = 'radio-stream.service';
    const sudo = (ms: number, pid: number, account: string, command: string) =>
      line(
        ms,
        '',
        'sudo',
        pid,
        `${account.padStart(8)} : TTY=pts/${account === 'zoe' ? 1 : 0} ; PWD=/home/${account} ; USER=root ; COMMAND=${command}`,
        5,
      );
    line(Date.UTC(2027, 7, 20, 21, 16, 2), 'ssh.service', 'sshd', 7712, 'Accepted publickey for zoe from 198.51.100.80 port 50122 ssh2');
    sudo(Date.UTC(2027, 7, 20, 21, 20, 41), 7790, 'zoe', '/usr/bin/nano /etc/radio/stream.conf');
    line(Date.UTC(2027, 7, 20, 21, 54, 10), 'ssh.service', 'sshd', 7712, 'Disconnected from user zoe 198.51.100.80 port 50122');
    line(
      NIGHT(2, 12, 40),
      'apt-daily-upgrade.service',
      'systemd',
      1,
      'Starting apt-daily-upgrade.service - Daily apt upgrade and clean activities...',
    );
    line(NIGHT(2, 13, 5), flux, 'systemd', 1, 'Stopping radio-stream.service - Radio Quartier stream relay...');
    line(NIGHT(2, 13, 5), flux, 'systemd', 1, 'Stopped radio-stream.service - Radio Quartier stream relay.');
    line(NIGHT(2, 13, 5), flux, 'systemd', 1, 'Started radio-stream.service - Radio Quartier stream relay.');
    line(NIGHT(2, 13, 6), flux, 'stream', 24410, "/etc/radio/stream.conf:7: unknown option 'bitrate_max'", 3);
    line(NIGHT(2, 13, 6), flux, 'systemd', 1, 'radio-stream.service: Main process exited, code=exited, status=1/FAILURE', 4);
    line(NIGHT(2, 13, 6), flux, 'systemd', 1, "radio-stream.service: Failed with result 'exit-code'.", 4);
    line(NIGHT(2, 13, 20), 'apt-daily-upgrade.service', 'systemd', 1, 'apt-daily-upgrade.service: Deactivated successfully.');
    line(NIGHT(2, 13, 20), 'apt-daily-upgrade.service', 'systemd', 1, 'Finished apt-daily-upgrade.service - Daily apt upgrade and clean activities.');
    // La sonde du chapitre précédent, toutes les 5 minutes : elle alerte de 2 h 15 à 2 h 55.
    const alerts: string[] = [];
    for (let m = 15; m <= 55; m += 5) {
      line(NIGHT(2, m), 'probe.service', 'systemd', 1, 'Starting probe.service - Sonde de Radio Quartier...');
      line(NIGHT(2, m, 1), 'probe.service', 'systemd', 1, 'Finished probe.service - Sonde de Radio Quartier.');
      alerts.push(
        `From root@radio Sun Sep 12 02:${String(m).padStart(2, '0')}:01 2027\nTo: root\nSubject: Alerte-radio\nFrom: root <root@radio>\n\nconnect to address localhost and port 8000: Connection refused\nHTTP CRITICAL - Unable to open TCP socket\n`,
      );
      if (m === 40) line(NIGHT(2, 41, 12), 'ssh.service', 'sshd', 25102, 'Accepted publickey for theo from 203.0.113.45 port 52114 ssh2');
      if (m === 40) sudo(NIGHT(2, 44, 30), 25140, 'theo', '/usr/bin/journalctl -u radio-stream');
      if (m === 50) sudo(NIGHT(2, 52, 10), 25188, 'theo', '/usr/bin/nano /etc/radio/stream.conf');
    }
    sudo(NIGHT(2, 58, 3), 25230, 'theo', '/usr/bin/systemctl restart radio-stream');
    line(NIGHT(2, 58, 3), flux, 'systemd', 1, 'Starting radio-stream.service - Radio Quartier stream relay...');
    line(NIGHT(2, 58, 4), flux, 'systemd', 1, 'Started radio-stream.service - Radio Quartier stream relay.');
    line(NIGHT(3, 5, 40), 'ssh.service', 'sshd', 25102, 'Disconnected from user theo 203.0.113.45 port 52114');
    line(NOW - 60_000, 'ssh.service', 'sshd', 26011, `Accepted publickey for ${j.player} from 198.51.100.23 port 40388 ssh2`);
    s.services['radio-stream'].since = NIGHT(2, 58, 4);
    s.clock = now;
    const box = j.find('/var/mail/theo');
    if (box?.type === 'fichier') box.content = alerts.join('\n');
    j.state.readPostMortem = j.read(path(j.t, FILE));
  },
  // Après chaque enregistrement du post-mortem, Zoé le relit.
  afterCommand: (j) => {
    const text = j.read(path(j.t, FILE));
    if (text === j.state.readPostMortem || j.state.finishedPostMortem) return;
    j.state.readPostMortem = text;
    const word = blame(j);
    const rest = missing(j);
    if (!rest.length && !word) {
      j.state.finishedPostMortem = true;
      return;
    }
    return [
      j.t('post-mortem-review'),
      ...(word ? [j.t('post-mortem-blame', { word: word })] : []),
      ...rest.map((m) => `- ${j.t(`post-mortem-missing-${m}`)}`),
    ].join('\n');
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const log = (text: string) => f(text, { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('radio'),
        aliases: file('# See man 5 aliases for format\npostmaster:    root\nroot: zoe, theo'),
        radio: place({ 'stream.conf': file(t('post-mortem-conf-flux')) }),
        apt: place({ 'apt.conf.d': place({ '50unattended-upgrades': file(t('post-mortem-unattended-conf')) }) }),
      }),
      home: place({
        you: d({
          'message_from_zoe.txt': f(t('post-mortem-message-zoe')),
          'notes_theo.txt': f(t('post-mortem-notes-theo')),
          'postmortem.md': f(t('post-mortem-template'), { lines: true }),
        }),
        zoe: place({}, { owner: 'zoe', mode: 'rwx------' }),
        theo: place({}, { owner: 'theo', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      var: place({
        log: place({
          apt: place({ 'history.log': log(t('post-mortem-apt-history')) }),
          'unattended-upgrades': place({ 'unattended-upgrades-dpkg.log': log(t('post-mortem-unattended-dpkg')) }),
        }),
        mail: place(
          { theo: f('', { lines: true, owner: 'theo', group: 'mail', mode: 'rw-rw----' }) },
          { owner: 'root', group: 'mail', mode: 'rwxrwsr-x' },
        ),
      }),
    });
  },
  events: [
    {
      id: 'notes',
      condition: (j) => j.last.commands.some((c) => c.some((a) => a.endsWith('notes_theo.txt'))),
      message: (j) => j.t('post-mortem-event-notes'),
    },
    {
      id: 'reboot',
      condition: (j) => /Stopping radio-stream\.service/.test(j.last.output) && /Starting apt-daily-upgrade/.test(j.last.output),
      message: (j) => j.t('post-mortem-event-reboot'),
    },
    {
      id: 'origin',
      condition: (j) => /zoe : TTY=pts\/1 .*stream\.conf/.test(j.last.output),
      message: (j) => j.t('post-mortem-event-origin'),
    },
    { id: 'end', condition: (j) => !!j.state.finishedPostMortem, message: (j) => j.t('post-mortem-event-end') },
  ],
};
