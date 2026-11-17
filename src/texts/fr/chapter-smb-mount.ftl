### Histoire « Les voisins Windows », chapitre « Le partage d'à côté » :
### le partage SMB d'un serveur Windows monté sous Linux (mount -t cifs),
### ses identifiants, ses propriétaires et sa ligne dans /etc/fstab. Les
### commandes, options, chemins et sorties d'outils ne sont pas traduits.

chapter-smb-mount = Le partage d'à côté
    .summary = Plotter doit enregistrer ses PDF sur le partage du serveur Windows : montez-le sous Linux avec un fichier d'identifiants, rendez-le inscriptible pour le service, et écrivez la ligne de fstab qui survit à un démarrage sans le serveur.

## Fichiers

smb-mount-email-ifeoma =
    De :  Ifeoma
    À :   vous

    Bonjour !

    Plotter, le service de compas qui exporte nos plans en PDF chaque
    matin (il tourne sous le compte plotter), devrait déposer les PDF sur
    armoire, dans le partage « plans », dossier exports : c'est là que
    tout le monde les cherche. Jusqu'ici il les gardait sur compas, et on
    les recopiait à la main.

    Priya a laissé ses notes (notes-de-priya.txt) : le partage, le compte
    qu'elle a créé pour compas, le mot de passe. Pourriez-vous monter le
    partage sur compas, dans /mnt/plans, de sorte que Plotter puisse y
    écrire, et qu'il revienne tout seul après un redémarrage ? Attention :
    armoire redémarre certains mardis la nuit pour Windows Update, et
    compas doit démarrer quand même si armoire est éteinte à ce moment-là.

    Henrik dit que sur son ancien NAS, il fallait toujours ajouter
    vers=1.0. Aucune idée de ce que ça veut dire.

    Ifeoma

