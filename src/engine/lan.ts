// Le réseau local d'une machine qui sert de routeur (etat.lan) : ses
// interfaces (physiques, et VLAN 802.1Q sur une interface « trunk » reliée
// au commutateur), leurs adresses, les routes, et les appareils branchés au
// commutateur (chacun dans un VLAN, avec une adresse fixe ou donnée par DHCP).
//   - la configuration persistante : /etc/network/interfaces, lu comme
//     ifupdown (https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html) :
//     auto, iface … inet static|manual|loopback, address (CIDR, ou netmask),
//     gateway, vlan-raw-device, source ; une interface « eth1.10 » est le
//     VLAN 10 de eth1 (paquet vlan, https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html) ;
//   - l'état courant, que changent ip, ifup et ifdown, et que le démarrage
//     reconstruit depuis le fichier (les interfaces « auto ») ;
//   - ping : un appareil répond s'il est dans le VLAN de l'interface dont le
//     réseau contient son adresse, et que cette interface est montée.
// Écarts : IPv4 seulement, pas d'ARP visible, pas de MTU ni de bonding ; le
// commutateur est décrit par le chapitre (ports déjà configurés).

import type { Game } from './shell';
import type { Flux } from './nftables';
import type { Remote } from './wireguard';

export interface Interface {
  name: string;
  up: boolean;
  // Adresses au format CIDR (10.10.10.1/24).
  addresses: string[];
  mac: string;
  vlan?: { parent: string; id: number };
  // Une interface WireGuard (wg0), montée par wg-quick (voir wireguard.ts).
  wireguard?: boolean;
  // Les réseaux joints par cette interface en plus du sien (les routes que wg-quick ajoute).
  routes?: string[];
}

export interface Device {
  name: string;
  mac: string;
  // Le VLAN de son port sur le commutateur (non étiqueté) ; 1 : le VLAN natif.
  vlan: number;
  // Adresse fixe (configurée sur l'appareil) ; sinon il la demande en DHCP.
  fixed?: string;
  // Adresse obtenue par DHCP (bail).
  lease?: string;
}

export interface Lan {
  interfaces: Record<string, Interface>;
  // La passerelle par défaut (route default via … dev …).
  gateway: { via: string; dev: string } | null;
  // L'interface reliée au port « trunk » du commutateur, et les VLAN qu'il transporte.
  trunk: string;
  vlans: number[];
  devices: Device[];
  // Un numéro par interface, dans l'ordre de création (ip a).
  order: string[];
  // Le trafic que les appareils essaient à travers le routeur (voir nftables.ts).
  flux?: Flux[];
  // Les appareils qui se connectent depuis internet par WireGuard (voir wireguard.ts).
  remotes?: Remote[];
}

export const INTERFACES = '/etc/network/interfaces';
export const lan = (j: Game) => j.state.lan as Lan | undefined;

// ——— Adresses ———

export const toCount = (ip: string) => ip.split('.').reduce((t, o) => t * 256 + Number(o), 0);
export const toIp = (n: number) => [24, 16, 8, 0].map((d) => (n >>> d) & 255).join('.');
export const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every((o) => Number(o) <= 255);

/** « 10.10.10.1/24 » → adresse, longueur, réseau, diffusion ; null si la forme est fausse. */
export function cidr(text: string): { ip: string; length: number; network: number; broadcast: number } | null {
  const [ip, l] = text.split('/');
  const length = l === undefined ? 32 : Number(l);
  if (!isIp(ip) || !Number.isInteger(length) || length < 0 || length > 32) return null;
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  const network = (toCount(ip) & mask) >>> 0;
  return { ip, length, network, broadcast: (network | (~mask >>> 0)) >>> 0 };
}

/** Le masque « 255.255.255.0 » en longueur (24) ; null s'il n'est pas contigu. */
export function maskLength(mask: string): number | null {
  if (!isIp(mask)) return null;
  const bits = toCount(mask).toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? (bits.indexOf('0') === -1 ? 32 : bits.indexOf('0')) : null;
}

