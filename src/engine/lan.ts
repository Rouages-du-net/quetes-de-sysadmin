// The local network of a machine acting as a router (state.lan): its
// interfaces (physical, and 802.1Q VLANs on a "trunk" interface linked to
// the switch), their addresses, the routes, and the devices plugged into
// the switch (each in a VLAN, with a fixed address or one given by DHCP).
//   - the persistent configuration: /etc/network/interfaces, read like
//     ifupdown (https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html):
//     auto, iface … inet static|manual|loopback, address (CIDR, or netmask),
//     gateway, vlan-raw-device, source; an interface "eth1.10" is VLAN 10
//     of eth1 (vlan package, https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html);
//   - the current state, which ip, ifup and ifdown change, and which boot
//     rebuilds from the file (the "auto" interfaces);
//   - ping: a device answers if it is in the VLAN of the interface whose
//     network contains its address, and that interface is up.
//   - IPv6 (see ipv6.ts): "iface … inet6 static|auto|manual" stanzas
//     (address with its prefix length, gateway, accept_ra, autoconf),
//     the router's advertisements (Lan.ra) and SLAAC.
// Differences: no visible ARP, no MTU or bonding; the switch is
// described by the chapter (ports already configured).

import type { Game } from './shell';
import type { Flux } from './nftables';
import type { Remote } from './wireguard';
import { cidr6, write6, type RouterAdvert } from './ipv6';

export interface Interface {
  name: string;
  up: boolean;
  // Addresses in CIDR format (10.10.10.1/24).
  addresses: string[];
  mac: string;
  vlan?: { parent: string; id: number };
  // A WireGuard interface (wg0), brought up by wg-quick (see wireguard.ts).
  wireguard?: boolean;
  // The networks reached through this interface besides its own (the routes wg-quick adds).
  routes?: string[];
  // IPv6 addresses given by hand or by ifupdown (CIDR, canonical); link-local and SLAAC ones are computed (ipv6.ts).
  addresses6?: string[];
}

export interface Device {
  name: string;
  mac: string;
  // The VLAN of its port on the switch (untagged); 1: the native VLAN.
  vlan: number;
  // Fixed address (configured on the device); otherwise it asks for one by DHCP.
  fixed?: string;
  // Address obtained by DHCP (lease).
  lease?: string;
}

export interface Lan {
  interfaces: Record<string, Interface>;
  // The default gateway (route default via … dev …).
  gateway: { via: string; dev: string } | null;
  // The interface linked to the switch's "trunk" port, and the VLANs it carries.
  trunk: string;
  vlans: number[];
  devices: Device[];
  // One number per interface, in order of creation (ip a).
  order: string[];
  // The traffic the devices attempt through the router (see nftables.ts).
  flux?: Flux[];
  // The devices that connect from the internet through WireGuard (see wireguard.ts).
  remotes?: Remote[];
  // IPv6: the router advertising a prefix on the link (the machine then speaks IPv6, see ipv6.ts).
  ra?: RouterAdvert;
  // An IPv6 default gateway given by hand (ip -6 route add default) or by ifupdown (gateway in an inet6 stanza).
  gateway6?: { via: string; dev: string } | null;
}

export const INTERFACES = '/etc/network/interfaces';
export const lan = (j: Game) => j.state.lan as Lan | undefined;

// ——— Addresses ———

export const toCount = (ip: string) => ip.split('.').reduce((t, o) => t * 256 + Number(o), 0);
export const toIp = (n: number) => [24, 16, 8, 0].map((d) => (n >>> d) & 255).join('.');
export const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every((o) => Number(o) <= 255);

/** "10.10.10.1/24" → address, length, network, broadcast; null if the form is wrong. */
export function cidr(text: string): { ip: string; length: number; network: number; broadcast: number } | null {
  const [ip, l] = text.split('/');
  const length = l === undefined ? 32 : Number(l);
  if (!isIp(ip) || !Number.isInteger(length) || length < 0 || length > 32) return null;
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  const network = (toCount(ip) & mask) >>> 0;
  return { ip, length, network, broadcast: (network | (~mask >>> 0)) >>> 0 };
}

/** The mask "255.255.255.0" as a length (24); null if it is not contiguous. */
export function maskLength(mask: string): number | null {
  if (!isIp(mask)) return null;
  const bits = toCount(mask).toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? (bits.indexOf('0') === -1 ? 32 : bits.indexOf('0')) : null;
}

