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
    (Here: restic -r repository --password-file file init|snapshots|ls|find|diff|dump|restore|backup|forget|prune|check|stats|key; see man restic)

## cryptsetup, mkfs.ext4, dd

cryptsetup-usage =
    Usage: cryptsetup [-?vyrqVDIMPTcsdhlwSbo] [OPTION...] <action> <action-specific>
    (Here: cryptsetup luksFormat|open|close|status|luksDump|luksAddKey|luksRemoveKey|luksKillSlot|isLuks|luksUUID; see man cryptsetup)
cryptsetup-only-luks2 = (The game only simulates LUKS2, cryptsetup's default type: leave out --type, or write --type luks2.)
mkfs-only-ext4 = (The game only makes ext4 file systems: mkfs.ext4 DEVICE.)
dd-random-endless = dd: { $file } never runs dry: give count= (and bs=) to say how much to read. (On a real system, dd would keep reading until you stop it with Ctrl-C.)

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
