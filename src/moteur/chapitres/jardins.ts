// Ce que les chapitres du « Courrier indésirable » ont en commun : le serveur
// des Jardins partagés (jardin, 203.0.113.30, gardens.example), son DNS (BIND,
// primaire sur la machine, secondaire chez le registre), Postfix et OpenDKIM
// tels que Debian les installe, et les serveurs de courrier d'en face :
// mailbox.example (une grosse messagerie, exigeante), verifier.example (qui
// répond avec le résultat de SPF, DKIM et DMARC, comme check-auth) et
// newsmail.example (le service qui envoie la lettre d'information).
// Sources : https://www.postfix.org/MILTER_README.html, le opendkim.conf de
// Debian, RFC 7208 (SPF), 6376 (DKIM), 7489 (DMARC).

import { d, f, fichiersComptes, joueur, type Comptes, type Dossier, type Droits } from '../monde';
import type { Jeu } from '../shell';
import type { Traduire } from '../../textes';
import { rechargerZones, type EtatDns, type Rr, type Zone } from '../dns';
import { nouveauSystemd, systemd, type DefinitionService } from '../systemd';
import {
  arreterDkim,
  authentifier,
  chargerDkim,
  chargerPostfix,
  clePrivee,
  clePublique,
  courrier,
  deposer,
  journaliser,
  lireDkim,
  OPENDKIM_CONF,
  rapportVerification,
  verifierDkim,
  verifierOpendkim,
  verifierSpf,
  type EtatCourrier,
  type Message,
  type Signature,
} from '../courrier';

export const IP = '203.0.113.30';
export const DOMAINE = 'gardens.example';
export const ZONE = `/etc/bind/zones/db.${DOMAINE}`;
export const MAILBOX = { domaine: 'mailbox.example', mx: 'mx.mailbox.example', ip: '198.51.100.25' };
export const VERIFICATEUR = { domaine: 'verifier.example', mx: 'mx.verifier.example', ip: '198.51.100.30', adresse: 'check-auth@verifier.example' };
export const NEWSMAIL = { domaine: 'newsmail.example', ip: '198.51.100.77', selecteur: 'nm1' };
// L'ancien hébergeur : ses serveurs d'envoi, que son SPF autorise.
export const ANCIEN = { domaine: 'old-hosting.example', reseau: '192.0.2.80/28' };
// La clé DKIM de newsmail.example (publiée chez eux, sous nm1.dkim.newsmail.example).
export const CLE_NEWSMAIL = clePublique(clePrivee('newsmail.example:nm1:2048:1'))!;
// La clé du serveur des Jardins, créée au chapitre « La signature » (et reprise au suivant).
export const PRIVEE_JARDINS = clePrivee(`${DOMAINE}:mail:2048:jardins`);

const rr = (nom: string, type: string, donnees: string, ttl = 3600): Rr => ({ nom: nom.replace(/\.?$/, '.'), ttl, type, donnees });

// Les zones des autres, telles qu'internet les voit.
function zonesExterieures(): Record<string, Zone> {
  return {
    [ANCIEN.domaine]: { serie: 1, rrs: [rr(`_spf.${ANCIEN.domaine}`, 'TXT', `"v=spf1 ip4:${ANCIEN.reseau} -all"`)] },
    [MAILBOX.domaine]: { serie: 1, rrs: [rr(MAILBOX.domaine, 'MX', `10 ${MAILBOX.mx}.`), rr(MAILBOX.mx, 'A', MAILBOX.ip)] },
    [VERIFICATEUR.domaine]: { serie: 1, rrs: [rr(VERIFICATEUR.domaine, 'MX', `10 ${VERIFICATEUR.mx}.`), rr(VERIFICATEUR.mx, 'A', VERIFICATEUR.ip)] },
    [NEWSMAIL.domaine]: {
      serie: 1,
      rrs: [
        rr(`_spf.${NEWSMAIL.domaine}`, 'TXT', `"v=spf1 ip4:${NEWSMAIL.ip} -all"`),
        rr(`bounce.${NEWSMAIL.domaine}`, 'TXT', `"v=spf1 ip4:${NEWSMAIL.ip} -all"`),
        rr(`${NEWSMAIL.selecteur}.dkim.${NEWSMAIL.domaine}`, 'TXT', `"v=DKIM1; k=rsa; " "p=${CLE_NEWSMAIL}"`),
        rr(`${NEWSMAIL.selecteur}._domainkey.${NEWSMAIL.domaine}`, 'TXT', `"v=DKIM1; k=rsa; " "p=${CLE_NEWSMAIL}"`),
      ],
    },
  };
}

