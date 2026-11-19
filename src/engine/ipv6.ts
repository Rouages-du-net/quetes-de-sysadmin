// IPv6 on a machine's network (state.lan, see lan.ts), and what the world
// outside sees of it over both address families.
//   - addresses: parsing, the canonical text form (RFC 5952: lower case,
//     leading zeros dropped, the longest run of zero groups as "::"),
//     prefixes;
//   - an interface's IPv6 addresses: its link-local fe80::/64 address and,
//     if the link has a router that advertises a prefix (Lan.ra) and the
//     kernel accepts router advertisements (accept_ra) and autoconfigures
//     (autoconf), a SLAAC address made from the prefix and the interface
//     identifier: modified EUI-64, the MAC address with ff:fe in the middle
//     and the universal/local bit flipped (RFC 4291, appendix A; the
//     kernel's default, addr_gen_mode 0); plus the addresses given by hand
//     (ip -6 addr add) or by ifupdown (iface … inet6 static). The kernel's
//     settings are read from /proc/sys/net/ipv6/conf/<interface>/ (a
//     directory of the world, changed with sysctl): disable_ipv6 removes
//     every address, and the static ones do not come back when IPv6 is
//     enabled again;
//   - the IPv6 default route: the router's link-local address, learnt from
//     its advertisements (proto ra), or a gateway given by hand;
//   - from outside (a "vantage" machine on the internet, state.vantage):
//     resolving a name through the story's DNS, then a TCP connection or
//     a ping to the machine: does it own the address, does its firewall
//     let neighbour discovery (ICMPv6) through, then the packet itself
//     (nftables tables ip, ip6, inet; ufw and its IPV6 setting), then who
//     listens (a socket on 0.0.0.0 is IPv4 only, on [::] IPv6 only, on *
//     both: an IPv6 socket without IPV6_V6ONLY also accepts IPv4 through
//     mapped addresses).
// Sources: https://www.rfc-editor.org/rfc/rfc4291, https://www.rfc-editor.org/rfc/rfc4862,
// https://www.rfc-editor.org/rfc/rfc5952, https://www.rfc-editor.org/rfc/rfc4890,
// https://docs.kernel.org/networking/ip-sysctl.html (accept_ra, autoconf, disable_ipv6, bindv6only),
// https://man7.org/linux/man-pages/man7/ipv6.7.html (IPV6_V6ONLY).
// Differences: no duplicate address detection, no privacy (temporary)
// addresses and no stable-privacy identifiers; a SLAAC address appears
// and disappears at once with the settings (on a real machine, it lives
// until its lifetime runs out); lifetimes are shown, they don't count down.

import type { Game, Shell } from './shell';
import type { Interface, Lan } from './lan';
import { inService, lan, networkToBoot, readInterfaces } from './lan';
import { sysctlToBoot } from './commands/nftables';
import { nft, traverse, type Package, type Ruleset } from './nftables';
import { verdict as ufwVerdict, type Firewall } from './firewall';
import { dns, query } from './dns';
import { systemd } from './systemd';
import type { Listening } from './commands/ss';

export type Family = 4 | 6;

// ——— Addresses ———

/** An IPv6 address as a 128-bit number; null if the text is not one (no zone, no prefix length). */
export function parse6(text: string): bigint | null {
  let s = text.toLowerCase();
  if (!/^[0-9a-f:.]+$/.test(s) || !s.includes(':')) return null;
  // An embedded IPv4 address at the end (::ffff:192.0.2.1).
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    if (v4.slice(1).some((o) => Number(o) > 255)) return null;
    const [a, b, c, d] = v4.slice(1).map(Number);
    s = s.slice(0, v4.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const groups = (h: string) => (h === '' ? [] : h.split(':'));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  if ([...head, ...tail].some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  return all.reduce((n, g) => (n << 16n) | BigInt(parseInt(g, 16)), 0n);
}

/** The canonical text form (RFC 5952). */
export function format6(n: bigint): string {
  const groups = Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(112 - 16 * i)) & 0xffffn));
  // The longest run of at least two zero groups (the first one if equal).
  let best = -1;
  let length = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > length && j - i >= 2) [best, length] = [i, j - i];
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best < 0) return hex.join(':');
  return `${hex.slice(0, best).join(':')}::${hex.slice(best + length).join(':')}`;
}

