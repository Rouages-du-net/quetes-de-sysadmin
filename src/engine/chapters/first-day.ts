// Histoire « Le Datacenter » — chapitre « Premier jour » : lire un journal
// de serveur avec head, tail, wc, grep, cut, sort, uniq et les tubes |,
// écrire avec > et >>, gérer les processus (ps, kill) et un service
// (systemctl), écrire dans un fichier de root avec sudo tee.
//
// Le journal suit le format « combined » de nginx, sans les deux derniers
// champs (page d'origine et navigateur). Toutes les adresses IP sont
// réservées à la documentation (RFC 5737).

import { path, d, f, player, type Chapter, type Accounts } from '../world';
import type { Game } from '../shell';
import { instants } from '../activity';
import type { Process } from '../commands/system';
import type { Translate } from '../../texts';
import { newSystemd } from '../systemd';

const M = '/home/you';
const ROBOT = '198.51.100.77';
const BLOCKED = '/etc/nginx/blocked.conf';

// Journal d'accès déterministe : des visiteurs, puis un robot qui aspire le
// catalogue et fait tomber le service (erreurs 503).
const VISITORS = ['192.0.2.14', '192.0.2.31', '192.0.2.58', '203.0.113.9', '203.0.113.42', '203.0.113.87', '192.0.2.120', '203.0.113.150'];
const PAGES = ['/', '/agenda', '/catalogue', '/horaires', '/catalogue/livre/1984', '/expositions', '/contact', '/catalogue/livre/beloved'];

function log(): { text: string; erreurs503: number; robotRequests: number } {
  const visitors = VISITORS;
  const pages = PAGES;
  let seed = 42;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const lines: string[] = [];
  let e503 = 0;
  let robot = 0;
  for (let i = 0; i < 360; i++) {
    const s = 20 * 3600 + i * 7;
    const timeOfDay = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const isRobot = i >= 120 && random() < 0.7;
    const ip = isRobot ? ROBOT : visitors[Math.floor(random() * visitors.length)];
    const page = isRobot ? `/catalogue/recherche?q=${String.fromCharCode(97 + (i % 26))}${i}` : pages[Math.floor(random() * pages.length)];
    const override = i >= 210 && random() < 0.75;
    const status = override ? 503 : 200;
    if (status === 503) e503++;
    if (isRobot) robot++;
    const size = status === 503 ? 197 : 1200 + Math.floor(random() * 9000);
    lines.push(`${ip} - - [13/Oct/2026:${timeOfDay} +0200] "GET ${page} HTTP/1.1" ${status} ${size}`);
  }
  return { text: lines.join('\n'), erreurs503: e503, robotRequests: robot };
}

const LOG = log();
export const NGINX_LOG = LOG.text;
export const ERRORS_503 = LOG.erreurs503;
export const ROBOT_REQUESTS = LOG.robotRequests;

// Pendant qu'on enquête, le site vit (activite.ts) : le robot continue
// d'aspirer le catalogue toutes les 2 s (503 tant que le service sature,
// 403 une fois bloqué par nginx), des visiteurs passent toutes les 7 s. Le
// journal grandit : tail -f /var/log/nginx/access.log le montre en direct.
const DIRECT_START = Date.UTC(2026, 9, 13, 18, 42, 0);
const inDirect = (j: Game): string[] => (j.state.accesEnDirect ??= []) as string[];
const accessLine = (t: number, ip: string, page: string, status: number, size: number) =>
  `${ip} - - [13/Oct/2026:${new Date(t + 2 * 3_600_000).toISOString().slice(11, 19)} +0200] "GET ${page} HTTP/1.1" ${status} ${size}`;
const override = (j: Game) => (j.state.processus as Process[]).some((p) => p.cpu > 90);
const blocked = (j: Game) => (j.state.confChargee as string).includes(`deny ${ROBOT};`);

function visits(j: Game, forEachOf: number, a: number) {
  const robot = instants(forEachOf, a, 2).map((t) => ({ t, robot: true }));
  const humans = instants(forEachOf, a, 7).map((t) => ({ t, robot: false }));
  for (const { t, robot: isRobot } of [...robot, ...humans].sort((x, y) => x.t - y.t)) {
    const n = Math.floor(t / 1000);
    if (isRobot) {
      const status = blocked(j) ? 403 : override(j) ? 503 : 200;
      inDirect(j).push(accessLine(t, ROBOT, `/catalogue/recherche?q=${String.fromCharCode(97 + (n % 26))}${n % 1000}`, status, status === 403 ? 153 : status === 503 ? 197 : 1200 + ((n * 7919) % 9000)));
    } else {
      const status = override(j) ? 503 : 200;
      inDirect(j).push(accessLine(t, VISITORS[n % VISITORS.length], PAGES[(n * 3) % PAGES.length], status, status === 503 ? 197 : 1200 + ((n * 7919) % 9000)));
    }
  }
}

