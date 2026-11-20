// apt: installing Debian packages, after apt(8) and the output of apt 3.0
// (Debian 13 "trixie"): https://manpages.debian.org/trixie/apt/apt.8.en.html
// As on a brand-new server, the package list is empty until
// `apt update` has been run ("Unable to locate package"). Installing a
// service starts and enables it at once, as Debian packages do.
// The state is in state.apt:
//   { lists: list downloaded?, installed: { package: version },
//     updates: { package: new version } (the pending updates),
//     interrupted: [packages unpacked but not configured] }
// apt upgrade (and full-upgrade) installs the updates; if the connection
// drops meanwhile (state.networkCut, except inside tmux), dpkg is
// interrupted: dpkg --configure -a is needed. A new kernel or a new
// libc writes /var/run/reboot-required (like update-notifier-common); the
// kernel only changes on reboot (state.kernel, uname -r).
// Differences: a small catalogue, indicative versions and sizes;
// only update, install, upgrade, full-upgrade, list; no real download.

import { d, f, type Directory } from '../world';
import type { Shell } from '../shell';
import { start, stop, writeLog, systemd } from '../systemd';
import { loadNginx, CONF, readFiles, nginxTime, test, VERSION, checkNginx } from '../nginx';
import type { Command } from './index';
import { ARCHIVE, BASE, known, type BasePackage } from '../packages';
import { isDebian, machineIdOf } from '../debian';

interface Package {
  version: string;
  architecture: 'amd64' | 'all';
  // Size to download and space taken once installed (kB).
  download: number;
  installed: number;
  dependencies?: string[];
  suggestions?: string[];
  // The files and the service the package installs.
  put?: (game: Shell) => void;
}

// nginx's pages and configuration on Debian (in English, like the real ones).
export const NGINX_CONF = `user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    access_log /var/log/nginx/access.log;

    gzip on;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}`;

export const MIME = `types {
    text/html                             html htm shtml;
    text/css                              css;
    text/plain                            txt;
    image/png                             png;
    image/jpeg                            jpeg jpg;
    application/javascript                js;
}`;

export const SITE_BY_DEFAULT = `# Default server configuration
#
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;

    # Add index.php to the list if you are using PHP
    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        # First attempt to serve request as file, then
        # as directory, then fall back to displaying a 404.
        try_files $uri $uri/ =404;
    }
}`;

