### Pistas graduales de El Transbordador (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin
### el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — La tarjeta nueva

hint-new-card-addresses =
    .lead = Mira las direcciones IPv6 del servidor, interfaz por interfaz (man ip; -6 se queda con una familia).
    .solution = ip -6 addr (o ip a)
hint-new-card-route =
    .lead = ¿Por dónde sale el tráfico IPv6 hacia internet? Las rutas, familia IPv6 (man ip).
    .solution = ip -6 route
hint-new-card-router =
    .lead = Haz ping a la pasarela de la ruta IPv6. Es una dirección de enlace local: necesita su interfaz (man ping).
    .solution = ping -6 -c 3 fe80::200:5eff:fe00:5301%eth0
hint-new-card-old-record =
    .lead = ¿Qué dirección IPv6 da el DNS para el sitio? Pide el registro AAAA (man dig).
    .solution = dig www.ferry.example AAAA
hint-new-card-static-now =
    .lead = Da a eth0 la dirección fija que Rangi te reserva, en el prefijo, enseguida (man ip, la acción addr add).
    .solution = sudo ip -6 addr add 2001:db8:4e1:20::80/64 dev eth0
hint-new-card-static-boot =
    .lead = Hazla durar: una estrofa inet6 static para eth0 en /etc/network/interfaces, con la dirección y la longitud de su prefijo (man interfaces).
    .solution = sudo nano /etc/network/interfaces, añade: iface eth0 inet6 static, luego address 2001:db8:4e1:20::80/64 y gateway fe80::200:5eff:fe00:5301 (sangrados).
hint-new-card-zone-loaded =
    .lead = El archivo de zona de ferry.example vive en /etc/bind/zones: sustituye la dirección antigua en sus registros AAAA, comprueba el archivo y haz que named lo vuelva a leer (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/zones/db.ferry.example (los registros AAAA), sudo named-checkzone ferry.example /etc/bind/zones/db.ferry.example, sudo rndc reload
hint-new-card-published =
    .lead = El secundario de la zona solo copia una zona cuyo número de serie (el primer número del SOA) ha subido. Compara lo que dan los dos servidores (dig @…).
    .solution = Sube el número de serie (2029041001), sudo rndc reload, luego dig @ns2.islenet.example www.ferry.example AAAA
hint-new-card-end =
    .lead = Todo debe encajar: la dirección fija ahora y al arrancar, una ruta IPv6 por defecto, y los tres nombres (ferry.example, www, muelle) dando esa dirección.
    .solution = ip -6 route (una ruta por defecto), ip -6 addr, dig @ns2.islenet.example muelle.ferry.example AAAA

## Capítulo 2 — La otra puerta

hint-other-door-scan6 =
    .lead = Desde vigia, escanea muelle en IPv6, como hizo islenet (man nmap, la opción -6).
    .solution = ssh vigia, luego nmap -6 muelle.ferry.example
hint-other-door-scan4 =
    .lead = El mismo escaneo, en IPv4, para comparar.
    .solution = nmap muelle.ferry.example
hint-other-door-sockets =
    .lead = En muelle: ¿qué programas escuchan, y en qué direcciones (man ss)?
    .solution = sudo ss -tlnp
hint-other-door-ruleset =
    .lead = Lee las reglas del cortafuegos, y fíjate en qué familia es su tabla (man nft).
    .solution = sudo nft list ruleset (o cat /etc/nftables.conf)
hint-other-door-closed-now =
    .lead = Una tabla para las dos familias (inet), las mismas reglas, más el ICMPv6 que necesita el descubrimiento de vecinos; carga el archivo (man nft).
    .solution = sudo nano /etc/nftables.conf: table inet filter, e icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, packet-too-big, echo-request {"}"} accept; luego sudo nft -c -f /etc/nftables.conf y sudo systemctl reload nftables
hint-other-door-closed-boot =
    .lead = Lo cargado debe ser lo que dice el archivo: el servicio nftables carga /etc/nftables.conf al arrancar.
    .solution = Escribe las reglas en /etc/nftables.conf, luego sudo systemctl reload nftables
hint-other-door-end =
    .lead = Comprueba desde vigia, en las dos familias: ssh, DNS y el sitio pasan, 5432 y 8080 no; e IPv6 debe seguir activo.
    .solution = nmap -6 -p 22,53,80,5432,8080 muelle.ferry.example, luego lo mismo sin -6

## Capítulo 3 — En los dos sentidos

hint-both-ways-refused6 =
    .lead = Desde vigia, pide el sitio solo en IPv6, y observa la conexión (man curl: -6, -v).
    .solution = ssh vigia, luego curl -6 -v http://www.ferry.example/
hint-both-ways-sockets =
    .lead = En muelle: ¿quién escucha en el puerto 80, y la aplicación en el 3000, en qué direcciones (man ss)?
    .solution = sudo ss -tlnp
hint-both-ways-bad-gateway =
    .lead = Pide la página de reservas, a través de nginx (man curl).
    .solution = curl -i http://localhost/booking/
hint-both-ways-error-log =
    .lead = nginx escribe en su registro de errores por qué no pudo llegar a la aplicación.
    .solution = sudo tail /var/log/nginx/error.log
hint-both-ways-listen6 =
    .lead = El bloque server de /etc/nginx/sites-available/ferry escucha en el puerto 80 solo en IPv4: añade un listen para IPv6, comprueba, recarga (man nginx).
    .solution = Añade listen [::]:80 default_server; bajo listen 80 default_server;, luego sudo nginx -t y sudo systemctl reload nginx
hint-both-ways-upstream-ok =
    .lead = nginx y la aplicación deben ponerse de acuerdo en una sola dirección de bucle local: o proxy_pass a [::1], o la aplicación de vuelta en 127.0.0.1 (/etc/default/booking).
    .solution = sudo nano /etc/default/booking: HOST=127.0.0.1, luego sudo systemctl restart booking (o proxy_pass http://[::1]:3000/; y un reload de nginx)
hint-both-ways-end =
    .lead = Comprueba desde vigia, en cada familia: los horarios y la página de reservas.
    .solution = curl -4 http://www.ferry.example/booking/ y curl -6 http://www.ferry.example/booking/
