// curl, ping (and ping6) and nc on a machine that speaks IPv6 (../ipv6.ts):
// the story's server, or a vantage point on the internet (state.vantage)
// that looks at it. Both address families: -4, -6, a name's AAAA and A
// records, literal addresses ([2001:db8::80] in a URL, fe80::1%eth0 for a
// link-local address, whose interface must be given).
// Outputs of curl 8 (-v: "Trying [addr]:port...", happy eyeballs: IPv6
// first, then IPv4), iputils ping (IPv6: "56 data bytes"; a link-local
// address without a zone: the warning and "connect: Invalid argument"),
// netcat-openbsd.
// Sources: https://curl.se/docs/manpage.html (-4, -6, -v, --connect-timeout),
// https://everything.curl.dev/usingcurl/connections/name.html (happy eyeballs, RFC 8305),
// https://manpages.debian.org/trixie/iputils-ping/ping.8.en.html,
// https://manpages.debian.org/trixie/netcat-openbsd/nc.1.en.html
// Differences: no real timing (the times shown are computed); a filtered
// port answers curl at once with its timeout's message instead of waiting.

import type { Shell } from '../shell';
import { httpRequest, nginxSockets, answerApp, type App, type Configuration, type Response } from '../nginx';
import { systemd } from '../systemd';
import { lan, reach } from '../lan';
import {
  echoState,
  isIp6,
  isLinkLocal,
  listens,
  machineAt,
  normalise6,
  ownAddresses,
  resolve,
  routerOf,
  sync6,
  tcpState,
  unreachableFrom,
  vantage,
  defaultRoute6,
  type Family,
  type TcpState,
} from '../ipv6';

const CURL = 'curl/8.14.1';
const isIp4 = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Is this machine one where these commands take over (an IPv6 vantage, or a machine with an IPv6 link)? */
export const speaks6 = (game: Shell) => !!game.state.vantage || !!lan(game)?.ra;

/** This machine's source address towards a destination of this family. */
function sourceFor(game: Shell, family: Family, local: boolean, to: string): string {
  const v = vantage(game);
  if (v) return family === 6 ? v.v6 : v.v4;
  if (local) return to;
  const own = ownAddresses(game, family).filter((a) => (family === 6 ? !isLinkLocal(a) && a !== '::1' : !a.startsWith('127.')));
  return own[0] ?? (family === 6 ? '::1' : '127.0.0.1');
}

/** Where a TCP connection to this address ends up, from this machine. */
export function connect(game: Shell, family: Family, address: string, port: number): { state: TcpState; target: Shell | null; local: boolean; source: string } {
  sync6(game);
  const own = !vantage(game) && (ownAddresses(game, family).includes(address) || address === '::1' || address.startsWith('127.'));
  if (own) return { state: listens(game, family, address, port) ? 'open' : 'refused', target: game, local: true, source: address };
  const source = sourceFor(game, family, false, address);
  // From the server itself, without a route for this family: nothing leaves.
  if (!vantage(game) && family === 6 && !defaultRoute6(game, lan(game)!)) return { state: 'unreachable', target: null, local: false, source };
  const target = machineAt(game, address, family);
  if (!target || target === game) {
    const unreachable = family === 6 && !!unreachableFrom(game, address);
    return { state: unreachable ? 'unreachable' : 'filtered', target: null, local: false, source };
  }
  return { state: tcpState(target, family, source, address, port), target, local: false, source };
}

// ——— curl ———

interface Url {
  scheme: string;
  host: string;
  port: number;
  path: string;
}

/** A URL, IPv6 literals in brackets included. */
export function parseUrl(url: string): Url | null {
  const m = /^(?:(https?):\/\/)?(\[[0-9a-fA-F:.]+(?:%[\w.]+)?\]|[^/:[\]]+)(?::(\d+))?(.*)$/.exec(url);
  if (!m) return null;
  const scheme = m[1] ?? 'http';
  return { scheme, host: m[2], port: Number(m[3] ?? (scheme === 'https' ? 443 : 80)), path: m[4] || '/' };
}

const bracket = (family: Family, a: string) => (family === 6 ? `[${a}]` : a);

