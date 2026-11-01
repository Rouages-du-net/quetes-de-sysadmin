// Histoire « L'Astreinte » — chapitre « La mémoire » : à 4 h 12, le direct
// de Radio Quartier passe du silence. La playlist automatique de la nuit
// (radio-playlist, un programme Node) a été tuée par l'OOM killer du noyau :
// elle garde en mémoire tout ce qu'elle lit, sans jamais rien oublier (une
// fuite). La relancer ne suffit pas : elle regrossit, et le noyau finit par
// tuer le plus gros processus. On la contient avec une limite systemd
// (MemoryMax=), qu'on fait relancer en cas d'échec (Restart=on-failure),
// le temps que les développeur·ses corrigent la fuite. Au passage, des
// processus zombies que kill ne tue pas : seul leur parent peut les
// récupérer (le redémarrer).
// Objectif vérifié sur l'état : la playlist tourne, avec une limite de
// mémoire raisonnable et une relance automatique, et plus aucun zombie.
// Sources : https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=,
// https://man7.org/linux/man-pages/man1/free.1.html, https://man7.org/linux/man-pages/man2/wait.2.html

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { writeLog, newSystemd, systemd, type Service } from '../systemd';
import { memory, kernel, process, checkMemory } from '../memory';
import type { Process } from '../commands/system';

const M = '/home/vous';
const Mo = 1024 * 1024;
// La playlist démarre avec 200 Mio et en prend 60 de plus à chaque instant.
const DEPARTURE = 200 * Mo;
const LEAK = 60 * Mo;
const PODCAST = 2305;
const ZOMBIES = [2411, 2427, 2448, 2463];

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    radio: { uid: 996, group: 'radio', home: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, group: 'vous' },
    zoe: { uid: 1001, group: 'zoe' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['vous', 'zoe'] },
    sudo: { gid: 27, members: ['vous', 'zoe'] },
    radio: { gid: 996, members: [] },
    vous: { gid: 1000, members: [] },
    zoe: { gid: 1001, members: [] },
  },
});

const sd = (j: Game) => systemd(j)!;
const playlist = (j: Game): Service => sd(j).services['radio-playlist'];
const active = (j: Game) => playlist(j).state === 'active';
const zombies = (j: Game) => process(j).filter((p) => p.zombie);
const killed = (j: Game): { service: string; cgroup: boolean; restart: boolean }[] =>
  (j.state.oomTues ?? []).filter((t: { service: string }) => t.service === 'radio-playlist');

// Une limite qui protège la machine sans empêcher la playlist de démarrer.
const reasonableLimit = (j: Game) => {
  const max = playlist(j).maxMemory;
  return max !== undefined && max >= 256 * Mo && max <= 1024 * Mo;
};
const restart = (j: Game) => ['on-failure', 'always', 'on-abnormal'].includes(playlist(j).reboot ?? '');

// Chaque démarrage : un nouveau processus, qui repart de 200 Mio.
function launchPlaylist(j: Game) {
  const pid = (j.state.prochainPid = (j.state.prochainPid ?? 2600) + 1);
  const s = playlist(j);
  s.process = [{ pid, user: 'radio', cpu: 2.0, mem: 0, command: '/usr/bin/node /opt/playlist/server.js' }];
  memory(j)!.rss[pid] = DEPARTURE;
  j.state.memoireDemandeur = pid;
}

