### Geschichte „Die Nachbarschaftsbriefe“, Kapitel 4 „Eine Wohngemeinschaft“:
### virtuelle Hosts und Reverse Proxy mit nginx. Befehle, Pfade, Direktiven
### und Meldungen von nginx werden nie übersetzt. Die Seiten der Websites
### (sharing-site-*, sharing-agenda-*) werden übersetzt.

chapter-sharing = Eine Wohngemeinschaft
    .summary = Zwei Websites und eine App auf einem einzigen Server: virtuelle Hosts, ln -s, Reverse Proxy mit nginx.

## Dateien

sharing-email-kofi =
    Von:     Kofi (Verein Die Nachbarschaftsbriefe)
    An:      dich
    Betreff: Das Café zieht bei uns ein

    Gute Nachricht: Das Nachbarschaftscafé (du erinnerst dich, das, in dem
    das Internet nicht mehr ging) zahlt nicht mehr für sein Hosting. Es
    zieht auf unseren Server! Eine Maschine, zwei Websites: Angeblich kann
    nginx das. Den Namen cafe.example habe ich schon auf unsere Adresse
    zeigen lassen.

    Und Rania hat den Workshop-Kalender fertig: ein kleines Programm, das
    unter http://letters.example/agenda/ erscheinen soll.

    Wir brauchen also:
    1. dass http://cafe.example die Website des Cafés zeigt;
    2. dass http://letters.example natürlich unsere Website bleibt;
    3. dass http://letters.example/agenda/ den Kalender zeigt (und seine
       Seiten, wie /agenda/woche);
    4. dass das alles einen Neustart übersteht.

    Rania hat ihre Notizen dagelassen (notiz_von_rania.txt). Für sudo ist
    dein Passwort immer noch dasselbe: ameisen-2026
sharing-note-rania =
    RANIAS NOTIZEN

    Die Seiten des Cafés sind fertig: /var/www/cafe/

    Unter Debian hat jede Website ihre Datei in /etc/nginx/sites-available/,
    und man aktiviert sie mit einem symbolischen Link in
    /etc/nginx/sites-enabled/ (ls -l /etc/nginx/sites-enabled, um zu sehen,
    wie unsere gemacht ist). Am einfachsten: unsere Datei kopieren und anpassen.

    Der Kalender liegt in /opt/agenda (systemd-Dienst „agenda“). Er
    lauscht auf 127.0.0.1:3000, nur auf der Maschine selbst: nginx muss
    ihm die Besuche weiterreichen (Reverse Proxy, siehe proxy_pass in
    man nginx). Seine Seiten beginnen bei /: /, /woche, /workshops.

    Um eine Website vom Server aus zu testen, bevor die ganze Welt sie sieht:
      curl -H "Host: cafe.example" http://127.0.0.1
    Und immer: sudo nginx -t vor dem Neuladen.
sharing-agenda-description = Workshop-Kalender (Node.js)
# { $file }: die Datei des Programms (server.js)
sharing-agenda-readme =
    Workshop-Kalender — Node.js-Server

    Lauscht auf 127.0.0.1:3000 (siehe { $file }).
    Seiten: /  /woche  /workshops
    systemd-Dienst: agenda
sharing-agenda-code =
    // Workshop-Kalender der Nachbarschaftsbriefe.
    const express = require('express');
    const app = express();

    app.get('/', (req, res) => res.sendFile(__dirname + '/pages/start.html'));
    app.get('/woche', (req, res) => res.sendFile(__dirname + '/pages/woche.html'));
    app.get('/workshops', (req, res) => res.sendFile(__dirname + '/pages/workshops.html'));

    // Nur auf der Maschine selbst: nginx steht davor.
    app.listen(3000, '127.0.0.1');

## Die Websites

sharing-site-letters =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Nachbarschaftsbriefe</title></head>
    <body>
    <h1>Die Nachbarschaftsbriefe</h1>
    <p>Öffentliche Schreibstube, Schreibworkshops, Hilfe bei Behördenkram.</p>
    </body>
    </html>
sharing-site-cafe =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Das Nachbarschaftscafé</title></head>
    <body>
    <h1>Das Nachbarschaftscafé</h1>
    <p>Geöffnet Mittwoch bis Sonntag. Suppe des Tages, zahl, was du kannst.</p>
    </body>
    </html>
sharing-agenda-welcome =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Workshop-Kalender</title></head>
    <body>
    <h1>Workshop-Kalender</h1>
    <p><a href="woche">Diese Woche</a> · <a href="workshops">Alle Workshops</a></p>
    </body>
    </html>
sharing-agenda-week =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Diese Woche</title></head>
    <body>
    <h1>Diese Woche</h1>
    <p>Dienstag 18 Uhr: Schreibworkshop. Donnerstag 14 Uhr: Hilfe bei Online-Formularen.</p>
    </body>
    </html>
