### Abgestufte Hinweise für „Bereitschaft“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur,
### ohne den genauen Befehl) und .solution (fast die Antwort). Ortsnamen
### wie in names.ftl.

## Kapitel 1 — Die volle Platte

hint-full-disk-full =
    .lead = Zoé spricht von einer vollen Platte. Bevor du etwas suchst, prüf, wie voll die Dateisysteme sind (man df, die Option, die menschenlesbare Größen zeigt).
    .solution = df -h (/ steht bei 100 %)
hint-full-disk-culprit =
    .lead = Was belegt den Platz? du misst, Verzeichnis für Verzeichnis: Fang bei den Logs an, in /var/log, und geh dann dorthin, wo es schwer ist.
    .solution = sudo du -sh /var/log/* (das Passwort steht in Zoés Nachricht), dann sudo du -sh /var/log/radio/*: stream.log wiegt mehr als 15 GB.
hint-full-disk-debug =
    .lead = Bevor du dieses riesige Log löschst, schau dir an, was darin steht: Seine letzten Zeilen sagen dir, warum es so schnell wächst.
    .solution = sudo tail /var/log/radio/stream.log (DEBUG-Zeilen für jedes Paket)
hint-full-disk-breathes =
    .lead = Der Platz muss zurückgegeben werden, aber rm reicht nicht: Das Relay hält die Datei offen. Leere sie, ohne sie zu löschen (man truncate), oder starte das Programm neu, das sie hält.
    .solution = sudo truncate -s 0 /var/log/radio/stream.log (dann df -h zum Prüfen; wenn du sie schon gelöscht hast: sudo systemctl restart radio-stream)
hint-full-disk-end =
    .lead = Damit es nicht wieder passiert: die normale Log-Stufe in /etc/radio/stream.conf wieder einstellen (das Relay liest sie nur beim Start neu) und das Log an logrotate übergeben, in /etc/logrotate.d, mit einer Möglichkeit, die Datei neu öffnen zu lassen (man logrotate).
    .solution = sudo nano /etc/radio/stream.conf (loglevel = info), sudo systemctl restart radio-stream, dann sudo nano /etc/logrotate.d/radio: /var/log/radio/*.log {"{"} daily, rotate 7, compress, missingok, copytruncate {"}"} (eine Direktive pro Zeile; sudo logrotate -d /etc/logrotate.d/radio zum Prüfen).

## Kapitel 2 — Der Speicher

hint-memory-oom =
    .lead = Die Playlist hat von selbst angehalten. Was sagt systemctl status dazu? Und das Log des Kernels, das festhält, welche Prozesse er töten musste?
    .solution = systemctl status radio-playlist (Result: oom-kill), dann sudo dmesg -T (Out of memory: Killed process…)
hint-memory-zombies =
    .lead = Schau dir die Liste aller Prozesse und ihren Zustand an: Einige sind mit <defunct> markiert. Die Spalte PPID sagt dir, wer ihr Elternprozess ist.
    .solution = ps -ef (oder ps aux): Zombies [konvertieren] <defunct>, Kinder von PID 2305 (der Dienst radio-podcast)
hint-memory-contained =
    .lead = Die Playlist leckt: So neu gestartet, wie sie ist, wächst sie wieder. systemd kann den Speicher eines Dienstes begrenzen und ihn neu starten, wenn er stirbt, mit einem Override (man systemctl: edit; man systemd.resource-control: MemoryMax=). Dann sieh ihr mit top beim Wachsen zu.
    .solution = sudo systemctl edit radio-playlist, [Service] schreiben, dann MemoryMax=600M und Restart=on-failure; sudo systemctl start radio-playlist, dann mehrmals top (oder free -h): systemd tötet sie und startet sie neu.
hint-memory-without-zombies =
    .lead = Einen Zombie kann man nicht töten: Er ist schon tot. Nur sein Elternprozess kann ihn verschwinden lassen, oder selbst verschwinden (init räumt die Zombies dann ab).
    .solution = sudo systemctl restart radio-podcast (der Dienst des Elternprozesses, PID 2305)
hint-memory-end =
    .lead = Zum Abschluss brauchst du alles auf einmal: die Playlist läuft, eine vernünftige Speichergrenze (ein paar Hundert MB), ein automatischer Neustart, keine Zombies mehr, und das Relay aktiv. Hast du eine Unit-Datei von Hand geschrieben, muss systemd sie neu lesen.
    .solution = systemctl status radio-playlist (Memory … max), ps aux ohne <defunct>; nach einer von Hand geschriebenen Datei: sudo systemctl daemon-reload, dann sudo systemctl start radio-playlist

## Kapitel 3 — Die Inodes

hint-inodes-almost-empty =
    .lead = Schon wieder „No space left on device“: Prüf zuerst den freien Platz auf dem Datenvolume, /srv/radio.
    .solution = df -h (/srv/radio ist fast leer)
hint-inodes-more-inodes =
    .lead = Platz ist nicht die einzige Ressource eines Dateisystems: Jede Datei braucht eine Inode, und ihre Zahl ist fest. Eine Option von df zählt sie (man df).
    .solution = df -i (oder df -ih): 100 % der Inodes von /srv/radio sind belegt
hint-inodes-culprit =
    .lead = Wer hat so viele Dateien angelegt? du kann Inodes statt Bytes zählen (man du), Verzeichnis für Verzeichnis.
    .solution = sudo du --inodes -d 1 /srv/radio (das Verzeichnis stats enthält mehr als 65.000 Dateien)
hint-inodes-restarts =
    .lead = Zoé will die letzten 30 Tage behalten. rm * wird scheitern (zu viele Argumente); find durchläuft das Verzeichnis selbst, wählt Dateien nach Alter aus und kann sie löschen (man find: -mtime, -delete).
    .solution = sudo find /srv/radio/stats -type f -mtime +30 -delete (probier es zuerst ohne -delete, mit | wc -l)
hint-inodes-end =
    .lead = Damit es nicht wieder passiert, muss das Aufräumen jede Nacht laufen: ein cron-Auftrag, in der crontab eines Kontos, das diese Dateien löschen darf (root, oder radio).
    .solution = sudo crontab -e, und ergänzen: 15 4 * * * find /srv/radio/stats -type f -mtime +30 -delete

## Kapitel 4 — Die Uhr

hint-clock-utc =
    .lead = Der cron-Auftrag hat sich nicht geändert, und doch startet er zwei Stunden zu spät. Welche Uhrzeit, und in welcher Zeitzone, glaubt die Maschine zu leben?
    .solution = date, oder timedatectl (Time zone: Etc/UTC)
hint-clock-late =
    .lead = timedatectl sagt dir auch, ob die Uhr synchronisiert ist und ob der NTP-Dienst läuft. Vergleiche mit der Uhrzeit deines Rechners.
    .solution = timedatectl (System clock synchronized: no, NTP service: inactive)
hint-clock-synced =
    .lead = Die Synchronisation ist Aufgabe von systemd-timesyncd: Er muss aktiviert sein und einen NTP-Server bekommen, der antwortet. Die E-Mail des Hosters sagt, welchen; die Konfiguration steht in /etc/systemd/timesyncd.conf (beim Start neu gelesen).
    .solution = sudo nano /etc/systemd/timesyncd.conf (NTP=ntp.hosting.example), dann sudo timedatectl set-ntp true (oder sudo systemctl restart systemd-timesyncd, wenn er schon läuft)
hint-clock-cron =
    .lead = Die Maschine muss nach Pariser Zeit leben. Die Zeitzone stellt man mit timedatectl ein (man timedatectl: set-timezone, list-timezones).
    .solution = sudo timedatectl set-timezone Europe/Paris
hint-clock-end =
    .lead = cron hat die Zeitzone bei seinem Start gelesen, am Samstag: Er rechnet noch in UTC. Und timesyncd muss aktiviert sein, um beim nächsten Start der Maschine wieder anzulaufen.
    .solution = sudo systemctl restart cron (und, falls noch nicht geschehen, sudo timedatectl set-ntp true)

## Kapitel 5 — Die Sonde

hint-probe-end =
    .lead = Zoés Sonde (/usr/local/bin/probe) hat drei TODOs: /srv/radio überwachen, Platz UND Inodes (man check_disk: -W, -K), prüfen, ob der Livestream antwortet (man check_http, Port 8000, /live), und sie alle 5 Minuten ausführen (ein systemd-Timer oder cron). Zu enge Schwellen geben Alarme für nichts.
    .solution = In sudo nano /usr/local/bin/probe ergänzen: $P/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio | grep -v " OK" | $ALERT und $P/check_http -H localhost -p 8000 -u /live | grep -v " OK" | $ALERT; dann sudo crontab -e: */5 * * * * /usr/local/bin/probe (oder probe.service + probe.timer mit OnCalendar=*:0/5, und sudo systemctl enable --now probe.timer).

