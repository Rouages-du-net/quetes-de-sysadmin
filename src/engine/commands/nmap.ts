// nmap, the network explorer (https://nmap.org/book/man.html), on the
// story's network (src/engine/scan.ts). Output in English, like the real
// tool. Options understood: -sV -sT -sS -sn -Pn -n -F -p -oN --open -T0..5 -v;
// the others give nmap's message.

import { scan, VERSION_NMAP, type Options, type ScanHost } from '../scan';
import { isIp6, machineAt, resolve, tcpState, vantage, type Family } from '../ipv6';
import type { Shell } from '../shell';
import type { Command } from './index';
import { help } from './manual';

const INVALID = (o: string) => `nmap: invalid option -- '${o}'\nSee the output of nmap -h for a summary of options.`;

// A list of ports: 22,80; 1-1024; - (all).
function readPorts(spec: string): number[] | 'all' | null {
  if (spec === '-') return 'all';
  const ports: number[] = [];
  for (const chunk of spec.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(chunk);
    if (!m) return null;
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    if (a < 1 || b > 65535 || a > b) return null;
    if (b - a > 2000) return 'all';
    for (let p = a; p <= b; p++) ports.push(p);
  }
  return ports;
}

export const NMAP: Record<string, Command> = {
  nmap: {
    ownOptions: true,
    launch: ({ args, game }) => {
      // -h: the summary of options, like --help.
      if (args.includes('-h')) return help('nmap', NMAP.nmap, game.t);
      if (args.includes('-V') || args.includes('--version'))
        return `Nmap version ${VERSION_NMAP} ( https://nmap.org )\nPlatform: x86_64-pc-linux-gnu\nCompiled with: liblua-5.4.7 openssl-3.5.1 libssh2-1.11.1 libz-1.3.1 libpcre2-10.45 libpcap-1.10.5 nmap-libdnet-1.12 ipv6\nCompiled without:\nAvailable nsock engines: epoll poll select`;
      const o: Options = { versions: false, ping: false, withoutPing: false, numbers: false, onlyOpen: false, ports: null };
      const targets: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-6') o.family = 6;
        else if (a === '-4') o.family = 4;
        else if (a === '-sV') o.versions = true;
        else if (a === '-sT') continue;
        else if (a === '-sS') {
          if (game.who !== 'root') return game.error("You requested a scan type which requires root privileges.\nQUITTING!", 1);
        } else if (a === '-sn') o.ping = true;
        else if (a === '-Pn') o.withoutPing = true;
        else if (a === '-n') o.numbers = true;
        else if (a === '-v' || a === '-vv') continue;
        else if (a === '--open') o.onlyOpen = true;
        else if (a === '-F') o.ports ??= 'fast';
        else if (/^-T[0-5]$/.test(a)) continue;
        else if (a === '-oN') {
          const f = args[++i];
          if (!f) return game.error('nmap: option requires an argument -- \'oN\'\nSee the output of nmap -h for a summary of options.', 1);
          o.file = f;
        } else if (a === '-p' || a.startsWith('-p')) {
          const spec = a === '-p' ? args[++i] : a.slice(2);
          if (spec === undefined) return game.error("nmap: option requires an argument -- 'p'\nSee the output of nmap -h for a summary of options.", 1);
          const ports = readPorts(spec);
          if (!ports) return game.error(`Your port specifications are illegal.  Example of proper form: "-100,200-1024,T:3000-4000,U:60000-"\nQUITTING!`, 1);
          o.ports = ports;
        } else if (a.startsWith('--')) return game.error(`nmap: unrecognized option '${a}'\nSee the output of nmap -h for a summary of options.`, 1);
        else if (a.startsWith('-')) return game.error(INVALID(a.slice(1, 2)), 1);
        else targets.push(a);
      }
      if (!targets.length) return game.error(game.t('nmap-none-target'), 1);
      // An IPv6 address needs -6 (nmap doesn't switch family on its own).
      const v6Literal = targets.find((t) => isIp6(t));
      if (v6Literal && o.family !== 6)
        return game.error(`Starting Nmap ${VERSION_NMAP} ( https://nmap.org )\n${v6Literal} looks like an IPv6 target specification -- you have to use the -6 option.\nWARNING: No targets were specified, so 0 hosts scanned.\nNmap done: 0 IP addresses (0 hosts up) scanned in 0.03 seconds`, 1);
      if (vantage(game)) targets.splice(0, targets.length, ...vantageTargets(game, targets, o.family ?? 4));
      const r = scan(game, targets, o, `nmap ${args.join(' ')}`);
      if ('error' in r) return game.error(r.error, 1);
      let note = '';
      if (o.file) {
        const refusal = game.place('nmap', o.file, { type: 'file', content: r.file, lines: true, owner: game.who });
        if (refusal) note = `\nFailed to open normal output file ${o.file} for writing: ${refusal}`;
      }
      return r.output + note;
    },
  },
};

// What nmap -sV recognises on the story's server.
const PRODUCTS: Record<number, [string, string]> = {
  22: ['ssh', 'OpenSSH 10.0p2 Debian 7 (protocol 2.0)'],
  53: ['domain', 'ISC BIND 9.20.9 (Debian Linux)'],
  80: ['http', 'nginx 1.26.3'],
  443: ['https', 'nginx 1.26.3'],
  3000: ['http', 'Node.js Express framework'],
  5432: ['postgresql', 'PostgreSQL DB 15.0 - 15.x'],
  8080: ['http', 'Node.js Express framework'],
};

/** From a vantage point on the internet: the targets resolved in the scan's family, and the story's server as a host whose ports follow its state. */
function vantageTargets(game: Shell, targets: string[], family: Family): string[] {
  const v = vantage(game)!;
  const hosts: ScanHost[] = [];
  const out = targets.map((t) => {
    const found = resolve(game, t, family);
    if (!found.length) return t;
    const address = found[0];
    const server = machineAt(game, address, family);
    if (server && !hosts.some((h) => h.address === address)) {
      const literal = isIp6(t) || /^\d+\.\d+\.\d+\.\d+$/.test(t);
      const probe = (_: unknown, port: number) => {
        const s = tcpState(server, family, family === 6 ? v.v6 : v.v4, address, port);
        return s === 'open' ? 'open' : s === 'refused' ? 'closed' : 'filtered';
      };
      // A server whose IPv6 is cut off (neighbour discovery dropped) doesn't even answer the ping probe.
      if (tcpState(server, family, family === 6 ? v.v6 : v.v4, address, 22) !== 'unreachable')
        hosts.push({ address, names: literal ? [] : [t], latency: 0.018, probe, services: Object.entries(PRODUCTS).map(([p, [service, product]]) => ({ port: Number(p), service, product })) });
    }
    return address;
  });
  game.state.scan = { hosts, scope: hosts.map((h) => h.address) };
  return out;
}
