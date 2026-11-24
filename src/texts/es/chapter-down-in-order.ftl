### Historia «El Rocódromo», capítulo «Apagado en orden»: el NAS del mismo
### SAI pasa a ser el secundario de upsmon. upsd.conf (LISTEN, un
### reinicio), upsd.users (upsmon secondary), ufw, el upsmon.conf y el
### nut.conf del secundario, HOSTSYNC, offdelay y ondelay en ups.conf, un
### simulacro. Los comandos, las opciones, las rutas, las líneas de
### configuración y las salidas no se traducen.

chapter-down-in-order = Apagado en orden
    .summary = El NAS que guarda las fotos y los descargos firmados del rocódromo comparte ahora el SAI del servidor, pero nadie le dice cuándo pararse. Conviértelo en el secundario del SAI por la red, sin abrir el SAI a todo internet, y asegúrate de que se detenga antes de que el SAI corte la corriente.

## Archivos

down-in-order-message-akosua =
    De: Akosua (archivo de fotos y descargos, Overhang)
    Viernes 26 de noviembre, 21:45

    ¡Hola! Nkechi me ha contado el simulacro de la semana pasada: seguro
    se apaga ahora limpiamente. Genial.

    Desde la tormenta, harness (el NAS, 198.51.100.142) está enchufado al
    mismo SAI que seguro, en el armario de la oficina. Pero no sabe nada
    del SAI: el martes murió con la corriente, y sus discos se pasaron la
    noche comprobándose. Los descargos están en él, tenemos que
    guardarlos cinco años.

    Haruto dijo una vez que el NAS podía escuchar a seguro: seguro habla
    con el SAI por USB y podría pasar las noticias por la red. No sé cómo.
    harness tiene instalado nut-client, sin configurar nada. Puedes hacer
    ssh de seguro a harness con tu clave; sudo también funciona allí.

    Una cosa sí sé: harness tarda en pararse. Primero Samba, luego vacía
    la caché de sus discos. Cuenta dos minutos y medio.

    El rocódromo está cerrado: puedes volver a hacer un simulacro esta
    noche.

    Akosua

## Eventos

down-in-order-event-listen-restart =
    upsd.conf tiene su nueva línea LISTEN, pero upsd sigue escuchando
    donde escuchaba (ss -tlnp): upsd solo lee LISTEN al arrancar. Una
    recarga vuelve a leer upsd.users y ups.conf, no esto: reinicia
    nut-server.

down-in-order-event-listen =
    upsd escucha ahora también en la red de la oficina: harness puede
    llegar a él en el puerto 3493, si el cortafuegos de seguro lo deja
    pasar.

down-in-order-event-exposed =
    Cuidado: desde internet, el puerto 3493 de la dirección pública de
    seguro responde ahora. upsd le cuenta a cualquiera el estado del SAI,
    y con una contraseña adivinada alguien podría pedir un apagado
    forzado. Escucha solo en la dirección de la oficina, o deja pasar
    solo a harness por el cortafuegos.

down-in-order-event-secondary-user =
    harness tiene una cuenta en upsd.users. «upsmon secondary» le da lo
    que necesita un secundario: conectarse y seguir el SAI, nada más.

down-in-order-event-too-much =
    Un segundo «primary»: un primario puede poner FSD y apagar todas las
    máquinas del SAI. Solo seguro, que controla el SAI y lo corta el
    último, debe ser primario; harness sigue como secundario (en
    upsd.users y en la línea MONITOR de harness).

down-in-order-event-firewall =
    El cortafuegos de seguro deja entrar a harness por el 3493.

down-in-order-event-blocked =
    La conexión agota el tiempo de espera: el ufw de seguro descarta lo
    que no está permitido. Permite 3493/tcp desde harness (man ufw: allow
    from DIRECCIÓN to any port PUERTO).

down-in-order-event-secondary =
    El upsmon de harness está conectado a hallups en seguro como
    secundario (upsc -c hallups en seguro lista dos clientes). Cuando la
    batería se agote, seguro pondrá FSD, harness lo verá y se apagará,
    seguro esperará a que se desconecte (HOSTSYNC) antes de su propio
    apagado.

down-in-order-event-drill-crash =
    Durante el simulacro, harness perdió la corriente mientras todavía se
    estaba apagando (su diario: el arranque anterior termina en mitad de
    la parada; este empieza con una comprobación de disco). Se desconectó
    enseguida, así que seguro siguió; seguro se detuvo en medio minuto, y
    luego le dijo al SAI que cortara sus enchufes tras offdelay segundos:
    20 por defecto, mientras que harness necesita 150. Dale al SAI un
    plazo más largo antes de cortar (man usbhid-ups: offdelay, ondelay).

down-in-order-event-ondelay =
    En ups.conf, ondelay no es mayor que offdelay. usbhid-ups(8): ondelay
    «must be greater» que offdelay, o el SAI podría no devolver la
    corriente tras un corte.

down-in-order-event-not-enabled =
    Tras el simulacro, el upsmon de harness no volvió: nut-monitor está
    arrancado pero no habilitado en harness, así que un arranque no lo
    inicia. Hasta que alguien se dé cuenta, harness vuelve a estar
    desprotegido.

down-in-order-event-end =
    Akosua: «He mirado las luces del NAS durante el simulacro: se apagó un
    buen minuto antes de que el SAI hiciera clic, y los dos volvieron
    solos. Los descargos te dan las gracias».

    ¡Bien hecho! Has terminado el capítulo «Apagado en orden».

    QUÉ HA PASADO
    harness compartía el SAI de seguro sin saberlo. Hiciste que el upsd de
    seguro escuchara en la red de la oficina (LISTEN, que solo se lee al
    arrancar), diste a harness una cuenta de secundario y su propia línea
    MONITOR, abriste el 3493 solo a harness, y habilitaste su
    nut-monitor. El primer simulacro mostró la última trampa: seguro
    esperaba a que harness se desconectara, pero harness se desconecta
    cuando empieza a apagarse, y necesita dos minutos y medio; el SAI
    cortaba sus enchufes 20 segundos después de la parada de seguro. Un
    offdelay más largo (y un ondelay mayor todavía) da tiempo a cada
    máquina para pararse.

    BUENA PRÁCTICA
    - Un primario por SAI: la máquina conectada a él, que se detiene la
      última y le dice al SAI que corte. Las demás son secundarias por la
      red.
    - Abre upsd a las máquinas que lo necesitan, no al mundo: LISTEN en la
      dirección interna, y una regla de cortafuegos desde cada secundario.
    - Cronometra el apagado de la máquina más lenta y pon offdelay por
      encima, con margen; comprueba que la batería aguanta ese tiempo con
      batería baja (battery.runtime.low, battery.charge.low).
    - Habilita los servicios, y luego demuéstralo con un simulacro: lo que
      no arranca al inicio no protege nada tras el primer corte.

    OTRA FORMA DE HACERLO
    Un secundario puede apagarse antes de la batería baja, con upssched
    (un temporizador tras ONBATT): las máquinas lentas se van entonces
    primero, y la batería se guarda para las demás.

    DOCUMENTACIÓN
    - upsd.conf(5): https://networkupstools.org/docs/man/upsd.conf.html
    - upsd.users(5): https://networkupstools.org/docs/man/upsd.users.html
    - upsmon(8), la secuencia de apagado: https://networkupstools.org/docs/man/upsmon.html
    - usbhid-ups(8), offdelay y ondelay: https://networkupstools.org/docs/man/usbhid-ups.html
    - nut.conf(5): https://networkupstools.org/docs/man/nut.conf.html
