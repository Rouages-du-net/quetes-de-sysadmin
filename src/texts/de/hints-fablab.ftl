### Abgestufte Hinweise für „Die Werkstatt“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).
### Ortsnamen wie in names.ftl.

## Kapitel 1 — Das Update

hint-update-end =
    .lead = Wo bewahrt der Werkzeugschuppen seine Datenbank auf? docker inspect (seine „Mounts“) sagt es dir: in der Schicht des Containers, die mit ihm verschwindet. Bring die Datenbank zuerst in Sicherheit (docker cp), dann erstelle einen neuen Container 1.5 mit einem Volume (-v) und einer Regel --restart (man docker).
    .solution = sudo mkdir /srv/werkzeugschuppen ; sudo docker cp werkzeugschuppen:/var/lib/werkzeugschuppen/werkzeugschuppen.db /srv/werkzeugschuppen/ ; sudo docker rm -f werkzeugschuppen ; sudo docker run -d --name werkzeugschuppen --restart unless-stopped -p 8080:8080 -v /srv/werkzeugschuppen:/var/lib/werkzeugschuppen registry.example/werkzeugschuppen:1.5

## Kapitel 2 — Die Komposition

hint-compose-connected =
    .lead = Starte das Projekt aus /srv/reservations und lies das Log der App: Sie sucht die Datenbank auf localhost. In einem Container ist localhost der Container selbst; in einem Compose-Projekt erreicht man einen Dienst über seinen Namen.
    .solution = In compose.yaml (sudo nano) @localhost: durch @db: in DATABASE_URL ersetzen, dann sudo docker compose up -d und curl http://localhost:8081
hint-compose-end =
    .lead = Mach den Aufbau jetzt solide: ein benanntes Volume für /var/lib/postgresql/data, das Passwort aus compose.yaml in .env verschoben (nur für root lesbar), und restart: bei jedem Dienst. docker compose config zeigt, was Compose versteht.
    .solution = In compose.yaml: ${"{"}POSTGRES_PASSWORD{"}"} statt des Passworts (zweimal), volumes: - pgdaten:/var/lib/postgresql/data und volumes: pgdaten: ganz unten, restart: unless-stopped bei beiden Diensten; dann echo POSTGRES_PASSWORD=werkstatt2027 | sudo tee .env ; sudo chmod 600 .env ; sudo docker compose up -d

## Kapitel 3 — Das Loch in der Firewall

hint-firewall-hole-closed =
    .lead = Was lauscht auf Port 5432? ss -tlnp sagt es dir: docker-proxy. Ein von Docker veröffentlichter Port kommt vor den Regeln von ufw durch. Die Korrektur steht in /srv/reservations/compose.yaml: Diesen Port nicht veröffentlichen, oder nur auf 127.0.0.1.
    .solution = In compose.yaml "5432:5432" durch "127.0.0.1:5432:5432" ersetzen (oder dieses ports: entfernen), dann sudo docker compose up -d. Von deinem Rechner aus prüfen: nc -zv werkstatt 5432
hint-firewall-hole-disk =
    .lead = Die Platte ist voll von Dingen, die Docker behält: docker system df zeigt sie. Images, die kein Container benutzt, dürfen weg; Volumes auf keinen Fall (altes-wiki!).
    .solution = sudo docker image prune -a (mit y antworten), dann df -h /. Nie docker volume prune -a.
hint-firewall-hole-end =
    .lead = Der Port geschlossen, die Platte unter 75 %, beide Apps antworten (8080 und 8081) und das Volume altes-wiki unversehrt: Prüfe jedes davon.
    .solution = nc -zv werkstatt 5432 vom Rechner aus, df -h /, curl http://localhost:8080 und curl http://localhost:8081, sudo docker volume ls. Eine App antwortet nicht mehr? sudo docker ps -a, dann sudo docker start (oder sudo docker compose up -d in /srv/reservations).

## Kapitel 4 — Alle Macht

hint-full-powers-end =
    .lead = Die Galerie läuft als root (docker exec … id, ps aux). Gib ihr einen Benutzer über Zahlen (user: in compose.yaml, man docker-compose) und übergib dann das Fotoverzeichnis und alles darin diesem Konto (ls -lan). Yasmine ist uid 1001.
    .solution = In /srv/galerie/compose.yaml dem Dienst user: "1001:1001" hinzufügen, dann sudo docker compose up -d und sudo chown -R 1001:1001 /srv/galerie/photos (kein chmod 777).
