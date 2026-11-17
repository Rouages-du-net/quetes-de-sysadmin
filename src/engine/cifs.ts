// CIFS: a Windows server's SMB share mounted on Linux (mount -t cifs,
// mount.cifs), like the kernel's cifs client with cifs-utils
// (https://manpages.debian.org/mount.cifs.8, https://www.kernel.org/doc/html/latest/admin-guide/cifs/usage.html).
// The share's directory is grafted at the mount point (the same tree: what
// one side writes, the other sees). A Windows server has no Unix owners:
// every file shows the owner, group and modes of the mount's options
// (uid=, gid=, file_mode=, dir_mode=; root and 0755 by default), and the
// Linux kernel checks those before the server checks the account the
// mount logged in as (it may change files if the share lets it). chown and
// chmod change nothing that shows. The account comes from username= and
// password= or, better, from a credentials file (credentials=, read by root
// only). vers=1.0 asks for SMB1, which the server has turned off.
// Simplifications (docs/SCENARIOS.md): no Kerberos (sec=krb5), no multiuser,
// no cache options, no reconnection; a second mount on the same point is
// refused.

import type { Shell } from './shell';
import type { Directory, Node } from './world';
import { serverFor } from './nfs';
import { isWindows, volumeUsed, windows } from './windows';
import { shareAccess } from './windows-acl';

export interface CifsMount {
  host: string;
  address: string;
  // The share's name and its path on the server (internal: /D/Shares/plans).
  share: string;
  path: string;
  // The account the mount logged in as.
  user: string;
  // What the files show on Linux.
  owner: string;
  group: string;
  fileMode: string;
  dirMode: string;
  vers: string;
  readOnly: boolean;
  // The uid= and gid= options were given (forceuid, forcegid).
  forced: { uid: boolean; gid: boolean };
}

export const REFER = 'Refer to the mount.cifs(8) manual page (e.g. man mount.cifs) and kernel log messages (dmesg)';
const error = (n: number, text: string) => `mount error(${n}): ${text}\n${REFER}`;

const VERSIONS: Record<string, string> = { '1.0': '1.0', '2.0': '2.0', '2.1': '2.1', '3': '3.0', '3.0': '3.0', '3.02': '3.02', '3.0.2': '3.02', '3.1.1': '3.1.1', '3.11': '3.1.1', default: '3.1.1' };
// The options the kernel and mount.cifs accept (the others: "Unknown mount option", error 22).
const KNOWN = new Set([
  'rw', 'ro', 'defaults', 'auto', 'noauto', 'user', 'nouser', '_netdev', 'nofail', 'noperm', 'perm', 'seal', 'nounix', 'unix', 'serverino', 'noserverino',
  'forceuid', 'forcegid', 'noforceuid', 'noforcegid', 'soft', 'hard', 'nobrl', 'mapposix', 'mapchars', 'nosetuids', 'setuids', 'exec', 'noexec',
  'suid', 'nosuid', 'dev', 'nodev', 'relatime', 'noatime', 'guest', 'sync', 'async',
]);
const WITH_VALUE = new Set(['credentials', 'cred', 'username', 'user', 'password', 'pass', 'domain', 'dom', 'workgroup', 'uid', 'gid', 'file_mode', 'dir_mode', 'vers', 'sec', 'iocharset', 'cache', 'actimeo', 'port', 'ip', 'addr', 'rsize', 'wsize', 'echo_interval']);

const octalToMode = (octal: string) =>
  [...octal.padStart(4, '0').slice(-3)].map((d) => {
    const v = Number(d);
    return `${v & 4 ? 'r' : '-'}${v & 2 ? 'w' : '-'}${v & 1 ? 'x' : '-'}`;
  }).join('');

/** The account behind a uid= (a name or a number), as the client names it. */
function accountFor(client: Shell, value: string, kind: 'users' | 'groups'): string | null {
  const table = client.accounts[kind] as Record<string, { uid?: number; gid?: number }>;
  if (/^\d+$/.test(value)) return Object.entries(table).find(([, a]) => (kind === 'users' ? a.uid : a.gid) === Number(value))?.[0] ?? value;
  return table[value] ? value : null;
}

/** The mounts of this machine that are cifs. */
export const cifsMounts = (j: Shell) => ((j.state.mounts ?? []) as { path: string; cifs?: CifsMount }[]).filter((m) => m.cifs) as { path: string; name: string; cifs: CifsMount }[];

