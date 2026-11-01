### Histoire « La Fabrique », chapitre 2 « La composition » : Docker Compose.
### Les commandes, chemins, clés YAML et messages de docker, de PostgreSQL
### et de l'appli (en anglais) ne se traduisent pas.

chapter-compose = La composition
    .summary = Une appli et sa base avec Docker Compose : le nom des services, les volumes, les secrets dans .env, le redémarrage.

## Fichiers

compose-message-yasmine =
    Un message de Yasmine :

    « On voudrait que les gens réservent les machines du fablab (la
    découpe laser, les imprimantes 3D) en ligne. J'ai trouvé une appli,
    « reservations », qui a besoin d'une base PostgreSQL. Un tutoriel
    donnait un fichier compose.yaml tout prêt : je l'ai copié dans
    /srv/reservations/.

    Je n'arrive pas à la faire marcher. Et avant de mettre ce fichier sur
    le dépôt git du fablab, je voudrais qu'il ne contienne plus aucun mot de
    passe : ils iront dans un fichier .env, lisible par root seulement.

    Bien sûr, tout doit repartir seul après une coupure, et les
    réservations ne doivent pas disparaître si on recrée les conteneurs.
    L'appli doit répondre sur http://localhost:8081.

    Pour sudo : fablab-2027. Mes notes : aide_compose.txt. »
compose-help-compose =
    NOTES DE YASMINE — DOCKER COMPOSE

    On lance tout depuis le dossier du projet (/srv/reservations) :
      sudo docker compose up -d       crée et démarre (ou recrée) les services
      sudo docker compose ps          l'état des services
      sudo docker compose logs appli  le journal d'un service
      sudo docker compose config      le fichier tel que Compose le comprend
      sudo docker compose down        arrête et supprime les conteneurs

    Le reste : man docker-compose.

## L'appli

compose-app-welcome =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Réserver une machine — Fablab</title></head>
    <body>
    <h1>Réserver une machine</h1>
    <p>Découpe laser, imprimantes 3D, brodeuse : choisissez un créneau.</p>
    <footer>reservations 2.1 — base de données connectée</footer>
    </body>
    </html>

## Événements

compose-event-localhost =
    « connect ECONNREFUSED 127.0.0.1:5432 » : l'appli cherche la base sur
    localhost. Mais dans un conteneur, localhost désigne le conteneur
    lui-même, pas la machine ni les autres conteneurs. Dans un projet
    Compose, chaque service est joignable par son nom, sur le réseau du
    projet.
compose-event-without-password =
    PostgreSQL refuse de créer sa base sans mot de passe : la variable
    POSTGRES_PASSWORD est vide. docker compose config montre ce que Compose
    a compris, et les avertissements disent quelle variable manque dans .env.
compose-event-authentication =
    « password authentication failed » : l'appli et la base n'ont pas le
    même mot de passe. Piège classique : l'image de PostgreSQL ne lit
    POSTGRES_PASSWORD qu'une fois, quand elle crée la base dans un dossier
    vide. Si la base existe déjà dans le volume, changer la variable ne
    change rien. Tant que la base ne contient rien d'important, on peut la
    recréer (down -v efface les volumes) ; sinon, on change le mot de passe
    dans la base elle-même.
compose-event-connected =
    L'appli est connectée à sa base : http://localhost:8081 répond. Reste
    à rendre l'installation solide (données, secrets, redémarrage).
compose-event-volumes-erased =
    docker compose down -v : les volumes du projet sont effacés, avec
    toutes les données de la base. Utile tant qu'elle est vide ; à ne jamais
    taper sur une base en service.
compose-event-in-clear =
    Tout marche… mais le mot de passe est toujours écrit dans compose.yaml,
    qui va partir sur le dépôt git. Compose remplace ${"{"}VARIABLE{"}"} par la
    valeur trouvée dans le fichier .env du projet (man docker-compose).
compose-event-env-readable =
    Le mot de passe a quitté compose.yaml : bien. Mais .env est lisible par
    tous les comptes de la machine (ls -la). Yasmine voulait qu'il ne le
    soit que par root.
compose-event-without-reboot =
    Presque : après une coupure de courant, ces conteneurs ne repartiraient
    pas. Dans compose.yaml, chaque service peut avoir sa politique restart.
compose-event-end =
    http://localhost:8081 répond, la base garde ses données dans un volume,
    le mot de passe dort dans .env (lisible par root seulement), et tout
    repartira après une coupure. Yasmine publie compose.yaml sur le dépôt
    git du fablab, sans aucun secret dedans.

    Bravo ! Tu as terminé le chapitre 2 de La Fabrique. (La suite t'attend :
    Le trou dans le pare-feu.)

    CE QUI S'EST PASSÉ
    Le compose.yaml du tutoriel avait quatre défauts : l'appli cherchait la
    base sur localhost (dans un conteneur, c'est lui-même), la base n'avait
    pas de volume, le mot de passe était écrit en clair, et rien ne
    redémarrait.

    LA BONNE PRATIQUE
    - Entre conteneurs d'un même projet : le nom du service (db), jamais
      localhost.
    - Les données d'une base dans un volume nommé, déclaré sous volumes:.
    - Les secrets dans .env (chmod 600), jamais dans le fichier publié ;
      ${"{"}VARIABLE{"}"} dans compose.yaml.
    - POSTGRES_PASSWORD ne sert qu'à la création de la base.
    - docker compose config pour voir ce que Compose a compris ; down -v
      efface les données.
    - restart: unless-stopped sur chaque service.
    - L'attribut version: est obsolète : on le retire.

    UNE AUTRE VOIE
    Podman, sans démon, sait lancer les mêmes fichiers compose ; ses
    quadlets décrivent les conteneurs comme des unités systemd.
    Kubernetes, pour beaucoup de machines, au prix de bien plus de
    complexité. Pour une appli et sa base sur un serveur, docker compose
    reste le plus simple.

    LA DOCUMENTATION
    - Le réseau de Compose : https://docs.docker.com/compose/how-tos/networking/
    - Les variables de Compose : https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
    - L'image PostgreSQL : https://hub.docker.com/_/postgres
