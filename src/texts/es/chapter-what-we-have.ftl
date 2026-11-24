### Historia «El Refugio», capítulo «¿Qué tenemos?»: el plan de
### recuperación ante desastres, escrito en 2029, comparado con lo que
### ejecuta de verdad cercado (unidades, temporizadores, sockets, la tarea de
### copia), RPO y RTO por servicio, y una copia dentro de cada RPO. También
### los textos que comparte toda la historia (shelter-*). Los comandos, las
### opciones, las rutas y las salidas no se traducen.

chapter-what-we-have = ¿Qué tenemos?
    .summary = Los refugios de animales tienen un plan de recuperación ante desastres por escrito. Era cierto en 2029. Antes de que algo vaya mal, compáralo con lo que ejecuta de verdad el servidor, da a cada servicio un punto y un tiempo de recuperación que pueda cumplir de verdad, y asegúrate de que cada uno tenga una copia lo bastante reciente.

## Compartido por la historia: los datos y los archivos del mundo

shelter-animal-names =
    Galleta
    Mango
    Pimienta
    Enebro
    Otis
    Clementina
    Caramelo
    Avellana
    Pepinillo
    Nala
    Zarza
    Ziggy
    Sauce
    Turrón
    Píxel
    Azafrán
    Judía
    Luna
    Tofu
    Arce
    Kiwi
    Polvo
    Calabaza
    Jengibre
    Musgo
    Trébol
    Bowie
    Cacahuete
    Calcetines
    Índigo
shelter-species =
    perro
    gato
    gato
    conejo
    perro
    cobaya
shelter-volunteer-names =
    Teuila
    Mirela
    Rahel
    Wiremu
    Oyelaran
    Bilal
    Chiamaka
    Dmitri
    Ximena
    Farida
    Gideon
    Hyun-woo
    Isolde
    Jamal
    Kalinda
    Lorenzo
    Mahsa
    Nikolai
    Odessa
    Priyanka
shelter-site-hillside = Hillside
shelter-site-riverbend = Riverbend
shelter-env-comment = Configuración de Adopt (Dariusz, 2029). Se lee cuando arranca el servicio.
shelter-adopt-readme =
    Adopt: la aplicación de adopciones de los refugios (Flask, servida por
    gunicorn en 127.0.0.1:8000, detrás del /adopt/ de nginx).
    Sus datos están en la base de datos PostgreSQL «shelter» (animals,
    adoptions, volunteers). Necesita la base de datos para arrancar.
shelter-backup-comment = Copia nocturna de cercado a pradera (Dariusz, 2029): el volcado de la base de datos, luego restic.
shelter-vetlink-comment = vetlink: descarga cada hora las fichas de nuestros animales de la clínica veterinaria (Mirela, 2031).
shelter-site-index =
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="utf-8">
    <title>Refugios de Animales de Hillside</title>
    </head>
    <body>
    <h1>Refugios de Animales de Hillside</h1>
    <p>Perros, gatos y conejos que esperan un hogar, en Hillside y Riverbend.</p>
    <p><a href="/adopt/">Adoptar</a> · <a href="/adopt/animals">Los animales que te esperan</a></p>
    </body>
    </html>
shelter-app-home =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Adoptar — Refugios de Animales de Hillside</title></head>
    <body><h1>Adoptar</h1><p>Conoce a los animales, reserva una visita, empieza una adopción.</p></body>
    </html>
shelter-app-animals =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Los animales que esperan — Adoptar</title></head>
    <body><h1>Los animales que esperan</h1><p>{ $count } animales esperan un hogar.</p></body>
    </html>
shelter-plan-col-service = Servicio
shelter-plan-col-backup = Copia
shelter-plan-col-owner = Responsable
shelter-zone-comment = hillsideshelters.example, primario oculto en pradera; lo sirve el servidor del registrador.
shelter-drill-draft =
    #!/bin/sh
    # Simulacro de restauración (borrador de Mirela, noviembre de 2031). Todavía sin programar.
    set -e
    export RESTIC_REPOSITORY={ $repo }
    export RESTIC_PASSWORD_FILE=/root/.restic-drill
    restic snapshots --latest 1
    echo "$(date -Is) drill done"

