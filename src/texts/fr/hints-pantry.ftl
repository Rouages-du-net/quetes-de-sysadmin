### Indices gradués de L'Épicerie solidaire (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une piste,
### sans la commande exacte) et .solution (presque la réponse). Les noms de
### lieux sont ceux de names.ftl.

## Chapitre 1 — Le disque perdu

hint-lost-disk-disk =
    .lead = Trouvez le disque de sauvegarde parmi les disques du serveur : lequel est amovible, quel système de fichiers il porte, où il est monté (man lsblk).
    .solution = lsblk, puis lsblk -f : sdb1, ext4 étiqueté OFFSITE, monté sur /mnt/offsite.
hint-lost-disk-unmounted =
    .lead = On ne peut pas chiffrer un périphérique monté (man umount).
    .solution = sudo umount /mnt/offsite
hint-lost-disk-formatted =
    .lead = LUKS se met en place avec cryptsetup : son action qui écrit un nouvel en-tête sur un périphérique demande YES en majuscules, puis deux fois une phrase de passe. Celle de Mei est dans son mot (man cryptsetup).
    .solution = sudo cryptsetup luksFormat /dev/sdb1, puis YES, puis deux fois la phrase de passe de Mei.
hint-lost-disk-filesystem =
    .lead = Le périphérique chiffré doit être ouvert sous un nom, et le système de fichiers créé sur le périphérique en clair qui apparaît dans /dev/mapper (man cryptsetup, man mkfs.ext4).
    .solution = sudo cryptsetup open /dev/sdb1 offsite (phrase de passe de Mei), puis sudo mkfs.ext4 /dev/mapper/offsite.
hint-lost-disk-keyfile =
    .lead = La sauvegarde de nuit a besoin d'un fichier de clé : des octets aléatoires (dd lit /dev/urandom), lisible par root seul, puis ajouté dans un autre emplacement (man dd, man chmod, man cryptsetup luksAddKey).
    .solution = sudo dd if=/dev/urandom of=/root/offsite.key bs=512 count=8, sudo chmod 400 /root/offsite.key, sudo cryptsetup luksAddKey /dev/sdb1 /root/offsite.key (phrase de passe de Mei).
hint-lost-disk-passphrase =
    .lead = Un emplacement doit s'ouvrir avec la phrase de passe que Mei garde dans le gestionnaire : celle de son mot (man cryptsetup luksAddKey).
    .solution = sudo cryptsetup luksAddKey /dev/sdb1 --key-file /root/offsite.key, puis deux fois la phrase de passe de Mei.
hint-lost-disk-crypttab =
    .lead = /etc/crypttab nomme le disque : le nom du périphérique ouvert, son UUID LUKS, le fichier de clé, et les options d'un disque amovible (man crypttab ; l'UUID : cryptsetup luksUUID ou blkid).
    .solution = sudo nano /etc/crypttab, ajouter : offsite UUID=<l'UUID de sdb1> /root/offsite.key luks,noauto
hint-lost-disk-fstab =
    .lead = L'ancienne ligne de fstab monte une étiquette qui n'existe plus : elle doit monter le périphérique ouvert, sans faire attendre le démarrage (man fstab).
    .solution = sudo nano /etc/fstab, remplacer la ligne LABEL=OFFSITE par : /dev/mapper/offsite /mnt/offsite ext4 noauto,nofail 0 2
