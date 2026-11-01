### Indices gradués de La Ludothèque (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — La rançon

hint-ransom-restored =
    .piste = D'abord arrêter l'attaque : un programme tourne encore (ps aux), et la crontab de son compte le relance. Ensuite seulement, la sauvegarde hors ligne : le disque USB du tiroir (lsblk -f), monté en lecture seule, contient un dépôt restic. La copie du NAS, elle, est chiffrée aussi.
    .solution = sudo kill 3141 ; sudo crontab -u accueil -r ; sudo mount -o ro /dev/sdb1 /mnt/cle ; sudo restic -r /mnt/cle/depot restore latest --target / (mot de passe : pion-cavalier-tour-27)
hint-ransom-end =
    .piste = Les fichiers sont revenus. Il reste à fermer la porte d'entrée (le compte dont le mot de passe a été deviné), à jeter les .locked et les demandes de rançon, et à remettre la sauvegarde hors ligne (hors de /mnt/cle pour démonter).
    .solution = sudo usermod -L accueil ; sudo find /srv/partage -name "*.locked" -delete ; sudo find /srv/partage -name LISEZ-MOI-POUR-RECUPERER.txt -delete ; cd ; sudo umount /mnt/cle

## Chapitre 2 — Les instantanés

hint-snapshots-error-berenice =
    .piste = Règle /etc/rsnapshot.conf : snapshot_root sur le second disque, des niveaux retain (7 quotidiens, 4 hebdomadaires), une ligne backup pour /srv/partage/ — avec des TABULATIONS entre les éléments. rsnapshot configtest vérifie, puis c'est cron (celui de root) qui le lance.
    .solution = Dans sudo nano /etc/rsnapshot.conf : snapshot_root⇥/mnt/instantanes/, retain⇥daily⇥7 et retain⇥weekly⇥4 (à la place des lignes alpha, beta et gamma), backup⇥/srv/partage/⇥localhost/ (⇥ = Tab) ; sudo rsnapshot configtest ; puis dans sudo crontab -e : 30 3 * * * /usr/bin/rsnapshot daily et 0 3 * * 1 /usr/bin/rsnapshot weekly
hint-snapshots-end =
    .piste = L'instantané le plus récent (.0) a été pris après l'erreur de Bérénice. Compare l'inventaire des instantanés plus anciens avec diff, et reprends celui de la nuit d'avant.
    .solution = sudo cp /mnt/instantanes/daily.1/localhost/srv/partage/inventaire.csv /srv/partage/ (daily.1 : la nuit d'avant, si tes niveaux s'appellent daily).

## Chapitre 3 — La base

hint-database-test-succeeded =
    .piste = Une vraie sauvegarde d'une base qui tourne, c'est pg_dump, lancé sous le compte postgres (sudo -u). Et une sauvegarde ne vaut que si elle se restaure : essaie-la dans une base de test à part (man createdb, man pg_restore), jamais par-dessus ludo.
    .solution = sudo -u postgres pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo ; sudo -u postgres createdb ludo_test ; sudo -u postgres pg_restore -d ludo_test /var/backups/postgresql/ludo.dump
hint-database-loans-returned =
    .piste = La table prets de ludo est vide, le reste est intact. pg_restore sait ne remettre qu'une table (-t), et que ses données dans une table vide.
    .solution = sudo -u postgres pg_restore -d ludo --data-only -t prets /var/backups/postgresql/ludo.dump
hint-database-end =
    .piste = Il reste à faire ce pg_dump chaque nuit, sous un rôle de la base : root n'en est pas un. La crontab de quel compte ?
    .solution = sudo crontab -u postgres -e, et y ajouter : 15 2 * * * pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo
