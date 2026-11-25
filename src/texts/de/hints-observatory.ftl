### Die gestuften Hinweise der Geschichte „Die Sternwarte“: eine Spur,
### dann fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Hohe Last

hint-heavy-load-load =
    .lead = Wie beschäftigt ist die Maschine? (man uptime: die Durchschnittslast; man nproc: wie viele CPUs)
    .solution = uptime zeigt eine Last von etwa 9; nproc sagt 2 CPUs: Sieben Prozesse warten jederzeit auf eine CPU.
hint-heavy-load-workers =
    .lead = Wer nimmt die CPU? (man top, man ps)
    .solution = top: acht stack-worker-Prozesse von jules, jeder bei etwa 22 %, und die Galerie (node) mit demselben Anteil.
hint-heavy-load-end =
    .lead = Gib den Workern eine niedrigere Priorität, allen, ohne sie zu stoppen (man renice: -n, -p, -u). Miss dann die Galerie so wie Amara.
    .solution = sudo renice -n 19 -u jules, dann curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/

## Kapitel 2 — Das Kontingent

hint-quota-measure =
    .lead = Wie viel CPU nimmt das Stacking heute Morgen, mit nice oder ohne? (man top, man systemd-cgtop)
    .solution = top: Die acht Worker auf NI 19 nehmen fast beide CPUs ganz; systemd-cgtop zeigt stacking.service bei fast 200 %.
hint-quota-end =
    .lead = nice begrenzt nicht: systemd kann die CPU-Zeit eines Dienstes begrenzen (man systemd.resource-control: CPUQuota=). 40 % von zwei CPUs sind wie viel Prozent EINER?
    .solution = sudo systemctl set-property stacking CPUQuota=80% (sofort angewendet, auf der Platte behalten), dann systemd-cgtop.

## Kapitel 3 — Zu viele offene Dateien

hint-too-many-files-emfile =
    .lead = Was sagt die Galerie, wenn das Archiv scheitert? (man journalctl: -u)
    .solution = journalctl -u gallery: „Error: EMFILE: too many open files“.
hint-too-many-files-limits =
    .lead = Was ist das Limit des Prozesses der Galerie, nicht deiner Shell? (man proc: /proc/PID/limits; man prlimit)
    .solution = cat /proc/840/limits: Max open files 1024 (weich), 524288 (hart). Oder sudo prlimit --pid 840 --nofile.
hint-too-many-files-end =
    .lead = Ein Dienst bekommt seine Limits von systemd, wenn er startet (man systemd.exec: LimitNOFILE=).
    .solution = sudo systemctl edit gallery: {"["}Service] LimitNOFILE=4096; dann sudo systemctl restart gallery, und curl -i http://localhost:8080/archive.

## Kapitel 4 — Der hängende Prozess

hint-stuck-process-stuck =
    .lead = Aus welchen Prozessen besteht die Kopie, und wer hat wen gestartet? (man ps: -ef, die Spalte PPID)
    .solution = ps -ef: /bin/bash /usr/local/bin/sync-photos (3301) und sein Kind rsync (3302).
hint-stuck-process-ignored =
    .lead = kill schickt TERM. Nimmt das Skript es an? Lies es (cat /usr/local/bin/sync-photos), und such die Signale, die nichts ignorieren kann (man 7 signal).
    .solution = Das Skript hat trap '' INT TERM HUP: sudo kill -KILL 3301 (oder kill -9).
hint-stuck-process-end =
    .lead = Nach KILL: Was bleibt von der Kopie, und was hatte das Skript keine Zeit mehr aufzuräumen? (ps -ef, das LOCK des Skripts)
    .solution = sudo kill auf das verbliebene rsync, mit ps -p 3301 prüfen, dass das Skript weg ist, dann sudo rm /run/sync-photos.pid.
