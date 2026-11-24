// SELinux on a Rocky Linux 10 machine (state.selinux, see rhel.ts): the
// targeted policy as far as httpd is concerned, read from selinux-policy
// 42.1.27 (Rocky 10.3; the sources of its src.rpm): file contexts
// (policy/modules/contrib/apache.fc, kernel/files.fc, system/userdomain),
// port types (kernel/corenetwork.te.in), httpd's rules and booleans
// (contrib/apache.te: httpd_can_network_connect, httpd_can_network_relay,
// httpd_graceful_shutdown, httpd_read_user_content; global_tunables:
// nis_enabled, and nis.if: what it opens to every nsswitch domain).
//   - mode: enforcing or permissive (setenforce), and /etc/selinux/config,
//     read at boot;
//   - booleans: the running value and the one saved in the policy store
//     (setsebool -P);
//   - local customisations (semanage): file contexts in the order they were
//     added, equivalences (-e), port types;
//   - modules loaded with semodule -i (from audit2allow -M): their allow rules;
//   - the audit log: each denial (AVC) with its SYSCALL and PROCTITLE records.
// The access decisions (httpd_t only): reading a file, searching a
// directory, binding a port, connecting to one. Permissive: logged
// (permissive=1) and allowed.
// Simplified (see docs/SCENARIOS.md): a subset of the policy's file
// contexts and port types; only httpd is confined; MLS levels are s0.
// Documentation: https://docs.rockylinux.org/guides/security/learning_selinux/,
// https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/

import type { Game, Shell } from './shell';
import type { Directory, Node } from './world';
import { systemd } from './systemd';
import { typeOf } from './rhel';

export interface Rule {
  source: string;
  target: string;
  tclass: string;
  perms: string[];
}

export interface Avc {
  // Seconds (UTC) and milliseconds, the event's serial.
  time: number;
  serial: number;
  perm: string;
  pid: number;
  comm: string;
  exe: string;
  // name="index.html" dev ino, or src=8010 / dest=8086.
  detail: string;
  scontext: string;
  tcontext: string;
  tclass: string;
  permissive: boolean;
  syscall: number;
  uid: number;
}

export interface SelinuxState {
  mode: 'enforcing' | 'permissive';
  booleans: Record<string, { value: boolean; saved: boolean }>;
  fcontexts: { spec: string; ftype: string; type: string }[];
  equivalences: Record<string, string>;
  ports: { type: string; proto: string; low: number; high: number }[];
  modules: Record<string, Rule[]>;
  audit: Avc[];
  serial: number;
  // What the machine's audit.log held before the story (raw lines).
  past: string;
}

export const selinux = (game: Game): SelinuxState => game.state.selinux as SelinuxState;
export const HTTPD = 'system_u:system_r:httpd_t:s0';
export const CONFIG = '/etc/selinux/config';
export const AUDIT_LOG = '/var/log/audit/audit.log';

// ——— Booleans (their defaults in the targeted policy) ———

export const BOOLEANS: Record<string, boolean> = {
  httpd_builtin_scripting: true,
  httpd_can_network_connect: false,
  httpd_can_network_connect_db: false,
  httpd_can_network_relay: false,
  httpd_can_sendmail: false,
  httpd_enable_cgi: true,
  httpd_enable_homedirs: false,
  httpd_graceful_shutdown: false,
  httpd_read_user_content: false,
  httpd_unified: false,
  httpd_use_nfs: false,
  nis_enabled: false,
  selinuxuser_execmod: true,
  ssh_sysadm_login: false,
  use_nfs_home_dirs: false,
};

export function newSelinux(past = ''): SelinuxState {
  return {
    mode: 'enforcing',
    booleans: Object.fromEntries(Object.entries(BOOLEANS).map(([k, v]) => [k, { value: v, saved: v }])),
    fcontexts: [],
    equivalences: {},
    ports: [],
    modules: {},
    audit: [],
    serial: 4100,
    past,
  };
}

export const boolOn = (game: Game, name: string, saved = false) => {
  const b = selinux(game).booleans[name];
  return !!b && (saved ? b.saved : b.value);
};

// ——— File contexts (a subset of the policy's file_contexts) ———

