### Histoire « Les voisins Windows », chapitre « De l'autre côté » : le
### volume du partage est plein, mais pas à cause du partage ; un coup
### d'œil dans le serveur Windows par son OpenSSH et PowerShell, en lecture
### seule. Les commandes, cmdlets, chemins et sorties ne sont pas traduits.

chapter-full-volume = De l'autre côté
    .summary = Le partage Windows est plein alors que le partage lui-même ne l'est pas : allez voir dans le serveur Windows par son OpenSSH, lisez-le avec quelques cmdlets PowerShell, et notez ce qui remplit le disque pour la personne qui s'en occupe.

## Fichiers

full-volume-email-ifeoma =
    De :  Ifeoma
    À :   vous

    Bonjour,

    Plotter n'a pas réussi à enregistrer les PDF de ce matin sur armoire :
    « No space left on device », dit son journal
    (/var/log/plotter/export.log). C'est étrange : nos plans ne sont pas
    si gros, et personne n'a rien ajouté cette semaine, que je sache.

    Priya vient le premier lundi du mois, et c'est elle qui administre
    armoire : ne modifiez rien dessus, s'il vous plaît. Mais vous y avez
    un compte (elle y a mis votre clé), et elle dit que c'est « OpenSSH,
    intégré à Windows ». Pourriez-vous aller voir ce qui la remplit, et
    noter ce que vous trouvez dans rapport-armoire.txt ? Je le lui
    enverrai.

    Ifeoma

full-volume-report =
    armoire - pourquoi le partage est plein (pour Priya)

    Le volume plein :
    Ce qui le remplit (chemin complet) :
    Depuis quand :
    Vu dans le journal des événements :

## Événements

full-volume-event-full =
    df le dit : le volume du partage est plein (100 %), environ 500 Go.
    C'est le disque d'armoire, compté par armoire, pas seulement le
    dossier du partage. Combien le partage lui-même contient-il ? (du)
full-volume-event-outside =
    Le partage contient environ 60 Go, le volume 500 Go : ce qui le
    remplit est sur le même disque, mais hors du partage, là où compas ne
    voit pas. Pour y regarder, il faut être sur armoire : son OpenSSH,
    intégré à Windows, ouvre un PowerShell.
full-volume-event-deleted-drawings =
    Attention : c'étaient les plans de l'Atelier, et faire de la place
    n'est pas votre décision ici. Le partage n'occupe qu'une fraction du
    volume : ce qui le remplit est ailleurs.
full-volume-event-powershell =
    « PS C:\Users\vous> » : vous êtes sous Windows, dans PowerShell. Les
    commandes s'appellent des cmdlets, nommées verbe-nom (Get-ChildItem,
    Get-Service), leurs paramètres commencent par un tiret (-Recurse), et
    la casse ne compte pas. Certains noms Linux marchent comme alias (ls,
    cat, cd, pwd). Get-Help NOM est le manuel ; Get-Command liste ce qui
    existe.
full-volume-event-linux-habit =
    Toutes les commandes Linux n'ont pas d'alias PowerShell : grep, df ou
    du n'existent pas ici. Leurs équivalents sont des cmdlets : Get-Volume
    ou Get-PSDrive pour les disques, Get-ChildItem pour les fichiers,
    Where-Object pour filtrer. Get-Help et Get-Command pour les trouver.
full-volume-event-parameter =
    ls n'est qu'un alias de Get-ChildItem, et Get-ChildItem n'a ni -l ni
    -a : ses paramètres ont des noms (-Force pour les fichiers cachés,
    -Recurse pour descendre). Get-Help Get-ChildItem les liste.
full-volume-event-volume =
    D: (Data) : 500 Go, il reste environ 11 Mo. C'est le volume des
    partages (D:\Shares). Qu'est-ce qui le remplit ? Get-ChildItem sait
    descendre tout le lecteur (-Recurse), et ses objets se trient par
    taille avant qu'on les regarde.
full-volume-event-culprit =
    Le voilà : plans-full-2029-11-03.zip, plus de 400 Go, dans D:\Backup,
    hors des partages, écrit le 3 novembre. Une copie complète des plans,
    zippée et oubliée. Notez-le dans rapport-armoire.txt (le volume, le
    fichier, depuis quand) ; le journal des événements dira peut-être
    depuis quand Windows se plaint (Get-WinEvent ou Get-EventLog).
full-volume-event-event-log =
    L'événement 2013 de srv (le serveur de fichiers) : « The D: disk is at
    or near capacity », toutes les quelques heures depuis le 18 novembre.
    Windows le disait ; personne ne lisait.
full-volume-event-read-only =
    Vous êtes là pour lire : armoire, c'est à Priya de la modifier. Notez
    ce que vous avez trouvé ; elle fera ce qu'il faut.
full-volume-event-end =
    Ifeoma : « J'ai envoyé votre rapport à Priya. Elle a compris tout de
    suite : le 3 novembre, avant de déplacer le partage, elle avait zippé
    tous les plans par précaution, et oublié le zip. Elle l'a supprimé de
    chez elle, et Plotter livrera les PDF de demain. Elle demande si vous
    voulez venir lundi, voir le côté Windows. »

    Bravo ! Vous avez terminé le chapitre « De l'autre côté ».

    CE QUI S'EST PASSÉ
    Le partage était plein parce que son volume l'était : df sous Linux
    montre le disque du serveur, du seulement le partage. Le reste était
    hors de vue de Linux. Par l'OpenSSH d'armoire (intégré à Windows
    depuis 2019), vous êtes arrivé·e dans PowerShell, avez trouvé le volume
    (Get-Volume, Get-PSDrive), le fichier (Get-ChildItem -Recurse, trié
    par Length) et les avertissements que Windows avait écrits
    (Get-WinEvent). Vous avez lu, noté, et laissé la modification à la
    personne qui administre le serveur.

    BONNES PRATIQUES
    - df et du ne mesurent pas la même chose : sur un partage réseau, df
      est le volume du serveur.
    - PowerShell passe des objets, pas du texte : triez et choisissez sur
      les propriétés (Sort-Object Length -Descending, Select-Object -First
      5), et laissez la mise en forme pour la fin.
    - Get-Help et Get-Command sont le manuel : le réflexe « le manuel
      d'abord » tient aussi sous Windows.
    - Sur un serveur que vous n'administrez pas, lisez et rapportez : le
      volume, le fichier avec son chemin complet, la date, les événements.
    - Surveillez les disques des serveurs dont vous dépendez (un partage
      qui se remplit arrête des services de l'autre côté).

    UNE AUTRE FAÇON
    Le PowerShell de Linux (pwsh) fait tourner les mêmes cmdlets sous
    Linux ; Windows Admin Center et l'Explorateur montrent la même chose
    en fenêtres. WSL apporte un Linux aux postes Windows, dans l'autre
    sens. Administrer Windows est une histoire à part entière.

    DOCUMENTATION
    - OpenSSH pour Windows : https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview
    - Get-ChildItem : https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem?view=powershell-5.1
    - Get-Volume : https://learn.microsoft.com/powershell/module/storage/get-volume
    - Get-WinEvent : https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - À propos des pipelines : https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_pipelines?view=powershell-5.1
