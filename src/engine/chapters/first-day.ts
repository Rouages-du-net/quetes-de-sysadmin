// Story "The Data Centre" — chapter "First day": reading a server log with
// head, tail, wc, grep, cut, sort, uniq and | pipes, writing with > and >>,
// managing processes (ps, kill) and a service (systemctl), writing to a
// root-owned file with sudo tee.
//
// The log follows nginx's "combined" format, without the last two fields
// (referrer and user agent). All IP addresses are reserved for
// documentation (RFC 5737).

import { path, name, d, f, player, type Chapter, type Accounts } from '../world';
import type { Game } from '../shell';
import { instants } from '../activity';
import type { Process } from '../commands/system';
import type { Translate } from '../../texts';
import { newSystemd } from '../systemd';

const M = '/home/you';
const ROBOT = '198.51.100.77';
const BLOCKED = '/etc/nginx/blocked.conf';

// Deterministic access log: visitors, then a bot that scrapes the catalogue
// and brings the service down (503 errors).
const VISITORS = ['192.0.2.14', '192.0.2.31', '192.0.2.58', '203.0.113.9', '203.0.113.42', '203.0.113.87', '192.0.2.120', '203.0.113.150'];
// The pages are written with their English names; route() gives them in the
// game's language (names.ftl: /catalogue/search → /catalogue/recherche).
const PAGES = ['/', '/events', '/catalogue', '/opening-hours', '/catalogue/book/1984', '/exhibitions', '/contact', '/catalogue/book/beloved'];
const SEARCH = '/catalogue/search?q=';

