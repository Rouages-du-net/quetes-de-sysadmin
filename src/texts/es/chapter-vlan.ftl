### Historia «La Colmena», capítulo «Las VLAN»: un router Debian detrás de
### un switch dividido en VLAN. Los comandos, los nombres de interfaces y la
### sintaxis de /etc/network/interfaces no se traducen.

chapter-vlan = Las VLAN
    .summary = El switch se ha dividido en tres VLAN; el router sigue hablando en plano. Interfaces 802.1Q, y que sobrevivan a un reinicio.

## Archivos

vlan-email-malik =
    De:      Malik (responsable de instalaciones de La Colmena)
    Para:    tú
    Asunto:  Sin red desde esta mañana

    El electricista vino este fin de semana: «dividió la red en VLAN» en el
    switch, para que el wifi de invitados ya no vea nuestros ordenadores,
    la impresora ni las cámaras. Su plano está en plano-switch.txt.

    Desde entonces no funciona nada: ¡ni siquiera responde el NAS de las
    oficinas! Me dijo: «le toca al router seguir, hay que crear en él las
    interfaces VLAN». El router es esta máquina (eth0 hacia el router del
    operador, eth1 hacia el switch).

    El proveedor anterior configuró la red en /etc/network/interfaces (man
    interfaces). Y para ver lo que pasa ahora mismo: man ip.

    Para sudo: abeja-2027

vlan-plan-switch =
    PLANO DEL SWITCH — La Colmena (electricista, noviembre de 2027)

    Puerto 1     : hacia el router (eth1). TRUNK 802.1Q: VLAN 10, 20, 30
                   etiquetadas. Ya nada en la VLAN nativa.
    Puertos 2-12 : VLAN 10 «oficinas»    (sin etiqueta, oficinas)
    Puertos 13-16: VLAN 20 «invitados»   (puntos de acceso wifi del café)
    Puertos 17-20: VLAN 30 «equipos»     (impresora, cámaras)

    Direcciones (a configurar en el router):
      VLAN 10  oficinas     10.10.10.0/24   router: 10.10.10.1
      VLAN 20  invitados    10.10.20.0/24   router: 10.10.20.1
      VLAN 30  equipos      10.10.30.0/24   router: 10.10.30.1

    Aparatos con dirección fija:
      nas             10.10.10.5   (VLAN 10)
      impresora       10.10.30.10  (VLAN 30)
      camara-entrada  10.10.30.11  (VLAN 30)

## Eventos

vlan-event-bad-number =
    Una de tus interfaces VLAN tiene una dirección en una red… pero no el
    número de VLAN correcto: sus tramas salen etiquetadas con otro número,
    y el switch no las pone en la VLAN correcta. Un ping a un aparato de
    esa red lo muestra (Destination Host Unreachable). Compruébalo con
    ip -d link show.
vlan-event-in-place =
    Las tres VLAN responden: el NAS, la impresora y la cámara también
    (ping). Pero lo que has hecho con ip desaparecerá en el próximo
    reinicio: solo /etc/network/interfaces se vuelve a leer en el
    arranque. Escribe ahí las tres VLAN (man interfaces), y luego ifup.
vlan-event-end =
    Las tres VLAN están levantadas, y escritas para durar. Malik: «¡El NAS
    ha vuelto! Y el wifi del café ya no ve la impresora, eso es lo que
    quería el electricista».

    ¡Bien hecho! Has terminado el capítulo «Las VLAN».

    QUÉ HA PASADO
    Una VLAN divide un switch en varias redes separadas. En un puerto
    «trunk», varias VLAN comparten el mismo cable: cada trama lleva una
    etiqueta 802.1Q con su número. Así que el router necesita una
    interfaz por VLAN (eth1.10, eth1.20, eth1.30), con su dirección en
    cada red. Sin etiqueta, sus tramas caían en la VLAN nativa, donde ya
    no queda nadie.

    BUENA PRÁCTICA
    - Una VLAN por uso: oficinas, invitados, equipos (impresoras,
      cámaras, teléfonos), administración.
    - El plano escrito en algún sitio (números, redes, puertos), y al día.
    - ip para probar, /etc/network/interfaces (o systemd-networkd) para
      que dure; ip -d link show para comprobar el número.
    - La VLAN nativa de un trunk: vacía, o al menos no la de los equipos
      sensibles.

    OTRA MANERA
    systemd-networkd (archivos .netdev y .network) o NetworkManager
    (nmcli) describen las mismas VLAN de otra manera. Debian conserva
    ifupdown en los servidores; Ubuntu pasa por netplan, que escribe la
    configuración para systemd-networkd. El principio no cambia: una
    interfaz por VLAN, en la tarjeta conectada al trunk.

    DOCUMENTACIÓN
    - interfaces (Debian): https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - VLAN en interfaces: https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html
    - ip link: https://man7.org/linux/man-pages/man8/ip-link.8.html
