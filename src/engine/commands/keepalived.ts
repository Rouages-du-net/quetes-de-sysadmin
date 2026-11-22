// keepalived's command (-t: the configuration test, -v), tcpdump on a
// story's VRRP link (the advertisements and ARP the nodes and routers send,
// see keepalived.ts), and pidof.
// Sources: https://www.keepalived.org/manpage.html (keepalived(8)),
// https://www.tcpdump.org/manpages/tcpdump.1.html and pcap-filter(7)
// (VRRP is IP protocol 112, printed by tcpdump's print-vrrp.c),
// https://manpages.debian.org/trixie/sysvinit-utils/pidof.8.en.html.

import type { Command } from './index';
import type { Shell } from '../shell';
import { CONF_FILE, VERSION, VRRP_GROUP, configTest, hasVrrp, nodeOf, vrrp, type Packet } from '../keepalived';
import type { Process } from './system';

function keepalived(game: Shell, args: string[]): string {
  if (args.includes('-v') || args.includes('--version'))
    return [`Keepalived ${VERSION}`, '', 'Copyright(C) 2001-2025 Alexandre Cassen, <acassen@gmail.com>', '', 'Built with kernel headers for Linux 6.12.0', 'Running on Linux 6.12.48+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.12.48-1 (2025-09-20)', 'Distro: Debian GNU/Linux 13 (trixie)'].join('\n');
  const test = args.find((a) => a === '-t' || a.startsWith('--config-test'));
  let file = CONF_FILE;
  const fi = args.findIndex((a) => a === '-f' || a === '--use-file');
  if (fi >= 0) file = args[fi + 1] ?? '';
  const eq = args.find((a) => a.startsWith('--use-file=') || a.startsWith('--config-test='));
  if (eq) file = eq.split('=')[1] || file;
  const unknown = args.find((a, i) => a.startsWith('-') && !['-t', '-f', '--use-file', '-l', '--log-console', '-D', '--log-detail', '-n', '--dont-fork'].includes(a) && !a.startsWith('--config-test') && !a.startsWith('--use-file=') && args[i - 1] !== '-f');
  if (unknown) return game.error(`keepalived: unrecognized option '${unknown}'\n${game.t('keepalived-usage')}`, 1);
  if (!test) return game.error(game.t('keepalived-not-by-hand'), 1);
  const n = game.find(file);
  if (!n || n.type !== 'file') return game.error(`Configuration file '${file}' is not a regular non-executable file`, 1);
  if (!game.can(n, 'r')) return game.error(`Configuration file '${file}' cannot be read: Permission denied`, 1);
  const problems = configTest(game.read(file) ?? '', file);
  if (!problems.length) return '';
  const errors = problems.filter((p) => !p.includes('Warning'));
  return game.error(problems.join('\n'), errors.length ? 1 : 0);
}

// ——— tcpdump ———

interface Filter {
  test: (p: Packet) => boolean;
}

/** A pcap-filter expression (a subset): vrrp, arp, proto N, ip proto N, host/src/dst ADDR, and, or, not, parentheses. */
function readFilter(words: string[]): Filter | null {
  let i = 0;
  const peek = () => words[i];
  const atom = (): ((p: Packet) => boolean) | null => {
    const w = words[i++];
    if (w === undefined) return null;
    if (w === '(') {
      const e = or();
      if (words[i++] !== ')') return null;
      return e;
    }
    if (w === 'not' || w === '!') {
      const e = atom();
      return e && ((p) => !e(p));
    }
    if (w === 'vrrp') return (p) => p.kind === 'vrrp';
    if (w === 'arp') return (p) => p.kind !== 'vrrp';
    if (w === 'ip') {
      if (peek() === 'proto') {
        i++;
        const v = words[i++];
        return v === '112' || v === 'vrrp' || v === '\\vrrp' ? (p) => p.kind === 'vrrp' : v ? () => false : null;
      }
      return (p) => p.kind === 'vrrp';
    }
    if (w === 'proto') {
      const v = words[i++];
      return v === '112' || v === 'vrrp' || v === '\\vrrp' ? (p) => p.kind === 'vrrp' : v ? () => false : null;
    }
    if (['tcp', 'udp', 'icmp', 'ip6', 'icmp6'].includes(w)) return () => false;
    if (w === 'port') return words[i++] ? () => false : null;
    const dir = w === 'src' || w === 'dst' ? w : null;
    if (dir && peek() === 'host') i++;
    if (dir || w === 'host') {
      const a = words[i++];
      if (!a) return null;
      return (p) => (dir !== 'dst' && (p.src === a || (p.kind !== 'vrrp' && p.target === a && dir === null))) || (dir !== 'src' && p.dst === a);
    }
    return null;
  };
  const and = (): ((p: Packet) => boolean) | null => {
    let left = atom();
    while (left && (peek() === 'and' || peek() === '&&')) {
      i++;
      const right = atom();
      if (!right) return null;
      const l = left;
      left = (p) => l(p) && right(p);
    }
    return left;
  };
  const or = (): ((p: Packet) => boolean) | null => {
    let left = and();
    while (left && (peek() === 'or' || peek() === '||')) {
      i++;
      const right = and();
      if (!right) return null;
      const l = left;
      left = (p) => l(p) || right(p);
    }
    return left;
  };
  if (!words.length) return { test: () => true };
  const e = or();
  if (!e || i < words.length) return null;
  return { test: e };
}

