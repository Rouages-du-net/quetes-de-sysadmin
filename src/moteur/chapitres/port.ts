// Histoire « Les Lettres du quartier » — chapitre « Le port » : déplacer SSH
// du port 22 au port 2222, sans s'enfermer dehors. Le journal de ssh déborde
// de robots ; Rania propose de changer de port. Trois portes à ouvrir dans le
// bon ordre (sshd, ufw, le ~/.ssh/config du poste), et une sentinelle à
// prévenir : la prison sshd de fail2ban ne garde que le port « ssh » (22).
// Démarche sûre : écouter sur les deux ports, autoriser 2222 dans ufw,
// tester depuis le poste, puis seulement fermer le 22.
// Pièges réels : un port retiré de sshd avant d'être ouvert dans ufw ; un
// « port = 2222 » mis dans le [DEFAULT] de jail.local, que le
// « port = ssh » du [sshd] de jail.conf continue d'emporter.
// En prime : ufw n'est qu'une façade ; sudo nft list ruleset montre les
// règles qu'il écrit, et la table de fail2ban (../apercu-nft.ts).
// Objectif vérifié sur l'état : sshd n'écoute que sur 2222 ; ufw laisse
// passer 2222 et plus 22 ; la prison sshd bloque le port 2222 ; le poste se
// connecte sur 2222 grâce à son ~/.ssh/config.
// Sources : https://man.openbsd.org/sshd_config#Port,
// https://man.openbsd.org/ssh_config#Port,
// https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html,
// https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html

