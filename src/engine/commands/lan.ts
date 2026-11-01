// ip (iproute2), ifup and ifdown (ifupdown), on the simulated local network
// (../lan.ts). Outputs of iproute2 6 and ifupdown 0.8, in English.
// Sources: https://man7.org/linux/man-pages/man8/ip-address.8.html,
// https://man7.org/linux/man-pages/man8/ip-link.8.html,
// https://manpages.debian.org/trixie/ifupdown/ifup.8.en.html

import type { Shell } from '../shell';
import { cidr, create, unmount, inService, lan, readInterfaces, mount, networkFor, remove, toIp, type Interface, type Lan } from '../lan';
import { readDnsmasq } from '../dnsmasq';
import type { Command, Context } from './index';
import { colourise, sgr, type When } from '../colours';

const NOT_ALLOWED = 'RTNETLINK answers: Operation not permitted';

// Like ip: "eth1.10@eth1" for a VLAN.
const showsName = (i: Interface) => (i.vlan ? `${i.name}@${i.vlan.parent}` : i.name);

function linkState(l: Lan, i: Interface): { flags: string; state: string } {
  if (i.name === 'lo') return { flags: '<LOOPBACK,UP,LOWER_UP>', state: 'UNKNOWN' };
  if (i.wireguard) return { flags: i.up ? '<POINTOPOINT,NOARP,UP,LOWER_UP>' : '<POINTOPOINT,NOARP>', state: i.up ? 'UNKNOWN' : 'DOWN' };
  if (!i.up) return { flags: '<BROADCAST,MULTICAST>', state: 'DOWN' };
  if (!inService(l, i)) return { flags: '<NO-CARRIER,BROADCAST,MULTICAST,UP>', state: 'LOWERLAYERDOWN' };
  return { flags: '<BROADCAST,MULTICAST,UP,LOWER_UP>', state: 'UP' };
}

function linkLines(l: Lan, i: Interface, details: boolean): string[] {
  const n = l.order.indexOf(i.name) + 1;
  const { flags, state } = linkState(l, i);
  const lo = i.name === 'lo';
  const lines = [
    `${n}: ${showsName(i)}: ${flags} mtu ${lo ? 65536 : i.wireguard ? 1420 : 1500} qdisc ${lo || i.vlan || i.wireguard ? 'noqueue' : 'fq_codel'} state ${state} mode DEFAULT group default qlen 1000`,
    lo
      ? '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00'
      : i.wireguard
        ? '    link/none '
        : `    link/ether ${i.mac} brd ff:ff:ff:ff:ff:ff`,
  ];
  if (details && i.vlan) lines.push(`    vlan protocol 802.1Q id ${i.vlan.id} <REORDER_HDR>`);
  return lines;
}

function addressesLines(l: Lan, i: Interface): string[] {
  const [first, ...rest] = linkLines(l, i, false);
  return [
    first.replace(' mode DEFAULT', ''),
    ...rest,
    ...i.addresses.flatMap((a) => {
      const c = cidr(a)!;
      const brd = i.name === 'lo' || i.wireguard ? '' : ` brd ${toIp(c.broadcast)}`;
      return [`    inet ${a}${brd} scope ${i.name === 'lo' ? 'host' : 'global'} ${i.name}`, '       valid_lft forever preferred_lft forever'];
    }),
  ];
}

const short = (l: Lan, i: Interface, what: string) => {
  const { state } = linkState(l, i);
  return `${showsName(i).padEnd(16)} ${state.padEnd(14)} ${what}`.trimEnd();
};

function routes(l: Lan): string[] {
  const lines: string[] = [];
  if (l.gateway) lines.push(`default via ${l.gateway.via} dev ${l.gateway.dev} onlink`);
  for (const name of l.order) {
    const i = l.interfaces[name];
    if (!i || name === 'lo' || !i.up) continue;
    for (const a of i.addresses)
      lines.push(`${networkFor(a)} dev ${name} proto kernel scope link src ${a.split('/')[0]}${inService(l, i) ? '' : ' linkdown'}`);
    for (const r of i.routes ?? []) lines.push(`${r} dev ${name} scope link`);
  }
  return lines;
}

