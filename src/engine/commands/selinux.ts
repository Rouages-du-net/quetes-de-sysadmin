// SELinux's commands on a Rocky Linux machine (the `rhel` family), on the
// model of ../selinux.ts: getenforce, setenforce, sestatus, getsebool,
// setsebool (libselinux-utils, policycoreutils 3.11), chcon (coreutils 9.5),
// restorecon, semodule, semanage (fcontext, port, boolean), audit2allow and
// audit2why (policycoreutils-python-utils, not installed by default), and
// ausearch (audit 4.2.1).
// Messages from their sources at those versions (SELinuxProject/selinux
// 3.11: libselinux/utils/setenforce.c, getsebool.c,
// policycoreutils/setsebool/setsebool.c, sestatus/sestatus.c,
// libselinux/src/selinux_restorecon.c ("Relabeled %s from %s to %s",
// "Would relabel"), policycoreutils/setfiles (restorecon's "progname: "
// prefix), python/semanage/seobject.py (the listings' formats, "Port
// tcp/8010 already defined, modifying instead", "Type %s is invalid, must
// be a port type"), python/audit2allow/audit2allow ("Was caused by:",
// "The boolean %s was set incorrectly.", the IMPORTANT banner),
// sepolgen's "#!!!! This avc can be allowed using the boolean";
// libsemanage's "Removing last %s module"; audit's src/ausearch.c
// ("<no matches>", "----", "time->"), auparse's "Error opening config file").
// Documentation: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/,
// semanage-fcontext(8), semanage-port(8), restorecon(8), audit2allow(1).
// Differences (docs/SCENARIOS.md): only httpd is confined; semodule -l and
// the -l listings show a subset of the policy; audit2allow writes no real
// policy package.

import type { Shell } from '../shell';
import type { Command } from './index';
import type { Node } from '../world';
import {
  BOOLEANS, DIST_EQUIVALENCES, FTYPES, FTYPE_OPTIONS, POLICY_PORTS, avcLine, booleansFor, configMode, eventLines, policyFcontexts, policyPortDefined, restored, selinux, walk, type Avc, type Rule,
} from '../selinux';
import { typeOf } from '../rhel';

const root = (game: Shell) => game.who === 'root';
/** A tool of policycoreutils-python-utils: there only once the package is installed. */
const missing = (game: Shell, path: string, name: string): boolean => {
  if (game.exists(path)) return false;
  game.error(`-bash: ${name}: command not found`, 127);
  return true;
};

// Types the policy defines for files and for ports (a subset: what the game knows of).
const FILE_TYPES = new Set([
  ...policyFcontexts().map(([, , t]) => t).filter((t) => t !== '<<none>>'),
  'httpd_sys_content_t', 'httpd_sys_rw_content_t', 'httpd_sys_ra_content_t', 'httpd_sys_script_exec_t', 'httpd_user_content_t', 'httpd_log_t', 'httpd_cache_t', 'httpd_var_run_t',
  'public_content_t', 'public_content_rw_t', 'user_home_t', 'user_home_dir_t', 'user_tmp_t', 'tmp_t', 'var_t', 'usr_t', 'etc_t', 'bin_t', 'default_t', 'admin_home_t', 'var_lib_t', 'var_log_t',
  'samba_share_t', 'nfs_t', 'container_file_t', 'svirt_sandbox_file_t', 'cert_t', 'mysqld_db_t', 'postgresql_db_t',
]);
const PORT_TYPES = new Set([...POLICY_PORTS.map(([t]) => t), 'unreserved_port_t', 'reserved_port_t', 'hi_reserved_port_t', 'ephemeral_port_t', 'port_t', 'ntop_port_t', 'jboss_management_port_t', 'puppet_port_t', 'tor_port_t', 'gopher_port_t', 'squid_port_t', 'memcache_port_t', 'redis_port_t']);

// ——— getenforce, setenforce, sestatus ———

const getenforce = (game: Shell) => (selinux(game).mode === 'enforcing' ? 'Enforcing' : 'Permissive');

function setenforce(game: Shell, args: string[]): string {
  const v = args[0];
  const value = v === '1' || v?.toLowerCase() === 'enforcing' ? 'enforcing' : v === '0' || v?.toLowerCase() === 'permissive' ? 'permissive' : null;
  if (args.length !== 1 || !value) return game.error('usage:  setenforce [ Enforcing | Permissive | 1 | 0 ]', 1);
  if (!root(game)) return game.error('setenforce:  security_setenforce() failed:  Permission denied', 1);
  selinux(game).mode = value;
  (game.state.setenforce ??= []).push(value);
  return '';
}

