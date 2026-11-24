### Historia «La Escuela de Música», capítulo «La inundación de registros»:
### el volumen de datos está lleno de registros de la aplicación de reservas,
### que sigue en nivel debug desde junio. Los comandos, cmdlets, rutas y
### salidas no se traducen.

chapter-log-flood = La inundación de registros
    .summary = La aplicación de reservas no puede guardar nada y el profesorado no puede guardar en su recurso compartido: el volumen de datos está lleno. Encuentra qué lo llena, libera espacio sin perder los registros que necesita la secretaría y evita que vuelva a llenarse.

## Files

log-flood-email-beatriz =
    De:    Beatriz (secretaría)
    Para:  tú

    Hola:

    Desde anoche, la Agenda responde «Could not save the booking» a cada
    nueva reserva, y esta mañana Samir no pudo guardar su plan de
    orquesta en el recurso Teachers: «No hay espacio suficiente en el
    disco».

    Gabriel nos dijo en junio que había «subido los registros de la
    Agenda» para perseguir las reservas duplicadas. ¿Los volvió a bajar
    alguna vez?

    Cuidado: todavía estoy resolviendo lo de la familia a la que se cobró
    dos veces el 4 de diciembre, y necesito los registros de la Agenda de
    esas semanas. La regla de Mariam es que siempre guardamos los últimos
    30 días de registros.

    ¡Gracias!
    Beatriz

## Events

log-flood-event-full =
    A D: (Data) le quedan unos cientos de megabytes de 500 GB: no es de
    extrañar que no se pueda guardar nada. ¿Qué ocupa todo ese sitio? Busca
    en D:\ los archivos más grandes (Get-ChildItem -Recurse -File,
    Sort-Object Length).
log-flood-event-culprit =
    D:\Logs\Agenda: un archivo al día desde el 12 de junio,
    agenda-2029-06-12.log y así sucesivamente, varios GB cada uno. La
    Agenda empieza un registro nuevo a medianoche y nada borra nunca los
    antiguos. Pero ¿por qué tan grandes? Su configuración está en
    C:\ProgramData\Agenda\agenda.ini.
log-flood-event-level =
    level=debug: la Agenda escribe cada petición, cada consulta SQL, cada
    búsqueda en la caché. El archivo se modificó por última vez el 12 de
    junio: la depuración de Gabriel, nunca deshecha. Primero libera algo de
    sitio, y luego vuelve a bajar el nivel.
log-flood-event-whatif =
    -WhatIf lista lo que se borraría, sin borrar nada. Comprueba la lista:
    solo registros de más de 30 días, nada de las semanas que necesita
    Beatriz, ni el agenda.log actual.
log-flood-event-in-use =
    agenda.log es el registro actual de la Agenda: el servicio lo mantiene
    abierto, y Windows se niega a borrar un archivo que usa otro proceso.
    Es una protección: el registro actual es el de hoy, y el sitio está en
    los antiguos.
log-flood-event-recent-deleted =
    Han desaparecido registros de los últimos 30 días, y Beatriz los
    necesitaba para el cobro doble del 4 de diciembre. Sin copia, no
    pueden volver: vuelve a empezar el capítulo (o usa la instantánea de
    rescate) y borra solo los más antiguos (Where-Object LastWriteTime -lt
    (Get-Date).AddDays(-30)).
log-flood-event-current-deleted =
    El agenda.log actual ha desaparecido, con los errores de esta mañana
    dentro: las pruebas del incidente. La próxima vez, detente en los
    registros antiguos.
log-flood-event-backup-deleted =
    La copia de D:\Backup no es lo que llena el disco, y borrarla deja a la
    escuela sin copia de sus recursos. Vuelve a empezar el capítulo (o usa
    la instantánea de rescate): el sitio está en los registros antiguos.
log-flood-event-compressed =
    La compresión NTFS reduce mucho los registros de texto, y sí que libera
    sitio. Pero en nivel debug la Agenda sigue escribiendo varios GB al día:
    el disco se vuelve a llenar, un poco más tarde. Los registros antiguos
    fuera del periodo de conservación no tienen por qué guardarse; y el
    nivel es la causa real.
