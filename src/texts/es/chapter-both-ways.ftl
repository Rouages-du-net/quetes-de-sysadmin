### Historia «El Transbordador», capítulo «En los dos sentidos»: nginx solo
### escucha en IPv4, y la aplicación de reservas actualizada escucha en ::1
### mientras nginx pregunta a 127.0.0.1. curl -4/-6 -v, ss, listen [::]:80,
### proxy_pass y localhost. Los comandos, opciones, direcciones, rutas y
### salidas no se traducen.

chapter-both-ways = En los dos sentidos
    .summary = El primer sábado de la temporada: con datos móviles el sitio del transbordador duda o falla, y desde la actualización de anoche la página de reservas responde «502 Bad Gateway» a todo el mundo. Una avería por familia de direcciones: encuentra las dos desde fuera y arréglalas antes de que abran las reservas.

## Files

both-ways-message-amaru =
    De: Amaru (cooperativa del transbordador)
    Sábado 14 de abril, 8:30

    ¡Buenos días! Día de apertura: las reservas abren a las nueve.

    Dos problemas, me temo. En mi teléfono, con datos móviles, «no se
    puede acceder» al sitio una vez de cada dos; con el wifi de la
    oficina, los horarios aparecen. Pero «Reservar una travesía» responde
    «502 Bad Gateway», aquí y en todas partes, desde que Lucía actualizó
    la aplicación anoche. Dejó una nota antes de coger el primer barco al
    continente.

    vigia sigue ahí.

    Amaru

both-ways-note-lucia =
    Nota de Lucía

    Anoche actualicé la aplicación de reservas (Node.js 22). De paso,
    ordené /etc/default/booking: HOST=localhost en lugar de 127.0.0.1, es
    más limpio, ¿no? Arrancó sin errores (journalctl -u booking). ¡Vuelvo
    el lunes!

    Lucía

## Events

both-ways-event-refused6 =
    En IPv6, el puerto 80 rechaza la conexión: la dirección responde
    (ping6 funciona), pero nadie escucha en el 80 en IPv6. Sin -6, curl
    prueba primero IPv6 y luego vuelve a IPv4 (happy eyeballs): por eso la
    página aparece a veces. Un teléfono en una red sin esa vuelta atrás, o
    con un IPv4 deficiente, espera o falla. En muelle: ss -tlnp.
both-ways-event-sockets =
    nginx escucha en 0.0.0.0:80: solo IPv4. Y la aplicación escucha
    en [::1]:3000, el bucle local IPv6, ya no en 127.0.0.1. Dos pistas,
    una por familia.
both-ways-event-bad-gateway =
    502 Bad Gateway: nginx respondió, pero no pudo llegar a la aplicación
    que tiene detrás. Su motivo está en /var/log/nginx/error.log.
both-ways-event-error-log =
    «connect() failed (111: Connection refused) while connecting to
    upstream, … upstream: http://127.0.0.1:3000/»: nginx llama a
    127.0.0.1, la aplicación escucha en ::1. Desde Node.js 17,
    «localhost» da las direcciones en el orden del sistema, ::1 primero, y
    la aplicación solo escucha en la primera. O nginx pregunta a [::1]
    (proxy_pass http://[::1]:3000/;), o la aplicación vuelve a escuchar en
    127.0.0.1 (HOST en /etc/default/booking, y luego reiníciala).
both-ways-event-not-reloaded =
    El archivo es correcto y nginx -t está de acuerdo, pero nginx sigue
    sirviendo la configuración que leyó al arrancar: systemctl reload
    nginx.
both-ways-event-bind-conflict =
    nginx no puede abrir [::]:80: con ipv6only=off, ese socket también
    acepta IPv4, y «listen 80» ya ocupa el puerto 80 de IPv4. nginx -t no
    lo ve (no abre los sockets). O dos líneas, listen 80 y listen [::]:80
    (solo IPv6, el valor por defecto), o una sola línea, listen [::]:80
    ipv6only=off.
both-ways-event-listen6 =
    nginx ya escucha también en IPv6 ([::]:80). Desde vigia, curl -6
    debería obtener los horarios.
both-ways-event-exposed =
    La aplicación escucha ahora en todas las direcciones: solo sigue
    siendo privada porque el cortafuegos descarta el puerto 3000. Su sitio
    es el bucle local (127.0.0.1 o ::1), donde solo llega nginx.
both-ways-event-upstream-ok =
    La página de reservas vuelve a responder a través de nginx.
both-ways-event-end =
    8:58. Amaru: «Mi teléfono lo muestra todo, las reservas funcionan, y
    los primeros pasajeros están reservando. ¡Ve a tomarte un café al
    muelle!»

    ¡Bien hecho! Has terminado El Transbordador.

    QUÉ HA PASADO
    Dos averías, una por familia. nginx solo escuchaba en IPv4 (listen
    80): en IPv6, la conexión se rechazaba en { $v6 }, y solo los clientes
    capaces de volver a IPv4 ({ $v4 }) obtenían la página, tarde. Y la
    aplicación actualizada escuchaba en «localhost», que Node.js convirtió
    en ::1, mientras nginx preguntaba a 127.0.0.1: 502 para todo el mundo.
    Añadiste el listen IPv6, apuntaste nginx y la aplicación al mismo bucle
    local, comprobaste (nginx -t), recargaste y comprobaste desde fuera en
    las dos familias.

    BUENA PRÁCTICA
    - Un registro AAAA es una promesa: todos los servicios detrás del
      nombre deben responder también en IPv6 (listen [::]:80 junto a
      listen 80).
    - nginx: listen [::]:80 es solo IPv6 por defecto (ipv6only=on); con
      ipv6only=off acepta los dos, y no debe estar junto a listen 80.
    - «localhost» son dos direcciones: escribe 127.0.0.1 o [::1] cuando
      quieres decir una (proxy_pass, HOST).
    - curl -4 y curl -6 -v prueban cada camino por separado; una página
      que funciona en un navegador puede ocultar un IPv6 roto (happy
      eyeballs).
    - ss -tlnp: 0.0.0.0 es IPv4, [::] IPv6, * los dos.

    DOCUMENTACIÓN
    - nginx, listen (ipv6only): https://nginx.org/en/docs/http/ngx_http_core_module.html#listen
    - nginx, proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Node.js, el orden de los resultados DNS: https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder
    - Happy eyeballs (RFC 8305): https://www.rfc-editor.org/rfc/rfc8305
