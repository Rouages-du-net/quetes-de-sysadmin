### Geschichte „Die Zine-Bibliothek“, Kapitel „Ein eigenes Profil“: Ein
### Backup-Skript, das als root läuft, bekommt ein eigenes AppArmor-Profil:
### aa-autodep, Complain-Modus, ein Lauf, aa-logprof, aa-enforce. Befehle,
### Optionen, Pfade, Profilregeln und Ausgaben werden nicht übersetzt.

chapter-backup-profile = Ein eigenes Profil
    .summary = Das Backup-Skript der Bibliothek läuft als root und sichert, was immer seine Konfiguration auflistet: Letzten Monat war die Passwortdatei dabei. Gib ihm ein eigenes AppArmor-Profil, gelernt aus dem, was es wirklich tut, sodass es selbst als root nur die Scans, den Katalog und sein Archiv erreicht, und sonst nichts.

## Files

backup-profile-message-hinewai =
    Von: Hinewai (Die Zine-Bibliothek)
    Dienstag, 22. März, 19:10

    Hallo! Noch einmal danke für die Messe. Jetzt eine Sorge von mir.

    Mein Backup-Skript, /usr/local/sbin/zine-backup, läuft jede Nacht als
    root (cron) und sichert, was /etc/zine-backup.conf auflistet. Im Februar
    hat jemand /etc zu SOURCES hinzugefügt, „um die Einstellungen von nginx
    zu behalten“, und das Archiv, das auf den gemeinsamen USB-Stick der
    Ehrenamtlichen kopiert wird, enthielt /etc/shadow. Ich habe /etc wieder
    herausgenommen, und wir haben alle Passwörter geändert, aber nichts
    hindert es daran, wieder zu passieren: Das Skript ist root, es liest,
    was immer man ihm sagt.

    Der Vorstand möchte es von AppArmor eingeschränkt haben, wie php-fpm:
    die Scans, die Datenbank des Katalogs, sein Archiv in /srv/backup, und
    sonst nichts, egal was seine Konfiguration sagt. Rahim hat letzte Woche
    auditd installiert (das Debian-Wiki sagt, die Profilwerkzeuge wollen
    es): Die Zeilen von AppArmor gehen jetzt nach
    /var/log/audit/audit.log.

    Du kannst das Backup ausführen, wann du willst: sudo zine-backup, oder
    sudo systemctl start zine-backup. Um diese Uhrzeit benutzt niemand den
    Katalog.

    Hinewai

## Events

backup-profile-event-script =
    Das Skript liest seine Liste aus /etc/zine-backup.conf und übergibt sie
    an tar, als root: Eine Zeile in dieser Datei reicht, um alles zu
    sichern. Ein Profil lässt es nur erreichen, was ein Backup braucht.
    aa-autodep schreibt ein erstes (man aa-autodep).

backup-profile-event-profile-file =
    Das Skript hat ein Profil in /etc/apparmor.d, im Complain-Modus geladen:
    Es lässt alles durch und protokolliert, was seine Regeln nicht abdecken.
    Führ jetzt das Backup aus, damit der Kernel sieht, was es wirklich tut.

backup-profile-event-too-early =
    Das Profil hat im Enforce-Modus etwas verweigert, das das Backup
    braucht, und das Backup ist gescheitert: Die DENIED-Zeilen in
    /var/log/audit/audit.log sagen, was. Entweder wurde das Programm nicht
    zuerst im Complain-Modus beobachtet, oder eine Regel ist zu eng: Der
    Name des Archivs ändert sich bei jedem Lauf, seine Regel darf nicht die
    Datei von heute Nacht nennen.

backup-profile-event-not-attached =
    Ein Profil ist geladen, aber das Skript lief uneingeschränkt: Seine
    Anbindung (der Pfad nach dem Namen des Profils, oder der Name selbst,
    wenn er mit / beginnt) muss zu /usr/local/sbin/zine-backup passen.

backup-profile-event-observed =
    Der Lauf ist im Complain-Modus durchgegangen, und audit.log hat seine
    apparmor="ALLOWED"-Zeilen bekommen: die Konfiguration gelesen, date, tar
    und gzip ausgeführt, die Scans und der Katalog gelesen (mit capability
    dac_read_search: Der Katalog gehört www-data, und die anderen dürfen ihn
    nicht lesen, also braucht selbst root sie), das Archiv geschrieben.
    aa-logprof macht daraus Regeln, eine Frage nach der anderen (man
    aa-logprof).

