// Rootless Podman, as Debian 13 ships it (podman 5.4.2+ds1-2+b2, passt
// 0.0~git20250503.587980c, systemd 257): each account has its own images
// and containers (~/.local/share/containers), in a user namespace that maps
// the container's uid 0 to the account and 1..N to its subordinate ids
// (/etc/subuid, /etc/subgid); pasta forwards the published ports from the
// host's network as an ordinary process of the account, so a port below
// net.ipv4.ip_unprivileged_port_start is refused; containers started from
// a user session live in the account's service manager (user@UID.service),
// which stops when its last session ends unless the account lingers
// (loginctl enable-linger); Quadlet (podman-systemd.unit(5)) turns
// ~/.config/containers/systemd/*.container into user services at each
// daemon-reload and when the manager starts.
//
//   state.podman = { users: { ACCOUNT: { images, containers, pause } },
//                    managers: { ACCOUNT: { since, units } }, boot }
//
// Sources: https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html,
// https://docs.podman.io/en/v5.4.2/markdown/podman-unshare.1.html,
// https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html,
// https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md,
// and Podman v5.4.2's sources: pkg/rootless/rootless_linux.go (the single
// mapping warning), containers/storage's idtools.go (subuid ranges,
// "potentially insufficient UIDs or GIDs"), containers/common's config.go
// (the user session warnings), libnetwork/pasta (the pasta error), the
// vendored rootlesskit's parent.go (rootlessport's privileged port error),
// chown_unix.go (:U), cmd/quadlet and pkg/systemd/quadlet (the generated
// unit, its messages).
// Simplifications: one registry the story declares (REGISTRY), the images'
// apps simulated (PAPPS); the pause process is the account's mapping, kept
// until podman system migrate or a reboot; no pods, no networks but pasta
// and slirp4netns; podman run without -d returns like -d.

import type { Game, Shell } from './shell';
import type { Directory, Node } from './world';
import { systemd, start as startUnit, type Systemd } from './systemd';
import { identifier, machineAccount, machineGroup, numericAccess } from './docker';
import type { Process } from './commands/system';
import type { Listening } from './commands/ss';

export const VERSION = '5.4.2';
// The kernel's overflow ids: what a namespace shows for an id it doesn't map.
export const OVERFLOW = 65534;

export interface IdMap {
  container: number;
  host: number;
  size: number;
}
export interface Maps {
  uid: IdMap[];
  gid: IdMap[];
  // Built without subordinate ids (the account only): "single mapping".
  single: boolean;
}

/** An image of the registry, declared by the story. */
export interface ImageSpec {
  ref: string;
  app: string;
  // The image's USER (its uid and gid inside), and the accounts of its /etc/passwd.
  user: number;
  group: number;
  accounts: Record<string, number>;
  port: number;
  command: string;
  size: number;
  created: number;
  // A file of its layers owned by an id other than 0 (a single mapping can't hold it).
  foreign: { path: string; uid: number; gid: number };
}
export const REGISTRY: Record<string, ImageSpec> = {};

export interface PImage extends ImageSpec {
  id: string;
}
export interface PMount {
  source: string;
  target: string;
  options: string[];
  // A named volume (podman volume): source is its name.
  volume?: boolean;
}
export interface PPort {
  ip: string;
  host: number;
  container: number;
}
export interface PContainer {
  id: string;
  name: string;
  image: string;
  owner: string;
  state: 'created' | 'running' | 'exited';
  code: number;
  created: number;
  started: number;
  finished: number;
  ports: PPort[];
  mounts: PMount[];
  network: string;
  userns: string;
  user?: string;
  // The ids mapped (null: rootful, the host's ids).
  maps: Maps | null;
  log: { time: number; text: string }[];
  // Where conmon lives: the account's manager (user@UID), a login session, or a system unit.
  scope: 'manager' | 'session' | 'system';
  unit?: string;
  remove: boolean;
  restart?: string;
  // Started by nohup, or by a system unit (the chapters' false leads).
  nohup?: boolean;
  boot: number;
  // Started by the manager when it started (at boot, or when linger was enabled).
  byManagerStart?: boolean;
  files: Record<string, string>;
}
export interface PUser {
  images: Record<string, PImage>;
  containers: PContainer[];
  volumes: Record<string, { created: number }>;
  pause: Maps | null;
}
export interface UserUnit {
  name: string;
  source: string;
  text: string;
  description: string;
  args: string[];
  container: string;
  wanted: boolean;
  state: 'active' | 'inactive' | 'failed';
  since: number;
  // The boot the manager started it in by itself (WantedBy=default.target).
  byManagerStart?: number;
}
export interface Manager {
  // When the running manager started (null: stopped).
  since: number | null;
  units: Record<string, UserUnit>;
}
export interface PodmanState {
  users: Record<string, PUser>;
  managers: Record<string, Manager>;
  boot: number;
  pid: number;
}