/** The app listening on this port of the target (state.apps, by loopback address). */
function appOn(target: Shell, family: Family, address: string, port: number): App | undefined {
  const apps = (target.state.apps ?? {}) as Record<string, App>;
  return apps[`${bracket(family, address)}:${port}`] ?? apps[`${family === 6 ? '[::1]' : '127.0.0.1'}:${port}`] ?? apps[`127.0.0.1:${port}`] ?? apps[`[::1]:${port}`];
}

const REASONS: Record<number, string> = { 200: 'OK', 301: 'Moved Permanently', 302: 'Found', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };

/** curl on an IPv6-aware machine. */
export function curl6(game: Shell, args: string[]): string {
  const WITH_VALUE = ['-H', '--header', '-o', '--output', '-X', '--request', '-A', '--user-agent', '-w', '--write-out', '--connect-timeout', '-m', '--max-time'];
  const letters = new Set<string>();
  const positional: string[] = [];
  let hostHeader: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (WITH_VALUE.includes(a)) {
      const v = args[++i] ?? '';
      const h = /^host:\s*(\S+)/i.exec(v);
      if ((a === '-H' || a === '--header') && h) hostHeader = h[1];
      continue;
    }
    if (a === '--ipv6') letters.add('6');
    else if (a === '--ipv4') letters.add('4');
    else if (a === '--verbose') letters.add('v');
    else if (a === '--head') letters.add('I');
    else if (a === '--include') letters.add('i');
    else if (a === '--silent') letters.add('s');
    else if (/^-[a-zA-Z46]+$/.test(a)) for (const c of a.slice(1)) letters.add(c);
    else if (!a.startsWith('-')) positional.push(a);
  }
  const url = positional[0];
  if (!url) return game.error("curl: try 'curl --help' for more information");
  if (letters.has('4') && letters.has('6')) letters.delete('4');
  const u = parseUrl(url);
  if (!u) return game.error('curl: (3) URL rejected: Malformed input to a URL function');
  const bare = u.host.replace(/^\[|\]$/g, '');
  const zone = bare.includes('%');
  const literal6 = isIp6(bare.split('%')[0]);
  if (u.host.startsWith('[') && !literal6) return game.error('curl: (3) URL rejected: Bad IPv6 address');
  const verbose = letters.has('v');
  const log: string[] = [];
  const families: Family[] = letters.has('6') ? [6] : letters.has('4') ? [4] : [6, 4];
  const found: Record<Family, string[]> = { 6: families.includes(6) ? resolve(game, u.host, 6) : [], 4: families.includes(4) ? resolve(game, u.host, 4) : [] };
  if (!found[6].length && !found[4].length) {
    if ((literal6 && letters.has('4')) || (isIp4(bare) && letters.has('6'))) return game.error(`curl: (6) Could not resolve host: ${bare}`);
    return game.error(`curl: (6) Could not resolve host: ${bare}`);
  }
  if (!literal6 && !isIp4(bare)) {
    log.push(`* Host ${bare}:${u.port} was resolved.`, `* IPv6: ${found[6].join(', ') || '(none)'}`, `* IPv4: ${found[4].join(', ') || '(none)'}`);
  }
  let connected: { family: Family; address: string; target: Shell; local: boolean; source: string } | null = null;
  let last: TcpState = 'refused';
  let time = 0;
  let port = 48712;
  // Happy eyeballs: the IPv6 addresses first, then IPv4 (a refusal moves on at once; a silence after 200 ms).
  for (const family of [6, 4] as Family[])
    for (const address of found[family]) {
      if (connected) break;
      log.push(`*   Trying ${bracket(family, address)}:${u.port}...`);
      const c = connect(game, family, address, u.port);
      if (c.state === 'open' && c.target) {
        connected = { family, address, target: c.target, local: c.local, source: c.source };
        break;
      }
      last = c.state;
      port += 7;
      if (c.state === 'refused') log.push(`* connect to ${address} port ${u.port} from ${c.source} port ${port} failed: Connection refused`);
      else if (c.state === 'unreachable') {
        time += 3071;
        log.push(`* connect to ${address} port ${u.port} from ${c.source} port ${port} failed: No route to host`);
      } else if (families.length === 1 || family === 4) {
        time += 134_982;
        log.push(`* connect to ${address} port ${u.port} from ${c.source} port ${port} failed: Connection timed out`);
      } else time += 200;
    }
  if (!connected) {
    const timeout = last === 'filtered' && families.length === 1;
    const message = `Failed to connect to ${bare.split('%')[0]} port ${u.port} after ${time} ms: Couldn't connect to server`;
    log.push(`* ${message}`, '* closing connection #0');
    return game.error([...(verbose ? log : []), `curl: (${timeout ? 28 : 7}) ${message}`].join('\n'));
  }
  const { family, address, target, local } = connected;
  log.push(`* Connected to ${bare.split('%')[0]} (${address}) port ${u.port}`, '* using HTTP/1.x');
  const nameSent = hostHeader ?? (literal6 ? `[${bare.split('%')[0]}]` : bare);
  log.push(`> ${letters.has('I') ? 'HEAD' : 'GET'} ${u.path} HTTP/1.1`, `> Host: ${nameSent}${u.port === 80 ? '' : `:${u.port}`}`, `> User-Agent: ${CURL}`, '> Accept: */*', '> ', '* Request completely sent off');
  const config: Configuration | null = target.state.nginx?.load ?? null;
  const nginxHere = !!config && systemd(target)?.services.nginx?.state === 'active' && nginxSockets(config).some((s) => s.port === u.port);
  const clientAddress = local ? (family === 6 ? '::1' : '127.0.0.1') : connected.source;
  let r: Response | null = null;
  if (nginxHere) r = httpRequest(target, nameSent.replace(/:\d+$/, ''), u.path, u.port, true, { address: local && !zone ? clientAddress : connected.source, time: systemd(target)?.clock ?? 0, agent: CURL });
  else {
    const app = appOn(target, family, address, u.port);
    if (app && systemd(target)?.services[app.service]?.state === 'active') {
      const a = answerApp(target, app, u.path, { headers: { host: nameSent }, address: clientAddress });
      r = { code: a.code, body: a.body, headers: [`HTTP/1.1 ${a.code} ${REASONS[a.code] ?? ''}`.trimEnd(), ...(a.headers ?? []), `Content-Type: ${a.type ?? 'text/html; charset=utf-8'}`, `Content-Length: ${new TextEncoder().encode(a.body).length}`] };
    }
  }
  if (!r) return game.error([...(verbose ? [...log, '* Empty reply from server', '* shutting down connection #0'] : []), 'curl: (52) Empty reply from server'].join('\n'));
  const head = r.headers.join('\n');
  const shown = letters.has('I') ? head : letters.has('i') ? `${head}\n\n${r.body}` : r.body;
  if (!verbose) return shown;
  const vHead = r.headers.map((h) => `< ${h}`).concat('< ').join('\n');
  return [...log, vHead, ...(letters.has('I') ? [] : [r.body]), `* Connection #0 to host ${bare.split('%')[0]} left intact`].join('\n');
}

