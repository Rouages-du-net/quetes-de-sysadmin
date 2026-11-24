### Historia «El Taller», capítulo 1 «La Actualización»: Docker,
### contenedores y volúmenes. Los comandos, las rutas y los mensajes de
### docker y de la aplicación herramientas (en inglés) no se traducen.

chapter-update = La Actualización
    .summary = Actualizar una aplicación en Docker sin perder sus datos: la capa del contenedor, docker cp, volúmenes, --restart.

## Archivos

update-message-yasmine =
    Un mensaje de Yasmine, que lleva el fablab:

    «¡Hola! Aquí prestamos herramientas a la gente del barrio, y lo
    apuntamos todo en «herramientas», una pequeña aplicación web. La instalé
    hace dos semanas con Docker, siguiendo las instrucciones:

      docker run -d --name herramientas -p 8080:8080 registry.example/herramientas:1.4

    Acaba de salir la versión 1.5 (corrige un fallo en las fechas de
    devolución). ¿Puedes actualizarla? Sobre todo, no pierdas los 37
    préstamos en curso: ¡solo tengo la aplicación para saber quién tiene
    qué!

    Otra cosa: después del corte de luz del miércoles, herramientas no
    volvió solo, tuve que arrancarlo otra vez.

    Para sudo, tu contraseña es: fablab-2027
    Mis notas están en notes_docker.txt.»
update-notes-docker =
    NOTAS DE YASMINE — DOCKER

      sudo docker ps -a              los contenedores (incluso los parados)
      sudo docker logs herramientas      lo que tiene que decir la aplicación
      curl http://localhost:8080     la aplicación, como en un navegador

    «Actualizar un contenedor»: no se actualiza, se sustituye por uno
    nuevo, creado a partir de la imagen nueva. Lo demás está en man docker
    (y la documentación de herramientas dice que guarda su base de datos en
    /var/lib/herramientas).
update-tools = taladro, sierra de calar, lijadora, escalera, atornillador inalámbrico, soldador, nivel láser, grapadora, despegadora de papel pintado, cortacésped, máquina de coser, sierra circular
update-people = Aya, Bilal, Chloé, Dmitri, Esra, Farid, Gaëlle, Hugo, Ines, Jun, Kenza, Lucas

## La aplicación (páginas)

update-app-welcome =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Herramientas del fablab</title></head>
    <body>
    <h1>Herramientas del fablab</h1>
    <p>{ $loans ->
        [0] Ningún préstamo en curso.
        [one] Un préstamo en curso.
       *[other] { $loans } préstamos en curso.
    } <a href="/prestamos">Ver los préstamos</a></p>
    <footer>herramientas { $version }</footer>
    </body>
    </html>
update-app-loans = Préstamos en curso: { $loans } (los cinco primeros)

## Eventos

update-event-layer =
    «Mounts»: []: este contenedor no tiene ningún volumen ni ninguna
    carpeta de la máquina montada. Todo lo que escribe la aplicación (su
    base de datos incluida) vive en la capa del contenedor, que desaparece
    con él. Antes de borrarlo, hay que poner la base de datos a salvo
    (man docker: cp).
update-event-port-busy =
    «port is already allocated»: el puerto 8080 de la máquina ya lo publica
    otro contenedor en marcha (el antiguo). Dos contenedores no pueden
    escuchar en el mismo puerto de la máquina: primero hay que parar el
    antiguo.
update-event-lost =
    Los 37 préstamos han desaparecido: el contenedor se ha borrado con su
    capa, y la base de datos no se había copiado en ningún sitio. En un
    servidor real, estaría perdida para siempre. Aquí puedes reiniciar el
    capítulo desde el menú. La regla: los datos de un contenedor van en un
    volumen, y se copian antes de cualquier operación arriesgada.
update-event-new-empty =
    La versión 1.5 funciona… con una base de datos nueva y vacía (docker
    logs lo dice: «creating a new one»). La base de datos del contenedor
    antiguo no está en el nuevo. Si la pusiste a salvo, todavía hay que
    volver a ponerla en su sitio (y reiniciar la aplicación para que la
    migre).
update-event-without-reboot =
    Los 37 préstamos están, en la versión 1.5, y la base de datos está por
    fin en un volumen. Pero Yasmine lo dijo: después de un corte de luz,
    herramientas no vuelve sola. Mira la opción --restart de docker run (o
    docker update).
update-event-end =
    La aplicación herramientas 1.5 funciona, con sus 37 préstamos, en un
    volumen que sobrevivirá a las próximas actualizaciones, y volverá a
    arrancar sola
    después de un corte de luz. Yasmine: «¡Y la próxima actualización será
    simplemente: contenedor nuevo, mismo volumen!»

    ¡Bien hecho! Has terminado el capítulo 1 de El Taller. (Te espera lo
    siguiente: La Composición.)

    QUÉ HA PASADO
    La aplicación herramientas se había lanzado sin volumen: su base de datos vivía en la
    capa del contenedor. Actualizar una aplicación en Docker es borrar el
    contenedor y crear uno nuevo; sin precauciones, la base de datos se
    iba con el antiguo.

    BUENA PRÁCTICA
    - Antes que nada: docker inspect (los «Mounts») para saber dónde están
      los datos.
    - Los datos de un contenedor van en un volumen (-v nombre:/ruta) o en
      una carpeta de la máquina (-v /srv/app:/ruta), nunca en su capa.
    - Copia antes de tocar: docker cp contenedor:/ruta ./copia.
    - Para el antiguo antes de arrancar el nuevo en el mismo puerto; bórralo
      solo una vez comprobado el nuevo (docker logs, curl).
    - --restart unless-stopped: el contenedor vuelve a arrancar con la
      máquina.
    - El grupo docker equivale a root: mete en él solo a quien administra.

    DOCUMENTACIÓN
    - Volúmenes: https://docs.docker.com/engine/storage/volumes/
    - docker cp: https://docs.docker.com/reference/cli/docker/container/cp/
    - Arrancar contenedores automáticamente: https://docs.docker.com/engine/containers/start-containers-automatically/
