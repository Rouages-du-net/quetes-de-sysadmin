### Historia «De Guardia», capítulo 7 «El cuello de botella»: esperar al
### disco (iowait), iostat, pidstat, ionice y el límite de ancho de banda
### de systemd. Los comandos, las rutas, los nombres de unidades y las
### líneas de registro no se traducen.

chapter-bottleneck = El cuello de botella
    .summary = Cada tarde a las 16:00, el directo tartamudea: encontrar lo que satura el disco, y limitarlo sin detenerlo.

## Archivos

bottleneck-message-zoe =
    Un mensaje de Zoé (16:12):

    «¡Otra vez! Cada día, hacia las 16:00, el directo tiene huecos:
    silencios de medio segundo, varios por minuto. Nos escriben oyentes.
    El repetidor (radio-stream) funciona, su diario habla de «read stall».

    He mirado top: la máquina parece sobrecargada, pero el procesador no
    hace casi nada. No entiendo nada.

    Encuentres lo que encuentres, no apagues nada: todo lo que corre en
    este servidor tiene su función, y los programas del día tienen que
    estar archivados esta noche. Pero el directo no debe romperse, ni hoy
    ni mañana.»

    Para mirar el disco: man iostat, man pidstat.

## Eventos

bottleneck-event-iowait =
    Mira la línea %Cpu(s) de top: el procesador casi nunca está ocupado
    (us, sy), pero «wa» es enorme. Es el iowait: el tiempo que los
    procesos pasan esperando al disco. La carga (load average) cuenta
    esos procesos bloqueados, de ahí una máquina «sobrecargada» que no
    calcula nada. El cuello de botella es el disco: iostat -x muestra lo
    ocupado que está (%util) y cuánto espera cada petición (r_await, en
    ms); pidstat -d muestra quién lee y escribe.
bottleneck-event-ionice =
    ionice ha aceptado la clase «idle»… pero mira iostat: no ha cambiado
    nada. Las prioridades de ionice solo cuentan si el planificador del
    disco las gestiona (bfq, mq-deadline). El planificador de este disco
    virtual es «none» (cat /sys/block/vda/queue/scheduler): sirve las
    peticiones en orden, sin prioridad. Un límite de ancho de banda, en
    cambio, funciona con cualquier planificador: systemd lo pone en el
    cgroup del servicio (man systemd.resource-control,
    IOWriteBandwidthMax=).
bottleneck-event-stop =
    El archivado ya no funciona. El directo respira… pero los programas de
    hoy no se archivarán, y mañana a las 16:00 el temporizador lo volverá
    a lanzar a toda velocidad. Vuelve a lanzarlo (sudo systemctl start
    radio-archives), pero con un límite de ancho de banda.
bottleneck-event-bad-disk =
    systemd ha registrado el límite, pero apunta a un disco que aquí no
    existe: no frena nada. El disco de esta máquina es vda (iostat lo
    muestra); también puedes dar una ruta, y systemd encuentra el disco
    que la contiene.
bottleneck-event-too-slow =
    Un límite tan bajo protege el directo… pero el archivado de hoy no
    estará hecho antes de mañana. Bastan unas decenas de MiB/s: mira
    iostat después de cada intento, y encuentra el equilibrio.
bottleneck-event-end =
    El directo ya no tartamudea: sus lecturas esperan unos milisegundos,
    no cientos. El archivado sigue, más despacio, y su límite está
    registrado: mañana a las 16:00 se aplicará solo. Zoé: «Ni un solo
    hueco en cinco minutos. Y el archivo estará hecho hacia las 18:00,
    perfecto».

    ¡Bien hecho! Has terminado el capítulo «El cuello de botella».

    QUÉ HA PASADO
    La máquina no estaba sobrecargada: estaba esperando a su disco. Una
    copia a toda velocidad se llevaba casi todo su ancho de banda, y cada
    lectura del directo hacía cola detrás (r_await de cientos de ms). top
    lo muestra (wa, la carga), iostat -x lo demuestra (%util, await),
    pidstat -d te dice quién lo provoca.

    BUENA PRÁCTICA
    - Carga alta con el procesador ocioso: piensa en el disco (iowait), y
      míralo con iostat -x 1.
    - Limita las tareas de fondo con systemd: IOWriteBandwidthMax= e
      IOReadBandwidthMax= (el cgroup del servicio, io.max), que funcionan
      con cualquier planificador; ionice e IOSchedulingClass=idle solo
      ayudan con bfq o mq-deadline.
    - systemctl set-property se aplica enseguida y lo registra (en
      /etc/systemd/system.control); un límite escrito con systemctl edit
      también se aplica a las ejecuciones siguientes.
    - Y cuando se pueda, programa las copias grandes cuando nadie escucha.

    DOCUMENTACIÓN
    - iostat(1): https://man7.org/linux/man-pages/man1/iostat.1.html
    - systemd.resource-control(5): https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - El controlador io de cgroup v2: https://docs.kernel.org/admin-guide/cgroup-v2.html#io
