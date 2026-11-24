// podman (rootless and rootful), loginctl's linger and users, systemctl
// --user and Quadlet's dry run, on the model of ../podman.ts.
// After Podman 5.4.2's man pages (https://docs.podman.io/en/v5.4.2/) and
// sources: cobra's "unknown flag" and "unrecognized command" errors,
// podman ps and images (report.NewWriterDefault: tabwriter 12, 2, 2;
// COMMAND cut at 17 characters; units.HumanDuration and HumanSizeWithPrecision),
// pull's lines (containers/image's copy), the storage's "already in use"
// error, rm's "running or paused containers cannot be removed without
// force", unshare's "please use unshare with rootless", generate systemd's
// deprecation; systemd 257's loginctl and systemctl (bus_log_connect_error's
// hint, "is transient or generated", "Unit … not found.").
// Differences: podman run without -d returns like -d; exec runs only id,
// whoami, ls, cat and touch; podman info shows a part of its fields; loginctl
// has enable-linger, disable-linger, show-user, list-users and list-sessions.

import type { Shell } from '../shell';
import type { Command, Context } from './index';
import { dateComplete, duration as sdDuration, logLine, systemd, type Systemd } from '../systemd';
import { duration, machineAccount, machineGroup } from '../docker';
import {
  OVERFLOW, RUN, SESSION_WARNINGS, VERSION, convert, end, findImage, freshMaps, gidOf, hostPath, homeOf, keepIdMaps, lingers, managerRunning, managerService,
  managerUnit, newId, now, nsOwner, podman, processIds, processMay, pull, quadletFiles, runtimeDir, settle, startContainer, startManager, startUserUnit, stopUserUnit, store, subIds, toHost,
  uidOf, userMaps, walk, generate, type Maps, type PContainer, type PImage, type PMount, type PPort,
} from '../podman';

// ——— Output ———

/** Go's tabwriter as podman uses it (minwidth 12, padding 2): each cell padded, the last one not. */
export function table(rows: string[][]): string {
  const widths = rows[0].map((_, k) => Math.max(...rows.map((r) => (r[k] ?? '').length)));
  return rows.map((r) => r.map((cell, k) => (k === r.length - 1 ? cell : cell.padEnd(Math.max(widths[k] + 2, 12)))).join('').trimEnd()).join('\n');
}