function sestatus(game: Shell, args: string[]): string {
  const tab = (k: string, v: string, w = 32) => `${k.padEnd(w)}${v}`;
  const lines = [
    tab('SELinux status:', 'enabled'),
    tab('SELinuxfs mount:', '/sys/fs/selinux'),
    tab('SELinux root directory:', '/etc/selinux'),
    tab('Loaded policy name:', 'targeted'),
    tab('Current mode:', selinux(game).mode),
    tab('Mode from config file:', configMode(game)),
    tab('Policy MLS status:', 'enabled'),
    tab('Policy deny_unknown status:', 'allowed'),
    tab('Memory protection checking:', 'actual (secure)'),
    tab('Max kernel policy version:', '33'),
  ];
  if (args.includes('-b')) {
    const names = Object.keys(selinux(game).booleans).sort();
    const w = Math.max(32, ...names.map((n) => n.length + 1));
    lines.push('', 'Policy booleans:', ...names.map((n) => tab(n, selinux(game).booleans[n].value ? 'on' : 'off', w)));
  }
  return lines.join('\n');
}

// ——— Booleans ———

function getsebool(game: Shell, args: string[]): string {
  const b = selinux(game).booleans;
  if (!args.length) return game.error('usage:  getsebool -a or getsebool boolean...', 1);
  const names = args.includes('-a') ? Object.keys(b).sort() : args;
  return names
    .map((n) => {
      if (!b[n]) return game.error(`Error getting active value for ${n}`, 1) || null;
      return `${n} --> ${b[n].value ? 'on' : 'off'}`;
    })
    .filter((x) => x !== null)
    .join('\n');
}

function setsebool(game: Shell, raw: string[]): string {
  const persistent = raw.some((a) => /^-[NPV]*P/.test(a));
  const args = raw.filter((a) => !a.startsWith('-'));
  if (raw.some((a) => a.startsWith('-') && !/^-[NPV]+$/.test(a)) || !args.length) return game.error('\nUsage:  setsebool [ -NPV ] boolean value | bool1=val1 bool2=val2...\n', 1);
  const pairs: [string, string][] = args.some((a) => a.includes('=')) ? args.map((a) => a.split('=') as [string, string]) : [[args[0], args[1] ?? '']];
  if (!args.some((a) => a.includes('=')) && args.length !== 2) return game.error(args.length === 1 ? 'Error: boolean name required\n' : '\nUsage:  setsebool [ -NPV ] boolean value | bool1=val1 bool2=val2...\n', 1);
  const st = selinux(game);
  for (const [name, v] of pairs) {
    const value = /^(1|true|on)$/i.test(v) ? true : /^(0|false|off)$/i.test(v) ? false : null;
    if (value === null) return game.error(`setsebool: illegal value ${v} for boolean ${name}`, 1);
    if (!st.booleans[name]) return game.error(persistent ? `Boolean ${name} is not defined` : 'Could not change active booleans: Invalid boolean', 1);
  }
  if (!root(game)) return game.error(persistent ? 'Cannot set persistent booleans, please try as root.' : 'Could not change active booleans. Please try as root: Permission denied', 1);
  for (const [name, v] of pairs) {
    const value = /^(1|true|on)$/i.test(v);
    st.booleans[name].value = value;
    if (persistent) st.booleans[name].saved = value;
  }
  return '';
}

// ——— File contexts: chcon, restorecon ———

const VALID_TYPE = (t: string) => FILE_TYPES.has(t);

