// Ce que les chapitres du « Courrier indésirable » ont en commun : le serveur
// des Jardins partagés (jardin, 203.0.113.30, gardens.example), son DNS (BIND,
// primaire sur la machine, secondaire chez le registre), Postfix et OpenDKIM
// tels que Debian les installe, et les serveurs de courrier d'en face :
// mailbox.example (une grosse messagerie, exigeante), verifier.example (qui
// répond avec le résultat de SPF, DKIM et DMARC, comme check-auth) et
// newsmail.example (le service qui envoie la lettre d'information).
// Sources : https://www.postfix.org/MILTER_README.html, le opendkim.conf de
// Debian, RFC 7208 (SPF), 6376 (DKIM), 7489 (DMARC).

import { d, f, accountsFiles, player, type Accounts, type Directory, type Rights } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { reloadZones, type DnsState, type Rr, type Zone } from '../dns';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import {
  stopDkim,
  authenticate,
  loadDkim,
  loadPostfix,
  privateKey,
  publicKey,
  mail,
  drop,
  writeLog,
  readDkim,
  OPENDKIM_CONF,
  verificationReport,
  checkDkim,
  checkOpendkim,
  checkSpf,
  type MailState,
  type Message,
  type Signature,
} from '../mail';

export const IP = '203.0.113.30';
export const DOMAIN = 'gardens.example';
export const ZONE = `/etc/bind/zones/db.${DOMAIN}`;
export const MAILBOX = { domain: 'mailbox.example', mx: 'mx.mailbox.example', ip: '198.51.100.25' };
export const CHECKER = { domain: 'verifier.example', mx: 'mx.verifier.example', ip: '198.51.100.30', address: 'check-auth@verifier.example' };
export const NEWSMAIL = { domain: 'newsmail.example', ip: '198.51.100.77', selector: 'nm1' };
// L'ancien hébergeur : ses serveurs d'envoi, que son SPF autorise.
export const OLD = { domain: 'old-hosting.example', reseau: '192.0.2.80/28' };
// La clé DKIM de newsmail.example (publiée chez eux, sous nm1.dkim.newsmail.example).
export const NEWSMAIL_KEY = publicKey(privateKey('newsmail.example:nm1:2048:1'))!;
// La clé du serveur des Jardins, créée au chapitre « La signature » (et reprise au suivant).
export const GARDENS_PRIVATE = privateKey(`${DOMAIN}:mail:2048:jardins`);

const rr = (name: string, type: string, data: string, ttl = 3600): Rr => ({ name: name.replace(/\.?$/, '.'), ttl, type, data });

// Les zones des autres, telles qu'internet les voit.
function externalZones(): Record<string, Zone> {
  return {
    [OLD.domain]: { serial: 1, rrs: [rr(`_spf.${OLD.domain}`, 'TXT', `"v=spf1 ip4:${OLD.reseau} -all"`)] },
    [MAILBOX.domain]: { serial: 1, rrs: [rr(MAILBOX.domain, 'MX', `10 ${MAILBOX.mx}.`), rr(MAILBOX.mx, 'A', MAILBOX.ip)] },
    [CHECKER.domain]: { serial: 1, rrs: [rr(CHECKER.domain, 'MX', `10 ${CHECKER.mx}.`), rr(CHECKER.mx, 'A', CHECKER.ip)] },
    [NEWSMAIL.domain]: {
      serial: 1,
      rrs: [
        rr(`_spf.${NEWSMAIL.domain}`, 'TXT', `"v=spf1 ip4:${NEWSMAIL.ip} -all"`),
        rr(`bounce.${NEWSMAIL.domain}`, 'TXT', `"v=spf1 ip4:${NEWSMAIL.ip} -all"`),
        rr(`${NEWSMAIL.selector}.dkim.${NEWSMAIL.domain}`, 'TXT', `"v=DKIM1; k=rsa; " "p=${NEWSMAIL_KEY}"`),
        rr(`${NEWSMAIL.selector}._domainkey.${NEWSMAIL.domain}`, 'TXT', `"v=DKIM1; k=rsa; " "p=${NEWSMAIL_KEY}"`),
      ],
    },
  };
}