sharing-agenda-workshops =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Workshops</title></head>
    <body>
    <h1>Die Workshops</h1>
    <p>Schreiben, Vorlesen, Online-Formulare, Briefe schreiben.</p>
    </body>
    </html>

## Ereignisse

sharing-event-link-broken =
    nginx findet eine Datei in /etc/nginx/sites-enabled/ nicht: Der Link
    ist kaputt. ls -l /etc/nginx/sites-enabled zeigt, wohin er zeigt. Ein
    relativer Pfad wird vom Verzeichnis des Links aus gelesen
    (sites-enabled), nicht von dort, wo du warst, als du ihn angelegt
    hast: Lies noch einmal man ln und lösche den falschen Link mit rm (die
    Zieldatei bleibt, wo sie ist).
sharing-event-conflict =
    „conflicting server name“: Zwei Websites antworten auf denselben
    Namen. nginx behält die erste, die es liest, und ignoriert die andere
    für diesen Namen. Die kopierte Datei hat wohl den server_name der
    Briefe-Website behalten.
sharing-event-bad-site =
    Du hast cafe.example angefragt… und die Briefe-Website antwortet.
    nginx wählt die Website nach dem angefragten Namen (server_name); passt
    keiner, nimmt es die Standard-Website des Ports (default_server).
    Ist die Café-Website aktiviert, und trägt sie diesen Namen?
sharing-event-cafe =
    cafe.example antwortet mit der Seite des Cafés: zwei Websites auf
    derselben Maschine, unter derselben Adresse, nur durch den angefragten
    Namen unterschieden. Das ist ein virtueller Host.
sharing-event-gateway =
    502 Bad Gateway: nginx hat den Besuch zwar empfangen, aber dahinter
    antwortet niemand. Sein Fehlerlog sagt, warum:
    sudo tail /var/log/nginx/error.log. Und läuft der Kalender?
sharing-event-cannot-get =
    „Cannot GET /agenda/“: Diesmal antwortet der Kalender… aber er bekommt
    den Pfad /agenda/, während seine Seiten bei / beginnen. Bei proxy_pass
    zählt ein Detail enorm: der Schrägstrich am Ende. Lies proxy_pass in
    man nginx noch einmal.
sharing-event-agenda-without-enable =
    Der Kalender antwortet. Aber er startet nicht mit der Maschine: Beim
    nächsten Neustart wieder 502. (man systemctl)
sharing-event-end =
    cafe.example, letters.example und der Kalender antworten, jeder mit
    seinen eigenen Seiten, von einem einzigen Server. Kofi: „Wir feiern
    den Einzug des Cafés. Du bist eingeladen!“

    Gut gemacht! Du hast Kapitel 4 von „Die Nachbarschaftsbriefe“
    abgeschlossen. (Als Nächstes: Bei mir geht's.)

    WAS PASSIERT IST
    Eine IP-Adresse, ein nginx, mehrere Websites: Jeder Besuch nennt den
    Namen, den er anfragt (Header Host), und nginx wählt den server-Block,
    dessen server_name passt, oder sonst den mit default_server
    markierten. Vor dem Kalender arbeitet nginx als Reverse Proxy: Es
    empfängt die Besuche und reicht sie an das Programm weiter, das nur
    auf 127.0.0.1 lauscht.

    GUTE PRAXIS
    - Eine Datei pro Website in sites-available, aktiviert durch einen Link
      in sites-enabled (ln -s, mit absolutem Pfad); deaktiviert wird durch
      Löschen des Links, ohne die Datei zu verlieren.
    - Ein einziger default_server pro Port, und überall ein ausdrücklicher server_name.
    - Eine Website vor dem DNS testen: curl -H "Host: name" http://127.0.0.1
    - proxy_pass http://127.0.0.1:3000/; (mit Schrägstrich) ersetzt das
      Präfix der location; ohne Schrägstrich geht der Pfad unverändert durch.
    - 502: in error.log schauen, dann beim Dienst hinter nginx.
    - Eine App hinter einem Proxy lauscht auf 127.0.0.1, nie auf allen
      Adressen.

    EIN ANDERER WEG
    Apache macht dasselbe (VirtualHost, a2ensite); Caddy auch, mit
    automatischem HTTPS. Vor Containern entdeckt Traefik die Apps von
    selbst. nginx ist vor einer App immer noch am weitesten verbreitet,
    und seine Konfiguration liest sich leicht.

    DOKUMENTATION
    - Wie nginx eine Website wählt: https://nginx.org/en/docs/http/request_processing.html
    - server_name: https://nginx.org/en/docs/http/server_names.html
    - proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