// ip -c[olor][=always|auto|never]: with no value, always (like iproute2).
// iproute2's colours: interface name in cyan, UP state in green and DOWN in
// red, MAC address in yellow, IPv4 in magenta, IPv6 in blue.
// Based on https://man7.org/linux/man-pages/man8/ip.8.html (-color).
function ipInColour(c: Context): string {
  let when: When = 'never';
  const args: string[] = [];
  for (const a of c.args) {
    const m = /^--?c(?:o(?:l(?:o(?:r)?)?)?)?(?:=(always|auto|never))?$/.exec(a);
    if (m) when = (m[1] as When | undefined) ?? 'always';
    else args.push(a);
  }
  const output = ip(c.game, args);
  return colourise(c, when) ? colourIp(output) : output;
}

const STATES: Record<string, string> = { UP: '32', DOWN: '31', LOWERLAYERDOWN: '31' };
export function colourIp(text: string): string {
  const state = (e: string) => sgr(STATES[e] ?? '', e);
  return text
    .split('\n')
    .map((l) => {
      // ip -br: name, state, addresses.
      const short = /^(\S+)(\s+)(UP|DOWN|UNKNOWN|LOWERLAYERDOWN)(\s*)(.*)$/.exec(l);
      if (short && !/^\d+:/.test(l))
        return sgr('36', short[1]) + short[2] + state(short[3]) + short[4] + short[5].replace(/[0-9a-f:.]+\/\d+/g, (a) => sgr(a.includes(':') ? '34' : '35', a));
      return l
        .replace(/^(\d+: )([^:@ ]+)/, (_, n, name) => n + sgr('36', name))
        .replace(/ state (\S+)/, (_, e) => ` state ${state(e)}`)
        .replace(/(link\/ether )(\S+)/, (_, a, mac) => a + sgr('33', mac))
        .replace(/^(\s+inet )(\S+)/, (_, a, adr) => a + sgr('35', adr))
        .replace(/^(\s+inet6 )(\S+)/, (_, a, adr) => a + sgr('34', adr));
    })
    .join('\n');
}

// The value following a keyword (dev eth0, name eth1.10…).
const after = (words: string[], word: string) => (words.includes(word) ? words[words.indexOf(word) + 1] : undefined);