/** Is this address in this network (10.10.10.0/24)? */
export function inside(ip: string, network: string): boolean {
  const c = cidr(network);
  if (!c || !isIp(ip)) return false;
  const mask = c.length === 0 ? 0 : (0xffffffff << (32 - c.length)) >>> 0;
  return (toCount(ip) & mask) >>> 0 === c.network;
}

/** The network of a CIDR address (10.10.10.1/24 → 10.10.10.0/24). */
export const networkFor = (address: string) => {
  const c = cidr(address)!;
  return `${toIp(c.network)}/${c.length}`;
};

// A documentation MAC address (RFC 7042) for one of the router's interfaces.
const macFor = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `52:54:00:${[16, 8, 0].map((d) => ((h >>> d) & 255).toString(16).padStart(2, '0')).join(':')}`;
};

/** An interface's VLAN, as seen from the switch: its id if it is a VLAN of the trunk, 1 if it is the trunk itself; null otherwise. */
export function vlanFor(l: Lan, i: Interface): number | null {
  if (i.vlan) return i.vlan.parent === l.trunk ? i.vlan.id : null;
  return i.name === l.trunk ? 1 : null;
}

/** Is the interface really in service (up, and its parent too)? */
export const inService = (l: Lan, i: Interface) => i.up && (!i.vlan || !!l.interfaces[i.vlan.parent]?.up);

// ——— The /etc/network/interfaces file (ifupdown) ———

export interface Strophe {
  name: string;
  // The inet method; "none" when the interface only has an inet6 stanza.
  method: string;
  auto: boolean;
  address?: string;
  gateway?: string;
  vlan?: { parent: string; id: number };
  v6?: Strophe6;
}

// An "iface … inet6" stanza (https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html, INET6 ADDRESS FAMILY).
export interface Strophe6 {
  method: string;
  address?: string;
  netmask?: string;
  gateway?: string;
  acceptRa?: string;
  autoconf?: string;
}