## Kapitel 6 — Das Post-Mortem

hint-post-mortem-notes =
    .lead = Fang mit dem an, was Théo in dieser Nacht aufgeschrieben hat, in deinem Home-Verzeichnis. Das sind Spuren zum Prüfen, keine Fakten.
    .solution = cat notes_theo.txt
hint-post-mortem-reboot =
    .lead = Die Logs sind sekundengenau. Lies die der Nacht vom 11. auf den 12. September, zwischen 2:00 und 3:30 (man journalctl: --since, --until): Was ist kurz vor dem Stopp des Relays gestartet?
    .solution = sudo journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30" (apt-daily-upgrade, dann Stopping radio-stream.service); dann sudo cat /var/log/unattended-upgrades/unattended-upgrades-dpkg.log und last
hint-post-mortem-origin =
    .lead = Die unbekannte Option wartete in stream.conf. Seit wann? Das Journal hält auch die mit sudo ausgeführten Befehle fest: Such, wer diese Datei geöffnet hat, und wann.
    .solution = sudo journalctl | grep stream.conf (am 20. August, sudo nano /etc/radio/stream.conf, nie neu gestartet)
hint-post-mortem-end =
    .lead = Vervollständige postmortem.md (nano), behalte die Überschriften „##“ der Vorlage und lass kein „(zu ergänzen“ stehen: Zusammenfassung; Zeitverlauf mit den Uhrzeiten aus den Logs (Ausfall, erster Alarm, Stream zurück); Auswirkung in Minuten; Ursachen (der Auslöser, und seit wann der Fehler wartete); Was gut lief; Maßnahmen (mindestens zwei Zeilen „-“). Ohne Schuldzuweisung: kein „ist schuld“ oder „schuldig“.
    .solution = Zeitverlauf: 02:13 (das Update startet das Relay neu), 02:15 (erster Alarm), 02:58 (das Relay läuft wieder); Auswirkung: 45 Minuten; Ursachen: unattended-upgrades (needrestart) hat das Relay neu gestartet, eine unbekannte Option (bitrate_max) wartete seit dem 20. August in stream.conf; Was gut lief: Die Sonde hat innerhalb von 2 Minuten gewarnt; Maßnahmen: - die Konfiguration vor jedem Neustart prüfen (ExecStartPre=) - das Relay nach jeder Änderung neu starten.

## Kapitel 7 — Der Engpass

hint-bottleneck-iowait =
    .lead = Zoé sagt, der Prozessor tue fast nichts. Schau auf die Zeile %Cpu(s) von top: Jede Spalte hat ihre Bedeutung (man top), und eine davon zählt die Zeit, die mit Warten auf die Platte verbracht wird.
    .solution = top („wa“ ist riesig: das ist iowait); dann iostat -x und sudo pidstat -d, um die ausgelastete Platte zu sehen und wer sie beschäftigt
hint-bottleneck-end =
    .lead = Was die Platte auslastet (pidstat nennt seinen Prozess; systemctl list-timers sagt, was um 16 Uhr startet), darf nicht gestoppt werden. ionice ist mit dem Scheduler „none“ nutzlos; eine von systemd gesetzte Bandbreitengrenze funktioniert immer (man systemd.resource-control: IOWriteBandwidthMax=), auf der richtigen Platte (iostat nennt sie), weder zu niedrig noch zu hoch.
    .solution = sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 20M" (in /etc gespeichert), dann iostat -x zum Prüfen; wenn die Archivierung gestoppt ist: sudo systemctl start radio-archives
