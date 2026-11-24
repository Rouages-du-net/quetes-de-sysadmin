### Historia «El Taller», capítulo 3 «El agujero en el cortafuegos»:
### Docker y ufw, y el espacio que ocupa Docker. Los comandos, las rutas y
### los mensajes de docker, ufw, ss y nc no se traducen.

chapter-firewall-hole = El agujero en el cortafuegos
    .summary = La base de datos del fablab abierta al mundo pese a ufw: puertos publicados por Docker, y luego liberar espacio sin tirar lo que importa.

## Archivos

firewall-hole-message-rania =
    Un mensaje de Rania, de Las Cartas del Barrio:

    «¡Hola! Anoche probé los puertos del servidor del fablab desde casa,
    por curiosidad. Sorpresa: PostgreSQL responde en el puerto 5432,
    abierto a todo el mundo. ¡Y eso que Yasmine me enseñó su cortafuegos:
    ufw solo permite SSH, 8080 y 8081!

    Pruébalo tú desde tu puesto (exit para volver a él):
      nc -zv taller 5432

    Una base de datos abierta en internet es una puerta abierta para
    todos los robots que prueban contraseñas…»
firewall-hole-word-yasmine =
    Una nota de Yasmine:

    «Uy. Había añadido el puerto 5432 a la base de datos en
    /srv/reservations/compose.yaml para conectarme con pgAdmin desde mi
    portátil. Creía que ufw lo bloqueaba.

    Y otro problema: el disco del servidor está lleno a más del 90 %
    (df -h /). Creo que es Docker. ¿Puedes liberar espacio? Pero
    cuidado: hagas lo que hagas, NO toques el volumen wiki-antigua. Tiene
    las páginas de nuestra antigua wiki, que todavía tenemos que
    recuperar. Ningún contenedor lo usa ahora mismo.

    Para sudo: fablab-2027.»

firewall-hole-compose-comment = Para pgAdmin, desde mi portátil (Yasmine)

## Eventos

firewall-hole-event-ss =
    docker-proxy escucha en 0.0.0.0:5432: Docker publica el puerto de la
    base de datos, en todas las direcciones de la máquina. Y sudo ufw
    status no dice nada de 5432… Docker escribe sus propias reglas en
    iptables, que el kernel consulta ANTES que las reglas de ufw: un
    puerto publicado por Docker se salta ufw.
firewall-hole-event-ufw-useless =
    Una regla de ufw para 5432 no cambia nada: los paquetes hacia un
    puerto publicado por Docker se redirigen al contenedor antes de llegar
    a las reglas de ufw. Prueba desde tu puesto: nc -zv taller 5432. La
    solución está en compose.yaml: no publicar este puerto, o publicarlo
    solo en 127.0.0.1.
firewall-hole-event-closed =
    El puerto 5432 ya no responde desde fuera, y la aplicación de reservas
    sigue funcionando: llega a la base de datos por la red del proyecto,
    sin puerto publicado. Para pgAdmin, Yasmine pasará por un túnel SSH:
    ssh -L 5432:127.0.0.1:5432 taller (con el puerto publicado solo en
    127.0.0.1), o docker compose exec db psql.
# { $volumes }: los volúmenes borrados
firewall-hole-event-volume-lost =
    El volumen { $volumes } ha desaparecido, con todos sus datos: docker
    volume prune -a borra todos los volúmenes que ningún contenedor usa,
    aunque tengan nombre e importen. En un servidor real, estaría perdido.
    Aquí puedes reiniciar el capítulo desde el menú. Antes de un prune:
    docker system df, docker volume ls, y leer el aviso.
# { $percent }: ocupación del disco
firewall-hole-event-disk =
    El disco vuelve a respirar: { $percent } % ocupado. Las imágenes que
    ningún contenedor usa (versiones antiguas, pruebas olvidadas, imágenes
    sin nombre) ocupaban casi todo el espacio.
firewall-hole-event-end =
    La base de datos ya no se ve desde internet, las dos aplicaciones
    funcionan, el disco tiene sitio y la wiki sigue esperando en su
    volumen. Rania vuelve a hacer su prueba: «Ya no hay nada en el 5432.
    ¡Bien hecho!»

    ¡Bien hecho! Has terminado el capítulo 3 de El Taller. (Lo siguiente:
    ssh taller, para la galería de fotos del fablab.)

    QUÉ HA PASADO
    «ports: - "5432:5432"» publica el puerto en todas las direcciones de la
    máquina. Para ello, Docker escribe sus propias reglas iptables (tabla
    nat, cadena DOCKER), que el kernel aplica antes que las reglas de ufw:
    el cortafuegos que muestra ufw status nunca ve estos paquetes. Y
    Docker guarda todo lo que ha descargado, hasta que se hace limpieza.

    BUENA PRÁCTICA
    - Publica solo lo que debe ser público; entre contenedores, basta con
      la red del proyecto.
    - Un puerto solo para ti: "127.0.0.1:5432:5432", y un túnel SSH.
    - Prueba desde fuera (nc -zv, nmap), nunca solo ufw status.
    - docker system df para ver el espacio ocupado; docker image prune -a y
      docker container prune para recuperarlo.
    - docker volume prune -a también borra los volúmenes con nombre no
      usados: comprueba antes, o no lo uses nunca en un servidor.

    DOCUMENTACIÓN
    - Docker y ufw: https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw
    - Publicar un puerto: https://docs.docker.com/engine/network/#published-ports
    - Hacer limpieza: https://docs.docker.com/engine/manage-resources/pruning/
