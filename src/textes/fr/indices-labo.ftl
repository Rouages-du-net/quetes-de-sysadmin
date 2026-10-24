### Indices gradués du Labo (voir src/moteur/indices.ts) : un message par
### étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans la
### commande exacte) et .solution (presque la réponse). Les noms des lieux
### sont ceux de noms.ftl.

## Chapitre 1 — Le disque qui fatigue

indice-fatigue-alerte =
    .piste = Odile parle de courriers de smartd : lis-les (man mail, et le fichier de ta boîte). Le noyau, lui, garde la trace des erreurs de lecture (man dmesg).
    .solution = mail, puis cat /var/mail/vous (ou sudo dmesg) : sdb a des secteurs illisibles.
indice-fatigue-grappes =
    .piste = Avant de toucher à un disque, regarde comment il sert : le RAID logiciel montre l'état de ses grappes dans un fichier de /proc (man mdadm).
    .solution = cat /proc/mdstat (ou sudo mdadm --detail /dev/md0) : md0 et md1, chacune avec une partition de sda et une de sdb.
indice-fatigue-smart =
    .piste = Interroge sdb sur sa santé, en entier : identité, verdict, attributs (man smartctl). Puis compare avec sda.
    .solution = sudo smartctl -a /dev/sdb (Reallocated_Sector_Ct, Current_Pending_Sector), puis sudo smartctl -a /dev/sda.
indice-fatigue-retire =
    .piste = Chaque partition de sdb doit quitter sa grappe : d'abord déclarée défectueuse, puis retirée (man mdadm). Il y a deux grappes.
    .solution = sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2, puis la même chose pour /dev/sdb3 dans /dev/md1.
indice-fatigue-ticket =
    .piste = La procédure de l'hébergeur demande une seule information sur le disque : celle qui ne change jamais, même si les noms sda et sdb changent (man smartctl, ou man lsblk).
    .solution = sudo smartctl -i /dev/sdb (Serial Number), puis nano ~/ticket.txt : une demande de remplacement avec ce numéro, et pas celui de sda.
indice-fatigue-fin =
    .piste = Il faut tout à la fois : plus rien de sdb dans les grappes, sda toujours actif dans les deux, et un ticket qui ne cite que le numéro de série de sdb.
    .solution = cat /proc/mdstat ([U_] pour md0 et md1, sans sdb) et cat ~/ticket.txt (le numéro de sdb seulement).

## Chapitre 2 — Le disque neuf

indice-disque-neuf-neuf =
    .piste = Regarde les disques et leurs partitions : qu'a-t-on livré à la place de l'ancien sdb ? (man lsblk)
    .solution = lsblk : sdb n'a aucune partition ; cat /proc/mdstat : les grappes sont en [U_].
indice-disque-neuf-table =
    .piste = Le disque neuf doit être découpé exactement comme sda : sfdisk sait écrire la table d'un disque sous forme de script, et un autre sfdisk sait la relire (man sfdisk). Attention au sens.
    .solution = sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (puis lsblk pour vérifier).
indice-disque-neuf-ajoutes =
    .piste = Chaque nouvelle partition rejoint la grappe de sa jumelle sur sda (man mdadm, l'ajout d'un membre).
    .solution = sudo mdadm --manage /dev/md0 --add /dev/sdb2, puis sudo mdadm --manage /dev/md1 --add /dev/sdb3.
indice-disque-neuf-reconstruit =
    .piste = La reconstruction prend du temps : suis-la dans le fichier qui montre l'état des grappes, jusqu'à ce qu'elles soient complètes.
    .solution = cat /proc/mdstat, plusieurs fois, jusqu'à [UU] pour md0 et md1.
indice-disque-neuf-grub =
    .piste = Le serveur doit pouvoir démarrer sur le disque neuf : le chargeur de démarrage s'installe sur le disque entier (man grub-install).
    .solution = sudo grub-install /dev/sdb
indice-disque-neuf-fin =
    .piste = Il faut tout à la fois : sdb découpé comme sda, les deux grappes complètes et à jour, et GRUB sur sdb.
    .solution = lsblk, cat /proc/mdstat ([UU] partout), sudo grub-install /dev/sdb si ce n'est pas fait.