function tcpdump(game: Shell, args: string[]): string {
  let iface: string | null = null;
  let count: number | null = null;
  let numeric = false;
  let verbose = 0;
  let ether = false;
  const expr: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-i' || a === '--interface') iface = args[++i] ?? '';
    else if (a === '-c') count = Number(args[++i]);
    else if (/^-[nvelqtNS]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (l === 'n') numeric = true;
        if (l === 'v') verbose++;
        if (l === 'e') ether = true;
      }
    } else if (a.startsWith('-')) return game.error(`tcpdump: invalid option -- '${a.replace(/^-+/, '').charAt(0)}'\n${game.t('tcpdump-usage')}`, 1);
    else expr.push(...a.replace(/([()])/g, ' $1 ').trim().split(/\s+/));
  }
  if (count !== null && (!Number.isInteger(count) || count <= 0)) return game.error(`tcpdump: invalid packet count ${args[args.indexOf('-c') + 1] ?? ''}`, 1);
  const dev = iface ?? 'eth0';
  const lan = game.state.baseLan as { interfaces: Record<string, { mac: string }> } | undefined;
  if (dev !== 'any' && !lan?.interfaces[dev]) return game.error(`tcpdump: ${dev}: No such device exists\n(No such device exists)`, 1);
  if (game.who !== 'root') return game.error(`tcpdump: ${dev}: You don't have permission to perform this capture on that device\n(socket: Operation not permitted)`, 1);
  const filter = readFilter(expr);
  if (!filter) return game.error('tcpdump: can\'t parse filter expression: syntax error', 1);
  const head = [
    ...(verbose ? [] : ['tcpdump: verbose output suppressed, use -v[v]... for full protocol decode']),
    dev === 'any' ? 'listening on any, link-type LINUX_SLL2 (Linux cooked v2), snapshot length 262144 bytes' : `listening on ${dev}, link-type EN10MB (Ethernet), snapshot length 262144 bytes`,
  ];
  // Only the story's VRRP link (eth0 of a node) carries what the game simulates.
  const node = hasVrrp(game) ? nodeOf(game) : null;
  const onLink = !!node && (dev === 'eth0' || dev === 'any');
  const lines: string[] = [];
  let captured = 0;
  const p = game.principal;
  const advance = p.state.haAdvance as ((s: number) => void) | undefined;
  const limit = 10;
  if (onLink && advance) {
    const v = vrrp(game);
    const me = v.nodes[node!];
    let from = v.packets.length;
    for (let s = 0; s < limit && (count === null || captured < count); s++) {
      advance(1);
      const fresh = vrrp(game).packets.slice(from);
      from = vrrp(game).packets.length;
      for (const pk of fresh) {
        if (count !== null && captured >= count) break;
        // A unicast advert only shows on its two ends; multicast and broadcast everywhere.
        if (pk.kind === 'vrrp' && pk.dst !== VRRP_GROUP && pk.dst !== me.address && pk.src !== me.address) continue;
        if (pk.kind === 'arp-reply' && pk.dst !== me.address && pk.srcMac !== me.mac && pk.dst !== '192.0.2.254') continue;
        if (!filter.test(pk)) continue;
        captured++;
        lines.push(packetLine(game, pk, numeric, verbose, ether));
      }
    }
  }
  const interrupted = count === null || captured < count;
  const tail = [`${captured} packet${captured === 1 ? '' : 's'} captured`, `${captured} packet${captured === 1 ? '' : 's'} received by filter`, '0 packets dropped by kernel'];
  return [...head, ...lines, ...(interrupted ? [game.t('tcpdump-stopped'), '^C'] : []), ...tail].join('\n');
}

