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

import { d, f, accountsFiles, accountsByDefault, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { machineName, WORKSTATION } from '../machines';
import { writeLog, newSystemd, systemd } from '../systemd';
import { readConfig as readSshd, portsSshd } from '../sshd';
import { apply, portBlocked, readConfig as readFail2ban, type Fail2banState } from '../fail2ban';
import { verdict, type Firewall } from '../firewall';
import { configuration } from '../access';
import type { Listening } from '../commands/ss';
import { JAIL_CONF } from './sentinel';

const M = '/home/you';
const NEW = 2222;
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

const HARDENING = 'PermitRootLogin no\nPasswordAuthentication no';

// Le fichier de Debian 12 (paquet fail2ban) et le jail.local de « La sentinelle ».
export const DEFAULTS_DEBIAN = `[DEFAULT]
banaction = nftables
banaction_allports = nftables[type=allports]

[sshd]
backend = systemd
enabled = true`;
const JAIL_LOCAL = `[DEFAULT]
bantime  = 1h
ignoreip = ${RANIA} ${WORKSTATION.address}`;

// La nuit : des robots, par centaines, sur le port 22.
const ROBOTS = ['203.0.113.66', '198.51.100.23', '192.0.2.200', '203.0.113.91', '198.51.100.77', '192.0.2.45'];
const NAMES = ['admin', 'oracle', 'ubuntu', 'test', 'git', 'pi', 'user', 'postgres', 'ftp', 'guest'];

const WEB_LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
];
const listening = (ports: number[]): Listening[] => [
  ...ports.flatMap((port): Listening[] => [
    { proto: 'tcp', address: '0.0.0.0', port, process: 'sshd', pid: 612 },
    { proto: 'tcp', address: '[::]', port, process: 'sshd', pid: 612 },
  ]),
  ...WEB_LISTENING,
];

interface SshdState {
  load: Record<string, string>;
  reloads: number;
}

const sshd = (j: Game) => j.state.sshd as SshdState;
const ports = (j: Game) => portsSshd(sshd(j).load);
const pf = (j: Game) => j.state.ufw as Firewall;
const f2b = (j: Game) => j.state.fail2ban as Fail2banState;
const workstation = (j: Game) => (j.state.poste as (() => Shell) | undefined)?.();
const open = (j: Game, port: number, source = INTERNET) => verdict(pf(j), port, source) === 'accepte';

// Un port où sshd écoute et que le pare-feu laisse passer depuis le poste.
const reachable = (j: Game) => ports(j).some((p) => open(j, p, WORKSTATION.address));
const moved = (j: Game) => ports(j).length === 1 && ports(j)[0] === NEW;
const dayAFirewall = (j: Game) => pf(j).enabled && open(j, NEW) && !open(j, 22);
const sentinel = (j: Game) => !!f2b(j).load?.enabled && portBlocked(f2b(j).load, NEW);
const dayAWorkstation = (j: Game) => {
  const p = workstation(j);
  return !!p && configuration(p, machineName(j.t, 'letters')).port?.[0] === String(NEW);
};

