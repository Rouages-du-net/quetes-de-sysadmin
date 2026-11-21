// Story "The Airwaves": what its chapters share. Five community radio
// stations run their common services from mast (pylone in French,
// 192.0.2.72), a Debian server of the federation: an intranet with the
// schedule and the rota, the shared programme archive, and the portal where
// reporters upload their recordings from the field. Every name is under
// airwaves.internal, so no public authority can certify them: two years ago
// Kwame, the volunteer who looked after everything, set up an internal
// certificate authority with openssl, in /srv/ca. The stations' computers
// trust its root because Kwame installed it by hand.
// Chapter 1: the intranet's certificate (CN only, 825 days) has expired;
// chapter 2: an issuing CA under the root, a site that sends its
// certificate without the intermediate, a new studio PC (booth, an
// internal host) and the monitoring that don't trust the root; chapter 3:
// a reporter's laptop stolen with its client certificate, revocation and
// CRL, then a watch on expiry dates.
// Adaeze coordinates the federation; Mateo is the technician of the
// Riverside station; Amina, Lindiwe and Ravi report from the field.
// Each command, a minute passes (cron, timers, the reporters' uploads).
// Addresses: RFC 5737; names: .internal (ICANN, 2024).
// Sources: https://docs.openssl.org/3.0/man1/openssl-x509/, https://docs.openssl.org/3.0/man1/openssl-ca/,
// https://www.rfc-editor.org/rfc/rfc5280, https://wiki.mozilla.org/Security/Server_Side_TLS,
// https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html,
// https://nginx.org/en/docs/http/ngx_http_ssl_module.html

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { checkNginx, httpRequest, loadNginx } from '../nginx';
import { passTime as passMinutes } from '../timers';
import { MIME, NGINX_CONF } from '../commands/apt';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { pem, readAll, type Certificate, type KeyInfo } from '../tls';
import { BUNDLE, CA_CONF, DAY, LOCAL_CAS, MOZILLA, bytesOf, crlPem, hex, issuedBy, keyPem, makeCertificate, nowUtc, readCrls, readIndex, readKey, selfSigned, slashDn, subjectHash, trustStore, utcTime, verify, writeIndex, type Crl, type Extensions, type IndexEntry } from '../pki';
import type { InternalHost } from '../world';
import type { PkiNet } from '../commands/openssl';
import { certText } from '../commands/openssl';

export const HOME = '/home/you';
export const PASSWORD = 'mixing-desk-30';
export const MAST = '192.0.2.72';
export const BOOTH = '192.0.2.73';
export const INTRANET = 'intranet.airwaves.internal';
export const BOARD = 'board.airwaves.internal';
export const ARCHIVE = 'archive.airwaves.internal';
export const CONTRIB = 'contrib.airwaves.internal';
export const STREAM = 'stream.airwaves.internal';
// The address the stolen laptop connects from, and Amina's.
export const THIEF = '203.0.113.66';
export const AMINA_AT = '198.51.100.31';

// Monday 4 March 2030, 8:40 (chapter 1); Monday 18 March, 9:15 (chapter 2);
// Tuesday 16 April, 10:05 (chapter 3). Local time (Paris), like systemd's clock.
export const NOW_1 = Date.UTC(2030, 2, 4, 8, 40, 0);
export const NOW_2 = Date.UTC(2030, 2, 18, 9, 15, 0);
export const NOW_3 = Date.UTC(2030, 3, 16, 10, 5, 0);
const BOOT = Date.UTC(2030, 1, 20, 6, 58, 0);

export type ChapterNo = 1 | 2 | 3;

// ——— Keys and certificates ———

const keyId = (seed: string) => hex(bytesOf(`airwaves:${seed}`, 10));
const k = (seed: string, alg: 'RSA' | 'EC', bits: number): KeyInfo => ({ alg, bits, id: keyId(seed) });
export const KEYS = {
  root: k('root', 'EC', 384),
  issuing: k('issuing', 'EC', 384),
  intranetOld: k('intranet-2028', 'RSA', 2048),
  intranet: k('intranet-2030', 'EC', 256),
  archive: k('archive', 'EC', 256),
  contrib: k('contrib', 'EC', 256),
  stream: k('stream', 'EC', 256),
  amina: k('laptop-amina', 'EC', 256),
  lindiwe: k('laptop-lindiwe', 'EC', 256),
  ravi: k('laptop-ravi', 'EC', 256),
};

