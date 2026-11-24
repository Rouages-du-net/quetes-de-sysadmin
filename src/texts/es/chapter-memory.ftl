### Historia «De Guardia», capítulo 2 «La memoria»: el OOM killer, una
### fuga de memoria contenida por systemd (MemoryMax=, Restart=), procesos
### zombis. Los comandos, las opciones, las directivas y los mensajes (free,
### top, dmesg, systemctl) no se traducen.

chapter-memory = La memoria
    .summary = 4:31 de la madrugada, el directo solo emite silencio: ¿quién ha matado la lista nocturna, y cómo evitar que la próxima vez lo tumbe todo?

## Archivos

memory-message-zoe =
    Un mensaje de Zoé (4:25):

    «Soy yo otra vez… Desde las 4:12, el directo solo emite silencio. El
    repetidor funciona (systemctl status radio-stream), pero la lista
    automática nocturna (el servicio radio-playlist) parece muerta. No he
    tocado nada, lo prometo.

    Otra cosa, quizá sin relación: en ps hay procesos marcados <defunct>,
    «zombis» según un foro. Les he hecho kill -9: siguen ahí.»
memory-server-js =
    // Radio Barrio: la lista de reproducción automática nocturna.
    const cache = new Map(); // pistas ya decodificadas

    function decode(track) {"{"}
      if (!cache.has(track.id)) cache.set(track.id, read(track)); // TODO: vaciar la caché algún día
      return cache.get(track.id);
    {"}"}
memory-convert-py =
    # Radio Barrio: convierte los programas en pódcast.
    import subprocess

    for show in new_shows():
        # Lanza la conversión... y nunca espera a que termine (sin wait()).
        subprocess.Popen(["convertir", show])

## Eventos

memory-event-oom =
    «Out of memory», «oom-kill»: la máquina se ha quedado sin memoria, y el
    kernel ha elegido un proceso que matar para sobrevivir. Es el OOM
    killer (Out Of Memory): apunta al proceso que más memoria usa. Sus
    mensajes están en el registro del kernel: sudo dmesg (o sudo
    journalctl -k). ¿Cuánta memoria queda, y quién la ocupa? free -h y top.
memory-event-zombies =
    Zombis: procesos que ya han terminado, cuyo padre todavía no ha leído
    su resultado (la llamada al sistema wait). Casi no ocupan nada, pero
    delatan a un padre que no hace su trabajo. ¿Quién es ese padre? ps -ef
    muestra la columna PPID.
memory-event-kill-zombie =
    kill no le hace nada a un zombi: ¡ya está muerto! Solo su padre puede
    hacerlo desaparecer… o desaparecer él mismo: cuando el padre muere,
    init (PID 1) adopta a los zombis y los recoge enseguida. Basta con
    reiniciar el servicio padre.
memory-event-grows =
    Mira la lista de reproducción en top (o top -o %MEM) de un comando al
    siguiente: no para de crecer, decenas de megabytes cada vez. ¡Una fuga
    de memoria! El código está en /opt/playlist. Si nada la detiene, el
    kernel tendrá que volver a matar a alguien…
memory-event-still =
    Ya está: sin memoria, el OOM killer ha vuelto a actuar (sudo dmesg).
    Reiniciar no basta, la fuga vuelve a empezar. Corregir el programa es
    trabajo del equipo de desarrollo; esta noche, hay que contenerla.
    systemd puede limitar la memoria de un servicio (MemoryMax=, ver man
    systemctl: edit, set-property) y reiniciarlo si muere (Restart=).
memory-event-too-down =
    Este límite es demasiado bajo: la lista necesita unos 200 MB solo para
    arrancar, la matarían casi en cuanto se lanzara. Dale lo suficiente
    para funcionar un rato (unos cientos de megabytes), sin poner en
    peligro la máquina.
memory-event-too-up =
    Este límite es mayor de lo que la máquina puede ofrecer sin sufrir
    (2 GB en total, 1 GB de los cuales se lo lleva todo lo demás): el
    kernel actuaría antes que systemd. Apunta más bien a unos cientos de
    megabytes.
memory-event-without-restart =
    systemd ha matado la lista cuando ha superado su límite, como estaba
    previsto: ni la máquina ni el repetidor lo han notado. Pero se ha
    quedado parada (systemctl status radio-playlist: Result: oom-kill).
    Para que systemd la reinicie sola, hay que añadir Restart=on-failure a
    la sección {"["}Service] del override (sudo systemctl edit radio-playlist).
memory-event-contained =
    La lista ha alcanzado su límite: systemd la ha matado, y la ha
    reiniciado enseguida (systemctl status radio-playlist). Solo ha sufrido
    la lista, no la máquina. El silencio solo ha durado un momento.
memory-event-without-zombies =
    Ya no hay zombis: con su padre reiniciado, init los ha recogido.
memory-event-end =
    La lista funciona, contenida por su límite y reiniciada si lo supera;
    los zombis han desaparecido. El directo vuelve a tener música. Zoé:
    «Abro una incidencia sobre la caché de la lista. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo 2 de De Guardia. (Lo siguiente:
    ssh radio.)

    QUÉ HA PASADO
    La lista guardaba en memoria cada pista decodificada, sin olvidar
    nunca nada: una fuga de memoria. A las 4:12 no quedaba ni un byte
    libre, y el kernel mató al proceso más grande (el OOM killer). Aquí
    era el culpable, pero podría haber sido la base de datos o el
    repetidor. Un límite por servicio (MemoryMax=) hace que solo el
    servicio defectuoso pague la fuga, y Restart=on-failure lo reinicia.
    Los zombis venían de otro programa, que nunca esperaba a sus hijos.

    BUENA PRÁCTICA
    - Un servicio muerto sin razón aparente: sudo dmesg o journalctl -k
      (Out of memory), systemctl status (Result: oom-kill).
    - free -h para el estado de la memoria, top -o %MEM para saber quién
      la ocupa, y seguirlo en el tiempo.
    - Un límite de memoria por servicio (MemoryMax=), con reinicio
      automático (Restart=on-failure), mientras se corrige la fuga.
    - Modifica un servicio con un override (systemctl edit), nunca tocando
      el archivo instalado en /usr/lib/systemd.
    - Un zombi no se puede matar: ocúpate de su padre (e informa del
      fallo).

    OTRA MANERA
    Corregir la fuga sigue siendo la verdadera solución: el límite solo la
    contiene. Otros ajustes de systemd: MemoryHigh= frena el servicio (el
    kernel le recupera memoria) antes de llegar a matarlo; OOMScoreAdjust=
    le dice al kernel a quién sacrificar primero; systemd-oomd detiene un
    servicio antes de que se ahogue toda la máquina.

    DOCUMENTACIÓN
    - MemoryMax=: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - Restart=: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
    - free: https://man7.org/linux/man-pages/man1/free.1.html
    - los zombis y wait: https://man7.org/linux/man-pages/man2/wait.2.html