export const WELCOME = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>`;

const NGINX_DESCRIPTION = 'A high performance web server and a reverse proxy server';
const root = { owner: 'root' };

// Puts files in place without overwriting those already there (restored
// configuration files stay, like dpkg's "conffiles").
function put(game: Shell, path: string, tree: Directory) {
  const here = game.find(path);
  if (!here) return void game.place('apt', path, tree);
  if (here.type !== 'directory') return;
  for (const [name, child] of Object.entries(tree.children)) {
    if (child.type === 'directory') put(game, `${path}/${name}`, child);
    else if (!here.children[name]) here.children[name] = child;
  }
}

export const PACKAGES: Record<string, Package> = {
  'nginx-common': {
    version: `${VERSION}-3`,
    architecture: 'all',
    download: 113,
    installed: 486,
    put: (game) => {
      const file = (text: string) => f(text, { lines: true, owner: 'root' });
      put(
        game,
        '/etc/nginx',
        d(
          {
            'nginx.conf': file(NGINX_CONF),
            'mime.types': file(MIME),
            'conf.d': d({}, undefined, root),
            'modules-enabled': d({}, undefined, root),
            'sites-available': d({ default: file(SITE_BY_DEFAULT) }, undefined, root),
            // On Debian, sites-enabled/default is a link to sites-available/default.
            'sites-enabled': d({ default: file(SITE_BY_DEFAULT) }, undefined, root),
          },
          undefined,
          root,
        ),
      );
      put(
        game,
        '/var/www',
        d({ html: d({ 'index.nginx-debian.html': f(WELCOME, { lines: true, owner: 'root' }) }, undefined, root) }, undefined, root),
      );
      put(
        game,
        '/var/log/nginx',
        d({ 'access.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) }, undefined, {
          owner: 'root',
          group: 'adm',
        }),
      );
    },
  },
  nginx: {
    version: `${VERSION}-3`,
    architecture: 'amd64',
    download: 527,
    installed: 1210,
    dependencies: ['nginx-common'],
    suggestions: ['fcgiwrap', 'nginx-doc', 'ssl-cert'],
    put: (game) => {
      put(game, '/usr/sbin', d({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }, undefined, root));
      const sd = systemd(game)!;
      sd.services.nginx ??= {
        description: NGINX_DESCRIPTION,
        state: 'inactive',
        active: false,
        executable: 'nginx',
        since: sd.clock,
        process: [
          { pid: 2411, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 2412, user: 'www-data', cpu: 0, mem: 0.4, command: 'nginx: worker process' },
        ],
        check: checkNginx,
        load: loadNginx,
        checkToReload: true,
      };
    },
  },
  certbot: {
    version: '4.0.0-2',
    architecture: 'all',
    download: 384,
    installed: 1530,
    put: (game) => put(game, '/usr/bin', d({ certbot: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 966 }) }, undefined, root)),
  },
  // certbot's nginx module: it serves the challenge and reloads nginx after a renewal.
  'python3-certbot-nginx': {
    version: '4.0.0-1',
    architecture: 'all',
    download: 70,
    installed: 318,
    dependencies: ['certbot'],
    put: (game) =>
      put(game, '/usr/lib/python3/dist-packages', d({ certbot_nginx: d({ '__init__.py': f('', { owner: 'root' }) }, undefined, root) }, undefined, root)),
  },
  curl: { version: '8.14.1-2', architecture: 'amd64', download: 269, installed: 497 },
  rsync: { version: '3.4.1+ds1-5', architecture: 'amd64', download: 445, installed: 806 },
  tar: { version: '1.35+dfsg-3.1', architecture: 'amd64', download: 846, installed: 3234 },
  'openssh-server': { version: '1:10.0p1-7', architecture: 'amd64', download: 610, installed: 2132 },
  // mount.cifs, the helper mount -t cifs needs (see cifs.ts).
  'cifs-utils': {
    version: '2:7.2-2',
    architecture: 'amd64',
    download: 95,
    installed: 337,
    suggestions: ['smbclient', 'winbind'],
    put: (game) => put(game, '/usr/sbin', d({ 'mount.cifs': f('', { owner: 'root', mode: 'rwxr-xr-x', size: 59_464 }) }, undefined, root)),
  },
  smbclient: { version: '2:4.22.3+dfsg-4', architecture: 'amd64', download: 488, installed: 1680 },
  dos2unix: { version: '7.5.2-1', architecture: 'amd64', download: 497, installed: 1946 },
  // zip and unzip: not installed by default on Debian (priority optional).
  zip: { version: '3.0-15', architecture: 'amd64', download: 234, installed: 610 },
  unzip: { version: '6.0-29', architecture: 'amd64', download: 166, installed: 389 },
  // lsb_release (lsb-release-minimal): no longer installed by default since Debian 12.
  'lsb-release': {
    version: '12.1-1',
    architecture: 'all',
    download: 6,
    installed: 20,
    put: (game) => put(game, '/usr/bin', d({ lsb_release: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 2_413 }) }, undefined, root)),
  },
};

/** A package apt can install: the catalogue's, or one of the base system (packages.ts) put back. */
export function pkg(name: string): Package | undefined {
  if (PACKAGES[name]) return PACKAGES[name];
  const b = BASE[name];
  return b ? { version: b.version, architecture: b.architecture, download: Math.round(b.size / 3), installed: b.size } : undefined;
}

// The packages already present on the host's Debian image.
export const BASE_INSTALLED = ['curl', 'rsync', 'tar', 'openssh-server'];

const SOURCES = [
  'http://deb.debian.org/debian trixie InRelease [140 kB]',
  'http://deb.debian.org/debian trixie-updates InRelease [47.3 kB]',
  'http://security.debian.org/debian-security trixie-security InRelease [43.4 kB]',
  'http://deb.debian.org/debian trixie/main amd64 Packages [9,669 kB]',
  'http://deb.debian.org/debian trixie/main Translation-en [6,486 kB]',
  'http://security.debian.org/debian-security trixie-security/main amd64 Packages [64.2 kB]',
];

const ko = (n: number) => `${n.toLocaleString('en-US')} kB`;
const READ = ['Reading package lists... Done', 'Building dependency tree... Done', 'Reading state information... Done'];

/** Where an update comes from (fields of the Release file, as apt-cache policy shows them). */
export interface Origin {
  o: string;
  n: string;
  l: string;
  site: string;
}
// By default: Debian's security updates.
export const SECURITY: Origin = { o: 'Debian', n: 'trixie-security', l: 'Debian-Security', site: 'security.debian.org' };

export interface AptState {
  lists: boolean;
  installed: Record<string, string>;
  // Pending updates: package → new version; a new package (the kernel) to install with them.
  updates?: Record<string, string>;
  fresh?: Record<string, string>;
  // The origin of each update (otherwise SECURITY).
  origins?: Record<string, Origin>;
  // Packages unpacked but not configured (dpkg interrupted).
  interrupted?: string[];
  inWaiting?: Record<string, string>;
  // Base packages (packages.ts) removed; packages removed whose configuration
  // files stay (dpkg's "rc"); packages installed as dependencies (apt-mark's "auto").
  removed?: string[];
  configs?: Record<string, string>;
  auto?: string[];
}

// The installed kernel and the running one (uname -r).
export interface Kernel {
  active: string;
  installed: string;
}

// Packages whose update requires a reboot (like update-notifier-common).
const REBOOT = /^(linux-image|libc6$|libssl|systemd$|dbus$)/;

/** The updates to apply (once the list is downloaded). */
export const availableUpdates = (e: AptState) =>
  e.lists ? Object.entries(e.updates ?? {}).filter(([n, v]) => e.installed[n] && e.installed[n] !== v) : [];

const INTERRUPTED_ERROR = "Error: dpkg was interrupted, you must manually run 'dpkg --configure -a' to correct the problem.";
const NOTHING_CLASSIC = '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.';

// The end of dpkg: configure each package, the triggers, and note whether a reboot is needed.
export function configure(game: Shell, e: AptState, packages: [string, string][]): string[] {
  const lines: string[] = [];
  for (const [n, v] of packages) {
    lines.push(`Setting up ${n} (${v}) ...`);
    e.installed[n] = v;
    if (n.startsWith('linux-image-6')) {
      const version = n.replace(/^linux-image-/, '');
      lines.push(`I: /vmlinuz is now a symlink to boot/vmlinuz-${version}`, `I: /initrd.img is now a symlink to boot/initrd.img-${version}`);
      const kernel = game.state.kernel as Kernel | undefined;
      if (kernel) kernel.installed = version;
      lines.push(`update-initramfs: Generating /boot/initrd.img-${version}`);
    }
  }
  e.interrupted = (e.interrupted ?? []).filter((n) => !packages.some(([p]) => p === n));
  lines.push('Processing triggers for man-db (2.13.1-1) ...', 'Processing triggers for libc-bin (2.41-12+deb13u1) ...');
  const restartA = packages.map(([n]) => n).filter((n) => REBOOT.test(n));
  if (restartA.length) {
    const before = (game.read('/var/run/reboot-required.pkgs') ?? '').split('\n').filter(Boolean);
    const listing = [...new Set([...before, ...restartA])].join('\n');
    for (const [file, content] of [
      ['/var/run/reboot-required', '*** System restart required ***'],
      ['/var/run/reboot-required.pkgs', listing],
    ]) {
      const n = game.find(file);
      if (n?.type === 'file') n.content = content;
      else game.place('dpkg', file, { type: 'file', content, lines: true, owner: 'root' });
    }
  }
  return lines;
}

function putDayA(game: Shell, yes: boolean, classic = false): string {
  const e = state(game);
  if (e.interrupted?.length) return game.error(classic ? `E: ${INTERRUPTED_ERROR.replace(/^Error: /, '')}` : INTERRUPTED_ERROR, 100);
  const updates = availableUpdates(e);
  const fresh = Object.entries(e.fresh ?? {}).filter(
    ([n]) => !e.installed[n] && updates.some(([m]) => m === 'linux-image-amd64' && n.startsWith('linux-image-')),
  );
  const output = [...READ, 'Calculating upgrade... Done'];
  if (!updates.length) return [...output, ...(classic ? [NOTHING_CLASSIC] : ['Summary:', '  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0'])].join('\n');
  if (classic)
    output.push(
      ...(fresh.length ? ['The following NEW packages will be installed:', `  ${fresh.map(([n]) => n).join(' ')}`] : []),
      'The following packages will be upgraded:',
      `  ${updates.map(([n]) => n).join(' ')}`,
      `${updates.length} upgraded, ${fresh.length} newly installed, 0 to remove and 0 not upgraded.`,
      'Need to get 118 MB of archives.',
      'After this operation, 109 MB of additional disk space will be used.',
    );
  else output.push(
    'Upgrading:',
    `  ${updates.map(([n]) => n).join('  ')}`,
    '',
    ...(fresh.length ? ['Installing dependencies:', `  ${fresh.map(([n]) => n).join('  ')}`, ''] : []),
    'Summary:',
    `  Upgrading: ${updates.length}, Installing: ${fresh.length}, Removing: 0, Not Upgrading: 0`,
    '  Download size: 118 MB',
    '  Space needed: 109 MB / 18.2 GB available',
  );
  const all = [...fresh, ...updates];
  const next = () => {
    const lines: string[] = [];
    all.forEach(([n, v], i) =>
      lines.push(`Get:${i + 1} http://security.debian.org/debian-security trixie-security/main amd64 ${n} amd64 ${v} [${ko(1000 + i * 731)}]`),
    );
    lines.push('Fetched 118 MB in 9s (13.1 MB/s)', '(Reading database ... 28412 files and directories currently installed.)');
    for (const [n, v] of all)
      lines.push(
        `Preparing to unpack .../${n}_${v.replace(/^\d+:/, '')}_amd64.deb ...`,
        e.installed[n] ? `Unpacking ${n} (${v}) over (${e.installed[n]}) ...` : `Unpacking ${n} (${v}) ...`,
      );
    // The connection drops during configuration: without tmux, dpkg dies with the session.
    if (game.state.networkCut && !game.tmux) {
      game.state.networkCut = false;
      e.interrupted = all.map(([n]) => n);
      // What is unpacked waits for its new version: we keep it in memory for dpkg --configure -a.
      e.inWaiting = Object.fromEntries(all);
      game.cut = true;
      lines.push(`Setting up ${all[0][0]} (${all[0][1]}) ...`);
      return lines.join('\n');
    }
    if (game.state.networkCut) {
      game.state.networkCut = false;
      game.cut = true;
    }
    lines.push(...configure(game, e, all));
    return lines.join('\n');
  };
  if (yes) return [...output, ...(classic ? [] : ['']), next()].join('\n');
  game.ask(classic ? 'Do you want to continue? [Y/n] ' : 'Continue? [Y/n] ', (response) => {
    if (response !== '' && !/^y(es)?$/i.test(response)) return 'Abort.';
    const before = game.who;
    game.who = 'root';
    try {
      return next();
    } finally {
      game.who = before;
    }
  });
  return [...output, ...(classic ? [] : [''])].join('\n');
}

