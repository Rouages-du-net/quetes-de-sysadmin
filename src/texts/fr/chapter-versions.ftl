### Histoire « Les Archives », chapitre 2 « Les versions » : restic.
### Les commandes, chemins, identifiants d'instantanés et messages de
### restic (en anglais) ne se traduisent pas.

chapter-versions = Les versions
    .summary = Une sauvegarde qui garde l'erreur : retrouver la bonne version avec restic, puis faire de la place sans la perdre.

## Fichiers

versions-word-rosa =
    Un mot de Rosa, bibliothécaire :

    « Depuis janvier, le fonds vit sur ce nouveau serveur, et je le sauvegarde
    chaque nuit avec restic sur le disque que la mairie nous prête
    (/mnt/mairie). Les sauvegardes sont chiffrées : les agent·es de la mairie
    ne peuvent pas lire nos archives. Le mot de passe est dans
    ~/.config/restic/mot-de-passe (et sur papier, dans le coffre).

    Catastrophe : ce matin, la transcription du journal de Marie est pleine
    de fautes absurdes. Le stagiaire a lancé un script de « correction
    automatique » il y a quelques nuits. Et la sauvegarde de chaque nuit a
    fidèlement sauvegardé la version abîmée…

    Deux autres soucis : la mairie dit que notre disque est presque plein
    (df -h /mnt/mairie), et je ne sais plus si notre dépôt est en bon état.

    Peux-tu :
    1. retrouver la bonne version du journal et la remettre à sa place ;
    2. faire de la place sur le disque, sans jeter la bonne version ;
    3. vérifier que le dépôt est sain ?

    Mes commandes habituelles sont dans notes_restic.txt. »
versions-notes-restic =
    NOTES DE ROSA — RESTIC

    Toutes les commandes ont besoin du dépôt et du mot de passe :
      restic -r /mnt/mairie/restic-bibliotheque --password-file ~/.config/restic/mot-de-passe COMMANDE

    Les commandes que j'ai déjà utilisées :
      snapshots      la liste des sauvegardes (instantanés)
      ls ID          ce que contient un instantané

    Les autres (dump, find, diff, restore, forget, prune, check…) sont dans
    man restic. ID : les 8 premiers caractères suffisent, ou latest.
versions-journal =
    JOURNAL DE MARIE, COUTURIÈRE (1931-1940) — TRANSCRIPTION

    12 mars 1931. Le marché a brûlé cette nuit. Les marchandes ont sauvé ce
    qu'elles ont pu ; Fatou a perdu tous ses tissus. On a cousu jusqu'au
    matin pour qu'elle ait de quoi vendre samedi.

    3 juin 1936. Grève à l'atelier. Nous avons chanté dans la cour. Le
    patron a cédé : deux semaines de congés payés, la première fois de ma
    vie.

    9 septembre 1939. Ahmed est parti ce matin. J'ai brodé son nom dans la
    doublure de sa veste, pour qu'il ne l'oublie pas, là-bas.
versions-journal-damaged =
    JOURNAL DE MARIE, COUTURIÈRE (1931-1940) — TRANSCRIPTION

    12 mars 1931. Le marcher a brûler cette nuit. Les marchande on sauvé ce
    quelle on pu ; Fatou a perdu tout ses tissu. On a cousue jusqu'au
    matin pour quelle est de quoi vendre samedi.

    3 juin 1936. Grêve a l'atelier. Nous avons chanter dans la cour. Le
    patron a céder : deux semaine de congé payer, la première foi de ma
    vie.

    9 septembre 1939. Ahmed est partie ce matin. J'ai broder son nom dans la
    doublure de sa veste, pour qu'il ne l'oubli pas, la-bas.
versions-recipe-added = Ajout de janvier 2027 : le mafé de Fatou, dicté par sa petite-fille.
versions-image-tiff = (image TIFF, numérisation brute)

## Événements

