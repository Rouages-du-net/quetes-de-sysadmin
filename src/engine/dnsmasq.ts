// dnsmasq, the local network's DHCP server (https://dnsmasq.org/docs/dnsmasq-man.html).
// Configuration: /etc/dnsmasq.conf and the files of /etc/dnsmasq.d (like
// Debian's package: except hidden files and those ending in ~, .dpkg-dist,
// .dpkg-old, .dpkg-new). One option per line: interface, except-interface,
// no-dhcp-interface, dhcp-range, dhcp-host, dhcp-option…
// At each start, the devices asking for an address (DHCP) get one if
// dnsmasq listens on the router's interface for their VLAN and a range
// matches its network; a reservation (dhcp-host) comes first.
// Leases are written to /var/lib/misc/dnsmasq.leases, and the exchange to
// the journal (DHCPDISCOVER, DHCPOFFER, DHCPREQUEST, DHCPACK).
// Differences: no simulated DNS here (port, server… are accepted and
// ignored), leases are not renewed, an address is derived from the MAC address.

import type { Game } from './shell';
import { inside, isIp, vlanInterface, lan, networkFor, toIp, toCount } from './lan';
import { writeLog, systemd } from './systemd';

export const CONF = '/etc/dnsmasq.conf';
export const DIRECTORY = '/etc/dnsmasq.d';
export const LEASES = '/var/lib/misc/dnsmasq.leases';

interface Range {
  start: string;
  end: string;
  duration: string;
}

export interface ConfigDnsmasq {
  interfaces: string[];
  excluded: string[];
  ranges: Range[];
  reservations: { mac: string; name?: string; ip: string }[];
  errors: string[];
}

// The options the game knows (the others are refused, like a typo).
const KNOWN = new Set([
  'interface',
  'except-interface',
  'no-dhcp-interface',
  'listen-address',
  'bind-interfaces',
  'bind-dynamic',
  'dhcp-range',
  'dhcp-host',
  'dhcp-option',
  'dhcp-authoritative',
  'domain',
  'local',
  'port',
  'log-dhcp',
  'log-queries',
  'server',
  'no-resolv',
  'domain-needed',
  'bogus-priv',
  'expand-hosts',
  'dhcp-leasefile',
  'conf-dir',
  'conf-file',
  'cache-size',
  'dhcp-lease-max',
  'no-hosts',
  'addn-hosts',
]);

const duration = (t: string) => /^\d+[smhd]?$|^infinite$/.test(t);

