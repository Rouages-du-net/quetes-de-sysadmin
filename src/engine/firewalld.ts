// firewalld 2.4.3 (Rocky Linux 10.3) on a machine (state.firewalld, see
// rhel.ts): zones with their services, ports and rich rules, in two
// configurations, as firewalld keeps them:
//   - runtime: what filters now (firewall-cmd without --permanent);
//   - permanent: /etc/firewalld/zones/*.xml, read again by --reload and at
//     each start (a runtime change is lost then).
// The decision for an incoming TCP connection (`verdict`): the zone of its
// source (a zone's sources) or of the interface, then the zone's rich rules,
// services and ports; anything else is rejected (the zone's default target:
// icmp-host-prohibited, so the client fails at once). Loopback is always
// accepted. firewalld stopped: nothing filters (Rocky has no other
// firewall).
// Sources: firewalld's src/firewall/command.py, firewall-cmd.in,
// core/rich.py, core/fw_policy.py, server/config_zone.py and config/ at tag
// v2.4.3 (Rocky's firewalld-2.4.3-4.el10_2 src.rpm, with Red Hat's patch
// adding cockpit to the public zone); https://firewalld.org/documentation/
// Simplified (see docs/SCENARIOS.md): IPv4 TCP only, the zones the story
// uses, a few services, rich rules with a source address, a service or a
// port, and accept, reject or drop.

import type { Game } from './shell';
import { systemd } from './systemd';

export interface Zone {
  target: string;
  interfaces: string[];
  sources: string[];
  services: string[];
  ports: string[];
  richRules: string[];
}
export interface FirewalldState {
  defaultZone: string;
  runtime: Record<string, Zone>;
  permanent: Record<string, Zone>;
  // Each --reload (or start): what the runtime had that permanent didn't (for the story's hints).
  lost: string[];
}

export const VERSION = '2.4.3';

// The services firewalld knows (config/services/*.xml), a subset: name → ports.
export const SERVICES: Record<string, string[]> = {
  cockpit: ['9090/tcp'],
  'dhcpv6-client': ['546/udp'],
  dns: ['53/tcp', '53/udp'],
  ftp: ['21/tcp'],
  http: ['80/tcp'],
  http3: ['443/udp'],
  https: ['443/tcp'],
  imap: ['143/tcp'],
  imaps: ['993/tcp'],
  mdns: ['5353/udp'],
  mysql: ['3306/tcp'],
  nfs: ['2049/tcp'],
  ntp: ['123/udp'],
  postgresql: ['5432/tcp'],
  samba: ['139/tcp', '445/tcp'],
  smtp: ['25/tcp'],
  ssh: ['22/tcp'],
};
export const ZONES = ['block', 'dmz', 'drop', 'external', 'home', 'internal', 'public', 'trusted', 'work'];

const zone = (services: string[], interfaces: string[] = []): Zone => ({ target: 'default', interfaces, sources: [], services, ports: [], richRules: [] });
const copy = (z: Record<string, Zone>): Record<string, Zone> => JSON.parse(JSON.stringify(z));

/** A fresh Rocky install: public (cockpit, dhcpv6-client, ssh) on the machine's interface. */
export function newFirewalld(iface: string): FirewalldState {
  const permanent: Record<string, Zone> = {
    block: { ...zone([]), target: '%%REJECT%%' },
    dmz: zone(['ssh']),
    drop: { ...zone([]), target: 'DROP' },
    external: zone(['ssh']),
    home: zone(['cockpit', 'dhcpv6-client', 'mdns', 'samba-client', 'ssh']),
    internal: zone(['cockpit', 'dhcpv6-client', 'mdns', 'samba-client', 'ssh']),
    public: zone(['cockpit', 'dhcpv6-client', 'ssh']),
    trusted: { ...zone([]), target: 'ACCEPT' },
    work: zone(['cockpit', 'dhcpv6-client', 'ssh']),
  };
  const runtime = copy(permanent);
  runtime.public.interfaces = [iface];
  return { defaultZone: 'public', runtime, permanent, lost: [] };
}

export const firewalld = (game: Game): FirewalldState | undefined => game.state.firewalld as FirewalldState | undefined;
export const running = (game: Game) => systemd(game)?.services.firewalld?.state === 'active';

/** --reload (and a start): the runtime becomes the permanent configuration, the interfaces kept. */
export function reloadFirewall(game: Game): void {
  const fw = firewalld(game);
  if (!fw) return;
  const interfaces = Object.fromEntries(Object.entries(fw.runtime).map(([k, z]) => [k, z.interfaces]));
  const lost: string[] = [];
  for (const [name, z] of Object.entries(fw.runtime)) {
    const p = fw.permanent[name];
    for (const s of z.services) if (!p?.services.includes(s)) lost.push(s);
    for (const s of z.ports) if (!p?.ports.includes(s)) lost.push(s);
    for (const s of z.richRules) if (!p?.richRules.includes(s)) lost.push(s);
  }
  fw.lost.push(...lost);
  fw.runtime = copy(fw.permanent);
  for (const [k, ifs] of Object.entries(interfaces)) if (fw.runtime[k]) fw.runtime[k].interfaces = ifs;
}

// ——— Rich rules ———

export interface RichRule {
  family?: string;
  source?: string;
  invert?: boolean;
  service?: string;
  port?: { port: string; protocol: string };
  action?: 'accept' | 'reject' | 'drop';
}