/** A simulated app in an image: it starts with the process's host ids, and answers HTTP. */
export interface PApp {
  start(game: Shell, c: PContainer, uid: number, gid: number): { ok: boolean; log: string[] };
  answer(game: Shell, c: PContainer, path: string): { code: number; body: string };
}
export const PAPPS: Record<string, PApp> = {};

export const podman = (game: Game): PodmanState => (game.state.podman ??= { users: {}, managers: {}, boot: systemd(game)?.boot ?? 1, pid: 2300 }) as PodmanState;
export const store = (game: Game, user: string): PUser => (podman(game).users[user] ??= { images: {}, containers: [], volumes: {}, pause: null });
const sdOf = (game: Game) => systemd(game) as Systemd;
export const now = (game: Game) => sdOf(game).clock;

// ——— Accounts and their ids ———

export const uidOf = (game: Game, user: string) => (user === 'root' ? 0 : (game.accounts.users[user]?.uid ?? -1));
export const gidOf = (game: Game, user: string) => (user === 'root' ? 0 : (game.accounts.groups[game.accounts.users[user]?.group ?? user]?.gid ?? uidOf(game, user)));
export const homeOf = (game: Game, user: string) => game.accounts.users[user]?.home ?? (user === 'root' ? '/root' : `/home/${user}`);
const hostUidOf = (game: Game, owner: string) => game.accounts.users[owner]?.uid ?? (/^\d+$/.test(owner) ? Number(owner) : -1);
const hostGidOf = (game: Game, group: string) => game.accounts.groups[group]?.gid ?? (/^\d+$/.test(group) ? Number(group) : -1);

/** An account's subordinate ranges (/etc/subuid or /etc/subgid: NAME:START:COUNT, or UID:START:COUNT). */
export function subIds(game: Game, file: 'subuid' | 'subgid', user: string): { start: number; count: number }[] {
  const uid = String(uidOf(game, user));
  return (game.read(`/etc/${file}`) ?? '')
    .split('\n')
    .map((l) => l.trim().split(':'))
    .filter((p) => p.length === 3 && (p[0] === user || p[0] === uid) && /^\d+$/.test(p[1]) && /^\d+$/.test(p[2]))
    .map((p) => ({ start: Number(p[1]), count: Number(p[2]) }));
}

/** The mapping a new user namespace gets: the account as 0, then its subordinate ids from 1. */
export function freshMaps(game: Game, user: string): Maps {
  const build = (own: number, ranges: { start: number; count: number }[]) => {
    const out: IdMap[] = [{ container: 0, host: own, size: 1 }];
    let next = 1;
    for (const r of ranges) {
      out.push({ container: next, host: r.start, size: r.count });
      next += r.count;
    }
    return out;
  };
  const u = subIds(game, 'subuid', user);
  const g = subIds(game, 'subgid', user);
  return { uid: build(uidOf(game, user), u), gid: build(gidOf(game, user), g), single: !u.length || !g.length };
}

export const toHost = (map: IdMap[], id: number): number | null => {
  const m = map.find((x) => id >= x.container && id < x.container + x.size);
  return m ? m.host + id - m.container : null;
};
export const toNs = (map: IdMap[], host: number): number => {
  const m = map.find((x) => host >= x.host && host < x.host + x.size);
  return m ? m.container + host - m.host : OVERFLOW;
};

/** keep-id: the account's own uid inside (or uid=N), the subordinate ids around it (podman-run(1), --userns=keep-id). */
export function keepIdMaps(game: Game, user: string, option: string): Maps {
  const fresh = freshMaps(game, user);
  const opts = Object.fromEntries(option.replace(/^keep-id:?/, '').split(',').filter(Boolean).map((kv) => kv.split('=')));
  const wrap = (map: IdMap[], own: number, inside: number): IdMap[] => {
    const subs = map.slice(1);
    const total = subs.reduce((t, x) => t + x.size, 0);
    const start = subs[0]?.host ?? own;
    const out: IdMap[] = [];
    if (inside > 0) out.push({ container: 0, host: start, size: Math.min(inside, total) });
    out.push({ container: inside, host: own, size: 1 });
    if (total > inside) out.push({ container: inside + 1, host: start + inside, size: total - inside });
    return out;
  };
  const uid = opts.uid !== undefined ? Number(opts.uid) : uidOf(game, user);
  const gid = opts.gid !== undefined ? Number(opts.gid) : gidOf(game, user);
  return { uid: wrap(fresh.uid, uidOf(game, user), uid), gid: wrap(fresh.gid, gidOf(game, user), gid), single: fresh.single };
}

// ——— The user's session and service manager ———

