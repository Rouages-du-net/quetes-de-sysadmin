// The Airwaves: a community radio federation's internal certificate
// authority. Each chapter is replayed to the end from the workstation (ssh
// mast), with another solution and false leads, in each language; the
// expected texts are checked in French. Also: the PKI model (keys,
// requests, certificates, CRLs, chain building and its OpenSSL errors) and
// update-ca-certificates.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { addExtension, parseSubj, readConf, readIndex, verify, writeIndex, type Extensions } from '../src/engine/pki';
import { ARCHIVE_CERT, INTRANET_NEW, INTRANET_OLD, ISSUING, LAPTOPS, ROOT, ROOT_CRL, booth } from '../src/engine/chapters/airwaves';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'mixing-desk-30';
const NOW = Date.UTC(2030, 2, 18, 8, 15, 0);

describe('PKI: names, extensions, the database, chain building', () => {
  it('reads -subj, extension values and configuration sections like OpenSSL', () => {
    expect(parseSubj('/O=Airwaves Federation/CN=x.internal')).toBe('O=Airwaves Federation, CN=x.internal');
    expect(parseSubj('CN=x')).toBeNull();
    const e: Extensions = {};
    expect(addExtension(e, 'subjectAltName', 'DNS:A.internal, IP:192.0.2.72')).toBeNull();
    expect(e).toEqual({ dns: ['a.internal'], ips: ['192.0.2.72'] });
    expect(addExtension(e, 'basicConstraints', 'critical,CA:TRUE,pathlen:0')).toBeNull();
    expect(e).toMatchObject({ bc: true, bcCritical: true, ca: true, pathlen: 0 });
    expect(addExtension(e, 'keyUsage', 'digitalSignature, flying')).toMatch(/invalid usage/);
    const conf = readConf('dir = /srv/ca\n[ v3 ]\nsubjectAltName = @names\n[ names ]\nDNS.1 = a.internal\nDNS.2 = b.internal\n[ x ]\ndb = $dir/index.txt');
    expect(conf.x.db).toBe('/srv/ca/index.txt');
    const e2: Extensions = {};
    expect(addExtension(e2, 'subjectAltName', conf.v3.subjectAltName, conf)).toBeNull();
    expect(e2.dns).toEqual(['a.internal', 'b.internal']);
  });

  it('keeps index.txt as openssl ca writes it (status, dates, reason, serial, subject)', () => {
    const line = 'R\t310314140000Z\t300416081500Z,keyCompromise\t1003\tunknown\t/CN=laptop-lindiwe\n';
    const entries = readIndex(line);
    expect(entries[0]).toMatchObject({ status: 'R', serial: '1003', reason: 'keyCompromise', expiry: Date.UTC(2031, 2, 14, 14, 0, 0) });
    expect(writeIndex(entries)).toBe(line);
  });

  it('builds and checks chains: unknown issuer, missing intermediate, expiry, revocation, the root CRL, purpose, depth', () => {
    const now = NOW;
    expect(verify(ARCHIVE_CERT, { now, trusted: [] }).errors.map((e) => e.code)).toEqual([20]);
    expect(verify(ARCHIVE_CERT, { now, trusted: [ROOT], all: true }).errors.map((e) => e.code)).toEqual([20, 21]);
    expect(verify(ARCHIVE_CERT, { now, trusted: [ROOT], untrusted: [ISSUING] }).errors).toEqual([]);
    expect(verify(ARCHIVE_CERT, { now, trusted: [ISSUING] }).errors.map((e) => e.code)).toEqual([2]);
    expect(verify(ARCHIVE_CERT, { now, trusted: [ISSUING], partial: true }).errors).toEqual([]);
    expect(verify(INTRANET_OLD, { now, trusted: [ROOT] }).errors.map((e) => e.code)).toEqual([10]);
    expect(verify(ROOT, { now, trusted: [] }).errors.map((e) => e.code)).toEqual([18]);
    expect(verify(INTRANET_NEW, { now, trusted: [ROOT], host: 'board.airwaves.internal' }).errors).toEqual([]);
    expect(verify(INTRANET_NEW, { now, trusted: [ROOT], host: 'archive.airwaves.internal' }).errors.map((e) => e.code)).toEqual([62]);
    expect(verify(LAPTOPS.amina, { now, trusted: [ROOT, ISSUING], purpose: 'sslserver' }).errors.map((e) => e.code)).toEqual([26]);
    const crl = { issuer: ISSUING.subjectDn!, signer: ISSUING.key!.id, last: now - 1000, next: now + 30 * 86_400_000, revoked: [{ serial: '1003', date: now - 2000 }] };
    const base = { now, trusted: [ROOT, ISSUING], purpose: 'sslclient' as const, crlCheck: 'all' as const };
    expect(verify(LAPTOPS.amina, { ...base, crls: [crl] }).errors.map((e) => e.code)).toEqual([3]);
    expect(verify(LAPTOPS.lindiwe, { ...base, crls: [crl] }).errors.map((e) => e.code)).toEqual([23]);
    expect(verify(LAPTOPS.lindiwe, { ...base, crls: [crl, ROOT_CRL] }).errors.map((e) => e.code)).toEqual([23]);
    expect(verify(LAPTOPS.amina, { ...base, crls: [crl, ROOT_CRL] }).errors).toEqual([]);
    expect(verify(LAPTOPS.amina, { ...base, crls: [{ ...crl, next: now - 1 }, ROOT_CRL] }).errors.map((e) => e.code)).toEqual([12]);
    expect(verify(LAPTOPS.amina, { now, trusted: [ROOT, ISSUING], depth: 0 }).errors.map((e) => e.code)).toEqual([22]);
  });

  it('update-ca-certificates: root only, *.crt only, the counts, the links and the bundle', () => {
    const s = new Shell(chapter('chain-of-trust'), 'en', 'mast');
    s.who = 'root';
    expect(s.execute('update-ca-certificates')).toBe('Updating certificates in /etc/ssl/certs...\n0 added, 0 removed; done.\nRunning hooks in /etc/ca-certificates/update.d...\ndone.');
    s.execute('cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.pem');
    expect(s.execute('update-ca-certificates')).toContain('0 added, 0 removed; done.');
    s.execute('mv /usr/local/share/ca-certificates/airwaves-root.pem /usr/local/share/ca-certificates/airwaves-root.crt');
    expect(s.execute('update-ca-certificates')).toContain('1 added, 0 removed; done.');
    expect(s.execute('ls -l /etc/ssl/certs/airwaves-root.pem')).toContain('airwaves-root.pem -> /usr/local/share/ca-certificates/airwaves-root.crt');
    expect(s.execute('grep -c "BEGIN CERTIFICATE" /etc/ssl/certs/ca-certificates.crt')).toBe('5');
    s.execute('rm /usr/local/share/ca-certificates/airwaves-root.crt');
    expect(s.execute('update-ca-certificates --fresh')).toContain('4 added, 0 removed; done.');
    s.who = 'you';
    s.execute('update-ca-certificates');
    expect(s.last.errors.join('\n')).toContain('Permission denied');
  });

  it('openssl: unknown options, a missing file, keys without passphrase, the CA and key that must match', () => {
    const s = new Shell(chapter('expiry-date'), 'en', 'mast');
    s.execute('openssl x509 -frobnicate -in a');
    expect(s.last.errors.join('\n')).toBe('x509: Unknown option or message digest: frobnicate\nx509: Use -help for summary.');
    s.execute('openssl verify -nope x');
    expect(s.last.errors.join('\n')).toContain('verify: Unknown option: -nope');
    s.execute('openssl x509 -in nowhere.crt -noout -dates');
    expect(s.last.errors.join('\n')).toContain('Could not open file or uri for loading certificate from nowhere.crt: No such file or directory');
    s.execute('openssl req -new -newkey rsa:2048 -keyout k.pem -subj /CN=x -out x.csr');
    expect(s.last.errors.join('\n')).toContain('-noenc');
    s.execute('openssl genpkey -algorithm EC -out k.pem');
    expect(s.last.errors.join('\n')).toContain('Error generating EC key');
    s.execute('openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out k.pem');
    expect(s.execute('openssl pkey -in k.pem -noout -text')).toContain('Private-Key: (3072 bit, 2 primes)');
    expect(s.execute('openssl req -new -key k.pem -subj /CN=x.internal -out x.csr')).toBe('');
    s.execute('openssl x509 -req -in x.csr -CA /srv/ca/ca.crt -CAkey k.pem -out x.crt');
    expect(s.last.errors.join('\n')).toBe('Error: CA certificate and CA private key do not match');
    expect(s.execute('openssl rsa -in k.pem -noout -modulus')).toMatch(/^Modulus=[0-9A-F]{768}$/);
    expect(s.execute('openssl x509 -in /srv/ca/ca.crt -noout -fingerprint -sha256')).toMatch(/^sha256 Fingerprint=([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(s.execute('openssl x509 -in /srv/ca/ca.crt -noout -ext basicConstraints,keyUsage')).toBe('X509v3 Basic Constraints: critical\n    CA:TRUE\nX509v3 Key Usage: critical\n    Certificate Sign, CRL Sign');
  });
});

for (const language of languagesFor('airwaves'))
  describe(`The Airwaves — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('airwaves'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const run = (...lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        return `${before}\n${c.shell.quitEdition() ?? ''}`;
      };
      run('ssh mast', 'yes');
      return { c, run, edit, mast: () => c.remote!.shell, finished: () => c.remote!.shell.finished };
    }

    it('chapter 1 — solution: s_client, the dates, a new key, -addext and -copy_extensions, the key protected, reload', () => {
      const { run, finished } = play([]);
      let all = run('cat message_from_adaeze.txt', 'openssl s_client -connect intranet.airwaves.internal:443 </dev/null');
      expect(all).toContain('verify error:num=10:certificate has expired\nnotAfter=Mar  3 22:59:59 2030 GMT');
      expect(all).toContain('Verify return code: 10 (certificate has expired)');
      contains(all, 'notAfter');
      all = run('openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -text', 'openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -checkend 0; echo $?');
      expect(all).toContain('Subject: CN=intranet.airwaves.internal');
      expect(all).not.toContain('Subject Alternative Name');
      expect(all).toContain('Certificate will expire\n1');
      contains(all, 'subjectAltName');
      all = run('cat /srv/ca/README.txt', 'ls -l /srv/ca/private');
      expect(all).toMatch(/-rw-r--r-- 1 root root +\d+ .* ca\.key/);
      contains(all, 'chmod 600');
      all = run('sudo chmod 600 /srv/ca/private/ca.key', 'sudo chmod 700 /srv/ca/private', 'cat /srv/ca/private/ca.key');
      expect(all).toMatch(/Permission (denied|non accordée)/);
      run('openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out intranet.key');
      expect(run('ls -l intranet.key')).toMatch(/^-rw------- 1 (you|vous) (you|vous)/);
      run('openssl req -new -key intranet.key -subj /CN=intranet.airwaves.internal -addext "subjectAltName=DNS:intranet.airwaves.internal,DNS:board.airwaves.internal" -out intranet.csr');
      expect(run('openssl req -in intranet.csr -noout -text')).toContain('Requested Extensions:\n                    X509v3 Subject Alternative Name: \n                        DNS:intranet.airwaves.internal, DNS:board.airwaves.internal');
      all = run('sudo openssl x509 -req -in intranet.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 365 -copy_extensions copy -out intranet.crt');
      expect(all).toContain('Certificate request self-signature ok\nsubject=CN=intranet.airwaves.internal');
      expect(run('openssl verify -CAfile /srv/ca/ca.crt intranet.crt')).toBe('intranet.crt: OK');
      expect(run('openssl x509 -noout -pubkey -in intranet.crt | sha256sum')).toBe(run('openssl pkey -pubout -in intranet.key | sha256sum'));
      all = run('sudo cp intranet.crt /etc/nginx/ssl/intranet.crt', 'sudo nginx -t');
      expect(all).toContain('key values mismatch');
      contains(all, 'moitié privée');
      expect(finished()).toBe(false);
      all = run('sudo cp intranet.key /etc/nginx/ssl/intranet.key', 'sudo nginx -t', 'sudo systemctl reload nginx');
      contains(all, "CE QUI S'EST PASSÉ");
      expect(finished()).toBe(true);
      expect(run('curl --cacert /srv/ca/ca.crt https://board.airwaves.internal/')).toContain('<h1>');
    });

    it('chapter 1 — false leads: curl -k, a self-signed certificate, Kwame\'s recipe, 30 days, not reloaded; then -extfile with the old key', () => {
      const { run, edit, finished } = play([]);
      let all = run('curl https://intranet.airwaves.internal/');
      expect(all).toContain('curl: (60) SSL certificate problem: unable to get local issuer certificate');
      all = run('curl -k https://intranet.airwaves.internal/');
      expect(all).toContain('<h1>');
      contains(all, 'ne vérifie plus');
      all = run('sudo openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -keyout /etc/nginx/ssl/intranet.key -out /etc/nginx/ssl/intranet.crt -subj /CN=intranet.airwaves.internal -days 365');
      contains(all, "toujours l'ancien");
      all = run('sudo systemctl reload nginx');
      contains(all, 'auto-signé');
      expect(run('curl --cacert /srv/ca/ca.crt https://intranet.airwaves.internal/')).toContain('self-signed certificate');
      // Kwame's recipe: no subjectAltName, 825 days.
      all = run(
        'openssl genpkey -algorithm RSA -out site.key',
        'openssl req -new -key site.key -subj /CN=intranet.airwaves.internal -out site.csr',
        'sudo openssl x509 -req -in site.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 825 -out site.crt',
        'sudo cp site.key /etc/nginx/ssl/intranet.key',
        'sudo cp site.crt /etc/nginx/ssl/intranet.crt',
      );
      all += run('sudo systemctl reload nginx');
      contains(all, 'toujours sans');
      contains(all, '825 jours');
      expect(run('curl --cacert /srv/ca/ca.crt https://board.airwaves.internal/')).toContain("SSL: certificate subject name 'intranet.airwaves.internal' does not match target hostname 'board.airwaves.internal'");
      // Without -days: 30.
      edit('nano san.ext', () => '[ server ]\nbasicConstraints = CA:FALSE\nkeyUsage = critical, digitalSignature\nextendedKeyUsage = serverAuth\nsubjectAltName = @names\n\n[ names ]\nDNS.1 = intranet.airwaves.internal\nDNS.2 = board.airwaves.internal\n');
      all = run('sudo openssl x509 -req -in site.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -extfile san.ext -extensions server -out site.crt', 'sudo cp site.crt /etc/nginx/ssl/intranet.crt', 'sudo systemctl reload nginx');
      contains(all, '30 jours');
      expect(finished()).toBe(false);
      all = run('sudo openssl x509 -req -in site.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 365 -extfile san.ext -extensions server -out site.crt', 'sudo cp site.crt /etc/nginx/ssl/intranet.crt', 'sudo systemctl reload nginx');
      expect(run('openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -ext subjectAltName,extendedKeyUsage')).toBe('X509v3 Extended Key Usage: \n    TLS Web Server Authentication\nX509v3 Subject Alternative Name: \n    DNS:intranet.airwaves.internal, DNS:board.airwaves.internal');
      // Not finished while the CA's key is readable by everyone.
      expect(finished()).toBe(false);
      all = run('sudo chmod 600 /srv/ca/private/ca.key');
      contains(all, 'root');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — solution: the monitoring, the root in both stores, the chain served', () => {
      const { run, finished, mast } = play(['expiry-date']);
      let all = run('cat message_from_adaeze.txt', 'tail -n 4 /var/log/check-sites.log', 'curl https://archive.airwaves.internal/');
      expect(all).toContain('FAIL archive.airwaves.internal');
      contains(all, 'magasin');
      all = run('sudo cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.crt', 'sudo update-ca-certificates');
      expect(all).toContain('Updating certificates in /etc/ssl/certs...\n1 added, 0 removed; done.\nRunning hooks in /etc/ca-certificates/update.d...\ndone.');
      contains(all, 'Airwaves Root CA');
      expect(run('curl -s -o /dev/null -w "%{http_code}" https://intranet.airwaves.internal/')).toBe('200');
      all = run('curl https://archive.airwaves.internal/');
      contains(all, 'intermédiaires');
      all = run('openssl s_client -connect archive.airwaves.internal:443 -showcerts </dev/null');
      expect(all).toContain('verify error:num=21:unable to verify the first certificate');
      expect(all).not.toContain(' 1 s:');
      expect(run('openssl verify -untrusted /srv/ca/issuing/issuing.crt /etc/nginx/ssl/archive.crt')).toBe('/etc/nginx/ssl/archive.crt: OK');
      all = run(
        'sudo sh -c "cat /etc/nginx/ssl/archive.crt /srv/ca/issuing/issuing.crt > /etc/nginx/ssl/archive-chain.crt"',
        'sudo sed -i "s|archive.crt;|archive-chain.crt;|" /etc/nginx/sites-enabled/archive',
        'sudo nginx -t',
        'sudo systemctl reload nginx',
      );
      contains(all, 'Firefox');
      expect(run('openssl s_client -connect archive.airwaves.internal:443 </dev/null')).toContain(' 1 s:O=Airwaves Federation, CN=Airwaves Issuing CA 1');
      run('sudo /usr/local/bin/check-sites');
      expect(run('tail -n 1 /var/log/check-sites.log')).toMatch(/^2030-03-18 \d\d:\d\d:\d\d OK {3}archive\.airwaves\.internal$/);
      expect(finished()).toBe(false);
      all = run('scp /srv/ca/ca.crt booth:', 'yes', 'ssh booth', 'cat note_from_mateo.txt', 'curl https://archive.airwaves.internal/');
      expect(all).toContain('unable to get local issuer certificate');
      all = run('wget https://archive.airwaves.internal/');
      expect(all).toContain("ERROR: cannot verify archive.airwaves.internal's certificate, issued by ‘CN=Airwaves Issuing CA 1,O=Airwaves Federation’:");
      all = run('sudo cp ca.crt /usr/local/share/ca-certificates/airwaves-root.crt', 'sudo update-ca-certificates', 'curl -s https://archive.airwaves.internal/');
      expect(all).toContain('<h1>');
      contains(all, 'Mateo');
      expect(finished()).toBe(true);
      expect(booth(mast())!.find('/etc/ssl/certs/airwaves-root.pem')).toBeTruthy();
    });

    it('chapter 2 — false leads: -k in the monitoring, a .pem, the CA key on booth, the intermediate trusted, the root served', () => {
      const { run, finished } = play(['expiry-date']);
      let all = run('sudo sed -i "s|curl -fsS|curl -kfsS|" /usr/local/bin/check-sites');
      contains(all, 'aveugle');
      all = run('sudo cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.pem', 'sudo update-ca-certificates');
      expect(all).toContain('0 added, 0 removed; done.');
      contains(all, '.crt');
      run('sudo mv /usr/local/share/ca-certificates/airwaves-root.pem /usr/local/share/ca-certificates/airwaves-root.crt', 'sudo update-ca-certificates');
      all = run('sudo cp /srv/ca/issuing/issuing.crt /usr/local/share/ca-certificates/airwaves-issuing.crt', 'sudo update-ca-certificates');
      expect(all).toContain('1 added, 0 removed; done.');
      contains(all, 'côté serveur');
      expect(run('curl -s -o /dev/null -w "%{http_code}" https://archive.airwaves.internal/')).toBe('200');
      run('sudo rm /usr/local/share/ca-certificates/airwaves-issuing.crt');
      expect(run('sudo update-ca-certificates')).toContain('0 added, 1 removed; done.');
      all = run('sudo cp /srv/ca/private/ca.key /tmp/ca.key', 'sudo chmod 644 /tmp/ca.key', 'scp /tmp/ca.key /srv/ca/ca.crt booth:', 'yes');
      contains(all, 'Efface-la');
      run('sudo rm /tmp/ca.key', 'ssh booth', 'sudo cp ca.crt /usr/local/share/ca-certificates/airwaves-root.crt', 'sudo update-ca-certificates', 'exit');
      all = run('sudo sh -c "cat /etc/nginx/ssl/archive.crt /srv/ca/issuing/issuing.crt /srv/ca/ca.crt > /etc/nginx/ssl/archive-full.crt"', 'sudo sed -i "s|archive.crt;|archive-full.crt;|" /etc/nginx/sites-enabled/archive', 'sudo systemctl reload nginx');
      contains(all, 'inutile');
      expect(finished()).toBe(false);
      run('ssh booth', 'rm ca.key', 'exit');
      expect(finished()).toBe(false);
      run('sudo sed -i "s|curl -kfsS|curl -fsS|" /usr/local/bin/check-sites');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — solution: the access log, revoke, the CRL with the root\'s, ssl_crl, then a daily watch', () => {
      const { run, edit, finished, mast } = play(['expiry-date', 'chain-of-trust']);
      let all = run('cat message_from_adaeze.txt', 'sudo tail -n 8 /var/log/nginx/access.log', 'cat /srv/ca/issuing/index.txt');
      expect(all).toMatch(/203\.0\.113\.66 - - \[16\/Apr\/2030:\d\d:\d\d:\d\d \+0200\] "GET \/ HTTP\/1\.1" 200/);
      expect(all).toContain('/O=Airwaves Federation/OU=Reporters/CN=laptop-lindiwe');
      contains(all, 'révoque');
      expect(run('curl https://contrib.airwaves.internal/')).toContain('<center>No required SSL certificate was sent</center>');
      all = run('openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem -crl_reason keyCompromise');
      expect(all).toContain('Permission denied');
      all = run('sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem -crl_reason keyCompromise');
      expect(all).toContain('Using configuration from /srv/ca/issuing/openssl.cnf\nRevoking Certificate 1003.\nDatabase updated');
      contains(all, 'liste de révocation');
      expect(run('sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem')).toContain('ERROR:Already revoked, serial number 1003');
      all = run('sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /srv/ca/issuing/crl/issuing.crl', 'openssl crl -in /srv/ca/issuing/crl/issuing.crl -noout -text');
      expect(all).toContain('Revoked Certificates:\n    Serial Number: 1003');
      expect(all).toContain('X509v3 CRL Reason Code: \n                Key Compromise');
      contains(all, 'ssl_crl');
      expect(run('openssl verify -crl_check -CRLfile /srv/ca/issuing/crl/issuing.crl -CAfile /srv/ca/issuing/chain.pem /srv/ca/issuing/certs/laptop-lindiwe.crt')).toContain('error 23 at 0 depth lookup: certificate revoked');
      all = run(
        'sudo sh -c "cat /srv/ca/issuing/crl/issuing.crl /srv/ca/crl/root.crl > /etc/nginx/ssl/airwaves-crl.pem"',
        'sudo sed -i "s|ssl_verify_depth 2;|ssl_verify_depth 2;\\n    ssl_crl /etc/nginx/ssl/airwaves-crl.pem;|" /etc/nginx/sites-enabled/contrib',
        'sudo nginx -t',
        'sudo systemctl reload nginx',
      );
      contains(all, 'Amina');
      run('ls', 'ls', 'ls');
      all = run('sudo tail -n 1 /var/log/nginx/error.log');
      expect(all).toContain('client SSL certificate verify error: (23:certificate revoked) while reading client request headers, client: 203.0.113.66');
      expect(finished()).toBe(false);
      // The watch: a script, from root's crontab.
      edit('sudo nano /usr/local/bin/cert-expiry', () =>
        '#!/bin/bash\n# Certificates expiring within 30 days\nfor c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do\n  if ! openssl x509 -in "$c" -noout -checkend $((30*86400)) > /dev/null; then\n    echo "expires within 30 days: $c ($(openssl x509 -in "$c" -noout -enddate))"\n  fi\ndone\n',
      );
      all = run('sudo chmod +x /usr/local/bin/cert-expiry', 'sudo /usr/local/bin/cert-expiry');
      expect(all).toContain('expires within 30 days: /srv/ca/issued/stream.crt (notAfter=May  6 08:00:00 2030 GMT)');
      expect(finished()).toBe(false);
      all = edit('sudo crontab -e', (x) => `${x}\n17 7 * * * /usr/local/bin/cert-expiry\n`);
      contains(all, '6 mai');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — false leads: the file deleted, a new CA, a stale CRL, the issuing CRL alone, a quiet and a noisy watch; then a timer', () => {
      const { run, edit, finished } = play(['expiry-date', 'chain-of-trust']);
      let all = run('sudo rm /srv/ca/issuing/newcerts/1003.pem');
      contains(all, 'ne révoque');
      all = run('openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-384 -noenc -keyout newca.key -out newca.crt -subj "/O=Airwaves Federation/CN=Airwaves Root CA 2" -days 3650');
      contains(all, 'nouvelle autorité');
      expect(run('openssl x509 -in newca.crt -noout -ext basicConstraints')).toBe('X509v3 Basic Constraints: critical\n    CA:TRUE');
      // A CRL written before the revocation, loaded by nginx: a stale snapshot.
      all = run(
        'sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /etc/nginx/ssl/airwaves-crl.pem',
        'sudo sed -i "s|ssl_verify_depth 2;|ssl_verify_depth 2;\\n    ssl_crl /etc/nginx/ssl/airwaves-crl.pem;|" /etc/nginx/sites-enabled/contrib',
        'sudo systemctl reload nginx',
      );
      contains(all, 'photo');
      contains(all, 'Amina comprise');
      all = run('sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/certs/laptop-lindiwe.crt -crl_reason keyCompromise', 'sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /srv/ca/issuing/crl/issuing.crl');
      expect(all).toContain('Revoking Certificate 1003.');
      run('sudo sh -c "cat /srv/ca/issuing/crl/issuing.crl /srv/ca/crl/root.crl > /etc/nginx/ssl/airwaves-crl.pem"', 'sudo systemctl reload nginx');
      // A watch that only looks at newcerts: quiet about the stream's certificate.
      edit('sudo nano /usr/local/bin/cert-expiry', () => '#!/bin/sh\nfor c in /srv/ca/issuing/newcerts/*.pem; do\n  openssl x509 -in "$c" -noout -checkend 2592000 > /dev/null || echo "renew $c"\ndone\n');
      all = run('sudo chmod +x /usr/local/bin/cert-expiry') + edit('sudo crontab -e', (x) => `${x}\n17 7 * * * /usr/local/bin/cert-expiry\n`);
      contains(all, '20 jours');
      // One that lists everything the same way.
      all = edit('sudo nano /usr/local/bin/cert-expiry', () => '#!/bin/sh\nfor c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do\n  echo "$c $(openssl x509 -in "$c" -noout -enddate)"\ndone\n') + run('ls');
      contains(all, 'noyé');
      expect(finished()).toBe(false);
      // A systemd timer instead of cron, and a script that only speaks for what expires.
      edit('sudo nano /usr/local/bin/cert-expiry', () => '#!/bin/bash\nfor c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do\n  openssl x509 -in "$c" -noout -checkend 2592000 > /dev/null || logger -t cert-expiry "expires soon: $c"\ndone\n');
      run('sudo crontab -r');
      edit('sudo nano /etc/systemd/system/cert-expiry.service', () => '[Unit]\nDescription=Certificates expiring within 30 days\n\n[Service]\nType=oneshot\nExecStart=/usr/local/bin/cert-expiry\n');
      edit('sudo nano /etc/systemd/system/cert-expiry.timer', () => '[Unit]\nDescription=Daily certificate expiry check\n\n[Timer]\nOnCalendar=daily\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n');
      all = run('sudo systemctl daemon-reload', 'sudo systemctl enable --now cert-expiry.timer');
      expect(all).toContain('Created symlink /etc/systemd/system/timers.target.wants/cert-expiry.timer → /etc/systemd/system/cert-expiry.timer.');
      expect(finished()).toBe(true);
      expect(run('sudo journalctl | grep cert-expiry')).toContain('expires soon: /srv/ca/issued/stream.crt');
    });
  });