function chcon(game: Shell, raw: string[]): string {
  const opts: Record<string, string> = {};
  const files: string[] = [];
  let recursive = false;
  let verbose = false;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '-R' || a === '--recursive') recursive = true;
    else if (a === '-v' || a === '--verbose') verbose = true;
    else if (/^-[tur]$/.test(a)) opts[a[1]] = raw[++i] ?? '';
    else if (/^--(type|user|role)=/.test(a)) opts[a.slice(2, 3)] = a.split('=')[1];
    else if (a.startsWith('--reference=')) opts.ref = a.slice(12);
    else if (/^-[Rv]+$/.test(a)) {
      if (a.includes('R')) recursive = true;
      if (a.includes('v')) verbose = true;
    } else if (a.startsWith('-')) return game.error(`chcon: invalid option -- '${a.replace(/^-+/, '')[0]}'\nTry 'chcon --help' for more information.`, 1);
    else files.push(a);
  }
  let full: string | null = null;
  if (opts.ref !== undefined) {
    const r = game.find(opts.ref);
    if (!r) return game.error(`chcon: failed to get security context of '${opts.ref}': No such file or directory`, 1);
    full = r.context ?? null;
  } else if (!opts.t && !opts.u && !opts.r) full = files.shift() ?? null;
  if (!files.length) return game.error(full === null ? "chcon: missing operand\nTry 'chcon --help' for more information." : `chcon: missing operand after '${full}'\nTry 'chcon --help' for more information.`, 1);
  const out: string[] = [];
  const change = (n: Node, shown: string) => {
    const [u, r, t] = (n.context ?? 'system_u:object_r:unlabeled_t:s0').split(':');
    const next = full ?? `${opts.u ?? u}:${opts.r ?? r}:${opts.t ?? t}:s0`;
    const type = typeOf(next);
    if (!/^\w+:\w+:\w+:s0/.test(next) || !VALID_TYPE(type)) return game.error(`chcon: failed to change context of '${shown}' to '${next}': Invalid argument`, 1);
    if (!root(game) && (n.owner ?? game.player) !== game.who) return game.error(`chcon: failed to change context of '${shown}' to '${next}': Operation not permitted`, 1);
    if (verbose) out.push(`changing security context of '${shown}'`);
    n.context = next;
    (game.state.chcon ??= 0);
    game.state.chcon++;
  };
  for (const f of files) {
    const n = game.find(f);
    if (!n) {
      game.error(`chcon: cannot access '${f}': No such file or directory`, 1);
      continue;
    }
    if (recursive) walk(n, f.replace(/\/$/, ''), (m, p) => change(m, p));
    else change(n, f);
  }
  return out.join('\n');
}

function restorecon(game: Shell, raw: string[]): string {
  let recursive = false;
  let verbose = false;
  let dry = false;
  let force = false;
  const paths: string[] = [];
  for (const a of raw) {
    if (/^-[RrvnFiDpTWIx0-9]+$/.test(a) && !/^\d/.test(a.slice(1))) {
      if (/[Rr]/.test(a)) recursive = true;
      if (a.includes('v')) verbose = true;
      if (a.includes('n')) dry = true;
      if (a.includes('F')) force = true;
    } else if (a.startsWith('-')) return game.error(`restorecon: invalid option -- '${a.replace(/^-+/, '')[0]}'\nusage:  restorecon [-iIDFUmnprRv0x] [-e excludedir] pathname...\nusage:  restorecon [-iIDFUmnprRv0x] [-e excludedir] -f filename`, 1);
    else paths.push(a);
  }
  if (!paths.length) return game.error('usage:  restorecon [-iIDFUmnprRv0x] [-e excludedir] pathname...\nusage:  restorecon [-iIDFUmnprRv0x] [-e excludedir] -f filename', 1);
  const out: string[] = [];
  for (const p of paths) {
    const abs = game.resolve(p);
    const n = game.find(abs, false);
    if (!n) {
      game.error(`restorecon: lstat(${abs}) failed: No such file or directory`, 255);
      continue;
    }
    const visit = (m: Node, path: string) => {
      const next = restored(game, m, path, force);
      if (!next) return;
      if (!dry && !root(game) && (m.owner ?? game.player) !== game.who) {
        game.error(`restorecon: Could not set context for ${path}:  Permission denied`, 255);
        return;
      }
      if (verbose || dry) out.push(`${dry ? 'Would relabel' : 'Relabeled'} ${path} from ${m.context} to ${next}`);
      if (!dry) m.context = next;
    };
    if (recursive) walk(n, abs, visit);
    else visit(n, abs);
  }
  if (!dry) game.state.restorecon = (game.state.restorecon ?? 0) + 1;
  return out.join('\n');
}

// ——— semanage ———

const VALUE_ERROR = (game: Shell, message: string) => game.error(`ValueError: ${message}`, 1);