/** Le fichier de zone de gardens.example, avec ces enregistrements en plus (après le CNAME de www). */
export const zone = (serial: number, inMore: string[]) => `$TTL 3600
@       IN  SOA ns1.${DOMAIN}. hostmaster.${DOMAIN}. (
                ${serial} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                300 )      ; negative cache TTL

@       IN  NS     ns1.${DOMAIN}.
@       IN  NS     ns2.registry.example.
@       IN  A      ${IP}
@       IN  MX     10 mail.${DOMAIN}.
ns1     IN  A      ${IP}
mail    IN  A      ${IP}
www     IN  CNAME  ${DOMAIN}.
${inMore.join('\n')}
`;

export const OLD_SPF = `@       IN  TXT    "v=spf1 include:_spf.${OLD.domain} -all"`;
export const GOOD_SPF = `@       IN  TXT    "v=spf1 mx -all"`;
/** L'enregistrement DKIM du serveur, tel qu'opendkim-genkey l'a écrit. */
export const goodDkim = () => {
  const p = publicKey(GARDENS_PRIVATE)!;
  return `mail._domainkey IN TXT ( "v=DKIM1; h=sha256; k=rsa; "\n          "p=${p.slice(0, 250)}"\n          "${p.slice(250)}" )`;
};
export const DMARC_NONE = `_dmarc  IN  TXT    "v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN}"`;

const NAMED_CONF_LOCAL = `//
// Do any local configuration here
//

zone "${DOMAIN}" {
    type primary;
    file "${ZONE}";
    allow-transfer { 192.0.2.53; };
    also-notify { 192.0.2.53; };
};`;

// main.cf tel que Debian l'installe (« Internet Site »), puis l'adresse de la machine.
export const MAIN_CF_DEBIAN = (inMore: string[] = []) => `# See /usr/share/postfix/main.cf.dist for a commented, more complete version


# Debian specific:  Specifying a file name will cause the first
# line of that file to be used as the name.  The Debian default
# is /etc/mailname.
#myorigin = /etc/mailname

smtpd_banner = $myhostname ESMTP $mail_name (Debian/GNU)
biff = no

# appending .domain is the MUA's job.
append_dot_mydomain = no

# Uncomment the next line to generate "delayed mail" warnings
#delay_warning_time = 4h

readme_directory = no

# See http://www.postfix.org/COMPATIBILITY_README.html -- default to 3.6 on
# fresh installs.
compatibility_level = 3.6



# TLS parameters
smtpd_tls_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level=may

smtp_tls_CApath=/etc/ssl/certs
smtp_tls_security_level=may
smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache


smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination
myhostname = mail.${DOMAIN}
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
myorigin = /etc/mailname
mydestination = $myhostname, ${DOMAIN}, localhost.localdomain, localhost
relayhost =
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all
${inMore.join('\n')}`;

export const MILTERS = ['', '# DKIM (opendkim)', 'smtpd_milters = inet:localhost:8891', 'non_smtpd_milters = $smtpd_milters', 'milter_default_action = accept'];

