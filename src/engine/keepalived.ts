// keepalived's VRRP (state.vrrp on a story's main machine): two (or more)
// nodes of a story, each with its /etc/keepalived/keepalived.conf read when
// keepalived starts or reloads (SIGHUP), a vrrp_instance each (state,
// interface, virtual_router_id, priority, advert_int, nopreempt,
// authentication, virtual_ipaddress, unicast_src_ip and unicast_peer,
// track_script) and the vrrp_script checks it tracks (script, interval,
// weight, fall, rise). The election runs second by second (`tick`): the
// master sends an advertisement every advert_int to 224.0.0.18 (or to its
// unicast peers); a backup that hears none for the master down interval
// (3 x advert_int + skew time) takes over; a master that hears a higher
// priority (or the same priority from a higher address) steps down; a
// backup with a higher priority than the master's adverts takes over
// unless nopreempt. A tracked script's failure adds its weight to the
// priority (negative: lower), or puts the instance in FAULT when its weight
// is 0. An advertisement reaches a node only if the node's firewall lets it
// in (nftables' input hook, see nftables.ts); one for the same VRID with
// other addresses (another router using the same virtual_router_id) is
// dropped as bogus. The master holds the virtual addresses (ip a) and
// sends gratuitous ARPs when it takes them.
// Sources: https://www.keepalived.org/manpage.html (keepalived.conf(5)),
// https://keepalived.readthedocs.io/en/latest/ (configuration synopsis,
// case study: failover), RFC 3768 (VRRPv2: timers, skew time, priority 0,
// preemption), and keepalived's own log messages (vrrp.c, vrrp_scheduler.c).
// Differences: one vrrp_instance per node takes part in the election (the
// first one), no vrrp_sync_group, no VRRPv3, no virtual MAC (use_vmac), no
// notify scripts; authentication PASS compares the password, AH is read but
// not checked; checks of the scripts we recognise (pidof, killall -0, pgrep,
// systemctl is-active) are computed, others are run by the game's shell.

import type { Game, Shell } from './shell';
import { systemd, writeLog } from './systemd';
import { traverse, type Ruleset } from './nftables';
import type { Process } from './commands/system';

export const CONF_FILE = '/etc/keepalived/keepalived.conf';
export const VRRP_GROUP = '224.0.0.18';
export const VERSION = 'v2.3.3 (03/30,2025)';
const KERNEL = 'Linux 6.12.48+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.12.48-1 (2025-09-20)';

// ——— The configuration ———

export interface VrrpScript {
  name: string;
  script: string;
  interval: number;
  weight: number;
  fall: number;
  rise: number;
}

export interface Instance {
  name: string;
  state: 'MASTER' | 'BACKUP';
  iface: string;
  vrid: number;
  priority: number;
  advertInt: number;
  nopreempt: boolean;
  auth: { type: string; pass: string } | null;
  vips: string[];
  track: { name: string; weight?: number }[];
  unicastSrc: string | null;
  unicastPeers: string[];
}

export interface KaConf {
  scripts: Record<string, VrrpScript>;
  instances: Instance[];
  scriptSecurity: boolean;
  scriptUser: string | null;
  routerId: string | null;
  // Errors (keepalived carries on without the line) and warnings, as keepalived writes them.
  errors: string[];
  warnings: string[];
}

const TOP = ['global_defs', 'vrrp_script', 'vrrp_instance', 'vrrp_sync_group', 'virtual_server', 'virtual_server_group', 'static_ipaddress', 'static_routes', 'include'];
const GLOBAL = ['router_id', 'enable_script_security', 'script_user', 'vrrp_skip_check_adv_addr', 'vrrp_strict', 'vrrp_garp_interval', 'vrrp_gna_interval', 'notification_email', 'notification_email_from', 'smtp_server', 'smtp_connect_timeout', 'max_auto_priority', 'vrrp_garp_master_delay', 'vrrp_garp_master_repeat', 'vrrp_version'];
const SCRIPT = ['script', 'interval', 'timeout', 'weight', 'fall', 'rise', 'user', 'init_fail'];
const INSTANCE = ['state', 'interface', 'virtual_router_id', 'priority', 'advert_int', 'nopreempt', 'preempt_delay', 'authentication', 'virtual_ipaddress', 'virtual_ipaddress_excluded', 'track_script', 'track_interface', 'unicast_src_ip', 'unicast_peer', 'garp_master_delay', 'notify_master', 'notify_backup', 'notify_fault', 'notify', 'smtp_alert', 'dont_track_primary', 'use_vmac', 'version'];
const BLOCKS = ['authentication', 'virtual_ipaddress', 'virtual_ipaddress_excluded', 'track_script', 'track_interface', 'unicast_peer', 'notification_email'];