/** A node's path below a root ('' for the root itself, /a/b below it), or null. */
function relativePath(root: Node, n: Node, at = ''): string | null {
  if (root === n) return at;
  if (root.type !== 'directory') return null;
  for (const [name, c] of Object.entries(root.children)) {
    const r = relativePath(c, n, `${at}/${name}`);
    if (r !== null) return r;
  }
  return null;
}

const contains = (root: Node, n: Node): boolean => root === n || (root.type === 'directory' && Object.values(root.children).some((c) => contains(c, n)));

/** The cifs mount a node is reached through, if any. */
export function cifsMountOf(j: Shell, n: Node): { path: string; name: string; cifs: CifsMount } | null {
  for (const m of cifsMounts(j)) {
    const root = j.find(m.path);
    if (root && contains(root, n)) return m;
  }
  return null;
}

/** May this client user do this on a node of a cifs mount (null: not on one)? */
export function cifsAccess(client: Shell, n: Node, right: 'r' | 'w' | 'x', user: string): boolean | null {
  const m = cifsMountOf(client, n);
  if (!m) return null;
  const c = m.cifs;
  if (right === 'w' && c.readOnly) return false;
  // The server decides for the account the session authenticated as: the
  // share permissions and the NTFS permissions together (windows-acl.ts).
  const server = serverFor(client, c.host)?.shell;
  const share = server && isWindows(server) ? windows(server).shares.find((s) => s.name.toLowerCase() === c.share.toLowerCase()) : null;
  if (right === 'w' && !share) return false;
  if (server && share) {
    const root = client.find(m.path);
    const rel = root ? relativePath(root, n) : null;
    const on = rel === null ? c.path : `${c.path}${rel}`;
    if (!shareAccess(server, share, on, c.user, right === 'w' ? 'write' : 'read')) return false;
  }
  if (user === 'root') return true;
  const mode = n.type === 'directory' ? octalToMode(c.dirMode) : octalToMode(c.fileMode);
  const triplet = c.owner === user ? mode.slice(0, 3) : client.groupsFor(user).includes(c.group) ? mode.slice(3, 6) : mode.slice(6, 9);
  return triplet.includes(right);
}

/** What ls shows of a node on a cifs mount: the mount's owner, group and modes. */
export function cifsShown(client: Shell, n: Node): { owner: string; group: string; mode: string } | null {
  const m = cifsMountOf(client, n);
  if (!m) return null;
  return { owner: m.cifs.owner, group: m.cifs.group, mode: octalToMode(n.type === 'directory' ? m.cifs.dirMode : m.cifs.fileMode) };
}

/** df on a cifs mount: the server's volume (its size, what it uses, files outside the share included). */
export function cifsUsage(client: Shell, path: string): { capacity: number; used: number } | null {
  const m = cifsMounts(client).find((x) => x.path === path);
  const server = m && serverFor(client, m.cifs.host)?.shell;
  if (!m || !server || !isWindows(server)) return null;
  const letter = m.cifs.path.split('/').filter(Boolean)[0];
  const v = windows(server).volumes.find((x) => x.letter === letter);
  return v ? { capacity: v.size, used: volumeUsed(server, letter) } : null;
}

export interface CifsRequest {
  source: string;
  point: string;
  options: string[];
  // The password typed at mount.cifs's prompt.
  typed?: string;
}

/**
 * mount -t cifs: mount.cifs's checks, then the server's, then the graft.
 * Returns '' when mounted, an error message, or { ask } when mount.cifs
 * must prompt for the password.
 */
