// Story "The Watch": what its chapters have in common. Six months after
// "The Audit", the Bakery has moved to a new server (kneader, same public
// domain bakery.example) while the business was growing. Salomé comes back
// no longer to audit, but to pass on a habit: the weekly security watch,
// which you keep up alone once she is gone. No real CVE: fictitious
// identifiers (CVE-2099-NNNNN), shaped like real ones. You only fix after
// checking it concerns this server; you break nothing; you prove it.

import { d, f, path, name, accountsFiles, player, type Accounts, type Directory, type Node } from '../world';
import { publicKey, storyMachine, machineName } from '../machines';
import type { Translate } from '../../texts';
import type { AptState } from '../commands/apt';
import { NGINX_CONF, MIME } from '../commands/apt';
import { loadNginx } from '../nginx';
import type { ScanState, ScanHost, ServiceScan } from '../scan';
import type { Listening } from '../commands/ss';
import type { Game } from '../shell';
import { SUDOERS } from './coop';
import { loadSshd, file, sshLog, sectionsMd, serviceSsh, sshd } from './audit';

export { sshLog, sectionsMd, serviceSsh, sshd, file };

/** At the start of each chapter: sshd and nginx apply the configuration on disk. */
export const initialiseWatch = (j: Game) => {
  loadSshd(j);
  loadNginx(j);
};

export const M = '/home/you';
// levain-2028 in French (passwords.ftl).
export const PASSWORD = 'sourdough-2028';
// Tuesday 15 September 2028, 9:30: six months after "The Audit".
export const NOW = Date.UTC(2028, 8, 15, 9, 30, 0);
// Any address on the internet (RFC 5737).
export const INTERNET = '198.51.100.23';
export const ADDRESS = '192.0.2.24';

// The bulletin's fictitious CVEs (shaped like real ones, none exists). The
// versions follow the packages already simulated (src/engine/commands/apt.ts).
export const CVE = {
  // Public (80/443), a fix exists: to handle first despite a lower score
  // than rsync.
  nginx: {
    id: 'CVE-2099-41042',
    pkg: 'nginx',
    cvss: 8.2,
    installee: '1.26.3-3+deb13u2',
    corrigee: '1.26.3-3+deb13u3',
  },
  // Higher score, but no listening port (a local tool, run by hand or by a
  // scheduled task): to handle after nginx despite the score.
  rsync: {
    id: 'CVE-2099-37715',
    pkg: 'rsync',
    cvss: 9.8,
    installee: '3.4.1+ds1-4',
    corrigee: '3.4.1+ds1-5',
  },
  // Not applicable: the package isn't installed on this server.
  certbot: {
    id: 'CVE-2099-50288',
    pkg: 'python3-certbot-nginx',
    cvss: 5.3,
  },
  // Not applicable: the installed version is already beyond the fixed version.
  curl: {
    id: 'CVE-2099-12003',
    pkg: 'curl',
    cvss: 6.1,
    installee: '8.14.1-3',
    affecteeJusqua: '8.14.1-2',
    corrigee: '8.14.1-3',
  },
  // Relevant, but already out of reach: KbdInteractiveAuthentication has
  // been "no" from the start on this server, and no Debian fix exists
  // yet.
  ssh: {
    id: 'CVE-2099-29107',
    pkg: 'openssh-server',
    cvss: 5.9,
  },
};

const root = { owner: 'root' };

// sshd_config already hardened (what "The Audit" leaves behind, carried over
// to the new server at installation).
export const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3

UsePAM yes

X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

// The Bakery's site: an order page, nothing dynamic. Its domain and its
// folder take their name in the language (bakery.example, /var/www/bakery).
export const site = (t: Translate) => `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name ${name(t, 'bakery.example')} www.${name(t, 'bakery.example')};

    root ${path(t, '/var/www/bakery')};
    index index.html;

    location ~ /\\. {
        deny all;
    }
}`;

