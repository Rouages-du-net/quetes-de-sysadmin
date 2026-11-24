### Historia «El Observatorio», capítulo 2 «La cuota»: nice no pone techo,
### CPUQuota= sí. Los comandos, las rutas, los nombres de unidades y los
### mensajes de systemd no se traducen.

chapter-quota = La cuota
    .summary = El apilado es ahora un servicio con Nice=19, y la galería va bien. Pero el proveedor va a estrangular la máquina: toda la noche por encima de su línea base de CPU. Poner un techo al apilado sin perder la noche de Jules.

## Archivos

quota-message-amara =
    De:      Amara
    Para:    tú
    Asunto:  El proveedor nos va a estrangular

    Hola:

    Desde tu arreglo, Jules ha convertido su apilado en un servicio:
    /etc/systemd/system/stacking.service, con Nice=19, como le
    aconsejaste. Lo arranca cuando se va a dormir. La galería ya no sufre.

    Pero lee el correo del proveedor (correo_del_alojamiento.txt): la
    máquina está por encima de su «línea base» toda la noche, y la van a
    ralentizar. ¿Puedes mantener el apilado por debajo de ese límite, para
    esta noche y para las siguientes?

    Todavía está en marcha (desde la 1:10, hasta las 11 más o menos): si
    puedes, no lo reinicies, Jules perdería su noche.

    La misma contraseña de sudo: nebulosa-2028.

    Amara
quota-mail-host =
    De:      support@cloud.example
    Para:    astro-club@cloud.example
    Asunto:  [observatorio] Créditos de CPU agotados

    Hola:

    Su instancia «observatorio» (2 vCPU, plan «burst») ha usado más de su
    línea base del 40 % de sus vCPU durante 7 horas seguidas. Sus créditos
    de CPU están agotados: a partir de las 12:00 de hoy, quedará limitada a
    esa línea base hasta que sus créditos se recuperen.

    Para evitarlo, mantenga el uso medio de la instancia por debajo del
    40 %.

    El equipo de cloud.example

## Eventos

quota-event-measure =
    Los procesos de trabajo están en nice 19, y sin embargo se llevan casi
    todo de las dos CPU: a esta hora nadie navega por la galería, así que
    nadie reclama el resto. Nice reparte entre los procesos que quieren la
    CPU; no pone ningún techo. En toda la noche, la máquina está al 100 % de
    sus dos vCPU: muy por encima del 40 % del proveedor.
quota-event-nice-property =
    systemctl set-property solo cambia ajustes de control de recursos, los
    que systemd puede aplicar a un servicio en marcha (CPUQuota=,
    CPUWeight=, MemoryMax=…). Nice= se aplica cuando arrancan los procesos.
    Y nice no es lo que necesitas aquí: man systemd.resource-control.
quota-event-reload =
    El archivo dice CPUQuota=, pero systemd todavía no lo ha leído: después
    de cambiar a mano un archivo de unidad o un drop-in, sudo systemctl
    daemon-reload. (systemctl edit y systemctl set-property lo hacen solos.)
quota-event-per-cpu =
    Hay una cuota puesta, pero es demasiado alta para el proveedor.
    CPUQuota= cuenta en porcentaje de UNA CPU: 100 % es una CPU entera,
    200 % las dos. El proveedor permite el 40 % de las dos vCPU: 0,8 CPU,
    así que CPUQuota=80% como máximo.
quota-event-stopped =
    El apilado está parado. Jules: «¡Mi noche!». Para que termine, tiene que
    funcionar: sudo systemctl start stacking (vuelve a empezar desde el
    principio) — y ponle un techo, si no el proveedor lo ralentizará todo.
quota-event-restarted =
    El apilado se ha reiniciado: vuelve a empezar desde el principio de las
    fotos de la noche. Jules suspira, pero terminará esta tarde. No hacía
    falta reiniciar: systemd aplica CPUQuota= a un servicio en marcha
    (set-property, o daemon-reload después de un drop-in).
quota-event-end =
    El apilado se queda ahora por debajo de 0,8 CPU: el 40 % de la máquina.
    Sigue funcionando, un poco más de tiempo, y se respeta el límite del
    proveedor; el ajuste está en disco, así que también se aplicará las
    próximas noches. Amara: «Perfecto, le contesto al proveedor».

    ¡Bien hecho! Has terminado el capítulo «La cuota».

    QUÉ HA PASADO
    Nice=19 ponía el apilado detrás de todos los demás procesos, pero no
    pone ningún techo: cuando nadie más quiere la CPU, un proceso con nice
    se la lleva entera. Toda la noche, la máquina estuvo al 100 % de sus dos
    vCPU, más que el 40 % que permite en el tiempo el plan del proveedor.

    NICE REPARTE, LA CUOTA PONE UN TECHO
    - nice (Nice=, renice): quién pasa primero cuando no hay para todos.
      Ningún límite cuando la CPU está libre.
    - CPUQuota= (systemd, los cgroups del núcleo): como mucho este tiempo de
      CPU por segundo, aunque la CPU esté libre. 100 % = una CPU, 200 % =
      dos.
    - CPUWeight=: como nice, pero entre servicios (cgroups).

    BUENA PRÁCTICA
    - sudo systemctl set-property stacking CPUQuota=80%: se aplica enseguida
      y se guarda en disco (en /etc/systemd/system.control).
    - O sudo systemctl edit stacking ({"["}Service] CPUQuota=80%): un
      drop-in, que systemctl edit lee enseguida. A mano: daemon-reload.
    - Compruébalo con systemd-cgtop, o top: los procesos de trabajo juntos
      se quedan por debajo de la cuota.

    DOCUMENTACIÓN
    - CPUQuota=, CPUWeight=: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - systemctl set-property: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - systemd-cgtop: https://www.freedesktop.org/software/systemd/man/latest/systemd-cgtop.html
