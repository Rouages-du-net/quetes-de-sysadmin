### Lo que comparten los capítulos de «La Donación de Sangre»: los mensajes
### propios del juego sobre keepalived, HAProxy, socat y tcpdump. Los
### comandos, las opciones, las rutas y las salidas no se traducen.

keepalived-usage = Uso: keepalived [-t] [-f ARCHIVO] [-v] (el keepalived del juego: man keepalived)
keepalived-not-by-hand = Aquí keepalived funciona como servicio: systemctl start, stop o reload keepalived. Para comprobar una configuración: keepalived -t (man keepalived).
haproxy-usage = Uso: haproxy -c -f /etc/haproxy/haproxy.cfg [-q] | haproxy -v | haproxy -vv (el haproxy del juego: man haproxy)
haproxy-not-by-hand = Aquí HAProxy funciona como servicio: systemctl start, stop o reload haproxy. Para comprobar una configuración: haproxy -c -f /etc/haproxy/haproxy.cfg.
socat-only-stdio = El socat del juego une su entrada y su salida estándar (STDIO, o -) a un socket UNIX: echo "show stat" | sudo socat stdio /run/haproxy/admin.sock
tcpdump-usage = Uso: tcpdump [-envv] [-c número] [-i interfaz] [expresión] (man tcpdump)
tcpdump-stopped = (El juego detiene la captura al cabo de diez segundos, como si hubieras pulsado Ctrl-C; -c NÚMERO la detiene tras NÚMERO paquetes.)