/** Cette adresse est-elle dans ce réseau (10.10.10.0/24) ? */
export function inside(ip: string, network: string): boolean {
  const c = cidr(network);
  if (!c || !isIp(ip)) return false;
  const mask = c.length === 0 ? 0 : (0xffffffff << (32 - c.length)) >>> 0;
  return (toCount(ip) & mask) >>> 0 === c.network;
}

/** Le réseau d'une adresse CIDR (10.10.10.1/24 → 10.10.10.0/24). */
export const networkFor = (address: string) => {
  const c = cidr(address)!;
  return `${toIp(c.network)}/${c.length}`;
};

// Une adresse MAC de documentation (RFC 7042) pour une interface du routeur.
const macFor = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `52:54:00:${[16, 8, 0].map((d) => ((h >>> d) & 255).toString(16).padStart(2, '0')).join(':')}`;
};

/** Le VLAN d'une interface, vu du commutateur : son id si c'est un VLAN du trunk, 1 si c'est le trunk lui-même ; null sinon. */
export function vlanFor(l: Lan, i: Interface): number | null {
  if (i.vlan) return i.vlan.parent === l.trunk ? i.vlan.id : null;
  return i.name === l.trunk ? 1 : null;
}

/** L'interface est-elle vraiment en service (montée, et son parent aussi) ? */
export const inService = (l: Lan, i: Interface) => i.up && (!i.vlan || !!l.interfaces[i.vlan.parent]?.up);

// ——— Le fichier /etc/network/interfaces (ifupdown) ———

export interface Strophe {
  name: string;
  method: string;
  auto: boolean;
  address?: string;
  gateway?: string;
  vlan?: { parent: string; id: number };
}