function semanage(game: Shell, raw: string[]): string {
  if (missing(game, '/usr/sbin/semanage', 'semanage')) return '';
  const [object, ...rest] = raw;
  if (!object || object.startsWith('-')) return game.error('usage: semanage [-h]\n                \n                {import,export,login,user,port,ibpkey,ibendport,interface,module,node,fcontext,boolean,permissive,dontaudit}\n                ...\nsemanage: error: the following arguments are required: subcommand', 2);
  const opts: Record<string, string | true> = {};
  const positional: string[] = [];
  const LONG: Record<string, string> = { add: 'a', delete: 'd', modify: 'm', list: 'l', type: 't', proto: 'p', ftype: 'f', equal: 'e', locallist: 'C', noheading: 'n', on: '1', off: '0' };
  const WITH_VALUE = ['t', 'p', 'f', 'e', 'r', 's'];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const long = /^--(\w+)(?:=(.*))?$/.exec(a);
    if (long) {
      const k = LONG[long[1]] ?? long[1];
      opts[k] = long[2] ?? (WITH_VALUE.includes(k) ? (rest[++i] ?? '') : true);
    } else if (/^-\w+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const k = a[j];
        if (WITH_VALUE.includes(k)) {
          opts[k] = a.slice(j + 1) || (rest[++i] ?? '');
          break;
        }
        opts[k] = true;
      }
    } else positional.push(a);
  }
  const list = !!opts.l;
  const changing = !!(opts.a || opts.d || opts.m);
  if (!root(game)) return VALUE_ERROR(game, 'SELinux policy is not managed or store cannot be accessed.');
  const st = selinux(game);
  const heading = !opts.n;
  if (object === 'fcontext') {
    if (list) {
      const local = st.fcontexts.map((r) => [r.spec, r.ftype, r.type] as [string, string, string]);
      const rows = opts.C ? local : [...policyFcontexts().filter(([s, , t]) => t !== '<<none>>' && s !== '/.*'), ...local].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const out: string[] = [];
      if (rows.length && heading) out.push(`${'SELinux fcontext'.padEnd(50)} ${'type'.padEnd(18)} Context`, '');
      for (const [spec, ftype, type] of rows) out.push(`${spec.padEnd(50)} ${FTYPES[ftype].padEnd(18)} system_u:object_r:${type}:s0 `);
      if (!opts.C) {
        if (heading) out.push('', 'SELinux Distribution fcontext Equivalence ', '');
        for (const [a, b] of DIST_EQUIVALENCES) out.push(`${a} = ${b}`);
      }
      if (Object.keys(st.equivalences).length) {
        if (heading) out.push('', 'SELinux Local fcontext Equivalence ', '');
        for (const [a, b] of Object.entries(st.equivalences)) out.push(`${a} = ${b}`);
      }
      return out.join('\n');
    }
    const spec = positional[0];
    if (!changing) return game.error('usage: semanage fcontext [-h] [-n] [-N] [-S STORE] [ --add ( -t TYPE -f FTYPE -r RANGE -s SEUSER | -e EQUAL ) FILE_SPEC | --delete ( -t TYPE -f FTYPE | -e EQUAL ) FILE_SPEC | --deleteall | --extract | --list [-C] | --modify ( -t TYPE -f FTYPE -r RANGE -s SEUSER | -e EQUAL ) FILE_SPEC ]', 2);
    if (!spec) return game.error('semanage fcontext: error: the following arguments are required: file_spec', 2);
    if (!spec.startsWith('/')) return VALUE_ERROR(game, 'Invalid file specification');
    if (/\s/.test(spec)) return VALUE_ERROR(game, 'File specification can not include spaces');
    if (typeof opts.e === 'string') {
      const target = spec.replace(/\/$/, '');
      const source = opts.e.replace(/\/$/, '');
      if (opts.d) {
        if (!st.equivalences[target]) return VALUE_ERROR(game, `Equivalence class for ${target} does not exist`);
        delete st.equivalences[target];
        return '';
      }
      if (st.equivalences[target] && opts.a) game.error(`Equivalence class for ${target} already exists, modifying instead`);
      st.equivalences[target] = source;
      return '';
    }
    const ftype = typeof opts.f === 'string' ? FTYPE_OPTIONS[opts.f] ?? (['--', '-d'].includes(opts.f) ? opts.f : null) : '';
    if (ftype === null) return game.error(`semanage fcontext: error: argument -f/--ftype: invalid choice: '${opts.f}' (choose from 'a', 'f', 'd', 'c', 'b', 's', 'l', 'p')`, 2);
    const existing = st.fcontexts.findIndex((r) => r.spec === spec && r.ftype === ftype);
    if (opts.d) {
      if (existing < 0) return VALUE_ERROR(game, policyFcontexts().some(([s]) => s === spec) ? `File context for ${spec} is defined in policy, cannot be deleted` : `File context for ${spec} is not defined`);
      st.fcontexts.splice(existing, 1);
      return '';
    }
    const type = opts.t;
    if (typeof type !== 'string' || !type) return VALUE_ERROR(game, 'SELinux Type is required');
    if (!VALID_TYPE(type)) return VALUE_ERROR(game, `Type ${type} is invalid, must be a file or device type`);
    if (opts.m && existing < 0) return VALUE_ERROR(game, `File context for ${spec} is not defined`);
    if (existing >= 0) {
      if (opts.a) game.error(`File context for ${spec} already defined, modifying instead`);
      st.fcontexts[existing].type = type;
    } else st.fcontexts.push({ spec, ftype, type });
    return '';
  }
  if (object === 'port') {
    if (list) {
      const byType = new Map<string, string[]>();
      for (const p of st.ports) {
        const k = `${p.type}\t${p.proto}`;
        byType.set(k, [...(byType.get(k) ?? []), p.low === p.high ? String(p.low) : `${p.low}-${p.high}`]);
      }
      if (!opts.C) for (const [t, pr, ranges] of POLICY_PORTS) byType.set(`${t}\t${pr}`, [...(byType.get(`${t}\t${pr}`) ?? []), ...ranges]);
      const keys = [...byType.keys()].sort();
      const out = keys.length && heading ? [`${'SELinux Port Type'.padEnd(30)} ${'Proto'.padEnd(8)} Port Number`, ''] : [];
      for (const k of keys) {
        const [t, pr] = k.split('\t');
        out.push(`${t.padEnd(30)} ${pr.padEnd(8)} ${byType.get(k)!.join(', ')}`);
      }
      return out.join('\n');
    }
    if (!changing) return game.error('usage: semanage port [-h] [-n] [-N] [-S STORE] [ --add -t TYPE -p PROTOCOL -r RANGE port_name | port_range | --delete -p PROTOCOL port_name | port_range | --deleteall | --extract | --list [-C] | --modify -t TYPE -p PROTOCOL -r RANGE port_name | port_range ]', 2);
    const port = positional[0];
    const proto = typeof opts.p === 'string' ? opts.p : '';
    if (!port) return game.error('semanage port: error: the following arguments are required: port', 2);
    if (!proto) return VALUE_ERROR(game, 'Protocol udp or tcp is required');
    if (!['tcp', 'udp', 'dccp', 'sctp'].includes(proto)) return VALUE_ERROR(game, `Protocol ${proto} is invalid`);
    const [low, high] = port.split('-').map(Number);
    if (Number.isNaN(low) || (high ?? low) > 65535) return VALUE_ERROR(game, 'Invalid Port');
    const hi = high ?? low;
    const i = st.ports.findIndex((p) => p.proto === proto && p.low === low && p.high === hi);
    if (opts.d) {
      if (i < 0) return VALUE_ERROR(game, policyPortDefined(low, proto) ? `Port ${proto}/${port} is defined in policy, cannot be deleted` : `Port ${proto}/${port} is not defined`);
      st.ports.splice(i, 1);
      return '';
    }
    const type = opts.t;
    if (typeof type !== 'string' || !type) return VALUE_ERROR(game, 'Type is required');
    if (!PORT_TYPES.has(type)) return VALUE_ERROR(game, `Type ${type} is invalid, must be a port type`);
    const exists = i >= 0 || policyPortDefined(low, proto);
    if (opts.m && !exists) return VALUE_ERROR(game, `Port ${proto}/${port} is not defined`);
    if (exists && opts.a) game.error(`Port ${proto}/${port} already defined, modifying instead`);
    if (i >= 0) st.ports[i].type = type;
    else st.ports.unshift({ type, proto, low, high: hi });
    return '';
  }
  if (object === 'boolean') {
    if (list) {
      const names = Object.keys(st.booleans)
        .filter((n) => !opts.C || st.booleans[n].saved !== BOOLEANS[n])
        .sort();
      const out = names.length && heading ? [`${'SELinux boolean'.padEnd(30)} State  Default Description`, ''] : [];
      for (const n of names) {
        const b = st.booleans[n];
        const [subject, ...more] = n.split('_');
        out.push(`${n.padEnd(30)} (${(b.value ? 'on' : 'off').padEnd(5)},${(b.saved ? 'on' : 'off').padStart(5)})  Allow ${subject} to ${more.join(' ')}`);
      }
      return out.join('\n');
    }
    const name = positional[0];
    if (!opts.m || !name) return game.error('usage: semanage boolean [-h] [-n] [-N] [-S STORE] [ --extract | --deleteall | --list [-C] | --modify ( --on | --off ) boolean ]', 2);
    if (!st.booleans[name]) return VALUE_ERROR(game, `Boolean ${name} is not defined`);
    const on = !!opts['1'];
    st.booleans[name].value = on;
    st.booleans[name].saved = on;
    return '';
  }
  return game.error(`usage: semanage [-h]\n                \n                {import,export,login,user,port,ibpkey,ibendport,interface,module,node,fcontext,boolean,permissive,dontaudit}\n                ...\nsemanage: error: argument subcommand: invalid choice: '${object}' (choose from 'import', 'export', 'login', 'user', 'port', 'ibpkey', 'ibendport', 'interface', 'module', 'node', 'fcontext', 'boolean', 'permissive', 'dontaudit')`, 2);
}

