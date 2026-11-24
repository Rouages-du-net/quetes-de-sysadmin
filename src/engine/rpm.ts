// A Rocky Linux 10.3 machine's packages (state.rpm, see rhel.ts): what the
// RPM database holds and what the repositories (baseos, appstream, extras)
// offer, for rpm and dnf. Versions as dl.rockylinux.org/pub/rocky/10/
// published them for 10.3 (November 2026). Installing a package puts its
// files in the world (labelled by the policy), its units in systemd, its
// accounts in /etc/passwd; dnf keeps each transaction for `dnf history`.
// Simplified (see docs/SCENARIOS.md): a few dozen packages, the files
// that matter, no scriptlets' output, no real dependency solver.

import type { Game, Shell } from './shell';
import type { Directory, File, Node } from './world';
import { systemd, type DefinitionService, type Service } from './systemd';
import { defaultType, HTTPD } from './selinux';
import { load as loadHttpd, startCheck, stopped as httpdStopped } from './httpd-rhel';

export interface Pkg {
  name: string;
  version: string;
  release: string;
  arch: string;
  repo: 'baseos' | 'appstream' | 'extras';
  // Download size and installed size (bytes).
  size: number;
  installed: number;
  summary: string;
  license: string;
  url: string;
  description: string;
  // Its files: path → content (null: a file the game doesn't model; a directory ends with /).
  files: Record<string, string | null>;
  requires?: string[];
  weak?: string[];
  // Its systemd units, and the accounts it creates (name → uid).
  units?: Record<string, DefinitionService>;
  accounts?: Record<string, number>;
  // Configuration files (rpm -V marks them c).
  config?: string[];
}

export interface Transaction {
  id: number;
  command: string;
  // Date (the machine's clock, ms), who ran it.
  at: number;
  user: string;
  action: 'Install' | 'Removed' | 'Upgrade';
  packages: string[];
}

export interface RpmState {
  // Installed: name → install date (ms) and the repository it came from (@anaconda for the installation).
  installed: Record<string, { at: number; from: string; altered?: string[] }>;
  history: Transaction[];
  // When dnf last refreshed its metadata (ms).
  metadata: number;
}

export const rpm = (game: Game): RpmState => game.state.rpm as RpmState;
export const nevra = (p: Pkg) => `${p.name}-${p.version}-${p.release}.${p.arch}`;
export const isInstalled = (game: Game, name: string) => !!rpm(game)?.installed[name];

const K = 1024;
const M = 1024 * 1024;
const pkg = (name: string, vr: string, arch: string, repo: Pkg['repo'], size: number, installed: number, summary: string, extra: Partial<Pkg> = {}): Pkg => {
  const [version, release] = vr.split(/-(?=[^-]+$)/);
  return { name, version, release, arch, repo, size, installed, summary, license: 'GPL-2.0-or-later', url: '', description: summary + '.', files: {}, ...extra };
};

// ——— httpd's files (Rocky's httpd.conf without its long comments) ———

export const HTTPD_CONF = `#
# This is the main Apache HTTP server configuration file.  It contains the
# configuration directives that give the server its instructions.
# See <URL:http://httpd.apache.org/docs/2.4/> for detailed information.
# In particular, see
# <URL:http://httpd.apache.org/docs/2.4/mod/directives.html>
# for a discussion of each configuration directive.
#
# (Rocky Linux's httpd.conf, its long comments shortened.)

ServerRoot "/etc/httpd"

# Listen: Allows you to bind Apache to specific IP addresses and/or
# ports, instead of the default. See also the <VirtualHost>
# directive.
Listen 80

Include conf.modules.d/*.conf

User apache
Group apache

ServerAdmin root@localhost

#ServerName www.example.com:80

<Directory />
    AllowOverride none
    Require all denied
</Directory>

# DocumentRoot: The directory out of which you will serve your
# documents. By default, all requests are taken from this directory, but
# symbolic links and aliases may be used to point to other locations.
DocumentRoot "/var/www/html"

<Directory "/var/www">
    AllowOverride None
    Require all granted
</Directory>

<Directory "/var/www/html">
    Options Indexes FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>

<IfModule dir_module>
    DirectoryIndex index.html
</IfModule>

<Files ".ht*">
    Require all denied
</Files>

ErrorLog "logs/error_log"
LogLevel warn

<IfModule log_config_module>
    LogFormat "%h %l %u %t \\"%r\\" %>s %b \\"%{Referer}i\\" \\"%{User-Agent}i\\"" combined
    CustomLog "logs/access_log" combined
</IfModule>

AddDefaultCharset UTF-8
EnableSendfile on

# Load config files in the "/etc/httpd/conf.d" directory, if any.
IncludeOptional conf.d/*.conf`;

