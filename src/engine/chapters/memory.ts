// Story "L'Astreinte" — chapter "Memory": at 4:12 am, Radio
// Quartier's live stream goes silent. The automatic night playlist
// (radio-playlist, a Node program) was killed by the kernel's OOM killer:
// it keeps in memory everything it reads, never forgetting anything (a
// leak). Restarting it isn't enough: it grows again, and the kernel ends up
// killing the biggest process. We contain it with a systemd limit
// (MemoryMax=), and have it restarted on failure (Restart=on-failure),
// while the developers fix the leak. Along the way, zombie
// processes that kill doesn't kill: only their parent can
// reap them (restart it).
// Objective checked on the state: the playlist runs, with a reasonable memory
// limit and automatic restart, and no zombie left.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=,
// https://man7.org/linux/man-pages/man1/free.1.html, https://man7.org/linux/man-pages/man2/wait.2.html

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { writeLog, newSystemd, systemd, type Service } from '../systemd';
import { memory, kernel, process, checkMemory } from '../memory';
import type { Process } from '../commands/system';

const M = '/home/you';
const Mo = 1024 * 1024;
// The playlist starts with 200 MiB and takes 60 more at each moment.
const DEPARTURE = 200 * Mo;
const LEAK = 60 * Mo;
const PODCAST = 2305;
const ZOMBIES = [2411, 2427, 2448, 2463];

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
const playlist = (j: Game): Service => sd(j).services['radio-playlist'];
const active = (j: Game) => playlist(j).state === 'active';
const zombies = (j: Game) => process(j).filter((p) => p.zombie);
const killed = (j: Game): { service: string; cgroup: boolean; restart: boolean }[] =>
  (j.state.oomKilled ?? []).filter((t: { service: string }) => t.service === 'radio-playlist');

// A limit that protects the machine without preventing the playlist from starting.
const reasonableLimit = (j: Game) => {
  const max = playlist(j).maxMemory;
  return max !== undefined && max >= 256 * Mo && max <= 1024 * Mo;
};
const restart = (j: Game) => ['on-failure', 'always', 'on-abnormal'].includes(playlist(j).reboot ?? '');

// Each start: a new process, which starts again from 200 MiB.
function launchPlaylist(j: Game) {
  const pid = (j.state.nextPid = (j.state.nextPid ?? 2600) + 1);
  const s = playlist(j);
  s.process = [{ pid, user: 'radio', cpu: 2.0, mem: 0, command: '/usr/bin/node /opt/playlist/server.js' }];
  memory(j)!.rss[pid] = DEPARTURE;
  j.state.memoryRequester = pid;
}

function launchPodcast(j: Game) {
  const s = sd(j).services['radio-podcast'];
  // On the first start, the zombies' parent; afterwards, a new process.
  const pid = j.state.podcastStarted ? (j.state.nextPid = (j.state.nextPid ?? 2600) + 1) : PODCAST;
  j.state.podcastStarted = true;
  s.process = [{ pid, user: 'radio', cpu: 0.3, mem: 0, command: '/usr/bin/python3 /opt/podcast/convertir.py' }];
  memory(j)!.rss[pid] = 160 * Mo;
}

const proc = (pid: number, user: string, command: string, extra: Partial<Process> = {}): Process => ({
  pid,
  user,
  cpu: 0,
  mem: 0,
  command,
  ...extra,
});

