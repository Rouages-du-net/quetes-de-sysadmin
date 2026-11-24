// Story "The Walking Club": what its chapters share. Open Paths, a walking
// club run by volunteers (Sentiers ouverts in French, Senderos Abiertos in
// Spanish), publishes its walks and takes the sign-ups through Trailbook, a
// small web app in a container image, behind nginx on cairn (hito in
// Spanish), the club's Debian 13 server. Soo-ah chairs the club; Bolat, a
// volunteer, ran Trailbook with Docker as root in 2031; Ayasha created the
// service account trailbook and started moving it to rootless Podman.
// Machines: cairn, 192.0.2.176 (RFC 5737); the site walks.openpaths.example
// (RFC 6761), nginx on 80 and 443 proxying to 127.0.0.1:8080; Ayasha's PC on
// the office network 198.51.100.0/24.
// Chapter 1: Docker stopped, the app back under trailbook, rootless:
// subordinate ids, the image pulled, port 8080 behind nginx, the data's
// owner seen through the user namespace (:U, keep-id or podman unshare chown).
// Chapter 2: the container died with Ayasha's session; a Quadlet unit, the
// account lingering, a reboot to prove it.
// Sources: https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html,
// https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html,
// https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md,
// subuid(5), loginctl(1), https://www.freedesktop.org/software/systemd/man/latest/loginctl.html.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, toUtc, type Systemd } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { player } from '../world';
import { applySysctl, sysctlToBoot } from '../commands/nftables';
import { numericAccess, machineAccount, machineGroup } from '../docker';
import { PAPPS, REGISTRY, freshMaps, hostPath, podman, settle, store, uidOf, type PContainer, type PImage } from '../podman';

export const HOME = '/home/you';
export const PASSWORD = 'switchback-27';
export type ChapterNo = 1 | 2;
export const CAIRN = '192.0.2.176';
export const AYASHA_PC = '198.51.100.23';
export const SITE = 'walks.openpaths.example';
export const IMAGE = 'registry.example/openpaths/trailbook:2.3';
export const DATA = '/srv/trailbook/data';
export const DB = `${DATA}/trailbook.db`;
export const SERVICE_HOME = '/var/lib/trailbook';
export const QUADLET_DIR = `${SERVICE_HOME}/.config/containers/systemd`;
// The service account (useradd --system: below 1000, no subordinate ids).
export const SERVICE_UID = 997;
// The first free subordinate range on cairn (after you, bolat and ayasha).
export const FREE_RANGE = 296608;
const DB_CONTENT = 'SQLite format 3 (Trailbook: 412 walks, 1873 sign-ups)';
export const WALKS = 412;
export const SIGNUPS = 1873;
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2033, 3, 12, 9, 20, 0), 2: Date.UTC(2033, 3, 14, 9, 5, 0) };
const BOOTED = Date.UTC(2033, 2, 30, 6, 12, 0);
export const LOGOUT = Date.UTC(2033, 3, 13, 18, 2, 11);

// ——— The image and its app ———

REGISTRY[IMAGE] = {
  ref: IMAGE,
  app: 'trailbook',
  user: 1000,
  group: 1000,
  accounts: { root: 0, trailbook: 1000, nobody: 65534 },
  port: 8080,
  command: '/usr/local/bin/trailbook serve --data /data',
  size: 142_318_592,
  created: Date.UTC(2033, 2, 20, 14, 3, 0),
  // Debian's base image: /etc/gshadow belongs to the group shadow (42).
  foreign: { path: '/etc/gshadow', uid: 0, gid: 42 },
};

const stamp = (game: Game) => new Date(toUtc((systemd(game) as Systemd).clock)).toISOString();
const slog = (game: Game, level: string, msg: string, extra = '') => `time=${stamp(game)} level=${level} msg=${/\s/.test(msg) ? `"${msg}"` : msg}${extra ? ` ${extra}` : ''}`;

/** The database the app opened: the club's (intact), an empty one it created, or none. */
const opened = (c: PContainer): 'club' | 'empty' => (c.files['/data/trailbook.db'] === 'empty' ? 'empty' : 'club');

PAPPS.trailbook = {
  start(game, c, uid, gid) {
    const log = [slog(game, 'INFO', 'trailbook 2.3.0 starting')];
    const host = hostPath(c, '/data');
    const may = (n: Node, r: 'r' | 'w' | 'x') => numericAccess(game, n, r, uid, gid);
    if (!host) {
      // No folder of the machine at /data: a fresh database in the container (or a new volume).
      c.files['/data/trailbook.db'] = 'empty';
      log.push(slog(game, 'WARN', 'database created', 'path=/data/trailbook.db walks=0 signups=0'), slog(game, 'INFO', 'listening', 'addr=0.0.0.0:8080'));
      return { ok: true, log };
    }
    const dir = game.find(host);
    const db = game.find(`${host}/trailbook.db`);
    const blocked = !dir || dir.type !== 'directory' || !may(dir, 'x') || !may(dir, 'w') || (db && (!may(db, 'r') || !may(db, 'w')));
    if (blocked) {
      log.push(slog(game, 'ERROR', 'cannot open database', 'path=/data/trailbook.db err="unable to open database file: permission denied"'));
      return { ok: false, log };
    }
    if (!db) {
      dir.children['trailbook.db'] = { type: 'file', content: 'SQLite format 3', owner: machineAccount(game, uid), group: machineGroup(game, gid), mode: 'rw-r--r--', size: 24_576 };
      c.files['/data/trailbook.db'] = 'empty';
      log.push(slog(game, 'WARN', 'database created', 'path=/data/trailbook.db walks=0 signups=0'));
    } else {
      const club = (game.read(`${host}/trailbook.db`) ?? '') === DB_CONTENT;
      c.files['/data/trailbook.db'] = club ? 'club' : 'empty';
      log.push(slog(game, 'INFO', 'database opened', `path=/data/trailbook.db walks=${club ? WALKS : 0} signups=${club ? SIGNUPS : 0}`));
    }
    log.push(slog(game, 'INFO', 'listening', 'addr=0.0.0.0:8080'));
    return { ok: true, log };
  },
  answer(game, c, path) {
    const club = opened(c) === 'club';
    if (path !== '/' && !path.startsWith('/walks')) return { code: 404, body: '404 page not found' };
    return { code: 200, body: game.t('walking-club-page', { walks: String(club ? WALKS : 0), signups: String(club ? SIGNUPS : 0) }) };
  },
};

// ——— Who answers on 127.0.0.1:8080, and the site through nginx ———

/** The running container that publishes this port of the machine, if any. */
export function publisher(game: Game, port: number): { c: PContainer; image: PImage } | null {
  for (const s of Object.values(podman(game).users))
    for (const c of s.containers)
      if (c.state === 'running' && c.ports.some((p) => p.host === port && ['', '0.0.0.0', '127.0.0.1'].includes(p.ip))) return { c, image: s.images[c.image] };
  return null;
}

/** What nginx serves for the site: the app behind it, or 502. */
export function site(game: Game, path = '/'): { code: number; body: string } {
  const sd = systemd(game) as Systemd;
  if (sd.services.nginx?.state !== 'active') return { code: 0, body: '' };
  const p = publisher(game, 8080);
  if (!p) return { code: 502, body: BAD_GATEWAY };
  return PAPPS[p.image.app].answer(game as Shell, p.c, path);
}
const BAD_GATEWAY = '<html>\n<head><title>502 Bad Gateway</title></head>\n<body>\n<center><h1>502 Bad Gateway</h1></center>\n<hr><center>nginx/1.26.3</center>\n</body>\n</html>';

/** The site answers with the club's walks (through nginx). */
export const siteUp = (game: Game) => {
  const r = site(game);
  return r.code === 200 && r.body.includes(String(SIGNUPS));
};

const CURL_VALUED = ['-H', '--header', '-o', '--output', '-w', '--write-out', '-X', '--request', '-A', '--user-agent', '-m', '--max-time', '--connect-timeout', '-u', '--user'];
const STATUS: Record<number, string> = { 200: 'OK', 404: 'Not Found', 502: 'Bad Gateway' };

/** curl on cairn towards the site, nginx or the app's port (null: curl's own way). */
export function walksCurl(from: Shell, args: string[]): string | null {
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (CURL_VALUED.includes(args[i])) i++;
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(positional[0] ?? '');
  if (!m) return null;
  const host = m[2].toLowerCase();
  const local = ['localhost', '127.0.0.1', CAIRN, SITE, 'cairn', 'cairn.internal', machineName(from.t, 'cairn'), `${machineName(from.t, 'cairn')}.internal`].includes(host);
  if (!local) return null;
  const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
  const path = m[4] || '/';
  settle(from);
  let r: { code: number; body: string } | null = null;
  let server = 'nginx/1.26.3';
  if (port === 80 || port === 443) {
    r = site(from, path);
    if (r.code === 0) return from.error(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`, 7);
  } else {
    const p = publisher(from, port);
    if (!p) return from.error(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`, 7);
    r = PAPPS[p.image.app].answer(from, p.c, path);
    server = '';
  }
  const headers = [`HTTP/1.1 ${r.code} ${STATUS[r.code] ?? ''}`.trim(), ...(server ? [`Server: ${server}`] : []), `Content-Type: text/html; charset=utf-8`];
  if (args.includes('-I') || args.includes('--head')) return headers.join('\n');
  if (args.includes('-i') || args.includes('--include')) return `${headers.join('\n')}\n\n${r.body}`;
  return r.body;
}

// ——— The machine ———

export const walkAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    nobody: { uid: 65534, group: 'nogroup', home: '/nonexistent', shell: '/usr/sbin/nologin' },
    trailbook: { uid: SERVICE_UID, group: 'trailbook', home: SERVICE_HOME, shell: '/bin/bash' },
    you: { uid: 1000, group: 'you' },
    bolat: { uid: 1001, group: 'bolat' },
    ayasha: { uid: 1002, group: 'ayasha' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    sudo: { gid: 27, members: ['you', 'ayasha'] },
    nogroup: { gid: 65534, members: [] },
    trailbook: { gid: SERVICE_UID, members: [] },
    you: { gid: 1000, members: [] },
    bolat: { gid: 1001, members: [] },
    ayasha: { gid: 1002, members: [] },
  },
});

const root: Rights = { owner: 'root', group: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });

const subIdsFile = (t: Translate, extra: string) => `${player(t)}:100000:65536\nbolat:165536:65536\nayasha:231072:65536${extra}`;

const NGINX_SITE = `# walks.openpaths.example: Trailbook, behind nginx (Bolat, 2031)
server {
    listen 80;
    listen [::]:80;
    server_name ${SITE};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${SITE};

    ssl_certificate     /etc/ssl/walks/fullchain.pem;
    ssl_certificate_key /etc/ssl/walks/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

const REGISTRIES = `# For more information on this configuration file, see containers-registries.conf(5).
#
# NOTE: RISK OF USING UNQUALIFIED IMAGE NAMES
# We recommend always using fully qualified image names including the registry
# server (full dns name), namespace, image name, and tag
# (e.g., registry.redhat.io/ubi8/ubi:latest). Pulling by digest (i.e.,
# quay.io/repository/name@digest) further eliminates the ambiguity of tags.
#
# # An array of host[:port] registries to try when pulling an unqualified image, in order.
# unqualified-search-registries = ["example.com"]`;

export function walkState(t: Translate, n: ChapterNo) {
  const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.4, command });
  return {
    systemd: newSystemd(machineName(t, 'cairn'), BOOTED, NOW[n], {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(598, 'root', '/usr/sbin/cron -f')] },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        process: [proc(702, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;'), proc(703, 'www-data', 'nginx: worker process')],
      },
      docker: { description: 'Docker Application Container Engine', active: false, state: 'inactive', executable: 'dockerd' },
    }),
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 611 },
      { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 702 },
      { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 702 },
      { proto: 'tcp', address: '[::]', port: 80, process: 'nginx', pid: 702 },
      { proto: 'tcp', address: '[::]', port: 443, process: 'nginx', pid: 702 },
    ],
    apt: {
      installed: { podman: '5.4.2+ds1-2+b2', passt: '0.0~git20250503.587980c-2+deb13u1', uidmap: '1:4.17.4-2', crun: '1.21-1', conmon: '2.1.12-4', 'containers-storage': '1.57.2+ds1-1', nginx: '1.26.3-3+deb13u1' },
    },
    mounts: [{ path: '/', capacity: 120 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
    storyCurl: walksCurl,
    walking: { chapter: n, boot: 1 },
  };
}

export function walkWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const host = machineName(t, 'cairn');
  const key = generateKey('walking-cairn', `you@${host}`);
  const trailbookIds = n === 2 ? `\ntrailbook:${FREE_RANGE}:65536` : '';
  // Chapter 2: chapter 1 done (data chowned through :U to the container's user, 296608 + 999).
  const dataOwner: Rights = n === 1 ? { owner: 'you', group: 'you' } : { owner: String(FREE_RANGE + 999), group: String(FREE_RANGE + 999) };
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(`127.0.0.1\tlocalhost\n${CAIRN}\t${host}.internal ${host}\n\n::1\tlocalhost ip6-localhost ip6-loopback`),
      subuid: file(subIdsFile(t, trailbookIds)),
      subgid: file(subIdsFile(t, trailbookIds)),
      'sysctl.d': dir({}),
      containers: dir({ 'registries.conf': file(REGISTRIES), systemd: dir({ users: dir({}) }) }),
      nginx: dir({ 'sites-available': dir({ walks: file(NGINX_SITE) }), 'sites-enabled': dir({ walks: file(NGINX_SITE) }) }),
      systemd: dir({ system: dir({}) }),
    }),
    home: dir({
      you: d({
        ...home,
        '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }),
      }),
      bolat: dir({}, { owner: 'bolat', group: 'bolat', mode: 'rwx------' }),
      ayasha: dir({}, { owner: 'ayasha', group: 'ayasha', mode: 'rwx------' }),
    }),
    srv: dir({
      trailbook: dir({
        data: dir({ 'trailbook.db': f(DB_CONTENT, { lines: true, ...dataOwner, mode: 'rw-r--r--', size: 2_412_544 }) }, { ...dataOwner, mode: 'rwxr-xr-x' }),
        'README.txt': file(t('walking-club-readme')),
      }),
    }),
    var: dir({
      lib: dir({
        trailbook: dir(
          {
            '.config': dir(n === 2 ? { containers: dir({ systemd: dir({}, { owner: 'trailbook', group: 'trailbook' }) }, { owner: 'trailbook', group: 'trailbook' }) } : {}, { owner: 'trailbook', group: 'trailbook' }),
          },
          { owner: 'trailbook', group: 'trailbook', mode: 'rwxr-x---' },
        ),
        systemd: dir({ linger: dir({}) }),
      }),
      log: dir({ nginx: dir({ 'error.log': file(n === 2 ? nginxErrors() : '', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) }) }),
      run: dir(n === 2 ? { 'reboot-required': file('*** System restart required ***'), 'reboot-required.pkgs': file('linux-image-6.12.48+deb13-amd64') } : {}),
    }),
    run: dir({ user: dir({}) }),
    proc: dir({ sys: dir({ net: dir({ ipv4: dir({ ip_unprivileged_port_start: file('1024'), ip_forward: file('0'), ping_group_range: file('0\t2147483647') }) }) }) }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

/** nginx's errors since Ayasha logged out (chapter 2). */
function nginxErrors(): string {
  const out: string[] = [];
  for (let k = 0; k < 6; k++) {
    const t = new Date(LOGOUT + 47_000 + k * 7_313_000);
    const s = t.toISOString().replace('T', ' ').slice(0, 19).replace(/-/g, '/');
    out.push(`${s} [error] 703#703: *${1841 + k * 3} connect() failed (111: Connection refused) while connecting to upstream, client: 203.0.113.${40 + k}, server: ${SITE}, request: "GET / HTTP/2.0", upstream: "http://127.0.0.1:8080/", host: "${SITE}"`);
  }
  return out.join('\n');
}

// ——— The story's state over time ———

/** The past of chapter 2: Ayasha's session as trailbook, her container, her logout. */
export function initialiseStory(j: Game, n: ChapterNo) {
  const s = j as Shell;
  const sd = systemd(s) as Systemd;
  const p = podman(s);
  p.boot = sd.boot;
  (s.state.walking as { boot: number }).boot = sd.boot;
  if (n === 1) {
    settle(s);
    return;
  }
  // Chapter 1's result: the namespace with trailbook's ranges, the image pulled.
  const st = store(s, 'trailbook');
  st.images[IMAGE] = { ...REGISTRY[IMAGE], id: '8c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e' };
  const saved = sd.clock;
  const uid = uidOf(s, 'trailbook');
  const at = (t: number, unit: string, ident: string, pid: number, message: string, extra: Partial<(typeof sd.log)[number]> = {}) =>
    sd.log.push({ time: t, boot: sd.boot, unit, ident, pid, message, priority: 6, ...extra });
  const start = Date.UTC(2033, 3, 13, 16, 41, 2);
  at(start, 'ssh.service', 'sshd', 2981, `Accepted publickey for trailbook from ${AYASHA_PC} port 51234 ssh2: ED25519 SHA256:q3Wm8XoQ1lZb7rT2c9KdV4n6yP0eHsJuAiFgLxCvBkM`);
  at(start, 'ssh.service', 'sshd', 2981, 'pam_unix(sshd:session): session opened for user trailbook(uid=997) by trailbook(uid=0)');
  at(start, 'systemd-logind.service', 'systemd-logind', 455, 'New session 41 of user trailbook.');
  at(start + 1000, `user@${uid}.service`, 'systemd', 1, `Starting user@${uid}.service - User Manager for UID ${uid}...`);
  at(start + 1000, `user@${uid}.service`, 'systemd', 1, `Started user@${uid}.service - User Manager for UID ${uid}.`);
  const run = Date.UTC(2033, 3, 13, 16, 47, 30);
  const id = '4b7e1c9a2f3d5e6b8a0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';
  st.containers.push({
    id,
    name: 'trailbook',
    image: IMAGE,
    owner: 'trailbook',
    state: 'exited',
    code: 143,
    created: run,
    started: run,
    finished: LOGOUT + 1000,
    ports: [{ ip: '127.0.0.1', host: 8080, container: 8080 }],
    mounts: [{ source: DATA, target: '/data', options: ['U'] }],
    network: 'pasta',
    userns: '',
    maps: freshMaps(s, 'trailbook'),
    log: [
      `time=2033-04-13T14:47:31.204Z level=INFO msg="trailbook 2.3.0 starting"`,
      `time=2033-04-13T14:47:31.388Z level=INFO msg="database opened" path=/data/trailbook.db walks=${WALKS} signups=${SIGNUPS}`,
      `time=2033-04-13T14:47:31.390Z level=INFO msg=listening addr=0.0.0.0:8080`,
      `time=2033-04-13T16:02:12.006Z level=INFO msg="shutting down" signal=terminated`,
    ].map((text) => ({ time: run, text })),
    scope: 'manager',
    remove: false,
    boot: sd.boot,
    files: { '/data/trailbook.db': 'club' },
  });
  at(LOGOUT, 'ssh.service', 'sshd', 2981, `Disconnected from user trailbook ${AYASHA_PC} port 51234`);
  at(LOGOUT, 'ssh.service', 'sshd', 2981, 'pam_unix(sshd:session): session closed for user trailbook');
  at(LOGOUT, 'systemd-logind.service', 'systemd-logind', 455, 'Session 41 logged out. Waiting for processes to exit.');
  at(LOGOUT, 'systemd-logind.service', 'systemd-logind', 455, 'Removed session 41.');
  at(LOGOUT + 1000, `user@${uid}.service`, 'systemd', 1, `Stopping user@${uid}.service - User Manager for UID ${uid}...`);
  at(LOGOUT + 1000, `user@${uid}.service`, 'systemd', 2990, `Stopped libpod-${id}.scope - libcrun container.`, { user: 'trailbook', userUnit: `libpod-${id}.scope` });
  at(LOGOUT + 1000, `user@${uid}.service`, 'systemd', 2990, 'Reached target exit.target - Exit the Session.', { user: 'trailbook' });
  at(LOGOUT + 2000, `user@${uid}.service`, 'systemd', 1, `user@${uid}.service: Deactivated successfully.`);
  at(LOGOUT + 2000, `user@${uid}.service`, 'systemd', 1, `Stopped user@${uid}.service - User Manager for UID ${uid}.`);
  sd.log.sort((a, b) => a.time - b.time);
  sd.clock = saved;
  settle(s);
}

/** After each command: a reboot reapplies the sysctl files; Podman's model follows systemd. */
export function passTime(j: Game) {
  const s = j as Shell;
  const sd = systemd(s) as Systemd;
  // Each command takes a few seconds.
  sd.clock += 5000;
  const w = s.state.walking as { boot: number };
  if (w.boot !== sd.boot) {
    w.boot = sd.boot;
    applySysctl(s, { 'net.ipv4.ip_unprivileged_port_start': '1024' });
  }
  settle(s);
}

// ——— What the chapters check ———

export const seen = (j: Game, text: string | RegExp) => {
  const last = (j as Shell).last;
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(last.line)) return false;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const typed = (j: Game) => (j as Shell).last.line ?? '';

/** The service account's running containers, and root's (rootful). */
export const running = (j: Game, user: string) => store(j, user).containers.filter((c) => c.state === 'running');
/** trailbook's container serving the club's data from /srv/trailbook/data. */
export const serving = (j: Game) => running(j, 'trailbook').find((c) => c.image === IMAGE && c.mounts.some((m) => !m.volume && m.source === DATA && m.target === '/data') && opened(c) === 'club');

/** The unprivileged port start, now and after a reboot. */
export const portStart = (j: Game) => Number((j.read('/proc/sys/net/ipv4/ip_unprivileged_port_start') ?? '1024').trim());
export const portStartAtBoot = (j: Game) => Number(sysctlToBoot(j, 'net.ipv4.ip_unprivileged_port_start', '1024'));
export const portsLowered = (j: Game) => portStart(j) < 1024 || portStartAtBoot(j) < 1024;

/** The data opened to everybody (chmod 777 or o+w). */
export const worldWritable = (j: Game) => [DATA, DB].some((p) => (j.find(p)?.mode ?? '').charAt(7) === 'w');
/** The club's database is still the club's. */
export const dataIntact = (j: Game) => j.read(DB) === DB_CONTENT;

/** trailbook's subordinate ranges, and whether they overlap another account's. */
export function ranges(j: Game): { ok: boolean; overlap: boolean } {
  const read = (file: string) =>
    (j.read(file) ?? '')
      .split('\n')
      .map((l) => l.trim().split(':'))
      .filter((p) => p.length === 3)
      .map(([who, start, count]) => ({ who, start: Number(start), end: Number(start) + Number(count) }));
  let ok = true;
  let overlap = false;
  for (const file of ['/etc/subuid', '/etc/subgid']) {
    const all = read(file);
    const mine = all.filter((r) => r.who === 'trailbook' || r.who === String(SERVICE_UID));
    if (!mine.some((r) => r.end - r.start >= 65536)) ok = false;
    if (mine.some((m) => all.some((o) => o.who !== m.who && o.who !== String(SERVICE_UID) && o.who !== 'trailbook' && m.start < o.end && o.start < m.end))) overlap = true;
  }
  return { ok, overlap };
}
