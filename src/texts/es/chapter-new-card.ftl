### Historia «El Transbordador», capítulo «La tarjeta nueva»: la dirección
### SLAAC de muelle siguió a su nueva tarjeta de red, los registros AAAA
### todavía nombran la antigua. ip -6, enlace local y %eth0, una dirección
### fija (inet6 static), la zona BIND y su número de serie. Los comandos,
### opciones, direcciones, rutas y salidas no se traducen.

chapter-new-card = La tarjeta nueva
    .summary = Desde que el servidor de la cooperativa del transbordador tiene una tarjeta de red nueva, su sitio ya no responde en IPv6, solo para los pasajeros con datos móviles. Lee sus direcciones y rutas IPv6, dale una dirección que no vuelva a moverse y publícala en la zona DNS.

## Files

new-card-message-amaru =
    De: Amaru (cooperativa del transbordador)
    Martes 10 de abril, 9:00

    ¡Hola, y te damos la bienvenida a bordo!

    Algo va mal con el sitio desde la semana pasada, y solo para algunas
    personas. Con el wifi de la oficina, los horarios aparecen enseguida.
    En mi teléfono, con datos móviles, se queda cargando mucho rato; a
    veces acaba apareciendo, a veces dice que no se puede acceder al
    sitio. Han llamado pasajeros por eso.

    El martes pasado se murió la tarjeta de red del servidor. La tienda de
    informática del continente puso una nueva, y todo volvió a arrancar.
    Desde entonces, creo. Tevita, que montó el servidor, se ha mudado al
    continente; me dijo por teléfono que el internet de la isla «pasó a
    IPv6» hace un mes, y que él «añadió el AAAA».

    Rangi, de islenet, mandó un correo sobre direcciones: está en tu
    carpeta personal. islenet también nos presta su máquina de
    vigilancia, vigia, para mirar el servidor desde fuera (ssh vigia).

    Amaru

new-card-email-rangi =
    De: Rangi (islenet, la cooperativa de fibra de la isla)
    Para: la cooperativa del transbordador
    Asunto: IPv6, la dirección de vuestro servidor

    Hola:

    Como anunciamos, IPv6 está activo desde el 5 de marzo. Nuestro router
    anuncia el prefijo de vuestro enlace, { $prefix }, y vuestro servidor
    construye en él su propia dirección (SLAAC). Eso está bien para un
    portátil. Para un servidor cuya dirección está en el DNS, os
    recomiendo una fija: os reservamos { $address } en nuestros registros.
    Nuestro router es 2001:db8:4e1:20::1 en ese enlace (veréis su
    dirección de enlace local como pasarela).

    Vuestra zona DNS sigue siendo vuestra: ns1 es vuestro servidor, y
    ns2.islenet.example, nuestro secundario, copia la zona cuando sube su
    número de serie.

    Rangi

## Events

new-card-event-addresses =
    eth0 tiene tres tipos de direcciones IPv6. fe80::…/64, «scope link»:
    la dirección de enlace local, que toda interfaz IPv6 se da a sí misma
    y que solo es válida en su propio enlace. 2001:db8:4e1:20:…/64, «scope
    global dynamic»: una dirección global, construida por SLAAC, a partir
    del prefijo del router (los primeros 64 bits) y de un identificador
    que la máquina calcula ella misma. Y lo tiene ::1. Mira bien el final
    de las dos direcciones de eth0, y la dirección MAC de la tarjeta (ip
    link).
new-card-event-mac =
    La dirección MAC de la tarjeta nueva es 00:00:5e:00:53:7c. Inserta
    ff:fe en medio, invierte un bit del primer byte (00 pasa a 02):
    0200:5eff:fe00:537c. Es el final de las dos direcciones de eth0: el
    identificador de interfaz «EUI-64 modificado». Tarjeta nueva, MAC
    nueva, así que dirección IPv6 nueva.
new-card-event-route =
    La ruta IPv6 por defecto va «via fe80::200:5eff:fe00:5301 dev eth0
    proto ra»: por la dirección de enlace local del router, aprendida de
    sus anuncios (ra: router advertisement). Una dirección de enlace local
    existe en todos los enlaces a la vez: para alcanzarla, hay que decir
    en cuál.
new-card-event-zone-needed =
    ping no sabe por qué enlace enviar a una dirección de enlace local:
    cada interfaz tiene su propio fe80::/64. Añade la interfaz tras un %:
    fe80::200:5eff:fe00:5301%eth0 (o ping -I eth0).
new-card-event-router =
    El router responde en su dirección de enlace local: el enlace funciona
    en IPv6. Así que el servidor es accesible... en su nueva dirección.
    ¿Qué da el DNS? (dig, el tipo AAAA)
new-card-event-old-record =
    Ahí está: el DNS sigue dando 2001:db8:4e1:20:200:5eff:fe00:532a, la
    dirección que construía la tarjeta antigua (su MAC terminaba en
    53:2a). Ya nadie tiene esa dirección: los teléfonos que prueban
    primero IPv6 esperan para nada, y luego vuelven a IPv4 cuando pueden.
    El consejo de Rangi: una dirección que no dependa de la tarjeta.