// ——— semodule ———

const BASE_MODULES = ['abrt', 'accountsd', 'apache', 'audit', 'auditadm', 'authlogin', 'bootloader', 'chronyd', 'container', 'cron', 'dbus', 'dnsmasq', 'firewalld', 'init', 'logging', 'mta', 'networkmanager', 'nis', 'ntp', 'policykit', 'postfix', 'rpm', 'selinuxutil', 'ssh', 'sssd', 'staff', 'sudo', 'sysadm', 'systemd', 'unconfined', 'unconfineduser', 'userdomain', 'xguest'];

function semodule(game: Shell, raw: string[]): string {
  const st = selinux(game);
  const flag = raw[0] ?? '';
  if (flag === '-l' || flag === '--list-modules' || flag.startsWith('--list-modules=')) return [...BASE_MODULES, ...Object.keys(st.modules)].sort().join('\n');
  if (!root(game) && /^-[ir]|^--(install|remove)/.test(flag))
    return game.error('libsemanage.semanage_create_store: Could not read from module store, active modules subdirectory at /var/lib/selinux/targeted/active/modules. (Permission denied).\nsemodule:  Could not connect to policy handler', 1);
  if (flag === '-i' || flag === '--install') {
    const file = raw[1];
    if (!file) return game.error('semodule:  Missing argument for -i', 1);
    const n = game.find(file);
    if (!n) return game.error(`libsemanage.map_compressed_file: Unable to open ${file}\n (No such file or directory).\nlibsemanage.semanage_direct_install_file: Unable to read file ${file}\n (No such file or directory).\nsemodule:  Failed on ${file}!`, 1);
    const pending = (game.state.policyPackages ?? {}) as Record<string, Rule[]>;
    const rules = pending[game.resolve(file)];
    const name = game.name(file).replace(/\.pp$/, '');
    st.modules[name] = rules ?? [];
    return '';
  }
  if (flag === '-r' || flag === '--remove') {
    const name = raw[1];
    if (!name || !st.modules[name]) return game.error(`libsemanage.semanage_direct_remove_key: Unable to remove module ${name} at priority 400. (No such file or directory).\nsemodule:  Failed!`, 1);
    delete st.modules[name];
    return `libsemanage.semanage_direct_remove_key: Removing last ${name} module (no other ${name} module exists at another priority).`;
  }
  return game.error('usage:  semodule [option]... MODE...\nManage SELinux policy modules.', 1);
}