// The accounts: Nadia (the manager, no sudo access) and the player's account.
export const watchAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    nadia: { uid: 1001, group: 'nadia' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    you: { gid: 1000, members: [] },
    nadia: { gid: 1001, members: [] },
  },
});

/** apt's state at the start of a chapter: the week's bulletin, not yet handled. */
export const watchApt = (lists = true): AptState => ({
  lists,
  installed: {
    curl: CVE.curl.installee,
    rsync: CVE.rsync.installee,
    tar: '1.35+dfsg-3.1',
    'openssh-server': '1:10.0p1-7+deb13u1',
    nginx: CVE.nginx.installee,
    'nginx-common': CVE.nginx.installee,
    openssl: '3.5.4-1~deb13u1',
  },
  updates: { nginx: CVE.nginx.corrigee, rsync: CVE.rsync.corrigee },
});

// The version nginx announces doesn't change with a Debian fix (only the
// upstream number is visible): the proof in "The Fix" goes through apt
// (dpkg -l, apt list --upgradable), not nmap.
const SERVICES: ServiceScan[] = [
  { port: 22, service: 'ssh', product: 'OpenSSH 10.0p1 Debian 7+deb13u1 (protocol 2.0)' },
  { port: 80, service: 'http', product: 'nginx 1.26.3' },
  { port: 443, service: 'http', ssl: true, product: 'nginx 1.26.3' },
];

/** What nmap sees of the Bakery, from the internet (a single host: the scope is already settled). */
export const watchScan = (t: Translate): ScanState => ({
  hosts: [{ address: ADDRESS, names: ['kneader.internal', name(t, 'bakery.example'), 'kneader'], local: true, services: SERVICES, latency: 0.012 }],
  scope: [ADDRESS],
});

/** nginx's initial state (before loadNginx): the names it serves, so that curl resolves them. */
export const watchNginx = (t: Translate) => ({ load: null, names: [name(t, 'bakery.example'), `www.${name(t, 'bakery.example')}`, 'kneader', 'kneader.internal', ADDRESS] });

/** The listening sockets: nginx and sshd only (rsync isn't a service, just a command-line tool). */
export const watchListening = (): Listening[] => [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
];

/** The common world: /etc (accounts, sudoers, ssh, nginx), the homes, and what the chapter adds. */
export function watchWorld(
  t: Translate,
  o: { home: Record<string, Node>; etc?: Record<string, Node>; more?: Record<string, Node>; logAccess?: string },
): Directory {
  const kneader = storyMachine('watch')!;
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: file(machineName(t, 'kneader')),
          sudoers: file(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d({ README: file('# See sudoers(5): files here are read unless their name has a dot or ends in ~.', 'root', 'r--r-----') }, undefined, { owner: 'root', mode: 'rwxr-xr-x' }),
          ssh: d({ sshd_config: f(SSHD_CONFIG, { lines: true, owner: 'root' }) }, undefined, root),
          systemd: d({ system: d({}, undefined, root) }, undefined, root),
          nginx: d(
            {
              'nginx.conf': file(NGINX_CONF),
              'mime.types': file(MIME),
              'conf.d': d({}, undefined, root),
              'modules-enabled': d({}, undefined, root),
              'sites-available': d({ bakery: file(site(t)) }, undefined, root),
              'sites-enabled': d({ bakery: f('', { owner: 'root', link: path(t, '/etc/nginx/sites-available/bakery') }) }, undefined, root),
            },
            undefined,
            root,
          ),
          ...(o.etc ?? {}),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d({
            ...o.home,
            '.ssh': d({ authorized_keys: f(publicKey(kneader, player(t)), { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
          nadia: d({}, undefined, { owner: 'nadia', mode: 'rwx------' }),
        },
        undefined,
        root,
      ),
      var: d(
        {
          www: d({ bakery: d({ 'index.html': file(t('watch-site-index'), 'root') }, undefined, root) }, undefined, root),
          log: d({ nginx: d({ 'access.log': f(o.logAccess ?? '', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) }, undefined, { owner: 'root', group: 'adm' }) }, undefined, root),
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
