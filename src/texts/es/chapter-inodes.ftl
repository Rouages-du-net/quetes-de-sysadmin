### Historia «De Guardia», capítulo 3 «Los inodos»: un volumen lleno de
### inodos y casi vacío de bytes (df -i, du --inodes), «Argument list too
### long», find -mtime -delete y cron. Los comandos, las opciones y los
### mensajes de las herramientas no se traducen.

chapter-inodes = Los inodos
    .summary = 3:20 de la madrugada, «No space left on device»… en un disco casi vacío. ¿Qué falta, si no es espacio?

## Archivos

inodes-message-zoe =
    Un mensaje de Zoé (3:05):

    «Ya no entiendo nada. La grabación del programa nocturno ha vuelto a
    fallar: "No space left on device", ¡igual que la semana pasada! Solo
    que esta vez, df -h dice que el volumen de datos (/srv/radio) está casi
    vacío. Y el repetidor ya no puede registrar las escuchas
    (journalctl -u radio-stream).

    PD: las estadísticas de escucha sirven para el informe mensual al
    ayuntamiento. Hay que conservar al menos los últimos 30 días.»
inodes-conf-stream =
    # Radio Barrio: repetidor del directo (el servicio radio-stream)
    port = 8000
    mount = /directo
    logfile = /var/log/radio/stream.log
    loglevel = info
    # Grabaciones de los programas
    record_dir = /srv/radio/programas
    # Estadísticas: un archivo por escucha (informe mensual para el ayuntamiento)
    stats_dir = /srv/radio/stats
inodes-stats-readme =
    Estadísticas de escucha, escritas por el repetidor: un pequeño archivo
    por escucha (dirección anonimizada, duración). El informe mensual para
    el ayuntamiento lee los archivos del último mes.
    (Zoé, marzo de 2027: acordarse de limpiar de vez en cuando…)

## La noche simulada

# { $command }: el comando de la tarea cron; { $output }: lo que ha escrito
inodes-mail =
    Correo de cron (Cron Daemon) sobre: { $command }
    { $output }
# { $jobs }: tareas ejecutadas; { $deleted }: archivos borrados; { $oldest }: edad del más antiguo, en días; { $percent }: inodos ocupados
inodes-night =
    Pasan un día y una noche. El repetidor registra sus escuchas; cron
    ejecuta { $jobs ->
        [0] ninguna tarea
        [one] una tarea
       *[other] { $jobs } tareas
    }. Por la mañana: { $deleted ->
        [one] { $deleted } archivo de estadísticas menos
       *[other] { $deleted } archivos de estadísticas menos
    }, el
    más antiguo tiene { $oldest } días, y está ocupado el { $percent } %
    de los inodos de /srv/radio.
inodes-night-recent-lost =
    Ay: han desaparecido estadísticas de menos de 30 días, las del informe
    para el ayuntamiento. ¿Una tarea que lo borra todo, sin mirar la edad
    de los archivos? Reinicia el capítulo para probar de otra manera
    (enlace debajo del terminal), y prueba tu comando a mano antes de
    confiárselo a cron.
inodes-night-nothing =
    Tu tarea no se ha ejecutado esta noche: su horario no cae durante la
    noche. Los cinco campos (minuto, hora, día del mes, mes, día de la
    semana) se explican en man crontab.
# { $days }: edad del archivo más antiguo
inodes-night-too-old =
    Por la mañana, sigue habiendo estadísticas de hace { $days } días: la
    tarea no ha limpiado. Ejecuta su comando a mano para ver lo que hace
    (y sudo crontab -l, para volver a leer la línea).
# { $percent }: inodos ocupados
inodes-night-full =
    Sigue ocupado el { $percent } % de los inodos: el volumen volverá a
    llenarse muy rápido. Habría que conservarlos menos tiempo (pero al
    menos 30 días).

## Eventos

inodes-event-almost-empty =
    El volumen de datos casi no está ocupado, y sin embargo ya no se puede
    crear ningún archivo en él. El espacio no es el único recurso de un
    sistema de archivos: cada uno de sus archivos necesita también un
    inodo (su ficha: propietario, permisos, fechas, dónde están sus
    datos), y su número se fija al crearlo. En man df, una opción los
    cuenta.
inodes-event-more-inodes =
    El 100 % de los inodos de /srv/radio están ocupados: ya no se puede
    crear ni un solo archivo, ni siquiera vacío, por mucho espacio libre
    que haya. ¿Quién ha creado tantos archivos? du puede contar inodos en
    lugar de bytes (man du).
inodes-event-culprit =
    ¡Decenas de miles de archivos! Uno por escucha, escritos por el
    repetidor desde marzo, y nunca borrados. Antes de borrar: Zoé quiere
    conservar al menos los últimos 30 días. find puede seleccionar
    archivos por su edad (man find).
inodes-event-too-long =
    «Argument list too long»: el shell sustituye * por todos los nombres de
    la carpeta ANTES de ejecutar el comando, y la lista no cabe en el
    espacio reservado a los argumentos de un programa (unos 2 MB).
    find, en cambio, recorre la carpeta él mismo: puede borrar lo que
    encuentra, sin lista gigante.
inodes-event-recent-lost =
    Cuidado: han desaparecido estadísticas de menos de 30 días, las que
    necesita el ayuntamiento. Reinicia el capítulo para probar de otra
    manera (enlace debajo del terminal).
# { $percent }: inodos ocupados
inodes-event-restarts =
    Se han liberado inodos ({ $percent } % ocupados): la grabación
    nocturna ha vuelto a empezar, y el repetidor vuelve a registrar las
    escuchas. Ahora, a evitar que vuelva a pasar: una tarea cron, cada
    noche, para conservar solo el último mes (el juego dejará pasar una
    noche para verla trabajar).
inodes-event-end =
    La noche ha pasado, la tarea ha limpiado, y el último mes de
    estadísticas está intacto. Zoé: «Los inodos… ni siquiera conocía la
    palabra. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo 3 de De Guardia.

    QUÉ HA PASADO
    El repetidor escribía un pequeño archivo por escucha, durante seis
    meses, sin borrarlos nunca. Al volumen le quedaba todo su espacio,
    pero ni un solo inodo: cada archivo ocupa uno, y su número se fija al
    crear el sistema de archivos (uno por cada 16 KiB por defecto). rm *
    no podía (demasiados argumentos); find, con -mtime y -delete, borró
    los antiguos conservando el último mes, y cron lo vuelve a hacer cada
    noche.

    BUENA PRÁCTICA
    - «No space left on device» con espacio de sobra: df -i.
    - Encuentra dónde están los archivos: du --inodes (con -d 1 o -s).
    - Borra en masa con find … -delete (o -exec), nunca rm * sobre miles
      de archivos; prueba primero sin -delete.
    - Todo dato que se acumula (registros, estadísticas, sesiones,
      cachés) tiene un plazo de conservación y una tarea que lo aplica.
    - Vigila los inodos como el espacio (una alerta al 80 %).

    DOCUMENTACIÓN
    - df (-i): https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html
    - find (-mtime, -delete): https://www.gnu.org/software/findutils/manual/html_mono/find.html
    - ARG_MAX y «Argument list too long»: https://man7.org/linux/man-pages/man2/execve.2.html
