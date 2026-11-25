### Geschichte „Die Nachbarschaftsbriefe“, Kapitel 9 „Das Repair-Café“:
### Apache hinter nginx (Ports, virtuelle Hosts, .htaccess, mod_rewrite).
### Befehle, Pfade, Direktiven und Meldungen von Apache werden nicht übersetzt.

chapter-repair-cafe = Das Repair-Café
    .summary = Die Website des Repair-Cafés läuft mit Apache und einer .htaccess: Bring sie hinter nginx zum Laufen, auf demselben Server.

## Dateien

repair-cafe-email-kofi =
    Von:     Kofi
    An:      dich
    Betreff: Das Repair-Café

    Hallo!

    Der alte Hoster des Repair-Cafés macht Ende des Monats zu. Ich habe
    angeboten, ihre Website auf unseren Server zu nehmen: Das DNS von
    repair.example zeigt schon hierher.

    Ihre Website lief mit Apache, mit einer Datei .htaccess, die die kurzen
    Adressen ihrer Anleitungen funktionieren lässt:
    http://repair.example/guide/42 führt zur Anleitung 42. Diese Adressen
    sind als QR-Codes auf alle Plakate des Cafés gedruckt: Sie müssen
    weiter funktionieren.

    Statt gleich alles für nginx umzuschreiben, behalten wir Apache, hinter
    nginx: nginx bleibt allein auf Port 80, für alle Websites, und reicht
    die Besuche des Cafés an Apache weiter. Rania hat gestern Abend
    angefangen, lies ihre Notiz (notiz_von_rania.txt).

    Was wir brauchen:
    - Apache läuft und startet mit der Maschine wieder; aber es lauscht
      nur auf 127.0.0.1 (Port 8080), wie der Kalender: Niemand soll es
      erreichen, ohne über nginx zu gehen;
    - http://repair.example/ zeigt die Startseite des Cafés, und
      http://repair.example/guide/42 zeigt die Anleitung 42;
    - die Briefe und das Café bleiben online.

    Danke!
    Kofi

repair-cafe-note-rania =
    Ich habe gestern Abend sudo apt install apache2 ausgeführt. Am Ende hat
    apt „Job for apache2.service failed“ angezeigt, und ich hatte keine
    Zeit nachzusehen, warum (systemctl status apache2, journalctl -u apache2…).

    Ich habe die Website nach /var/www/repair kopiert, mit ihrer .htaccess
    (die versteckte Datei, die die Adressen /guide/… funktionieren lässt),
    und die Apache-Konfiguration des alten Hosters nach
    /etc/apache2/sites-available/repair.conf. Aktiviert habe ich sie wie
    bei nginx, mit einem Link in sites-enabled.

    Auf der Seite von nginx ist die Website fertig in
    /etc/nginx/sites-available/repair, noch nicht aktiviert: Sie reicht
    alles an 127.0.0.1:8080 weiter.

    Unter Debian wird Apache in /etc/apache2 konfiguriert: ports.conf für
    die Ports, sites-available und sites-enabled wie bei nginx, aber mit
    eigenen Werkzeugen (man a2ensite, man a2enmod, man apache2ctl).

    Rania

repair-cafe-htaccess-comment =
    # Kurze Adressen der Anleitungen, auf die Plakate gedruckt:
    # /guide/42 führt zu guides/42.html

repair-cafe-site-welcome =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Das Repair-Café</title></head>
    <body>
    <h1>Das Repair-Café</h1>
    <p>Jeden Samstag reparieren wir gemeinsam: Fahrräder, Toaster, Kleidung.</p>
    <p>Anleitungen: <a href="/guide/7">7, einen Schlauch wechseln</a>, <a href="/guide/42">42, einen Wasserkocher entkalken</a>.</p>
    </body>
    </html>

repair-cafe-sheet-7 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Anleitung 7: einen Schlauch wechseln</title></head>
    <body>
    <h1>Anleitung 7: einen Schlauch wechseln</h1>
    <p>Das Rad ausbauen, den Reifen mit zwei Reifenhebern abhebeln, das Loch in einer Schüssel Wasser suchen.</p>
    </body>
    </html>

repair-cafe-sheet-42 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Anleitung 42: einen Wasserkocher entkalken</title></head>
    <body>
    <h1>Anleitung 42: einen Wasserkocher entkalken</h1>
    <p>Halb Essig, halb Wasser: aufkochen, eine Stunde stehen lassen, dreimal ausspülen.</p>
    </body>
    </html>

## Ereignisse

repair-cafe-event-busy =
    „Address already in use“: Apache will auf Port 80 lauschen (Listen 80,
    in /etc/apache2/ports.conf), aber dort ist schon nginx, für alle
    Websites. Zwei Programme können nicht auf demselben Port derselben
    Adresse lauschen: sudo ss -tlnp zeigt, wer wo lauscht. Hier behält
    nginx Port 80; Apache geht auf 127.0.0.1:8080, wo die von Rania
    vorbereitete nginx-Website es erwartet.
repair-cafe-event-ah00558 =
    „AH00558“ ist nur eine Warnung: Apache kennt keinen vollständigen Namen
    für die Maschine und benutzt ihre Adresse. Eine globale Zeile
    ServerName bringt sie zum Schweigen (zum Beispiel ServerName localhost
    in /etc/apache2/conf-available/servername.conf, dann sudo a2enconf
    servername). Das ist nicht der Grund, warum Apache nicht startet.