export const isIp6 = (s: string) => parse6(s) !== null;
/** The canonical form of an address, or null. */
export const normalise6 = (s: string) => {
  const n = parse6(s);
  return n === null ? null : format6(n);
};

/** "2001:db8::1/64" → address (canonical), length, and the network's number; null if wrong. */
export function cidr6(text: string): { ip: string; length: number; network: bigint } | null {
  const [a, l] = text.split('/');
  const n = parse6(a);
  const length = l === undefined ? 128 : Number(l);
  if (n === null || !/^\d+$/.test(l ?? '128') || length > 128) return null;
  return { ip: format6(n), length, network: n & mask6(length) };
}

const mask6 = (length: number) => (length === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - length)) - 1n));

/** Is this address in this prefix ("2001:db8:4e1:20::/64"), or equal to it (no length)? */
export function inPrefix6(address: string, prefix: string): boolean {
  const n = parse6(address.split('%')[0]);
  const p = cidr6(prefix);
  if (n === null || !p) return false;
  return (n & mask6(p.length)) === p.network;
}

/** The network of a CIDR address (2001:db8::80/64 → 2001:db8::/64). */
export const network6 = (address: string) => {
  const c = cidr6(address)!;
  return `${format6(c.network)}/${c.length}`;
};

export const isLinkLocal = (address: string) => inPrefix6(address, 'fe80::/10');

/** The modified EUI-64 interface identifier of a MAC address (RFC 4291, appendix A), as a number. */
export function eui64(mac: string): bigint {
  const b = mac.split(':').map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  const bytes = [b[0], b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]];
  return bytes.reduce((n, x) => (n << 8n) | BigInt(x), 0n);
}

/** fe80::/64 and the interface identifier. */
export const linkLocalFor = (mac: string) => format6((0xfe80n << 112n) | eui64(mac));
/** A SLAAC address: the advertised /64 prefix and the interface identifier. */
export const slaacFor = (prefix: string, mac: string) => format6(cidr6(prefix)!.network | eui64(mac));

// ——— An interface's IPv6 ———

/** What a router advertises on the link (RFC 4861): its prefix, its link-local address, its MAC. */
export interface RouterAdvert {
  dev: string;
  prefix: string;
  router: string;
  mac: string;
  // The router's global address in the prefix (it sends the "Address unreachable" errors).
  global: string;
}

export interface Address6 {
  // CIDR, canonical.
  cidr: string;
  scope: 'global' | 'link' | 'host';
  // Learnt from a router advertisement (SLAAC): "dynamic", with lifetimes.
  dynamic: boolean;
}

const PROC = '/proc/sys/net/ipv6/conf';
// The kernel's defaults (https://docs.kernel.org/networking/ip-sysctl.html).
const DEFAULTS: Record<string, string> = { accept_ra: '1', autoconf: '1', disable_ipv6: '0', forwarding: '0' };

/** A setting of /proc/sys/net/ipv6/conf/<interface>/ (the kernel's default if the file doesn't exist). */
export function setting6(j: Game, dev: string, key: string): string {
  return (j.read(`${PROC}/${dev}/${key}`) ?? DEFAULTS[key] ?? '0').trim();
}

/** Writes a setting (ifupdown does this when it brings an interface up). */
export function write6(j: Game, dev: string, key: string, value: string) {
  const n = j.find(`${PROC}/${dev}/${key}`);
  if (n?.type === 'file') n.content = value;
}

/** Is IPv6 off on this interface (disable_ipv6 on it, or on "all")? */
export const disabled6 = (j: Game, dev: string) => setting6(j, 'all', 'disable_ipv6') === '1' || setting6(j, dev, 'disable_ipv6') === '1';

/** Does the kernel accept the router's advertisements on this interface (accept_ra 1 without forwarding, or 2)? */
export function acceptsRa(j: Game, dev: string): boolean {
  const a = setting6(j, dev, 'accept_ra');
  const forwarding = setting6(j, dev, 'forwarding') === '1' || setting6(j, 'all', 'forwarding') === '1';
  return a === '2' || (a === '1' && !forwarding);
}