export const WELCOME_CONF = `#
# This configuration file enables the default "Welcome" page if there
# is no default index page present for the root URL.  To disable the
# Welcome page, comment out all the lines below.
#
# NOTE: if this file is removed, it will be restored on upgrades.
#
<LocationMatch "^/+$">
    Options -Indexes
    ErrorDocument 403 /.noindex.html
</LocationMatch>

<Directory /usr/share/httpd/noindex>
    AllowOverride None
    Require all granted
</Directory>

Alias /.noindex.html /usr/share/httpd/noindex/index.html
Alias /poweredby.png /usr/share/httpd/icons/apache_pb3.png
Alias /system_noindex_logo.png /usr/share/httpd/icons/system_noindex_logo.png`;

export const TEST_PAGE = `<!doctype html>
<html>
  <head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>HTTP Server Test Page powered by: Rocky Linux</title>
  </head>
  <body>
    <h1>HTTP Server <strong>Test Page</strong></h1>
    <p>This page is used to test the proper operation of an HTTP server after it has been installed on a Rocky Linux system.
    If you can read this page, it means that the software is working correctly.</p>
    <h2>Just visiting?</h2>
    <p>This website you are visiting is either experiencing problems or could be going through maintenance.</p>
    <h2>I am the admin, what do I do?</h2>
    <p>You may now add content to the webroot directory for your software.
    For systems using the Apache Webserver: You can add content to the directory /var/www/html/.
    Until you do so, people visiting your website will see this page.</p>
  </body>
</html>`;

const HTTPD_UNIT = `# See httpd.service(8) for more information on using the httpd service.
[Unit]
Description=The Apache HTTP Server
Wants=httpd-init.service
After=network.target remote-fs.target nss-lookup.target httpd-init.service
Documentation=man:httpd.service(8)

[Service]
Type=notify
Environment=LANG=C
ExecStart=/usr/sbin/httpd $OPTIONS -DFOREGROUND
ExecReload=/usr/sbin/httpd $OPTIONS -k graceful
# Send SIGWINCH for graceful stop
KillSignal=SIGWINCH
KillMode=mixed
PrivateTmp=true
OOMPolicy=continue

[Install]
WantedBy=multi-user.target`;

/** httpd's unit: its configuration checked and its sockets bound at start, read again by a reload (httpd -k graceful). */
export function httpdUnit(): DefinitionService {
  const p = (pid: number, user: string) => ({ pid, user, cpu: 0, mem: user === 'root' ? 0.6 : 0.4, command: '/usr/sbin/httpd -DFOREGROUND', ppid: pid === 2201 ? 1 : 2201, label: HTTPD });
  return {
    description: 'The Apache HTTP Server',
    executable: 'httpd',
    active: false,
    state: 'inactive',
    process: [p(2201, 'root'), p(2202, 'apache'), p(2203, 'apache'), p(2204, 'apache'), p(2205, 'apache')],
    check: startCheck,
    checkToReload: true,
    load: loadHttpd,
    stop: httpdStopped,
    unitFile: '/usr/lib/systemd/system/httpd.service',
  };
}

// ——— The catalogue ———