/** units.HumanSizeWithPrecision(size, 3): "142 MB". */
export function humanSize(bytes: number): string {
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${Number(v.toPrecision(3))} ${units[i]}`;
}

const ports = (c: PContainer) => c.ports.map((p) => `${p.ip || '0.0.0.0'}:${p.host}->${p.container}/tcp`).join(', ');
const statusOf = (game: Shell, c: PContainer) =>
  c.state === 'running' ? `Up ${duration(now(game) - c.started)}` : c.state === 'exited' ? `Exited (${c.code}) ${duration(now(game) - c.finished)} ago` : 'Created';
const command17 = (s: string) => (s.length > 17 ? `${s.slice(0, 17)}...` : s);

// ——— Options (cobra/pflag) ———

interface Parsed {
  flags: Record<string, string[]>;
  rest: string[];
  error?: string;
}

/**
 * Reads a subcommand's options: VALUED take a value (--name x, --name=x, -p x,
 * -px), BOOLS don't; the first argument that isn't an option ends them
 * (podman run IMAGE COMMAND…, like SetInterspersed(false)).
 */
function parse(args: string[], valued: string[], bools: string[], sub: string, interspersed = false): Parsed {
  const flags: Record<string, string[]> = {};
  const rest: string[] = [];
  const add = (k: string, v: string) => (flags[k] ??= []).push(v);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      rest.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const [k, v] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
      if (valued.includes(k)) add(k, v ?? args[++i] ?? '');
      else if (bools.includes(k)) add(k, v ?? 'true');
      else return { flags, rest, error: `Error: unknown flag: ${k}\nSee 'podman ${sub} --help'` };
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const k = `-${a[j]}`;
        if (valued.includes(k)) {
          add(k, a.slice(j + 1) || args[++i] || '');
          break;
        }
        if (bools.includes(k)) add(k, 'true');
        else return { flags, rest, error: `Error: unknown shorthand flag: '${a[j]}' in ${a}\nSee 'podman ${sub} --help'` };
      }
      continue;
    }
    if (!interspersed) {
      rest.push(...args.slice(i));
      break;
    }
    rest.push(a);
  }
  return { flags, rest };
}
const one = (p: Parsed, ...keys: string[]) => keys.flatMap((k) => p.flags[k] ?? []).at(-1);
const all = (p: Parsed, ...keys: string[]) => keys.flatMap((k) => p.flags[k] ?? []);
const has = (p: Parsed, ...keys: string[]) => keys.some((k) => (p.flags[k] ?? []).some((v) => v !== 'false'));

const RUN_VALUED = ['--name', '-p', '--publish', '-v', '--volume', '--userns', '-u', '--user', '--network', '--net', '--restart', '-e', '--env', '--cidfile', '--cgroups', '--sdnotify', '--pull', '--entrypoint', '-w', '--workdir', '--hostname', '-h', '--label', '-l', '--log-driver', '--stop-timeout', '--memory', '-m', '--security-opt', '--tz'];
const RUN_BOOLS = ['-d', '--detach', '--rm', '--replace', '-i', '--interactive', '-t', '--tty', '--init', '--read-only', '-q', '--quiet'];
const MOUNT_OPTIONS = ['ro', 'rw', 'z', 'Z', 'U', 'nocopy', 'copy', 'rprivate', 'private', 'shared', 'rshared', 'slave', 'rslave', 'bind', 'rbind', 'noexec', 'exec', 'nosuid', 'suid', 'nodev', 'dev', 'O', 'idmap', 'relabel=private', 'relabel=shared'];

/** -p [IP:]HOST:CONTAINER[/tcp], or -p CONTAINER (the same port here). */
function readPort(spec: string): PPort | null {
  const s = spec.replace(/\/tcp$/, '');
  const parts = s.split(':');
  if (parts.some((x) => x === '' && parts.length < 3)) return null;
  if (parts.length === 1 && /^\d+$/.test(parts[0])) return { ip: '', host: Number(parts[0]), container: Number(parts[0]) };
  if (parts.length === 2 && parts.every((x) => /^\d+$/.test(x))) return { ip: '', host: Number(parts[0]), container: Number(parts[1]) };
  if (parts.length === 3 && /^\d+$/.test(parts[2]) && (parts[1] === '' || /^\d+$/.test(parts[1]))) return { ip: parts[0], host: Number(parts[1] || parts[2]), container: Number(parts[2]) };
  return null;
}

/**
 * podman run: creates the container (its name, its image pulled if needed,
 * its mounts checked), then starts it. The lines it prints (pull) and its
 * error (exit 125 before the container exists, 126 when it can't start).
 */
export function runContainer(game: Shell, user: string, args: string[], scope: PContainer['scope'], unit?: string): { lines: string[]; error?: string; code?: number; container?: PContainer } {
  const p = parse(args, RUN_VALUED, RUN_BOOLS, 'run');
  if (p.error) return { lines: [], error: p.error, code: 125 };
  const [imageRef] = p.rest;
  if (!imageRef) return { lines: [], error: 'Error: requires at least 1 arg(s), only received 0', code: 125 };
  const s = store(game, user);
  const lines: string[] = [];
  let image: PImage | null = findImage(s, imageRef);
  if (!image) {
    const r = pull(game, user, imageRef);
    lines.push(...r.lines.filter((l) => !/^[0-9a-f]{64}$/.test(l)));
    if (r.error) return { lines, error: r.error, code: 125 };
    image = r.image!;
  }
  // The ports.
  const ps: PPort[] = [];
  for (const spec of all(p, '-p', '--publish')) {
    const x = readPort(spec);
    if (!x) return { lines, error: `Error: invalid port format "${spec}"`, code: 125 };
    ps.push(x);
  }
  // The mounts.
  const mounts: PMount[] = [];
  for (const spec of all(p, '-v', '--volume')) {
    const [rawSource, target, opts = ''] = spec.split(':');
    if (!target) return { lines, error: `Error: ${spec}: incorrect volume format, should be [host-dir:]ctr-dir[:option]`, code: 125 };
    const options = opts.split(',').filter(Boolean);
    const bad = options.find((o) => !MOUNT_OPTIONS.includes(o));
    if (bad) return { lines, error: `Error: invalid option type "${bad}"`, code: 125 };
    const source = rawSource.replace(/^%h/, homeOf(game, user)).replace(/^~/, homeOf(game, user));
    const named = !source.startsWith('/') && !source.startsWith('.');
    if (named) {
      s.volumes[source] ??= { created: now(game) };
      mounts.push({ source, target, options, volume: true });
      continue;
    }
    const resolved = game.resolve(source);
    if (!game.find(resolved)) return { lines, error: `Error: statfs ${resolved}: no such file or directory`, code: 125 };
    mounts.push({ source: resolved, target, options });
  }
  const userns = one(p, '--userns') ?? '';
  if (userns && !/^(keep-id(:.*)?|host|auto|nomap)$/.test(userns)) return { lines, error: `Error: invalid user namespace mode "${userns}"`, code: 125 };
  const network = one(p, '--network', '--net') ?? (user === 'root' ? 'bridge' : 'pasta');
  if (!['pasta', 'slirp4netns', 'host', 'none', 'bridge'].includes(network)) return { lines, error: `Error: unable to find network with name or ID ${network}: network not found`, code: 125 };
  // The name: given, or chosen (adjective_noun), and taken already?
  let name = one(p, '--name');
  if (name) {
    const other = s.containers.find((c) => c.name === name);
    if (other && has(p, '--replace')) {
      if (other.state === 'running') end(game, other, 0, true);
      s.containers = s.containers.filter((c) => c !== other);
    } else if (other)
      return { lines, error: `Error: creating container storage: the container name "${name}" is already in use by ${other.id}. You have to remove that container to be able to reuse that name: that name is already in use`, code: 125 };
  } else {
    const A = ['amazing', 'brave', 'clever', 'eager', 'gentle', 'happy', 'jolly', 'keen', 'lucid', 'nifty'];
    const B = ['hopper', 'lovelace', 'noether', 'curie', 'turing', 'germain', 'meitner', 'franklin', 'johnson', 'hamilton'];
    name = `${A[s.containers.length % A.length]}_${B[(s.containers.length * 3 + 1) % B.length]}`;
  }
  const maps: Maps | null = user === 'root' || userns === 'host' ? null : userns.startsWith('keep-id') ? keepIdMaps(game, user, userns) : userMaps(game, user);
  const c: PContainer = {
    id: newId(game, `${user}-${name}`),
    name,
    image: image.ref,
    owner: user,
    state: 'created',
    code: 0,
    created: now(game),
    started: 0,
    finished: 0,
    ports: network === 'host' ? [{ ip: '', host: image.port, container: image.port }] : network === 'none' ? [] : ps,
    mounts,
    network,
    userns,
    user: one(p, '-u', '--user'),
    maps,
    log: [],
    scope,
    unit,
    remove: has(p, '--rm'),
    restart: one(p, '--restart'),
    boot: systemd(game)?.boot ?? 1,
    files: {},
  };
  s.containers.push(c);
  const error = startContainer(game, c);
  if (error) return { lines, error, code: 126, container: c };
  return { lines, container: c };
}
RUN.run = (game, user, args, scope, unit) => {
  const sh = game as Shell;
  const fixed = args.map((a) => a.replace(/%h/g, homeOf(game, user)).replace(/%U/g, String(uidOf(game, user))));
  const r = runContainer(sh, user, fixed, scope, unit);
  return { error: r.error, container: r.container };
};

// ——— Inside a container (podman exec) and inside the namespace (podman unshare) ———

/** A name for an id inside: the image's passwd for a container, the host's for unshare. */
const insideName = (names: Record<string, number>, id: number) => Object.entries(names).find(([, x]) => x === id)?.[0] ?? (id === OVERFLOW ? 'nobody' : String(id));

function lsInside(game: Shell, c: PContainer, args: string[]): string {
  const long = args.some((a) => /^-[a-zA-Z]*[ln]/.test(a));
  const numeric = args.some((a) => /^-[a-zA-Z]*n/.test(a));
  const path = args.find((a) => !a.startsWith('-')) ?? '/';
  const host = hostPath(c, path);
  const n = host ? game.find(host) : null;
  if (!n) return game.error(`ls: cannot access '${path}': No such file or directory`, 2);
  if (!processMay(game, c, n, 'r')) return game.error(`ls: cannot open directory '${path}': Permission denied`, 2);
  const names = store(game, c.owner).images[c.image]?.accounts ?? { root: 0 };
  const entries: [string, (typeof n)][] = n.type === 'directory' ? Object.entries(n.children).sort(([a], [b]) => a.localeCompare(b)) : [[path.split('/').at(-1)!, n]];
  if (!long) return entries.map(([k]) => k).join('  ');
  const rows = entries.map(([k, e]) => {
    const ids = nsOwner(game, c.maps, e);
    const mode = `${e.type === 'directory' ? 'd' : '-'}${e.mode ?? (e.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--')}`;
    const size = e.type === 'directory' ? 4096 : e.type === 'file' ? (e.size ?? (typeof e.content === 'string' ? e.content.length : 0)) : 0;
    return [mode, '1', numeric ? String(ids.uid) : insideName(names, ids.uid), numeric ? String(ids.gid) : insideName(names, ids.gid), String(size), k];
  });
  const w = rows[0]?.map((_, i) => Math.max(...rows.map((r) => r[i].length))) ?? [];
  return [`total ${entries.length * 4}`, ...rows.map((r) => `${r[0]} ${r[1]} ${r[2].padEnd(w[2])} ${r[3].padEnd(w[3])} ${r[4].padStart(w[4])} ${r[5]}`)].join('\n');
}