export const managerUnit = (game: Game, user: string) => `user@${uidOf(game, user)}`;
export const managerRunning = (game: Game, user: string) => sdOf(game).services[managerUnit(game, user)]?.state === 'active';
export const lingers = (game: Game, user: string) => game.exists(`/var/lib/systemd/linger/${user}`);
export const runtimeDir = (game: Game, user: string) => `/run/user/${uidOf(game, user)}`;

/** The account's service manager as a system unit (user@UID.service), created when first needed. */
export function managerService(game: Game, user: string) {
  const sd = sdOf(game);
  const name = managerUnit(game, user);
  const pid = 1040 + (uidOf(game, user) % 50);
  sd.services[name] ??= {
    description: `User Manager for UID ${uidOf(game, user)}`,
    state: 'inactive',
    active: lingers(game, user),
    process: [
      { pid, user, cpu: 0, mem: 0.3, command: '/usr/lib/systemd/systemd --user' },
      { pid: pid + 1, user, cpu: 0, mem: 0.1, command: '(sd-pam)' },
    ],
    executable: 'systemd',
    since: sd.clock,
    unitFile: '/usr/lib/systemd/system/user@.service',
  };
  return sd.services[name];
}

/** The warnings of a rootless podman without a user session (containers/common's config.go). */
export const SESSION_WARNINGS = (uid: number) => [
  'WARN[0000] The cgroupv2 manager is set to systemd but there is no systemd user session available',
  'WARN[0000] For using systemd, you may need to log in using a user session',
  `WARN[0000] Alternatively, you can enable lingering with: \`loginctl enable-linger ${uid}\` (possibly as root)`,
  'WARN[0000] Falling back to --cgroup-manager=cgroupfs',
];

/** A line of the user manager's journal (a system journal entry of user@UID.service). */
export function userLog(game: Game, user: string, ident: string, message: string, userUnit?: string, priority = 6) {
  const sd = sdOf(game);
  sd.clock += 1000;
  const pid = ident === 'systemd' ? 1040 + (uidOf(game, user) % 50) : podman(game).pid;
  sd.log.push({ time: sd.clock, boot: sd.boot, unit: `${managerUnit(game, user)}.service`, ident, pid, message, priority, userUnit, user });
}

const unitTitle = (u: UserUnit) => (u.description ? `${u.name} - ${u.description}` : u.name);

/**
 * Brings the model in line with systemd: after a reboot every container is
 * gone (their processes died with the machine); a manager that has just
 * started runs its generators and starts what default.target wants; one that
 * stopped takes down its units and the containers in its scope. Called before
 * each command that reads Podman's state, and after each command.
 */
export function settle(game: Game) {
  const sd = sdOf(game);
  const p = podman(game);
  if (p.boot !== sd.boot) {
    // The machine stopped: every container died with it, every manager's units too.
    for (const m of Object.values(p.managers)) {
      m.since = null;
      for (const u of Object.values(m.units)) u.state = 'inactive';
    }
    for (const s of Object.values(p.users)) {
      for (const c of s.containers) if (c.state === 'running') end(game, c, 0, true);
      s.pause = null;
    }
    p.boot = sd.boot;
    syncWorld(game);
  }
  for (const user of Object.keys(game.accounts.users)) {
    if (user === 'root') continue;
    const svc = sd.services[managerUnit(game, user)];
    if (svc) svc.active = lingers(game, user);
    const m = (p.managers[user] ??= { since: null, units: {} });
    const running = svc?.state === 'active';
    if (running && m.since !== svc.since) {
      m.since = svc.since;
      generate(game, user);
      for (const u of Object.values(m.units)) if (u.wanted && u.state !== 'active') startUserUnit(game, user, u.name, true);
    } else if (!running && m.since !== null) {
      m.since = null;
      for (const u of Object.values(m.units)) if (u.state === 'active') stopUserUnit(game, user, u.name, true);
      for (const c of store(game, user).containers) if (c.state === 'running' && c.scope === 'manager') end(game, c, 143, true);
    }
    syncRuntimeDir(game, user, running);
  }
  syncWorld(game);
}

function syncRuntimeDir(game: Game, user: string, running: boolean) {
  const base = game.find('/run/user');
  if (base?.type !== 'directory') return;
  const uid = String(uidOf(game, user));
  if (!running) {
    delete base.children[uid];
    return;
  }
  const units = Object.values(podman(game).managers[user]?.units ?? {});
  base.children[uid] ??= { type: 'directory', owner: user, group: game.accounts.users[user]?.group ?? user, mode: 'rwx------', children: {} };
  const dir = base.children[uid] as Directory;
  dir.children.bus ??= { type: 'file', content: '', owner: user, group: game.accounts.users[user]?.group ?? user, mode: 'rw-rw-rw-' };
  dir.children.systemd = {
    type: 'directory',
    owner: user,
    group: game.accounts.users[user]?.group ?? user,
    children: {
      generator: {
        type: 'directory',
        owner: user,
        group: game.accounts.users[user]?.group ?? user,
        children: Object.fromEntries(units.map((u) => [u.name, { type: 'file', content: u.text, lines: true, owner: user, group: game.accounts.users[user]?.group ?? user }])),
      },
    },
  };
}

