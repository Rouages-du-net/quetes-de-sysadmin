### Historia «La Colmena», capítulo «Las zonas»: enrutamiento, NAT y un
### cortafuegos entre las VLAN, con sysctl y nftables. Los comandos, las
### palabras clave de nft, los nombres de interfaces y las rutas no se
### traducen.

chapter-zones = Las zonas
    .summary = No sale nada a internet, y todo el mundo lo ve todo: enrutamiento, traducción de direcciones (NAT) y un cortafuegos entre las VLAN, con nftables, y que todo sobreviva a un reinicio.

## Archivos

zones-email-malik =
    De:      Malik
    Para:    tú
    Asunto:  Internet no sale

    Todo el mundo tiene su dirección, ¡gracias! Pero no sale nada a
    internet: ni las oficinas, ni el wifi del café. Sacha, el voluntario
    que se ocupaba de la red antes que tú, dice que lo había «montado todo
    a mano»; sus notas están en notas-de-sacha.txt. El router se reinició
    el sábado, durante el corte de luz.

    Y ya puestos, lo que de verdad queríamos con las VLAN:

    - las oficinas (VLAN 10): internet, y la impresora;
    - el wifi de invitados (VLAN 20): internet, y NADA más. El NAS
      contiene los expedientes de las personas beneficiarias de la tienda
      solidaria, y están las cámaras;
    - los equipos (VLAN 30): nada de internet. Las cámaras intentan
      enviar sus imágenes a su fabricante, y no queremos. El NAS, en
      cambio, tiene que seguir grabando las cámaras.

    Trabajas desde el puesto de administración (192.0.2.2), por ssh: ¡no
    te dejes fuera!

    Para ver quién habla con quién a través del router: sudo conntrack -L.
    Lo demás: man nft, man sysctl.

    Para sudo: abeja-2027

zones-notes-sacha =
    NOTAS DE SACHA (la red de La Colmena)

    Para que la red salga a internet, después de un reinicio del router
    (algún día lo pondré en un archivo):

      sudo sysctl -w net.ipv4.ip_forward=1
      sudo nft add table ip nat
      sudo nft 'add chain ip nat postrouting {"{"} type nat hook postrouting priority srcnat; {"}"}'
      sudo nft add rule ip nat postrouting oifname "eth0" masquerade

    Sin filtrado: todo el mundo lo ve todo, pero bueno, estamos entre
    amigos.

## Eventos

zones-event-without-translation =
    El router ya reenvía los paquetes… y salen por eth0 con su dirección
    privada (10.10.x.x). En internet, nadie sabe adónde responder a una
    dirección privada: están reservadas a las redes locales (RFC 1918), y
    el router del operador las descarta. El router tiene que hacerlas
    salir con su propia dirección (traducción de direcciones, o NAT: man
    nft, masquerade). sudo conntrack -L muestra los intercambios que se
    han quedado sin respuesta ([UNREPLIED]).
zones-event-responses =
    Las preguntas pasan, pero no las respuestas: con una política drop, la
    respuesta de un servidor es un paquete como cualquier otro, que entra
    por una interfaz donde nada lo permite. El cortafuegos sigue los
    intercambios (ct state): puede reconocer una respuesta a un
    intercambio ya permitido (established) y dejarla volver.
zones-event-all-open =
    Internet funciona en todas partes… también donde no debería: el móvil
    de un visitante llega al NAS o a una cámara, o la cámara sale a
    internet. Por defecto, la cadena forward lo deja pasar todo. El buen
    método: cerrarlo todo (policy drop), y luego abrir solo lo que se
    quiere, zona a zona.
zones-event-ssh =
    Cuidado: con estas reglas, una conexión ssh nueva desde el puesto de
    administración (192.0.2.2) sería rechazada por la cadena input. Tu
    sesión actual pende de un hilo: si se corta, ya nadie entra en el
    router (salvo conectándole una pantalla). Deja pasar ssh antes de
    cerrar lo demás.
zones-event-in-place =
    Todo funciona como quería Malik… por ahora. Pero ¿y si el router se
    reinicia, como el sábado? sysctl -w y nft en la línea de comandos no
    duran. Los ajustes del kernel se escriben en /etc/sysctl.d (man
    sysctl.d), las reglas en /etc/nftables.conf, que el servicio nftables
    carga en el arranque… si está habilitado.
zones-event-end =
    Las oficinas salen a internet y pueden imprimir, el café tiene wifi y
    solo ve eso, las cámaras se quedan en casa, y todo aguantará en el
    próximo reinicio. Malik: «Sacha dice que es la primera vez que el
    cortafuegos está escrito en algún sitio».

    ¡Bien hecho! Has terminado el capítulo «Las zonas».

    QUÉ HA PASADO
    Un router Linux solo reenvía paquetes de una red a otra si tiene
    permiso (net.ipv4.ip_forward = 1). Las direcciones de las VLAN son
    privadas: para salir a internet, el router sustituye la dirección de
    origen por la suya (masquerade) y registra el intercambio para
    devolver la respuesta al aparato correcto (seguimiento de conexiones,
    conntrack). La cadena forward decide lo que pasa: ahí se cierra todo
    (policy drop), se dejan volver las respuestas (ct state
    established,related), y luego se abre zona a zona (iifname, oifname).

    BUENA PRÁCTICA
    - Cerrar por defecto, abrir lo que se quiere; dejar pasar las
      respuestas una sola vez, al principio de la cadena.
    - Nunca dejarse fuera: abre ssh (cadena input) antes de cerrar lo
      demás, y prueba con nft -c antes de cargar.
    - Lo que debe durar va en archivos: /etc/sysctl.d,
      /etc/nftables.conf, y systemctl enable nftables.
    - Un ejemplo de cadena forward, para esta red:

        chain forward {"{"}
            type filter hook forward priority filter; policy drop;
            ct state established,related accept
            iifname "eth1.10" accept
            iifname "eth1.20" oifname "eth0" accept
        {"}"}

    DOCUMENTACIÓN
    - nft: https://www.netfilter.org/projects/nftables/manpage.html
    - NAT con nftables: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - Un router doméstico: https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_home_router
    - sysctl.d: https://man7.org/linux/man-pages/man5/sysctl.d.5.html