function execIn(game: Shell, c: PContainer, args: string[]): string {
  const [cmd, ...rest] = args;
  const ids = processIds(game, c);
  const names = store(game, c.owner).images[c.image]?.accounts ?? { root: 0 };
  if (cmd === 'id') {
    const u = insideName(names, ids.inside);
    const g = insideName(names, ids.insideGid);
    return `uid=${ids.inside}(${u}) gid=${ids.insideGid}(${g}) groups=${ids.insideGid}(${g})`;
  }
  if (cmd === 'whoami') return /^\d+$/.test(insideName(names, ids.inside)) ? game.error(`whoami: cannot find name for user ID ${ids.inside}`, 1) : insideName(names, ids.inside);
  if (cmd === 'ls') return lsInside(game, c, rest);
  if (cmd === 'cat') {
    const path = rest[0] ?? '';
    const host = hostPath(c, path);
    const n = host ? game.find(host) : null;
    if (!n || n.type !== 'file') return game.error(`cat: ${path}: No such file or directory`, 1);
    if (!processMay(game, c, n, 'r')) return game.error(`cat: ${path}: Permission denied`, 1);
    return game.read(host!) ?? '';
  }
  if (cmd === 'touch') {
    const path = rest[0] ?? '';
    const host = hostPath(c, path);
    const parent = host ? game.find(host.replace(/\/[^/]+$/, '') || '/') : null;
    const n = host ? game.find(host) : null;
    const ok = n ? processMay(game, c, n, 'w') : parent?.type === 'directory' && processMay(game, c, parent, 'w') && processMay(game, c, parent, 'x');
    if (!host || !ok) return game.error(`touch: cannot touch '${path}': Permission denied`, 1);
    if (!n && parent?.type === 'directory')
      parent.children[host.split('/').at(-1)!] = { type: 'file', content: '', owner: machineAccount(game, ids.uid), group: machineGroup(game, ids.gid) };
    return '';
  }
  return game.error(`Error: crun: executable file \`${cmd}\` not found in $PATH: No such file or directory: OCI runtime attempted to invoke a command that was not found`, 127);
}

/** podman unshare: chown as the namespace's root, id, the maps; anything else runs seeing the namespace's ids. */
function unshare(game: Shell, user: string, args: string[], input: string | null, last: boolean): string {
  if (user === 'root') return game.error('Error: please use unshare with rootless', 125);
  const maps = userMaps(game, user);
  const [cmd, ...rest] = args;
  if (!cmd) return game.error(game.t('podman-unshare-shell'), 125);
  const hostNames = Object.fromEntries(Object.entries(game.accounts.users).map(([k, u]) => [k, u.uid]));
  const groupNames = Object.fromEntries(Object.entries(game.accounts.groups).map(([k, g]) => [k, g.gid]));
  if (cmd === 'cat' && /^\/proc\/self\/(uid|gid)_map$/.test(rest[0] ?? '')) {
    const m = rest[0].includes('uid') ? maps.uid : maps.gid;
    return m.map((x) => `${String(x.container).padStart(10)} ${String(x.host).padStart(10)} ${String(x.size).padStart(10)}`).join('\n');
  }
  if (cmd === 'id') return 'uid=0(root) gid=0(root) groups=0(root),65534(nogroup)';
  if (cmd === 'chown') {
    const recursive = rest.some((a) => /^-[a-zA-Z]*R/.test(a) || a === '--recursive');
    const words = rest.filter((a) => !a.startsWith('-'));
    const [spec, ...paths] = words;
    if (!spec || !paths.length) return game.error(game.t('chown-usage'), 1);
    const [u, g] = spec.split(':');
    const nsId = (x: string, names: Record<string, number>) => (/^\d+$/.test(x) ? Number(x) : (names[x] ?? null));
    const uid = nsId(u, hostNames);
    const gid = g === undefined ? null : g === '' ? nsId(u, groupNames) : nsId(g, groupNames);
    if (uid === null) return game.error(game.t('chown-user-incorrect', { owner: spec }), 1);
    for (const path of paths) {
      const target = game.resolve(path);
      if (!game.find(target)) {
        game.error(`chown: cannot access '${path}': No such file or directory`, 1);
        continue;
      }
      for (const [p, n] of recursive ? walk(game, target) : [[target, game.find(target)!] as [string, NonNullable<ReturnType<Shell['find']>>]]) {
        const shown = path + p.slice(target.length);
        const seen = nsOwner(game, maps, n);
        if (seen.uid === OVERFLOW) {
          game.error(`chown: changing ownership of '${shown}': Operation not permitted`, 1);
          continue;
        }
        const hu = toHost(maps.uid, uid);
        const hg = gid === null ? null : toHost(maps.gid, gid);
        if (hu === null || (gid !== null && hg === null)) {
          game.error(`chown: changing ownership of '${shown}': Invalid argument`, 1);
          continue;
        }
        n.owner = machineAccount(game, hu);
        if (hg !== null) n.group = machineGroup(game, hg);
      }
    }
    return '';
  }
  // Any other command, as the namespace's root: it sees the ids through the mapping (ls -ln).
  const name = (id: number, names: Record<string, number>, overflow: string) => (id === OVERFLOW ? overflow : (Object.entries(names).find(([, x]) => x === id)?.[0] ?? String(id)));
  const hostId = (o: string, names: Record<string, number>) => names[o] ?? (/^\d+$/.test(o) ? Number(o) : -1);
  game.state.idView = {
    owner: (o: string) => name(maps.uid.some((m) => hostId(o, hostNames) >= m.host && hostId(o, hostNames) < m.host + m.size) ? nsOf(maps.uid, hostId(o, hostNames)) : OVERFLOW, hostNames, hostNames.nobody !== undefined ? 'nobody' : String(OVERFLOW)),
    group: (g: string) => name(maps.gid.some((m) => hostId(g, groupNames) >= m.host && hostId(g, groupNames) < m.host + m.size) ? nsOf(maps.gid, hostId(g, groupNames)) : OVERFLOW, groupNames, groupNames.nogroup !== undefined ? 'nogroup' : String(OVERFLOW)),
  };
  const before = game.who;
  try {
    game.who = 'root';
    return game.run(args, input, last);
  } finally {
    game.who = before;
    delete game.state.idView;
  }
}
const nsOf = (map: { container: number; host: number; size: number }[], host: number) => {
  const m = map.find((x) => host >= x.host && host < x.host + x.size);
  return m ? m.container + host - m.host : OVERFLOW;
};