// ——— The audit log: ausearch, audit2why, audit2allow ———

const ctime = (s: number) => {
  const d = new Date(s * 1000);
  const u = d.toUTCString();
  return `${u.slice(0, 3)} ${u.slice(8, 11)} ${String(d.getUTCDate()).padStart(2, ' ')} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};

/** When the machine booted (its journal's first line of this boot), in seconds. */
const bootTime = (game: Shell) => {
  const sd = game.state.systemd as { boot: number; log: { boot: number; time: number }[] } | undefined;
  return Math.floor((sd?.log.find((e) => e.boot === sd.boot)?.time ?? 0) / 1000);
};

function ausearch(game: Shell, raw: string[]): string {
  if (!root(game)) return game.error('Error opening config file (Permission denied)\nNOTE - using built-in logs: /var/log/audit/audit.log\nError opening /var/log/audit/audit.log (Permission denied)', 1);
  let types: string[] | null = null;
  let since: number | null = null;
  let comm: string | null = null;
  const now = Math.floor((game.state.systemd?.clock ?? 0) / 1000);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '-m' || a === '--message') types = (raw[++i] ?? '').toUpperCase().split(',');
    else if (a === '-c' || a === '--comm') comm = raw[++i] ?? '';
    else if (a === '-ts' || a === '--start') {
      const v = raw[++i] ?? '';
      since = v === 'recent' ? now - 600 : v === 'today' ? now - (now % 86400) : v === 'boot' ? bootTime(game) : /^\d\d?:\d\d(:\d\d)?$/.test(v) ? now - (now % 86400) + Number(v.split(':')[0]) * 3600 + Number(v.split(':')[1]) * 60 : null;
      if (since === null) return game.error(`Invalid start time (${v}). Hint, time is in 24 hour format`, 1);
    } else if (a === '-i' || a === '--interpret' || a === '--raw' || a === '-r') continue;
    else return game.error(`${a} is an unsupported option`, 1);
  }
  if (types && types.some((t) => !['AVC', 'USER_AVC', 'SELINUX_ERR', 'ALL'].includes(t))) {
    if (!types.every((t) => /^[A-Z_]+$/.test(t))) return game.error(`Invalid message type (${types.join(',')})`, 1);
  }
  const hits = selinux(game).audit.filter((a) => (since === null || a.time >= since) && (comm === null || a.comm === comm) && (!types || types.includes('AVC') || types.includes('ALL')));
  if (!hits.length) return game.error('<no matches>', 1);
  return hits.map((a) => ['----', `time->${ctime(a.time)}`, ...eventLines(a).reverse()].join('\n')).join('\n');
}

/** The AVC records of an input (a pipe, a file), or of the whole log with -a. */
function avcsOf(game: Shell, input: string | null, all: boolean): Avc[] | null {
  const log = selinux(game).audit;
  if (all) return log;
  if (input === null) return null;
  const serials = new Set([...input.matchAll(/type=AVC msg=audit\([\d.]+:(\d+)\)/g)].map((m) => Number(m[1])));
  return log.filter((a) => serials.has(a.serial));
}

function audit2why(game: Shell, raw: string[], input: string | null, name = 'audit2why'): string {
  if (missing(game, `/usr/bin/${name}`, name)) return '';
  const all = raw.includes('-a') || raw.includes('--all');
  if (all && !root(game)) return game.error('Error opening /var/log/audit/audit.log (Permission denied)', 1);
  const avcs = avcsOf(game, input, all);
  if (!avcs) return game.error('Nothing to do', 1);
  const out: string[] = [];
  for (const a of avcs) {
    out.push(`${avcLine(a)}\n\n\tWas caused by:`);
    const target = typeOf(a.tcontext);
    const bools = booleansFor(target, a.tclass, a.perm).filter((b) => !selinux(game).booleans[b]?.value);
    if (bools.length > 1) {
      out.push('\tOne of the following booleans was set incorrectly.');
      for (const b of bools) {
        const [subject, ...rest] = b.split('_');
        out.push(`\tDescription:\n\tAllow ${subject} to ${rest.join(' ')}\n`, `\tAllow access by executing:\n\t# setsebool -P ${b} 1`);
      }
    } else if (bools.length === 1) {
      const [subject, ...rest] = bools[0].split('_');
      out.push(`\tThe boolean ${bools[0]} was set incorrectly. `, `\tDescription:\n\tAllow ${subject} to ${rest.join(' ')}\n`, `\tAllow access by executing:\n\t# setsebool -P ${bools[0]} 1`);
    } else out.push('\t\tMissing type enforcement (TE) allow rule.\n', '\t\tYou can use audit2allow to generate a loadable module to allow this access.\n');
  }
  return out.join('\n');
}

