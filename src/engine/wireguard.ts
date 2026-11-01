// WireGuard on a router (state.wg): keys (wg genkey, wg pubkey), an
// interface (wg0) described by /etc/wireguard/wg0.conf and brought up by
// wg-quick, and remote peers (Lan.remotes) that try to connect to it
// from the internet.
// The format is that of wg(8) and wg-quick(8):
// https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html,
// https://www.wireguard.com/quickstart/
// A handshake succeeds if the peer has the router's right public key,
// the right address and port, if the input chain lets the UDP through,
// and if the router knows the peer's public key. Then its packets
// go through if the tunnel address is in the peer's AllowedIPs (on the
// router's side), the destination in its own AllowedIPs, and if the forward
// chain lets them go (and come back).
// Differences: the keys have the right format, but the public key is not
// computed with Curve25519 (a fingerprint stands in for it); no
// PresharedKey checked, no PostUp run, no routing of all traffic
// (0.0.0.0/0) on the router's side, no IPv6.

import { path } from './world';
import type { Game } from './shell';
import { cidr, create, inside, isIp, lan, networkFor, remove } from './lan';
import { nft, routing, traverse, type Ruleset } from './nftables';

export const DIRECTORY = '/etc/wireguard';

// ——— Keys (32 bytes in base64) ———

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toB64(o: number[]): string {
  let s = '';
  for (let i = 0; i < o.length; i += 3) {
    const n = (o[i] << 16) | ((o[i + 1] ?? 0) << 8) | (o[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < o.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < o.length ? B64[n & 63] : '=');
  }
  return s;
}

function sinceB64(s: string): number[] | null {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(s)) return null;
  const bits = s
    .slice(0, 43)
    .split('')
    .map((c) => B64.indexOf(c).toString(2).padStart(6, '0'))
    .join('');
  // 43 characters: 258 bits, the last 2 of which must be zero.
  if (!bits.endsWith('00')) return null;
  return Array.from({ length: 32 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
}

export const validKey = (s: string) => sinceB64(s.trim()) !== null;

/** wg genkey: a private key (always different, but replayable: a counter in the state). */
export function generateKey(j: Game): string {
  const n = (j.state.wgCounter = (j.state.wgCounter ?? 0) + 1);
  let x = (n * 2654435761) >>> 0 || 1;
  const o = Array.from({ length: 32 }, () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x & 255;
  });
  // Like a real Curve25519 key: low and high bits adjusted.
  o[0] &= 248;
  o[31] = (o[31] & 127) | 64;
  return toB64(o);
}

/** wg pubkey: the public key of a private key (a fingerprint stands in for Curve25519); null if the key is malformed. */
export function isPublic(key: string): string | null {
  const o = sinceB64(key.trim());
  if (!o) return null;
  let h = 2166136261;
  const output = Array.from({ length: 32 }, (_, i) => {
    for (const b of [...o, i]) {
      h ^= b;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 8) & 255;
  });
  return toB64(output);
}

// ——— Configuration (wg-quick) ———

export interface Peer {
  key: string;
  allowed: string[];
  endpoint?: string;
  // PersistentKeepalive: a packet every N seconds, which keeps the way open through a home router (NAT).
  keepalive?: number;
}

export interface ConfWg {
  addresses: string[];
  port?: number;
  key?: string;
  peers: Peer[];
  // The messages of wg setconf or wg-quick, if there is a mistake.
  errors: string[];
}

const IFACE_WG_QUICK = ['address', 'dns', 'mtu', 'table', 'preup', 'postup', 'predown', 'postdown', 'saveconfig'];

/** Reads a configuration file like wg-quick (its own keys) then wg setconf (the rest). */
export function readConfWg(text: string): ConfWg {
  const c: ConfWg = { addresses: [], peers: [], errors: [] };
  let section: 'interface' | 'peer' | null = null;
  for (const rawValue of text.split('\n')) {
    const line = rawValue.replace(/#.*/, '').trim();
    if (!line) continue;
    const title = /^\[(\w+)\]$/.exec(line);
    if (title) {
      const t = title[1].toLowerCase();
      if (t === 'interface') section = 'interface';
      else if (t === 'peer') {
        section = 'peer';
        c.peers.push({ key: '', allowed: [] });
      } else return { ...c, errors: [`Line unrecognized: \`${line}'`, 'Configuration parsing error'] };
      continue;
    }
    const k = line.indexOf('=');
    const key = (k < 0 ? line : line.slice(0, k)).trim().toLowerCase();
    const value = k < 0 ? '' : line.slice(k + 1).trim();
    const bad = (m: string) => ({ ...c, errors: [m, 'Configuration parsing error'] });
    const notRecognised = () => bad(`Line unrecognized: \`${line.replace(/\s+/g, '')}'`);
    if (k < 0 || !section) return notRecognised();
    if (section === 'interface') {
      if (key === 'address') {
        for (const a of value.split(',').map((x) => x.trim())) {
          if (!cidr(a)) return { ...c, errors: [`Error: any valid prefix is expected rather than "${a}".`] };
          c.addresses.push(a.includes('/') ? a : `${a}/32`);
        }
      } else if (IFACE_WG_QUICK.includes(key)) continue;
      else if (key === 'listenport') {
        if (!/^\d+$/.test(value) || Number(value) > 65535) return bad(`Unable to parse port: \`${value}'`);
        c.port = Number(value);
      } else if (key === 'privatekey') {
        if (!validKey(value)) return bad(`Key is not the correct length or format: \`${value}'`);
        c.key = value;
      } else if (key === 'fwmark') continue;
      else return notRecognised();
    } else {
      const p = c.peers.at(-1)!;
      if (key === 'publickey') {
        if (!validKey(value)) return bad(`Key is not the correct length or format: \`${value}'`);
        p.key = value;
      } else if (key === 'allowedips') {
        for (const a of value
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)) {
          if (!cidr(a)) return bad(`Unable to parse IP address: \`${a}'`);
          p.allowed.push(a.includes('/') ? a : `${a}/32`);
        }
      } else if (key === 'endpoint') {
        if (!/^[\w.-]+:\d+$/.test(value)) return bad(`Unable to parse endpoint: \`${value}'`);
        p.endpoint = value;
      } else if (key === 'presharedkey') {
        if (!validKey(value)) return bad(`Key is not the correct length or format: \`${value}'`);
      } else if (key === 'persistentkeepalive') {
        if (value === 'off') continue;
        if (!/^\d+$/.test(value) || Number(value) > 65535) return bad(`Unable to parse persistent keepalive interval: \`${value}'`);
        p.keepalive = Number(value);
      } else return notRecognised();
    }
  }
  if (c.peers.some((p) => !p.key)) return { ...c, errors: ['A peer is missing a public key', 'Configuration parsing error'] };
  return c;
}

// ——— State: the interfaces brought up ———

export interface InterfaceWg {
  conf: ConfWg;
  // Brought up by the service (wg-quick@wg0) or by hand (wg-quick up).
  byService: boolean;
}

export const wg = (j: Game): Record<string, InterfaceWg> => (j.state.wg ??= {});
export const confFor = (name: string) => `${DIRECTORY}/${name}.conf`;

/** wg-quick up: returns the "[#] …" lines and the errors, and brings the interface up if all is well. */
export function mountWg(j: Game, name: string, byService: boolean): { lines: string[]; error: string | null } {
  const l = lan(j);
  const text = j.read(confFor(name));
  if (text === null) return { lines: [], error: `wg-quick: \`${confFor(name)}' does not exist` };
  if (wg(j)[name] || l?.interfaces[name]) return { lines: [], error: `wg-quick: \`${name}' already exists` };
  const c = readConfWg(text);
  const lines = [`[#] ip link add ${name} type wireguard`, `[#] wg setconf ${name} /dev/fd/63`];
  if (c.errors.length) {
    // Like wg-quick: the created interface is removed.
    return { lines: [...lines, ...c.errors, `[#] ip link delete dev ${name}`], error: '' };
  }
  for (const a of c.addresses) lines.push(`[#] ip -4 address add ${a} dev ${name}`);
  lines.push(`[#] ip link set mtu 1420 up dev ${name}`);
  // Like wg-quick: a route for each AllowedIPs the interface's network doesn't already cover.
  const routes = [...new Set(c.peers.flatMap((p) => p.allowed))]
    .map(networkFor)
    .filter((r) => !c.addresses.some((a) => inside(r.split('/')[0], networkFor(a)) && Number(r.split('/')[1]) >= Number(a.split('/')[1])));
  for (const r of routes) lines.push(`[#] ip -4 route add ${r} dev ${name}`);
  wg(j)[name] = { conf: c, byService };
  if (l) {
    const i = create(l, name);
    i.wireguard = true;
    i.up = true;
    i.addresses = [...c.addresses];
    i.routes = routes;
  }
  return { lines, error: null };
}

export function unmountWg(j: Game, name: string): string | null {
  if (!wg(j)[name]) return `wg-quick: \`${name}' is not a WireGuard interface`;
  delete wg(j)[name];
  const l = lan(j);
  if (l) remove(l, name);
  return null;
}

// ——— Remote peers ———

/** A device on the internet that connects to the router through WireGuard (Malik's laptop…). */
export interface Remote {
  name: string;
  // Its public address (where its UDP packets come from).
  address: string;
  // Its public key (its private key never leaves the device).
  key: string;
  // Its configuration file, which the chapter has the player complete (path
  // written with the reference names, like the chapters': see path()).
  conf: string;
  // What it tries to reach through the tunnel.
  to: string;
  port: number;
  // A whole site behind this peer (another router): its network, and the device the exchange starts from.
  network?: string;
  source?: string;
  // Behind its provider's home router (NAT): it can't be reached unless it keeps the way open.
  behindNat?: boolean;
}

export type TunnelState =
  | 'down' // no WireGuard interface up
  | 'conf' // the peer's configuration is incomplete or wrong
  | 'address' // Endpoint: not the router, or not the right port
  | 'filtered' // the input chain drops the UDP
  | 'router-key' // the peer doesn't have the router's public key
  | 'unknown' // the router doesn't know the peer's public key
  | 'allowed-ips' // the address the exchange starts from is not in the peer's AllowedIPs (router side)
  | 'route' // the destination is not in the peer's AllowedIPs (its own side)
  | 'asleep' // the peer is behind a home router and doesn't keep the way open (PersistentKeepalive)
  | 'forwarding' // ip_forward, or the forward chain
  | 'ok';

interface Options {
  ruleset?: Ruleset;
  interfaces?: Record<string, InterfaceWg>;
  transfer?: boolean;
  publicAddress: string;
  names: string[];
}

interface Handshake {
  name: string;
  peer: Peer;
  client: ConfWg;
  clientAddress: string;
  ruleset: Ruleset;
  transfer: boolean;
}

/** The handshake between the peer and the router: what they need to recognise each other. */
/** A remote peer's configuration, read from its file (under its name in the language). */
export const remoteConf = (j: Game, d: Remote): ConfWg => readConfWg(j.read(path(j.t, d.conf)) ?? '');

function handshake(j: Game, d: Remote, o: Options): Handshake | { state: TunnelState; name?: string } {
  const interfaces = o.interfaces ?? wg(j);
  const ruleset = o.ruleset ?? nft(j);
  const transfer = o.transfer ?? routing(j);
  const inputs = Object.entries(interfaces);
  if (!inputs.length) return { state: 'down' };
  const client = remoteConf(j, d);
  const routerPeer = client.peers[0];
  const clientAddress = client.addresses[0]?.split('/')[0];
  if (client.errors.length || !routerPeer?.endpoint || !clientAddress) return { state: 'conf' };
  const [host, port] = routerPeer.endpoint.split(':');
  if (host !== o.publicAddress && !o.names.includes(host)) return { state: 'address' };
  const iface = inputs.find(([, i]) => i.conf.port === Number(port));
  if (!iface) return { state: 'address' };
  const [name, i] = iface;
  const input = {
    iif: 'eth0',
    oif: '',
    saddr: d.address,
    daddr: o.publicAddress,
    proto: 'udp' as const,
    sport: 51820,
    dport: Number(port),
    ct: 'new' as const,
    size: 148,
  };
  if (!traverse(ruleset, 'input', 'filter', input).pass) return { state: 'filtered', name };
  if (!i.conf.key || routerPeer.key !== isPublic(i.conf.key)) return { state: 'router-key', name };
  const peer = i.conf.peers.find((p) => p.key === d.key);
  if (!peer) return { state: 'unknown', name };
  return { name, peer, client, clientAddress, ruleset, transfer };
}

// The router interface an address goes through (outside the tunnel).
const outputFor = (j: Game, ip: string, except: string) =>
  Object.values(lan(j)?.interfaces ?? {}).find((x) => x.name !== except && x.up && !x.wireguard && x.addresses.some((a) => inside(ip, networkFor(a))));

// An exchange through the forward chain: the first packet, then the reply.
function traversesForward(r: Ruleset, iif: string, oif: string, saddr: string, daddr: string, port: number): boolean {
  const go = { iif, oif, saddr, daddr, proto: 'tcp' as const, sport: 49152, dport: port, ct: 'new' as const, size: 60 };
  const back = { ...go, iif: oif, oif: iif, saddr: daddr, daddr: saddr, sport: port, dport: 49152, ct: 'established' as const, size: 1500 };
  return traverse(r, 'forward', 'filter', go).pass && traverse(r, 'forward', 'filter', back).pass;
}

/** Where the peer stands when it tries to reach d.to through the tunnel (now, or at start-up). */
export function tunnelState(j: Game, d: Remote, o: Options): { state: TunnelState; name?: string } {
  const p = handshake(j, d, o);
  if ('state' in p) return p;
  const { name, peer, client, clientAddress, ruleset, transfer } = p;
  const source = d.source ?? clientAddress;
  if (!peer.allowed.some((a) => inside(source, a))) return { state: 'allowed-ips', name };
  if (!isIp(d.to) || !client.peers[0].allowed.some((a) => inside(d.to, a))) return { state: 'route', name };
  if (!transfer) return { state: 'forwarding', name };
  const output = outputFor(j, d.to, name);
  if (!traversesForward(ruleset, name, output?.name ?? '', source, d.to, d.port)) return { state: 'forwarding', name };
  return { state: 'ok', name };
}

/** An exchange in the other direction: a device on the local network (its address) to an address behind the peer. */
export function stateToRemote(j: Game, d: Remote, forEachOf: string, to: string, port: number, o: Options): { state: TunnelState; name?: string } {
  const p = handshake(j, d, o);
  if ('state' in p) return p;
  const { name, peer, client, ruleset, transfer } = p;
  // On the router's side, the peer's AllowedIPs say where to send (and wg-quick's routes).
  if (!peer.allowed.some((a) => inside(to, a))) return { state: 'allowed-ips', name };
  // On the peer's side, the reply must be able to go back into the tunnel (and the packet be accepted).
  if (!client.peers[0].allowed.some((a) => inside(forEachOf, a))) return { state: 'route', name };
  if (d.behindNat && !client.peers[0].keepalive) return { state: 'asleep', name };
  if (!transfer) return { state: 'forwarding', name };
  const input = outputFor(j, forEachOf, name);
  if (!traversesForward(ruleset, input?.name ?? '', name, forEachOf, to, port)) return { state: 'forwarding', name };
  return { state: 'ok', name };
}
