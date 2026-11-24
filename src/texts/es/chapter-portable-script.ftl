### Historia «El Otro Unix», capítulo «El script que se rompió»: un script de
### copia de seguridad escrito para Debian, ejecutado en FreeBSD. Los
### comandos, opciones, rutas y mensajes de error no se traducen.

chapter-portable-script = El script que se rompió
    .summary = Un script de copia de seguridad escrito en Debian falla en el servidor FreeBSD del cineclub: lee cada error y arréglalo con el manual de este sistema.

## Files

portable-script-message-yanis =
    De:    Yanis
    Para:  tú

    ¡Hola! Soy el nuevo voluntario del cineclub. Escribí un script para
    hacer la copia del sitio cada noche (nightly-backup.sh, en tu carpeta).
    En mi portátil Debian funciona perfectamente. En el servidor, la última
    copia de /var/backups/state.conf es del 1 de septiembre.

    Lucien, que montó el servidor hace años, decía siempre «no es Linux,
    es FreeBSD». Yo creía que Unix era Unix…

    ¿Puedes hacer que funcione? La copia de anoche (con la fecha de ayer)
    sería un buen comienzo.

    Yanis

## Events

portable-script-event-not-found =
    «not found»… sobre un archivo que está ahí mismo. FreeBSD lee la primera
    línea, #!/bin/bash, y busca /bin/bash: no existe. bash no forma parte
    del sistema base de FreeBSD (un paquete lo pondría en
    /usr/local/bin/bash). El shell del sistema base es /bin/sh: un script
    que solo necesita sh funciona en todas partes.
portable-script-event-date =
    date: illegal option -- d. -d es del date de GNU (el de Debian). FreeBSD
    tiene su propio date, de BSD, con otras opciones: su manual (man date)
    explica cómo ajustar una fecha (-v).
portable-script-event-stat =
    stat: illegal option -- c. -c FORMATO es del stat de GNU. El stat de BSD
    recibe su formato con -f, y las secuencias también cambian: man stat.
portable-script-event-sed =
    sed se queja de un script llamado /var/backups/state.conf: el -i del sed
    de BSD siempre lleva una palabra detrás, el sufijo de la copia de
    seguridad (-i '' para ninguna). Aquí tomó el s/…/…/ como sufijo, y luego
    el nombre del archivo como script (/var/ se volvió una dirección, b un
    comando). man sed, en -i.
portable-script-event-end =
    Yanis: «¡Por fin la copia de ayer! Y state.conf está al día. A partir
    de ahora leeré el manual de la máquina en la que esté.»

    ¡Bien hecho! Has terminado el capítulo «El script que se rompió».

    QUÉ HA PASADO
    El script estaba escrito para las herramientas de Debian, que son las de
    GNU. FreeBSD tiene las suyas, de BSD: mismos nombres, mismo propósito,
    pero otras opciones. date -d, stat -c y sed -i sin sufijo son solo de
    GNU; y bash no viene instalado por defecto.

    BUENA PRÁCTICA
    - Lee el manual de la máquina en la que estás: man date en FreeBSD no es
      man date en Debian.
    - Para un script que deba funcionar en todas partes: #!/bin/sh, y solo
      lo que garantiza POSIX (date +%F, pero no date -d; nada de sed -i:
      escribe en un archivo temporal y luego mv).
    - set -e se detiene en el primer error: el mensaje te dice qué línea.

    OTRA MANERA
    pkg install coreutils trae las herramientas de GNU a FreeBSD, con una g
    delante (gdate, gstat, y gsed en su propio paquete): práctico para un
    script copiado tal cual, pero entonces el script depende de paquetes.
    pkg install bash, y #!/usr/local/bin/bash (o #!/usr/bin/env bash), para
    el propio bash.

    DOCUMENTACIÓN
    - date(1) en FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=date
    - sed(1) en FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=sed
    - stat(1) en FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=stat
    - El FreeBSD Handbook, los shells: https://docs.freebsd.org/en/books/handbook/basics/#shells
