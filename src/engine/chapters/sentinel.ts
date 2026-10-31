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

import { d, f, fichiersComptes, comptesParDefaut, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { POSTE } from '../machines';
import { journaliser, nouveauSystemd, systemd } from '../systemd';
import { appliquer, couvre, DOSSIER, lireConfig, noter, type EtatFail2ban } from '../fail2ban';
import { instants } from '../activity';

const M = '/home/vous';
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
const ECHECS = (joueur: string): [string, string][] => [
  ...[51234, 51240, 51251].map((p): [string, string] => [POSTE.adresse, `Failed publickey for ${joueur} from ${POSTE.adresse} port ${p} ssh2`]),
  ...['oracle', 'git', 'admin', 'test', 'oracle', 'pi', 'git'].map((u, i): [string, string] => ['203.0.113.66', `Invalid user ${u} from 203.0.113.66 port ${40100 + i}`]),
  ...['admin', 'user', 'admin', 'ftp', 'guest', 'admin'].map((u, i): [string, string] => ['198.51.100.23', `Invalid user ${u} from 198.51.100.23 port ${33800 + i}`]),
  ...[50211, 50214, 50219, 50223, 50230].map((p): [string, string] => [RANIA, `Invalid user ranja from ${RANIA} port ${p}`]),
];

const f2b = (j: Jeu) => j.etat.fail2ban as EtatFail2ban;

// Les robots ne s'arrêtent pas pendant qu'on joue : chacun retente sa chance
// à son rythme, avec un nom au hasard de sa liste. Banni, il ne passe plus
// (le pare-feu le rejette avant sshd) ; à la fin du bantime, fail2ban le
// relâche et il recommence (« ils reviennent toutes les dix minutes »).
const EN_DIRECT = [
  { ip: ROBOTS[0], periode: 20, comptes: ['root', 'admin', 'oracle', 'postgres', 'ubuntu', 'git'] },
  { ip: ROBOTS[1], periode: 12, comptes: ['admin', 'test', 'user', 'ftp', 'guest'] },
];
// Le bruit de fond d'internet : des scanners qui essaient un ou deux noms puis
// passent à une autre cible (trop peu pour fail2ban). Adresses de documentation.
const SCANNERS = ['203.0.113.', '192.0.2.', '198.51.100.'];
const COMPTES_COURANTS = ['root', 'admin', 'pi', 'oracle', 'test', 'ubuntu', 'support', 'user'];
const scanner = (n: number) => `${SCANNERS[n % 3]}${150 + ((n * 37) % 50)}`;
// Depuis quand chaque robot est banni (pour le relâcher à la fin du bantime).
const depuis = (j: Jeu): Record<string, number> => (j.etat.bannisDepuis ??= {}) as Record<string, number>;

function relacher(j: Jeu, t: number) {
  const etat = f2b(j);
  const bantime = etat.charge?.bantime ?? 600;
  for (const ip of ROBOTS) {
    if (!etat.bannis.includes(ip)) continue;
    const debut = (depuis(j)[ip] ??= t);
    if (bantime < 0 || t - debut < bantime * 1000) continue;
    etat.bannis.splice(etat.bannis.indexOf(ip), 1);
    (etat.remis ??= {})[ip] = t;
    delete depuis(j)[ip];
    systemd(j)!.horloge = t;
    noter(j, etat, `Unban ${ip}`);
  }
}

function robotsEnDirect(j: Jeu, de: number, a: number) {
  const sd = systemd(j)!;
  const etat = f2b(j);
  const veille = () => sd.services.fail2ban?.etat === 'active' && !!etat.charge?.enabled;
  // Un scanner toutes les 9 s, deux essais chacun (le second 9 s après le premier).
  const scanners = instants(de, a, 9).map((t) => {
    const k = Math.floor(t / 9000);
    const n = Math.floor(k / 2);
    return { t, r: { ip: scanner(n), periode: 9, comptes: [COMPTES_COURANTS[(n + (k % 2)) % COMPTES_COURANTS.length]] } };
  });
  const essais = [...EN_DIRECT.flatMap((r) => instants(de, a, r.periode).map((t) => ({ t, r }))), ...scanners].sort((x, y) => x.t - y.t);
  for (const { t, r } of essais) {
    sd.horloge = t;
    if (veille()) relacher(j, t);
    if (etat.bannis.includes(r.ip)) continue;
    const n = Math.floor(t / (r.periode * 1000));
    journaliser(sd, 'ssh.service', 'sshd', 3100 + (n % 60), `Invalid user ${r.comptes[n % r.comptes.length]} from ${r.ip} port ${40000 + (n % 20000)}`, 6, false);
    if (!veille()) continue;
    appliquer(j, etat, r.ip);
    for (const ip of ROBOTS) if (etat.bannis.includes(ip)) depuis(j)[ip] ??= t;
  }
  if (veille()) relacher(j, a);
}
const ignore = (j: Jeu, ip: string) => f2b(j).charge?.ignoreip.some((e) => couvre(e, ip)) ?? false;
const reglee = (j: Jeu) => {
  const p = f2b(j).charge;
  return !!p && p.enabled && (p.bantime >= 3600 || p.bantime < 0) && ignore(j, RANIA) && ignore(j, POSTE.adresse);
};
const bansJustes = (j: Jeu) => !f2b(j).bannis.includes(RANIA) && !f2b(j).bannis.includes(POSTE.adresse) && ROBOTS.every((r) => f2b(j).bannis.includes(r));

export const sentinelle: Chapitre = {
  id: 'sentinelle',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'fail2ban-client'],
  maison: M,
  accueil: 'courriel_kofi.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fourmis-2026',
  comptes: () => {
    const c = comptesParDefaut();
    c.groupes.adm = { gid: 4, membres: ['vous'] };
    return c;
  },
  activite: { pas: 15, avancer: robotsEnDirect },
  etat: () => ({
    // Le second robot vient d'être relâché (09:35) : il recommence pendant qu'on joue, et fail2ban le rattrape.
    fail2ban: { charge: null, bannis: [ROBOTS[0], RANIA], totalBannis: 6, journal: [], chargements: 0, consulte: false, remis: { [ROBOTS[1]]: Date.UTC(2026, 9, 22, 9, 35, 40) } } satisfies EtatFail2ban,
    systemd: nouveauSystemd('lettres', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 9, 22, 6, 0, 0), {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
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
          etat.charge = lireConfig(j).prison;
          etat.chargements++;
          etat.consulte = false;
          appliquer(j, etat);
        },
      },
    }),
  }),
  initialiser: (j) => {
    f2b(j).charge = lireConfig(j).prison;
    const sd = systemd(j)!;
    ECHECS(j.joueur).forEach(([, message], i) => journaliser(sd, 'ssh.service', 'sshd', 1900 + i * 4, message, 6, true));
    sd.horloge = Date.UTC(2026, 9, 22, 9, 40, 0);
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
                'jail.conf': f(JAIL_CONF, { lignes: true, proprio: 'root' }),
                'jail.d': d({ 'defaults-debian.conf': f('[sshd]\nenabled = true', { lignes: true, proprio: 'root' }) }, undefined, racine),
              },
              undefined,
              racine,
            ),
          },
          undefined,
          racine,
        ),
        home: d({ vous: d({ 'courriel_kofi.txt': f(t('sentinelle-courriel-kofi')) }) }, undefined, racine),
        var: d(
          {
            log: d(
              { 'fail2ban.log': f((j) => [LOG, ...f2b(j).journal].join('\n'), { lignes: true, proprio: 'root', groupe: 'adm', mode: 'rw-r-----' }) },
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
      condition: (j) => j.lire(`${DOSSIER}/jail.conf`) !== JAIL_CONF,
      message: (j) => j.t('sentinelle-evenement-jail-conf'),
    },
    {
      id: 'erreur',
      condition: (j) => lireConfig(j).erreurs.length > 0,
      message: (j) => j.t('sentinelle-evenement-erreur'),
    },
    {
      id: 'rania',
      condition: (j) => !f2b(j).bannis.includes(RANIA),
      message: (j) => j.t('sentinelle-evenement-rania'),
    },
    {
      id: 'banni-soi',
      condition: (j) => f2b(j).bannis.includes(POSTE.adresse),
      message: (j) => j.t('sentinelle-evenement-banni-soi', { adresse: POSTE.adresse }),
    },
    {
      id: 'reglee',
      condition: (j) => reglee(j) && f2b(j).chargements > 0,
      message: (j) => j.t('sentinelle-evenement-reglee'),
    },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('reglee') && reglee(j) && bansJustes(j) && f2b(j).consulte,
      message: (j) => j.t('sentinelle-evenement-fin'),
    },
  ],
};