export const state = (game: Shell): AptState =>
  (game.state.apt ??= { lists: false, installed: Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])) });

// Only root may touch the package database: apt stops at the lock.
const lock = (game: Shell, file: string, what: string) =>
  game.error(`Error: Could not open lock file ${file} - open (13: Permission denied)\nError: ${what}`);

function installer(game: Shell, names: string[], yes: boolean, classic = false): string {
  const e = state(game);
  if (e.interrupted?.length) return game.error(classic ? `E: ${INTERRUPTED_ERROR.replace(/^Error: /, '')}` : INTERRUPTED_ERROR, 100);
  const have = installedSet(game);
  const unknown = names.filter((n) => !have[n] && (!e.lists || !pkg(n)));
  if (unknown.length) {
    game.state.missingApt = true;
    return game.error([...READ, ...unknown.map((n) => `${classic ? 'E:' : 'Error:'} Unable to locate package ${n}`)].join('\n'), 100);
  }
  const already = names.filter((n) => have[n]);
  const requests = names.filter((n) => !have[n]);
  const dependencies = [...new Set(requests.flatMap((n) => pkg(n)!.dependencies ?? []))].filter((n) => !have[n] && !requests.includes(n));
  const all = [...dependencies, ...requests];
  const output = [...READ, ...already.map((n) => `${n} is already the newest version (${have[n]}).`)];
  if (!all.length) {
    output.push(...(classic ? [NOTHING_CLASSIC] : ['Summary:', '  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0']));
    return output.join('\n');
  }
  const suggestions = [...new Set(requests.flatMap((n) => pkg(n)!.suggestions ?? []))];
  const download = all.reduce((t, n) => t + pkg(n)!.download, 0);
  const place = all.reduce((t, n) => t + pkg(n)!.installed, 0);
  if (classic)
    output.push(
      ...(dependencies.length ? ['The following additional packages will be installed:', `  ${dependencies.join(' ')}`] : []),
      ...(suggestions.length ? ['Suggested packages:', `  ${suggestions.join(' ')}`] : []),
      'The following NEW packages will be installed:',
      `  ${[...all].sort().join(' ')}`,
      `0 upgraded, ${all.length} newly installed, 0 to remove and 0 not upgraded.`,
      `Need to get ${ko(download)} of archives.`,
      `After this operation, ${ko(place)} of additional disk space will be used.`,
    );
  else
    output.push(
      'Installing:',
      `  ${requests.join('  ')}`,
      '',
      ...(dependencies.length ? ['Installing dependencies:', `  ${dependencies.join('  ')}`, ''] : []),
      ...(suggestions.length ? ['Suggested packages:', `  ${suggestions.join('  ')}`, ''] : []),
      'Summary:',
      `  Upgrading: 0, Installing: ${all.length}, Removing: 0, Not Upgrading: 0`,
      `  Download size: ${ko(download)}`,
      `  Space needed: ${ko(place)} / 18.2 GB available`,
    );
  const next = () => {
    const lines: string[] = [];
    all.forEach((n, i) => {
      const p = pkg(n)!;
      lines.push(
        `Get:${i + 1} http://deb.debian.org/debian trixie/main ${p.architecture} ${n} ${p.architecture} ${p.version} [${ko(p.download)}]`,
      );
    });
    lines.push(`Fetched ${ko(download)} in 0s (${ko(download * 4)}/s)`);
    all.forEach((n, i) => {
      const p = pkg(n)!;
      lines.push(`Selecting previously unselected package ${n}.`);
      if (i === 0) lines.push('(Reading database ... 28412 files and directories currently installed.)');
      lines.push(`Preparing to unpack .../${n}_${p.version.replace(/^\d+:/, '')}_${p.architecture}.deb ...`, `Unpacking ${n} (${p.version}) ...`);
    });
    const failures: string[] = [];
    for (const n of all) {
      const p = pkg(n)!;
      lines.push(`Setting up ${n} (${p.version}) ...`);
      p.put?.(game);
      e.installed[n] = p.version;
      e.removed = (e.removed ?? []).filter((x) => x !== n);
      if (e.configs) delete e.configs[n];
      // A dependency is installed "automatically": apt autoremove takes it away once nothing needs it.
      if (dependencies.includes(n)) e.auto = [...new Set([...(e.auto ?? []), n])];
      else e.auto = (e.auto ?? []).filter((x) => x !== n);
      // A service's package enables and starts it (deb-systemd-helper, invoke-rc.d).
      const sd = systemd(game);
      const service = sd?.services[n];
      if (sd && service) {
        if (!service.active)
          lines.push(`Created symlink '/etc/systemd/system/multi-user.target.wants/${n}.service' → '/usr/lib/systemd/system/${n}.service'.`);
        service.active = true;
        writeLog(sd, '', 'systemd', 1, 'Reloading finished in 187 ms.');
        if (service.state !== 'active' && !start(game, sd, n, true)) {
          lines.push(
            `Job for ${n}.service failed because the control process exited with error code.`,
            `See "systemctl status ${n}.service" and "journalctl -xeu ${n}.service" for details.`,
            `invoke-rc.d: initscript ${n}, action "start" failed.`,
            `dpkg: error processing package ${n} (--configure):`,
            ` installed ${n} package post-installation script subprocess returned error exit status 1`,
          );
          failures.push(n);
        }
      }
    }
    lines.push('Processing triggers for man-db (2.13.1-1) ...');
    if (failures.length)
      lines.push(
        'Errors were encountered while processing:',
        ...failures.map((n) => ` ${n}`),
        'Error: Sub-process /usr/bin/dpkg returned an error code (1)',
      );
    return lines.join('\n');
  };
  // apt-get asks only when it installs more than what was asked for.
  if (yes || (classic && !dependencies.length)) return [...output, ...(classic ? [] : ['']), next()].join('\n');
  // The answer comes on the next line, outside sudo: we take the root account back.
  game.ask(classic ? 'Do you want to continue? [Y/n] ' : 'Continue? [Y/n] ', (response) => {
    if (response !== '' && !/^y(es)?$/i.test(response)) return 'Abort.';
    const before = game.who;
    game.who = 'root';
    try {
      return next();
    } finally {
      game.who = before;
    }
  });
  return [...output, ''].join('\n');
}