/** dnsmasq's configuration, and its errors in dnsmasq's format. */
export function readDnsmasq(j: Game): ConfigDnsmasq {
  const c: ConfigDnsmasq = { interfaces: [], excluded: [], ranges: [], reservations: [], errors: [] };
  const read = new Set<string>();
  const readFile = (file: string) => {
    if (read.has(file)) return;
    read.add(file);
    const text = j.read(file);
    if (text === null) return;
    text.split('\n').forEach((rawValue, i) => {
      if (c.errors.length) return;
      const line = rawValue.replace(/#.*/, '').trim();
      if (!line) return;
      const [key, ...rest] = line.split('=');
      const name = key.trim();
      const value = rest.join('=').trim();
      const bad = (what: string) => c.errors.push(`dnsmasq: ${what} at line ${i + 1} of ${file}`);
      if (!KNOWN.has(name)) return bad('bad option');
      if (name === 'interface') c.interfaces.push(...value.split(','));
      else if (name === 'except-interface' || name === 'no-dhcp-interface') c.excluded.push(...value.split(','));
      else if (name === 'conf-dir') readDirectory(value.split(',')[0]);
      else if (name === 'conf-file') readFile(value);
      else if (name === 'dhcp-range') {
        // Before the addresses: tags (set:, tag:) or a name, which the game ignores.
        const fields = value.split(',').map((x) => x.trim());
        const k = fields.findIndex(isIp);
        const [start, end, ...next] = k >= 0 ? fields.slice(k) : [];
        if (!start || !end || !isIp(end)) return bad('bad dhcp-range');
        const mask = next.find(isIp);
        const d = next.find((x) => !isIp(x));
        if (d && !duration(d)) return bad('bad dhcp-range');
        if (mask && !isIp(mask)) return bad('bad dhcp-range');
        c.ranges.push({ start, end, duration: d ?? '1h' });
      } else if (name === 'dhcp-host') {
        const fields = value.split(',').map((x) => x.trim());
        const mac = fields.find((x) => /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(x));
        const ip = fields.find(isIp);
        if (!mac || !ip) return bad('bad dhcp-host');
        const hostName = fields.find((x) => x !== mac && x !== ip && !duration(x));
        c.reservations.push({ mac: mac.toLowerCase(), ip, ...(hostName ? { name: hostName } : {}) });
      }
    });
  };
  const readDirectory = (directory: string) => {
    const d = j.find(directory);
    if (d?.type !== 'directory') return;
    for (const n of Object.keys(d.children).sort())
      if (!n.startsWith('.') && !n.endsWith('~') && !/\.dpkg-(dist|old|new)$/.test(n)) readFile(`${directory}/${n}`);
  };
  readFile(CONF);
  // Debian : /etc/default/dnsmasq ajoute -7 /etc/dnsmasq.d.
  readDirectory(DIRECTORY);
  return c;
}

// An address of the range, derived from the MAC address (always the same for a device).
function addressIn(p: Range, mac: string, sockets: Set<string>): string | null {
  const start = toCount(p.start);
  const size = toCount(p.end) - start + 1;
  if (size <= 0) return null;
  let h = 0;
  for (const ch of mac) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  for (let k = 0; k < size; k++) {
    const ip = toIp(start + ((h + k) % size));
    if (!sockets.has(ip)) return ip;
  }
  return null;
}

/** When dnsmasq starts: each DHCP device asks for an address. */
export function startDnsmasq(j: Game) {
  const l = lan(j);
  const sd = systemd(j);
  if (!l || !sd) return;
  const c = readDnsmasq(j);
  const pid = 1450;
  const note = (m: string) => writeLog(sd, 'dnsmasq.service', 'dnsmasq-dhcp', pid, m);
  writeLog(sd, 'dnsmasq.service', 'dnsmasq', pid, 'started, version 2.90 cachesize 150');
  for (const p of c.ranges) note(`DHCP, IP range ${p.start} -- ${p.end}, lease time ${p.duration}`);
  const sockets = new Set<string>(c.reservations.map((r) => r.ip));
  const leases: string[] = [];
  const expiration = Math.floor(sd.clock / 1000) + 12 * 3600;
  for (const a of l.devices) {
    if (a.fixed) continue;
    delete a.lease;
    const i = vlanInterface(l, a.vlan);
    if (!i || !listening(c, i)) continue;
    const reseaux = i.addresses.map(networkFor);
    note(`DHCPDISCOVER(${i.name}) ${a.mac}`);
    const reserved = c.reservations.find((r) => r.mac === a.mac && reseaux.some((n) => inside(r.ip, n)));
    const range = c.ranges.find((p) => reseaux.some((n) => inside(p.start, n) && inside(p.end, n)));
    const ip = reserved?.ip ?? (range ? addressIn(range, a.mac, sockets) : null);
    if (!ip) {
      note(`DHCPDISCOVER(${i.name}) ${a.mac} no address range available for DHCP request via ${i.name}`);
      continue;
    }
    sockets.add(ip);
    a.lease = ip;
    const name = reserved?.name ?? a.name;
    note(`DHCPOFFER(${i.name}) ${ip} ${a.mac}`);
    note(`DHCPREQUEST(${i.name}) ${ip} ${a.mac}`);
    note(`DHCPACK(${i.name}) ${ip} ${a.mac} ${name}`);
    leases.push(`${expiration} ${a.mac} ${ip} ${name} *`);
  }
  const n = j.find(LEASES);
  if (n?.type === 'file') n.content = leases.join('\n');
}

// Does dnsmasq answer on this interface?
// An interface name, or a prefix followed by * (interface=eth1*: eth1, eth1.10…).
const correspond = (pattern: string, name: string) => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name);
const listening = (c: ConfigDnsmasq, i: { name: string }) =>
  (!c.interfaces.length || c.interfaces.some((m) => correspond(m, i.name))) && !c.excluded.some((m) => correspond(m, i.name));

/** The devices that received an address from dnsmasq, and the one they have. */
export const donnesLeases = (j: Game) => (lan(j)?.devices ?? []).filter((a) => a.lease).map((a) => ({ name: a.name, mac: a.mac, ip: a.lease! }));

/** Does dnsmasq listen (for DHCP) on the interface carrying this address? */
export function answersOn(j: Game, interfaceName: string): boolean {
  return listening(readDnsmasq(j), { name: interfaceName });
}