// /etc/opendkim.conf tel que Debian l'installe.
export const OPENDKIM_DEBIAN = `# This is a basic configuration for signing and verifying. It can easily be
# adapted to suit a basic installation. See opendkim.conf(5) and
# /usr/share/doc/opendkim/examples/opendkim.conf.sample for complete
# documentation of available configuration parameters.
Syslog			yes
SyslogSuccess		yes
#LogWhy			no

# Common signing and verification parameters. In Debian, the "From" header is
# oversigned, because it is often the identity key used by reputation systems
# and thus somewhat security sensitive.
Canonicalization	relaxed/simple
#Mode			sv
#SubDomains		no
OversignHeaders		From

# Signing domain, selector, and key (required). For example, perform signing
# for domain "example.com" with selector "2020" (2020._domainkey.example.com),
# using the private key stored in /etc/dkimkeys/example.private. More granular
# setup options can be found in /usr/share/doc/opendkim/README.opendkim.
#Domain			example.com
#Selector		2020
#KeyFile		/etc/dkimkeys/example.private

# In Debian, opendkim runs as user "opendkim". A umask of 007 is required when
# using a local socket with MTAs that access the socket as a non-privileged
# user (for example, Postfix). You may need to add user "postfix" to group
# "opendkim" in that case.
UserID			opendkim
UMask			007

# Socket for the MTA connection (required). If the MTA is inside a chroot jail,
# it must be ensured that the socket is accessible. In Debian, Postfix runs in
# a chroot in /var/spool/postfix, therefore a Unix socket would have to be
# configured as shown on the last line below.
Socket			local:/run/opendkim/opendkim.sock
#Socket			inet:8891@localhost
#Socket			inet:8891
#Socket			local:/var/spool/postfix/opendkim/opendkim.sock

PidFile			/run/opendkim/opendkim.pid

# Hosts for which to sign rather than verify, default is 127.0.0.1. See the
# OPERATION section of opendkim(8) for more information.
#InternalHosts		192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12

# The trust anchor enables DNSSEC. In Debian, the trust anchor file is provided
# by the package dns-root-data.
TrustAnchorFile		/usr/share/dns/root.key
#Nameservers		127.0.0.1`;

/** opendkim.conf configuré pour signer gardens.example (chapitre « La politique »). */
export const OPENDKIM_CONFIGURE = OPENDKIM_DEBIAN.replace('#Domain\t\t\texample.com', `Domain\t\t\t${DOMAIN}`)
  .replace('#Selector\t\t2020', 'Selector\t\tmail')
  .replace('#KeyFile\t\t/etc/dkimkeys/example.private', 'KeyFile\t\t/etc/dkimkeys/mail.private')
  .replace('Socket\t\t\tlocal:/run/opendkim/opendkim.sock\n#Socket\t\t\tinet:8891@localhost', '#Socket\t\t\tlocal:/run/opendkim/opendkim.sock\nSocket\t\t\tinet:8891@localhost');

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    bind: { uid: 104, group: 'bind', home: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    postfix: { uid: 105, group: 'postfix', home: '/var/spool/postfix', shell: '/usr/sbin/nologin' },
    opendkim: { uid: 110, group: 'opendkim', home: '/run/opendkim', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    nour: { uid: 1001, group: 'nour' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    mail: { gid: 8, members: [] },
    sudo: { gid: 27, members: ['you', 'nour'] },
    'www-data': { gid: 33, members: [] },
    bind: { gid: 106, members: [] },
    postfix: { gid: 107, members: [] },
    opendkim: { gid: 112, members: [] },
    you: { gid: 1000, members: [] },
    nour: { gid: 1001, members: [] },
  },
});

// ——— Les serveurs d'en face ———

// La signature qu'aurait un message déposé sur la machine, envoyé maintenant (sans rien écrire au journal).
export function expectedSignature(game: Game): Signature | null {
  const c = mail(game);
  if (!c || systemd(game)?.services.postfix?.state !== 'active' || systemd(game)?.services.opendkim?.state !== 'active') return null;
  const values = c.postfix?.values ?? {};
  const milters = (values.non_smtpd_milters ?? '').replace('$smtpd_milters', values.smtpd_milters ?? '').replace('${smtpd_milters}', values.smtpd_milters ?? '');
  const conf = c.dkim ?? readDkim(game.read(OPENDKIM_CONF) ?? '');
  const joined = milters.split(/[\s,]+/).some((m) => {
    const inet = /^inet:(?:(localhost|127\.0\.0\.1):)?(\d+)$/.exec(m);
    const p = /^inet6?:(\d+)(?:@(localhost|127\.0\.0\.1))?$/.exec(conf.socket);
    if (inet && p) return inet[2] === p[1];
    const unix = /^unix:(.+)$/.exec(m);
    const l = /^(?:local|unix):(.+)$/.exec(conf.socket);
    return !!unix && !!l && l[1] === `/var/spool/postfix${unix[1]}`;
  });
  if (!joined || !conf.key || !conf.selector || !conf.domains.includes(DOMAIN) || !conf.mode.includes('s')) return null;
  const isPublic = publicKey(game.read(conf.key) ?? '');
  return isPublic ? { d: DOMAIN, s: conf.selector, key: isPublic } : null;
}

