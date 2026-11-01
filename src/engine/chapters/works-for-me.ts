// Histoire « Les Lettres du quartier » — chapitre « Ça marche chez moi » :
// le DNS. Kofi a « fait pointer » cafe.example vers le serveur… en ajoutant
// une ligne dans le /etc/hosts de son propre ordinateur. Chez lui, le site du
// café marche ; chez les clients, le nom mène toujours à l'ancien hébergeur.
// Le serveur des Lettres fait autorité pour la zone (named, BIND 9) ; le
// registre en garde une copie (serveur secondaire). Il faut corriger la
// zone, augmenter son numéro de série, la vérifier, la recharger, ajouter
// www, et comprendre pourquoi les résolveurs donnent encore l'ancienne
// adresse (le TTL).
// Objectif vérifié sur l'état : les deux serveurs qui font autorité
// répondent la nouvelle adresse pour cafe.example et www.cafe.example, le
// courrier (MX) est toujours là, et la zone des Lettres n'a pas bougé.
// Sources : https://bind9.readthedocs.io/en/stable/chapter3.html (zones),
// https://bind9.readthedocs.io/en/stable/manpages.html (named-checkzone, rndc, dig),
// RFC 1034 et 1035 (TTL, SOA, CNAME).

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd, toUtc } from '../systemd';
import { dns, query, reloadZones, type DnsState } from '../dns';

const M = '/home/vous';
const NEW = '203.0.113.10';
const OLD = '198.51.100.80';
const ZONES = '/etc/bind/zones';

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    bind: { uid: 104, group: 'bind', home: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, group: 'vous' },
    rania: { uid: 1001, group: 'rania' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['vous'] },
    sudo: { gid: 27, members: ['vous', 'rania'] },
    bind: { gid: 104, members: [] },
    vous: { gid: 1000, members: [] },
    rania: { gid: 1001, members: [] },
  },
});

const SOA = (serial: string) => `@       IN SOA  ns1.letters.example. kofi.letters.example. (
                ${serial} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                3600 )     ; negative cache TTL`;

// La zone du café, telle qu'elle était chez l'ancien hébergeur.
const ZONE_CAFE = `$TTL 86400
${SOA('2026091501')}
        IN NS   ns1.letters.example.
        IN NS   ns2.registry.example.
        IN A    ${OLD}
        IN MX   10 mail.letters.example.
        IN TXT  "v=spf1 mx -all"`;

// La zone des Lettres : un bon modèle.
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
// L'adresse finale d'un nom pour un serveur qui fait autorité (après les CNAME).
const address = (j: Game, server: 'primary' | 'secondary', name: string) =>
  query(j, server, name, 'A', 0)
    .responses.filter((r) => r.type === 'A')
    .map((r) => r.data);
const good = (j: Game, server: 'primary' | 'secondary') =>
  ['cafe.example', 'www.cafe.example'].every((n) => address(j, server, n).join() === NEW) &&
  query(j, server, 'cafe.example', 'MX', 0).responses.some((r) => r.type === 'MX') &&
  address(j, server, 'letters.example').join() === NEW;
// Un nom de la zone écrit sans le point final dans les données.
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
  welcome: 'courriel_kofi.txt',
  names: true,
  final: 'fin',
  password: 'fourmis-2026',
  accounts,
  state: () => {
    const now = Date.UTC(2027, 2, 20, 10, 0, 0);
    const dnsState: DnsState = {
      conf: '/etc/bind/named.conf.local',
      primary: {},
      secondary: {},
      // Le résolveur public a demandé cafe.example hier à 16 h : il garde
      // l'ancienne adresse 24 heures (TTL 86400).
      cache: {
        'cafe.example. A': {
          rrs: [{ name: 'cafe.example.', ttl: 86400, type: 'A', data: OLD }],
          expires: Date.UTC(2027, 2, 19, 15, 0, 0) + 86400 * 1000,
        },
      },
      servers: {
        primary: ['localhost', '127.0.0.1', 'lettres', 'letters.example', 'ns1.letters.example', NEW],
        secondary: ['ns2.registry.example', '192.0.2.53'],
        resolver: ['9.9.9.9', 'dns.quad9.net'],
      },
      charges: {},
    };
    return {
      systemd: newSystemd('lettres', Date.UTC(2027, 2, 1, 6, 12, 0), now, {
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
      processus: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
        { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 733, user: 'bind', cpu: 0.1, mem: 1.4, command: '/usr/sbin/named -f -u bind' },
      ],
      dns: dnsState,
    };
  },
  // named a chargé les zones au démarrage, et le registre en a une copie.
  initialise: (j) => {
    reloadZones(j);
    const e = state(j);
    e.secondary = JSON.parse(JSON.stringify(e.primary));
    // Le journal de ce chargement ne date pas d'aujourd'hui : on le retire.
    sd(j).log = sd(j).log.filter((x) => x.unit !== 'named.service');
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = { owner: 'root', group: 'bind' }) => f(text, { lines: true, ...rights });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('lettres', root),
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
      home: place({ vous: d({ 'courriel_kofi.txt': f(t('works-for-me-courriel-kofi')), 'aide_dns.txt': f(t('works-for-me-aide-dns')) }) }),
      usr: place({ sbin: place({ named: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_201_664 }) }) }),
    });
  },
  events: [
    {
      id: 'cache',
      // Juste après une question au résolveur public, qui répond encore l'ancienne adresse.
      condition: (j) => {
        const q: { server: string; data: string[] } | undefined = j.state.dnsQuestions?.at(-1);
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
        return j.t('works-for-me-evenement-cache', { heures: hours });
      },
    },
    {
      id: 'erreur-zone',
      condition: (j) => j.last.errors.some((e) => e.includes("'reload' failed")),
      message: (j) => j.t('works-for-me-evenement-erreur-zone'),
    },
    {
      id: 'serial',
      condition: (j) => {
        const e = state(j);
        return !same(e.primary['cafe.example']?.rrs, e.secondary['cafe.example']?.rrs);
      },
      message: (j) => j.t('works-for-me-evenement-serial'),
    },
    {
      id: 'point-final',
      condition: forgottenPoint,
      message: (j) => j.t('works-for-me-evenement-point-final'),
    },
    {
      id: 'fin',
      condition: (j) => good(j, 'primary') && good(j, 'secondary'),
      message: (j) => j.t('works-for-me-evenement-fin'),
    },
  ],
};