// [spec, ftype ('' all files, '--' regular file, '-d' directory), type].
const POLICY_FCONTEXTS: [string, string, string][] = [
  ['/.*', '', 'default_t'],
  ['/', '-d', 'root_t'],
  ['/\\.autorelabel', '--', 'etc_runtime_t'],
  ['/bin', '', 'bin_t'],
  ['/boot(/.*)?', '', 'boot_t'],
  ['/dev(/.*)?', '', 'device_t'],
  ['/etc(/.*)?', '', 'etc_t'],
  ['/etc/httpd(/.*)?', '', 'httpd_config_t'],
  ['/etc/selinux(/.*)?', '', 'selinux_config_t'],
  ['/etc/firewalld(/.*)?', '', 'firewalld_etc_rw_t'],
  ['/etc/shadow.*', '--', 'shadow_t'],
  ['/etc/ssh(/.*)?', '', 'etc_t'],
  ['/home', '-d', 'home_root_t'],
  ['/home/[^/]+', '-d', 'user_home_dir_t'],
  ['/home/[^/]+/.+', '', 'user_home_t'],
  ['/home/[^/]+/\\.ssh(/.*)?', '', 'ssh_home_t'],
  ['/opt(/.*)?', '', 'usr_t'],
  ['/opt/.*/bin(/.*)?', '', 'bin_t'],
  ['/root(/.*)?', '', 'admin_home_t'],
  ['/run(/.*)?', '', 'var_run_t'],
  ['/srv', '-d', 'var_t'],
  ['/srv/.*', '', 'var_t'],
  ['/srv/([^/]*/)?ftp(/.*)?', '', 'public_content_t'],
  ['/srv/([^/]*/)?rsync(/.*)?', '', 'public_content_t'],
  ['/srv/([^/]*/)?www(/.*)?', '', 'httpd_sys_content_t'],
  ['/srv/([^/]*/)?www/logs(/.*)?', '', 'httpd_log_t'],
  ['/tmp', '-d', 'tmp_t'],
  ['/tmp/.*', '', '<<none>>'],
  ['/usr(/.*)?', '', 'usr_t'],
  ['/usr/bin(/.*)?', '', 'bin_t'],
  ['/usr/sbin(/.*)?', '', 'bin_t'],
  ['/usr/sbin/httpd', '--', 'httpd_exec_t'],
  ['/usr/lib/systemd/system(/.*)?', '', 'systemd_unit_file_t'],
  ['/usr/lib/systemd/system/httpd.*', '--', 'httpd_unit_file_t'],
  ['/usr/share/httpd(/.*)?', '', 'httpd_sys_content_t'],
  ['/var(/.*)?', '', 'var_t'],
  ['/var/lib(/.*)?', '', 'var_lib_t'],
  ['/var/log(/.*)?', '', 'var_log_t'],
  ['/var/log/audit(/.*)?', '', 'auditd_log_t'],
  ['/var/log/httpd(/.*)?', '', 'httpd_log_t'],
  ['/var/log/messages[^/]*', '--', 'var_log_t'],
  ['/var/log/secure[^/]*', '--', 'var_log_t'],
  ['/var/www(/.*)?', '', 'httpd_sys_content_t'],
  ['/var/www(/.*)?/logs(/.*)?', '', 'httpd_log_t'],
  ['/var/www/cgi-bin(/.*)?', '', 'httpd_sys_script_exec_t'],
  ['/var/www/html(/.*)?/uploads(/.*)?', '', 'httpd_sys_rw_content_t'],
  ['/var/www/html(/.*)?/wp-content(/.*)?', '', 'httpd_sys_rw_content_t'],
];
// file_contexts.subs_dist (the distribution's equivalences), a few.
export const DIST_EQUIVALENCES: [string, string][] = [
  ['/var/run', '/run'],
  ['/var/lock', '/run/lock'],
  ['/lib', '/usr/lib'],
  ['/lib64', '/usr/lib'],
  ['/usr/lib64', '/usr/lib'],
  ['/etc/systemd/system', '/usr/lib/systemd/system'],
  ['/sbin', '/usr/bin'],
  ['/var/roothome', '/root'],
];
export const FTYPES: Record<string, string> = { '': 'all files', '--': 'regular file', '-d': 'directory' };
export const FTYPE_OPTIONS: Record<string, string> = { a: '', f: '--', d: '-d' };

