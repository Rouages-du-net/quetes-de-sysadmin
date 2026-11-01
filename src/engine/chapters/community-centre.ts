// Histoire « La Maison des associations » : ce que ses quatre chapitres ont
// en commun. La machine maison est la passerelle : seule joignable depuis
// internet, elle a le « vrai » ssh (acces.ts : clés, mot de passe,
// authorized_keys). Derrière elle, le réseau interne de la Maison :
// wiki (le wiki des associations) et archives (les sauvegardes), qu'on
// joint en rebondissant par maison (ssh -J, ProxyJump).
// Sources : https://man.openbsd.org/sshd_config, https://man.openbsd.org/ssh

import { d, f, accountsFiles, type Accounts, type Directory, type InternalHost, type Node } from '../world';
import { machineName } from '../machines';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { readConfig } from '../sshd';
import { internet, type ElementPlan } from '../plan';

export const M = '/home/you';
export const PASSWORD = 'lilac-2027';
// Lundi 4 octobre 2027, 18 h 40.
export const NOW = Date.UTC(2027, 9, 4, 18, 40, 0);

// sshd_config de Debian ; PasswordAuthentication donné en paramètre (null : la ligne commentée d'origine).
const sshdConfig = (passwords: 'yes' | 'no' | null) =>
  `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#ListenAddress 0.0.0.0

# Authentication:

#LoginGraceTime 2m
#PermitRootLogin prohibit-password
#MaxAuthTries 6

#PubkeyAuthentication yes

# To disable tunneled clear text passwords, change to no here!
${passwords ? `PasswordAuthentication ${passwords}` : '#PasswordAuthentication yes'}
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

export const HOSTS = `127.0.0.1\tlocalhost
192.0.2.19\tmaison.internal maison
10.20.0.11\twiki.community.internal wiki
10.20.0.12\tarchives.community.internal archives`;

export interface SshdState {
  load: Record<string, string>;
  // Connexions par clé reçues au moment du dernier chargement (se reconnecter après).
  keysToLoad: number;
  reloads: number;
}
export const sshd = (j: Game) => j.state.sshd as SshdState;
export const connectionsBy = (j: Game, comment: 'key' | 'password') => (j.state.sshConnections?.[comment] as number | undefined) ?? 0;

// Le service ssh, comme celui de Debian : ExecReload vérifie d'abord (sshd -t).
const serviceSsh = (): DefinitionService => ({
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  process: [{ pid: 588, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  check: (j) => {
    const e = readConfig(j).errors;
    return e.length ? e : null;
  },
  checkToReload: true,
  load: (j) => {
    const c = sshd(j);
    if (!c) return;
    c.load = readConfig(j).values;
    c.keysToLoad = connectionsBy(j, 'key');
    c.reloads++;
  },
});

/** L'état de maison : le vrai ssh, sshd et systemd (plus les services du chapitre). */
export const homeState = (services: Record<string, DefinitionService> = {}, more: Record<string, unknown> = {}) => ({
  realSsh: true,
  sshd: { load: {}, keysToLoad: 0, reloads: 0 },
  systemd: newSystemd('community', NOW - 9 * 86_400_000, NOW, { ssh: serviceSsh(), ...services }),
  ...more,
});

/** Au démarrage : sshd charge sa configuration. */
export const loadSshd = (j: Game) => {
  sshd(j).load = readConfig(j).values;
};

export const homeAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, yasmine: { uid: 1001, group: 'yasmine' } },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'yasmine'] },
    sudo: { gid: 27, members: ['you', 'yasmine'] },
    you: { gid: 1000, members: [] },
    yasmine: { gid: 1001, members: [] },
  },
});

const root = { owner: 'root' };
const isPrivate = { mode: 'rwx------' };

/** Le dossier ~/.ssh de vous (vide, ou avec ces fichiers). */
export const sshDirectory = (files: Record<string, Node> = {}) => d(files, undefined, isPrivate);

/** Le monde de maison : /etc (comptes, hosts, ssh), la maison de vous, et le reste du chapitre. */
export function homeWorld(o: { passwords: 'yes' | 'no' | null; home: Record<string, Node>; more?: Record<string, Node> }): Directory {
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: f('community', { lines: true, owner: 'root' }),
          hosts: f(HOSTS, { lines: true, owner: 'root' }),
          ssh: d(
            { sshd_config: f(sshdConfig(o.passwords), { lines: true, owner: 'root' }), 'sshd_config.d': d({}, undefined, root) },
            undefined,
            root,
          ),
        },
        undefined,
        root,
      ),
      home: d({ you: d(o.home), yasmine: d({}, undefined, { owner: 'yasmine', mode: 'rwx------' }) }, undefined, root),
      ...(o.more ?? {}),
    },
    undefined,
    root,
  );
}

// ——— Le réseau interne ———

const internalAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] } },
});

/** Une machine interne : son nom, son adresse, ce qu'il y a dans sa maison et ailleurs. */
export function internalHost(
  name: string,
  address: string,
  o: {
    home?: (t: Translate) => Record<string, Node>;
    more?: (t: Translate) => Record<string, Node>;
    state?: (t: Translate) => Record<string, unknown>;
    initialise?: (j: Game) => void;
    commands?: string[];
  } = {},
): InternalHost {
  return {
    address,
    domain: `${name}.community.internal`,
    accounts: internalAccounts,
    commands: o.commands,
    state: o.state,
    initialise: o.initialise,
    createWorld: (t) =>
      d(
        {
          etc: d(
            { ...accountsFiles(), hostname: f(name, { lines: true, owner: 'root' }), hosts: f(HOSTS, { lines: true, owner: 'root' }) },
            undefined,
            root,
          ),
          home: d({ you: d({ '.ssh': sshDirectory(), ...(o.home?.(t) ?? {}) }) }, undefined, root),
          ...(o.more?.(t) ?? {}),
        },
        undefined,
        root,
      ),
  };
}

export const sd = (j: Game) => systemd(j)!;

/** Le plan du réseau de la Maison : la passerelle, et derrière elle le wiki et les archives ; l'hébergeur du site, sur internet. */
export const homePlan =
  (o: { host?: boolean } = {}) =>
  (t: Translate): ElementPlan =>
    internet(
      t,
      {
        role: 'router',
        name: machineName(t, 'community'),
        address: '192.0.2.19',
        note: t('plan-note-gateway'),
        host: 'community',
        children: [
          {
            role: 'network',
            name: t('plan-network-internal'),
            address: '10.20.0.0/24',
            children: [
              { role: 'server', name: 'wiki', address: '10.20.0.11', note: t('plan-note-wiki'), host: 'wiki' },
              { role: 'server', name: 'archives', address: '10.20.0.12', note: t('plan-note-archives'), host: 'archives' },
            ],
          },
        ],
      },
      ...(o.host ? [{ role: 'server' as const, name: 'ftp.hosting.example', address: '203.0.113.80', note: t('plan-note-host') }] : []),
    );
