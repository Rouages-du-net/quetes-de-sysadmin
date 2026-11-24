### Historia «El Observatorio», capítulo 4 «El proceso atascado»: las
### señales (TERM, KILL), el trap de un script, un archivo PID obsoleto. Los
### comandos, las rutas y las salidas de las herramientas no se traducen.

chapter-stuck-process = El proceso atascado
    .summary = La copia de anoche al NAS del club nunca terminó: rsync espera, su script lo reintenta sin fin, y no se deja parar. Librarse de ella limpiamente, para que la copia de esta noche se ejecute.

## Archivos

stuck-process-message-amara =
    De:      Amara
    Para:    tú
    Asunto:  La copia al NAS está atascada

    Hola:

    Cada noche a las 2:00, cron ejecuta /usr/local/bin/sync-photos, que
    copia la galería al NAS del club. Anoche el NAS estaba apagado (un corte
    de luz en el local del club). Ha vuelto desde las 9:00, pero la copia
    lanzada a las 2:00 sigue ahí, atascada.

    Y si sigue ahí esta noche, la copia nueva ni siquiera arrancará: el
    script guarda un archivo PID y se rinde si encuentra uno.

    Le hice un kill, y no pasó nada. ¿Puedes hacer que desaparezca, y
    comprobar que la copia de esta noche se ejecutará?

    La misma contraseña de sudo: nebulosa-2028.

    Amara

## Eventos

stuck-process-event-stuck =
    La copia: un script /bin/bash (sync-photos), y su hijo, rsync, que
    espera al NAS desde las 2:00. ps -ef muestra quién lanzó a quién (la
    columna PPID).
stuck-process-event-ignored =
    SIG{ $signal } enviada, y el script sigue ahí: ningún error, nada. Un
    proceso puede ignorar una señal, o tratarla a su manera (mira el script:
    trap). Solo dos señales no se pueden capturar ni ignorar (man 7 signal).
stuck-process-event-respawn =
    rsync ha muerto… y ha aparecido uno nuevo (PID { $pid }): el script lo
    reintenta en bucle («until rsync …; do sleep 60; done»). Mientras viva
    el script, matar a su hijo no sirve de nada.
stuck-process-event-orphan =
    El script ya no está, pero su rsync sigue ahí: los hijos de un proceso
    que muere no mueren con él, los adopta init (PPID 1). rsync, en cambio,
    es un proceso corriente: acepta TERM.
stuck-process-event-stale =
    Ya no quedan procesos. Pero el script terminó con KILL: no pudo ejecutar
    su última línea (rm -f "$LOCK"). Su archivo PID sigue diciendo 3301, un
    proceso que ya no existe: esta noche, la copia nueva lo encontrará y se
    rendirá («already running»). Un archivo PID obsoleto se borra a mano,
    después de comprobar que el proceso se ha ido de verdad.
stuck-process-event-early-lock =
    El archivo PID ya no está, pero el script atascado sigue funcionando:
    esta noche arrancará una segunda copia a su lado. El archivo solo se
    quita cuando ya nadie lo tiene.
stuck-process-event-cron-stopped =
    cron está parado: esta noche, nada lanzará la copia. Vuelve a arrancarlo
    (sudo systemctl start cron).
stuck-process-event-end =
    Ninguna copia en marcha, ningún archivo PID: esta noche a las 2:00, cron
    lanzará sync-photos, y encontrará el NAS. Amara: «Le añadiré un tiempo
    máximo a rsync (--timeout), para que la próxima vez se rinda solo».

    ¡Bien hecho! Has terminado el capítulo «El proceso atascado».

    QUÉ HA PASADO
    rsync esperó al NAS toda la noche. Su script ignoraba TERM, INT y HUP
    (trap '' …), y volvía a lanzar rsync cada vez que moría. kill sin opción
    envía TERM: ignorada.

    LAS SEÑALES
    - TERM (15): «por favor, termina»; la de kill por defecto. Un programa
      puede capturarla para limpiar, o ignorarla.
    - KILL (9): el núcleo termina el proceso al momento. No se puede
      capturar: ninguna limpieza (aquí, el archivo PID se queda).
    - HUP (1): a menudo «vuelve a leer tu configuración» para un demonio;
      INT (2): Ctrl-C; STOP y CONT: pausa, reanudación.
    - Los hijos de un proceso matado no mueren con él: los adopta init.

    BUENA PRÁCTICA
    - TERM primero, espera un poco, KILL solo si hace falta, y luego limpia
      lo que el programa habría limpiado por sí mismo.
    - Mira los padres: ps -ef, ps -o pid,ppid,stat,args.
    - Antes de borrar un archivo PID, comprueba su proceso: ps -p PID.
    - Una copia por la red necesita un tiempo máximo (rsync --timeout).

    DOCUMENTACIÓN
    - Las señales: https://man7.org/linux/man-pages/man7/signal.7.html
    - kill: https://man7.org/linux/man-pages/man1/kill.1.html
    - trap: https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html#index-trap
