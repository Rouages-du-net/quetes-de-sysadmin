### rsync und crontab: die Bemerkungen des Spiels (die eigenen Meldungen von
### rsync und cron bleiben auf Englisch, wie bei den echten Werkzeugen).

rsync-usage =
    usage: rsync [OPTION]... SRC [SRC]... DEST
    rsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]
    (Beispiel: rsync -av ~/verzeichnis/ /mnt/backup/verzeichnis/; siehe man rsync)
crontab-usage =
    usage: crontab [-u user] [-l | -r | -e] [file]
    (Um deine geplanten Aufgaben zu bearbeiten: crontab -e; siehe man crontab)
crontab-retry = (Die crontab wurde nicht installiert. Führe crontab -e noch einmal aus, um sie zu korrigieren: Das Handbuch, man crontab, erklärt die fünf Zeitfelder genau.)

## restic

restic-usage =
    Usage:
      restic [command]
    (Hier: restic -r repository --password-file datei init|snapshots|ls|find|diff|dump|restore|backup|forget|prune|check|stats|key; siehe man restic)
restic-sftp-init = (Das Spiel legt kein Repository über sftp an: Führe restic init auf der Maschine aus, die es aufnehmen soll.)

## cryptsetup, mkfs.ext4, dd

cryptsetup-usage =
    Usage: cryptsetup [-?vyrqVDIMPTcsdhlwSbo] [OPTION...] <action> <action-specific>
    (Hier: cryptsetup luksFormat|open|close|status|luksDump|luksAddKey|luksRemoveKey|luksKillSlot|isLuks|luksUUID; siehe man cryptsetup)
cryptsetup-only-luks2 = (Das Spiel simuliert nur LUKS2, den Standardtyp von cryptsetup: Lass --type weg oder schreib --type luks2.)
mkfs-only-ext4 = (Das Spiel legt nur ext4-Dateisysteme an: mkfs.ext4 GERÄT.)
dd-random-endless = dd: { $file } versiegt nie: Gib count= (und bs=) an, um zu sagen, wie viel gelesen werden soll. (Auf einem echten System würde dd weiterlesen, bis du es mit Strg-C stoppst.)

## rsnapshot

rsnapshot-usage =
    rsnapshot 1.4.5
    Usage: rsnapshot [-vtxqVD] [-c cfgfile] [command] [args]
    Type "man rsnapshot" for more information.

## PostgreSQL (psql, pg_restore)

psql-interactive = (In diesem Spiel öffnet sich psql nicht im interaktiven Modus: Gib die Abfrage mit -c "…" an oder eine Datei mit -f. Siehe man psql.)
pg-restore-input =
    pg_restore: Fehler: entweder -d/--dbname oder -f/--file muss angegeben werden
    Versuchen Sie »pg_restore --help« für weitere Informationen.

## MariaDB (die Hilfe des mariadb-Monitors, mariadb-admin ohne Befehl): die eigene Ausgabe des Werkzeugs, auf Englisch.

mariadb-monitor-help =
    General information about MariaDB can be found at
    https://mariadb.org

    List of all client commands:
    Note that all text commands must be first on line and end with ';'
    ?         (\?) Synonym for `help'.
    clear     (\c) Clear the current input statement.
    ego       (\G) Send command to MariaDB server, display result vertically.
    exit      (\q) Exit mysql. Same as quit.
    go        (\g) Send command to MariaDB server.
    help      (\h) Display this help.
    quit      (\q) Quit mysql.
    source    (\.) Execute an SQL script file. Takes a file name as an argument.
    status    (\s) Get status information from the server.
    use       (\u) Use another database. Takes database name as argument.

    For server side help, type 'help contents'
mariadb-admin-usage =
    { $program }  Ver 10.0 Distrib 11.8.9-MariaDB, for debian-linux-gnu on x86_64
    Usage: { $program } [OPTIONS] command command....
    Where command is one or more of: ping, status, processlist, kill id,id,..., variables, extended-status, version, flush-privileges, create databasename, drop databasename, shutdown, start-slave, stop-slave