/** The ports pasta forwards (ss) and the containers' processes (ps), from the running containers. */
export function syncWorld(game: Game) {
  const p = podman(game);
  const listening = ((game.state.listening ??= []) as (Listening & { podman?: boolean })[]).filter((l) => !l.podman);
  const processes = ((game.state.process ??= []) as (Process & { podman?: boolean })[]).filter((x) => !x.podman);
  let k = 0;
  for (const [owner, s] of Object.entries(p.users))
    for (const c of s.containers) {
      if (c.state !== 'running') continue;
      const pid = 2400 + k * 20;
      k++;
      const image = s.images[c.image];
      const ids = processIds(game, c);
      processes.push({ pid, user: owner, cpu: 0, mem: 0.1, command: `/usr/bin/conmon --api-version 1 -c ${c.id} -u ${c.id} -n ${c.name}`, podman: true });
      processes.push({ pid: pid + 7, user: machineAccount(game, ids.uid), cpu: 0.4, mem: 1.2, command: image?.command ?? '', ppid: pid, podman: true });
      if (c.network === 'pasta' && owner !== 'root' && c.ports.length) processes.push({ pid: pid + 3, user: owner, cpu: 0.1, mem: 0.1, command: `/usr/bin/pasta --config-net ${c.ports.map((x) => `-t ${pastaSpec(x)}`).join(' ')}`, podman: true });
      for (const x of c.ports)
        listening.push({ proto: 'tcp', address: x.ip || (owner === 'root' ? '0.0.0.0' : '*'), port: x.host, process: owner === 'root' ? 'conmon' : c.network === 'pasta' ? 'pasta' : 'rootlessport', pid: pid + 3, podman: true });
    }
  game.state.listening = listening;
  game.state.process = processes;
}

// ——— Images ———

export const qualify = (ref: string) => (/:[^/]+$/.test(ref) || ref.includes('@') ? ref : `${ref}:latest`);
/** A short name (no registry): Debian's registries.conf defines no unqualified-search registries. */
export const shortName = (ref: string) => !/^[^/]+[.:][^/]*\//.test(ref) && !ref.startsWith('localhost/');

export function findImage(s: PUser, ref: string): PImage | null {
  const q = qualify(ref);
  return s.images[q] ?? Object.values(s.images).find((i) => ref.length >= 3 && i.id.startsWith(ref)) ?? null;
}

const digest = (seed: string) => identifier(seed);

/** podman pull: its lines, and the image or the error (exit 125). */
export function pull(game: Game, user: string, ref: string): { lines: string[]; image?: PImage; error?: string } {
  if (shortName(ref))
    return { lines: [], error: `Error: short-name "${ref}" did not resolve to an alias and no unqualified-search registries are defined in "/etc/containers/registries.conf"` };
  const q = qualify(ref);
  const spec = REGISTRY[q];
  const lines = [`Trying to pull ${q}...`];
  if (!spec) {
    const [repo, tag] = [q.slice(0, q.lastIndexOf(':')), q.slice(q.lastIndexOf(':') + 1)];
    return { lines, error: `Error: initializing source docker://${q}: reading manifest ${tag} in ${repo}: manifest unknown` };
  }
  const blob = digest(`blob-${q}`);
  const diff = digest(`diff-${q}`);
  lines.push('Getting image source signatures', `Copying blob ${blob.slice(0, 12)} done   | `);
  const maps = user === 'root' ? null : userMaps(game, user);
  if (maps && (toHost(maps.uid, spec.foreign.uid) === null || toHost(maps.gid, spec.foreign.gid) === null))
    return {
      lines,
      error: `Error: writing blob: adding layer with blob "sha256:${blob}"/""/"sha256:${diff}": processing tar file(potentially insufficient UIDs or GIDs available in user namespace (requested ${spec.foreign.uid}:${spec.foreign.gid} for ${spec.foreign.path}): Check /etc/subuid and /etc/subgid if configured locally and run "podman system migrate": lchown ${spec.foreign.path}: invalid argument): exit status 1`,
    };
  const id = digest(`image-${q}`);
  lines.push(`Copying config ${id.slice(0, 10)} done   | `, 'Writing manifest to image destination', id);
  const image: PImage = { ...spec, id };
  store(game, user).images[q] = image;
  return { lines, image };
}

