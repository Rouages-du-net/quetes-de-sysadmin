// Histoire « L'Astreinte » — chapitre « Le disque plein » : une nuit
// d'astreinte pour Radio Quartier. Le disque du serveur est plein : le relais
// du flux (radio-stream) écrit son journal en mode debug depuis trois jours
// (16 Go). Effacer le fichier ne rend rien : le programme le tient ouvert
// (df plein, du ne le voit plus, lsof +L1 le montre). On vide le fichier
// (truncate) ou on redémarre, on remet le niveau de journal normal, et on
// confie le journal à logrotate pour que ça ne recommence pas.
// Objectif vérifié sur l'état : le disque est sous 80 %, aucun fichier
// effacé n'est encore tenu ouvert, le relais tourne sans debug, et une
// configuration logrotate valable couvre son journal (et sait le faire
// rouvrir : copytruncate, ou un postrotate qui recharge le relais).
// Sources : https://man7.org/linux/man-pages/man8/logrotate.8.html,
// https://man7.org/linux/man-pages/man8/lsof.8.html,
// https://www.gnu.org/software/coreutils/manual/html_node/truncate-invocation.html

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { erases, openSet, open, ghostPlace, held } from '../open-files';

const M = '/home/you';
const CONF = '/etc/radio/stream.conf';
const LOG = '/var/log/radio/stream.log';
const ROTATION = '/etc/logrotate.d/radio';
const Go = 1_000_000_000;
const DISK = 20 * Go;

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

// Le niveau de journal du relais, lu dans sa configuration (au démarrage).
const configLevel = (j: Game) => /^\s*loglevel\s*=\s*(\w+)/m.exec(j.read(CONF) ?? '')?.[1] ?? 'info';

const sd = (j: Game) => systemd(j)!;
const shell = (j: Game) => j as Shell;
const occupation = (j: Game) => Math.min(1, (shell(j).size(j.find('/')!) + ghostPlace(j, '/')) / DISK);
const ghost = (j: Game) => openSet(j).some((o) => held(j, o) && erases(j, o));
const enabled = (j: Game) => sd(j).services['radio-stream']?.state === 'active';

// La configuration logrotate du relais est-elle bonne ?
function validRotation(j: Game): boolean {
  const text = j.read(ROTATION);
  if (!text) return false;
  const game = shell(j);
  const before = game.who;
  game.who = 'root';
  // logrotate -d ne touche à rien : s'il ne dit aucune erreur, la configuration se lit.
  const r = game.underCommand(`logrotate -d ${ROTATION}`, '/');
  game.who = before;
  const block = /([^\n{]*)\{([^}]*)\}/.exec(text);
  if (!r.ok || !block) return false;
  const patterns = block[1].trim().split(/\s+/);
  const covers = patterns.some((m) => m === LOG || (m.startsWith('/var/log/radio/') && /\*/.test(m)));
  const inside = block[2];
  const kept = /^\s*rotate\s+\d+/m.test(inside) && /^\s*(daily|weekly|monthly|size\s+\S+|maxsize\s+\S+)\s*$/m.test(inside);
  const reopens =
    /^\s*copytruncate\s*$/m.test(inside) || /postrotate[\s\S]*systemctl\s+(reload|restart|kill)[\s\S]*radio-stream[\s\S]*endscript/.test(inside);
  return covers && kept && reopens;
}

