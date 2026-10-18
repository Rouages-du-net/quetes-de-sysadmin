### rsync et crontab : remarques du jeu (les messages de rsync et de cron,
### eux, restent en anglais, comme les vrais outils).

rsync-usage =
    usage: rsync [OPTION]... SRC [SRC]... DEST
    rsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]
    (Exemple : rsync -av ~/dossier/ /mnt/sauvegarde/dossier/ ; voir man rsync)
crontab-usage =
    usage: crontab [-u user] [-l | -r | -e] [file]
    (Pour modifier tes tâches planifiées : crontab -e ; voir man crontab)
crontab-reessayer = (La crontab n'est pas installée. Relance crontab -e pour corriger : le manuel, man crontab, détaille les cinq champs de l'heure.)