/** Le fichier de zone de gardens.example, avec ces enregistrements en plus (après le CNAME de www). */
export const zone = (serie: number, enPlus: string[]) => `$TTL 3600
@       IN  SOA ns1.${DOMAINE}. hostmaster.${DOMAINE}. (
                ${serie} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                300 )      ; negative cache TTL

@       IN  NS     ns1.${DOMAINE}.
@       IN  NS     ns2.registry.example.
@       IN  A      ${IP}
@       IN  MX     10 mail.${DOMAINE}.
ns1     IN  A      ${IP}
mail    IN  A      ${IP}
www     IN  CNAME  ${DOMAINE}.
${enPlus.join('\n')}
`;

export const SPF_ANCIEN = `@       IN  TXT    "v=spf1 include:_spf.${ANCIEN.domaine} -all"`;
export const SPF_BON = `@       IN  TXT    "v=spf1 mx -all"`;
/** L'enregistrement DKIM du serveur, tel qu'opendkim-genkey l'a écrit. */
export const dkimBon = () => {
  const p = clePublique(PRIVEE_JARDINS)!;
  return `mail._domainkey IN TXT ( "v=DKIM1; h=sha256; k=rsa; "\n          "p=${p.slice(0, 250)}"\n          "${p.slice(250)}" )`;
};
export const DMARC_NONE = `_dmarc  IN  TXT    "v=DMARC1; p=none; rua=mailto:dmarc@${DOMAINE}"`;

const NAMED_CONF_LOCAL = `//
// Do any local configuration here
//

zone "${DOMAINE}" {
    type primary;
    file "${ZONE}";
    allow-transfer { 192.0.2.53; };
    also-notify { 192.0.2.53; };
};`;

// main.cf tel que Debian l'installe (« Internet Site »), puis l'adresse de la machine.
export const MAIN_CF_DEBIAN = (enPlus: string[] = []) => `# See /usr/share/postfix/main.cf.dist for a commented, more complete version


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
myhostname = mail.${DOMAINE}
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
myorigin = /etc/mailname
mydestination = $myhostname, ${DOMAINE}, localhost.localdomain, localhost
relayhost =
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all
${enPlus.join('\n')}`;

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
export const OPENDKIM_CONFIGURE = OPENDKIM_DEBIAN.replace('#Domain\t\t\texample.com', `Domain\t\t\t${DOMAINE}`)
  .replace('#Selector\t\t2020', 'Selector\t\tmail')
  .replace('#KeyFile\t\t/etc/dkimkeys/example.private', 'KeyFile\t\t/etc/dkimkeys/mail.private')
  .replace('Socket\t\t\tlocal:/run/opendkim/opendkim.sock\n#Socket\t\t\tinet:8891@localhost', '#Socket\t\t\tlocal:/run/opendkim/opendkim.sock\nSocket\t\t\tinet:8891@localhost');

export const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    bind: { uid: 104, groupe: 'bind', maison: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    postfix: { uid: 105, groupe: 'postfix', maison: '/var/spool/postfix', shell: '/usr/sbin/nologin' },
    opendkim: { uid: 110, groupe: 'opendkim', maison: '/run/opendkim', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    nour: { uid: 1001, groupe: 'nour' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    mail: { gid: 8, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'nour'] },
    'www-data': { gid: 33, membres: [] },
    bind: { gid: 106, membres: [] },
    postfix: { gid: 107, membres: [] },
    opendkim: { gid: 112, membres: [] },
    vous: { gid: 1000, membres: [] },
    nour: { gid: 1001, membres: [] },
  },
});

// ——— Les serveurs d'en face ———