const RL = 'el10';
export const CATALOGUE: Pkg[] = [
  pkg('httpd', `2.4.63-13.${RL}_2.8`, 'x86_64', 'appstream', 47 * K, 61 * K, 'Apache HTTP Server', {
    license: 'Apache-2.0',
    url: 'https://httpd.apache.org/',
    description: 'The Apache HTTP Server is a powerful, efficient, and extensible\nweb server.',
    requires: ['httpd-core', 'httpd-filesystem', 'httpd-tools', 'apr', 'apr-util', 'apr-util-lmdb', 'rocky-logos-httpd'],
    weak: ['apr-util-openssl', 'mod_http2', 'mod_lua'],
    files: { '/usr/lib/systemd/system/httpd.service': HTTPD_UNIT, '/usr/share/man/man8/httpd.service.8.gz': null },
    units: { httpd: httpdUnit() },
  }),
  pkg('httpd-core', `2.4.63-13.${RL}_2.8`, 'x86_64', 'appstream', 1.5 * M, 4.7 * M, 'httpd minimal core', {
    license: 'Apache-2.0',
    url: 'https://httpd.apache.org/',
    files: {
      '/etc/httpd/conf/httpd.conf': HTTPD_CONF,
      '/etc/httpd/conf.d/': null,
      '/etc/httpd/conf.modules.d/00-base.conf': '# This file configures all the modules that make up the base of httpd.\n# (LoadModule lines)',
      '/etc/httpd/conf.modules.d/00-proxy.conf': '# This file configures all the proxy modules:\nLoadModule proxy_module modules/mod_proxy.so\nLoadModule proxy_http_module modules/mod_proxy_http.so',
      '/etc/httpd/conf.d/README': 'This directory holds configuration files for the Apache HTTP Server;\nany files in this directory which have the ".conf" extension will be\nprocessed as httpd configuration files.',
      '/usr/sbin/httpd': null,
      '/usr/sbin/apachectl': null,
      '/var/log/httpd/': null,
      '/var/www/html/': null,
      '/var/www/cgi-bin/': null,
    },
    config: ['/etc/httpd/conf/httpd.conf'],
    accounts: { apache: 48 },
  }),
  pkg('httpd-filesystem', `2.4.63-13.${RL}_2.8`, 'noarch', 'appstream', 13 * K, 400, 'The basic directory layout for the Apache HTTP Server', { license: 'Apache-2.0', files: { '/etc/httpd/conf.d/welcome.conf': WELCOME_CONF } }),
  pkg('httpd-tools', `2.4.63-13.${RL}_2.8`, 'x86_64', 'appstream', 80 * K, 191 * K, 'Tools for use with the Apache HTTP Server', { license: 'Apache-2.0', files: { '/usr/bin/htpasswd': null, '/usr/bin/ab': null } }),
  pkg('apr', `1.7.5-3.${RL}`, 'x86_64', 'appstream', 129 * K, 302 * K, 'Apache Portable Runtime library', { license: 'Apache-2.0' }),
  pkg('apr-util', `1.6.3-23.${RL}_2.1`, 'x86_64', 'appstream', 98 * K, 222 * K, 'Apache Portable Runtime Utility library', { license: 'Apache-2.0' }),
  pkg('apr-util-lmdb', `1.6.3-23.${RL}_2.1`, 'x86_64', 'appstream', 13 * K, 15 * K, 'APR utility library LMDB driver', { license: 'Apache-2.0' }),
  pkg('apr-util-openssl', `1.6.3-23.${RL}_2.1`, 'x86_64', 'appstream', 15 * K, 24 * K, 'APR utility library OpenSSL crypto support', { license: 'Apache-2.0' }),
  pkg('mod_http2', `2.0.29-5.${RL}_3.1`, 'x86_64', 'appstream', 165 * K, 427 * K, 'module implementing HTTP/2 for Apache 2', { license: 'Apache-2.0' }),
  pkg('mod_lua', `2.4.63-13.${RL}_2.8`, 'x86_64', 'appstream', 60 * K, 141 * K, 'Lua language module for the Apache HTTP Server', { license: 'Apache-2.0' }),
  pkg('mod_ssl', `2.4.63-13.${RL}_2.8`, 'x86_64', 'appstream', 109 * K, 255 * K, 'SSL/TLS module for the Apache HTTP Server', { license: 'Apache-2.0', requires: ['httpd'], files: { '/etc/httpd/conf.d/ssl.conf': null } }),
  pkg('rocky-logos-httpd', `100.5-3.${RL}`, 'noarch', 'appstream', 21 * K, 26 * K, 'Rocky Linux-related icons and pictures used by httpd', { license: 'CC-BY-SA-4.0', files: { '/usr/share/httpd/noindex/index.html': TEST_PAGE } }),
  pkg('nginx', `1.26.3-16.${RL}_3.3`, 'x86_64', 'appstream', 33 * K, 85 * K, 'A high performance web server and reverse proxy server', { license: 'BSD-2-Clause' }),
  pkg('policycoreutils-python-utils', `3.11-1.${RL}`, 'noarch', 'appstream', 73 * K, 140 * K, 'SELinux policy core python utilities', {
    url: 'https://github.com/SELinuxProject/selinux',
    description: 'The policycoreutils-python-utils package contains the management tools use to manage\nan SELinux environment.',
    requires: ['python3-policycoreutils', 'python3-libsemanage', 'python3-setools', 'python3-audit', 'checkpolicy'],
    files: { '/usr/sbin/semanage': null, '/usr/bin/audit2allow': null, '/usr/bin/audit2why': null, '/usr/bin/chcat': null, '/usr/bin/sandbox': null },
  }),
  pkg('python3-policycoreutils', `3.11-1.${RL}`, 'noarch', 'appstream', 2.2 * M, 6.4 * M, 'SELinux policy core python3 interfaces'),
  pkg('python3-libsemanage', `3.11-1.${RL}`, 'x86_64', 'appstream', 82 * K, 382 * K, 'semanage python 3 bindings for libsemanage'),
  pkg('python3-setools', `4.7.1-1.1.${RL}_3`, 'x86_64', 'baseos', 637 * K, 2.9 * M, 'Policy analysis tools for SELinux'),
  pkg('python3-audit', `4.2.1-3.${RL}`, 'x86_64', 'appstream', 85 * K, 273 * K, 'Python3 bindings for libaudit'),
  pkg('checkpolicy', `3.11-2.${RL}`, 'x86_64', 'appstream', 352 * K, 1.3 * M, 'SELinux policy compiler'),
  pkg('setroubleshoot-server', `3.3.37-2.${RL}`, 'x86_64', 'appstream', 365 * K, 1.2 * M, 'SELinux troubleshoot server'),
];

