### Histoire « L'Audit », chapitre « L'exposition » : le balayage de ports de
### l'auditrice trouve la base de données et Redis joignables depuis
### internet. ufw et la configuration de Redis. Les commandes, les chemins,
### les mots-clés de redis.conf et les messages des outils (en anglais) ne se
### traduisent pas.

chapitre-exposure = L'exposition
    .resume = Fermer ce qu'un balayage de ports trouve ouvert : ufw, et faire écouter Redis seulement en local.

## Fichiers

exposure-courriel-salome =
    De :     Salomé (auditrice)
    À :      toi
    Objet :  Audit du Fournil — deuxième partie : l'exposition

    Bonjour,

    Merci d'avoir traité la première partie : SSH, les comptes, sudo et le
    fichier de secrets sont en ordre. La deuxième partie concerne ce qu'on
    voit du serveur depuis internet.

    Mon balayage de ports est dans balayage-audit.txt. Deux lignes me
    gênent : la base de données (5432) et Redis (6379) répondent à
    n'importe qui. Redis n'a même pas de mot de passe, et il a été installé
    pour écouter sur toutes les interfaces.

    Ce que j'attends :
    1. Que seuls SSH (depuis ton poste d'administration), le site (80 et
       443) soient joignables depuis internet. Un pare-feu est installé
       (ufw), mais il est éteint.
    2. Que Redis, en plus, n'écoute plus que sur la machine elle-même :
       un pare-feu se désactive, s'oublie, se trompe ; un service qui ne
       tend l'oreille qu'à lui-même est plus sûr.
    3. Que l'appli de commandes continue de marcher : elle utilise la
       base et Redis, en local.

    Pense à tester avec une nouvelle connexion SSH avant de refermer la
    session que tu as ouverte.

    Salomé
    (Pour sudo, ton mot de passe est toujours : farine-2028)

## Événements

exposure-evenement-ecoute =
    Voilà qui écoute, et où. Regarde la colonne « Local Address:Port » :
    0.0.0.0 veut dire « toutes les interfaces », donc joignable de partout
    (si rien ne filtre) ; 127.0.0.1 veut dire « cette machine seulement ».
    Le port 3000 (l'appli) est déjà en local : c'est le bon exemple.
exposure-evenement-enferme =
    ATTENTION : le pare-feu est actif et ne laisse plus entrer SSH depuis
    ton poste. Ta session actuelle tient (les connexions établies ne sont
    pas coupées), mais pas la suivante. Autorise SSH tout de suite
    (sudo ufw status pour voir, man ufw pour la règle).
exposure-evenement-site-coupe =
    Le pare-feu bloque maintenant le site : les clientes et clients ne
    peuvent plus commander. Autorise les ports 80 et 443 (un profil d'ufw
    les nomme : ufw app list, ou directement les numéros).
exposure-evenement-base-ouverte =
    Le pare-feu est actif, mais un port de la base ou de Redis passe encore :
    une règle trop large (« allow » sans port, une plage…) ou une politique
    par défaut à « allow ». Relis  sudo ufw status verbose  : par défaut, ce
    qui n'est pas autorisé doit être refusé en entrée.
exposure-evenement-redis-arrete =
    Redis est arrêté : l'appli de commandes en a besoin (sessions et file
    d'attente), les commandes en ligne ne passent plus ! Fermer un service
    n'est pas le réparer : relance-le, et change plutôt son adresse
    d'écoute.
exposure-evenement-sans-effet =
    redis.conf dit bien « bind 127.0.0.1 »… mais Redis écoute toujours sur
    toutes les interfaces : un programme lit sa configuration quand il
    démarre, pas quand le fichier change. Fais-le redémarrer, puis relance
      ss -tln
    pour voir la nouvelle adresse.
exposure-evenement-pare-feu =
    Le pare-feu est actif : SSH (depuis ton poste), 80 et 443 passent ; la
    base et Redis sont fermés depuis internet. Mais ce n'est qu'une couche :
    Redis écoute encore sur toutes les interfaces.
exposure-evenement-redis-local =
    Redis n'écoute plus que sur 127.0.0.1 : même sans pare-feu, il ne serait
    plus joignable de l'extérieur, et l'appli le joint toujours.
exposure-evenement-fin =
    Tu es entré·e avec le pare-feu actif : SSH passe, le site aussi, et la
    base et Redis sont fermés. Salomé : « Mon balayage ne voit plus que trois
    ports. Merci ! Reste la troisième partie, les traces de connexion. »

    Bravo ! Tu as terminé le chapitre « L'exposition ».

    CE QUI S'EST PASSÉ
    Un service qui écoute sur 0.0.0.0 est joignable par tout ce qui atteint la
    machine. Beaucoup de logiciels (bases de données, caches comme Redis) sont
    installés ouverts « pour que ça marche » ; sans mot de passe, Redis
    permet de lire et d'écrire toutes ses données, et des robots balaient
    internet pour les trouver. Un balayage de ports (nmap) est le premier
    geste d'un audit, comme d'une attaque : voir ce que voit l'extérieur.

    LA BONNE PRATIQUE
    - Deux couches : un pare-feu qui refuse l'entrant par défaut et
      n'autorise que ce qui doit l'être (SSH, 80, 443), ET des services qui
      n'écoutent que là où il le faut (bind 127.0.0.1, listen_addresses =
      'localhost' pour PostgreSQL).
    - ss -tlnp pour savoir qui écoute ; refaire le balayage après chaque
      changement.
    - Autoriser SSH AVANT d'activer le pare-feu, et tester avec une nouvelle
      connexion. Redémarrer le service pour qu'il relise sa configuration.
    - Pour un service qui doit rester accessible à une machine précise : une
      règle ufw limitée à son adresse (ufw allow from 192.0.2.30 to any
      port 5432).

    UNE AUTRE VOIE
    nftables (ou iptables) fait le même travail qu'ufw, plus finement, et
    ufw n'en est qu'une façade : le principe reste le même (politique par
    défaut, règles, ordre). Redis peut aussi n'écouter que sur une socket
    Unix (unixsocket, port 0), sans aucun port réseau.

    LA DOCUMENTATION
    - ufw : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss : https://man7.org/linux/man-pages/man8/ss.8.html
    - Sécurité de Redis : https://redis.io/docs/latest/operate/oss_and_stack/management/security/
    - PostgreSQL, connexions : https://www.postgresql.org/docs/current/runtime-config-connection.html
