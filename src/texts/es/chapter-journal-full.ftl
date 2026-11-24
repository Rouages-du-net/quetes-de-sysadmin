### Historia «Los Refugios», capítulo 2 «El journal lleno»: el journal de
### systemd en disco, journalctl --disk-usage y --vacuum-*, SystemMaxUse=.
### La configuración, las rutas y las salidas de las herramientas no se
### traducen.

chapter-journal-full = El journal lleno
    .summary = El disco del valle está al 93 %. Los archivos de los refugios son pequeños; otra cosa ocupa gigabytes en /var/log. Recuperar el espacio, y asegurarse de que no se vuelve a perder.

## Archivos

journal-full-message-lou =
    De:      Lou
    Para:    tú
    Asunto:  Disco casi lleno

    Hola:

    El panel del alojamiento dice que el disco de valle está al 93 %. Los
    archivos de registro de los refugios (¡gracias otra vez!) ocupan unos
    pocos megas, así que tiene que ser otra cosa.

    Es verdad que el mes pasado activé una opción «debug» en hut-collector,
    para entender un problema con un sensor… ¿tendrá que ver?

    No toques /var/lib/hut-data: es el archivo de todas las medidas desde
    2019.

    La misma contraseña de sudo: cumbre-2028.

    Lou

## Eventos

journal-full-event-disk =
    93 % usado. ¿Adónde va? du -sh sobre las carpetas grandes lo dirá
    (sudo du -sh /var/log/*, /var/lib/*).
journal-full-event-journal =
    El journal de systemd, en /var/log/journal, ocupa gigabytes: treinta
    archivos archivados, uno por día, y el activo. Desde que hut-collector
    escribe en debug, crece rápido. journald guarda por defecto hasta el
    10 % del sistema de archivos… y es el resto del disco lo que falta.
    (man journalctl: --disk-usage, --vacuum-size; man journald.conf)
journal-full-event-rm =
    El archivo activo del journal se ha borrado a mano. journald sigue
    escribiendo en él (lo tiene abierto), pero ya nada puede leerlo, y su
    espacio solo vuelve cuando journald se reinicia. Los archivos archivados
    se recortan con journalctl --vacuum-…, nunca con rm.
journal-full-event-vacuum-only =
    Los archivos archivados están recortados: el espacio ha vuelto. Pero
    nada impide que el journal vuelva a crecer al mismo ritmo. journald
    necesita un límite (SystemMaxUse= en journald.conf), que se aplica
    cuando arranca.
journal-full-event-restart-needed =
    El límite está escrito, pero journald lee su configuración cuando
    arranca: sudo systemctl restart systemd-journald.
journal-full-event-too-big =
    Hay un límite puesto, pero demasiado alto para este disco: con el
    archivo de las medidas, 1G para el journal es más que suficiente
    (SystemMaxUse=1G como máximo).
journal-full-event-end =
    El journal está por debajo de su nuevo límite, y journald lo mantendrá
    ahí: el disco ha vuelto por debajo del 80 %. Lou: «Y he desactivado el
    debug de hut-collector, prometido».

    ¡Bien hecho! Has terminado el capítulo «El journal lleno».

    QUÉ HA PASADO
    hut-collector escribía en debug en el journal, cientos de megas al día.
    El límite por defecto de journald (el 10 % del sistema de archivos,
    hasta 4G) permitía seis gigas en este disco, junto a un archivo que ya
    ocupaba la mayor parte.

    EL JOURNAL EN DISCO
    - journalctl --disk-usage: cuánto ocupa.
    - journalctl --vacuum-size=500M (o --vacuum-time=2weeks): recorta ya
      los archivos archivados.
    - SystemMaxUse= en /etc/systemd/journald.conf (o un drop-in en
      journald.conf.d): el límite duradero, que se aplica cuando arranca
      journald.

    BUENA PRÁCTICA
    - Nunca rm en /var/log/journal: journalctl --vacuum-….
    - Pon un límite adaptado al disco, y vigila el disco (df) con una
      alerta.
    - Un programa en debug es un programa que llenará un disco: desactívalo
      una vez entendido el problema.

    DOCUMENTACIÓN
    - journald.conf: https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html
    - journalctl --vacuum-size: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