export const fullDisk: Chapter = {
  id: 'full-disk',
  number: 1,
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
    'du',
    'df',
    'cp',
    'mv',
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
    'lsof',
    'truncate',
    'logrotate',
  ],
  home: M,
  welcome: 'message_from_zoe.txt',
  names: true,
  final: 'end',
  password: 'antenna-2027',
  accounts,
  state: () => ({
    systemd: newSystemd('radio', Date.UTC(2027, 7, 1, 6, 0, 0), Date.UTC(2027, 7, 15, 2, 47, 0), {
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
        process: [{ pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: `/usr/local/bin/stream --config ${CONF}` }],
        // Au démarrage (et au rechargement), le relais relit sa configuration et rouvre son journal.
        load: (j) => {
          j.state.fluxLevel = configLevel(j);
          open(j, { service: 'radio-stream', pid: 1730, user: 'radio', command: 'flux', fd: 3, path: LOG }, 'radio', 'adm');
        },
      },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 1730, user: 'radio', cpu: 3.2, mem: 1.1, command: `/usr/local/bin/stream --config ${CONF}` },
    ],
    mounts: [{ path: '/', capacity: DISK, name: '/dev/vda1', system: 'ext4' }],
  }),
  initialise: (j) => sd(j).services['radio-stream'].load!(j),
  // Le relais écrit : en debug, le journal enfle à chaque instant.
  afterCommand: (j) => {
    if (!enabled(j)) return;
    const o = openSet(j).find((x) => x.service === 'radio-stream');
    if (!o) return;
    const freeMem = DISK - occupation(j) * DISK;
    const addition = Math.min(Math.max(0, freeMem), j.state.fluxLevel === 'debug' ? 400_000_000 : 40_000);
    o.node.size = (o.node.size ?? 0) + addition;
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const log = (text: string, size: number, owner = 'root') =>
      f(text, { lines: true, owner, group: 'adm', mode: 'rw-r-----', size });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('radio'),
        radio: place({ 'stream.conf': file(t('full-disk-conf-flux')) }),
        'logrotate.conf': file(t('full-disk-logrotate-conf')),
        'logrotate.d': place({ rsyslog: file(t('full-disk-logrotate-rsyslog')), apt: file(t('full-disk-logrotate-apt')) }),
      }),
      home: place({ you: d({ 'message_from_zoe.txt': f(t('full-disk-message-zoe')) }), zoe: place({}, { owner: 'zoe', mode: 'rwx------' }) }),
      srv: place({
        radio: place({
          shows: place(
            { 'matinale-2027-08-14.ogg': f(t('archives-its-ogg'), { lines: true, owner: 'radio', size: 92_000_000 }) },
            { owner: 'radio' },
          ),
        }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: place({
        lib: f('', { owner: 'root', size: 3_200_000_000 }),
        local: place({ bin: place({ stream: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 8_400_000 }) }) }),
      }),
      var: place({
        lib: place({ radio: place({}, { owner: 'radio' }), logrotate: place({ status: file('logrotate state -- version 2') }) }),
        log: place({
          syslog: log(t('full-disk-syslog'), 41_000_000),
          'syslog.1': log('', 38_000_000),
          'syslog.2.gz': log('', 4_100_000),
          'auth.log': log('', 2_300_000),
          radio: place(
            { 'stream.log': log(t('full-disk-flux-log'), 16_640_000_000, 'radio') },
            { owner: 'radio', group: 'adm', mode: 'rwxr-x---' },
          ),
        }),
      }),
    });
  },
  events: [
    {
      id: 'full',
      condition: (j) => j.last.commands.some((c) => c[0] === 'df') && occupation(j) > 0.97,
      message: (j) => j.t('full-disk-event-full'),
    },
    {
      id: 'culprit',
      condition: (j) =>
        j.last.commands.some((c) => ['du', 'ls', 'find'].includes(c[0])) &&
        /\b1[5-9]G\b|flux\.log/.test(j.last.output) &&
        /radio/.test(j.last.line),
      message: (j) => j.t('full-disk-event-culprit'),
    },
    { id: 'debug', condition: (j) => j.last.output.includes('DEBUG'), message: (j) => j.t('full-disk-event-debug') },
    {
      id: 'ghost',
      condition: (j) => ghost(j) && j.last.commands.some((c) => c[0] === 'df' || c[0] === 'du'),
      message: (j) => j.t('full-disk-event-ghost'),
    },
    {
      id: 'renamed',
      condition: (j) => openSet(j).some((o) => held(j, o) && o.service === 'radio-stream' && o.path !== LOG),
      message: (j) => j.t('full-disk-event-renamed'),
    },
    {
      id: 'breathes',
      condition: (j) => occupation(j) < 0.8 && !ghost(j),
      message: (j) => j.t('full-disk-event-breathes', { percent: Math.round(occupation(j) * 100) }),
    },
    {
      id: 'end',
      condition: (j) => occupation(j) < 0.8 && !ghost(j) && enabled(j) && j.state.fluxLevel !== 'debug' && validRotation(j),
      message: (j) => j.t('full-disk-event-end'),
    },
  ],
};
