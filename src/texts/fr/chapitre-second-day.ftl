### Histoire « Le Datacenter », chapitre « Deuxième jour » : comptes et
### groupes. Malo doit lire les journaux nginx sans sudo (groupe adm), et
### l'équipe web a besoin d'un dossier partagé (/srv/equipe).
### Les noms de comptes et de groupes (malo, adm, web-team), les commandes,
### les chemins et les modes (640, 770) ne se traduisent pas.

chapter-second-day = Deuxième jour
    .resume = Une nouvelle recrue : comptes et groupes, id, usermod -aG, chgrp, chmod pour le groupe.

## Fichiers

second-day-email-awa =
    De :     Awa (responsable d'exploitation)
    À :      toi
    Objet :  Deuxième jour, deux petites choses

    Merci pour hier ! Aujourd'hui, Malo arrive en renfort. Son compte existe
    déjà (malo). Deux choses à régler avant son arrivée :

    1. Malo doit pouvoir LIRE les journaux de nginx (/var/log/nginx), pour
       repérer les robots comme celui d'hier. Mais pas de sudo pour lui : il
       n'a pas besoin d'être administrateur pour lire un journal. Toi, tu
       les lis sans sudo… pourquoi ? Compare  id  et  id malo , et regarde
       les droits avec  ls -l /var/log/nginx

    2. L'équipe web (le groupe web-team) a besoin d'un dossier partagé,
       /srv/equipe, où chacun·e peut déposer ses rapports. Aucun autre compte
       de la machine ne doit pouvoir y lire ou y écrire, surtout pas
       www-data : c'est sous ce compte que tourne le site, et si un jour il
       est piraté, l'attaquant agira avec ses droits.

    Le mot de passe pour sudo n'a pas changé. Mes notes sur les droits sont
    dans ~/notes_awa.txt, et le manuel est ton ami : man usermod, man chgrp.
second-day-notes-awa =
    NOTES D'AWA — LIRE  ls -l

      -rw-r----- www-data adm      84211 access.log
       ^^^             ^^^  propriétaire, puis groupe
          ^^^          droits du propriétaire (rw-), du groupe (r--),
             ^^^       puis des autres (---)

    Pour savoir quels droits s'appliquent à quelqu'un, on regarde dans
    l'ordre : est-ce le propriétaire ? Sinon, est-il membre du groupe ?
    Sinon, c'est un « autre ». Une seule ligne compte, la première qui
    correspond.

    Les groupes d'un compte :  id nom  ou  groups nom
    Sur Debian, le groupe adm sert à surveiller la machine : ses membres
    peuvent lire les journaux de /var/log.

    Pour un dossier, r = voir la liste, w = créer ou effacer dedans,
    x = y entrer. En chiffres : r = 4, w = 2, x = 1, donc 7 = rwx, 5 = r-x,
    0 = rien (voir man chmod).

## Événements

second-day-event-replaced =
    Aïe : Malo n'est plus dans le groupe web-team !

    Sans l'option -a, usermod -G REMPLACE la liste des groupes secondaires
    au lieu d'y ajouter le nouveau. C'est un piège classique, qui a déjà
    privé plus d'un·e admin de son propre accès à sudo. Vérifie avec
    groups malo, puis relis man usermod pour rendre à Malo ses groupes.
# { $logs } : le dossier des journaux
second-day-event-logs-open =
    Attention : avec ces droits, TOUS les comptes de la machine peuvent lire
    les journaux de { $logs }, y compris www-data, le compte du site web.

    Or un journal d'accès contient les adresses IP des visiteur·ses : ce sont
    des données personnelles, à protéger (RGPD). Rends aux autres leur
    absence de droits (640), et passe plutôt par le groupe prévu pour ça.
second-day-event-malo-reads =
    Malo peut lire les journaux, sans sudo et sans les ouvrir à tout le
    monde : il est membre du groupe adm, et les journaux donnent le droit de
    lecture à ce groupe (r-- au milieu de rw-r-----).

    Au passage, sur une vraie machine, Malo devra se reconnecter : les
    groupes d'une session sont lus à la connexion.
# { $partage } : le chemin du dossier partagé
second-day-event-share-open =
    Prudence : n'importe quel compte peut maintenant écrire dans { $partage },
    y compris www-data. Si le site est piraté, l'attaquant pourra y déposer
    ce qu'il veut. Retire tout droit aux autres (le dernier chiffre à 0).
second-day-event-share =
    Le dossier { $partage } est prêt : l'équipe web peut y entrer, y lire et
    y écrire, et les autres comptes n'y voient rien.
second-day-event-end =
    Awa passe la tête par la porte : « Parfait. Malo lit les journaux, le
    partage est fermé aux autres, et personne n'a reçu plus de droits que
    nécessaire. »

    Bravo ! Tu as terminé le chapitre 2 du Datacenter.

    CE QUI S'EST PASSÉ
    Sous Linux, les droits d'un fichier se décident en trois cases :
    propriétaire, groupe, autres. Ajouter Malo au groupe adm lui a donné
    exactement ce dont il avait besoin, sans sudo et sans ouvrir les
    journaux à tout le monde. Pour /srv/equipe, un groupe et le mode 770
    (rwx pour le propriétaire et le groupe, rien pour les autres) font un
    vrai dossier d'équipe.

    LA BONNE PRATIQUE
    - Le moindre privilège : donner un groupe plutôt que sudo, et jamais
      chmod 777 ou o+r « pour que ça marche ».
    - usermod -aG pour ajouter un groupe ; -G seul remplace la liste.
    - Pour aller plus loin : chmod g+s sur un dossier partagé (bit setgid)
      fait que les nouveaux fichiers prennent le groupe du dossier.

    LA DOCUMENTATION
    - usermod : https://man7.org/linux/man-pages/man8/usermod.8.html
    - chmod : https://man7.org/linux/man-pages/man1/chmod.1.html
    - Les groupes système de Debian (adm…) : https://wiki.debian.org/SystemGroups
