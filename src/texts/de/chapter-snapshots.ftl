### Geschichte „Die Ludothek“, Kapitel 2 „Die Snapshots“: rsnapshot,
### harte Links, tägliche und wöchentliche Rotation, cron. Befehle, Pfade,
### Direktiven und die Meldungen von rsnapshot werden nicht übersetzt.

chapter-snapshots = Die Snapshots
    .summary = Zu jedem Tag der letzten zwei Wochen zurückkehren können: rsnapshot, seine Tabulatoren, seine harten Links, und cron.

## Dateien

snapshots-message-berenice =
    Eine Nachricht von Bérénice:

    „Nach dem Angriff möchte Malo, dass wir zu jedem Tag der letzten zwei
    Wochen zurückkehren können, ohne jedes Mal die USB-Platte
    anzuschließen. Er hat rsnapshot installiert; seine Konfiguration ist
    noch die von Debian mitgelieferte (/etc/rsnapshot.conf).

    Was wir brauchen:
      - /srv/freigabe/ sichern;
      - auf der zweiten Platte des Servers, eingehängt unter /mnt/snapshots
        (nicht auf der Systemplatte!);
      - 7 tägliche Snapshots und 4 wöchentliche behalten;
      - dass es von selbst läuft, jede Nacht und jede Woche.

    Malo hat einen Tipp dagelassen: „rsnapshot configtest vor allem
    anderen, und Vorsicht bei den Tabulatoren“. Für sudo: wuerfel-2027.“
# { $number }: die Nummer des hinzugefügten Spiels
snapshots-line-inventory = gespendetes Spiel Nr. { $number };1;neu
snapshots-inventory-old =
    spiel;exemplare;zustand
    Leiterspiel;3;gut
    Mensch ärgere dich nicht;2;gut

# Das Label der zweiten Platte (lsblk -f, blkid).
snapshots-disk-label = SNAPSHOTS

## Ereignisse

# { $mails }: die Zahl der von cron geschickten E-Mails
snapshots-two-weeks =
    Zwei Wochen vergehen. Jeden Tag trägt Bérénice die gespendeten Spiele
    ins Inventar ein; jede Nacht führt cron aus, was geplant ist. Schau
    dir an, was jetzt in /mnt/snapshots liegt (und die Post von cron:
    { $mails ->
        [0] keine Nachricht, alles ist gut gelaufen)
        [one] eine Nachricht; „nothing to copy“ ist in den ersten Tagen
            normal, solange es nicht genug tägliche Snapshots gibt)
       *[other] { $mails } Nachrichten; „nothing to copy“ ist in den
            ersten Tagen normal, solange es nicht genug tägliche Snapshots gibt)
    }.
snapshots-event-spaces =
    rsnapshot lehnt seine Konfiguration ab: In /etc/rsnapshot.conf werden
    die Elemente einer Zeile durch TABULATOREN getrennt, nie durch
    Leerzeichen (selbst wenn sie auf dem Bildschirm gleich aussehen). In
    nano schreibt die Tabulatortaste einen Tabulator.
snapshots-event-same-disk =
    Die Snapshots liegen auf der Systemplatte, neben den Daten: Fällt diese
    Platte aus, geht alles mit. Malo wollte die zweite Platte,
    /mnt/snapshots (snapshot_root).
# { $example }: der Anfang einer E-Mail von cron
snapshots-event-mails =
    cron hat Post geschickt: Seine Aufträge haben Fehler geschrieben. Zum
    Beispiel:

    { $example }

    Ein Auftrag in der crontab eines gewöhnlichen Kontos hat nicht die
    Rechte von root; einer in der crontab von root schon (sudo crontab -e).
snapshots-event-links =
    Der erste Snapshot belegt seine volle Größe, die nächsten fast nichts:
    Dateien, die sich nicht geändert haben, werden nicht neu kopiert,
    sondern verlinkt. ls -i zeigt dieselbe Inode-Nummer für dieselbe
    Datei in zwei Snapshots: eine einzige Datei, zwei Namen. Trotzdem
    sieht jeder Snapshot vollständig aus.
snapshots-event-error-berenice =
    Die Snapshots rotieren: sieben tägliche, und der erste wöchentliche.
    Und wie es der Zufall will, Bérénice: „Hoppla… Gestern Abend habe ich
    das Inventar durch eine alte Kopie von meinem USB-Stick ersetzt: Alle
    gespendeten Spiele sind weg! Kannst du es so zurückholen, wie es
    vorgestern war?“ (Der Snapshot von letzter Nacht hat schon die falsche
    Version: Schau dir die früheren an, diff hilft dir.)
snapshots-event-wrong-version =
    Das Inventar auf der Freigabe ist immer noch die alte Kopie: Der
    neueste Snapshot (.0) wurde NACH Bérénices Fehler gemacht. Du brauchst
    den aus der Nacht davor.
snapshots-event-end =
    Das Inventar ist zurück, mit allen gespendeten Spielen. Bérénice: „Und
    jeder Tag der letzten zwei Wochen ist da, ohne dass die Platte voll ist!“

    Gut gemacht! Du hast Kapitel 2 von „Die Ludothek“ abgeschlossen. (Das
    nächste erwartet dich: ssh ludothek.)

    WAS PASSIERT IST
    Jede Nacht hat rsnapshot die täglichen Snapshots rotiert: Das alte .0
    wird zu .1, und so weiter; das älteste wird gelöscht. Das neue .0 ist
    eine Kopie von .1 aus harten Links, die rsync aktualisiert: Nur
    geänderte Dateien belegen Platz. Einmal pro Woche wird der älteste
    tägliche zu einem wöchentlichen. Um Bérénices Fehler zu beheben,
    musste man nur die Datei aus dem Snapshot zurückkopieren, der vor dem
    Fehler gemacht wurde.

    GUTE PRAXIS
    - Snapshots auf einer anderen Platte (und zusätzlich eine
      Offline-Kopie: Ein Snapshot auf derselben Maschine schützt nicht vor allem).
    - configtest nach jeder Änderung; Tabulatoren, keine Leerzeichen.
    - Die seltenste Stufe läuft etwas vor der häufigsten, in der crontab
      von root.
    - Die Post von cron lesen: Dort kommen die Fehler an.
    - Das Wiederherstellen einer Datei üben, bevor man es braucht.

    EIN ANDERER WEG
    restic („Die Versionen“, Das Archiv) oder borg: Deduplizierung (eine
    geänderte Datei kopiert nur ihre geänderten Stücke), Verschlüsselung,
    entferntes Repository (sftp, Object Storage); aber man stellt mit dem
    Werkzeug wieder her (restic restore), nicht mit cp. rsnapshot:
    einfache Verzeichnisse, die man mit ls liest, aber keine
    Verschlüsselung und keine feine Deduplizierung, und man braucht ein
    Dateisystem, das harte Links unterstützt.

    DOKUMENTATION
    - rsnapshot: https://rsnapshot.org/rsnapshot/docs/docs.html
    - rsnapshot(1): https://manpages.debian.org/bookworm/rsnapshot/rsnapshot.1.en.html
    - Harte Links (ln): https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