backup-profile-event-too-wide =
    Dieses Profil lässt das Backup immer noch { $path } erreichen: nichts,
    was ein Backup braucht. Ein Glob, der zu hoch steigt (/**), oder ein
    uneingeschränkt ausgeführtes tar (ux), gibt zurück, was das Profil
    wegnehmen sollte.

backup-profile-event-rules =
    Das Profil enthält jetzt die Regeln des Backups. Es ist noch im
    Complain-Modus: Es schützt noch nichts.

backup-profile-event-enforced =
    Das Profil ist im Enforce-Modus. Führ das Backup noch einmal aus: Es
    muss immer noch durchgehen.

backup-profile-event-shadow =
    tar: /etc/shadow: Cannot open: Permission denied, und eine
    apparmor="DENIED"-Zeile: Mit /etc/shadow in SOURCES verweigert das
    Profil es, root oder nicht. Nimm es wieder aus der Konfiguration heraus:
    Das Backup sollte dann gelingen.

backup-profile-event-end =
    Hinewai: „Der Vorstand ist zufrieden. Und ich schlafe besser: Was auch
    immer in dieser Datei landet, das Skript kann die Passwörter nicht mehr
    mitnehmen.“

    Gut gemacht! Du hast „Ein eigenes Profil“ abgeschlossen.

    WAS PASSIERT IST
    Das Backup-Skript lief als root und las, was immer seine Konfiguration
    auflistete. Du hast ihm ein eigenes Profil gegeben: aa-autodep hat es im
    Complain-Modus begonnen, ein Lauf hat den Kernel protokollieren lassen,
    was das Skript tat (mit auditd, in /var/log/audit/audit.log), aa-logprof
    hat diese Zeilen in Regeln verwandelt (tar und gzip als ix, die
    Verzeichnisse per Glob, capability dac_read_search für den Katalog),
    dann aa-enforce. Das Skript ist bei jedem Lauf ein neuer Prozess: Das
    Profil wird bei seinem nächsten exec angehängt, nichts neu zu starten.
    root oder nicht, es kann /etc/shadow nicht mehr lesen.

    GUTE PRAXIS
    - Beobachte, bevor du durchsetzt: Complain-Modus, ein echter Lauf (der
      übliche Weg des nächtlichen Jobs), dann die Regeln.
    - Lies jede Frage von aa-logprof: Erlaube, was das Programm braucht,
      nimm für ein Verzeichnis einen Glob statt seine Dateien aufzulisten,
      nie ux, nie /**.
    - Prüfe ein Profil in beide Richtungen: Der Job gelingt, und was er
      nicht anfassen darf, wird verweigert (DENIED).
    - Unter AppArmor ist root nicht allmächtig: Capabilities sind auch
      Regeln (capability dac_read_search).
    - Halte den Complain-Modus kurz, und bewahre das Profil mit der
      Konfiguration der Maschine auf (und in ihren Backups).

    EIN ANDERER WEG
    Das Sandboxing von systemd schränkt ein, was ein Dienst sieht, ohne
    Profil (ProtectSystem=strict, ReadWritePaths=,
    InaccessiblePaths=/etc/shadow). SELinux schränkt über Labels ein: eine
    Domäne für das Skript, Typen auf seinen Dateien; eine stärkere
    Trennung, aber alles zu kennzeichnen, was ein Backup liest, ist mehr
    Arbeit.

    DOKUMENTATION
    - aa-logprof(8): https://manpages.debian.org/trixie/apparmor-utils/aa-logprof.8.en.html
    - aa-autodep(8): https://manpages.debian.org/trixie/apparmor-utils/aa-autodep.8.en.html
    - aa-enforce(8), aa-complain(8): https://manpages.debian.org/trixie/apparmor-utils/aa-enforce.8.en.html
    - apparmor.d(5): https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - Profile mit den Werkzeugen erstellen: https://gitlab.com/apparmor/apparmor/-/wikis/Profiling_with_tools
