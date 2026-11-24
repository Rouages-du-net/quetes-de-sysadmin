### Historia «La Colmena», capítulo «El Anexo»: unir dos sedes con
### WireGuard. Los comandos, las palabras clave de wg-quick, las direcciones
### y las rutas nunca se traducen.

chapter-annex = El Anexo
    .summary = La Colmena abre una segunda sede: unir sus dos redes por la VPN, con AllowedIPs como tabla de rutas, y un camino que se mantiene abierto a través del router del operador del Anexo.

## Archivos

# { $key }: la clave pública WireGuard del router del Anexo
annex-email-sami =
    De:      Sami (voluntario del Anexo)
    Para:    tú
    Asunto:  Unir el Anexo a La Colmena

    ¡Hola! El Anexo abre el lunes. He montado nuestro router (también una
    Debian, detrás del router de nuestro operador); nuestra red es
    10.20.10.0/24.

    Lo que necesitamos:
    - que los ordenadores del Anexo puedan abrir las carpetas del NAS de
      La Colmena (10.10.10.5);
    - que Malik pueda imprimir en nuestra impresora (10.20.10.20) desde
      las oficinas;
    - y nada más: las cámaras de La Colmena no nos miran.

    Malik dice que la VPN del teletrabajo puede servir: nuestro router será
    un peer más en wg0. Ha tomado la dirección 10.10.99.3 en el túnel, y su
    clave pública es:

        { $key }

    He preparado annex-wg0.conf: completa la parte Peer (tu router) y yo
    lo copio aquí. Para la clave pública de tu router: sudo wg show.

    Para sudo: abeja-2027

annex-conf =
    # La configuración WireGuard del router del Anexo (Sami la copiará).
    # Su clave privada se queda en el Anexo.
    {"["}Interface]
    Address = 10.10.99.3/24
    ListenPort = 51820

    {"["}Peer]
    # El router de La Colmena:
    PublicKey =
    Endpoint =
    # Las direcciones de La Colmena que se envían por el túnel:
    AllowedIPs =

## Eventos

annex-event-not-reread =
    El archivo /etc/wireguard/wg0.conf tiene un peer para el Anexo… pero
    wg0 sigue funcionando con la configuración antigua (sudo wg show):
    wg-quick no vuelve a leer el archivo por sí solo. Hay que reiniciar la
    interfaz (el servicio wg-quick@wg0).
annex-event-handshake =
    Sami: «Nuestro router dice: Handshake did not complete». sudo wg show
    lo confirma: ningún «latest handshake» para el peer del Anexo. Cada
    lado debe tener la clave PÚBLICA del otro, y el Endpoint debe dar la
    dirección y el puerto de tu router.
annex-event-allowed =
    Sami: «El túnel está levantado, pero nuestros ordenadores no llegan al
    NAS». Los paquetes llegan… y el router los descarta: vienen de
    10.20.10.15, y para WireGuard, un peer solo puede enviar desde las
    direcciones de sus AllowedIPs. Para toda una sede, es toda su red.
annex-event-route =
    Sami: «Sigue sin ir nada hacia el NAS». Del lado del Anexo, los
    paquetes hacia 10.10.10.5 no entran en el túnel: en annex-wg0.conf,
    AllowedIPs dice lo que debe entrar (y wg-quick lo convierte en rutas).
annex-event-asleep =
    Sami: «¡El NAS funciona!» Malik: «Y yo puedo imprimir en el Anexo… a
    veces. Luego nada durante horas». El router del Anexo está detrás del
    router de su operador: mientras no envía nada, ese router olvida el
    camino, y La Colmena ya no puede llegar a él. WireGuard puede
    mantenerlo abierto enviando un pequeño paquete de vez en cuando (man
    wg: PersistentKeepalive).
annex-event-cameras =
    Cuidado: el Anexo puede llegar ahora a las cámaras de La Colmena. Sami
    solo pidió el NAS: el túnel no lo abre todo, el cortafuegos (la cadena
    forward) decide adónde lleva.
annex-event-malik =
    Cuidado: Malik ya no puede llegar al NAS desde casa. El peer de su
    portátil debe seguir en wg0.conf, con su propia dirección.
annex-event-in-place =
    Las dos sedes pueden hablar… ahora mismo. En el próximo reinicio, wg0
    vuelve a arrancar desde /etc/wireguard/wg0.conf por el servicio
    wg-quick@wg0: todo tiene que estar ahí.
annex-event-end =
    Los ordenadores del Anexo abren el NAS, Malik imprime en el Anexo, el
    túnel se mantiene abierto pese al router del operador, y no pasa nada
    más. Sami: «Es como si estuviéramos en el mismo edificio».

    ¡Bien hecho! Has terminado el capítulo «El Anexo».

    QUÉ HA PASADO
    Para WireGuard, AllowedIPs funciona en los dos sentidos: enumera las
    direcciones que se envían a este peer (wg-quick las convierte en
    rutas, visibles con ip route) y aquellas desde las que este peer
    puede enviar. Para unir dos sedes, cada lado pone ahí la red del otro.
    Y una sede detrás de un router con NAT debe mantener el camino
    abierto: PersistentKeepalive envía un paquete cada 25 segundos.

    BUENA PRÁCTICA
    - Redes que no se solapen (10.10.x para La Colmena, 10.20.x para el
      Anexo), elegidas antes de unir las sedes.
    - El túnel transporta, el cortafuegos decide: abre solo lo que se ha
      pedido.
    - Después de cambiar wg0.conf, reinicia la interfaz (o el servicio), y
      compruébalo con wg show e ip route.

    DOCUMENTACIÓN
    - El enrutamiento por claves: https://www.wireguard.com/#cryptokey-routing
    - wg (PersistentKeepalive): https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick (rutas): https://man7.org/linux/man-pages/man8/wg-quick.8.html

# El comentario encima del peer del Anexo en wg0.conf.
annex-peer-comment = Anexo
