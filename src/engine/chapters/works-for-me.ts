// Story "The Neighbourhood Letters" — chapter "Works on my machine":
// DNS. Kofi "pointed" cafe.example to the server… by adding a line to his
// own computer's /etc/hosts. On his computer, the café's site works; for
// customers, the name still leads to the former host.
// The Letters' server is authoritative for the zone (named, BIND 9); the
// registry keeps a copy (secondary server). The zone must be fixed, its
// serial number increased, then checked, reloaded, www added, and the
// player must understand why resolvers still give the old address (the TTL).
// Objective checked on the state: both authoritative servers answer the
// new address for cafe.example and www.cafe.example, the mail (MX) is still
// there, and the Letters' zone hasn't changed.
// Sources: https://bind9.readthedocs.io/en/stable/chapter3.html (zones),
// https://bind9.readthedocs.io/en/stable/manpages.html (named-checkzone, rndc, dig),
// RFC 1034 and 1035 (TTL, SOA, CNAME).

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd, toUtc } from '../systemd';
import { dns, query, reloadZones, type DnsState } from '../dns';

const M = '/home/you';
const NEW = '203.0.113.10';
const OLD = '198.51.100.80';
const ZONES = '/etc/bind/zones';

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    bind: { uid: 104, group: 'bind', home: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    rania: { uid: 1001, group: 'rania' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'rania'] },
    bind: { gid: 104, members: [] },
    you: { gid: 1000, members: [] },
    rania: { gid: 1001, members: [] },
  },
});

const SOA = (serial: string) => `@       IN SOA  ns1.letters.example. kofi.letters.example. (
                ${serial} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                3600 )     ; negative cache TTL`;

// The café's zone, as it was at the former host.
const ZONE_CAFE = `$TTL 86400
${SOA('2026091501')}
        IN NS   ns1.letters.example.
        IN NS   ns2.registry.example.
        IN A    ${OLD}
        IN MX   10 mail.letters.example.
        IN TXT  "v=spf1 mx -all"`;

// The Letters' zone: a good model.
const LETTERS_ZONE = `$TTL 3600
${SOA('2026111002')}
        IN NS   ns1.letters.example.
        IN NS   ns2.registry.example.
        IN A    ${NEW}
        IN MX   10 mail
ns1     IN A    ${NEW}
mail    IN A    ${NEW}
www     IN CNAME letters.example.`;

const NAMED_CONF = `// This is the primary configuration file for the BIND DNS server named.
//
// Please read /usr/share/doc/bind9/README.Debian for information on the
// structure of BIND configuration files in Debian, *BEFORE* you customize
// this configuration file.
//
// If you are just adding zones, please do that in /etc/bind/named.conf.local

include "/etc/bind/named.conf.options";
include "/etc/bind/named.conf.local";
include "/etc/bind/named.conf.default-zones";`;

const NAMED_CONF_LOCAL = `//
// Do any local configuration here
//

zone "letters.example" {
    type primary;
    file "${ZONES}/db.letters.example";
    notify yes;
    also-notify { 192.0.2.53; };
};

zone "cafe.example" {
    type primary;
    file "${ZONES}/db.cafe.example";
    notify yes;
    also-notify { 192.0.2.53; };
};`;

const NAMED_OPTIONS = `options {
    directory "/var/cache/bind";
    recursion no;
    allow-transfer { 192.0.2.53; };
    listen-on { any; };
    listen-on-v6 { any; };
};`;

const sd = (j: Game) => systemd(j)!;
const state = (j: Game): DnsState => dns(j)!;
// The final address of a name for an authoritative server (after CNAMEs).
const address = (j: Game, server: 'primary' | 'secondary', name: string) =>
  query(j, server, name, 'A', 0)
    .responses.filter((r) => r.type === 'A')
    .map((r) => r.data);
const good = (j: Game, server: 'primary' | 'secondary') =>
  ['cafe.example', 'www.cafe.example'].every((n) => address(j, server, n).join() === NEW) &&
  query(j, server, 'cafe.example', 'MX', 0).responses.some((r) => r.type === 'MX') &&
  address(j, server, 'letters.example').join() === NEW;