repair-cafe-event-listening =
    Apache läuft! sudo ss -tlnp zeigt es, mit seinen Adressen. Prüfe, ob es
    das Café ausliefert, mit dem Namen der Website:
    curl -H "Host: repair.example" http://127.0.0.1:8080/
repair-cafe-event-everywhere =
    Vorsicht: Apache lauscht auf allen Adressen der Maschine (ein Listen
    nur mit dem Port). Heute schützt es die Firewall, aber Rania will, dass
    es nur auf 127.0.0.1 lauscht, wie der Kalender: Nur nginx soll es
    erreichen können. Listen 127.0.0.1:8080, in ports.conf.
repair-cafe-event-default =
    Das ist die Standardseite von Apache (/var/www/html), nicht die des
    Cafés. Für eine Anfrage behält Apache zuerst die VirtualHosts, die zur
    Adresse und zum Port passen, dann den, dessen ServerName zum
    angefragten Namen passt (Header Host); passt keiner, nimmt es den
    zuerst gelesenen, oder seine Hauptkonfiguration. sudo apache2ctl -S
    zeigt, wer wo antwortet. Wird die Website des Cafés überhaupt gelesen
    (eine Datei in sites-enabled, die auf .conf endet)? Ist ihr
    VirtualHost auf dem richtigen Port? Und über nginx: Welchen Namen
    reicht nginx an Apache weiter?
repair-cafe-event-site =
    Apache liefert die Startseite des Cafés auf dem Loopback aus. Jetzt
    veröffentliche sie: nginx, davor, muss ihm die Besuche für
    repair.example weiterreichen.
repair-cafe-event-gateway =
    502: nginx erreicht Apache nicht (in /var/log/nginx/error.log:
    „connect() failed“). Läuft Apache, und auf dem Port, wo nginx es
    erwartet (proxy_pass http://127.0.0.1:8080)?
repair-cafe-event-proxy =
    http://repair.example/ zeigt die Startseite des Cafés: nginx, dann
    Apache. Probier jetzt eine Adresse von den Plakaten:
    curl http://repair.example/guide/42
repair-cafe-event-ignore =
    404 bei /guide/…: Apache sucht die Datei /var/www/repair/guide/42, die
    es nicht gibt. Die Regel, die diese Adresse umwandelt, steht in
    /var/www/repair/.htaccess… aber Apache liest .htaccess-Dateien nur,
    wenn AllowOverride es erlaubt, und apache2.conf sagt AllowOverride None
    für /var/www. Erlaube es nur für diese Website, in einem Abschnitt
    <Directory /var/www/repair> ihres VirtualHost.
repair-cafe-event-internal =
    500 Internal Server Error: Apache hat die .htaccess gelesen, aber etwas
    stimmt nicht. Der Grund steht im Fehlerlog der Website:
    sudo tail /var/log/apache2/repair-error.log
repair-cafe-event-rewrite =
    /guide/42 führt zur Anleitung 42: Die Regel der .htaccess (RewriteRule)
    hat die Adresse in guides/42.html umgewandelt. Apache liest die Datei
    bei jedem Besuch neu: Wenn du sie änderst, ist nichts neu zu laden.
repair-cafe-event-end =
    Die Adressen der Plakate funktionieren, über nginx und dann Apache.
    Rania: „Die QR-Codes des Cafés führen wieder zu den richtigen Anleitungen!“

    Gut gemacht! Du hast das Kapitel „Das Repair-Café“ abgeschlossen.

    WAS PASSIERT IST
    Apache wollte nicht starten: nginx hielt Port 80. Es lauscht jetzt auf
    127.0.0.1:8080 (Listen in ports.conf, und der Port des VirtualHost),
    und nginx reicht ihm die Besuche für repair.example weiter. Die
    Website wurde nicht gelesen: Apache nimmt aus sites-enabled nur
    Dateien, die auf .conf enden, wie a2ensite sie anlegt. Die kurzen
    Adressen laufen über die .htaccess, die Apache nur mit AllowOverride
    liest, und deren RewriteRule das Modul rewrite braucht (a2enmod).

    NGINX UND APACHE, NEBENEINANDER
      nginx                        Apache (Debian)
      sites-enabled, ln -s         sites-enabled, a2ensite (.conf)
      nginx -t                     apache2ctl configtest, apache2ctl -S
      listen, server_name, root    Listen, VirtualHost, ServerName, DocumentRoot
      location                     Directory, Location
      rewrite, try_files           RewriteRule (a2enmod rewrite)
      keine .htaccess              .htaccess, wenn AllowOverride

    GUTE PRAXIS
    - Ein Programm pro Port: ein Webserver vorne (Reverse Proxy), die
      anderen dahinter, auf 127.0.0.1.
    - apache2ctl configtest vor dem Neuladen; apache2ctl -S, um zu wissen,
      welcher VirtualHost auf welchen Namen antwortet.
    - Hinter einem Proxy den angefragten Namen weiterreichen
      (proxy_set_header Host $host; in nginx), sonst liefert Apache seine
      Standard-Website aus.
    - .htaccess-Dateien helfen, wenn man keinen Zugriff auf die
      Konfiguration hat (Shared Hosting), aber Apache liest sie bei jedem
      Besuch neu. Auf dem eigenen Server stehen dieselben Regeln besser im
      VirtualHost, mit AllowOverride None.

    DOKUMENTATION
    - Wie der virtuelle Host gewählt wird: https://httpd.apache.org/docs/2.4/vhosts/details.html
    - .htaccess-Dateien: https://httpd.apache.org/docs/2.4/howto/htaccess.html
    - mod_rewrite: https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html
    - proxy_set_header (nginx): https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
