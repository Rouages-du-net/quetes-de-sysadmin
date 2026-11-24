### Historia «La Donación de Sangre», capítulo «Cerebro dividido»: los dos
### balanceadores de carga tienen la dirección virtual tras un cambio de red
### (un cortafuegos que descarta VRRP en lb2, routers nuevos que usan el
### mismo virtual_router_id). ip a, journalctl, tcpdump, nft,
### virtual_router_id, unicast_peer. Los comandos, las opciones, las rutas
### y las salidas no se traducen.

chapter-split-brain = Cerebro dividido
    .summary = Tras una noche de trabajos de red, la mitad de las conexiones de los donantes se cortan. Los dos balanceadores de carga creen que mandan ellos: averigua por qué ya no se oyen, y devuélveles una sola voz.

## Archivos

split-brain-message-kirsi =
    De: Kirsi (equipo de red)
    Miércoles 5 de junio, 9:20

    Hola:

    Anoche (martes, desde las 21:30) instalamos los nuevos routers de
    borde: una pareja, edge-a (192.0.2.252) y edge-b (192.0.2.253), que
    comparten la puerta de enlace 192.0.2.254 con VRRP, para que la
    puerta de enlace sobreviva al fallo de un router. Ya puestos,
    aplicamos nuestra configuración básica de bastionado (v3, nftables) a
    lb2; lb1 la recibe la semana que viene.

    Esta mañana el registro de los routers de borde está lleno de líneas
    como estas:
      arp: 192.0.2.108 moved from 52:54:00:6c:01:04 to 52:54:00:6c:01:05 on vlan20
      arp: 192.0.2.108 moved from 52:54:00:6c:01:05 to 52:54:00:6c:01:04 on vlan20
      vrrp: VRID 51: advert from 192.0.2.104 with a different address list, ignored

    Dos máquinas responden por 192.0.2.108. Seguro que no son los
    routers ;)

    Kirsi

split-brain-message-zainab =
    De: Zainab (atención a donantes)

    Los donantes escriben que el sitio «falla una vez de cada dos»: la
    página carga, el clic siguiente falla, y luego vuelve a funcionar.
    ¿Puedes echarle un vistazo?

    Zainab

## Eventos

split-brain-event-two-masters =
    lb2 también tiene 192.0.2.108: dos maestros. La puerta de enlace
    aprende la MAC de la dirección de quien respondió el último, y cada
    cambio corta las conexiones que estaban en el otro. Cerebro dividido:
    cada nodo cree que el otro ha desaparecido. Pregunta a keepalived en
    cada uno por qué (journalctl -u keepalived).
split-brain-event-lower-priority =
    lb1 oye los anuncios de lb2 (prioridad 100, más baja que su propio
    101) y se lo dice cada segundo («forcing new election»). Pero lb2 se
    comporta como si no oyera nada. ¿Recibe lb2 los anuncios de lb1?
    tcpdump en lb2 muestra lo que llega a su tarjeta de red (VRRP es el
    protocolo IP 112).
split-brain-event-on-the-wire =
    Los anuncios de lb1 llegan a la tarjeta de red de lb2: tcpdump los ve.
    Pero tcpdump mira los paquetes antes que el cortafuegos, y keepalived
    después. Algo en lb2 los descarta a la entrada: mira su cortafuegos
    (nft list ruleset).
split-brain-event-ruleset =
    La cadena input de la configuración básica descarta todo lo que no
    permite (policy drop), y nada permite VRRP: protocolo 112, enviado a
    224.0.0.18. lb2 nunca oye a lb1, así que se quedó con la dirección.
    Deja entrar VRRP (man nft: ip protocol, ip daddr), ahora y en
    /etc/nftables.conf.
split-brain-event-stopped =
    Con keepalived parado en un nodo, solo hay un maestro, pero tampoco
    hay reserva: el próximo fallo tirará el sitio. El nodo tiene que
    seguir en el grupo, y oír al otro.