/** The words of a line (quotes keep spaces), without its comment (# or !). */
function words(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  const clean = line.replace(/(^|\s)[#!].*$/, '');
  while ((m = re.exec(clean))) out.push(m[1] ?? m[2]);
  return out;
}

/** keepalived.conf read like keepalived (its blocks, keywords and checks). */
export function parseKeepalived(text: string, file = CONF_FILE): KaConf {
  const conf: KaConf = { scripts: {}, instances: [], scriptSecurity: false, scriptUser: null, routerId: null, errors: [], warnings: [] };
  const err = (n: number, message: string) => conf.errors.push(`(${file}: Line ${n}) ${message}`);
  // Each line as tokens, braces apart; stack of open blocks.
  const lines = text.split('\n').map((l) => words(l.replace(/([{}])/g, ' $1 ')));
  const stack: { kind: string; name?: string; line: number }[] = [];
  let script: VrrpScript | null = null;
  let inst: Instance | null = null;
  for (const [k, w] of lines.entries()) {
    const n = k + 1;
    let i = 0;
    while (i < w.length) {
      const word = w[i];
      if (word === '}') {
        const closed = stack.pop();
        if (!closed) err(n, "Unexpected '}' - ignoring");
        else if (closed.kind === 'vrrp_script') script = null;
        else if (closed.kind === 'vrrp_instance') inst = null;
        i++;
        continue;
      }
      if (word === '{') {
        i++;
        continue;
      }
      // The rest of the line: a keyword and its values (up to a brace).
      let j = i + 1;
      while (j < w.length && w[j] !== '{' && w[j] !== '}') j++;
      const values = w.slice(i + 1, j);
      const opens = w[j] === '{' || (j === w.length && (lines[k + 1] ?? [])[0] === '{');
      const top = stack.at(-1);
      const kind = top?.kind ?? '';
      const open = (name = word) => stack.push({ kind: name, line: n });
      if (!top) {
        if (!TOP.includes(word)) err(n, `Unknown keyword '${word}'`);
        if (word === 'vrrp_script') {
          script = { name: values[0] ?? '', script: '', interval: 1, weight: 0, fall: 1, rise: 1 };
          if (script.name) conf.scripts[script.name] = script;
        }
        if (word === 'vrrp_instance') {
          inst = { name: values[0] ?? '', state: 'BACKUP', iface: '', vrid: 0, priority: 100, advertInt: 1, nopreempt: false, auth: null, vips: [], track: [], unicastSrc: null, unicastPeers: [] };
          conf.instances.push(inst);
        }
        if (opens) open(TOP.includes(word) ? word : 'unknown');
      } else if (kind === 'global_defs') {
        if (!GLOBAL.includes(word)) err(n, `Unknown keyword '${word}'`);
        if (word === 'router_id') conf.routerId = values[0] ?? null;
        if (word === 'enable_script_security') conf.scriptSecurity = true;
        if (word === 'script_user') conf.scriptUser = values[0] ?? null;
        if (opens) open(BLOCKS.includes(word) ? word : 'unknown');
      } else if (kind === 'vrrp_script' && script) {
        if (!SCRIPT.includes(word)) err(n, `Unknown keyword '${word}'`);
        const num = Number(values[0]);
        if (word === 'script') script.script = values.join(' ');
        if (word === 'interval') script.interval = Number.isFinite(num) && num > 0 ? num : 1;
        if (word === 'weight') {
          if (!Number.isInteger(num) || num < -253 || num > 253) err(n, `vrrp_script ${script.name} weight ${values[0] ?? ''} must be between [-253, 253]`);
          else script.weight = num;
        }
        if (word === 'fall') script.fall = Number.isInteger(num) && num > 0 ? num : 1;
        if (word === 'rise') script.rise = Number.isInteger(num) && num > 0 ? num : 1;
        if (opens) open('unknown');
      } else if (kind === 'vrrp_instance' && inst) {
        if (!INSTANCE.includes(word)) err(n, `Unknown keyword '${word}'`);
        const num = Number(values[0]);
        if (word === 'state') {
          const v = (values[0] ?? '').toUpperCase();
          if (v === 'MASTER' || v === 'BACKUP') inst.state = v;
          else err(n, `(${inst.name}) unknown state '${values[0] ?? ''}', defaulting to BACKUP`);
        }
        if (word === 'interface') inst.iface = values[0] ?? '';
        if (word === 'virtual_router_id') {
          if (!Number.isInteger(num) || num < 1 || num > 255) err(n, `(${inst.name}) VRID '${values[0] ?? ''}' not valid - must be between 1 & 255`);
          else inst.vrid = num;
        }
        if (word === 'priority') {
          if (!Number.isInteger(num) || num < 1 || num > 255) err(n, `(${inst.name}) Priority not valid! must be between 1 & 255`);
          else inst.priority = num;
        }
        if (word === 'advert_int') inst.advertInt = Number.isFinite(num) && num > 0 ? num : 1;
        if (word === 'nopreempt') inst.nopreempt = true;
        if (word === 'unicast_src_ip') inst.unicastSrc = values[0] ?? null;
        if (opens) open(BLOCKS.includes(word) ? word : 'unknown');
      } else if (kind === 'authentication' && inst) {
        if (word === 'auth_type') inst.auth = { type: (values[0] ?? 'PASS').toUpperCase(), pass: inst.auth?.pass ?? '' };
        else if (word === 'auth_pass') inst.auth = { type: inst.auth?.type ?? 'PASS', pass: (values[0] ?? '').slice(0, 8) };
        else err(n, `Unknown keyword '${word}'`);
      } else if ((kind === 'virtual_ipaddress' || kind === 'virtual_ipaddress_excluded') && inst) {
        if (!/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(word)) err(n, `(${inst.name}) Invalid address '${word}' - ignoring`);
        else if (kind === 'virtual_ipaddress') inst.vips.push(word.includes('/') ? word : `${word}/32`);
      } else if (kind === 'unicast_peer' && inst) {
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(word)) err(n, `(${inst.name}) Invalid unicast peer '${word}' - ignoring`);
        else inst.unicastPeers.push(word);
      } else if (kind === 'track_script' && inst) {
        const wi = values.indexOf('weight');
        inst.track.push({ name: word, ...(wi >= 0 ? { weight: Number(values[wi + 1]) } : {}) });
      } else if (opens) open('unknown');
      i = j;
    }
  }
  if (stack.length) err(lines.length, `Missing '}' at end of configuration block '${stack.at(-1)!.kind}' (opened line ${stack.at(-1)!.line})`);
  for (const inst of conf.instances) {
    if (!inst.vrid) conf.errors.push(`(${inst.name}): the virtual router id must be set`);
    if (!inst.iface) conf.errors.push(`(${inst.name}) Unknown interface !`);
    for (const t of inst.track) if (!conf.scripts[t.name]) conf.errors.push(`(${inst.name}) track script ${t.name} not found, ignoring...`);
    inst.track = inst.track.filter((t) => conf.scripts[t.name]);
    if (inst.nopreempt && inst.state === 'MASTER') {
      conf.warnings.push(`(${inst.name}) Warning - nopreempt will not work with initial state MASTER - clearing`);
      inst.nopreempt = false;
    }
  }
  for (const s of Object.values(conf.scripts)) if (!s.script) conf.errors.push(`VRRP_Script(${s.name}) has no script - ignoring`);
  return conf;
}

// ——— The nodes and their state ———

export interface Node {
  name: string;
  address: string;
  mac: string;
  iface: string;
}

// Another VRRP router on the same link (a router pair using VRRP for its own gateway address).
export interface Speaker {
  address: string;
  mac: string;
  vrid: number;
  priority: number;
  vips: string[];
  advertInt: number;
}

export interface ScriptRun {
  status: 'init' | 'good' | 'bad';
  streak: number;
  nextRun: number;
  disabled: boolean;
  code: number;
}

export type VrrpStateName = 'BACKUP' | 'MASTER' | 'FAULT';

export interface Run {
  conf: KaConf;
  pid: number;
  inst: Instance | null;
  state: VrrpStateName;
  effective: number;
  downAt: number;
  nextAdvert: number;
  scripts: Record<string, ScriptRun>;
  since: number;
}

export interface Packet {
  time: number;
  kind: 'vrrp' | 'garp' | 'arp-request' | 'arp-reply';
  src: string;
  dst: string;
  srcMac: string;
  vrid?: number;
  prio?: number;
  vips?: string[];
  advertInt?: number;
  auth?: { type: string; pass: string } | null;
  // ARP: the address asked or announced.
  target?: string;
}

export interface Vrrp {
  // The node that is the story's main machine (the others are its internal machines).
  main: string;
  nodes: Record<string, Node>;
  runs: Record<string, Run | undefined>;
  speakers: Speaker[];
  packets: Packet[];
  now: number;
  nextPid: number;
  // Each node's shell, by name (the main machine, or one of its internal machines).
  shells?: Record<string, Shell>;
  // Every virtual address keepalived ever set (taken off an interface when no longer held).
  vipsSeen?: string[];
}

export const vrrp = (j: Game): Vrrp => (j as Shell).principal.state.vrrp as Vrrp;
export const hasVrrp = (j: Game) => !!(j as Shell).principal?.state?.vrrp;

/** The node a shell is, if any. */
export function nodeOf(j: Game): string | null {
  const s = j as Shell;
  const v = vrrp(s);
  if (!v) return null;
  return Object.keys(v.nodes).find((n) => shellOf(s, n) === s) ?? null;
}

/** A node's shell (the main machine, or an internal machine created on first use). */
export function shellOf(j: Game, name: string): Shell {
  const p = (j as Shell).principal;
  return (p.state.vrrp as Vrrp).main === name ? p : (p.internal(name) as Shell);
}

const ip = (a: string) => a.split('/')[0];
const masterDown = (r: Run) => {
  const adv = (r.inst?.advertInt ?? 1) * 1000;
  return 3 * adv + Math.floor(((256 - r.effective) * adv) / 256);
};

function log(j: Game, name: string, message: string, child = true) {
  const sh = shellOf(j, name);
  const sd = systemd(sh);
  const r = vrrp(j).runs[name];
  if (!sd) return;
  sd.clock = Math.max(sd.clock, vrrp(j).now);
  writeLog(sd, 'keepalived.service', child ? 'Keepalived_vrrp' : 'Keepalived', (r?.pid ?? 0) + (child ? 1 : 0), message, 6, false);
}

const send = (j: Game, p: Packet) => vrrp(j).packets.push(p);

function advert(j: Game, name: string, prio?: number) {
  const v = vrrp(j);
  const r = v.runs[name]!;
  const node = v.nodes[name];
  const inst = r.inst!;
  const base = { time: v.now, kind: 'vrrp' as const, src: inst.unicastSrc ?? node.address, srcMac: node.mac, vrid: inst.vrid, prio: prio ?? r.effective, vips: inst.vips, advertInt: inst.advertInt, auth: inst.auth };
  if (inst.unicastPeers.length) for (const peer of inst.unicastPeers) send(j, { ...base, dst: peer });
  else send(j, { ...base, dst: VRRP_GROUP });
}

function becomeMaster(j: Game, name: string, timeout = true) {
  const v = vrrp(j);
  const r = v.runs[name]!;
  const inst = r.inst!;
  if (timeout) log(j, name, `(${inst.name}) Receive advertisement timeout`);
  log(j, name, `(${inst.name}) Entering MASTER STATE`);
  log(j, name, `(${inst.name}) setting VIPs.`);
  r.state = 'MASTER';
  r.since = v.now;
  const vip = inst.vips.map(ip).join(', ');
  log(j, name, `(${inst.name}) Sending/queueing gratuitous ARPs on ${inst.iface} for ${vip}`);
  for (let k = 0; k < 5; k++) {
    for (const a of inst.vips) {
      log(j, name, `Sending gratuitous ARP on ${inst.iface} for ${ip(a)}`);
      if (k === 0) send(j, { time: v.now, kind: 'garp', src: ip(a), dst: 'ff:ff:ff:ff:ff:ff', srcMac: v.nodes[name].mac, target: ip(a) });
    }
  }
  r.nextAdvert = v.now;
}

function becomeBackup(j: Game, name: string) {
  const v = vrrp(j);
  const r = v.runs[name]!;
  if (r.state === 'MASTER') log(j, name, `(${r.inst!.name}) removing VIPs.`);
  r.state = 'BACKUP';
  r.since = v.now;
  r.downAt = v.now + masterDown(r);
}

// ——— Starting, stopping, reloading (the keepalived service) ———

function newRun(j: Game, name: string, conf: KaConf, pid: number): Run {
  const v = vrrp(j);
  const inst = conf.instances.find((i) => i.iface && i.vrid) ?? null;
  const run: Run = { conf, pid, inst, state: 'BACKUP', effective: inst?.priority ?? 100, downAt: 0, nextAdvert: 0, scripts: {}, since: v.now };
  const sh = shellOf(j, name);
  for (const s of Object.values(conf.scripts)) {
    const path = s.script.split(/\s+/)[0];
    const missing = path.startsWith('/') && !sh.find(path);
    run.scripts[s.name] = { status: 'init', streak: 0, nextRun: v.now, disabled: missing || !s.script, code: 0 };
  }
  return run;
}

function startInstance(j: Game, name: string, r: Run) {
  const v = vrrp(j);
  if (!r.inst) return;
  for (const [n, s] of Object.entries(r.scripts)) if (s.disabled && r.inst.track.some((t) => t.name === n)) log(j, name, `Disabling track script ${n} since not found/accessible`);
  r.effective = r.inst.priority;
  if (r.inst.priority === 255 && r.inst.state === 'MASTER') {
    becomeMaster(j, name, false);
    return;
  }
  log(j, name, `(${r.inst.name}) Entering BACKUP STATE (init)`);
  r.state = 'BACKUP';
  r.downAt = v.now + masterDown(r);
}

/** keepalived starts on a node: it reads its configuration and enters the BACKUP state. */
export function startKeepalived(j: Game, name: string) {
  const v = vrrp(j);
  const sh = shellOf(j, name);
  v.now = Math.max(v.now, systemd(sh)?.clock ?? 0);
  const conf = parseKeepalived(sh.read(CONF_FILE) ?? '');
  const pid = systemd(sh)?.services.keepalived?.process[0]?.pid ?? v.nextPid;
  const r = newRun(j, name, conf, pid);
  v.runs[name] = r;
  log(j, name, `Starting Keepalived ${VERSION}`, false);
  log(j, name, `Running on ${KERNEL} (built for Linux 6.12.0)`, false);
  log(j, name, `Command line: '/usr/sbin/keepalived' '--dont-fork'`, false);
  log(j, name, `Configuration file ${CONF_FILE}`, false);
  log(j, name, `NOTICE: setting config option max_auto_priority should result in better keepalived performance`, false);
  log(j, name, `Starting VRRP child process, pid=${pid + 1}`, false);
  for (const e of [...conf.errors, ...conf.warnings]) log(j, name, e);
  if (Object.keys(conf.scripts).length && !conf.scriptUser && !sh.accounts.users.keepalived_script) log(j, name, `WARNING - default user 'keepalived_script' for script execution does not exist - please create.`);
  if (Object.keys(conf.scripts).length && !conf.scriptSecurity) log(j, name, `SECURITY VIOLATION - scripts are being executed but script_security not enabled.`);
  log(j, name, `Startup complete`, false);
  startInstance(j, name, r);
  syncAddresses(j);
}

/** keepalived stops: a master says so (priority 0) and drops its addresses. */
export function stopKeepalived(j: Game, name: string) {
  const v = vrrp(j);
  const r = v.runs[name];
  if (!r) return;
  v.now = Math.max(v.now, systemd(shellOf(j, name))?.clock ?? 0);
  log(j, name, 'Stopping', false);
  if (r.state === 'MASTER' && r.inst) {
    advert(j, name, 0);
    log(j, name, `(${r.inst.name}) sent 0 priority`);
    log(j, name, `(${r.inst.name}) removing VIPs.`);
  }
  log(j, name, 'Stopped', true);
  log(j, name, `Stopped Keepalived ${VERSION}`, false);
  v.runs[name] = undefined;
  syncAddresses(j);
}

/** systemctl reload keepalived (SIGHUP): the configuration is read again; an instance that kept its VRID and interface keeps its state. */
export function reloadKeepalived(j: Game, name: string) {
  const v = vrrp(j);
  const old = v.runs[name];
  if (!old) return;
  const sh = shellOf(j, name);
  v.now = Math.max(v.now, systemd(sh)?.clock ?? 0);
  const conf = parseKeepalived(sh.read(CONF_FILE) ?? '');
  log(j, name, `Reloading Keepalived ${VERSION}`, false);
  log(j, name, `Opening file '${CONF_FILE}'.`, false);
  for (const e of [...conf.errors, ...conf.warnings]) log(j, name, e);
  const r = newRun(j, name, conf, old.pid);
  v.runs[name] = r;
  const same = old.inst && r.inst && old.inst.vrid === r.inst.vrid && old.inst.iface === r.inst.iface;
  if (same) {
    r.state = old.state;
    r.since = old.since;
    r.effective = r.inst!.priority;
    r.downAt = old.state === 'BACKUP' ? v.now + masterDown(r) : old.downAt;
    r.nextAdvert = v.now;
    for (const [n, s] of Object.entries(r.scripts)) if (s.disabled && r.inst!.track.some((t) => t.name === n)) log(j, name, `Disabling track script ${n} since not found/accessible`);
  } else {
    if (old.state === 'MASTER' && old.inst) {
      advert(j, name, 0);
      log(j, name, `(${old.inst.name}) removing VIPs.`);
    }
    startInstance(j, name, r);
  }
  syncAddresses(j);
}

/** Hooks a node's keepalived service to the model (call once its shell exists). */
export function attachKeepalived(j: Game, name: string) {
  const s = systemd(j)?.services.keepalived;
  if (!s) return;
  s.load = (g) => {
    // Started, or reloaded: a run already there means SIGHUP.
    if (vrrp(g).runs[name]) reloadKeepalived(g, name);
    else startKeepalived(g, name);
  };
  s.stop = (g) => stopKeepalived(g, name);
}

// ——— Scripts ———

const comm = (p: Process) => p.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '');

