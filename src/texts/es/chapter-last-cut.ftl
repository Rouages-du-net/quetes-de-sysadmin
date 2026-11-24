### Historia «El Rocódromo», capítulo «El último corte»: tras un corte de
### luz, el servidor del rocódromo se colgó en lugar de apagarse. Network
### UPS Tools (upsc, upsmon, MONITOR, MINSUPPLIES, SHUTDOWNCMD, upsmon -c
### fsd) y la política de restauración de energía del servidor (ipmitool
### chassis policy). Los comandos, las opciones, las rutas, las líneas de
### configuración y las salidas no se traducen.

chapter-last-cut = El último corte
    .summary = Una tormenta cortó la luz del rocódromo durante una hora y media. El servidor estaba en un SAI comprado justo para eso, y aun así murió como si lo desenchufaran. Averigua por qué nunca oyó al SAI, haz que lo escuche y demuéstralo con un simulacro de verdad.

## Archivos

last-cut-message-nkechi =
    De: Nkechi (presidenta, rocódromo Overhang)
    Jueves 18 de noviembre, 21:40

    ¡Hola, y gracias por quedarte después del cierre!

    El martes por la tarde la tormenta cortó la luz en toda la calle de
    19:42 a 21:05. Se encendieron las luces de emergencia, bajamos a todo
    el mundo de las paredes, y el SAI del armario de la oficina pitó
    valientemente durante casi una hora. Luego se calló, y seguro (nuestro
    servidor: reservas, cuotas, los distintivos de la puerta) murió con
    él. Cuando volvió la luz arrancó solo, pero la base de datos de
    reservas necesitó una reparación y perdimos las entradas de la tarde.

    El SAI está ahí precisamente para que seguro se apague limpiamente
    antes de que se vacíe la batería. Haruto lo montó todo en 2028; ahora
    vive en Sapporo pero dejó notas en tu carpeta personal.

    El rocódromo está cerrado hasta mañana a las 10:00, así que esta noche
    puedes probarlo de verdad: Ikaika, nuestro electricista voluntario,
    está en la oficina por si hay que pulsar un botón. sudo funciona con
    tu contraseña.

    Nkechi

last-cut-notes-haruto =
    Notas de Haruto (seguro, 2028, actualizadas por última vez en 2030)

    - El SAI habla con seguro por USB. Network UPS Tools (NUT, los
      paquetes nut-server y nut-client de Debian) tiene tres capas: el
      driver (nut-driver@NOMBRE, para el SAI llamado NOMBRE en
      /etc/nut/ups.conf), upsd (nut-server: sirve los datos del SAI), y
      upsmon (nut-monitor: vigila upsd y apaga seguro cuando la batería
      se agota).
    - upsc lista lo que sabe upsd: upsc -l para los nombres de los SAI,
      upsc NOMBRE para todo lo que dice un SAI.
    - 2030: el viejo Eaton murió, compramos un APC Back-UPS RS 1500.
      Cambié el nombre de su sección en ups.conf por algo más claro.
    - upsmon llenaba el diario de líneas «Poll UPS failed»; lo hice más
      discreto en upsmon.conf (POLLFAIL_LOG_THROTTLE_MAX).
    - Para probar el apagado, la documentación de NUT dice: upsmon -c fsd.
      Es un apagado DE VERDAD: seguro se para, y luego el SAI corta sus
      enchufes un momento. ¡Solo con el rocódromo cerrado!
    - La placa del servidor tiene un BMC: ipmitool funciona como root.

## Eventos

last-cut-event-blind =
    upsmon ha estado consultando un SAI llamado eaton en localhost, y upsd
    responde que no existe. Desde 2030, el único SAI que conoce upsd tiene
    otro nombre. Un SAI del que upsmon nunca ha sabido nada nunca está
    «en batería» para él, así que el martes se quedó quieto hasta que la
    batería se vació. ¿Qué SAI sirve upsd? (man upsc)

last-cut-event-renamed =
    Ahí está: upsd sirve un SAI, con el nombre de su sección en
    /etc/nut/ups.conf. La línea MONITOR de upsmon tiene que nombrarlo
    exactamente, como NOMBRE@HOST (man upsmon.conf).

last-cut-event-minsupplies =
    MINSUPPLIES dice cuántas fuentes de alimentación tienen que seguir
    sanas para que upsmon mantenga la máquina en marcha. Con 0, upsmon
    nunca encuentra demasiado pocas: nunca apaga seguro, diga lo que diga
    la batería. seguro tiene una fuente de alimentación: MINSUPPLIES 1.

last-cut-event-no-shutdown =
    El SHUTDOWNCMD de upsmon.conf ya no detiene la máquina. Cuando la
    batería se agote, upsmon lo ejecutaría y seguro seguiría funcionando
    hasta que el SAI se apague: exactamente el fallo del martes. El valor
    por defecto de Debian es «/sbin/shutdown -h +0».

last-cut-event-monitor-down =
    nut-monitor (upsmon) no está en marcha, o no arrancará en el próximo
    arranque. Sin upsmon, nada vigila el SAI: tiene que estar activo y
    habilitado (systemctl status nut-monitor, systemctl enable --now).