// Les erreurs 503 du journal, à cet instant.
const erreurs503 = (j: Game) => (j.read('/var/log/nginx/access.log') ?? '').split('\n').filter((l) => / 503 /.test(l)).length;
// Le nombre que donne le rapport : une ligne qui commence par un nombre (la sortie de wc -l).
const reportCount = (r: string) =>
  r
    .split('\n')
    .map((l) => /^\s*(\d+)(?![\d.])/.exec(l)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number);

// Les comptes de la machine datacenter (chapitres 2 et 3), comme une Debian :
// www-data fait tourner le site, adm lit les journaux.
export const datacenterAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    nobody: { uid: 65534, group: 'nogroup', home: '/nonexistent', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    awa: { uid: 1001, group: 'awa' },
    malo: { uid: 1002, group: 'malo' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'awa'] },
    'www-data': { gid: 33, members: [] },
    nogroup: { gid: 65534, members: [] },
    you: { gid: 1000, members: [] },
    awa: { gid: 1001, members: [] },
    malo: { gid: 1002, members: [] },
    'web-team': { gid: 1003, members: ['you', 'awa', 'malo'] },
  },
});

const initialBlocked = (t: Translate) => `# ${t('first-day-blocked-comment')}
deny 203.0.113.5;
deny 192.0.2.99;`;

const catalogueStable = (): Process => ({ pid: 4243, user: 'www-data', cpu: 1.2, mem: 2.1, command: 'php-fpm: pool catalogue' });

