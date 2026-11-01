// Histoire « Les Lettres du quartier » — chapitre « La récidive » : d'autres
// prisons de fail2ban. Les mêmes robots sont bannis une heure, reviennent,
// sont rebannis, depuis des semaines ; et le robot de l'agenda, que nginx
// limite depuis le soir du concert (« limiting requests » dans error.log),
// insiste. jail.conf a des prisons toutes prêtes : recidive (qui lit
// fail2ban.log et bannit longtemps, sur tous les ports, les adresses déjà
// bannies plusieurs fois) et nginx-limit-req (qui lit error.log). Il suffit
// de les activer, dans jail.local.
// Pièges réels : « enabled = true » dans [DEFAULT] active TOUTES les prisons
// de jail.conf, et fail2ban refuse de démarrer faute de trouver leurs
// journaux (apache, postfix) ; une recidive qui ne bannit pas plus longtemps
// que les autres prisons ne sert à rien.
// Objectif vérifié sur l'état : recidive et nginx-limit-req chargées, les
// récidivistes et le robot bannis, Rania et les visiteur·ses non, recidive
// plus longue que sshd, l'état des prisons consulté.
// Sources : https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html,
// https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf,
// https://github.com/fail2ban/fail2ban/blob/master/config/filter.d/recidive.conf,
// https://github.com/fail2ban/fail2ban/blob/master/config/filter.d/nginx-limit-req.conf

import { d, f, accountsFiles, accountsByDefault, type Chapter } from '../world';
import type { Game } from '../shell';
import { WORKSTATION } from '../machines';
import { newSystemd, systemd } from '../systemd';
import { actives, apply, bannedFor, DIRECTORY, readConfig, type Fail2banState } from '../fail2ban';
import type { Firewall } from '../firewall';
import type { Listening } from '../commands/ss';
import { JAIL_CONF } from './sentinel';
import { DEFAULTS_DEBIAN } from './port';

const M = '/home/vous';
const RANIA = '198.51.100.40';
const REPEAT_OFFENDERS = ['203.0.113.66', '198.51.100.23'];
const OCCASIONAL = '192.0.2.200';
const SCRAPERS = ['198.51.100.24', '198.51.100.25', '198.51.100.26'];
const VISITOR = '203.0.113.41';

// Les prisons de jail.conf que le jeu reprend (celles de fail2ban, abrégées).
const COMPLETE_CONF_JAIL = `${JAIL_CONF}


#
# HTTP servers
#

[apache-auth]

port     = http,https
logpath  = %(apache_error_log)s


[nginx-http-auth]

port    = http,https
logpath = %(nginx_error_log)s

# To use 'nginx-limit-req' jail you should have \`ngx_http_limit_req_module\`
# and define \`limit_req\` and \`limit_req_zone\` as described in nginx documentation
# http://nginx.org/en/docs/http/ngx_http_limit_req_module.html
# or for example see in 'config/filter.d/nginx-limit-req.conf'
[nginx-limit-req]
port    = http,https
logpath = %(nginx_error_log)s

[nginx-botsearch]

port     = http,https
logpath  = %(nginx_error_log)s


#
# Mail servers
#

[postfix]
# To use another modes set filter parameter "mode" in jail.local:
mode    = more
port    = smtp,465,submission
logpath = %(postfix_log)s
backend = %(postfix_backend)s


# Jail for more extended banning of persistent abusers
# !!! WARNINGS !!!
# 1. Make sure that your loglevel specified in fail2ban.conf/.local
#    is not at DEBUG level -- which might then cause fail2ban to fall into
#    an infinite loop constantly feeding itself with non-informative lines
# 2. Increase dbpurgeage defined in fail2ban.conf to e.g. 648000 (7.5 days)
#    to maintain entries for failed logins for sufficient amount of time
[recidive]

logpath  = /var/log/fail2ban.log
banaction = %(banaction_allports)s
bantime  = 1w
findtime = 1d`;

