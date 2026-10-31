// « Le courrier indésirable » : SPF, DKIM et DMARC. Chaque chapitre rejoué
// dans chaque langue : la solution, une autre, et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { HISTOIRES } from '../src/engine/chapters';
import { prerequis } from '../src/engine/unlocking';
import { LANGUES, traducteur } from '../src/texts';
import { dansLaLangue } from './names';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const AVANT = [...new Set([...EFFACEUR, ...prerequis('courrier')])];
const ZONE = '/etc/bind/zones/db.gardens.example';

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === 'fr';
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const partie = (termines: string[], chapitre: string) => {
      const c = new Console({ langue, termines: [...AVANT, ...termines] });
      const jouer = (lignes: string[]) =>
        lignes
          .map((l) => {
            let s = c.executer(L(l)) ?? '';
            if (c.shell.attente) s += c.executer(L('semis-2027')) ?? '';
            return s;
          })
          .join('\n');
      const ecrire = (fichier: string, changer: (texte: string) => string) => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer(L('semis-2027'));
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh jardin', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe(chapitre);
      const boite = () => c.distant!.shell.lire(`/var/mail/${c.distant!.shell.joueur}`) ?? '';
      const lire = (chemin: string) => c.distant!.shell.lire(chemin) ?? '';
      return { c, jouer, ecrire, boite, lire };
    };
    const serie = (de: string, a: string) => (t: string) => t.replace(de, a);

    describe('Le facteur', () => {
      it('solution : la file, le SPF de l’ancien hébergeur, le serial, postqueue -f', () => {
        const { c, jouer, ecrire } = partie([], 'facteur');
        let tout = jouer(['mailq', 'grep deferred /var/log/mail.log', 'dig TXT gardens.example +short']);
        expect(tout).toContain('-- 7 Kbytes in 5 Requests.');
        expect(tout).toContain('451 4.7.26 Unauthenticated mail from gardens.example: neither SPF nor DKIM passed for 203.0.113.30 (SPF: fail)');
        expect(tout).toContain('"v=spf1 include:_spf.old-hosting.example -all"');
        if (fr) expect(tout).toContain('serveurs de l\'ancien hébergeur');
        // D'abord sans le serial : le secondaire du registre garde l'ancien SPF.
        ecrire(ZONE, (t) => t.replace('include:_spf.old-hosting.example', 'mx'));
        tout = jouer(['sudo rndc reload', 'dig TXT gardens.example @ns2.registry.example +short', 'sudo postqueue -f', 'mailq']);
        expect(tout).toContain('"v=spf1 include:_spf.old-hosting.example -all"');
        expect(tout).toContain('in 5 Requests');
        if (fr) expect(tout).toContain('numéro de série');
        ecrire(ZONE, serie('2027042801', '2027050301'));
        tout = jouer(['sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example', 'sudo rndc reload', 'dig TXT gardens.example @ns2.registry.example +short']);
        expect(tout).toContain('loaded serial 2027050301');
        expect(tout).toContain('"v=spf1 mx -all"');
        expect(c.termines).not.toContain('facteur');
        tout = jouer(['sudo postqueue -f', 'mailq', 'sudo tail -2 /var/log/mail.log']);
        expect(tout).toContain('Mail queue is empty');
        expect(tout).toContain('status=sent (250 2.0.0 OK');
        if (fr) expect(tout).toContain('https://www.rfc-editor.org/rfc/rfc7208');
        expect(c.termines).toContain('facteur');
      });

      it('autre solution : ip4 et ~all ; fausse piste : deux enregistrements SPF', () => {
        const { c, jouer, ecrire } = partie([], 'facteur');
        ecrire(ZONE, (t) => serie('2027042801', '2027050301')(t) + '@       IN  TXT    "v=spf1 ip4:203.0.113.30 ~all"\n');
        let tout = jouer(['sudo rndc reload', 'dig TXT gardens.example @ns2.registry.example +short', 'sudo postqueue -f', 'mailq']);
        expect(tout).toContain('"v=spf1 ip4:203.0.113.30 ~all"');
        expect(tout).toContain('in 5 Requests');
        if (fr) expect(tout).toContain('deux enregistrements');
        ecrire(ZONE, (t) => serie('2027050301', '2027050302')(t).replace(/.*include:_spf\.old-hosting\.example.*\n/, ''));
        tout = jouer(['sudo rndc reload', 'sudo postqueue -f', 'mailq']);
        expect(tout).toContain('Mail queue is empty');
        expect(c.termines).toContain('facteur');
      });

      it('les commandes : postconf, postfix check, postsuper, le manuel', () => {
        const { jouer, ecrire } = partie([], 'facteur');
        let tout = jouer(['postconf myorigin mydestination', 'postconf -x mydestination', 'postconf mydestinaton', 'man postqueue', 'mailq --help']);
        expect(tout).toContain('myorigin = /etc/mailname');
        expect(tout).toContain('mydestination = mail.gardens.example, gardens.example, localhost.localdomain, localhost');
        expect(tout).toContain('postconf: warning: mydestinaton: unknown parameter');
        expect(tout).toContain('postqueue');
        ecrire('/etc/postfix/main.cf', (t) => t + '\nsmtpd_milter = inet:localhost:8891\n');
        tout = jouer(['sudo postfix check', 'postsuper -d ALL', 'sudo postsuper -d 3F2A9C1B7D', 'mailq']);
        expect(tout).toContain('postconf: warning: /etc/postfix/main.cf: unused parameter: smtpd_milter=inet:localhost:8891');
        expect(tout).toContain('postsuper: fatal: use of this command is reserved for the superuser');
        expect(tout).toContain('postsuper: 3F2A9C1B7D: removed');
        expect(tout).toContain('in 4 Requests');
      });
    });

    describe('La signature', () => {
      const CONF = '/etc/opendkim.conf';
      const configurer = (prise = 'Socket\t\t\tlocal:/run/opendkim/opendkim.sock') => (t: string) =>
        t
          .replace('#Domain\t\t\texample.com', 'Domain\t\t\tgardens.example')
          .replace('#Selector\t\t2020', 'Selector\t\tmail')
          .replace('#KeyFile\t\t/etc/dkimkeys/example.private', 'KeyFile\t\t/etc/dkimkeys/mail.private')
          .replace('Socket\t\t\tlocal:/run/opendkim/opendkim.sock', prise);

      it('solution : la clé, opendkim, le milter, la clé publiée', () => {
        const { c, jouer, ecrire, boite, lire } = partie(['facteur'], 'signature');
        jouer(['echo test | mail -s test check-auth@verifier.example']);
        expect(boite()).toMatch(/DKIM check: +none/);
        let tout = jouer(['mail']);
        expect(tout).toContain('check-auth@verifier.example');
        tout = jouer(['sudo opendkim-genkey -v -d gardens.example -s mail -D /etc/dkimkeys', 'sudo ls -l /etc/dkimkeys']);
        expect(tout).toContain('opendkim-genkey: DNS TXT record written to mail.txt');
        expect(tout).toMatch(/-rw------- root +root +\d+ mail\.private/);
        ecrire(CONF, configurer('Socket\t\t\tinet:8891@localhost'));
        // La clé appartient à root : opendkim ne peut pas la lire.
        tout = jouer(['sudo systemctl restart opendkim', 'journalctl -u opendkim -n 4']);
        expect(tout).toContain('/etc/dkimkeys/mail.private: open(): Permission denied');
        if (fr) expect(tout).toContain('chown opendkim:opendkim');
        tout = jouer(['sudo chown opendkim:opendkim /etc/dkimkeys/mail.private', 'sudo systemctl restart opendkim', 'systemctl is-active opendkim']);
        expect(tout).toContain('active');
        tout = jouer([
          'sudo postconf -e "smtpd_milters = inet:localhost:8891" "non_smtpd_milters = $smtpd_milters" "milter_default_action = accept"',
          'sudo systemctl reload postfix',
          'echo test | mail -s test2 check-auth@verifier.example',
          'sudo grep DKIM-Signature /var/log/mail.log',
        ]);
        expect(tout).toContain('DKIM-Signature field added (s=mail, d=gardens.example)');
        expect(boite()).toContain('dkim=permerror (no key for signature)');
        const enregistrement = lire('/etc/dkimkeys/mail.txt');
        expect(enregistrement).toContain('mail._domainkey\tIN\tTXT\t( "v=DKIM1; h=sha256; k=rsa; "');
        ecrire(ZONE, (t) => serie('2027050301', '2027051001')(t) + enregistrement + '\n');
        tout = jouer(['sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example', 'sudo rndc reload', 'sudo opendkim-testkey -d gardens.example -s mail -vvv']);
        expect(tout).toContain('opendkim-testkey: key not secure\nopendkim-testkey: key OK');
        expect(c.termines).toContain('signature');
        jouer(['echo test | mail -s test3 check-auth@verifier.example']);
        expect(boite()).toContain('dkim=pass header.d=gardens.example header.s=mail');
      });

      it('fausses pistes : clé lisible par tous, prise unix hors du chroot, smtpd_milters seul, serial oublié', () => {
        const { c, jouer, ecrire, lire } = partie(['facteur'], 'signature');
        jouer(['sudo -u opendkim opendkim-genkey -d gardens.example -s mail -D /etc/dkimkeys', 'sudo chmod 644 /etc/dkimkeys/mail.private']);
        ecrire(CONF, configurer());
        let tout = jouer(['sudo systemctl restart opendkim', 'journalctl -u opendkim -n 4']);
        expect(tout).toContain('key data is not secure: /etc/dkimkeys/mail.private can be read or written by other users');
        tout = jouer(['sudo chmod 600 /etc/dkimkeys/mail.private', 'sudo systemctl restart opendkim']);
        // La prise locale de Debian, vue depuis le chroot de Postfix.
        ecrire('/etc/postfix/main.cf', (t) => t + '\nsmtpd_milters = unix:/run/opendkim/opendkim.sock\nnon_smtpd_milters = $smtpd_milters\n');
        tout = jouer(['sudo systemctl reload postfix', 'echo test | mail -s test check-auth@verifier.example', 'mailq', 'sudo grep Milter /var/log/mail.log']);
        expect(tout).toContain('warning: connect to Milter service unix:/run/opendkim/opendkim.sock: No such file or directory');
        // milter_default_action vaut tempfail : le message attend.
        expect(tout).toContain('(4.7.1 Service unavailable - try again later)');
        if (fr) expect(tout).toContain('chroot');
        ecrire(CONF, (t) => t.replace('Socket\t\t\tlocal:/run/opendkim/opendkim.sock', 'Socket\t\t\tlocal:/var/spool/postfix/opendkim/opendkim.sock'));
        ecrire('/etc/postfix/main.cf', (t) => t.replace('unix:/run/opendkim/opendkim.sock', 'unix:/opendkim/opendkim.sock').replace('non_smtpd_milters = $smtpd_milters\n', ''));
        tout = jouer(['sudo systemctl restart opendkim', 'sudo systemctl reload postfix', 'sudo postqueue -f']);
        if (fr) expect(tout).toContain('non_smtpd_milters');
        ecrire('/etc/postfix/main.cf', (t) => t + 'non_smtpd_milters = $smtpd_milters\n');
        jouer(['sudo systemctl reload postfix', 'echo test | mail -s test2 check-auth@verifier.example']);
        expect(lire('/var/log/mail.log')).toContain('DKIM-Signature field added (s=mail, d=gardens.example)');
        // La clé publiée sans changer le serial : le secondaire ne l'a pas.
        ecrire(ZONE, (t) => t + lire('/etc/dkimkeys/mail.txt') + '\n');
        tout = jouer(['sudo rndc reload', 'dig TXT mail._domainkey.gardens.example @ns2.registry.example +short']);
        if (fr) expect(tout).toContain('serial');
        expect(c.termines).not.toContain('signature');
        ecrire(ZONE, serie('2027050301', '2027051002'));
        jouer(['sudo rndc reload']);
        expect(c.termines).toContain('signature');
      });
    });

    describe('La politique', () => {
      const CNAME = 'nm1._domainkey IN CNAME nm1.dkim.newsmail.example.';
      it('solution : lire les rapports, déléguer nm1, passer à quarantine', () => {
        const { c, jouer, ecrire } = partie(['facteur', 'signature'], 'politique');
        let tout = jouer(['ls rapports_dmarc', 'grep source_ip rapports_dmarc/mailbox.example-2027-05-16.xml', 'dig TXT _dmarc.gardens.example +short']);
        expect(tout).toContain('<source_ip>198.51.100.77</source_ip>');
        expect(tout).toContain('"v=DMARC1; p=none; rua=mailto:dmarc@gardens.example"');
        if (fr) expect(tout).toContain('alignement');
        if (fr) expect(tout).toContain('se fait passer pour');
        ecrire(ZONE, (t) => serie('2027051701', '2027052401')(t) + CNAME + '\n');
        tout = jouer(['sudo rndc reload', 'dig TXT nm1._domainkey.gardens.example @ns2.registry.example']);
        expect(tout).toContain('nm1._domainkey.gardens.example. 3600    IN\tCNAME\tnm1.dkim.newsmail.example.');
        if (fr) expect(tout).toContain('d=gardens.example');
        expect(c.termines).not.toContain('politique');
        ecrire(ZONE, (t) => serie('2027052401', '2027052402')(t).replace('p=none', 'p=quarantine'));
        tout = jouer(['sudo rndc reload', 'dig TXT _dmarc.gardens.example @ns2.registry.example +short']);
        expect(tout).toContain('"v=DMARC1; p=quarantine; rua=mailto:dmarc@gardens.example"');
        if (fr) expect(tout).toContain('https://www.rfc-editor.org/rfc/rfc7489');
        expect(c.termines).toContain('politique');
      });

      it('fausses pistes : quarantine trop tôt, include du prestataire, CNAME sans point, deux DMARC ; reject accepté', () => {
        const { c, jouer, ecrire } = partie(['facteur', 'signature'], 'politique');
        ecrire(ZONE, (t) => serie('2027051701', '2027052401')(t).replace('p=none', 'p=quarantine').replace('"v=spf1 mx -all"', '"v=spf1 mx include:_spf.newsmail.example -all"'));
        let tout = jouer(['sudo rndc reload']);
        if (fr) expect(tout).toContain('Aligne d\'abord');
        if (fr) expect(tout).toContain('bounce.newsmail.example');
        // Le CNAME sans point final : le jeu le remarque dès l'enregistrement du fichier.
        tout = ecrire(ZONE, (t) => serie('2027052401', '2027052402')(t) + 'nm1._domainkey IN CNAME nm1.dkim.newsmail.example\n');
        tout += jouer(['sudo rndc reload', 'dig TXT nm1._domainkey.gardens.example']);
        expect(tout).toContain('CNAME\tnm1.dkim.newsmail.example.gardens.example.');
        if (fr) expect(tout).toContain('point final');
        expect(c.termines).not.toContain('politique');
        ecrire(ZONE, (t) => serie('2027052402', '2027052403')(t).replace('newsmail.example\n', 'newsmail.example.\n') + '_dmarc IN TXT "v=DMARC1; p=reject"\n');
        tout = jouer(['sudo rndc reload']);
        if (fr) expect(tout).toContain('deux enregistrements DMARC');
        expect(c.termines).not.toContain('politique');
        ecrire(ZONE, (t) => serie('2027052403', '2027052404')(t).replace('_dmarc IN TXT "v=DMARC1; p=reject"\n', '').replace('p=quarantine', 'p=reject'));
        jouer(['sudo rndc reload']);
        expect(c.termines).toContain('politique');
      });
    });
  });