// La signature qu'aurait un message déposé sur la machine, envoyé maintenant (sans rien écrire au journal).
export function signatureAttendue(jeu: Jeu): Signature | null {
  const c = courrier(jeu);
  if (!c || systemd(jeu)?.services.postfix?.etat !== 'active' || systemd(jeu)?.services.opendkim?.etat !== 'active') return null;
  const valeurs = c.postfix?.valeurs ?? {};
  const milters = (valeurs.non_smtpd_milters ?? '').replace('$smtpd_milters', valeurs.smtpd_milters ?? '').replace('${smtpd_milters}', valeurs.smtpd_milters ?? '');
  const conf = c.dkim ?? lireDkim(jeu.lire(OPENDKIM_CONF) ?? '');
  const joint = milters.split(/[\s,]+/).some((m) => {
    const inet = /^inet:(?:(localhost|127\.0\.0\.1):)?(\d+)$/.exec(m);
    const p = /^inet6?:(\d+)(?:@(localhost|127\.0\.0\.1))?$/.exec(conf.prise);
    if (inet && p) return inet[2] === p[1];
    const unix = /^unix:(.+)$/.exec(m);
    const l = /^(?:local|unix):(.+)$/.exec(conf.prise);
    return !!unix && !!l && l[1] === `/var/spool/postfix${unix[1]}`;
  });
  if (!joint || !conf.cle || !conf.selecteur || !conf.domaines.includes(DOMAINE) || !conf.mode.includes('s')) return null;
  const publique = clePublique(jeu.lire(conf.cle) ?? '');
  return publique ? { d: DOMAINE, s: conf.selecteur, cle: publique } : null;
}

/** Un message des Jardins, tel qu'un serveur distant le recevrait maintenant. */
export const messageJardins = (jeu: Jeu): Message => ({
  id: 'TEST',
  de: `${jeu.joueur}@${DOMAINE}`,
  a: [`test@${MAILBOX.domaine}`],
  from: `${jeu.joueur}@${DOMAINE}`,
  sujet: '',
  corps: '',
  arrive: 0,
  taille: 0,
  signature: signatureAttendue(jeu),
  ip: IP,
});

/** La lettre d'information, envoyée par newsmail.example : signée pour gardens.example si le CNAME de nm1 est publié. */
export function lettre(jeu: Jeu): Message {
  const delegue = verifierDkim(jeu, { d: DOMAINE, s: NEWSMAIL.selecteur, cle: CLE_NEWSMAIL }).resultat === 'pass';
  return {
    id: 'NEWS',
    de: `bounces+4521@bounce.${NEWSMAIL.domaine}`,
    a: [`amina@${MAILBOX.domaine}`],
    from: `news@${DOMAINE}`,
    sujet: '',
    corps: '',
    arrive: 0,
    taille: 0,
    signature: { d: delegue ? DOMAINE : NEWSMAIL.domaine, s: NEWSMAIL.selecteur, cle: CLE_NEWSMAIL },
    ip: NEWSMAIL.ip,
  };
}

export const spfPasse = (jeu: Jeu) => verifierSpf(jeu, IP, DOMAINE).resultat === 'pass';

function fournisseurs(t: Traduire): EtatCourrier['fournisseurs'] {
  return {
    [MAILBOX.domaine]: {
      mx: MAILBOX.mx,
      ip: MAILBOX.ip,
      recevoir: (_j, a, m) => {
        if (a.dmarc === 'fail' && a.politique === 'reject')
          return `550 5.7.1 Unauthenticated email from ${a.fromDomaine} is not accepted due to the domain's DMARC policy. See https://support.mailbox.example/dmarc`;
        if (a.spf !== 'pass' && a.dkim !== 'pass')
          return `451 4.7.26 Unauthenticated mail from ${a.spfDomaine}: neither SPF nor DKIM passed for ${m.ip ?? IP} (SPF: ${a.spf}). Try again later. See https://support.mailbox.example/senders`;
        return `250 2.0.0 OK ${String(1795000000 + m.taille)} - mx.mailbox.example`;
      },
    },
    [VERIFICATEUR.domaine]: {
      mx: VERIFICATEUR.mx,
      ip: VERIFICATEUR.ip,
      // Le vérificateur répond à l'expéditeur avec le résultat de ses vérifications.
      recevoir: (j, a, m) => {
        const reponse: Message = {
          id: 'R' + m.id.slice(1),
          de: VERIFICATEUR.adresse,
          a: [m.de],
          from: `Authentication Checker <${VERIFICATEUR.adresse}>`,
          sujet: t('jardins-sujet-verification'),
          corps: rapportVerification(a, m, VERIFICATEUR.mx),
          arrive: systemd(j)?.horloge ?? 0,
          taille: 1800,
        };
        journaliser(j, 'postfix/smtpd', `connect from ${VERIFICATEUR.mx}[${VERIFICATEUR.ip}]`);
        journaliser(j, 'postfix/local', `${reponse.id}: to=<${m.de}>, relay=local, delay=1.2, delays=1.1/0.01/0/0.01, dsn=2.0.0, status=sent (delivered to mailbox)`);
        deposer(j, m.de, reponse);
        return '250 2.0.0 Ok: queued as 4XzQ7k2Lp9z1';
      },
    },
  };
}