/** A check script's exit code: the usual checks are computed, the others run in the node's shell (as root). */
export function runCheck(j: Game, name: string, script: string): number {
  const sh = shellOf(j, name);
  const w = script.trim().split(/\s+/);
  const program = (w[0] ?? '').split('/').at(-1)!;
  const processes = ((sh.state.process ?? []) as Process[]).filter((p) => !p.zombie && !p.stopped);
  const running = (n: string) => processes.some((p) => comm(p) === n);
  const args = w.slice(1).filter((a) => !a.startsWith('-'));
  if (program === 'pidof' && args.length) return args.some(running) ? 0 : 1;
  if (program === 'killall' && w.includes('-0') && args.length) return args.every(running) ? 0 : 1;
  if (program === 'pgrep' && args.length) return processes.some((p) => (w.includes('-x') ? comm(p) === args[0] : p.command.includes(args[0]))) ? 0 : 1;
  if (program === 'systemctl' && w.includes('is-active') && args.length >= 2) {
    const unit = args[args.indexOf('is-active') + 1]?.replace(/\.service$/, '');
    return systemd(sh)?.services[unit]?.state === 'active' ? 0 : 3;
  }
  const before = sh.who;
  sh.who = 'root';
  try {
    const path = w[0];
    const text = path.startsWith('/') ? sh.read(path) : null;
    return sh.underCommand(text ?? script, '/').code;
  } finally {
    sh.who = before;
  }
}