export function mountCifs(client: Shell, r: CifsRequest): string | { ask: string } {
  const unc = /^\/\/([^/]+)\/([^/]+)\/?$/.exec(r.source.replace(/\\/g, '/'));
  if (!unc) return `mount.cifs: bad UNC (${r.source})`;
  const [, host, shareName] = unc;
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (const o of r.options) {
    const [k, ...v] = o.split('=');
    const key = k.toLowerCase();
    if (WITH_VALUE.has(key)) values[key] = v.join('=');
    else if (KNOWN.has(key) || key.startsWith('x-systemd.') || key === 'comment') flags.add(key);
    else return error(22, 'Invalid argument');
  }
  // The credentials file: username=, password=, domain= (read by mount.cifs, as root).
  const credFile = values.credentials ?? values.cred;
  if (credFile !== undefined) {
    const text = client.read(credFile);
    if (text === null) return `error 2 (No such file or directory) opening credential file ${credFile}`;
    for (const line of text.split('\n')) {
      const m = /^\s*(username|user|password|pass|domain|dom|workgroup)\s*=\s*(.*?)\s*$/i.exec(line);
      if (m) values[m[1].toLowerCase()] ??= m[2];
    }
  }
  const user = values.username ?? values.user ?? 'root';
  const password = values.password ?? values.pass ?? r.typed;
  const owner = values.uid !== undefined ? accountFor(client, values.uid, 'users') : 'root';
  if (owner === null) return `bad user name "${values.uid}"`;
  const group = values.gid !== undefined ? accountFor(client, values.gid, 'groups') : 'root';
  if (group === null) return `bad group name "${values.gid}"`;
  const absolute = client.resolve(r.point);
  const place = client.find(absolute);
  if (place?.type !== 'directory') return `Couldn't chdir to ${absolute}: No such file or directory`;
  if (password === undefined && !flags.has('guest')) return { ask: `Password for ${user}@${r.source}:  ` };
  const vers = values.vers === undefined ? '3.1.1' : VERSIONS[values.vers];
  if (!vers) return error(22, 'Invalid argument');
  const found = serverFor(client, host);
  if (!found) return `mount error: could not resolve address for ${host}: Unknown error`;
  const server = found.shell;
  if (!isWindows(server)) return error(115, 'Operation now in progress');
  const w = windows(server);
  // SMB1 is off on the server: it drops the connection at the first request.
  if (vers === '1.0' && !w.smb1) return error(112, 'Host is down');
  if (flags.has('guest') || w.passwords[user] === undefined || w.passwords[user] !== password) return error(13, 'Permission denied');
  const share = w.shares.find((s) => s.name.toLowerCase() === shareName.toLowerCase());
  if (!share || !share.path) return error(2, 'No such file or directory');
  if (share.special && !(server.groupsFor(user).includes('Administrators'))) return error(13, 'Permission denied');
  const internal = '/' + share.path.replace(/:\\?/, '\\').split('\\').filter(Boolean).join('/');
  const target = server.find(internal);
  if (target?.type !== 'directory') return error(2, 'No such file or directory');
  if (cifsMounts(client).some((m) => m.path === absolute)) return error(16, 'Device or resource busy');
  const parent = client.find(`${absolute}/..`) as Directory;
  const name = absolute.split('/').pop()!;
  (client.state.mounts ??= []).push({
    path: absolute,
    capacity: w.volumes.find((v) => v.letter === internal.split('/')[1])?.size ?? 0,
    name: r.source,
    system: 'cifs',
    onlyRead: flags.has('ro'),
    hidden: parent.children[name],
    cifs: {
      host,
      address: found.address,
      share: share.name,
      path: internal,
      user,
      owner,
      group,
      fileMode: values.file_mode ?? '0755',
      dirMode: values.dir_mode ?? '0755',
      vers,
      readOnly: flags.has('ro'),
      forced: { uid: values.uid !== undefined, gid: values.gid !== undefined },
    } satisfies CifsMount,
  });
  parent.children[name] = target;
  (server.state.smbSessions ??= []).push({ user, share: share.name });
  return '';
}

/** umount of a cifs mount: the mount point's own directory comes back. */
export function unmountCifs(client: Shell, path: string): void {
  const all = (client.state.mounts ?? []) as { path: string; hidden?: Node; cifs?: CifsMount }[];
  const m = all.find((x) => x.cifs && x.path === path);
  if (!m) return;
  const parent = client.find(`${path}/..`) as Directory;
  if (m.hidden) parent.children[path.split('/').pop()!] = m.hidden;
  client.state.mounts = all.filter((x) => x !== m);
}

/** mount's line for a cifs mount, like /proc/mounts (no password, ever). */
export function cifsLine(client: Shell, m: { path: string; name: string; cifs: CifsMount }): string {
  const c = m.cifs;
  const uid = String(client.accounts.users[c.owner]?.uid ?? c.owner);
  const gid = String(client.accounts.groups[c.group]?.gid ?? c.group);
  return `${m.name} on ${m.path} type cifs (${c.readOnly ? 'ro' : 'rw'},relatime,vers=${c.vers},cache=strict,username=${c.user},uid=${uid},${c.forced.uid ? 'forceuid' : 'noforceuid'},gid=${gid},${c.forced.gid ? 'forcegid' : 'noforcegid'},addr=${c.address},file_mode=${c.fileMode},dir_mode=${c.dirMode},soft,nounix,serverino,mapposix,rsize=4194304,wsize=4194304,bsize=1048576,echo_interval=60,actimeo=1,closetimeo=1)`;
}
