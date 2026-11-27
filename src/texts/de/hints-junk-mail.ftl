### Die gestuften Hinweise der Geschichte „Spam“: eine Spur, dann fast die
### Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Der Briefträger

hint-postman-differs =
    .lead = Post, die nicht abgegangen ist, wartet in der Warteschlange von Postfix: mailq zeigt sie, mit der Antwort des anderen Servers. /var/log/mail.log erzählt jeden Versuch.
    .solution = mailq (oder postqueue -p), dann grep deferred /var/log/mail.log: mailbox.example antwortet mit 451, „neither SPF nor DKIM passed“.
hint-postman-old =
    .lead = SPF ist ein TXT-Eintrag der Domain, der mit v=spf1 beginnt (man dig). Wen erlaubt er zum Senden?
    .solution = dig TXT gardens.example: „v=spf1 include:_spf.old-hosting.example -all“, das SPF des alten Hosters.
hint-postman-spf =
    .lead = Das SPF steht in der Zone von gardens.example, auf diesem Server (/etc/bind/zones). Es muss diese Maschine erlauben (mx, a oder ip4:203.0.113.30). Damit der Secondary der Registry es kopiert, muss die Seriennummer steigen.
    .solution = sudo nano /etc/bind/zones/db.gardens.example: das include durch mx ersetzen („v=spf1 mx -all“) und die Seriennummer erhöhen; sudo named-checkzone gardens.example /etc/bind/zones/db.gardens.example, sudo rndc reload, dann dig TXT gardens.example @ns2.registry.example
hint-postman-end =
    .lead = Das SPF stimmt, aber Postfix versucht es erst nach ein paar Minuten erneut. man postqueue.
    .solution = sudo postqueue -f, dann mailq: „Mail queue is empty“.

## Kapitel 2 — Die Signatur

hint-signature-check =
    .lead = Schick eine E-Mail an den Prüfdienst (siehe Nours Nachricht), und lies dann seine Antwort mit mail.
    .solution = echo test | mail -s test check-auth@verifier.example, dann mail (oder cat /var/mail/dein_konto): „DKIM check: none“.
hint-signature-key =
    .lead = Zuerst brauchst du ein Schlüsselpaar, in /etc/dkimkeys: man opendkim-genkey (die Domain, der Selektor, das Verzeichnis).
    .solution = sudo -u opendkim opendkim-genkey -d gardens.example -s mail -D /etc/dkimkeys (oder mit einfachem sudo, dann sudo chown opendkim:opendkim /etc/dkimkeys/mail.private)
hint-signature-opendkim =
    .lead = /etc/opendkim.conf hat auskommentierte Zeilen für die Domain, den Selektor und den Schlüssel. opendkim muss den Schlüssel lesen können; journalctl -u opendkim sagt, warum es nicht startet.
    .solution = In /etc/opendkim.conf: Domain gardens.example, Selector mail, KeyFile /etc/dkimkeys/mail.private, und Socket inet:8891@localhost; sudo systemctl restart opendkim
hint-signature-milter =
    .lead = Postfix muss die Mail an opendkim übergeben: die Parameter smtpd_milters und non_smtpd_milters (man postconf). Auf der Maschine eingelieferte Mail geht über non_smtpd_milters, und Postfix läuft in einem chroot.
    .solution = sudo postconf -e "smtpd_milters = inet:localhost:8891" 'non_smtpd_milters = $smtpd_milters' "milter_default_action = accept", dann sudo systemctl reload postfix
hint-signature-end =
    .lead = Die Signatur lässt sich nur mit dem öffentlichen Schlüssel prüfen, veröffentlicht in der Zone (die .txt-Datei von opendkim-genkey). Und die Seriennummer.
    .solution = Füg den Inhalt von /etc/dkimkeys/mail.txt zu /etc/bind/zones/db.gardens.example hinzu, erhöh die Seriennummer, sudo rndc reload; sudo opendkim-testkey -d gardens.example -s mail -vvv, dann eine E-Mail an den Prüfdienst.

## Kapitel 3 — Die Richtlinie

hint-policy-report =
    .lead = Die Berichte in dmarc_berichte sind XML: Jeder „record“ sagt, wer gesendet hat (source_ip), wie viel, und was SPF, DKIM und DMARC ergeben haben. Such die Adressen, die nicht 203.0.113.30 sind.
    .solution = grep source_ip dmarc_berichte/*.xml, dann less auf den Bericht: 198.51.100.77 (newsmail.example) besteht SPF und DKIM für die eigene Domain, nicht für gardens.example.
hint-policy-aligned =
    .lead = Der Newsletter muss mit d=gardens.example signiert sein: newsmail_schreiben.txt sagt, wie man einen Selektor delegiert, und die Berichte sagen, welchen (selector). Achte auf den Punkt am Ende, und die Seriennummer.
    .solution = Füg „nm1._domainkey IN CNAME nm1.dkim.newsmail.example.“ zur Zone hinzu, erhöh die Seriennummer, sudo rndc reload; dig TXT nm1._domainkey.gardens.example @ns2.registry.example
hint-policy-end =
    .lead = Jetzt, wo der Newsletter ausgerichtet ist, kann die Richtlinie verschärft werden: das Tag p= des Eintrags _dmarc (rua= behalten).
    .solution = In der Zone: _dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@gardens.example", Seriennummer, sudo rndc reload; dig TXT _dmarc.gardens.example @ns2.registry.example
