### rsync et crontab : remarques du jeu (les messages de rsync et de cron,
### eux, restent en anglais, comme les vrais outils).

rsync-usage =
    usage: rsync [OPTION]... SRC [SRC]... DEST
    rsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]
    (Exemple : rsync -av ~/dossier/ /mnt/sauvegarde/dossier/ ; voir man rsync)
crontab-usage =
    usage: crontab [-u user] [-l | -r | -e] [file]
    (Pour modifier tes tâches planifiées : crontab -e ; voir man crontab)
crontab-retry = (La crontab n'est pas installée. Relance crontab -e pour corriger : le manuel, man crontab, détaille les cinq champs de l'heure.)

## restic

restic-usage =
    Usage:
      restic [command]
    (Ici : restic -r dépôt --password-file fichier init|snapshots|ls|find|diff|dump|restore|backup|forget|prune|check|stats|key ; voir man restic)

## cryptsetup, mkfs.ext4, dd

cryptsetup-usage =
    Usage: cryptsetup [-?vyrqVDIMPTcsdhlwSbo] [OPTION...] <action> <action-specific>
    (Ici : cryptsetup luksFormat|open|close|status|luksDump|luksAddKey|luksRemoveKey|luksKillSlot|isLuks|luksUUID ; voir man cryptsetup)
cryptsetup-only-luks2 = (Le jeu ne simule que LUKS2, le type par défaut de cryptsetup : omettez --type, ou écrivez --type luks2.)
mkfs-only-ext4 = (Le jeu ne crée que des systèmes de fichiers ext4 : mkfs.ext4 PÉRIPHÉRIQUE.)
dd-random-endless = dd : { $file } ne se tarit jamais : donnez count= (et bs=) pour dire combien lire. (Sur un vrai système, dd lirait jusqu'à ce que vous l'arrêtiez avec Ctrl-C.)

## rsnapshot

rsnapshot-usage =
    rsnapshot 1.4.5
    Usage: rsnapshot [-vtxqVD] [-c cfgfile] [command] [args]
    Type "man rsnapshot" for more information.

## PostgreSQL (psql, pg_restore)

psql-interactive = (Dans ce jeu, psql ne s'ouvre pas en mode interactif : donner la requête avec -c "…", ou un fichier avec -f. Voir man psql.)
pg-restore-input =
    pg_restore: error: one of -d/--dbname and -f/--file must be specified
    Try "pg_restore --help" for more information.