// What a Rocky Linux 10.3 server installation has (the packages the game names; rpm -qa lists them).
export const BASE: Pkg[] = [
  pkg('bash', '5.2.26-6.el10', 'x86_64', 'baseos', 1.8 * M, 8.2 * M, 'The GNU Bourne Again shell', { license: 'GPL-3.0-or-later' }),
  pkg('coreutils', '9.5-14.el10_3', 'x86_64', 'baseos', 1.2 * M, 5.7 * M, 'A set of basic GNU tools commonly used in shell scripts', { license: 'GPL-3.0-or-later', files: { '/usr/bin/ls': null, '/usr/bin/chcon': null, '/usr/bin/cp': null } }),
  pkg('curl', '8.12.1-9.el10_3', 'x86_64', 'baseos', 315 * K, 801 * K, 'A utility for getting files from remote servers (FTP, HTTP, and others)', { license: 'curl', files: { '/usr/bin/curl': null } }),
  pkg('dnf', '4.20.0-28.el10.rocky.0.1', 'noarch', 'baseos', 486 * K, 2.4 * M, 'Package manager', { files: { '/usr/bin/dnf': null, '/etc/dnf/dnf.conf': '[main]\ngpgcheck=1\ninstallonly_limit=3\nclean_requirements_on_remove=True\nbest=True\nskip_if_unavailable=False' } }),
  pkg('firewalld', '2.4.3-4.el10_2', 'noarch', 'baseos', 474 * K, 2.2 * M, 'A firewall daemon with D-Bus interface providing a dynamic firewall', { files: { '/usr/bin/firewall-cmd': null, '/usr/sbin/firewalld': null, '/etc/firewalld/firewalld.conf': null }, config: ['/etc/firewalld/firewalld.conf'] }),
  pkg('glibc', '2.39-147.el10_3', 'x86_64', 'baseos', 2.0 * M, 6.4 * M, 'The GNU libc libraries', { license: 'LGPL-2.1-or-later' }),
  pkg('kernel', '6.12.0-264.17.1.el10_3', 'x86_64', 'baseos', 1.2 * M, 0, 'The Linux kernel, based on version 6.12.0, heavily modified with backports'),
  pkg('libselinux-utils', '3.11-2.el10', 'x86_64', 'baseos', 112 * K, 307 * K, 'SELinux libselinux utilities', { license: 'LicenseRef-Fedora-Public-Domain', files: { '/usr/sbin/getenforce': null, '/usr/sbin/setenforce': null, '/usr/sbin/getsebool': null, '/usr/sbin/selinuxenabled': null } }),
  pkg('nano', '8.1-3.el10', 'x86_64', 'baseos', 801 * K, 2.9 * M, 'A small text editor', { license: 'GPL-3.0-or-later', files: { '/usr/bin/nano': null } }),
  pkg('openssh-server', '9.9p1-33.el10_3.rocky.0.1', 'x86_64', 'baseos', 477 * K, 1.4 * M, 'An open source SSH server daemon', { license: 'BSD-3-Clause', files: { '/usr/sbin/sshd': null, '/etc/ssh/sshd_config': null }, config: ['/etc/ssh/sshd_config'] }),
  pkg('policycoreutils', '3.11-1.el10', 'x86_64', 'baseos', 229 * K, 682 * K, 'SELinux policy core utilities', { files: { '/usr/sbin/restorecon': null, '/usr/sbin/setsebool': null, '/usr/sbin/semodule': null, '/usr/sbin/sestatus': null, '/usr/sbin/fixfiles': null } }),
  pkg('audit', '4.2.1-3.el10', 'x86_64', 'baseos', 293 * K, 893 * K, 'User space tools for kernel auditing', { files: { '/usr/sbin/auditd': null, '/usr/sbin/ausearch': null, '/var/log/audit/': null } }),
  pkg('rocky-release', '10.3-1.0.el10', 'noarch', 'baseos', 25 * K, 28 * K, 'Rocky Linux release files', { license: 'BSD-3-Clause', files: { '/etc/os-release': null, '/etc/rocky-release': null, '/etc/redhat-release': null } }),
  pkg('rpm', '4.19.1.1-29.el10_3', 'x86_64', 'baseos', 543 * K, 2.6 * M, 'The RPM package management system', { files: { '/usr/bin/rpm': null } }),
  pkg('rsyslog', '8.2604.0-5.el10_3.1', 'x86_64', 'appstream', 812 * K, 2.6 * M, 'Enhanced system logging and kernel message trapping daemon', { files: { '/etc/rsyslog.conf': null, '/var/log/messages': null, '/var/log/secure': null } }),
  pkg('selinux-policy-targeted', '42.1.27-2.el10_3.2', 'noarch', 'baseos', 7.1 * M, 18.9 * M, 'SELinux targeted policy', { files: { '/etc/selinux/config': null, '/etc/selinux/targeted/': null } }),
  pkg('sudo', '1.9.17-10.p2.el10_3.13', 'x86_64', 'baseos', 1.0 * M, 3.8 * M, 'Allows restricted root access for specified users', { license: 'ISC', files: { '/usr/bin/sudo': null, '/etc/sudoers': null } }),
  pkg('systemd', '257-33.el10.rocky.0.1', 'x86_64', 'baseos', 4.1 * M, 13.6 * M, 'System and Service Manager', { license: 'LGPL-2.1-or-later', files: { '/usr/bin/systemctl': null, '/usr/bin/journalctl': null } }),
];

