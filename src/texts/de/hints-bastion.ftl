### Abgestufte Hinweise für Die Bastion (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung,
### ohne den genauen Befehl) und .solution (fast die Antwort: der Befehl,
### mit dem, was er tut).

## Kapitel 1 — Der Alarm

hint-alarm-process =
    .lead = Etwas belegt den Prozessor: Schau dir an, was läuft, unter welchem Konto, aus welchem Verzeichnis (man ps, man top).
    .solution = ps aux (oder top): ein „kworkerd“ mit fast 200 % CPU, im Besitz von deploy, aus /tmp/.cache gestartet.
hint-alarm-connection =
    .lead = Der Hoster nennt eine Adresse und einen Port: Finde, welches Programm diese Verbindung hält (man ss oder man netstat). Die Prozessspalte braucht root.
    .solution = sudo ss -tnp (oder sudo netstat -tnp): kworkerd, verbunden mit 198.51.100.66:3333.
hint-alarm-entry =
    .lead = Wie ist jemand hereingekommen? Das Log von ssh hält jeden Versuch und jedes Login fest (man journalctl); last listet die Sitzungen.
    .solution = sudo journalctl -u ssh | grep deploy: falsche Passwörter, dann „Accepted password for deploy from 203.0.113.66“ um 02:40:57.
hint-alarm-end =
    .lead = Ergänze incident.md: das Programm und sein Verzeichnis, die Adresse des Pools, das Konto, die Adresse des Eindringlings und die Uhrzeit des Logins.
    .solution = nano incident.md: /tmp/.cache/kworkerd (deploy), 198.51.100.66 Port 3333, deploy per Passwort von 203.0.113.66 um 02:40.

## Kapitel 2 — Eindämmung

hint-containment-pool =
    .lead = Hindere den Miner daran, den Pool zu erreichen: eine Firewall-Regel für das, was die Maschine verlässt (man iptables, die Kette OUTPUT).
    .solution = sudo iptables -A OUTPUT -d 198.51.100.66 -j DROP
hint-containment-attacker =
    .lead = Schließ die Tür für die Adresse, von der jemand kam: eine Regel für das, was hereinkommt (INPUT, nach Quelle). Denk an dein eigenes ssh.
    .solution = sudo iptables -A INPUT -s 203.0.113.66 -j DROP (ein Anhängen berührt deinen eigenen Zugang nicht; prüfe mit sudo iptables -L -n).
hint-containment-stopped =
    .lead = Der Miner kommt wieder, wenn du ihn stoppst: Etwas wacht über ihn. Schau dir seinen Elternprozess an (ps -ef, die Spalte PPID) und stoppe den zuerst (man kill).
    .solution = sudo kill 4410 (der Wachhund, /bin/sh /tmp/.cache/.w), dann sudo kill auf die PID von kworkerd (oder sudo killall kworkerd, sobald der Wachhund weg ist).
hint-containment-closed =
    .lead = Schließ deploy endgültig, Schlüssel inklusive: man usermod sagt, was -L nicht abdeckt.
    .solution = sudo usermod -L -e 1 deploy (Passwort gesperrt UND Konto abgelaufen; sudo chage -E 0 deploy lässt es ebenfalls ablaufen).
hint-containment-end =
    .lead = Prüfe alles: Pool und Adresse blockiert, dein ssh weiterhin zugelassen, nichts aus /tmp/.cache läuft, deploy geschlossen, und die Liefer-App läuft.
    .solution = sudo iptables -L -n, ps aux | grep cache, systemctl status delivery (sudo systemctl start delivery, falls sie gestoppt ist, dann stoppen, was sie neu gestartet hat).

## Kapitel 3 — Beseitigung

hint-eradication-cron =
    .lead = Ein Konto kann einen Job hinterlassen, der bei jedem Boot startet: Lies die crontab von deploy und entferne nur, was nicht von Selma ist (man crontab, -u).
    .solution = sudo crontab -u deploy -e: die Zeile „@reboot /bin/sh /tmp/.cache/.w“ löschen, sync-orders behalten.