# { $file } : le fichier du mot de passe
versions-event-password =
    Le dépôt est chiffré… mais son mot de passe est dans { $file },
    lisible par tous les comptes de la machine (ls -l). Rosa a un compte
    ici, et demain peut-être un stagiaire de plus. Qui doit pouvoir le lire ?
versions-event-bad-password =
    Mauvais mot de passe : sans lui, restic ne peut rien déchiffrer, pas même
    la liste des sauvegardes. C'est voulu. Perdre ce mot de passe, c'est
    perdre toutes les sauvegardes : gardez-en toujours une copie ailleurs
    (Rosa a la sienne au coffre).
versions-event-elsewhere =
    La bonne version du journal est revenue… mais pas à sa place : restic
    recrée le chemin complet sous le lieu donné à --target. Il reste à la
    remettre dans ~/fonds/manuscrits/.
versions-event-restored =
    Le journal de Marie est revenu, mot pour mot. C'est tout l'intérêt
    d'avoir des versions : une copie miroir (rsync --delete) aurait recopié
    l'erreur dès la première nuit.

    Pense aussi à la sauvegarde de cette nuit : tant qu'aucun instantané
    récent ne contient la bonne version, la garder dépend des anciens.
versions-event-lost =
    Plus aucun instantané ne contient la bonne version du journal : la
    politique de forget les a tous retirés. Sur un vrai serveur, ce serait
    perdu (sauf une autre copie ailleurs). Ici, tu peux recommencer le
    chapitre depuis le menu. Avant de supprimer, forget --dry-run montre ce
    qui partirait.
versions-event-forgotten-without-prune =
    forget a retiré des instantanés de la liste… mais df -h /mnt/mairie ne
    bouge pas : forget n'efface que les « étiquettes ». Les données ne
    partent qu'avec prune (ou forget --prune).
versions-event-place =
    Le disque respire : prune a supprimé les données qu'aucun instantané
    restant n'utilise (surtout les numérisations brutes de janvier). df -h
    /mnt/mairie le montre.
versions-event-end =
    Rosa relit le journal de Marie : « Le marché a brûlé cette nuit »,
    comme dans le cahier original. Le disque de la mairie a de la place, le
    dépôt est vérifié, et le mot de passe n'est plus à la portée de tous.

    Bravo ! Tu as terminé le chapitre 2 des Archives.

    CE QUI S'EST PASSÉ
    Un script a abîmé un fichier ; chaque nuit, la sauvegarde a gardé la
    version abîmée. Comme restic garde des instantanés, la bonne version
    était encore dans ceux d'avant le 2 février. Un miroir l'aurait perdue
    dès la première nuit.

    LA BONNE PRATIQUE
    - Garder des versions, et une politique claire : par exemple 7
      quotidiennes, 4 hebdomadaires, 12 mensuelles (forget --keep-daily 7
      --keep-weekly 4 --keep-monthly 12 --prune). Essayer avec --dry-run.
    - Une erreur peut rester invisible des jours : il faut des versions
      plus anciennes que le temps qu'on met à s'en apercevoir.
    - forget retire des instantanés ; seul prune rend la place.
    - restic check régulièrement, et une vraie restauration de temps en
      temps : une sauvegarde qu'on n'a jamais restaurée n'est qu'un espoir.
    - Chiffrer les sauvegardes qui dorment chez d'autres, et garder le mot
      de passe (fichier en 600, et une copie hors de la machine).

    UNE AUTRE VOIE
    rsnapshot (« Les instantanés », La Ludothèque) : chaque instantané est
    un simple dossier qu'on lit avec ls et qu'on recopie avec cp, sans
    outil pour restaurer ; mais pas de chiffrement, et une déduplication
    par fichier entier seulement. restic : chiffré, dédupliqué par
    morceaux, et un dépôt qui peut vivre ailleurs (sftp, stockage objet).

    LA DOCUMENTATION
    - Travailler avec un dépôt : https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - Restaurer : https://restic.readthedocs.io/en/stable/050_restore.html
    - Supprimer des instantanés : https://restic.readthedocs.io/en/stable/060_forget.html