export const ALL: Pkg[] = [...BASE, ...CATALOGUE];
export const byName = (name: string) => ALL.find((p) => p.name === name);

export function newRpm(installAt: number, extra: string[] = []): RpmState {
  return {
    installed: Object.fromEntries([...BASE.map((p) => p.name), ...extra].map((n) => [n, { at: installAt, from: BASE.some((p) => p.name === n) ? 'anaconda' : (byName(n)?.repo ?? 'appstream') }])),
    history: [{ id: 1, command: '', at: installAt, user: 'System <unset>', action: 'Install', packages: BASE.map((p) => p.name) }],
    metadata: installAt,
  };
}

/** What installing these names brings (the packages, their requirements, their weak ones), not installed yet. */
export function closure(game: Game, names: string[]): { main: Pkg[]; deps: Pkg[]; weak: Pkg[] } {
  const seen = new Set<string>();
  const main: Pkg[] = [];
  const deps: Pkg[] = [];
  const weak: Pkg[] = [];
  const visit = (p: Pkg, into: Pkg[]) => {
    if (seen.has(p.name) || isInstalled(game, p.name)) return;
    seen.add(p.name);
    into.push(p);
    for (const r of p.requires ?? []) {
      const q = byName(r);
      if (q) visit(q, deps);
    }
    for (const r of p.weak ?? []) {
      const q = byName(r);
      if (q) visit(q, weak);
    }
  };
  for (const n of names) {
    const p = byName(n);
    if (p) visit(p, main);
  }
  return { main, deps, weak };
}

