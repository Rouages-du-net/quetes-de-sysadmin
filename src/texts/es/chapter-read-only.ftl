### Historia «El Teatro», capítulo 3 «Solo lectura»: los roles, GRANT, los
### privilegios por defecto. El SQL, las rutas y las salidas de las
### herramientas no se traducen.

chapter-read-only = Solo lectura
    .summary = La herramienta de estadísticas de Inès usa la propia cuenta de la aplicación, la dueña de todas las tablas: la semana pasada renombró todos los espectáculos por error. Darle una cuenta que lo lea todo y no cambie nada, incluidas las tablas que están por venir.

## Archivos

read-only-message-camille =
    De:      Camille
    Para:    tú
    Asunto:  Inès y la base de datos

    Hola:

    Inès, nuestra voluntaria de las cifras, tiene una pequeña herramienta
    que hace el informe semanal de venta de entradas (ticket-stats, un
    servicio del servidor). Le di la cuenta de la aplicación para
    conectarse, porque era la que tenía (mira
    /etc/ticket-stats/config.env).

    La semana pasada, explorando la base de datos con la misma cuenta, Inès
    renombró por error todos los espectáculos a «test». Restauré la copia de
    seguridad de anoche; perdimos dos horas de reservas.

    ¿Podrías darle una cuenta que pueda leerlo todo pero no cambiar nada? Y
    ponerla en la herramienta. Cuidado: esta semana añado una tabla de
    donaciones (la migración se ejecuta como boxoffice, como todas las
    migraciones), y ella también la necesitará en su informe.

    La misma contraseña de sudo: telon-2028.

    Camille

## Eventos

read-only-event-account =
    La herramienta se conecta como boxoffice: el rol de la aplicación, que
    es dueño de todas las tablas. Un dueño puede hacer cualquier cosa con
    sus tablas: leer, cambiar, vaciar, borrar. ¿Quién puede hacer qué? (man
    psql: \du para los roles, \dp para los privilegios de cada tabla)
read-only-event-role =
    Un rol nuevo puede leer los espectáculos. Para probarlo sin su
    contraseña: como superusuario, SET ROLE nombre; y luego una consulta (en
    el mismo -c, separada por «;»): todo se ejecuta con los privilegios de
    ese rol.
read-only-event-too-much =
    Este rol también puede cambiar datos (INSERT, UPDATE, DELETE o TRUNCATE
    en una tabla): es exactamente lo que no debe volver a pasar. Solo GRANT
    SELECT, y REVOKE del resto (REVOKE ALL ON … FROM rol, y luego GRANT
    SELECT).
read-only-event-superuser =
    Un superusuario se salta todas las comprobaciones de privilegios: puede
    leer, cambiar y borrar todo, en todas las bases de datos. Nunca para una
    cuenta que solo lee (ALTER ROLE … NOSUPERUSER).
read-only-event-member =
    Un miembro de boxoffice hereda todos los derechos de boxoffice, incluida
    la propiedad de las tablas: puede cambiarlas y borrarlas. Da los
    privilegios en sí, no el rol del dueño (REVOKE boxoffice FROM …).
read-only-event-migration =
    Camille: «La migración se ha ejecutado: ahora hay una tabla
    donations». La creó boxoffice, después de tu GRANT. ¿Puede leerla el rol
    nuevo?
read-only-event-donations-denied =
    El rol nuevo no puede leer donations: GRANT … ON ALL TABLES solo se
    aplica a las tablas que existen en ese momento. Para las tablas que
    están por venir, PostgreSQL tiene privilegios por defecto (man psql:
    ALTER DEFAULT PRIVILEGES), dados para las tablas que creará un rol
    concreto.
read-only-event-wrong-creator =
    Los privilegios por defecto se aplican a las tablas creadas por un rol:
    sin FOR ROLE, el que ejecuta el comando (postgres, aquí). Las
    migraciones se ejecutan como boxoffice: ALTER DEFAULT PRIVILEGES FOR
    ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO …
read-only-event-no-defaults =
    El rol nuevo lee ahora donations, pero la próxima tabla se escapará de
    la misma manera. Añade privilegios por defecto para las tablas que cree
    boxoffice (ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice …).
read-only-event-tool =
    El rol está listo. La herramienta todavía se conecta como boxoffice:
    cambia su DATABASE_URL en /etc/ticket-stats/config.env (con el rol nuevo
    y su contraseña), y luego reiníciala.
read-only-event-tool-failed =
    ticket-stats no ha podido arrancar: systemctl status ticket-stats y
    journalctl -u ticket-stats dicen por qué (el rol, su contraseña, su
    LOGIN, o una tabla que no puede leer).
read-only-event-end =
    El informe semanal funciona con { $role }: lee todas las tablas,
    donations incluida, y no puede cambiar ninguna. Inès: «¡Ahora puedo
    explorar sin miedo!». Camille: «Y las próximas migraciones no romperán
    el informe».

    ¡Bien hecho! Has terminado el capítulo «Solo lectura».

    QUÉ HA PASADO
    La herramienta, e Inès, usaban boxoffice, el dueño de todas las tablas.
    Un dueño puede hacerlo todo, y PostgreSQL no distingue un error de una
    orden: UPDATE shows SET title = 'test' estaba permitido.

    LOS ROLES Y LOS PRIVILEGIOS
    - CREATE ROLE … LOGIN PASSWORD '…': una cuenta que puede conectarse.
    - GRANT SELECT ON ALL TABLES IN SCHEMA public TO …: las tablas que
      existen ahora.
    - ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT
      SELECT ON TABLES TO …: las tablas que creará boxoffice.
    - Ni superusuario, ni miembro del rol del dueño: los dos dan todos los
      derechos.

    BUENA PRÁCTICA
    - Un rol por uso: la aplicación, las migraciones, los informes, cada
      persona. El mínimo privilegio que necesita cada uno.
    - Prueba un rol antes de entregarlo: SET ROLE …; y luego las consultas
      que hará, y una que no debe poder hacer.
    - \dp y \ddp muestran quién puede hacer qué.

    DOCUMENTACIÓN
    - Los privilegios: https://www.postgresql.org/docs/16/ddl-priv.html
    - GRANT: https://www.postgresql.org/docs/16/sql-grant.html
    - ALTER DEFAULT PRIVILEGES: https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html
