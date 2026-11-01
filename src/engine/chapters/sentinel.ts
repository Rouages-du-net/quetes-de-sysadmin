// Histoire « Les Lettres du quartier » — chapitre « La sentinelle » :
// fail2ban. Il tourne avec les réglages de Debian (prison sshd, bantime de
// 10 minutes) : les robots reviennent dès la fin de leur bannissement, et
// Rania, la webmestre, a été bannie après s'être trompée de nom. Débannir
// Rania, régler jail.local (bantime plus long, ignoreip pour Rania et pour
// son propre poste), recharger, vérifier.
// Piège : un maxretry trop strict sans ignoreip, et le poste (qui a raté
// trois connexions hier) se bannit lui-même.
// Sources : https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html,
// https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html

import { d, f, accountsFiles, accountsByDefault, type Chapter } from '../world';
import type { Game } from '../shell';
import { WORKSTATION } from '../machines';
import { writeLog, newSystemd, systemd } from '../systemd';
import { apply, covers, DIRECTORY, readConfig, note, type Fail2banState } from '../fail2ban';
import { instants } from '../activity';

const M = '/home/you';
const RANIA = '198.51.100.40';
const ROBOTS = ['203.0.113.66', '198.51.100.23'];

// L'en-tête et l'essentiel du jail.conf livré avec fail2ban.
export const JAIL_CONF = `#
# WARNING: heavily refactored in 0.9.0 release.  Please review and
#          customize settings for your setup.
#
# Changes:  in most of the cases you should not modify this
#           file, but provide customizations in jail.local file,
#           or separate .conf files under jail.d/ directory, e.g.:
#
# HOW TO ACTIVATE JAILS:
#
# YOU SHOULD NOT MODIFY THIS FILE.
#
# It will probably be overwritten or improved in a distribution update.
#
# Provide customizations in a jail.local file or a jail.d/customisation.local.
# For example to change the default bantime for all jails and to enable the
# ssh-iptables jail the following (uncommented) would appear in the .local file.
# See man 5 jail.conf for details.
#
# [DEFAULT]
# bantime = 1h
#
# [sshd]
# enabled = true
#

[DEFAULT]

# "ignoreip" can be a list of IP addresses, CIDR masks or DNS hosts. Fail2ban
# will not ban a host which matches an address in this list. Several addresses
# can be defined using space (and/or comma) separator.
#ignoreip = 127.0.0.1/8 ::1

# "bantime" is the number of seconds that a host is banned.
bantime  = 10m

# A host is banned if it has generated "maxretry" during the last "findtime"
# seconds.
findtime  = 10m

# "maxretry" is the number of failures before a host get banned.
maxretry = 5

[sshd]
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s`;

// Ce que fail2ban a écrit ce matin : le va-et-vient des robots, et Rania.
const LOG = [
  ['07:12:04', 'Ban 203.0.113.66'],
  ['07:22:04', 'Unban 203.0.113.66'],
  ['07:31:47', 'Ban 203.0.113.66'],
  ['07:41:47', 'Unban 203.0.113.66'],
  ['07:50:12', 'Ban 203.0.113.66'],
  ['07:58:31', `Ban ${RANIA}`],
  ['08:00:12', 'Unban 203.0.113.66'],
  ['08:05:40', 'Ban 198.51.100.23'],
  ['08:09:55', 'Ban 203.0.113.66'],
  ['09:35:40', 'Unban 198.51.100.23'],
]
  .map(([h, m]) => `2026-10-22 ${h},412 fail2ban.actions        [701]: NOTICE  [sshd] ${m}`)
  .join('\n');

// Les échecs de connexion de la nuit et de la matinée, dans le journal de ssh (les vôtres sous le nom de votre compte).
const FAILURES = (player: string): [string, string][] => [
  ...[51234, 51240, 51251].map((p): [string, string] => [WORKSTATION.address, `Failed publickey for ${player} from ${WORKSTATION.address} port ${p} ssh2`]),
  ...['oracle', 'git', 'admin', 'test', 'oracle', 'pi', 'git'].map((u, i): [string, string] => ['203.0.113.66', `Invalid user ${u} from 203.0.113.66 port ${40100 + i}`]),
  ...['admin', 'user', 'admin', 'ftp', 'guest', 'admin'].map((u, i): [string, string] => ['198.51.100.23', `Invalid user ${u} from 198.51.100.23 port ${33800 + i}`]),
  ...[50211, 50214, 50219, 50223, 50230].map((p): [string, string] => [RANIA, `Invalid user ranja from ${RANIA} port ${p}`]),
];

