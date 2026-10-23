### Indices gradués de La Fabrique (voir src/moteur/indices.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — La mise à jour

indice-mise-a-jour-fin =
    .piste = Où l'outilthèque range-t-elle sa base ? docker inspect (ses « Mounts ») le dit : dans la couche du conteneur, qui part avec lui. Mets d'abord la base à l'abri (docker cp), puis crée un conteneur neuf en 1.5 avec un volume (-v) et une politique --restart (man docker).
    .solution = sudo mkdir /srv/outiltheque ; sudo docker cp outiltheque:/var/lib/outiltheque/outiltheque.db /srv/outiltheque/ ; sudo docker rm -f outiltheque ; sudo docker run -d --name outiltheque --restart unless-stopped -p 8080:8080 -v /srv/outiltheque:/var/lib/outiltheque registre.example/outiltheque:1.5

## Chapitre 2 — La composition

indice-composition-connectee =
    .piste = Lance le projet depuis /srv/reservations et lis le journal de l'appli : elle cherche la base sur localhost. Dans un conteneur, localhost, c'est le conteneur lui-même ; dans un projet Compose, un service se joint par son nom.
    .solution = Dans compose.yaml (sudo nano), remplace @localhost: par @db: dans DATABASE_URL, puis sudo docker compose up -d et curl http://localhost:8081
indice-composition-fin =
    .piste = Reste à rendre l'installation solide : un volume nommé pour /var/lib/postgresql/data, le mot de passe sorti de compose.yaml vers .env (lisible par root seulement), et restart: sur chaque service. docker compose config montre ce que Compose comprend.
    .solution = Dans compose.yaml : ${"{"}POSTGRES_PASSWORD{"}"} à la place du mot de passe (deux fois), volumes: - donnees:/var/lib/postgresql/data et volumes: donnees: en bas, restart: unless-stopped aux deux services ; puis echo POSTGRES_PASSWORD=atelier2027 | sudo tee .env ; sudo chmod 600 .env ; sudo docker compose up -d

## Chapitre 3 — Le trou dans le pare-feu

indice-contournement-ferme =
    .piste = Qui écoute sur le port 5432 ? ss -tlnp le dit : docker-proxy. Un port publié par Docker passe avant les règles d'ufw. La solution est dans /srv/reservations/compose.yaml : ne pas publier ce port, ou seulement sur 127.0.0.1.
    .solution = Dans compose.yaml, remplace "5432:5432" par "127.0.0.1:5432:5432" (ou retire ce ports:), puis sudo docker compose up -d. Vérifie depuis ton poste : nc -zv fabrique 5432
indice-contournement-disque =
    .piste = Le disque est plein de choses que Docker garde : docker system df les montre. Les images qu'aucun conteneur n'utilise peuvent partir ; les volumes, surtout pas (wiki-ancien !).
    .solution = sudo docker image prune -a (répondre y), puis df -h /. Jamais docker volume prune -a.
indice-contournement-fin =
    .piste = Le port fermé, le disque sous 75 %, les deux applis qui répondent (8080 et 8081) et le volume wiki-ancien intact : vérifie chacun.
    .solution = nc -zv fabrique 5432 depuis le poste, df -h /, curl http://localhost:8080 et curl http://localhost:8081, sudo docker volume ls. Une appli ne répond plus ? sudo docker ps -a, puis sudo docker start (ou sudo docker compose up -d dans /srv/reservations).

## Chapitre 4 — Les pleins pouvoirs

indice-pleins-pouvoirs-fin =
    .piste = La galerie tourne en root (docker exec … id, ps aux). Donne-lui un utilisateur par numéros (user: dans compose.yaml, man docker-compose), puis rends le dossier des photos, et tout ce qu'il contient, à ce compte (ls -lan). Yasmine, c'est l'uid 1001.
    .solution = Dans /srv/galerie/compose.yaml, ajoute user: "1001:1001" au service, puis sudo docker compose up -d et sudo chown -R 1001:1001 /srv/galerie/photos (sans chmod 777).