// ——— What is installed, what the archive has ———

/** The installed packages and their versions: Debian's base (packages.ts) less what was removed, and the chapter's. */
export function installedSet(game: Shell): Record<string, string> {
  const e = state(game);
  const removed = new Set(e.removed ?? []);
  const base = isDebian(game) ? Object.entries(BASE).filter(([n]) => !removed.has(n)).map(([n, b]) => [n, b.version] as const) : [];
  return { ...Object.fromEntries(base), ...e.installed };
}

/** What the game knows of a package: its description and files (packages.ts), its version (the catalogue's first). */
export function packageInfo(name: string): (BasePackage & { dependencies: string[] }) | undefined {
  const b = known(name);
  const p = PACKAGES[name];
  if (!b && !p) return undefined;
  return {
    ...(b ?? { section: 'misc', priority: 'optional', description: name, size: p!.installed }),
    version: p?.version ?? b!.version,
    architecture: p?.architecture ?? b!.architecture,
    dependencies: p?.dependencies ?? [],
  } as BasePackage & { dependencies: string[] };
}

/** The packages apt can see: the installed ones, and the archive's once `apt update` ran. */
function visible(game: Shell): string[] {
  const e = state(game);
  const names = new Set(Object.keys(installedSet(game)));
  if (e.lists) for (const n of [...Object.keys(PACKAGES), ...Object.keys(ARCHIVE)]) names.add(n);
  return [...names].sort();
}