/** The account's namespace (its pause process): built at its first use, kept until migrate or a reboot. */
export function userMaps(game: Game, user: string): Maps {
  const s = store(game, user);
  return (s.pause ??= freshMaps(game, user));
}

// ——— Containers ———

/** The process's ids inside, and on the host. */
export function processIds(game: Game, c: PContainer): { inside: number; insideGid: number; uid: number; gid: number } {
  const image = store(game, c.owner).images[c.image];
  const keep = c.userns.startsWith('keep-id');
  const [u, g] = (c.user ?? '').split(':');
  const named = (x: string | undefined) => (x === undefined || x === '' ? undefined : /^\d+$/.test(x) ? Number(x) : (image?.accounts[x] ?? undefined));
  let inside = named(u) ?? (keep ? (c.maps?.uid.find((m) => m.size === 1 && m.host === uidOf(game, c.owner))?.container ?? uidOf(game, c.owner)) : (image?.user ?? 0));
  let insideGid = named(g) ?? (u !== undefined && u !== '' && named(u) !== undefined ? named(u)! : keep ? (c.maps?.gid.find((m) => m.size === 1 && m.host === gidOf(game, c.owner))?.container ?? gidOf(game, c.owner)) : (image?.group ?? 0));
  if (Number.isNaN(inside)) inside = 0;
  if (Number.isNaN(insideGid)) insideGid = 0;
  if (!c.maps) return { inside, insideGid, uid: inside, gid: insideGid };
  return { inside, insideGid, uid: toHost(c.maps.uid, inside) ?? OVERFLOW, gid: toHost(c.maps.gid, insideGid) ?? OVERFLOW };
}

/** The host path behind a path of the container (a bind mount), if any. */
export function hostPath(c: PContainer, path: string): string | null {
  const m = c.mounts
    .filter((x) => !x.volume && (path === x.target || path.startsWith(x.target.replace(/\/$/, '') + '/')))
    .sort((a, b) => b.target.length - a.target.length)[0];
  return m ? m.source.replace(/\/$/, '') + path.slice(m.target.replace(/\/$/, '').length) : null;
}

/** May the container's process do this on a host path (the kernel, by number)? */
export const processMay = (game: Game, c: PContainer, n: Node, right: 'r' | 'w' | 'x') => {
  const ids = processIds(game, c);
  return numericAccess(game, n, right, ids.uid, ids.gid);
};

/** The ids a namespace shows for a file of the host (podman unshare, ls in the container). */
export const nsOwner = (game: Game, maps: Maps | null, n: Node): { uid: number; gid: number } => {
  const owner = n.owner ?? 'root';
  const group = n.group ?? owner;
  const uid = hostUidOf(game, owner);
  const gid = hostGidOf(game, group);
  return maps ? { uid: toNs(maps.uid, uid), gid: toNs(maps.gid, gid) } : { uid, gid };
};

/** Every node under a path (itself first), like filepath.Walk. */
export function walk(game: Game, path: string): [string, Node][] {
  const n = game.find(path);
  if (!n) return [];
  const out: [string, Node][] = [[path, n]];
  if (n.type === 'directory') for (const k of Object.keys(n.children).sort()) out.push(...walk(game, `${path.replace(/\/$/, '')}/${k}`));
  return out;
}

/** :U: the source chowned to the container's user, from inside the namespace (chown_unix.go). */
function chownU(game: Game, c: PContainer, m: PMount): string | null {
  const ids = processIds(game, c);
  for (const [path, n] of walk(game, m.source)) {
    if (c.maps) {
      const seen = nsOwner(game, c.maps, n);
      if (seen.uid === OVERFLOW || seen.gid === OVERFLOW) return `Error: failed to chown recursively host path: lchown ${path}: operation not permitted`;
    }
  }
  for (const [, n] of walk(game, m.source)) {
    n.owner = machineAccount(game, ids.uid);
    n.group = machineGroup(game, ids.gid);
  }
  return null;
}

const pastaSpec = (x: PPort) => `${x.ip ? `${x.ip}/` : ''}${x.host}-${x.host}:${x.container}-${x.container}`;

/** What binds a port already (sshd, nginx, another container's pasta). */
function portTaken(game: Game, c: PContainer, x: PPort): boolean {
  return ((game.state.listening ?? []) as (Listening & { pid: number })[]).some((l) => l.proto === 'tcp' && l.port === x.host && (!x.ip || ['0.0.0.0', '*', '[::]', x.ip].includes(l.address) || ['0.0.0.0', '*'].includes(l.address)));
}

export const unprivilegedStart = (game: Game) => Number((game.read('/proc/sys/net/ipv4/ip_unprivileged_port_start') ?? '1024').trim()) || 0;