/** Lit /etc/network/interfaces (et ses « source ») ; les erreurs au format d'ifup. */
export function readInterfaces(j: Game): { stanzas: Record<string, Strophe>; errors: string[] } {
  const stanzas: Record<string, Strophe> = {};
  const autos = new Set<string>();
  const errors: string[] = [];
  const read = (file: string) => {
    const text = j.read(file);
    if (text === null) return;
    let current: Strophe | null = null;
    let mask: string | undefined;
    const finish = () => {
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
        if (family !== 'inet' || !['static', 'manual', 'loopback', 'dhcp'].includes(method ?? ''))
          errors.push(`${file}:${i + 1}: unknown or no method and no address family`);
        current = { name, method: method ?? '', auto: false };
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

// ——— Changer l'état (ip, ifup, ifdown) ———

/** Crée une interface (VLAN, ou physique pour le monde de départ). */
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
  // Les VLAN d'une interface supprimée disparaissent avec elle.
  for (const [n, i] of Object.entries(l.interfaces)) if (i.vlan?.parent === name) delete l.interfaces[n];
  if (l.gateway?.dev === name) l.gateway = null;
}

/** ifup : monte une interface d'après sa strophe ; renvoie le message d'erreur d'ifup, ou null. */
export function mount(j: Game, l: Lan, s: Strophe): string | null {
  if (s.method === 'loopback') return null;
  let i = l.interfaces[s.name];
  if (!i) {
    if (!s.vlan) return `Cannot find device "${s.name}"`;
    if (!l.interfaces[s.vlan.parent]) return `Cannot find device "${s.vlan.parent}"`;
    i = create(l, s.name, s.vlan);
  }
  // Monter un VLAN monte aussi son interface parente (comme le fait ifupdown avec le paquet vlan).
  if (i.vlan) l.interfaces[i.vlan.parent].up = true;
  i.up = true;
  if (s.method === 'static' && s.address) {
    if (!i.addresses.includes(s.address)) i.addresses.push(s.address);
    if (s.gateway) l.gateway = { via: s.gateway, dev: s.name };
  }
  return null;
}

export function unmount(l: Lan, s: Strophe) {
  const i = l.interfaces[s.name];
  if (!i) return;
  i.up = false;
  i.addresses = [];
  if (l.gateway?.dev === s.name) l.gateway = null;
  // ifdown d'un VLAN le supprime.
  if (i.vlan) delete l.interfaces[s.name];
}

/** Au démarrage (et à systemctl restart networking) : l'état repart du fichier, interfaces « auto ». */
export function startNetwork(j: Game) {
  const l = lan(j);
  if (!l) return;
  // L'état d'ifupdown (/run/network/ifstate) : ce qui a été monté.
  j.state.ifstate = goUp(j, l);
}

/** Le réseau local tel qu'il serait au prochain démarrage (une copie, montée d'après le fichier). */
export function networkToBoot(j: Game): Lan | null {
  const l = lan(j);
  if (!l) return null;
  const copyOf = structuredClone(l);
  for (const [name, i] of Object.entries(copyOf.interfaces)) if (i.wireguard) delete copyOf.interfaces[name];
  goUp(j, copyOf);
  return copyOf;
}

function goUp(j: Game, l: Lan): string[] {
  for (const [name, i] of Object.entries(l.interfaces)) {
    // Les interfaces WireGuard ne sont pas dans ce fichier : wg-quick les gère.
    if (i.wireguard) continue;
    if (i.vlan) delete l.interfaces[name];
    else Object.assign(i, { up: name === 'lo', addresses: name === 'lo' ? ['127.0.0.1/8'] : [] });
  }
  l.gateway = null;
  const { stanzas } = readInterfaces(j);
  const mounted: string[] = [];
  for (const s of [...Object.values(stanzas).filter((x) => !x.vlan), ...Object.values(stanzas).filter((x) => x.vlan)])
    if (s.auto && !mount(j, l, s)) mounted.push(s.name);
  return mounted;
}

// ——— Joindre une adresse ———

/** L'interface (en service) dont le réseau contient cette adresse. */
export function interfaceFor(l: Lan, ip: string): Interface | null {
  return (
    Object.values(l.interfaces).find((i) => inService(l, i) && i.addresses.some((a) => inside(ip, networkFor(a)))) ??
    Object.values(l.interfaces).find((i) => inService(l, i) && i.routes?.some((r) => inside(ip, r))) ??
    null
  );
}

/** L'interface du routeur (en service, avec une adresse) qui reçoit ce VLAN. */
export function vlanInterface(l: Lan, vlan: number): Interface | null {
  return Object.values(l.interfaces).find((i) => inService(l, i) && i.addresses.length && vlanFor(l, i) === vlan) ?? null;
}

/** Une adresse privée (RFC 1918) ? */
export const isPrivate = (ip: string) => inside(ip, '10.0.0.0/8') || inside(ip, '172.16.0.0/12') || inside(ip, '192.168.0.0/16');

/** L'adresse d'un appareil (fixe, ou son bail DHCP). */
export const addressFor = (a: Device) => a.fixed ?? a.lease;

/**
 * Ce que donne un ping depuis le routeur : « local » (une de ses adresses),
 * « appareil » (il répond), « injoignable » (personne ne répond sur ce
 * réseau, l'adresse source de l'erreur), « internet » (par la passerelle),
 * « perdu » (une adresse privée envoyée à la passerelle) ou « pas-de-route ».
 */
export function reach(
  l: Lan,
  ip: string,
): { what: 'local' | 'device' | 'internet' | 'lost' | 'no-route'; source?: string } | { what: 'injoignable'; source: string } {
  if (ip.startsWith('127.') || Object.values(l.interfaces).some((i) => i.addresses.some((a) => a.split('/')[0] === ip))) return { what: 'local' };
  const i = interfaceFor(l, ip);
  if (i) {
    const source = (i.addresses.find((a) => inside(ip, networkFor(a))) ?? i.addresses[0] ?? '').split('/')[0];
    const vlan = vlanFor(l, i);
    const ok = vlan !== null && l.vlans.concat(1).includes(vlan) && l.devices.some((a) => a.vlan === vlan && addressFor(a) === ip);
    return ok ? { what: 'device', source } : { what: 'injoignable', source };
  }
  const gw = l.gateway;
  if (gw && l.interfaces[gw.dev] && inService(l, l.interfaces[gw.dev]))
    // Une adresse privée (RFC 1918) ne se route pas sur internet : la box la jette.
    return { what: isPrivate(ip) ? 'lost' : 'internet', source: l.interfaces[gw.dev].addresses[0]?.split('/')[0] };
  return { what: 'no-route' };
}