// Shell-style patterns of apt list and dpkg -l (nginx*, 'lib?c6').
export const matches = (pattern: string, name: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(name);

// The packages nothing installed needs any more (installed as dependencies).
function orphans(game: Shell, have: Record<string, string>): string[] {
  const e = state(game);
  return (e.auto ?? []).filter((n) => have[n] && !Object.keys(have).some((m) => (packageInfo(m)?.dependencies ?? []).includes(n)));
}

const AUTOREMOVE = (game: Shell, names: string[]) => [
  `The following package${names.length > 1 ? 's were' : ' was'} automatically installed and ${names.length > 1 ? 'are' : 'is'} no longer required:`,
  `  ${names.join('  ')}`,
  `Use '${game.shellUser === 'root' && !game.environment.SUDO_USER ? '' : 'sudo '}apt autoremove' to remove ${names.length > 1 ? 'them' : 'it'}.`,
];

/**
 * apt remove / purge / autoremove (and apt-get's): the packages go, a
 * service is stopped and disabled, the programs leave the disk; purge also
 * removes the configuration files (otherwise dpkg keeps them: "rc").
 * An essential package asks for the real phrase, Yes, do as I say!
 */
function remover(game: Shell, names: string[], purge: boolean, yes: boolean, classic: boolean, auto = false): string {
  const e = state(game);
  const E = classic ? 'E:' : 'Error:';
  if (e.interrupted?.length) return game.error(classic ? `E: ${INTERRUPTED_ERROR.replace(/^Error: /, '')}` : INTERRUPTED_ERROR, 100);
  const have = installedSet(game);
  const unknown = names.filter((n) => !packageInfo(n) && !have[n]);
  if (unknown.length) return game.error([...READ, ...unknown.map((n) => `${E} Unable to locate package ${n}`)].join('\n'), 100);
  const output = [...READ];
  for (const n of names.filter((x) => !have[x] && !(purge && e.configs?.[x]))) output.push(`Package '${n}' is not installed, so not removed`);
  let going = names.filter((n) => have[n]);
  // purge of a package already removed: only its configuration files remain.
  const configsOnly = purge ? names.filter((n) => !have[n] && e.configs?.[n]) : [];
  if (auto) going = orphans(game, have);
  // What remove leaves unneeded (apt says so, autoremove takes it away).
  const after = Object.fromEntries(Object.entries(have).filter(([n]) => !going.includes(n)));
  const left = auto ? [] : orphans(game, after);
  if (left.length) output.push(...AUTOREMOVE(game, left));
  const all = [...going, ...configsOnly];
  if (!all.length) return [...output, classic ? NOTHING_CLASSIC : 'Summary:\n  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0'].join('\n');
  const freed = going.reduce((t, n) => t + (packageInfo(n)?.size ?? 0), 0);
  const star = (n: string) => (purge ? `${n}*` : n);
  const essential = going.filter((n) => packageInfo(n)?.essential);
  const warning = essential.length ? ['WARNING: The following essential packages will be removed.', 'This should NOT be done unless you know exactly what you are doing!', `  ${essential.join(' ')}`] : [];
  if (classic)
    output.push(
      'The following packages will be REMOVED:',
      `  ${all.map(star).join(' ')}`,
      ...warning,
      `0 upgraded, 0 newly installed, ${all.length} to remove and 0 not upgraded.`,
      `After this operation, ${ko(freed)} disk space will be freed.`,
    );
  else output.push('REMOVING:', `  ${all.map(star).join('  ')}`, '', ...(warning.length ? [...warning, ''] : []), 'Summary:', `  Upgrading: 0, Installing: 0, Removing: ${all.length}, Not Upgrading: 0`, `  Freed space: ${ko(freed)}`);
  const next = () => {
    const lines = ['(Reading database ... 28412 files and directories currently installed.)'];
    const sd = systemd(game);
    for (const n of going) {
      const version = have[n];
      lines.push(`Removing ${n} (${version}) ...`);
      const service = sd?.services[n];
      if (sd && service) {
        if (service.state === 'active') stop(game, sd, n);
        service.active = false;
      }
      // Its programs leave the disk (/usr/sbin/nginx…).
      for (const file of packageInfo(n)?.files ?? []) if (/^\/usr\/s?bin\//.test(file) && game.find(file)?.type === 'file') game.erase(file);
      delete e.installed[n];
      if (BASE[n]) e.removed = [...new Set([...(e.removed ?? []), n])];
      e.auto = (e.auto ?? []).filter((x) => x !== n);
      if (!purge) (e.configs ??= {})[n] = version;
    }
    for (const n of purge ? all : []) {
      const version = have[n] ?? e.configs?.[n];
      lines.push(`Purging configuration files for ${n} (${version}) ...`);
      for (const file of packageInfo(n)?.files ?? []) if (file.startsWith('/etc/') && game.find(file)) game.erase(file);
      if (e.configs) delete e.configs[n];
    }
    lines.push('Processing triggers for man-db (2.13.1-1) ...');
    return lines.join('\n');
  };
  const asRoot = (f: () => string) => () => {
    const before = game.who;
    game.who = 'root';
    try {
      return f();
    } finally {
      game.who = before;
    }
  };
  if (essential.length) {
    if (yes) return game.error([...output, `${E} Essential packages were removed and -y was used without --allow-remove-essential.`].join('\n'), 100);
    output.push(
      'You are about to do something potentially harmful.',
      "To continue type in the phrase 'Yes, do as I say!'",
    );
    game.ask(' ?] ', (response) => (response === 'Yes, do as I say!' ? asRoot(next)() : 'Abort.'));
    return output.join('\n');
  }
  if (yes) return [...output, ...(classic ? [] : ['']), next()].join('\n');
  game.ask(classic ? 'Do you want to continue? [Y/n] ' : 'Continue? [Y/n] ', (response) => (response !== '' && !/^y(es)?$/i.test(response) ? 'Abort.' : asRoot(next)()));
  return [...output, ...(classic ? [] : [''])].join('\n');
}

// apt search (and apt-cache search): the name or the short description, a regular expression, case ignored.
function search(game: Shell, terms: string[], classic: boolean): string {
  if (!terms.length) return game.error(classic ? 'E: You must give at least one search pattern' : 'Error: You must give at least one search pattern', 100);
  const have = installedSet(game);
  const found = visible(game).filter((n) => {
    const text = `${n} ${packageInfo(n)?.description ?? ''}`;
    return terms.every((t) => {
      try {
        return new RegExp(t, 'i').test(text);
      } catch {
        return text.toLowerCase().includes(t.toLowerCase());
      }
    });
  });
  if (classic) return found.map((n) => `${n} - ${packageInfo(n)!.description}`).join('\n');
  return [
    'Sorting... Done',
    'Full Text Search... Done',
    ...found.flatMap((n) => {
      const i = packageInfo(n)!;
      const tag = have[n] ? (state(game).auto?.includes(n) ? ' [installed,automatic]' : ' [installed]') : '';
      return [`${n}/trixie ${have[n] ?? i.version} ${i.architecture}${tag}`, `  ${i.description}`, ''];
    }),
  ].join('\n').trimEnd();
}

// apt show (and apt-cache show): the package's fields.
function show(game: Shell, names: string[], classic: boolean): string {
  const E = classic ? 'E:' : 'Error:';
  if (!names.length) return game.error(`${E} No packages found`, 100);
  const have = installedSet(game);
  const out: string[] = [];
  for (const n of names) {
    const i = packageInfo(n);
    if (!i || !(have[n] || state(game).lists)) {
      game.error(classic ? `N: Unable to locate package ${n}\nE: No packages found` : `${E} No packages found`, 100);
      continue;
    }
    out.push(
      [
        `Package: ${n}`,
        `Version: ${have[n] ?? i.version}`,
        ...(i.essential ? ['Essential: yes'] : []),
        `Priority: ${i.priority}`,
        `Section: ${i.section}`,
        `Installed-Size: ${classic ? i.size : ko(i.size)}`,
        ...(i.depends ? [`Depends: ${i.depends}`] : i.dependencies.length ? [`Depends: ${i.dependencies.join(', ')}`] : []),
        ...(i.homepage ? [`Homepage: ${i.homepage}`] : []),
        ...(classic ? [`Architecture: ${i.architecture}`] : []),
        ...(have[n] && !classic ? [`APT-Manual-Installed: ${state(game).auto?.includes(n) ? 'no' : 'yes'}`] : []),
        ...(classic ? [] : [`APT-Sources: ${have[n] && !state(game).lists ? '/var/lib/dpkg/status' : 'http://deb.debian.org/debian trixie/main amd64 Packages'}`]),
        `Description: ${i.description}`,
        '',
      ].join('\n'),
    );
  }
  return out.join('\n').trimEnd();
}

// apt policy (and apt-cache policy): installed and candidate versions, and where they come from.
function policy(game: Shell, names: string[]): string {
  const e = state(game);
  if (!names.length)
    return [
      'Package files:',
      ' 100 /var/lib/dpkg/status',
      '     release a=now',
      ...(e.lists
        ? [
            ' 500 http://security.debian.org/debian-security trixie-security/main amd64 Packages',
            '     release v=13,o=Debian,a=stable-security,n=trixie-security,l=Debian-Security,c=main,b=amd64',
            '     origin security.debian.org',
            ' 500 http://deb.debian.org/debian trixie/main amd64 Packages',
            '     release v=13.2,o=Debian,a=stable,n=trixie,l=Debian,c=main,b=amd64',
            '     origin deb.debian.org',
          ]
        : []),
      'Pinned packages:',
    ].join('\n');
  const have = installedSet(game);
  const out: string[] = [];
  for (const n of names) {
    const i = packageInfo(n);
    if (!i || !(have[n] || e.lists)) {
      game.error(`N: Unable to locate package ${n}`);
      game.status = 0;
      continue;
    }
    const update = e.lists ? e.updates?.[n] : undefined;
    const candidate = update && update !== have[n] ? update : (have[n] ?? i.version);
    const origin = e.origins?.[n] ?? SECURITY;
    const row = (v: string) => {
      const sources: string[] = [];
      if (e.lists && v === candidate && update && update !== have[n]) sources.push(`        500 http://${origin.site}/debian-security ${origin.n}/main amd64 Packages`);
      else if (e.lists) sources.push('        500 http://deb.debian.org/debian trixie/main amd64 Packages');
      if (v === have[n]) sources.push('        100 /var/lib/dpkg/status');
      return [`${v === have[n] ? ' ***' : '    '} ${v} ${v === have[n] && !e.lists ? 100 : 500}`, ...sources];
    };
    const versions = [...new Set([candidate, ...(have[n] ? [have[n]] : [])])];
    out.push(`${n}:`, `  Installed: ${have[n] ?? '(none)'}`, `  Candidate: ${candidate}`, '  Version table:', ...versions.flatMap(row));
  }
  return out.join('\n');
}

// apt list [--installed|--upgradable|--all-versions] [pattern…]
function list(game: Shell, args: string[], patterns: string[]): string {
  const e = state(game);
  const have = installedSet(game);
  if (args.includes('--upgradable')) {
    const fresh = availableUpdates(e)
      .filter(([n]) => !patterns.length || patterns.some((p) => matches(p, n)))
      .map(([n, v]) => `${n}/${(e.origins?.[n] ?? SECURITY).n} ${v} amd64 [upgradable from: ${e.installed[n]}]`);
    return ['Listing... Done', ...fresh.sort()].join('\n');
  }
  const names = (args.includes('--installed') ? Object.keys(have).sort() : visible(game)).filter((n) => !patterns.length || patterns.some((p) => matches(p, n)));
  const lines = names.map((n) => {
    const i = packageInfo(n);
    const arch = i?.architecture ?? 'amd64';
    if (!have[n]) return `${n}/trixie ${i?.version} ${arch}`;
    const upgradable = e.lists && e.updates?.[n] && e.updates[n] !== have[n];
    const tag = upgradable ? `upgradable from: ${have[n]}` : state(game).auto?.includes(n) ? 'installed,automatic' : 'installed';
    return `${n}/trixie,now ${upgradable ? e.updates![n] : have[n]} ${arch} [${tag}]`;
  });
  return ['Listing... Done', ...lines].join('\n');
}

// apt and apt-get: the actions; `classic`: apt-get's output (E:, "The following…", the counts line).
function aptMain(game: Shell, args: string[], classic: boolean): string {
  const yes = args.some((a) => /^-\w*y/.test(a) && !a.startsWith('--') || a === '--yes' || a === '--assume-yes');
  const purgeFlag = args.includes('--purge');
  const words = args.filter((a) => !a.startsWith('-'));
  const [action, ...packages] = words;
  const e = state(game);
  const E = classic ? 'E:' : 'Error:';
  const needRoot = () =>
    classic
      ? game.error('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 100)
      : lock(game, '/var/lib/dpkg/lock-frontend', 'Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');
  if (!action) return game.error(game.t(classic ? 'apt-get-usage' : 'apt-usage'), 1);
  if (action === 'update') {
    if (game.who !== 'root')
      return classic ? game.error('E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/', 100) : lock(game, '/var/lib/apt/lists/lock', 'Unable to lock directory /var/lib/apt/lists/');
    e.lists = true;
    const n = availableUpdates(e).length;
    return [
      ...SOURCES.map((x, i) => `Get:${i + 1} ${x}`),
      'Fetched 16.4 MB in 2s (8,210 kB/s)',
      ...(classic
        ? ['Reading package lists... Done']
        : [...READ.slice(0, 2), n ? `${n} package${n > 1 ? 's' : ''} can be upgraded. Run 'apt list --upgradable' to see ${n > 1 ? 'them' : 'it'}.` : 'All packages are up to date.']),
    ].join('\n');
  }
  if (action === 'install' || action === 'reinstall') {
    if (!packages.length) return classic ? [...READ, NOTHING_CLASSIC].join('\n') : game.error(`${READ.join('\n')}\nSummary:\n  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0`);
    if (game.who !== 'root') return needRoot();
    return installer(game, packages, yes, classic);
  }
  if (action === 'upgrade' || action === 'full-upgrade' || action === 'dist-upgrade') {
    if (game.who !== 'root') return needRoot();
    return putDayA(game, yes, classic);
  }
  if (action === 'remove' || action === 'purge' || action === 'autoremove' || action === 'autopurge') {
    if (action !== 'autoremove' && action !== 'autopurge' && !packages.length) return classic ? [...READ, NOTHING_CLASSIC].join('\n') : [...READ, 'Summary:', '  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0'].join('\n');
    if (game.who !== 'root') return needRoot();
    const auto = action === 'autoremove' || action === 'autopurge';
    return remover(game, packages, action === 'purge' || action === 'autopurge' || purgeFlag, yes, classic, auto);
  }
  if (!classic) {
    if (action === 'search') return search(game, packages, false);
    if (action === 'show') return show(game, packages, false);
    if (action === 'policy') return policy(game, packages);
    if (action === 'list') return list(game, args, packages);
  }
  if (classic && action === 'clean') return '';
  return game.error(`${E} Invalid operation ${action}`, 100);
}

// apt's stable-CLI warning: on standard error, when its output doesn't go to a terminal (apt(8), SCRIPT USAGE).
const UNSTABLE = '\nWARNING: apt does not have a stable CLI interface. Use with caution in scripts.\n';

// apt-get -q (-qq): less output; -qq keeps only the errors, for scripts.
const quiet = (args: string[], out: string) => (args.some((a) => a === '-qq' || a === '-q=2' || /^-\w*qq/.test(a)) ? '' : out);

// apt-cache: the archive's side, for scripts (apt-cache(8)): policy, show, search, showpkg's simpler cousins.
function aptCache(game: Shell, args: string[]): string {
  const words = args.filter((a) => !a.startsWith('-'));
  const [action, ...rest] = words;
  if (!action) return game.error(game.t('apt-cache-usage'), 100);
  if (action === 'policy') return policy(game, rest);
  if (action === 'show') return show(game, rest, true);
  if (action === 'search') return search(game, rest, true);
  if (action === 'pkgnames') return visible(game).filter((n) => !rest[0] || n.startsWith(rest[0])).join('\n');
  if (action === 'depends') {
    const out: string[] = [];
    for (const n of rest) {
      const i = packageInfo(n);
      if (!i) {
        game.error(`E: No packages found`, 100);
        continue;
      }
      const deps = i.depends ? i.depends.split(/,\s*/).map((x) => x.split(' ')[0]) : i.dependencies;
      out.push(n, ...deps.map((x) => `  Depends: ${x}`));
    }
    return out.join('\n');
  }
  return game.error(`E: Invalid operation ${action}`, 100);
}


// ——— dpkg's queries (dpkg-query(1)): -l, -L, -S, -s ———
// Source: https://manpages.debian.org/trixie/dpkg/dpkg-query.1.en.html

// A package's files as dpkg -L lists them: its directories, its files, its documentation and manual pages.
function filesOf(game: Shell, name: string): string[] {
  const i = packageInfo(name);
  const own = i?.files ?? [];
  const man = own
    .filter((f) => /^\/usr\/s?bin\//.test(f))
    .map((f) => (f.startsWith('/usr/sbin/') ? 8 : 1))
    .map((section, k) => `/usr/share/man/man${section}/${own.filter((f) => /^\/usr\/s?bin\//.test(f))[k].split('/').at(-1)}.${section}.gz`);
  const files = [...own, `/usr/share/doc/${name}/copyright`, ...man];
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split('/').slice(1, -1);
    for (let k = 1; k <= parts.length; k++) dirs.add(`/${parts.slice(0, k).join('/')}`);
  }
  return ['/.', ...[...new Set([...dirs, ...files])].sort((a, b) => a.localeCompare(b))];
}

const DPKG_HEADER = [
  'Desired=Unknown/Install/Remove/Purge/Hold',
  '| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend',
  '|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)',
];

function dpkg(game: Shell, args: string[]): string {
  const e = state(game);
  const action = args.find((a) => a.startsWith('-')) ?? '';
  const rest = args.filter((a) => !a.startsWith('-'));
  if (args.includes('--configure') && args.includes('-a')) {
    if (game.who !== 'root') return game.error('dpkg: error: requested operation requires superuser privilege', 2);
    const waiting = (e.interrupted ?? []).map((n) => [n, e.inWaiting?.[n] ?? e.installed[n]] as [string, string]);
    if (!waiting.length) return '';
    return configure(game, e, waiting).join('\n');
  }
  const have = installedSet(game);
  // -l [pattern…]: one line per package, columns as wide as their longest value (dpkg-query's list format).
  if (action === '-l' || action === '--list') {
    const rows: [string, string, string, string, string][] = [];
    const all = [...Object.keys(have), ...Object.keys(e.configs ?? {})].filter((n, i, a) => a.indexOf(n) === i).sort();
    let failed = false;
    const chosen = rest.length
      ? rest.flatMap((p) => {
          const found = all.filter((n) => matches(p, n));
          if (!found.length) {
            game.error(`dpkg-query: no packages found matching ${p}`);
            failed = true;
          }
          return found;
        })
      : all;
    for (const n of [...new Set(chosen)].sort()) {
      const i = packageInfo(n);
      const inst = have[n];
      rows.push([inst ? 'ii' : 'rc', n, inst ?? e.configs?.[n] ?? '', i?.architecture ?? 'amd64', i?.description ?? '']);
    }
    if (failed) game.status = 1;
    if (!rows.length) return '';
    const w = [14, 12, 12, 33].map((min, k) => Math.max(min, ...rows.map((r) => r[k + 1].length)));
    const line = (a: string, b: string, c: string, d: string, x: string) => `${a.padEnd(3)} ${b.padEnd(w[0])} ${c.padEnd(w[1])} ${d.padEnd(w[2])} ${x}`.trimEnd();
    return [
      ...DPKG_HEADER,
      line('||/', 'Name', 'Version', 'Architecture', 'Description'),
      `+++-${'='.repeat(w[0])}-${'='.repeat(w[1])}-${'='.repeat(w[2])}-${'='.repeat(w[3])}`,
      ...rows.map((r) => `${r[0]}  ${r[1].padEnd(w[0])} ${r[2].padEnd(w[1])} ${r[3].padEnd(w[2])} ${r[4]}`),
    ].join('\n');
  }
  // -L package: its files.
  if (action === '-L' || action === '--listfiles') {
    if (!rest.length) return game.error('dpkg-query: error: --listfiles needs at least one package name argument\n\nUse --help for help about querying packages.', 2);
    const out: string[] = [];
    for (const n of rest) {
      if (!have[n]) {
        game.error(e.configs?.[n] ? `Package '${n}' does not contain any files (!)` : `dpkg-query: package '${n}' is not installed\nUse dpkg --contents (= dpkg-deb --contents) to list archive files contents.`);
        if (!e.configs?.[n]) game.status = 1;
        continue;
      }
      out.push(...filesOf(game, n));
    }
    return out.join('\n');
  }
  // -S pattern: which package a file comes from (a path exactly, or a pattern anywhere in the paths).
  if (action === '-S' || action === '--search') {
    if (!rest.length) return game.error('dpkg-query: error: --search needs at least one file name pattern argument\n\nUse --help for help about querying packages.', 2);
    const out: string[] = [];
    for (const p of rest) {
      const exact = p.startsWith('/') && !/[*?[]/.test(p);
      const test = exact ? (f: string) => f === p.replace(/\/+$/, '') : (f: string) => matches(p.includes('*') || p.includes('?') ? p : `*${p}*`, f);
      const owners = new Map<string, string[]>();
      for (const n of Object.keys(have).sort())
        for (const f of filesOf(game, n).slice(1))
          if (test(f)) owners.set(f, [...(owners.get(f) ?? []), n]);
      if (!owners.size) {
        game.error(`dpkg-query: no path found matching pattern ${p}`);
        game.status = 1;
        continue;
      }
      for (const [f, pkgs] of [...owners].sort((a, b) => a[1][0].localeCompare(b[1][0]) || a[0].localeCompare(b[0]))) out.push(`${pkgs.join(', ')}: ${f}`);
    }
    return out.join('\n');
  }
  // -s package: its status and fields.
  if (action === '-s' || action === '--status') {
    if (!rest.length) return game.error('dpkg-query: error: --status needs at least one package name argument\n\nUse --help for help about querying packages.', 2);
    const out: string[] = [];
    for (const n of rest) {
      const i = packageInfo(n);
      const conf = e.configs?.[n];
      if (!have[n] && !conf) {
        game.error(`dpkg-query: package '${n}' is not installed and no information is available\nUse dpkg --info (= dpkg-deb --info) to examine archive files.`);
        game.status = 1;
        continue;
      }
      out.push(
        [
          `Package: ${n}`,
          ...(i?.essential ? ['Essential: yes'] : []),
          `Status: ${have[n] ? 'install ok installed' : 'deinstall ok config-files'}`,
          `Priority: ${i?.priority ?? 'optional'}`,
          `Section: ${i?.section ?? 'misc'}`,
          `Installed-Size: ${i?.size ?? 0}`,
          `Architecture: ${i?.architecture ?? 'amd64'}`,
          `Version: ${have[n] ?? conf}`,
          ...(i?.depends ? [`Depends: ${i.depends}`] : i?.dependencies.length ? [`Depends: ${i.dependencies.join(', ')}`] : []),
          ...((i?.files ?? []).some((f) => f.startsWith('/etc/')) ? ['Conffiles:', ...(i?.files ?? []).filter((f) => f.startsWith('/etc/')).map((f) => ` ${f} ${machineIdOf(f)}`)] : []),
          `Description: ${i?.description ?? n}`,
          ...(i?.homepage ? [`Homepage: ${i.homepage}`] : []),
          '',
        ].join('\n'),
      );
    }
    return out.join('\n').trimEnd();
  }
  return game.error(game.t('dpkg-usage'), 2);
}

export const APT: Record<string, Command> = {
  apt: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game, last }) => {
      if (!last || game.outputTo) game.error(UNSTABLE);
      const before = game.errorCount();
      const out = aptMain(game, args, false);
      if (game.errorCount() === before && game.status === null) game.status = 0;
      return out;
    },
  },
  'apt-get': { section: 8, ownOptions: true, launch: ({ args, game }) => quiet(args, aptMain(game, args, true)) },
  'apt-cache': { section: 8, ownOptions: true, launch: ({ args, game }) => aptCache(game, args) },
  // dpkg: --configure -a finishes configuring the unpacked packages (after
  // an interruption); -l, -L, -S, -s query its database (dpkg-query).
  dpkg: {
    section: 1,
    ownOptions: true,
    launch: ({ args, game }) => dpkg(game, args),
  },
  // nginx: the web server. Here it is used to check the configuration
  // (-t), print it whole (-T) and get its version (-v).
  nginx: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      if (!game.find('/usr/sbin/nginx')) return game.error(game.t('command-missing', { command: 'nginx' }));
      const option = args[0];
      if (option === '-v') return `nginx version: nginx/${VERSION}`;
      if (option !== '-t' && option !== '-T') {
        const letter = option?.replace(/^-+/, '') ?? '';
        return game.error(option ? `nginx: invalid option: "${letter}"` : game.t('nginx-without-option'));
      }
      const res = test(game);
      const output: string[] = [];
      // Without root, nginx can open neither its log nor its PID file.
      if (game.who !== 'root')
        output.push('nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)');
      if (res.error) {
        game.state.nginxError = res.error;
        output.push(`nginx: [emerg] ${res.error}`, `nginx: configuration file ${CONF} test failed`);
        return game.error(output.join('\n'));
      }
      game.state.nginxTested = true;
      output.push(...(res.config?.warnings ?? []).map((a) => `nginx: [warn] ${a}`), `nginx: the configuration file ${CONF} syntax is ok`);
      if (game.who !== 'root') {
        const h = nginxTime(systemd(game)?.clock ?? 0);
        output.push(
          `${h} [emerg] 2533#2533: open() "/run/nginx.pid" failed (13: Permission denied)`,
          `nginx: configuration file ${CONF} test failed`,
        );
        return game.error(output.join('\n'));
      }
      output.push(`nginx: configuration file ${CONF} test is successful`);
      if (option === '-T') output.push(...readFiles(game).flatMap((path) => [`# configuration file ${path}:`, game.read(path) ?? '', '']));
      return output.join('\n').trimEnd();
    },
  },
};
