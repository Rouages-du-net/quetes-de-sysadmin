// BIND 9 : dig et host (les questions), named-checkzone, named-checkconf et
// rndc (le serveur). D'après https://bind9.readthedocs.io/en/stable/manpages.html.
// Le DNS simulé est dans dns.ts ; sans etat.dns, dig garde son ancien
// fonctionnement (Le Paquet perdu, reseau.ts).

import type { Shell } from '../shell';
import { dns, query, readZone, reloadZones, serverFor, declaredZones, type Rr } from '../dns';
import { summerTime, systemd, toUtc } from '../systemd';
import type { Command } from './index';

const VERSION = '9.20.9-1-Debian';
const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// « Sat Mar 20 10:00:00 CET 2027 », comme dig.
const when = (local: number) => {
  const d = new Date(local);
  return `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${d.toISOString().slice(11, 19)} ${summerTime(local) ? 'CEST' : 'CET'} ${d.getUTCFullYear()}`;
};

const rrLine = (r: Rr) => `${r.name.padEnd(23)} ${String(r.ttl).padEnd(7)} IN\t${r.type}\t${r.data}`;

// Les noms et adresses des serveurs (pour @serveur et SERVER:).
function addressFor(game: Shell, name: string): string {
  const d = dns(game)!;
  const s = serverFor(d, name)!;
  return d.servers[s].find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)) ?? name;
}

/** Le serveur que le système interroge (/etc/resolv.conf). */
const systemResolver = (game: Shell) => /^\s*nameserver\s+(\S+)/m.exec(game.read('/etc/resolv.conf') ?? '')?.[1] ?? '127.0.0.1';

export function digDns(args: string[], game: Shell): string {
  const d = dns(game)!;
  const sd = systemd(game);
  const local = sd?.clock ?? 0;
  const request = args.find((a) => a.startsWith('@'))?.slice(1);
  const short = args.includes('+short');
  const onlyResponse = args.includes('+noall') && args.includes('+answer');
  const positional = args.filter((a) => !a.startsWith('@') && !a.startsWith('+') && !a.startsWith('-'));
  const type =
    positional
      .slice(1)
      .find((a) => TYPES.includes(a.toUpperCase()))
      ?.toUpperCase() ?? (positional.length > 1 && TYPES.includes(positional[0].toUpperCase()) ? positional[0].toUpperCase() : 'A');
  const name = positional.find((a) => !TYPES.includes(a.toUpperCase()));
  if (!name) return game.error(game.t('dig-usage'));
  const target = request ?? systemResolver(game);
  const server = serverFor(d, target);
  if (!server) {
    if (request) return game.error(`dig: couldn't get address for '${request}': not found`);
    return game.error(`;; communications error to ${target}#53: timed out\n;; no servers could be reached`);
  }
  // named arrêté : le serveur de la machine ne répond plus.
  if (server === 'primary' && sd?.services.named?.state !== 'active')
    return game.error(`;; communications error to ${addressFor(game, target)}#53: connection refused\n;; no servers could be reached`);
  const r = query(game, server, name, type, toUtc(local));
  game.state.dnsQueries = [
    ...(game.state.dnsQueries ?? []),
    { server, name: name.replace(/\.?$/, '.').toLowerCase(), type, data: r.responses.map((x) => x.data) },
  ];
  if (short) return r.responses.map((x) => x.data).join('\n');
  if (onlyResponse) return r.responses.map(rrLine).join('\n');
  const q = name.replace(/\.?$/, '.').toLowerCase();
  const recursive = server === 'resolver' || (server === 'primary' && !!d.recursive);
  const address = addressFor(game, target);
  return [
    `; <<>> DiG ${VERSION} <<>> ${args.join(' ')}`,
    ';; global options: +cmd',
    ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${r.status}, id: 4242`,
    `;; flags: qr${r.authority ? ' aa' : ''} rd${recursive ? ' ra' : ''}; QUERY: 1, ANSWER: ${r.responses.length}, AUTHORITY: 0, ADDITIONAL: 1`,
    ...(recursive ? [] : [';; WARNING: recursion requested but not available']),
    '',
    ';; QUESTION SECTION:',
    `;${q.padEnd(30)} IN\t${type}`,
    ...(r.responses.length ? ['', ';; ANSWER SECTION:', ...r.responses.map(rrLine)] : []),
    '',
    `;; Query time: ${recursive ? 14 : 0} msec`,
    `;; SERVER: ${address}#53(${target}) (UDP)`,
    `;; WHEN: ${when(local)}`,
    `;; MSG SIZE  rcvd: ${40 + r.responses.length * 16}`,
  ].join('\n');
}