// ——— podman ———

const SUBCOMMANDS = ['run', 'ps', 'images', 'pull', 'logs', 'exec', 'stop', 'start', 'restart', 'rm', 'rmi', 'unshare', 'top', 'port', 'info', 'version', 'system', 'generate', 'container', 'image'];

function containerOf(game: Shell, s: ReturnType<typeof store>, key: string | undefined): PContainer | string {
  if (!key) return 'Error: requires at least 1 arg(s), only received 0';
  const c = s.containers.find((x) => x.name === key) ?? s.containers.find((x) => key.length >= 3 && x.id.startsWith(key));
  return c ?? `Error: no container with name or ID "${key}" found: no such container`;
}

function podmanCommand(c: Context): string {
  const game = c.game;
  let args = [...c.args];
  // Global options.
  while (args[0]?.startsWith('--log-level') || args[0] === '--remote=false') args = args.slice(args[0].includes('=') ? 1 : 2);
  if (args[0] === '-v' || args[0] === '--version') return `podman version ${VERSION}`;
  if (!args.length) return game.error("Error: missing command 'podman COMMAND'\nTry 'podman --help' for more information", 125);
  // podman container ls/rm…, podman image ls/rm…: the same commands.
  if (args[0] === 'container' || args[0] === 'image') {
    const map: Record<string, string> = args[0] === 'container' ? { ls: 'ps', list: 'ps' } : { ls: 'images', list: 'images', rm: 'rmi', pull: 'pull' };
    args = [map[args[1]] ?? args[1], ...args.slice(2)];
  }
  const [sub, ...rest] = args;
  if (!SUBCOMMANDS.includes(sub ?? '')) return game.error(`Error: unrecognized command \`podman ${sub}\`\nTry 'podman --help' for more information`, 125);
  if (sub === 'version') return [`Client:       Podman Engine`, `Version:      ${VERSION}`, `API Version:  ${VERSION}`, `Go Version:   go1.24.4`, `Built:        Fri Jun 13 17:05:46 2025`, `OS/Arch:      linux/amd64`].join('\n');
  const user = game.who;
  settle(game);
  // The warnings of every rootless command: no user session; the namespace built without subordinate ids.
  if (user !== 'root') {
    managerService(game, user);
    if (!managerRunning(game, user)) for (const w of SESSION_WARNINGS(uidOf(game, user))) game.error(w);
    if (!store(game, user).pause && sub !== 'info') {
      const fresh = freshMaps(game, user);
      if (fresh.single) {
        const file = subIds(game, 'subuid', user).length ? 'subgid' : 'subuid';
        game.error(`ERRO[0000] cannot find UID/GID for user ${user}: no ${file} ranges found for user "${user}" in /etc/${file} - check rootless mode in man pages.`);
        game.error('WARN[0000] Using rootless single mapping into the namespace. This might break some images. Check /etc/subuid and /etc/subgid for adding sub*ids if not using a network user');
      }
      userMaps(game, user);
    }
  }
  const before = game.errorCount();
  const out = subcommand(game, user, sub, rest, c);
  if (game.errorCount() === before && game.status === null) game.status = 0;
  settle(game);
  return out;
}

