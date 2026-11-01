// dnsmasq, le serveur DHCP du réseau local (https://dnsmasq.org/docs/dnsmasq-man.html).
// Configuration : /etc/dnsmasq.conf et les fichiers de /etc/dnsmasq.d (comme
// le paquet Debian : sauf les fichiers cachés, finissant par ~, .dpkg-dist,
// .dpkg-old, .dpkg-new). Une option par ligne : interface, except-interface,
// no-dhcp-interface, dhcp-range, dhcp-host, dhcp-option…
// À chaque démarrage, les appareils qui demandent une adresse (DHCP) la
// reçoivent si dnsmasq écoute l'interface du routeur de leur VLAN et qu'une
// plage correspond à son réseau ; une réservation (dhcp-host) passe avant.
// Les baux sont écrits dans /var/lib/misc/dnsmasq.leases, et l'échange dans
// le journal (DHCPDISCOVER, DHCPOFFER, DHCPREQUEST, DHCPACK).
// Écarts : pas de DNS simulé ici (port, server… sont acceptés et ignorés),
// les baux ne se renouvellent pas, une adresse est tirée de l'adresse MAC.

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

// Les options que le jeu connaît (les autres sont refusées, comme une faute de frappe).
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

/** La configuration de dnsmasq, et ses erreurs au format de dnsmasq. */
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
        // Devant les adresses : des étiquettes (set:, tag:) ou un nom, que le jeu ignore.
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

// Une adresse de la plage, tirée de l'adresse MAC (toujours la même pour un appareil).
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

/** Au démarrage de dnsmasq : chaque appareil en DHCP demande une adresse. */
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

// dnsmasq répond-il sur cette interface ?
// Un nom d'interface, ou un préfixe suivi de * (interface=eth1* : eth1, eth1.10…).
const correspond = (pattern: string, name: string) => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name);
const listening = (c: ConfigDnsmasq, i: { name: string }) =>
  (!c.interfaces.length || c.interfaces.some((m) => correspond(m, i.name))) && !c.excluded.some((m) => correspond(m, i.name));

/** Les appareils qui ont reçu une adresse de dnsmasq, et celle qu'ils ont. */
export const donnesLeases = (j: Game) => (lan(j)?.devices ?? []).filter((a) => a.lease).map((a) => ({ name: a.name, mac: a.mac, ip: a.lease! }));

/** dnsmasq écoute-t-il (en DHCP) l'interface qui porte cette adresse ? */
export function answersOn(j: Game, interfaceName: string): boolean {
  return listening(readDnsmasq(j), { name: interfaceName });
}
