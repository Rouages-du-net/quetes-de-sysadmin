// Story "On Call" — chapter "The Post-Mortem": on Sunday night, Théo was on
// call and the live stream went down for 45 minutes. For the association,
// we write a blameless post-mortem. Théo's notes are approximate: the real
// times and the real cause are in the logs (journalctl --since/--until,
// last, apt's history, the alert email). The automatic update
// (unattended-upgrades, with needrestart) restarted the relay at 2:13; it
// could not come back up because of an unknown option written into its
// configuration on 20 August, and never applied since.
// Objective checked on the state: the file ~/postmortem.md, filled in (no
// more "to be completed"), with the exact times (2:13, 2:15, 2:58), the
// impact (45 minutes), the trigger and the cause (stream.conf, since
// 20 August), at least two actions, what went well, and blameless.
// Source: https://sre.google/sre-book/postmortem-culture/

import { path, d, f, accountsFiles, player, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { writeLog, newSystemd, systemd } from '../systemd';

const M = '/home/you';
const FILE = `${M}/postmortem.md`;
// Monday 13 September 2027, 10:00.
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

// The post-mortem's text, section by section ("##" headings, in the game's language).
function sections(j: Game, text: string): Record<string, string> {
  const names = ['summary', 'timeline', 'impact', 'causes', 'went-well', 'actions'];
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

// A time, written 02:13, 2:13, 2 h 13 or 2h13.
const timeOfDay = (h: number, m: number) => new RegExp(`\\b0?${h}\\s*(?::|h)\\s*${String(m).padStart(2, '0')}\\b`, 'i');
const words = (j: Game, key: string) =>
  j
    .t(key)
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
const containsOne = (text: string, listing: string[]) => listing.some((m) => text.toLowerCase().includes(m));

/** What the post-mortem is still missing (message identifiers), empty if it is complete. */
export function missing(j: Game): string[] {
  const text = j.read(path(j.t, FILE)) ?? '';
  const s = sections(j, text);
  const full = (n: string) => (s[n] ?? '').trim().length > 0;
  const m: string[] = [];
  if (text.includes(j.t('post-mortem-a-complete'))) m.push('template');
  const timer = s.timeline ?? '';
  if (!timeOfDay(2, 13).test(timer) || !timeOfDay(2, 15).test(timer) || !timeOfDay(2, 58).test(timer)) m.push('timeline');
  if (!/\b45\b/.test(s.impact ?? '')) m.push('impact');
  const causes = s.causes ?? '';
  if (!/stream\.conf|bitrate_max/i.test(causes) || !containsOne(causes, words(j, 'post-mortem-words-trigger'))) m.push('cause');
  if (!containsOne(causes, words(j, 'post-mortem-words-origin'))) m.push('origin');
  if ((s.actions ?? '').split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l)).length < 2) m.push('actions');
  if (!full('went-well') || !full('summary')) m.push('works');
  return m;
}

// A word that looks for someone to blame, in the sections (not in the template's header).
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
        description: t('radio-unit-stream'),
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
      probe: { description: t('radio-unit-probe'), active: false, state: 'inactive', executable: 'probe', oneshot: true },
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
  // The night of 11 to 12 September, as the journal kept it.
  initialise: (j) => {
    const s = sd(j);
    const now = s.clock;
    const line = (ms: number, unit: string, ident: string, pid: number, message: string, priority = 6) => {
      s.clock = ms;
      writeLog(s, unit, ident, pid, message, priority, false);
    };
    const relay = 'radio-stream.service';
    const relayName = j.t('radio-unit-stream');
    const probeName = j.t('radio-unit-probe');
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
    line(NIGHT(2, 13, 5), relay, 'systemd', 1, `Stopping radio-stream.service - ${relayName}...`);
    line(NIGHT(2, 13, 5), relay, 'systemd', 1, `Stopped radio-stream.service - ${relayName}.`);
    line(NIGHT(2, 13, 5), relay, 'systemd', 1, `Started radio-stream.service - ${relayName}.`);
    line(NIGHT(2, 13, 6), relay, 'stream', 24410, "/etc/radio/stream.conf:7: unknown option 'bitrate_max'", 3);
    line(NIGHT(2, 13, 6), relay, 'systemd', 1, 'radio-stream.service: Main process exited, code=exited, status=1/FAILURE', 4);
    line(NIGHT(2, 13, 6), relay, 'systemd', 1, "radio-stream.service: Failed with result 'exit-code'.", 4);
    line(NIGHT(2, 13, 20), 'apt-daily-upgrade.service', 'systemd', 1, 'apt-daily-upgrade.service: Deactivated successfully.');
    line(NIGHT(2, 13, 20), 'apt-daily-upgrade.service', 'systemd', 1, 'Finished apt-daily-upgrade.service - Daily apt upgrade and clean activities.');
    // The previous chapter's probe, every 5 minutes: it alerts from 2:15 to 2:55.
    const alerts: string[] = [];
    for (let m = 15; m <= 55; m += 5) {
      line(NIGHT(2, m), 'probe.service', 'systemd', 1, `Starting probe.service - ${probeName}...`);
      line(NIGHT(2, m, 1), 'probe.service', 'systemd', 1, `Finished probe.service - ${probeName}.`);
      alerts.push(
        `From root@radio Sun Sep 12 02:${String(m).padStart(2, '0')}:01 2027\nTo: root\nSubject: ${j.t('radio-alert-subject')}\nFrom: root <root@radio>\n\nconnect to address localhost and port 8000: Connection refused\nHTTP CRITICAL - Unable to open TCP socket\n`,
      );
      if (m === 40) line(NIGHT(2, 41, 12), 'ssh.service', 'sshd', 25102, 'Accepted publickey for theo from 203.0.113.45 port 52114 ssh2');
      if (m === 40) sudo(NIGHT(2, 44, 30), 25140, 'theo', '/usr/bin/journalctl -u radio-stream');
      if (m === 50) sudo(NIGHT(2, 52, 10), 25188, 'theo', '/usr/bin/nano /etc/radio/stream.conf');
    }
    sudo(NIGHT(2, 58, 3), 25230, 'theo', '/usr/bin/systemctl restart radio-stream');
    line(NIGHT(2, 58, 3), relay, 'systemd', 1, `Starting radio-stream.service - ${relayName}...`);
    line(NIGHT(2, 58, 4), relay, 'systemd', 1, `Started radio-stream.service - ${relayName}.`);
    line(NIGHT(3, 5, 40), 'ssh.service', 'sshd', 25102, 'Disconnected from user theo 203.0.113.45 port 52114');
    line(NOW - 60_000, 'ssh.service', 'sshd', 26011, `Accepted publickey for ${j.player} from 198.51.100.23 port 40388 ssh2`);
    s.services['radio-stream'].since = NIGHT(2, 58, 4);
    s.clock = now;
    const box = j.find('/var/mail/theo');
    if (box?.type === 'file') box.content = alerts.join('\n');
    j.state.readPostMortem = j.read(path(j.t, FILE));
  },
  // After each save of the post-mortem, Zoé rereads it.
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
        radio: place({ 'stream.conf': file(t('post-mortem-conf-stream')) }),
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
