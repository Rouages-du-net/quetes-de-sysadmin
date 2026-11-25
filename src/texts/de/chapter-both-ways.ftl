### Geschichte „Die Fähre“, Kapitel „In beide Richtungen“: nginx lauscht nur
### in IPv4, und die aktualisierte Buchungs-App lauscht auf ::1, während
### nginx 127.0.0.1 fragt. curl -4/-6 -v, ss, listen [::]:80, proxy_pass
### und localhost. Befehle, Optionen, Adressen, Pfade und Ausgaben werden
### nicht übersetzt.

chapter-both-ways = In beide Richtungen
    .summary = Der erste Samstag der Saison: Mit mobilen Daten zögert die Website der Fähre oder scheitert, und seit dem Update gestern Abend antwortet die Buchungsseite allen mit „502 Bad Gateway“. Ein Fehler pro Adressfamilie: beide von außen finden und reparieren, bevor die Buchungen öffnen.

## Dateien

both-ways-message-amaru =
    Von: Amaru (Fährgenossenschaft)
    Samstag, 14. April, 8:30

    Guten Morgen! Eröffnungstag: Die Buchungen öffnen um neun.

    Zwei Probleme, fürchte ich. Auf meinem Handy, mit mobilen Daten, ist
    die Website jedes zweite Mal „nicht erreichbar“; im WLAN des Büros
    erscheint der Fahrplan. Aber „Überfahrt buchen“ antwortet „502 Bad
    Gateway“, hier und überall, seit Lucía gestern Abend die App
    aktualisiert hat. Sie hat eine Notiz hinterlassen, bevor sie das erste
    Boot aufs Festland genommen hat.

    ausguck ist immer noch da.

    Amaru

both-ways-note-lucia =
    Notiz von Lucía

    Gestern Abend habe ich die Buchungs-App aktualisiert (Node.js 22).
    Dabei habe ich /etc/default/booking aufgeräumt: HOST=localhost statt
    127.0.0.1, das ist sauberer, oder? Sie ist ohne Fehler gestartet
    (journalctl -u booking). Bis Montag!

    Lucía

## Ereignisse

both-ways-event-refused6 =
    In IPv6 lehnt Port 80 die Verbindung ab: Die Adresse antwortet (ping6
    funktioniert), aber niemand lauscht in IPv6 auf 80. Ohne -6 versucht
    curl zuerst IPv6 und fällt dann auf IPv4 zurück (Happy Eyeballs):
    Deshalb erscheint die Seite manchmal. Ein Handy in einem Netz ohne
    diesen Rückfall, oder dessen IPv4 schlecht ist, wartet oder scheitert.
    Auf kai: ss -tlnp.
both-ways-event-sockets =
    nginx lauscht auf 0.0.0.0:80: nur IPv4. Und die App lauscht auf
    [::1]:3000, dem IPv6-Loopback, nicht mehr auf 127.0.0.1. Zwei Spuren,
    eine pro Familie.
both-ways-event-bad-gateway =
    502 Bad Gateway: nginx hat geantwortet, konnte aber die App dahinter
    nicht erreichen. Sein Grund steht in /var/log/nginx/error.log.
both-ways-event-error-log =
    „connect() failed (111: Connection refused) while connecting to
    upstream, … upstream: http://127.0.0.1:3000/“: nginx klopft an
    127.0.0.1, die App lauscht auf ::1. Seit Node.js 17 gibt „localhost“
    die Adressen in der Reihenfolge des Systems, ::1 zuerst, und die App
    lauscht nur auf der ersten. Entweder fragt nginx [::1]
    (proxy_pass http://[::1]:3000/;), oder die App lauscht wieder auf
    127.0.0.1 (HOST in /etc/default/booking, dann neu starten).
both-ways-event-not-reloaded =
    Die Datei stimmt, und nginx -t ist einverstanden, aber nginx liefert
    immer noch die Konfiguration aus, die es beim Start gelesen hat:
    systemctl reload nginx.
both-ways-event-bind-conflict =
    nginx kann [::]:80 nicht öffnen: Mit ipv6only=off nimmt dieser Socket
    auch IPv4, und „listen 80“ hält schon den IPv4-Port 80. nginx -t sieht
    das nicht (es öffnet die Sockets nicht). Entweder zwei Zeilen, listen
    80 und listen [::]:80 (nur IPv6, die Voreinstellung), oder eine
    einzige Zeile, listen [::]:80 ipv6only=off.
both-ways-event-listen6 =
    nginx lauscht jetzt auch in IPv6 ([::]:80). Von ausguck aus sollte curl
    -6 den Fahrplan bekommen.
both-ways-event-exposed =
    Die App lauscht jetzt auf jeder Adresse: Sie bleibt nur privat, weil
    die Firewall Port 3000 verwirft. Ihr Platz ist das Loopback (127.0.0.1
    oder ::1), wo nur nginx sie erreicht.
both-ways-event-upstream-ok =
    Die Buchungsseite antwortet wieder über nginx.
both-ways-event-end =
    8:58. Amaru: „Mein Handy zeigt alles, die Buchungen funktionieren, und
    die ersten Fahrgäste buchen. Geh einen Kaffee am Kai trinken!“

    Gut gemacht! Du hast Die Fähre abgeschlossen.

    WAS PASSIERT IST
    Zwei Fehler, einer pro Familie. nginx lauschte nur in IPv4 (listen 80):
    In IPv6 wurde die Verbindung bei { $v6 } abgelehnt, und nur Clients,
    die auf IPv4 zurückfallen konnten ({ $v4 }), bekamen die Seite, spät.
    Und die aktualisierte App lauschte auf „localhost“, das Node.js zu ::1
    gemacht hat, während nginx 127.0.0.1 fragte: 502 für alle. Du hast das
    IPv6-listen hinzugefügt, nginx und die App auf dasselbe Loopback
    gerichtet, geprüft (nginx -t), neu geladen und von außen in beiden
    Familien geprüft.

    GUTE PRAXIS
    - Ein AAAA-Eintrag ist ein Versprechen: Jeder Dienst hinter dem Namen
      muss auch in IPv6 antworten (listen [::]:80 neben listen 80).
    - nginx: listen [::]:80 ist standardmäßig nur IPv6 (ipv6only=on); mit
      ipv6only=off nimmt es beides und darf nicht neben listen 80 stehen.
    - „localhost“ sind zwei Adressen: Schreib 127.0.0.1 oder [::1], wo eine
      gemeint ist (proxy_pass, HOST).
    - curl -4 und curl -6 -v testen jeden Weg einzeln; eine
      funktionierende Seite im Browser kann ein kaputtes IPv6 verstecken
      (Happy Eyeballs).
    - ss -tlnp: 0.0.0.0 ist IPv4, [::] IPv6, * beides.

    DOKUMENTATION
    - nginx, listen (ipv6only): https://nginx.org/en/docs/http/ngx_http_core_module.html#listen
    - nginx, proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Node.js, die Reihenfolge der DNS-Ergebnisse: https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder
    - Happy Eyeballs (RFC 8305): https://www.rfc-editor.org/rfc/rfc8305