export const datacenter: Chapter = {
  id: 'first-day',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'wc', 'grep', 'cut', 'sort', 'uniq', 'echo', 'tee', 'cp', 'mv', 'rm', 'ps', 'kill', 'systemctl', 'nano', 'sudo', 'whoami'],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'report',
  password: 'welcome-2026',
  activity: { not: 5, departure: () => DIRECT_START, advance: visits },
  // t : les textes dans la langue du jeu (français tant que le shell ne le
  // transmet pas).
  state: (t) => ({
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx' },
      { pid: 613, user: 'www-data', cpu: 4.8, mem: 0.6, command: 'nginx: worker process' },
      { pid: 4242, user: 'www-data', cpu: 99.3, mem: 38.5, command: 'php-fpm: pool catalogue' },
      { pid: 5120, user: player(t), cpu: 0, mem: 0.1, command: '-bash' },
    ] satisfies Process[],
    systemd: newSystemd('datacenter', Date.UTC(2026, 9, 13, 8, 0, 0), Date.UTC(2026, 9, 13, 21, 5, 0), {
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        process: [
          { pid: 612, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx' },
          { pid: 613, user: 'www-data', cpu: 4.8, mem: 0.6, command: 'nginx: worker process' },
        ],
      },
      // Ses processus sont gérés par l'histoire (surKill).
      catalogue: { description: t('first-day-service-catalogue'), active: true, executable: 'php-fpm' },
    }),
    // Configuration que nginx a réellement chargée (il ne relit le fichier
    // qu'au reload ou au restart).
    confChargee: initialBlocked(t),
    surSystemctl: (game: any, action: string, name: string) => {
      if (name !== 'nginx' || action === 'stop') return '';
      game.state.confChargee = game.read(BLOCKED) ?? '';
      return '';
    },
    surKill: (game: any, p: Process) => {
      if (p.command !== 'php-fpm: pool catalogue') return '';
      // systemd relance automatiquement le service (Restart=always).
      const blocked = game.state.confChargee.includes(`deny ${ROBOT};`);
      const fresh = blocked ? catalogueStable() : { ...catalogueStable(), pid: p.pid + 2, cpu: 99.1, mem: 37.9 };
      game.state.processus.push(fresh);
      return game.t(blocked ? 'first-day-restart-calm' : 'first-day-restart-robot', { pid: String(fresh.pid) });
    },
  }),
  createWorld: (t) =>
    d(
      {
        home: d(
          {
            you: d({
              'email_awa.txt': f(t('first-day-email-awa')),
              'notes_awa.txt': f(t('first-day-notes-awa')),
            }),
          },
          undefined,
          { owner: 'root' },
        ),
        var: d(
          {
            log: d(
              {
                nginx: d(
                  {
                    'access.log': f((j) => [LOG.text, ...inDirect(j)].join('\n'), { owner: 'root', lines: true }),
                  },
                  undefined,
                  { owner: 'root' },
                ),
              },
              undefined,
              { owner: 'root' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
        etc: d(
          {
            nginx: d(
              {
                'blocked.conf': f(initialBlocked(t), { owner: 'root', lines: true }),
                'blocked.conf.bak': f(initialBlocked(t), { owner: 'root', lines: true }),
              },
              undefined,
              { owner: 'root' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
      undefined,
      { owner: 'root' },
    ),
  events: [
    // Coups de pouce : une piste trop longue (tout lire, compter à la main) renvoie aux notes d'Awa.
    {
      id: 'all-read',
      condition: (j) =>
        !j.flags.has('account') &&
        j.last.commands.length === 1 &&
        ['cat', 'less', 'more'].includes(j.last.commands[0][0]) &&
        j.last.commands[0].some((a) => a.endsWith('access.log')),
      message: (j) => j.t('first-day-event-all-read'),
    },
    {
      id: 'grep-only',
      condition: (j) => {
        const cmds = j.last.commands.flat();
        return !j.flags.has('account') && cmds.includes('grep') && !cmds.includes('wc') && j.last.output.split('\n').filter((l) => / 503 /.test(l)).length >= 20;
      },
      message: (j) => j.t('first-day-event-grep-only'),
    },
    {
      id: 'addresses-only',
      condition: (j) => {
        const cmds = j.last.commands.flat();
        return !j.flags.has('robot') && cmds.includes('cut') && !cmds.includes('uniq') && j.last.output.split('\n').length >= 20;
      },
      message: (j) => j.t('first-day-event-addresses-only'),
    },
    {
      id: 'account',
      // Le journal grandit : le bon compte est celui du journal à cet instant.
      condition: (j) => {
        const cmds = j.last.commands.flat();
        return cmds.includes('grep') && j.last.output.trim().split(/\s+/)[0] === String(erreurs503(j));
      },
      message: (j) => j.t('first-day-event-account', { erreurs: String(erreurs503(j)) }),
    },
    {
      id: 'robot',
      condition: (j) => j.last.commands.flat().includes('uniq') && j.last.output.includes(ROBOT),
      message: (j) => j.t('first-day-event-robot', { robot: ROBOT, requetes: String(ROBOT_REQUESTS) }),
    },
    {
      id: 'override',
      condition: (j) => j.last.commands[0]?.[0] === 'ps' && j.last.output.includes('99.3'),
      message: (j) => j.t('first-day-event-override', { robot: ROBOT, bloques: BLOCKED }),
    },
    {
      id: 'overwritten',
      condition: (j) => !(j.read(BLOCKED) ?? '').includes('deny 203.0.113.5;'),
      message: (j) => j.t('first-day-event-overwritten', { bloques: BLOCKED }),
    },
    {
      id: 'rule',
      condition: (j) => (j.read(BLOCKED) ?? '').includes(`deny ${ROBOT};`),
      message: (j) => j.t('first-day-event-rule'),
    },
    {
      id: 'blocked',
      condition: (j) => j.state.confChargee.includes(`deny ${ROBOT};`),
      message: (j) => {
        const p = (j.state.processus as Process[]).find((q) => q.cpu > 90);
        return p
          ? j.t('first-day-event-blocked-process', { robot: ROBOT, pid: String(p.pid) })
          : j.t('first-day-event-blocked', { robot: ROBOT });
      },
    },
    {
      id: 'repaired',
      condition: (j) =>
        j.flags.has('blocked') && !(j.state.processus as Process[]).some((p) => p.cpu > 90),
      message: (j) => j.t('first-day-event-repaired', { robot: ROBOT }),
    },
    {
      id: 'report',
      // Un compte pris à un moment de l'enquête : entre le journal du début et celui de maintenant.
      condition: (j) => {
        const r = j.read(path(j.t, `${M}/rapport.txt`)) ?? '';
        return j.flags.has('repaired') && r.includes(ROBOT) && reportCount(r).some((n) => n >= ERRORS_503 && n <= erreurs503(j));
      },
      message: (j) => {
        const r = j.read(path(j.t, `${M}/rapport.txt`)) ?? '';
        const n = reportCount(r).find((x) => x >= ERRORS_503 && x <= erreurs503(j)) ?? ERRORS_503;
        return j.t('first-day-event-report', { erreurs: String(n) });
      },
    },
  ],
};
