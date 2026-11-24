### Historia «El Transbordador», capítulo «La otra puerta»: el cortafuegos
### es una «table ip», así que IPv6 pasa sin tocar: PostgreSQL y las páginas
### de administración están abiertas desde internet en IPv6. nmap -6, ss,
### familias de nftables (inet), ICMPv6. Los comandos, opciones, direcciones,
### rutas y salidas no se traducen.

chapter-other-door = La otra puerta
    .summary = El escaneo mensual de la cooperativa de fibra encuentra la base de datos y las páginas de administración de la aplicación de reservas abiertas en el servidor del transbordador, pero solo en IPv6. Compara las dos vistas desde fuera, averigua por qué el cortafuegos deja pasar IPv6 y escribe una sola política para las dos familias sin cortar IPv6.

## Files

other-door-message-amaru =
    De: Amaru (cooperativa del transbordador)
    Jueves 12 de abril, 13:50

    Hola otra vez:

    Rangi nos ha reenviado el escaneo mensual de islenet de los servidores
    de sus miembros (está en tu carpeta personal). Desde IPv6, escanean
    los dos. Escribió una frase encima: «Vuestra base de datos está
    abierta a todo internet en IPv6. No en IPv4.»

    No lo entiendo: Tevita me dijo que el cortafuegos lo cierra todo
    menos el sitio y ssh. La base de datos solo la debe leer el mostrador
    de reservas, aquí en la oficina del puerto (198.51.100.40). Y las
    páginas de administración de la aplicación de reservas son para
    nosotros, no para el mundo.

    ¿Podrías mirarlo? vigia sigue ahí para ver desde fuera.

    Amaru

other-door-scan-report =
    islenet, escaneo mensual de los servidores de los miembros, abril 2029
    Miembro: cooperativa del transbordador, servidor muelle.ferry.example

    IPv4 192.0.2.52
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    open      http
      5432/tcp  filtered  postgresql
      8080/tcp  filtered  http-proxy

    IPv6 { $address }
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    closed    http
      5432/tcp  open      postgresql    <-- !
      8080/tcp  open      http-proxy    <-- !

    Recordatorio: un servicio que solo usa la oficina no debería ser
    accesible desde internet, en ninguna de las dos familias.

## Events

other-door-event-scan6 =
    Visto desde internet, en IPv6, PostgreSQL (5432) responde. Ahora el
    mismo escaneo en IPv4 (nmap sin -6), para comparar.
other-door-event-scan4 =
    En IPv4, 5432 está «filtered»: algo descarta los paquetes. El
    cortafuegos de Tevita hace su trabajo, en IPv4. Dos puertas, una
    vigilada. En muelle: ¿quién escucha, y en qué direcciones? (ss -tlnp)
other-door-event-sockets =
    PostgreSQL escucha dos veces: 0.0.0.0:5432 (todas las direcciones
    IPv4) y [::]:5432 (todas las direcciones IPv6). Las páginas de
    administración escuchan en *:8080: un socket IPv6 que también acepta
    IPv4 (IPV6_V6ONLY desactivado). Nada malo ahí: la oficina necesita la
    base de datos. Es trabajo del cortafuegos elegir quién entra. Lee sus
    reglas (nft list ruleset).
other-door-event-ruleset =
    «table ip filter»: una tabla de la familia ip solo ve los paquetes
    IPv4. Los paquetes IPv6 pasan por la familia ip6, y la familia inet
    sirve a las dos. Aquí no hay ninguna tabla ip6 ni inet: en IPv6, no se
    filtra nada en absoluto. Una sola política para las dos familias: una
    table inet (man nft).
other-door-event-disabled =
    IPv6 está desactivado: los puertos abiertos quedan ocultos, pero los
    registros AAAA siguen enviando a los visitantes IPv6 a muelle, que
    ahora se dan contra un muro. Y volver a activarlo (sysctl -w
    …disable_ipv6=0) trae de vuelta las direcciones de enlace local y
    SLAAC, no la fija: esa vuelve con ip -6 addr add (o systemctl restart
    networking). Esto se arregla en el cortafuegos.