/** Forget the static addresses of the interfaces where IPv6 was turned off (the kernel removes them). */
export function sync6(j: Game) {
  const l = lan(j);
  if (!l?.ra) return;
  for (const i of Object.values(l.interfaces))
    if (i.name !== 'lo' && disabled6(j, i.name)) {
      i.addresses6 = [];
      if (l.gateway6?.dev === i.name) l.gateway6 = null;
    }
}

/** An interface's IPv6 addresses, as ip -6 addr shows them (the static ones first, then SLAAC, then link-local). */
export function addresses6(j: Game, l: Lan, i: Interface): Address6[] {
  if (!l.ra) return [];
  if (i.name === 'lo') return disabled6(j, 'lo') ? [] : [{ cidr: '::1/128', scope: 'host', dynamic: false }];
  if (disabled6(j, i.name) || !i.up) return [];
  const out: Address6[] = (i.addresses6 ?? []).map((a) => ({ cidr: a, scope: isLinkLocal(a) ? 'link' : 'global', dynamic: false }));
  const ra = l.ra;
  if (ra.dev === i.name && inService(l, i) && acceptsRa(j, i.name) && setting6(j, i.name, 'autoconf') === '1') {
    const a = `${slaacFor(ra.prefix, i.mac)}/64`;
    if (!out.some((x) => x.cidr === a)) out.push({ cidr: a, scope: 'global', dynamic: true });
  }
  out.push({ cidr: `${linkLocalFor(i.mac)}/64`, scope: 'link', dynamic: false });
  return out;
}

/** Every address of the machine, in one family (without prefix length). */
export function ownAddresses(j: Game, family: Family): string[] {
  const l = lan(j);
  if (!l) return [];
  if (family === 4) return Object.values(l.interfaces).flatMap((i) => (inService(l, i) || i.name === 'lo' ? i.addresses.map((a) => a.split('/')[0]) : []));
  return Object.values(l.interfaces).flatMap((i) => addresses6(j, l, i).map((a) => a.cidr.split('/')[0]));
}

/** The IPv6 default route: a gateway given by hand (or by ifupdown), otherwise the advertising router. */
export function defaultRoute6(j: Game, l: Lan): { via: string; dev: string; proto: 'ra' | 'static' } | null {
  const up = (dev: string) => !!l.interfaces[dev] && inService(l, l.interfaces[dev]) && !disabled6(j, dev);
  if (l.gateway6 && up(l.gateway6.dev)) return { ...l.gateway6, proto: 'static' };
  if (l.ra && up(l.ra.dev) && acceptsRa(j, l.ra.dev)) return { via: l.ra.router, dev: l.ra.dev, proto: 'ra' };
  return null;
}

/** ip -6 route: the prefixes on the links, link-local, loopback, then the default route. */
export function routes6(j: Game, l: Lan): string[] {
  const lines: string[] = [];
  if (!disabled6(j, 'lo') && l.interfaces.lo) lines.push('::1 dev lo proto kernel metric 256 pref medium');
  for (const name of l.order) {
    const i = l.interfaces[name];
    if (!i || name === 'lo') continue;
    const all = addresses6(j, l, i);
    const seen = new Set<string>();
    for (const a of all.filter((x) => x.scope === 'global')) {
      const n = network6(a.cidr);
      if (seen.has(n) || a.cidr.endsWith('/128')) continue;
      seen.add(n);
      lines.push(a.dynamic && !all.some((x) => !x.dynamic && x.scope === 'global' && network6(x.cidr) === n) ? `${n} dev ${name} proto ra metric 256 expires 86391sec pref medium` : `${n} dev ${name} proto kernel metric 256 pref medium`);
    }
    if (all.some((x) => x.scope === 'link')) lines.push(`fe80::/64 dev ${name} proto kernel metric 256 pref medium`);
  }
  const d = defaultRoute6(j, l);
  if (d)
    lines.push(
      d.proto === 'ra'
        ? `default via ${d.via} dev ${d.dev} proto ra metric 1024 expires 1791sec hoplimit 64 pref medium`
        : `default via ${d.via} dev ${d.dev} metric 1024 onlink pref medium`,
    );
  return lines;
}

