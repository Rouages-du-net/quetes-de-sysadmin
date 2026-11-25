### Geschichte „Die Ludothek“, Kapitel 3 „Die Datenbank“: eine
### PostgreSQL-Datenbank mit pg_dump sichern, die Wiederherstellung prüfen,
### eine Tabelle reparieren. Die Befehle, das SQL und die Meldungen von
### PostgreSQL werden nicht übersetzt.

chapter-database = Die Datenbank
    .summary = Die Dateien einer laufenden Datenbank zu kopieren ist kein Backup: pg_dump jede Nacht, eine Probewiederherstellung, dann eine Tabelle, die in Eile zurück muss.

## Dateien

database-message-berenice =
    Eine Nachricht von Bérénice:

    „Die Ausleihen der Spiele stehen in einer PostgreSQL-Datenbank, ludo,
    auf dem Server. Malo sagt, sie wird gesichert, weil rsnapshot jede
    Nacht /var/lib/postgresql kopiert (seine Notiz liegt neben dieser).
    Aber eine Freundin, die in der IT arbeitet, hat mir gesagt, das sei
    kein echtes Backup.

    Könntest du dafür sorgen, dass die Datenbank wirklich jede Nacht
    gesichert wird (in /var/backups/postgresql), und prüfen, ob wir wüssten,
    wie man sie zurückspielt? Vor allem: Rühr die echte Datenbank nicht an,
    während du Dinge ausprobierst: Die Ehrenamtlichen tragen den ganzen Tag
    Ausleihen ein.

    Für sudo: wuerfel-2027.“
database-word-malo =
    Eine Notiz von Malo:

    „Die Dateien der Datenbank liegen in /var/lib/postgresql/16/main, und
    rsnapshot kopiert sie jede Nacht mit dem Rest. Um mit der Datenbank zu
    sprechen: psql. Das Konto mit allen Rechten auf die Datenbank heißt postgres.“
database-crontab-root = Snapshots (rsnapshot): wöchentlich montags um 3:00, täglich um 3:30
# Die Spalten der Tabellen, und die Viertel der Mitglieder.
database-columns-boardgames = id,name,exemplare
database-columns-members = id,karte,viertel
database-columns-loans = id,spiel_id,mitglied_id,ausgeliehen_am,zurueck_am
database-districts = nord,sued,ost,west,mitte
database-names-games = Leiterspiel,Mensch ärgere dich nicht,Dame,Mikado,Domino,Tier-Memo,Gänsespiel,Oware,Go,Vier gewinnt,Mancala,Tangram,Solitär,Schiffe versenken,Quartett

## Ereignisse

database-event-role =
    PostgreSQL kennt dich nicht: Über den lokalen Socket verbindest du dich
    unter dem Namen deines Kontos (Authentifizierung „peer“), und weder
    „du“ noch root ist eine Rolle in dieser Datenbank. Das Konto postgres
    dagegen hat alle Rechte: sudo -u postgres (man sudo).
database-event-on-live =
    Halt! Diese Wiederherstellung zielte auf ludo, die laufende Datenbank:
    Ihre Tabellen existieren schon, daher die Fehler. Über die echte
    Datenbank wiederherzustellen, um „es auszuprobieren“, riskiert, die
    Ausleihen von heute zu überschreiben. Eine Probewiederherstellung macht
    man in einer eigenen Datenbank (man createdb).
database-event-test-succeeded =
    Die Testdatenbank enthält genauso viele Spiele, Mitglieder und
    Ausleihen wie die echte: Das Backup lässt sich wiederherstellen. Nur so
    weiß man, dass ein Backup funktioniert. (Die Testdatenbank lässt sich
    mit dropdb löschen.)
database-incident =
    14:05 Uhr. Bérénice, in Panik: „Eine ehrenamtliche Person hat auf der
    Admin-Seite auf ‚Verlauf leeren‘ geklickt… Die Liste der Ausleihen ist
    leer! Die Spiele und die Mitglieder sind noch da. Kannst du die
    Ausleihen zurückholen, OHNE den Rest anzufassen?“
    (Prüfe mit psql: Wie viele Zeilen sind in ausleihen noch übrig? Dein
    Backup von heute Morgen enthält die ganze Tabelle; man pg_restore.)
database-event-duplicates =
    pg_restore weigert sich: Einige Ausleihen aus dem Backup sind schon in
    der Tabelle (duplicate key). Daten lädt man nur in eine leere Tabelle
    neu, oder indem man sie neu anlegt (--clean).
database-event-cron-root =
    Der Auftrag in der crontab von root führt pg_dump als root aus, und
    root ist keine Rolle in der Datenbank: Jede Nacht würde er scheitern
    (role "root" does not exist). Nimm die crontab des Kontos postgres
    (sudo crontab -u postgres -e), oder sudo -u postgres vor dem Befehl.
database-event-loans-returned =
    Die 1.873 Ausleihen sind zurück, und sonst hat sich nichts bewegt.
    Bérénice: „Puh!“
database-event-end =
    Die Datenbank wird jetzt wirklich jede Nacht gesichert, die
    Wiederherstellung ist geprüft, und die versehentlich geleerte Tabelle
    ist mit einem Befehl zurückgekommen.

    Gut gemacht! Du hast Kapitel 3 von „Die Ludothek“ abgeschlossen, und
    die ganze Geschichte.

    WAS PASSIERT IST
    Die Dateien einer laufenden Datenbank zu kopieren (wie rsnapshot es
    tat) kann eine inkonsistente Kopie ergeben: Die Datenbank schreibt
    während des Kopierens. pg_dump dagegen liest die Datenbank, wie sie zu
    einem bestimmten Zeitpunkt war, und erzeugt ein konsistentes Backup,
    ohne sie anzuhalten. Eine Wiederherstellung in eine Testdatenbank hat
    bewiesen, dass es funktioniert; dann hat pg_restore nur eine Tabelle
    zurückgespielt, die einzige betroffene.

    GUTE PRAXIS
    - Eine Datenbank mit ihrem eigenen Werkzeug sichern (pg_dump,
      mysqldump), jede Nacht, und das Archiv dann mit dem Rest kopieren
      (rsnapshot, restic, offline).
    - Das Custom-Format (-Fc): komprimiert, und man kann nur einen Teil
      davon wiederherstellen (-t).
    - Die Wiederherstellung regelmäßig testen, in einer eigenen Datenbank.
    - Was sich seit dem letzten Backup geändert hat, ist verloren: Um
      weniger zu verlieren, archiviert man das Log der Datenbank (WAL,
      Point-in-Time-Recovery).
    - Nie an der laufenden Datenbank experimentieren.

    DOKUMENTATION
    - Sichern mit pg_dump: https://www.postgresql.org/docs/16/backup-dump.html
    - Warum Dateien kopieren nicht reicht: https://www.postgresql.org/docs/16/backup-file.html
    - pg_restore: https://www.postgresql.org/docs/16/app-pgrestore.html
