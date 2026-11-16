// A FreeBSD machine (state.os = 'freebsd'): what differs from the Debian
// servers of the other stories, after the FreeBSD Handbook
// (https://docs.freebsd.org/en/books/handbook/):
//   - no systemd: services are rc scripts (/etc/rc.d, /usr/local/etc/rc.d),
//     switched on by a line in /etc/rc.conf (nginx_enable="YES"), driven by
//     service(8) and edited with sysrc(8) — state.rc keeps what runs;
//   - packages with pkg(8), installed under /usr/local (state.pkg);
//   - the BSD userland: date, sed, stat take other options than GNU's, and
//     bash is not part of the base system (/bin/sh is);
//   - the firewall is pf (state.pf): /etc/pf.conf read by pfctl(8), where
//     the LAST matching rule wins (unless "quick"), the opposite of
//     iptables. https://man.freebsd.org/cgi/man.cgi?query=pf.conf
// Simplifications (see docs/SCENARIOS.md): a handful of packages, the pf
// rules that decide an incoming TCP connection (pass/block, in/out, quick,
// proto, from, to, port, lists and macros, set skip), no NAT, no tables.

import type { Game } from './shell';
import { inNetwork, type Verdict } from './firewall';
import type { Listening } from './commands/ss';

export const isBsd = (game: Game) => game.state.os === 'freebsd';

// Commands of a Debian server that a FreeBSD base system doesn't have.
export const LINUX_ONLY = [
  'systemctl', 'journalctl', 'apt', 'apt-get', 'dpkg', 'ss', 'ip', 'ufw', 'iptables', 'iptables-save', 'nft', 'update-rc.d', 'useradd', 'free',
];

// ——— /etc/rc.conf ———

export const RC_CONF = '/etc/rc.conf';

/** The variables of rc.conf (name → value without quotes), as sh would read them. */
export function rcConf(game: Game): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of (game.read(RC_CONF) ?? '').split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([A-Za-z_][\w]*)=(?:"([^"]*)"|'([^']*)'|(\S*))$/.exec(line);
    if (m) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

const yes = (v: string | undefined) => /^(yes|true|on|1)$/i.test(v ?? '');
/** Is the service switched on in rc.conf (its rcvar: NAME_enable, or the one its script names)? */
export const enabled = (game: Game, service: string) => yes(rcConf(game)[rcState(game).services[service]?.rcvar ?? `${service}_enable`]);

/** Sets (or adds) NAME="value" in rc.conf, like sysrc; returns the old value (undefined: unset). */
export function setRc(game: Game, name: string, value: string): string | undefined {
  const before = rcConf(game)[name];
  const text = game.read(RC_CONF) ?? '';
  const line = `${name}="${value}"`;
  const re = new RegExp(`^\\s*${name}=.*$`, 'm');
  const next = re.test(text) ? text.replace(re, line) : `${text.replace(/\n*$/, '')}${text ? '\n' : ''}${line}`;
  const n = game.find(RC_CONF);
  if (n?.type === 'file') {
    n.content = next;
    n.lines = true;
  }
  return before;
}

/** Removes NAME from rc.conf (sysrc -x); false if it wasn't set. */
export function unsetRc(game: Game, name: string): boolean {
  const text = game.read(RC_CONF) ?? '';
  const re = new RegExp(`^\\s*${name}=.*\\n?`, 'm');
  if (!re.test(text)) return false;
  const n = game.find(RC_CONF);
  if (n?.type === 'file') n.content = text.replace(re, '').replace(/\n$/, '');
  return true;
}

// ——— packages ———

export interface Package {
  version: string;
  comment: string;
  size: string;
  // What installing it adds to the world (path → content), and its rc script.
  files: Record<string, string>;
  service?: string;
  // The message pkg prints after installing it.
  message?: string;
}

export interface PkgState {
  installed: string[];
  // The packages the repository offers (declared by the story).
  catalogue: Record<string, Package>;
}

export const pkgState = (game: Game): PkgState => (game.state.pkg ??= { installed: [], catalogue: {} });
export const installed = (game: Game, name: string) => pkgState(game).installed.includes(name);

// ——— rc services ———

export interface RcService {
  // Its rc.conf variable, when it isn't NAME_enable (mysql-server: mysql_enable).
  rcvar?: string;
  // The program and its listening sockets when it runs.
  program: string;
  listening: Omit<Listening, 'pid'>[];
  // A configuration check before start (nginx -t): errors, or null.
  check?: (game: Game) => string[] | null;
  // Lines printed on start (after the check).
  start?: string[];
  // The service manages something else than a process (pf): its own start/stop.
  onStart?: (game: Game) => string | null;
  onStop?: (game: Game) => string;
  status?: (game: Game) => string;
}