/** IPv6 as the next boot would bring it up (the interfaces file, the sysctl files): eth0's global addresses and whether a default route exists. */
export function boot6(j: Game): { addresses: string[]; route: boolean } {
  const l = lan(j);
  const copy = networkToBoot(j);
  if (!l?.ra || !copy) return { addresses: [], route: false };
  const dev = l.ra.dev;
  const i = copy.interfaces[dev];
  const atBoot = (key: string) => sysctlToBoot(j, `net.ipv6.conf.${dev}.${key}`, sysctlToBoot(j, `net.ipv6.conf.default.${key}`, DEFAULTS[key]));
  const off = sysctlToBoot(j, 'net.ipv6.conf.all.disable_ipv6', '0') === '1' || atBoot('disable_ipv6') === '1';
  if (!i?.up || off) return { addresses: [], route: false };
  const v6 = readInterfaces(j).stanzas[dev]?.v6;
  const acceptRa = v6?.acceptRa ?? (v6?.method === 'auto' ? '2' : atBoot('accept_ra'));
  const autoconf = v6?.method === 'static' ? (v6.autoconf ?? '0') : v6?.method === 'auto' ? '1' : atBoot('autoconf');
  const forwarding = atBoot('forwarding') === '1' || sysctlToBoot(j, 'net.ipv6.conf.all.forwarding', '0') === '1';
  const ra = acceptRa === '2' || (acceptRa === '1' && !forwarding);
  const addresses = (i.addresses6 ?? []).filter((a) => !isLinkLocal(a)).map((a) => a.split('/')[0]);
  if (ra && autoconf === '1') addresses.push(slaacFor(l.ra.prefix, i.mac));
  return { addresses, route: !!copy.gateway6 || ra };
}

// ——— Names ———