split-brain-event-priorities =
    Las prioridades solo cuentan entre nodos que se oyen: mientras el
    cortafuegos de lb2 descarte los anuncios de lb1, cada nodo está solo
    en su elección, y cada uno la gana.
split-brain-event-single-master =
    Vuelve a haber un solo maestro: lb2 oye a lb1, ve una prioridad más
    alta, y ha vuelto a BACKUP (ha quitado la dirección). Las conexiones
    de los donantes dejan de cortarse.
split-brain-event-persisted =
    Y el /etc/nftables.conf de lb2 también deja entrar VRRP: el próximo
    reinicio de la máquina o de nftables no traerá de vuelta el cerebro
    dividido. Díselo a Kirsi, para que la configuración básica v4 lo
    incluya para lb1.
split-brain-event-clash =
    Otro grupo VRRP comparte el enlace: edge-a anuncia el VRID 51 (prio
    120, dirección 192.0.2.254), el mismo virtual_router_id que tu pareja.
    keepalived descarta sus anuncios como «bogus» (otra lista de
    direcciones), y los routers registran los tuyos. El mismo VRID en un
    enlace para dos grupos es buscarse problemas: uno de los dos tiene que
    cambiar, y el VRID de los routers es cosa del equipo de red.
split-brain-event-vrid-half =
    lb1 y lb2 ya no tienen el mismo virtual_router_id: ahora están en dos
    grupos VRRP distintos, y cada uno es maestro del suyo. Los dos nodos
    tienen que usar el mismo VRID.
split-brain-event-vrid =
    Tu pareja ya no se cruza con el grupo de los routers: su propio
    virtual_router_id en los dos nodos (o anuncios unicast entre los dos).
split-brain-event-end =
    Kirsi: «El registro de los routers está tranquilo, y la configuración
    básica v4 permitirá VRRP en los dos balanceadores. ¡Perdón por lb2!»
    Zainab: «Los donantes han dejado de escribir. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «Cerebro dividido».

    QUÉ HA PASADO
    El martes por la noche, la configuración básica de bastionado dio a
    lb2 una cadena input que descartaba todo lo que no permitía, VRRP
    incluido. lb2 dejó de oír a lb1 y también se quedó con la dirección:
    dos maestros, una puerta de enlace cuya entrada ARP oscilaba entre
    ellos, una de cada dos conexiones de los donantes cortada. La misma
    noche, los nuevos routers de borde crearon un grupo VRRP con el mismo
    VRID, 51. Encontraste los dos maestros (ip a), viste que los anuncios
    de lb1 llegaban a la tarjeta de lb2 (tcpdump) pero no a su keepalived
    (nft), dejaste entrar VRRP de forma permanente, y sacaste a tu pareja
    del VRID 51.

    BUENA PRÁCTICA
    - Dos maestros significa que los nodos no se oyen: mira el camino de
      los anuncios (tcpdump del lado que recibe, luego su cortafuegos), no
      las prioridades.
    - Un cortafuegos en un nodo VRRP tiene que dejar entrar el protocolo
      112 (desde el compañero, hacia 224.0.0.18 o la dirección del
      compañero con unicast_peer). Hazlo persistente.
    - Un VRID por grupo en un enlace. Acuerda los números con el equipo de
      red, o usa unicast_peer.
    - Vigila «los dos maestros» (la dirección en los dos nodos) como una
      alerta propia: un cerebro dividido no para un sitio, lo vuelve poco
      fiable.

    DOCUMENTACIÓN
    - keepalived.conf(5): https://www.keepalived.org/manpage.html
    - nft(8): https://www.netfilter.org/projects/nftables/manpage.html
    - tcpdump(1): https://www.tcpdump.org/manpages/tcpdump.1.html
    - VRRP (RFC 3768): https://www.rfc-editor.org/rfc/rfc3768
