### El diálogo del recordatorio diario (src/engine/reminder.ts), cargado
### cuando se abre por primera vez (src/texts/plugin.mjs: dialog-*.ftl). Su
### botón está en interface.ftl.

reminder-title = Un recordatorio diario en tu calendario
reminder-intro = Elige una hora: el juego crea un archivo de calendario (.ics) con un evento cada día a esa hora y una alerta. Abre el archivo con tu aplicación de calendario, en el móvil o en el ordenador, para añadirlo.
reminder-time = Hora del recordatorio
reminder-download = Descargar el archivo de calendario
reminder-floating = La hora se mantiene igual estés donde estés, y cuando se cambia la hora.
reminder-private = No se envía nada a ninguna parte: el archivo se crea en tu navegador y solo lo guarda tu aplicación de calendario. Para dejar de recibir los recordatorios, borra el evento de tu calendario.
reminder-ready = Archivo descargado: ábrelo para añadir el recordatorio a tu calendario.
reminder-invalid = Elige una hora, por ejemplo 18:30.
reminder-close = Cerrar
# El nombre del archivo descargado.
reminder-file = recordatorio-misiones-sysadmin.ics
# El evento en el calendario de quien juega. { $url }: la dirección del juego.
reminder-event-title = Misiones de Sysadmin: el incidente del día
reminder-event-description = Unos minutos de guardia: el incidente de hoy te espera. { $url }
reminder-event-alarm = Hora del incidente de hoy