export interface Depart {
  zone: string[];
  serie: number;
  mainCf: string[];
  // opendkim : absent (pas encore installé), la configuration de Debian, ou configuré avec la clé.
  opendkim: 'absent' | 'debian' | 'configure';
  maintenant: number;
  file?: (t: Traduire) => Message[];
}

/** L'état d'un chapitre : systemd (named, postfix, opendkim), le DNS, le courrier. */
export function etatJardins(t: Traduire, depart: Depart): Record<string, unknown> {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
    named: {
      description: 'BIND Domain Name Server',
      active: true,
      executable: 'named',
      processus: [{ pid: 733, utilisateur: 'bind', cpu: 0.1, mem: 1.4, commande: '/usr/sbin/named -f -u bind' }],
      charger: (j) => void rechargerZones(j),
    },
    postfix: {
      description: 'Postfix Mail Transport Agent (instance -)',
      active: true,
      executable: 'master',
      processus: [{ pid: 1180, utilisateur: 'root', cpu: 0, mem: 0.3, commande: '/usr/lib/postfix/sbin/master -w' }],
      charger: chargerPostfix,
    },
  };
  if (depart.opendkim !== 'absent')
    services.opendkim = {
      description: 'OpenDKIM Milter',
      active: true,
      executable: 'opendkim',
      processus: [{ pid: 812, utilisateur: 'opendkim', cpu: 0, mem: 0.4, commande: '/usr/sbin/opendkim -f' }],
      verifier: verifierOpendkim,
      charger: chargerDkim,
      arret: arreterDkim,
      verifierAuRechargement: true,
    };
  const dnsEtat: EtatDns = {
    conf: '/etc/bind/named.conf.local',
    primaire: {},
    secondaire: {},
    cache: {},
    serveurs: {
      primaire: ['localhost', '127.0.0.1', 'jardin', `ns1.${DOMAINE}`, IP],
      secondaire: ['ns2.registry.example', '192.0.2.53'],
      resolveur: ['9.9.9.9', 'dns.quad9.net'],
    },
    charges: {},
    recursif: true,
  };
  const etat: EtatCourrier = { ip: IP, file: depart.file?.(t) ?? [], compteur: 40, postfix: null, dkim: null, fournisseurs: fournisseurs(t), remis: [] };
  return {
    systemd: nouveauSystemd('jardin', depart.maintenant - 6 * 86_400_000, depart.maintenant, services),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 733, utilisateur: 'bind', cpu: 0.1, mem: 1.4, commande: '/usr/sbin/named -f -u bind' },
      { pid: 1180, utilisateur: 'root', cpu: 0, mem: 0.3, commande: '/usr/lib/postfix/sbin/master -w' },
      ...(depart.opendkim !== 'absent' ? [{ pid: 812, utilisateur: 'opendkim', cpu: 0, mem: 0.4, commande: '/usr/sbin/opendkim -f' }] : []),
    ],
    dns: dnsEtat,
    courrier: etat,
    ecoute: [
      { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
      { proto: 'tcp', adresse: '0.0.0.0', port: 25, processus: 'master', pid: 1180 },
      { proto: 'udp', adresse: '0.0.0.0', port: 53, processus: 'named', pid: 733 },
      { proto: 'tcp', adresse: '0.0.0.0', port: 53, processus: 'named', pid: 733 },
      ...(depart.opendkim === 'configure' ? [{ proto: 'tcp', adresse: '127.0.0.1', port: 8891, processus: 'opendkim', pid: 812 }] : []),
    ],
  };
}

/** Une fois le monde créé : named charge la zone (le registre en a la copie), Postfix et OpenDKIM leur configuration. */
export function initialiserJardins(j: Jeu) {
  rechargerZones(j);
  const d = j.etat.dns as EtatDns;
  d.secondaire = { ...zonesExterieures(), ...JSON.parse(JSON.stringify(d.primaire)) };
  const sd = systemd(j)!;
  sd.journal = sd.journal.filter((x) => x.unite !== 'named.service');
  chargerPostfix(j);
  if (sd.services.opendkim) chargerDkim(j);
}

