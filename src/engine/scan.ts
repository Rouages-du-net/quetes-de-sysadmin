// Simulated nmap (https://nmap.org/book/man.html): the port scan of a
// network described by the story (state.scan), seen from the internet.
//   - the chapter declares the machines that can be probed (address, names,
//     services with their version) and the authorised scope (the addresses
//     in the engagement letter); an unknown address never answers;
//   - for the machine being played (`local`), each port's state comes from
//     the real model (ports.ts: who listens, ufw): a fix therefore changes
//     the result of the next scan; 127.0.0.1 sees it from the inside;
//   - -sV shows the services' versions; -oN keeps a record in a file;
//   - each scan is recorded in state.scans (the chapter reads there whether
//     the player went outside the scope).
// Differences: TCP only (no -sU), no -O, no scripts (-sC, -A) and no XML
// output; the 1000 most common ports come down to the declared services;
// the time is a computed duration, with no real wait.
// Source: https://nmap.org/book/man.html

import type { Game } from './shell';
import { portState } from './ports';
import type { Firewall } from './firewall';

export const VERSION_NMAP = '7.95';
// The scan's point of view: any address on the internet (RFC 5737).
const INTERNET = '198.51.100.23';

export interface ServiceScan {
  port: number;
  // The service's name, and its version as nmap -sV guesses it (a function: it follows the state, e.g. apt).
  service: string;
  product?: string | ((j: Game) => string);
  // TLS: nmap -sV writes "ssl/http".
  ssl?: boolean;
}

export interface ScanHost {
  address: string;
  // The first name is used for display ("fournil.internal (192.0.2.22)").
  names: string[];
  // The machine being played: its ports' state comes from the model, and 127.0.0.1 is itself.
  local?: boolean;
  services: ServiceScan[];
  // Displayed latency (seconds).
  latency?: number;
}

export interface ScanState {
  hosts: ScanHost[];
  // The addresses the engagement letter authorises probing.
  scope: string[];
}

export interface Scan {
  // The targeted addresses (the command, as typed), and whether one is outside the scope.
  command: string;
  addresses: string[];
  outsideScope: string[];
  versions: boolean;
  file?: string;
  // The hosts that answered, with their open ports.
  openSet: Record<string, number[]>;
  // What -sV read on each open port (the product and its version), by address.
  products: Record<string, string[]>;
}

export interface Options {
  versions: boolean;
  ping: boolean;
  withoutPing: boolean;
  numbers: boolean;
  onlyOpen: boolean;
  // null: the 1000 common ports; otherwise the list, or "all".
  ports: number[] | 'all' | 'fast' | null;
  file?: string;
}

// /etc/services, for the SERVICE column without -sV.
const NAMES: Record<number, string> = { 22: 'ssh', 25: 'smtp', 53: 'domain', 80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 3000: 'ppp', 3306: 'mysql', 5432: 'postgresql', 6379: 'redis', 8080: 'http-proxy' };
// The 100 most common ports that we recognise (-F).
const FAST = new Set([22, 25, 53, 80, 110, 143, 443, 3306, 8080]);

export const scanState = (game: Game): ScanState | undefined => game.state.scan;

const toCount = (a: string) => a.split('.').reduce((n, o) => n * 256 + Number(o), 0);
const toAddress = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
const validAddress = (a: string) => /^(\d{1,3})(\.\d{1,3}){3}$/.test(a) && a.split('.').every((o) => Number(o) <= 255);

/** A target's addresses: a name, an address, a network (192.0.2.0/29) or a range (192.0.2.20-25). null: cannot be resolved. */
export function expand(game: Game, target: string): { addresses: string[]; name?: string } | null {
  const e = scanState(game);
  const cidr = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(target);
  if (cidr && validAddress(cidr[1]) && Number(cidr[2]) >= 16 && Number(cidr[2]) <= 32) {
    const size = 2 ** (32 - Number(cidr[2]));
    const start = Math.floor(toCount(cidr[1]) / size) * size;
    return { addresses: Array.from({ length: size }, (_, i) => toAddress(start + i)) };
  }
  const range = /^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$/.exec(target);
  if (range && validAddress(`${range[1]}${range[2]}`) && Number(range[3]) <= 255 && Number(range[2]) <= Number(range[3]))
    return { addresses: Array.from({ length: Number(range[3]) - Number(range[2]) + 1 }, (_, i) => `${range[1]}${Number(range[2]) + i}`) };
  if (validAddress(target)) return { addresses: [target] };
  if (target === 'localhost') {
    const here = e?.hosts.find((h) => h.local);
    return here ? { addresses: ['127.0.0.1'], name: 'localhost' } : null;
  }
  const host = e?.hosts.find((h) => h.names.includes(target));
  return host ? { addresses: [host.address], name: target } : null;
}

