### Historia «La Colmena», capítulo «Teletrabajo»: una VPN WireGuard en el
### router. Los comandos, las palabras clave de wg-quick, los nombres de
### interfaces y las rutas no se traducen.

chapter-remote-work = Teletrabajo
    .summary = Malik quiere abrir el NAS desde casa: no abriendo un puerto en internet, sino con una VPN WireGuard, claves bien guardadas y un cortafuegos que le deje entrar.

## Archivos

# { $key }: la clave pública WireGuard del portátil de Malik
remote-work-email-malik =
    De:      Malik
    Para:    tú
    Asunto:  El NAS desde casa

    La red funciona, ¡gracias! Una última petición: me gustaría abrir las
    carpetas del NAS desde casa, por la tarde. El sobrino de la tesorera
    propone «abrir el puerto 445 en el router». Tengo mis dudas.

    Prefiero lo que me aconsejaste: una VPN WireGuard en el router. He
    instalado la aplicación en mi portátil. Ha creado mis claves, y me da
    mi clave pública:

        { $key }

    En el túnel, mi portátil tendrá la dirección 10.10.99.2. La aplicación
    me pide la clave pública del router, su dirección (hive.example, o
    192.0.2.21) y su puerto: completa malik-laptop.conf, yo lo copiaré.

    WireGuard está instalado en el router (man wg, man wg-quick; las
    configuraciones van en /etc/wireguard). Y no olvides el cortafuegos de
    zonas: la cadena input está cerrada por defecto.

    Para sudo: abeja-2027

remote-work-laptop-malik =
    # La configuración WireGuard del portátil de Malik. Su clave privada se
    # queda en el portátil: la aplicación nunca la muestra.
    # Por completar: la sección Peer, es decir, el router.
    {"["}Interface]
    Address = 10.10.99.2/32

    {"["}Peer]
    # La clave pública del router:
    PublicKey =
    # La dirección y el puerto del router, vistos desde internet:
    Endpoint =
    # Las direcciones a las que llegar por el túnel:
    AllowedIPs =

## Eventos

# { $file }: el archivo que contiene la clave privada
remote-work-event-key-exposed =
    Cuidado: { $file } contiene la clave privada del router, y todas las
    cuentas de la máquina pueden leerla. Con esta clave, cualquiera podría
    hacerse pasar por el router. Una clave privada solo la puede leer su
    propietario (chmod 600, o umask 077 antes de crearla); una vez copiada
    en /etc/wireguard, reservado a root, las demás copias ya no tienen
    razón de existir.
remote-work-event-filter =
    Malik: «Mi aplicación dice: Handshake did not complete after 5
    seconds». Sus paquetes sí llegan al router… y la cadena input los
    descarta: está cerrada por defecto (policy drop), y nada en ella deja
    pasar el puerto en el que escucha WireGuard (en UDP).
remote-work-event-handshake =
    Malik: «Sigue sin ir: Handshake did not complete». sudo wg show lo
    confirma: ningún «latest handshake» para su peer. Para reconocerse,
    cada lado necesita la clave PÚBLICA del otro: la de Malik en el Peer
    de wg0.conf, la del router en malik-laptop.conf. Y el Endpoint debe
    dar la dirección del router y el puerto en el que escucha
    (ListenPort).
remote-work-event-without-nas =
    Malik: «¡Conectado! … pero el NAS no responde». El handshake se ha
    hecho (sudo wg show: latest handshake). Queda el camino de los
    paquetes: la dirección del portátil debe estar en los AllowedIPs de
    su peer, del lado del router; el NAS en los AllowedIPs, del lado del
    portátil; y la cadena forward debe dejar pasar wg0 hacia las oficinas.
remote-work-event-in-place =
    Malik abre sus carpetas desde casa… ahora mismo. En el próximo
    reinicio, wg0 solo volverá si el servicio wg-quick@wg0 está
    habilitado, y el cortafuegos solo si sus reglas están en
    /etc/nftables.conf. (Una interfaz levantada a mano con wg-quick up
    impide arrancar al servicio: primero wg-quick down.)
remote-work-event-end =
    Malik abre las carpetas del NAS desde casa, por un túnel cifrado, sin
    que nada del NAS sea visible desde internet. Y todo volverá en el
    próximo reinicio. Malik: «El sobrino de la tesorera se ha quedado un
    poco chafado».

    ¡Bien hecho! Has terminado el capítulo «Teletrabajo».

    QUÉ HA PASADO
    WireGuard une dos máquinas con claves, como ssh: cada una tiene una
    clave privada, que nunca sale de ella, y da su clave pública a la
    otra. El portátil envía sus paquetes cifrados por UDP al router
    (Endpoint); el router los acepta si vienen de una clave que conoce
    (Peer), y solo para las direcciones que ese peer puede usar
    (AllowedIPs). AllowedIPs funciona en los dos sentidos: del lado del
    portátil, enumera las redes que se envían por el túnel.

    BUENA PRÁCTICA
    - Nunca abras un recurso compartido de archivos (445) en internet: una
      VPN, y un solo puerto UDP abierto.
    - Una clave privada solo la puede leer su propietario: umask 077 antes
      de wg genkey, /etc/wireguard reservado a root.
    - Una dirección por peer, en /32, en AllowedIPs; y el cortafuegos
      decide adónde lleva el túnel (aquí, solo a las oficinas).
    - systemctl enable wg-quick@wg0, para que el túnel vuelva en el
      arranque.

    OTRA MANERA
    OpenVPN: más antiguo y muy extendido, basado en TLS y certificados,
    capaz de pasar por TCP 443; más pesado de configurar. Un túnel SSH
    (ssh -L, El Centro Cívico) basta para un servicio ocasional, no para
    toda una red. Tailscale, o Headscale que alojas tú, montan una malla
    WireGuard y reparten las claves.

    DOCUMENTACIÓN
    - Inicio rápido: https://www.wireguard.com/quickstart/
    - wg: https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick: https://man7.org/linux/man-pages/man8/wg-quick.8.html
    - WireGuard en Debian: https://wiki.debian.org/WireGuard