// ——— ping ———

const ms = (v: number) => v.toFixed(3);

function statistics(host: string, n: number, time: number[], errors = 0): string[] {
  const received = time.length;
  const lines = ['', `--- ${host} ping statistics ---`, `${n} packets transmitted, ${received} received, ${errors ? `+${errors} errors, ` : ''}${Math.round((100 * (n - received)) / n)}% packet loss, time ${(n - 1) * 1001 + 3}ms`];
  if (received) {
    const avg = time.reduce((a, b) => a + b, 0) / received;
    lines.push(`rtt min/avg/max/mdev = ${ms(Math.min(...time))}/${ms(avg)}/${ms(Math.max(...time))}/0.080 ms`);
  }
  return lines;
}

/** ping (or ping6, which is ping -6) on an IPv6-aware machine. */
export function ping6(game: Shell, args: string[], forced: Family | null): string {
  let n = 4;
  let family: Family | null = forced;
  let iface: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-c') n = Math.max(1, Math.min(10, Number(args[++i]) || 4));
    else if (/^-c\d+$/.test(a)) n = Math.max(1, Math.min(10, Number(a.slice(2)) || 4));
    else if (a === '-I') iface = args[++i] ?? null;
    else if (a === '-6') family = 6;
    else if (a === '-4') family = 4;
    else if (/^-c\d+$/.test(a)) n = Math.max(1, Math.min(10, Number(a.slice(2))));
    else rest.push(a);
  }
  const host = rest[0];
  if (!host) return game.error('ping: usage error: Destination address required', 2);
  const [bare, scope] = host.split('%');
  const zone = scope ?? iface;
  if (family === 4 && isIp6(bare)) return game.error(`ping: ${host}: Address family for hostname not supported`, 2);
  if (family === 6 && isIp4(bare)) return game.error(`ping: ${host}: Address family for hostname not supported`, 2);
  const try6 = family !== 4 ? resolve(game, bare, 6) : [];
  const try4 = family !== 6 ? resolve(game, bare, 4) : [];
  const chosen: Family | null = try6.length && (family === 6 || isIp6(bare) || !try4.length) ? 6 : try4.length ? 4 : try6.length ? 6 : null;
  if (!chosen) return game.error(`ping: ${host}: ${family ? 'Address family for hostname not supported' : 'Name or service not known'}`, 2);
  const address = chosen === 6 ? try6[0] : try4[0];
  // IPv4 on a machine with a local network: the LAN model (lan.ts) answers.
  if (chosen === 4 && !vantage(game)) return ping4(game, host, address, n);
  sync6(game);
  const v = vantage(game);
  const l = lan(game);
  const shownHost = zone ? `${address}%${zone}` : address;
  if (chosen === 6 && isLinkLocal(address)) {
    if (!zone) return game.error('ping: Warning: IPv6 link-local address on ICMP datagram socket may require ifname or scope-id => use: address%<ifname|scope-id>\nping: connect: Invalid argument', 2);
    if (v || !l?.interfaces[zone]) return game.error(`ping: ${host}: Name or service not known`, 2);
  }
  const literal = bare === address || normalise6(bare) === address || !!zone;
  const lines = [
    chosen === 6 ? (literal ? `PING ${shownHost} (${shownHost}) 56 data bytes` : `PING ${host} (${address}) 56 data bytes`) : `PING ${host} (${address}) 56(84) bytes of data.`,
  ];
  const time: number[] = [];
  let errors = 0;
  // What answers: this machine itself, the link's router, the story's server (from outside), or nobody.
  let answer: 'self' | 'router' | 'remote' | 'unreachable' | 'silent' | 'no-route' = 'silent';
  let from = '';
  const own = !v && (ownAddresses(game, chosen).includes(address) || address === '::1' || address.startsWith('127.'));
  const ra = routerOf(game);
  if (own) answer = 'self';
  // The link's router answers on its link (no route needed: the prefix is on the link).
  else if (!v && chosen === 6 && ra && (address === ra.router || address === ra.global)) answer = 'router';
  else if (!v && chosen === 6 && l && !defaultRoute6(game, l)) answer = 'no-route';
  else {
    const target = machineAt(game, address, chosen);
    if (target && target !== game) {
      const e = echoState(target, chosen, sourceFor(game, chosen, false, address), address);
      answer = e === 'reply' ? 'remote' : e === 'unreachable' ? 'unreachable' : 'silent';
    } else if (chosen === 6 && ra && (address === ra.global || address === ra.router) && v) answer = 'router';
    else if (chosen === 6 && unreachableFrom(game, address)) answer = 'unreachable';
    else answer = v ? 'silent' : 'remote';
    if (answer === 'unreachable') from = unreachableFrom(game, address) ?? '';
  }
  if (answer === 'no-route') return game.error('ping: connect: Network is unreachable', 2);
  for (let i = 1; i <= n; i++) {
    if (answer === 'silent') continue;
    if (answer === 'unreachable') {
      if (i <= 3) lines.push(`From ${from} icmp_seq=${i} Destination unreachable: Address unreachable`);
      errors = Math.min(n, 3);
      continue;
    }
    const t = answer === 'self' ? 0.031 + (i % 3) / 1000 : answer === 'router' ? 0.41 + ((i * 37) % 11) / 40 : 18.2 + ((i * 37) % 11) / 10;
    time.push(t);
    lines.push(`64 bytes from ${zone ? `${address}%${zone}` : address}: icmp_seq=${i} ttl=${answer === 'remote' ? 57 : 64} time=${t.toFixed(t < 10 ? 2 : 1)} ms`);
  }
  lines.push(...statistics(host, n, time, errors));
  game.status = time.length ? 0 : 1;
  return lines.join('\n');
}

