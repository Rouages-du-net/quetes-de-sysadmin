### Abgestufte Hinweise für „Die Nachbarschaftsbriefe“ (siehe
### src/engine/hints.ts): eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>,
### mit .lead (eine Spur, ohne den genauen Befehl) und .solution (fast die
### Antwort). Ortsnamen wie in names.ftl.

## Kapitel 1 — Tür zu

hint-shut-the-door-closed =
    .lead = Zwei Optionen in /etc/ssh/sshd_config (man sshd_config): PermitRootLogin und PasswordAuthentication. Aber schau dir die Zeile Include ganz oben an: Bei sshd gewinnt der erste gelesene Wert. sshd -t prüft, dann muss der Dienst neu geladen werden.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no; in /etc/ssh/sshd_config.d/50-cloud-init.conf: PasswordAuthentication no. Dann sudo sshd -t und sudo systemctl reload ssh (sudo sshd -T zeigt die geltenden Werte).
hint-shut-the-door-end =
    .lead = Die Tür ist zu; beweise jetzt, dass du noch hereinkommst. Eine schon offene Sitzung beweist nichts: Du brauchst eine neue.
    .solution = exit, dann von deinem Rechner aus: ssh briefe (und ssh root@briefe muss abgewiesen werden).

## Kapitel 2 — Die Firewall

hint-firewall-listening =
    .lead = Bevor du Türen schließt, schau nach, welche Programme auf welchen Ports lauschen, auf dem Server selbst (man ss).
    .solution = ss -tlnp (lauschende TCP-Sockets, als Zahlen; 3306 ist MariaDB).
hint-firewall-filter =
    .lead = Einmal aktiviert, weist ufw eingehenden Verkehr standardmäßig ab; erlaube einfach, was offen bleiben muss (SSH, http, https), BEVOR du es aktivierst (man ufw, ufw app list).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", dann sudo ufw enable (und sudo ufw status verbose zum Prüfen).
hint-firewall-end =
    .lead = Die Firewall filtert; beweise, dass SSH noch durchkommt, mit einer neuen Verbindung von deinem Rechner aus.
    .solution = exit, dann ssh briefe.

## Kapitel 3 — Der Wächter

hint-sentinel-rania =
    .lead = Rania (198.51.100.40) steckt im Jail sshd von fail2ban. fail2ban-client kann den Status eines Jails zeigen und eine Sperre aufheben.
    .solution = sudo fail2ban-client status sshd, dann sudo fail2ban-client set sshd unbanip 198.51.100.40
hint-sentinel-set =
    .lead = Lass jail.conf in Ruhe: Einstellungen gehören in /etc/fail2ban/jail.local (man jail.conf). Du brauchst eine bantime von mindestens einer Stunde und ignoreip für Rania und für deinen Rechner (seine Adresse steht in journalctl -u ssh). Dann fail2ban neu laden.
    .solution = sudo nano /etc/fail2ban/jail.local: [DEFAULT], bantime = 1h, ignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40; dann sudo fail2ban-client -t und sudo systemctl reload fail2ban
hint-sentinel-end =
    .lead = Prüfe nach dem Neuladen den Status des Jails: die Bots gesperrt, weder Rania noch du.
    .solution = sudo fail2ban-client status sshd

## Kapitel 4 — Eine Wohngemeinschaft

hint-sharing-cafe =
    .lead = Unter Debian ist eine nginx-Website = eine Datei in /etc/nginx/sites-available, aktiviert durch einen symbolischen Link in sites-enabled (siehe notiz_von_rania.txt). Die Website des Cafés hat ihren eigenen server_name und ihre Wurzel /var/www/cafe, ohne default_server.
    .solution = sudo cp /etc/nginx/sites-available/letters /etc/nginx/sites-available/cafe, darin letters durch cafe ersetzen und default_server entfernen (sudo nano), dann sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/, sudo nginx -t und sudo systemctl reload nginx