export const port: Chapter = {
  id: 'port',
  number: 7,
  commands: [
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
  home: M,
  welcome: 'email_kofi.txt',
  names: true,
  final: 'fin',
  password: 'ants-2026',
  watchesWorkstation: true,
  accounts: () => {
    const c = accountsByDefault();
    c.groups.adm = { gid: 4, members: ['you'] };
    return c;
  },
  state: () => ({
    sshd: { load: {}, reloads: 0 } satisfies SshdState,
    ecoute: listening([22]),
    ufw: {
      enabled: true,
      incoming: 'deny',
      outgoing: 'allow',
      rules: [
        { action: 'allow', to: 'OpenSSH', ports: [22], forEachOf: null },
        { action: 'allow', to: 'Nginx Full', ports: [80, 443], forEachOf: null },
      ],
    } satisfies Firewall,
    fail2ban: { load: null, banned: ROBOTS.slice(0, 2), bannedTotal: 214, log: [], loads: 0, consulted: false } satisfies Fail2banState,
    systemd: newSystemd('letters', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 10, 3, 8, 0, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        // Comme le service ssh de Debian : ExecReload vérifie d'abord (sshd -t).
        check: (j) => {
          const e = readSshd(j).errors;
          return e.length ? e : null;
        },
        checkToReload: true,
        load: (j) => {
          const s = sshd(j);
          if (!s) return;
          s.load = readSshd(j).values;
          s.reloads++;
          // sshd relancé rouvre ses sockets : il écoute sur les ports de la nouvelle configuration.
          j.state.ecoute = listening(ports(j));
          const sd = systemd(j)!;
          for (const p of ports(j)) {
            writeLog(sd, 'ssh.service', 'sshd', 612, `Server listening on 0.0.0.0 port ${p}.`);
            writeLog(sd, 'ssh.service', 'sshd', 612, `Server listening on :: port ${p}.`);
          }
        },
      },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
      fail2ban: {
        description: 'Fail2Ban Service',
        active: true,
        executable: 'fail2ban-server',
        check: (j) => {
          const e = readFail2ban(j).errors;
          return e.length ? e : null;
        },
        checkToReload: true,
        load: (j) => {
          const state = f2b(j);
          if (!state) return;
          state.load = readFail2ban(j).jail;
          state.loads++;
          state.consulted = false;
          apply(j, state);
        },
      },
    }),
  }),
  initialise: (j) => {
    sshd(j).load = readSshd(j).values;
    f2b(j).load = readFail2ban(j).jail;
    const sd = systemd(j)!;
    // Une nuit ordinaire : une tentative toutes les deux minutes, d'une demi-douzaine d'adresses.
    sd.clock = Date.UTC(2026, 10, 3, 0, 0, 0);
    for (let i = 0; i < 40; i++) {
      sd.clock += 127_000;
      const ip = ROBOTS[i % ROBOTS.length];
      const name = NAMES[(i * 7) % NAMES.length];
      writeLog(sd, 'ssh.service', 'sshd', 3000 + i * 5, `Invalid user ${name} from ${ip} port ${40000 + i * 37}`, 6, false);
      writeLog(
        sd,
        'ssh.service',
        'sshd',
        3000 + i * 5,
        `Connection closed by invalid user ${name} ${ip} port ${40000 + i * 37} [preauth]`,
        6,
        false,
      );
    }
    sd.clock = Date.UTC(2026, 10, 3, 8, 0, 0);
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    return d(
      {
        etc: d(
          {
            ...accountsFiles(),
            ssh: d(
              {
                sshd_config: f(SSHD_CONFIG, { lines: true, owner: 'root' }),
                'sshd_config.d': d({ '00-hardening.conf': f(HARDENING, { lines: true, owner: 'root' }) }, undefined, root),
              },
              undefined,
              root,
            ),
            fail2ban: d(
              {
                'jail.conf': f(JAIL_CONF, { lines: true, owner: 'root' }),
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
        home: d({ you: d({ 'email_kofi.txt': f(t('port-courriel-kofi', { port: String(NEW) })) }) }, undefined, root),
      },
      undefined,
      root,
    );
  },
  events: [
    { id: 'enferme', condition: (j) => !reachable(j), message: (j) => j.t('port-evenement-enferme') },
    {
      id: 'deux-ports',
      condition: (j) => ports(j).includes(22) && ports(j).includes(NEW) && open(j, NEW, WORKSTATION.address),
      message: (j) => j.t('port-evenement-deux-ports', { port: String(NEW) }),
    },
    { id: 'essai', condition: (j) => j.state.portSession === NEW, message: (j) => j.t('port-evenement-essai', { port: String(NEW) }) },
    {
      id: 'defaut',
      condition: (j) => /^\s*port\s*=\s*2222/m.test(j.read('/etc/fail2ban/jail.local') ?? '') && f2b(j).loads > 0 && !sentinel(j),
      message: (j) => j.t('port-evenement-defaut'),
    },
    { id: 'sentinelle', condition: (j) => moved(j) && !sentinel(j), message: (j) => j.t('port-evenement-sentinelle') },
    {
      id: 'fin',
      condition: (j) => moved(j) && dayAFirewall(j) && sentinel(j) && dayAWorkstation(j) && j.state.portSession === NEW,
      message: (j) => j.t('port-evenement-fin'),
    },
  ],
};