/** Un message des Jardins, tel qu'un serveur distant le recevrait maintenant. */
export const gardensMessage = (game: Game): Message => ({
  id: 'TEST',
  forEachOf: `${game.player}@${DOMAIN}`,
  a: [`test@${MAILBOX.domain}`],
  from: `${game.player}@${DOMAIN}`,
  subject: '',
  body: '',
  arrives: 0,
  size: 0,
  signature: expectedSignature(game),
  ip: IP,
});

/** La lettre d'information, envoyée par newsmail.example : signée pour gardens.example si le CNAME de nm1 est publié. */
export function letter(game: Game): Message {
  const delegated = checkDkim(game, { d: DOMAIN, s: NEWSMAIL.selector, key: NEWSMAIL_KEY }).result === 'pass';
  return {
    id: 'NEWS',
    forEachOf: `bounces+4521@bounce.${NEWSMAIL.domain}`,
    a: [`amina@${MAILBOX.domain}`],
    from: `news@${DOMAIN}`,
    subject: '',
    body: '',
    arrives: 0,
    size: 0,
    signature: { d: delegated ? DOMAIN : NEWSMAIL.domain, s: NEWSMAIL.selector, key: NEWSMAIL_KEY },
    ip: NEWSMAIL.ip,
  };
}

export const passSpf = (game: Game) => checkSpf(game, IP, DOMAIN).result === 'pass';

function providers(t: Translate): MailState['providers'] {
  return {
    [MAILBOX.domain]: {
      mx: MAILBOX.mx,
      ip: MAILBOX.ip,
      receive: (_j, a, m) => {
        if (a.dmarc === 'fail' && a.policy === 'reject')
          return `550 5.7.1 Unauthenticated email from ${a.domainFrom} is not accepted due to the domain's DMARC policy. See https://support.mailbox.example/dmarc`;
        if (a.spf !== 'pass' && a.dkim !== 'pass')
          return `451 4.7.26 Unauthenticated mail from ${a.domainSpf}: neither SPF nor DKIM passed for ${m.ip ?? IP} (SPF: ${a.spf}). Try again later. See https://support.mailbox.example/senders`;
        return `250 2.0.0 OK ${String(1795000000 + m.size)} - mx.mailbox.example`;
      },
    },
    [CHECKER.domain]: {
      mx: CHECKER.mx,
      ip: CHECKER.ip,
      // Le vérificateur répond à l'expéditeur avec le résultat de ses vérifications.
      receive: (j, a, m) => {
        const response: Message = {
          id: 'R' + m.id.slice(1),
          forEachOf: CHECKER.address,
          a: [m.forEachOf],
          from: `Authentication Checker <${CHECKER.address}>`,
          subject: t('jardins-sujet-verification'),
          body: verificationReport(a, m, CHECKER.mx),
          arrives: systemd(j)?.clock ?? 0,
          size: 1800,
        };
        writeLog(j, 'postfix/smtpd', `connect from ${CHECKER.mx}[${CHECKER.ip}]`);
        writeLog(j, 'postfix/local', `${response.id}: to=<${m.forEachOf}>, relay=local, delay=1.2, delays=1.1/0.01/0/0.01, dsn=2.0.0, status=sent (delivered to mailbox)`);
        drop(j, m.forEachOf, response);
        return '250 2.0.0 Ok: queued as 4XzQ7k2Lp9z1';
      },
    },
  };
}