export const BIND: Record<string, Command> = {
  host: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const d = dns(game);
      const positional = args.filter((a) => !a.startsWith('-'));
      const [name, requestServer] = positional;
      if (!name || !d) return game.error(game.t('host-usage'));
      const target = requestServer ?? systemResolver(game);
      const server = serverFor(d, target);
      if (!server) return game.error(`host: couldn't get address for '${target}': not found`);
      const now = toUtc(systemd(game)?.clock ?? 0);
      const header = requestServer ? ['Using domain server:', `Name: ${target}`, `Address: ${addressFor(game, target)}#53`, 'Aliases: ', ''] : [];
      const lines: string[] = [];
      const seen = new Set<string>();
      for (const type of ['A', 'AAAA', 'MX']) {
        const r = query(game, server, name, type, now);
        if (type === 'A')
          game.state.dnsQueries = [...(game.state.dnsQueries ?? []), { server, name, type, data: r.responses.map((x) => x.data) }];
        if (r.status === 'NXDOMAIN') return game.error([...header, `Host ${name} not found: 3(NXDOMAIN)`].join('\n'));
        if (r.status === 'REFUSED') return game.error([...header, `Host ${name} not found: 5(REFUSED)`].join('\n'));
        for (const x of r.responses) {
          const line =
            x.type === 'CNAME'
              ? `${x.name.slice(0, -1)} is an alias for ${x.data}`
              : x.type === 'A'
                ? `${x.name.slice(0, -1)} has address ${x.data}`
                : x.type === 'AAAA'
                  ? `${x.name.slice(0, -1)} has IPv6 address ${x.data}`
                  : `${x.name.slice(0, -1)} mail is handled by ${x.data}`;
          if (!seen.has(line)) (lines.push(line), seen.add(line));
        }
      }
      return [...header, ...lines].join('\n');
    },
  },

  'named-checkzone': {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const [zone, file] = args.filter((a) => !a.startsWith('-'));
      if (!zone || !file) return game.error(game.t('named-checkzone-usage'));
      const n = game.find(file);
      if (!n || n.type !== 'fichier' || !game.can(n, 'r'))
        return game.error(
          `zone ${zone}/IN: loading from master file ${file} failed: ${!n ? 'file not found' : 'permission denied'}\nzone ${zone}/IN: not loaded due to errors.`,
        );
      const { zone: z, errors } = readZone(game.read(file) ?? '', zone, file);
      if (errors.length) {
        const reason = errors[0].includes('dotted') ? 'bad dotted quad' : errors[0].includes('unknown RR') ? 'unknown class/type' : 'failure';
        return game.error(
          [...errors, `zone ${zone}/IN: loading from master file ${file} failed: ${reason}`, `zone ${zone}/IN: not loaded due to errors.`].join(
            '\n',
          ),
        );
      }
      game.state.zoneChecked = true;
      return `zone ${zone}/IN: loaded serial ${z.serial}\nOK`;
    },
  },

  'named-checkconf': {
    section: 8,
    ownOptions: true,
    launch: ({ game }) => {
      const d = dns(game);
      if (!d) return '';
      const text = game.read(d.conf) ?? '';
      // Les accolades, et les fichiers de zone qui manquent.
      const openOnes = (text.match(/\{/g) ?? []).length;
      const closed = (text.match(/\}/g) ?? []).length;
      if (openOnes !== closed) return game.error(`${d.conf}:${text.split('\n').length}: unexpected end of input`);
      for (const [zone, file] of Object.entries(declaredZones(game)))
        if (!game.exists(file)) return game.error(`${d.conf}: zone '${zone}': file '${file}' not found`);
      return '';
    },
  },

  rndc: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const d = dns(game);
      if (!d) return game.error(game.t('command-missing', { commande: 'rndc' }));
      if (game.who !== 'root') return game.error('open: /etc/bind/rndc.key: permission denied\nrndc: could not load rndc configuration');
      const sd = systemd(game);
      if (sd?.services.named?.state !== 'active') return game.error('rndc: connect failed: 127.0.0.1#953: connection refused');
      const [action, zone] = args;
      if (action === 'status')
        return [
          `version: BIND ${VERSION} (Stable Release) <id:>`,
          'running on localhost: Linux x86_64 6.12.0-quetes',
          `number of zones: ${Object.keys(d.primary).length + 99} (99 automatic)`,
          'server is up and running',
        ].join('\n');
      if (action !== 'reload') return game.error(game.t('rndc-usage'));
      if (zone) {
        if (!declaredZones(game)[zone.replace(/\.$/, '').toLowerCase()])
          return game.error(`rndc: 'reload' failed: not found\nno matching zone '${zone}' in any view`);
        const { errors, changed } = reloadZones(game, zone);
        if (errors.length) return game.error("rndc: 'reload' failed: failure");
        return changed.length ? 'zone reload queued' : 'zone reload up-to-date';
      }
      const { errors } = reloadZones(game);
      return errors.length ? game.error("rndc: 'reload' failed: failure") : 'server reload successful';
    },
  },
};