/** The network's errors (pasta, rootlessport, rootful), for a port that can't be bound. */
function portError(game: Game, c: PContainer, x: PPort, denied: boolean): string {
  const start = unprivilegedStart(game);
  if (c.owner === 'root') return `Error: unable to start container "${c.id}": cannot listen on the TCP port: listen tcp4 ${x.ip || ''}:${x.host}: bind: address already in use`;
  if (c.network === 'slirp4netns')
    return denied
      ? `Error: rootlessport cannot expose privileged port ${x.host}, you can add 'net.ipv4.ip_unprivileged_port_start=${x.host}' to /etc/sysctl.conf (currently ${start}), or choose a larger port number (>= ${start}): listen tcp ${x.ip || '0.0.0.0'}:${x.host}: bind: permission denied`
      : `Error: rootlessport listen tcp ${x.ip || '0.0.0.0'}:${x.host}: bind: address already in use`;
  return denied
    ? `Error: pasta failed with exit code 1:\nFailed to bind port ${x.host} (Permission denied) for option '-t ${pastaSpec(x)}'`
    : `Error: pasta failed with exit code 1:\nFailed to bind port ${x.host} (Address already in use) for option '-t ${pastaSpec(x)}'`;
}

/**
 * Starts a created container: :U, the ports, the app. Returns podman's error
 * (the container stays Created, or exits if its app fails).
 */
export function startContainer(game: Game, c: PContainer): string | null {
  const sh = game as Shell;
  for (const m of c.mounts)
    if (!m.volume && m.options.includes('U')) {
      const e = chownU(game, c, m);
      if (e) return e;
    }
  for (const x of c.ports) {
    const denied = c.owner !== 'root' && x.host < unprivilegedStart(game);
    if (denied || portTaken(game, c, x)) return portError(game, c, x, denied);
  }
  const image = store(game, c.owner).images[c.image];
  c.state = 'running';
  c.started = now(game);
  c.boot = sdOf(game).boot;
  const ids = processIds(game, c);
  const app = image ? PAPPS[image.app] : undefined;
  const r = app ? app.start(sh, c, ids.uid, ids.gid) : { ok: true, log: [] };
  for (const text of r.log) containerLog(game, c, text);
  if (!r.ok) end(game, c, 1, false);
  syncWorld(game);
  return null;
}

export function containerLog(game: Game, c: PContainer, text: string) {
  c.log.push({ time: now(game), text });
  // Quadlet's containers log to the journal under the unit (SyslogIdentifier=%N).
  if (c.unit && c.owner !== 'root') userLog(game, c.owner, c.unit.replace(/\.service$/, ''), text, c.unit);
}

/** The container's process ends (exit code), its --rm removes it; a unit's container fails its unit. */
export function end(game: Game, c: PContainer, code: number, quiet: boolean) {
  if (c.state !== 'running') return;
  c.state = 'exited';
  c.code = code;
  c.finished = now(game);
  const s = store(game, c.owner);
  if (c.remove) s.containers = s.containers.filter((x) => x !== c);
  if (c.unit && !quiet) {
    const u = podman(game).managers[c.owner]?.units[c.unit];
    if (u && u.state === 'active') {
      userLog(game, c.owner, 'systemd', `${u.name}: Main process exited, code=exited, status=${code}/${code === 1 ? 'FAILURE' : 'n/a'}`, u.name, 4);
      userLog(game, c.owner, 'systemd', `${u.name}: Failed with result 'exit-code'.`, u.name, 4);
      u.state = 'failed';
      u.since = now(game);
    }
  }
}

export const newId = (game: Game, seed: string) => {
  const p = podman(game);
  p.pid += 1;
  return identifier(`${seed}-${p.pid}-${now(game)}`);
};

// ——— Quadlet (podman-systemd.unit(5)) ———

export const QUADLET_DIRS = (game: Game, user: string) => [`${homeOf(game, user)}/.config/containers/systemd`, `/etc/containers/systemd/users/${uidOf(game, user)}`, '/etc/containers/systemd/users'];

/** A unit file's groups, as systemd reads them (comments, continuations). */
export function readUnit(text: string): { groups: Record<string, [string, string][]>; order: string[] } {
  const groups: Record<string, [string, string][]> = {};
  const order: string[] = [];
  let current = '';
  const lines = text.replace(/\\\n/g, ' ').split('\n');
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith(';')) continue;
    const g = /^\[([^\]]+)\]$/.exec(l);
    if (g) {
      current = g[1];
      if (!groups[current]) order.push(current);
      groups[current] ??= [];
      continue;
    }
    const i = l.indexOf('=');
    if (i < 0 || !current) continue;
    groups[current].push([l.slice(0, i).trim(), l.slice(i + 1).trim()]);
  }
  return { groups, order };
}

