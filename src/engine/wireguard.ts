// WireGuard sur un routeur (etat.wg) : des clés (wg genkey, wg pubkey), une
// interface (wg0) décrite par /etc/wireguard/wg0.conf et montée par
// wg-quick, et des pairs distants (Lan.distants) qui essaient de s'y
// connecter depuis internet.
// Le format est celui de wg(8) et wg-quick(8) :
// https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html,
// https://www.wireguard.com/quickstart/
// Une poignée de main réussit si le pair a la bonne clé publique du routeur,
// la bonne adresse et le bon port, si la chaîne input laisse passer l'UDP,
// et si le routeur connaît la clé publique du pair. Ensuite, ses paquets
// passent si l'adresse du tunnel est dans les AllowedIPs du pair (côté
// routeur), la destination dans ses AllowedIPs à lui, et si la chaîne
// forward les laisse aller (et revenir).
// Écarts : les clés ont le bon format, mais la clé publique n'est pas
// calculée par Curve25519 (une empreinte qui en tient lieu) ; pas de
// PresharedKey vérifiée, de PostUp exécuté, de routage de tout le trafic
// (0.0.0.0/0) côté routeur ni d'IPv6.

import { path } from './world';
import type { Game } from './shell';
import { cidr, create, inside, isIp, lan, networkFor, remove } from './lan';
import { nft, routing, traverse, type Ruleset } from './nftables';

export const DIRECTORY = '/etc/wireguard';

// ——— Les clés (32 octets en base64) ———

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
  // 43 caractères : 258 bits, dont les 2 derniers doivent être nuls.
  if (!bits.endsWith('00')) return null;
  return Array.from({ length: 32 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
}

export const validKey = (s: string) => sinceB64(s.trim()) !== null;

/** wg genkey : une clé privée (toujours différente, mais rejouable : un compteur de l'état). */
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
  // Comme une vraie clé Curve25519 : bits de poids faible et fort ajustés.
  o[0] &= 248;
  o[31] = (o[31] & 127) | 64;
  return toB64(o);
}

/** wg pubkey : la clé publique d'une clé privée (une empreinte qui tient lieu de Curve25519) ; null si la clé est mal formée. */
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

// ——— La configuration (wg-quick) ———

export interface Peer {
  key: string;
  allowed: string[];
  endpoint?: string;
  // PersistentKeepalive : un paquet toutes les N secondes, qui garde le passage ouvert dans une box (NAT).
  keepalive?: number;
}

export interface ConfWg {
  addresses: string[];
  port?: number;
  key?: string;
  peers: Peer[];
  // Les messages de wg setconf ou de wg-quick, s'il y a une faute.
  errors: string[];
}

const IFACE_WG_QUICK = ['address', 'dns', 'mtu', 'table', 'preup', 'postup', 'predown', 'postdown', 'saveconfig'];

/** Lit un fichier de configuration comme wg-quick (ses clés à lui) puis wg setconf (le reste). */
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

// ——— L'état : les interfaces montées ———

export interface InterfaceWg {
  conf: ConfWg;
  // Montée par le service (wg-quick@wg0) ou à la main (wg-quick up).
  byService: boolean;
}

export const wg = (j: Game): Record<string, InterfaceWg> => (j.state.wg ??= {});
export const confFor = (name: string) => `${DIRECTORY}/${name}.conf`;