function audit2allow(game: Shell, raw: string[], input: string | null): string {
  if (missing(game, '/usr/bin/audit2allow', 'audit2allow')) return '';
  if (raw.includes('-w') || raw.includes('--why')) return audit2why(game, raw.filter((a) => a !== '-w' && a !== '--why'), input, 'audit2allow');
  const all = raw.includes('-a') || raw.includes('--all');
  if (all && !root(game)) return game.error('Error opening /var/log/audit/audit.log (Permission denied)', 1);
  const im = raw.findIndex((a) => a === '-M' || a === '--module-package');
  const avcs = avcsOf(game, input, all);
  if (!avcs) return game.error('Nothing to do', 1);
  // The rules, grouped by source type, one per target and class.
  const rules = new Map<string, Rule>();
  for (const a of avcs) {
    const key = `${typeOf(a.scontext)} ${typeOf(a.tcontext)} ${a.tclass}`;
    const r = rules.get(key) ?? { source: typeOf(a.scontext), target: typeOf(a.tcontext), tclass: a.tclass, perms: [] };
    if (!r.perms.includes(a.perm)) r.perms.push(a.perm);
    rules.set(key, r);
  }
  const text = (r: Rule) => {
    const bools = booleansFor(r.target, r.tclass, r.perms[0]);
    const note = bools.length > 1 ? `\n#!!!! This avc can be allowed using one of the these booleans:\n#     ${bools.join(', ')}` : bools.length === 1 ? `\n#!!!! This avc can be allowed using the boolean '${bools[0]}'` : '';
    return `${note}\nallow ${r.source} ${r.target}:${r.tclass} ${r.perms.length > 1 ? `{ ${r.perms.join(' ')} }` : r.perms[0]};`;
  };
  const sources = [...new Set([...rules.values()].map((r) => r.source))];
  const body = sources.map((s) => `\n#============= ${s} ==============${[...rules.values()].filter((r) => r.source === s).map(text).join('\n')}`).join('\n');
  if (im < 0) return body;
  const name = raw[im + 1];
  if (!name) return game.error('audit2allow: error: -M option requires 1 argument', 2);
  if (!rules.size) return game.error('No AVC records found in the input.', 1);
  const te = `\nmodule ${name} 1.0;\n\nrequire {\n${[...new Set([...rules.values()].flatMap((r) => [r.source, r.target]))].map((t) => `\ttype ${t};`).join('\n')}\n${[...new Set([...rules.values()].map((r) => `\tclass ${r.tclass} { ${r.perms.join(' ')} };`))].join('\n')}\n}\n${body}`;
  for (const [file, content] of [
    [`${name}.te`, te],
    [`${name}.pp`, ''],
  ] as const) {
    const error = game.place('audit2allow', file, { type: 'file', content, owner: game.who, lines: true, ...(file.endsWith('.pp') ? { size: 1408 } : {}) });
    if (error) return game.error(`could not write output file: [Errno 13] Permission denied: '${file}'`, 1);
  }
  const packages = (game.state.policyPackages ??= {}) as Record<string, Rule[]>;
  packages[game.resolve(`${name}.pp`)] = [...rules.values()];
  return `******************** IMPORTANT ***********************\nTo make this policy package active, execute:\n\nsemodule -i ${name}.pp\n`;
}


