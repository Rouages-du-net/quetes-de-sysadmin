### Histoire « L'Effaceur », chapitre 4 « La Sauvegarde » : rsync et cron.
### Les commandes, chemins, noms de fichiers et sorties de rsync et de cron
### (en anglais) ne se traduisent pas.

chapitre-backup = La Sauvegarde
    .resume = Plus jamais ça : sauvegarder avec rsync, chaque nuit avec cron, et savoir restaurer.

## Fichiers

backup-mot-de-maelle =
    Un mot de Maëlle, la gardienne du phare :

    « Depuis que l'Effaceur s'est arrêté, le royaume a retrouvé ses
    souvenirs (ils sont dans ~/souvenirs). Mais j'ai encore peur : et si
    quelque chose les effaçait de nouveau ?

    On m'a branché un disque de sauvegarde, monté sur /mnt/sauvegarde.
    Peux-tu :

    1. copier les souvenirs dans /mnt/sauvegarde/souvenirs ;
    2. faire en sorte que cette copie se refasse TOUTE SEULE, chaque nuit ;
    3. et me montrer qu'on sait les récupérer, le jour où il le faudra ?

    On m'a parlé de rsync et de cron. Tu trouveras tout dans man rsync et
    man crontab. »
backup-souvenir-first-letter =
    La première lettre arrivée au Port après le retour de la lumière. Elle
    commence par : « Chère Maëlle, nous avons vu le Phare depuis le large… »
backup-souvenir-lighthouse =
    Le soir où le Phare s'est rallumé : un faisceau qui balaie la mer, et la
    capitaine Ana qui hisse la voile.
backup-souvenir-village =
    Le Bourg en fête : le levain sauvé, l'horloge qui repart, l'école
    retrouvée.
backup-souvenir-nour =
    Nour, retrouvée dans la Galerie, qui rit en mangeant du fromage.
backup-souvenir-eraser =
    L'Effaceur qui vide enfin la Corbeille, comme au premier jour, et rien
    d'autre.
backup-souvenir-lighthouse-festival =
    La fête du Phare, aujourd'hui : tout le royaume sur la Jetée, et des
    lampions jusqu'à la Lanterne.

## La nuit (cron)

# { $fichier } : le souvenir arrivé pendant la journée
backup-nuit-debut =
    Le soir tombe sur le royaume. Pendant la journée, un nouveau souvenir est
    arrivé : ~/souvenirs/{ $fichier }.

    La nuit passe. Entre minuit et 6 h, cron se réveille et lance ce que ta
    crontab lui demande…
backup-nuit-encore =
    Une nouvelle nuit passe. Entre minuit et 6 h, cron lance ce que ta
    crontab lui demande…
backup-nuit-ok =
    Au matin, la sauvegarde est à jour : { $fichier } y est, sans que tu aies
    rien tapé. C'est ça, une sauvegarde automatique.
backup-matin =
    Mais Maëlle arrive, catastrophée : « J'ai voulu ranger… et j'ai effacé
    ~/souvenirs/{ $fichier } ! » Sous Linux, rm ne passe pas par une
    corbeille. Heureusement, tu as une sauvegarde. Restaure ce souvenir.
backup-nuit-rien =
    Au matin, rien n'a bougé : aucune tâche de ta crontab ne tombait cette
    nuit, entre minuit et 6 h. Relis les cinq champs de l'heure (man crontab) :
    minute, heure, jour du mois, mois, jour de la semaine.
# { $courrier } : ce que les tâches ont écrit
backup-nuit-courrier =
    Au matin, la sauvegarde n'est pas à jour. Cron t'a laissé ce courrier,
    avec ce que ta tâche a écrit :

    { $courrier }
backup-nuit-echec =
    Au matin, la sauvegarde n'est pas à jour : ta tâche a tourné, mais elle
    n'a pas copié les souvenirs au bon endroit. Vérifie la commande à la main,
    avec rsync -n pour essayer sans rien toucher.

## Événements

# { $sauvegarde } : le dossier de sauvegarde
backup-evenement-imbrique =
    Regarde bien : tu as maintenant { $sauvegarde }/souvenirs, un dossier
    souvenirs DANS le dossier souvenirs. Pour rsync, la barre finale de la
    source compte : « souvenirs/ » veut dire « le contenu de souvenirs »,
    « souvenirs » veut dire « le dossier lui-même ». Ce dossier en trop ne
    gêne pas, mais vise juste pour la suite : rsync -a ~/souvenirs/ suivi
    de la destination.
backup-evenement-copie =
    Les souvenirs sont copiés sur le disque de sauvegarde. Mais une sauvegarde
    qu'il faut penser à faire à la main, on finit toujours par l'oublier.
    Demande à cron de la refaire chaque nuit : crontab -e.
# { $fichier } : le souvenir effacé
backup-evenement-perdu =
    { $fichier } a disparu… de la sauvegarde aussi ! Avec --delete, rsync a
    recopié l'effacement : un miroir reproduit les erreurs comme le reste.
    C'est pour ça qu'on garde plusieurs versions (rsnapshot, restic : ce sera
    pour plus tard). Ici, recommence le chapitre pour réessayer.
backup-evenement-fin =
    Le souvenir est revenu. Maëlle : « Alors c'est ça, une vraie sauvegarde :
    une copie ailleurs, refaite toute seule, et qu'on a déjà réussi à
    restaurer. »

    Bravo ! Tu as terminé le chapitre 4 de l'Effaceur.

    CE QUI S'EST PASSÉ
    rsync a copié les souvenirs sur un autre disque ; cron refait la copie
    chaque nuit ; et le matin, la sauvegarde a servi, pour de vrai.

    LA BONNE PRATIQUE
    - La barre finale compte : rsync -a source/ destination/.
    - Essayer d'abord avec -n (--dry-run), surtout avec --delete.
    - Une sauvegarde manuelle s'oublie : la planifier (cron).
    - Une sauvegarde jamais restaurée n'est pas une sauvegarde : tester la
      restauration.
    - La règle 3-2-1 : trois copies, sur deux supports, dont une ailleurs ;
      et plusieurs versions, car un miroir (--delete) recopie aussi les
      erreurs.

    UNE AUTRE VOIE
    Un timer systemd au lieu de cron : le résultat dans journalctl, une
    exécution manquée rattrapée au démarrage (Persistent=true). Et rsync
    tient un miroir : un fichier effacé ou abîmé le sera aussi à la passe
    suivante. Pour garder plusieurs jours, rsnapshot ou restic (Les
    Archives, La Ludothèque).

    LA DOCUMENTATION
    - rsync : https://download.samba.org/pub/rsync/rsync.1
    - crontab : https://manpages.debian.org/bookworm/cron/crontab.5.en.html
