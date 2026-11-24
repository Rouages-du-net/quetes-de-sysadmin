### Historia «El Comedor», capítulo 3 «El arranque lento»:
### network-online.target, systemd-networkd-wait-online, systemd-analyze. Los
### nombres de unidades, las rutas y los mensajes de systemd no se traducen.

chapter-slow-boot = El arranque lento
    .summary = Desde la segunda tarjeta de red, el servidor tarda dos minutos en volver tras un reinicio. Averiguar a quién está esperando.

## Archivos

slow-boot-message-ibrahim =
    De:      Ibrahim
    Para:    tú
    Asunto:  Dos minutos de 502

    Hola:

    Añadí una segunda tarjeta de red al servidor, eth1, para la línea de
    respaldo que nos va a dar el ayuntamiento (todavía no está cableada).
    Ya la configuré, /etc/systemd/network/20-eth1.network, para que esté
    lista el día que llegue.

    Desde entonces, cada reinicio tarda una eternidad: más de dos minutos
    antes de que vuelva el sitio, y mientras tanto el voluntariado recibe
    «502 Bad Gateway». Al final todo funciona, pero dos minutos a la hora de
    comer es mucho.

    ¿Puedes averiguar qué espera el servidor, y hacer que vuelva a arrancar
    rápido? La línea de respaldo llegará algún día: su configuración no se
    puede perder para siempre. Puedes reiniciar (sudo reboot), contraseña
    lentejas-2028.

    Ibrahim

## Eventos

slow-boot-event-blame =
    systemd-networkd-wait-online.service: más de dos minutos, casi todo el
    arranque. Su trabajo es esperar a que la red esté «online», para que se
    alcance network-online.target; nginx y la aplicación esperan ese target
    (systemd-analyze critical-chain). ¿A qué espera? networkctl lista los
    enlaces y su estado.
slow-boot-event-no-carrier =
    eth1: no-carrier. La tarjeta tiene una configuración (20-eth1.network),
    así que wait-online espera a que esté online… pero sin cable no hay red:
    al cabo de dos minutos se rinde, y el arranque sigue. Dile que no espere
    a este enlace (man systemd.network: RequiredForOnline=), o qué esperar
    (man systemd-networkd-wait-online: --any, --interface=).
slow-boot-event-menu-only =
    Sigue siendo lento: la aplicación ya no espera a la red, pero nginx sí
    (su unidad, After=network-online.target). Mientras wait-online espere a
    eth1, todo lo que necesita la red espera con él (systemd-analyze
    critical-chain).
slow-boot-event-disabled =
    Sin wait-online, network-online.target se alcanza enseguida: rápido, sí.
    En este servidor es aceptable (los servicios escuchan en local o en
    eth0, que se levanta en un segundo), pero el target ya no quiere decir
    «la red funciona». El arreglo más fino conserva wait-online y le dice
    qué esperar.
slow-boot-event-end =
    El servidor está en pie en unos segundos tras un reinicio, y el sitio
    responde enseguida. Ibrahim: «¿Y cuando se cablee la línea de respaldo,
    eth1 se levantará sola?». Sí: su configuración sigue ahí.

    ¡Bien hecho! Has terminado el capítulo «El arranque lento».

    QUÉ HA PASADO
    nginx (la unidad de Debian) y la aplicación esperan
    network-online.target. Ese target se alcanza cuando
    systemd-networkd-wait-online ha terminado, y wait-online espera a que
    cada enlace que tiene configuración (archivo .network) esté online. eth1
    tenía una, pero ningún cable: wait-online esperó dos minutos, se rindió,
    y solo entonces arrancaron nginx y la aplicación.

    LAS HERRAMIENTAS DE UN ARRANQUE LENTO
    - systemd-analyze time: lo que tardaron el núcleo y el espacio de
      usuario.
    - systemd-analyze blame: cada unidad, por el tiempo que tardó en
      arrancar.
    - systemd-analyze critical-chain: la cadena de unidades que retrasó el
      final del arranque (@ cuándo arrancó, + cuánto tardó).
    - systemctl list-dependencies --after nginx: lo que espera una unidad.
    - networkctl: los enlaces, y hasta dónde ha llegado cada uno.

    BUENA PRÁCTICA
    - Un enlace que puede faltar: RequiredForOnline=no en su
      archivo .network (sección [Link]); se levanta solo cuando se cablea.
    - O dile a wait-online lo que quiere decir «online» aquí: un drop-in con
      ExecStart= y luego ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --any
      (o --interface=eth0).
    - After=network-online.target solo donde hace falta (un servicio que se
      conecta a otra máquina al arrancar); un servicio que escucha no lo
      necesita.

    DOCUMENTACIÓN
    - Ejecutar servicios cuando la red está lista: https://systemd.io/NETWORK_ONLINE/
    - systemd-networkd-wait-online: https://www.freedesktop.org/software/systemd/man/latest/systemd-networkd-wait-online.service.html
    - RequiredForOnline=: https://www.freedesktop.org/software/systemd/man/latest/systemd.network.html#RequiredForOnline=
    - systemd-analyze: https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html
