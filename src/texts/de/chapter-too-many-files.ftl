### Geschichte „Die Sternwarte“, Kapitel 3 „Zu viele offene Dateien“: die
### Limits eines Prozesses, ulimit, prlimit, LimitNOFILE=. Befehle, Pfade
### und die Ausgaben der Werkzeuge werden nicht übersetzt.

chapter-too-many-files = Zu viele offene Dateien
    .summary = Die neue Archivseite der Galerie antwortet mit 500: „EMFILE: too many open files“. ulimit in der Shell sagt 1024, limits.conf sagt nichts, und die Galerie ist ein Dienst. Gib ihr das Limit, das sie braucht, dauerhaft.

## Dateien

too-many-files-message-amara =
    Von:     Amara
    An:      dich
    Betreff: Die Archivseite ist kaputt

    Hallo,

    Ich bin zurück! Heute Morgen habe ich die Galerie aktualisiert
    (Version 1.5): Sie hat eine neue Seite, das Archiv, mit einem Mosaik
    aller unserer Fotos seit 2019, 2400 Stück. Die Startseite geht, aber
    das Archiv antwortet mit einem Fehler:
      curl -i http://localhost:8080/archive

    Die Mitglieder warten darauf. Ich weiß nicht, wo ich suchen soll: Auf
    meinem Laptop geht es.

    Gleiches sudo-Passwort: nebel-2028.

    Amara

too-many-files-archive-page =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Astronomieverein — Archiv</title></head>
    <body>
    <h1>Das Archiv</h1>
    <p>{ $photos } Fotos seit 2019, als Mosaik.</p>
    </body>
    </html>

## Ereignisse

too-many-files-event-emfile =
    „EMFILE: too many open files“: Die Galerie wollte eine Datei mehr
    öffnen, und der Kernel hat abgelehnt. Jeder Prozess hat ein Limit für
    die Anzahl der Dateien, die er gleichzeitig offen hält. Wie viele hält
    sie, und was ist ihr Limit? Alles über einen Prozess liegt unter
    /proc/PID (ihre PID: systemctl status gallery).
too-many-files-event-limits =
    Max open files: ein weiches Limit (was der Prozess benutzen darf) und
    ein hartes (die Obergrenze, bis zu der er sein weiches Limit selbst
    anheben darf). Das Archiv öffnet alle seine 2400 Fotos und hält sie
    offen: 1024 reichen nicht. Wer hat der Galerie 1024 gegeben? Sie ist
    ein Dienst: systemd, das sie startet.
too-many-files-event-ulimit-shell =
    ulimit ändert die Limits DEINER Shell, und von dem, was du aus ihr
    heraus startest. Die Galerie wurde von systemd gestartet: Die Limits
    deiner Shell erreichen sie nicht.
too-many-files-event-limits-conf =
    /etc/security/limits.conf wird von pam_limits gelesen, wenn eine
    Sitzung geöffnet wird (ssh, login, su). Ein systemd-Dienst öffnet keine
    Sitzung: Er liest diese Datei nie. Seine Limits kommen aus seiner Unit
    (man systemd.exec: LimitNOFILE=).
too-many-files-event-too-small =
    Die Galerie hat jetzt ihr eigenes Limit, aber es ist zu niedrig: Das
    Archiv hält etwa { $need } Dateien gleichzeitig (2400 Fotos, plus was
    Node.js schon hält). Gib ihr etwas Luft: 4096 zum Beispiel.
too-many-files-event-restart-needed =
    systemd hat das neue Limit, aber der Prozess der Galerie hat noch das
    alte: Ein Limit wird gesetzt, wenn der Prozess startet. Starte die
    Galerie neu (sudo systemctl restart gallery).
too-many-files-event-live-only =
    Die laufende Galerie hat jetzt genug (prlimit ändert die Limits eines
    laufenden Prozesses). Aber nur bis zu ihrem nächsten Neustart: systemd
    startet sie wieder mit 1024. Schreib das Limit auch in ihre Unit.
too-many-files-event-end =
    Das Archiv antwortet mit 200: Das Mosaik ist zurück, und sein Limit
    steht in der Unit der Galerie, also übersteht es Neustarts von Dienst
    und Maschine. Amara: „Deshalb ging es also auf meinem Laptop: Ich habe
    es aus meinem Terminal gestartet!“

    Gut gemacht! Du hast das Kapitel „Zu viele offene Dateien“ abgeschlossen.

    WAS PASSIERT IST
    Das Archiv öffnet seine 2400 Fotos und hält sie offen. Die Galerie,
    ein systemd-Dienst, hatte das Standardlimit von systemd: 1024 offene
    Dateien (weich), 524288 (hart). Über 1024 scheitert open(): EMFILE.

    WOHER LIMITS KOMMEN
    - Ein Prozess erbt die Limits seines Elternprozesses und darf sie
      senken, oder sein weiches Limit bis zu seinem harten anheben.
    - systemd setzt die Limits eines Dienstes, wenn es ihn startet:
      LimitNOFILE= in der Unit (Standard 1024:524288).
    - Eine Login-Sitzung bekommt sie von pam_limits (limits.conf), und
      ulimit ändert die der Shell: Keins von beiden erreicht einen Dienst.
    - prlimit ändert die Limits eines laufenden Prozesses, bis er neu
      startet.

    GUTE PRAXIS
    - Schau dir den echten Prozess an: cat /proc/PID/limits,
      ls /proc/PID/fd | wc -l (was er hält), lsof -p PID.
    - sudo systemctl edit gallery: {"["}Service] LimitNOFILE=4096, dann sudo
      systemctl restart gallery.
    - Vernünftig anheben: Ein Programm, das Tausende Dateien offen hält,
      hat vielleicht auch ein Leck, das zu beheben ist.

    DOKUMENTATION
    - LimitNOFILE=: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitCPU=
    - /proc/PID/limits: https://man7.org/linux/man-pages/man5/proc_pid_limits.5.html
    - prlimit: https://man7.org/linux/man-pages/man1/prlimit.1.html
