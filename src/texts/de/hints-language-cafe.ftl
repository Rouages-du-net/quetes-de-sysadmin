### Abgestufte Hinweise für „Das Sprachcafé“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Neue Nachbarschaft

hint-new-neighbour-rocky =
    .lead = Bevor du die Befehle von Debian tippst, frag die Maschine, was sie ist: Eine Datei in /etc sagt es, und Seuns Notizen auch.
    .solution = cat /etc/os-release; cat notizen_von_seun.txt
hint-new-neighbour-installed =
    .lead = In der Red-Hat-Familie heißt das Paket von Apache httpd, und der Paketmanager ist dnf (man dnf: search, info, install).
    .solution = dnf search httpd; sudo dnf install httpd (mit y antworten)
hint-new-neighbour-running =
    .lead = Starte den Dienst, und lass ihn bei jedem Booten starten, in einem einzigen systemctl-Befehl.
    .solution = sudo systemctl enable --now httpd; systemctl status httpd
hint-new-neighbour-blocked =
    .lead = Teste von dort, wo die Nutzer·innen sind: von der Pinnwand. Wenn kessel ablehnt, schau dir an, was die Zone von firewalld erlaubt (man firewall-cmd).
    .solution = ssh pinnwand, dann curl -I http://www.commontongue.example/; auf kessel: sudo firewall-cmd --list-all
hint-new-neighbour-runtime-only =
    .lead = Ein firewalld-Dienst wird über seinen Namen erlaubt (http, https), in der Laufzeitkonfiguration und in der permanenten.
    .solution = sudo firewall-cmd --add-service=http --add-service=https; sudo firewall-cmd --permanent --add-service=http --add-service=https
hint-new-neighbour-permanent-only =
    .lead = Ist, was du erlaubt hast, jetzt aktiv, und nach einem reload noch da? Vergleiche beide Konfigurationen.
    .solution = sudo firewall-cmd --list-all; sudo firewall-cmd --permanent --list-all; sudo firewall-cmd --reload
hint-new-neighbour-reached =
    .lead = Prüf von der Pinnwand aus, dass httpd antwortet.
    .solution = ssh pinnwand; curl http://www.commontongue.example/ | head
hint-new-neighbour-end =
    .lead = httpd installiert, laufend und aktiviert; http und https zur Laufzeit und permanent erlaubt; SELinux enforcing; die Pinnwand bekommt eine Antwort.
    .solution = systemctl is-enabled httpd; sudo firewall-cmd --permanent --list-services; sudo firewall-cmd --list-services; getenforce

## Kapitel 2 — Keine Berechtigung, aber…

hint-wrong-label-test-page =
    .lead = Frag die Website selbst ab, dann lies das Fehler-Log von httpd: welche Datei, und welcher Fehler?
    .solution = curl -I http://localhost/; sudo tail /var/log/httpd/error_log
hint-wrong-label-error-log =
    .lead = Die Unix-Rechte stimmen. Vergleiche die SELinux-Labels der Dateien der Website mit denen von /var/www/html (man ls: -Z).
    .solution = ls -lZ /srv/site; ls -Zd /var/www/html; ps -eZ | grep httpd
hint-wrong-label-labels =
    .lead = Wer hat verweigert, und was genau? Das Audit-Log bewahrt die Verweigerungen von SELinux auf (man ausearch).
    .solution = sudo ausearch -m avc -ts recent
hint-wrong-label-avc =
    .lead = Frag nach dem Warum: audit2why erklärt eine Verweigerung. Wenn bash es nicht kennt, finde sein Paket mit dnf.
    .solution = sudo ausearch -m avc -ts recent | audit2why
hint-wrong-label-tools-missing =
    .lead = Welches Paket enthält den Befehl semanage? dnf kann nach Dateien suchen (man dnf: provides).
    .solution = dnf provides semanage; sudo dnf install policycoreutils-python-utils
