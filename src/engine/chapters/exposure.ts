// Story "The Audit" — chapter "The Exposure": second part of Salomé's
// report. Her port scan, from the internet, finds the PostgreSQL database
// (5432) and Redis (6379) reachable by everyone; the firewall (ufw) is
// installed but off. Redis has no password and listens on every interface
// (bind * -::*, protected-mode no).
//   - ss -tlnp: who listens where;
//   - ufw: allow SSH (from the workstation), 80 and 443 BEFORE enabling;
//   - Redis: on top of the firewall, make it listen only on 127.0.0.1
//     (bind in /etc/redis/redis.conf, then restart: a program does not
//     reread its configuration on its own). The firewall alone would leave
//     Redis one rule mistake away from being public.
// Real traps: enabling ufw before allowing SSH, cutting off the site,
// stopping Redis (the orders app needs it), editing redis.conf without
// restarting.
// Objective checked on the state: ufw active (incoming denied by default),
// SSH from the workstation, 80 and 443 reachable from the internet, 5432
// and 6379 closed, Redis active and listening on 127.0.0.1 only, and a new
// successful ssh connection since enabling.
// Sources: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html,
// https://redis.io/docs/latest/operate/oss_and_stack/management/security/,
// https://www.postgresql.org/docs/current/runtime-config-connection.html

import { d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';
import { WORKSTATION } from '../machines';
import { newFirewall, type Firewall } from '../firewall';
import { portState } from '../ports';
import { newSystemd, systemd } from '../systemd';
import type { Listening } from '../commands/ss';
import { loadSshd, bakeryAccounts, file, INTERNET, M, NOW, PASSWORD, bakeryWorld, serviceSsh } from './audit';

const REDIS_CONF = '/etc/redis/redis.conf';

// Salomé's scan, as nmap shows it.
const scan = (domain: string) => `Starting Nmap 7.94 ( https://nmap.org ) at 2028-03-13 17:41 CET
Nmap scan report for ${domain} (192.0.2.22)
Host is up (0.011s latency).
Not shown: 994 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
5432/tcp open  postgresql
6379/tcp open  redis

Nmap done: 1 IP address (1 host up) scanned in 2.07 seconds`;

// Debian's redis.conf (excerpt), as the "just make it work" installation left it.
const REDIS_CONFIG = `# Redis configuration file (excerpt)
bind * -::*
port 6379
protected-mode no
# requirepass foobared
daemonize no
supervised systemd
dir /var/lib/redis`;

const listening = (): Listening[] => [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 5432, process: 'postgres', pid: 744 },
  { proto: 'tcp', address: '0.0.0.0', port: 6379, process: 'redis-server', pid: 760 },
  { proto: 'tcp', address: '127.0.0.1', port: 3000, process: 'node', pid: 731 },
];

/** According to this redis.conf, does Redis listen only on the loopback? (without "bind": everywhere) */
export const redisLocal = (conf: string) => {
  const words = conf
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => /^bind\s/i.test(l))
    .flatMap((l) => l.split(/\s+/).slice(1))
    .map((a) => a.replace(/^-/, ''));
  return words.length > 0 && words.every((a) => ['127.0.0.1', '::1', 'localhost'].includes(a));
};

const pf = (j: Game) => j.state.ufw as Firewall;
const open = (j: Game, port: number, source = INTERNET) => portState(j, port, false, source) === 'open';
const openSsh = (j: Game) => open(j, 22, WORKSTATION.address);
const openSite = (j: Game) => open(j, 80) && open(j, 443);
const openBase = (j: Game) => open(j, 5432) || open(j, 6379);
const filter = (j: Game) => pf(j).enabled && pf(j).incoming !== 'allow' && openSsh(j) && openSite(j) && !openBase(j);

const redis = (j: Game) => (j.state.listening as Listening[]).find((e) => e.port === 6379);
const activeRedis = (j: Game) => systemd(j)!.services['redis-server'].state === 'active';
const localeListeningRedis = (j: Game) => activeRedis(j) && redis(j)?.address === '127.0.0.1';
const confLocale = (j: Game) => redisLocal(j.read(REDIS_CONF) ?? '');

export const exposure: Chapter = {
  id: 'exposure',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'ps', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ufw'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['listening', 'firewall', 'redis-local', 'end'],
  password: PASSWORD,
  accounts: () => bakeryAccounts(false),
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ufw: newFirewall(),
    listening: listening(),
    systemd: newSystemd('bakery', NOW - 5 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres' },
      'redis-server': {
        description: 'Advanced key-value store',
        active: true,
        executable: 'redis-server',
        process: [{ pid: 760, user: 'redis', cpu: 0.2, mem: 0.6, command: '/usr/bin/redis-server *:6379' }],
        // Redis reads redis.conf on start: that is where it chooses where to listen.
        load: (j) => {
          const e = redis(j);
          if (e) e.address = redisLocal(j.read(REDIS_CONF) ?? '') ? '127.0.0.1' : '0.0.0.0';
        },
      },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
    }),
  }),
  initialise: (j) => loadSshd(j),
  createWorld: (t) =>
    bakeryWorld(t, {
      withoutLucas: true,
      home: { 'email_salome.txt': f(t('exposure-email-salome')), 'audit_scan.txt': f(scan(name(t, 'bakery.example')), { lines: true }) },
      etc: { redis: d({ 'redis.conf': f(REDIS_CONFIG, { lines: true, owner: 'redis', group: 'redis', mode: 'rw-r-----' }) }, undefined, { owner: 'root' }) },
      ssh: { 'sshd_config.d': d({ '00-hardening.conf': file('PermitRootLogin no', 'root') }, undefined, { owner: 'root' }) },
    }),
  events: [
    {
      id: 'listening',
      condition: (j) => j.last.commands.some((c) => c[0] === 'ss') && /:(6379|redis)\b/.test(j.last.output),
      message: (j) => j.t('exposure-event-listening'),
    },
    { id: 'locked-out', condition: (j) => pf(j).enabled && !openSsh(j), message: (j) => j.t('exposure-event-locked-out') },
    { id: 'site-cut', condition: (j) => pf(j).enabled && !openSite(j), message: (j) => j.t('exposure-event-site-cut') },
    { id: 'base-open', condition: (j) => pf(j).enabled && openBase(j), message: (j) => j.t('exposure-event-base-open') },
    { id: 'redis-stopped', condition: (j) => !activeRedis(j), message: (j) => j.t('exposure-event-redis-stopped') },
    {
      id: 'without-effect',
      condition: (j) => activeRedis(j) && confLocale(j) && !localeListeningRedis(j),
      message: (j) => j.t('exposure-event-without-effect'),
    },
    { id: 'firewall', condition: filter, message: (j) => j.t('exposure-event-firewall') },
    { id: 'redis-local', condition: localeListeningRedis, message: (j) => j.t('exposure-event-redis-local') },
    {
      id: 'end',
      condition: (j) => filter(j) && localeListeningRedis(j) && (j.state.connections ?? 1) > (pf(j).activationAlConnections ?? Infinity),
      message: (j) => j.t('exposure-event-end'),
    },
  ],
};