function ip(game: Shell, args: string[]): string {
  const l = lan(game);
  if (!l) return game.error('Cannot open netlink socket: Operation not permitted', 1);
  const options = args.filter((a) => a.startsWith('-'));
  const [object = '', action = 'show', ...rest] = args.filter((a) => !a.startsWith('-'));
  const brief = options.some((o) => o === '-br' || o === '-brief');
  const details = options.some((o) => o === '-d' || o === '-details');
  const root = game.who === 'root';
  const interfaceFor = (name: string | undefined) => (name ? l.interfaces[name] : undefined);
  const missing = (name: string) => game.error(`Cannot find device "${name}"`, 1);
  const listing = (dev: string | undefined) =>
    (dev ? [interfaceFor(dev)].filter(Boolean) : l.order.map((n) => l.interfaces[n]).filter(Boolean)) as Interface[];

  if (['a', 'addr', 'address'].includes(object)) {
    if (['show', 'list', 'sh', 'ls'].includes(action)) {
      const dev = after(rest, 'dev') ?? rest.find((r) => r !== 'dev');
      if (dev && !interfaceFor(dev)) return missing(dev);
      return listing(dev)
        .flatMap((i) => (brief ? [short(l, i, i.addresses.join(' '))] : addressesLines(l, i)))
        .join('\n');
    }
    if (['add', 'del', 'delete'].includes(action)) {
      const address = rest[0];
      const dev = after(rest, 'dev');
      if (!address || !dev) return game.error('Not enough information: "dev" argument is required.', 1);
      if (!cidr(address)) return game.error(`Error: any valid prefix is expected rather than "${address}".`, 1);
      const i = interfaceFor(dev);
      if (!i) return missing(dev);
      if (!root) return game.error(NOT_ALLOWED, 2);
      const complete = address.includes('/') ? address : `${address}/32`;
      if (action === 'add') {
        if (i.addresses.includes(complete)) return game.error('Error: ipv4: Address already assigned.', 2);
        i.addresses.push(complete);
      } else {
        if (!i.addresses.includes(complete)) return game.error('Error: ipv4: Address not found.', 2);
        i.addresses = i.addresses.filter((a) => a !== complete);
      }
      return '';
    }
    if (action === 'flush') {
      const i = interfaceFor(after(rest, 'dev') ?? rest[0]);
      if (!i) return missing(after(rest, 'dev') ?? rest[0] ?? '');
      if (!root) return game.error(NOT_ALLOWED, 2);
      i.addresses = [];
      return '';
    }
  }

  if (['l', 'link'].includes(object)) {
    if (['show', 'list', 'sh', 'ls'].includes(action)) {
      const dev = after(rest, 'dev') ?? rest.find((r) => r !== 'dev');
      if (dev && !interfaceFor(dev)) return missing(dev);
      return listing(dev)
        .flatMap((i) =>
          brief
            ? [short(l, i, `${i.name === 'lo' ? '00:00:00:00:00:00' : i.wireguard ? '' : i.mac} ${linkState(l, i).flags}`.trim())]
            : linkLines(l, i, details),
        )
        .join('\n');
    }
    if (action === 'add') {
      const parent = after(rest, 'link');
      const name = after(rest, 'name');
      const type = after(rest, 'type');
      const id = Number(after(rest, 'id'));
      if (!name) return game.error('Not enough information: "dev" argument is required.', 1);
      if (type !== 'vlan') return game.error(`Error: Unknown device type.`, 2);
      if (!parent || !interfaceFor(parent)) return missing(parent ?? '');
      if (!Number.isInteger(id) || id < 1 || id > 4094) return game.error('Error: argument "id" is wrong: invalid VLAN id', 1);
      if (!root) return game.error(NOT_ALLOWED, 2);
      if (l.interfaces[name]) return game.error('RTNETLINK answers: File exists', 2);
      create(l, name, { parent, id });
      return '';
    }
    if (action === 'set') {
      const dev = after(rest, 'dev') ?? rest[0];
      const i = interfaceFor(dev);
      if (!i) return missing(dev ?? '');
      if (!rest.includes('up') && !rest.includes('down')) return game.error('Not enough of information: "dev" argument is required.', 1);
      if (!root) return game.error(NOT_ALLOWED, 2);
      i.up = rest.includes('up');
      return '';
    }
    if (['del', 'delete'].includes(action)) {
      const dev = after(rest, 'dev') ?? rest[0];
      if (!interfaceFor(dev)) return missing(dev ?? '');
      if (!root) return game.error(NOT_ALLOWED, 2);
      if (!interfaceFor(dev)!.vlan) return game.error('RTNETLINK answers: Operation not supported', 2);
      remove(l, dev!);
      return '';
    }
  }

  if (['r', 'ro', 'route'].includes(object)) {
    if (['show', 'list', 'sh', 'ls'].includes(action)) return routes(l).join('\n');
    if (['add', 'replace'].includes(action) && rest[0] === 'default') {
      const via = after(rest, 'via');
      if (!via) return game.error('Error: either "to" is duplicate, or "via" is a garbage.', 1);
      if (!root) return game.error(NOT_ALLOWED, 2);
      const dev = after(rest, 'dev') ?? Object.values(l.interfaces).find((i) => i.addresses.some((a) => dans4(via, a)))?.name;
      if (!dev) return game.error('Error: Nexthop has invalid gateway.', 2);
      if (action === 'add' && l.gateway) return game.error('RTNETLINK answers: File exists', 2);
      l.gateway = { via, dev };
      return '';
    }
    if (['del', 'delete'].includes(action) && rest[0] === 'default') {
      if (!root) return game.error(NOT_ALLOWED, 2);
      if (!l.gateway) return game.error('RTNETLINK answers: No such process', 2);
      l.gateway = null;
      return '';
    }
  }
  if (!object) return game.error(game.t('ip-usage'), 255);
  if (!['a', 'addr', 'address', 'l', 'link', 'r', 'ro', 'route'].includes(object))
    return game.error(`Object "${object}" is unknown, try "ip help".`, 255);
  return game.error(`Command "${action}" is unknown, try "ip ${object} help".`, 255);
}

