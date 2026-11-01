// Story "On Call", chapter "Inodes": the night recording still fails
// ("No space left on device"), but df -h says the data volume is almost
// empty. Each file takes an inode, and there are none left: the relay has
// been writing one small file per listen for six months (df -i,
// du --inodes). rm * fails ("Argument list too long"); find … -mtime +30
// -delete removes the old ones while keeping the last month, and a cron
// job does it again every night.
// Objective checked on the state: after a simulated night (the cron job
// runs), no file less than 31 days old has disappeared, the oldest is at
// most 60 days old, and the volume is under 80 % of its inodes; the night
// recording could be written.
// Sources: https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html,
// https://www.gnu.org/software/findutils/manual/html_mono/find.html (-mtime, -delete),
// https://man7.org/linux/man-pages/man2/execve.2.html (E2BIG, ARG_MAX)

import { path, name, d, f, accountsFiles, type Chapter, type Accounts, type Directory, type Rights, type File } from '../world';
import type { Game, Shell } from '../shell';
import { writeLog, newSystemd, systemd } from '../systemd';
import { pass } from '../cron';
import type { Translate } from '../../texts';

const M = '/home/you';
const DATA = '/srv/radio';
const STATS = '/srv/radio/stats';
const DAY = 86_400_000;
const INODES = 65_536;
// The evening of the incident: Sunday 29 August 2027, 3:20 (local time read as UTC).
const NOW = Date.UTC(2027, 7, 29, 3, 20, 0);
// The statistics start on 1 March: one file per listen, about 360 a day.
const START = Date.UTC(2027, 2, 1, 0, 0, 0);
// Tonight's recording, in the language (/srv/radio/shows/night-show-2027-08-29.ogg in English).
const record = (j: Game) => `${path(j.t, '/srv/radio/shows')}/${name(j.t, 'night-show')}-2027-08-29.ogg`;

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

const sd = (j: Game) => systemd(j)!;
const shell = (j: Game) => j as Shell;
const volume = (j: Game) => shell(j).mount(DATA)!;
const inodesPercent = (j: Game) => Math.ceil((100 * shell(j).usedInodes(volume(j))) / INODES);
const dayFor = (ms: number) => Math.floor(ms / DAY);
const twoDigits = (n: number) => String(n).padStart(2, '0');

// A statistics file's name: the date of the listen, and a number (listen-… in English).
function statName(t: Translate, ms: number, n: number): string {
  const dt = new Date(ms);
  const date = `${dt.getUTCFullYear()}-${twoDigits(dt.getUTCMonth() + 1)}-${twoDigits(dt.getUTCDate())}`;
  const timeOfDay = `${twoDigits(dt.getUTCHours())}-${twoDigits(dt.getUTCMinutes())}-${twoDigits(dt.getUTCSeconds())}`;
  return `${name(t, 'listen')}-${date}T${timeOfDay}-${String(n).padStart(5, '0')}.json`;
}

const stat = (ms: number): File => ({
  type: 'file',
  content: '{"listener":"203.0.113.0","seconds":1260}',
  mtime: ms,
  owner: 'radio',
  lines: true,
});

// How many statistics files of each day are still there.
function byDay(j: Game): Map<number, number> {
  const place = j.find(STATS);
  const account = new Map<number, number>();
  if (place?.type !== 'directory') return account;
  for (const k in place.children) {
    const e = place.children[k];
    if (e.type === 'file' && e.mtime !== undefined) account.set(dayFor(e.mtime), (account.get(dayFor(e.mtime)) ?? 0) + 1);
  }
  return account;
}

// Are all the statistics less than 31 days old (find -mtime -31) still there?
function intactRecent(j: Game): boolean {
  const written: Record<number, number> = j.state.statsWritten;
  const presents = byDay(j);
  const limit = dayFor(sd(j).clock) - 30;
  return Object.entries(written).every(([day, n]) => Number(day) < limit || (presents.get(Number(day)) ?? 0) >= n);
}

// The age of the oldest statistics file, in whole days (like find -mtime).
const moreOld = (j: Game) => {
  const place = j.find(STATS);
  let min = Infinity;
  if (place?.type === 'directory')
    for (const k in place.children) {
      const e = place.children[k];
      if (e.type === 'file' && e.mtime !== undefined && e.mtime < min) min = e.mtime;
    }
  return min === Infinity ? 0 : Math.floor((sd(j).clock - min) / DAY);
};

/** Writes a file as the radio account: succeeds only if an inode is left. */
function writeAsRadio(j: Game, path: string, n: File): boolean {
  const game = shell(j);
  const before = game.who;
  game.who = 'radio';
  try {
    return game.place('stream', path, n) === null;
  } finally {
    game.who = before;
  }
}

