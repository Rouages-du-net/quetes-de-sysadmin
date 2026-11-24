### Historia «El Bastión», capítulo «La contención»: cortar el paso al
### minero y al intruso con iptables sin quedarse fuera, parar el minero y
### su vigilante, cerrar la cuenta deploy. Los comandos, las rutas y las
### direcciones no se traducen.

chapter-containment = La contención
    .summary = Cortar el paso al minero y al intruso sin quedarse fuera, parar lo que se ejecuta y cerrar la cuenta que usaron.

## Archivos

containment-email-nadia =
    De:      Nadia
    Para:    tú
    Asunto:  Re: Aviso de abuso

    Gracias por las notas. Mi primo dice que habría que desenchufar el
    servidor sin más. Pero los repartidores necesitan las rutas a las 11.
    ¿Podemos parar el daño sin parar los repartos?

    Nadia

containment-incident =
    # Incidente — horno (reparto)

    ## Qué se ejecuta
    /tmp/.cache/kworkerd (deploy), vigilado por /bin/sh /tmp/.cache/.w.

    ## Con quién habla
    198.51.100.66, puerto 3333 (el pool).

    ## Cómo entró
    deploy, por contraseña, desde 203.0.113.66, el 13/04 a las 02:40:57.

    ## Contención
    (por hacer: cortar el pool y la dirección del intruso, parar lo que se
    ejecuta, cerrar deploy — sin cortar tu propio ssh, y sin parar los
    repartos)

## Eventos

# { $pool }: the pool's address
containment-event-pool =
    El minero ya no puede alcanzar { $pool }: calcule lo que calcule, no
    puede entregarlo. El proveedor verá que la conexión se detiene.
# { $address }: the intruder's address
containment-event-attacker =
    { $address } ya no puede abrir una conexión con este servidor. No
    detendrá a alguien que cambie de dirección, pero cierra el camino que
    usó.
containment-event-locked-out =
    Cuidado: con estas reglas, tu próxima conexión ssh desde tu puesto sería
    rechazada. Tu sesión actual sigue abierta (el cortafuegos no corta una
    conexión establecida), pero si cierras la sesión ahora te quedas fuera.
    Acepta primero tu propio ssh (iptables -L --line-numbers para ver el
    orden).
# { $pid }: the new miner's PID
containment-event-respawn =
    kworkerd ha vuelto, con el PID { $pid }: el vigilante (/bin/sh
    /tmp/.cache/.w) lo vuelve a lanzar en cuanto falta. Para primero el
    vigilante, o congélalo (kill -STOP), y luego el minero.
containment-event-app-down =
    La aplicación de reparto se ha parado: también se ejecutaba como
    deploy, así que se ha ido con lo demás. Los repartidores la necesitan a
    las 11: vuelve a arrancarla (systemctl).
containment-event-relaunched =
    La aplicación ha vuelto a arrancar… y el vigilante y el minero también.
    Arrancar la aplicación los ha relanzado: algo en la propia aplicación lo
    hace. Anótalo en incident.md; vuelve a pararlos, y guárdalo para el
    paso siguiente.
containment-event-stopped =
    Ya no se ejecuta nada desde /tmp/.cache. Los archivos siguen ahí, y lo
    que los relanza también: será el trabajo del paso siguiente.
containment-event-password-only =
    usermod -L bloquea la contraseña de deploy, no la cuenta: sshd sigue
    aceptando una clave, y puede que el intruso haya dejado una. El manual
    de usermod dice qué añadir para bloquear la cuenta de verdad (la
    EXPIRE_DATE).
containment-event-closed =
    deploy ya no puede conectarse de ninguna manera, ni con clave ni con
    contraseña. Selma la necesitará el lunes; entonces se volverá a abrir
    como es debido.
containment-event-end =
    Nadia: «Las rutas están listas y el proveedor dice que la conexión se ha
    detenido. Gracias. Y no hemos tenido que desenchufar nada».

    ¡Bien hecho! Has terminado el capítulo «La contención».

    QUÉ HA PASADO
    Paraste el daño sin parar el negocio: el pool y la dirección del intruso
    están bloqueados, el minero y su vigilante están parados en el orden
    correcto, y deploy está cerrada de verdad, clave incluida. Y la
    aplicación de reparto sigue funcionando.

    BUENA PRÁCTICA
    - Primero contener, luego limpiar: el objetivo es parar el daño
      conservando las pruebas y el servicio.
    - Antes de una regla de cortafuegos, piensa en tu propio acceso: una
      sesión establecida sobrevive, la siguiente no.
    - Un proceso que vuelve tiene un padre que lo relanza: mira el árbol
      (ps -ef, la columna PPID) y para primero el padre.
    - usermod -L bloquea la contraseña, no la cuenta: con sshd y PAM, una
      clave todavía la abre. Haz caducar la cuenta (usermod -e 1) o dale
      nologin.

    OTRA MANERA
    En una máquina virtual, el proveedor puede tomar una instantánea de la
    memoria y del disco antes de que se toque nada: la prueba más fiel que
    existe. En un servidor físico, aislarlo en la red (un puerto del switch)
    hace el mismo trabajo que las reglas de cortafuegos, desde fuera de la
    máquina.

    DOCUMENTACIÓN
    - iptables: https://man7.org/linux/man-pages/man8/iptables.8.html
    - kill y las señales: https://man7.org/linux/man-pages/man7/signal.7.html
    - usermod (-L, -e): https://man7.org/linux/man-pages/man8/usermod.8.html
    - NIST SP 800-61r2, contención: https://csrc.nist.gov/pubs/sp/800/61/r2/final
