### Histoire « Les voisins Windows », chapitre « Caractères invisibles » :
### un script écrit sous Windows (fins de ligne CR LF) que bash ne sait pas
### lancer, comment le voir, le convertir et empêcher git de le ramener.
### Les commandes, contenus de fichiers et sorties d'outils ne sont pas
### traduits.

chapter-line-endings = Caractères invisibles
    .summary = Un script de sauvegarde écrit sur un portable Windows refuse même de démarrer sous Linux : trouvez le caractère invisible au bout de chaque ligne, convertissez le fichier et faites en sorte que git le garde propre.

## Commun à l'histoire

mixed-fleet-ops-readme =
    ops - les scripts de l'Atelier (compas)

    nightly-copy.sh    copie nocturne de /srv/projects/current vers /srv/nightly
                 (cron, 01:30, en tant que vous)

    Écrivez-les où vous voulez, poussez-les ici, lancez-les sur compas.
    Henrik

mixed-fleet-project-notes =
    Projets en cours - Atelier
    harbour-library : façade, indice C, pour le 30 novembre
    school-canteen : plan de la cuisine, revue client vendredi

mixed-fleet-plotter-conf =
    # Plotter - exporte les plans en PDF chaque matin à 06:00
    {"["}export]
    source = /srv/projects/current
    target = /mnt/plans/exports
    user = plotter

mixed-fleet-templates-readme =
    Cartouches et gabarits de l'Atelier. Demander à Ifeoma avant de les modifier.

mixed-fleet-handover =
    armoire - notes de passation (Priya, prestataire), 28 octobre 2029

    Windows Server 2022 Standard, serveur de fichiers de l'Atelier.
    C: système (100 Go), D: Data (500 Go) : les partages sont dans D:\Shares.

    Partages : plans (D:\Shares\plans) : projets, exports PDF, gabarits.
               scans (D:\Shares\scans) : le copieur y dépose ses scans.
    compas accède à plans avec le compte local compass-svc.

    OpenSSH Server est activé (intégré à Windows) : ssh arrive dans
    PowerShell. Votre clé est dans
    C:\ProgramData\ssh\administrators_authorized_keys (pour les
    administrateur·rices, Windows lit ce fichier, pas celui du profil).

    SMB1 est désactivé et le reste. Windows Update redémarre le serveur
    certains mardis, entre 03:00 et 03:30.

    Je m'occupe de ce serveur le premier lundi du mois ; pour le reste,
    écrivez-moi ce que vous avez vu, je prendrai le relais.
    Priya

## Fichiers

line-endings-email-ifeoma =
    De :  Ifeoma
    À :   vous

    Bonjour, et bienvenue à l'Atelier !

    Nos serveurs sont un peu panachés. compas, où vous êtes, est notre
    serveur Linux : il garde les sauvegardes des projets et fait tourner
    Plotter, le service qui exporte nos plans en PDF. À côté, armoire est
    le serveur Windows où tout le monde enregistre ses plans ; Priya, notre
    prestataire, l'a installé et s'en occupe.

    Premier sujet : Henrik a écrit un script pour la sauvegarde nocturne
    des projets en cours, sur son portable (Windows), et l'a mis dans
    ~/ops, le dépôt git de nos scripts. Il n'a jamais tourné : cette nuit,
    /srv/nightly est resté vide, et quand je l'essaie moi-même, il parle
    d'un « bad interpreter ». Le fichier a l'air parfaitement normal.

    Pourriez-vous trouver ce qui cloche, faire une sauvegarde, et faire en
    sorte que le prochain script venu d'une machine Windows ne recommence
    pas ?

    Merci !
    Ifeoma

## Événements

line-endings-event-bad-interpreter =
    « /bin/bash^M: bad interpreter » : le noyau a lu la ligne #! et
    cherché un programme nommé /bin/bash suivi d'un caractère invisible,
    affiché ^M. Ce caractère est un retour chariot (CR, \r, octet 0x0D) :
    Windows termine chaque ligne par CR LF (\r\n), Linux par LF (\n)
    seul. Regardez les octets du fichier plutôt que son texte : file,
    cat -A, od -c.