// The [Container] keys of Podman 5.4.2's Quadlet (pkg/systemd/quadlet/quadlet.go, supportedContainerKeys).
const CONTAINER_KEYS = new Set(
  'AddCapability AddDevice AddHost Annotation AutoUpdate CgroupsMode ContainerName ContainersConfModule DNS DNSOption DNSSearch DropCapability Entrypoint Environment EnvironmentFile EnvironmentHost Exec ExposeHostPort GIDMap GlobalArgs Group GroupAdd HealthCmd HealthInterval HealthOnFailure HealthRetries HealthStartPeriod HealthTimeout HostName IP IP6 Image Label LogDriver LogOpt Mask Mount Network NetworkAlias NoNewPrivileges Notify PidsLimit Pod PodmanArgs PublishPort Pull ReadOnly ReadOnlyTmpfs RemapGid RemapUid RemapUidSize RemapUsers Rootfs RunInit SeccompProfile Secret SecurityLabelDisable SecurityLabelFileType SecurityLabelLevel SecurityLabelNested SecurityLabelType ServiceName ShmSize StartWithPod StopSignal StopTimeout SubGIDMap SubUIDMap Sysctl Timezone Tmpfs UIDMap Ulimit Unmask User UserNS VolatileTmp Volume WorkingDir'.split(' '),
);

/** Converts a .container file into its service (quadlet.go's ConvertContainer); an error like Quadlet's. */
export function convert(path: string, text: string, generator: string): { unit?: UserUnit; error?: string } {
  const file = path.split('/').at(-1)!;
  const name = file.replace(/\.container$/, '.service');
  const { groups, order } = readUnit(text);
  const container = groups.Container ?? [];
  for (const [k] of container) if (!CONTAINER_KEYS.has(k)) return { error: `converting "${file}": unsupported key '${k}' in group 'Container' in ${path}` };
  const get = (k: string) => container.filter(([x]) => x === k).map(([, v]) => v);
  const image = get('Image').at(-1) ?? '';
  if (!image && !get('Rootfs').length) return { error: `converting "${file}": no Image or Rootfs key specified` };
  const containerName = get('ContainerName').at(-1) || 'systemd-%N';
  const args = ['--name', containerName, '--cidfile=%t/%N.cid', '--replace', '--rm', '--cgroups=split', '--sdnotify=conmon', '-d'];
  for (const v of get('UserNS')) args.push('--userns', v);
  for (const v of get('User')) args.push('--user', v);
  for (const v of get('Network')) args.push('--network', v);
  for (const v of get('Volume')) args.push('-v', v);
  for (const v of get('PublishPort')) args.push('--publish', v);
  for (const v of get('Environment')) for (const e of v.split(/\s+/)) args.push('--env', e);
  for (const v of get('PodmanArgs')) args.push(...v.split(/\s+/));
  args.push(image);
  const stem = name.replace(/\.service$/, '');
  const description = (groups.Unit ?? []).filter(([k]) => k === 'Description').map(([, v]) => v).at(-1) ?? '';
  const wanted = (groups.Install ?? []).some(([k, v]) => (k === 'WantedBy' || k === 'RequiredBy') && v.split(/\s+/).includes('default.target'));
  const section = (g: string, extra: string[] = []) => [`[${g}]`, ...(groups[g] ?? []).map(([k, v]) => `${k}=${v}`), ...extra].join('\n');
  const execStart = ['/usr/bin/podman', 'run', ...args].join(' ');
  // The generated file: the source's groups, [Container] renamed X-Container, then what Quadlet adds.
  const rendered: string[] = [`# Automatically generated by ${generator}`, '#'];
  for (const g of order) {
    if (g === 'Container') rendered.push(section('Container').replace('[Container]', '[X-Container]'), '');
    else if (g === 'Unit') rendered.push(section('Unit', [`SourcePath=${path}`, 'RequiresMountsFor=%t/containers']), '');
    else if (g !== 'Service') rendered.push(section(g), '');
  }
  if (!groups.Unit) rendered.push(['[Unit]', `SourcePath=${path}`, 'RequiresMountsFor=%t/containers'].join('\n'), '');
  rendered.push(
    section('Service', [
      'Environment=PODMAN_SYSTEMD_UNIT=%n',
      'KillMode=mixed',
      'ExecStop=/usr/bin/podman rm -v -f -i --cidfile=%t/%N.cid',
      'ExecStopPost=-/usr/bin/podman rm -v -f -i --cidfile=%t/%N.cid',
      'Delegate=yes',
      'Type=notify',
      'NotifyAccess=all',
      'SyslogIdentifier=%N',
      `ExecStart=${execStart}`,
    ]),
  );
  return {
    unit: {
      name,
      source: path,
      text: rendered.join('\n'),
      description,
      args: args.map((a) => a.replace(/%N/g, stem).replace(/%t/g, '/run/user/%U')),
      container: containerName.replace(/%N/g, stem),
      wanted,
      state: 'inactive',
      since: 0,
    },
  };
}