function subcommand(game: Shell, user: string, sub: string, rest: string[], ctx: Context): string {
  const s = store(game, user);
  const fail = (text: string, code = 125) => game.error(text, code);
  switch (sub) {
    case 'pull': {
      const p = parse(rest, ['--authfile', '--arch', '--platform'], ['-q', '--quiet'], 'pull', true);
      if (p.error) return fail(p.error);
      if (!p.rest[0]) return fail('Error: requires at least 1 arg(s), only received 0');
      const r = pull(game, user, p.rest[0]);
      if (r.error) {
        r.lines.forEach((l) => game.error(l));
        return fail(r.error);
      }
      return has(p, '-q', '--quiet') ? r.image!.id : r.lines.join('\n');
    }
    case 'images': {
      const p = parse(rest, ['--format', '--filter', '-f'], ['-a', '--all', '-q', '--quiet', '--no-trunc'], 'images', true);
      if (p.error) return fail(p.error);
      const images = Object.values(s.images);
      if (has(p, '-q', '--quiet')) return images.map((i) => i.id.slice(0, 12)).join('\n');
      return table([['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE'], ...images.map((i) => [i.ref.slice(0, i.ref.lastIndexOf(':')), i.ref.slice(i.ref.lastIndexOf(':') + 1), i.id.slice(0, 12), `${duration(now(game) - i.created)} ago`, humanSize(i.size)])]);
    }
    case 'rmi': {
      const p = parse(rest, [], ['-f', '--force', '-a', '--all'], 'rmi', true);
      if (p.error) return fail(p.error);
      const out: string[] = [];
      for (const ref of p.rest) {
        const i = findImage(s, ref);
        if (!i) return fail(`Error: ${ref}: image not known`, 1);
        const users = s.containers.filter((x) => x.image === i.ref);
        if (users.length && !has(p, '-f', '--force'))
          return fail(`Error: image used by ${users[0].id}: image is in use by a container: consider listing external containers and force-removing image`, 2);
        for (const x of users) end(game, x, 137, true);
        s.containers = s.containers.filter((x) => x.image !== i.ref);
        delete s.images[i.ref];
        out.push(`Untagged: ${i.ref}`, `Deleted: ${i.id}`);
      }
      return out.join('\n');
    }
    case 'run': {
      const p = parse(rest, RUN_VALUED, RUN_BOOLS, 'run');
      if (p.error) return fail(p.error);
      const line = game.commandLine;
      const r = runContainer(game, user, rest, user === 'root' ? 'system' : managerRunning(game, user) ? 'manager' : 'session');
      if (r.container && /(^|[\s;&|])nohup\s/.test(line)) r.container.nohup = true;
      r.lines.forEach((l) => game.error(l));
      if (r.error) return fail(r.error, r.code);
      const cont = r.container!;
      if (has(p, '-d', '--detach')) return cont.id;
      return cont.log.map((l) => l.text).join('\n');
    }
    case 'ps': {
      const p = parse(rest, ['--format', '--filter', '-f', '-n', '--last'], ['-a', '--all', '-q', '--quiet', '--no-trunc', '-l', '--latest', '-s', '--size'], 'ps', true);
      if (p.error) return fail(p.error);
      const list = s.containers.filter((x) => has(p, '-a', '--all') || x.state === 'running');
      if (has(p, '-q', '--quiet')) return list.map((x) => x.id.slice(0, 12)).join('\n');
      const imageOf = (x: PContainer) => s.images[x.image];
      return table([
        ['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES'],
        ...list.map((x) => [x.id.slice(0, 12), x.image, has(p, '--no-trunc') ? (imageOf(x)?.command ?? '') : command17(imageOf(x)?.command ?? ''), `${duration(now(game) - x.created)} ago`, statusOf(game, x), ports(x), x.name]),
      ]);
    }
    case 'logs': {
      const p = parse(rest, ['-n', '--tail', '--since', '--until'], ['-f', '--follow', '-t', '--timestamps', '-l', '--latest'], 'logs', true);
      if (p.error) return fail(p.error);
      const x = containerOf(game, s, p.rest[0]);
      if (typeof x === 'string') return fail(x);
      const tail = one(p, '-n', '--tail');
      const lines = x.log.map((l) => l.text);
      return (tail !== undefined && Number(tail) >= 0 ? lines.slice(-Number(tail) || lines.length) : lines).join('\n');
    }
    case 'exec': {
      const p = parse(rest, ['-u', '--user', '-w', '--workdir', '-e', '--env'], ['-i', '--interactive', '-t', '--tty', '-d', '--detach'], 'exec');
      if (p.error) return fail(p.error);
      const [key, ...cmd] = p.rest;
      const x = containerOf(game, s, key);
      if (typeof x === 'string') return fail(x);
      if (!cmd.length) return fail('Error: must provide a non-empty command to start an exec session: invalid argument');
      if (x.state !== 'running') return fail(`Error: can only create exec sessions on running containers: container state improper`, 255);
      return execIn(game, x, cmd);
    }
    case 'top': {
      const [key, ...descriptors] = rest;
      const x = containerOf(game, s, key);
      if (typeof x === 'string') return fail(x);
      if (x.state !== 'running') return fail(`Error: top can only be used on running containers: container state improper`);
      const ids = processIds(game, x);
      const image = s.images[x.image];
      const names = image?.accounts ?? { root: 0 };
      const hostName = machineAccount(game, ids.uid);
      const k = s.containers.filter((y) => y.state === 'running').indexOf(x);
      const values: Record<string, [string, string]> = {
        user: ['USER', insideName(names, ids.inside)],
        huser: ['HUSER', hostName],
        group: ['GROUP', insideName(names, ids.insideGid)],
        hgroup: ['HGROUP', machineGroup(game, ids.gid)],
        pid: ['PID', '1'],
        hpid: ['HPID', String(2407 + Math.max(k, 0) * 20)],
        ppid: ['PPID', '0'],
        '%cpu': ['%CPU', '0.000'],
        elapsed: ['ELAPSED', `${Math.round((now(game) - x.started) / 1000)}s`],
        tty: ['TTY', '?'],
        time: ['TIME', '0s'],
        args: ['COMMAND', image?.command ?? ''],
        comm: ['COMMAND', (image?.command ?? '').split(' ')[0].split('/').at(-1) ?? ''],
      };
      const chosen = descriptors.length ? descriptors : ['user', 'pid', 'ppid', '%cpu', 'elapsed', 'tty', 'time', 'args'];
      const bad = chosen.find((d) => !values[d]);
      if (bad) return fail(`Error: '${bad}': unknown descriptor`);
      return table([chosen.map((d) => values[d][0]), chosen.map((d) => values[d][1])]);
    }
    case 'port': {
      const x = containerOf(game, s, rest[0]);
      if (typeof x === 'string') return fail(x);
      return x.ports.map((p) => `${p.container}/tcp -> ${p.ip || '0.0.0.0'}:${p.host}`).join('\n');
    }
    case 'stop':
    case 'start':
    case 'restart':
    case 'rm': {
      const p = parse(rest, ['-t', '--time'], ['-f', '--force', '-a', '--all', '-i', '--ignore', '-v', '--volumes'], sub, true);
      if (p.error) return fail(p.error);
      if (!p.rest.length && !has(p, '-a', '--all')) return fail(`Error: you must provide at least one name or id`);
      const targets = has(p, '-a', '--all') ? [...s.containers] : p.rest.map((k) => containerOf(game, s, k));
      const out: string[] = [];
      for (const [i, x] of targets.entries()) {
        if (typeof x === 'string') {
          if (has(p, '-i', '--ignore')) continue;
          fail(x);
          continue;
        }
        const shown = p.rest[i] ?? x.id;
        if (sub === 'stop') {
          end(game, x, 0, false);
          out.push(shown);
        } else if (sub === 'rm') {
          if (x.state === 'running' && !has(p, '-f', '--force')) {
            fail(`Error: cannot remove container ${x.id} as it is running - running or paused containers cannot be removed without force: container state improper`, 2);
            continue;
          }
          end(game, x, 137, true);
          s.containers = s.containers.filter((y) => y !== x);
          out.push(has(p, '-a', '--all') ? x.id : shown);
        } else {
          if (sub === 'restart') end(game, x, 0, true);
          if (x.state === 'running') {
            out.push(shown);
            continue;
          }
          x.scope = user === 'root' ? 'system' : managerRunning(game, user) ? 'manager' : 'session';
          const e = startContainer(game, x);
          if (e) {
            fail(e, 125);
            continue;
          }
          out.push(shown);
        }
      }
      return out.join('\n');
    }
    case 'unshare':
      return unshare(game, user, rest, ctx.input, ctx.last);
    case 'info':
      return info(game, user);
    case 'system': {
      if (rest[0] === 'migrate') {
        if (user !== 'root') {
          for (const x of s.containers) if (x.state === 'running') end(game, x, 0, false);
          s.pause = null;
          userMaps(game, user);
        }
        return '';
      }
      return fail(`Error: unrecognized command \`podman system ${rest[0] ?? ''}\`\nTry 'podman system --help' for more information`);
    }
    case 'generate': {
      if (rest[0] !== 'systemd') return fail(`Error: unrecognized command \`podman generate ${rest[0] ?? ''}\`\nTry 'podman generate --help' for more information`);
      game.error('\nDEPRECATED command:\nIt is recommended to use Quadlets for running containers and pods under systemd.\n\nPlease refer to podman-systemd.unit(5) for details.');
      const names = rest.slice(1).filter((a) => !a.startsWith('-'));
      const x = containerOf(game, s, names[0]);
      if (typeof x === 'string') return fail(x);
      return [
        `# container-${x.name}.service`,
        `# autogenerated by Podman ${VERSION}`,
        '',
        '[Unit]',
        `Description=Podman container-${x.name}.service`,
        'Documentation=man:podman-generate-systemd(1)',
        'Wants=network-online.target',
        'After=network-online.target',
        `RequiresMountsFor=${runtimeDir(game, user)}/containers`,
        '',
        '[Service]',
        'Environment=PODMAN_SYSTEMD_UNIT=%n',
        'Restart=on-failure',
        'TimeoutStopSec=70',
        `ExecStart=/usr/bin/podman start ${x.name}`,
        `ExecStop=/usr/bin/podman stop -t 10 ${x.name}`,
        `ExecStopPost=/usr/bin/podman stop -t 10 ${x.name}`,
        `PIDFile=${runtimeDir(game, user)}/containers/overlay-containers/${x.id}/userdata/conmon.pid`,
        'Type=forking',
        '',
        '[Install]',
        'WantedBy=default.target',
      ].join('\n');
    }
  }
  return '';
}

