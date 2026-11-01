### Indices gradués du Labo (voir src/engine/hints.ts) : un message par
### étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans la
### commande exacte) et .solution (presque la réponse). Les noms des lieux
### sont ceux de names.ftl.

## Chapitre 1 — Le disque qui fatigue

hint-tired-disk-alert =
    .lead = Odile parle de courriers de smartd : lis-les (man mail, et le fichier de ta boîte). Le noyau, lui, garde la trace des erreurs de lecture (man dmesg).
    .solution = mail, puis cat /var/mail/vous (ou sudo dmesg) : sdb a des secteurs illisibles.
hint-tired-disk-arrays =
    .lead = Avant de toucher à un disque, regarde comment il sert : le RAID logiciel montre l'état de ses grappes dans un fichier de /proc (man mdadm).
    .solution = cat /proc/mdstat (ou sudo mdadm --detail /dev/md0) : md0 et md1, chacune avec une partition de sda et une de sdb.
hint-tired-disk-smart =
    .lead = Interroge sdb sur sa santé, en entier : identité, verdict, attributs (man smartctl). Puis compare avec sda.
    .solution = sudo smartctl -a /dev/sdb (Reallocated_Sector_Ct, Current_Pending_Sector), puis sudo smartctl -a /dev/sda.
hint-tired-disk-removed =
    .lead = Chaque partition de sdb doit quitter sa grappe : d'abord déclarée défectueuse, puis retirée (man mdadm). Il y a deux grappes.
    .solution = sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2, puis la même chose pour /dev/sdb3 dans /dev/md1.
hint-tired-disk-ticket =
    .lead = La procédure de l'hébergeur demande une seule information sur le disque : celle qui ne change jamais, même si les noms sda et sdb changent (man smartctl, ou man lsblk).
    .solution = sudo smartctl -i /dev/sdb (Serial Number), puis nano ~/ticket.txt : une demande de remplacement avec ce numéro, et pas celui de sda.
hint-tired-disk-end =
    .lead = Il faut tout à la fois : plus rien de sdb dans les grappes, sda toujours actif dans les deux, et un ticket qui ne cite que le numéro de série de sdb.
    .solution = cat /proc/mdstat ([U_] pour md0 et md1, sans sdb) et cat ~/ticket.txt (le numéro de sdb seulement).

## Chapitre 2 — Le disque neuf

hint-new-disk-new =
    .lead = Regarde les disques et leurs partitions : qu'a-t-on livré à la place de l'ancien sdb ? (man lsblk)
    .solution = lsblk : sdb n'a aucune partition ; cat /proc/mdstat : les grappes sont en [U_].
hint-new-disk-table =
    .lead = Le disque neuf doit être découpé exactement comme sda : sfdisk sait écrire la table d'un disque sous forme de script, et un autre sfdisk sait la relire (man sfdisk). Attention au sens.
    .solution = sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (puis lsblk pour vérifier).
hint-new-disk-added =
    .lead = Chaque nouvelle partition rejoint la grappe de sa jumelle sur sda (man mdadm, l'ajout d'un membre).
    .solution = sudo mdadm --manage /dev/md0 --add /dev/sdb2, puis sudo mdadm --manage /dev/md1 --add /dev/sdb3.
hint-new-disk-rebuilt =
    .lead = La reconstruction prend du temps : suis-la dans le fichier qui montre l'état des grappes, jusqu'à ce qu'elles soient complètes.
    .solution = cat /proc/mdstat, plusieurs fois, jusqu'à [UU] pour md0 et md1.
hint-new-disk-grub =
    .lead = Le serveur doit pouvoir démarrer sur le disque neuf : le chargeur de démarrage s'installe sur le disque entier (man grub-install).
    .solution = sudo grub-install /dev/sdb
hint-new-disk-end =
    .lead = Il faut tout à la fois : sdb découpé comme sda, les deux grappes complètes et à jour, et GRUB sur sdb.
    .solution = lsblk, cat /proc/mdstat ([UU] partout), sudo grub-install /dev/sdb si ce n'est pas fait.

## Chapitre 3 — La place qui manque

hint-more-room-full =
    .lead = Regarde l'occupation des systèmes de fichiers (man df) : lequel est plein, et sur quel périphérique ?
    .solution = df -h : /srv, sur /dev/mapper/labo-photos, est plein à 97 %.
hint-more-room-lvm =
    .lead = /srv est un volume logique LVM : regarde ses trois étages, volumes physiques, groupes et volumes logiques (man pvs, man vgs, man lvs).
    .solution = sudo vgs (VFree à 0), sudo pvs (md1 seul), sudo lvs ; puis lsblk : sdc et sdd sont neufs.
hint-more-room-array =
    .lead = Avant de donner les disques neufs à LVM, fais-en une grappe RAID 1, pour garder deux copies (man mdadm, la création d'une grappe).
    .solution = sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd, puis y pour confirmer.
hint-more-room-extended =
    .lead = La grappe neuve doit devenir un volume physique, puis entrer dans le groupe labo (man pvcreate, man vgextend).
    .solution = sudo pvcreate /dev/md2, puis sudo vgextend labo /dev/md2 (sudo vgs : VFree a grandi).
hint-more-room-grown =
    .lead = Agrandis le volume logique des photos, puis le système de fichiers qu'il porte (man lvextend, man resize2fs).
    .solution = sudo lvextend -r -l +100%FREE /dev/labo/photos (ou lvextend sans -r, puis sudo resize2fs /dev/labo/photos) ; df -h /srv pour vérifier.
hint-more-room-conf =
    .lead = La nouvelle grappe doit être déclarée dans /etc/mdadm/mdadm.conf, une seule fois : mdadm sait écrire sa ligne ARRAY (man mdadm). Attention, ce fichier appartient à root.
    .solution = sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf
hint-more-room-end =
    .lead = Le démarrage lit une copie de mdadm.conf, rangée dans l'initramfs : refais-le (man update-initramfs). Il faut aussi au moins 1,5 To libres sur /srv, et aucun disque seul dans le groupe.
    .solution = sudo update-initramfs -u

## Chapitre 4 — Le redémarrage qui coince

hint-stuck-boot-journal =
    .lead = Le message du mode secours dit où regarder : le journal de ce démarrage, avec ses explications (man journalctl).
    .solution = journalctl -xb (ou journalctl -b -p err) : « Timed out waiting for device /dev/sdc1 ».
hint-stuck-boot-disks =
    .lead = Qui est sdc aujourd'hui, et où est passé le disque USB ? Regarde les disques avec leurs systèmes de fichiers, leurs étiquettes et leurs UUID (man lsblk, man blkid).
    .solution = lsblk -f (ou blkid) : sdc est dans md2 ; le disque USB est sde, sa partition sde1 porte l'étiquette SCANS et un UUID.
hint-stuck-boot-fixed =
    .lead = Dans /etc/fstab, la ligne des scans doit désigner le disque par ce qui ne change pas, et ne pas bloquer le démarrage s'il manque (man fstab : UUID=, nofail).
    .solution = nano /etc/fstab : UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults,nofail  0  2 (l'UUID de blkid), puis findmnt --verify.
hint-stuck-boot-mounted =
    .lead = Essaie fstab sans redémarrer : mount sait monter tout ce que le fichier décrit (man mount). Et systemd doit relire le fichier (man systemctl).
    .solution = systemctl daemon-reload, puis mount -a, puis df -h /srv/scans.
hint-stuck-boot-end =
    .lead = Il reste à sortir du mode secours : reprendre le démarrage normal, comme le dit le message de la console (man systemctl).
    .solution = systemctl default (ou exit, ou reboot)