export const ROOT_DN = 'O=Airwaves Federation, CN=Airwaves Root CA';
export const ISSUING_DN = 'O=Airwaves Federation, CN=Airwaves Issuing CA 1';
const serial20 = (seed: string) => {
  const b = bytesOf(`airwaves-serial:${seed}`, 20);
  b[0] &= 0x7f;
  return hex(b).toUpperCase();
};

const CA_EXT: Extensions = { bc: true, bcCritical: true, ca: true, ku: ['keyCertSign', 'cRLSign'], kuCritical: true };
const SERVER_EXT = (...names: string[]): Extensions => ({ bc: true, ca: false, ku: ['digitalSignature'], kuCritical: true, eku: ['serverAuth'], dns: names, ips: [] });
const CLIENT_EXT: Extensions = { bc: true, ca: false, ku: ['digitalSignature'], kuCritical: true, eku: ['clientAuth'] };

const cert = (subjectDn: string, key: KeyInfo, issuer: string, signer: KeyInfo, serial: string, start: number, end: number, ext: Extensions): Certificate => ({
  ...makeCertificate({ subject: subjectDn, key, issuer, signer: signer.id, serial, start, end, ext }),
  sig: signer.alg,
});

export const ROOT = cert(ROOT_DN, KEYS.root, ROOT_DN, KEYS.root, serial20('root'), Date.UTC(2028, 0, 15, 9, 0, 0), Date.UTC(2038, 0, 13, 9, 0, 0), CA_EXT);
export const ISSUING = cert(ISSUING_DN, KEYS.issuing, ROOT_DN, KEYS.root, serial20('issuing'), Date.UTC(2030, 2, 11, 9, 0, 0), Date.UTC(2035, 2, 10, 9, 0, 0), { ...CA_EXT, pathlen: 0 });
// Kwame's 2028 certificate: the CN only, no extension, 825 days.
const OLD_END = Date.UTC(2030, 2, 3, 22, 59, 59);
export const INTRANET_OLD = cert(`CN=${INTRANET}`, KEYS.intranetOld, ROOT_DN, KEYS.root, serial20('intranet-2028'), OLD_END - 825 * DAY + 1000, OLD_END, {});
// What chapter 1's solution leaves (for chapters 2 and 3).
export const INTRANET_NEW = cert(`CN=${INTRANET}`, KEYS.intranet, ROOT_DN, KEYS.root, serial20('intranet-2030'), Date.UTC(2030, 2, 4, 8, 12, 0), Date.UTC(2030, 2, 4, 8, 12, 0) + 365 * DAY, SERVER_EXT(INTRANET, BOARD));
// The streaming server's certificate, signed by the root in 2029: it expires 20 days after chapter 3 starts.
export const STREAM_CERT = cert(`CN=${STREAM}`, KEYS.stream, ROOT_DN, KEYS.root, serial20('stream-2029'), Date.UTC(2029, 4, 6, 8, 0, 0), Date.UTC(2030, 4, 6, 8, 0, 0), SERVER_EXT(STREAM));
const issued = (n: number) => Date.UTC(2030, 2, 12 + n, 14, 0, 0);
export const ARCHIVE_CERT = cert(`CN=${ARCHIVE}`, KEYS.archive, ISSUING_DN, KEYS.issuing, '1000', issued(0), issued(0) + 365 * DAY, SERVER_EXT(ARCHIVE));
export const CONTRIB_CERT = cert(`CN=${CONTRIB}`, KEYS.contrib, ISSUING_DN, KEYS.issuing, '1001', issued(1), issued(1) + 365 * DAY, SERVER_EXT(CONTRIB));
const laptop = (who: 'amina' | 'lindiwe' | 'ravi', serial: string, n: number) =>
  cert(`O=Airwaves Federation, OU=Reporters, CN=laptop-${who}`, KEYS[who], ISSUING_DN, KEYS.issuing, serial, issued(n), issued(n) + 365 * DAY, CLIENT_EXT);
export const LAPTOPS = { amina: laptop('amina', '1002', 2), lindiwe: laptop('lindiwe', '1003', 2), ravi: laptop('ravi', '1004', 3) };
// The root's CRL, written at the key ceremony that created the issuing CA (valid a year).
export const ROOT_CRL: Crl = { issuer: ROOT_DN, signer: KEYS.root.id, last: Date.UTC(2030, 2, 11, 9, 5, 0), next: Date.UTC(2031, 2, 11, 9, 5, 0), number: '01', revoked: [] };

