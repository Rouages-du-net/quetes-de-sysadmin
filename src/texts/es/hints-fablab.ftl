### Pistas graduales de El Taller (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en
### names.ftl.

## Capítulo 1 — La Actualización

hint-update-end =
    .lead = ¿Dónde guarda herramientas su base de datos? docker inspect (sus «Mounts») te lo dice: en la capa del contenedor, que se va con él. Primero pon la base de datos a salvo (docker cp), y luego crea un contenedor 1.5 nuevo con un volumen (-v) y una política --restart (man docker).
    .solution = sudo mkdir /srv/herramientas ; sudo docker cp herramientas:/var/lib/herramientas/herramientas.db /srv/herramientas/ ; sudo docker rm -f herramientas ; sudo docker run -d --name herramientas --restart unless-stopped -p 8080:8080 -v /srv/herramientas:/var/lib/herramientas registry.example/herramientas:1.5

## Capítulo 2 — La Composición

hint-compose-connected =
    .lead = Arranca el proyecto desde /srv/reservations y lee el registro de la aplicación: busca la base de datos en localhost. En un contenedor, localhost es el propio contenedor; en un proyecto Compose, a un servicio se llega por su nombre.
    .solution = En compose.yaml (sudo nano), sustituye @localhost: por @db: en DATABASE_URL, y luego sudo docker compose up -d y curl http://localhost:8081
hint-compose-end =
    .lead = Ahora haz sólido el montaje: un volumen con nombre para /var/lib/postgresql/data, la contraseña sacada de compose.yaml y llevada a .env (legible solo por root), y restart: en cada servicio. docker compose config muestra lo que entiende Compose.
    .solution = En compose.yaml: ${"{"}POSTGRES_PASSWORD{"}"} en lugar de la contraseña (dos veces), volumes: - datos:/var/lib/postgresql/data y volumes: datos: al final, restart: unless-stopped en los dos servicios; luego echo POSTGRES_PASSWORD=taller2027 | sudo tee .env ; sudo chmod 600 .env ; sudo docker compose up -d

## Capítulo 3 — El agujero en el cortafuegos

hint-firewall-hole-closed =
    .lead = ¿Qué escucha en el puerto 5432? ss -tlnp te lo dice: docker-proxy. Un puerto publicado por Docker pasa antes que las reglas de ufw. El arreglo está en /srv/reservations/compose.yaml: no publicar ese puerto, o solo en 127.0.0.1.
    .solution = En compose.yaml, sustituye "5432:5432" por "127.0.0.1:5432:5432" (o quita ese ports:), y luego sudo docker compose up -d. Compruébalo desde tu puesto: nc -zv taller 5432
hint-firewall-hole-disk =
    .lead = El disco está lleno de cosas que guarda Docker: docker system df las muestra. Las imágenes que ningún contenedor usa pueden irse; los volúmenes, desde luego que no (¡wiki-antigua!).
    .solution = sudo docker image prune -a (responde y), y luego df -h /. Nunca docker volume prune -a.
hint-firewall-hole-end =
    .lead = El puerto cerrado, el disco por debajo del 75 %, las dos aplicaciones respondiendo (8080 y 8081) y el volumen wiki-antigua intacto: compruébalo todo.
    .solution = nc -zv taller 5432 desde el puesto, df -h /, curl http://localhost:8080 y curl http://localhost:8081, sudo docker volume ls. ¿Una aplicación ya no responde? sudo docker ps -a, y luego sudo docker start (o sudo docker compose up -d en /srv/reservations).

## Capítulo 4 — Plenos poderes

hint-full-powers-end =
    .lead = La galería funciona como root (docker exec … id, ps aux). Dale un usuario por números (user: en compose.yaml, man docker-compose), y luego da la carpeta de las fotos, y todo lo que contiene, a esa cuenta (ls -lan). Yasmine es el uid 1001.
    .solution = En /srv/galeria/compose.yaml, añade user: "1001:1001" al servicio, y luego sudo docker compose up -d y sudo chown -R 1001:1001 /srv/galeria/photos (nada de chmod 777).