log-flood-event-freed =
    D: vuelve a tener sitio, y los registros de los últimos 30 días siguen
    ahí. Ahora la causa: en nivel debug, volverá a estar lleno en unos
    meses. Baja el nivel en agenda.ini.
log-flood-event-freed-quiet =
    D: vuelve a tener sitio, y los registros de los últimos 30 días siguen
    ahí.
log-flood-event-not-applied =
    agenda.ini dice ahora un nivel más bajo, pero la Agenda leyó su
    configuración al arrancar, en debug: sigue escribiendo cada petición
    hasta que vuelva a arrancar (Restart-Service).
log-flood-event-stopped =
    La Agenda está parada: nadie puede reservar una clase. Vuelve a
    arrancarla (Start-Service Agenda).
log-flood-event-quieter =
    La Agenda funciona con un nivel de registro más discreto: unos MB al
    día en lugar de varios GB. Aún falta liberar el sitio en D:.
log-flood-event-quieter-freed =
    La Agenda funciona con un nivel de registro más discreto: unos MB al
    día en lugar de varios GB.
log-flood-event-cleanup-task =
    Una tarea programada de limpieza: una buena segunda capa, para que los
    registros antiguos no vuelvan a acumularse nunca, sea cual sea el
    nivel. Asegúrate de que conserva 30 días, y pruébala una vez
    (Start-ScheduledTask) antes de fiarte de ella.
log-flood-event-end =
    Beatriz: «La Agenda vuelve a guardar reservas, y Samir ha guardado su
    plan. ¡Y todavía tengo mis registros de principios de diciembre,
    gracias!»

    ¡Bien hecho! Has terminado el capítulo «La inundación de registros».

    QUÉ HA PASADO
    En junio, Gabriel puso el nivel de registro de la Agenda en debug para
    perseguir un error, y nunca lo volvió a poner como estaba. La Agenda
    empieza un archivo de registro nuevo cada medianoche, y nada borra los
    antiguos: seis meses de registros de depuración, unos GB al día,
    llenaron los 500 GB de D:. Encontraste al culpable por su tamaño,
    borraste solo los registros de más de los 30 días que guarda la
    escuela (después de un -WhatIf), y volviste a poner un nivel normal,
    reiniciando el servicio para que lo leyera.

    BUENA PRÁCTICA
    - Busca antes de borrar: Get-Volume para el volumen,
      Get-ChildItem -Recurse -File | Sort-Object Length -Descending para
      los archivos más grandes, Measure-Object -Sum para el total de una
      carpeta.
    - Borra según un criterio que puedas comprobar (LastWriteTime anterior
      al periodo de conservación), primero con -WhatIf.
    - Un archivo que un servicio mantiene abierto no se puede borrar, ni se
      debe: es el registro actual.
    - El registro de depuración es para el tiempo de una investigación:
      anótalo, y desactívalo al terminar. Un servicio lee su configuración
      al arrancar.
    - Todo registro necesita una conservación: una tarea de limpieza
      (Register-ScheduledTask) o el propio ajuste de la aplicación, y una
      vigilancia del espacio libre que avise antes del 100%.

    OTRA MANERA
    La compresión NTFS (compact /c) reduce los registros de texto antiguos,
    si hay que conservarlos; no detiene lo que llena el disco. IIS tiene
    sus propios ajustes de registro (rollover), y nada borra tampoco sus
    registros antiguos: una tarea programada es lo habitual.

    DOCUMENTACIÓN
    - Get-Volume: https://learn.microsoft.com/powershell/module/storage/get-volume
    - Remove-Item: https://learn.microsoft.com/powershell/module/microsoft.powershell.management/remove-item?view=powershell-5.1
    - Where-Object: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/where-object?view=powershell-5.1
    - Register-ScheduledTask: https://learn.microsoft.com/powershell/module/scheduledtasks/register-scheduledtask
    - compact: https://learn.microsoft.com/windows-server/administration/windows-commands/compact