// The relay records a listen; the counter of files written per day follows.
function noteListening(j: Game, ms: number): boolean {
  const n = (j.state.statNumber = (j.state.statNumber ?? 0) + 1);
  const ok = writeAsRadio(j, `${STATS}/${statName(j.t, ms, n)}`, stat(ms));
  if (ok) j.state.statsWritten[dayFor(ms)] = (j.state.statsWritten[dayFor(ms)] ?? 0) + 1;
  return ok;
}

// The crontabs that mention the statistics (to know when to let a night pass).
const cronFingerprint = (j: Game) => JSON.stringify(j.state.crontabs ?? {});
const cronStats = (j: Game) => Object.values((j.state.crontabs ?? {}) as Record<string, string>).some((t) => t.includes(STATS));

/** The next night: a day of listens, then cron. Returns the morning report. */
function night(j: Game): string {
  const s = sd(j);
  const before = byDay(j);
  const total = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  // The day: the relay records its listens, as long as inodes are left.
  const nextDay = (dayFor(s.clock) + 1) * DAY;
  const free = INODES - shell(j).usedInodes(volume(j));
  const place = j.find(STATS);
  const written = place?.type === 'directory' ? Math.max(0, Math.min(360, free)) : 0;
  for (let k = 0; k < written; k++) {
    const ms = s.clock + Math.floor((k * (nextDay + 3 * 3600_000 - s.clock)) / 360);
    const n = (j.state.statNumber = (j.state.statNumber ?? 0) + 1);
    (place as Directory).children[statName(j.t, ms, n)] = stat(ms);
    j.state.statsWritten[dayFor(ms)] = (j.state.statsWritten[dayFor(ms)] ?? 0) + 1;
  }
  // The night: cron runs the scheduled jobs until 6:00.
  const start = s.clock;
  const end = nextDay + 6 * 3600_000;
  // The jobs see the morning's time (find -mtime counts age from the clock).
  s.clock = end;
  const executions = pass(shell(j), start, end);
  const deleted = total(before) + written - total(byDay(j));
  const mails = executions
    .filter((e) => e.output)
    // A mail of thousands of lines (one error per file): only the beginning.
    .map((e) => {
      const lines = e.output.split('\n');
      const output = lines.length > 5 ? [...lines.slice(0, 5), '[…]'].join('\n') : e.output;
      return j.t('inodes-mail', { command: e.command, output: output });
    })
    .join('\n\n');
  const result = [j.t('inodes-night', { jobs: executions.length, deleted, oldest: moreOld(j), percent: inodesPercent(j) }), mails];
  if (!intactRecent(j)) result.push(j.t('inodes-night-recent-lost'));
  else if (!executions.length) result.push(j.t('inodes-night-nothing'));
  else if (moreOld(j) > 60) result.push(j.t('inodes-night-too-old', { days: moreOld(j) }));
  else if (inodesPercent(j) >= 80) result.push(j.t('inodes-night-full', { percent: inodesPercent(j) }));
  else j.state.nightSucceeded = true;
  return result.filter(Boolean).join('\n\n');
}

