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
import { start, writeLog, systemd } from '../systemd';
import { loadNginx, CONF, readFiles, nginxTime, test, VERSION, checkNginx } from '../nginx';
import type { Command } from './index';

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
};

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

function putDayA(game: Shell, yes: boolean): string {
  const e = state(game);
  if (e.interrupted?.length) return game.error(INTERRUPTED_ERROR, 100);
  const updates = availableUpdates(e);
  const fresh = Object.entries(e.fresh ?? {}).filter(
    ([n]) => !e.installed[n] && updates.some(([m]) => m === 'linux-image-amd64' && n.startsWith('linux-image-')),
  );
  const output = [...READ, 'Calculating upgrade... Done'];
  if (!updates.length) return [...output, 'Summary:', '  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0'].join('\n');
  output.push(
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
  if (yes) return [...output, '', next()].join('\n');
  game.ask('Continue? [Y/n] ', (response) => {
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

export const state = (game: Shell): AptState =>
  (game.state.apt ??= { lists: false, installed: Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])) });

// Only root may touch the package database: apt stops at the lock.
const lock = (game: Shell, file: string, what: string) =>
  game.error(`Error: Could not open lock file ${file} - open (13: Permission denied)\nError: ${what}`);

function installer(game: Shell, names: string[], yes: boolean): string {
  const e = state(game);
  if (e.interrupted?.length) return game.error(INTERRUPTED_ERROR, 100);
  const unknown = names.filter((n) => !e.lists || !PACKAGES[n]);
  if (unknown.length) {
    game.state.missingApt = true;
    return game.error([...READ, ...unknown.map((n) => `Error: Unable to locate package ${n}`)].join('\n'));
  }
  const already = names.filter((n) => e.installed[n]);
  const requests = names.filter((n) => !e.installed[n]);
  const dependencies = [...new Set(requests.flatMap((n) => PACKAGES[n].dependencies ?? []))].filter((n) => !e.installed[n] && !requests.includes(n));
  const all = [...dependencies, ...requests];
  const output = [...READ, ...already.map((n) => `${n} is already the newest version (${e.installed[n]}).`)];
  if (!all.length) {
    output.push('Summary:', '  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0');
    return output.join('\n');
  }
  const suggestions = [...new Set(requests.flatMap((n) => PACKAGES[n].suggestions ?? []))];
  const download = all.reduce((t, n) => t + PACKAGES[n].download, 0);
  const place = all.reduce((t, n) => t + PACKAGES[n].installed, 0);
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
      const p = PACKAGES[n];
      lines.push(
        `Get:${i + 1} http://deb.debian.org/debian trixie/main ${p.architecture} ${n} ${p.architecture} ${p.version} [${ko(p.download)}]`,
      );
    });
    lines.push(`Fetched ${ko(download)} in 0s (${ko(download * 4)}/s)`);
    all.forEach((n, i) => {
      const p = PACKAGES[n];
      lines.push(`Selecting previously unselected package ${n}.`);
      if (i === 0) lines.push('(Reading database ... 28412 files and directories currently installed.)');
      lines.push(`Preparing to unpack .../${n}_${p.version.replace(/^\d+:/, '')}_${p.architecture}.deb ...`, `Unpacking ${n} (${p.version}) ...`);
    });
    const failures: string[] = [];
    for (const n of all) {
      const p = PACKAGES[n];
      lines.push(`Setting up ${n} (${p.version}) ...`);
      p.put?.(game);
      e.installed[n] = p.version;
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
  if (yes) return [...output, '', next()].join('\n');
  // The answer comes on the next line, outside sudo: we take the root account back.
  game.ask('Continue? [Y/n] ', (response) => {
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

export const APT: Record<string, Command> = {
  apt: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const yes = args.some((a) => a === '-y' || a === '--yes' || a === '--assume-yes');
      const words = args.filter((a) => !a.startsWith('-'));
      const [action, ...packages] = words;
      const e = state(game);
      if (!action) return game.error(game.t('apt-usage'));
      if (action === 'update') {
        if (game.who !== 'root') return lock(game, '/var/lib/apt/lists/lock', 'Unable to lock directory /var/lib/apt/lists/');
        e.lists = true;
        const n = availableUpdates(e).length;
        return [
          ...SOURCES.map((s, i) => `Get:${i + 1} ${s}`),
          'Fetched 16.4 MB in 2s (8,210 kB/s)',
          ...READ.slice(0, 2),
          n
            ? `${n} package${n > 1 ? 's' : ''} can be upgraded. Run 'apt list --upgradable' to see ${n > 1 ? 'them' : 'it'}.`
            : 'All packages are up to date.',
        ].join('\n');
      }
      if (action === 'install') {
        if (!packages.length) return game.error(`${READ.join('\n')}\nSummary:\n  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0`);
        if (game.who !== 'root')
          return lock(game, '/var/lib/dpkg/lock-frontend', 'Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');
        return installer(game, packages, yes);
      }
      if (action === 'upgrade' || action === 'full-upgrade') {
        if (game.who !== 'root')
          return lock(game, '/var/lib/dpkg/lock-frontend', 'Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');
        return putDayA(game, yes);
      }
      if (action === 'list' && args.includes('--upgradable')) {
        const fresh = availableUpdates(e).map(
          ([n, v]) => `${n}/${(e.origins?.[n] ?? SECURITY).n} ${v} amd64 [upgradable from: ${e.installed[n]}]`,
        );
        return ['Listing... Done', ...fresh.sort()].join('\n');
      }
      if (action === 'list') {
        if (!args.includes('--installed')) return game.error(game.t('apt-list'));
        const lines = Object.entries(e.installed)
          .sort()
          .map(([n, v]) => `${n}/trixie,now ${v} ${PACKAGES[n]?.architecture ?? 'amd64'} [installed]`);
        return ['Listing... Done', ...lines].join('\n');
      }
      return game.error(`Error: Invalid operation ${action}`);
    },
  },
  // dpkg --configure -a: finish configuring the unpacked packages (after an interruption).
  dpkg: {
    section: 1,
    ownOptions: true,
    launch: ({ args, game }) => {
      if (!(args.includes('--configure') && args.includes('-a'))) return game.error(game.t('dpkg-usage'), 2);
      if (game.who !== 'root') return game.error('dpkg: error: requested operation requires superuser privilege', 2);
      const e = state(game);
      const waiting = (e.interrupted ?? []).map((n) => [n, e.inWaiting?.[n] ?? e.installed[n]] as [string, string]);
      if (!waiting.length) return '';
      return configure(game, e, waiting).join('\n');
    },
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