// Le jail.local laissé par « La sentinelle » et « Le port ».
const JAIL_LOCAL = `[DEFAULT]
bantime  = 1h
ignoreip = ${RANIA} ${WORKSTATION.address}

[sshd]
port = 2222`;

// fail2ban.log : depuis hier, les mêmes adresses bannies, débannies une heure plus tard, rebannies.
const LOG = (() => {
  const events: [number, string][] = [];
  const bans = (ip: string, times: number, start: number, difference: number) => {
    for (let i = 0; i < times; i++) {
      const t = start + i * difference;
      events.push([t, `Ban ${ip}`], [t + 3600, `Unban ${ip}`]);
    }
  };
  bans(REPEAT_OFFENDERS[0], 9, 0, 9000);
  bans(REPEAT_OFFENDERS[1], 7, 1500, 11000);
  bans(OCCASIONAL, 2, 4000, 30000);
  const start = Date.UTC(2026, 10, 11, 8, 0, 0);
  // Les deux récidivistes sont encore bannis à l'instant (leur dernier Unban n'a pas eu lieu).
  const end = Date.UTC(2026, 10, 12, 8, 50, 0);
  return events
    .map(([t, m]): [number, string] => [start + t * 1000, m])
    .filter(([t]) => t < end)
    .sort((a, b) => a[0] - b[0])
    .map(
      ([t, m]) =>
        `${new Date(t).toISOString().replace('T', ' ').slice(0, 19)},${String(100 + (t % 900)).slice(0, 3)} fail2ban.actions        [701]: NOTICE  [sshd] ${m}`,
    )
    .join('\n');
})();

// error.log de nginx : la limite de débit refuse le robot de l'agenda (et, parfois, d'autres).
const ERRORS = (() => {
  const who: [string, number][] = [
    [SCRAPERS[0], 15],
    [SCRAPERS[1], 12],
    [SCRAPERS[2], 9],
    [RANIA, 6],
    [VISITOR, 2],
  ];
  const lines: string[] = [];
  let n = 18300;
  who.forEach(([ip, times], k) => {
    for (let i = 0; i < times; i++) {
      const s = 10 + k * 7 + i * 3;
      const timeOfDay = `2026/11/11 ${String(20 + (Math.floor(s / 60) % 4)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`;
      const excess = (10 + ((i * 37 + k * 11) % 900) / 1000).toFixed(3);
      lines.push(
        `${timeOfDay} [error] 702#702: *${n++} limiting requests, excess: ${excess} by zone "agenda", client: ${ip}, server: letters.example, request: "GET /agenda/ HTTP/1.1", host: "letters.example"`,
      );
    }
  });
  return lines.sort().join('\n');
})();

const f2b = (j: Game) => j.state.fail2ban as Fail2banState;
const jail = (j: Game, name: string) => actives(f2b(j)).find((p) => p.name === name);
const banned = (j: Game, ip: string, name: string) => !!jail(j, name) && bannedFor(f2b(j), name).includes(ip);
// recidive ne sert que si elle bannit plus longtemps que la prison sshd.
const moreLong = (j: Game) => {
  const r = jail(j, 'recidive');
  const s = jail(j, 'sshd');
  return !!r && (r.bantime < 0 || (!!s && s.bantime >= 0 && r.bantime > s.bantime));
};
const spared = (j: Game) => [RANIA, VISITOR, WORKSTATION.address].every((ip) => actives(f2b(j)).every((p) => !bannedFor(f2b(j), p.name).includes(ip)));
const succeeded = (j: Game) =>
  REPEAT_OFFENDERS.every((ip) => banned(j, ip, 'recidive')) &&
  SCRAPERS.every((ip) => banned(j, ip, 'nginx-limit-req')) &&
  !!jail(j, 'sshd') &&
  moreLong(j) &&
  spared(j);

const LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 2222, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '[::]', port: 2222, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
];

