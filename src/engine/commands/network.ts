// Commandes réseau simulées : ping, dig, traceroute, curl. Leurs sorties
// reprennent le format des vrais outils (en anglais, comme sur un vrai
// système) ; les machines et les routes viennent de l'état de l'histoire :
//
//   etat.reseau = {
//     machines:   { ip: { ping: répond-il au ping ?, ms: aller-retour } },
//     noms:       { nom: ip }           ce que savent les vrais serveurs DNS
//     resolveurs: [ip]                  serveurs DNS qui répondent
//     routes:     { ip: [{ ip, nom?, ms }] }  sauts jusqu'à la destination
//     web:        { nom: { entetes: [...], corps } }
//   }
//
// Le serveur DNS utilisé est lu, comme sous Linux, dans /etc/resolv.conf
// (ligne « nameserver … »). Les adresses et les noms sont réservés à la
// documentation (RFC 5737, RFC 6761), sauf 9.9.9.9 (le résolveur public Quad9).

import type { Shell } from '../shell';
import type { Command } from './index';
import { httpRequest, appRequest, type Response } from '../nginx';
import { caddyRequest } from '../caddy';
import { dockerRequest } from '../docker';
import { digDns } from './bind';
import { covers, read } from '../tls';
import { systemd, toUtc } from '../systemd';
import { addressFor, interfaceFor, reach, lan } from '../lan';
import { pingTunnel } from './wireguard';

// Ce que curl ajoute quand la vérification du certificat échoue (curl 8).
const SSL_HELP = `More details here: https://curl.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the webpage mentioned above.`;

