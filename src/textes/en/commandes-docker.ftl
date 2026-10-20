### docker: the game's remarks (docker's own messages stay in
### English, like the real tool).

docker-usage =
    Usage:  docker [OPTIONS] COMMAND
    (Here: docker ps, images, pull, run, logs, exec, cp, stop, start, restart, rm, port, update, inspect, volume; see man docker)
docker-attache = (Without -d, docker would stay attached to the container and show its log until Ctrl+C, which would stop it. Here, the game gives you the prompt back and the container keeps running; usually, you start a service with -d.)
docker-update-usage = (Here, docker update changes the restart policy: docker update --restart unless-stopped container.)
docker-volume-usage = (Here: docker volume ls, create, inspect, rm; see man docker.)
compose-usage =
    Usage:  docker compose [OPTIONS] COMMAND
    (Here: up [-d], down [-v], ps, logs, config, restart, stop, start, exec, pull; see man docker-compose)
