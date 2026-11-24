### Historia «El Lote Nocturno», capítulo «El archivo que llega tarde»: el
### temporizador arrancó el lote antes de que llegara el archivo de la
### gestoría. Esperar a que el archivo esté completo, no procesarlo nunca dos
### veces y hacer visible un fallo. Los comandos, rutas, archivos de unidad y
### salidas de los programas no se traducen.

chapter-late-file = El archivo que llega tarde
    .summary = El lote se ejecutó a las 02:00 con el archivo de ayer y no dijo nada: haz que espere al archivo completo, que lo procese una sola vez y que te avise cuando falle.

## Files

late-file-email-ayesha =
    De:    Ayesha
    Para:  tú

    Malas noticias. Esta mañana, contabilidad se dio cuenta de que el
    informe de cobro tenía la misma fecha de ejecución que el de ayer: a
    las 02:00, el lote procesó por segunda vez el archivo del 22. El
    archivo de la gestoría llegó anoche a las 02:41, después de nuestro
    temporizador. Y el lote no dijo nada: el servicio terminó «con éxito».

    Lo ejecuté a mano con el archivo correcto a las 8:10, y quité el .done
    (la gestoría escribe contrib.ebc.done cuando termina su envío). Ahora
    el informe es correcto: a nadie se le cobrará dos veces.

    La gestoría avisa de que su archivo puede volver a llegar tarde. ¿Podrías
    arreglar las tuberías? El lote debe esperar a que el archivo esté
    completo, no procesar nunca dos veces el mismo archivo y, si el programa
    termina mal, tenemos que enterarnos (un correo a mí o a ti servirá). El
    temporizador y el servicio están en /etc/systemd/system, el script
    envoltorio es /opt/batch/run-night.sh.

    La gestoría aceptó hacer un ensayo: cada vez que cambies el envoltorio,
    las unidades o un crontab, sus dos noches siguientes llegarán tarde a
    propósito, y al segundo archivo le faltará un registro.

    Ayesha

## The rehearsal

late-file-rehearsal = Ensayo con la gestoría: las dos noches siguientes (Ayesha quita primero cualquier .done que quede en /srv/drop).
late-file-night-first = Noche del { $date }: el archivo llega tarde, su .done llega a las { $done }.
late-file-night-second = Noche del { $date }: el archivo llega aún más tarde, su .done llega a las { $done }, y le falta un registro (el registro final todavía lo cuenta).
late-file-run = { $time }: el lote se ejecutó con el archivo del { $date }, código de retorno { $rc }.
late-file-more-runs = …y { $count } ejecuciones más.
late-file-no-run = El lote no procesó ningún archivo.
late-file-verdict-stale = Mal: procesó un archivo viejo, y a los socios y socias se les cobraría dos veces. Procesa solo un archivo cuyo .done esté ahí.
late-file-verdict-partial = Mal: empezó con un archivo que aún se estaba escribiendo (sin registro final todavía: código de retorno 12). Espera al .done.
late-file-verdict-none = Mal: el archivo de esta noche no se procesó nunca. ¿Vuelve a intentarlo el lote después de las 02:00? ¿Ha recargado systemd el temporizador, y está activo (systemctl daemon-reload, systemctl list-timers)? ¿O está instalado el crontab?
late-file-verdict-twice = Mal: el archivo de esta noche se procesó { $count } veces. Una vez procesado, quita su .done (rm o mv).
late-file-verdict-too-late = Mal: procesado a las { $time }, después de las 07:00, cuando contabilidad envía el informe al banco. Vuelve a intentarlo más a menudo.
late-file-verdict-ok = Bien: procesado una vez, completo, con código de retorno 0.
late-file-verdict-mailed = Bien: código de retorno 8, y { $who } recibió un correo a las { $time }.
late-file-verdict-failed = Bien: código de retorno 8, y systemd marcó { $unit } como fallido a las { $time } (systemctl status, journalctl -u).
late-file-verdict-silent = Mal: código de retorno 8, pero nadie lo sabe. El servicio terminó con éxito y nadie recibió un correo: el envoltorio debe transmitir el código del programa (set -e, o salir con él), o enviar un correo.
late-file-rehearsal-again = Cambia lo que haya que cambiar: la gestoría volverá a ensayar las dos noches siguientes.

## Events

late-file-event-diagnosed =
    Ahí está: el lote se ejecutó a las 02:00 el jueves y otra vez el
    viernes, y las dos ejecuciones leyeron el archivo del 22 (RUN DATE
    291122). A las 02:00 del viernes, el archivo nuevo aún no estaba; el
    temporizador no lo sabe, solo sabe la hora.
late-file-event-unscheduled =
    Ya no hay nada programado: ningún temporizador activo, ningún crontab.
    Esta noche, el lote no se ejecutará en absoluto.
late-file-event-first-night =
    La noche del retraso fue bien: el lote esperó al .done y luego procesó
    el archivo una vez, con código de retorno 0.
late-file-event-second-night =
    El archivo incompleto se detectó: código de retorno 8, y alguien lo
    sabe.
late-file-event-end =
    Ayesha: «Dos noches, dos trampas, y el lote superó las dos. Ramón leyó
    tu envoltorio: dice que es la primera vez en treinta años que el lote
    avisa a alguien cuando algo va mal.»

    ¡Bien hecho! Has terminado el capítulo «El archivo que llega tarde» y
    la historia «El Lote Nocturno».

    QUÉ HA PASADO
    El temporizador arrancaba el lote a una hora fija, estuviera o no el
    archivo, y el envoltorio terminaba con un echo: su código de salida era
    siempre 0. El programa había hecho lo que se le pedía. Cambiaste las
    tuberías a su alrededor: ahora el lote espera al .done de la gestoría
    (la señal de que el envío está completo), lo quita una vez procesado el
    archivo, vuelve a intentarlo durante la noche y transmite el código de
    retorno del programa, para que un fallo se vea.

    BUENA PRÁCTICA
    - Arranca un trabajo con un evento (el archivo está completo: un .done,
      un tamaño que ya no cambia), no solo a una hora.
    - Haz un trabajo idempotente: el mismo archivo no debe procesarse nunca
      dos veces (quita su marca, muévelo a un archivo histórico).
    - Un envoltorio transmite los códigos de retorno de sus programas (set
      -e, exit $RC): systemd marca el servicio como fallido (systemctl
      --failed), cron envía la salida por correo.
    - Avisa a una persona, y fija un plazo: un archivo que nunca llega
      también es un incidente.

    OTRA MANERA
    Una unidad path de systemd (PathExists=/srv/drop/contrib.ebc.done)
    arranca el servicio en cuanto aparece el .done, sin intentarlo cada
    diez minutos; OnFailure= arranca otra unidad (un correo) cuando el
    servicio falla. En un mainframe, el planificador (y el COND del JCL)
    hacía todo eso: es la parte que hay que mudar con más cuidado.

    DOCUMENTACIÓN
    - systemd.timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - systemd.path: https://www.freedesktop.org/software/systemd/man/latest/systemd.path.html
    - sh, set -e y exit: https://manpages.debian.org/bookworm/dash/sh.1.en.html
    - crontab(5): https://manpages.debian.org/bookworm/cron/crontab.5.en.html