last-cut-event-killed =
    upsdrvctl shutdown envía al SAI su orden de «cortar la corriente»:
    tras offdelay segundos corta sus enchufes, con lo que siga funcionando
    detrás. NUT lo hace él mismo al final de un apagado, una vez detenidas
    las máquinas; escrito a mano, desenchufa seguro.

last-cut-event-watching =
    upsmon vigila ahora hallups: conectado a upsd como primario (upsc -c
    hallups lo lista como cliente, y el diario dice «UPS: … (primary)»).
    En batería, y luego con batería baja, avisará y apagará seguro, y le
    dirá al SAI que corte y vuelva.

last-cut-event-blind-drill =
    El simulacro apagó seguro… pero upsmon seguía vigilando el SAI que no
    existe: intentó ponerle «forced shutdown», falló, y detuvo seguro de
    todas formas. upsmon -c fsd prueba el apagado, no la detección: en un
    corte real, este upsmon seguiría sin ver nada. Arregla primero la
    línea MONITOR, y luego repite el simulacro.

last-cut-event-drill =
    El simulacro ha ido como debía: upsmon puso FSD en el SAI, seguro se
    apagó limpiamente, y al final el SAI cortó sus enchufes un momento
    (journalctl -b -1: el final del arranque anterior).

last-cut-event-stayed-off =
    Pero seguro no volvió solo: Ikaika tuvo que pulsar su botón de
    encendido. La política de restauración de energía de su firmware es
    «previous»: se enciende cuando vuelve la corriente solo si estaba
    funcionando cuando se fue. El martes se colgó funcionando, así que
    volvió; esta noche se había apagado limpiamente, así que se quedó
    apagado. En un corte a las 3 de la madrugada, nadie pulsa el botón.
    Mira ipmitool chassis status (man ipmitool).

last-cut-event-policy =
    Power Restore Policy: always-on. Cada vez que el SAI devuelva la
    corriente a sus enchufes, seguro arrancará. Un nuevo simulacro lo
    dirá.

last-cut-event-end =
    Nkechi: «Ikaika dice que el SAI hizo clic, se calló, y seguro volvió
    solo dos minutos después. El mejor espectáculo que hemos tenido en la
    oficina».

    ¡Bien hecho! Has terminado el capítulo «El último corte».

    QUÉ HA PASADO
    upsmon vigilaba eaton@localhost, el nombre de un SAI sustituido en
    2030: upsd respondía «does not exist», y un SAI del que upsmon nunca
    ha sabido nada nunca está en batería para él. El martes la batería se
    agotó y seguro se colgó. Hiciste que upsmon vigilara hallups como
    primario, y luego hiciste un simulacro con upsmon -c fsd: FSD en el
    SAI, un apagado limpio, y el corte de corriente del SAI al final (el
    POWERDOWNFLAG de upsmon, luego upsdrvctl shutdown desde los scripts de
    apagado). Tras un apagado limpio, la política «previous» del firmware
    mantenía seguro apagado: always-on lo trae de vuelta con la corriente.

    BUENA PRÁCTICA
    - Comprueba la cadena de punta a punta: upsc -l (qué nombres sirve
      upsd), upsc -c SAI (¿está conectado upsmon?), el diario de
      nut-monitor (ningún «Poll UPS failed»).
    - Nunca silencies un error que no has entendido: limitar «Poll UPS
      failed» lo escondió durante dos años.
    - MINSUPPLIES 1 y un SHUTDOWNCMD de verdad: no existe un ajuste
      «seguro» que desactive el apagado; ese es el fallo que querías
      evitar.
    - Haz simulacros cuando nadie necesita la máquina: upsmon -c fsd
      apaga de verdad y el SAI corta de verdad sus enchufes. No prueba la
      detección: para eso, lee los registros, o desenchufa el SAI (con un
      electricista).
    - Las máquinas detrás de un SAI que corta y devuelve la corriente
      necesitan «encender al volver la corriente» (always-on) en su
      firmware.
    - NUT 2.8 renombró master y slave como primary y secondary; las
      palabras antiguas siguen funcionando, las nuevas son más claras.

    DOCUMENTACIÓN
    - upsmon(8): https://networkupstools.org/docs/man/upsmon.html
    - upsmon.conf(5): https://networkupstools.org/docs/man/upsmon.conf.html
    - upsc(8): https://networkupstools.org/docs/man/upsc.html
    - Probar los apagados (upsdrvctl -t shutdown, luego upsmon -c fsd): https://networkupstools.org/docs/user-manual.chunked/Configuration_notes.html
    - ipmitool: https://codeberg.org/IPMITool/ipmitool

## Lo que comparten los tres capítulos de la historia: guardado aquí para que se cargue con la historia.

climbing-wall-archive-readme =
    harness: el NAS de Overhang (Akosua)
    /srv/archive/photos: las fotos de las competiciones y de los cursos
    /srv/archive/waivers: los descargos de responsabilidad firmados (escaneados), guardados cinco años
    Compartidos con Samba con la oficina y la recepción.