// libselinux orders specifications from the least to the most specific
// (a regex's stem without metacharacters), the local ones after the
// policy's, and the last that matches wins.
const stem = (spec: string) => spec.search(/[.^$?*+|[({\\]/) === -1 ? spec.length + 1000 : spec.search(/[.^$?*+|[({\\]/);
const matches = (spec: string, ftype: string, path: string, dir: boolean) => {
  if (ftype === '--' && dir) return false;
  if (ftype === '-d' && !dir) return false;
  try {
    return new RegExp(`^(?:${spec})$`).test(path);
  } catch {
    return false;
  }
};

/** A path as the policy reads it, after the equivalences (local ones first). */
export function equivalent(game: Game, path: string): string {
  const all: [string, string][] = [...Object.entries(selinux(game).equivalences), ...DIST_EQUIVALENCES];
  for (const [alias, original] of all) if (path === alias || path.startsWith(alias + '/')) return original + path.slice(alias.length);
  return path;
}

/** The type the policy gives this path (what restorecon would set), or null for <<none>>. */
export function defaultType(game: Game, path: string, dir: boolean): string | null {
  const p = equivalent(game, path);
  let best: { score: number; type: string } | null = null;
  const local = selinux(game).fcontexts.map((r) => [r.spec, r.ftype, r.type] as [string, string, string]);
  const all = [...POLICY_FCONTEXTS.map((r) => ({ r, local: 0 })), ...local.map((r) => ({ r, local: 1 }))];
  for (const { r, local: l } of all) {
    const [spec, ftype, type] = r;
    if (!matches(spec, ftype, p, dir)) continue;
    // Local customisations come after the policy's: they win over an equal or less specific one.
    const score = l * 100_000 + stem(spec) * 10 + (ftype ? 1 : 0);
    if (!best || score >= best.score) best = { score, type };
  }
  return !best || best.type === '<<none>>' ? null : best.type;
}

/** The policy's file contexts, then the local ones, as semanage fcontext -l lists them. */
export const policyFcontexts = () => POLICY_FCONTEXTS;

/** Every node of the tree with its path (for restorecon, the relabel). */
export function walk(n: Node, path: string, visit: (n: Node, path: string) => void): void {
  visit(n, path);
  if (n.type === 'directory') for (const [k, c] of Object.entries(n.children)) walk(c, path === '/' ? `/${k}` : `${path}/${k}`, visit);
}

/** Labels a whole tree from the policy, as the installer does (system_u; unconfined_u in the homes). */
export function labelTree(game: Game, root: Directory, at = '/'): void {
  walk(root, at, (n, path) => {
    const type = defaultType(game, path, n.type === 'directory');
    const user = path.startsWith('/home/') ? 'unconfined_u' : 'system_u';
    if (!n.context) n.context = `${user}:object_r:${type ?? 'default_t'}:s0`;
  });
}

/** The labels every new node got from its place (a safety net after each command; Shell.place does it too). */
export function labelMissing(game: Game): void {
  const visit = (parent: Node, n: Node) => {
    if (!n.context) {
      const p = typeOf(parent.context);
      n.context = `unconfined_u:object_r:${p === 'user_home_dir_t' ? 'user_home_t' : p === 'tmp_t' ? 'user_tmp_t' : p}:s0`;
    }
    if (n.type === 'directory') for (const c of Object.values(n.children)) visit(n, c);
  };
  for (const c of Object.values(game.root.children)) visit(game.root, c);
}

/** restorecon on one node: the policy's type (and with force, its user), or null if nothing changes. */
export function restored(game: Game, n: Node, path: string, force = false): string | null {
  const type = defaultType(game, path, n.type === 'directory');
  if (!type) return null;
  const old = n.context ?? 'system_u:object_r:unlabeled_t:s0';
  const [user, role] = old.split(':');
  const next = `${force ? 'system_u' : user}:${force ? 'object_r' : role}:${type}:s0`;
  return next === old ? null : next;
}

// ——— Ports ———

// [type, proto, ranges]: corenetwork.te.in, a subset.
export const POLICY_PORTS: [string, string, string[]][] = [
  ['dns_port_t', 'tcp', ['53', '853']],
  ['dns_port_t', 'udp', ['53', '853']],
  ['http_cache_port_t', 'tcp', ['8080', '8118', '8123', '10001-10010']],
  ['http_cache_port_t', 'udp', ['3130']],
  ['http_port_t', 'tcp', ['80', '81', '443', '488', '8008', '8009', '8443', '9000']],
  ['http_port_t', 'udp', ['80', '443']],
  ['mysqld_port_t', 'tcp', ['1186', '3306', '63132-63164']],
  ['postgresql_port_t', 'tcp', ['5432', '9898']],
  ['smtp_port_t', 'tcp', ['25', '465', '587']],
  ['ssh_port_t', 'tcp', ['22']],
  ['transproxy_port_t', 'tcp', ['8081']],
  ['luci_port_t', 'tcp', ['8084']],
  ['websm_port_t', 'tcp', ['9090']],
];
const inRange = (r: string, port: number) => {
  const [a, b] = r.split('-').map(Number);
  return port >= a && port <= (b ?? a);
};

/** A port's type: a local definition first, then the policy's, then the defaults. */
export function portType(game: Game, port: number, proto = 'tcp'): string {
  const local = selinux(game).ports.find((p) => p.proto === proto && port >= p.low && port <= p.high);
  if (local) return local.type;
  const policy = POLICY_PORTS.find(([, pr, ranges]) => pr === proto && ranges.some((r) => inRange(r, port)));
  if (policy) return policy[0];
  if (port >= 32768 && port <= 60999) return 'ephemeral_port_t';
  if (port >= 512 && port < 1024) return 'hi_reserved_port_t';
  if (port < 512) return 'reserved_port_t';
  return 'unreserved_port_t';
}
export const policyPortDefined = (port: number, proto: string) => POLICY_PORTS.some(([, pr, ranges]) => pr === proto && ranges.includes(String(port)));

// ——— httpd_t's rules ———

const READ = ['httpd_sys_content_t', 'httpd_sys_rw_content_t', 'httpd_sys_ra_content_t', 'httpd_sys_script_exec_t', 'public_content_t', 'public_content_rw_t', 'usr_t', 'etc_t', 'httpd_config_t'];
const SEARCH = [...READ, 'var_t', 'root_t', 'usr_t', 'home_root_t', 'var_lib_t', 'var_log_t', 'httpd_log_t'];
const BIND = ['http_port_t', 'http_cache_port_t', 'ntop_port_t', 'jboss_management_port_t', 'jboss_messaging_port_t', 'puppet_port_t'];

const moduleAllows = (game: Game, target: string, tclass: string, perm: string) =>
  Object.values(selinux(game).modules).some((rules) => rules.some((r) => r.source === 'httpd_t' && r.target === target && r.tclass === tclass && r.perms.includes(perm)));

/** Does the policy (booleans as they are, or as saved for the next boot) allow httpd_t this? */
export function httpdAllows(game: Game, target: string, tclass: string, perm: string, saved = false): boolean {
  const on = (b: string) => boolOn(game, b, saved);
  if (moduleAllows(game, target, tclass, perm)) return true;
  if (tclass === 'file') return READ.includes(target) || (on('httpd_read_user_content') && target === 'user_home_t');
  if (tclass === 'dir') return SEARCH.includes(target) || ((on('httpd_read_user_content') || on('httpd_enable_homedirs')) && ['user_home_t', 'user_home_dir_t'].includes(target));
  if (tclass === 'tcp_socket' && perm === 'name_bind') return BIND.includes(target) || (on('nis_enabled') && ['port_t', 'unreserved_port_t', 'ephemeral_port_t'].includes(target));
  if (tclass === 'tcp_socket' && perm === 'name_connect') {
    if (on('httpd_can_network_connect')) return true;
    if ((on('httpd_graceful_shutdown') || on('httpd_can_network_relay')) && target === 'http_port_t') return true;
    if (on('httpd_can_network_relay') && ['http_cache_port_t', 'ephemeral_port_t'].includes(target)) return true;
    if (on('nis_enabled') && ['port_t', 'unreserved_port_t', 'ephemeral_port_t'].includes(target)) return true;
    return false;
  }
  return false;
}

/** The booleans that would allow this denial (audit2why), with the value to set. */
export function booleansFor(target: string, tclass: string, perm: string): string[] {
  if (tclass === 'tcp_socket' && perm === 'name_connect') {
    const out = ['httpd_can_network_connect'];
    if (target === 'http_port_t') out.push('httpd_can_network_relay', 'httpd_graceful_shutdown');
    if (['unreserved_port_t', 'ephemeral_port_t', 'port_t'].includes(target)) out.push('nis_enabled');
    return out;
  }
  if (tclass === 'tcp_socket' && perm === 'name_bind') return ['unreserved_port_t', 'ephemeral_port_t', 'port_t'].includes(target) ? ['nis_enabled'] : [];
  if (tclass === 'file' && target === 'user_home_t') return ['httpd_read_user_content'];
  return [];
}

// ——— The audit log ———

const hexTitle = (s: string) => [...s].map((c) => (c === ' ' ? '00' : c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))).join('');

/** One denial (or, permissive, one logged access): written to the audit log. Returns whether access is allowed. */
export function check(
  game: Game,
  access: { target: string; tclass: string; perm: string; detail: string; pid: number; syscall: number; uid?: number; scontext?: string; comm?: string; exe?: string },
  quiet = false,
): boolean {
  const type = typeOf(access.target);
  if (httpdAllows(game, type, access.tclass, access.perm)) return true;
  const st = selinux(game);
  const permissive = st.mode === 'permissive';
  if (!quiet) {
    const sd = systemd(game);
    const time = Math.floor((sd?.clock ?? 0) / 1000);
    st.audit.push({
      time,
      serial: ++st.serial,
      perm: access.perm,
      pid: access.pid,
      comm: access.comm ?? 'httpd',
      exe: access.exe ?? '/usr/sbin/httpd',
      detail: access.detail,
      scontext: access.scontext ?? HTTPD,
      tcontext: access.target,
      tclass: access.tclass,
      permissive,
      syscall: access.syscall,
      uid: access.uid ?? 48,
    });
  }
  return permissive;
}

/** The AVC record's text (as auditd writes it). */
export const avcLine = (a: Avc) =>
  `type=AVC msg=audit(${a.time}.${String(a.serial % 1000).padStart(3, '0')}:${a.serial}): avc:  denied  { ${a.perm} } for  pid=${a.pid} comm="${a.comm}" ${a.detail} scontext=${a.scontext} tcontext=${a.tcontext} tclass=${a.tclass} permissive=${a.permissive ? 1 : 0}`;
/** The three records of a denial's event, in the log's order. */
export function eventLines(a: Avc): string[] {
  const stamp = `msg=audit(${a.time}.${String(a.serial % 1000).padStart(3, '0')}:${a.serial})`;
  const ids = `auid=4294967295 uid=${a.uid} gid=${a.uid} euid=${a.uid} suid=${a.uid} fsuid=${a.uid} egid=${a.uid} sgid=${a.uid} fsgid=${a.uid}`;
  return [
    avcLine(a),
    `type=SYSCALL ${stamp}: arch=c000003e syscall=${a.syscall} success=${a.permissive ? 'yes' : 'no'} exit=${a.permissive ? 0 : -13} a0=ffffff9c a1=7f3a1c0042f8 a2=80000 a3=0 items=0 ppid=${a.pid - 3} pid=${a.pid} ${ids} tty=(none) ses=4294967295 comm="${a.comm}" exe="${a.exe}" subj=${a.scontext} key=(null)`,
    `type=PROCTITLE ${stamp}: proctitle=${hexTitle(`${a.exe} -DFOREGROUND`)}`,
  ];
}
/** /var/log/audit/audit.log: what it held, then each event. */
export const auditText = (game: Game) => [selinux(game).past, ...selinux(game).audit.flatMap(eventLines)].filter(Boolean).join('\n');

// ——— Boot: the mode from the configuration, the saved booleans, a relabel if asked ———

export function configMode(game: Game): string {
  const m = /^\s*SELINUX\s*=\s*(\S+)/m.exec(game.read(CONFIG) ?? '');
  return (m?.[1] ?? 'enforcing').toLowerCase();
}

/** The whole file system relabelled from the policy (fixfiles, /.autorelabel at boot). */
export function relabelAll(game: Game): number {
  let changed = 0;
  walk(game.root, '/', (n, path) => {
    const next = restored(game, n, path);
    if (next) {
      n.context = next;
      changed++;
    }
  });
  return changed;
}

export function boot(game: Game): void {
  const st = selinux(game);
  const mode = configMode(game);
  st.mode = mode === 'permissive' ? 'permissive' : 'enforcing';
  for (const b of Object.values(st.booleans)) b.value = b.saved;
  if (game.exists('/.autorelabel') && mode !== 'disabled') {
    relabelAll(game);
    game.erase('/.autorelabel');
    (game.state as { relabelled?: number }).relabelled = ((game.state as { relabelled?: number }).relabelled ?? 0) + 1;
  }
}

/** A node's label, its path given (for checks without the shell's helpers). */
export const labelAt = (game: Game, path: string) => (game as Shell).find(path)?.context;