// Public authorities of Mozilla's store (the ca-certificates package holds about 150; four here).
const PUBLIC: [string, string, 'RSA' | 'EC', number, number, number][] = [
  ['ISRG_Root_X1', 'C=US, O=Internet Security Research Group, CN=ISRG Root X1', 'RSA', 4096, Date.UTC(2015, 5, 4, 11, 4, 38), Date.UTC(2035, 5, 4, 11, 4, 38)],
  ['ISRG_Root_X2', 'C=US, O=Internet Security Research Group, CN=ISRG Root X2', 'EC', 384, Date.UTC(2020, 8, 4, 0, 0, 0), Date.UTC(2040, 8, 17, 16, 0, 0)],
  ['DigiCert_Global_Root_G2', 'C=US, O=DigiCert Inc, OU=www.digicert.com, CN=DigiCert Global Root G2', 'RSA', 2048, Date.UTC(2013, 7, 1, 12, 0, 0), Date.UTC(2038, 0, 15, 12, 0, 0)],
  ['USERTrust_ECC_Certification_Authority', 'C=US, ST=New Jersey, L=Jersey City, O=The USERTRUST Network, CN=USERTrust ECC Certification Authority', 'EC', 384, Date.UTC(2010, 1, 1, 0, 0, 0), Date.UTC(2038, 0, 18, 23, 59, 59)],
];
const publicRoots = () =>
  PUBLIC.map(([file, dn, alg, bits, start, end]) => {
    const key = k(`public-${file}`, alg, bits);
    return { file, cert: cert(dn, key, dn, key, serial20(file), start, end, CA_EXT) };
  });

// ——— Accounts ———

export const mastAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    adaeze: { uid: 1001, group: 'adaeze' },
    mateo: { uid: 1002, group: 'mateo' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'mateo'] },
    'www-data': { gid: 33, members: [] },
    you: { gid: 1000, members: [] },
    adaeze: { gid: 1001, members: [] },
    mateo: { gid: 1002, members: [] },
  },
});

const boothAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, mateo: { uid: 1001, group: 'mateo' } },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['you', 'mateo'] }, you: { gid: 1000, members: [] }, mateo: { gid: 1001, members: [] } },
});

// ——— nginx ———

const site = (names: string[], file: string, root: string, extra = '') => `server {
    listen 80;
    server_name ${names.join(' ')};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${names.join(' ')};

    ssl_certificate /etc/nginx/ssl/${file}.crt;
    ssl_certificate_key /etc/nginx/ssl/${file}.key;
${extra}
    root ${root};
    index index.html;
}`;

export const INTRANET_CONF = site([INTRANET, BOARD], 'intranet', '/var/www/intranet');
export const ARCHIVE_CONF = site([ARCHIVE], 'archive', '/var/www/archive');
export const CONTRIB_CONF = site(
  [CONTRIB],
  'contrib',
  '/var/www/contrib',
  `
    # Only the reporters' laptops: a client certificate from our CA.
    ssl_client_certificate /etc/nginx/ssl/airwaves-cas.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;
`,
);

// ——— The CA's files ———

export const ISSUING_CNF = `# Airwaves Issuing CA 1 -- set up by Kwame, 11 March 2030.
# Sign:    openssl ca -config /srv/ca/issuing/openssl.cnf -in request.csr -out cert.crt
#          (add -extensions client_cert for a laptop)

[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = /srv/ca/issuing
certs             = $dir/certs
crl_dir           = $dir/crl
new_certs_dir     = $dir/newcerts
database          = $dir/index.txt
serial            = $dir/serial
crlnumber         = $dir/crlnumber
certificate       = $dir/issuing.crt
private_key       = $dir/private/issuing.key
default_md        = sha256
default_days      = 365
default_crl_days  = 30
policy            = policy_loose
copy_extensions   = copy
x509_extensions   = server_cert

[ policy_loose ]
organizationName       = optional
organizationalUnitName = optional
commonName             = supplied

[ server_cert ]
basicConstraints       = CA:FALSE
keyUsage               = critical, digitalSignature
extendedKeyUsage       = serverAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer

[ client_cert ]
basicConstraints       = CA:FALSE
keyUsage               = critical, digitalSignature
extendedKeyUsage       = clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
`;