// A gateway reachable through this interface address?
const dans4 = (ip: string, address: string) => {
  const c = cidr(address)!;
  const other = cidr(`${ip}/${c.length}`);
  return !!other && other.network === c.network;
};

// ifup / ifdown: -a (the "auto" interfaces), or names.
function ifupdown(game: Shell, args: string[], mounted: boolean): string {
  const program = mounted ? 'ifup' : 'ifdown';
  const l = lan(game);
  if (!l) return game.error(`${program}: couldn't open interfaces file "/etc/network/interfaces"`, 1);
  if (game.who !== 'root') return game.error(`${program}: failed to open lockfile /run/network/.ifstate.lock: Permission denied`, 1);
  const { stanzas, errors } = readInterfaces(game);
  if (errors.length) return game.error([...errors, `${program}: couldn't read interfaces file "/etc/network/interfaces"`].join('\n'), 1);
  const configured: string[] = (game.state.ifstate ??= []);
  const names = args.includes('-a')
    ? Object.values(stanzas)
        .filter((s) => s.auto)
        .map((s) => s.name)
    : args.filter((a) => !a.startsWith('-'));
  if (!names.length) return game.error(`Usage: ${program} <options> <ifaces...>`, 1);
  for (const name of names) {
    const s = stanzas[name];
    if (!s) {
      game.error(`${program}: unknown interface ${name}`, 1);
      continue;
    }
    if (mounted) {
      if (configured.includes(name)) {
        if (!args.includes('-a')) game.error(`ifup: interface ${name} already configured`, 0);
        continue;
      }
      const e = mount(game, l, s);
      if (e) game.error(`${e}\nifup: failed to bring up ${name}`, 1);
      else configured.push(name);
    } else {
      if (!configured.includes(name)) {
        if (!args.includes('-a')) game.error(`ifdown: interface ${name} not configured`, 0);
        continue;
      }
      unmount(l, s);
      game.state.ifstate = configured.filter((n) => n !== name);
    }
  }
  return '';
}

export const LAN: Record<string, Command> = {
  // dnsmasq --test: check the configuration (the service itself is controlled with systemctl).
  dnsmasq: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      if (args.includes('--test')) {
        const { errors } = readDnsmasq(game);
        return errors.length ? game.error(errors[0], 1) : 'dnsmasq: syntax check OK.';
      }
      return game.error(
        `dnsmasq: failed to create listening socket for port 53: ${game.who === 'root' ? 'Address already in use' : 'Permission denied'}`,
        2,
      );
    },
  },
  ip: { section: 8, ownOptions: true, launch: (c) => ipInColour(c) },
  ifup: { section: 8, ownOptions: true, launch: ({ args, game }) => ifupdown(game, args, true) },
  ifdown: { section: 8, ownOptions: true, launch: ({ args, game }) => ifupdown(game, args, false) },
  // The file's manual page (man 5 interfaces).
  interfaces: { section: 5, launch: () => '' },
};
