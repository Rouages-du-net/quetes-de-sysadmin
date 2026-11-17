### Histoire « L'École de musique », chapitre « Deux serrures » : les profs ne
### peuvent pas enregistrer dans leur partage sur le Windows Server de
### l'école ; permissions de partage et permissions NTFS, toutes deux trop
### fermées. Aussi les textes communs de l'histoire (la passation de
### Gabriel). Commandes, cmdlets, chemins et sorties ne sont pas traduits.

chapter-two-locks = Deux serrures
    .summary = Les profs ouvrent leur partage sur le Windows Server de l'école de musique mais n'y enregistrent rien : lisez les permissions du partage et les permissions NTFS des dossiers, et ouvrez les deux serrures pour les profs, et pour eux seuls.

## Fichiers

music-school-handover =
    portee - notes de passation (Gabriel, 30 novembre 2029)

    Le serveur : portee.internal (192.0.2.42), Windows Server 2022.
    Accès à distance : OpenSSH, intégré à Windows, avec ta clé. On
    arrive dans cmd.exe : tape powershell pour avoir PowerShell (exit
    pour revenir).

    Groupes locaux :
      Teachers   samir, lucia, yuki (les profs)
      Office     beatriz, tomasz (le secrétariat)

    Partages (D:\Shares sur le serveur) :
      Teachers   cours, partitions, enregistrements (les profs)
      Office     inscriptions et cotisations (le secrétariat)
      Public     affiches et emplois du temps (tout le monde lit)

    Cet été, j'ai déplacé les partages sur le nouveau disque (D:) et je
    les ai recréés avec New-SmbShare. Pendant la copie, j'ai gelé
    LessonPlans pour que personne ne modifie un fichier en plein milieu.

    Service :
      Agenda     réservations des cours et des salles
                 (http://portee.internal:8080), tourne sous son propre
                 compte local, svc_agenda.

    Tâche planifiée :
      Nightly Backup   chaque nuit à 1 h 30, C:\Scripts\backup.ps1 sous
                       svc_backup : copie D:\Shares dans D:\Backup\Shares.

    Journaux : D:\Logs (Agenda, Backup). Windows Update redémarre le
    serveur le dimanche à 3 h du matin quand une mise à jour le demande.

    Mots de passe : dans le gestionnaire de mots de passe de l'école
    (Mariam l'ouvre).

    Merci de prendre la suite, et bon courage !
    Gabriel

two-locks-email-samir =
    De :   Samir (coordinateur des profs)
    À :    vous
    Cc :   Mariam

    Bonjour, et bienvenue à l'école !

    Depuis la rentrée, nous, les profs, pouvons ouvrir notre partage
    (\\portee\Teachers) mais pas y enregistrer quoi que ce soit : Word
    dit que nous n'avons pas l'autorisation d'enregistrer à cet
    emplacement, et copier un fichier donne « Accès refusé ». Pareil
    pour Lucia, Yuki et moi, dans Scores comme dans LessonPlans. Le
    secrétariat n'a aucun souci avec son propre partage.

    Gabriel vous a laissé une passation (Documents\passation.txt). Avant
    de partir, il a dit « ça doit être les permissions », mais il n'a pas
    eu le temps de regarder.

    Il faut qu'on dépose les partitions du concert dans Scores avant la
    répétition de vendredi, et les plans de cours de décembre dans
    LessonPlans. Et s'il vous plaît : seulement nous, les profs. Le
    secrétariat ne doit pas pouvoir modifier nos fichiers (ni nous les
    siens).

    Samir

## Événements

two-locks-event-cmd =
    Vous êtes dans cmd.exe, le vieil interpréteur de commandes de
    Windows : son OpenSSH le lance quand aucun DefaultShell n'est défini.
    Il connaît dir, cd, type et les programmes (icacls, net, sc, whoami),
    pas les cmdlets de PowerShell. Tapez powershell pour lancer Windows
    PowerShell à l'intérieur (exit pour revenir).
two-locks-event-powershell =
    PS C:\Users\vous> : Windows PowerShell. Ses commandes, les cmdlets,
    s'appellent verbe-nom ; Get-Help NOM est le manuel, et Get-Command
    -Noun Smb* liste celles qui parlent de partages. D'où sont partagés
    les fichiers des profs ?
two-locks-event-shares =
    Get-SmbShare liste les partages : Teachers, c'est D:\Shares\Teachers
    sur le serveur (ceux qui finissent par $ sont les partages
    administratifs de Windows). Pour atteindre un fichier par un partage,
    on passe deux serrures : les permissions du partage
    (Get-SmbShareAccess), puis les permissions NTFS du dossier (Get-Acl,
    icacls).
two-locks-event-share-access =
    Voilà : sur le partage, Everyone (tout le monde) a Read, et rien de
    plus. C'est ce que New-SmbShare accorde quand on ne lui donne ni
    -ChangeAccess ni -FullAccess : quand Gabriel a recréé le partage cet
    été, il a eu la valeur par défaut. Par le partage, personne n'écrit,
    quoi que dise NTFS. Regardez aussi NTFS avant de changer quoi que ce
    soit.
two-locks-event-ntfs =
    NTFS donne Modify (modification) au groupe Teachers sur
    D:\Shares\Teachers, hérité par ce qu'il contient ((OI)(CI) : fichiers
    et dossiers), et le dossier n'hérite pas de D:\Shares (aucune ligne
    (I)) : seulement SYSTEM, les administrateurs, les profs et svc_backup
    (pour la sauvegarde). De ce côté, les profs peuvent écrire. Qui est
    dans Teachers ?