export interface RcState {
  // The services the machine knows (base system and installed packages).
  services: Record<string, RcService>;
  // What runs: service → pid.
  running: Record<string, number>;
  nextPid: number;
}

export const rcState = (game: Game): RcState => (game.state.rc ??= { services: {}, running: {}, nextPid: 900 });

/** Is there an rc script for this service (base system, or an installed package's)? */
export const hasScript = (game: Game, name: string) => game.exists(`/etc/rc.d/${name}`) || game.exists(`/usr/local/etc/rc.d/${name}`);

/** Starts a service: its process and its sockets. */
export function startService(game: Game, name: string): string[] | null {
  const rc = rcState(game);
  const s = rc.services[name];
  if (!s) return null;
  const errors = s.check?.(game);
  if (errors) return errors;
  if (s.onStart) {
    const e = s.onStart(game);
    if (e) return [e];
  }
  if (!s.onStart) {
    const pid = rc.nextPid++;
    rc.running[name] = pid;
    game.state.listening = [...((game.state.listening ?? []) as Listening[]), ...s.listening.map((l) => ({ ...l, pid }))];
    (game.state.process ??= []).push({ pid, user: 'root', cpu: 0, mem: 0.3, command: `${s.program}: master process ${s.program}`, ppid: 1 });
  } else rc.running[name] = 0;
  return [];
}

export function stopService(game: Game, name: string) {
  const rc = rcState(game);
  const pid = rc.running[name];
  if (pid === undefined) return;
  rc.services[name]?.onStop?.(game);
  delete rc.running[name];
  if (pid) {
    game.state.listening = ((game.state.listening ?? []) as Listening[]).filter((l) => l.pid !== pid);
    game.state.process = ((game.state.process ?? []) as { pid: number }[]).filter((p) => p.pid !== pid);
  }
}

// ——— pf ———

export interface PfRule {
  action: 'pass' | 'block';
  direction: 'in' | 'out' | 'any';
  quick: boolean;
  proto?: 'tcp' | 'udp';
  from: string[]; // addresses or networks; [] = any
  to: string[];
  ports: number[]; // [] = any
  // block return: refuse (RST) rather than drop.
  ret?: boolean;
  text: string; // the rule as pfctl -sr shows it
}

export interface PfState {
  enabled: boolean;
  rules: PfRule[];
  skip: string[];
}

export const pf = (game: Game): PfState | undefined => game.state.pf as PfState | undefined;

const SERVICES: Record<string, number> = { ssh: 22, http: 80, https: 443, domain: 53, smtp: 25, mysql: 3306, postgresql: 5432, ftp: 21 };

/** Parses pf.conf; returns the rules or the errors (like pfctl -nf: "file:line: syntax error"). */
export function parsePf(text: string, file: string): { rules: PfRule[]; skip: string[] } | { errors: string[] } {
  const macros: Record<string, string> = {};
  const rules: PfRule[] = [];
  const skip: string[] = [];
  const errors: string[] = [];
  // Lines continued with "\".
  const lines = text.replace(/\\\n/g, ' ').split('\n');
  lines.forEach((raw, i) => {
    const where = `${file}:${i + 1}`;
    let line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const macro = /^(\w+)\s*=\s*"([^"]*)"$/.exec(line);
    if (macro) {
      macros[macro[1]] = macro[2];
      return;
    }
    line = line.replace(/\$(\w+)/g, (m, n) => macros[n] ?? `\u0000${n}`);
    if (line.includes('\u0000')) {
      errors.push(`${where}: macro '${/\u0000(\w+)/.exec(line)![1]}' not defined`);
      return;
    }
    const set = /^set\s+skip\s+on\s+(\{[^}]*\}|\S+)$/.exec(line);
    if (set) {
      skip.push(...set[1].replace(/[{}]/g, ' ').split(/[\s,]+/).filter(Boolean));
      return;
    }
    if (/^set\s+(block-policy|loginterface|optimization)\b/.test(line)) return;
    if (/^scrub\b/.test(line)) return;
    const r = parseRule(line);
    if (typeof r === 'string') errors.push(`${where}: ${r}`);
    else rules.push(r);
  });
  return errors.length ? { errors } : { rules, skip };
}

