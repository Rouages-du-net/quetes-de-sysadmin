### Historia «La Colmena», capítulo «DHCP»: dnsmasq reparte direcciones en
### cada VLAN. Las opciones de dnsmasq, los comandos y las rutas no se
### traducen.

chapter-dhcp = DHCP
    .summary = Las VLAN están, pero nadie tiene dirección: un rango DHCP por VLAN con dnsmasq, una reserva para la impresora, y ni una palabra hacia el router del operador.

## Archivos

dhcp-email-malik =
    De:      Malik
    Para:    tú
    Asunto:  Las VLAN están genial, pero…

    El NAS y la cámara responden, ¡gracias! Pero los ordenadores de las
    oficinas y el wifi del café siguen sin dirección. Se la piden al router
    por DHCP: de eso se encarga dnsmasq (/etc/dnsmasq.d, man dnsmasq).
    Sigue sirviendo la antigua red plana.

    Otra cosa: ha llegado la impresora nueva. Solo puede obtener su
    dirección por DHCP, pero todos los ordenadores la esperan en
    10.10.30.10. Su dirección MAC está en la etiqueta: 00:00:5e:00:53:30.

    Y el electricista me hizo prometer que te lo diría: «sobre todo, el
    DHCP NUNCA debe responder del lado del router del operador». No lo
    entendí muy bien.

    El diario (journalctl -u dnsmasq) y el archivo de concesiones
    (/var/lib/misc/dnsmasq.leases) dicen quién ha recibido qué.

    Para sudo: abeja-2027

## Eventos

dhcp-event-wan =
    Cuidado: dnsmasq escucha en todas las interfaces, incluida eth0, la red
    del proveedor de internet. Un servidor DHCP que responde en casa de los
    vecinos (un «servidor DHCP pirata») es el tipo de avería que deja sin
    conexión a todo un barrio. Dile a dnsmasq dónde puede escuchar
    (interface=, o except-interface=eth0).
# { $address }: la dirección esperada de la impresora
dhcp-event-printer-elsewhere =
    La impresora ha recibido una dirección… pero no { $address }, y los
    ordenadores no la encuentran. dnsmasq puede reservar una dirección
    para un aparato, según su dirección MAC (man dnsmasq: dhcp-host).
dhcp-event-end =
    Cada aparato tiene su dirección en su VLAN, la impresora está en su
    sitio, y el router del operador no oye nada. Malik: «El café tiene
    wifi, las oficinas tienen internet… bueno, casi: al parecer todavía no
    sale nada».

    ¡Bien hecho! Has terminado el capítulo «DHCP».

    QUÉ HA PASADO
    Un aparato que llega a una red grita «¿alguien puede darme una
    dirección?» (DHCPDISCOVER). El servidor DHCP de la red responde
    (OFFER), el aparato acepta (REQUEST), el servidor confirma (ACK) y
    registra la concesión. dnsmasq elige el rango según la interfaz por
    la que llega la petición: un rango por VLAN, en la red de cada
    interfaz.

    BUENA PRÁCTICA
    - Un rango por red, y reservas (MAC → dirección) para lo que hay que
      encontrar: impresoras, servidores, cámaras.
    - Limita las interfaces donde escucha el DHCP: nunca del lado de
      internet.
    - dnsmasq --test antes de reiniciar; el diario y el archivo de
      concesiones para comprobar.

    OTRA MANERA
    Kea, el servidor DHCP de ISC, que sustituye a isc-dhcp-server (fin de
    vida desde finales de 2022): bases de datos, alta disponibilidad, API,
    pero más pesado de instalar. dnsmasq hace DHCP y caché DNS en un solo
    programa pequeño: ideal para una red pequeña.

    DOCUMENTACIÓN
    - dnsmasq: https://dnsmasq.org/docs/dnsmasq-man.html