line-endings-event-carriage-return =
    « $'\r': command not found » : bash écrit le retour chariot entre $'…',
    sa façon de montrer les caractères qu'on ne voit pas. Pour bash, la
    ligne 5, vide, est une commande nommée \r, et SRC contient
    « /srv/projects\r » : ce répertoire n'existe pas. Chaque ligne porte
    un \r à sa fin.
line-endings-event-chmod =
    Le script était déjà exécutable (rwx dans ls -l) : les droits n'ont
    jamais été le problème. L'interpréteur nommé sur la première ligne,
    si.
line-endings-event-crlf =
    Le voilà : chaque ligne se termine par \r\n (^M$ pour cat -A, \r \n
    pour od -c, « with CRLF line terminators » pour file). Un éditeur
    sous Windows écrit cela ; bash ne connaît que \n. Convertissez le
    fichier en fins de ligne Unix (man dos2unix ; sed et tr savent le
    faire aussi).
line-endings-event-converted =
    nightly-copy.sh est au format Unix : plus aucun \r, les commandes intactes.
    Lancez-le.
line-endings-event-ran =
    /srv/nightly/current est là : la sauvegarde a tourné. Maintenant, pour
    que le prochain push d'Henrik ne ramène pas les \r : dites à git que
    ces fichiers sont du texte à fins de ligne LF (man gitattributes), et
    validez cela avec le script converti.
line-endings-event-committed =
    Le dépôt dit désormais que les *.sh sont du texte en LF, et son
    script est en LF : quel que soit l'éditeur d'Henrik, git stocke et
    extrait du LF.
line-endings-event-end =
    Ifeoma : « Il a tourné ! Et Henrik dit qu'il fera un pull avant de
    modifier, la prochaine fois. Merci. »

    Bravo ! Vous avez terminé le chapitre « Caractères invisibles ».

    CE QUI S'EST PASSÉ
    L'éditeur d'Henrik, sous Windows, a enregistré le script avec des fins
    de ligne CR LF. Sous Linux, le retour chariot (\r, ^M) s'est collé au
    dernier mot de chaque ligne : la ligne #! demandait « /bin/bash\r »
    (bad interpreter), bash lancé à la main a pris une ligne vide pour
    une commande nommée $'\r', et les variables gardaient un \r au bout
    de leur valeur. Vous l'avez vu avec file, cat -A ou od -c, avez
    converti le fichier, l'avez lancé, et avez ajouté un .gitattributes
    pour que git garde les scripts du dépôt en LF.

    BONNES PRATIQUES
    - Quand un script « a l'air normal » mais échoue bizarrement, regardez
      ses octets : file, cat -A (^M$ en fin de ligne), od -c (\r \n).
    - dos2unix (ou sed -i 's/\r$//', ou tr -d '\r' dans un tube) pour
      convertir ; unix2dos pour l'inverse.
    - Dans le dépôt, un .gitattributes avec « *.sh text eol=lf » (ou
      « * text=auto eol=lf ») : git stocke du LF et écrit du LF à
      l'extraction, quelle que soit la machine. Validez-le d'abord, puis
      les fichiers.
    - Sous Windows, les éditeurs savent enregistrer en LF (VS Code,
      Notepad++), et le réglage core.autocrlf de git convertit à
      l'extraction ; .gitattributes l'emporte, et voyage avec le dépôt.

    UNE AUTRE FAÇON
    WSL (le sous-système Windows pour Linux) fait tourner un vrai Linux
    sur le portable : un script écrit et essayé là a des fins de ligne LF,
    et rencontre bash avant de rencontrer compas.

    DOCUMENTATION
    - dos2unix(1) : https://waterlan.home.xs4all.nl/dos2unix/dos2unix.htm
    - gitattributes, les attributs eol et text : https://git-scm.com/docs/gitattributes
    - bash, la citation ANSI-C ($'…') : https://www.gnu.org/software/bash/manual/bash.html#ANSI_002dC-Quoting
