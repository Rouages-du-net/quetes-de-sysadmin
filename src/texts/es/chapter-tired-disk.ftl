### Historia «El Laboratorio», capítulo 1 «El disco cansado»: SMART, RAID
### por software (mdadm), sacar un disco de sus arreglos. Los comandos, las
### opciones, las rutas y las salidas (smartctl, mdadm, /proc/mdstat) no se
### traducen. También contiene los textos compartidos por la historia (lab-…).

chapter-tired-disk = El disco cansado
    .summary = smartd se preocupa por un disco: leer lo que dice de verdad SMART, entender el RAID del servidor, sacar el disco enfermo de sus arreglos y pedir su sustitución por su número de serie.

## Compartido por la historia

lab-procedure-host =
    Sustitución de un disco averiado — servidores dedicados

    1. Antes de escribirnos, retira el disco de tus arreglos RAID por
       software (mdadm): lo desconectamos con el servidor en marcha, y un
       disco todavía en uso podría dañar el arreglo.
    2. Indícanos en tu solicitud el número de serie (S/N) del disco que hay
       que sustituir, y solo ese: los nombres sda o sdb pueden cambiar de un
       arranque a otro, el número de serie no (smartctl -i o lsblk -o lo
       muestran).
    3. Intervenimos en un plazo de 24 horas. El disco nuevo se entrega
       vacío: te toca a ti particionarlo y reconstruir tu RAID.
lab-syslog =
    Nov 11 03:12:44 laboratorio smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors
    Nov 11 03:42:44 laboratorio smartd[588]: Device: /dev/sdb [SAT], 8 Offline uncorrectable sectors
    Nov 13 03:00:12 laboratorio smartd[588]: Device: /dev/sdb [SAT], starting scheduled Short Self-Test.
    Nov 13 03:02:44 laboratorio smartd[588]: Device: /dev/sdb [SAT], previous self-test completed with error (read test element)
    Nov 13 03:12:44 laboratorio smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors

# The gallery's home page (/var/www/gallery/index.html).
lab-gallery-index = <!doctype html><title>El Laboratorio</title>

## Archivos

tired-disk-message-odile =
    Un mensaje de Odile, presidenta del Laboratorio, el club de fotografía
    del barrio (sábado, 7:30):

    «Hola, ¡y gracias por hacerte cargo del servidor del club! No entiendo
    mucho, pero desde el jueves recibo correos raros de "smartd" sobre un
    disco. Te los he reenviado: el comando mail los lista, y están en
    /var/mail/tu. Además, la galería iba muy lenta anoche.

    El servidor está alquilado a una empresa de alojamiento. Según el
    voluntario anterior, tiene dos discos "en RAID", para no perder nada si
    uno falla. Si hay que sustituir un disco, el proveedor lo hace gratis:
    su procedimiento está en procedimiento_alojamiento.txt. Escribe la
    solicitud en ~/ticket.txt, yo la enviaré desde nuestra cuenta de
    cliente.

    Para sudo: pelicula-2027.»

## Eventos

tired-disk-event-alert =
    smartd y el núcleo hablan del mismo disco: sdb. Sectores que ya no
    puede leer (pending), y lecturas que el RAID tuvo que repetir en el
    otro disco (redirecting … to other mirror). Antes de sacar
    conclusiones, mira cómo están montados los discos: cat /proc/mdstat.
tired-disk-event-arrays =
    Dos arreglos RAID 1: md0 (el sistema, /) con sda2 y sdb2, y md1 (las
    fotos, /srv) con sda3 y sdb3. [UU]: por ahora, las dos copias están ahí.
    Así que cada disco está en los dos arreglos. ¿Qué dice SMART de sdb, y
    de sda para comparar? (man smartctl)
tired-disk-event-smart =
    «PASSED»… y sin embargo: más de mil sectores reasignados, 8 pendientes,
    37 errores en su registro. El veredicto global solo cambia al llegar al
    umbral del fabricante; un número de sectores reasignados que no deja de
    subir anuncia la avería. Compara con sda: cero en todo. sdb tiene que
    salir de sus dos arreglos antes de que lo sustituyan (man mdadm:
    --fail, y luego --remove).
tired-disk-event-busy =
    mdadm se niega: no se retira un miembro activo de un arreglo («Device or
    resource busy»). Primero hay que declararlo averiado (--fail), y luego
    retirarlo (--remove); las dos cosas caben en el mismo comando.
tired-disk-event-healthy =
    Cuidado: ¡acabas de sacar de su arreglo un miembro de sda, el disco
    SANO! Ahora solo se sostiene sobre sdb, el que se está desgastando.
    Retíralo (--remove) y vuelve a añadirlo (--re-add): se pondrá al día y
    el arreglo recuperará su copia sana. Solo entonces ocúpate de sdb.
# { $partition }: the sdb partition still in place; { $array }: its array
tired-disk-event-half =
    Un arreglo está hecho. Pero sdb también está en el otro: { $partition }
    sigue formando parte de { $array }. Un disco que se sustituye sale de
    todos sus arreglos.
tired-disk-event-removed =
    sdb ya no forma parte de ningún arreglo: /proc/mdstat muestra [U_] en
    los dos. El servidor funciona solo con sda, sin red de seguridad: hay
    que sustituir el disco rápido. Queda la solicitud, ~/ticket.txt, con lo
    que pide el procedimiento del proveedor.
# { $file }: the ticket's name
tired-disk-event-ticket-false =
    La solicitud contiene el número de serie de sda: ¡es el disco SANO! El
    proveedor desconectaría el único disco que todavía funciona. Corrige
    { $file }: solo el número de serie de sdb.
tired-disk-event-ticket =
    La solicitud indica el número de serie del disco que hay que sustituir.
    Odile la enviará en cuanto el disco esté fuera de sus arreglos.
tired-disk-event-end =
    Odile: «¡Enviada! El proveedor responde que cambiará el disco esta
    noche».

    ¡Bien hecho! Has terminado el capítulo 1 de El Laboratorio. (Lo que
    sigue te espera: ssh laboratorio.)

    QUÉ HA PASADO
    El disco sdb se estaba desgastando: sectores ilegibles, de los que
    smartd avisaba desde hacía dos días y que el RAID compensaba leyendo el
    otro disco. Sin embargo, SMART decía PASSED: su veredicto global solo
    cambia al llegar al umbral del fabricante, a menudo demasiado tarde.
    Comparaste los atributos de los dos discos, sacaste sdb de sus dos
    arreglos y pediste su sustitución por su número de serie.

    BUENA PRÁCTICA
    - Ten smartd en marcha, y lee sus correos: el correo de root tiene que
      llegar a alguien (/etc/aliases).
    - Juzga un disco por sus atributos (5, 197, 198) y su evolución, no por
      PASSED.
    - Antes de una sustitución: --fail y luego --remove, en todos los
      arreglos del disco.
    - Designa un disco por su número de serie, nunca por sda o sdb, que
      pueden cambiar de un arranque a otro.
    - El RAID no es una copia de seguridad: protege de la avería de un
      disco, no de un borrado, de un ransomware ni de un incendio.

    DOCUMENTACIÓN
    - smartctl: https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in
    - mdadm: https://man7.org/linux/man-pages/man8/mdadm.8.html
    - RAID por software de Linux (md): https://docs.kernel.org/admin-guide/md.html