type LineState = 'open' | 'closed' | 'filtered';

// The state of one of this host's ports, seen from the internet (or from the inside for 127.0.0.1).
function state(game: Game, h: ScanHost, port: number, inside: boolean): LineState {
  const declare = h.services.some((s) => s.port === port);
  if (!h.local) return declare ? 'open' : 'closed';
  const e = portState(game, port, inside, INTERNET);
  if (declare || e !== 'refused') return e === 'open' ? 'open' : e === 'filtered' ? 'filtered' : 'closed';
  // A port where nothing listens: closed, or silently dropped by the firewall.
  const pf: Firewall | undefined = game.state.ufw;
  return !inside && pf?.enabled && pf.incoming === 'deny' ? 'filtered' : 'closed';
}

const product = (game: Game, s: ServiceScan) => (typeof s.product === 'function' ? s.product(game) : (s.product ?? ''));
const hhmm = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const timeOfDay = (game: Game) => hhmm(game.state.systemd?.clock ?? Date.UTC(2028, 2, 14, 9, 30));
const decimals = (n: number, d = 2) => n.toFixed(d);

/** The ports to examine for this host: those it declares among those requested, and the scan's total number of ports. */
function portsExamines(h: ScanHost, o: Options): { ports: number[]; total: number } {
  const declares = h.services.map((s) => s.port);
  if (Array.isArray(o.ports)) return { ports: o.ports, total: o.ports.length };
  if (o.ports === 'all') return { ports: declares, total: 65535 };
  if (o.ports === 'fast') return { ports: declares.filter((p) => FAST.has(p)), total: 100 };
  return { ports: declares, total: 1000 };
}

function grid(game: Game, h: ScanHost, o: Options, inside: boolean): { lines: string[]; openSet: number[]; products: string[]; duration: number } {
  const { ports, total } = portsExamines(h, o);
  const unique = [...new Set(ports)].sort((a, b) => a - b);
  const states = unique.map((p) => [p, state(game, h, p, inside)] as const);
  // The ports not named: all in the machine's "default" state.
  const fallback = state(game, h, -1, inside) === 'open' ? 'closed' : state(game, h, -1, inside);
  const other = total - unique.length;
  const account: Record<LineState, number> = { open: 0, closed: 0, filtered: 0 };
  for (const [, e] of states) account[e]++;
  account[fallback] += other;
  // nmap groups the most common state if it covers more than 25 ports; open ports are always listed.
  const groups = (['closed', 'filtered'] as LineState[]).filter((e) => account[e] > 25).sort((a, b) => account[b] - account[a])[0];
  const visibles = states.filter(([, e]) => e === 'open' || (e !== groups && !o.onlyOpen));
  const openSet = states.filter(([, e]) => e === 'open').map(([p]) => p);
  const lines: string[] = [];
  const cache = groups ? account[groups] : 0;
  const stateName = (e: LineState) => (e === 'filtered' ? 'filtered' : e);
  if (!visibles.length && groups) lines.push(`All ${total} scanned ports on ${h.names[0] && !o.numbers ? `${h.names[0]} (${h.address})` : h.address} are in ignored states.`);
  if (groups) lines.push(`Not shown: ${cache} ${groups} tcp ports (${groups === 'filtered' ? 'no-response' : 'reset'})`);
  if (visibles.length) {
    const portsLines = visibles.map(([p, e]) => {
      const s = h.services.find((x) => x.port === p);
      const service = o.versions && s ? `${s.ssl ? 'ssl/' : ''}${s.service}` : e === 'open' && s && !o.versions ? (NAMES[p] ?? s.service) : (NAMES[p] ?? 'unknown');
      const version = o.versions && s && e === 'open' ? product(game, s) : '';
      return [`${p}/tcp`, stateName(e), service, version];
    });
    const widths = [4, 5, 7].map((min, i) => Math.max(min, ...portsLines.map((l) => l[i].length)));
    const line = (l: string[]) => `${l[0].padEnd(widths[0])} ${l[1].padEnd(widths[1])} ${l[2].padEnd(widths[2])}${o.versions ? ` ${l[3]}` : ''}`.trimEnd();
    lines.push(line(['PORT', 'STATE', 'SERVICE', 'VERSION']));
    for (const l of portsLines) lines.push(line(l));
    if (o.versions && openSet.some((p) => /^OpenSSH/.test(product(game, h.services.find((s) => s.port === p)!)))) lines.push('Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel');
  }
  // The duration: filtered ports make it wait, and so does version detection.
  const duration = 0.9 + account.closed * 0.0004 + account.filtered * 0.0052 + (o.versions ? openSet.length * 2.4 : 0) + total * 0.00002;
  const products = openSet.map((p) => h.services.find((s) => s.port === p)).filter((s) => !!s).map((s) => product(game, s!));
  return { lines, openSet, products, duration };
}

