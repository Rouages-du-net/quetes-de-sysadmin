// Histoire « L'Audit » : ce que ses chapitres ont en commun. Le serveur du
// Fournil (machine fournil), la boulangerie de Nadia qui prend ses commandes
// en ligne : un nginx, une appli de commandes (un compte de service), une base
// PostgreSQL et un Redis. Salomé, auditrice indépendante, a passé le serveur au
// crible et laisse un rapport : chaque chapitre en traite une partie. Les
// exemples restent défensifs : on lit le rapport, on vérifie, on répare.

import { d, f, accountsFiles, player, type Accounts, type Directory, type Node } from '../world';
import { generateKey } from '../access';
import { publicKey, storyMachine, machineName } from '../machines';
import { writeLog, systemd, type DefinitionService } from '../systemd';
import { readConfig } from '../sshd';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import type { ScanState, ScanHost, ServiceScan } from '../scan';
import type { Listening } from '../commands/ss';
import { BASE_INSTALLED, PACKAGES, type AptState } from '../commands/apt';
import { SUDOERS } from './coop';

export const M = '/home/vous';
export const PASSWORD = 'farine-2028';
// Mardi 14 mars 2028, 9 h 30.
export const NOW = Date.UTC(2028, 2, 14, 9, 30, 0);
// Une adresse quelconque d'internet (RFC 5737).
export const INTERNET = '198.51.100.23';

// Les clés publiques (fausses, de la bonne forme).
export const KEYS = {
  nadia: generateKey('audit-nadia', 'nadia@boutique').isPublic,
  lucas: generateKey('audit-lucas', 'lucas@portable').isPublic,
  // Une clé qui se fait passer pour une clé de Nadia : seule son empreinte la trahit.
  unknown: generateKey('audit-inconnue', 'nadia@portable').isPublic,
};

// Les comptes : Nadia (la gérante), Lucas (le stagiaire, parti fin février) et
// commandes, le compte de service de l'appli.
export const bakeryAccounts = (withLucas = true): Accounts => {
  const c: Accounts = {
    users: {
      root: { uid: 0, group: 'root', home: '/root' },
      commandes: { uid: 997, group: 'commandes', home: '/var/lib/commandes', shell: '/usr/sbin/nologin' },
      vous: { uid: 1000, group: 'vous' },
      nadia: { uid: 1001, group: 'nadia' },
      lucas: { uid: 1002, group: 'lucas' },
    },
    groups: {
      root: { gid: 0, members: [] },
      adm: { gid: 4, members: ['vous'] },
      sudo: { gid: 27, members: ['vous', 'lucas'] },
      commandes: { gid: 997, members: ['nadia'] },
      vous: { gid: 1000, members: [] },
      nadia: { gid: 1001, members: [] },
      lucas: { gid: 1002, members: [] },
    },
  };
  if (!withLucas) {
    delete c.users.lucas;
    delete c.groups.lucas;
    for (const g of Object.values(c.groups)) g.members = g.members.filter((m) => m !== 'lucas');
  }
  return c;
};

const root = { owner: 'root' };
export const file = (content: string, owner = 'root', mode?: string) => f(content, { lines: true, owner, ...(mode ? { mode } : {}) });

// sshd_config de Debian, tel que l'hébergeur l'a laissé : root peut entrer.
export const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
PermitRootLogin yes
PasswordAuthentication no
KbdInteractiveAuthentication no

UsePAM yes

X11Forwarding yes
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

type SshdState = { load: Record<string, string>; connectionsToLoad: number; reloads: number };
export const sshd = (j: Game) => j.state.sshd as SshdState;

/** Le service ssh : comme celui de Debian, il vérifie sshd_config avant de recharger. */
export const serviceSsh = (): DefinitionService => ({
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  check: (j) => {
    const e = readConfig(j).errors;
    return e.length ? e : null;
  },
  checkToReload: true,
  load: (j) => {
    const c = sshd(j);
    if (!c) return;
    c.load = readConfig(j).values;
    c.connectionsToLoad = j.state.connexions ?? 1;
    c.reloads++;
  },
});

/** Au début du chapitre, sshd tourne avec la configuration du disque. */
export const loadSshd = (j: Game) => {
  sshd(j).load = readConfig(j).values;
};

/** Une ligne au journal de ssh, à l'heure donnée (heure locale lue comme UTC). */
export const sshLog = (j: Game, timeOfDay: number, pid: number, message: string) => {
  const sd = systemd(j)!;
  const before = sd.clock;
  sd.clock = timeOfDay;
  writeLog(sd, 'ssh.service', 'sshd', pid, message, 6, false);
  sd.clock = before;
};