import { d, f, fichiersComptes, comptesParDefaut, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { POSTE } from '../machines';
import { journaliser, nouveauSystemd, systemd } from '../systemd';
import { lireConfig as lireSshd, portsSshd } from '../sshd';
import { appliquer, bloquePort, lireConfig as lireFail2ban, type EtatFail2ban } from '../fail2ban';
import { verdict, type PareFeu } from '../parefeu';
import { configuration } from '../acces';
import type { Ecoute } from '../commandes/ss';
import { JAIL_CONF } from './sentinelle';

const M = '/home/vous';
const NOUVEAU = 2222;
const RANIA = '198.51.100.40';
// Une adresse quelconque d'internet.
const INTERNET = '203.0.113.200';

// sshd_config de Debian (l'Include en tête, le port commenté).
const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

# The strategy used for options in the default sshd_config shipped with
# OpenSSH is to specify options with their default value where
# possible, but leave them commented.  Uncommented options override the
# default value.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#AddressFamily any
#ListenAddress 0.0.0.0
#ListenAddress ::

#LoginGraceTime 2m
#PermitRootLogin prohibit-password
#MaxAuthTries 6

KbdInteractiveAuthentication no

UsePAM yes

X11Forwarding yes
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

const DURCISSEMENT = 'PermitRootLogin no\nPasswordAuthentication no';

// Le fichier de Debian 12 (paquet fail2ban) et le jail.local de « La sentinelle ».
export const DEFAULTS_DEBIAN = `[DEFAULT]
banaction = nftables
banaction_allports = nftables[type=allports]

[sshd]
backend = systemd
enabled = true`;
const JAIL_LOCAL = `[DEFAULT]
bantime  = 1h
ignoreip = ${RANIA} ${POSTE.adresse}`;

// La nuit : des robots, par centaines, sur le port 22.
const ROBOTS = ['203.0.113.66', '198.51.100.23', '192.0.2.200', '203.0.113.91', '198.51.100.77', '192.0.2.45'];
const NOMS = ['admin', 'oracle', 'ubuntu', 'test', 'git', 'pi', 'user', 'postgres', 'ftp', 'guest'];

const ECOUTE_WEB: Ecoute[] = [
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
];
const ecoute = (ports: number[]): Ecoute[] => [
  ...ports.flatMap((port): Ecoute[] => [
    { proto: 'tcp', adresse: '0.0.0.0', port, processus: 'sshd', pid: 612 },
    { proto: 'tcp', adresse: '[::]', port, processus: 'sshd', pid: 612 },
  ]),
  ...ECOUTE_WEB,
];

interface EtatSshd {
  charge: Record<string, string>;
  recharges: number;
}

const sshd = (j: Jeu) => j.etat.sshd as EtatSshd;
const ports = (j: Jeu) => portsSshd(sshd(j).charge);
const pf = (j: Jeu) => j.etat.ufw as PareFeu;
const f2b = (j: Jeu) => j.etat.fail2ban as EtatFail2ban;
const poste = (j: Jeu) => (j.etat.poste as (() => Shell) | undefined)?.();
const ouvert = (j: Jeu, port: number, source = INTERNET) => verdict(pf(j), port, source) === 'accepte';

// Un port où sshd écoute et que le pare-feu laisse passer depuis le poste.
const joignable = (j: Jeu) => ports(j).some((p) => ouvert(j, p, POSTE.adresse));
const deplace = (j: Jeu) => ports(j).length === 1 && ports(j)[0] === NOUVEAU;
const pareFeuAJour = (j: Jeu) => pf(j).actif && ouvert(j, NOUVEAU) && !ouvert(j, 22);
const sentinelle = (j: Jeu) => !!f2b(j).charge?.enabled && bloquePort(f2b(j).charge, NOUVEAU);
const posteAJour = (j: Jeu) => {
  const p = poste(j);
  return !!p && configuration(p, 'lettres').port?.[0] === String(NOUVEAU);
};

export const port: Chapitre = {
  id: 'port',
  numero: 7,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'id',
    'whoami',
    'nano',
    'sudo',
    'systemctl',
    'journalctl',
    'sshd',
    'ss',
    'ufw',
    'fail2ban-client',
    'nft',
  ],
  maison: M,
  accueil: 'courriel_kofi.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fourmis-2026',
  surveillePoste: true,
  comptes: () => {
    const c = comptesParDefaut();
    c.groupes.adm = { gid: 4, membres: ['vous'] };
    return c;
  },
  etat: () => ({
    sshd: { charge: {}, recharges: 0 } satisfies EtatSshd,
    ecoute: ecoute([22]),
    ufw: {
      actif: true,
      entrant: 'deny',
      sortant: 'allow',
      regles: [
        { action: 'allow', vers: 'OpenSSH', ports: [22], de: null },
        { action: 'allow', vers: 'Nginx Full', ports: [80, 443], de: null },
      ],
    } satisfies PareFeu,
    fail2ban: { charge: null, bannis: ROBOTS.slice(0, 2), totalBannis: 214, journal: [], chargements: 0, consulte: false } satisfies EtatFail2ban,
    systemd: nouveauSystemd('lettres', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 10, 3, 8, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        // Comme le service ssh de Debian : ExecReload vérifie d'abord (sshd -t).
        verifier: (j) => {
          const e = lireSshd(j).erreurs;
          return e.length ? e : null;
        },
        verifierAuRechargement: true,
        charger: (j) => {
          const s = sshd(j);
          if (!s) return;
          s.charge = lireSshd(j).valeurs;
          s.recharges++;
          // sshd relancé rouvre ses sockets : il écoute sur les ports de la nouvelle configuration.
          j.etat.ecoute = ecoute(ports(j));
          const sd = systemd(j)!;
          for (const p of ports(j)) {
            journaliser(sd, 'ssh.service', 'sshd', 612, `Server listening on 0.0.0.0 port ${p}.`);
            journaliser(sd, 'ssh.service', 'sshd', 612, `Server listening on :: port ${p}.`);
          }
        },
      },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
      fail2ban: {
        description: 'Fail2Ban Service',
        active: true,
        executable: 'fail2ban-server',
        verifier: (j) => {
          const e = lireFail2ban(j).erreurs;
          return e.length ? e : null;
        },
        verifierAuRechargement: true,
        charger: (j) => {
          const etat = f2b(j);
          if (!etat) return;
          etat.charge = lireFail2ban(j).prison;
          etat.chargements++;
          etat.consulte = false;
          appliquer(j, etat);
        },
      },
    }),
  }),
  initialiser: (j) => {
    sshd(j).charge = lireSshd(j).valeurs;
    f2b(j).charge = lireFail2ban(j).prison;
    const sd = systemd(j)!;
    // Une nuit ordinaire : une tentative toutes les deux minutes, d'une demi-douzaine d'adresses.
    sd.horloge = Date.UTC(2026, 10, 3, 0, 0, 0);
    for (let i = 0; i < 40; i++) {
      sd.horloge += 127_000;
      const ip = ROBOTS[i % ROBOTS.length];
      const nom = NOMS[(i * 7) % NOMS.length];
      journaliser(sd, 'ssh.service', 'sshd', 3000 + i * 5, `Invalid user ${nom} from ${ip} port ${40000 + i * 37}`, 6, false);
      journaliser(
        sd,
        'ssh.service',
        'sshd',
        3000 + i * 5,
        `Connection closed by invalid user ${nom} ${ip} port ${40000 + i * 37} [preauth]`,
        6,
        false,
      );
    }
    sd.horloge = Date.UTC(2026, 10, 3, 8, 0, 0);
  },
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    return d(
      {
        etc: d(
          {
            ...fichiersComptes(),
            ssh: d(
              {
                sshd_config: f(SSHD_CONFIG, { lignes: true, proprio: 'root' }),
                'sshd_config.d': d({ '00-durcissement.conf': f(DURCISSEMENT, { lignes: true, proprio: 'root' }) }, undefined, racine),
              },
              undefined,
              racine,
            ),
            fail2ban: d(
              {
                'jail.conf': f(JAIL_CONF, { lignes: true, proprio: 'root' }),
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
        home: d({ vous: d({ 'courriel_kofi.txt': f(t('port-courriel-kofi', { port: String(NOUVEAU) })) }) }, undefined, racine),
      },
      undefined,
      racine,
    );
  },
  evenements: [
    { id: 'enferme', condition: (j) => !joignable(j), message: (j) => j.t('port-evenement-enferme') },
    {
      id: 'deux-ports',
      condition: (j) => ports(j).includes(22) && ports(j).includes(NOUVEAU) && ouvert(j, NOUVEAU, POSTE.adresse),
      message: (j) => j.t('port-evenement-deux-ports', { port: String(NOUVEAU) }),
    },
    { id: 'essai', condition: (j) => j.etat.portSession === NOUVEAU, message: (j) => j.t('port-evenement-essai', { port: String(NOUVEAU) }) },
    {
      id: 'defaut',
      condition: (j) => /^\s*port\s*=\s*2222/m.test(j.lire('/etc/fail2ban/jail.local') ?? '') && f2b(j).chargements > 0 && !sentinelle(j),
      message: (j) => j.t('port-evenement-defaut'),
    },
    { id: 'sentinelle', condition: (j) => deplace(j) && !sentinelle(j), message: (j) => j.t('port-evenement-sentinelle') },
    {
      id: 'fin',
      condition: (j) => deplace(j) && pareFeuAJour(j) && sentinelle(j) && posteAJour(j) && j.etat.portSession === NOUVEAU,
      message: (j) => j.t('port-evenement-fin'),
    },
  ],
};
