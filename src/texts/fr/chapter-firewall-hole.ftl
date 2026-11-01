### Histoire « La Fabrique », chapitre 3 « Le trou dans le pare-feu » :
### Docker et ufw, et la place que prend Docker. Les commandes, chemins et
### messages de docker, ufw, ss et nc ne se traduisent pas.

chapter-firewall-hole = Le trou dans le pare-feu
    .summary = La base du fablab ouverte au monde malgré ufw : les ports publiés par Docker, puis faire de la place sans jeter ce qui compte.

## Fichiers

firewall-hole-message-rania =
    Un message de Rania, des Lettres du quartier :

    « Salut ! Hier soir, j'ai testé les ports du serveur du fablab depuis
    chez moi, par curiosité. Surprise : PostgreSQL répond sur le port 5432,
    ouvert au monde entier. Pourtant, Yasmine m'a montré son pare-feu : ufw
    n'autorise que SSH, 8080 et 8081 !

    Teste toi-même depuis ton poste (exit pour y revenir) :
      nc -zv fabrique 5432

    Une base de données ouverte sur internet, c'est la porte à tous les
    robots qui essaient des mots de passe… »
firewall-hole-word-yasmine =
    Un mot de Yasmine :

    « Oups. J'avais ajouté le port 5432 à la base dans
    /srv/reservations/compose.yaml pour m'y connecter avec pgAdmin depuis
    mon portable. Je croyais qu'ufw le bloquait.

    Et autre souci : le disque du serveur est plein à plus de 90 %
    (df -h /). Je crois que c'est Docker. Tu peux faire de la place ? Mais
    attention : ne touche SURTOUT PAS au volume wiki-ancien. Il contient les
    pages de notre ancien wiki, qu'on doit encore récupérer. Aucun conteneur
    ne s'en sert en ce moment.

    Pour sudo : fablab-2027. »

## Événements

firewall-hole-event-ss =
    docker-proxy écoute sur 0.0.0.0:5432 : c'est Docker qui publie le port
    de la base, sur toutes les adresses de la machine. Et sudo ufw status ne
    parle pas du 5432… Docker écrit ses propres règles dans iptables, que
    le noyau consulte AVANT celles d'ufw : un port publié par Docker
    contourne ufw.
firewall-hole-event-ufw-useless =
    Une règle ufw pour le 5432 ne change rien : les paquets vers un port
    publié par Docker sont redirigés vers le conteneur avant d'arriver aux
    règles d'ufw. Teste depuis ton poste : nc -zv fabrique 5432. La
    solution est dans compose.yaml : ne pas publier ce port, ou seulement
    sur 127.0.0.1.
firewall-hole-event-closed =
    Le port 5432 ne répond plus depuis l'extérieur, et l'appli de
    réservation fonctionne toujours : elle joint la base par le réseau du
    projet, sans port publié. Pour pgAdmin, Yasmine passera par un tunnel
    SSH : ssh -L 5432:127.0.0.1:5432 fabrique (avec le port publié sur
    127.0.0.1 seulement), ou docker compose exec db psql.
# { $volumes } : les volumes effacés
firewall-hole-event-volume-lost =
    Le volume { $volumes } a disparu, avec toutes ses données : docker
    volume prune -a efface tous les volumes qu'aucun conteneur n'utilise,
    même s'ils ont un nom et comptent. Sur un vrai serveur, ce serait perdu.
    Ici, tu peux recommencer le chapitre depuis le menu. Avant un prune :
    docker system df, docker volume ls, et lire l'avertissement.
# { $percent } : l'occupation du disque
firewall-hole-event-disk =
    Le disque respire : { $percent } % occupés. Les images qu'aucun
    conteneur n'utilise (anciennes versions, essais oubliés, images sans
    nom) prenaient presque toute la place.
firewall-hole-event-end =
    La base n'est plus visible d'internet, les deux applis tournent, le
    disque a de la place, et le wiki attend toujours dans son volume.
    Rania refait son test : « Plus rien sur le 5432. Bien joué ! »

    Bravo ! Tu as terminé le chapitre 3 de La Fabrique. (La suite t'attend :
    ssh fabrique, pour la galerie photo du fablab.)

    CE QUI S'EST PASSÉ
    « ports: - "5432:5432" » publie le port sur toutes les adresses de la
    machine. Pour cela, Docker écrit ses propres règles iptables (table nat,
    chaîne DOCKER), que le noyau applique avant les règles d'ufw : le
    pare-feu affiché par ufw status ne voit jamais ces paquets. Et Docker
    garde tout ce qu'il a téléchargé, jusqu'à ce qu'on fasse le ménage.

    LA BONNE PRATIQUE
    - Ne publier que ce qui doit être public ; entre conteneurs, le réseau
      du projet suffit.
    - Un port pour soi seul : "127.0.0.1:5432:5432", et un tunnel SSH.
    - Tester depuis l'extérieur (nc -zv, nmap), jamais seulement ufw status.
    - docker system df pour voir la place ; docker image prune -a et
      docker container prune pour la reprendre.
    - docker volume prune -a efface aussi les volumes nommés inutilisés :
      vérifier avant, ou ne jamais l'utiliser sur un serveur.

    LA DOCUMENTATION
    - Docker et ufw : https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw
    - Publier un port : https://docs.docker.com/engine/network/#published-ports
    - Faire le ménage : https://docs.docker.com/engine/manage-resources/pruning/
