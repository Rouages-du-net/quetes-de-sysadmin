// Ce que les chapitres de « La flotte » ont en commun : le poste de pilotage
// des maisons de quartier (pilote, 192.0.2.25), où Ansible est installé, et
// les trois serveurs des maisons de quartier (north, south, east, sur
// 10.30.0.0/24), joints en ssh avec le compte deploy (sudo sans mot de passe).
// Sources : https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html,
// https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html

import { d, f, accountsFiles, player, type Accounts, type Directory, type InternalHost, type Node } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { generateKey } from '../access';
import { readConfig } from '../sshd';
import { newSystemd, systemd } from '../systemd';
import { history } from '../commands/ansible';
import { hostKey } from '../machines';

export const M = '/home/you';
export const DIRECTORY = `${M}/ansible`;
export const CENTRES: Record<string, string> = { north: '10.30.0.11', south: '10.30.0.12', east: '10.30.0.13' };
export const NAMES = Object.keys(CENTRES);
const NOW = Date.UTC(2027, 8, 14, 9, 0, 0);

// La clé du compte vous sur pilote ; sa partie publique est dans ~deploy/.ssh/authorized_keys sur chaque centre.
export const KEY = generateKey('pilote-ansible', 'you@pilot');

export const HOSTS = `127.0.0.1\tlocalhost
192.0.2.25\tpilote.internal pilote
${NAMES.map((n) => `${CENTRES[n]}\t${n}.centres.internal ${n}`).join('\n')}`;

export const MOTD_DEBIAN = `
The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.`;

const SSHD_CONFIG = `# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#PermitRootLogin prohibit-password
#PubkeyAuthentication yes

# To disable tunneled clear text passwords, change to no here!
#PasswordAuthentication yes
#PermitEmptyPasswords no

KbdInteractiveAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem\tsftp\t/usr/lib/openssh/sftp-server`;

// Les paquets que le miroir Debian connaît (apt), et ceux déjà installés.
const REPO: Record<string, string> = { htop: '3.4.1-4', tree: '2.2.1-1', vim: '2:9.1.1230-2', curl: '8.14.1-2', nginx: '1.26.3-3', fail2ban: '1.1.0-8', chrony: '4.6.1-3', ncdu: '1.21-2' };
const INSTALLED: Record<string, string> = { curl: '8.14.1-2', 'openssh-server': '1:10.0p1-7', sudo: '1.9.16p2-3' };

const centreAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    deploy: { uid: 1001, group: 'deploy', home: '/home/deploy', shell: '/bin/bash' },
  },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['deploy'] }, deploy: { gid: 1001, members: [] } },
});

// Le service ssh d'un centre : sshd charge sa configuration au démarrage et au rechargement.
const serviceSsh = {
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  check: (j: Game) => {
    const e = readConfig(j).errors;
    return e.length ? e : null;
  },
  checkToReload: true,
  load: (j: Game) => {
    j.state.sshd = { ...(j.state.sshd ?? {}), load: readConfig(j).values };
  },
};

export interface CentreState {
  motd?: (t: Translate) => string;
  share?: boolean;
  packages?: string[];
  sshd?: string;
}

/** Un centre : son monde (comptes, sshd, la clé autorisée de deploy, motd), ses paquets et son ssh. */
export function centre(name: string, e: CentreState = {}): InternalHost {
  return {
    address: CENTRES[name],
    domain: `${name}.centres.internal`,
    accounts: centreAccounts,
    commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'mkdir', 'echo', 'sudo', 'systemctl', 'journalctl', 'sshd', 'id', 'whoami', 'exit', 'logout'],
    state: () => ({
      packages: { ...INSTALLED, ...Object.fromEntries((e.packages ?? []).map((p) => [p, REPO[p]])) },
      repo: REPO,
      sshd: { load: {} },
      systemd: newSystemd(name, NOW - 20 * 86_400_000, NOW, { ssh: serviceSsh }),
    }),
    initialise: (j) => serviceSsh.load(j),
    createWorld: (t) => {
      const root = { owner: 'root' };
      const file = (text: string) => f(text, { lines: true, owner: 'root' });
      return d(
        {
          etc: d(
            {
              ...accountsFiles(),
              hostname: file(name),
              hosts: file(HOSTS),
              motd: file(e.motd?.(t) ?? MOTD_DEBIAN),
              ssh: d({ sshd_config: file(e.sshd ?? SSHD_CONFIG), 'sshd_config.d': d({}, undefined, root) }, undefined, root),
              'sudoers.d': d({ deploy: f('deploy ALL=(ALL) NOPASSWD: ALL', { lines: true, owner: 'root', mode: 'r--r-----' }) }, undefined, root),
            },
            undefined,
            root,
          ),
          home: d(
            {
              deploy: d(
                { '.ssh': d({ authorized_keys: f(KEY.isPublic, { lines: true, owner: 'deploy', mode: 'rw-------' }) }, undefined, { owner: 'deploy', mode: 'rwx------' }) },
                undefined,
                { owner: 'deploy', mode: 'rwxr-xr-x' },
              ),
            },
            undefined,
            root,
          ),
          srv: d(e.share ? { shared: d({}, undefined, { owner: 'root', mode: 'rwxr-xr-x' }) } : {}, undefined, root),
        },
        undefined,
        root,
      );
    },
  };
}

