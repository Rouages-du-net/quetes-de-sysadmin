### Historia «Los Huertos», capítulo «La réplica rota»: la réplica se paró
### por una clave duplicada. SHOW REPLICA STATUS, read_only, START/STOP
### REPLICA, sql_slave_skip_counter, GTID, CHECKSUM TABLE, mariadb-dump
### --single-transaction, una prueba de restauración. Los comandos, las
### opciones, las rutas, el SQL y las salidas no se traducen.

chapter-broken-replica = La réplica rota
    .summary = La copia de informes de la base de datos de los huertos dejó de seguir a la real el sábado por la tarde, y nadie se dio cuenta: la lista de espera que imprime Moana tiene dos días, y también todas las copias de seguridad nocturnas. Repara bien la réplica, y luego demuestra que las copias se pueden restaurar.

## Archivos

broken-replica-message-moana =
    De: Moana (secretaria, Asociación de Huertos de Greenholme)
    Lunes 2 de junio, 8:45

    Kia ora:

    Esta mañana mi informe de la lista de espera (el que hago desde el
    servidor de informes, rake) no muestra a las personas que se
    apuntaron ayer. Y creo que quizá lo he provocado yo: el sábado por la
    tarde añadí a mi vecina, Esi Boateng, a la lista de espera desde mi
    herramienta de informes, directamente en rake. Me dejó, así que pensé
    que estaba bien.

    Lwazi dice que rake es una «réplica» de paleta y que las copias de
    seguridad nocturnas también se hacen en ella. ¡Me gustaría que Esi
    siguiera en la lista, por favor!

    Moana

broken-replica-note-lwazi =
    Lwazi, abril de 2031

    - paleta es el primario: Plotline (en barrow) escribe ahí. Su registro
      binario va a /var/log/mysql. rake (198.51.100.132) lo replica, con
      GTID, como repl. Los informes de Moana leen rake, así nunca
      ralentizan el sitio.
    - En rake: sudo mariadb, luego SHOW REPLICA STATUS\G.
    - Copias de seguridad: el /usr/local/sbin/plots-backup de rake, cada
      noche a las 2:30 (/etc/cron.d/plots-backup), en /var/backups/mariadb.
      Nunca he probado a restaurar una.
    - ssh rake desde paleta; sudo funciona allí con tu contraseña.

## Eventos

broken-replica-event-stopped =
    Slave_IO_Running: Yes, Slave_SQL_Running: No. El hilo IO sigue copiando
    lo que escribe paleta, pero el hilo SQL, que lo aplica, se paró el
    sábado a las 18:12 y Seconds_Behind_Master es NULL. Last_SQL_Error dice
    por qué: una fila que paleta insertó en plots.waitlist, id 1043, ya
    existe en rake. Compara esa fila en los dos servidores.
broken-replica-event-cause =
    En rake, la entrada 1043 de la lista de espera es Esi, escrita a mano
    el sábado a las 17:46; en paleta, la 1043 es Wairimu, que se apuntó en
    el sitio a las 18:12. Una réplica solo debe recibir lo que le envía su
    primario: basta una escritura hecha en ella para que las dos copias
    no coincidan. ¿Qué habría impedido que la herramienta de Moana
    escribiera ahí? (man mariadb: read_only.)
broken-replica-event-skipped =
    El hilo SQL vuelve a funcionar, pasado el evento que fallaba: la fila
    de Wairimu se ha saltado, no se ha aplicado. La 1043 de rake sigue
    siendo Esi, y Wairimu solo existe en paleta. La réplica contiene ahora
    otra base de datos, en silencio. Compara las tablas en los dos
    servidores (CHECKSUM TABLE plots.waitlist; en cada uno).
broken-replica-event-skip-again =
    Ya van { $count } eventos saltados. Cada salto tira un cambio que hizo
    paleta: la réplica sigue, pero cada vez más lejos de su primario.
    Saltar esconde un error, no repara los datos.
broken-replica-event-read-only =
    read_only está activo: rake rechaza ahora las escrituras de las
    cuentas normales, incluida la herramienta de Moana («running with the
    --read-only option»). La propia replicación y quienes administran
    (READ_ONLY ADMIN) todavía pueden escribir.
broken-replica-event-read-only-kept =
    read_only está ahora en la configuración de rake: seguirá activo tras
    un reinicio.
