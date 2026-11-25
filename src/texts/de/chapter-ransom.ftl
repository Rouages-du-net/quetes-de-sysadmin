### Geschichte „Die Ludothek“, Kapitel 1 „Das Lösegeld“: Ransomware,
### sie stoppen, ein Offline-Backup finden und wiederherstellen. Befehle,
### Pfade und die Meldungen von ps, mount, restic, crontab werden nicht
### übersetzt. Die Adressen und die Wallet sind erfunden.

chapter-ransom = Das Lösegeld
    .summary = Montagmorgen, alle Dateien der Ludothek sind verschlüsselt: den Angriff stoppen, verstehen, warum die Kopie auf dem NAS nutzlos ist, und von der Offline-Platte wiederherstellen.

## Dateien

ransom-message-berenice =
    Eine Nachricht von Bérénice, Vorsitzende der Ludothek:

    „Katastrophe! Heute Morgen lässt sich keine einzige Datei auf der
    Freigabe (/srv/freigabe) mehr öffnen: Alle enden auf .locked, und eine
    Nachricht verlangt Geld. Wir zahlen nicht.

    Wir haben jede Nacht eine Kopie von allem auf dem NAS (/mnt/nas). Und
    Malo macht jeden Sonntag ein Backup auf die USB-Platte aus der
    Schublade, die er danach absteckt (heute Morgen steckt sie am Server,
    ist aber nicht eingehängt). Das Passwort dieses Backups liegt im Tresor:
      bauer-springer-turm-27

    Ich überlasse es dir. Für sudo: wuerfel-2027.“
ransom-note =
    IHRE DATEIEN SIND VERSCHLÜSSELT.
    Um sie zurückzubekommen, senden Sie 0,5 Bitcoin an die Adresse
    bc1q-example-fictitious-address innerhalb von 72 Stunden.
    Danach sind Ihre Dateien verloren.
ransom-crontab-root = Kopie der Freigabe auf das NAS, jede Nacht um 2:30
# Die Option, mit der der Verschlüsseler läuft, und das Label der USB-Backup-Platte.
ransom-option-quiet = --leise
ransom-usb-label = SICHERUNG
ransom-inventory =
    spiel;exemplare;zustand
    Leiterspiel;3;gut
    Mensch ärgere dich nicht;2;gut
    Dame;4;ein Stein fehlt
    Mikado;2;gut
    Domino;5;gut
    Tier-Memo;2;gut
ransom-schedule =
    Öffnungszeiten im Juni
    Mittwoch 14 - 18 Uhr: zwei Ehrenamtliche
    Samstag 10 - 12 Uhr: eine ehrenamtliche Person und der Spielregel-Workshop
    Samstag 14 - 18 Uhr: drei Ehrenamtliche (Spielefest am 26.)
ransom-shows =
    SPIELEFEST — Samstag, 26. Juni, Marktplatz
    Holzspiele, Dameturnier, Ecke für die Kleinsten.
    Kostenlos, offen für alle.
ransom-rules-goose =
    Das Gänsespiel
    Alle würfeln mit zwei Würfeln und ziehen so viele Felder vor.
    Eine Gans: noch einmal genauso weit vorziehen. Der Brunnen: warten,
    bis jemand anderes kommt und dich befreit. Wer zuerst auf Feld 63
    kommt, gewinnt (man muss genau darauf landen).
ransom-rules-horses =
    Mensch ärgere dich nicht
    Mit einer 6 bringt man eine Figur aus dem Haus. Man läuft einmal um
    das Brett und zieht dann in die Zielfelder ein. Wer eine 6 würfelt,
    darf noch einmal.
ransom-rules-ladies =
    Dame
    Die Steine ziehen diagonal, nach vorn. Man schlägt, indem man über
    einen gegnerischen Stein springt; Schlagen ist Pflicht. Ein Stein, der
    die letzte Reihe erreicht, wird zur Dame.

## Ereignisse

ransom-event-extent =
    Alles ist verschlüsselt, und in jedem Verzeichnis wartet eine
    Lösegeldforderung. Wir zahlen nicht: Nichts garantiert, dass wir etwas
    zurückbekommen, und es finanziert den nächsten Angriff. Bevor du
    irgendetwas wiederherstellst, musst du wissen, ob der Angriff vorbei
    ist: Läuft noch ein Programm (ps aux)? Und das Log der letzten Nacht
    (journalctl) verrät vielleicht, wie er hereingekommen ist.
