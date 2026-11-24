### Historia «El Paquete Perdido»: «internet ya no funciona» en el café
### asociativo. Diagnosticar una avería de red paso a paso con ping, dig,
### traceroute y curl. Los comandos, los nombres de dominio y las
### direcciones IP no se traducen; la salida de las herramientas de red
### sigue en inglés, como en un sistema real.

chapter-lost-packet = El Paquete Perdido
    .summary = Encontrar dónde se pierde un mensaje, capa a capa: ping, dig, traceroute, curl.

## Archivos

lost-packet-note-kofi =
    Una nota de Kofi, voluntario de El Hormiguero, el café asociativo:

    «¡Socorro! Internet ya no funciona en el ordenador del café. El sitio
    de Las Cartas del Barrio (letters.example) no se abre, y es ahí donde
    publicamos la programación de la semana.

    Ya he reiniciado el router. Nada. ¿Puedes echar un vistazo? La
    contraseña de este ordenador, por si la necesitas: hormiguero

    Hay un cuaderno al lado de la pantalla:  cat cuaderno.txt  »
lost-packet-notebook =
    CUADERNO DE DIAGNÓSTICO — encontrar dónde se pierde el paquete

    Prueba paso a paso, de lo más cercano a lo más lejano:

      1. ¿Responde mi router?           ping 192.168.1.1
      2. ¿Responde internet?            ping 9.9.9.9   (un servidor DNS público)
      3. ¿Funcionan los nombres?        ping letters.example
                                        dig letters.example
      4. ¿Por dónde van los paquetes?   traceroute letters.example
      5. ¿Responde el sitio?            curl -I https://letters.example

    El DNS traduce un nombre (letters.example) en una dirección IP
    (números). El ordenador sabe a qué servidor DNS preguntar gracias al
    archivo /etc/resolv.conf (la línea «nameserver»).

    Los comandos de red responden en inglés, como en un sistema real:
    «packet loss» = paquetes perdidos, «timed out» = sin respuesta a tiempo.
# Comentarios de los archivos /etc/resolv.conf y /etc/resolv.conf.box (después de «#»)
lost-packet-resolv-comment = Escrito en la instalación, con el router antiguo
lost-packet-resolv-box-comment = Ajuste recomendado por el router nuevo

## La página del sitio, devuelta por curl (HTML)

lost-packet-site-title = Las Cartas del Barrio
lost-packet-site-text = ¡El sitio funciona! Escríbenos.

## Eventos ({ $ip }: la dirección IP del sitio)

lost-packet-event-box =
    El router responde, en apenas un milisegundo: la red local (el cable o
    el wifi hasta el router) funciona. ping envía un pequeño mensaje ICMP
    «echo»; la máquina devuelve la pelota, y se mide el viaje de ida y
    vuelta.

    Ahora más lejos: un servidor en internet,  ping 9.9.9.9
lost-packet-event-internet =
    9.9.9.9 responde: los paquetes sí salen a internet y vuelven.
    ¡Así que «internet» funciona! El problema está en otra parte. Prueba
    el nombre del sitio: ping letters.example
lost-packet-event-name =
    «Temporary failure in name resolution»: el ordenador no consigue
    traducir el nombre en una dirección IP. Ese es el trabajo del DNS.
    Hazle la pregunta directamente: dig letters.example
lost-packet-event-dns-silent =
    El servidor DNS 192.168.1.250 no responde: «timed out». ¿De dónde sale
    esta dirección? Mira cat /etc/resolv.conf

    Y para comprobar que el nombre existe de verdad, pregunta a otro
    servidor DNS: dig @9.9.9.9 letters.example
lost-packet-event-dns-other =
    Con otro servidor DNS, la respuesta llega: letters.example = { $ip }.
    El nombre existe; lo que está mal es el ajuste del ordenador: pregunta
    a 192.168.1.250, la dirección del router ANTIGUO, que ya no existe.

    El ajuste correcto está en /etc/resolv.conf.box. Este archivo pertenece
    a root: sudo cp /etc/resolv.conf.box /etc/resolv.conf
lost-packet-event-dns-repaired = El DNS está arreglado: el ordenador pregunta ahora al router nuevo. Vuelve a probar:  ping letters.example
lost-packet-event-ping-lost =
    El nombre se traduce ({ $ip })… ¡pero se pierde el 100 % de los
    paquetes! ¿Está caído el sitio? ¿O se pierden los paquetes por el
    camino? Sigue su rastro:  traceroute letters.example
lost-packet-event-route =
    Este es el viaje del paquete, salto a salto:
     1. tu router;
     2-3. los routers de tu proveedor (el ISP);
     4. un punto de intercambio, donde las redes se conectan entre sí;
     5. el router del proveedor de alojamiento del sitio.
    Luego, nada más: «* * *». Los paquetes llegan hasta la puerta del
    alojamiento. Muchos servidores ignoran a propósito ping y traceroute
    (su cortafuegos los filtra): este silencio no demuestra una avería.

    La única prueba real es pedir la página:  curl -I https://letters.example
lost-packet-event-curl =
    HTTP/2 200: ¡el sitio responde perfectamente! Kofi puede publicar la
    programación.

    Resumen de la investigación: la red local funcionaba (ping al router),
    e internet también (ping 9.9.9.9). La avería estaba en el DNS: el
    ordenador preguntaba a un router antiguo que ya no estaba. Una vez
    arreglado el DNS, el ping al sitio fallaba… pero solo porque su
    cortafuegos ignora el ping. curl lo demostró.

    FIN DE LA HISTORIA «EL PAQUETE PERDIDO».

    El método que hay que recordar: probar paso a paso, sin sacar
    conclusiones precipitadas. «No responde al ping» no quiere decir
    «caído».