export const inodes: Chapter = {
  id: 'inodes',
  number: 3,
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
    'sort',
    'uniq',
    'find',
    'du',
    'df',
    'rm',
    'mkdir',
    'touch',
    'echo',
    'id',
    'whoami',
    'ps',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'crontab',
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
        process: [{ pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' }],
      },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' }],
      },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: '/usr/local/bin/stream --config /etc/radio/stream.conf' },
    ],
    mounts: [
      { path: '/', capacity: 20_000_000_000, name: '/dev/vda1', system: 'ext4', inodes: 1_310_720, inodesBase: 61_204 },
      // A small data volume: 1 GiB, so 65,536 inodes (one per 16 KiB, mkfs.ext4's default setting).
      { path: DATA, capacity: 1_073_741_824, name: '/dev/vdb1', system: 'ext4', inodes: INODES, inodesBase: 11 },
    ],
    crontabs: {},
    statsWritten: {},
  }),
  // The statistics fill all the inodes left on the volume.
  initialise: (j) => {
    const s = sd(j);
    const place = j.find(STATS) as Directory;
    const rest = INODES - shell(j).usedInodes(volume(j));
    const byPlannedDay = rest / ((NOW - START) / DAY);
    for (let k = 0; k < rest; k++) {
      const ms = START + Math.floor((k * DAY) / byPlannedDay);
      const n = (j.state.statNumber = (j.state.statNumber ?? 0) + 1);
      place.children[statName(j.t, ms, n)] = stat(ms);
      j.state.statsWritten[dayFor(ms)] = (j.state.statsWritten[dayFor(ms)] ?? 0) + 1;
    }
    // Tonight, nothing can be written on the volume any more.
    s.clock = NOW - 40 * 60_000;
    writeLog(s, 'radio-stream.service', 'stream', 1730, `stats: cannot create ${STATS}/${statName(j.t, s.clock, 99_001)}: No space left on device`, 3);
    s.clock = NOW - 20 * 60_000;
    writeLog(s, 'radio-stream.service', 'stream', 1730, `record: cannot create ${record(j)}: No space left on device`, 3);
    writeLog(
      s,
      'radio-stream.service',
      'stream',
      1730,
      `stats: cannot create ${STATS}/${statName(j.t, s.clock, 99_002)}: No space left on device`,
      3,
      false,
    );
    s.clock = NOW;
  },
  // At every moment, the relay records a listen and retries recording the show; and if the crontab changed, a night passes.
  afterCommand: (j) => {
    const s = sd(j);
    s.clock += 30_000;
    if (!noteListening(j, s.clock))
      writeLog(s, 'radio-stream.service', 'stream', 1730, `stats: cannot create ${STATS}/...: No space left on device`, 3, false);
    if (
      !j.find(record(j)) &&
      writeAsRadio(j, record(j), { type: 'file', content: '', size: 48_000_000, owner: 'radio', mtime: s.clock })
    )
      writeLog(s, 'radio-stream.service', 'stream', 1730, `record: writing ${record(j)}`, 6, false);
    if (j.state.nightSucceeded || !cronStats(j) || j.state.nightFingerprint === cronFingerprint(j)) return;
    j.state.nightFingerprint = cronFingerprint(j);
    return night(j);
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const radio: Rights = { owner: 'radio' };
    return place({
      etc: place({ ...accountsFiles(), hostname: file('radio'), radio: place({ 'stream.conf': file(t('inodes-conf-stream')) }) }),
      home: place({ you: d({ 'message_from_zoe.txt': f(t('inodes-message-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
      srv: place({
        radio: place(
          {
            'lost+found': place({}, { owner: 'root', mode: 'rwx------' }),
            shows: place(
              {
                [`${name(t, 'morning-show')}-2027-08-27.ogg`]: f('', { owner: 'radio', size: 92_000_000 }),
                [`${name(t, 'morning-show')}-2027-08-28.ogg`]: f('', { owner: 'radio', size: 91_000_000 }),
                [`${name(t, 'night-show')}-2027-08-28.ogg`]: f('', { owner: 'radio', size: 48_000_000 }),
              },
              radio,
            ),
            stats: place({ 'README.txt': file(t('inodes-stats-readme'), radio) }, radio),
          },
          radio,
        ),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: place({
        lib: f('', { owner: 'root', size: 3_200_000_000 }),
        local: place({ bin: place({ stream: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 8_400_000 }) }) }),
      }),
      var: place({ lib: place({ radio: place({}, radio) }) }),
    });
  },
  events: [
    {
      id: 'almost-empty',
      condition: (j) =>
        j.last.commands.some((c) => c.includes('df')) &&
        !j.last.commands.some((c) => c.some((a) => /^-\w*i/.test(a))) &&
        /\/srv\/radio/.test(j.last.output),
      message: (j) => j.t('inodes-event-almost-empty'),
    },
    { id: 'more-inodes', condition: (j) => /100% \/srv\/radio/.test(j.last.output), message: (j) => j.t('inodes-event-more-inodes') },
    {
      id: 'culprit',
      condition: (j) =>
        /\b6\d{4}\b/.test(j.last.output) && /stats|^6\d{4}$/m.test(j.last.output) && !/100% \/srv\/radio/.test(j.last.output),
      message: (j) => j.t('inodes-event-culprit'),
    },
    { id: 'too-long', condition: (j) => (j.state.argumentsTooLong ?? 0) > 0, message: (j) => j.t('inodes-event-too-long') },
    { id: 'recent-lost', condition: (j) => !intactRecent(j), message: (j) => j.t('inodes-event-recent-lost') },
    { id: 'restarts', condition: (j) => !!j.find(record(j)), message: (j) => j.t('inodes-event-restarts', { percent: inodesPercent(j) }) },
    {
      id: 'end',
      condition: (j) => !!j.state.nightSucceeded && intactRecent(j) && inodesPercent(j) < 80,
      message: (j) => j.t('inodes-event-end'),
    },
  ],
};