/** Parses a rich rule like firewalld's Rich_Rule (the elements the game knows); throws "CODE: message". */
export function parseRich(text: string): RichRule {
  const tokens: string[] = [];
  const re = /(\w[\w-]*)(?:="([^"]*)"|='([^']*)'|=(\S+))?/g;
  let m: RegExpExecArray | null;
  if (!text.trim()) throw new Error('INVALID_RULE: empty rule');
  while ((m = re.exec(text))) tokens.push(m[2] !== undefined || m[3] !== undefined || m[4] !== undefined ? `${m[1]}=${m[2] ?? m[3] ?? m[4]}` : m[1]);
  if (tokens[0] !== 'rule') throw new Error(`INVALID_RULE: rule '${tokens[0] ?? ''}' is not a rich rule`);
  const r: RichRule = {};
  let element = '';
  for (const tok of tokens.slice(1)) {
    const [k, v] = tok.split(/=(.*)/s);
    if (v === undefined) {
      if (['source', 'service', 'port', 'destination'].includes(k)) element = k;
      else if (['accept', 'reject', 'drop'].includes(k)) r.action = k as RichRule['action'];
      else if (k === 'NOT' && element === 'source') r.invert = true;
      else throw new Error(`INVALID_RULE: unknown element ${k}`);
      continue;
    }
    if (k === 'family' && !element) r.family = v;
    else if (element === 'source' && k === 'address') r.source = v;
    else if (element === 'service' && k === 'name') r.service = v;
    else if (element === 'port' && k === 'port') r.port = { port: v, protocol: r.port?.protocol ?? '' };
    else if (element === 'port' && k === 'protocol') r.port = { port: r.port?.port ?? '', protocol: v };
    else if (k === 'protocol') throw new Error("INVALID_RULE: wrong 'protocol' usage. Use either 'rule protocol value=...' or  'rule [forward-]port protocol=...'.");
    else throw new Error(`INVALID_RULE: attribute '${k}' outside of any element. Use 'rule <element> ${k}= ...'.`);
  }
  if (r.family && !['ipv4', 'ipv6'].includes(r.family)) throw new Error(`INVALID_FAMILY: ${r.family}`);
  if (!r.service && !r.port && !r.action) throw new Error('INVALID_RULE: no element, no action');
  if (!r.action) throw new Error('INVALID_RULE: no action, no log, no audit');
  if (r.source && !r.family) throw new Error('INVALID_FAMILY');
  if (r.source && !/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(r.source)) throw new Error(`INVALID_ADDR: ${r.source}`);
  if (r.service && !SERVICES[r.service]) throw new Error(`INVALID_SERVICE: ${r.service}`);
  if (r.port && (!/^\d+(-\d+)?$/.test(r.port.port) || Number(r.port.port.split('-')[0]) > 65535)) throw new Error(`INVALID_PORT: ${r.port.port}`);
  if (r.port && !['tcp', 'udp', 'sctp', 'dccp'].includes(r.port.protocol)) throw new Error(`INVALID_PROTOCOL: ${r.port.protocol}`);
  return r;
}

/** The rule as firewalld writes it back (Rich_Rule.__str__). */
export function richText(r: RichRule): string {
  let s = 'rule';
  if (r.family) s += ` family="${r.family}"`;
  if (r.source) s += ` source${r.invert ? ' NOT' : ''} address="${r.source}"`;
  if (r.service) s += ` service name="${r.service}"`;
  if (r.port) s += ` port port="${r.port.port}" protocol="${r.port.protocol}"`;
  if (r.action) s += ` ${r.action}`;
  return s;
}

// ——— The decision ———

const ipNum = (a: string) => a.split('.').reduce((t, x) => t * 256 + Number(x), 0);
export function inNet(address: string, net: string): boolean {
  const [base, bits] = net.split('/');
  const n = Number(bits ?? 32);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address) || !/^\d+\.\d+\.\d+\.\d+$/.test(base)) return false;
  const mask = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
  return ((ipNum(address) & mask) >>> 0) === ((ipNum(base) & mask) >>> 0);
}
const portIn = (spec: string, port: number, proto: string) => {
  const [range, p] = spec.split('/');
  const [a, b] = range.split('-').map(Number);
  return p === proto && port >= a && port <= (b ?? a);
};

/** An incoming TCP connection from `source` to `port` (runtime, or the permanent configuration after a reload or reboot). */
export function verdict(game: Game, port: number, source: string, config: 'runtime' | 'permanent' = 'runtime'): 'accepted' | 'rejected' {
  const fw = firewalld(game);
  if (!fw || source === '127.0.0.1') return 'accepted';
  if (config === 'runtime' && !running(game)) return 'accepted';
  const zones = fw[config];
  const ifaceZone = Object.entries(fw.runtime).find(([, z]) => z.interfaces.length)?.[0] ?? fw.defaultZone;
  const name = Object.entries(zones).find(([, z]) => z.sources.some((s) => inNet(source, s)))?.[0] ?? ifaceZone;
  const z = zones[name];
  if (!z) return 'rejected';
  if (z.target === 'ACCEPT') return 'accepted';
  for (const text of z.richRules) {
    let r: RichRule;
    try {
      r = parseRich(text);
    } catch {
      continue;
    }
    if (r.source && inNet(source, r.source) === !!r.invert) continue;
    const ports = r.service ? SERVICES[r.service] ?? [] : r.port ? [`${r.port.port}/${r.port.protocol}`] : null;
    if (ports && !ports.some((p) => portIn(p, port, 'tcp'))) continue;
    return r.action === 'accept' ? 'accepted' : 'rejected';
  }
  if (z.services.some((s) => (SERVICES[s] ?? []).some((p) => portIn(p, port, 'tcp')))) return 'accepted';
  if (z.ports.some((p) => portIn(p, port, 'tcp'))) return 'accepted';
  return 'rejected';
}
