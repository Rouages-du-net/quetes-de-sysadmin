// Histoire « Les Lettres du quartier » — chapitre « Fermer la porte » :
// durcir SSH sur un serveur tout neuf, attaqué par force brute. Désactiver
// la connexion en root et les mots de passe (sshd_config), vérifier avec
// sshd -t, recharger ssh, puis se reconnecter pour prouver qu'on ne s'est
// pas enfermé dehors.
// Pièges réels : l'Include de Debian en tête de sshd_config (le fichier
// 50-cloud-init.conf garde PasswordAuthentication yes : la première valeur
// lue l'emporte), une faute de frappe (sshd -t ; reload refuse et garde
// l'ancienne configuration), un AllowUsers qui oublie son propre compte.
// Sources : https://man.openbsd.org/sshd_config, https://man.openbsd.org/sshd

import { accountsByDefault, d, f, accountsFiles, player, type Chapter } from '../world';
import type { Game } from '../shell';
import { publicKey, storyMachine, machineName } from '../machines';
import { writeLog, newSystemd, systemd } from '../systemd';
import { allowed, CONFIG, readConfig } from '../sshd';

const M = '/home/vous';
const SSH = 'OpenBSD Secure Shell server';

// sshd_config de Debian, modifié par l'hébergeur (PermitRootLogin yes).
const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

# The strategy used for options in the default sshd_config shipped with
# OpenSSH is to specify options with their default value where
# possible, but leave them commented.  Uncommented options override the
# default value.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#ListenAddress 0.0.0.0

# Authentication:

#LoginGraceTime 2m
PermitRootLogin yes
#MaxAuthTries 6

#PubkeyAuthentication yes

# To disable tunneled clear text passwords, change to no here!
#PasswordAuthentication yes
#PermitEmptyPasswords no

KbdInteractiveAuthentication no

UsePAM yes

X11Forwarding yes
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

const CLOUD_INIT = 'PasswordAuthentication yes';

// Les tentatives de force brute de la nuit, dans le journal de ssh.
const ATTACKS: [string, number, string][] = [
  ['203.0.113.66', 51022, 'Failed password for root from 203.0.113.66 port 51022 ssh2'],
  ['198.51.100.23', 40112, 'Invalid user admin from 198.51.100.23 port 40112'],
  ['198.51.100.23', 40112, 'Failed password for invalid user admin from 198.51.100.23 port 40112 ssh2'],
  ['203.0.113.66', 51088, 'Failed password for root from 203.0.113.66 port 51088 ssh2'],
  ['192.0.2.200', 33870, 'Invalid user test from 192.0.2.200 port 33870'],
  ['192.0.2.200', 33870, 'Failed password for invalid user test from 192.0.2.200 port 33870 ssh2'],
  ['203.0.113.66', 51141, 'Failed password for root from 203.0.113.66 port 51141 ssh2'],
  ['198.51.100.23', 40177, 'Invalid user ubuntu from 198.51.100.23 port 40177'],
  ['198.51.100.23', 40177, 'Failed password for invalid user ubuntu from 198.51.100.23 port 40177 ssh2'],
  ['203.0.113.66', 51202, 'Failed password for root from 203.0.113.66 port 51202 ssh2'],
];

const config = (j: Game) => j.state.sshd as { load: Record<string, string>; connectionsToLoad: number; reloads: number };
const closed = (v: Record<string, string>) => v.permitrootlogin === 'no' && v.passwordauthentication === 'no';

export const door: Chapter = {
  id: 'fermer-la-porte',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'chmod', 'nano', 'sudo', 'systemctl', 'journalctl', 'sshd'],
  home: M,
  welcome: 'courriel_kofi.txt',
  names: true,
  final: 'fin',
  password: 'fourmis-2026',
  accounts: () => {
    const c = accountsByDefault();
    c.groups.adm = { gid: 4, members: ['vous'] };
    return c;
  },
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    systemd: newSystemd('lettres', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 9, 20, 9, 15, 0), {
      ssh: {
        description: SSH,
        active: true,
        executable: 'sshd',
        process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        // Comme le service ssh de Debian : ExecReload vérifie d'abord (sshd -t).
        check: (j) => {
          const e = readConfig(j).errors;
          return e.length ? e : null;
        },
        checkToReload: true,
        load: (j) => {
          const c = config(j);
          if (!c) return;
          c.load = readConfig(j).values;
          c.connectionsToLoad = j.state.connexions ?? 1;
          c.reloads++;
          // Les robots reviennent… et se font éconduire avant même d'essayer un mot de passe.
          if (closed(c.load)) {
            const sd = systemd(j)!;
            writeLog(sd, 'ssh.service', 'sshd', 2690, 'Connection closed by authenticating user root 203.0.113.66 port 51533 [preauth]');
            writeLog(sd, 'ssh.service', 'sshd', 2694, 'Connection closed by invalid user admin 198.51.100.23 port 40877 [preauth]');
          }
        },
      },
    }),
  }),
  // La configuration chargée au démarrage du serveur, et les attaques de la nuit.
  initialise: (j) => {
    config(j).load = readConfig(j).values;
    const sd = systemd(j)!;
    sd.clock = Date.UTC(2026, 9, 20, 3, 0, 0);
    ATTACKS.forEach(([, , message], i) => {
      sd.clock += 37_000;
      writeLog(sd, 'ssh.service', 'sshd', 1800 + i * 3, message, 6, false);
    });
    sd.clock = Date.UTC(2026, 9, 20, 9, 15, 0);
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const letters = storyMachine('lettres')!;
    return d(
      {
        etc: d(
          {
            ...accountsFiles(),
            ssh: d(
              {
                sshd_config: f(SSHD_CONFIG, { lines: true, owner: 'root' }),
                'sshd_config.d': d({ '50-cloud-init.conf': f(CLOUD_INIT, { lines: true, owner: 'root' }) }, undefined, root),
              },
              undefined,
              root,
            ),
          },
          undefined,
          root,
        ),
        home: d(
          {
            vous: d({
              'courriel_kofi.txt': f(t('porte-courriel-kofi')),
              '.ssh': d({ authorized_keys: f(publicKey(letters, player(t), machineName(t, 'poste')), { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
            }),
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
      id: 'erreur',
      condition: (j) => readConfig(j).errors.length > 0,
      message: (j) => j.t('porte-evenement-erreur', { config: CONFIG }),
    },
    {
      id: 'enferme',
      condition: (j) => !allowed(config(j).load, j.player),
      message: (j) => j.t('porte-evenement-enferme'),
    },
    {
      id: 'sans-effet',
      condition: (j) =>
        config(j).reloads > 0 &&
        config(j).load.passwordauthentication === 'yes' &&
        /^\s*PasswordAuthentication\s+no\b/im.test(j.read(CONFIG) ?? ''),
      message: (j) => j.t('porte-evenement-sans-effet'),
    },
    {
      id: 'fermee',
      condition: (j) => closed(config(j).load) && allowed(config(j).load, j.player),
      message: (j) => j.t('porte-evenement-fermee'),
    },
    {
      id: 'fin',
      condition: (j) =>
        j.flags.has('fermee') &&
        closed(config(j).load) &&
        allowed(config(j).load, j.player) &&
        (j.state.connexions ?? 1) > config(j).connectionsToLoad,
      message: (j) => j.t('porte-evenement-fin'),
    },
  ],
};