broken-replica-event-repaired =
    Los dos hilos funcionan, sin error, Seconds_Behind_Master: 0. rake se
    ha puesto al día de los dos días de cambios que se perdió.
broken-replica-event-diverged =
    La réplica funciona, pero las sumas de comprobación difieren: rake no
    contiene las mismas filas que paleta. La replicación solo aplica
    cambios; nunca compara ni arregla lo que ya difiere. Encuentra las
    filas que difieren, o reconstruye rake a partir de un volcado
    coherente de paleta (mariadb-dump --single-transaction --master-data
    --gtid).
broken-replica-event-identical =
    Las mismas sumas de comprobación en los dos servidores: rake vuelve a
    ser una copia exacta de paleta.
broken-replica-event-jun =
    Esi está en la lista de espera, en paleta, donde van las escrituras;
    rake recibe su fila como cualquier otra.
broken-replica-event-locking-dump =
    Sin --single-transaction, mariadb-dump bloqueó las tablas mientras las
    leía (LOCK TABLES): durante todo el volcado, el hilo SQL de rake
    esperó detrás (mira Seconds_Behind_Master), y en paleta el sitio
    habría esperado. Para las tablas InnoDB, --single-transaction lee una
    instantánea coherente sin bloquear nada.
broken-replica-event-inconsistent-dump =
    Ese volcado leyó cada tabla en un momento distinto mientras rake
    seguía aplicando cambios (sin bloqueo, sin transacción): puede
    contener una reserva sin su miembro, una fila de la lista de espera
    sin su actualización. Parece correcto y se restaura sin error, pero no
    es una foto de un solo momento. --single-transaction da una.
broken-replica-event-script =
    El script nocturno vuelca ahora con --single-transaction: una
    instantánea coherente, sin parar la replicación.
broken-replica-event-backup =
    Un volcado coherente de rake, tomado mientras iba al paso de paleta.
    Pero una copia de seguridad solo cuenta una vez que la has restaurado.
broken-replica-event-restored =
    El volcado se ha restaurado en otra base de datos, con las mismas
    filas: esta copia de seguridad está probada. Borra la base de datos
    provisional cuando termines.
broken-replica-event-end =
    Moana: «Esi y los que se apuntaron ayer están todos en mi informe. No
    volveré a escribir en rake, ¡y ahora además no me dejaría!»

    ¡Bien hecho! Has terminado el capítulo «La réplica rota».

    QUÉ HA PASADO
    Una fila escrita a mano en la réplica ocupó un id que el primario dio
    a otra persona minutos después; cuando llegó esa fila, el hilo SQL de
    rake se paró por una clave duplicada y la réplica se quedó dos días
    atrás, arrastrando con ella las copias de seguridad nocturnas. Pusiste
    rake en solo lectura, quitaste allí la fila intrusa y añadiste a Esi
    en paleta, volviste a arrancar la replicación y comprobaste que los
    dos servidores tienen las mismas filas; luego hiciste coherente la
    copia de seguridad y la probaste restaurándola.

    BUENA PRÁCTICA
    - Una réplica es read_only (en su configuración): las escrituras van
      solo al primario. Vigila Slave_SQL_Running y Seconds_Behind_Master,
      no solo si el servidor responde.
    - sql_slave_skip_counter tira un cambio: la réplica vuelve a funcionar
      pero difiere de su primario. Repara los datos, o reconstruye la
      réplica a partir de un volcado coherente con su posición GTID.
    - Compara en lugar de esperar: CHECKSUM TABLE en los dos lados
      (pt-table-checksum, o mariadb-dump y diff en una base grande).
    - mariadb-dump --single-transaction da una instantánea coherente de
      las tablas InnoDB sin bloquear; --skip-lock-tables solo da tablas
      leídas en momentos distintos.
    - Una copia de seguridad se prueba con una restauración: en una base
      de datos provisional, y luego se compara.

    DOCUMENTACIÓN
    - SHOW REPLICA STATUS: https://mariadb.com/kb/en/show-replica-status/
    - Identificadores globales de transacción: https://mariadb.com/kb/en/gtid/
    - read_only: https://mariadb.com/kb/en/server-system-variables/#read_only
    - sql_slave_skip_counter: https://mariadb.com/kb/en/replication-and-binary-log-system-variables/#sql_slave_skip_counter
    - CHECKSUM TABLE: https://mariadb.com/kb/en/checksum-table/
    - mariadb-dump: https://mariadb.com/kb/en/mariadb-dump/
