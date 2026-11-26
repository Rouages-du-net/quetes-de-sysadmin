### Graded hints for The Lifeboat (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — Mailbox Full

hint-mailbox-full-bounces =
    .lead = Was ist mit den letzten Nachrichten an Saoirse passiert? Postfix und Dovecot schreiben jede Zustellung ins Mail-Log.
    .solution = sudo grep saoirse /var/log/mail.log | tail
hint-mailbox-full-quota-get =
    .lead = Wie viel ihrer Quota benutzt sie? doveadm hat einen Befehl für die Quota eines Benutzers (man doveadm).
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-trash =
    .lead = Welcher ihrer Ordner belegt den Platz? Frag doveadm nach der Größe jedes Postfachs, oder miss ihr Maildir.
    .solution = sudo doveadm mailbox status -u saoirse@lifeboat.example "messages vsize" "*" (oder sudo du -sh /var/vmail/lifeboat.example/saoirse/Maildir/.[A-Z]*)
hint-mailbox-full-expunged =
    .lead = Lösch die alten Nachrichten ihres Papierkorbs über Dovecot, mit einer Suchanfrage nach ihrem Datum (man doveadm, man doveadm-search-query); probier die Anfrage zuerst mit doveadm search aus.
    .solution = sudo doveadm expunge -u saoirse@lifeboat.example mailbox Trash savedbefore 2031-01-01
hint-mailbox-full-raised =
    .lead = Gib Saoirse, und nur ihr, die 2 GB, die der Vorstand beschlossen hat: die userdb von Dovecot kann Einstellungen pro Benutzer tragen.
    .solution = sudo nano /etc/dovecot/users: userdb_quota_storage_size=2G ans Ende von Saoirses Zeile anfügen; prüfen mit sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-delivered =
    .lead = Sobald Platz ist, wird die nächste Nachricht an sie gespeichert: beobachte das Log.
    .solution = sudo tail -n 5 /var/log/mail.log (such nach „stored mail into mailbox 'INBOX'“)
hint-mailbox-full-warning =
    .lead = 90-quota.conf hat ein auskommentiertes Beispiel einer Quota-Warnung, und der Dienst, den sie ausführt, existiert schon. Aktiviere sie, prüfe, lade Dovecot neu.
    .solution = sudo nano /etc/dovecot/conf.d/90-quota.conf (den Block quota_warning warn-90 einkommentieren), dann sudo doveconf -n | grep -A5 quota_warning und sudo doveadm reload
hint-mailbox-full-end =
    .lead = Prüf alles: ihre Quota, den Papierkorb, die Zählung (doveadm quota recalc, falls Dateien von Hand entfernt wurden), die Warnung in der laufenden Konfiguration.
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example; sudo doveadm quota recalc -u saoirse@lifeboat.example; sudo doveadm reload

## Chapter 2 — Spam Tide

hint-spam-tide-scores =
    .lead = Wie bewertet rspamd diese Nachrichten? Sein Log hat eine Zeile pro Nachricht, und rspamc kann eine gespeicherte scannen (man rspamc).
    .solution = sudo tail -n 3 /var/log/rspamd/rspamd.log; oder sudo rspamc symbols auf eine Datei aus Leilanis INBOX (/var/vmail/lifeboat.example/leilani/Maildir/cur/…)
hint-spam-tide-thresholds =
    .lead = Schau dir die Schwellen der Aktionen an, die Yerlan geändert hat, setz sie auf die Standardwerte von rspamd zurück, prüf die Konfiguration und lade rspamd neu.
    .solution = sudo nano /etc/rspamd/local.d/actions.conf (reject = 15; add_header = 6; greylist = 4;), sudo rspamadm configtest, sudo systemctl reload rspamd
hint-spam-tide-bulletin-junk =
    .lead = Warum liegt das Bulletin über add_header? Lies seine Symbole und schau, welche von der Plattform kommen, über die es geschickt wird.
    .solution = sudo grep coastwatch /var/log/rspamd/rspamd.log | tail -n 1
