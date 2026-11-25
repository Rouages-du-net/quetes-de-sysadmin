### Geschichte „Spam“, Kapitel 2 „Die Signatur“: DKIM mit OpenDKIM.
### Befehle, Pfade, Direktiven und Meldungen werden nicht übersetzt.

chapter-signature = Die Signatur
    .summary = Die E-Mails kommen an, aber im Spam-Ordner: Signiere sie mit DKIM (OpenDKIM, der Milter von Postfix, der Schlüssel im DNS).

## Dateien

signature-message-nour =
    Hallo!

    Die Willkommens-E-Mails kommen an, danke. Aber bei mailbox.example
    landen sie im Spam-Ordner. Deren Hilfeseite sagt, ein seriöser
    Absender muss SPF und DKIM haben.

    Ich habe gestern opendkim installiert (sudo apt install opendkim
    opendkim-tools), ohne etwas zu konfigurieren: Die Datei ist
    /etc/opendkim.conf, und Debian legt die Schlüssel in /etc/dkimkeys ab.

    Ein Freund hat mir eine Adresse gegeben, die antwortet, was sie von
    einer E-Mail sieht (SPF, DKIM, DMARC):
    echo test | mail -s test check-auth@verifier.example
    Die Antwort kommt in deinem Postfach an, auf diesem Server (der Befehl
    mail ohne Argument listet sie auf; das Postfach selbst ist
    /var/mail/dein_konto).

    Das sudo-Passwort ist immer noch samen-2027.

    Nour

## Ereignisse

signature-event-check =
    Der Prüfdienst hat geantwortet: SPF besteht, aber „DKIM check: none“:
    Die E-Mails sind nicht signiert. DKIM ist eine Signatur, die jeder
    Nachricht mit einem privaten Schlüssel hinzugefügt wird; der Empfänger
    prüft sie mit dem öffentlichen Schlüssel, der im DNS veröffentlicht
    ist (selektor._domainkey.gardens.example). Unter Debian signiert
    opendkim, als „Milter“ an Postfix angeschlossen. Fang mit dem
    Schlüsselpaar an: man opendkim-genkey.
signature-event-key =
    Ein privater Schlüssel in /etc/dkimkeys. opendkim-genkey hat daneben
    auch eine .txt-Datei geschrieben: den DNS-Eintrag zum Veröffentlichen,
    mit dem öffentlichen Schlüssel. Prüf, wem der private Schlüssel gehört
    (ls -l): opendkim läuft als Konto opendkim und muss ihn lesen können.
signature-event-unreadable =
    opendkim startet nicht: „Permission denied“ auf den privaten
    Schlüssel. Er gehört root (root hat ihn angelegt), mit den Rechten
    rw-------: Das Konto opendkim kann ihn nicht lesen. Gib ihn opendkim:
    sudo chown opendkim:opendkim /etc/dkimkeys/…private
signature-event-not-sure =
    opendkim lehnt den Schlüssel ab: „key data is not secure“. Ein privater
    Schlüssel, den andere Konten lesen können, ist nicht mehr geheim, und
    opendkim (RequireSafeKeys) weigert sich, ihn zu benutzen. Mach ihn nur
    für seinen Besitzer lesbar: sudo chmod 600 …
signature-event-opendkim =
    opendkim läuft, mit dem Schlüssel und der Domain. Aber es signiert nur,
    was Postfix ihm übergibt: Der Milter muss in /etc/postfix/main.cf
    angeschlossen werden (man postconf, und MILTER_README). Die Adresse
    des Sockets muss zu Socket in opendkim.conf passen, jede mit ihrer
    eigenen Syntax.
signature-event-chroot =
    „connect to Milter service unix:…: No such file or directory“: Unter
    Debian läuft Postfix eingesperrt in /var/spool/postfix (chroot). Ein
    Pfad wie /run/opendkim/opendkim.sock ist für ihn
    /var/spool/postfix/run/opendkim/opendkim.sock, und das gibt es nicht.
    Der Kommentar in opendkim.conf sagt es: entweder ein Socket in
    /var/spool/postfix, oder ein Netzwerk-Socket (Socket
    inet:8891@localhost, und inet:localhost:8891 auf der Seite von
    Postfix).
signature-event-socket =
    „connect to Milter service inet:…: Connection refused“: Postfix findet
    unter dieser Adresse niemanden. Läuft opendkim, und lauscht es auf
    diesem Port? Achte auf die zwei Syntaxen: inet:8891@localhost in
    opendkim.conf, inet:localhost:8891 in main.cf.
signature-event-smtpd-only =
    smtpd_milters gilt nur für Mail, die über das Netz (SMTP) ankommt. Die
    E-Mails der Website und der Befehl mail werden auf der Maschine
    eingeliefert: Sie gehen über non_smtpd_milters. Um beide zu signieren:
    non_smtpd_milters = $smtpd_milters.
signature-event-milter =
    Postfix übergibt die Mail jetzt an opendkim, das sie signiert
    („DKIM-Signature field added“ in /var/log/mail.log). Veröffentliche
    jetzt den öffentlichen Schlüssel in der Zone, sonst kann niemand die
    Signatur prüfen. opendkim-testkey prüft den veröffentlichten
    Schlüssel.
signature-event-not-secure =
    „key not secure“ ist kein Fehler: opendkim-testkey sagt nur, dass die
    DNS-Antwort nicht durch DNSSEC geschützt ist. Worauf es ankommt, ist
    die nächste Zeile: „key OK“.
signature-event-serial =
    Der Server der Maschine veröffentlicht den Schlüssel, aber der
    Secondary der Registry hat ihn nicht: Hast du die Seriennummer der Zone
    erhöht? dig TXT mail._domainkey.gardens.example @ns2.registry.example
signature-event-end =
    Die E-Mails der Gärten sind signiert, und das Internet kann die
    Signatur mit dem veröffentlichten Schlüssel prüfen. Nour:
    „mailbox.example legt sie endlich in den Posteingang!“

    Gut gemacht! Du hast das Kapitel „Die Signatur“ abgeschlossen.

    WAS PASSIERT IST
    DKIM fügt jeder E-Mail eine Signatur hinzu, berechnet mit einem
    privaten Schlüssel, den nur der Server kennt; der Empfänger prüft sie
    mit dem öffentlichen Schlüssel, veröffentlicht im DNS unter
    selektor._domainkey.domain. Eine unterwegs veränderte oder von jemand
    anderem gesendete Nachricht fällt durch. opendkim signiert; Postfix
    übergibt ihm die Mail (Milter); das DNS veröffentlicht den Schlüssel.

    GUTE PRAXIS
    - Der private Schlüssel gehört dem Konto des Dienstes (opendkim), nur
      für es lesbar (600); nie woandershin kopiert.
    - non_smtpd_milters für Mail, die auf der Maschine eingeliefert wird,
      smtpd_milters für Mail, die über SMTP ankommt;
      milter_default_action = accept, damit die Mail nicht blockiert wird,
      wenn opendkim stoppt.
    - Ein Selektor pro Schlüssel (mail, 2027…): Um Schlüssel zu wechseln,
      einen neuen daneben veröffentlichen, dann den alten entfernen.
    - opendkim-testkey, dann eine echte E-Mail an einen Prüfdienst.

    DOKUMENTATION
    - DKIM, RFC 6376: https://www.rfc-editor.org/rfc/rfc6376
    - Postfix und Milter: https://www.postfix.org/MILTER_README.html
    - OpenDKIM: http://www.opendkim.org/opendkim.conf.5.html
