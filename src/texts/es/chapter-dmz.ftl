### Historia «La Colmena», capítulo «La DMZ»: un servidor público en una
### VLAN aparte, la traducción de destino (dnat) y el cortafuegos. Los
### comandos, las palabras clave de nft, los nombres de interfaces y las
### rutas no se traducen.

chapter-dmz = La DMZ
    .summary = El sitio de reservas de salas ahora se aloja aquí: una VLAN aparte (la DMZ), una traducción de destino para que se pueda llegar a él desde internet, y un servidor que no ve nada del resto.

## Archivos

dmz-email-ines =
    De:      Inès (voluntaria, el sitio web de La Colmena)
    Para:    tú
    Asunto:  ¡El sitio de reservas, en casa!

    ¡Hola! Malik me ha dicho que tú te ocupas del router. Ya no pagamos al
    alojamiento: el sitio de reservas de salas funciona ahora en un pequeño
    servidor de aquí, «web» (10.10.40.10, pasarela 10.10.40.1). Responde
    por HTTP y HTTPS (puertos 80 y 443).

    El electricista lo ha conectado al puerto 21 del switch, en una nueva
    VLAN 40: la «DMZ», dijo. Su plano está en plano-switch.txt.

    Para que la gente lo encuentre, lo que llegue a la dirección pública
    del router (192.0.2.21), puertos 80 y 443, debería ir al servidor. Y
    tiene que poder traer sus actualizaciones de internet.

    Malik añade: «Un servidor abierto a internet es al que atacan. Si cae,
    no debe ver nada más de lo nuestro: ni el NAS, ni la impresora». Las
    oficinas, en cambio, tienen que poder conectarse a él por ssh para
    administrarlo.

    Para ver pasar las visitas: sudo conntrack -L. Lo demás: man nft
    (dnat), man interfaces.

    Para sudo: abeja-2027

dmz-plan-switch =
    PLANO DEL SWITCH — La Colmena (electricista, actualizado en enero de 2028)

    Puerto 1     : hacia el router (eth1). TRUNK 802.1Q: VLAN 10, 20, 30, 40
                   etiquetadas.
    Puertos 2-12 : VLAN 10 «oficinas»
    Puertos 13-16: VLAN 20 «invitados»
    Puertos 17-20: VLAN 30 «equipos»
    Puerto 21    : VLAN 40 «dmz» (el servidor web)

    Direcciones:
      VLAN 40  dmz          10.10.40.0/24   router  : 10.10.40.1
                                            web     : 10.10.40.10 (fija)

## Eventos

# { $address }: la dirección pública del router
dmz-event-address-public =
    Una regla de la cadena forward espera la dirección { $address }… pero
    nunca la verá: la traducción de destino (dnat) se hace antes, en el
    hook prerouting. Cuando el paquete llega a forward, ya va hacia
    10.10.40.10. Esa es la dirección que forward debe dejar pasar.
dmz-event-without-forward =
    Inès: «El sitio sigue sin responder desde casa». El router sí traduce
    el destino (sudo nft list ruleset), pero el paquete traducido pasa
    luego por la cadena forward, cerrada por defecto: nada en ella deja
    pasar internet hacia la DMZ.
dmz-event-too-open =
    Cuidado: con estas reglas, la DMZ está demasiado abierta. O bien
    internet llega al servidor por otros puertos además del 80 y el 443
    (ssh, por ejemplo), o bien el servidor puede abrir conexiones hacia la
    red interna. Una DMZ solo deja entrar lo que publica, y no deja salir
    nada hacia el interior.
dmz-event-in-place =
    El sitio responde, y la DMZ aguanta… por ahora. Pero ¿después del
    próximo reinicio? La interfaz eth1.40 debe estar en
    /etc/network/interfaces, y las reglas en /etc/nftables.conf.
dmz-event-end =
    El sitio de reservas responde desde internet, el servidor recibe sus
    actualizaciones, las oficinas lo administran, y si algún día lo
    atacan, no verá ni el NAS ni la impresora. Inès: «¡Y el alojamiento ya
    no nos cuesta nada!»

    ¡Bien hecho! Has terminado el capítulo «La DMZ».

    QUÉ HA PASADO
    El router solo tiene una dirección pública. La traducción de destino
    (dnat, en una cadena nat en el hook prerouting) cambia el destino de
    los paquetes que llegan a ciertos puertos: se envían al servidor, y el
    seguimiento de conexiones devuelve las respuestas con la dirección
    del router. Como este cambio ocurre ANTES del enrutamiento, la cadena
    forward ya ve el nuevo destino. La DMZ (zona desmilitarizada) es una
    red aparte para lo que se ve desde internet.

    BUENA PRÁCTICA
    - Publica solo los puertos que necesitas (80, 443), nunca «todo» hacia
      un servidor.
    - La DMZ no puede abrir nada hacia la red interna; es el interior el
      que va hacia ella (administración desde las oficinas).
    - En forward, escribe el destino DESPUÉS de la traducción (la
      dirección del servidor), y prueba con sudo conntrack -L.

    DOCUMENTACIÓN
    - NAT con nftables: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - El camino de los paquetes (hooks): https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks
