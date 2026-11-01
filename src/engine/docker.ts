// Simulated Docker: images, containers, volumes, published ports. Based on
// Docker's documentation (https://docs.docker.com/reference/cli/docker/,
// https://docs.docker.com/engine/storage/volumes/): a container writes into
// its own layer, which disappears with it (docker rm); a volume or a
// mounted folder (bind mount) outlives the container; a published port (-p)
// links a port of the machine to the container's.
//
//   state.docker = { images, registry, containers, volumes, next }
//
// The images' applications are simulated (APPS): they write their
// log, read and write their files, and answer over HTTP.
// Differences: no real image layer (the app's files are described by
// the app), no network between containers in this file
// (see docker compose), a single platform.

import type { Node } from './world';
import type { Game } from './shell';
import { writeLog, systemd, toUtc } from './systemd';

export interface Image {
  repo: string;
  tag: string;
  id: string;
  size: number;
  created: number;
  // The application it contains (APPS), and its port.
  app: string;
  port: number;
  command: string;
  // The image's USER (empty: root), and the accounts of its /etc/passwd (name → uid,
  // the primary group has the same number).
  user?: string;
  accounts?: Record<string, number>;
}

export interface Mount {
  type: 'volume' | 'bind';
  source: string;
  target: string;
  onlyRead: boolean;
}

export interface Port {
  ip: string;
  host: number;
  container: number;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  state: 'created' | 'running' | 'exited';
  code: number;
  ports: Port[];
  mounts: Mount[];
  env: Record<string, string>;
  reboot: string;
  created: number;
  start: number;
  end: number;
  // The container's layer: the files it has written (path → content).
  layer: Record<string, string>;
  log: { time: number; text: string }[];
  ip: string;
  // Stopped by hand (docker stop): unless-stopped does not restart it.
  mainAStopped?: boolean;
  // --user (empty: the image's), --read-only, --cap-drop, --security-opt.
  user?: string;
  onlyRead?: boolean;
  capDrop?: string[];
  security?: string[];
}

export interface DockerState {
  images: Record<string, Image>;
  registry: Record<string, Image>;
  containers: Container[];
  // size: what the volume takes beyond its simulated files (a real database, for example).
  volumes: Record<string, { created: number; data: Record<string, string>; size?: number }>;
  next: number;
}

export const docker = (game: Game): DockerState | undefined => game.state.docker;
export const clock = (game: Game) => systemd(game)?.clock ?? 0;

/** An ID of 64 hexadecimal characters, always the same for a given seed. */
export function identifier(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  let s = '';
  while (s.length < 64) {
    h = Math.imul(h ^ s.length, 0x01000193) >>> 0;
    s += (h >>> 4).toString(16).padStart(7, '0');
  }
  return s.slice(0, 64);
}

export const imageName = (i: Image) => `${i.repo}:${i.tag}`;
/** "registry.example/outiltheque" → "registry.example/outiltheque:latest". */
export const complete = (name: string) => (/:[^/]+$/.test(name) ? name : `${name}:latest`);

/** A container by its name or the start of its ID. */
export function findContainer(d: DockerState, key: string): Container | null {
  return d.containers.find((c) => c.name === key) ?? d.containers.find((c) => key.length >= 3 && c.id.startsWith(key)) ?? null;
}

// ——— A container's user ———
// Without --user nor USER in the image, the process runs as root (uid 0).
// Without a user namespace (userns-remap, disabled by default), the
// container's uid is the SAME uid on the machine: root inside is root on the
// mounted files; uid 1000 inside is the machine's account 1000.
// https://docs.docker.com/reference/cli/docker/container/run/#user,
// https://docs.docker.com/engine/security/userns-remap/

export interface Identity {
  uid: number;
  gid: number;
  // The names in the image's /etc/passwd (null: unknown).
  name: string | null;
  group: string | null;
}

export const imageOfContainer = (game: Game, c: Container): Image | undefined => Object.values(docker(game)!.images).find((i) => imageName(i) === c.image);

/** The accounts of an image's /etc/passwd (those of its app, and root). */
export const imageAccounts = (image: Image | undefined): Record<string, number> => ({
  root: 0,
  ...(image ? (APPS[image.app]?.accounts ?? {}) : {}),
  ...(image?.accounts ?? {}),
});
/** An image's default user (the Dockerfile's USER; root if there is none). */
export const imageUser = (image: Image | undefined) => image?.user || (image && APPS[image.app]?.user) || 'root';

/** The process's identity: --user, else the image's USER, else root; or runc's error. */
export function identity(image: Image | undefined, c: Container, request?: string): Identity | { error: string } {
  const accounts = imageAccounts(image);
  const nameFor = (n: number) => Object.entries(accounts).find(([, x]) => x === n)?.[0] ?? null;
  const [u, g] = (request || c.user || imageUser(image)).split(':');
  let uid: number;
  if (/^\d+$/.test(u)) uid = Number(u);
  else if (u in accounts) uid = accounts[u];
  else return { error: `unable to find user ${u}: no matching entries in passwd file` };
  // Without a group: the account's group in the image; a uid unknown to the image gets group 0.
  let gid = nameFor(uid) === null ? 0 : uid;
  if (g !== undefined) {
    if (/^\d+$/.test(g)) gid = Number(g);
    else if (g in accounts) gid = accounts[g];
    else return { error: `unable to find group ${g}: no matching entries in group file` };
  }
  return { uid, gid, name: nameFor(uid), group: nameFor(gid) };
}

/** The name, on the machine, of the account with this uid (otherwise the number). */
export const machineAccount = (game: Game, uid: number) => Object.entries(game.accounts.users).find(([, u]) => u.uid === uid)?.[0] ?? String(uid);
export const machineGroup = (game: Game, gid: number) => Object.entries(game.accounts.groups).find(([, g]) => g.gid === gid)?.[0] ?? String(gid);

/** The rights of a uid and a gid on a file of the machine (like the kernel: by number). */
export function numericAccess(game: Game, n: Node, right: 'r' | 'w' | 'x', uid: number, gid: number): boolean {
  if (uid === 0) return true;
  const mode = n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
  const owner = n.owner ?? game.player;
  const group = n.group ?? owner;
  const numUid = game.accounts.users[owner]?.uid ?? (/^\d+$/.test(owner) ? Number(owner) : -1);
  const numGid = game.accounts.groups[group]?.gid ?? (/^\d+$/.test(group) ? Number(group) : -1);
  const triplet = numUid === uid ? mode.slice(0, 3) : numGid === gid ? mode.slice(3, 6) : mode.slice(6, 9);
  return triplet.includes(right);
}

// The identity of a running container (root if it could not be read).
function who(game: Game, c: Container): Identity {
  const id = identity(imageOfContainer(game, c), c);
  return 'error' in id ? { uid: 0, gid: 0, name: 'root', group: 'root' } : id;
}

// ——— A container's files ———