/** Puts a package's files in the world, labelled by the policy, its units in systemd. */
export function installFiles(game: Game, p: Pkg): void {
  const sh = game as Shell;
  for (const [path, content] of Object.entries(p.files)) {
    const dir = path.endsWith('/');
    const clean = path.replace(/\/$/, '');
    const parts = clean.split('/').filter(Boolean);
    let n: Directory = sh.root;
    let at = '';
    for (let i = 0; i < parts.length; i++) {
      at += `/${parts[i]}`;
      const last = i === parts.length - 1;
      const existing: Node | undefined = n.children[parts[i]];
      if (last && !dir) {
        if (!existing && content !== null) n.children[parts[i]] = labelled(game, at, { type: 'file', content, lines: true, owner: 'root', group: 'root' });
        else if (!existing) n.children[parts[i]] = labelled(game, at, { type: 'file', content: '', owner: 'root', group: 'root', mode: at.includes('/bin/') || at.includes('/sbin/') ? 'rwxr-xr-x' : 'rw-r--r--', size: 4096 });
        continue;
      }
      if (existing?.type !== 'directory') n.children[parts[i]] = labelled(game, at, { type: 'directory', children: {}, owner: 'root', group: 'root', ...(at === '/var/log/httpd' ? { mode: 'rwx------' } : {}) });
      n = n.children[parts[i]] as Directory;
    }
  }
  if (p.name === 'httpd-core') game.state.httpd ??= { loaded: null, pid: 2201, backends: {} };
  const sd = systemd(game);
  if (sd)
    for (const [name, d] of Object.entries(p.units ?? {}))
      if (!sd.services[name]) sd.services[name] = { ...d, active: false, state: 'inactive', process: d.process ?? [], since: sd.clock } as Service;
  for (const [name, uid] of Object.entries(p.accounts ?? {})) {
    if (!sh.accounts.users[name]) sh.accounts.users[name] = { uid, group: name, home: '/usr/share/httpd', shell: '/sbin/nologin' };
    if (!sh.accounts.groups[name]) sh.accounts.groups[name] = { gid: uid, members: [] };
  }
}
function labelled<T extends File | Directory>(game: Game, path: string, n: T): T {
  n.context = `system_u:object_r:${defaultType(game, path, n.type === 'directory') ?? 'usr_t'}:s0`;
  return n;
}

/** Takes a package's files out of the world (its configuration files changed by hand are kept as .rpmsave). */
export function removeFiles(game: Game, p: Pkg): void {
  const sh = game as Shell;
  for (const path of Object.keys(p.files).filter((x) => !x.endsWith('/'))) if (sh.exists(path)) sh.erase(path);
  const sd = systemd(game);
  for (const name of Object.keys(p.units ?? {})) if (sd?.services[name]) delete sd.services[name];
}