// La réponse d'une appli dans un conteneur, avec ses en-têtes.
function appResponse(game: Shell, r: { code: number; body: string; type?: string; headers?: string[] }): Response {
  const reasons: Record<number, string> = {
    200: 'OK',
    301: 'Moved Permanently',
    302: 'Found',
    403: 'Forbidden',
    404: 'Not Found',
    410: 'Gone',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  const date = new Date(toUtc(systemd(game)?.clock ?? 0)).toUTCString();
  return {
    code: r.code,
    body: r.body,
    headers: [
      `HTTP/1.1 ${r.code} ${reasons[r.code] ?? ''}`.trimEnd(),
      `Date: ${date}`,
      ...(r.headers ?? []),
      `Content-Type: ${r.type ?? 'text/html; charset=utf-8'}`,
      `Content-Length: ${new TextEncoder().encode(r.body).length}`,
    ],
  };
}

/** Le problème du certificat présenté, au format de curl ; null s'il est bon. */
export function checkCertificate(game: Shell, content: string | null, host: string): string | null {
  const c = read(content);
  if (!c) return 'SSL certificate problem: unable to get local issuer certificate';
  const now = toUtc(systemd(game)?.clock ?? 0);
  if (now > c.end) return 'SSL certificate problem: certificate has expired';
  if (now < c.start) return 'SSL certificate problem: certificate is not yet valid';
  if (!covers(c, host)) return `SSL: no alternative certificate subject name matches target hostname '${host}'`;
  return null;
}

interface Network {
  machines: Record<string, { ping: boolean; ms: number }>;
  names: Record<string, string>;
  resolvers: string[];
  routes: Record<string, { ip: string; name?: string; ms: number }[]>;
  web: Record<string, { headers: string[]; body: string }>;
}

// Les noms sous lesquels une machine avec nginx se joint elle-même : etat.nginx.noms.
const BASE_LOCAL = ['localhost', '127.0.0.1'];

const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
const ms = (v: number) => v.toFixed(3);

function dnsServers(game: Shell): string[] {
  const conf = game.read('/etc/resolv.conf') ?? '';
  return [...conf.matchAll(/^\s*nameserver\s+(\S+)/gm)].map((m) => m[1]);
}

// Résout un nom comme le ferait le système. `serveur` : forcer un serveur DNS.
function resolveName(game: Shell, name: string, server?: string): { ip: string } | { error: 'timeout' | 'unknown'; servers: string[] } {
  if (isIp(name)) return { ip: name };
  const r: Network = game.state.network;
  const servers = server ? [server] : dnsServers(game);
  if (!servers.some((s) => r.resolvers.includes(s))) return { error: 'timeout', servers };
  const ip = r.names[name.replace(/\.$/, '')];
  return ip ? { ip } : { error: 'unknown', servers };
}

// ping sur le réseau local : un appareil répond, ou l'interface du routeur dit qu'il est injoignable.
function pingLan(game: Shell, host: string, n: number): string {
  const l = lan(game)!;
  // Sans DNS local : une adresse, ou un nom d'appareil connu par le jeu (/etc/hosts n'est pas simulé ici).
  const ip = isIp(host) ? host : l.devices.find((a) => a.name === host) ? addressFor(l.devices.find((a) => a.name === host)!) : undefined;
  if (!ip) return game.error(`ping: ${host}: Name or service not known`, 2);
  const r = reach(l, ip);
  if (r.what === 'no-route') return game.error('ping: connect: Network is unreachable', 2);
  const lines = [`PING ${host} (${ip}) 56(84) bytes of data.`];
  const time: number[] = [];
  // Par un tunnel WireGuard : il faut un pair pour cette adresse, et que la poignée de main ait eu lieu.
  const tunnel = interfaceFor(l, ip)?.wireguard ? pingTunnel(game, ip) : null;
  for (let i = 1; i <= n; i++) {
    if (tunnel === 'no-peer') {
      lines.push('ping: sendmsg: Required key not available');
      continue;
    }
    if (tunnel === 'lost') continue;
    if (tunnel === 'ok') {
      const t = 23.1 + ((i * 37) % 11) / 10;
      time.push(t);
      lines.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=64 time=${t.toFixed(1)} ms`);
      continue;
    }
    if (r.what === 'injoignable') {
      if (i <= 3) lines.push(`From ${r.source} icmp_seq=${i} Destination Host Unreachable`);
      continue;
    }
    if (r.what === 'lost') continue;
    const t = r.what === 'local' ? 0.03 : r.what === 'device' ? 0.4 + ((i * 37) % 11) / 40 : 11.2 + ((i * 37) % 11) / 10;
    time.push(t);
    lines.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=${r.what === 'internet' ? 57 : 64} time=${t.toFixed(t < 10 ? 2 : 1)} ms`);
  }
  const received = time.length;
  lines.push(
    '',
    `--- ${host} ping statistics ---`,
    `${n} packets transmitted, ${received} received, ${r.what === 'injoignable' && !tunnel ? `+${Math.min(n, 3)} errors, ` : ''}${Math.round((100 * (n - received)) / n)}% packet loss, time ${(n - 1) * 1001 + 3}ms`,
  );
  if (received) {
    const moy = time.reduce((a, b) => a + b, 0) / received;
    lines.push(`rtt min/avg/max/mdev = ${ms(Math.min(...time))}/${ms(moy)}/${ms(Math.max(...time))}/0.080 ms`);
  }
  game.status = received ? 0 : 1;
  return lines.join('\n');
}

export const NETWORK: Record<string, Command> = {
  ping: {
    launch: ({ args, game }) => {
      let n = 4;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-c') n = Math.max(1, Math.min(10, Number(args[++i]) || 4));
        else rest.push(args[i]);
      }
      const host = rest[0];
      if (!host) return game.error('ping: usage error: Destination address required');
      // Une machine qui sert de routeur à un réseau local (lan.ts).
      if (lan(game)) return pingLan(game, host, n);
      const res = resolveName(game, host);
      if ('error' in res)
        return game.error(`ping: ${host}: ${res.error === 'timeout' ? 'Temporary failure in name resolution' : 'Name or service not known'}`);
      const r: Network = game.state.network;
      const m = r.machines[res.ip];
      const jumps = r.routes[res.ip]?.length ?? 1;
      const lines = [`PING ${host} (${res.ip}) 56(84) bytes of data.`];
      const time: number[] = [];
      if (m?.ping)
        for (let i = 1; i <= n; i++) {
          const t = m.ms + ((i * 37) % 11) / 20;
          time.push(t);
          lines.push(`64 bytes from ${res.ip}: icmp_seq=${i} ttl=${65 - jumps} time=${t.toFixed(t < 10 ? 2 : 1)} ms`);
        }
      const received = time.length;
      lines.push(
        '',
        `--- ${host} ping statistics ---`,
        `${n} packets transmitted, ${received} received, ${Math.round((100 * (n - received)) / n)}% packet loss, time ${(n - 1) * 1001 + 3}ms`,
      );
      if (received) {
        const moy = time.reduce((a, b) => a + b, 0) / received;
        lines.push(`rtt min/avg/max/mdev = ${ms(Math.min(...time))}/${ms(moy)}/${ms(Math.max(...time))}/0.080 ms`);
      }
      return lines.join('\n');
    },
  },

  dig: {
    ownOptions: true,
    launch: ({ args, game }) => {
      // Une machine avec un vrai DNS simulé (zones, serveurs, cache) : bind.ts.
      if (game.state.dns) return digDns(args, game);
      const server = args.find((a) => a.startsWith('@'))?.slice(1);
      const short = args.includes('+short');
      const name = args.find((a) => !a.startsWith('@') && !a.startsWith('+'));
      if (!name) return game.error(game.t('dig-usage'));
      const res = resolveName(game, name, server);
      const header = `; <<>> DiG 9.18.28 <<>> ${args.join(' ')}\n;; global options: +cmd`;
      if ('error' in res && res.error === 'timeout') {
        const s = res.servers[0] ?? '?';
        const errors = Array(3).fill(`;; communications error to ${s}#53: timed out`).join('\n');
        return short ? errors : `${errors}\n\n${header}\n;; no servers could be reached`;
      }
      const inUse = server ?? dnsServers(game).find((s) => (game.state.network as Network).resolvers.includes(s))!;
      if (short) return 'ip' in res ? res.ip : '';
      const fqdn = name.replace(/\.$/, '') + '.';
      return [
        header,
        ';; Got answer:',
        `;; ->>HEADER<<- opcode: QUERY, status: ${'ip' in res ? 'NOERROR' : 'NXDOMAIN'}, id: 4242`,
        '',
        ';; QUESTION SECTION:',
        `;${fqdn}\t\tIN\tA`,
        ...('ip' in res ? ['', ';; ANSWER SECTION:', `${fqdn}\t3600\tIN\tA\t${res.ip}`] : []),
        '',
        ';; Query time: 18 msec',
        `;; SERVER: ${inUse}#53(${inUse}) (UDP)`,
      ].join('\n');
    },
  },

  traceroute: {
    launch: ({ args, game }) => {
      const host = args.find((a) => !a.startsWith('-'));
      if (!host) return game.error(game.t('traceroute-usage'));
      const res = resolveName(game, host);
      if ('error' in res)
        return game.error(
          `${host}: ${res.error === 'timeout' ? 'Temporary failure in name resolution' : 'Name or service not known'}\nCannot handle "host" cmdline arg \`${host}' on position 1 (argc 1)`,
        );
      const r: Network = game.state.network;
      const jumps = r.routes[res.ip] ?? [];
      const lines = [`traceroute to ${host} (${res.ip}), 30 hops max, 60 byte packets`];
      jumps.forEach((s, i) => {
        const t = [0, 1, 2].map((k) => ms(s.ms + k * 0.13)).join(' ms  ');
        lines.push(`${String(i + 1).padStart(2)}  ${s.name ?? s.ip} (${s.ip})  ${t} ms`);
      });
      const arrives = jumps.at(-1)?.ip === res.ip;
      if (!arrives) {
        for (let i = jumps.length + 1; i <= jumps.length + 3; i++) lines.push(`${String(i).padStart(2)}  * * *`);
        // Écart volontaire : le vrai traceroute continue jusqu'à 30 sauts.
        lines.push('    ' + game.t('traceroute-more-person'));
      }
      return lines.join('\n');
    },
  },

  curl: {
    // curl a beaucoup d'options (-s, -L, -v…) : on ignore celles qu'on ne simule pas.
    ownOptions: true,
    launch: ({ args, game }) => {
      // Les options qui prennent une valeur ; -H « Host: nom » choisit le site demandé.
      const WITH_VALUE = ['-H', '--header', '-o', '--output', '-X', '--request', '-d', '--data', '-A', '--user-agent', '-u', '--user', '-w', '--write-out', '-e', '--referer'];
      let requestHost: string | null = null;
      // Les autres en-têtes donnés avec -H (noms en minuscules), transmis à nginx.
      const inTetes: Record<string, string> = {};
      // -X, ou -d (POST) : la méthode, qu'on retrouve dans le journal de nginx.
      let method: string | undefined;
      const positional: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (WITH_VALUE.includes(args[i])) {
          const value = args[++i] ?? '';
          const h = /^host:\s*(\S+)/i.exec(value);
          if ((args[i - 1] === '-H' || args[i - 1] === '--header') && h) requestHost = h[1];
          else if (args[i - 1] === '-X' || args[i - 1] === '--request') method = value.toUpperCase();
          else if ((args[i - 1] === '-d' || args[i - 1] === '--data') && !method) method = 'POST';
          else if (args[i - 1] === '-H' || args[i - 1] === '--header') {
            const e = /^([\w-]+):\s*(.*)$/.exec(value);
            if (e) inTetes[e[1].toLowerCase()] = e[2];
          }
        } else if (!args[i].startsWith('-')) positional.push(args[i]);
      }
      const headers = args.includes('-I') || args.includes('--head');
      // -i : les en-têtes, puis le corps (include).
      const withHeaders = args.includes('-i') || args.includes('--include');
      const follow = args.includes('-L') || args.includes('--location');
      const url = positional[0];
      if (!url) return game.error("curl: try 'curl --help' for more information");
      const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(url);
      if (!m) return game.error(`curl: (3) URL rejected: Malformed input to a URL function`);
      const host = m[2];
      // Un tunnel ssh (ssh -L) : le port local mène à un service vu depuis une autre machine.
      const tunnel = BASE_LOCAL.includes(host.toLowerCase())
        ? ((game.state.tunnels ?? []) as { port: number; shell: Shell; remotePort: number; pid: number; loop: boolean }[]).find(
            (t) => t.port === Number(m[3] ?? 80) && ((game.state.process ?? []) as { pid: number }[]).some((p) => p.pid === t.pid),
          )
        : undefined;
      if (tunnel) {
        const target = tunnel.shell;
        const path = m[4] || '/';
        const app = tunnel.loop ? appRequest(target, tunnel.remotePort, path) : null;
        const r = app ? appResponse(target, app) : target.state.nginx && tunnel.remotePort === 80 ? httpRequest(target, 'localhost', path, 80) : null;
        // Personne n'écoute en face : ssh le signale (sur le terminal où il tourne), curl ne reçoit rien.
        if (!r) return game.error(`channel 2: open failed: connect failed: Connection refused\ncurl: (52) Empty reply from server`);
        return headers ? r.headers.join('\n') : withHeaders ? `${r.headers.join('\n')}\n\n${r.body}` : r.body;
      }
      // Une machine avec nginx : la requête part vers elle-même (localhost,
      // son nom, son adresse), et nginx répond selon sa configuration chargée.
      if (game.state.nginx || game.state.docker || game.state.apps || game.state.caddy) {
        const containers: string[] = (game.state.docker?.containers ?? []).map((c: { ip: string }) => c.ip);
        const local = [...BASE_LOCAL, ...(game.state.nginx?.names ?? game.state.docker?.names ?? game.state.caddy?.names ?? []), ...containers];
        const blocks: string[] = [];
        let [schema, target, port, path, name] = [m[1] ?? 'http', host, Number(m[3] ?? (m[1] === 'https' ? 443 : 80)), m[4] || '/', requestHost ?? host];
        // -L suit les redirections (au plus 5 ici).
        for (let hop = 0; hop < 6; hop++) {
          if (!local.includes(target.toLowerCase())) return game.error(`curl: (6) Could not resolve host: ${target}`);
          // Un port publié par un conteneur (docker run -p) : c'est lui qui répond.
          const viaDocker = dockerRequest(game, target.toLowerCase() === 'localhost' ? '127.0.0.1' : target, port, path);
          // Une appli de la machine, jointe sur son propre port (sans nginx).
          const appVia = port !== 80 && port !== 443 && BASE_LOCAL.includes(target.toLowerCase()) ? appRequest(game, port, path, { ...inTetes, host: name === target ? `${target}:${port}` : name }) : null;
          // Caddy : il répond sur ses ports ; sans certificat pour ce nom, la poignée de main TLS échoue.
          const viaCaddy = game.state.caddy ? caddyRequest(game, name, path, port) : null;
          if (viaCaddy && 'tls' in viaCaddy) return game.error('curl: (35) OpenSSL/3.5.1: error:0A000438:SSL routines::tlsv1 alert internal error');
          const r =
            viaCaddy
              ? viaCaddy
              : viaDocker !== undefined
              ? viaDocker && viaDocker.code !== 0 && appResponse(game, viaDocker)
              : appVia
                ? appResponse(game, appVia)
                : game.state.nginx && (port === 80 || port === 443)
                  ? httpRequest(game, name, path, port, true, Object.keys(inTetes).length || method ? { address: '127.0.0.1', time: systemd(game)?.clock ?? 0, agent: 'curl/8.14.1', headers: inTetes, method } : undefined)
                  : null;
          // Un service qui ne parle pas HTTP (une base de données) : réponse vide.
          if (viaDocker?.code === 0) return game.error('curl: (52) Empty reply from server');
          if (!r) return game.error(`curl: (7) Failed to connect to ${target} port ${port} after 0 ms: Couldn't connect to server`);
          // HTTPS : curl vérifie le certificat présenté (dates, nom), sauf avec -k.
          const insecure = args.some((a) => a === '-k' || a === '--insecure');
          const problem = schema === 'https' && !insecure ? checkCertificate(game, r.certificate ?? null, target) : null;
          if (problem) return game.error(`curl: (60) ${problem}\n${SSL_HELP}`);
          const elsewhere = r.headers.find((e) => e.startsWith('Location: '))?.slice(10);
          if (!follow || !elsewhere || r.code < 300 || r.code >= 400) {
            blocks.push(headers ? r.headers.join('\n') : withHeaders ? `${r.headers.join('\n')}\n\n${r.body}` : r.body);
            return blocks.join('\n\n');
          }
          if (headers) blocks.push(r.headers.join('\n'));
          const next = /^(https?):\/\/([^/:]+)(?::(\d+))?(.*)$/.exec(elsewhere);
          if (!next) return game.error(`curl: (3) URL rejected: Malformed input to a URL function`);
          [schema, target, port, path, name] = [next[1], next[2], Number(next[3] ?? (next[1] === 'https' ? 443 : 80)), next[4] || '/', next[2]];
        }
        return game.error('curl: (47) Maximum (5) redirects followed');
      }
      // Une machine sans réseau simulé (le poste) : personne ne répond, sauf par un tunnel.
      if (!game.state.network)
        return game.error(
          BASE_LOCAL.includes(host.toLowerCase())
            ? `curl: (7) Failed to connect to ${host} port ${m[3] ?? 80} after 0 ms: Couldn't connect to server`
            : `curl: (6) Could not resolve host: ${host}`,
        );
      const res = resolveName(game, host);
      if ('error' in res) return game.error(`curl: (6) Could not resolve host: ${host}`);
      const site = (game.state.network as Network).web[host];
      if (!site)
        return game.error(`curl: (7) Failed to connect to ${host} port ${m[1] === 'http' ? 80 : 443} after 3002 ms: Couldn't connect to server`);
      return headers ? site.headers.join('\n') : site.body;
    },
  },
};
