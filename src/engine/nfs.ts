// NFS: a server's exports and a client's network mounts.
//
// The server: /etc/exports (and /etc/exports.d/*.exports), read like
// exportfs(8) reads it, into the table the kernel serves (state.nfs.table),
// loaded when nfs-server starts and by exportfs -r/-a. The client: mount -t
// nfs (or a source "host:/path") grafts the server's directory at the mount
// point (the same tree: what one writes, the other sees); the server decides
// every access with the client's numbers, as NFS with sec=sys does: the
// client's uid and gids, squashed to anonuid (65534, nobody) for root under
// root_squash (the default) or for everyone under all_squash, compared with
// the uid and gid of the file on the server. Names are each machine's own:
// a uid with no account on the client shows as a number.
// Sources: https://man7.org/linux/man-pages/man5/exports.5.html,
// https://man7.org/linux/man-pages/man8/exportfs.8.html,
// https://man7.org/linux/man-pages/man5/nfs.5.html (mount.nfs),
// https://man7.org/linux/man-pages/man8/showmount.8.html
// Simplifications: NFSv4 (one port, 2049) for mounting, showmount needs
// rpcbind (111); no Kerberos (sec=krb5), no idmapd name mapping, no
// subtree_check, no locks; a host name matches by the client's address.

import type { Shell } from './shell';
import type { Directory, Node } from './world';
import { inNetwork, verdict, type Firewall } from './firewall';

export const EXPORTS = '/etc/exports';
export const NOBODY = 65534;

export interface ExportClient {
  // 192.0.2.0/24, 192.0.2.32, darkroom.internal, *
  spec: string;
  options: string[];
}
export interface Export {
  path: string;
  clients: ExportClient[];
  line: number;
  file: string;
}
export interface NfsServer {
  // What the kernel serves (exportfs -r loads it from the files).
  table: Export[];
}
/** What a client remembers of a mount. */
export interface NfsMount {
  host: string;
  address: string;
  export: string;
  // The mount's own options (rw, hard, vers=4.2…).
  options: string[];
}

export const server = (j: Shell): NfsServer => (j.state.nfs ??= { table: [] });

// The options exportfs adds to what is written (exportfs -v shows them all).
const DEFAULTS = ['sync', 'wdelay', 'hide', 'no_subtree_check', 'sec=sys', 'secure', 'root_squash', 'no_all_squash'];
const OPPOSITES: Record<string, string> = {
  rw: 'ro', ro: 'rw', sync: 'async', async: 'sync', root_squash: 'no_root_squash', no_root_squash: 'root_squash',
  all_squash: 'no_all_squash', no_all_squash: 'all_squash', subtree_check: 'no_subtree_check', no_subtree_check: 'subtree_check',
  secure: 'insecure', insecure: 'secure', wdelay: 'no_wdelay', no_wdelay: 'wdelay', hide: 'nohide', nohide: 'hide',
};
const KNOWN = new Set([...Object.keys(OPPOSITES), 'sec=sys', 'fsid=0', 'crossmnt']);