export interface Departure {
  zone: string[];
  serial: number;
  mainCf: string[];
  // opendkim : absent (pas encore installé), la configuration de Debian, ou configuré avec la clé.
  opendkim: 'absent' | 'debian' | 'configure';
  now: number;
  file?: (t: Translate) => Message[];
}

/** L'état d'un chapitre : systemd (named, postfix, opendkim), le DNS, le courrier. */
export function gardensState(t: Translate, departure: Departure): Record<string, unknown> {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
    named: {
      description: 'BIND Domain Name Server',
      active: true,
      executable: 'named',
      process: [{ pid: 733, user: 'bind', cpu: 0.1, mem: 1.4, command: '/usr/sbin/named -f -u bind' }],
      load: (j) => void reloadZones(j),
    },
    postfix: {
      description: 'Postfix Mail Transport Agent (instance -)',
      active: true,
      executable: 'master',
      process: [{ pid: 1180, user: 'root', cpu: 0, mem: 0.3, command: '/usr/lib/postfix/sbin/master -w' }],
      load: loadPostfix,
    },
  };
  if (departure.opendkim !== 'absent')
    services.opendkim = {
      description: 'OpenDKIM Milter',
      active: true,
      executable: 'opendkim',
      process: [{ pid: 812, user: 'opendkim', cpu: 0, mem: 0.4, command: '/usr/sbin/opendkim -f' }],
      check: checkOpendkim,
      load: loadDkim,
      stop: stopDkim,
      checkToReload: true,
    };
  const stateDns: DnsState = {
    conf: '/etc/bind/named.conf.local',
    primary: {},
    secondary: {},
    cache: {},
    servers: {
      primary: ['localhost', '127.0.0.1', 'garden', `ns1.${DOMAIN}`, IP],
      secondary: ['ns2.registry.example', '192.0.2.53'],
      resolver: ['9.9.9.9', 'dns.quad9.net'],
    },
    charges: {},
    recursive: true,
  };
  const state: MailState = { ip: IP, file: departure.file?.(t) ?? [], counter: 40, postfix: null, dkim: null, providers: providers(t), restored: [] };
  return {
    systemd: newSystemd('garden', departure.now - 6 * 86_400_000, departure.now, services),
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 733, user: 'bind', cpu: 0.1, mem: 1.4, command: '/usr/sbin/named -f -u bind' },
      { pid: 1180, user: 'root', cpu: 0, mem: 0.3, command: '/usr/lib/postfix/sbin/master -w' },
      ...(departure.opendkim !== 'absent' ? [{ pid: 812, user: 'opendkim', cpu: 0, mem: 0.4, command: '/usr/sbin/opendkim -f' }] : []),
    ],
    dns: stateDns,
    courrier: state,
    ecoute: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
      { proto: 'tcp', address: '0.0.0.0', port: 25, processus: 'master', pid: 1180 },
      { proto: 'udp', address: '0.0.0.0', port: 53, processus: 'named', pid: 733 },
      { proto: 'tcp', address: '0.0.0.0', port: 53, processus: 'named', pid: 733 },
      ...(departure.opendkim === 'configure' ? [{ proto: 'tcp', address: '127.0.0.1', port: 8891, processus: 'opendkim', pid: 812 }] : []),
    ],
  };
}

/** Une fois le monde créé : named charge la zone (le registre en a la copie), Postfix et OpenDKIM leur configuration. */
export function initialiseGardens(j: Game) {
  reloadZones(j);
  const d = j.state.dns as DnsState;
  d.secondary = { ...externalZones(), ...JSON.parse(JSON.stringify(d.primary)) };
  const sd = systemd(j)!;
  sd.log = sd.log.filter((x) => x.unit !== 'named.service');
  loadPostfix(j);
  if (sd.services.opendkim) loadDkim(j);
}