// A name of the zone written without the trailing dot in the data.
const forgottenPoint = (j: Game) =>
  (state(j).primary['cafe.example']?.rrs ?? []).some(
    (r) => /\.cafe\.example\.cafe\.example\.$/.test(r.data) || r.data.endsWith('.example.cafe.example.'),
  );
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const atMe: Chapter = {
  id: 'works-for-me',
  number: 5,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'cp',
    'mv',
    'nano',
    'sudo',
    'id',
    'whoami',
    'dig',
    'host',
    'named-checkzone',
    'named-checkconf',
    'rndc',
    'systemctl',
    'journalctl',
  ],
  home: M,
  welcome: 'email_kofi.txt',
  names: true,
  final: 'end',
  password: 'ants-2026',
  accounts,
  state: () => {
    const now = Date.UTC(2027, 2, 20, 10, 0, 0);
    const dnsState: DnsState = {
      conf: '/etc/bind/named.conf.local',
      primary: {},
      secondary: {},
      // The public resolver asked for cafe.example yesterday at 4 p.m.: it keeps
      // the old address for 24 hours (TTL 86400).
      cache: {
        'cafe.example. A': {
          rrs: [{ name: 'cafe.example.', ttl: 86400, type: 'A', data: OLD }],
          expires: Date.UTC(2027, 2, 19, 15, 0, 0) + 86400 * 1000,
        },
      },
      servers: {
        primary: ['localhost', '127.0.0.1', 'letters', 'letters.example', 'ns1.letters.example', NEW],
        secondary: ['ns2.registry.example', '192.0.2.53'],
        resolver: ['9.9.9.9', 'dns.quad9.net'],
      },
      charges: {},
    };
    return {
      systemd: newSystemd('letters', Date.UTC(2027, 2, 1, 6, 12, 0), now, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        named: {
          description: 'BIND Domain Name Server',
          active: true,
          executable: 'named',
          process: [{ pid: 733, user: 'bind', cpu: 0.1, mem: 1.4, command: '/usr/sbin/named -f -u bind' }],
          load: (j) => void reloadZones(j),
        },
      }),
      process: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
        { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 733, user: 'bind', cpu: 0.1, mem: 1.4, command: '/usr/sbin/named -f -u bind' },
      ],
      dns: dnsState,
    };
  },
  // named loaded the zones at boot, and the registry has a copy.
  initialise: (j) => {
    reloadZones(j);
    const e = state(j);
    e.secondary = JSON.parse(JSON.stringify(e.primary));
    // The log of this loading isn't from today: remove it.
    sd(j).log = sd(j).log.filter((x) => x.unit !== 'named.service');
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = { owner: 'root', group: 'bind' }) => f(text, { lines: true, ...rights });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('letters', root),
        'resolv.conf': file('nameserver 9.9.9.9', root),
        bind: place(
          {
            'named.conf': file(NAMED_CONF),
            'named.conf.local': file(NAMED_CONF_LOCAL),
            'named.conf.options': file(NAMED_OPTIONS),
            'named.conf.default-zones': file(
              '// prime the server with knowledge of the root servers\nzone "." {\n    type hint;\n    file "/usr/share/dns/root.hints";\n};',
            ),
            'rndc.key': f('key "rndc-key" {\n    algorithm hmac-sha256;\n    secret "q2V0b3VybmVyLWxlLWpldQ==";\n};', {
              lines: true,
              owner: 'bind',
              group: 'bind',
              mode: 'rw-r-----',
            }),
            zones: place({ 'db.letters.example': file(LETTERS_ZONE), 'db.cafe.example': file(ZONE_CAFE) }, { owner: 'root', group: 'bind' }),
          },
          { owner: 'root', group: 'bind', mode: 'rwxr-sr-x' },
        ),
      }),
      home: place({ you: d({ 'email_kofi.txt': f(t('works-for-me-email-kofi')), 'help_dns.txt': f(t('works-for-me-help-dns')) }) }),
      usr: place({ sbin: place({ named: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_201_664 }) }) }),
    });
  },
  events: [
    {
      id: 'cache',
      // Right after a question to the public resolver, which still answers the old address.
      condition: (j) => {
        const q: { server: string; data: string[] } | undefined = j.state.dnsQueries?.at(-1);
        return (
          j.last.commands.some((c) => c[0] === 'dig' || c[0] === 'host') &&
          q?.server === 'resolver' &&
          q.data.includes(OLD) &&
          address(j, 'primary', 'cafe.example').join() === NEW
        );
      },
      message: (j) => {
        const memo = state(j).cache['cafe.example. A'];
        const hours = Math.max(1, Math.round((memo.expires - toUtc(sd(j).clock)) / 3_600_000));
        return j.t('works-for-me-event-cache', { hours: hours });
      },
    },
    {
      id: 'error-zone',
      condition: (j) => j.last.errors.some((e) => e.includes("'reload' failed")),
      message: (j) => j.t('works-for-me-event-error-zone'),
    },
    {
      id: 'serial',
      condition: (j) => {
        const e = state(j);
        return !same(e.primary['cafe.example']?.rrs, e.secondary['cafe.example']?.rrs);
      },
      message: (j) => j.t('works-for-me-event-serial'),
    },
    {
      id: 'point-final',
      condition: forgottenPoint,
      message: (j) => j.t('works-for-me-event-point-final'),
    },
    {
      id: 'end',
      condition: (j) => good(j, 'primary') && good(j, 'secondary'),
      message: (j) => j.t('works-for-me-event-end'),
    },
  ],
};