hint-sharing-end =
    .lead = Der Kalender lauscht auf 127.0.0.1:3000, und seine Seiten beginnen bei /: nginx muss ihm /agenda/ weiterreichen und dabei dieses Präfix entfernen (proxy_pass, und der Schrägstrich am Ende). Und der Dienst agenda muss laufen, auch nach einem Neustart (man systemctl).
    .solution = In /etc/nginx/sites-available/letters: location /agenda/ {"{"} proxy_pass http://127.0.0.1:3000/; {"}"}; sudo nginx -t, sudo systemctl reload nginx, dann sudo systemctl enable --now agenda

## Kapitel 5 — Bei mir geht's

hint-works-for-me-end =
    .lead = /etc/hosts zählt nur für eine Maschine: Die Zone cafe.example muss korrigiert werden (/etc/bind/zones/db.cafe.example, siehe hilfe_dns.txt). Neue Adresse, ein www, eine höhere Seriennummer, damit ns2 die Zone neu kopiert, und der Punkt am Ende vollständiger Namen. Dann schauen, was die Gäste sehen: der öffentliche Resolver (dig ohne @).
    .solution = sudo nano /etc/bind/zones/db.cafe.example: 203.0.113.10 statt 198.51.100.80, serial 2027032001, und die Zeile www IN CNAME cafe.example. (mit dem Punkt); dann named-checkzone cafe.example /etc/bind/zones/db.cafe.example und sudo rndc reload; zuletzt dig cafe.example (der Resolver: die alte Adresse, ihre TTL)

## Kapitel 6 — Konzertabend

hint-concert-robot =
    .lead = Wer fragt was an? Das Zugriffslog von nginx hat eine Zeile pro Anfrage; awk zerlegt sie in Felder (die Adresse ist das erste, siehe hilfe_logs.txt), sort und uniq -c zählen sie.
    .solution = awk '{"{"}print $1{"}"}' /var/log/nginx/access.log | sort | uniq -c | sort -n (drei Adressen in 198.51.100.x dominieren).
hint-concert-end =
    .lead = Adressen zu sperren hält nicht: Begrenze die Rate pro Adresse (limit_req_zone im http-Kontext, limit_req in der location des Kalenders). Ein Browser fragt eine Seite und ihre vier Dateien auf einmal an: Ohne Burst werden auch echte Besucher abgewiesen.
    .solution = Oben in /etc/nginx/sites-available/letters: limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s; und in location /agenda/: limit_req zone=agenda burst=10 nodelay; dann sudo nginx -t und sudo systemctl reload nginx

## Kapitel 7 — Der Port

hint-port-two-ports =
    .lead = Öffne die neue Tür, ohne die alte zu schließen: sshd kann auf mehreren Ports lauschen (mehrere Zeilen Port, man sshd_config), und die Firewall muss den neuen durchlassen.
    .solution = In /etc/ssh/sshd_config: Port 22 und Port 2222; dann sudo sshd -t, sudo ufw allow 2222/tcp und sudo systemctl reload ssh
hint-port-attempt =
    .lead = Teste die neue Tür von deinem Rechner aus. Damit ssh briefe von selbst dorthin geht, hat die ~/.ssh/config des Rechners eine Option Port (man ssh_config).
    .solution = exit, dann auf dem Rechner: nano ~/.ssh/config, Port 2222 unter Host briefe ergänzen, und ssh briefe (den Schlüssel des Servers auf diesem Port akzeptieren: yes).
hint-port-end =
    .lead = Die neue Tür funktioniert: Schließ die alte, in sshd und in ufw. Dann fail2ban: Sein Jail sshd überwacht noch den Port „ssh“ (22). Ein Port in [DEFAULT] reicht nicht, es braucht den eigenen Abschnitt des Jails.
    .solution = Port 22 aus sshd_config entfernen, sudo systemctl reload ssh, sudo ufw delete allow OpenSSH; in /etc/fail2ban/jail.local [sshd] port = 2222, dann sudo systemctl reload fail2ban

## Kapitel 8 — Wiederholungstäter