/** Le monde : /etc (comptes, BIND, Postfix, OpenDKIM), /var/log/mail.log, /var/mail, et la maison. */
export function gardensWorld(t: Translate, departure: Departure, home: Record<string, Parameters<typeof d>[0][string]>, log: string, box = ''): Directory {
  const root = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const binary = (size: number) => f('', { owner: 'root', mode: 'rwxr-xr-x', size });
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file('garden'),
      mailname: file(DOMAIN),
      'resolv.conf': file('nameserver 127.0.0.1'),
      aliases: file(`# See man 5 aliases for format\npostmaster:    root\nroot:          ${player(t)}\ndmarc:         ${player(t)}`),
      bind: place({
        'named.conf.local': file(NAMED_CONF_LOCAL, { owner: 'root', group: 'bind' }),
        zones: place({ [`db.${DOMAIN}`]: file(zone(departure.serial, departure.zone), { owner: 'root', group: 'bind' }) }, { owner: 'root', group: 'bind' }),
      }),
      postfix: place({
        'main.cf': file(MAIN_CF_DEBIAN(departure.mainCf)),
        'master.cf': file(
          '#\n# Postfix master process configuration file.  For details on the format\n# of the file, see the master(5) manual page (command: "man 5 master" or\n# on-line: https://www.postfix.org/master.5.html).\n#\n# ==========================================================================\n# service type  private unpriv  chroot  wakeup  maxproc command + args\n#               (yes)   (yes)   (no)    (never) (100)\n# ==========================================================================\nsmtp      inet  n       -       y       -       -       smtpd\npickup    unix  n       -       y       60      1       pickup\ncleanup   unix  n       -       y       -       0       cleanup\nqmgr      unix  n       -       n       300     1       qmgr\nsmtp      unix  -       -       y       -       -       smtp\nlocal     unix  -       n       n       -       -       local',
        ),
      }),
      ...(departure.opendkim !== 'absent'
        ? {
            'opendkim.conf': file(departure.opendkim === 'configure' ? OPENDKIM_CONFIGURE : OPENDKIM_DEBIAN),
            dkimkeys: place(
              departure.opendkim === 'configure' ? { 'mail.private': file(GARDENS_PRIVATE, { owner: 'opendkim', group: 'opendkim', mode: 'rw-------' }) } : {},
              { owner: 'opendkim', group: 'opendkim', mode: 'rwx------' },
            ),
          }
        : {}),
    }),
    home: place({ you: d(home), nour: place({}, { owner: 'nour', mode: 'rwx------' }) }),
    usr: place({
      sbin: place({
        postfix: binary(27_528),
        postconf: binary(178_656),
        postqueue: binary(35_392),
        postsuper: binary(52_168),
        sendmail: binary(39_496),
        named: binary(1_034_112),
        rndc: binary(47_528),
        ...(departure.opendkim !== 'absent' ? { opendkim: binary(256_312), 'opendkim-genkey': binary(10_224), 'opendkim-testkey': binary(22_752) } : {}),
      }),
      bin: place({ mailq: f('', { owner: 'root', link: '../sbin/sendmail' }), mail: binary(108_392) }),
    }),
    var: place({
      log: place({ 'mail.log': f(log, { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' }) }),
      mail: place({ [player(t)]: f(box, { lines: true, owner: player(t), group: 'mail', mode: 'rw-rw----' }) }, { owner: 'root', group: 'mail', mode: 'rwxrwsr-x' }),
      www: place({}),
    }),
  });
}

/** Ce que voit un serveur distant pour un message des Jardins : SPF, DKIM, DMARC. */
export const gardensAuth = (j: Game) => authenticate(j, gardensMessage(j));
export const letterAuth = (j: Game) => authenticate(j, letter(j));