/** The account's .container files, by name (the first directory that has one wins). */
export function quadletFiles(game: Game, user: string): [string, string][] {
  const seen = new Map<string, string>();
  for (const dir of QUADLET_DIRS(game, user)) {
    const n = game.find(dir);
    if (n?.type !== 'directory') continue;
    for (const [k, v] of Object.entries(n.children)) if (k.endsWith('.container') && v.type === 'file' && !seen.has(k)) seen.set(k, `${dir}/${k}`);
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => [p, game.read(p) ?? '']);
}

export const GENERATOR = '/usr/lib/systemd/user-generators/podman-user-generator';

/** The user generator (at the manager's start and at daemon-reload): units rebuilt, errors in the journal. */
export function generate(game: Game, user: string) {
  const m = (podman(game).managers[user] ??= { since: null, units: {} });
  const fresh: Record<string, UserUnit> = {};
  for (const [path, text] of quadletFiles(game, user)) {
    const r = convert(path, text, GENERATOR);
    if (r.error) {
      userLog(game, user, `quadlet-generator`, `quadlet-generator[${podman(game).pid}]: ${r.error}`, undefined, 3);
      continue;
    }
    const u = r.unit!;
    const old = m.units[u.name];
    if (old) Object.assign(u, { state: old.state, since: old.since, byManagerStart: old.byManagerStart });
    fresh[u.name] = u;
  }
  // A unit whose file is gone stays loaded while it runs (systemd keeps it, "not-found").
  for (const [k, u] of Object.entries(m.units)) if (!fresh[k] && u.state === 'active') fresh[k] = u;
  m.units = fresh;
}

/** Runs `podman run ARGS` for an account (the CLI's parser is in commands/podman.ts, hooked here). */
export const RUN: { run?: (game: Game, user: string, args: string[], scope: PContainer['scope'], unit?: string) => { error?: string; container?: PContainer } } = {};

export function startUserUnit(game: Game, user: string, name: string, byManager = false): boolean {
  const m = podman(game).managers[user];
  const u = m?.units[name];
  if (!u) return false;
  userLog(game, user, 'systemd', `Starting ${unitTitle(u)}...`, u.name);
  const r = RUN.run?.(game, user, u.args, 'manager', u.name) ?? { error: 'Error: podman is not there' };
  if (r.error) {
    for (const line of r.error.split('\n')) userLog(game, user, u.name.replace(/\.service$/, ''), line, u.name, 3);
    userLog(game, user, 'systemd', `${u.name}: Main process exited, code=exited, status=125/n/a`, u.name, 4);
    userLog(game, user, 'systemd', `${u.name}: Failed with result 'exit-code'.`, u.name, 4);
    userLog(game, user, 'systemd', `Failed to start ${unitTitle(u)}.`, u.name, 3);
    u.state = 'failed';
    u.since = now(game);
    return false;
  }
  const c = r.container!;
  if (c.state !== 'running') {
    userLog(game, user, 'systemd', `${u.name}: Main process exited, code=exited, status=${c.code}/FAILURE`, u.name, 4);
    userLog(game, user, 'systemd', `${u.name}: Failed with result 'exit-code'.`, u.name, 4);
    userLog(game, user, 'systemd', `Failed to start ${unitTitle(u)}.`, u.name, 3);
    u.state = 'failed';
    u.since = now(game);
    return false;
  }
  if (byManager) {
    c.byManagerStart = true;
    u.byManagerStart = sdOf(game).boot;
  } else u.byManagerStart = undefined;
  userLog(game, user, 'systemd', `Started ${unitTitle(u)}.`, u.name);
  u.state = 'active';
  u.since = now(game);
  return true;
}

export function stopUserUnit(game: Game, user: string, name: string, quiet = false) {
  const u = podman(game).managers[user]?.units[name];
  if (!u) return;
  if (!quiet) userLog(game, user, 'systemd', `Stopping ${unitTitle(u)}...`, u.name);
  u.state = 'inactive';
  u.since = now(game);
  for (const c of store(game, user).containers.filter((x) => x.unit === name)) end(game, c, 0, true);
  if (!quiet) userLog(game, user, 'systemd', `Stopped ${unitTitle(u)}.`, u.name);
}

/** loginctl enable-linger: the manager starts now and at each boot. */
export function startManager(game: Game, user: string) {
  const svc = managerService(game, user);
  svc.active = lingers(game, user);
  if (svc.state !== 'active') startUnit(game, sdOf(game), managerUnit(game, user));
  settle(game);
}
