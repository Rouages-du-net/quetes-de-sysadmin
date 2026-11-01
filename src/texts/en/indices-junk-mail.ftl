### Graded hints for the "Junk Mail" story: a lead, then almost the answer,
### for each step (see indices.ts).

## Chapter 1 — The Postman

hint-postman-differs =
    .piste = Mail that didn't leave waits in Postfix's queue: mailq shows it, with the other server's answer. /var/log/mail.log tells each attempt.
    .solution = mailq (or postqueue -p), then grep deferred /var/log/mail.log: mailbox.example answers 451, "neither SPF nor DKIM passed".
hint-postman-old =
    .piste = SPF is a TXT record of the domain, starting with v=spf1 (man dig). Whom does it authorize to send?
    .solution = dig TXT gardens.example: "v=spf1 include:_spf.old-hosting.example -all", the old host's SPF.
hint-postman-spf =
    .piste = The SPF is in gardens.example's zone, on this server (/etc/bind/zones). It must authorize this machine (mx, a or ip4:203.0.113.30). For the registry's secondary to copy it, the serial must go up.
    .solution = sudo nano /etc/bind/zones/db.gardens.example: replace the include with mx ("v=spf1 mx -all") and raise the serial; sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example, sudo rndc reload, then dig TXT gardens.example @ns2.registry.example
hint-postman-end =
    .piste = The SPF is right, but Postfix only retries after a few minutes. man postqueue.
    .solution = sudo postqueue -f, then mailq: "Mail queue is empty".

## Chapter 2 — The Signature

hint-signature-check =
    .piste = Send an email to the checker (see Nour's message), then read its answer with mail.
    .solution = echo test | mail -s test check-auth@verifier.example, then mail (or cat /var/mail/your_account): "DKIM check: none".
hint-signature-key =
    .piste = First you need a key pair, in /etc/dkimkeys: man opendkim-genkey (the domain, the selector, the directory).
    .solution = sudo -u opendkim opendkim-genkey -d gardens.example -s mail -D /etc/dkimkeys (or with plain sudo, then sudo chown opendkim:opendkim /etc/dkimkeys/mail.private)
hint-signature-opendkim =
    .piste = /etc/opendkim.conf has commented lines for the domain, the selector and the key. opendkim must be able to read the key; journalctl -u opendkim says why it won't start.
    .solution = In /etc/opendkim.conf: Domain gardens.example, Selector mail, KeyFile /etc/dkimkeys/mail.private, and Socket inet:8891@localhost; sudo systemctl restart opendkim
hint-signature-milter =
    .piste = Postfix must hand the mail to opendkim: the smtpd_milters and non_smtpd_milters parameters (man postconf). Mail submitted on the machine goes through non_smtpd_milters, and Postfix runs in a chroot.
    .solution = sudo postconf -e "smtpd_milters = inet:localhost:8891" "non_smtpd_milters = $smtpd_milters" "milter_default_action = accept", then sudo systemctl reload postfix
hint-signature-end =
    .piste = The signature can only be checked with the public key, published in the zone (opendkim-genkey's .txt file). And the serial.
    .solution = Add the content of /etc/dkimkeys/mail.txt to /etc/bind/zones/db.gardens.example, raise the serial, sudo rndc reload; sudo opendkim-testkey -d gardens.example -s mail -vvv, then an email to the checker.

## Chapter 3 — The Policy

hint-policy-report =
    .piste = The reports in dmarc_reports are XML: each "record" says who sent (source_ip), how many, and what SPF, DKIM and DMARC gave. Look for the addresses that aren't 203.0.113.30.
    .solution = grep source_ip dmarc_reports/*.xml, then less on the report: 198.51.100.77 (newsmail.example) passes SPF and DKIM for its own domain, not for gardens.example.
hint-policy-aligned =
    .piste = The newsletter must be signed with d=gardens.example: newsmail_letter.txt says how to delegate a selector. Mind the trailing dot, and the serial.
    .solution = Add "nm1._domainkey IN CNAME nm1.dkim.newsmail.example." to the zone, raise the serial, sudo rndc reload; dig TXT nm1._domainkey.gardens.example @ns2.registry.example
hint-policy-end =
    .piste = Now that the newsletter is aligned, the policy can be tightened: the p= tag of the _dmarc record (keep rua=).
    .solution = In the zone: _dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@gardens.example", serial, sudo rndc reload; dig TXT _dmarc.gardens.example @ns2.registry.example