// A list: { a, b } or a single word.
function list(words: string[], i: number): { values: string[]; next: number } | null {
  if (words[i] === '{') {
    const end = words.indexOf('}', i);
    if (end < 0) return null;
    return { values: words.slice(i + 1, end).flatMap((w) => w.split(',')).filter(Boolean), next: end + 1 };
  }
  return words[i] === undefined ? null : { values: [words[i]], next: i + 1 };
}

function parseRule(line: string): PfRule | string {
  const words = line.replace(/([{}])/g, ' $1 ').replace(/,/g, ' , ').split(/\s+/).filter((w) => w && w !== ',');
  const action = words[0];
  if (action !== 'pass' && action !== 'block') return 'syntax error';
  const r: PfRule = { action, direction: 'any', quick: false, from: [], to: [], ports: [], text: '' };
  let i = 1;
  if (action === 'block' && (words[i] === 'return' || words[i] === 'drop')) r.ret = words[i++] === 'return';
  if (words[i] === 'in' || words[i] === 'out') r.direction = words[i++] as 'in' | 'out';
  for (;;) {
    const w = words[i];
    if (w === undefined) break;
    if (w === 'quick') (r.quick = true), i++;
    else if (w === 'log') i++;
    else if (w === 'on') i += 2;
    else if (w === 'inet' || w === 'inet6') i++;
    else if (w === 'all') i++;
    else if (w === 'proto') {
      const p = words[i + 1];
      if (p !== 'tcp' && p !== 'udp' && p !== 'icmp') return 'syntax error';
      if (p !== 'icmp') r.proto = p;
      i += 2;
    } else if (w === 'from' || w === 'to') {
      // "to port ssh": the address may be left out (any).
      const l = words[i + 1] === 'port' ? { values: [], next: i + 1 } : list(words, i + 1);
      if (!l) return 'syntax error';
      const values = l.values.filter((v) => v !== 'any');
      if (w === 'from') r.from = values;
      else r.to = values;
      i = l.next;
      if (words[i] === 'port') {
        const p = list(words, i + 1);
        if (!p) return 'syntax error';
        for (const v of p.values) {
          const n = /^\d+$/.test(v) ? Number(v) : SERVICES[v];
          if (n === undefined) return `unknown port ${v}`;
          r.ports.push(n);
        }
        i = p.next;
      }
    } else if (w === 'port') {
      return 'syntax error';
    } else if (w === 'keep' || w === 'modulate' || w === 'synproxy') {
      i += 2;
    } else if (w === 'flags') i += 2;
    else return 'syntax error';
  }
  if (r.ports.length && !r.proto) return 'port only applies to tcp/udp';
  r.text = show(r);
  return r;
}

/** A rule as pfctl -sr shows it (normalised). */
function show(r: PfRule): string {
  const p: string[] = [r.action];
  if (r.action === 'block') p.push(r.ret ? 'return' : 'drop');
  if (r.direction !== 'any') p.push(r.direction);
  if (r.quick) p.push('quick');
  if (r.proto) p.push('proto', r.proto);
  const side = (k: 'from' | 'to', v: string[]) => (v.length ? `${k} ${v.length > 1 ? `{ ${v.join(' ')} }` : v[0]}` : `${k} any`);
  if (!r.from.length && !r.to.length && !r.ports.length) p.push('all');
  else {
    p.push(side('from', r.from), side('to', r.to));
    if (r.ports.length) p.push(r.ports.length > 1 ? `port { ${r.ports.map((x) => `= ${x}`).join(' ')} }` : `port = ${r.ports[0]}`);
  }
  if (r.action === 'pass') p.push(r.proto === 'tcp' ? 'flags S/SA keep state' : 'keep state');
  return p.join(' ');
}

const covers = (v: string[], address: string) => !v.length || v.some((x) => (x.includes('/') ? inNetwork(address, x) : x === address));

/**
 * pf's verdict on an incoming TCP connection to `port` from `source`:
 * every rule is evaluated, the LAST one that matches decides — unless a
 * "quick" rule matches first. No rule: pass (pf's default).
 */
export function pfVerdict(p: PfState, port: number, source: string, proto: 'tcp' | 'udp' = 'tcp'): Verdict {
  if (!p.enabled) return 'accepted';
  let decided: PfRule | null = null;
  for (const r of p.rules) {
    if (r.direction === 'out') continue;
    if (r.proto && r.proto !== proto) continue;
    if (r.ports.length && !r.ports.includes(port)) continue;
    if (!covers(r.from, source)) continue;
    decided = r;
    if (r.quick) break;
  }
  if (!decided || decided.action === 'pass') return 'accepted';
  return decided.ret ? 'refused' : 'blocked';
}
