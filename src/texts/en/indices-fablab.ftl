### Graded hints for The Workshop (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in noms.ftl.

## Chapter 1 — The Update

hint-update-end =
    .piste = Where does the outiltheque keep its database? docker inspect (its "Mounts") tells you: in the container's layer, which goes with it. First put the database somewhere safe (docker cp), then create a fresh 1.5 container with a volume (-v) and a --restart policy (man docker).
    .solution = sudo mkdir /srv/outiltheque ; sudo docker cp outiltheque:/var/lib/outiltheque/outiltheque.db /srv/outiltheque/ ; sudo docker rm -f outiltheque ; sudo docker run -d --name outiltheque --restart unless-stopped -p 8080:8080 -v /srv/outiltheque:/var/lib/outiltheque registry.example/outiltheque:1.5

## Chapter 2 — The Composition

hint-compose-connected =
    .piste = Start the project from /srv/reservations and read the app's log: it looks for the database on localhost. In a container, localhost is the container itself; in a Compose project, a service is reached by its name.
    .solution = In compose.yaml (sudo nano), replace @localhost: with @db: in DATABASE_URL, then sudo docker compose up -d and curl http://localhost:8081
hint-compose-end =
    .piste = Now make the setup solid: a named volume for /var/lib/postgresql/data, the password moved out of compose.yaml into .env (readable by root only), and restart: on each service. docker compose config shows what Compose understands.
    .solution = In compose.yaml: ${"{"}POSTGRES_PASSWORD{"}"} instead of the password (twice), volumes: - donnees:/var/lib/postgresql/data and volumes: donnees: at the bottom, restart: unless-stopped on both services; then echo POSTGRES_PASSWORD=workshop2027 | sudo tee .env ; sudo chmod 600 .env ; sudo docker compose up -d

## Chapter 3 — The hole in the firewall

hint-firewall-hole-closed =
    .piste = What listens on port 5432? ss -tlnp tells you: docker-proxy. A port published by Docker gets through before ufw's rules. The fix is in /srv/reservations/compose.yaml: do not publish that port, or only on 127.0.0.1.
    .solution = In compose.yaml, replace "5432:5432" with "127.0.0.1:5432:5432" (or remove that ports:), then sudo docker compose up -d. Check from your workstation: nc -zv workshop 5432
hint-firewall-hole-disk =
    .piste = The disk is full of things Docker keeps: docker system df shows them. Images that no container uses can go; volumes certainly not (wiki-ancien!).
    .solution = sudo docker image prune -a (answer y), then df -h /. Never docker volume prune -a.
hint-firewall-hole-end =
    .piste = The port closed, the disk under 75%, both apps answering (8080 and 8081) and the wiki-ancien volume intact: check each one.
    .solution = nc -zv workshop 5432 from the workstation, df -h /, curl http://localhost:8080 and curl http://localhost:8081, sudo docker volume ls. An app no longer answers? sudo docker ps -a, then sudo docker start (or sudo docker compose up -d in /srv/reservations).

## Chapter 4 — Full powers

hint-full-powers-end =
    .piste = The gallery runs as root (docker exec … id, ps aux). Give it a user by numbers (user: in compose.yaml, man docker-compose), then hand the photos directory, and everything in it, to that account (ls -lan). Yasmine is uid 1001.
    .solution = In /srv/galerie/compose.yaml, add user: "1001:1001" to the service, then sudo docker compose up -d and sudo chown -R 1001:1001 /srv/galerie/photos (no chmod 777).
