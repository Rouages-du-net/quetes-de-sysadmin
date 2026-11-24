### rsync y crontab: los comentarios del juego (los mensajes propios de
### rsync y de cron se quedan en inglés, como en las herramientas reales).

rsync-usage =
    usage: rsync [OPTION]... SRC [SRC]... DEST
    rsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]
    (Ejemplo: rsync -av ~/carpeta/ /mnt/backup/carpeta/; mira man rsync)
crontab-usage =
    usage: crontab [-u user] [-l | -r | -e] [file]
    (Para editar tus tareas programadas: crontab -e; mira man crontab)
crontab-retry = (El crontab no se ha instalado. Vuelve a ejecutar crontab -e para corregirlo: el manual, man crontab, detalla los cinco campos de la hora.)

## restic

restic-usage =
    Usage:
      restic [command]
    (Aquí: restic -r repositorio --password-file archivo init|snapshots|ls|find|diff|dump|restore|backup|forget|prune|check|stats|key; mira man restic)
restic-sftp-init = (El juego no crea un repositorio por sftp: ejecuta restic init en la máquina que lo va a guardar.)

## cryptsetup, mkfs.ext4, dd

cryptsetup-usage =
    Usage: cryptsetup [-?vyrqVDIMPTcsdhlwSbo] [OPTION...] <action> <action-specific>
    (Aquí: cryptsetup luksFormat|open|close|status|luksDump|luksAddKey|luksRemoveKey|luksKillSlot|isLuks|luksUUID; mira man cryptsetup)
cryptsetup-only-luks2 = (El juego solo simula LUKS2, el tipo por defecto de cryptsetup: quita --type, o escribe --type luks2.)
mkfs-only-ext4 = (El juego solo crea sistemas de archivos ext4: mkfs.ext4 DISPOSITIVO.)
dd-random-endless = dd: { $file } nunca se agota: indica count= (y bs=) para decir cuánto leer. (En un sistema real, dd seguiría leyendo hasta que lo detuvieras con Ctrl-C.)

## rsnapshot

rsnapshot-usage =
    rsnapshot 1.4.5
    Usage: rsnapshot [-vtxqVD] [-c cfgfile] [command] [args]
    Type "man rsnapshot" for more information.

## PostgreSQL (psql, pg_restore)

psql-interactive = (En este juego, psql no se abre en modo interactivo: da la consulta con -c "…", o un archivo con -f. Mira man psql.)
pg-restore-input =
    pg_restore: error: one of -d/--dbname and -f/--file must be specified
    Try "pg_restore --help" for more information.

## MariaDB (la ayuda del monitor mariadb, mariadb-admin sin comando): la salida propia de la herramienta, en inglés.

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
