### Historia «El Taller», capítulo 4 «Plenos poderes»: no ejecutar un
### contenedor como root. Los comandos, las rutas, las opciones y los
### mensajes de docker, chown, ls y ps nunca se traducen.

chapter-full-powers = Plenos poderes
    .summary = La galería de fotos del fablab funciona como root: --user, el uid compartido entre el contenedor y la máquina, y la carpeta que hay que dar a la cuenta correcta.

## Archivos

full-powers-message-yasmine =
    Un mensaje de Yasmine:

    «¡Hola! ¿Conoces la galería de fotos del fablab (puerto 8082)? La gente
    sube allí fotos de sus proyectos. La lancé con docker compose, en
    /srv/galeria.

    Dos problemas. Uno: ya no puedo añadir ni quitar fotos en
    /srv/galeria/photos sin sudo, «Permission denied». ¡Y eso que es
    nuestra carpeta! Dos: Rania dice que la galería «funciona como root»,
    y que es peligroso (su nota está al lado de este mensaje).

    Lo que me gustaría:
      - que la galería ya no funcione como root;
      - poder gestionar yo misma las fotos (soy yasmine, uid 1001);
      - ¡y sobre todo no perder ninguna de las 14 fotos!

    Para sudo: fablab-2027.»
full-powers-word-rania =
    Una nota de Rania:

    «La galería recibe archivos subidos por desconocidos: es justo el tipo
    de programa que atacan. Si alguien le encuentra un fallo, su código se
    ejecuta con los privilegios de la galería.

    Y un contenedor no es una máquina aparte: sus procesos se ejecutan en
    el kernel de la máquina. Root en el contenedor es el mismo uid 0 que
    root en la máquina, y todo lo que se monta en el contenedor queda a
    su merced.

    Empieza por mirar quién eres, dentro y fuera:
      sudo docker exec galeria-galeria-1 id
      ps aux
    Luego el manual: man docker y man docker-compose.»
full-powers-readme =
    Gallery 3.2 — LEEME (incluido con la imagen registry.example/galeria)

    Las fotos viven en /app/photos: monta ahí una carpeta o un volumen.
    Al arrancar, la galería reconstruye su índice de miniaturas en
    /app/photos/.miniaturas: debe poder escribir en /app/photos.

    La imagen está hecha sobre node:22 y no elige usuario. Funciona con
    cualquier uid, siempre que pueda escribir en /app/photos.

# { $count }: el número de fotos
full-powers-gallery-welcome = { $count ->
        [one] Galería del fablab: una foto de proyecto. ¡Manda la tuya!
       *[other] Galería del fablab: { $count } fotos de proyectos. ¡Manda la tuya!
    }

## Eventos

full-powers-event-root =
    La galería funciona como root: uid=0 en el contenedor, y root en ps aux
    en la máquina, como sshd. Su imagen no declara usuario (no hay USER),
    y compose.yaml tampoco: así que, por defecto, un contenedor funciona
    como root. Y sin un espacio de nombres de usuario (userns-remap,
    desactivado por defecto), el uid 0 del contenedor ES el uid 0 de la
    máquina. Por eso también los archivos de /srv/galeria/photos
    pertenecen a root. Busca --user en man docker, y user: en
    man docker-compose.
full-powers-event-unknown =
    «unable to find user»: un nombre dado a --user (o a user:) debe existir
    en el /etc/passwd de la IMAGEN, no en el de la máquina. Con números
    (uid:gid), se acabó el problema: el kernel solo conoce números.
full-powers-event-eacces =
    La galería ya no arranca: EACCES, permiso denegado (sudo docker logs,
    o docker compose logs). Ya no funciona como root, así que se le
    aplican los permisos Unix de la máquina, por número: uid y gid.
    Pero /srv/galeria/photos y lo que contiene siguen perteneciendo a
    root. Mira ls -lan /srv/galeria/photos (-n: los números, -a: también
    los archivos ocultos). Docker la vuelve a arrancar solo (restart:
    unless-stopped): volverá en cuanto pueda escribir.
full-powers-event-uid-1000 =
    La galería funciona con el uid 1000… y en esta máquina, el uid 1000
    eres tú (tu cuenta, tu). En ls -l, sus archivos te pertenecen: el
    kernel solo ve números, y cada /etc/passwd les da su propio nombre
    (node en la imagen, tu en la máquina). Yasmine (uid 1001), en cambio,
    sigue sin poder escribir en la carpeta de las fotos.
full-powers-event-open-to-all =
    Una carpeta en la que todo el mundo puede escribir (chmod 777, o+w):
    «funciona», pero entonces cualquier cuenta, cualquier programa de la
    máquina puede dejar o borrar archivos ahí. Mejor da la carpeta al
    propietario correcto (chown), sin abrir los permisos de los demás.
# { $count }: el número de fotos desaparecidas
full-powers-event-photos-lost =
    { $count ->
        [one] Ha desaparecido una foto de /srv/galeria/photos. En un servidor real, sin copia de seguridad, estaría perdida.
       *[other] Han desaparecido { $count } fotos de /srv/galeria/photos. En un servidor real, sin copia de seguridad, estarían perdidas.
    } Aquí puedes reiniciar el capítulo desde el menú.
full-powers-event-end =
    La galería funciona con una cuenta normal, Yasmine gestiona las fotos
    sin sudo, y las 14 fotos están ahí. Rania: «Si alguien entra en la
    galería, solo tendrá los privilegios de una cuenta normal. No los de
    root».

    ¡Bien hecho! Has terminado el capítulo 4 de El Taller, y toda la
    historia.

    QUÉ HA PASADO
    La imagen de la galería no declara usuario: sin --user (o user:), un
    contenedor funciona como root. Un contenedor comparte el kernel de la
    máquina; sin espacio de nombres de usuario, su uid 0 es el uid 0 de
    la máquina. Los archivos que escribe en una carpeta montada pertenecen
    a root, y un fallo de la aplicación daría privilegios de root sobre
    todo lo montado. Con un uid normal, la galería está sujeta a los
    permisos Unix como cualquier otro programa: había que darle su
    carpeta (chown -R).

    BUENA PRÁCTICA
    - Comprueba: docker exec contenedor id, y ps aux en la máquina.
    - Un uid normal para cada contenedor: USER en el Dockerfile, si no
      --user uid:gid o user: "uid:gid".
    - Números mejor que nombres: un nombre debe existir en la imagen.
    - Da las carpetas montadas a ese uid (chown -R), nunca chmod 777.
    - Quita lo que no hace falta: --cap-drop ALL, --security-opt
      no-new-privileges, --read-only.
    - Nunca --privileged, ni /var/run/docker.sock montado en un contenedor
      expuesto: eso es root en la máquina. El grupo docker, igual.
    - Para ir más allá: userns-remap, o Docker en modo rootless.

    DOCUMENTACIÓN
    - docker run --user: https://docs.docker.com/reference/cli/docker/container/run/#user
    - user: en Compose: https://docs.docker.com/reference/compose-file/services/#user
    - Seguridad de Docker: https://docs.docker.com/engine/security/
    - userns-remap: https://docs.docker.com/engine/security/userns-remap/
    - Docker rootless: https://docs.docker.com/engine/security/rootless/