function runScripts(j: Game, name: string) {
  const v = vrrp(j);
  const r = v.runs[name]!;
  for (const [n, s] of Object.entries(r.scripts)) {
    const def = r.conf.scripts[n];
    if (s.disabled || v.now < s.nextRun || !def) continue;
    s.nextRun = v.now + def.interval * 1000;
    if (!r.inst?.track.some((t) => t.name === n)) continue;
    const code = runCheck(j, name, def.script);
    const ok = code === 0;
    s.code = code;
    if (s.status === 'init') {
      s.status = ok ? 'good' : 'bad';
      s.streak = 0;
      log(j, name, ok ? `VRRP_Script(${n}) succeeded` : `VRRP_Script(${n}) failed (exited with status ${code})`);
      continue;
    }
    if ((s.status === 'good') === ok) {
      s.streak = 0;
      continue;
    }
    s.streak++;
    if (s.status === 'good' && s.streak >= def.fall) {
      s.status = 'bad';
      s.streak = 0;
      log(j, name, `VRRP_Script(${n}) failed (exited with status ${code})`);
    } else if (s.status === 'bad' && s.streak >= def.rise) {
      s.status = 'good';
      s.streak = 0;
      log(j, name, `VRRP_Script(${n}) succeeded`);
    }
  }
}

