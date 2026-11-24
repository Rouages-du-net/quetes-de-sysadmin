### Historia «El Observatorio», capítulo 1 «Carga pesada»: la carga media,
### top, nice y renice. Los comandos, las rutas y las salidas de las
### herramientas no se traducen.

chapter-heavy-load = Carga pesada
    .summary = La galería del club tarda cinco segundos por página desde que Jules empezó a apilar las fotos de anoche. Hacer que vuelva a ir rápida sin parar su trabajo.

## Archivos

heavy-load-message-amara =
    De:      Amara
    Para:    tú
    Asunto:  La galería se arrastra

    Hola:

    Estoy fuera hasta el domingo (¡por fin cielo despejado!), y los socios
    del club me escriben que la galería tarda una eternidad en abrirse esta
    mañana. Anoche fue el máximo de las Gemínidas: Jules lanzó el apilado de
    sus fotos en el servidor a las 6:00, desde su sesión.

    Por favor, no pares su apilado: lleva tres horas funcionando, y volvería
    a empezar de cero. Solo haz que la galería se pueda volver a usar
    mientras termina.

    Para cronometrar la galería, hago:
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/
    Normalmente responde en unos 0,25 s.

    Tu contraseña de sudo: nebulosa-2028.

    Amara

## Eventos

heavy-load-event-load =
    La carga media: cuántos procesos, de media durante 1, 5 y 15 minutos,
    están ejecutándose o esperando una CPU. Compárala con el número de CPU
    (nproc): por encima, algunos esperan su turno.
heavy-load-event-workers =
    stack-worker, ocho veces, cada uno a un 22 % de una CPU: el apilado de
    Jules (stack-night) lanzó ocho procesos de trabajo, en una máquina que
    tiene dos CPU. La galería (node) recibe la misma parte que cada uno de
    ellos: una novena parte de la máquina, cuando necesita una CPU entera.
heavy-load-event-parent-only =
    El padre, stack-night, tiene ahora un valor nice; sus ocho procesos de
    trabajo conservan el suyo (mira la columna NI de top, o
    ps -o pid,ni,comm). Un valor nice pertenece a cada proceso: los hijos ya
    lanzados no lo siguen. Y el padre solo espera: los que calculan son los
    procesos de trabajo.
heavy-load-event-some-workers =
    Algunos procesos de trabajo tienen nice, no todos: los que siguen en 0
    conservan su parte completa, y la galería sigue esperando. renice acepta
    varios PID, o todos los procesos de una cuenta (man renice: -u).
heavy-load-event-killed =
    Una parte del apilado ha desaparecido. Jules: «Tres horas de cálculo…
    esta noche tendrá que volver a empezar de cero». Era lo que Amara pedía
    evitar: para volver a intentarlo, usa «Reiniciar este capítulo», debajo
    de la terminal.
heavy-load-event-gallery-stopped =
    La galería está parada: los socios ya no reciben ninguna página. Vuelve
    a arrancarla (sudo systemctl start gallery).
heavy-load-event-end =
    La galería vuelve a responder en un cuarto de segundo, y el apilado
    sigue. Jules: «¡Ah, ha tardado un poco más, pero nadie se ha dado
    cuenta!».

    ¡Bien hecho! Has terminado el capítulo «Carga pesada».

    QUÉ HA PASADO
    La máquina tiene dos CPU. El apilado de Jules lanzó ocho procesos de
    trabajo, cada uno queriendo una CPU: con la galería, nueve procesos para
    dos CPU. La carga media lo decía (unos 9 para 2 CPU), y el planificador
    daba a cada uno la misma parte: la galería recibía 0,2 CPU en lugar de
    1, y sus peticiones hacían cola.

    LO QUE CAMBIA NICE
    El valor nice va de -20 (servido primero) a 19 (servido el último). El
    planificador reparte la CPU en proporción a un peso que baja alrededor
    de un 25 % en cada paso: con nice 19, un proceso pesa 15 frente a 1024
    con 0. Los procesos de trabajo siguen recibiendo todo lo que nadie más
    quiere: el apilado solo va más lento mientras la galería está ocupada.
    La carga media no ha bajado: cuenta los procesos que quieren
    ejecutarse, sea cual sea su prioridad. Una carga alta no es un problema
    en sí misma; un servicio que espera una CPU sí lo es.

    BUENA PRÁCTICA
    - Compara la carga con nproc, y luego busca quién se lleva la CPU: top
      (ordenado por %CPU), ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Lanza los trabajos largos ya con nice: nice -n 19 stack-night…
    - renice -n 19 -u CUENTA alcanza todos los procesos de una cuenta; sobre
      un PID, solo ese proceso (sus hijos conservan su valor).
    - Solo root puede bajar un valor nice (dar más prioridad).

    DOCUMENTACIÓN
    - renice: https://man7.org/linux/man-pages/man1/renice.1.html
    - El planificador y nice: https://man7.org/linux/man-pages/man7/sched.7.html
    - La carga media: https://man7.org/linux/man-pages/man5/proc_loadavg.5.html
heavy-load-event-end-gallery =
    La galería vuelve a responder en un cuarto de segundo, y el apilado
    sigue: le has dado a la galería una prioridad más alta (un valor nice
    negativo, que solo root puede poner). Funciona; la forma habitual es la
    contraria: bajar la prioridad del trabajo por lotes (renice -n 19 sobre
    los procesos de trabajo), para que todos los servicios de la máquina
    pasen antes que él.

    ¡Bien hecho! Has terminado el capítulo «Carga pesada».

    QUÉ HA PASADO
    La máquina tiene dos CPU. El apilado de Jules lanzó ocho procesos de
    trabajo, cada uno queriendo una CPU: con la galería, nueve procesos para
    dos CPU. La carga media lo decía (unos 9 para 2 CPU), y el planificador
    daba a cada uno la misma parte: la galería recibía 0,2 CPU en lugar de
    1.

    LO QUE CAMBIA NICE
    El valor nice va de -20 (servido primero) a 19 (servido el último). El
    planificador reparte la CPU en proporción a un peso que cambia alrededor
    de un 25 % en cada paso. La carga media no ha bajado: cuenta los
    procesos que quieren ejecutarse, sea cual sea su prioridad.

    BUENA PRÁCTICA
    - Compara la carga con nproc, y luego busca quién se lleva la CPU: top,
      ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Lanza los trabajos largos ya con nice: nice -n 19 stack-night…
    - renice -n 19 -u CUENTA alcanza todos los procesos de una cuenta.

    DOCUMENTACIÓN
    - renice: https://man7.org/linux/man-pages/man1/renice.1.html
    - El planificador y nice: https://man7.org/linux/man-pages/man7/sched.7.html
