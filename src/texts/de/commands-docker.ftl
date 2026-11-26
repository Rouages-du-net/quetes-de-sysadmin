### docker: die Bemerkungen des Spiels (die eigenen Meldungen von docker
### bleiben auf Englisch, wie beim echten Werkzeug).

docker-usage =
    Usage:  docker [OPTIONS] COMMAND
    (Hier: docker ps, images, pull, run, logs, exec, cp, stop, start, restart, rm, port, update, inspect, volume; siehe man docker)
docker-attached = (Ohne -d würde docker am Container hängen bleiben und sein Log bis Strg+C anzeigen, was ihn stoppen würde. Hier gibt dir das Spiel den Prompt zurück und der Container läuft weiter; normalerweise startet man einen Dienst mit -d.)
docker-update-usage = (Hier ändert docker update die Neustart-Richtlinie: docker update --restart unless-stopped container.)
docker-volume-usage = (Hier: docker volume ls, create, inspect, rm; siehe man docker.)
compose-usage =
    Usage:  docker compose [OPTIONS] COMMAND
    (Hier: up [-d], down [-v], ps, logs, config, restart, stop, start, exec, pull; siehe man docker-compose)
podman-unshare-shell = podman unshare ohne Befehl öffnet eine Shell im Namespace des Kontos: Das Spiel simuliert diese Shell nicht. Gib ihm einen Befehl (podman unshare ls -ln VERZEICHNIS, podman unshare cat /proc/self/uid_map).