// IPv4 from the server: itself, its LAN's gateway, or the internet (lan.ts's reach).
function ping4(game: Shell, host: string, address: string, n: number): string {
  const l = lan(game)!;
  const r = reach(l, address);
  if (r.what === 'no-route') return game.error('ping: connect: Network is unreachable', 2);
  const lines = [`PING ${host} (${address}) 56(84) bytes of data.`];
  const time: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (r.what === 'lost' || r.what === 'unreachable') continue;
    const t = r.what === 'local' ? 0.03 : r.what === 'device' ? 0.4 + ((i * 37) % 11) / 40 : 17.6 + ((i * 37) % 11) / 10;
    time.push(t);
    lines.push(`64 bytes from ${address}: icmp_seq=${i} ttl=${r.what === 'internet' ? 57 : 64} time=${t.toFixed(t < 10 ? 2 : 1)} ms`);
  }
  lines.push(...statistics(host, n, time));
  game.status = time.length ? 0 : 1;
  return lines.join('\n');
}

// ——— nc ———

const NC_SERVICES: Record<number, string> = { 22: 'ssh', 25: 'smtp', 53: 'domain', 80: 'http', 443: 'https', 3000: 'hbci', 5432: 'postgresql', 8080: 'http-alt' };

/** nc -zv [-4|-6] host port[-port], from an IPv6-aware machine. */
export function nc6(game: Shell, args: string[]): string {
  const letters = new Set(args.filter((a) => /^-[a-zA-Z46]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const positional = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-w');
  const [host, ports] = positional;
  const verbose = letters.has('v');
  if (!host || !ports) return game.error('usage: nc [-46CDdFhklNnrStUuvZz] [-I length] [-i interval] [-M ttl]\n\t  [-m minttl] [-O length] [-P proxy_username] [-p source_port]\n\t  [-q seconds] [-s sourceaddr] [-T keyword] [-V rtable] [-W recvlimit]\n\t  [-w timeout] [-X proxy_protocol] [-x proxy_address[:port]]\n\t  [destination] [port]');
  const families: Family[] = letters.has('6') ? [6] : letters.has('4') ? [4] : [6, 4];
  let address: string | null = null;
  let family: Family = 6;
  for (const f of families) {
    const r = resolve(game, host, f);
    if (r.length) {
      [address, family] = [r[0], f];
      break;
    }
  }
  if (!address) return game.error(`nc: getaddrinfo for host "${host}" port ${ports}: ${letters.has('6') || letters.has('4') ? 'Address family for hostname not supported' : 'Name or service not known'}`, 1);
  const [start, end = start] = ports.split('-').map(Number);
  const lines: string[] = [];
  let failed = false;
  for (let port = start; port <= end && port - start < 1024; port++) {
    const c = connect(game, family, address, port);
    const target = isIp6(host) || isIp4(host) ? host : `${host} (${normalise6(address) ?? address})`;
    if (c.state === 'open') {
      if (verbose) lines.push(`Connection to ${target} ${port} port [tcp/${NC_SERVICES[port] ?? '*'}] succeeded!`);
    } else {
      failed = true;
      if (verbose || start === end)
        game.error(
          c.state === 'filtered'
            ? `nc: connect to ${target} port ${port} (tcp) timed out: Operation now in progress`
            : c.state === 'unreachable'
              ? `nc: connect to ${target} port ${port} (tcp) failed: No route to host`
              : `nc: connect to ${target} port ${port} (tcp) failed: Connection refused`,
        );
    }
  }
  game.status = failed && start === end ? 1 : 0;
  return lines.join('\n');
}
