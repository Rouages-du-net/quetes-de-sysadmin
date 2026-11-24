### Historia «La Gaceta», capítulo 1 «El repositorio desnudo»: desplegar un
### sitio con git push, un repositorio desnudo y un hook post-receive. Los
### comandos, las rutas y los mensajes de git, nginx y diff no se traducen.

chapter-bare-repo = El repositorio desnudo
    .summary = Publicar el sitio del periódico con git push: un repositorio desnudo en el servidor, un hook post-receive, y nada de editar a mano.

## Archivos

bare-repo-message-samia =
    Un mensaje de Samia, redactora jefa de La Gaceta, el periódico del
    barrio:

    «¡Te damos la bienvenida a la Gaceta! Nuestro sitio (curl
    http://gazette.example) lo sirve nginx desde /var/www/gazette. Hasta
    ahora, cada cual copiaba sus archivos ahí a mano… y la semana pasada
    un artículo quedó sobrescrito por una versión antigua.

    El sitio ya lo sigue git, en ~/gazette. A partir de ahora, solo
    publicamos con git:
      - un repositorio en el servidor: /srv/git/gazette.git (un
        repositorio «desnudo», bare);
      - en cuanto se le envían commits (git push), el sitio se actualiza
        solo.

    Mi artículo sobre la fiesta vecinal está listo en ~/gazette, pero aún
    no está en línea. Todo está en man git. Para sudo: gazette-2027.»
bare-repo-word-theo =
    Una nota de Théo, el becario:

    «¡Perdón otra vez por el artículo sobrescrito! Por cierto: he corregido
    una errata en el título del sitio, directamente en
    /var/www/gazette/index.html. No me ha dado tiempo a meterlo en git…»

## El sitio (HTML; { $date }: AAAA-MM-DD, { $day }: el día del mes)

bare-repo-title-mistake = La Gazeta del Barrio
bare-repo-site-index-v1 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La Gazeta del Barrio</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gazeta del Barrio</h1>
    <p>Noticias de la calle, por quienes viven en ella.</p>
    <ul>
    <li><a href="agenda.html">La agenda del mes</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-index-theo =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La Gaceta del Barrio</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gaceta del Barrio</h1>
    <p>Noticias de la calle, por quienes viven en ella.</p>
    <ul>
    <li><a href="agenda.html">La agenda del mes</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-index-v2 =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La Gazeta del Barrio</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gazeta del Barrio</h1>
    <p>Noticias de la calle, por quienes viven en ella.</p>
    <ul>
    <li><a href="fiesta-vecinal.html">La fiesta vecinal, desde el patio</a></li>
    <li><a href="agenda.html">La agenda del mes</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-article =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La fiesta vecinal, desde el patio</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La fiesta vecinal, desde el patio</h1>
    <p>Tres mesas, dos guitarras y un pastel de pistacho: el viernes por la
    noche, el patio del número 12 estuvo de fiesta hasta tarde. Por Samia.</p>
    </body>
    </html>
bare-repo-site-agenda =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La agenda del mes</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La agenda del mes</h1>
    <p>Rastro vecinal: sábado <time datetime="{ $date }">{ $day } de junio</time>, de 8:00 a 18:00.</p>
    </body>
    </html>
bare-repo-commit-1 = Primera versión del sitio
bare-repo-commit-2 = Artículo: la fiesta vecinal

## Eventos

bare-repo-event-drift =
    Ahí está la corrección de Théo: «Gazeta» se ha convertido en «Gaceta»,
    solo en la copia del servidor. No está en git: si despliegas ~/gazette
    tal cual, desaparecerá. Mejor llevarla primero a ~/gazette/index.html,
    y luego git commit.
bare-repo-event-rights =
    El repositorio se creó con sudo: pertenece a root, y git push, que se
    ejecuta con tu nombre, no tiene permiso para escribir en él. Mira
    ls -l /srv/git: ¿quién debería ser su propietario? (man chown)
bare-repo-event-without-hook =
    El repositorio del servidor sí ha recibido tus commits (git log
    --oneline en /srv/git/gazette.git), pero el sitio no ha cambiado: nada
    los extrae a /var/www/gazette. Ese es el trabajo de un hook,
    hooks/post-receive, que se ejecuta después de recibir cada push
    (man git).
bare-repo-event-hook-ignore =
    El push ha pasado, pero git no ha ejecutado el hook: no es ejecutable
    (ls -l /srv/git/gazette.git/hooks). Un hook es un programa; mira
    man chmod.
bare-repo-event-not-tracked =
    git se niega a sobrescribir archivos que no conoce en /var/www/gazette:
    los pusieron ahí a mano, y no quiere perder nada. Con -f (force), los
    sustituye. Antes de forzar, mira lo que perderías:
    diff -r ~/gazette /var/www/gazette.
bare-repo-event-correction-lost =
    La corrección de Théo ha desaparecido del sitio: el despliegue ha
    sustituido index.html por el de git, que no la tenía. A partir de
    ahora, lo que no está en git no existe. Vuelve a hacer la corrección
    en ~/gazette («Gazeta» pasa a «Gaceta», dos veces en index.html), y
    luego commit y push.
bare-repo-event-in-line =
    Samia: «Mi artículo está en línea, y la errata del título ha
    desaparecido, ¡gracias! Una cosita: en agenda.html, el rastro es el
    sábado 12 de junio, no el 21. La fecha está escrita dos veces: en el
    texto y en datetime="2027-06-21". ¿Puedes corregirla, y publicarla
    como es debido?»
bare-repo-event-by-hand =
    La fecha está corregida en el servidor, pero no en git: justo lo que
    queríamos dejar de hacer. En el próximo push, la corrección quedaría
    sobrescrita. Corrígela en ~/gazette, y luego commit y push.
bare-repo-event-end =
    El sitio está al día, y solo cambia con git push. Samia: «Ya nadie
    sobrescribe el trabajo de nadie. Y si una versión sale mal, ahí está
    el historial».

    ¡Bien hecho! Has terminado el capítulo 1 de La Gaceta. (Te espera lo
    siguiente: ssh gaceta.)

    QUÉ HA PASADO
    El sitio vivía en una carpeta editada a mano: imposible saber quién
    había cambiado qué, y una copia podía sobrescribir otra. Un
    repositorio desnudo (git init --bare) no tiene copia de trabajo: solo
    sirve para recibir pushes. Su hook post-receive, un script que se
    ejecuta después de recibir cada push, extrae el último commit a la
    carpeta del sitio (git --work-tree=… checkout -f). Lo que solo estaba
    en el servidor (la corrección de Théo) tenía que pasar primero a git.

    BUENA PRÁCTICA
    - Una sola fuente: el repositorio. Nunca edites el sitio en el
      servidor; usa diff -r para detectar lo que se ha desviado antes de
      cambiar de sistema.
    - El repositorio del servidor pertenece a la cuenta que hace push (o
      a un grupo, con git init --bare --shared=group).
    - Un hook es un programa: chmod +x, y empieza por #!/bin/sh.
    - El despliegue debe ser reproducible: el mismo commit da el mismo
      sitio.

    DOCUMENTACIÓN
    - Git en el servidor: https://git-scm.com/book/en/v2/Git-on-the-Server-Setting-Up-the-Server
    - Los hooks de git: https://git-scm.com/docs/githooks
    - --work-tree: https://git-scm.com/docs/git