function info(game: Shell, user: string): string {
  const rootless = user !== 'root';
  const maps = rootless ? userMaps(game, user) : null;
  const idmap = (m: { container: number; host: number; size: number }[]) => m.map((x) => `    - container_id: ${x.container}\n      host_id: ${x.host}\n      size: ${x.size}`).join('\n');
  const home = homeOf(game, user);
  const s = store(game, user);
  return [
    'host:',
    '  arch: amd64',
    '  cgroupManager: ' + (rootless && !managerRunning(game, user) ? 'cgroupfs' : 'systemd'),
    '  cgroupVersion: v2',
    '  distribution:',
    '    codename: trixie',
    '    distribution: debian',
    '    version: "13"',
    '  idMappings:',
    ...(maps ? ['    gidmap:', idmap(maps.gid), '    uidmap:', idmap(maps.uid)] : ['    gidmap: null', '    uidmap: null']),
    '  kernel: 6.12.43+deb13-amd64',
    '  networkBackend: netavark',
    '  ociRuntime:',
    '    name: crun',
    '  os: linux',
    '  pasta:',
    '    executable: /usr/bin/pasta',
    '    package: passt_0.0~git20250503.587980c-2+deb13u1_amd64',
    '  security:',
    `    rootless: ${rootless}`,
    `  serviceIsRemote: false`,
    'store:',
    '  containerStore:',
    `    number: ${s.containers.length}`,
    `    running: ${s.containers.filter((x) => x.state === 'running').length}`,
    `  graphRoot: ${rootless ? `${home}/.local/share/containers/storage` : '/var/lib/containers/storage'}`,
    '  imageStore:',
    `    number: ${Object.keys(s.images).length}`,
    `  runRoot: ${rootless ? `${runtimeDir(game, user)}/containers` : '/run/containers/storage'}`,
    'version:',
    `  APIVersion: ${VERSION}`,
    `  Version: ${VERSION}`,
  ].join('\n');
}

// ——— systemctl --user ———

const unitName = (n: string) => (n.includes('.') ? n : `${n}.service`);

