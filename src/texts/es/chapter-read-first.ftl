### Historia «El Viejo Sun», capítulo «Leer antes de tocar»: leer un sistema
### Solaris 10 desconocido antes de sacar nada de él. Los comandos, FMRI,
### rutas y salidas no se traducen.

chapter-read-first = Leer antes de tocar
    .summary = La vieja máquina Sun del banco de semillas funciona con Solaris 10: averigua qué ejecuta el catálogo, dónde viven sus datos y en qué juego de caracteres, y haz una instantánea de seguridad antes que nada.

## Files

read-first-email-inaya =
    De:    Inaya
    Para:  tú

    ¡Hola! Coordino al voluntariado del banco de semillas. Nuestro catálogo
    (las variedades, los socios y socias, quién se llevó qué) vive desde
    2009 en el viejo servidor Sun del armario, herbario. Lo montó Odette;
    se jubiló junto al mar y solo contesta al teléfono los domingos.

    Compramos un servidor nuevo, greenhouse (Debian, mucho más pequeño y
    mucho más silencioso), y nos gustaría que el catálogo se mudara allí.
    Pero nadie se atreve a tocar el Sun: no es Linux, y la última vez que
    alguien lo reinició tardó toda la tarde.

    ¿Podrías mirar primero cómo está montado y anotarlo en migration.md?
    Las notas de Odette están en tu carpeta.

    Inaya

read-first-notes-odette =
    Notas de Odette (2014)
    - El catálogo = PostgreSQL + PHP. Todo lo arranca SMF.
    - Copia semanal: /export/backup/pgdata-weekly.tar (todo el directorio
      de datos, cada domingo por la noche).
    - Discos: ZFS, dos espejos. ¡Nunca rm en /var/postgres!
    - Aquí grep no conoce -q: /usr/xpg4/bin/grep sí.

read-first-template =
    # Sacar el catálogo de herbario

    ## El servicio de la base de datos (su nombre SMF)
    (por completar)

    ## Dónde viven sus datos (directorio, dataset ZFS)
    (por completar)

    ## La base de datos (nombre, versión de PostgreSQL, juego de caracteres)
    (por completar)

    ## Antes de tocar nada
    (por completar: la red de seguridad)

## Events

read-first-event-linux-habit =
    No encontrado: Solaris 10 no tiene ni systemd ni top. Sus servicios los
    gestiona SMF: svcs los lista, svcs -x explica qué falla, svcadm los
    maneja. Y prstat hace el papel de top (man prstat).
read-first-event-old-grep =
    El /usr/bin/grep de Solaris es anterior a POSIX: sin -q, sin -E, sin -r.
    La versión POSIX está en /usr/xpg4/bin/grep (lo decían las notas de
    Odette). Lo mismo con sed, tar y otros: /usr/bin conserva el
    comportamiento antiguo, para los scripts de los años 90.
read-first-event-smf =
    Ahí está: svc:/application/database/postgresql_84:default_64bit,
    online. En Solaris, un servicio se nombra con un FMRI; svcs -l y svcprop
    cuentan más sobre él. Y a su lado, svc:/site/seed-catalogue:default: el
    propio catálogo, un manifiesto que escribió Odette.
read-first-event-maintenance =
    sendmail está en mantenimiento desde marzo de 2025: no tiene que ver
    con el catálogo, y probablemente lleva años roto. Anótalo, no lo
    arregles ahora: un cambio cada vez, sobre todo en una máquina que nadie
    conoce.
read-first-event-data-dir =
    Los datos de PostgreSQL viven en /var/postgres/8.4/data_64 (la
    instancia de 64 bits). Nunca toques esos archivos a mano.
read-first-event-sparc =
    sun4u, sparcv9: un procesador SPARC. Escribe sus números con el byte más
    significativo primero (big-endian), al revés que el x86 de greenhouse.
    Conviene recordarlo cuando llegue el momento de mudar los datos.
read-first-event-zfs =
    /var/postgres es un dataset ZFS propio, data/postgres, en el pool
    «data» (dos discos en espejo). ZFS puede hacerle una instantánea en un
    instante.
read-first-event-encoding =
    seeds, LATIN1: la base se creó en ISO 8859-1, un byte por letra, como
    era habitual en 2009. El PostgreSQL de greenhouse trabaja en UTF-8. Los
    acentos necesitarán cuidado en la mudanza.
read-first-event-snapshot =
    Una instantánea de data/postgres: pase lo que pase después, los datos
    tal como están ahora pueden volver en segundos (zfs rollback). Casi no
    ocupa sitio: ZFS solo guarda los bloques que cambian después.
read-first-event-end =
    Inaya: «He leído tus notas. ¡Por primera vez entiendo lo que hay en ese
    armario!»

    ¡Bien hecho! Has terminado el capítulo «Leer antes de tocar».

    QUÉ HA PASADO
    Leíste un sistema desconocido sin cambiar nada, con sus propias
    herramientas: SMF para los servicios, ZFS para los discos, psql para la
    base de datos. migration.md dice ahora qué ejecuta el catálogo, dónde
    viven sus datos y en qué juego de caracteres; y una instantánea ZFS
    mantiene los datos de hoy al alcance de la mano.

    BUENA PRÁCTICA
    - En un sistema que no conoces, lee antes de actuar: sus servicios, sus
      discos, sus versiones, y lo que ya está roto (svcs -x).
    - Anótalo sobre la marcha: las notas son para ti, y para quien venga
      después.
    - Prepara una red de seguridad antes del primer cambio: una
      instantánea, una copia que sepas restaurar.
    - Usa las herramientas del propio sistema en lugar de imponerle tus
      costumbres: svcs en lugar de ps | grep, /usr/xpg4/bin cuando hace
      falta el comportamiento POSIX.

    OTRA MANERA
    Un inventario completo listaría también las tareas cron (crontab -l
    con cada usuario), la configuración de red (ifconfig -a, /etc/hosts) y
    los paquetes (pkginfo). En Solaris 11 se hace lo mismo con el sistema
    de paquetes IPS (pkg list) e ipadm.

    DOCUMENTACIÓN
    - svcs(1): https://docs.oracle.com/cd/E26505_01/html/816-5165/svcs-1.html
    - zfs(1M): https://docs.oracle.com/cd/E26505_01/html/816-5166/zfs-1m.html
    - PostgreSQL 8.4, juegos de caracteres: https://www.postgresql.org/docs/8.4/multibyte.html