hint-wrong-label-tools =
    .lead = Welches Label gibt die Policy /srv/site, und /var/www? semanage listet die Dateikontexte.
    .solution = sudo semanage fcontext -l | grep -E '^/srv|^/var/www'
hint-wrong-label-rule =
    .lead = Bring der Policy bei, dass /srv/site und alles darin Webinhalt ist (man semanage-fcontext), dann wende es auf die Dateien an.
    .solution = sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"; sudo restorecon -Rv /srv/site
hint-wrong-label-relabelled =
    .lead = Hat das Relabel zurückgesetzt, was du von Hand gesetzt hast? Eine Regel in der Policy ist, was es übersteht.
    .solution = ls -Z /srv/site; sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"; sudo restorecon -Rv /srv/site
hint-wrong-label-end =
    .lead = SELinux enforcing; die Website und ihr Stylesheet an die Pinnwand ausgeliefert; Labels aus der Policy (restorecon -Rnv ändert nichts); kein 777, kein Modul, kein Home-Boolean.
    .solution = getenforce; restorecon -Rnv /srv/site; sudo semanage fcontext -l -C; ssh pinnwand, dann curl http://www.commontongue.example/css/style.css

## Kapitel 3 — Ein Port und ein Boolean

hint-port-and-boolean-down =
    .lead = Warum startet httpd nicht? Der Status seiner Unit und das Journal sagen es.
    .solution = systemctl status httpd; sudo journalctl -u httpd | tail
hint-port-and-boolean-bind-avc =
    .lead = Sonst lauscht nichts auf 8010 (ss -tlnp): Such nach der Verweigerung von SELinux, dann nach den Ports, die die Policy httpd benutzen lässt.
    .solution = sudo ausearch -m avc -c httpd; sudo semanage port -l | grep http_port_t
hint-port-and-boolean-port =
    .lead = Gib 8010 den Typ eines Web-Ports (man semanage-port), dann starte httpd noch einmal.
    .solution = sudo semanage port -a -t http_port_t -p tcp 8010; sudo systemctl restart httpd
hint-port-and-boolean-up =
    .lead = Teste die zwei neuen Dinge: die Anmeldeseite über ihren Namen, den Dienstplan aus dem Netz des Cafés.
    .solution = curl -H 'Host: signup.commontongue.example' http://localhost/; ssh pinnwand, dann curl http://kessel:8010/
hint-port-and-boolean-proxy-503 =
    .lead = Die App antwortet auf ihrem eigenen Port; httpd erreicht sie nicht. Such nach der Verweigerung.
    .solution = curl http://127.0.0.1:8086/; sudo ausearch -m avc -ts recent | audit2why
hint-port-and-boolean-connect-avc =
    .lead = Ein Boolean lässt httpd sich mit anderen Ports verbinden (getsebool -a | grep httpd); setz ihn so, dass er einen Neustart übersteht.
    .solution = sudo setsebool -P httpd_can_network_connect on
hint-port-and-boolean-boolean =
    .lead = Jetzt der Dienstplan: Nur das Netz des Cafés (198.51.100.0/24) soll Port 8010 erreichen (man firewall-cmd: rich rules), zur Laufzeit und permanent.
    .solution = sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="198.51.100.0/24" port port="8010" protocol="tcp" accept'; sudo firewall-cmd --reload
hint-port-and-boolean-rota-office =
    .lead = Ist die Regel in beiden Konfigurationen, und öffnet nichts 8010 für alle?
    .solution = sudo firewall-cmd --list-rich-rules; sudo firewall-cmd --permanent --list-all
hint-port-and-boolean-end =
    .lead = httpd läuft und ist aktiviert; Website und Anmeldung für alle, der Dienstplan nur für das Café; httpd_can_network_connect mit -P; kein nis_enabled, kein Modul; SELinux enforcing.
    .solution = getsebool httpd_can_network_connect nis_enabled; sudo semanage boolean -l -C; sudo semodule -l | grep httpd; sudo firewall-cmd --permanent --list-all