export const SELINUX_COMMANDS: Record<string, Command> = {
  getenforce: { ownOptions: true, section: 8, launch: ({ game }) => getenforce(game) },
  setenforce: { ownOptions: true, section: 8, launch: ({ args, game }) => setenforce(game, args) },
  sestatus: { ownOptions: true, section: 8, launch: ({ args, game }) => sestatus(game, args) },
  getsebool: { ownOptions: true, section: 8, launch: ({ args, game }) => getsebool(game, args) },
  setsebool: { ownOptions: true, section: 8, launch: ({ args, game }) => setsebool(game, args) },
  chcon: { ownOptions: true, launch: ({ args, game }) => chcon(game, args) },
  restorecon: { ownOptions: true, section: 8, launch: ({ args, game }) => restorecon(game, args) },
  semanage: { ownOptions: true, section: 8, launch: ({ args, game }) => semanage(game, args) },
  semodule: { ownOptions: true, section: 8, launch: ({ args, game }) => semodule(game, args) },
  ausearch: { ownOptions: true, section: 8, launch: ({ args, game }) => ausearch(game, args) },
  audit2why: { ownOptions: true, launch: ({ args, game, input }) => audit2why(game, args, input) },
  audit2allow: { ownOptions: true, launch: ({ args, game, input }) => audit2allow(game, args, input) },
};