export const chapterMemory: Chapter = {
  id: 'memory',
  number: 2,
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
    'mkdir',
    'touch',
    'cp',
    'ps',
    'kill',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'free',
    'top',
    'dmesg',
  ],
  home: M,
  welcome: 'message_from_zoe.txt',
  names: true,
  final: 'end',
  password: 'antenna-2027',
  accounts,
  state: () => ({
    systemd: newSystemd('radio', Date.UTC(2027, 7, 1, 6, 0, 0), Date.UTC(2027, 7, 22, 4, 12, 0), {
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
        process: [proc(1730, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', { cpu: 3.2 })],
      },
      'radio-playlist': { description: 'Radio Quartier night playlist', active: true, executable: 'node', load: launchPlaylist },
      'radio-podcast': { description: 'Radio Quartier podcast converter', active: true, executable: 'python3', load: launchPodcast },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        process: [proc(611, 'root', '/usr/sbin/cron -f')],
      },
    }),
    process: [
      proc(1, 'root', '/sbin/init'),
      proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'),
      proc(611, 'root', '/usr/sbin/cron -f'),
      proc(1730, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', { cpu: 3.2 }),
      ...ZOMBIES.map((pid) => proc(pid, 'radio', '[convertir] <defunct>', { ppid: PODCAST, zombie: true })),
    ],
    memory: { total: 2048 * Mo, kernel: 380 * Mo, rss: { 1: 12 * Mo, 598: 8 * Mo, 611: 4 * Mo, 1730: 420 * Mo } },
  }),
  // The night so far: the playlist has grown since it started, and at 4:12 am, no memory left.
  initialise: (j) => {
    const s = sd(j);
    const start = s.log[0].time;
    // A few lines from boot, for dmesg.
    const clock = s.clock;
    [
      'Linux version 6.12.0-quetes (radio)',
      'Memory: 2097152K/2097152K available',
      'EXT4-fs (vda1): mounted filesystem with ordered data mode.',
    ].forEach((text, i) => (j.state.kernel ??= []).push({ time: start + i * 211, text }));
    launchPlaylist(j);
    launchPodcast(j);
    for (const name of ['radio-playlist', 'radio-podcast']) {
      const svc = s.services[name];
      j.state.process.push({ ...svc.process[0] });
    }
    const pid = playlist(j).process[0].pid;
    s.clock = start + 60_000;
    writeLog(s, 'radio-playlist.service', 'node', pid, 'playlist: 2214 tracks loaded, cache enabled (no size limit)');
    s.clock = clock - 14 * 60_000;
    writeLog(s, 'radio-playlist.service', 'node', pid, 'playlist: cache holds 41208 decoded chunks (1.4 GB)', 4);
    s.clock = Date.UTC(2027, 7, 22, 4, 12, 30);
    memory(j)!.rss[pid] = 1700 * Mo;
    checkMemory(j);
    writeLog(s, 'radio-stream.service', 'stream', 1730, 'relay: source disconnected (playlist), streaming silence', 4);
    s.clock = Date.UTC(2027, 7, 22, 4, 31, 0);
    j.state.oomKilled = [];
  },
  // The playlist (if it runs) takes memory at each moment; the kernel and systemd keep watch.
  afterCommand: (j) => {
    // Each command, half a minute of the night.
    sd(j).clock += 30_000;
    if (active(j)) {
      const pid = playlist(j).process[0].pid;
      const m = memory(j)!;
      m.rss[pid] = (m.rss[pid] ?? DEPARTURE) + LEAK;
      j.state.memoryRequester = pid;
    }
    checkMemory(j);
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const unit = (description: string, command: string) =>
      file(
        `[Unit]\nDescription=${description}\nAfter=network.target\n\n[Service]\nUser=radio\nExecStart=${command}\n\n[Install]\nWantedBy=multi-user.target`,
      );
    return place({
      etc: place({ ...accountsFiles(), hostname: file('radio'), systemd: place({ system: place({}) }) }),
      home: place({ you: d({ 'message_from_zoe.txt': f(t('memory-message-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
      opt: place({
        playlist: place({ 'server.js': file(t('memory-server-js')) }),
        podcast: place({ 'convertir.py': file(t('memory-convert-py')) }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: place({
        lib: place({
          systemd: place({
            system: place({
              'radio-playlist.service': unit('Radio Quartier night playlist', '/usr/bin/node /opt/playlist/server.js'),
              'radio-podcast.service': unit('Radio Quartier podcast converter', '/usr/bin/python3 /opt/podcast/convertir.py'),
              'radio-stream.service': unit('Radio Quartier stream relay', '/usr/local/bin/stream --config /etc/radio/stream.conf'),
            }),
          }),
        }),
      }),
      var: place({ lib: place({ radio: place({}, { owner: 'radio' }) }) }),
    });
  },
  events: [
    { id: 'oom', condition: (j) => /Out of memory|oom-kill|OOM killer/.test(j.last.output), message: (j) => j.t('memory-event-oom') },
    {
      id: 'zombies',
      condition: (j) => /<defunct>| Z /.test(j.last.output) && j.last.commands.some((c) => c.includes('ps') || c.includes('top')),
      message: (j) => j.t('memory-event-zombies'),
    },
    {
      id: 'kill-zombie',
      condition: (j) => j.last.commands.some((c) => c.includes('kill') && c.some((a) => ZOMBIES.includes(Number(a)))) && zombies(j).length > 0,
      message: (j) => j.t('memory-event-kill-zombie'),
    },
    {
      id: 'grows',
      condition: (j) =>
        active(j) &&
        !playlist(j).maxMemory &&
        (memory(j)!.rss[playlist(j).process[0].pid] ?? 0) >= DEPARTURE + 4 * LEAK &&
        j.last.commands.some(
          (c) => ['free', 'top', 'ps', 'systemctl'].includes(c[0]) || (c[0] === 'sudo' && ['free', 'top', 'ps', 'systemctl'].includes(c[1])),
        ),
      message: (j) => j.t('memory-event-grows'),
    },
    { id: 'still', condition: (j) => killed(j).some((t) => !t.cgroup), message: (j) => j.t('memory-event-still') },
    { id: 'too-down', condition: (j) => (playlist(j).maxMemory ?? Infinity) < 256 * Mo, message: (j) => j.t('memory-event-too-down') },
    { id: 'too-up', condition: (j) => (playlist(j).maxMemory ?? 0) > 1024 * Mo, message: (j) => j.t('memory-event-too-up') },
    { id: 'without-restart', condition: (j) => killed(j).some((t) => t.cgroup) && !active(j), message: (j) => j.t('memory-event-without-restart') },
    { id: 'contained', condition: (j) => killed(j).some((t) => t.cgroup && t.restart) && active(j), message: (j) => j.t('memory-event-contained') },
    { id: 'without-zombies', condition: (j) => zombies(j).length === 0, message: (j) => j.t('memory-event-without-zombies') },
    {
      id: 'end',
      condition: (j) => active(j) && reasonableLimit(j) && restart(j) && zombies(j).length === 0 && sd(j).services['radio-stream'].state === 'active',
      message: (j) => j.t('memory-event-end'),
    },
  ],
};