/** The instance's priority with its tracked scripts' weights, and whether one puts it in FAULT. */
export function effectiveOf(r: Run): { priority: number; fault: boolean } {
  const inst = r.inst!;
  let p = inst.priority;
  let fault = false;
  for (const t of inst.track) {
    const s = r.scripts[t.name];
    const def = r.conf.scripts[t.name];
    if (!s || !def || s.disabled || s.status === 'init') continue;
    const w = t.weight ?? def.weight;
    if (w === 0 && s.status === 'bad') fault = true;
    if (w > 0 && s.status === 'good') p += w;
    if (w < 0 && s.status === 'bad') p += w;
  }
  return { priority: inst.priority === 255 ? 255 : Math.min(254, Math.max(1, p)), fault };
}

// ——— The election, second by second ———

/** Whether a node's firewall lets an advertisement (or ARP) in. */
function admits(sh: Shell, p: Packet, iface: string): boolean {
  if (p.kind !== 'vrrp') return true;
  const r = sh.state.nft as Ruleset | undefined;
  if (!r || !r.tables.length) return true;
  return traverse(r, 'input', 'filter', { iif: iface, oif: '', saddr: p.src, daddr: p.dst, proto: 'vrrp', sport: 0, dport: 0, ct: 'new', size: 60 }).pass;
}

