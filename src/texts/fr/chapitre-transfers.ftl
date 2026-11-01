### Histoire « La Maison des associations », chapitre « Les transferts » :
### copier des fichiers entre machines (scp, rsync). Les commandes, les
### options, les chemins et les messages des outils (en anglais) ne se
### traduisent pas.

chapitre-transfers = Les transferts
    .resume = Rapatrier un fichier du wiki sur ton poste (scp), puis mettre la sauvegarde à jour sur archives (rsync).

## Fichiers

transfers-courriel-yasmine =
    De :     Yasmine
    À :      toi
    Objet :  Avant l'assemblée générale

    L'assemblée générale, c'est samedi ! Deux choses avant :

    1. Le rapport d'activité est sur le wiki :
       /srv/wiki/exports/rapport-2027.pdf. Peux-tu le récupérer sur TON
       poste ? Je l'imprimerai depuis chez toi. (man scp ; le raccourci que
       tu as écrit pour le wiki marche aussi pour scp.)

    2. La sauvegarde du dossier partagé (/srv/partage, ici sur maison) n'a
       pas été faite depuis l'an dernier. Elle va sur archives, dans
       /srv/sauvegardes/partage : les mêmes fichiers, aux mêmes endroits.
       Gaspard utilisait rsync, depuis maison : il ne copie que ce qui a
       changé (man rsync). Il avait même créé une clé rien que pour ça,
       ~/.ssh/id_sauvegarde (regarde ~/.ssh/config, ici).

    Gaspard me dit au téléphone : « Attention à la barre oblique à la fin
    de la source, avec rsync. Et essaie d'abord avec -n. »

transfers-cr-ag-2026 =
    Assemblée générale 2026 — compte rendu

    Présent·es : 34 associations sur 41.
    Rapport moral adopté à l'unanimité. Budget adopté (2 abstentions).
    Projet de l'année : un wiki commun pour toutes les associations.
transfers-cr-ca-2027-09 =
    Conseil d'administration — septembre 2027

    Point 1 : l'informatique de la Maison est reprise par une nouvelle
    personne bénévole. Gaspard reste joignable par téléphone.
    Point 2 : l'assemblée générale aura lieu le samedi 9 octobre.
transfers-planning =
    Planning des salles — octobre 2027

    Salle 1 : chorale (mardi 19 h), club d'échecs (jeudi 18 h)
    Salle 2 : atelier vélo (samedi 10 h)
    Grande salle : assemblée générale (samedi 9 octobre, 14 h)

## Événements

transfers-evenement-rapport =
    Le rapport d'activité est sur ton poste : scp est passé par maison (le
    ProxyJump de ton raccourci), comme ssh.
# { $dossier } : le dossier créé en trop
transfers-evenement-imbrique =
    Regarde sur archives : il y a maintenant un dossier { $dossier }. Sans
    barre oblique finale, rsync a copié le DOSSIER partage dans la
    sauvegarde, au lieu de son CONTENU.

    Recommence avec /srv/partage/. Et pour retirer le dossier en trop,
    rsync sait effacer en face ce qui n'existe pas à la source : l'option
    --delete (man rsync). Puissante, donc d'abord à blanc, avec -n.
transfers-evenement-sauvegarde =
    La sauvegarde sur archives est à jour : chaque fichier de /srv/partage y
    est, au même endroit. Relance la même commande : rsync n'a plus rien à
    copier.
transfers-evenement-fin =
    Le rapport est sur ton poste, et la sauvegarde sur archives est à jour.
    Yasmine : « Merci ! Gaspard aussi te dit bravo, il a vu ta sauvegarde. »

    Bravo ! Tu as terminé « La Maison des associations ».

    CE QUI S'EST PASSÉ
    scp copie des fichiers par la même connexion chiffrée que ssh, avec les
    mêmes clés et les mêmes raccourcis (~/.ssh/config, ProxyJump). rsync
    aussi passe par ssh ; mais il compare d'abord les deux côtés et n'envoie
    que ce qui a changé : idéal pour une sauvegarde qu'on refait souvent.

    LA BONNE PRATIQUE
    - La barre oblique finale de la source compte, avec rsync :
      /srv/partage/ copie le contenu, /srv/partage copie le dossier.
    - Toujours un essai à blanc d'abord (rsync -n, ou --dry-run), surtout
      avec --delete, qui efface en face ce qui n'existe plus à la source.
    - Une clé dédiée pour chaque tâche automatique (id_sauvegarde), et pas
      celle d'une personne ; sur le serveur, on peut encore la restreindre
      dans authorized_keys (option restrict).
    - Jamais de FTP ni de telnet : ils font passer les mots de passe en
      clair sur le réseau. scp, sftp et rsync passent par ssh.

    LA DOCUMENTATION
    - scp : https://man.openbsd.org/scp
    - rsync : https://download.samba.org/pub/rsync/rsync.1
    - authorized_keys, option restrict : https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