/** A page of the site (with its query string) in the game's language. */
export const route = (t: Translate, page: string) => {
  const [where, query] = page.split('?');
  const translated = where
    .split('/')
    .map((m) => (m ? name(t, m) : m))
    .join('/');
  return query === undefined ? translated : `${translated}?${query}`;
};
// The requests of an access log, in the game's language.
const translateRequests = (t: Translate, text: string) => text.replace(/"GET (\S+) HTTP/g, (_, page: string) => `"GET ${route(t, page)} HTTP`);

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
    const page = isRobot ? `${SEARCH}${String.fromCharCode(97 + (i % 26))}${i}` : pages[Math.floor(random() * pages.length)];
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
/** The access log of the evening of 13 October, in the game's language. */
export const nginxLog = (t: Translate) => translateRequests(t, LOG.text);
export const ERRORS_503 = LOG.erreurs503;
export const ROBOT_REQUESTS = LOG.robotRequests;

// While you investigate, the site lives on (activity.ts): the bot keeps
// scraping the catalogue every 2 s (503 while the service is saturated, 403
// once blocked by nginx), visitors come by every 7 s. The log grows:
// tail -f /var/log/nginx/access.log shows it live.
const DIRECT_START = Date.UTC(2026, 9, 13, 18, 42, 0);
const inDirect = (j: Game): string[] => (j.state.liveAccess ??= []) as string[];
const accessLine = (j: Game, t: number, ip: string, page: string, status: number, size: number) =>
  `${ip} - - [13/Oct/2026:${new Date(t + 2 * 3_600_000).toISOString().slice(11, 19)} +0200] "GET ${route(j.t, page)} HTTP/1.1" ${status} ${size}`;
const override = (j: Game) => (j.state.process as Process[]).some((p) => p.cpu > 90);
const blocked = (j: Game) => (j.state.loadedConf as string).includes(`deny ${ROBOT};`);

function visits(j: Game, forEachOf: number, a: number) {
  const robot = instants(forEachOf, a, 2).map((t) => ({ t, robot: true }));
  const humans = instants(forEachOf, a, 7).map((t) => ({ t, robot: false }));
  for (const { t, robot: isRobot } of [...robot, ...humans].sort((x, y) => x.t - y.t)) {
    const n = Math.floor(t / 1000);
    if (isRobot) {
      const status = blocked(j) ? 403 : override(j) ? 503 : 200;
      inDirect(j).push(accessLine(j, t, ROBOT, `${SEARCH}${String.fromCharCode(97 + (n % 26))}${n % 1000}`, status, status === 403 ? 153 : status === 503 ? 197 : 1200 + ((n * 7919) % 9000)));
    } else {
      const status = override(j) ? 503 : 200;
      inDirect(j).push(accessLine(j, t, VISITORS[n % VISITORS.length], PAGES[(n * 3) % PAGES.length], status, status === 503 ? 197 : 1200 + ((n * 7919) % 9000)));
    }
  }
}

// The log's 503 errors, at this moment.
const erreurs503 = (j: Game) => (j.read('/var/log/nginx/access.log') ?? '').split('\n').filter((l) => / 503 /.test(l)).length;
// The number the report gives: a line that starts with a number (the output of wc -l).
const reportCount = (r: string) =>
  r
    .split('\n')
    .map((l) => /^\s*(\d+)(?![\d.])/.exec(l)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number);

// The accounts of the datacenter machine (chapters 2 and 3), like a Debian:
// www-data runs the site, adm reads the logs.
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
  // t: the texts in the game's language (French as long as the shell does
  // not pass it on).
  state: (t) => ({
    process: [
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
      // Its processes are managed by the story (onKill).
      catalogue: { description: t('first-day-service-catalogue'), active: true, executable: 'php-fpm' },
    }),
    // The configuration nginx actually loaded (it only rereads the file on
    // reload or restart).
    loadedConf: initialBlocked(t),
    onSystemctl: (game: any, action: string, name: string) => {
      if (name !== 'nginx' || action === 'stop') return '';
      game.state.loadedConf = game.read(BLOCKED) ?? '';
      return '';
    },
    onKill: (game: any, p: Process) => {
      if (p.command !== 'php-fpm: pool catalogue') return '';
      // systemd restarts the service automatically (Restart=always).
      const blocked = game.state.loadedConf.includes(`deny ${ROBOT};`);
      const fresh = blocked ? catalogueStable() : { ...catalogueStable(), pid: p.pid + 2, cpu: 99.1, mem: 37.9 };
      game.state.process.push(fresh);
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
                    'access.log': f((j) => [nginxLog(j.t), ...inDirect(j)].join('\n'), { owner: 'root', lines: true }),
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
    // Hints: a lead that is too long (reading everything, counting by hand) points back to Awa's notes.
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
      // The log grows: the right count is that of the log at this moment.
      condition: (j) => {
        const cmds = j.last.commands.flat();
        return cmds.includes('grep') && j.last.output.trim().split(/\s+/)[0] === String(erreurs503(j));
      },
      message: (j) => j.t('first-day-event-account', { errors: String(erreurs503(j)) }),
    },
    {
      id: 'robot',
      condition: (j) => j.last.commands.flat().includes('uniq') && j.last.output.includes(ROBOT),
      message: (j) => j.t('first-day-event-robot', { robot: ROBOT, requests: String(ROBOT_REQUESTS) }),
    },
    {
      id: 'override',
      condition: (j) => j.last.commands[0]?.[0] === 'ps' && j.last.output.includes('99.3'),
      message: (j) => j.t('first-day-event-override', { robot: ROBOT, blocked: BLOCKED }),
    },
    {
      id: 'overwritten',
      condition: (j) => !(j.read(BLOCKED) ?? '').includes('deny 203.0.113.5;'),
      message: (j) => j.t('first-day-event-overwritten', { blocked: BLOCKED }),
    },
    {
      id: 'rule',
      condition: (j) => (j.read(BLOCKED) ?? '').includes(`deny ${ROBOT};`),
      message: (j) => j.t('first-day-event-rule'),
    },
    {
      id: 'blocked',
      condition: (j) => j.state.loadedConf.includes(`deny ${ROBOT};`),
      message: (j) => {
        const p = (j.state.process as Process[]).find((q) => q.cpu > 90);
        return p
          ? j.t('first-day-event-blocked-process', { robot: ROBOT, pid: String(p.pid) })
          : j.t('first-day-event-blocked', { robot: ROBOT });
      },
    },
    {
      id: 'repaired',
      condition: (j) =>
        j.flags.has('blocked') && !(j.state.process as Process[]).some((p) => p.cpu > 90),
      message: (j) => j.t('first-day-event-repaired', { robot: ROBOT }),
    },
    {
      id: 'report',
      // A count taken at some point during the investigation: between the log at the start and the log now.
      condition: (j) => {
        const r = j.read(path(j.t, `${M}/report.txt`)) ?? '';
        return j.flags.has('repaired') && r.includes(ROBOT) && reportCount(r).some((n) => n >= ERRORS_503 && n <= erreurs503(j));
      },
      message: (j) => {
        const r = j.read(path(j.t, `${M}/report.txt`)) ?? '';
        const n = reportCount(r).find((x) => x >= ERRORS_503 && x <= erreurs503(j)) ?? ERRORS_503;
        return j.t('first-day-event-report', { errors: String(n) });
      },
    },
  ],
};