// Debian's /usr/lib/ssl/openssl.cnf, shortened: the demoCA of [ CA_default ] and the v3_ca extensions.
export const DEFAULT_CNF = `#
# OpenSSL example configuration file.
# See doc/man5/config.pod for more info.
#

[ ca ]
default_ca      = CA_default            # The default ca section

[ CA_default ]
dir             = ./demoCA              # Where everything is kept
certs           = $dir/certs            # Where the issued certs are kept
crl_dir         = $dir/crl              # Where the issued crl are kept
database        = $dir/index.txt        # database index file.
new_certs_dir   = $dir/newcerts         # default place for new certs.
certificate     = $dir/cacert.pem       # The CA certificate
serial          = $dir/serial           # The current serial number
crlnumber       = $dir/crlnumber        # the current crl number
private_key     = $dir/private/cakey.pem # The private key
default_days    = 365                   # how long to certify for
default_crl_days= 30                    # how long before next CRL
default_md      = default               # use public key default MD

[ req ]
default_bits            = 2048
distinguished_name      = req_distinguished_name
x509_extensions = v3_ca # The extensions to add to the self signed cert

[ v3_ca ]
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid:always,issuer
basicConstraints = critical,CA:true
`;

const index = (entries: Certificate[], revoked: Record<string, string> = {}): string =>
  writeIndex(
    entries.map(
      (c): IndexEntry => ({
        status: revoked[c.serial] ? 'R' : 'V',
        expiry: c.end,
        serial: c.serial,
        file: 'unknown',
        subject: slashDn(c.subjectDn!),
      }),
    ),
  );

// ——— State ———

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.3, command });

export function mastState(n: ChapterNo) {
  const now = n === 1 ? NOW_1 : n === 2 ? NOW_2 : NOW_3;
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(642, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(588, 'root', '/usr/sbin/cron -f')] },
    nginx: {
      description: 'A high performance web server and a reverse proxy server',
      active: true,
      executable: 'nginx',
      process: [proc(811, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;'), proc(812, 'www-data', 'nginx: worker process')],
      check: checkNginx,
      load: loadNginx,
      checkToReload: true,
    },
  };
  const hosts: Record<string, string> = { localhost: 'mast', '127.0.0.1': 'mast', [MAST]: 'mast', [INTRANET]: 'mast', [BOARD]: 'mast', [ARCHIVE]: 'mast', [CONTRIB]: 'mast', 'mast.airwaves.internal': 'mast' };
  return {
    systemd: newSystemd('mast', BOOT, now, services),
    process: [proc(1, 'root', '/sbin/init'), ...Object.values(services).flatMap((x) => x.process ?? [])],
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 642 },
      { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 811 },
      { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 811 },
    ],
    nginx: { load: null, names: ['mast', 'mast.airwaves.internal', MAST, INTRANET, BOARD, ...(n >= 2 ? [ARCHIVE] : []), ...(n === 3 ? [CONTRIB] : [])], accessLog: true },
    crontabs: n >= 2 ? { root: CRONTAB } : {},
    pkiNet: { main: 'mast', hosts, addresses: { mast: MAST, booth: BOOTH } } satisfies PkiNet,
  };
}

export const CRONTAB = `# m h  dom mon dow   command
# Mateo, 11 March: are our sites answering over HTTPS?
*/5 * * * * /usr/local/bin/check-sites
`;

export const CHECK_SITES = `#!/bin/bash
# Mateo, 11 March: is each of our sites answering over HTTPS?
# Every five minutes, from root's crontab. The result: /var/log/check-sites.log
LOG=/var/log/check-sites.log
for site in ${INTRANET} ${ARCHIVE}; do
    if curl -fsS -o /dev/null "https://$site/" 2>> "$LOG"; then
        echo "$(date '+%F %T') OK   $site" >> "$LOG"
    else
        echo "$(date '+%F %T') FAIL $site" >> "$LOG"
    fi
done
`;