/** systemctl --user (and -M USER@ --user): the account's manager and its units. */
export function userSystemctl(c: Context): string {
  const game = c.game;
  const args = c.args;
  settle(game);
  let machine: string | null = null;
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-M' || a === '--machine') machine = args[++i] ?? '';
    else if (a.startsWith('--machine=')) machine = a.slice(10);
    else if (/^-M./.test(a)) machine = a.slice(2);
    else if (a.startsWith('-')) continue;
    else words.push(a);
  }
  const fail = (text: string, code = 1) => game.error(text, code);
  let user = game.who;
  let transport = 'local';
  if (machine !== null) {
    transport = 'machine';
    const m = /^([^@]*)@(\.host)?$/.exec(machine);
    if (!m) return fail(`Failed to connect to user scope bus via machine transport: Host is down`);
    user = m[1] || game.who;
    if (!game.accounts.users[user]) return fail(`Failed to connect to user scope bus via machine transport: No such process`);
    if (game.who !== 'root' && game.who !== user) return fail('Failed to connect to user scope bus via machine transport: Operation not permitted');
  } else {
    // The bus of the user's manager is found through $XDG_RUNTIME_DIR, which a login sets (pam_systemd), not sudo.
    const env = game.environment.XDG_RUNTIME_DIR ?? game.vars.XDG_RUNTIME_DIR ?? (user === game.player && !game.shells.length ? runtimeDir(game, user) : undefined);
    if (!env) return fail('Failed to connect to user scope bus via local transport: $DBUS_SESSION_BUS_ADDRESS and $XDG_RUNTIME_DIR not defined (consider using --machine=<user>@.host --user to connect to bus of other user)');
    if (env !== runtimeDir(game, user) || !game.exists(`${env}/bus`)) return fail('Failed to connect to user scope bus via local transport: No such file or directory');
  }
  managerService(game, user);
  if (!managerRunning(game, user)) return fail(`Failed to connect to user scope bus via ${transport} transport: No such file or directory`);
  const m = podman(game).managers[user];
  const [verb = 'list-units', ...names] = words;
  const sd = systemd(game) as Systemd;
  const known = (n: string) => m.units[unitName(n)];
  switch (verb) {
    case 'daemon-reload':
      generate(game, user);
      settle(game);
      return '';
    case 'start':
    case 'restart': {
      if (!names.length) return fail('Too few arguments.');
      for (const n of names) {
        const u = known(n);
        if (!u) return fail(`Failed to ${verb} ${unitName(n)}: Unit ${unitName(n)} not found.`, 5);
        if (verb === 'restart' && u.state === 'active') stopUserUnit(game, user, u.name);
        if (u.state !== 'active' && !startUserUnit(game, user, u.name))
          fail(`Job for ${u.name} failed because the control process exited with error code.\nSee "systemctl --user status ${u.name}" and "journalctl --user -xeu ${u.name}" for details.`);
      }
      settle(game);
      return '';
    }
    case 'stop': {
      for (const n of names) {
        const u = known(n);
        if (!u) return fail(`Failed to stop ${unitName(n)}: Unit ${unitName(n)} not loaded.`, 5);
        if (u.state === 'active') stopUserUnit(game, user, u.name);
      }
      settle(game);
      return '';
    }
    case 'enable':
    case 'disable':
    case 'reenable': {
      if (!names.length) return fail('Too few arguments.');
      const u = known(names[0]);
      if (u) return fail(`Failed to ${verb} unit: Unit ${runtimeDir(game, user)}/systemd/generator/${u.name} is transient or generated`);
      return fail(`Failed to ${verb} unit: Unit file ${unitName(names[0])} does not exist.`);
    }
    case 'is-active': {
      const u = names[0] ? known(names[0]) : undefined;
      const state = u?.state ?? 'inactive';
      if (state !== 'active') game.status = 3;
      return state;
    }
    case 'is-enabled': {
      const u = names[0] ? known(names[0]) : undefined;
      if (!u) return fail(`Failed to get unit file state for ${unitName(names[0] ?? '')}: No such file or directory`);
      return 'generated';
    }
    case 'cat': {
      if (!names.length) return fail('Too few arguments.');
      const u = known(names[0]);
      if (!u) return fail(`No files found for ${unitName(names[0])}.`);
      return `# ${runtimeDir(game, user)}/systemd/generator/${u.name}\n${u.text}`;
    }
    case 'status': {
      if (!names.length) {
        const loaded = Object.values(m.units);
        return [
          `● ${sd.host}`,
          '    State: running',
          `    Units: ${loaded.length + 12} loaded (incl. loaded aliases)`,
          '     Jobs: 0 queued',
          `   Failed: ${loaded.filter((u) => u.state === 'failed').length} units`,
          `    Since: ${dateComplete(m.since ?? sd.clock, game.t.language, sd)}; ${sdDuration(sd.clock - (m.since ?? sd.clock))} ago`,
          `  systemd: 257.8-1~deb13u2`,
          `   CGroup: /user.slice/user-${uidOf(game, user)}.slice/${managerUnit(game, user)}.service`,
        ].join('\n');
      }
      const u = known(names[0]);
      if (!u) return fail(`Unit ${unitName(names[0])} could not be found.`, 4);
      const lang = game.t.language;
      const ago = (t: number) => `${dateComplete(t, lang, sd)}; ${sdDuration(sd.clock - t)} ago`;
      const running = store(game, user).containers.find((x) => x.unit === u.name && x.state === 'running');
      const head = [
        `${u.state === 'active' ? '●' : u.state === 'failed' ? '\u00d7' : '○'} ${u.name}${u.description ? ` - ${u.description}` : ''}`,
        `     Loaded: loaded (${u.source}; generated)`,
        `     Active: ${u.state === 'active' ? `active (running) since ${ago(u.since)}` : u.state === 'failed' ? `failed (Result: exit-code) since ${ago(u.since)}` : 'inactive (dead)'}`,
      ];
      if (running) {
        const k = Object.values(podman(game).users).flatMap((x) => x.containers).filter((y) => y.state === 'running').indexOf(running);
        const pid = 2400 + Math.max(k, 0) * 20;
        head.push(
          `   Main PID: ${pid} (conmon)`,
          `      Tasks: 4 (limit: 4596)`,
          `     Memory: 21.3M (peak: 24.0M)`,
          `        CPU: 412ms`,
          `     CGroup: /user.slice/user-${uidOf(game, user)}.slice/${managerUnit(game, user)}.service/app.slice/${u.name}`,
          `             ├─libpod-payload-${running.id}`,
          `             │ └─${pid + 7} ${store(game, user).images[running.image]?.command ?? ''}`,
          `             └─runtime`,
          `               └─${pid} /usr/bin/conmon --api-version 1 -c ${running.id} -u ${running.id} -n ${running.name}`,
        );
      }
      const lines = sd.log.filter((e) => e.userUnit === u.name).slice(-10);
      return [...head, ...(lines.length ? ['', ...lines.map((e) => logLine(e, sd, lang))] : [])].join('\n');
    }
    case 'list-units': {
      const units = Object.values(m.units);
      const rows = units.map((u) => `  ${u.name.padEnd(24)} loaded ${u.state.padEnd(8)} ${u.state === 'active' ? 'running' : 'dead   '} ${u.name}`);
      return [`  ${'UNIT'.padEnd(24)} LOAD   ACTIVE   SUB     DESCRIPTION`, ...rows, '', `${units.length} loaded units listed.`].join('\n');
    }
  }
  return fail(`Unknown command verb '${verb}'.`);
}