// The mount that contains this path (the longest one), and the relative path.
function mount(c: Container, path: string): { m: Mount; relative: string } | null {
  const m = c.mounts
    .filter((x) => path === x.target || path.startsWith(x.target.replace(/\/$/, '') + '/'))
    .sort((a, b) => b.target.length - a.target.length)[0];
  return m ? { m, relative: path.slice(m.target.replace(/\/$/, '').length).replace(/^\//, '') } : null;
}

/** Reads a file as seen from the container: volume, mounted folder, or its layer. */
export function readIn(game: Game, c: Container, path: string): string | null {
  const d = docker(game)!;
  const found = mount(c, path);
  if (found?.m.type === 'volume') return d.volumes[found.m.source]?.data[found.relative] ?? null;
  if (found?.m.type === 'bind') return game.read(`${found.m.source.replace(/\/$/, '')}/${found.relative}`);
  return c.layer[path] ?? null;
}

/**
 * Writes a file as seen from the container; returns an error if the mount
 * is read-only, or if the container's user may not write into the mounted
 * folder (it is subject to the machine's rights).
 */
export function writeIn(game: Game, c: Container, path: string, content: string): string | null {
  const d = docker(game)!;
  const found = mount(c, path);
  if (found?.m.onlyRead || (!found && c.onlyRead)) return 'read-only file system';
  if (found?.m.type === 'volume') (d.volumes[found.m.source] ??= { created: clock(game), data: {} }).data[found.relative] = content;
  else if (found?.m.type === 'bind') {
    const id = who(game, c);
    const place = `${found.m.source.replace(/\/$/, '')}/${found.relative}`;
    const n = game.find(place);
    if (n?.type === 'file') {
      if (!numericAccess(game, n, 'w', id.uid, id.gid)) return 'permission denied';
      n.content = content;
    } else {
      const parent = game.find(place.replace(/\/[^/]+$/, ''));
      if (parent?.type !== 'directory') return 'no such file or directory';
      if (!numericAccess(game, parent, 'w', id.uid, id.gid) || !numericAccess(game, parent, 'x', id.uid, id.gid)) return 'permission denied';
      // The created file belongs, on the machine, to the container's uid.
      parent.children[place.split('/').at(-1)!] = {
        type: 'file',
        content,
        lines: true,
        owner: machineAccount(game, id.uid),
        group: machineGroup(game, id.gid),
      };
    }
  } else c.layer[path] = content;
  return null;
}

/** Creates a folder as seen from the container (mkdir); same rules as writeIn. */
export function createDirectoryIn(game: Game, c: Container, path: string): string | null {
  const found = mount(c, path);
  if (found?.m.type !== 'bind') return null;
  const place = `${found.m.source.replace(/\/$/, '')}/${found.relative}`;
  if (game.find(place)?.type === 'directory') return null;
  if (found.m.onlyRead) return 'read-only file system';
  const parent = game.find(place.replace(/\/[^/]+$/, ''));
  const id = who(game, c);
  if (parent?.type !== 'directory') return 'no such file or directory';
  if (!numericAccess(game, parent, 'w', id.uid, id.gid)) return 'permission denied';
  parent.children[place.split('/').at(-1)!] = { type: 'directory', children: {}, owner: machineAccount(game, id.uid), group: machineGroup(game, id.gid) };
  return null;
}

/** The machine's file behind a container path (mounted folder), if there is one. */
export function nodeIn(game: Game, c: Container, path: string): Node | null {
  const found = mount(c, path);
  if (found?.m.type !== 'bind') return null;
  return game.find(`${found.m.source.replace(/\/$/, '')}/${found.relative}`.replace(/\/$/, '')) ?? null;
}

/** May the container's user do this on this path (mounted folder)? */
export function canIn(game: Game, c: Container, path: string, right: 'r' | 'w' | 'x'): boolean {
  const n = nodeIn(game, c, path);
  const id = who(game, c);
  return !n || numericAccess(game, n, right, id.uid, id.gid);
}

/** The files visible under a place of the container (absolute paths). */
export function listIn(game: Game, c: Container, place: string): string[] {
  const d = docker(game)!;
  const base = place.replace(/\/$/, '');
  const found = mount(c, base);
  if (found?.m.type === 'volume')
    return Object.keys(d.volumes[found.m.source]?.data ?? {}).map((r) => `${found.m.target.replace(/\/$/, '')}/${r}`);
  if (found?.m.type === 'bind') {
    const n = game.find(found.m.source);
    return n?.type === 'directory' ? Object.keys(n.children).map((k) => `${found.m.target.replace(/\/$/, '')}/${k}`) : [];
  }
  return Object.keys(c.layer).filter((p) => p.startsWith(base + '/'));
}

// ——— The applications ———

export interface App {
  // On start: writes its log, prepares its files; returns the exit code
  // if it stops right away (otherwise null: it runs).
  start(game: Game, c: Container, image: Image): number | null;
  // An HTTP request on its port.
  answer(game: Game, c: Container, path: string): { code: number; body: string };
  // The image's files (what a new container contains).
  files?: (image: Image) => Record<string, string>;
  // The image's USER (absent: root) and the accounts of its /etc/passwd.
  user?: string;
  accounts?: Record<string, number>;
}

// The images' applications, declared by the chapters.
export const APPS: Record<string, App> = {};

/** A line of a container's log (docker logs). */
export function log(game: Game, c: Container, text: string) {
  c.log.push({ time: clock(game), text });
}

/**
 * Starts a container: its app prepares its files and writes its log.
 * Returns runc's error if the process could not be created (user unknown to
 * the image): the container then stays "Created".
 */
export function launch(game: Game, c: Container): string | null {
  const d = docker(game)!;
  const image = Object.values(d.images).find((i) => imageName(i) === c.image)!;
  const id = identity(image, c);
  if ('error' in id) {
    c.state = c.state === 'running' ? 'exited' : c.state;
    if (c.state === 'exited') c.code = 127;
    return `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: ${id.error}: unknown`;
  }
  c.state = 'running';
  c.start = clock(game);
  c.mainAStopped = false;
  const code = APPS[image.app]?.start(game, c, image) ?? null;
  if (code !== null) {
    c.state = 'exited';
    c.code = code;
    c.end = clock(game);
  }
  return null;
}

/**
 * Docker restarts by itself a container that failed, with a delay that
 * doubles at each failure, if its --restart policy allows it (always,
 * unless-stopped, on-failure): called after each command by the chapters
 * that need it (one attempt per command).
 */
export function restartInLoop(game: Game) {
  const d = docker(game);
  const service = systemd(game)?.services.docker;
  if (!d || (service && service.state !== 'active')) return;
  for (const c of d.containers)
    if (c.state === 'exited' && c.code !== 0 && !c.mainAStopped && ['always', 'unless-stopped', 'on-failure'].includes(c.reboot.split(':')[0]))
      launch(game, c);
}

export function stop(game: Game, c: Container, mainA = true) {
  if (c.state !== 'running') return;
  c.state = 'exited';
  // SIGTERM: the app stops cleanly (exit code 0 here).
  c.code = 0;
  c.end = clock(game);
  if (mainA) c.mainAStopped = true;
}

/**
 * When the docker service starts (after a reboot of the machine): the
 * containers stopped by the daemon's shutdown start again according to their
 * --restart policy (always, unless-stopped if they were not stopped by hand).
 */
export function startDocker(game: Game) {
  const d = docker(game);
  if (!d) return;
  for (const c of d.containers) {
    const before = c.state === 'running';
    if (before) stop(game, c, false);
    const restarts =
      c.reboot === 'always' ||
      (c.reboot === 'unless-stopped' && !c.mainAStopped) ||
      (c.reboot.startsWith('on-failure') && c.code !== 0);
    if (restarts) launch(game, c);
  }
  const sd = systemd(game);
  if (sd) writeLog(sd, 'docker.service', 'dockerd', 702, 'Daemon has completed initialization');
}

/**
 * An HTTP request to a port of the machine: the container that publishes it
 * answers (undefined: no container publishes this port; null: it does not
 * answer, stopped).
 */
export function dockerRequest(game: Game, address: string, port: number, path: string): { code: number; body: string } | null | undefined {
  const d = docker(game);
  if (!d) return undefined;
  const local = ['127.0.0.1', 'localhost'].includes(address);
  // From the machine, the container's address (bridge network) also answers on its port.
  const direct = d.containers.find((c) => c.ip === address && c.state === 'running');
  const published = (x: Container) => x.ports.some((p) => p.host === port && (p.ip === '0.0.0.0' || (p.ip === '127.0.0.1' && local)));
  // The running container first; a stopped container no longer answers (the port is no longer forwarded).
  const c = direct ?? d.containers.find((x) => x.state === 'running' && published(x)) ?? d.containers.find((x) => x.state === 'exited' && published(x));
  if (!c) return undefined;
  if (c.state !== 'running') return null;
  const image = Object.values(d.images).find((i) => imageName(i) === c.image)!;
  if (direct && port !== image.port) return null;
  return APPS[image.app]?.answer(game, c, path) ?? null;
}

// ——— Affichage ———

/** "2 weeks ago", "3 minutes ago", like docker. */
export function yaIt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const units: [number, string][] = [
    [365 * 86400, 'year'],
    [30 * 86400, 'month'],
    [7 * 86400, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];
  if (s < 1) return 'Less than a second';
  for (const [n, u] of units)
    if (s >= n) {
      const k = Math.floor(s / n);
      if (u === 'hour' && k === 1) return 'About an hour';
      return k === 1 ? `${u === 'hour' ? 'An' : 'A'} ${u}` : `${k} ${u}s`;
    }
  return `${s} seconds`;
}

/** "148MB", like docker images. */
export function dockerSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2).replace(/\.?0+$/, '')}GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e5) / 10}MB`.replace(/\.0MB$/, 'MB');
  if (bytes >= 1e3) return `${Math.round(bytes / 100) / 10}kB`;
  return `${bytes}B`;
}

/** The UTC time of a local instant, in RFC 3339 format (docker logs -t, inspect). */
export const rfc3339 = (local: number) => new Date(toUtc(local)).toISOString().replace(/\.\d+Z$/, '.000000000Z');

// ——— The network and the disk seen from the machine ———

/** The docker-proxy sockets for the published ports (for ss). */
export function dockerListeners(game: Game): { proto: 'tcp'; address: string; port: number; process: string; pid: number }[] {
  const d = docker(game);
  if (!d) return [];
  return d.containers
    .filter((c) => c.state === 'running')
    .flatMap((c, i) =>
      c.ports.flatMap((p) => {
        const pid = 3100 + i * 10 + (p.host % 7);
        const v4 = { proto: 'tcp' as const, address: p.ip, port: p.host, process: 'docker-proxy', pid };
        return p.ip === '0.0.0.0' ? [v4, { ...v4, address: '[::]', pid: pid + 1 }] : [v4];
      }),
    );
}

/**
 * A port published to the outside on all addresses (0.0.0.0): Docker
 * writes its own iptables rules (DOCKER chain, nat table), consulted
 * BEFORE ufw's. The packet is redirected to the container without ever
 * going through ufw's rules: it gets in, whatever ufw status says.
 * https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw
 */
export function publishedToWorld(game: Game, port: number): boolean {
  const d = docker(game);
  return !!d?.containers.some((c) => c.state === 'running' && c.ports.some((p) => p.host === port && p.ip === '0.0.0.0'));
}

/**
 * The containers' processes, seen from the machine (ps aux): there they are
 * processes like any other, under the name of the account with their uid.
 */
export function dockerProcess(game: Game): { pid: number; user: string; cpu: number; mem: number; command: string }[] {
  const d = docker(game);
  if (!d) return [];
  return d.containers
    .filter((c) => c.state === 'running')
    .map((c, i) => ({
      pid: 3400 + i * 37,
      user: machineAccount(game, who(game, c).uid),
      cpu: 0.3,
      mem: 1.8,
      command: imageOfContainer(game, c)?.command ?? '',
    }));
}

/** The space Docker takes on the disk (images, containers, volumes), in bytes. */
export function placeDocker(d: DockerState): { images: number; containers: number; volumes: number } {
  const volumes = Object.values(d.volumes).reduce((t, v) => t + Object.values(v.data).reduce((a, x) => a + x.length, 0) + (v.size ?? 0), 0);
  return { images: Object.values(d.images).reduce((t, i) => t + i.size, 0), containers: d.containers.length * 4096, volumes };
}

/** Updates /var/lib/docker on the simulated disk (for df and du). */
export function diskUpdate(game: Game) {
  const d = docker(game);
  const n = game.find('/var/lib/docker');
  if (!d || n?.type !== 'directory') return;
  const p = placeDocker(d);
  n.children = {
    overlay2: {
      type: 'directory',
      owner: 'root',
      mode: 'rwx--x---',
      children: { couches: { type: 'file', content: '', size: p.images + p.containers, owner: 'root' } },
    },
    volumes: {
      type: 'directory',
      owner: 'root',
      mode: 'rwx------',
      children: { donnees: { type: 'file', content: '', size: p.volumes, owner: 'root' } },
    },
  };
}
