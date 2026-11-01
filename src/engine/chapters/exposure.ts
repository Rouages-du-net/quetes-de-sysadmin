// Histoire « L'Audit » — chapitre « L'exposition » : deuxième partie du
// rapport de Salomé. Son balayage de ports, depuis internet, trouve la base
// PostgreSQL (5432) et Redis (6379) joignables par tout le monde ; le
// pare-feu (ufw) est installé mais éteint. Redis n'a pas de mot de passe et
// écoute sur toutes les interfaces (bind * -::*, protected-mode no).
//   - ss -tlnp : qui écoute où ;
//   - ufw : autoriser SSH (depuis le poste), 80 et 443 AVANT d'activer ;
//   - Redis : en plus du pare-feu, le faire écouter seulement sur
//     127.0.0.1 (bind dans /etc/redis/redis.conf, puis restart : un
//     programme ne relit pas sa configuration tout seul). Le pare-feu seul
//     laisserait Redis à une erreur de règle d'être public.
// Pièges réels : activer ufw avant d'autoriser SSH, couper le site, arrêter
// Redis (l'appli de commandes en a besoin), modifier redis.conf sans
// redémarrer.
// Objectif vérifié sur l'état : ufw actif (entrant refusé par défaut), SSH
// du poste, 80 et 443 joignables depuis internet, 5432 et 6379 fermés,
// Redis actif et à l'écoute sur 127.0.0.1 seulement, et une nouvelle
// connexion ssh réussie depuis l'activation.
// Sources : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html,
// https://redis.io/docs/latest/operate/oss_and_stack/management/security/,
// https://www.postgresql.org/docs/current/runtime-config-connection.html

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { WORKSTATION } from '../machines';
import { newFirewall, type Firewall } from '../firewall';
import { portState } from '../ports';
import { newSystemd, systemd } from '../systemd';
import type { Listening } from '../commands/ss';
import { loadSshd, bakeryAccounts, file, INTERNET, M, NOW, PASSWORD, bakeryWorld, serviceSsh } from './audit';

const REDIS_CONF = '/etc/redis/redis.conf';

// Le balayage de Salomé, comme nmap l'affiche.
const SCAN = `Starting Nmap 7.94 ( https://nmap.org ) at 2028-03-13 17:41 CET
Nmap scan report for bakery.example (192.0.2.22)
Host is up (0.011s latency).
Not shown: 994 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
5432/tcp open  postgresql
6379/tcp open  redis

Nmap done: 1 IP address (1 host up) scanned in 2.07 seconds`;

// redis.conf de Debian (extrait), tel que l'a laissé l'installation « pour que ça marche ».
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

/** Redis écoute-t-il seulement sur la boucle locale d'après ce redis.conf ? (sans « bind » : partout) */
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
const open = (j: Game, port: number, source = INTERNET) => portState(j, port, false, source) === 'ouvert';
const openSsh = (j: Game) => open(j, 22, WORKSTATION.address);
const openSite = (j: Game) => open(j, 80) && open(j, 443);
const openBase = (j: Game) => open(j, 5432) || open(j, 6379);
const filter = (j: Game) => pf(j).enabled && pf(j).incoming !== 'allow' && openSsh(j) && openSite(j) && !openBase(j);

const redis = (j: Game) => (j.state.ecoute as Listening[]).find((e) => e.port === 6379);
const activeRedis = (j: Game) => systemd(j)!.services['redis-server'].state === 'active';
const localeListeningRedis = (j: Game) => activeRedis(j) && redis(j)?.address === '127.0.0.1';
const confLocale = (j: Game) => redisLocal(j.read(REDIS_CONF) ?? '');

export const exposure: Chapter = {
  id: 'exposure',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'ps', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ufw'],
  home: M,
  welcome: 'courriel_salome.txt',
  names: true,
  final: 'fin',
  steps: ['ecoute', 'pare-feu', 'redis-local', 'fin'],
  password: PASSWORD,
  accounts: () => bakeryAccounts(false),
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ufw: newFirewall(),
    ecoute: listening(),
    systemd: newSystemd('bakery', NOW - 5 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres' },
      'redis-server': {
        description: 'Advanced key-value store',
        active: true,
        executable: 'redis-server',
        process: [{ pid: 760, user: 'redis', cpu: 0.2, mem: 0.6, command: '/usr/bin/redis-server *:6379' }],
        // Redis lit redis.conf au démarrage : c'est là qu'il choisit où écouter.
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
      home: { 'courriel_salome.txt': f(t('exposure-courriel-salome')), 'balayage-audit.txt': f(SCAN, { lines: true }) },
      etc: { redis: d({ 'redis.conf': f(REDIS_CONFIG, { lines: true, owner: 'redis', group: 'redis', mode: 'rw-r-----' }) }, undefined, { owner: 'root' }) },
      ssh: { 'sshd_config.d': d({ '00-hardening.conf': file('PermitRootLogin no', 'root') }, undefined, { owner: 'root' }) },
    }),
  events: [
    {
      id: 'ecoute',
      condition: (j) => j.last.commands.some((c) => c[0] === 'ss') && /:(6379|redis)\b/.test(j.last.output),
      message: (j) => j.t('exposure-evenement-ecoute'),
    },
    { id: 'enferme', condition: (j) => pf(j).enabled && !openSsh(j), message: (j) => j.t('exposure-evenement-enferme') },
    { id: 'site-coupe', condition: (j) => pf(j).enabled && !openSite(j), message: (j) => j.t('exposure-evenement-site-coupe') },
    { id: 'base-ouverte', condition: (j) => pf(j).enabled && openBase(j), message: (j) => j.t('exposure-evenement-base-ouverte') },
    { id: 'redis-arrete', condition: (j) => !activeRedis(j), message: (j) => j.t('exposure-evenement-redis-arrete') },
    {
      id: 'sans-effet',
      condition: (j) => activeRedis(j) && confLocale(j) && !localeListeningRedis(j),
      message: (j) => j.t('exposure-evenement-sans-effet'),
    },
    { id: 'pare-feu', condition: filter, message: (j) => j.t('exposure-evenement-pare-feu') },
    { id: 'redis-local', condition: localeListeningRedis, message: (j) => j.t('exposure-evenement-redis-local') },
    {
      id: 'fin',
      condition: (j) => filter(j) && localeListeningRedis(j) && (j.state.connexions ?? 1) > (pf(j).activationAlConnections ?? Infinity),
      message: (j) => j.t('exposure-evenement-fin'),
    },
  ],
};
