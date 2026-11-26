### Abgestufte Hinweise für Das andere Unix (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung)
### und .solution (fast die Antwort).

## Kapitel 1 — Das Skript, das nicht mehr lief

hint-portable-script-not-found =
    .lead = Führe das Skript aus und lies, was das System antwortet (./nightly-backup.sh). Schau dir dann seine erste Zeile an.
    .solution = ./nightly-backup.sh sagt „not found“: Seine erste Zeile, #!/bin/bash, nennt einen Interpreter, den FreeBSD nicht hat. nano nightly-backup.sh, und mach daraus #!/bin/sh.
hint-portable-script-date =
    .lead = Das Skript hält jetzt bei date an. Dieses date ist nicht das von Debian: Lies SEIN Handbuch (man date), um gestern zu bekommen.
    .solution = Ersetze date -d yesterday durch date -v-1d (in nano), mit +%F.
hint-portable-script-stat =
    .lead = Als Nächstes kommt stat: man stat auf dieser Maschine sagt, welche Option ein Format nimmt und wie man nach der Größe fragt.
    .solution = Ersetze stat -c %s durch stat -f %z.
hint-portable-script-sed =
    .lead = Zuletzt sed -i: Unter BSD will -i immer ein Wort danach (man sed).
    .solution = Schreib sed -i '' "s/^last=.*/last=$DAY/" /var/backups/state.conf (das '' ist eine leere Endung: keine Sicherungskopie).
hint-portable-script-end =
    .lead = Lass das Skript bis zum Ende laufen: Das Archiv von gestern muss in /var/backups liegen, und state.conf muss last=2029-10-05 sagen.
    .solution = ./nightly-backup.sh, dann ls -l /var/backups und cat /var/backups/state.conf.

## Kapitel 2 — Hier gibt es kein systemd

hint-rc-services-installed =
    .lead = Hier gibt es kein apt: FreeBSD hat seine eigene Paketverwaltung (man pkg).
    .solution = sudo pkg install nginx (antworte y).
hint-rc-services-not-enabled =
    .lead = Dienste werden mit service gesteuert (man service): Versuch, nginx zu starten.
    .solution = sudo service nginx start (und lies, warum es ablehnt).
hint-rc-services-enabled =
    .lead = Die Meldung nennt die Variable aus rc.conf. sysrc schreibt sie für dich (man sysrc).
    .solution = sudo sysrc nginx_enable=YES (oder sudo service nginx enable).
hint-rc-services-end =
    .lead = Starte es jetzt und prüfe, dass es auf Port 80 lauscht (man sockstat).
    .solution = sudo service nginx start, dann sockstat -4l.

## Kapitel 3 — Die letzte Regel gewinnt

hint-last-rule-checked =
    .lead = Lies /etc/pf.conf und prüfe es, ohne es zu laden (man pfctl).
    .solution = cat /etc/pf.conf, dann sudo pfctl -nf /etc/pf.conf.
hint-last-rule-on =
    .lead = Bei pf entscheidet die LETZTE passende Regel (man pf.conf). Bring die Regeln in die Reihenfolge von pf, bevor du es einschaltest.
    .solution = sudo nano /etc/pf.conf: zuerst „block in all“, dann „pass in proto tcp to port {"{"} 22 80 {"}"}“, dann „pass out all keep state“. Dann sudo sysrc pf_enable=YES und sudo service pf start.
hint-last-rule-end =
    .lead = pf muss beim Booten starten, mit den Regeln aus der Datei: Prüfe, was gilt (pfctl -sr), und von deinem Rechner aus, was antwortet (nc -zv).
    .solution = sudo pfctl -f /etc/pf.conf nach jeder Änderung, sudo pfctl -sr; exit, dann nc -zv projektor 3306 (darf nicht antworten) und nc -zv projektor 80.
