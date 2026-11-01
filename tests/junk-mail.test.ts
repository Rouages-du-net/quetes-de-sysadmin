// « Le courrier indésirable » : SPF, DKIM et DMARC. Chaque chapitre rejoué
// dans chaque langue : la solution, une autre, et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';

const ERASER = STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id);
const BEFORE = [...new Set([...ERASER, ...prerequisites('junk-mail')])];
const ZONE = '/etc/bind/zones/db.gardens.example';

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const part = (finished: string[], chapter: string) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const play = (lines: string[]) =>
        lines
          .map((l) => {
            let s = c.execute(L(l)) ?? '';
            if (c.shell.waiting) s += c.execute(L('semis-2027')) ?? '';
            return s;
          })
          .join('\n');
      const write = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(L('semis-2027'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh garden', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe(chapter);
      const box = () => c.remote!.shell.read(`/var/mail/${c.remote!.shell.player}`) ?? '';
      const read = (path: string) => c.remote!.shell.read(path) ?? '';
      return { c, jouer: play, ecrire: write, boite: box, read };
    };
    const serial = (forEachOf: string, a: string) => (t: string) => t.replace(forEachOf, a);

    describe('Le facteur', () => {
      it('solution : la file, le SPF de l’ancien hébergeur, le serial, postqueue -f', () => {
        const { c, jouer: play, ecrire: write } = part([], 'postman');
        let all = play(['mailq', 'grep deferred /var/log/mail.log', 'dig TXT gardens.example +short']);
        expect(all).toContain('-- 7 Kbytes in 5 Requests.');
        expect(all).toContain('451 4.7.26 Unauthenticated mail from gardens.example: neither SPF nor DKIM passed for 203.0.113.30 (SPF: fail)');
        expect(all).toContain('"v=spf1 include:_spf.old-hosting.example -all"');
        if (fr) expect(all).toContain('serveurs de l\'ancien hébergeur');
        // D'abord sans le serial : le secondaire du registre garde l'ancien SPF.
        write(ZONE, (t) => t.replace('include:_spf.old-hosting.example', 'mx'));
        all = play(['sudo rndc reload', 'dig TXT gardens.example @ns2.registry.example +short', 'sudo postqueue -f', 'mailq']);
        expect(all).toContain('"v=spf1 include:_spf.old-hosting.example -all"');
        expect(all).toContain('in 5 Requests');
        if (fr) expect(all).toContain('numéro de série');
        write(ZONE, serial('2027042801', '2027050301'));
        all = play(['sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example', 'sudo rndc reload', 'dig TXT gardens.example @ns2.registry.example +short']);
        expect(all).toContain('loaded serial 2027050301');
        expect(all).toContain('"v=spf1 mx -all"');
        expect(c.finished).not.toContain('postman');
        all = play(['sudo postqueue -f', 'mailq', 'sudo tail -2 /var/log/mail.log']);
        expect(all).toContain('Mail queue is empty');
        expect(all).toContain('status=sent (250 2.0.0 OK');
        if (fr) expect(all).toContain('https://www.rfc-editor.org/rfc/rfc7208');
        expect(c.finished).toContain('postman');
      });

      it('autre solution : ip4 et ~all ; fausse piste : deux enregistrements SPF', () => {
        const { c, jouer: play, ecrire: write } = part([], 'postman');
        write(ZONE, (t) => serial('2027042801', '2027050301')(t) + '@       IN  TXT    "v=spf1 ip4:203.0.113.30 ~all"\n');
        let all = play(['sudo rndc reload', 'dig TXT gardens.example @ns2.registry.example +short', 'sudo postqueue -f', 'mailq']);
        expect(all).toContain('"v=spf1 ip4:203.0.113.30 ~all"');
        expect(all).toContain('in 5 Requests');
        if (fr) expect(all).toContain('deux enregistrements');
        write(ZONE, (t) => serial('2027050301', '2027050302')(t).replace(/.*include:_spf\.old-hosting\.example.*\n/, ''));
        all = play(['sudo rndc reload', 'sudo postqueue -f', 'mailq']);
        expect(all).toContain('Mail queue is empty');
        expect(c.finished).toContain('postman');
      });

      it('les commandes : postconf, postfix check, postsuper, le manuel', () => {
        const { jouer: play, ecrire: write } = part([], 'postman');
        let all = play(['postconf myorigin mydestination', 'postconf -x mydestination', 'postconf mydestinaton', 'man postqueue', 'mailq --help']);
        expect(all).toContain('myorigin = /etc/mailname');
        expect(all).toContain('mydestination = mail.gardens.example, gardens.example, localhost.localdomain, localhost');
        expect(all).toContain('postconf: warning: mydestinaton: unknown parameter');
        expect(all).toContain('postqueue');
        write('/etc/postfix/main.cf', (t) => t + '\nsmtpd_milter = inet:localhost:8891\n');
        all = play(['sudo postfix check', 'postsuper -d ALL', 'sudo postsuper -d 3F2A9C1B7D', 'mailq']);
        expect(all).toContain('postconf: warning: /etc/postfix/main.cf: unused parameter: smtpd_milter=inet:localhost:8891');
        expect(all).toContain('postsuper: fatal: use of this command is reserved for the superuser');
        expect(all).toContain('postsuper: 3F2A9C1B7D: removed');
        expect(all).toContain('in 4 Requests');
      });
    });

    describe('La signature', () => {
      const CONF = '/etc/opendkim.conf';
      const configure = (socket = 'Socket\t\t\tlocal:/run/opendkim/opendkim.sock') => (t: string) =>
        t
          .replace('#Domain\t\t\texample.com', 'Domain\t\t\tgardens.example')
          .replace('#Selector\t\t2020', 'Selector\t\tmail')
          .replace('#KeyFile\t\t/etc/dkimkeys/example.private', 'KeyFile\t\t/etc/dkimkeys/mail.private')
          .replace('Socket\t\t\tlocal:/run/opendkim/opendkim.sock', socket);

      it('solution : la clé, opendkim, le milter, la clé publiée', () => {
        const { c, jouer: play, ecrire: write, boite: box, read } = part(['postman'], 'signature');
        play(['echo test | mail -s test check-auth@verifier.example']);
        expect(box()).toMatch(/DKIM check: +none/);
        let all = play(['mail']);
        expect(all).toContain('check-auth@verifier.example');
        all = play(['sudo opendkim-genkey -v -d gardens.example -s mail -D /etc/dkimkeys', 'sudo ls -l /etc/dkimkeys']);
        expect(all).toContain('opendkim-genkey: DNS TXT record written to mail.txt');
        expect(all).toMatch(/-rw------- root +root +\d+ mail\.private/);
        write(CONF, configure('Socket\t\t\tinet:8891@localhost'));
        // La clé appartient à root : opendkim ne peut pas la lire.
        all = play(['sudo systemctl restart opendkim', 'journalctl -u opendkim -n 4']);
        expect(all).toContain('/etc/dkimkeys/mail.private: open(): Permission denied');
        if (fr) expect(all).toContain('chown opendkim:opendkim');
        all = play(['sudo chown opendkim:opendkim /etc/dkimkeys/mail.private', 'sudo systemctl restart opendkim', 'systemctl is-active opendkim']);
        expect(all).toContain('active');
        all = play([
          'sudo postconf -e "smtpd_milters = inet:localhost:8891" "non_smtpd_milters = $smtpd_milters" "milter_default_action = accept"',
          'sudo systemctl reload postfix',
          'echo test | mail -s test2 check-auth@verifier.example',
          'sudo grep DKIM-Signature /var/log/mail.log',
        ]);
        expect(all).toContain('DKIM-Signature field added (s=mail, d=gardens.example)');
        expect(box()).toContain('dkim=permerror (no key for signature)');
        const record = read('/etc/dkimkeys/mail.txt');
        expect(record).toContain('mail._domainkey\tIN\tTXT\t( "v=DKIM1; h=sha256; k=rsa; "');
        write(ZONE, (t) => serial('2027050301', '2027051001')(t) + record + '\n');
        all = play(['sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example', 'sudo rndc reload', 'sudo opendkim-testkey -d gardens.example -s mail -vvv']);
        expect(all).toContain('opendkim-testkey: key not secure\nopendkim-testkey: key OK');
        expect(c.finished).toContain('signature');
        play(['echo test | mail -s test3 check-auth@verifier.example']);
        expect(box()).toContain('dkim=pass header.d=gardens.example header.s=mail');
      });

      it('fausses pistes : clé lisible par tous, prise unix hors du chroot, smtpd_milters seul, serial oublié', () => {
        const { c, jouer: play, ecrire: write, read } = part(['postman'], 'signature');
        play(['sudo -u opendkim opendkim-genkey -d gardens.example -s mail -D /etc/dkimkeys', 'sudo chmod 644 /etc/dkimkeys/mail.private']);
        write(CONF, configure());
        let all = play(['sudo systemctl restart opendkim', 'journalctl -u opendkim -n 4']);
        expect(all).toContain('key data is not secure: /etc/dkimkeys/mail.private can be read or written by other users');
        all = play(['sudo chmod 600 /etc/dkimkeys/mail.private', 'sudo systemctl restart opendkim']);
        // La prise locale de Debian, vue depuis le chroot de Postfix.
        write('/etc/postfix/main.cf', (t) => t + '\nsmtpd_milters = unix:/run/opendkim/opendkim.sock\nnon_smtpd_milters = $smtpd_milters\n');
        all = play(['sudo systemctl reload postfix', 'echo test | mail -s test check-auth@verifier.example', 'mailq', 'sudo grep Milter /var/log/mail.log']);
        expect(all).toContain('warning: connect to Milter service unix:/run/opendkim/opendkim.sock: No such file or directory');
        // milter_default_action vaut tempfail : le message attend.
        expect(all).toContain('(4.7.1 Service unavailable - try again later)');
        if (fr) expect(all).toContain('chroot');
        write(CONF, (t) => t.replace('Socket\t\t\tlocal:/run/opendkim/opendkim.sock', 'Socket\t\t\tlocal:/var/spool/postfix/opendkim/opendkim.sock'));
        write('/etc/postfix/main.cf', (t) => t.replace('unix:/run/opendkim/opendkim.sock', 'unix:/opendkim/opendkim.sock').replace('non_smtpd_milters = $smtpd_milters\n', ''));
        all = play(['sudo systemctl restart opendkim', 'sudo systemctl reload postfix', 'sudo postqueue -f']);
        if (fr) expect(all).toContain('non_smtpd_milters');
        write('/etc/postfix/main.cf', (t) => t + 'non_smtpd_milters = $smtpd_milters\n');
        play(['sudo systemctl reload postfix', 'echo test | mail -s test2 check-auth@verifier.example']);
        expect(read('/var/log/mail.log')).toContain('DKIM-Signature field added (s=mail, d=gardens.example)');
        // La clé publiée sans changer le serial : le secondaire ne l'a pas.
        write(ZONE, (t) => t + read('/etc/dkimkeys/mail.txt') + '\n');
        all = play(['sudo rndc reload', 'dig TXT mail._domainkey.gardens.example @ns2.registry.example +short']);
        if (fr) expect(all).toContain('serial');
        expect(c.finished).not.toContain('signature');
        write(ZONE, serial('2027050301', '2027051002'));
        play(['sudo rndc reload']);
        expect(c.finished).toContain('signature');
      });
    });

    describe('La politique', () => {
      const CNAME = 'nm1._domainkey IN CNAME nm1.dkim.newsmail.example.';
      it('solution : lire les rapports, déléguer nm1, passer à quarantine', () => {
        const { c, jouer: play, ecrire: write } = part(['postman', 'signature'], 'policy');
        let all = play(['ls rapports_dmarc', 'grep source_ip rapports_dmarc/mailbox.example-2027-05-16.xml', 'dig TXT _dmarc.gardens.example +short']);
        expect(all).toContain('<source_ip>198.51.100.77</source_ip>');
        expect(all).toContain('"v=DMARC1; p=none; rua=mailto:dmarc@gardens.example"');
        if (fr) expect(all).toContain('alignement');
        if (fr) expect(all).toContain('se fait passer pour');
        write(ZONE, (t) => serial('2027051701', '2027052401')(t) + CNAME + '\n');
        all = play(['sudo rndc reload', 'dig TXT nm1._domainkey.gardens.example @ns2.registry.example']);
        expect(all).toContain('nm1._domainkey.gardens.example. 3600    IN\tCNAME\tnm1.dkim.newsmail.example.');
        if (fr) expect(all).toContain('d=gardens.example');
        expect(c.finished).not.toContain('policy');
        write(ZONE, (t) => serial('2027052401', '2027052402')(t).replace('p=none', 'p=quarantine'));
        all = play(['sudo rndc reload', 'dig TXT _dmarc.gardens.example @ns2.registry.example +short']);
        expect(all).toContain('"v=DMARC1; p=quarantine; rua=mailto:dmarc@gardens.example"');
        if (fr) expect(all).toContain('https://www.rfc-editor.org/rfc/rfc7489');
        expect(c.finished).toContain('policy');
      });

      it('fausses pistes : quarantine trop tôt, include du prestataire, CNAME sans point, deux DMARC ; reject accepté', () => {
        const { c, jouer: play, ecrire: write } = part(['postman', 'signature'], 'policy');
        write(ZONE, (t) => serial('2027051701', '2027052401')(t).replace('p=none', 'p=quarantine').replace('"v=spf1 mx -all"', '"v=spf1 mx include:_spf.newsmail.example -all"'));
        let all = play(['sudo rndc reload']);
        if (fr) expect(all).toContain('Aligne d\'abord');
        if (fr) expect(all).toContain('bounce.newsmail.example');
        // Le CNAME sans point final : le jeu le remarque dès l'enregistrement du fichier.
        all = write(ZONE, (t) => serial('2027052401', '2027052402')(t) + 'nm1._domainkey IN CNAME nm1.dkim.newsmail.example\n');
        all += play(['sudo rndc reload', 'dig TXT nm1._domainkey.gardens.example']);
        expect(all).toContain('CNAME\tnm1.dkim.newsmail.example.gardens.example.');
        if (fr) expect(all).toContain('point final');
        expect(c.finished).not.toContain('policy');
        write(ZONE, (t) => serial('2027052402', '2027052403')(t).replace('newsmail.example\n', 'newsmail.example.\n') + '_dmarc IN TXT "v=DMARC1; p=reject"\n');
        all = play(['sudo rndc reload']);
        if (fr) expect(all).toContain('deux enregistrements DMARC');
        expect(c.finished).not.toContain('policy');
        write(ZONE, (t) => serial('2027052403', '2027052404')(t).replace('_dmarc IN TXT "v=DMARC1; p=reject"\n', '').replace('p=quarantine', 'p=reject'));
        play(['sudo rndc reload']);
        expect(c.finished).toContain('policy');
      });
    });
  });
