### Histoire « L'Astreinte », chapitre 3 « Les inodes » : un volume plein
### d'inodes et presque vide d'octets (df -i, du --inodes), « Liste
### d'arguments trop longue », find -mtime -delete et cron. Les commandes,
### options et messages des outils ne se traduisent pas.

chapitre-inodes = Les inodes
    .resume = 3 h 20, « No space left on device »… sur un disque presque vide. Qu'est-ce qui manque, si ce n'est pas la place ?

## Fichiers

inodes-message-de-zoe =
    Un message de Zoé (3 h 05) :

    « Je n'y comprends plus rien. L'enregistrement de l'émission de nuit a
    encore échoué : « No space left on device », comme la semaine dernière !
    Sauf que cette fois, df -h dit que le volume des données (/srv/radio)
    est presque vide. Et le relais n'arrive plus à noter les écoutes
    (journalctl -u radio-flux).

    PS : les statistiques d'écoute servent au rapport mensuel pour la
    mairie. Il faut garder au moins les 30 derniers jours. »
inodes-conf-flux =
    # Radio Quartier : relais du flux (le service radio-flux)
    port = 8000
    mount = /direct
    logfile = /var/log/radio/flux.log
    loglevel = info
    # Enregistrement des émissions
    record_dir = /srv/radio/emissions
    # Statistiques : un fichier par écoute (rapport mensuel pour la mairie)
    stats_dir = /srv/radio/stats
inodes-stats-lisezmoi =
    Statistiques d'écoute, écrites par le relais : un petit fichier par
    écoute (adresse anonymisée, durée). Le rapport mensuel pour la mairie
    lit les fichiers du mois écoulé.
    (Zoé, mars 2027 : penser à faire le ménage de temps en temps…)

## La nuit simulée

# { $commande } : la commande de la tâche cron ; { $sortie } : ce qu'elle a écrit
inodes-courrier =
    Courrier de cron (Cron Daemon) au sujet de : { $commande }
    { $sortie }
# { $taches } : tâches lancées ; { $effaces } : fichiers effacés ; { $ancien } : âge du plus ancien, en jours ; { $pourcent } : inodes occupés
inodes-nuit =
    Une journée et une nuit passent. Le relais note ses écoutes ; cron
    lance { $taches ->
        [0] aucune tâche
        [one] une tâche
       *[other] { $taches } tâches
    }. Au matin : { $effaces ->
        [one] { $effaces } fichier de statistiques en moins
       *[other] { $effaces } fichiers de statistiques en moins
    }, le plus
    ancien a { $ancien } jours, et { $pourcent } % des inodes de /srv/radio
    sont occupés.
inodes-nuit-recentes-perdues =
    Aïe : des statistiques de moins de 30 jours ont disparu, celles du
    rapport pour la mairie. Une tâche qui efface tout, sans regarder l'âge
    des fichiers ? Recommence le chapitre pour essayer autrement (lien sous
    le terminal), et teste ta commande à la main avant de la confier à cron.
inodes-nuit-rien =
    Ta tâche n'a pas tourné cette nuit : son horaire ne tombe pas dans la
    nuit. Les cinq champs (minute, heure, jour du mois, mois, jour de la
    semaine) sont expliqués dans man crontab.
# { $jours } : âge du plus ancien fichier
inodes-nuit-trop-vieux =
    Au matin, il reste des statistiques de { $jours } jours : la tâche n'a
    pas fait le ménage. Lance sa commande à la main pour voir ce qu'elle
    fait (et sudo crontab -l, pour relire la ligne).
# { $pourcent } : inodes occupés
inodes-nuit-plein =
    { $pourcent } % des inodes sont encore occupés : le volume se remplira
    de nouveau très vite. Il faudrait garder moins longtemps (mais au moins
    30 jours).

## Événements

inodes-evenement-presque-vide =
    Le volume des données n'est presque pas rempli, et pourtant on ne peut
    plus y créer de fichier. La place n'est pas la seule ressource d'un
    système de fichiers : chacun de ses fichiers a aussi besoin d'un inode
    (sa fiche : propriétaire, droits, dates, où sont ses données), et leur
    nombre est fixé à la création. Dans man df, une option les compte.
inodes-evenement-plus-d-inodes =
    100 % des inodes de /srv/radio sont pris : plus un seul fichier ne
    peut y être créé, même vide, quelle que soit la place libre. Qui a
    créé autant de fichiers ? du sait compter les inodes au lieu des
    octets (man du).
inodes-evenement-coupable =
    Des dizaines de milliers de fichiers ! Un par écoute, écrit par le
    relais depuis le mois de mars, et jamais effacé. Avant d'effacer :
    Zoé veut garder au moins les 30 derniers jours. find sait choisir les
    fichiers selon leur âge (man find).
inodes-evenement-trop-long =
    « Liste d'arguments trop longue » : le shell remplace * par tous les
    noms du lieu AVANT de lancer la commande, et la liste ne tient pas
    dans la place réservée aux arguments d'un programme (environ 2 Mo).
    find, lui, parcourt le lieu tout seul : il peut effacer ce qu'il
    trouve, sans liste géante.
inodes-evenement-recentes-perdues =
    Attention : des statistiques de moins de 30 jours ont disparu, celles
    dont la mairie a besoin. Recommence le chapitre pour essayer autrement
    (lien sous le terminal).
# { $pourcent } : inodes occupés
inodes-evenement-repart =
    Des inodes se sont libérés ({ $pourcent } % occupés) : l'enregistrement
    de nuit a repris, et le relais note de nouveau les écoutes. Reste à
    éviter que ça recommence : une tâche cron, chaque nuit, pour ne garder
    que le dernier mois (le jeu fera passer une nuit pour la voir à
    l'œuvre).
inodes-evenement-fin =
    La nuit a passé, la tâche a fait le ménage, et le dernier mois de
    statistiques est intact. Zoé : « Les inodes… je ne connaissais même
    pas le mot. Merci ! »

    Bravo ! Tu as terminé le chapitre 3 de L'Astreinte.

    CE QUI S'EST PASSÉ
    Le relais écrivait un petit fichier par écoute, depuis six mois, sans
    jamais les effacer. Le volume avait encore toute sa place, mais plus un
    seul inode : chaque fichier en prend un, et leur nombre est fixé à la
    création du système de fichiers (un pour 16 Kio par défaut). rm * ne
    pouvait pas suivre (trop d'arguments) ; find, avec -mtime et -delete,
    a effacé les vieux en gardant le dernier mois, et cron le refait
    chaque nuit.

    LA BONNE PRATIQUE
    - « No space left on device » avec de la place : df -i.
    - Trouver où sont les fichiers : du --inodes (avec -d 1 ou -s).
    - Effacer en masse avec find … -delete (ou -exec), jamais rm * sur des
      milliers de fichiers ; tester d'abord sans -delete.
    - Toute donnée qui s'accumule (journaux, statistiques, sessions,
      caches) a une durée de conservation et une tâche qui l'applique.
    - Surveiller les inodes comme la place (une alerte à 80 %).

    LA DOCUMENTATION
    - df (-i) : https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html
    - find (-mtime, -delete) : https://www.gnu.org/software/findutils/manual/html_mono/find.html
    - ARG_MAX et « Argument list too long » : https://man7.org/linux/man-pages/man2/execve.2.html
