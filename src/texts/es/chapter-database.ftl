### Historia «La Ludoteca», capítulo 3 «La base de datos»: copiar una base
### PostgreSQL con pg_dump, comprobar la restauración, reparar una tabla.
### Los comandos, el SQL y los mensajes de PostgreSQL no se traducen.

chapter-database = La base de datos
    .summary = Copiar los archivos de una base de datos en marcha no es una copia de seguridad: pg_dump cada noche, una restauración de prueba, y luego una tabla que reponer deprisa.

## Archivos

database-message-berenice =
    Un mensaje de Bérénice:

    «Los préstamos de juegos están en una base de datos PostgreSQL, ludo,
    en el servidor. Malo dice que tiene copia, porque rsnapshot copia
    /var/lib/postgresql cada noche (su nota está al lado de esta). Pero
    una amiga que trabaja en informática me ha dicho que eso no es una
    copia de seguridad de verdad.

    ¿Podrías asegurarte de que la base de datos tiene de verdad una copia
    cada noche (en /var/backups/postgresql), y comprobar que sabríamos
    reponerla? Sobre todo, no toques la base de datos real mientras haces
    pruebas: el voluntariado registra préstamos todo el día.

    Para sudo: dados-2027.»
database-word-malo =
    Una nota de Malo:

    «Los archivos de la base de datos están en /var/lib/postgresql/16/main,
    y rsnapshot los copia cada noche con todo lo demás. Para hablar con la
    base de datos: psql. La cuenta que tiene todos los derechos sobre la
    base de datos se llama postgres.»
database-crontab-root = Instantáneas (rsnapshot): semanal a las 3:00 los lunes, diaria a las 3:30
# Las columnas de las tablas, y los barrios de los socios.
database-columns-boardgames = id,nombre,ejemplares
database-columns-members = id,carne,barrio
database-columns-loans = id,juego_id,socio_id,salida_el,devuelto_el
database-districts = norte,sur,este,oeste,centro
database-names-games = serpientes y escaleras,parchís,damas,mikado,dominó,memory de animales,juego de la escalera,oware,go,conecta cuatro,mancala,tangram,solitario,hundir la flota,juego de las familias

## Eventos

database-event-role =
    PostgreSQL no te conoce: por el socket local, te conectas con el
    nombre de tu cuenta (autenticación «peer»), y ni «tu» ni root son
    roles de esta base de datos. La cuenta postgres, en cambio, tiene todos
    los derechos: sudo -u postgres (man sudo).
database-event-on-live =
    ¡Alto! Esta restauración apuntaba a ludo, la base de datos en
    producción: sus tablas ya existen, de ahí los errores. Restaurar sobre
    la base de datos real «para probar» puede sobrescribir los préstamos
    de hoy. Una restauración de prueba se hace en una base de datos aparte
    (man createdb).
database-event-test-succeeded =
    La base de datos de prueba contiene tantos juegos, socios y préstamos
    como la real: la copia se puede restaurar. Es la única manera de saber
    que una copia funciona. (La base de datos de prueba se puede borrar
    con dropdb.)
database-incident =
    14:05. Bérénice, presa del pánico: «Un voluntario ha hecho clic en
    "borrar el historial" en la página de administración… ¡La lista de
    préstamos está vacía! Los juegos y los socios siguen ahí. ¿Puedes
    reponer los préstamos, SIN tocar lo demás?»
    (Compruébalo con psql: ¿cuántas filas quedan en prestamos? Tu copia de
    esta mañana contiene la tabla entera; man pg_restore.)
database-event-duplicates =
    pg_restore se niega: algunos préstamos de la copia ya están en la tabla
    (clave duplicada). Solo se recargan datos en una tabla vacía, o
    volviendo a crearla (--clean).
database-event-cron-root =
    La tarea del crontab de root ejecuta pg_dump como root, que no es un
    rol de la base de datos: cada noche fallaría (role "root" does not
    exist). Usa el crontab de la cuenta postgres (sudo crontab -u postgres
    -e), o sudo -u postgres delante del comando.
database-event-loans-returned =
    Los 1873 préstamos han vuelto, y nada más se ha movido. Bérénice:
    «¡Uf!»
database-event-end =
    La base de datos tiene copia de verdad cada noche, la restauración
    está comprobada, y la tabla vaciada por error ha vuelto con un solo
    comando.

    ¡Bien hecho! Has terminado el capítulo 3 de La Ludoteca, y toda la
    historia.

    QUÉ HA PASADO
    Copiar los archivos de una base de datos en marcha (como hacía
    rsnapshot) puede dar una copia incoherente: la base de datos escribe
    durante la copia. pg_dump, en cambio, lee la base de datos tal como
    está en un momento preciso y produce una copia coherente, sin
    detenerla. Una restauración en una base de datos de prueba demostró
    que funcionaba; luego pg_restore repuso solo una tabla, la única
    afectada.

    BUENA PRÁCTICA
    - Copia una base de datos con su propia herramienta (pg_dump,
      mysqldump), cada noche, y luego copia el archivo con todo lo demás
      (rsnapshot, restic, desconectada).
    - El formato custom (-Fc): comprimido, y se puede restaurar solo una
      parte (-t).
    - Prueba la restauración con regularidad, en una base de datos aparte.
    - Lo que ha cambiado desde la última copia se pierde: para perder
      menos, archiva el registro de la base de datos (WAL, recuperación a
      un punto en el tiempo).
    - Nunca hagas experimentos con la base de datos en producción.

    DOCUMENTACIÓN
    - Copiar con pg_dump: https://www.postgresql.org/docs/16/backup-dump.html
    - Por qué no basta con copiar los archivos: https://www.postgresql.org/docs/16/backup-file.html
    - pg_restore: https://www.postgresql.org/docs/16/app-pgrestore.html
