### Histoire « La Cantine », chapitre 4 « Le disque en retard » : un montage
### qui arrive après le service qui en a besoin (RequiresMountsFor=,
### nofail, ce que cache un point de montage). Les noms d'unités, les
### chemins et les messages de systemd ne se traduisent pas.

chapter-late-disk = Le disque en retard
    .summary = Les réservations de ce matin ont disparu du disque USB de la cantine. Elles ne sont pas perdues : elles sont cachées. Retrouve-les, et fais attendre son disque à l'appli.

## Fichiers

late-disk-message-ibrahim =
    De :      Ibrahim
    À :       toi
    Objet :   Les réservations du matin ont disparu !

    Bonjour,

    Catastrophe : la cuisine ouvre la liste du jour (l'appli l'écrit dans
    /srv/data/bookings/, un fichier par jour) et les réservations de ce
    matin n'y sont pas. Des gens ont réservé entre 6 h 30 et 9 h, je les ai
    vus dans l'appli, et le fichier du jour n'existe même pas sur le disque.

    /srv/data, c'est notre vieux disque USB (dans /etc/fstab, avec nofail
    depuis le jour où il était débranché et où le serveur ne démarrait plus,
    souviens-toi du Labo). Il y a eu un redémarrage tôt ce matin, pour les
    mises à jour.

    Peux-tu retrouver les réservations du matin et les remettre sur le
    disque ? Et faire en sorte que ça ne recommence pas au prochain
    redémarrage. Mot de passe lentilles-2028.

    Ibrahim

late-disk-header = heure;nom;couverts
late-disk-bookings =
    06:41;Amadou;2
    06:58;Claire;1
    07:12;Rui;4
    07:30;Mei;2
    07:52;Youssef;3
    08:05;Hanna;1
    08:17;Kwame;2
    08:33;Lucia;5
    08:46;Tomasz;1
    08:59;Nadia;2
late-disk-old-bookings =
    10:02;Amadou;2
    10:45;Rui;3
    11:10;Hanna;1

## Événements

late-disk-event-hidden =
    La voilà : la liste du jour, avec les réservations du matin. Elle était
    bien là, dans /srv/data… mais sur le disque système, dans le dossier sur
    lequel le disque USB est monté. Un montage cache ce que contenait le
    dossier (c'est toujours là, intact) ; démonté, ça réapparaît. Mets-la à
    l'abri, puis remets-la sur le disque USB.
late-disk-event-order =
    « Mounted srv-data.mount » : le disque USB est arrivé vers 25 secondes
    après le début du démarrage, et l'appli avait démarré bien avant. Avec
    nofail, rien n'attend ce montage. Où l'appli a-t-elle donc écrit la
    liste de ce matin ? (findmnt, et que contient /srv/data sans son
    disque ?)
late-disk-event-recovered =
    Les réservations du matin sont de retour sur le disque USB : la cuisine a
    sa liste. Reste la cause : au prochain redémarrage, l'appli démarrera
    encore avant le disque. Dis à systemd qu'elle a besoin de /srv/data
    (man systemd.unit : RequiresMountsFor=), puis redémarre pour vérifier.
late-disk-event-no-nofail =
    Sans nofail, tout le démarrage attend le disque USB : l'appli démarre
    bien après lui. Mais le jour où le disque manquera, le serveur s'arrêtera
    en mode de secours, comme une fois déjà. RequiresMountsFor= sur l'appli
    seule aurait laissé le serveur démarrer.
late-disk-event-end =
    Après le redémarrage, le disque USB a été monté d'abord, puis l'appli a
    démarré et a écrit dessus. Ibrahim : « Et les réservations de ce matin
    sont là. La cuisine peut servir ! »

    Bravo ! Tu as terminé le chapitre « Le disque en retard ».

    CE QUI S'EST PASSÉ
    Le disque USB met environ 25 secondes à apparaître au démarrage. Sa
    ligne de fstab a nofail (pour que le serveur démarre même sans lui), et
    avec nofail rien n'attend le montage. L'appli a démarré la première et
    a écrit la liste du jour dans /srv/data… le dossier vide du disque
    système. Quand le disque USB a été monté par-dessus, il a caché ce
    fichier : pour tout le monde, la liste avait disparu. Elle était
    seulement cachée.

    CE QUE CACHE UN POINT DE MONTAGE
    - Monter un disque sur un dossier cache le contenu de ce dossier sans
      l'effacer ; le démonter le fait réapparaître.
    - Pour regarder sans démonter : monter le disque système ailleurs
      (mount --bind / /mnt/root), puis regarder dans /mnt/root/srv/data.
    - Un piège classique : un service qui écrit avant que son disque soit
      là, ou une sauvegarde qui remplit le disque système en l'absence du
      disque de sauvegarde.

    LA CORRECTION
    - RequiresMountsFor=/srv/data dans la section {"["}Unit] de l'appli :
      l'appli requiert le montage de /srv/data et démarre après lui. Si le
      disque manque, l'appli ne démarre pas (mieux qu'écrire au mauvais
      endroit), et le serveur démarre quand même.
    - Garder nofail pour un disque qui peut manquer ; l'enlever fait attendre
      tout le démarrage, et l'arrête en mode de secours si le disque n'est
      pas là.

    DOCUMENTATION
    - RequiresMountsFor= : https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#RequiresMountsFor=
    - nofail et les montages au démarrage : https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - mount, umount : https://man7.org/linux/man-pages/man8/mount.8.html
