### Historia «El Taller», capítulo 2 «La Composición»: Docker Compose.
### Los comandos, las rutas, las claves YAML y los mensajes de docker,
### PostgreSQL y la aplicación (en inglés) no se traducen.

chapter-compose = La Composición
    .summary = Una aplicación y su base de datos con Docker Compose: nombres de servicio, volúmenes, secretos en .env, rearranque.

## Archivos

compose-message-yasmine =
    Un mensaje de Yasmine:

    «Nos gustaría que la gente reservara en línea las máquinas del fablab
    (la cortadora láser, las impresoras 3D). He encontrado una aplicación,
    "reservations", que necesita una base de datos PostgreSQL. Un tutorial
    daba un archivo compose.yaml ya hecho: lo he copiado en
    /srv/reservations/.

    No consigo que funcione. Y antes de poner este archivo en el
    repositorio git del fablab, me gustaría que ya no contuviera ninguna
    contraseña: irán en un archivo .env, legible solo por root.

    Por supuesto, todo debe volver a arrancar solo después de un corte de
    luz, y las reservas no deben desaparecer si se vuelven a crear los
    contenedores. La aplicación debe responder en http://localhost:8081.

    Para sudo: fablab-2027. Mis notas: ayuda_compose.txt.»
compose-help-compose =
    NOTAS DE YASMINE — DOCKER COMPOSE

    Lanzarlo todo desde la carpeta del proyecto (/srv/reservations):
      sudo docker compose up -d       crea y arranca (o vuelve a crear) los servicios
      sudo docker compose ps          el estado de los servicios
      sudo docker compose logs aplicacion el registro de un servicio
      sudo docker compose config      el archivo tal como lo entiende Compose
      sudo docker compose down        para y quita los contenedores

    Lo demás: man docker-compose.

## La aplicación

compose-app-welcome =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Reservar una máquina — Fablab</title></head>
    <body>
    <h1>Reservar una máquina</h1>
    <p>Cortadora láser, impresoras 3D, bordadora: elige una franja horaria.</p>
    <footer>reservations 2.1 — database connected</footer>
    </body>
    </html>

## Eventos

compose-event-localhost =
    «connect ECONNREFUSED 127.0.0.1:5432»: la aplicación busca la base de
    datos en localhost. Pero en un contenedor, localhost es el propio
    contenedor, no la máquina ni los demás contenedores. En un proyecto
    Compose, a cada servicio se llega por su nombre, en la red del
    proyecto.
compose-event-without-password =
    PostgreSQL se niega a crear su base de datos sin contraseña: la
    variable POSTGRES_PASSWORD está vacía. docker compose config muestra lo
    que ha entendido Compose, y los avisos dicen qué variable falta en .env.
compose-event-authentication =
    «password authentication failed»: la aplicación y la base de datos no
    tienen la misma contraseña. Una trampa clásica: la imagen de
    PostgreSQL solo lee POSTGRES_PASSWORD una vez, cuando crea la base de
    datos en una carpeta vacía. Si la base de datos ya existe en el
    volumen, cambiar la variable no cambia nada. Mientras la base de datos
    no contenga nada importante, puedes volver a crearla (down -v borra
    los volúmenes); si no, se cambia la contraseña en la propia base de
    datos.
compose-event-connected =
    La aplicación está conectada a su base de datos: http://localhost:8081
    responde. Ahora haz que el montaje sea sólido (datos, secretos,
    rearranque).
compose-event-volumes-erased =
    docker compose down -v: los volúmenes del proyecto se borran, con
    todos los datos de la base de datos. Útil mientras está vacía; nunca
    hay que escribirlo con una base de datos en servicio.
compose-event-in-clear =
    Todo funciona… pero la contraseña sigue escrita en compose.yaml, que va
    a ir al repositorio git. Compose sustituye ${"{"}VARIABLE{"}"} por el
    valor que encuentra en el archivo .env del proyecto (man docker-compose).
compose-event-env-readable =
    La contraseña ha salido de compose.yaml: bien. Pero .env es legible
    por todas las cuentas de la máquina (ls -la). Yasmine quería que solo
    pudiera leerlo root.
compose-event-without-reboot =
    Casi: después de un corte de luz, estos contenedores no volverían a
    arrancar. En compose.yaml, cada servicio puede tener su política de
    rearranque.
compose-event-end =
    http://localhost:8081 responde, la base de datos guarda sus datos en un
    volumen, la contraseña duerme en .env (legible solo por root), y todo
    volverá a arrancar después de un corte de luz. Yasmine publica
    compose.yaml en el repositorio git del fablab, sin ningún secreto.

    ¡Bien hecho! Has terminado el capítulo 2 de El Taller. (Te espera lo
    siguiente: El Agujero en el Cortafuegos.)

    QUÉ HA PASADO
    El compose.yaml del tutorial tenía cuatro fallos: la aplicación buscaba
    la base de datos en localhost (en un contenedor, es él mismo), la base
    de datos no tenía volumen, la contraseña estaba escrita en claro y nada
    volvía a arrancar.

    BUENA PRÁCTICA
    - Entre contenedores del mismo proyecto: el nombre del servicio (db),
      nunca localhost.
    - Los datos de una base de datos en un volumen con nombre, declarado
      bajo volumes:.
    - Los secretos en .env (chmod 600), nunca en el archivo publicado;
      ${"{"}VARIABLE{"}"} en compose.yaml.
    - POSTGRES_PASSWORD solo se usa al crear la base de datos.
    - docker compose config para ver lo que ha entendido Compose; down -v
      borra los datos.
    - restart: unless-stopped en cada servicio.
    - El atributo version: está obsoleto: quítalo.

    OTRA MANERA
    Podman, sin demonio, puede ejecutar los mismos archivos compose; sus
    quadlets describen los contenedores como unidades systemd.
    Kubernetes, para muchas máquinas, a costa de mucha más complejidad.
    Para una aplicación y su base de datos en un servidor, docker compose
    sigue siendo lo más sencillo.

    DOCUMENTACIÓN
    - La red en Compose: https://docs.docker.com/compose/how-tos/networking/
    - Las variables de Compose: https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
    - La imagen de PostgreSQL: https://hub.docker.com/_/postgres
