### Geschichte „Der Flicken“, Kapitel 1 „Das Schloss“: Caddy und sein
### automatisches HTTPS (Adresse der Website, ACME-Challenge, Firewall,
### Weiterleitung von www). Befehle, Pfade, Direktiven und Meldungen von
### Caddy werden nicht übersetzt.

chapter-padlock = Das Schloss
    .summary = Caddy sollte HTTPS von selbst machen, aber die Website der Fahrradwerkstatt bleibt bei HTTP: Gib ihr ihren Namen, lass Let's Encrypt durch, und vergiss www nicht.

## Dateien

padlock-message-ines =
    Von:     Inès
    An:      dich
    Betreff: Das Schloss!

    Hallo!

    Der Flicken hat endlich einen eigenen Server, nur für die Website der
    Werkstatt. Ich habe Caddy statt nginx installiert: Angeblich macht er
    HTTPS von selbst, ohne certbot, ohne alles. Ich habe die Website nach
    /var/www/cycles gelegt und das Verzeichnis in /etc/caddy/Caddyfile
    geändert.

    Auf dem Server zeigt curl http://localhost unsere Seite. Aber von
    außen: nichts. Kein Schloss im Browser, https://cycles.example
    antwortet nicht, und sogar http://cycles.example geht bei mir zu Hause
    nicht. Dabei stimmt das DNS: cycles.example und www.cycles.example
    führen beide zu 203.0.113.40, unserem Server.

    Was wir brauchen:
    - https://cycles.example zeigt die Website, mit einem echten Zertifikat;
    - http://cycles.example schickt die Leute zu https://;
    - https://www.cycles.example geht auch (das ist die Adresse auf unseren
      Plakaten!), und zeigt die Website oder schickt zu cycles.example.

    Die Firewall (ufw) habe ich nach einem Tutorial eingeschaltet, für ssh.
    Der Dienst heißt caddy (systemctl status caddy, journalctl -u caddy);
    es gibt auch man caddy.

    Danke, und bis Samstag in der Werkstatt!
    Inès

padlock-site =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Der Flicken — Fahrradwerkstatt</title></head>
    <body>
    <h1>Der Flicken</h1>
    <p>Offene Fahrradwerkstatt: Wir zeigen dir, wie du dein Fahrrad selbst reparierst.</p>
    <p>Jeden Samstag, 10 bis 17 Uhr. Werkzeug und Rat, zahl, was du kannst.</p>
    </body>
    </html>

## Ereignisse