const sameVips = (a: string[], b: string[]) => a.map(ip).sort().join(',') === b.map(ip).sort().join(',');

function receive(j: Game, name: string, p: Packet) {
  const v = vrrp(j);
  const r = v.runs[name]!;
  const inst = r.inst!;
  const node = v.nodes[name];
  if (p.vrid !== inst.vrid) return;
  const theirs = p.vips ?? [];
  if (!sameVips(theirs, inst.vips)) {
    const missing = inst.vips.find((a) => !theirs.map(ip).includes(ip(a)));
    log(j, name, `(${inst.name}) ip address associated with VRID ${inst.vrid} not present in MASTER advert : ${missing ? ip(missing) : ip(theirs[0] ?? '')}`);
    log(j, name, `bogus VRRP packet received on ${inst.iface} !!!`);
    return;
  }
  if ((p.auth?.type ?? null) !== (inst.auth?.type ?? null) || (inst.auth?.type === 'PASS' && p.auth?.pass !== inst.auth.pass)) {
    log(j, name, `(${inst.name}) received an invalid passwd!`);
    return;
  }
  if ((p.advertInt ?? 1) !== inst.advertInt) {
    log(j, name, `(${inst.name}) advertisement interval mismatch mine=${inst.advertInt * 1000} msec rcv'd=${(p.advertInt ?? 1) * 1000} msec`);
    return;
  }
  const prio = p.prio ?? 0;
  if (r.state === 'MASTER') {
    if (prio === 0) {
      advert(j, name);
      return;
    }
    const higherIp = toNumber(p.src) > toNumber(inst.unicastSrc ?? node.address);
    if (prio > r.effective || (prio === r.effective && higherIp)) {
      log(
        j,
        name,
        prio > r.effective
          ? `(${inst.name}) Master received advert from ${p.src} with higher priority ${prio}, ours ${r.effective}`
          : `(${inst.name}) Master received advert from ${p.src} with same priority ${prio} but higher IP address than ours`,
      );
      log(j, name, `(${inst.name}) Entering BACKUP STATE`);
      becomeBackup(j, name);
    } else {
      log(j, name, `(${inst.name}) Received advert from ${p.src} with lower priority ${prio}, ours ${r.effective}, forcing new election`);
      advert(j, name);
    }
    return;
  }
  if (r.state === 'BACKUP') {
    if (prio === 0) {
      r.downAt = v.now + Math.floor(((256 - r.effective) * inst.advertInt * 1000) / 256);
      return;
    }
    if (inst.nopreempt || prio >= r.effective) r.downAt = v.now + masterDown(r);
  }
}