hint-repeat-offenders-repeat-offence =
    .lead = jail.conf beschreibt ein Jail recidive, deaktiviert: Es liest fail2ban.log und sperrt Adressen, die schon mehrmals gesperrt wurden, für lange Zeit. Aktiviere es in seinem eigenen Abschnitt von jail.local, nicht in [DEFAULT].
    .solution = In /etc/fail2ban/jail.local ergänzen: [recidive], dann enabled = true; sudo fail2ban-client -t und sudo systemctl reload fail2ban
hint-repeat-offenders-agenda =
    .lead = Der Bot des Kalenders füllt /var/log/nginx/error.log mit „limiting requests“. Ein Jail in jail.conf liest genau diese Zeilen: Such nach den nginx-Jails (grep "^\[" /etc/fail2ban/jail.conf).
    .solution = In /etc/fail2ban/jail.local ergänzen: [nginx-limit-req], dann enabled = true; sudo systemctl reload fail2ban
hint-repeat-offenders-end =
    .lead = Die Jails sind geladen: Prüfe, wen sie sperren (die Wiederholungstäter und den Bot, aber weder Rania noch die Besucher).
    .solution = sudo fail2ban-client status, dann sudo fail2ban-client status recidive und sudo fail2ban-client status nginx-limit-req

## Kapitel 9 — Das Repair-Café

hint-repair-cafe-busy =
    .lead = apt hat „Job for apache2.service failed“ gesagt. systemctl status apache2 und journalctl -u apache2 sagen, warum; sudo ss -tlnp zeigt, wer auf welchem Port lauscht.
    .solution = journalctl -u apache2: „Address already in use“ auf Port 80; sudo ss -tlnp: nginx hält ihn.
hint-repair-cafe-listening =
    .lead = Die Ports von Apache stehen in /etc/apache2/ports.conf (Listen). Rania erwartet es auf 127.0.0.1:8080, wie den Kalender. Dann den Dienst starten.
    .solution = sudo nano /etc/apache2/ports.conf: Listen 127.0.0.1:8080 statt Listen 80; sudo apache2ctl configtest; sudo systemctl restart apache2
hint-repair-cafe-site =
    .lead = sudo apache2ctl -S listet die Websites, die Apache gelesen hat: Ist die des Cafés dabei? Apache liest aus sites-enabled nur Dateien, die auf .conf enden (man a2ensite). Und der VirtualHost der Website muss auf dem Port sein, auf dem Apache lauscht.
    .solution = sudo a2ensite repair; in /etc/apache2/sites-available/repair.conf <VirtualHost 127.0.0.1:8080> (oder *:8080); sudo apache2ctl configtest; sudo systemctl reload apache2; curl -H "Host: repair.example" http://127.0.0.1:8080/
hint-repair-cafe-proxy =
    .lead = Die nginx-Website des Cafés ist fertig in /etc/nginx/sites-available/repair, aber nicht aktiviert (wie die des Cafés in „Eine Wohngemeinschaft“).
    .solution = sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/; sudo nginx -t; sudo systemctl reload nginx; curl http://repair.example/
hint-repair-cafe-rewrite =
    .lead = /guide/42 ist keine Datei: Eine Regel in der .htaccess von /var/www/repair wandelt die Adresse um. Apache liest .htaccess-Dateien nur, wenn AllowOverride es erlaubt (man apache2ctl), und RewriteRule kommt aus einem Modul (man a2enmod). Das Fehlerlog der Website sagt, was nicht stimmt.
    .solution = Im VirtualHost von repair.conf: <Directory /var/www/repair>, AllowOverride All, </Directory> (drei Zeilen); sudo a2enmod rewrite; sudo apache2ctl configtest; sudo systemctl restart apache2; curl http://repair.example/guide/42
hint-repair-cafe-end =
    .lead = Prüfe alles: Apache beim Start aktiviert und nur auf 127.0.0.1, http://repair.example/ und /guide/42 über nginx, letters.example unversehrt.
    .solution = systemctl is-enabled apache2; sudo ss -tlnp; curl http://repair.example/guide/42; curl http://letters.example/
