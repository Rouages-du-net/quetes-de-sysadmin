### Geschichte „Das andere Unix“, Kapitel „Das Skript, das nicht mehr
### lief“: ein für Debian geschriebenes Backup-Skript, unter FreeBSD
### ausgeführt. Befehle, Optionen, Pfade und Fehlermeldungen werden nicht
### übersetzt.

chapter-portable-script = Das Skript, das nicht mehr lief
    .summary = Ein unter Debian geschriebenes Backup-Skript scheitert auf dem FreeBSD-Server des Clubs: Lies jeden Fehler und korrigiere ihn mit dem Handbuch dieses Systems.

## Dateien

portable-script-message-yanis =
    Von:  Yanis
    An:   dich

    Hallo! Ich bin der neue Ehrenamtliche im Club. Ich habe ein Skript
    geschrieben, das die Website jede Nacht sichert (nightly-backup.sh, in
    deinem Verzeichnis). Auf meinem Debian-Laptop funktioniert es perfekt.
    Auf dem Server ist das letzte Backup in /var/backups/state.conf vom
    1. September.

    Lucien, der den Server vor Jahren eingerichtet hat, sagte immer: „Das
    ist kein Linux, das ist FreeBSD.“ Ich dachte, Unix ist Unix…

    Kannst du es zum Laufen bringen? Das Backup von letzter Nacht (mit dem
    Datum von gestern) wäre ein guter Anfang.

    Yanis

## Ereignisse

portable-script-event-not-found =
    „not found“… für eine Datei, die genau da liegt. FreeBSD liest die
    erste Zeile, #!/bin/bash, und sucht /bin/bash: Das gibt es nicht. bash
    gehört nicht zum Basissystem von FreeBSD (ein Paket würde es nach
    /usr/local/bin/bash legen). Die Shell des Basissystems ist /bin/sh: Ein
    Skript, das nur sh braucht, läuft überall.
portable-script-event-date =
    date: illegal option -- d. -d gehört zum date von GNU (dem von Debian).
    FreeBSD hat sein eigenes date, von BSD, mit anderen Optionen: Sein
    Handbuch (man date) sagt, wie man ein Datum verschiebt (-v).
portable-script-event-stat =
    stat: illegal option -- c. -c FORMAT gehört zum stat von GNU. Das stat
    von BSD nimmt sein Format mit -f, und auch die Sequenzen sind andere:
    man stat.
portable-script-event-sed =
    sed beschwert sich über ein Skript namens /var/backups/state.conf: Bei
    BSD-sed nimmt -i immer ein Wort danach, die Endung der Sicherungskopie
    (-i '' für keine). Hier hat es das s/…/…/ als Endung genommen, dann den
    Dateinamen als Skript (/var/ wurde zu einer Adresse, b zu einem
    Befehl). man sed, bei -i.
portable-script-event-end =
    Yanis: „Endlich das Backup von gestern! Und state.conf ist aktuell. Ab
    jetzt lese ich das Handbuch der Maschine, auf der ich bin.“

    Gut gemacht! Du hast das Kapitel „Das Skript, das nicht mehr lief“
    abgeschlossen.

    WAS PASSIERT IST
    Das Skript war für die Werkzeuge von Debian geschrieben, also die von
    GNU. FreeBSD hat seine eigenen Werkzeuge, von BSD: gleiche Namen,
    gleicher Zweck, aber andere Optionen. date -d, stat -c und sed -i ohne
    Endung gibt es nur bei GNU; und bash ist standardmäßig nicht
    installiert.

    GUTE PRAXIS
    - Lies das Handbuch der Maschine, auf der du bist: man date unter
      FreeBSD ist nicht man date unter Debian.
    - Für ein Skript, das überall laufen muss: #!/bin/sh, und nur, was
      POSIX garantiert (date +%F, aber nicht date -d; überhaupt kein sed
      -i: in eine temporäre Datei schreiben, dann mv).
    - set -e hält beim ersten Fehler an: Die Meldung sagt dir, welche
      Zeile.

    EIN ANDERER WEG
    pkg install coreutils bringt die Werkzeuge von GNU auf FreeBSD, mit
    einem g davor (gdate, gstat, und gsed in einem eigenen Paket): praktisch
    für ein unverändert kopiertes Skript, aber das Skript hängt dann von
    Paketen ab. pkg install bash und #!/usr/local/bin/bash (oder
    #!/usr/bin/env bash) für bash selbst.

    DOKUMENTATION
    - date(1) unter FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=date
    - sed(1) unter FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=sed
    - stat(1) unter FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=stat
    - Das FreeBSD-Handbuch, Shells: https://docs.freebsd.org/en/books/handbook/basics/#shells
