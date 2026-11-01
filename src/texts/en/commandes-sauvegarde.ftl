### rsync and crontab: the game's remarks (rsync's and cron's own
### messages stay in English, like the real tools).

rsync-usage =
    usage: rsync [OPTION]... SRC [SRC]... DEST
    rsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]
    (Example: rsync -av ~/folder/ /mnt/backup/folder/; see man rsync)
crontab-usage =
    usage: crontab [-u user] [-l | -r | -e] [file]
    (To edit your scheduled tasks: crontab -e; see man crontab)
crontab-retry = (The crontab was not installed. Run crontab -e again to fix it: the manual, man crontab, details the five time fields.)

## restic

restic-usage =
    Usage:
      restic [command]
    (Here: restic -r repository --password-file file snapshots|ls|find|diff|dump|restore|backup|forget|prune|check|stats; see man restic)
restic-init = (Here, the repository already exists: you don't create a new one. See man restic.)

## rsnapshot

rsnapshot-usage =
    rsnapshot 1.4.5
    Usage: rsnapshot [-vtxqVD] [-c cfgfile] [command] [args]
    Type "man rsnapshot" for more information.

## PostgreSQL (psql, pg_restore)

psql-interactive = (In this game, psql does not open in interactive mode: give the query with -c "…", or a file with -f. See man psql.)
pg-restore-input =
    pg_restore: error: one of -d/--dbname and -f/--file must be specified
    Try "pg_restore --help" for more information.
