// Story "The Hive" — chapter "Working from home": Malik wants to open the
// NAS's folders from home. Certainly not by exposing the file share to the
// internet: a WireGuard VPN on the router.
//   - keys for the router (wg genkey | tee … | wg pubkey), without leaving
//     the private key readable by everyone (umask 077);
//   - /etc/wireguard/wg0.conf: [Interface] (Address, ListenPort, PrivateKey)
//     and a [Peer] for Malik's laptop (its public key, AllowedIPs);
//   - complete malik-laptop.conf: the router's public key, Endpoint,
//     AllowedIPs (the offices' network);
//   - open the UDP port in the input chain, and wg0 → offices in forward;
//   - wg-quick up wg0, then systemctl enable wg-quick@wg0.
// Objective checked on the state: Malik's laptop (Lan.remotes) completes its
// handshake and reaches the NAS, now AND at the next boot (service enabled,
// files), ssh stays open to the admin workstation, and no copy of the
// router's private key is readable by other accounts.
// Sources: https://www.wireguard.com/quickstart/, https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html, https://wiki.debian.org/WireGuard

import { d, f, type Chapter, type Directory, type Node } from '../world';
import type { Game } from '../shell';
import { toBoot, nft } from '../nftables';
import { sysctlToBoot } from '../commands/nftables';
import { publicFields, serviceWg } from '../commands/wireguard';
import { confFor, tunnelState, readConfWg, isPublic, wg, type Remote, type TunnelState } from '../wireguard';
import { systemd } from '../systemd';
import type { Shell } from '../shell';
import { FLUX, fluxFor, openSsh } from './zones';
import {
  hiveAccounts,
  dnsmasqVlan,
  interfacesVlan,
  M,
  hiveWorld,
  PASSWORD,
  initialiseFirewall,
  NFTABLES_ZONES,
  newLan,
  ROUTER_SYSCTL,
  hiveSystemd,
  hivePlan,
} from './hive';

// The private key of Malik's laptop (the example from WireGuard's documentation): it never leaves the laptop.
const MALIK_KEY = 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=';
export const MALIK_PUBLIC = isPublic(MALIK_KEY)!;
const LAPTOP = `${M}/malik-laptop.conf`;

export const MALIK: Remote = { name: 'malik-laptop', address: '198.51.100.23', key: MALIK_PUBLIC, conf: LAPTOP, to: '10.10.10.5', port: 445 };

const publicOf = (j: Game) => publicFields(j as Shell);
const now = (j: Game) => tunnelState(j, MALIK, publicOf(j));

// At the next boot: wg-quick@wg0 if it is enabled (the file), nftables if it is enabled, the sysctl files.
function toReboot(j: Game): TunnelState {
  const sd = systemd(j);
  const interfaces: Record<string, { conf: ReturnType<typeof readConfWg>; byService: boolean }> = {};
  for (const [name, s] of Object.entries(sd?.services ?? {})) {
    const m = /^wg-quick@(.+)$/.exec(name);
    if (!m || !s.active) continue;
    const c = readConfWg(j.read(confFor(m[1])) ?? '');
    if (j.read(confFor(m[1])) !== null && !c.errors.length) interfaces[m[1]] = { conf: c, byService: true };
  }
  const ruleset = (sd?.services.nftables?.active && toBoot(j)) || { tables: [] };
  const transfer = sysctlToBoot(j, 'net.ipv4.ip_forward', '0') === '1';
  return tunnelState(j, MALIK, { ...publicOf(j), interfaces, ruleset, transfer }).state;
}
const sshToReboot = (j: Game) => openSsh((systemd(j)?.services.nftables?.active && toBoot(j)) || { tables: [] });

// The private keys in use (those of the files in /etc/wireguard).
function privateKeys(j: Game): string[] {
  const directory = j.find('/etc/wireguard');
  if (directory?.type !== 'directory') return [];
  return Object.keys(directory.children)
    .filter((n) => n.endsWith('.conf'))
    .map((n) => readConfWg(j.read(`/etc/wireguard/${n}`) ?? '').key)
    .filter((c): c is string => !!c);
}

// A file readable by any account (neither owner nor in the group): r for others, and x on every directory of the path.
const forAll = (n: Node, right: 'r' | 'x') => (n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--'))[right === 'r' ? 6 : 8] !== '-';

/** A copy of the router's private key that everyone can read? */
export function exposedKey(j: Game): string | null {
  const keys = privateKeys(j);
  if (!keys.length) return null;
  const search = (n: Node, path: string): string | null => {
    if (n.type === 'file') return forAll(n, 'r') && keys.some((c) => (j.read(path) ?? '').includes(c)) ? path : null;
    if (!forAll(n, 'x') || path === '/proc') return null;
    for (const [name, e] of Object.entries((n as Directory).children)) {
      const r = search(e, `${path === '/' ? '' : path}/${name}`);
      if (r) return r;
    }
    return null;
  };
  return search(j.root, '/');
}

const finished = (j: Game) => now(j).state === 'ok' && toReboot(j) === 'ok' && openSsh(nft(j)) && sshToReboot(j) && !exposedKey(j);

export const vpn: Chapter = {
  id: 'remote-work',
  number: 4,
  plan: hivePlan({ remoteWork: true }),
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'nano',
    'cp',
    'mv',
    'rm',
    'chmod',
    'umask',
    'echo',
    'tee',
    'sudo',
    'id',
    'whoami',
    'ip',
    'ping',
    'systemctl',
    'journalctl',
    'reboot',
    'sysctl',
    'nft',
    'conntrack',
    'wg',
    'wg-quick',
  ],
  home: M,
  welcome: 'email_malik.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: (t) => {
    const sd = hiveSystemd({ 'wg-quick@wg0': serviceWg('wg0') });
    sd.services.nftables.active = true;
    sd.services.nftables.state = 'active';
    return { lan: { ...newLan(t, true), flux: fluxFor(t, FLUX), remotes: [MALIK] }, systemd: sd, nft: { tables: [] }, wg: {} };
  },
  initialise: initialiseFirewall,
  createWorld: (t) =>
    hiveWorld({
      interfaces: interfacesVlan(t),
      dnsmasq: dnsmasqVlan(t),
      nftables: NFTABLES_ZONES,
      sysctl: ROUTER_SYSCTL,
      etc: { wireguard: d({}, undefined, { owner: 'root', mode: 'rwx------' }) },
      home: {
        'email_malik.txt': f(t('remote-work-email-malik', { key: MALIK_PUBLIC })),
        'malik-laptop.conf': f(t('remote-work-laptop-malik'), { lines: true }),
      },
    }),
  events: [
    { id: 'key-exposed', condition: (j) => !!exposedKey(j), message: (j) => j.t('remote-work-event-key-exposed', { file: exposedKey(j)! }) },
    { id: 'filter', condition: (j) => now(j).state === 'filtered', message: (j) => j.t('remote-work-event-filter') },
    {
      id: 'handshake',
      condition: (j) => Object.keys(wg(j)).length > 0 && ['conf', 'address', 'router-key', 'unknown'].includes(now(j).state),
      message: (j) => j.t('remote-work-event-handshake'),
    },
    {
      id: 'without-nas',
      condition: (j) => ['allowed-ips', 'route', 'forwarding'].includes(now(j).state),
      message: (j) => j.t('remote-work-event-without-nas'),
    },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-event-ssh') },
    { id: 'in-place', condition: (j) => now(j).state === 'ok' && toReboot(j) !== 'ok', message: (j) => j.t('remote-work-event-in-place') },
    { id: 'end', condition: finished, message: (j) => j.t('remote-work-event-end') },
  ],
};