ransom-event-encryptor-seen =
    Ein Programm, versteckt in /home/empfang/.cache, das unter dem Konto
    empfang läuft und die ganze CPU frisst: Das ist der Verschlüsseler. Du
    musst ihn stoppen (er gehört einem anderen Konto: man kill, und sudo).
    Dann such nach dem, was ihn wieder starten könnte.
ransom-event-nas =
    Auch auf dem NAS ist alles .locked: Letzte Nacht um 2:30 hat die
    automatische Kopie (rsync --delete, in der crontab von root) die
    verschlüsselten Dateien treu kopiert und die guten gelöscht. Eine
    synchronisierte Kopie, die immer angeschlossen ist, ist kein Backup:
    Sie kopiert auch den Schaden. Bleibt die Platte aus der Schublade (lsblk).
ransom-event-reencrypted =
    Einige wiederhergestellte Dateien wurden gerade wieder verschlüsselt:
    Der Verschlüsseler läuft noch. Man löscht kein Feuer, indem man die
    Möbel zurück ins Haus trägt: erst stoppen, dann wiederherstellen.
ransom-event-key-too-early =
    Vorsicht: Die Backup-Platte ist angeschlossen, während der
    Verschlüsseler noch läuft. Diesmal darf er nicht auf sie schreiben
    (ihre Dateien gehören root), aber mit einem anderen Konto hätte auch
    das letzte Backup draufgehen können. Stopp zuerst den Angriff und häng
    ein Backup nur lesend ein (mount -o ro).
# Der Verschlüsseler, neu gestartet von der crontab des Kontos empfang
ransom-return =
    Der Verschlüsseler ist zurück (ps aux)! Etwas startet ihn in
    regelmäßigen Abständen neu. Wo stehen die geplanten Aufgaben eines
    Kontos? (man crontab)
ransom-event-restored =
    Die sechs Dateien sind zurück, im Stand von Sonntagabend: Was sich
    seitdem geändert hat (diesmal fast nichts), ist verloren. Räum jetzt
    die .locked-Dateien und die Lösegeldforderungen weg und nimm die
    Backup-Platte wieder vom Netz.
ransom-event-end =
    Die Freigabe ist sauber, der Angriff gestoppt, das schuldige Konto
    gesperrt, und das Backup wieder offline. Bérénice: „Und keinen Cent
    gezahlt. Malo hatte recht, diese Platte jeden Sonntag abzustecken.“

    Gut gemacht! Du hast Kapitel 1 von „Die Ludothek“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: ssh ludothek.)

    WAS PASSIERT IST
    Das Passwort des Kontos empfang wurde erraten (journalctl: drei
    Fehlschläge, dann eine Anmeldung, um 3 Uhr morgens). Ein Programm hat
    alles verschlüsselt, was dieses Konto ändern konnte, und sich in seine
    crontab eingetragen, um wiederzukommen. Die nächtliche Kopie auf das
    NAS, immer angeschlossen, hat den Schaden kopiert. Nur das
    abgesteckte Offline-Backup hat überlebt.

    GUTE PRAXIS
    - Nicht zahlen; den Angriff melden (in Deutschland bei der Polizei,
      Hilfe beim BSI; cybermalveillance.gouv.fr in Frankreich).
    - Zuerst den Angriff stoppen: den Prozess, das, was ihn neu startet
      (crontab, Dienste), das benutzte Konto (gesperrt, Passwort geändert).
    - Erst dann wiederherstellen, aus einem nur lesend eingehängten
      Backup; prüfen; dann wieder vom Netz nehmen.
    - Die 3-2-1-Regel: mindestens eine Offline- oder unveränderliche
      Kopie. Eine Synchronisation (rsync --delete) ist kein Backup.
    - Lange Passwörter, keine SSH-Anmeldung mit Passwort aus dem Internet,
      und fail2ban.

    DOKUMENTATION
    - Leitfaden der ANSSI (auf Französisch): https://cyber.gouv.fr/publications/attaques-par-rancongiciels-tous-concernes
    - Leitfaden der CISA: https://www.cisa.gov/stopransomware/ransomware-guide
    - Wiederherstellen mit restic: https://restic.readthedocs.io/en/stable/050_restore.html
    - mount: https://man7.org/linux/man-pages/man8/mount.8.html