hint-spam-tide-whitelist =
    .lead = Vertraue der eigenen From:-Adresse des Bulletins, nichts Weiterem: eine multimap-Regel vom Typ from (Vorsicht: standardmäßig der SMTP-Absender) oder eine settings-Regel (from_mime), in local.d.
    .solution = local.d/multimap.conf: WHITELIST_COASTWATCH { "{" } type = "from"; extract_from = "mime"; map = "/etc/rspamd/local.d/coastwatch.map"; score = -6.0; { "}" }, die Map mit news@coastwatch.example; rspamadm configtest; systemctl reload rspamd
hint-spam-tide-bayes =
    .lead = Bayes braucht genug Beispiele beider Klassen: Leilani hat Spam schon nach Junk sortiert und ihre Buchungen in Archive behalten.
    .solution = sudo rspamc learn_spam /var/vmail/lifeboat.example/leilani/Maildir/.Junk/cur/ und sudo rspamc learn_ham /var/vmail/lifeboat.example/leilani/Maildir/.Archive/cur/; dann rspamc stat
hint-spam-tide-caught =
    .lead = Prüf an neuen Nachrichten: werden Phishing, Rechnungen und Gewinne jetzt als Spam markiert? Das Log zeigt die Aktion jeder neuen.
    .solution = sudo tail -n 4 /var/log/rspamd/rspamd.log (such nach add header); sudo rspamc stat
hint-spam-tide-end =
    .lead = Alles auf einmal: der Milter in main.cf, vernünftige Schwellen, Bayes trainiert, das Bulletin ohne Aktion, nichts auf der Whitelist, was Spam benutzen kann.
    .solution = postconf smtpd_milters; sudo rspamadm configdump actions multimap; sudo rspamc stat

## Chapter 3 — The Sorting Office

hint-sorting-office-read-old =
    .lead = Yerlan hat ein altes Skript von Aziz erwähnt: schau dir seine Sieve-Skripte an.
    .solution = sudo doveadm sieve list -u aziz@lifeboat.example; sudo cat /var/vmail/lifeboat.example/aziz/sieve/holiday.sieve
hint-sorting-office-folder =
    .lead = Schreib für Leilani ein Skript, das die Nachrichten an bookings@ nach Bookings legt (fileinto, :create), prüf es und mach es zu ihrem aktiven Skript.
    .solution = require ["fileinto", "mailbox", "envelope"]; if envelope :is "to" "bookings@lifeboat.example" { "{" } fileinto :create "Bookings"; { "}" } — sudo doveadm sieve put -a -u leilani@lifeboat.example sorting < sorting.sieve
hint-sorting-office-sorted-live =
    .lead = Warte auf die nächste Buchung und schau, was LMTP damit gemacht hat.
    .solution = sudo grep -E "Bookings|bookings@" /var/log/mail.log | tail
hint-sorting-office-vacation =
    .lead = Eine Abwesenheitsnotiz ist die Erweiterung vacation (RFC 5230): schreib Aziz ein Skript damit, teste es an den Beispielen (sieve-test), aktiviere es.
    .solution = require ["vacation"]; vacation :days 7 :subject "Abwesend bis 24. November" "Ich bin bis zum 24. November weg; in dringenden Fällen schreib an marisol@lifeboat.example."; — dann sudo sieve-test away.sieve beispiel-liste.eml und doveadm sieve put -a
hint-sorting-office-alias =
    .lead = Eine Nachricht an treasurer@ bekommt keine Antwort: vacation antwortet nur auf Mail, die an den Benutzer adressiert ist. Nenn ihm seine andere Adresse.
    .solution = vacation :days 7 :addresses ["treasurer@lifeboat.example"] :subject "…" "…";
hint-sorting-office-replied-live =
    .lead = Warte auf eine echte Nachricht an Aziz und such die Antwort im Log.
    .solution = sudo grep "vacation response" /var/log/mail.log | tail
hint-sorting-office-end =
    .lead = Beide Skripte aktiv, jedes getestet, jedes bei der Arbeit an echter Mail gesehen.
    .solution = sudo doveadm sieve list -u leilani@lifeboat.example; sudo doveadm sieve list -u aziz@lifeboat.example; sudo tail /var/log/mail.log