smb-mount-notes-priya =
    Pour compas (Priya, 28 octobre 2029)

    Serveur de fichiers : armoire.internal (Windows Server 2022)
    Partage pour compas : plans  (D:\Shares\plans sur le serveur)
    Compte : compass-svc   mot de passe : Ruler-2029-cab
             (un compte local d'armoire ; il peut modifier les fichiers de plans)
    Le partage a aussi un dossier exports, pour Plotter.

    SMB1 est désactivé sur armoire, exprès. SMB 3, c'est très bien.
    Ne laissez pas traîner ce mot de passe une fois en place.

## Événements

smb-mount-event-listed =
    Les partages d'armoire : plans et scans, et ceux qui finissent par $
    (ADMIN$, C$, D$, IPC$), que Windows crée pour ses administrateur·rices.
    « SMB1 disabled » : smbclient a parlé SMB 3, et il n'y a pas de
    navigation NetBIOS. Maintenant, plutôt qu'une session ponctuelle de
    smbclient, un montage : man mount.cifs.
smb-mount-event-helper-missing =
    mount connaît le type cifs, mais il lui faut son assistant,
    /sbin/mount.cifs, qui lit les options, demande le mot de passe et
    passe le reste au noyau. Il vient dans un paquet qui n'est pas
    installé : cifs-utils.
smb-mount-event-helper =
    cifs-utils est installé : mount -t cifs (et mount.cifs) peuvent
    fonctionner.
smb-mount-event-smb1 =
    « Host is down » : armoire n'a pas refusé avec un message, elle a
    coupé la connexion. vers=1.0 demande SMB1, le protocole des années
    1980 derrière le ver WannaCry en 2017 ; Windows Server ne l'installe
    plus depuis 2019, et Priya le laisse désactivé. L'ancien NAS d'Henrik
    ne parlait que SMB1 ; armoire parle SMB 3. Omettez vers= (le noyau
    choisit la meilleure), ou demandez vers=3.0 ou 3.1.1.
smb-mount-event-denied =
    « Permission denied » (erreur 13) : armoire a refusé le compte ou le
    mot de passe. Vérifiez username= et le mot de passe (dans les notes de
    Priya), et que c'est bien à armoire que vous le demandez.
smb-mount-event-password-visible =
    Ça marche, mais ce mot de passe est maintenant dans l'historique de
    votre shell (history), et tant que mount.cifs tournait, n'importe qui
    sur compas pouvait le lire dans ps ou /proc/PID/cmdline. Mettez le
    compte et son mot de passe dans un fichier que seul root lit (man
    mount.cifs : credentials=), et désignez-le.
smb-mount-event-mounted =
    Le partage est monté : /mnt/plans, c'est D:\Shares\plans d'armoire.
    Regardez à qui appartient ce qu'il contient (ls -l), et demandez-vous
    sous quel compte tourne Plotter.
smb-mount-event-root-owned =
    Tout, dans /mnt/plans, appartient à root, avec les droits 755 :
    Plotter (le compte plotter) peut lire, pas écrire. Un serveur Windows
    n'a pas de propriétaires Unix à donner : le client Linux montre ceux
    des options du montage, root et 0755 par défaut. Ils se choisissent au
    montage (man mount.cifs : uid=, gid=, file_mode=, dir_mode=).
smb-mount-event-chown =
    chown et chmod n'ont rien dit, et rien n'a changé : sur un partage
    venu d'un serveur Windows, le propriétaire et les droits affichés
    viennent des options du montage, pas des fichiers. Remontez avec uid=
    et gid= (umount, puis mount à nouveau).
smb-mount-event-writable =
    plotter peut écrire dans /mnt/plans : le montage présente le partage
    comme le sien. Sur armoire, c'est toujours compass-svc qui écrit, avec
    les droits de ce compte sur le partage.
smb-mount-event-world-readable =
    Ce fichier d'identifiants peut être lu par d'autres que root : le mot
    de passe de compass-svc serait lisible par tous les comptes de compas.
    chmod 600, propriétaire root.
smb-mount-event-credentials =
    Le fichier d'identifiants est bon : à root, rw------- (600), avec le
    compte et son mot de passe, et plus rien sur la ligne de commande.
smb-mount-event-no-nofail =
    Sans nofail, un démarrage pendant lequel armoire est injoignable
    attend le montage et le marque en échec (et ce qui en dépend avec).
    Avec nofail, compas démarre quand même, et mount -a le monte plus
    tard. _netdev dit que c'est un système de fichiers réseau : attendre
    le réseau d'abord.
smb-mount-event-fstab-password =
    /etc/fstab est lisible par tous les comptes de compas : pas de mot de
    passe là-dedans. credentials= désigne le fichier que seul root lit.
smb-mount-event-fstab =
    La ligne de fstab est bonne : le partage plans d'armoire sur
    /mnt/plans, le fichier d'identifiants, les propriétaires qu'il faut à
    Plotter, _netdev et nofail. Essayez-la : umount /mnt/plans, puis
    mount -a (ou mount /mnt/plans).
smb-mount-event-end =
    Ifeoma : « Les PDF de ce matin sont dans exports ! Et Henrik a appris
    ce que voulait dire vers=1.0. Merci. »

    Bravo ! Vous avez terminé le chapitre « Le partage d'à côté ».

    CE QUI S'EST PASSÉ
    armoire partage ses dossiers en SMB, le protocole de partage de
    fichiers de Windows. Linux les monte avec le client cifs du noyau et
    son assistant, mount.cifs (paquet cifs-utils). Vous avez listé les
    partages avec smbclient, monté plans avec un fichier d'identifiants
    plutôt qu'un mot de passe sur la ligne de commande, donné aux
    fichiers le propriétaire qu'il fallait à Plotter (uid=, gid= : un
    serveur Windows n'a pas de propriétaires Unix à montrer), et écrit la
    ligne de fstab avec _netdev et nofail.

    BONNES PRATIQUES
    - Le mot de passe dans un fichier de root, en mode 600
      (credentials=), jamais sur une ligne de commande (history, ps) ni
      dans /etc/fstab (lisible par tous).
    - Un compte créé pour le serveur (compass-svc), avec seulement les
      droits qu'il lui faut sur le partage.
    - uid=, gid=, file_mode=, dir_mode= : à qui appartiennent les fichiers
      sous Linux se décide au montage ; chown et chmod n'y changent rien.
    - Jamais vers=1.0 : SMB1 est obsolète et dangereux ; laissez le noyau
      choisir (SMB 3.1.1 avec un Windows récent), ou demandez vers=3.0.
    - Dans fstab, _netdev et nofail pour un partage réseau : le démarrage
      ne dépend pas d'une autre machine. Testez la ligne avec umount, puis
      mount -a.

    UNE AUTRE FAÇON
    x-systemd.automount monte le partage au premier accès plutôt qu'au
    démarrage (et le remonte si armoire revient plus tard). Pour un
    partage que plusieurs utilisateur·rices Linux atteignent avec leur
    propre compte Windows, voyez l'option multiuser et Kerberos
    (sec=krb5) dans mount.cifs(8).

    DOCUMENTATION
    - mount.cifs(8) : https://manpages.debian.org/mount.cifs.8
    - Le client cifs du noyau : https://www.kernel.org/doc/html/latest/admin-guide/cifs/usage.html
    - SMBv1 sous Windows : https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3
    - systemd.mount, _netdev et nofail : https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