// ——— loginctl ———

function loginctl(c: Context): string {
  const game = c.game;
  settle(game);
  const words = c.args.filter((a) => !a.startsWith('-'));
  const property = c.args.find((a) => a.startsWith('--property='))?.slice(11) ?? (c.args.includes('-p') ? c.args[c.args.indexOf('-p') + 1] : undefined);
  const valueOnly = c.args.includes('--value');
  const [verb = 'list-sessions', ...rest] = words.filter((w) => w !== property);
  const fail = (text: string, code = 1) => game.error(text, code);
  const sessions = (u: string) => (u === game.player ? ['3'] : []);
  switch (verb) {
    case 'enable-linger':
    case 'disable-linger': {
      const targets = rest.length ? rest : [game.who];
      for (const u of targets) {
        if (!game.accounts.users[u] && !/^\d+$/.test(u)) return fail(`Failed to look up user ${u}: No such process`);
        if (game.who !== 'root') return fail(`Could not ${verb === 'enable-linger' ? 'enable' : 'disable'} linger: Access denied`);
        const user = game.accounts.users[u] ? u : Object.entries(game.accounts.users).find(([, x]) => String(x.uid) === u)?.[0] ?? u;
        const dir = game.find('/var/lib/systemd/linger');
        if (dir?.type !== 'directory') continue;
        if (verb === 'enable-linger') {
          dir.children[user] = { type: 'file', content: '', owner: 'root', group: 'root' };
          startManager(game, user);
        } else {
          delete dir.children[user];
          const svc = managerService(game, user);
          svc.active = false;
          // Without lingering nor a session, logind stops the manager (and what runs in it).
          if (!sessions(user).length && svc.state === 'active') {
            const sd = systemd(game) as Systemd;
            svc.state = 'inactive';
            svc.since = sd.clock;
            sd.log.push({ time: (sd.clock += 1000), boot: sd.boot, unit: `${managerUnit(game, user)}.service`, ident: 'systemd', pid: 1, message: `Stopped ${managerUnit(game, user)}.service - User Manager for UID ${uidOf(game, user)}.`, priority: 6 });
          }
          settle(game);
        }
      }
      return '';
    }
    case 'show-user': {
      const u = rest[0] ?? game.who;
      if (!game.accounts.users[u]) return fail(`Failed to look up user ${u}: No such process`);
      const linger = lingers(game, u);
      if (!linger && !sessions(u).length) return fail(`Failed to get user: User ID ${uidOf(game, u)} is not logged in or lingering`);
      const props: [string, string][] = [
        ['UID', String(uidOf(game, u))],
        ['GID', String(gidOf(game, u))],
        ['Name', u],
        ['RuntimePath', runtimeDir(game, u)],
        ['Service', `${managerUnit(game, u)}.service`],
        ['Slice', `user-${uidOf(game, u)}.slice`],
        ['Sessions', sessions(u).join(' ')],
        ['IdleHint', 'no'],
        ['Linger', linger ? 'yes' : 'no'],
        ['State', sessions(u).length ? 'active' : 'lingering'],
      ];
      const chosen = property ? props.filter(([k]) => property.split(',').includes(k)) : props;
      return chosen.map(([k, v]) => (valueOnly ? v : `${k}=${v}`)).join('\n');
    }
    case 'list-users': {
      const users = Object.keys(game.accounts.users).filter((u) => u !== 'root' && (lingers(game, u) || sessions(u).length));
      const rows = users.map((u) => [String(uidOf(game, u)).padStart(4), u.padEnd(9), (lingers(game, u) ? 'yes' : 'no').padEnd(6), sessions(u).length ? 'active' : 'lingering']);
      return [` UID ${'USER'.padEnd(9)} LINGER STATE`, ...rows.map((r) => r.join(' ')), '', `${users.length} users listed.`].join('\n');
    }
    case 'list-sessions':
      return ['SESSION  UID USER SEAT LEADER CLASS TTY   IDLE SINCE', `      3 ${String(uidOf(game, game.player)).padStart(4)} ${game.player.padEnd(4)} -    1180   user  pts/0 no   -`, '', '1 sessions listed.'].join('\n');
  }
  return fail(`Unknown command verb '${verb}'.`);
}

// ——— Quadlet's dry run (/usr/libexec/podman/quadlet -dryrun) ———

function quadlet(c: Context): string {
  const game = c.game;
  const userMode = c.args.includes('-user') || c.args.includes('--user');
  if (!c.args.some((a) => a === '-dryrun' || a === '--dryrun')) return game.error('quadlet-generator[2318]: Missing output directory argument', 1);
  const user = userMode ? game.who : 'root';
  const files = userMode ? quadletFiles(game, user) : [];
  const out: string[] = [];
  let failed = false;
  for (const [path, text] of files) {
    const r = convert(path, text, '/usr/libexec/podman/quadlet');
    if (r.error) {
      game.error(`quadlet-generator[2318]: ${r.error}`);
      failed = true;
    } else out.push(`---${r.unit!.name}---\n${r.unit!.text}\n`);
  }
  if (failed) game.status = 1;
  return out.join('\n');
}

export const PODMAN_COMMANDS: Record<string, Command> = {
  podman: { section: 1, ownOptions: true, launch: podmanCommand },
  loginctl: { section: 1, ownOptions: true, launch: loginctl },
  quadlet: { section: 1, ownOptions: true, directory: '/usr/libexec/podman', launch: quadlet },
  // The manual pages of the files: podman-systemd.unit(5) and subuid(5).
  'podman-systemd.unit': { section: 5, launch: () => '' },
  subuid: { section: 5, launch: () => '' },
};

/** The family's hooks: systemctl --user goes through the account's manager. */
export const HOOKS_PODMAN = { userSystemctl };