// The monitoring's log since Mateo set it up: red from the first minute.
function checkLog(): string {
  const lines: string[] = [];
  for (let t = Date.UTC(2030, 2, 11, 16, 0, 0); t < NOW_2; t += 6 * 3600_000) {
    const at = new Date(t).toISOString().slice(0, 19).replace('T', ' ');
    for (const s of [INTRANET, ARCHIVE]) {
      if (s === ARCHIVE && t < Date.UTC(2030, 2, 12, 15, 0, 0)) continue;
      lines.push('curl: (60) SSL certificate problem: unable to get local issuer certificate', `${at} FAIL ${s}`);
    }
  }
  return lines.slice(-24).join('\n');
}

// ——— The world ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const secret = (text: string): File => file(text, { owner: 'root', mode: 'rw-------' });

/** /etc/ssl/certs, /usr/share/ca-certificates and /etc/ca-certificates.conf, with these local authorities installed. */
export function trustFiles(local: Record<string, Certificate>): { etcSsl: Directory; usrShare: Directory; conf: File; localDir: Directory } {
  const roots = publicRoots();
  const certs: Record<string, Node> = {};
  const link = (target: string): File => ({ type: 'file', content: '', link: target, owner: 'root', mode: 'rwxrwxrwx' });
  for (const r of roots) {
    certs[`${r.file}.pem`] = link(`${MOZILLA}/mozilla/${r.file}.crt`);
    certs[`${subjectHash(r.cert)}.0`] = link(`${r.file}.pem`);
  }
  for (const [name, c] of Object.entries(local)) {
    certs[`${name}.pem`] = link(`${LOCAL_CAS}/${name}.crt`);
    certs[`${subjectHash(c)}.0`] = link(`${name}.pem`);
  }
  certs['ca-certificates.crt'] = file([...roots.map((r) => pem(r.cert)), ...Object.values(local).map(pem)].join('\n'), { owner: 'root', mode: 'rw-r--r--' });
  return {
    etcSsl: dir({ certs: dir(certs), private: dir({}, { owner: 'root', group: 'ssl-cert', mode: 'rwx--x---' }), 'openssl.cnf': file(DEFAULT_CNF) }),
    usrShare: dir({ mozilla: dir(Object.fromEntries(roots.map((r) => [`${r.file}.crt`, file(pem(r.cert))]))) }),
    conf: file(`# This file lists certificates that you wish to use or to ignore to be\n# installed in /etc/ssl/certs.\n# update-ca-certificates(8) will update /etc/ssl/certs by reading this file.\n#\n# This is autogenerated by dpkg-reconfigure ca-certificates.\n# Certificates should be installed under /usr/share/ca-certificates\n# and files with extension '.crt' is recognized as available certificate.\n#\n# line begins with # is comment.\n# line begins with ! is certificate filename to be deselected.\n#\n${roots.map((r) => `mozilla/${r.file}.crt`).join('\n')}`),
    localDir: dir(Object.fromEntries(Object.entries(local).map(([name, c]) => [`${name}.crt`, file(pem(c))]))),
  };
}

const page = (t: Translate, key: string) => file(t(key), { owner: 'www-data', group: 'www-data' });