const toNumber = (a: string) => a.split('.').reduce((n, x) => n * 256 + Number(x), 0);

/** One second of the nodes' life. */
export function tick(j: Game, now: number) {
  const v = vrrp(j);
  v.now = now;
  const start = v.packets.length;
  for (const [name, r] of Object.entries(v.runs)) {
    if (!r?.inst) continue;
    runScripts(j, name);
    const { priority, fault } = effectiveOf(r);
    if (fault && r.state !== 'FAULT') {
      if (r.state === 'MASTER') {
        advert(j, name, 0);
        log(j, name, `(${r.inst.name}) removing VIPs.`);
      }
      log(j, name, `(${r.inst.name}) Entering FAULT STATE`);
      r.state = 'FAULT';
      r.since = now;
    } else if (!fault && r.state === 'FAULT') {
      log(j, name, `(${r.inst.name}) Entering BACKUP STATE`);
      r.effective = priority;
      becomeBackup(j, name);
    }
    if (priority !== r.effective && r.state !== 'FAULT') {
      log(j, name, `(${r.inst.name}) Changing effective priority from ${r.effective} to ${priority}`);
      r.effective = priority;
    }
  }
  // The masters (and the other routers) advertise.
  for (const [name, r] of Object.entries(v.runs))
    if (r?.inst && r.state === 'MASTER' && now >= r.nextAdvert) {
      advert(j, name);
      r.nextAdvert = now + r.inst.advertInt * 1000;
    }
  for (const s of v.speakers)
    if (Math.floor(now / 1000) % s.advertInt === 0)
      send(j, { time: now, kind: 'vrrp', src: s.address, dst: VRRP_GROUP, srcMac: s.mac, vrid: s.vrid, prio: s.priority, vips: s.vips, advertInt: s.advertInt, auth: null });
  // What each node hears (in the order sent; an answer sent now is heard by the others too).
  for (let k = start; k < v.packets.length && k < start + 64; k++) {
    const p = v.packets[k];
    if (p.kind !== 'vrrp') continue;
    for (const [name, r] of Object.entries(v.runs)) {
      if (!r?.inst || r.state === 'FAULT') continue;
      const node = v.nodes[name];
      if (p.src === node.address || p.src === r.inst.unicastSrc) continue;
      const unicast = r.inst.unicastPeers.length > 0;
      const reaches = p.dst === VRRP_GROUP ? !unicast : p.dst === node.address;
      if (!reaches) continue;
      if (unicast && !r.inst.unicastPeers.includes(p.src)) continue;
      if (!admits(shellOf(j, name), p, r.inst.iface)) continue;
      receive(j, name, p);
    }
  }
  for (const [name, r] of Object.entries(v.runs)) if (r?.inst && r.state === 'BACKUP' && now >= r.downAt) becomeMaster(j, name);
  v.packets = v.packets.filter((p) => p.time > now - 120_000);
  syncAddresses(j);
}