/** The addresses /etc/hosts gives a name, in one family. */
export function fromHosts(j: Game, name: string, family: Family): string[] {
  const out: string[] = [];
  for (const line of (j.read('/etc/hosts') ?? '').split('\n')) {
    const [ip, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (!ip || !names.includes(name)) continue;
    if (family === 6 ? isIp6(ip) : /^\d+\.\d+\.\d+\.\d+$/.test(ip)) out.push(family === 6 ? normalise6(ip)! : ip);
  }
  return out;
}

/** The story's DNS, seen from this machine: its own server (named), or, from outside, the zone's public servers. */
function fromDns(j: Game, name: string, family: Family): string[] {
  const p = (j as Shell).principal ?? (j as Shell);
  const d = dns(p);
  if (!d) return [];
  const own = dns(j) && systemd(j)?.services.named?.state === 'active';
  const r = query(p, own ? 'primary' : 'secondary', name, family === 6 ? 'AAAA' : 'A', 0);
  return r.responses.filter((x) => x.type === (family === 6 ? 'AAAA' : 'A')).map((x) => (family === 6 ? (normalise6(x.data) ?? x.data) : x.data));
}

/** A name's addresses in one family, as getaddrinfo would give them: a literal, /etc/hosts, then the DNS. */
export function resolve(j: Game, host: string, family: Family): string[] {
  const bare = host.replace(/^\[|\]$/g, '').split('%')[0];
  if (family === 6 && isIp6(bare)) return [normalise6(bare)!];
  if (family === 4 && /^\d+\.\d+\.\d+\.\d+$/.test(bare)) return [bare];
  if (isIp6(bare) || /^\d+\.\d+\.\d+\.\d+$/.test(bare)) return [];
  const local = fromHosts(j, bare, family);
  if (local.length) return local;
  return fromDns(j, bare.replace(/\.$/, ''), family);
}

// ——— From outside: who answers ———

/** A machine on the internet that looks at the story's server (state.vantage): its addresses. */
export interface Vantage {
  v4: string;
  v6: string;
}

export const vantage = (j: Game) => j.state.vantage as Vantage | undefined;

/** The machine of the story that owns this address (the main one), or null. */
export function machineAt(j: Game, address: string, family: Family): Shell | null {
  const p = (j as Shell).principal ?? (j as Shell);
  sync6(p);
  const a = family === 6 ? normalise6(address) : address;
  return a && ownAddresses(p, family).includes(a) && !(family === 6 && a === '::1') && !(family === 4 && a.startsWith('127.')) ? p : null;
}

/** The router of the main machine's link (its global IPv6 address answers ping). */
export function routerOf(j: Game): RouterAdvert | null {
  const p = (j as Shell).principal ?? (j as Shell);
  return lan(p)?.ra ?? null;
}

/** The firewall's verdict on an incoming packet: nftables (if loaded), then ufw. */
export function inputVerdict(target: Game, p: Package, r: Ruleset = nft(target)): 'accept' | 'drop' | 'reject' {
  if (r.tables.length) {
    const t = traverse(r, 'input', 'filter', p);
    if (!t.pass) return t.rejected ? 'reject' : 'drop';
  }
  const pf = target.state.ufw as Firewall | undefined;
  if (pf && p.proto === 'tcp') {
    const v = ufwVerdict(pf, p.dport, p.saddr);
    if (v === 'blocked') return 'drop';
    if (v === 'refused') return 'reject';
  }
  return 'accept';
}

/** Neighbour discovery: the router asks who has the address (an ICMPv6 neighbour solicitation): does the firewall let it in? */
export function neighbourDiscovery(target: Game, r: Ruleset = nft(target)): boolean {
  const ra = lan(target)?.ra;
  if (!ra) return true;
  const p: Package = { family: 'ip6', iif: ra.dev, oif: '', saddr: ra.router, daddr: 'ff02::1:ff00:0', proto: 'icmpv6', icmpType: 'nd-neighbor-solicit', sport: 0, dport: 0, ct: 'new', size: 72 };
  return inputVerdict(target, p, r) === 'accept';
}

/** Does a socket of the machine listen for this family and address on this TCP port? */
export function listens(target: Game, family: Family, address: string, port: number): boolean {
  const all = (target.state.listening ?? []) as Listening[];
  const bindv6only = (target.read('/proc/sys/net/ipv6/bindv6only') ?? '0').trim() === '1';
  return all.some((e) => {
    if (e.proto !== 'tcp' || e.port !== port) return false;
    const a = e.address.replace(/^\[|\]$/g, '');
    if (a === '*') return true;
    if (family === 4) return a === '0.0.0.0' || a === address || (a === '::' && e.v6only === false && !bindv6only);
    return a === '::' ? true : normalise6(a) === address;
  });
}

export type TcpState = 'open' | 'refused' | 'filtered' | 'unreachable';

/** A TCP connection from outside (saddr) to the machine's address: open, refused, filtered (dropped), unreachable. */
export function tcpState(target: Game, family: Family, saddr: string, daddr: string, port: number, r: Ruleset = nft(target)): TcpState {
  if (family === 6 && !neighbourDiscovery(target, r)) return 'unreachable';
  const dev = lan(target)?.ra?.dev ?? 'eth0';
  const p: Package = { family: family === 6 ? 'ip6' : 'ip', iif: dev, oif: '', saddr, daddr, proto: 'tcp', sport: 43120, dport: port, ct: 'new', size: 60 };
  const v = inputVerdict(target, p, r);
  if (v === 'drop') return 'filtered';
  if (v === 'reject') return 'refused';
  return listens(target, family, daddr, port) ? 'open' : 'refused';
}

/** A ping from outside: does the echo request get an answer? */
export function echoState(target: Game, family: Family, saddr: string, daddr: string): 'reply' | 'filtered' | 'unreachable' {
  if (family === 6 && !neighbourDiscovery(target)) return 'unreachable';
  const dev = lan(target)?.ra?.dev ?? 'eth0';
  const p: Package = {
    family: family === 6 ? 'ip6' : 'ip',
    iif: dev,
    oif: '',
    saddr,
    daddr,
    proto: family === 6 ? 'icmpv6' : 'icmp',
    icmpType: 'echo-request',
    sport: 0,
    dport: 0,
    ct: 'new',
    size: 64,
  };
  return inputVerdict(target, p) === 'accept' ? 'reply' : 'filtered';
}

/** The ISP's router answers for its link: an address of the prefix nobody owns gets "Address unreachable". */
export function unreachableFrom(j: Game, address: string): string | null {
  const ra = routerOf(j);
  return ra && inPrefix6(address, ra.prefix) ? ra.global : null;
}
