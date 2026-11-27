### Die gestuften Hinweise von „Die Wache“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, mit .lead (eine Richtung, ohne den genauen
### Befehl) und .solution (fast die Antwort: der Befehl, mit dem, was er
### tut). Die Ortsnamen sind die von names.ftl.

## Kapitel 1 — Das Bulletin

hint-bulletin-read =
    .lead = Das Bulletin dieser Woche liegt in deinem Verzeichnis. Prüf für jede CVE, ob das Paket hier überhaupt installiert ist, und in welcher Version (man apt, die Option list).
    .solution = cat sicherheitsbulletin.txt, dann apt list --installed, um zu sehen, was auf diesem Server installiert ist, und in welcher Version.
hint-bulletin-sort =
    .lead = Schreib deine Sortierung in beobachtung.md: Ist certbot überhaupt auf diesem Server? Ist curl schon jenseits der korrigierten Version des Bulletins?
    .solution = sudo nano beobachtung.md: unter „Nicht zutreffend“ certbot (nicht installiert) und curl (schon aktuell); unter „Betrifft diesen Server“ nginx, rsync und openssh-server.
hint-bulletin-end =
    .lead = Prüf, dass deine Sortierung nichts durcheinanderbringt: Nur nginx, rsync und openssh-server gehören unter „Betrifft diesen Server“.
    .solution = Lies beobachtung.md ganz durch: nichts zu certbot oder curl unter „Betrifft diesen Server“, nichts zu nginx oder rsync unter „Nicht zutreffend“.

## Kapitel 2 — Die Priorität

hint-priority-expose =
    .lead = Bevor du ordnest, schau dir an, was auf diesem Server tatsächlich lauscht, und was gar keinen Port hat (man ss, man nmap).
    .solution = ss -tlnp (oder nmap -sV kneter.internal): 80 und 443 antworten jeder Adresse, für rsync lauscht nichts.
hint-priority-order =
    .lead = Der Wert von rsync ist höher, aber ein Wert misst, wie schlimm es wird, WENN der Dienst erreicht wird, nicht wie leicht er zu erreichen ist. Schreib deine Entscheidung in prioritaet.md, mit dem Warum.
    .solution = sudo nano prioritaet.md: nginx zuerst (aus dem Internet erreichbar, 80/443), rsync danach (höherer Wert, aber kein lauschender Port); und ein Wort zu openssh-server (schon geschützt, KbdInteractiveAuthentication auf no).
hint-priority-end =
    .lead = Prüf, dass dein Text sagt, WARUM, nicht nur die Reihenfolge: Was macht nginx erreichbar, was hält rsync davon ab, erreichbar zu sein?
    .solution = Lies prioritaet.md noch einmal: Der Grund für die Reihenfolge muss die Exposition nennen (Internet, Port), nicht nur den Wert.

## Kapitel 3 — Die Korrektur

hint-fix-fixed =
    .lead = apt upgrade installiert die verfügbaren Korrekturen, aber nur die, die apt kennt: Frisch zuerst die Paketliste auf (man apt).
    .solution = sudo apt update, dann sudo apt upgrade (beide Korrekturen, nginx und rsync, werden zusammen installiert).
hint-fix-checked =
    .lead = Bevor es weitergeht: Antwortet die Website noch? (man curl)
    .solution = curl -I http://baeckerei.example/ (Code 200 erwartet).
hint-fix-end =
    .lead = Beide Pakete müssen die korrigierte Version des Bulletins haben, und die Website muss noch antworten.
    .solution = apt list --installed | grep -E 'nginx|rsync', um die Versionen zu prüfen, dann curl -I http://baeckerei.example/.

## Kapitel 4 — Ohne Beweis keine Gewissheit

hint-proof-versions =
    .lead = Eine Korrektur beweist man erneut: Frag apt, was noch zu aktualisieren bleibt (man apt).
    .solution = apt list --upgradable (für nginx und rsync sollte nichts mehr erscheinen).
hint-proof-found =
    .lead = Das Access-Log von nginx hält jede Anfrage fest. Die Schwachstelle von nginx lag in HTTP/2: Such eine Anfrage dieser Art (man grep).
    .solution = grep "HTTP/2" /var/log/nginx/access.log (eine Zeile mit Code 400, ohne angegebenen Browser, ein paar Tage vor der Korrektur).
hint-proof-end =
    .lead = Du brauchst zwei Dinge: den Beweis, dass die Pakete aktuell sind, und das Access-Log auf einen früheren Versuch durchgesehen zu haben.
    .solution = apt list --upgradable (leer), dann grep "HTTP/2" /var/log/nginx/access.log.

## Kapitel 5 — Eine Routine einrichten

hint-routine-active =
    .lead = unattended-upgrades ist installiert, aber ausgeschaltet: Schau dir /etc/apt/apt.conf.d/20auto-upgrades an (man apt.conf).
    .solution = sudo nano /etc/apt/apt.conf.d/20auto-upgrades: beide Zeilen auf „1“ setzen.
hint-routine-security =
    .lead = In /etc/apt/apt.conf.d/50unattended-upgrades erlaubt eine Zeile Origins-Pattern ALLE Updates, nicht nur security; und Unattended-Upgrade::Mail ist auskommentiert.
    .solution = sudo nano /etc/apt/apt.conf.d/50unattended-upgrades: die Zeile „label=Debian“ (ohne -Security) auskommentieren, beide Zeilen „label=Debian-Security“ behalten, und Unattended-Upgrade::Mail mit einer Adresse einkommentieren (z. B. „root“).
hint-routine-periodic =
    .lead = Du brauchst einen wöchentlichen Termin, der einen Neustart übersteht: einen systemd-Timer in /etc/systemd/system, oder eine cron-Aufgabe, die sich die ausstehenden Updates ansieht und dir das Ergebnis mailt (man systemd.timer, man crontab).
    .solution = Ein Timer: sudo nano /etc/systemd/system/watch.service (ExecStart=/bin/sh -c "apt list --upgradable | mail -s Watch root") und /etc/systemd/system/watch.timer (OnCalendar=weekly), dann sudo systemctl daemon-reload && sudo systemctl enable --now watch.timer. Oder eine cron-Aufgabe: sudo crontab -e, eine wöchentliche Zeile, die dasselbe tut.
hint-routine-end =
    .lead = Drei Dinge zu prüfen: beide Aufgaben von 20auto-upgrades eingeschaltet, 50unattended-upgrades auf security beschränkt mit Bericht, und ein aktiver periodischer Termin.
    .solution = sudo apt-config dump | grep Periodic, cat /etc/apt/apt.conf.d/50unattended-upgrades, systemctl list-timers (oder crontab -l).
