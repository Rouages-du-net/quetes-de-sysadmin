### Histoire « Le Club photo », chapitre 3 « Les Portables » : un partage
### Samba (smb.conf, testparm, smbpasswd, masques, smbclient). La
### configuration, les chemins et les sorties des outils ne sont pas
### traduits.

chapter-samba-share = Les Portables
    .summary = Les portables Windows des membres doivent ouvrir les photos aussi, sur le Wi-Fi du club. Un partage Samba pour le club seulement, où une photo ajoutée par un membre peut être retouchée par les autres.

## Fichiers

samba-share-message-margot =
    De :     Margot
    À :      toi
    Objet :  Et nos portables ?

    Bonjour,

    L'ordinateur du labo fait des merveilles. Maintenant, Sam et Nora
    voudraient ouvrir les photos depuis leurs portables (Windows), sur le
    Wi-Fi du club (192.0.2.0/24). Samba est installé sur le NAS (smbd
    tourne), mais ne partage encore rien.

    - Un partage « photos » avec /srv/photos, pour les membres du club
      seulement. Tom a quitté le club : il garde son compte sur le NAS
      pour ses anciens fichiers, mais pas d'accès au partage.
    - Une photo ajoutée par un membre doit pouvoir être retouchée par les
      autres.
    - Pas d'accès invité, évidemment.

    Même mot de passe sudo : obturateur-2028. Pour les essais, le mot de
    passe du portable de Sam sera negatif-2028, celui de Nora diapo-2028
    (ils les changeront).

    Margot

## Événements

samba-share-event-share =
    Un partage sert /srv/photos. testparm vérifie smb.conf (sudo testparm
    -s), smbclient l'essaie depuis ici : smbclient //localhost/photos -U
    sam -c "ls". smbd lit smb.conf à chaque nouvelle connexion : pas
    besoin de redémarrer pour un partage.
samba-share-event-unknown =
    testparm ne connaît pas un des paramètres : il est ignoré, comme s'il
    n'était pas là. Vérifie son orthographe dans man smb.conf (valid
    users, read only, create mask…).
samba-share-event-logon-failure =
    Samba refuse la connexion : il garde ses propres mots de passe,
    distincts de ceux d'Unix (man smbpasswd : -a). Chaque membre en a
    besoin d'un : sudo smbpasswd -a sam.
samba-share-event-read-only =
    Le partage est en lecture seule : c'est le défaut de Samba. read only
    = no (ou writable = yes) dans la section du partage.
samba-share-event-guest =
    guest ok = yes laisse entrer n'importe qui sur le Wi-Fi, sans mot de
    passe (en tant que nobody). Le club a demandé l'inverse : retire-le,
    et liste qui peut entrer (valid users = @club).
samba-share-event-tom =
    N'importe quel compte du NAS peut entrer dans ce partage, Tom compris,
    dès qu'il a un mot de passe Samba. valid users = @club réserve le
    partage aux membres du groupe.
samba-share-event-passwords =
    Sam et Nora peuvent se connecter. Essaie d'ajouter une photo en tant
    que Sam (smbclient … -c "put /tmp/contact-sheet.jpg sheet.jpg"), puis
    regarde ses droits sur le NAS : Nora pourrait-elle la retoucher ?
samba-share-event-masks =
    Regarde les droits du nouveau fichier (ls -l) : par défaut, Samba crée
    les fichiers en rw-r--r-- (create mask = 0744), et seul·e leur
    auteur·rice peut les modifier. Pour le club : create mask = 0664 et
    directory mask = 2775 (et les fichiers doivent appartenir au groupe
    club : force group = club, ou le setgid de /srv/photos).
samba-share-event-firewall =
    Le partage est prêt, mais les portables sont sur le Wi-Fi, et le
    pare-feu du NAS ne laisse entrer que SSH et NFS : SMB utilise le port
    445 (ufw connaît l'application « Samba »). Ouvre-le au réseau du club
    seulement.
samba-share-event-end =
    Les portables ouvrent \\nas\photos avec le mot de passe Samba de
    chaque membre ; Tom et les invité·es restent dehors, et une photo
    ajoutée par l'un·e est retouchable par les autres. Margot : « Nora a
    retouché le héron de Sam. Il est ravi. Presque. »

    Bravo ! Tu as terminé le chapitre « Les Portables ».

    CE QUI S'EST PASSÉ
    Samba était installé mais ne partageait rien. Un partage pour le
    groupe du club, des mots de passe Samba pour ses membres, des masques
    pour que le groupe puisse écrire, et le pare-feu ouvert au réseau du
    club.

    UN PARTAGE SAMBA
    - Dans /etc/samba/smb.conf : [photos], path = /srv/photos, read only
      = no, valid users = @club, create mask = 0664, directory mask =
      2775, force group = club.
    - testparm -s après chaque modification ; smbd lit le fichier à
      chaque nouvelle connexion.
    - smbpasswd -a NOM : le mot de passe propre à Samba ; pdbedit -L les
      liste.
    - smbclient //serveur/partage -U NOM -c "ls" pour l'essayer.

    BONNES PRATIQUES
    - Pas de guest ok sur un partage de fichiers personnels.
    - Les droits Linux s'appliquent toujours sous Samba : les masques et
      le groupe décident qui peut modifier quoi.
    - SMB seulement sur le réseau local (445), jamais ouvert sur Internet.

    DOCUMENTATION
    - smb.conf(5) : https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html
    - smbpasswd(8) : https://www.samba.org/samba/docs/current/man-html/smbpasswd.8.html
    - Debian : https://wiki.debian.org/Samba/ServerSimple
