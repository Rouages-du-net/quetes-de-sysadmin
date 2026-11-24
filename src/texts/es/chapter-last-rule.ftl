### Historia «El Otro Unix», capítulo «Gana la última regla»: una
### configuración de pf escrita con costumbres de iptables. Los comandos,
### opciones, reglas y rutas no se traducen.

chapter-last-rule = Gana la última regla
    .summary = La base de datos del cineclub responde a todo internet: activa pf sin dejarte fuera, y aprende que en pf gana la última regla que coincide.

## Files

last-rule-message-romy =
    De:    Romy
    Para:  tú

    Una socia que trabaja en informática escaneó nuestro servidor (con
    nuestro permiso): la base de datos, puerto 3306, responde a todo
    internet. Solo debería hablar con ella el sitio, desde el propio
    servidor.

    Yanis escribió una configuración de cortafuegos, /etc/pf.conf, «como
    iptables», dice. No se atrevió a activarla: la última vez que tocó un
    cortafuegos, nadie pudo conectarse en dos días.

    ¿Puedes activarla sin dejarnos fuera?

    Romy

## Events

last-rule-event-checked =
    pfctl -n lee la configuración y se detiene ahí: si no dice nada, la
    sintaxis es correcta. Pero una sintaxis correcta no quiere decir que las
    reglas hagan lo que quieres: pfctl -sr te las mostrará como las entiende
    pf, una vez cargadas.
last-rule-event-locked-out =
    Cuidado: con estas reglas en vigor, tu próxima conexión ssh sería
    rechazada, y el sitio ya no responde. En pf se lee CADA regla, y gana la
    última que coincide: «block in all», al final, bloquea también ssh y la
    web. Tu sesión actual sigue abierta (pf mantiene las conexiones que ya
    conoce): corrige pf.conf y vuelve a cargarlo.
last-rule-event-on =
    pf está activo, y ssh sigue entrando.
last-rule-event-not-at-boot =
    pf filtra como debe… hasta el próximo reinicio: sin pf_enable="YES" en
    rc.conf, no volverá a arrancar.
last-rule-event-file-differs =
    Las reglas en vigor ya no son las de /etc/pf.conf: después de editar el
    archivo, vuelve a cargarlo (pfctl -f), o un reinicio traería otra cosa.
last-rule-event-end =
    Romy: «El escaneo dice 22 y 80, nada más. ¡Y todavía podemos
    conectarnos!»

    ¡Bien hecho! Has terminado el capítulo «Gana la última regla» y la
    historia «El Otro Unix».

    QUÉ HA PASADO
    Yanis escribió sus reglas en el orden en que las lee iptables: aceptar,
    y luego bloquear el resto. pf las lee todas, y decide la ÚLTIMA regla
    que coincide: su «block in all» final lo bloqueaba todo, ssh incluido.
    Bloquear primero y luego abrir (o pases «quick») dice lo mismo en el
    idioma de pf. pf arranca ahora al inicio, con las reglas del archivo.

    BUENA PRÁCTICA
    - Comprueba una configuración antes de cargarla (pfctl -nf), luego
      comprueba lo que está realmente en vigor (pfctl -sr) y prueba desde
      fuera.
    - En pf: primero el bloqueo, luego los pases; o quick en las reglas que
      deben decidir enseguida.
    - Por ssh, mantén tu sesión abierta mientras pruebas un cortafuegos
      nuevo, y abre una segunda para comprobar que todavía puedes entrar.
    - Mejor aún para una base de datos: que escuche solo en 127.0.0.1. El
      cortafuegos es una segunda línea, no la única.

    OTRA MANERA
    pf también puede mantener listas de direcciones (tables), frenar a los
    atacantes (max-src-conn-rate con overload, el equivalente pf de
    fail2ban) y hacer NAT para un router de casa o de oficina. FreeBSD trae
    también ipfw, su otro cortafuegos, con su propia sintaxis (donde gana la
    primera regla).

    DOCUMENTACIÓN
    - pf.conf(5): https://man.freebsd.org/cgi/man.cgi?query=pf.conf
    - pfctl(8): https://man.freebsd.org/cgi/man.cgi?query=pfctl
    - El Handbook, PF: https://docs.freebsd.org/en/books/handbook/firewalls/#firewalls-pf
