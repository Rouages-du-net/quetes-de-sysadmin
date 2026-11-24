### Historia «La Ludoteca», capítulo 2 «Instantáneas»: rsnapshot, enlaces
### duros, rotación diaria y semanal, cron. Los comandos, las rutas, las
### directivas y los mensajes de rsnapshot no se traducen.

chapter-snapshots = Instantáneas
    .summary = Poder volver a cualquier día de las dos últimas semanas: rsnapshot, sus tabulaciones, sus enlaces duros, y cron.

## Archivos

snapshots-message-berenice =
    Un mensaje de Bérénice:

    «Después del ataque, a Malo le gustaría que pudiéramos volver a
    cualquier día de las dos últimas semanas, sin conectar el disco USB
    cada vez. Ha instalado rsnapshot; su configuración sigue siendo la que
    trae Debian (/etc/rsnapshot.conf).

    Lo que necesitamos:
      - copiar /srv/compartido/;
      - en el segundo disco del servidor, montado en /mnt/instantaneas
        (¡no en el disco del sistema!);
      - conservar 7 instantáneas diarias y 4 semanales;
      - que funcione solo, cada noche y cada semana.

    Malo ha dejado un consejo: «rsnapshot configtest antes que nada, y
    cuidado con las tabulaciones». Para sudo: dados-2027.»
# { $number }: el número del juego añadido
snapshots-line-inventory = juego donado n.º { $number };1;nuevo
snapshots-inventory-old =
    juego;ejemplares;estado
    serpientes y escaleras;3;bueno
    parchís;2;bueno

# La etiqueta del segundo disco (lsblk -f, blkid).
snapshots-disk-label = INSTANTANEAS

## Eventos

# { $mails }: el número de correos enviados por cron
snapshots-two-weeks =
    Pasan dos semanas. Cada día, Bérénice añade al inventario los juegos
    donados; cada noche, cron ejecuta lo que está programado. Mira lo que
    hay ahora en /mnt/instantaneas (y el correo de cron:
    { $mails ->
        [0] ningún mensaje, todo ha ido bien)
        [one] un mensaje; «nothing to copy» es normal los primeros días,
            mientras no haya suficientes instantáneas diarias)
       *[other] { $mails } mensajes; «nothing to copy» es normal los
            primeros días, mientras no haya suficientes instantáneas
            diarias)
    }.
snapshots-event-spaces =
    rsnapshot rechaza su configuración: en /etc/rsnapshot.conf, los
    elementos de una línea se separan con TABULACIONES, nunca con espacios
    (aunque en pantalla parezcan iguales). En nano, la tecla Tab escribe
    una tabulación.
snapshots-event-same-disk =
    Las instantáneas se guardan en el disco del sistema, al lado de los
    datos: si ese disco falla, se va todo con él. Malo quería el segundo
    disco, /mnt/instantaneas (snapshot_root).
# { $example }: el principio de un correo de cron
snapshots-event-mails =
    cron ha enviado correo: sus tareas han escrito errores. Por ejemplo:

    { $example }

    Una tarea del crontab de una cuenta normal no tiene los permisos de
    root; una del crontab de root, sí (sudo crontab -e).
snapshots-event-links =
    La primera instantánea ocupa su tamaño completo, las siguientes casi
    nada: los archivos que no han cambiado no se vuelven a copiar, se
    enlazan. ls -i muestra el mismo número de inodo para el mismo archivo
    en dos instantáneas: un solo archivo, dos nombres. Y sin embargo cada
    instantánea parece completa.
snapshots-event-error-berenice =
    Las instantáneas rotan: siete diarias, y la primera semanal. Y justo
    entonces, Bérénice: «Uy… Anoche sustituí el inventario por una copia
    antigua que andaba por mi memoria USB: ¡todos los juegos donados han
    desaparecido! ¿Puedes dejarlo como estaba anteayer?» (La instantánea
    de anoche ya tiene la versión mala: mira las anteriores, diff te
    ayudará.)
snapshots-event-wrong-version =
    El inventario de la carpeta compartida sigue siendo la copia antigua:
    la instantánea más reciente (.0) se tomó DESPUÉS del error de
    Bérénice. Necesitas la de la noche anterior.
snapshots-event-end =
    El inventario ha vuelto, con todos los juegos donados. Bérénice: «¡Y
    todos los días de las dos últimas semanas están ahí, sin que el disco
    esté lleno!»

    ¡Bien hecho! Has terminado el capítulo 2 de La Ludoteca. (Te espera el
    siguiente: ssh ludoteca.)

    QUÉ HA PASADO
    Cada noche, rsnapshot ha rotado las instantáneas diarias: la
    antigua .0 pasa a ser .1, y así sucesivamente; la más antigua se
    borra. La
    nueva .0 es una copia de .1 hecha de enlaces duros, que rsync
    actualiza: solo ocupan espacio los archivos modificados. Una vez por
    semana, la diaria más antigua pasa a ser semanal. Para corregir el
    error de Bérénice, bastaba con volver a copiar el archivo desde la
    instantánea tomada antes del error.

    BUENA PRÁCTICA
    - Las instantáneas en otro disco (y además una copia desconectada:
      una instantánea en la misma máquina no protege de todo).
    - configtest después de cada cambio; tabulaciones, no espacios.
    - El nivel más raro se ejecuta un poco antes que el más frecuente, en
      el crontab de root.
    - Lee el correo de cron: es ahí donde llegan los errores.
    - Practica la restauración de un archivo antes de necesitarla.

    OTRA MANERA
    restic («Las Versiones», El Archivo) o borg: deduplicación (un archivo
    modificado solo copia sus trozos cambiados), cifrado, repositorio
    remoto (sftp, almacenamiento de objetos); pero se restaura con la
    herramienta (restic restore), no con cp. rsnapshot: carpetas normales
    que se leen con ls, pero sin cifrado ni deduplicación fina, y hace
    falta un sistema de archivos que admita enlaces duros.

    DOCUMENTACIÓN
    - rsnapshot: https://rsnapshot.org/rsnapshot/docs/docs.html
    - rsnapshot(1): https://manpages.debian.org/bookworm/rsnapshot/rsnapshot.1.en.html
    - Enlaces duros (ln): https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