padlock-event-http-only =
    Caddy lauscht nur auf Port 80, über HTTP: Das Caddyfile beginnt mit
    „:80 {"{"}“, der Vorlage des Pakets. Eine Adresse ohne Domainnamen,
    oder eine, die Port 80 (oder http://) angibt, bekommt kein Zertifikat:
    Caddy wüsste nicht, für welchen Namen er es anfordern soll. Der
    Kommentar oben in der Datei sagt es: Ersetze :80 durch den Namen der
    Website. Dann sudo systemctl reload caddy, und schau, was das Journal
    sagt.
padlock-event-schema-http =
    http://cycles.example: Mit http:// verlangt die Adresse eine reine
    HTTP-Website, also kein Zertifikat. Für automatisches HTTPS reicht der
    Name allein: cycles.example (oder https://cycles.example).
padlock-event-address =
    Caddy hat den Namen übernommen: Er lauscht jetzt auf den Ports 80 und
    443 (sudo ss -tlnp) und fordert von selbst ein Zertifikat bei Let's
    Encrypt an. Hat er es bekommen? Alles steht in seinem Journal:
    journalctl -u caddy (die Zeilen tls.obtain und acme_client).
padlock-event-firewall =
    „Timeout during connect (likely firewall problem)“: Um zu prüfen, dass
    der Server wirklich für cycles.example antwortet, schaut Let's Encrypt
    aus dem Internet nach, auf Port 80 (HTTP-01-Challenge) oder 443
    (TLS-ALPN-01). Aber ufw lässt nur ssh herein: sudo ufw status. Auch die
    Besucher werden diese Ports benutzen. Caddy versucht es etwas später
    von selbst noch einmal.
padlock-event-alert =
    „tlsv1 alert internal error“: Caddy antwortet auf Port 443, hat aber
    (noch) kein Zertifikat für diesen Namen, also scheitert der
    TLS-Handshake. Das Journal sagt, wie weit er ist: journalctl -u caddy.
padlock-event-format =
    Nur eine Warnung: Das Caddyfile ist nicht so geschrieben, wie caddy fmt
    es gerne hätte (Tabs zum Einrücken, ein Leerzeichen zwischen Wörtern).
    sudo caddy fmt --overwrite /etc/caddy/Caddyfile formatiert es.
padlock-event-certificate =
    Das Schloss! Caddy hat sein Zertifikat bekommen („certificate obtained
    successfully“ im Journal), abgelegt in /var/lib/caddy. Probier
    curl -I http://cycles.example: Die Weiterleitung auf HTTPS hat Caddy
    von selbst hinzugefügt. Bleibt noch die Adresse auf den Plakaten:
    www.cycles.example.
padlock-event-end =
    https://cycles.example und https://www.cycles.example antworten, mit
    ihren Zertifikaten, und HTTP schickt zu HTTPS. Inès: „Das Schloss!
    Ich kann die neuen Plakate drucken.“

    Gut gemacht! Du hast das Kapitel „Das Schloss“ abgeschlossen.

    WAS PASSIERT IST
    Das Caddyfile begann mit :80, der Vorlage des Pakets: eine Website ohne
    Namen, nur über HTTP ausgeliefert. Mit ihrem Domainnamen als Adresse
    kümmert sich Caddy selbst um HTTPS: Er fordert ein Zertifikat bei Let's
    Encrypt an (ACME), legt es ab, erneuert es und leitet HTTP auf HTTPS
    weiter. Aber Let's Encrypt muss die Maschine auf Port 80 oder 443
    erreichen können, um zu prüfen, dass sie für diesen Namen antwortet:
    Die Firewall ließ nur ssh durch. Und www.cycles.example ist ein anderer
    Name: Er braucht seinen eigenen Block (oder seinen Platz in der Liste
    der Adressen) und sein Zertifikat.

    NGINX + CERTBOT UND CADDY, NEBENEINANDER
      nginx + certbot                     Caddy
      server_name, listen 443 ssl          die Adresse der Website: cycles.example
      certbot --nginx oder --webroot       nichts: Caddy macht es beim Laden
      ssl_certificate, ssl_certificate_key nichts (abgelegt in /var/lib/caddy)
      return 301 https://…                 automatisch (308)
      ein Timer für certbot renew          automatisch
      nginx -t                             caddy validate, caddy fmt
      systemctl reload nginx               systemctl reload caddy (caddy reload)

    GUTE PRAXIS
    - Für ein öffentliches Zertifikat muss der Name zur Maschine führen
      (DNS), und die Ports 80 und 443 müssen offen sein: bei Caddy wie bei
      certbot.
    - Lies das Journal nach jedem Reload: Ein abgelehntes Zertifikat hält
      Caddy nicht vom Laufen ab, es steht nur im Journal.
    - caddy validate vor dem Reload; caddy fmt für ein lesbares Caddyfile.
    - Ein Name pro Adresse oder pro Block: www ist ein eigener Name, den
      du auch auslieferst oder weiterleitest
      (redir https://cycles.example{"{"}uri{"}"} permanent).
    - Zum Experimentieren, ohne an die Limits von Let's Encrypt zu stoßen,
      kann Caddy die Staging-Stelle benutzen (Option acme_ca, oder tls
      internal in einem privaten Netz).

    DOKUMENTATION
    - Automatisches HTTPS: https://caddyserver.com/docs/automatic-https
    - Adressen im Caddyfile: https://caddyserver.com/docs/caddyfile/concepts#addresses
    - redir: https://caddyserver.com/docs/caddyfile/directives/redir
    - ACME-Challenge-Typen: https://letsencrypt.org/docs/challenge-types/
