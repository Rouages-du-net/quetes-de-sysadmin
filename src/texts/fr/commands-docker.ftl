### docker : remarques du jeu (les messages de docker, eux, restent en
### anglais, comme le vrai outil).

docker-usage =
    Usage:  docker [OPTIONS] COMMAND
    (Ici : docker ps, images, pull, run, logs, exec, cp, stop, start, restart, rm, port, update, inspect, volume ; voir man docker)
docker-attached = (Sans -d, docker resterait attaché au conteneur et afficherait son journal jusqu'à Ctrl+C, qui l'arrêterait. Ici, le jeu rend la main et le conteneur continue ; d'habitude, on lance un service avec -d.)
docker-update-usage = (Ici, docker update change la politique de redémarrage : docker update --restart unless-stopped conteneur.)
docker-volume-usage = (Ici : docker volume ls, create, inspect, rm ; voir man docker.)
compose-usage =
    Usage:  docker compose [OPTIONS] COMMAND
    (Ici : up [-d], down [-v], ps, logs, config, restart, stop, start, exec, pull ; voir man docker-compose)
