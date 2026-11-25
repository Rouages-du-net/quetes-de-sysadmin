### Geschichte „Das Rechenzentrum“, Kapitel 5 „Das Zertifikat ist
### abgelaufen“: TLS, Let's Encrypt und certbot. Befehle, Pfade, Dateinamen
### und die Meldungen von certbot, openssl, curl und nginx werden nicht übersetzt.

chapter-certificate = Das Zertifikat ist abgelaufen
    .summary = Das Schloss ist weg: certbot, die HTTP-Challenge, openssl und eine Erneuerung, die von selbst klappt.

## Dateien

certificate-email-awa =
    Von:     Awa (Leiterin des Betriebs)
    An:      dich
    Betreff: Die Website verschreckt die Besucher

    Léa, am Empfang der Mediathek, sagt mir, dass die Website seit heute
    Morgen eine Sicherheitswarnung zeigt (ihre Nachricht liegt in
    ~/nachricht_von_lea.txt). Das HTTPS-Zertifikat muss abgelaufen sein.

    Ich verstehe es nicht: certbot soll es von selbst erneuern, es
    versucht es zweimal am Tag. Und seit 2025 schickt Let's Encrypt vor
    dem Ablauf keine E-Mail mehr: Niemand hat es kommen sehen.

    Könntest du:
    1. herausfinden, warum die automatische Erneuerung nicht funktioniert;
    2. das Zertifikat erneuern, damit die Website wieder sicher ist;
    3. sicherstellen, dass es das nächste Mal GANZ VON SELBST klappt, bis zum Ende.

    Um zu prüfen, was ein Browser sieht: curl https://medialibrary.example
    Der Rest steht in man certbot und man openssl. Das sudo-Passwort hat
    sich nicht geändert.
certificate-message-lea =
    Hallo Awa,

    als ich heute Morgen die Website der Mediathek geöffnet habe, hat
    Firefox angezeigt:

      Warnung: Mögliches Sicherheitsrisiko erkannt
      Das Zertifikat für medialibrary.example ist am 21.01.2027 abgelaufen.
      Fehlercode: SEC_ERROR_EXPIRED_CERTIFICATE

    Auf meinem Handy sagt Chrome „Dies ist keine sichere Verbindung“
    (NET::ERR_CERT_DATE_INVALID). Zwei Leute aus der Leserschaft haben
    schon angerufen und gefragt, ob wir gehackt wurden. Ich habe ihnen
    gesagt, sie sollen vorerst nichts auf der Website eingeben.

    Léa
certificate-readme-live =
    This directory contains your keys and certificates.

    `privkey.pem`  : the private key for your certificate.
    `fullchain.pem`: the certificate file used in most server software.
    `chain.pem`    : used for OCSP stapling in Nginx >=1.3.7.
    `cert.pem`     : will break many server configurations, and should not be used
                     without reading further documentation (see link below).

    WARNING: DO NOT MOVE OR RENAME THESE FILES!
             Certbot expects these files to remain in this location in order
             to function properly!

    We recommend not moving these files. For more information, see the Certbot
    User Guide at https://certbot.eff.org/docs/using.html#where-are-my-certificates.

## Die Website

certificate-site-index =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Mediathek im Viertel</title></head>
    <body>
    <h1>Mediathek im Viertel</h1>
    <p>Geöffnet Dienstag bis Samstag, 10 bis 18 Uhr.</p>
    <p>Neu: Reserviere deine Bücher online mit deinem Leseausweis.</p>
    </body>
    </html>

## Ereignisse

certificate-event-expires =
    Das Zertifikat ist tatsächlich abgelaufen: Genau das sehen die
    Browser. Aber warum wurde es nicht erneuert? certbot läuft von selbst,
    gestartet von systemd: Sein Journal weiß es (journalctl -u certbot,
    oder systemctl --failed). Um eine Erneuerung zu probieren, ohne etwas
    kaputtzumachen, spricht man certbot von einem Probelauf (dry run).