export function scan(game: Game, targets: string[], o: Options, command: string): { output: string; file: string } | { error: string } {
  const e = scanState(game);
  const addresses: string[] = [];
  const failures: string[] = [];
  const names = new Map<string, string>();
  for (const c of targets) {
    const r = expand(game, c);
    if (!r) {
      failures.push(`Failed to resolve "${c}".`);
      continue;
    }
    for (const a of r.addresses) {
      addresses.push(a);
      if (r.name) names.set(a, r.name);
    }
  }
  const outsideScope = [...new Set(addresses)].filter((a) => a !== '127.0.0.1' && !e?.scope.includes(a));
  const report: string[] = [];
  const file: string[] = [];
  let live = 0;
  let duration = 0.3;
  const openSet: Record<string, number[]> = {};
  const products: Record<string, string[]> = {};
  for (const a of [...new Set(addresses)]) {
    const inside = a === '127.0.0.1';
    const h = e?.hosts.find((x) => x.address === a || (inside && x.local));
    const alive = !!h || o.withoutPing;
    if (!alive) {
      if (targets.length === 1 && addresses.length === 1) report.push('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn');
      duration += addresses.length === 1 ? 3 : 0.2;
      continue;
    }
    live++;
    const name = names.get(a) ?? h?.names[0];
    const title = inside ? `localhost (127.0.0.1)` : name && !o.numbers ? `${name} (${a})` : a;
    const header = [`Nmap scan report for ${title}`];
    if (h) header.push(`Host is up (${decimals(h.latency ?? (inside ? 0.00012 : 0.011), inside ? 5 : 3)}s latency).`);
    else header.push('Host is up.');
    if (o.ping) {
      report.push(...header, '');
      file.push(...header, '');
      duration += 0.02;
      continue;
    }
    const host: ScanHost = h ?? { address: a, names: [], services: [] };
    // A host reached through 127.0.0.1 is shown under that name.
    const t = grid(game, host, o, inside);
    openSet[a] = t.openSet;
    if (o.versions) products[a] = t.products;
    duration += t.duration;
    const block = [...header, ...t.lines, ''];
    report.push(...block);
    file.push(...block);
  }
  const total = new Set(addresses).size;
  const duration2 = Math.max(0.02, duration);
  const pied = `Nmap done: ${total} IP address${total === 1 ? '' : 'es'} (${live} host${live === 1 ? '' : 's'} up) scanned in ${decimals(duration2)} seconds`;
  if (!total) failures.push('WARNING: No targets were specified, so 0 hosts scanned.');
  const clock = timeOfDay(game);
  const detection = o.versions && !o.ping && live ? ['Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .'] : [];
  const output = [`Starting Nmap ${VERSION_NMAP} ( https://nmap.org ) at ${clock} CET`, ...failures, ...report, ...detection, pied]
    .join('\n');
  const readable = (ms: number) => new Date(ms).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) (\d+:\d+:\d+) GMT$/, '$1 $3 $2 $5 $4');
  const t0 = game.state.systemd?.clock ?? Date.UTC(2028, 2, 14, 9, 30);
  const content = [
    `# Nmap ${VERSION_NMAP} scan initiated ${readable(t0)} as: ${command}`,
    ...file,
    ...detection,
    `# Nmap done at ${readable(t0 + Math.round(duration2) * 1000)} -- ${total} IP address${total === 1 ? '' : 'es'} (${live} host${live === 1 ? '' : 's'} up) scanned in ${decimals(duration2)} seconds`,
  ]
    .join('\n');
  // Time passes: the machine's clock moves on by the scan's duration.
  if (game.state.systemd) game.state.systemd.clock += Math.round(duration2) * 1000;
  const listing: Scan[] = (game.state.scans ??= []);
  listing.push({ command, addresses: [...new Set(addresses)], outsideScope, versions: o.versions, file: o.file, openSet, products });
  return { output, file: content };
}