other-door-event-nd-dropped =
    muelle ya no responde a nada en IPv6, ni siquiera a ping ni a ssh: el
    router pregunta «¿quién tiene 2001:db8:4e1:20::80?» con una solicitud
    de vecino ICMPv6, y tu cadena input la descarta. IPv4 tiene ARP fuera
    del cortafuegos; IPv6 lo hace con ICMPv6, así que las reglas deben
    dejarlo entrar: icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert {"}"}
    accept (el RFC 4890 lista los demás que conviene conservar:
    packet-too-big…).
other-door-event-v6-stricter =
    Un servicio que pasa en IPv4 ya no pasa en IPv6: a la tabla IPv6 le
    falta una regla de la tabla IPv4. Esa es la trampa de dos copias
    mantenidas a mano: una table inet contiene un solo conjunto de reglas
    para las dos.
other-door-event-office-cut =
    El mostrador de reservas (198.51.100.40, IPv4) ya no llega a la base
    de datos: conserva su regla (ip saddr 198.51.100.40 tcp dport 5432
    accept).
other-door-event-ssh-cut =
    El puesto de trabajo ya no llegaría a ssh: deja el puerto 22 abierto.
other-door-event-closed-now =
    El conjunto de reglas cargado se mantiene ahora en las dos familias:
    ssh, DNS y el sitio pasan, la base de datos y las páginas de
    administración no, la oficina sigue leyendo, y el descubrimiento de
    vecinos pasa. Por ahora: el servicio nftables carga /etc/nftables.conf
    al arrancar (y al recargar).
other-door-event-not-saved =
    Las reglas cargadas ahora no son las de /etc/nftables.conf: en el
    próximo reinicio (o con systemctl reload nftables), la puerta IPv6
    vuelve a abrirse. Escríbelas en el archivo, nft -c -f para
    comprobarlo, y luego cárgalo.
other-door-event-closed-boot =
    /etc/nftables.conf contiene la política para las dos familias, y el
    servicio nftables está activo: la cargará al arrancar.
other-door-event-end =
    Rangi: «Segundo escaneo esta mañana: 5432 y 8080 filtrados en IPv4 y
    en IPv6. Limpio.» Amaru: «Y el mostrador de reservas sigue
    funcionando. Perfecto.»

    ¡Bien hecho! Has terminado el capítulo 2 de El Transbordador. (Te
    espera lo que viene después: ssh muelle.)

    QUÉ HA PASADO
    El cortafuegos de muelle era una tabla de la familia ip: solo veía
    IPv4. Cuando llegó IPv6, todos los servicios que escuchaban en [::]
    o * se volvieron accesibles en IPv6 sin ningún filtro: la base de datos,
    las páginas de administración. Comparaste las dos familias desde fuera
    (nmap, nmap -6), viste los sockets (ss -tlnp) y escribiste una sola
    política para las dos, en una table inet, con el ICMPv6 sin el que
    IPv6 no puede vivir, en el archivo y cargada.

    BUENA PRÁCTICA
    - Activar IPv6 significa auditar el cortafuegos en IPv6: escanea las
      dos familias, desde fuera.
    - nftables: una table inet contiene las reglas de las dos familias; ip
      saddr solo coincide con IPv4, ip6 saddr solo con IPv6.
    - Nunca descartes ICMPv6 en bloque: por él pasan el descubrimiento de
      vecinos y los anuncios del router (RFC 4890).
    - Desactivar IPv6 para ocultar un agujero rompe lo que depende de él
      (los registros AAAA): arregla mejor el filtro.
    - ufw: IPV6=yes en /etc/default/ufw; las reglas añadidas mientras
      estaba en «no» solo existen para IPv4.
    - Mejor un servicio que solo escucha donde hace falta (127.0.0.1, ::1)
      que un cortafuegos que lo oculta.

    DOCUMENTACIÓN
    - Familias de nftables: https://wiki.nftables.org/wiki-nftables/index.php/Nftables_families
    - Un conjunto de reglas sencillo para un servidor: https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_server
    - Filtrar ICMPv6 (RFC 4890): https://www.rfc-editor.org/rfc/rfc4890
    - nmap e IPv6: https://nmap.org/book/man-ipv6.html