/** wg-quick up : renvoie les lignes « [#] … » et les erreurs, et monte l'interface si tout va bien. */
export function mountWg(j: Game, name: string, byService: boolean): { lines: string[]; error: string | null } {
  const l = lan(j);
  const text = j.read(confFor(name));
  if (text === null) return { lines: [], error: `wg-quick: \`${confFor(name)}' does not exist` };
  if (wg(j)[name] || l?.interfaces[name]) return { lines: [], error: `wg-quick: \`${name}' already exists` };
  const c = readConfWg(text);
  const lines = [`[#] ip link add ${name} type wireguard`, `[#] wg setconf ${name} /dev/fd/63`];
  if (c.errors.length) {
    // Comme wg-quick : l'interface créée est retirée.
    return { lines: [...lines, ...c.errors, `[#] ip link delete dev ${name}`], error: '' };
  }
  for (const a of c.addresses) lines.push(`[#] ip -4 address add ${a} dev ${name}`);
  lines.push(`[#] ip link set mtu 1420 up dev ${name}`);
  // Comme wg-quick : une route pour chaque AllowedIPs que le réseau de l'interface ne couvre pas déjà.
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

// ——— Les pairs distants ———

/** Un appareil sur internet qui se connecte au routeur par WireGuard (le portable de Malik…). */
export interface Remote {
  name: string;
  // Son adresse publique (d'où viennent ses paquets UDP).
  address: string;
  // Sa clé publique (sa clé privée ne quitte jamais l'appareil).
  key: string;
  // Son fichier de configuration, que le chapitre fait compléter (chemin
  // écrit avec les noms français, comme ceux des chapitres : voir chemin()).
  conf: string;
  // Ce qu'il essaie de joindre à travers le tunnel.
  to: string;
  port: number;
  // Un site entier derrière ce pair (un autre routeur) : son réseau, et l'appareil d'où part l'échange.
  network?: string;
  source?: string;
  // Derrière la box de son fournisseur (NAT) : on ne peut pas le joindre sans qu'il garde le passage ouvert.
  behindNat?: boolean;
}

export type TunnelState =
  | 'eteint' // pas d'interface WireGuard montée
  | 'conf' // la configuration du pair est incomplète ou fausse
  | 'adresse' // Endpoint : pas le routeur, ou pas le bon port
  | 'filtre' // la chaîne input jette l'UDP
  | 'cle-routeur' // le pair n'a pas la clé publique du routeur
  | 'inconnu' // le routeur ne connaît pas la clé publique du pair
  | 'autorisees' // l'adresse d'où part l'échange n'est pas dans les AllowedIPs du pair (côté routeur)
  | 'route' // la destination n'est pas dans les AllowedIPs du pair (de son côté)
  | 'endormi' // le pair est derrière une box et ne garde pas le passage ouvert (PersistentKeepalive)
  | 'transfert' // ip_forward, ou la chaîne forward
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

/** La poignée de main entre le pair et le routeur : ce qu'il faut pour qu'ils se reconnaissent. */
/** La configuration d'un pair distant, lue dans son fichier (sous son nom dans la langue). */
export const remoteConf = (j: Game, d: Remote): ConfWg => readConfWg(j.read(path(j.t, d.conf)) ?? '');

function handshake(j: Game, d: Remote, o: Options): Handshake | { state: TunnelState; name?: string } {
  const interfaces = o.interfaces ?? wg(j);
  const ruleset = o.ruleset ?? nft(j);
  const transfer = o.transfer ?? routing(j);
  const inputs = Object.entries(interfaces);
  if (!inputs.length) return { state: 'eteint' };
  const client = remoteConf(j, d);
  const routerPeer = client.peers[0];
  const clientAddress = client.addresses[0]?.split('/')[0];
  if (client.errors.length || !routerPeer?.endpoint || !clientAddress) return { state: 'conf' };
  const [host, port] = routerPeer.endpoint.split(':');
  if (host !== o.publicAddress && !o.names.includes(host)) return { state: 'adresse' };
  const iface = inputs.find(([, i]) => i.conf.port === Number(port));
  if (!iface) return { state: 'adresse' };
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
  if (!traverse(ruleset, 'input', 'filter', input).pass) return { state: 'filtre', name };
  if (!i.conf.key || routerPeer.key !== isPublic(i.conf.key)) return { state: 'cle-routeur', name };
  const peer = i.conf.peers.find((p) => p.key === d.key);
  if (!peer) return { state: 'inconnu', name };
  return { name, peer, client, clientAddress, ruleset, transfer };
}

// L'interface du routeur par où passe une adresse (hors tunnel).
const outputFor = (j: Game, ip: string, except: string) =>
  Object.values(lan(j)?.interfaces ?? {}).find((x) => x.name !== except && x.up && !x.wireguard && x.addresses.some((a) => inside(ip, networkFor(a))));

// Un échange à travers la chaîne forward : le premier paquet, puis la réponse.
function traversesForward(r: Ruleset, iif: string, oif: string, saddr: string, daddr: string, port: number): boolean {
  const go = { iif, oif, saddr, daddr, proto: 'tcp' as const, sport: 49152, dport: port, ct: 'new' as const, size: 60 };
  const back = { ...go, iif: oif, oif: iif, saddr: daddr, daddr: saddr, sport: port, dport: 49152, ct: 'established' as const, size: 1500 };
  return traverse(r, 'forward', 'filter', go).pass && traverse(r, 'forward', 'filter', back).pass;
}

/** Où en est le pair quand il essaie de joindre d.vers à travers le tunnel (maintenant, ou au démarrage). */
export function tunnelState(j: Game, d: Remote, o: Options): { state: TunnelState; name?: string } {
  const p = handshake(j, d, o);
  if ('state' in p) return p;
  const { name, peer, client, clientAddress, ruleset, transfer } = p;
  const source = d.source ?? clientAddress;
  if (!peer.allowed.some((a) => inside(source, a))) return { state: 'autorisees', name };
  if (!isIp(d.to) || !client.peers[0].allowed.some((a) => inside(d.to, a))) return { state: 'route', name };
  if (!transfer) return { state: 'transfert', name };
  const output = outputFor(j, d.to, name);
  if (!traversesForward(ruleset, name, output?.name ?? '', source, d.to, d.port)) return { state: 'transfert', name };
  return { state: 'ok', name };
}

/** Un échange dans l'autre sens : un appareil du réseau local (son adresse) vers une adresse derrière le pair. */
export function stateToRemote(j: Game, d: Remote, forEachOf: string, to: string, port: number, o: Options): { state: TunnelState; name?: string } {
  const p = handshake(j, d, o);
  if ('state' in p) return p;
  const { name, peer, client, ruleset, transfer } = p;
  // Côté routeur, c'est l'AllowedIPs du pair qui dit par où envoyer (et les routes de wg-quick).
  if (!peer.allowed.some((a) => inside(to, a))) return { state: 'autorisees', name };
  // Côté pair, la réponse doit pouvoir repartir dans le tunnel (et le paquet être accepté).
  if (!client.peers[0].allowed.some((a) => inside(forEachOf, a))) return { state: 'route', name };
  if (d.behindNat && !client.peers[0].keepalive) return { state: 'endormi', name };
  if (!transfer) return { state: 'transfert', name };
  const input = outputFor(j, forEachOf, name);
  if (!traversesForward(ruleset, input?.name ?? '', name, forEachOf, to, port)) return { state: 'transfert', name };
  return { state: 'ok', name };
}