new-card-event-cut =
    La sesión ssh se ha cortado: ifdown eth0 apagó la misma interfaz por
    la que estabas conectado. Amaru, en la oficina, escribió ifup eth0 en
    la pantalla del servidor, y ha vuelto (ssh muelle). Por ssh, cambia
    una dirección con ip, o vuelve a levantar la red de una vez
    (systemctl restart networking), nunca ifdown a secas.
new-card-event-already =
    ifup se niega: eth0 ya está levantada (ifupdown lo recuerda en
    /run/network/ifstate). Para aplicar el archivo sin cortar tu propia
    sesión, systemctl restart networking lo apaga y lo vuelve a levantar
    todo de una vez; o añade la dirección enseguida con ip -6 addr add, y
    deja el archivo para el próximo arranque.
new-card-event-wrong-prefix =
    Esa dirección no está en el prefijo del enlace ({ $prefix }): el
    router nunca le enviará nada. Bórrala (ip -6 addr del, y el archivo) y
    toma una del prefijo, la que Rangi te reserva.
new-card-event-static-now =
    eth0 lleva ahora una dirección fija en el prefijo, junto a la de
    SLAAC. Solo está ahí hasta el próximo reinicio: escríbela en
    /etc/network/interfaces (una estrofa «iface eth0 inet6 static», man
    interfaces).
new-card-event-static-boot =
    En el próximo arranque, ifupdown dará a eth0 su dirección fija, y la
    ruta IPv6 seguirá ahí. Ahora el DNS.
new-card-event-no-route-boot =
    Cuidado: con este archivo, eth0 arrancaría con su dirección pero sin
    ruta IPv6 por defecto (accept_ra 0 rechaza los anuncios del router, y
    no hay pasarela). Añade la pasarela (la dirección de enlace local del
    router), o deja accept_ra como estaba.
new-card-event-no-route =
    muelle ya no tiene ruta IPv6 por defecto: solo alcanza su propio
    enlace. Recupera los anuncios del router (accept_ra), o da una
    pasarela: ip -6 route add default via fe80::200:5eff:fe00:5301 dev
    eth0.
new-card-event-zone-loaded =
    named ha cargado la zona nueva: dig @localhost da la nueva dirección.
    ¿Y el resto de internet? También pregunta a ns2.islenet.example.
new-card-event-serial =
    Tu servidor da la nueva dirección, pero ns2.islenet.example, el
    secundario, sigue dando la antigua: solo copia la zona cuando sube su
    número de serie (el primer número del SOA). Auméntalo (la convención:
    la fecha y un contador, 2029041001), comprueba el archivo
    (named-checkzone), rndc reload.
new-card-event-slaac-record =
    El DNS da ahora la dirección construida a partir de la tarjeta nueva.
    Hoy funciona, y volverá a romperse en el próximo cambio de tarjeta (o
    de placa base). La dirección de un servidor en el DNS debería ser
    fija.
new-card-event-published =
    Los servidores públicos de la zona dan la dirección fija de muelle,
    para ferry.example, www y muelle. vigia puede comprobarlo desde fuera
    (ssh vigia, luego ping6 www.ferry.example).
new-card-event-seen-outside =
    Desde internet, www.ferry.example responde al ping en IPv6, en su
    dirección fija.
new-card-event-end =
    Amaru: «En mi teléfono, los horarios aparecen ahora enseguida.
    ¡Gracias!» (Entre tú y yo, su teléfono sigue recibiendo la página en
    IPv4: prueba curl -6 desde vigia. Eso es para otro día.)

    ¡Bien hecho! Has terminado el capítulo 1 de El Transbordador. (Te
    espera lo que viene después: ssh muelle.)

    QUÉ HA PASADO
    muelle construía su dirección IPv6 él solo (SLAAC): el prefijo que
    anuncia el router, y luego un identificador calculado a partir de la
    dirección MAC de la tarjeta de red (EUI-64 modificado). La tarjeta
    nueva trajo una dirección nueva, pero los registros AAAA seguían
    nombrando la antigua: los clientes IPv6 llamaban a una dirección que
    nadie tenía. Diste a muelle una dirección fija, { $address }, ahora (ip
    -6 addr add) y al arrancar (iface eth0 inet6 static), y la publicaste:
    los registros AAAA, un número de serie mayor, named-checkzone, rndc
    reload.

    BUENA PRÁCTICA
    - Un servidor en el DNS recibe una dirección IPv6 fija; SLAAC es para
      las máquinas que nadie busca por su nombre.
    - ip -6 addr: scope link (fe80::, válida en un enlace) y scope global;
      ip -6 route: la pasarela suele ser la dirección de enlace local del
      router.
    - Una dirección de enlace local necesita su interfaz: fe80::…%eth0.
    - Por ssh, nunca hagas ifdown de la interfaz por la que estás
      conectado.
    - Cada cambio de una zona sube su número de serie, o los secundarios
      se quedan con la versión antigua.
    - Comprueba desde fuera, en cada familia: ping -6, curl -6.

    DOCUMENTACIÓN
    - SLAAC (RFC 4862): https://www.rfc-editor.org/rfc/rfc4862
    - El archivo interfaces, familia inet6: https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - ip address: https://man7.org/linux/man-pages/man8/ip-address.8.html
    - BIND 9, archivos de zona: https://bind9.readthedocs.io/en/stable/chapter3.html