/** All of an export's options, as exportfs -v prints them (what is written wins over the defaults). */
export function effective(options: string[]): string[] {
  const out = [...DEFAULTS];
  if (!options.includes('rw') && !options.includes('ro')) out.push('ro');
  for (const o of options) {
    const opposite = OPPOSITES[o];
    const i = opposite ? out.indexOf(opposite) : -1;
    if (i >= 0) out.splice(i, 1);
    if (!out.includes(o)) out.push(o);
  }
  // exportfs -v's order: sync,wdelay,hide,no_subtree_check,sec=sys,rw,secure,root_squash,no_all_squash
  const order = ['sync', 'async', 'wdelay', 'no_wdelay', 'hide', 'nohide', 'crossmnt', 'no_subtree_check', 'subtree_check', 'fsid=0', 'sec=sys', 'rw', 'ro', 'secure', 'insecure', 'root_squash', 'no_root_squash', 'all_squash', 'no_all_squash'];
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** The exports files, read like exportfs; warnings and errors as exportfs writes them. */
export function readExports(j: Shell): { exports: Export[]; messages: string[] } {
  const files = [EXPORTS];
  const dir = j.find('/etc/exports.d');
  if (dir?.type === 'directory') files.push(...Object.keys(dir.children).filter((n) => n.endsWith('.exports')).sort().map((n) => `/etc/exports.d/${n}`));
  const exports: Export[] = [];
  const messages: string[] = [];
  for (const file of files) {
    (j.read(file) ?? '').split('\n').forEach((raw, i) => {
      const l = raw.replace(/#.*/, '').trim();
      if (!l) return;
      const [path, ...rest] = l.split(/\s+/);
      if (!path.startsWith('/')) {
        messages.push(`exportfs: ${file}:${i + 1}: unknown keyword "${path}"`);
        return;
      }
      const clients: ExportClient[] = [];
      for (const word of rest.length ? rest : ['*']) {
        const m = /^([^(]*)(?:\(([^)]*)\))?$/.exec(word);
        if (!m) {
          messages.push(`exportfs: ${file}:${i + 1}: syntax error: bad option list`);
          continue;
        }
        const options = (m[2] ?? '').split(',').filter(Boolean);
        const bad = options.find((o) => !KNOWN.has(o) && !/^anon[ug]id=\d+$/.test(o));
        if (bad) {
          messages.push(`exportfs: ${file}:${i + 1}: unknown keyword "${bad}"`);
          continue;
        }
        const spec = m[1] || '*';
        if (!options.includes('subtree_check') && !options.includes('no_subtree_check'))
          messages.push(
            `exportfs: ${file} [${i + 1}]: Neither 'subtree_check' or 'no_subtree_check' specified for export "${spec}:${path}".\n  Assuming default behaviour ('no_subtree_check').\n  NOTE: this default has changed since nfs-utils version 1.0.x\n`,
          );
        clients.push({ spec, options });
      }
      if (j.find(path)?.type !== 'directory') {
        messages.push(`exportfs: Failed to stat ${path}: No such file or directory`);
        return;
      }
      exports.push({ path, clients, line: i + 1, file });
    });
  }
  return { exports, messages };
}

/** exportfs -r (and nfs-server starting): the table becomes what the files say. */
export function reload(j: Shell): string[] {
  const { exports, messages } = readExports(j);
  server(j).table = exports;
  return messages;
}

/** Does this client (its address, its names) match this specification? */
function matches(spec: string, address: string, names: string[]): boolean {
  if (spec === '*') return true;
  if (/^[\d.]+(\/\d+)?$/.test(spec)) return inNetwork(address, spec.includes('/') || !/\.\d+$/.test(spec) ? spec : `${spec}/32`);
  const re = new RegExp(`^${spec.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*').replace(/\?/g, '.')}$`, 'i');
  return names.some((n) => re.test(n));
}

/** The export that serves this path to this client, and the options it gets (the first matching client). */
export function lookup(j: Shell, path: string, address: string, names: string[]): { exported: Export; options: string[] } | null {
  const clean = path.replace(/\/+$/, '') || '/';
  const candidates = server(j)
    .table.filter((e) => clean === e.path || clean.startsWith(e.path === '/' ? '/' : `${e.path}/`))
    .sort((a, b) => b.path.length - a.path.length);
  for (const e of candidates) {
    const c = e.clients.find((x) => matches(x.spec, address, names));
    if (c) return { exported: e, options: effective(c.options) };
  }
  return null;
}

// ——— The client side ———

/** The machines of the story (the main one and the internal ones), by name, domain or address. */
function machines(j: Shell): { shell: Shell; address: string; names: string[] }[] {
  const p = j.principal;
  const out: { shell: Shell; address: string; names: string[] }[] = [];
  const main = p.state.nfsAddress as string | undefined;
  if (main) out.push({ shell: p, address: main, names: [p.host, `${p.host}.internal`] });
  for (const h of p.internal_()) {
    const s = p.internal(h.name);
    if (s) out.push({ shell: s, address: h.address, names: [h.name, h.domain] });
  }
  return out;
}

/** This machine's address on the story's network (for the server: who is asking). */
export function addressOf(j: Shell): string {
  return machines(j).find((m) => m.shell === j)?.address ?? '127.0.0.1';
}

/** The addresses of the story's machines that have something mounted from this server (showmount). */
export function clientsOf(j: Shell): string[] {
  return machines(j)
    .filter((m) => nfsMounts(m.shell).some((x) => (x as { nfs?: NfsMount }).nfs && serverFor(m.shell, (x as { nfs: NfsMount }).nfs.host)?.shell === j))
    .map((m) => m.address)
    .sort();
}

/** The server a client names (through its /etc/hosts, or an address). */
export function serverFor(j: Shell, host: string): { shell: Shell; address: string } | null {
  let address: string | null = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : null;
  for (const line of (j.read('/etc/hosts') ?? '').split('\n')) {
    const [a, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (!address && names.includes(host)) address = a;
  }
  if (!address) return null;
  const m = machines(j).find((x) => x.address === address);
  return m ? { shell: m.shell, address } : null;
}

/** The NFS mounts of this machine (state.mounts entries with `nfs`). */
export const nfsMounts = (j: Shell) => ((j.state.mounts ?? []) as { path: string; nfs?: NfsMount }[]).filter((m) => m.nfs);

const contains = (root: Node, n: Node): boolean => root === n || (root.type === 'directory' && Object.values(root.children).some((c) => contains(c, n)));

/** The NFS mount this node is reached through, on this machine, if any. */
export function mountOf(j: Shell, n: Node): { path: string; nfs: NfsMount } | null {
  for (const m of nfsMounts(j)) {
    const root = j.find(m.path);
    if (root && contains(root, n)) return m as { path: string; nfs: NfsMount };
  }
  return null;
}

/** The credentials a client user sends, after the server's squashing: uid and gids. */
function credentials(client: Shell, user: string, options: string[]): { uid: number; gids: number[] } {
  const uid = client.accounts.users[user]?.uid ?? NOBODY;
  const anon = Number(options.find((o) => o.startsWith('anonuid='))?.slice(8) ?? NOBODY);
  const anong = Number(options.find((o) => o.startsWith('anongid='))?.slice(8) ?? NOBODY);
  if (options.includes('all_squash') || (uid === 0 && !options.includes('no_root_squash'))) return { uid: anon, gids: [anong] };
  return { uid, gids: client.groupsFor(user).map((g) => client.accounts.groups[g]?.gid ?? NOBODY) };
}

const uidOf = (s: Shell, name: string | undefined) => (name === undefined ? NOBODY : (s.accounts.users[name]?.uid ?? (/^\d+$/.test(name) ? Number(name) : NOBODY)));
const gidOf = (s: Shell, name: string | undefined) => (name === undefined ? NOBODY : (s.accounts.groups[name]?.gid ?? (/^\d+$/.test(name) ? Number(name) : NOBODY)));
const nameForUid = (s: Shell, uid: number) => Object.entries(s.accounts.users).find(([, u]) => u.uid === uid)?.[0] ?? (uid === NOBODY ? 'nobody' : String(uid));
const nameForGid = (s: Shell, gid: number) => Object.entries(s.accounts.groups).find(([, g]) => g.gid === gid)?.[0] ?? (gid === NOBODY ? 'nogroup' : String(gid));

/** The export's current options for this mount (the server's table, now), or null if it no longer serves it. */
function current(client: Shell, m: NfsMount): { server: Shell; options: string[] } | null {
  const s = serverFor(client, m.host);
  if (!s) return null;
  const found = lookup(s.shell, m.export, addressOf(client), [client.host, ...client.internal_().filter((h) => h.name === client.host).map((h) => h.domain)]);
  return found ? { server: s.shell, options: found.options } : null;
}

/**
 * The server's decision for a client's access to a node of an NFS mount
 * (null: not on an NFS mount). Read-only exports and mounts refuse writes.
 */
export function access(client: Shell, n: Node, right: 'r' | 'w' | 'x', user: string): boolean | null {
  const m = mountOf(client, n);
  if (!m) return null;
  const c = current(client, m.nfs);
  if (!c) return false;
  if (right === 'w' && (c.options.includes('ro') || m.nfs.options.includes('ro'))) return false;
  const { uid, gids } = credentials(client, user, c.options);
  if (uid === 0) return true;
  const mode = n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
  const owner = uidOf(c.server, n.owner ?? c.server.player);
  const group = gidOf(c.server, n.group ?? n.owner ?? c.server.player);
  const triplet = owner === uid ? mode.slice(0, 3) : gids.includes(group) ? mode.slice(3, 6) : mode.slice(6, 9);
  return triplet.includes(right) || (right === 'x' && /[st]$/.test(triplet));
}

/** Who owns a node, as this machine shows it (an NFS node: the server's numbers, this machine's names). */
export function shownOwner(client: Shell, n: Node): { owner: string; group: string } | null {
  const m = mountOf(client, n);
  const s = m && serverFor(client, m.nfs.host);
  if (!m || !s) return null;
  const owner = n.owner ?? s.shell.player;
  return { owner: nameForUid(client, uidOf(s.shell, owner)), group: nameForGid(client, gidOf(s.shell, n.group ?? owner)) };
}

/** A node created through an NFS mount gets the owner the server sees (names of the server's accounts, or numbers). */
export function ownForServer(client: Shell, parent: Node, n: Node): void {
  const m = mountOf(client, parent);
  const c = m && current(client, m.nfs);
  if (!m || !c) return;
  const { uid, gids } = credentials(client, client.who, c.options);
  n.owner = nameForUid(c.server, uid);
  if (n.group === undefined) n.group = nameForGid(c.server, gids[0]);
}

/** Is root squashed for this node's mount (chown then fails: "Operation not permitted")? */
export function squashed(client: Shell, n: Node): boolean {
  const m = mountOf(client, n);
  const c = m && current(client, m.nfs);
  return !!c && client.who === 'root' && credentials(client, 'root', c.options).uid !== 0;
}

// ——— mount and umount ———

const DMESG = '';

/** mount -t nfs host:/path point: mount.nfs's checks, then the graft. Returns mount's error, or ''. */
export function mountNfs(client: Shell, source: string, point: string, options: string): string {
  const m = /^([^:]+):(\/.*)$/.exec(source);
  if (!m) return `mount.nfs: remote share not in 'host:dir' format`;
  const [, host, path] = m;
  const absolute = client.resolve(point);
  const place = client.find(absolute);
  if (place?.type !== 'directory') return `mount.nfs: mount point ${absolute} does not exist`;
  if (nfsMounts(client).some((x) => x.path === absolute)) return `mount.nfs: ${source} is busy or already mounted on ${absolute}`;
  const s = serverFor(client, host);
  if (!s) return `mount.nfs: Failed to resolve server ${host}: Name or service not known`;
  const pf = s.shell.state.ufw as Firewall | undefined;
  const from = addressOf(client);
  if (pf && verdict(pf, 2049, from) === 'blocked') return 'mount.nfs: Connection timed out';
  if (pf && verdict(pf, 2049, from) === 'refused') return 'mount.nfs: Connection refused';
  const sd = s.shell.state.systemd as { services: Record<string, { state: string }> } | undefined;
  if (sd && sd.services['nfs-server']?.state !== 'active') return 'mount.nfs: Connection refused';
  const found = lookup(s.shell, path, from, [client.host, ...client.internal_().filter((h) => h.name === client.host).map((h) => h.domain)]);
  const target = s.shell.find(path);
  if (!found) return `mount.nfs: access denied by server while mounting ${source}`;
  if (target?.type !== 'directory') return `mount.nfs: mounting ${source} failed, reason given by server: No such file or directory`;
  const parent = client.find(`${absolute}/..`) as Directory;
  const name = absolute.split('/').pop()!;
  const own = options.split(',').filter(Boolean);
  (client.state.mounts ??= []).push({
    path: absolute,
    capacity: (s.shell.mount(path)?.capacity as number | undefined) ?? 0,
    name: source,
    system: 'nfs4',
    onlyRead: own.includes('ro'),
    hidden: parent.children[name],
    nfs: { host, address: s.address, export: path, options: own },
  });
  parent.children[name] = target;
  return DMESG;
}

/** umount of an NFS mount: the mount point's own directory comes back. */
export function unmountNfs(client: Shell, path: string): void {
  const all = (client.state.mounts ?? []) as { path: string; hidden?: Node; nfs?: NfsMount }[];
  const m = all.find((x) => x.nfs && x.path === path);
  if (!m) return;
  const parent = client.find(`${path}/..`) as Directory;
  if (m.hidden) parent.children[path.split('/').pop()!] = m.hidden;
  client.state.mounts = all.filter((x) => x !== m);
}

/** mount's line for an NFS mount ("nas.internal:/srv/photos on /mnt/photos type nfs4 (rw,…)"). */
export function mountLine(client: Shell, m: { path: string; name: string; nfs: NfsMount }): string {
  const rw = m.nfs.options.includes('ro') ? 'ro' : 'rw';
  return `${m.name} on ${m.path} type nfs4 (${rw},relatime,vers=4.2,rsize=1048576,wsize=1048576,namlen=255,hard,proto=tcp,timeo=600,retrans=2,sec=sys,clientaddr=${addressOf(client)},local_lock=none,addr=${m.nfs.address})`;
}