hint-lost-disk-copied =
    .lead = Le disque est vide : ouvrez-le, montez-le, et copiez-y les fichiers de l'épicerie depuis /srv (man cryptdisks_start, man rsync).
    .solution = sudo cryptdisks_start offsite (s'il est fermé), sudo mount /mnt/offsite, sudo rsync -a /srv/epicerie /mnt/offsite/
hint-lost-disk-closed =
    .lead = Avant que le disque parte : démontez-le, puis fermez le périphérique chiffré (man umount, man cryptsetup close ou man cryptdisks_stop).
    .solution = cd (pour sortir de /mnt/offsite), sudo umount /mnt/offsite, sudo cryptsetup close offsite
hint-lost-disk-note =
    .lead = La phrase de passe de Mei n'a rien à faire sur le serveur une fois dans un emplacement.
    .solution = rm mot_de_mei.txt
hint-lost-disk-end =
    .lead = Tout à la fois : LUKS avec la phrase de passe de Mei et un fichier de clé que seul root lit, crypttab (UUID, noauto) et fstab, les fichiers sur le disque, le disque fermé, le mot supprimé.
    .solution = sudo cryptsetup luksDump /dev/sdb1 (deux emplacements), cat /etc/crypttab /etc/fstab, sudo ls -l /root, lsblk (rien d'ouvert sous sdb1), ls (plus de mot).

## Chapitre 2 — Le double des clés

hint-spare-key-opened =
    .lead = Le disque est fermé : ouvrez-le comme le décrit crypttab, puis montez-le comme le fait fstab (man cryptdisks_start).
    .solution = sudo cryptdisks_start offsite, puis sudo mount /mnt/offsite.
hint-spare-key-job =
    .lead = Lisez le script de nuit : comment dit-il à restic où est le dépôt, et où est le mot de passe ?
    .solution = sudo cat /usr/local/sbin/nightly-backup : RESTIC_REPOSITORY=/mnt/offsite/restic, RESTIC_PASSWORD_FILE=/root/.restic-pass.
hint-spare-key-snapshots =
    .lead = Listez les instantanés du dépôt, en root, avec le dépôt et le fichier de mot de passe du script (man restic ; sudo vide l'environnement).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass snapshots (ou sudo RESTIC_REPOSITORY=… RESTIC_PASSWORD_FILE=… restic snapshots).
hint-spare-key-one-key =
    .lead = restic a une commande pour les clés qui ouvrent un dépôt (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key list : une seule clé, son mot de passe sur cagette seulement.
hint-spare-key-escrowed =
    .lead = Ajoutez un accès dont Mei garde le mot de passe : celui de son mot. Gardez la clé du script (man restic, key add).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key add, puis deux fois le mot de passe de Mei.
hint-spare-key-checked =
    .lead = Après avoir changé les clés du dépôt, vérifiez-le (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass check
hint-spare-key-note =
    .lead = Le mot de passe de Mei doit vivre hors du serveur.
    .solution = rm mot_de_mei.txt
hint-spare-key-closed =
    .lead = Laissez le disque comme vous l'avez trouvé : démonté et fermé (man cryptdisks_stop).
    .solution = sudo umount /mnt/offsite, puis sudo cryptdisks_stop offsite.
hint-spare-key-end =
    .lead = Tout à la fois : deux clés (celle du script et celle de Mei), une vérification après l'ajout de la sienne, aucune copie de son mot de passe sur cagette, le disque fermé.
    .solution = key list (deux clés), check, rm du mot, umount, cryptdisks_stop.

## Chapitre 3 — L'exercice de restauration

hint-restore-drill-plugged =
    .lead = L'exercice se passe sur le portable prêté : connectez-vous-y, puis trouvez le disque et son type (man ssh, man lsblk).
    .solution = ssh secours, puis lsblk -f : sdb1 crypto_LUKS.
hint-restore-drill-opened =
    .lead = Ouvrez le disque chiffré avec la phrase de passe du message de Fatou, celle de l'enveloppe (man cryptsetup open).
    .solution = sudo cryptsetup open /dev/sdb1 offsite, puis la phrase de passe du disque.
hint-restore-drill-mounted =
    .lead = Montez le périphérique ouvert sur un répertoire vide de votre choix (man mkdir, man mount).
    .solution = sudo mkdir /mnt/offsite, puis sudo mount /dev/mapper/offsite /mnt/offsite.
hint-restore-drill-snapshots =
    .lead = Ouvrez le dépôt avec le mot de passe restic de l'enveloppe, tapé quand restic le demande (man restic).
    .solution = sudo restic -r /mnt/offsite/restic snapshots, puis le mot de passe de secours restic.
hint-restore-drill-read-data =
    .lead = Vérifiez le dépôt en relisant chaque octet de ses données, pas seulement sa structure (man restic, check).
    .solution = sudo restic -r /mnt/offsite/restic check --read-data
hint-restore-drill-restored =
    .lead = Restaurez le dernier instantané à côté, sous un répertoire de votre choix (man restic, restore).
    .solution = sudo restic -r /mnt/offsite/restic restore latest --target /srv/restore
hint-restore-drill-verified =
    .lead = Le script a écrit les empreintes des fichiers dans SHA256SUMS : vérifiez-les depuis le répertoire où ils ont été restaurés (man sha256sum).
    .solution = cd /srv/restore/srv/epicerie, puis sha256sum -c SHA256SUMS.
hint-restore-drill-no-dump =
    .lead = La ligne 6 de la liste : cherchez la sauvegarde de la base dans les sauvegardes (man restic, find).
    .solution = sudo restic -r /mnt/offsite/restic find pantry.sql : rien.
hint-restore-drill-fixed =
    .lead = Sur cagette, le script doit aussi sauvegarder l'export de la base : sa ligne restic backup ne nomme qu'un répertoire.
    .solution = exit (retour sur cagette), sudo nano /usr/local/sbin/nightly-backup : restic backup /srv/epicerie /var/backups/pantry.sql
hint-restore-drill-closed =
    .lead = Sur secours, laissez le disque démonté et fermé (man umount, man cryptsetup close).
    .solution = ssh secours, cd, sudo umount /mnt/offsite, sudo cryptsetup close offsite.
hint-restore-drill-end =
    .lead = Tout à la fois : sur secours, le disque ouvert avec la phrase de passe, le dépôt avec le mot de passe de l'enveloppe, check --read-data, les fichiers restaurés et vérifiés, rien copié de cagette, le disque fermé ; sur cagette, le script sauvegarde l'export de la base.
    .solution = Refaites ce qui manque sur secours (ssh secours), et vérifiez /usr/local/sbin/nightly-backup sur cagette.