certificate-event-challenge =
    Let's Encrypt gibt ein Zertifikat nur dem, der beweist, dass er die
    Website kontrolliert: certbot legt eine kleine Datei (die „Challenge“)
    in ein Verzeichnis, dann holt die Zertifizierungsstelle sie von
    http://medialibrary.example/.well-known/acme-challenge/ ab.
    Hier bekommt sie ein 404: Die Datei liegt nicht dort, wo nginx diese
    Website ausliefert.

    In welches Verzeichnis legt certbot die Challenge (schau dir jede Zeile
    von /etc/letsencrypt/renewal/medialibrary.example.conf an)? Und welches
    Verzeichnis liefert nginx für medialibrary.example aus? man certbot
    sagt dir, wie du das Verzeichnis änderst.
certificate-event-not-reload =
    Das neue Zertifikat liegt auf der Platte… aber curl sieht noch das
    alte. nginx liest sein Zertifikat beim Start oder beim Neuladen seiner
    Konfiguration, nicht bei jedem Besuch: Es liefert noch das vom Oktober
    aus. Was musst du nginx sagen?
certificate-event-without-hook =
    Die Website ist wieder sicher, und certbot kann jetzt erneuern. Aber
    in 60 Tagen, wenn es mitten in der Nacht von selbst erneuert, wer lädt
    dann nginx neu? Niemand: Die Website wird das alte Zertifikat
    ausliefern, bis es abläuft, genau wie heute. certbot kann nach jeder
    erfolgreichen Erneuerung einen Befehl ausführen: Such nach „hook“ in
    man certbot.
certificate-event-end =
    curl https://medialibrary.example antwortet ohne Warnung: Das Schloss
    ist zurück. Und nächstes Mal erneuert certbot von selbst und lädt
    nginx dann von selbst neu.

    Awa: „Danke. Ich richte einen Alarm ein, der uns fünfzehn Tage vor
    Ablauf warnt: Auf die E-Mails von Let's Encrypt können wir nicht mehr
    zählen.“

    Gut gemacht! Du hast Kapitel 5 von „Das Rechenzentrum“ abgeschlossen.

    WAS PASSIERT IST
    Am Tag des Brandes wurde das Zertifikat beantragt, bevor die Website
    wiederhergestellt war: certbot hat sich das Standardverzeichnis der
    Debian-Website gemerkt, /var/www/html. 60 Tage lang kein Problem. Dann,
    ab 30 Tagen vor Ablauf, hat jede automatische Erneuerung die Challenge
    in dieses Verzeichnis gelegt, das nginx für die Mediathek nicht
    ausliefert: 404, Fehlschlag, zweimal am Tag, still. Heute Morgen ist
    das Zertifikat abgelaufen.

    GUTE PRAXIS
    - Ein Zertifikat von Let's Encrypt hält 90 Tage; certbot versucht, es
      30 Tage vor dem Ende zu erneuern. Eine fehlgeschlagene Erneuerung
      bleibt unbemerkt: Überwache das Ablaufdatum selbst (openssl x509
      -checkend, eine Sonde) und den Dienst certbot (systemctl --failed).
    - certbot renew --dry-run nach jeder Änderung an der Website oder an nginx.
    - Die HTTP-01-Challenge läuft über Port 80: Das an certbot übergebene
      Verzeichnis (-w) muss das sein, das nginx für diesen Namen ausliefert.
    - nginx liest sein Zertifikat beim Laden: Ein Deploy-Hook (systemctl
      reload nginx) lädt es nach jeder erfolgreichen Erneuerung neu.
    - Immer wie ein Besucher prüfen: curl https://…, oder openssl s_client.

    EIN ANDERER WEG
    Andere ACME-Clients: acme.sh (ein Shell-Skript, ohne Abhängigkeiten)
    oder lego; oder ein Webserver, der das allein erledigt (Caddy holt und
    erneuert seine Zertifikate ohne Konfiguration). Und die
    DNS-01-Challenge (ein TXT-Eintrag) statt HTTP-01: die einzige, die ein
    Wildcard-Zertifikat (*.example) liefert, aber du musst in deine
    DNS-Zone schreiben können.

    DOKUMENTATION
    - certbot: https://eff-certbot.readthedocs.io/en/stable/using.html
    - Let's Encrypt challenges: https://letsencrypt.org/docs/challenge-types/
    - openssl x509: https://docs.openssl.org/3.5/man1/openssl-x509/