function stampOf(t: number): string {
  const d = new Date(t);
  const p = (x: number, w = 2) => String(x).padStart(w, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p((t % 1000) * 1000 + ((t / 1000) % 997), 6)}`;
}

function packetLine(game: Shell, pk: Packet, numeric: boolean, verbose: number, ether: boolean): string {
  const names: Record<string, string> = {};
  for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
    const [a, ...n] = line.trim().split(/\s+/);
    if (a && n[0] && !names[a]) names[a] = n[0];
  }
  const name = (a: string) => (numeric ? a : a === VRRP_GROUP ? 'vrrp.mcast.net' : (names[a] ?? a));
  const t = stampOf(pk.time);
  if (pk.kind !== 'vrrp') {
    const eth = ether ? `${pk.srcMac} > ${pk.kind === 'arp-reply' ? '00:00:5e:00:01:33' : 'ff:ff:ff:ff:ff:ff'}, ethertype ARP (0x0806), length 42: ` : '';
    if (pk.kind === 'arp-reply') return `${t} ${eth}ARP, Reply ${name(pk.target!)} is-at ${pk.srcMac}, length 28`;
    if (pk.kind === 'garp') return `${t} ${eth}ARP, Request who-has ${name(pk.target!)} (ff:ff:ff:ff:ff:ff) tell ${name(pk.target!)}, length 28`;
    return `${t} ${eth}ARP, Request who-has ${name(pk.target!)} tell ${name(pk.src)}, length 28`;
  }
  const dstMac = pk.dst === VRRP_GROUP ? '01:00:5e:00:00:12' : '52:54:00:6c:01:05';
  const eth = ether ? `${pk.srcMac} > ${dstMac}, ethertype IPv4 (0x0800), length 54: ` : '';
  const auth = pk.auth ? `authtype simple` : 'authtype none';
  const body = `VRRPv2, Advertisement, vrid ${pk.vrid}, prio ${pk.prio}, ${auth}, intvl ${pk.advertInt}s, length 20`;
  if (!verbose) return `${t} ${eth}IP ${name(pk.src)} > ${name(pk.dst)}: ${body}`;
  const addrs = `, addrs: ${(pk.vips ?? []).map((a) => a.split('/')[0]).join(',')}${pk.auth ? ` auth "${pk.auth.pass}"` : ''}`;
  return `${t} ${eth}IP (tos 0xc0, ttl 255, id 0, offset 0, flags [none], proto VRRP (112), length 40)\n    ${name(pk.src)} > ${name(pk.dst)}: vrrp ${name(pk.src)} > ${name(pk.dst)}: ${body}${addrs}`;
}

// ——— pidof ———

function pidof(game: Shell, args: string[]): string {
  const single = args.includes('-s');
  const names = args.filter((a) => !a.startsWith('-'));
  if (!names.length) {
    game.status = 1;
    return '';
  }
  const comm = (p: Process) => p.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '');
  const pids = ((game.state.process ?? []) as Process[])
    .filter((p) => !p.zombie && names.some((n) => comm(p) === n.split('/').at(-1)))
    .map((p) => p.pid)
    .sort((a, b) => b - a);
  if (!pids.length) {
    game.status = 1;
    return '';
  }
  return (single ? pids.slice(0, 1) : pids).join(' ');
}

export const KEEPALIVED_COMMANDS: Record<string, Command> = {
  keepalived: { section: 8, ownOptions: true, launch: ({ args, game }) => keepalived(game, args) },
  tcpdump: { section: 8, ownOptions: true, launch: ({ args, game }) => tcpdump(game, args) },
  pidof: { section: 8, ownOptions: true, launch: ({ args, game }) => pidof(game, args) },
  'keepalived.conf': { section: 5, launch: () => '' },
};