const f2b = (j: Game) => j.state.fail2ban as Fail2banState;

// Les robots ne s'arrêtent pas pendant qu'on joue : chacun retente sa chance
// à son rythme, avec un nom au hasard de sa liste. Banni, il ne passe plus
// (le pare-feu le rejette avant sshd) ; à la fin du bantime, fail2ban le
// relâche et il recommence (« ils reviennent toutes les dix minutes »).
const IN_DIRECT = [
  { ip: ROBOTS[0], period: 20, accounts: ['root', 'admin', 'oracle', 'postgres', 'ubuntu', 'git'] },
  { ip: ROBOTS[1], period: 12, accounts: ['admin', 'test', 'user', 'ftp', 'guest'] },
];
// Le bruit de fond d'internet : des scanners qui essaient un ou deux noms puis
// passent à une autre cible (trop peu pour fail2ban). Adresses de documentation.
const SCANNERS = ['203.0.113.', '192.0.2.', '198.51.100.'];
const COURANTS_ACCOUNTS = ['root', 'admin', 'pi', 'oracle', 'test', 'ubuntu', 'support', 'user'];
const scanner = (n: number) => `${SCANNERS[n % 3]}${150 + ((n * 37) % 50)}`;
// Depuis quand chaque robot est banni (pour le relâcher à la fin du bantime).
const since = (j: Game): Record<string, number> => (j.state.bannedSince ??= {}) as Record<string, number>;

function release(j: Game, t: number) {
  const state = f2b(j);
  const bantime = state.load?.bantime ?? 600;
  for (const ip of ROBOTS) {
    if (!state.banned.includes(ip)) continue;
    const start = (since(j)[ip] ??= t);
    if (bantime < 0 || t - start < bantime * 1000) continue;
    state.banned.splice(state.banned.indexOf(ip), 1);
    (state.restored ??= {})[ip] = t;
    delete since(j)[ip];
    systemd(j)!.clock = t;
    note(j, state, `Unban ${ip}`);
  }
}

function robotsInDirect(j: Game, forEachOf: number, a: number) {
  const sd = systemd(j)!;
  const state = f2b(j);
  const watch = () => sd.services.fail2ban?.state === 'active' && !!state.load?.enabled;
  // Un scanner toutes les 9 s, deux essais chacun (le second 9 s après le premier).
  const scanners = instants(forEachOf, a, 9).map((t) => {
    const k = Math.floor(t / 9000);
    const n = Math.floor(k / 2);
    return { t, r: { ip: scanner(n), period: 9, accounts: [COURANTS_ACCOUNTS[(n + (k % 2)) % COURANTS_ACCOUNTS.length]] } };
  });
  const attempts = [...IN_DIRECT.flatMap((r) => instants(forEachOf, a, r.period).map((t) => ({ t, r }))), ...scanners].sort((x, y) => x.t - y.t);
  for (const { t, r } of attempts) {
    sd.clock = t;
    if (watch()) release(j, t);
    if (state.banned.includes(r.ip)) continue;
    const n = Math.floor(t / (r.period * 1000));
    writeLog(sd, 'ssh.service', 'sshd', 3100 + (n % 60), `Invalid user ${r.accounts[n % r.accounts.length]} from ${r.ip} port ${40000 + (n % 20000)}`, 6, false);
    if (!watch()) continue;
    apply(j, state, r.ip);
    for (const ip of ROBOTS) if (state.banned.includes(ip)) since(j)[ip] ??= t;
  }
  if (watch()) release(j, a);
}
const ignore = (j: Game, ip: string) => f2b(j).load?.ignoreip.some((e) => covers(e, ip)) ?? false;
const set = (j: Game) => {
  const p = f2b(j).load;
  return !!p && p.enabled && (p.bantime >= 3600 || p.bantime < 0) && ignore(j, RANIA) && ignore(j, WORKSTATION.address);
};
const rightBans = (j: Game) => !f2b(j).banned.includes(RANIA) && !f2b(j).banned.includes(WORKSTATION.address) && ROBOTS.every((r) => f2b(j).banned.includes(r));