/** Le monde commun : /etc (comptes, sudoers, ssh), les maisons, /srv, et ce que le chapitre ajoute. */
export function bakeryWorld(
  t: Translate,
  o: {
    home: Record<string, Node>;
    homes?: Record<string, Node>;
    etc?: Record<string, Node>;
    sudoersD?: Record<string, Node>;
    ssh?: Record<string, Node>;
    more?: Record<string, Node>;
    // Après « Le rapport » : le compte de Lucas n'existe plus.
    withoutLucas?: boolean;
  },
): Directory {
  const bakery = storyMachine('audit')!;
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: file('fournil'),
          sudoers: file(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d(
            { README: file('# See sudoers(5): files here are read unless their name has a dot or ends in ~.', 'root', 'r--r-----'), ...(o.sudoersD ?? {}) },
            undefined,
            { owner: 'root', mode: 'rwxr-xr-x' },
          ),
          ssh: d({ sshd_config: f(SSHD_CONFIG, { lines: true, owner: 'root' }), ...(o.ssh ?? {}) }, undefined, root),
          ...(o.etc ?? {}),
        },
        undefined,
        root,
      ),
      home: d(
        {
          vous: d({
            ...o.home,
            '.ssh': d({ authorized_keys: f(publicKey(bakery, player(t), machineName(t, 'poste')), { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
          nadia: d({}, undefined, { owner: 'nadia', mode: 'rwx------' }),
          ...(o.withoutLucas ? {} : { lucas: d({}, undefined, { owner: 'lucas', mode: 'rwx------' }) }),
          ...(o.homes ?? {}),
        },
        undefined,
        root,
      ),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
      ...(o.more ?? {}),
    },
    undefined,
    root,
  );
}


// ——— Le réseau vu par nmap, et les paquets ———

export const SCOPE = ['192.0.2.22'];
export const NEIGHBOUR = { name: 'voisin.internal', address: '192.0.2.24' };
// Le nom d'un paquet installé, tel que le service le dit à nmap : « Debian 7 » puis « Debian 7+deb13u1 ».
const revision = (j: Game) => ((j.state.apt as AptState | undefined)?.installed['openssh-server'] ?? '1:10.0p1-7').split('-').slice(1).join('-');

const SERVICES: ServiceScan[] = [
  { port: 22, service: 'ssh', product: (j) => `OpenSSH 10.0p1 Debian ${revision(j)} (protocol 2.0)` },
  { port: 80, service: 'http', product: 'nginx 1.26.3' },
  { port: 443, service: 'http', ssl: true, product: 'nginx 1.26.3' },
  { port: 3000, service: 'http', product: 'Node.js Express framework' },
  { port: 5432, service: 'postgresql', product: 'PostgreSQL DB 17.0 - 17.2' },
  { port: 6379, service: 'redis', product: 'Redis key-value store 8.0.2' },
];

/** Ce que nmap peut sonder : le Fournil (son état suit la machine) et le serveur du voisin, hors périmètre. */
export const bakeryScan = (): ScanState => {
  const bakery: ScanHost = { address: '192.0.2.22', names: ['fournil.internal', 'bakery.example', 'fournil'], local: true, services: SERVICES, latency: 0.011 };
  const neighbour: ScanHost = {
    address: NEIGHBOUR.address,
    names: [NEIGHBOUR.name],
    latency: 0.014,
    services: [
      { port: 22, service: 'ssh', product: 'OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)' },
      { port: 80, service: 'http', product: 'Apache httpd 2.4.62 ((Debian))' },
      { port: 3306, service: 'mysql', product: 'MariaDB 10.11.6' },
    ],
  };
  return { hosts: [bakery, neighbour], scope: [...SCOPE] };
};

/** Les sockets en écoute au départ : tout est ouvert, sauf l'appli de commandes (en local). */
export const bakeryListening = (redisLocal = false): Listening[] => [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 5432, process: 'postgres', pid: 744 },
  { proto: 'tcp', address: redisLocal ? '127.0.0.1' : '0.0.0.0', port: 6379, process: 'redis-server', pid: 760 },
  { proto: 'tcp', address: '127.0.0.1', port: 3000, process: 'node', pid: 731 },
];

/** L'état d'apt : la liste est à jour ; `mises` : les mises à jour de sécurité en attente. */
export const bakeryApt = (inWaiting: boolean): AptState => ({
  lists: true,
  installed: { ...Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])), nginx: '1.26.3-3+deb13u1', openssl: '3.5.1-1' },
  updates: inWaiting ? { 'openssh-server': '1:10.0p1-7+deb13u1', openssl: '3.5.4-1~deb13u1' } : {},
});

/** Un document Markdown rédigé par le joueur, section par section (titres « ## », lus dans la langue du jeu : <prefixe>-<nom>). */
export function sectionsMd(j: Game, text: string, prefix: string, names: string[]): Record<string, string> {
  const titres = Object.fromEntries(names.map((n) => [j.t(`${prefix}-${n}`).toLowerCase(), n]));
  const r: Record<string, string> = {};
  let current = '';
  for (const line of text.split('\n')) {
    const title = /^##\s+(.*)$/.exec(line);
    if (title) {
      current = titres[title[1].trim().toLowerCase()] ?? '';
      continue;
    }
    if (current) r[current] = `${r[current] ?? ''}${line}\n`;
  }
  return r;
}
