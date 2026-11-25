### docker: los comentarios del juego (los mensajes propios de docker se
### quedan en inglés, como en la herramienta real).

docker-usage =
    Usage:  docker [OPTIONS] COMMAND
    (Aquí: docker ps, images, pull, run, logs, exec, cp, stop, start, restart, rm, port, update, inspect, volume; mira man docker)
docker-attached = (Sin -d, docker se quedaría enganchado al contenedor mostrando su registro hasta Ctrl+C, que lo detendría. Aquí el juego te devuelve el prompt y el contenedor sigue en marcha; normalmente un servicio se arranca con -d.)
docker-update-usage = (Aquí, docker update cambia la política de reinicio: docker update --restart unless-stopped contenedor.)
docker-volume-usage = (Aquí: docker volume ls, create, inspect, rm; mira man docker.)
compose-usage =
    Usage:  docker compose [OPTIONS] COMMAND
    (Aquí: up [-d], down [-v], ps, logs, config, restart, stop, start, exec, pull; mira man docker-compose)
podman-unshare-shell = podman unshare sin comando abre un shell en el espacio de nombres de la cuenta: el juego no simula ese shell. Dale un comando (podman unshare ls -ln CARPETA, podman unshare cat /proc/self/uid_map).