/** Reads /etc/network/interfaces (and its "source" lines); errors in ifup's format. */
export function readInterfaces(j: Game): { stanzas: Record<string, Strophe>; errors: string[] } {
  const stanzas: Record<string, Strophe> = {};
  const autos = new Set<string>();
  const errors: string[] = [];
  const read = (file: string) => {
    const text = j.read(file);
    if (text === null) return;
    let current: Strophe | null = null;
    let current6: Strophe6 | null = null;
    let mask: string | undefined;
    const finish = () => {
      if (current6 && current6.address && !current6.address.includes('/') && current6.netmask) current6.address = `${current6.address}/${current6.netmask}`;
      current6 = null;
      if (current && mask && current.address && !current.address.includes('/')) {
        const l = maskLength(mask);
        if (l === null) errors.push(`${file}: invalid netmask ${mask}`);
        else current.address = `${current.address}/${l}`;
      }
      mask = undefined;
    };
    text.split('\n').forEach((rawValue, i) => {
      const line = rawValue.replace(/#.*/, '').trim();
      if (!line) return;
      const [word, ...rest] = line.split(/\s+/);
      if (word === 'auto' || word === 'allow-hotplug') {
        rest.forEach((n) => autos.add(n));
        return;
      }
      if (word === 'source') {
        for (const pattern of rest) {
          const k = pattern.lastIndexOf('/');
          const directory = j.find(pattern.slice(0, k));
          const re = new RegExp(
            `^${pattern
              .slice(k + 1)
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*')}$`,
          );
          if (directory?.type === 'directory') for (const n of Object.keys(directory.children).sort()) if (re.test(n)) read(`${pattern.slice(0, k)}/${n}`);
        }
        return;
      }
      if (word === 'iface') {
        finish();
        const [name, family, method] = rest;
        if (family === 'inet6') {
          if (!['static', 'auto', 'manual', 'dhcp', 'loopback', 'v4tunnel', '6to4'].includes(method ?? '')) errors.push(`${file}:${i + 1}: unknown or no method and no address family`);
          current = stanzas[name] ?? { name, method: 'none', auto: false };
          current6 = current.v6 = { method: method ?? '' };
          const v = /^(.+)\.(\d+)$/.exec(name);
          if (v && !current.vlan) current.vlan = { parent: v[1], id: Number(v[2]) };
          stanzas[name] = current;
          return;
        }
        if (family !== 'inet' || !['static', 'manual', 'loopback', 'dhcp'].includes(method ?? ''))
          errors.push(`${file}:${i + 1}: unknown or no method and no address family`);
        current = { name, method: method ?? '', auto: false, ...(stanzas[name]?.v6 ? { v6: stanzas[name].v6 } : {}) };
        const v = /^(.+)\.(\d+)$/.exec(name);
        if (v) current.vlan = { parent: v[1], id: Number(v[2]) };
        stanzas[name] = current;
        return;
      }
      if (!current) {
        errors.push(`${file}:${i + 1}: option with empty value`);
        return;
      }
      const value = rest.join(' ');
      if (current6) {
        if (word === 'address') current6.address = value;
        else if (word === 'netmask') current6.netmask = value;
        else if (word === 'gateway') current6.gateway = value;
        else if (word === 'accept_ra') current6.acceptRa = value;
        else if (word === 'autoconf') current6.autoconf = value;
        return;
      }
      if (word === 'address') {
        if (!cidr(value.split('/')[0])) errors.push(`${file}:${i + 1}: invalid address ${value}`);
        else current.address = value;
      } else if (word === 'netmask') mask = value;
      else if (word === 'gateway') current.gateway = value;
      else if (word === 'vlan-raw-device' || word === 'vlan_raw_device') {
        const id = Number(/(\d+)$/.exec(current.name)?.[1]);
        current.vlan = { parent: value, id };
      }
    });
    finish();
  };
  read(INTERFACES);
  for (const n of autos) if (stanzas[n]) stanzas[n].auto = true;
  return { stanzas, errors };
}

// ——— Changing the state (ip, ifup, ifdown) ———

/** Creates an interface (VLAN, or physical for the starting world). */
export function create(l: Lan, name: string, vlan?: { parent: string; id: number }): Interface {
  const i: Interface = {
    name,
    up: false,
    addresses: [],
    mac: vlan ? (l.interfaces[vlan.parent]?.mac ?? macFor(name)) : macFor(name),
    ...(vlan ? { vlan } : {}),
  };
  l.interfaces[name] = i;
  if (!l.order.includes(name)) l.order.push(name);
  return i;
}

export function remove(l: Lan, name: string) {
  delete l.interfaces[name];
  // The VLANs of a deleted interface disappear with it.
  for (const [n, i] of Object.entries(l.interfaces)) if (i.vlan?.parent === name) delete l.interfaces[n];
  if (l.gateway?.dev === name) l.gateway = null;
}

/** ifup: brings up an interface from its stanza; returns ifup's error message, or null. */
export function mount(j: Game, l: Lan, s: Strophe, writes = true): string | null {
  if (s.method === 'loopback') return null;
  let i = l.interfaces[s.name];
  if (!i) {
    if (!s.vlan) return `Cannot find device "${s.name}"`;
    if (!l.interfaces[s.vlan.parent]) return `Cannot find device "${s.vlan.parent}"`;
    i = create(l, s.name, s.vlan);
  }
  // An inet6 stanza: the address must be one (ifupdown hands it to ip, which refuses it).
  const v6 = s.v6 && l.ra ? s.v6 : null;
  if (v6?.method === 'static') {
    if (!v6.address) return `Error: inet6 prefix is expected rather than "".`;
    if (!cidr6(v6.address)) return `Error: inet6 prefix is expected rather than "${v6.address}".`;
  }
  // Bringing up a VLAN also brings up its parent interface (as ifupdown does with the vlan package).
  if (i.vlan) l.interfaces[i.vlan.parent].up = true;
  i.up = true;
  if (s.method === 'static' && s.address) {
    if (!i.addresses.includes(s.address)) i.addresses.push(s.address);
    if (s.gateway) l.gateway = { via: s.gateway, dev: s.name };
  }
  if (v6) {
    // ifupdown writes the kernel's settings (/proc/sys/net/ipv6/conf/IFACE/…), then adds the address and the route.
    if (v6.method === 'static') {
      const c = cidr6(v6.address!)!;
      const a = `${c.ip}/${v6.address!.includes('/') ? c.length : 128}`;
      i.addresses6 = [...(i.addresses6 ?? []).filter((x) => x !== a), a];
      if (writes) write6(j, s.name, 'autoconf', v6.autoconf ?? '0');
      if (writes && v6.acceptRa !== undefined) write6(j, s.name, 'accept_ra', v6.acceptRa);
      if (v6.gateway) l.gateway6 = { via: v6.gateway.split('%')[0], dev: s.name };
    } else if (v6.method === 'auto') {
      if (writes) write6(j, s.name, 'accept_ra', v6.acceptRa ?? '2');
      if (writes) write6(j, s.name, 'autoconf', '1');
    }
  }
  return null;
}

export function unmount(l: Lan, s: Strophe) {
  const i = l.interfaces[s.name];
  if (!i) return;
  i.up = false;
  i.addresses = [];
  i.addresses6 = [];
  if (l.gateway?.dev === s.name) l.gateway = null;
  if (l.gateway6?.dev === s.name) l.gateway6 = null;
  // ifdown on a VLAN deletes it.
  if (i.vlan) delete l.interfaces[s.name];
}

/** On boot (and on systemctl restart networking): the state starts again from the file, "auto" interfaces. */
export function startNetwork(j: Game) {
  const l = lan(j);
  if (!l) return;
  // ifupdown's state (/run/network/ifstate): what has been brought up.
  j.state.ifstate = goUp(j, l);
}

/** The local network as it would be at the next boot (a copy, brought up from the file). */
export function networkToBoot(j: Game): Lan | null {
  const l = lan(j);
  if (!l) return null;
  const copyOf = structuredClone(l);
  for (const [name, i] of Object.entries(copyOf.interfaces)) if (i.wireguard) delete copyOf.interfaces[name];
  goUp(j, copyOf, false);
  return copyOf;
}

function goUp(j: Game, l: Lan, writes = true): string[] {
  for (const [name, i] of Object.entries(l.interfaces)) {
    // WireGuard interfaces are not in this file: wg-quick manages them.
    if (i.wireguard) continue;
    if (i.vlan) delete l.interfaces[name];
    else Object.assign(i, { up: name === 'lo', addresses: name === 'lo' ? ['127.0.0.1/8'] : [], addresses6: [] });
  }
  l.gateway = null;
  l.gateway6 = null;
  const { stanzas } = readInterfaces(j);
  const mounted: string[] = [];
  for (const s of [...Object.values(stanzas).filter((x) => !x.vlan), ...Object.values(stanzas).filter((x) => x.vlan)])
    if (s.auto && !mount(j, l, s, writes)) mounted.push(s.name);
  return mounted;
}

// ——— Reaching an address ———

/** The interface (in service) whose network contains this address. */
export function interfaceFor(l: Lan, ip: string): Interface | null {
  return (
    Object.values(l.interfaces).find((i) => inService(l, i) && i.addresses.some((a) => inside(ip, networkFor(a)))) ??
    Object.values(l.interfaces).find((i) => inService(l, i) && i.routes?.some((r) => inside(ip, r))) ??
    null
  );
}

/** The router's interface (in service, with an address) that receives this VLAN. */
export function vlanInterface(l: Lan, vlan: number): Interface | null {
  return Object.values(l.interfaces).find((i) => inService(l, i) && i.addresses.length && vlanFor(l, i) === vlan) ?? null;
}

/** A private address (RFC 1918)? */
export const isPrivate = (ip: string) => inside(ip, '10.0.0.0/8') || inside(ip, '172.16.0.0/12') || inside(ip, '192.168.0.0/16');

/** A device's address (fixed, or its DHCP lease). */
export const addressFor = (a: Device) => a.fixed ?? a.lease;

/**
 * What a ping from the router gives: "local" (one of its addresses),
 * "device" (it answers), "unreachable" (nobody answers on that
 * network; the error's source address), "internet" (through the gateway),
 * "lost" (a private address sent to the gateway) or "no-route".
 */
export function reach(
  l: Lan,
  ip: string,
): { what: 'local' | 'device' | 'internet' | 'lost' | 'no-route'; source?: string } | { what: 'unreachable'; source: string } {
  if (ip.startsWith('127.') || Object.values(l.interfaces).some((i) => i.addresses.some((a) => a.split('/')[0] === ip))) return { what: 'local' };
  const i = interfaceFor(l, ip);
  if (i) {
    const source = (i.addresses.find((a) => inside(ip, networkFor(a))) ?? i.addresses[0] ?? '').split('/')[0];
    const vlan = vlanFor(l, i);
    const ok = vlan !== null && l.vlans.concat(1).includes(vlan) && l.devices.some((a) => a.vlan === vlan && addressFor(a) === ip);
    return ok ? { what: 'device', source } : { what: 'unreachable', source };
  }
  const gw = l.gateway;
  if (gw && l.interfaces[gw.dev] && inService(l, l.interfaces[gw.dev]))
    // A private address (RFC 1918) is not routed on the internet: the ISP box drops it.
    return { what: isPrivate(ip) ? 'lost' : 'internet', source: l.interfaces[gw.dev].addresses[0]?.split('/')[0] };
  return { what: 'no-route' };
}
