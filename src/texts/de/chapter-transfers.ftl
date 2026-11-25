### Geschichte „Das Bürgerhaus“, Kapitel „Die Übertragungen“: Dateien
### zwischen Maschinen kopieren (scp, rsync). Die Befehle, die Optionen, die
### Pfade und die Meldungen der Werkzeuge (auf Englisch) werden nicht übersetzt.

chapter-transfers = Die Übertragungen
    .summary = Eine Datei vom Wiki auf deinen Rechner holen (scp), dann das Backup auf archives auf den neuesten Stand bringen (rsync).

## Dateien

transfers-email-yasmine =
    Von:     Yasmine
    An:      dich
    Betreff: Vor der Mitgliederversammlung

    Die Mitgliederversammlung ist am Samstag! Zwei Dinge vorher:

    1. Der Jahresbericht liegt im Wiki:
       /srv/wiki/exports/bericht-2027.pdf. Könntest du ihn auf DEINEN
       Rechner holen? Ich drucke ihn bei dir aus. (man scp; die Abkürzung,
       die du für das Wiki geschrieben hast, funktioniert auch für scp.)

    2. Das Backup des gemeinsamen Verzeichnisses (/srv/freigabe, hier auf
       buergerhaus) wurde seit letztem Jahr nicht gemacht. Es kommt auf
       archives, nach /srv/sicherungen/freigabe: dieselben Dateien, an
       denselben Stellen. Gaspard benutzte rsync, von buergerhaus aus: Es
       kopiert nur, was sich geändert hat (man rsync). Er hat sogar einen
       Schlüssel nur dafür angelegt, ~/.ssh/id_sicherung (schau hier in
       ~/.ssh/config).

    Gaspard sagt mir am Telefon: „Vorsicht mit dem Schrägstrich am Ende
    der Quelle, bei rsync. Und probier es zuerst mit -n.“

transfers-minutes-agm-2026 =
    Mitgliederversammlung 2026 — Protokoll

    Anwesend: 34 Vereine von 41.
    Jahresbericht einstimmig angenommen. Haushalt angenommen
    (2 Enthaltungen).
    Projekt des Jahres: ein gemeinsames Wiki für alle Vereine.
transfers-minutes-board-2027-09 =
    Vorstandssitzung — September 2027

    Punkt 1: Die IT des Bürgerhauses wird von einer neuen ehrenamtlichen
    Person übernommen. Gaspard bleibt telefonisch erreichbar.
    Punkt 2: Die Mitgliederversammlung findet am Samstag, 9. Oktober statt.
transfers-schedule =
    Raumbuchungen — Oktober 2027

    Raum 1: Chor (Dienstag 19 Uhr), Schachclub (Donnerstag 18 Uhr)
    Raum 2: Fahrradwerkstatt (Samstag 10 Uhr)
    Großer Saal: Mitgliederversammlung (Samstag, 9. Oktober, 14 Uhr)

## Ereignisse

transfers-event-report =
    Der Jahresbericht ist auf deinem Rechner: scp ist über buergerhaus
    gegangen (das ProxyJump deiner Abkürzung), genau wie ssh.
# { $directory }: das zusätzliche Verzeichnis, das angelegt wurde
transfers-event-nested =
    Schau auf archives: Dort gibt es jetzt ein Verzeichnis { $directory }.
    Ohne Schrägstrich am Ende hat rsync das VERZEICHNIS freigabe ins
    Backup kopiert, statt seines INHALTS.

    Fang mit /srv/freigabe/ neu an. Und um das zusätzliche Verzeichnis zu
    entfernen, kann rsync auf der anderen Seite löschen, was es in der
    Quelle nicht gibt: die Option --delete (man rsync). Mächtig, also
    zuerst ein Probelauf, mit -n.
transfers-event-backup =
    Das Backup auf archives ist aktuell: Jede Datei aus /srv/freigabe ist
    da, an derselben Stelle. Führ denselben Befehl noch einmal aus: rsync
    hat nichts mehr zu kopieren.
transfers-event-end =
    Der Bericht ist auf deinem Rechner, und das Backup auf archives ist
    aktuell. Yasmine: „Danke! Gaspard sagt auch: gut gemacht, er hat dein
    Backup gesehen.“

    Gut gemacht! Du hast „Das Bürgerhaus“ abgeschlossen.

    WAS PASSIERT IST
    scp kopiert Dateien über dieselbe verschlüsselte Verbindung wie ssh,
    mit denselben Schlüsseln und denselben Abkürzungen (~/.ssh/config,
    ProxyJump). rsync geht auch über ssh; aber es vergleicht zuerst beide
    Seiten und schickt nur, was sich geändert hat: ideal für ein Backup,
    das man oft wiederholt.

    GUTE PRAXIS
    - Der Schrägstrich am Ende der Quelle zählt, bei rsync:
      /srv/freigabe/ kopiert den Inhalt, /srv/freigabe kopiert das Verzeichnis.
    - Immer zuerst einen Probelauf machen (rsync -n, oder --dry-run), vor
      allem mit --delete, das auf der anderen Seite löscht, was es in der
      Quelle nicht mehr gibt.
    - Ein eigener Schlüssel für jede automatisierte Aufgabe (id_sicherung),
      nicht der Schlüssel einer Person; auf dem Server kann man ihn in
      authorized_keys noch weiter einschränken (Option restrict).
    - Nie FTP oder telnet: Sie schicken Passwörter im Klartext durchs Netz.
      scp, sftp und rsync gehen über ssh.

    DOKUMENTATION
    - scp: https://man.openbsd.org/scp
    - rsync: https://download.samba.org/pub/rsync/rsync.1
    - authorized_keys, Option restrict: https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