function launchPodcast(j: Game) {
  const s = sd(j).services['radio-podcast'];
  // Au premier démarrage, le parent des zombies ; ensuite, un nouveau processus.
  const pid = j.state.podcastLance ? (j.state.prochainPid = (j.state.prochainPid ?? 2600) + 1) : PODCAST;
  j.state.podcastLance = true;
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
  id: 'memoire',
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
  welcome: 'message_de_zoe.txt',
  names: true,
  final: 'fin',
  password: 'antenne-2027',
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
    processus: [
      proc(1, 'root', '/sbin/init'),
      proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'),
      proc(611, 'root', '/usr/sbin/cron -f'),
      proc(1730, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', { cpu: 3.2 }),
      ...ZOMBIES.map((pid) => proc(pid, 'radio', '[convertir] <defunct>', { ppid: PODCAST, zombie: true })),
    ],
    memoire: { total: 2048 * Mo, kernel: 380 * Mo, rss: { 1: 12 * Mo, 598: 8 * Mo, 611: 4 * Mo, 1730: 420 * Mo } },
  }),
  // La nuit jusqu'ici : la playlist grossit depuis son démarrage, et à 4 h 12, plus de mémoire.
  initialise: (j) => {
    const s = sd(j);
    const start = s.log[0].time;
    // Quelques lignes du démarrage, pour dmesg.
    const clock = s.clock;
    [
      'Linux version 6.12.0-quetes (radio)',
      'Memory: 2097152K/2097152K available',
      'EXT4-fs (vda1): mounted filesystem with ordered data mode.',
    ].forEach((text, i) => (j.state.noyau ??= []).push({ time: start + i * 211, text }));
    launchPlaylist(j);
    launchPodcast(j);
    for (const name of ['radio-playlist', 'radio-podcast']) {
      const svc = s.services[name];
      j.state.processus.push({ ...svc.process[0] });
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
    j.state.oomTues = [];
  },
  // La playlist (si elle tourne) prend de la mémoire à chaque instant ; le noyau et systemd veillent.
  afterCommand: (j) => {
    // Chaque commande, une demi-minute de la nuit.
    sd(j).clock += 30_000;
    if (active(j)) {
      const pid = playlist(j).process[0].pid;
      const m = memory(j)!;
      m.rss[pid] = (m.rss[pid] ?? DEPARTURE) + LEAK;
      j.state.memoireDemandeur = pid;
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
      home: place({ vous: d({ 'message_de_zoe.txt': f(t('memoire-message-de-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
      opt: place({
        playlist: place({ 'server.js': file(t('memoire-server-js')) }),
        podcast: place({ 'convertir.py': file(t('memoire-convertir-py')) }),
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
    { id: 'oom', condition: (j) => /Out of memory|oom-kill|OOM killer/.test(j.last.output), message: (j) => j.t('memoire-evenement-oom') },
    {
      id: 'zombies',
      condition: (j) => /<defunct>| Z /.test(j.last.output) && j.last.commands.some((c) => c.includes('ps') || c.includes('top')),
      message: (j) => j.t('memoire-evenement-zombies'),
    },
    {
      id: 'kill-zombie',
      condition: (j) => j.last.commands.some((c) => c.includes('kill') && c.some((a) => ZOMBIES.includes(Number(a)))) && zombies(j).length > 0,
      message: (j) => j.t('memoire-evenement-kill-zombie'),
    },
    {
      id: 'grossit',
      condition: (j) =>
        active(j) &&
        !playlist(j).maxMemory &&
        (memory(j)!.rss[playlist(j).process[0].pid] ?? 0) >= DEPARTURE + 4 * LEAK &&
        j.last.commands.some(
          (c) => ['free', 'top', 'ps', 'systemctl'].includes(c[0]) || (c[0] === 'sudo' && ['free', 'top', 'ps', 'systemctl'].includes(c[1])),
        ),
      message: (j) => j.t('memoire-evenement-grossit'),
    },
    { id: 'encore', condition: (j) => killed(j).some((t) => !t.cgroup), message: (j) => j.t('memoire-evenement-encore') },
    { id: 'trop-bas', condition: (j) => (playlist(j).maxMemory ?? Infinity) < 256 * Mo, message: (j) => j.t('memoire-evenement-trop-bas') },
    { id: 'trop-haut', condition: (j) => (playlist(j).maxMemory ?? 0) > 1024 * Mo, message: (j) => j.t('memoire-evenement-trop-haut') },
    { id: 'sans-relance', condition: (j) => killed(j).some((t) => t.cgroup) && !active(j), message: (j) => j.t('memoire-evenement-sans-relance') },
    { id: 'contenue', condition: (j) => killed(j).some((t) => t.cgroup && t.restart) && active(j), message: (j) => j.t('memoire-evenement-contenue') },
    { id: 'sans-zombies', condition: (j) => zombies(j).length === 0, message: (j) => j.t('memoire-evenement-sans-zombies') },
    {
      id: 'fin',
      condition: (j) => active(j) && reasonableLimit(j) && restart(j) && zombies(j).length === 0 && sd(j).services['radio-stream'].state === 'active',
      message: (j) => j.t('memoire-evenement-fin'),
    },
  ],
};