shelter-plan-2029 =
    # Plan de recuperación ante desastres — Refugios de Animales de Hillside

    Escrito por Dariusz, mayo de 2029. Mantenlo al día, y fuera de cercado:
    el plan tiene que sobrevivir al servidor que describe.

    ## Servicios

    | Servicio | RPO | RTO | Copia | Responsable |
    |----------|-----|-----|-------|-------------|
    | Sitio web (nginx) | 24h | 2d | restic, cada noche a las 02:00 | Dariusz |
    | Aplicación de adopciones y su base de datos (PostgreSQL) | 1h | 1d | pg_dump y luego restic, cada noche a las 02:00 | Dariusz |
    | Boletín (phpList) | 1sem | 1sem | restic, cada noche a las 02:00 | Dariusz |

    RPO (objetivo de punto de recuperación): cuántos datos podemos
    permitirnos perder, el tiempo desde la última copia buena.
    RTO (objetivo de tiempo de recuperación): cuánto tiempo puede estar
    caído el servicio.
    Duraciones como 30min, 4h, 1d, 1sem.

    ## Copias de seguridad

    La tarea nocturna de cercado (/usr/local/sbin/shelter-backup, lanzada
    por shelter-backup.timer) vuelca la base de datos, y luego envía sus
    archivos al repositorio restic de pradera (/srv/restic, por sftp). La
    contraseña de recuperación está en un sobre cerrado en la caja fuerte
    de Rahel.

    ## Orden de restauración

    Por escribir.

shelter-plan-2031 =
    # Plan de recuperación ante desastres — Refugios de Animales de Hillside

    Escrito por Dariusz, mayo de 2029; revisado por Teuila y por ti,
    noviembre de 2031. Mantenlo al día, y fuera de cercado: el plan tiene
    que sobrevivir al servidor que describe.

    ## Servicios

    | Servicio | RPO | RTO | Copia | Responsable |
    |----------|-----|-----|-------|-------------|
    | Sitio web (nginx) | 24h | 8h | restic, cada noche a las 02:00 | Teuila |
    | Aplicación de adopciones y su base de datos (PostgreSQL) | 24h | 8h | pg_dump y luego restic, cada noche a las 02:00 | tú |
    | Fichas veterinarias (vetlink) | 24h | 2d | restic, cada noche a las 02:00 | Mirela |

    ## Copias de seguridad

    La tarea nocturna de cercado vuelca la base de datos (shelter.sql, con
    su SHA-256 en shelter.sha256 y sus recuentos de filas en
    shelter.counts), y luego envía /etc, /var/www, /srv/adopt, /srv/vetlink
    y /var/backups al repositorio restic de pradera (/srv/restic, por
    sftp). La contraseña de recuperación está en un sobre cerrado en la
    caja fuerte de Rahel.

    ## Orden de restauración

    1. Una máquina con un Debian 13 recién instalado y restic.
    2. Los paquetes que necesitan los servicios (la tabla del plan), de
       Debian.
    3. La última instantánea, restaurada AL LADO del sistema nuevo. /etc
       es de la máquina nueva: toma de la copia solo lo que es nuestro (el
       sitio, la aplicación, las unidades), nunca sus discos, su identidad
       ni sus claves.
    4. La base de datos, recreada a partir del volcado, comprobada con el
       SHA-256 y los recuentos de filas de la tarea antes de que nada la
       use.
    5. Arrancar en el orden de las dependencias: la base de datos, la
       aplicación, luego nginx.
    6. Probar en la propia máquina, antes de que nadie cambie nada.
    7. Cambiar www (su TTL es de 300 segundos desde noviembre de 2031, para
       esto), y comprobar desde fuera.
    8. Escribir la revisión; planificar el próximo simulacro.

## Archivos

what-we-have-message-teuila =
    De: Teuila (coordinadora)
    Lunes 3 de noviembre, 9:20

    ¡Hola, y bienvenida o bienvenido a los refugios!

    La junta me hizo una pregunta sencilla: «si cercado muriera esta
    noche, ¿qué haríamos?». Tenemos una respuesta en papel: el plan de
    recuperación ante desastres de Dariusz, /srv/drp/plan.md aquí en
    pradera. Pero Dariusz se mudó a la costa en 2030, y el plan no se ha
    movido desde 2029.

    ¿Podrías hacer que vuelva a ser cierto? Mira lo que ejecuta de verdad
    cercado (ssh cercado desde aquí), compáralo con el plan, y arregla la
    tabla: una fila por servicio, con un RPO y un RTO que podamos cumplir
    de verdad, su copia, y alguien que todavía esté aquí para responder de
    él (yo, Mirela, Rahel, Wiremu, o tú).

    Y comprueba que cada servicio de la tabla tiene de verdad una copia lo
    bastante reciente. El repositorio está aquí en pradera, en
    /srv/restic; la tarea nocturna de cercado tiene la contraseña.

    ¡Gracias!
    Teuila

## Eventos

what-we-have-event-plan =
    La tabla de Dariusz: tres servicios, su RPO (cuántos datos se pueden
    perder) y su RTO (cuánto tiempo pueden estar caídos). ¿Sigue siendo
    eso lo que ejecuta cercado? Las palabras del plan son el punto de
    partida, no la respuesta: mira la máquina.
what-we-have-event-paddock =
    Estás en cercado, en el sótano de Hillside. Un inventario empieza por
    lo que funciona, no por lo que se escribió: los servicios (systemctl
    list-units --type=service), lo programado (systemctl list-timers,
    crontab -l), lo que escucha (ss -tlnp).