export const sentinel: Chapter = {
  id: 'sentinel',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'fail2ban-client'],
  home: M,
  welcome: 'email_kofi.txt',
  names: true,
  final: 'end',
  password: 'ants-2026',
  accounts: () => {
    const c = accountsByDefault();
    c.groups.adm = { gid: 4, members: ['you'] };
    return c;
  },
  activity: { not: 15, advance: robotsInDirect },
  state: () => ({
    // Le second robot vient d'être relâché (09:35) : il recommence pendant qu'on joue, et fail2ban le rattrape.
    fail2ban: { load: null, banned: [ROBOTS[0], RANIA], bannedTotal: 6, log: [], loads: 0, consulted: false, restored: { [ROBOTS[1]]: Date.UTC(2026, 9, 22, 9, 35, 40) } } satisfies Fail2banState,
    systemd: newSystemd('letters', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 9, 22, 6, 0, 0), {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      fail2ban: {
        description: 'Fail2Ban Service',
        active: true,
        executable: 'fail2ban-server',
        check: (j) => {
          const e = readConfig(j).errors;
          return e.length ? e : null;
        },
        checkToReload: true,
        load: (j) => {
          const state = f2b(j);
          if (!state) return;
          state.load = readConfig(j).jail;
          state.loads++;
          state.consulted = false;
          apply(j, state);
        },
      },
    }),
  }),
  initialise: (j) => {
    f2b(j).load = readConfig(j).jail;
    const sd = systemd(j)!;
    FAILURES(j.player).forEach(([, message], i) => writeLog(sd, 'ssh.service', 'sshd', 1900 + i * 4, message, 6, true));
    sd.clock = Date.UTC(2026, 9, 22, 9, 40, 0);
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    return d(
      {
        etc: d(
          {
            ...accountsFiles(),
            fail2ban: d(
              {
                'jail.conf': f(JAIL_CONF, { lines: true, owner: 'root' }),
                'jail.d': d({ 'defaults-debian.conf': f('[sshd]\nenabled = true', { lines: true, owner: 'root' }) }, undefined, root),
              },
              undefined,
              root,
            ),
          },
          undefined,
          root,
        ),
        home: d({ you: d({ 'email_kofi.txt': f(t('sentinel-email-kofi')) }) }, undefined, root),
        var: d(
          {
            log: d(
              { 'fail2ban.log': f((j) => [LOG, ...f2b(j).log].join('\n'), { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' }) },
              undefined,
              root,
            ),
          },
          undefined,
          root,
        ),
      },
      undefined,
      root,
    );
  },
  events: [
    {
      id: 'jail-conf',
      condition: (j) => j.read(`${DIRECTORY}/jail.conf`) !== JAIL_CONF,
      message: (j) => j.t('sentinel-event-jail-conf'),
    },
    {
      id: 'error',
      condition: (j) => readConfig(j).errors.length > 0,
      message: (j) => j.t('sentinel-event-error'),
    },
    {
      id: 'rania',
      condition: (j) => !f2b(j).banned.includes(RANIA),
      message: (j) => j.t('sentinel-event-rania'),
    },
    {
      id: 'banned-self',
      condition: (j) => f2b(j).banned.includes(WORKSTATION.address),
      message: (j) => j.t('sentinel-event-banned-self', { address: WORKSTATION.address }),
    },
    {
      id: 'set',
      condition: (j) => set(j) && f2b(j).loads > 0,
      message: (j) => j.t('sentinel-event-set'),
    },
    {
      id: 'end',
      condition: (j) => j.flags.has('set') && set(j) && rightBans(j) && f2b(j).consulted,
      message: (j) => j.t('sentinel-event-end'),
    },
  ],
};