export const repeatOffence: Chapter = {
  id: 'repeat-offenders',
  number: 8,
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
    'cut',
    'awk',
    'id',
    'whoami',
    'nano',
    'sudo',
    'systemctl',
    'journalctl',
    'fail2ban-client',
    'ufw',
    'ss',
    'nft',
  ],
  home: M,
  welcome: 'courriel_rania.txt',
  names: true,
  final: 'fin',
  password: 'fourmis-2026',
  accounts: () => {
    const c = accountsByDefault();
    c.groups.adm = { gid: 4, members: ['vous'] };
    return c;
  },
  state: () => ({
    // SSH écoute sur 2222 depuis « Le port ».
    sshd: { load: { port: '2222' }, reloads: 0 },
    ecoute: LISTENING,
    ufw: {
      enabled: true,
      incoming: 'deny',
      outgoing: 'allow',
      rules: [
        { action: 'allow', to: '2222/tcp', ports: [2222], forEachOf: null },
        { action: 'allow', to: 'Nginx Full', ports: [80, 443], forEachOf: null },
      ],
    } satisfies Firewall,
    fail2ban: { load: null, banned: [...REPEAT_OFFENDERS], bannedTotal: 18, log: [], loads: 0, consulted: false } satisfies Fail2banState,
    systemd: newSystemd('lettres', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 10, 12, 9, 0, 0), {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
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
          const { jail, jails } = readConfig(j);
          state.load = jail;
          state.jails = jails;
          state.loads++;
          state.consulted = false;
          apply(j, state);
        },
      },
    }),
  }),
  initialise: (j) => {
    const { jail, jails } = readConfig(j);
    f2b(j).load = jail;
    f2b(j).jails = jails;
    systemd(j)!.clock = Date.UTC(2026, 10, 12, 9, 0, 0);
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
                'jail.conf': f(COMPLETE_CONF_JAIL, { lines: true, owner: 'root' }),
                'jail.d': d({ 'defaults-debian.conf': f(DEFAULTS_DEBIAN, { lines: true, owner: 'root' }) }, undefined, root),
                'jail.local': f(JAIL_LOCAL, { lines: true, owner: 'root' }),
              },
              undefined,
              root,
            ),
          },
          undefined,
          root,
        ),
        home: d({ vous: d({ 'courriel_rania.txt': f(t('repeat-offenders-courriel-rania')) }) }, undefined, root),
        var: d(
          {
            log: d(
              {
                'fail2ban.log': f((j) => [LOG, ...f2b(j).log].join('\n'), { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' }),
                nginx: d(
                  {
                    'error.log': f(ERRORS, { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
                    'access.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
                  },
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
        ),
      },
      undefined,
      root,
    );
  },
  events: [
    {
      id: 'jail-conf',
      condition: (j) => j.read(`${DIRECTORY}/jail.conf`) !== COMPLETE_CONF_JAIL,
      message: (j) => j.t('sentinel-evenement-jail-conf'),
    },
    {
      id: 'tout-active',
      condition: (j) => readConfig(j).errors.some((e) => e.includes('Have not found any log file')),
      message: (j) => j.t('repeat-offenders-evenement-tout-active'),
    },
    { id: 'courte', condition: (j) => !!jail(j, 'recidive') && !moreLong(j), message: (j) => j.t('repeat-offenders-evenement-courte') },
    { id: 'recidive', condition: (j) => REPEAT_OFFENDERS.some((ip) => banned(j, ip, 'recidive')), message: (j) => j.t('repeat-offenders-evenement-recidive') },
    { id: 'agenda', condition: (j) => SCRAPERS.some((ip) => banned(j, ip, 'nginx-limit-req')), message: (j) => j.t('repeat-offenders-evenement-agenda') },
    { id: 'fin', condition: (j) => succeeded(j) && f2b(j).consulted, message: (j) => j.t('repeat-offenders-evenement-fin') },
  ],
};