hint-eradication-key =
    .lead = Zwei Schlüssel auf deploy: Vergleiche ihre Fingerabdrücke mit dem aus Selmas E-Mail (man ssh-keygen, -l).
    .solution = sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, dann sudo nano /home/deploy/.ssh/authorized_keys: die Zeile entfernen, deren Fingerabdruck nicht Selmas ist.
hint-eradication-files =
    .lead = Der Miner und sein Wachhund liegen noch auf der Platte (man rm).
    .solution = sudo ls -la /tmp/.cache, dann sudo rm /tmp/.cache/kworkerd /tmp/.cache/.w (auch die versteckte .w).
hint-eradication-verified =
    .lead = Was wurde verändert? find kann kürzlich geänderte Dateien auflisten (man find, -mtime); die History von deploy sagt es auch. Prüfe vor dem Wiederherstellen die Signatur des Release (man gpg, --verify).
    .solution = sudo find /srv/delivery -type f -mtime -3 (server.js), dann gpg --verify /srv/releases/delivery-2.3.1.tar.gz.asc /srv/releases/delivery-2.3.1.tar.gz (Good signature; die Kopie in /home/deploy ist BAD).
hint-eradication-restored =
    .lead = Stell server.js aus dem Archiv wieder her, dessen Signatur gültig ist (man tar, -x und -C).
    .solution = sudo tar -xzf /srv/releases/delivery-2.3.1.tar.gz -C /srv (es überschreibt /srv/delivery/server.js; im Zweifel mit diff gegen die des Archivs vergleichen).
hint-eradication-end =
    .lead = Prüfe: kein @reboot, sync-orders behalten, nur Selmas Schlüssel, /tmp/.cache weg, server.js wie im Release, dessen Signatur du geprüft hast, die App läuft und nichts wurde neu gestartet.
    .solution = sudo crontab -u deploy -l, sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, sudo ls -la /tmp/.cache, sudo systemctl restart delivery, ps aux | grep cache.

## Kapitel 4 — Härtung

hint-hardening-passwords =
    .lead = sshd_config sagt no zu Passwörtern, trotzdem wurden sie angenommen: Frag sshd, was es anwendet (man sshd, -T), und schau, was es zuerst einbindet.
    .solution = sudo sshd -T | grep passwordauthentication, dann sudo rm /etc/ssh/sshd_config.d/50-delivery.conf und sudo systemctl reload ssh.
hint-hardening-firewall =
    .lead = Standardmäßig verweigern (iptables -P INPUT DROP), aber zuerst lo, die Antworten (-m state --state ESTABLISHED,RELATED) und die Ports 22, 80, 443 zulassen (man iptables).
    .solution = sudo iptables -A INPUT -i lo -j ACCEPT; sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT; sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT (dasselbe für 80 und 443); dann sudo iptables -P INPUT DROP.
hint-hardening-saved =
    .lead = Regeln leben im Speicher: Schreib sie dorthin, wo iptables-persistent sie beim Booten liest (man iptables-save). Denk daran, dass eine Umleitung als du läuft, nicht als root.
    .solution = sudo iptables-save | sudo tee /etc/iptables/rules.v4
hint-hardening-deploy =
    .lead = Selma braucht deploy zurück: Heb auf, was es geschlossen hat (man usermod, -e; man chage).
    .solution = sudo usermod -e "" deploy (oder sudo chage -E -1 deploy); da Passwörter aus sind, öffnet nur ihr Schlüssel das Konto.
hint-hardening-end =
    .lead = Prüfe: sshd -T sagt no, iptables -L zeigt Policy DROP mit lo, ESTABLISHED, 22, 80, 443, die Regeln sind gespeichert, deploy ist benutzbar.
    .solution = sudo sshd -T | grep password, sudo iptables -L -n, sudo cat /etc/iptables/rules.v4, sudo chage -l deploy.
