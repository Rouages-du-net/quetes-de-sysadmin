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

import { d, f, fichiersComptes, comptesParDefaut, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { POSTE } from '../machines';
import { nouveauSystemd, systemd } from '../systemd';
import { actives, appliquer, bannisDe, DOSSIER, lireConfig, type EtatFail2ban } from '../fail2ban';
import type { PareFeu } from '../parefeu';
import type { Ecoute } from '../commandes/ss';
import { JAIL_CONF } from './sentinelle';
import { DEFAULTS_DEBIAN } from './port';

const M = '/home/vous';
const RANIA = '198.51.100.40';
const RECIDIVISTES = ['203.0.113.66', '198.51.100.23'];
const OCCASIONNEL = '192.0.2.200';
const ASPIRATEURS = ['198.51.100.24', '198.51.100.25', '198.51.100.26'];
const VISITEUR = '203.0.113.41';

// Les prisons de jail.conf que le jeu reprend (celles de fail2ban, abrégées).
const JAIL_CONF_COMPLET = `${JAIL_CONF}


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
ignoreip = ${RANIA} ${POSTE.adresse}

[sshd]
port = 2222`;

// fail2ban.log : depuis hier, les mêmes adresses bannies, débannies une heure plus tard, rebannies.
const LOG = (() => {
  const evenements: [number, string][] = [];
  const bans = (ip: string, fois: number, debut: number, ecart: number) => {
    for (let i = 0; i < fois; i++) {
      const t = debut + i * ecart;
      evenements.push([t, `Ban ${ip}`], [t + 3600, `Unban ${ip}`]);
    }
  };
  bans(RECIDIVISTES[0], 9, 0, 9000);
  bans(RECIDIVISTES[1], 7, 1500, 11000);
  bans(OCCASIONNEL, 2, 4000, 30000);
  const debut = Date.UTC(2026, 10, 11, 8, 0, 0);
  // Les deux récidivistes sont encore bannis à l'instant (leur dernier Unban n'a pas eu lieu).
  const fin = Date.UTC(2026, 10, 12, 8, 50, 0);
  return evenements
    .map(([t, m]): [number, string] => [debut + t * 1000, m])
    .filter(([t]) => t < fin)
    .sort((a, b) => a[0] - b[0])
    .map(
      ([t, m]) =>
        `${new Date(t).toISOString().replace('T', ' ').slice(0, 19)},${String(100 + (t % 900)).slice(0, 3)} fail2ban.actions        [701]: NOTICE  [sshd] ${m}`,
    )
    .join('\n');
})();

// error.log de nginx : la limite de débit refuse le robot de l'agenda (et, parfois, d'autres).
const ERREURS = (() => {
  const qui: [string, number][] = [
    [ASPIRATEURS[0], 15],
    [ASPIRATEURS[1], 12],
    [ASPIRATEURS[2], 9],
    [RANIA, 6],
    [VISITEUR, 2],
  ];
  const lignes: string[] = [];
  let n = 18300;
  qui.forEach(([ip, fois], k) => {
    for (let i = 0; i < fois; i++) {
      const s = 10 + k * 7 + i * 3;
      const heure = `2026/11/11 ${String(20 + (Math.floor(s / 60) % 4)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`;
      const exces = (10 + ((i * 37 + k * 11) % 900) / 1000).toFixed(3);
      lignes.push(
        `${heure} [error] 702#702: *${n++} limiting requests, excess: ${exces} by zone "agenda", client: ${ip}, server: lettres.example, request: "GET /agenda/ HTTP/1.1", host: "lettres.example"`,
      );
    }
  });
  return lignes.sort().join('\n');
})();

const f2b = (j: Jeu) => j.etat.fail2ban as EtatFail2ban;
const prison = (j: Jeu, nom: string) => actives(f2b(j)).find((p) => p.nom === nom);
const banni = (j: Jeu, ip: string, nom: string) => !!prison(j, nom) && bannisDe(f2b(j), nom).includes(ip);
// recidive ne sert que si elle bannit plus longtemps que la prison sshd.
const plusLongue = (j: Jeu) => {
  const r = prison(j, 'recidive');
  const s = prison(j, 'sshd');
  return !!r && (r.bantime < 0 || (!!s && s.bantime >= 0 && r.bantime > s.bantime));
};
const epargnes = (j: Jeu) => [RANIA, VISITEUR, POSTE.adresse].every((ip) => actives(f2b(j)).every((p) => !bannisDe(f2b(j), p.nom).includes(ip)));
const reussi = (j: Jeu) =>
  RECIDIVISTES.every((ip) => banni(j, ip, 'recidive')) &&
  ASPIRATEURS.every((ip) => banni(j, ip, 'nginx-limit-req')) &&
  !!prison(j, 'sshd') &&
  plusLongue(j) &&
  epargnes(j);

const ECOUTE: Ecoute[] = [
  { proto: 'tcp', adresse: '0.0.0.0', port: 2222, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '[::]', port: 2222, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
];

export const recidive: Chapitre = {
  id: 'recidive',
  numero: 8,
  commandes: [
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
  maison: M,
  accueil: 'courriel_rania.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fourmis-2026',
  comptes: () => {
    const c = comptesParDefaut();
    c.groupes.adm = { gid: 4, membres: ['vous'] };
    return c;
  },
  etat: () => ({
    // SSH écoute sur 2222 depuis « Le port ».
    sshd: { charge: { port: '2222' }, recharges: 0 },
    ecoute: ECOUTE,
    ufw: {
      actif: true,
      entrant: 'deny',
      sortant: 'allow',
      regles: [
        { action: 'allow', vers: '2222/tcp', ports: [2222], de: null },
        { action: 'allow', vers: 'Nginx Full', ports: [80, 443], de: null },
      ],
    } satisfies PareFeu,
    fail2ban: { charge: null, bannis: [...RECIDIVISTES], totalBannis: 18, journal: [], chargements: 0, consulte: false } satisfies EtatFail2ban,
    systemd: nouveauSystemd('lettres', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 10, 12, 9, 0, 0), {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
      fail2ban: {
        description: 'Fail2Ban Service',
        active: true,
        executable: 'fail2ban-server',
        verifier: (j) => {
          const e = lireConfig(j).erreurs;
          return e.length ? e : null;
        },
        verifierAuRechargement: true,
        charger: (j) => {
          const etat = f2b(j);
          if (!etat) return;
          const { prison, prisons } = lireConfig(j);
          etat.charge = prison;
          etat.prisons = prisons;
          etat.chargements++;
          etat.consulte = false;
          appliquer(j, etat);
        },
      },
    }),
  }),
  initialiser: (j) => {
    const { prison, prisons } = lireConfig(j);
    f2b(j).charge = prison;
    f2b(j).prisons = prisons;
    systemd(j)!.horloge = Date.UTC(2026, 10, 12, 9, 0, 0);
  },
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    return d(
      {
        etc: d(
          {
            ...fichiersComptes(),
            fail2ban: d(
              {
                'jail.conf': f(JAIL_CONF_COMPLET, { lignes: true, proprio: 'root' }),
                'jail.d': d({ 'defaults-debian.conf': f(DEFAULTS_DEBIAN, { lignes: true, proprio: 'root' }) }, undefined, racine),
                'jail.local': f(JAIL_LOCAL, { lignes: true, proprio: 'root' }),
              },
              undefined,
              racine,
            ),
          },
          undefined,
          racine,
        ),
        home: d({ vous: d({ 'courriel_rania.txt': f(t('recidive-courriel-rania')) }) }, undefined, racine),
        var: d(
          {
            log: d(
              {
                'fail2ban.log': f((j) => [LOG, ...f2b(j).journal].join('\n'), { lignes: true, proprio: 'root', groupe: 'adm', mode: 'rw-r-----' }),
                nginx: d(
                  {
                    'error.log': f(ERREURS, { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
                    'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
                  },
                  undefined,
                  racine,
                ),
              },
              undefined,
              racine,
            ),
          },
          undefined,
          racine,
        ),
      },
      undefined,
      racine,
    );
  },
  evenements: [
    {
      id: 'jail-conf',
      condition: (j) => j.lire(`${DOSSIER}/jail.conf`) !== JAIL_CONF_COMPLET,
      message: (j) => j.t('sentinelle-evenement-jail-conf'),
    },
    {
      id: 'tout-active',
      condition: (j) => lireConfig(j).erreurs.some((e) => e.includes('Have not found any log file')),
      message: (j) => j.t('recidive-evenement-tout-active'),
    },
    { id: 'courte', condition: (j) => !!prison(j, 'recidive') && !plusLongue(j), message: (j) => j.t('recidive-evenement-courte') },
    { id: 'recidive', condition: (j) => RECIDIVISTES.some((ip) => banni(j, ip, 'recidive')), message: (j) => j.t('recidive-evenement-recidive') },
    { id: 'agenda', condition: (j) => ASPIRATEURS.some((ip) => banni(j, ip, 'nginx-limit-req')), message: (j) => j.t('recidive-evenement-agenda') },
    { id: 'fin', condition: (j) => reussi(j) && f2b(j).consulte, message: (j) => j.t('recidive-evenement-fin') },
  ],
};