export const pilotAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, theo: { uid: 1001, group: 'theo' } },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'theo'] },
    you: { gid: 1000, members: [] },
    theo: { gid: 1001, members: [] },
  },
});

export const pilotState = () => ({
  systemd: newSystemd('pilot', NOW - 30 * 86_400_000, NOW, {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
  }),
});

/** Le monde de pilote : /etc/hosts, la clé ssh de vous (et son known_hosts), ~/ansible, et Ansible. */
export function pilotWorld(t: Parameters<typeof player>[0], o: { known: string[]; ansible: Record<string, Node>; home: Record<string, Node> }): Directory {
  const root = { owner: 'root' };
  const binary = (size: number) => f('', { owner: 'root', mode: 'rwxr-xr-x', size });
  const isPrivate = { mode: 'rwx------' };
  const known = o.known.map((n) => `${n} ${hostKeyFor(n)}`).join('\n');
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: f('pilot', { lines: true, owner: 'root' }),
          hosts: f(HOSTS, { lines: true, owner: 'root' }),
          ansible: d({ 'ansible.cfg': f('# Since Ansible 2.12 (core):\n# To generate an example config file (a "disabled" one with all default settings, commented out):\n#               $ ansible-config init --disabled > ansible.cfg', { lines: true, owner: 'root' }) }, undefined, root),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d({
            '.ssh': d(
              {
                id_ed25519: f(KEY.isPrivate, { lines: true, mode: 'rw-------' }),
                'id_ed25519.pub': f(KEY.isPublic.replace('you@', `${player(t)}@`), { lines: true }),
                ...(known ? { known_hosts: f(known, { lines: true, mode: 'rw-------' }) } : {}),
              },
              undefined,
              isPrivate,
            ),
            ansible: d(o.ansible),
            ...o.home,
          }),
          theo: d({}, undefined, { owner: 'theo', mode: 'rwx------' }),
        },
        undefined,
        root,
      ),
      usr: d(
        { bin: d({ ansible: binary(5_412), 'ansible-playbook': binary(5_412), 'ansible-inventory': binary(5_412), 'ansible-doc': binary(5_412), python3: binary(6_830_640) }, undefined, root) },
        undefined,
        root,
      ),
    },
    undefined,
    root,
  );
}

// La clé d'hôte d'un centre, telle que known_hosts la garde (celle que connecterSansQuestion attend).
export const hostKeyFor = (name: string) => hostKey({ name, domain: `${name}.centres.internal`, address: CENTRES[name] }, '');

// ——— Ce que les chapitres vérifient ———

/** Une session sur un centre (créée à la première demande). */
export const onCentre = (j: Game, name: string) => (j as Shell).internal(name)!;

/** La dernière exécution complète (sans --check, sans --limit) d'un playbook. */
export function lastComplete(j: Game) {
  return [...history(j as Shell).executions].reverse().find((e) => !e.check && !e.limit && NAMES.every((n) => e.hosts[n]));
}

/** Idempotent : la dernière exécution complète n'a rien changé, rien raté, joint tout le monde. */
export const idempotent = (j: Game) => {
  const e = lastComplete(j);
  return !!e && NAMES.every((n) => e.hosts[n].changed === 0 && e.hosts[n].failed === 0 && e.hosts[n].unreachable === 0);
};

export const sdFor = (j: Game) => systemd(j)!;