/** The nodes in the MASTER state (they hold the virtual addresses). */
export const masters = (j: Game) => Object.entries(vrrp(j).runs).filter(([, r]) => r?.inst && r.state === 'MASTER').map(([n]) => n);

/** The virtual addresses a node holds. */
export function heldBy(j: Game, name: string): string[] {
  const r = vrrp(j).runs[name];
  return r?.inst && r.state === 'MASTER' ? r.inst.vips : [];
}

/** ip a follows: each node's interface carries the virtual addresses it holds. */
export function syncAddresses(j: Game) {
  const v = vrrp(j);
  const all = new Set(Object.values(v.runs).flatMap((r) => r?.inst?.vips ?? []));
  for (const name of Object.keys(v.nodes)) {
    const sh = shellOf(j, name);
    const lan = sh.state.baseLan as { interfaces: Record<string, { addresses: string[] }> } | undefined;
    const i = lan?.interfaces[v.nodes[name].iface];
    if (!i) continue;
    const kept = i.addresses.filter((a) => !all.has(a) && !(v.vipsSeen ?? []).includes(a));
    i.addresses = [...kept, ...heldBy(j, name).filter((a) => !kept.includes(a))];
  }
  v.vipsSeen = [...new Set([...(v.vipsSeen ?? []), ...all])];
}

/** keepalived -t: the configuration's errors (empty: valid). */
export function configTest(text: string, file = CONF_FILE): string[] {
  const c = parseKeepalived(text, file);
  return [...c.errors, ...c.warnings];
}