two-locks-event-members =
    Teachers : samir, lucia, yuki, tous les trois. C'est à un groupe qu'on
    donne des droits : quand un·e prof arrive ou part, on change le
    groupe, pas chaque dossier.
two-locks-event-share-fixed =
    Samir : « Scores marche ! Je viens d'y mettre les partitions du
    concert. Mais LessonPlans dit toujours Accès refusé, pour nous trois. »
    Le partage laisse maintenant les profs modifier : dans LessonPlans, c'est
    NTFS qui dit non. Regardez les permissions de ce dossier.
two-locks-event-share-fixed-all =
    Samir : « Scores et LessonPlans marchent, tous les deux ! »
two-locks-event-lessons =
    LessonPlans a ses propres permissions : aucun (I), son héritage est donc
    coupé, et les profs n'ont que (RX), lecture et exécution. Le gel de
    Gabriel pendant la copie de l'été, jamais levé. Redonnez Modify à
    Teachers sur ce dossier, pour ses fichiers et sous-dossiers aussi, ou
    rétablissez son héritage pour qu'il reçoive les entrées de
    D:\Shares\Teachers (man icacls : /grant, /inheritance).
two-locks-event-folder-only =
    Les profs peuvent maintenant créer des fichiers dans LessonPlans, mais pas
    modifier ceux qui y sont déjà : l'entrée ajoutée ne s'applique qu'au
    dossier. Sans (OI)(CI) (héritage objet, héritage conteneur), ses
    fichiers et sous-dossiers ne la reçoivent pas. Avec icacls, les
    indicateurs se mettent avant le droit.
two-locks-event-too-broad =
    Attention : des personnes qui ne sont pas profs peuvent maintenant
    modifier des fichiers du partage des profs (le secrétariat, ou
    n'importe qui, selon ce que vous avez ouvert). Par un partage,
    l'accès est le plus restrictif du partage et de NTFS : quand les deux
    sont ouverts à tout le monde, tout le monde écrit. Donnez les droits
    au groupe Teachers, et gardez au moins une serrure fermée aux autres.
two-locks-event-admin =
    Un·e prof dans Administrators passe toutes les serrures, partout sur
    le serveur : ses fichiers, ceux du secrétariat, ceux du système. Ce
    n'est pas une réparation, c'est enlever les serrures. Retirez-le ou
    retirez-la d'Administrators (Remove-LocalGroupMember) et donnez les
    droits au groupe Teachers.
two-locks-event-full-control =
    Par le partage et NTFS, les profs ont maintenant le contrôle total
    (Full Control) : ils pourraient changer les permissions eux-mêmes, ou
    s'approprier les fichiers. Change sur le partage et Modify sur NTFS
    suffisent pour travailler.
two-locks-event-end =
    Samir : « Lucia a enregistré les plans de décembre dans LessonPlans, j'ai
    mis les partitions dans Scores, et Beatriz a vérifié : elle ne peut
    pas toucher à notre dossier. Parfait, merci ! On se voit au
    concert ? »

    Bravo ! Vous avez terminé le chapitre « Deux serrures ».

    CE QUI S'EST PASSÉ
    Les profs atteignent leurs fichiers par \\portee\Teachers, et deux
    jeux de permissions y décident : celles du partage et celles de NTFS.
    Windows garde la plus restrictive des deux. Le partage, recréé avec
    la valeur par défaut de New-SmbShare, ne donnait que Read à Everyone ;
    et LessonPlans, gelé pendant la copie de l'été, avait perdu son héritage
    et ne gardait que la lecture pour les profs. Deux serrures, toutes
    deux fermées : vous avez ouvert chacune, pour le seul groupe
    Teachers.

    BONNES PRATIQUES
    - Par un partage, l'accès effectif, ce sont les permissions du
      partage ET les permissions NTFS : la plus restrictive l'emporte.
      Lisez les deux : Get-SmbShareAccess, puis Get-Acl ou icacls.
    - Donnez les droits à des groupes (Teachers), pas à des personnes, et
      jamais l'écriture à Everyone.
    - Un choix courant : des permissions de partage larges
      (Authenticated Users, Change) et un NTFS précis, ou précis des deux
      côtés ; jamais larges des deux côtés.
    - (OI)(CI) pour que fichiers et sous-dossiers héritent ; un dossier
      dont l'héritage est coupé (aucun (I)) ne garde que ses propres
      entrées.
    - Administrators n'est pas une réparation de permissions, et le
      contrôle total permet de changer soi-même les permissions : Change
      et Modify suffisent.
    - Un gel « temporaire » s'écrit avec sa date de fin, et se lève.

    UNE AUTRE FAÇON DE FAIRE
    New-SmbShare -Name Teachers -Path D:\Shares\Teachers -ChangeAccess
    PORTEE\Teachers aurait créé le partage correctement du premier coup.
    Set-Acl avec une FileSystemAccessRule fait ce que fait icacls. Dans
    l'Explorateur, Propriétés > Sécurité > Avancé > Accès effectif montre
    l'accès d'un utilisateur. Et pour arriver directement dans PowerShell
    par ssh, l'OpenSSH de Windows lit DefaultShell sous
    HKLM:\SOFTWARE\OpenSSH (New-ItemProperty).

    DOCUMENTATION
    - Permissions de partage et NTFS : https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-shared-folders-and-ntfs
    - Grant-SmbShareAccess : https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess
    - icacls : https://learn.microsoft.com/windows-server/administration/windows-commands/icacls
    - Get-Acl : https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1
    - DefaultShell d'OpenSSH : https://learn.microsoft.com/windows-server/administration/openssh/openssh-server-configuration
