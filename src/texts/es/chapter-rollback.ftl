### Historia «La Gaceta», capítulo 2 «Marcha atrás»: una versión por
### carpeta, un enlace current, volver atrás con ln -sfn, y pruebas antes
### de poner en línea. Los comandos, las rutas y los mensajes de git, ln,
### nginx y sh no se traducen.

chapter-rollback = Marcha atrás
    .summary = Una versión que rompe el sitio: volver a la anterior en un instante, y luego hacer que cada publicación pase antes las pruebas.

## Archivos

rollback-message-samia =
    Un mensaje de Samia, lunes 21:02:

    «¡Socorro! El sitio muestra un error desde que Théo hizo push de su
    nueva maquetación, y el boletín sale mañana por la mañana con un
    enlace a la Gaceta.

    Desde la semana pasada, el hook del servidor
    (/srv/git/gazette.git/hooks/post-receive) publica cada push en su
    propia carpeta, /srv/gazette/releases/, y luego apunta el enlace
    /srv/gazette/current a la nueva versión. nginx sirve current.
    Así que las versiones antiguas siguen todas ahí…

    Por orden:
      1. vuelve a poner el sitio en marcha, ya;
      2. asegúrate de que no pueda volver a pasar: escribí tests.sh
         (en el repositorio), pero nadie lo ejecuta antes de publicar;
      3. luego publica la maquetación de Théo, corregida.

    Para sudo: gazette-2027.»
rollback-hook-comment = Publica cada push en una carpeta nueva bajo releases/, y luego cambia el enlace current.
rollback-hook-echo = Versión $VERSION en línea
rollback-tests =
    #!/bin/sh
    # Comprobaciones antes de publicar (Samia).
    # Se lanza desde la carpeta del sitio: sh tests.sh
    set -e
    echo "Comprobando la página de inicio (index.html)..."
    test -f index.html
    grep -q "<title>" index.html
    echo "Comprobando la agenda (agenda.html)..."
    test -f agenda.html
    echo "Tests OK"

## El sitio

rollback-site-index =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La Gaceta del Barrio</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gaceta del Barrio</h1>
    <p>Noticias de la calle, por quienes viven en ella.</p>
    <ul>
    <li><a href="fiesta-vecinal.html">La fiesta vecinal, entre bastidores</a></li>
    <li><a href="agenda.html">La agenda del mes</a></li>
    </ul>
    </body>
    </html>
rollback-site-welcome =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>La Gaceta del Barrio</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <header><h1>La Gaceta del Barrio</h1><p>Noticias de la calle, por quienes viven en ella.</p></header>
    <section class="lead">
    <h2><a href="fiesta-vecinal.html">En portada: la fiesta vecinal, entre bastidores</a></h2>
    </section>
    <nav><a href="agenda.html">La agenda del mes</a></nav>
    </body>
    </html>
rollback-commit-3 = Título: Gaceta, bien escrito
rollback-commit-4 = Agenda: el rastro es el 12 de junio
rollback-commit-5 = Añadir tests.sh: comprobaciones antes de publicar
rollback-commit-6 = Nueva maquetación de la portada
# { $number }: el número del intento
rollback-commit-theo = Nueva maquetación, intento { $number }

## Eventos

# { $output }: lo que git le ha mostrado a Théo (líneas sangradas)
rollback-theo-push =
    Théo, desde su casa: «Vuelvo a probar mi maquetación…». Hace push
    (todavía sin index.html). Esto es lo que le dice git:

    { $output }
rollback-event-failure =
    403 Forbidden: nginx sirve /srv/gazette/current, pero no encuentra ahí
    ninguna página de inicio (index.html). Mira adónde apunta current (ls
    -l /srv/gazette, o readlink), y lo que hay en cada versión bajo
    releases/. La versión anterior está intacta: basta con que current
    vuelva a apuntar a ella (man ln).
rollback-event-without-n =
    El nuevo enlace se ha creado DENTRO de la versión rota (ls -l
    /srv/gazette/releases/20270517203012): current apunta a una carpeta,
    así que ln ha entrado en ella en lugar de sustituir el enlace. La
    opción -n es la que trata current como un archivo normal:
    ln -sfn destino current.
rollback-event-restored =
    El sitio vuelve a responder. Samia: «¡Uf! Y ha llevado un segundo: la
    versión antigua nunca se había borrado, solo hemos cambiado el enlace.
    Ahora, asegurémonos de que no vuelva a pasar: el hook debe ejecutar
    tests.sh sobre la nueva versión, y no cambiar current si las pruebas
    fallan». (Mira el hook, y man sh.)
rollback-event-safeguard =
    El push de Théo ha llegado al servidor, pero sus pruebas han fallado y
    el hook se ha detenido antes de cambiar current: el sitio no ha
    cambiado. Para eso sirve una salvaguarda. Ahora publica su maquetación
    de verdad: recupera sus commits (git pull), dale a la página el nombre
    correcto, commit y push.
rollback-event-safeguard-pierced =
    El push roto de Théo ha salido en línea de todas formas: el hook no ha
    detenido la publicación. Restaura el sitio, y luego mira el hook: ¿se
    ejecutan las pruebas ANTES de cambiar current, desde la carpeta de la
    nueva versión, y un fallo detiene el script (set -e, o || exit 1)?
    Théo volverá a intentarlo en cuanto cambie el hook.
rollback-event-tests-elsewhere =
    La última versión sí contiene index.html, pero no se ha puesto en
    línea: sus pruebas han fallado igualmente. tests.sh busca index.html
    en la carpeta desde la que se ejecuta. ¿Desde dónde lo ejecuta el
    hook? (Un hook arranca en el repositorio, /srv/git/gazette.git; cd
    cambia de carpeta.)
rollback-event-end =
    La nueva maquetación está en línea, publicada por el hook después de
    sus pruebas. Samia: «Esta vez, un error en el repositorio ya no puede
    romper el sitio. Y si una versión pasa las pruebas pero no nos gusta,
    sabemos volver atrás en un segundo».

    ¡Bien hecho! Has terminado el capítulo 2 de La Gaceta. (Te espera lo
    siguiente: ssh gaceta.)

    QUÉ HA PASADO
    Cada publicación va a su propia carpeta; el enlace current apunta a la
    que está en línea. Volver atrás es cambiar el enlace: ln -sfn sustituye
    el enlace de una vez (sin -n, ln entra en la carpeta a la que apunta).
    Luego el hook aprendió a ejecutar las pruebas sobre la nueva versión
    ANTES de cambiar, y a detenerse si fallan: una versión rota llega al
    servidor, pero nunca sale en línea.

    BUENA PRÁCTICA
    - Conserva las versiones anteriores; se cambia de una a otra, no se
      copia encima.
    - Una vuelta atrás debería ser un solo comando, probado de antemano.
    - Prueba antes de poner en línea (integración continua), y detenlo
      todo al primer fallo: set -e, o comando || exit 1.
    - post-receive ya no puede rechazar el push (ya se ha recibido); para
      rechazar los propios commits, usa pre-receive.
    - Limpia de vez en cuando las versiones antiguas (conserva algunas).

    DOCUMENTACIÓN
    - ln (coreutils): https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
    - Los hooks de git: https://git-scm.com/docs/githooks
    - dash, el /bin/sh de Debian: https://manpages.debian.org/bookworm/dash/dash.1.en.html