/** Le monde : /etc (comptes, BIND, Postfix, OpenDKIM), /var/log/mail.log, /var/mail, et la maison. */
export function mondeJardins(t: Traduire, depart: Depart, maison: Record<string, Parameters<typeof d>[0][string]>, journal: string, boite = ''): Dossier {
  const racine = { proprio: 'root' };
  const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
  const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
  const binaire = (taille: number) => f('', { proprio: 'root', mode: 'rwxr-xr-x', taille });
  return lieu({
    etc: lieu({
      ...fichiersComptes(),
      hostname: fichier('jardin'),
      mailname: fichier(DOMAINE),
      'resolv.conf': fichier('nameserver 127.0.0.1'),
      aliases: fichier(`# See man 5 aliases for format\npostmaster:    root\nroot:          ${joueur(t)}\ndmarc:         ${joueur(t)}`),
      bind: lieu({
        'named.conf.local': fichier(NAMED_CONF_LOCAL, { proprio: 'root', groupe: 'bind' }),
        zones: lieu({ [`db.${DOMAINE}`]: fichier(zone(depart.serie, depart.zone), { proprio: 'root', groupe: 'bind' }) }, { proprio: 'root', groupe: 'bind' }),
      }),
      postfix: lieu({
        'main.cf': fichier(MAIN_CF_DEBIAN(depart.mainCf)),
        'master.cf': fichier(
          '#\n# Postfix master process configuration file.  For details on the format\n# of the file, see the master(5) manual page (command: "man 5 master" or\n# on-line: https://www.postfix.org/master.5.html).\n#\n# ==========================================================================\n# service type  private unpriv  chroot  wakeup  maxproc command + args\n#               (yes)   (yes)   (no)    (never) (100)\n# ==========================================================================\nsmtp      inet  n       -       y       -       -       smtpd\npickup    unix  n       -       y       60      1       pickup\ncleanup   unix  n       -       y       -       0       cleanup\nqmgr      unix  n       -       n       300     1       qmgr\nsmtp      unix  -       -       y       -       -       smtp\nlocal     unix  -       n       n       -       -       local',
        ),
      }),
      ...(depart.opendkim !== 'absent'
        ? {
            'opendkim.conf': fichier(depart.opendkim === 'configure' ? OPENDKIM_CONFIGURE : OPENDKIM_DEBIAN),
            dkimkeys: lieu(
              depart.opendkim === 'configure' ? { 'mail.private': fichier(PRIVEE_JARDINS, { proprio: 'opendkim', groupe: 'opendkim', mode: 'rw-------' }) } : {},
              { proprio: 'opendkim', groupe: 'opendkim', mode: 'rwx------' },
            ),
          }
        : {}),
    }),
    home: lieu({ vous: d(maison), nour: lieu({}, { proprio: 'nour', mode: 'rwx------' }) }),
    usr: lieu({
      sbin: lieu({
        postfix: binaire(27_528),
        postconf: binaire(178_656),
        postqueue: binaire(35_392),
        postsuper: binaire(52_168),
        sendmail: binaire(39_496),
        named: binaire(1_034_112),
        rndc: binaire(47_528),
        ...(depart.opendkim !== 'absent' ? { opendkim: binaire(256_312), 'opendkim-genkey': binaire(10_224), 'opendkim-testkey': binaire(22_752) } : {}),
      }),
      bin: lieu({ mailq: f('', { proprio: 'root', lien: '../sbin/sendmail' }), mail: binaire(108_392) }),
    }),
    var: lieu({
      log: lieu({ 'mail.log': f(journal, { lignes: true, proprio: 'root', groupe: 'adm', mode: 'rw-r-----' }) }),
      mail: lieu({ [joueur(t)]: f(boite, { lignes: true, proprio: joueur(t), groupe: 'mail', mode: 'rw-rw----' }) }, { proprio: 'root', groupe: 'mail', mode: 'rwxrwsr-x' }),
      www: lieu({}),
    }),
  });
}

/** Ce que voit un serveur distant pour un message des Jardins : SPF, DKIM, DMARC. */
export const authJardins = (j: Jeu) => authentifier(j, messageJardins(j));
export const authLettre = (j: Jeu) => authentifier(j, lettre(j));