export function mastWorld(t: Translate, n: ChapterNo, home: Record<string, File>): Directory {
  const trust = trustFiles(n === 3 ? { 'airwaves-root': ROOT } : {});
  const keyMode: Rights = n === 1 ? { owner: 'root', mode: 'rw-r--r--' } : { owner: 'root', mode: 'rw-------' };
  const issuedCerts = n === 3 ? [ARCHIVE_CERT, CONTRIB_CERT, LAPTOPS.amina, LAPTOPS.lindiwe, LAPTOPS.ravi] : [ARCHIVE_CERT];
  const caText = (c: Certificate) => `${certText(c)}\n${pem(c)}`;
  const issuing: Record<string, Node> =
    n >= 2
      ? {
          issuing: dir(
            {
              'openssl.cnf': file(ISSUING_CNF),
              'issuing.crt': file(pem(ISSUING)),
              'chain.pem': file(`${pem(ISSUING)}\n${pem(ROOT)}`),
              private: dir({ 'issuing.key': secret(keyPem(KEYS.issuing)) }, { owner: 'root', mode: 'rwx------' }),
              'index.txt': file(index(issuedCerts)),
              'index.txt.attr': file('unique_subject = no'),
              'index.txt.old': file(index(issuedCerts.slice(0, -1))),
              serial: file(n === 3 ? '1005' : '1001'),
              'serial.old': file(n === 3 ? '1004' : '1000'),
              crlnumber: file('1000'),
              newcerts: dir(Object.fromEntries(issuedCerts.map((c) => [`${c.serial}.pem`, file(caText(c))]))),
              certs: dir(Object.fromEntries(issuedCerts.map((c) => [`${c.cn}.crt`, file(pem(c))]))),
              crl: dir({}),
              requests: dir({}),
            },
            { owner: 'root', mode: 'rwxr-xr-x' },
          ),
        }
      : {};
  const nginxSsl: Record<string, Node> = {
    'intranet.crt': file(pem(n === 1 ? INTRANET_OLD : INTRANET_NEW)),
    'intranet.key': secret(keyPem(n === 1 ? KEYS.intranetOld : KEYS.intranet)),
    ...(n >= 2
      ? {
          // Chapter 2: the leaf alone (Kwame's mistake); chapter 3: fixed, with the intermediate.
          'archive.crt': file(n === 2 ? pem(ARCHIVE_CERT) : `${pem(ARCHIVE_CERT)}\n${pem(ISSUING)}`),
          'archive.key': secret(keyPem(KEYS.archive)),
        }
      : {}),
    ...(n === 3 ? { 'contrib.crt': file(`${pem(CONTRIB_CERT)}\n${pem(ISSUING)}`), 'contrib.key': secret(keyPem(KEYS.contrib)), 'airwaves-cas.pem': file(`${pem(ROOT)}\n${pem(ISSUING)}`) } : {}),
  };
  const enabled: Record<string, Node> = { intranet: file(INTRANET_CONF), ...(n >= 2 ? { archive: file(ARCHIVE_CONF) } : {}), ...(n === 3 ? { contrib: file(CONTRIB_CONF) } : {}) };
  const sshKey = generateKey('airwaves-mast', `you@${machineName(t, 'mast')}`);
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file('mast'),
      hosts: file(`127.0.0.1\tlocalhost\n${MAST}\tmast.airwaves.internal mast ${INTRANET} ${BOARD} ${ARCHIVE} ${CONTRIB}\n${BOOTH}\tbooth.airwaves.internal booth`),
      nginx: dir({
        // Chapter 3: Kwame set the error log to info, where nginx writes why it refuses a client certificate.
        'nginx.conf': file(n === 3 ? NGINX_CONF.replace('error_log /var/log/nginx/error.log;', 'error_log /var/log/nginx/error.log info;') : NGINX_CONF),
        'mime.types': file(MIME),
        'conf.d': dir({}),
        'modules-enabled': dir({}),
        'sites-available': dir({ ...enabled }),
        'sites-enabled': dir(enabled),
        ssl: dir(nginxSsl),
      }),
      ssl: trust.etcSsl,
      'ca-certificates.conf': trust.conf,
      'ca-certificates': dir({ 'update.d': dir({}) }),
      systemd: dir({ system: dir({}) }),
    }),
    srv: dir({
      ca: dir(
        {
          'ca.crt': file(pem(ROOT)),
          'ca.srl': file(n === 1 ? INTRANET_OLD.serial : INTRANET_NEW.serial),
          private: dir({ 'ca.key': file(keyPem(KEYS.root), keyMode) }, n === 1 ? { owner: 'root', mode: 'rwxr-xr-x' } : { owner: 'root', mode: 'rwx------' }),
          issued: dir({
            'intranet-2028.crt': file(pem(INTRANET_OLD)),
            ...(n >= 2 ? { 'intranet-2030.crt': file(pem(INTRANET_NEW)), 'issuing-ca-1.crt': file(pem(ISSUING)) } : {}),
            'stream.crt': file(pem(STREAM_CERT)),
          }),
          ...(n === 3 ? { crl: dir({ 'root.crl': file(crlPem(ROOT_CRL)) }) } : ({} as Record<string, Node>)),
          'README.txt': file(t(`airwaves-readme-ca-${n}`)),
          'POLICY.txt': file(t('airwaves-policy')),
          ...issuing,
        },
        { owner: 'root', mode: 'rwxr-xr-x' },
      ),
    }),
    usr: dir({
      bin: dir({ openssl: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_014_808 }), curl: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 309_912 }) }),
      sbin: dir({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }), 'update-ca-certificates': f('', { owner: 'root', mode: 'rwxr-xr-x', size: 6_524 }) }),
      lib: dir({ ssl: dir({ 'openssl.cnf': file(DEFAULT_CNF) }) }),
      local: dir({
        bin: dir(n >= 2 ? { 'check-sites': file(CHECK_SITES, { owner: 'root', mode: 'rwxr-xr-x' }) } : {}),
        share: dir({ 'ca-certificates': trust.localDir }),
      }),
      share: dir({ 'ca-certificates': trust.usrShare }),
    }),
    var: dir({
      www: dir({
        intranet: dir({ 'index.html': page(t, 'airwaves-site-intranet') }),
        ...(n >= 2 ? { archive: dir({ 'index.html': page(t, 'airwaves-site-archive') }) } : {}),
        ...(n === 3 ? { contrib: dir({ 'index.html': page(t, 'airwaves-site-contrib') }) } : {}),
      }),
      log: dir({
        nginx: dir(
          { 'access.log': f(n === 3 ? contribPast() : '', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }), 'error.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) },
          { owner: 'root', group: 'adm', mode: 'rwxr-xr-x' },
        ),
        ...(n >= 2 ? { 'check-sites.log': file(n === 2 ? checkLog() : `${new Date(NOW_3 - 600_000).toISOString().slice(0, 19).replace('T', ' ')} OK   ${INTRANET}\n${new Date(NOW_3 - 600_000).toISOString().slice(0, 19).replace('T', ' ')} OK   ${ARCHIVE}`) } : {}),
      }),
      mail: dir({}, { owner: 'root', group: 'mail', mode: 'rwxrwsr-x' }),
    }),
    home: dir({
      you: d({ ...home, '.ssh': d({ id_ed25519: f(sshKey.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(sshKey.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }),
      adaeze: dir({}, { owner: 'adaeze', mode: 'rwx------' }),
      mateo: dir({}, { owner: 'mateo', mode: 'rwx------' }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

// Last night's uploads, and the stolen laptop's first connections (the access log).
function contribPast(): string {
  const at = (h: number, m: number) => {
    const d = new Date(Date.UTC(2030, 3, 16, h, m, 12));
    const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getUTCDate()).padStart(2, '0')}/${MONTH[d.getUTCMonth()]}/${d.getUTCFullYear()}:${d.toISOString().slice(11, 19)} +0200`;
  };
  const line = (ip: string, h: number, m: number, code = 200, size = 412) => `${ip} - - [${at(h, m)}] "GET / HTTP/1.1" ${code} ${size} "-" "airwaves-uploader/2.1"`;
  return [line(AMINA_AT, 7, 2), line('198.51.100.58', 7, 40), line(THIEF, 2, 14), line(THIEF, 2, 15), line(AMINA_AT, 9, 31), line(THIEF, 9, 48), line(THIEF, 9, 51)]
    .sort((a, b) => a.split('[')[1].localeCompare(b.split('[')[1]))
    .join('\n');
}

// ——— booth, the new studio PC (an internal host) ———

export function boothHost(commands: string[], installed = false): InternalHost {
  return {
    address: BOOTH,
    domain: 'booth.airwaves.internal',
    accounts: boothAccounts,
    commands,
    state: (t) => ({
      systemd: newSystemd(machineName(t, 'booth'), Date.UTC(2030, 2, 15, 17, 30, 0), NOW_2, {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(602, 'root', 'sshd: /usr/sbin/sshd -D')] },
      }),
    }),
    createWorld: (t) => {
      const trust = trustFiles(installed ? { 'airwaves-root': ROOT } : {});
      const key = generateKey('airwaves-mast', `you@${machineName(t, 'mast')}`);
      return dir({
        etc: dir({ ...accountsFiles(), hostname: file(machineName(t, 'booth')), ssl: trust.etcSsl, 'ca-certificates.conf': trust.conf, 'ca-certificates': dir({ 'update.d': dir({}) }) }),
        usr: dir({
          bin: dir({ curl: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 309_912 }), openssl: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_014_808 }) }),
          lib: dir({ ssl: dir({ 'openssl.cnf': file(DEFAULT_CNF) }) }),
          local: dir({ share: dir({ 'ca-certificates': trust.localDir }) }),
          share: dir({ 'ca-certificates': trust.usrShare }),
        }),
        home: dir({
          you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }), 'note_from_mateo.txt': f(t('chain-of-trust-note-mateo')) }),
          mateo: dir({}, { owner: 'mateo', mode: 'rwx------' }),
        }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
  };
}

export const booth = (j: Game): Shell | null => (j as Shell).principal.internal('booth');

// ——— Helpers for the chapters ———

export const sd = (j: Game) => systemd(j)!;
export const seen = (j: Game, text: string | RegExp) => {
  const all = `${j.last.output}\n${j.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const typed = (j: Game) => (j as Shell).last.line ?? '';
export const nginxRunning = (j: Game) => sd(j).services.nginx?.state === 'active';

/** What nginx serves for this name right now (the chain, PEM by PEM), without a trace. */
export const servedChain = (j: Game, name: string): Certificate[] => readAll(httpRequest((j as Shell).principal, name, '/', 443, false)?.certificate ?? null);

/** Does the chain lead to the root, with the intermediates the server sends (no partial chain, like a strict client)? */
export const chainComplete = (chain: Certificate[], now: number) => !!chain[0] && !verify(chain[0], { now, trusted: [ROOT], untrusted: chain.slice(1) }).errors.length;

/** A store holds this certificate. */
export const storeHas = (s: Shell | null, c: Certificate) => !!s && trustStore(s).some((x) => x.key?.id === c.key?.id && x.subjectDn === c.subjectDn);

/** Can this user read the file (every directory crossed, then the file)? */
export function readableBy(j: Game, path: string, user: string): boolean {
  const s = j as Shell;
  const parts = path.split('/').filter(Boolean);
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur += `/${parts[i]}`;
    const n = s.find(cur);
    if (!n || !s.can(n, 'x', user)) return false;
  }
  const n = s.find(path);
  return !!n && s.can(n, 'r', user);
}

/** Every text file of a machine (path → content), to find a secret wherever it is. */
export function filesOf(j: Game, from = '/'): [string, string][] {
  const out: [string, string][] = [];
  const walk = (p: string) => {
    if (p === '/proc' || p === '/dev' || p === '/sys') return;
    const n = (j as Shell).find(p);
    if (!n) return;
    if (n.type === 'file') {
      if (n.link === undefined && typeof n.content === 'string') out.push([p, n.content]);
      return;
    }
    for (const c of Object.keys(n.children)) walk(p === '/' ? `/${c}` : `${p}/${c}`);
  };
  walk(from);
  return out;
}

/** The files holding a CA's private key (the root's or the issuing CA's). */
export const caKeyFiles = (j: Game | null) => (j ? filesOf(j).filter(([, c]) => /PRIVATE KEY/.test(c) && [KEYS.root.id, KEYS.issuing.id].includes(readKey(c)?.id ?? '')).map(([p]) => p) : []);

/** The issuing CA's database. */
export const caIndex = (j: Game) => readIndex((j as Shell).read('/srv/ca/issuing/index.txt') ?? '');

/** The CRLs present on the machine (any file). */
export const crlsOn = (j: Game) => filesOf(j).flatMap(([p, c]) => (c.includes('BEGIN X509 CRL') ? readCrls(c).map((x) => ({ path: p, crl: x })) : []));

/** What nginx answers a laptop on contrib (its certificate as the uploader sends it), without a trace. */
export function laptopAnswer(j: Game, who: keyof typeof LAPTOPS, trace = false, address = AMINA_AT): number | null {
  const s = (j as Shell).principal;
  const r = httpRequest(s, CONTRIB, '/', 443, trace, { address, time: sd(s).clock, agent: 'airwaves-uploader/2.1', certificate: pem(LAPTOPS[who]) });
  return r?.code ?? null;
}

/** A minute passes: cron, timers; in chapter 3, the uploaders try contrib. */
export function passTime(j: Game, n: ChapterNo) {
  const s = (j as Shell).principal;
  const start = sd(s).clock;
  passMinutes(s, start, start + 60_000, () => {
    if (n !== 3) return;
    const minute = (s.state.minutes = (s.state.minutes ?? 0) + 1);
    if (minute % 3 === 1) laptopAnswer(s, 'lindiwe', true, THIEF);
    else if (minute % 5 === 2) laptopAnswer(s, 'amina', true, AMINA_AT);
  });
}

export { issuedBy, selfSigned, nowUtc, utcTime, DAY, BUNDLE, CA_CONF, LOCAL_CAS };