what-we-have-event-units =
    nginx, postgresql, y adopt: la aplicación de adopciones que menciona el
    plan, un servicio propio (su unidad está en /etc/systemd/system). Y
    ningún phpList por ninguna parte.
what-we-have-event-timers =
    Dos temporizadores propios de los refugios: shelter-backup (la tarea
    nocturna) y vetlink-sync, cada hora. vetlink no está en ninguna línea
    del plan. systemctl cat vetlink-sync.service dice qué ejecuta, y
    adónde van sus datos.
what-we-have-event-sockets =
    ssh y nginx de cara a la red; PostgreSQL (5432) y el gunicorn de la
    aplicación (8000) solo en 127.0.0.1, detrás de nginx. Lo que escucha
    coincide con lo que funciona: nada escondido ahí.
what-we-have-event-no-phplist =
    No hay phpList en cercado: se quitó en 2030 (el boletín pasó a un
    servicio de envíos). Un plan que restaura lo que ya no existe te manda
    a buscarlo la peor noche del año: su fila sobra.
what-we-have-event-script =
    La tarea nocturna copia /etc, /var/www, /srv/adopt y /var/backups.
    vetlink escribe sus fichas en { $path }: no está en la lista. Las
    fichas de Mirela no están en ninguna copia.
what-we-have-event-snapshots =
    Las instantáneas del repositorio: una por noche, a las 2:00, guardadas
    14 días y 8 semanas. Las rutas de cada una dicen lo que contiene;
    restic ls o find dicen si un archivo está en ella. El RPO de un plan
    solo es cierto si las copias son así de recientes.
what-we-have-event-rpo-unmet =
    Un RPO más corto que el ritmo de las copias no se puede cumplir: la
    tarea se ejecuta una vez por noche, así que la peor noche pierdes
    hasta 24 horas. O el RPO dice la verdad (24h), o el horario cambia
    para cumplirlo.
what-we-have-event-old-owner =
    Dariusz sigue en la tabla. Un responsable es la persona a la que
    llamas a las 3 de la madrugada, y Dariusz se fue hace dos años:
    Teuila, Mirela, Rahel, Wiremu, o tú.
what-we-have-event-stale-row =
    La fila de phpList sigue ahí: el plan restauraría un servicio que
    cercado dejó de ejecutar en 2030. Quítala.
what-we-have-event-rows =
    La tabla es cierta: el sitio, la aplicación y su base de datos,
    vetlink, cada uno con un RPO que la tarea puede cumplir, un RTO, una
    copia, un responsable. Ahora las copias también tienen que cumplir la
    promesa.
what-we-have-event-unsaved =
    vetlink tiene su fila, con un RPO: pero ninguna instantánea contiene
    sus fichas. El plan promete una copia que todavía no existe. La línea
    restic backup de la tarea en cercado decide lo que entra.
what-we-have-event-fixed =
    La tarea nocturna incluye las fichas de vetlink a partir de esta
    noche. Hasta esta noche, sigue sin haber copia: una copia ahora
    (ejecuta la tarea, o restic backup tú) cierra el hueco hoy.
what-we-have-event-saved =
    Una instantánea contiene las fichas de vetlink: el trabajo de Mirela
    sobrevive ahora a cercado.
what-we-have-event-end =
    Teuila: «Así que esto es lo que tenemos de verdad. Lo imprimiré para
    la junta, y le daré una copia a Rahel para la caja fuerte, con el
    sobre».

    ¡Bien hecho! Has terminado el capítulo 1 de «El Refugio».

    QUÉ HA PASADO
    El plan describía cercado tal como era en 2029. El inventario (las
    unidades y temporizadores de systemd, los sockets, la tarea) encontró
    un servicio desaparecido (phpList), un servicio ausente tanto del plan
    como de las copias (vetlink), un RPO de una hora para una base de
    datos copiada una vez por noche, y un responsable que se había ido.
    La tabla dice ahora lo que funciona, lo que puede perder cada servicio
    y cuánto puede esperar, quién responde de él; y cada servicio tiene
    una instantánea más reciente que su RPO.

    BUENA PRÁCTICA
    - Un plan se comprueba con la máquina, no consigo mismo: lo que
      funciona (systemctl list-units, list-timers, crontab -l), lo que
      escucha (ss -tlnp), lo que se copia (la tarea, restic snapshots y
      ls).
    - El RPO y el RTO son decisiones de la organización, por escrito: el
      ritmo de las copias tiene que cumplir el RPO, la restauración tiene
      que caber en el RTO.
    - Cada servicio tiene un responsable que sigue aquí.
    - Guarda el plan fuera del servidor que describe, y en papel en algún
      sitio.
    - Cada servicio nuevo (un temporizador añadido una tarde) entra en el
      plan y en las copias el mismo día.

    DOCUMENTACIÓN
    - NIST SP 800-34 Rev. 1, guía de planificación de contingencias (análisis de impacto, RPO, RTO): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - restic, trabajar con repositorios: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - systemctl: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
