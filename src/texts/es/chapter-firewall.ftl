### Historia «Las Cartas del Barrio», capítulo «El cortafuegos»: ufw.
### Los comandos, los puertos, las direcciones y las palabras clave de ufw
### (allow, deny…) no se traducen; la salida de nmap y de ss se queda en
### inglés.

chapter-firewall = El cortafuegos
    .summary = Quién escucha, y quién puede entrar: ss, ufw, y no quedarse nunca fuera.

## Archivos

firewall-email-kofi =
    De:      Kofi (El Hormiguero)
    Para:    tú
    Asunto:  ¿Una puerta de más?

    Mi amiga Yasmine, que trabaja en seguridad, ha «escaneado» nuestro
    servidor desde su casa (¡con nuestro permiso!). Su informe está en
    ~/scan_yasmine.txt. Dice que el puerto 3306 es la base de datos del
    sitio web, y que no pinta nada en internet.

    ¿Podrías montar un cortafuegos? Necesitamos:

    1. que el sitio web siga accesible para todo el mundo (http y https);
    2. que tú puedas seguir conectándote por SSH desde tu ordenador;
    3. que todo lo demás se rechace, empezando por la base de datos.

    Yasmine recomienda ufw, ya instalado (man ufw). Y añadió: «Y sobre
    todo, permite SSH ANTES de activar el cortafuegos». Para sudo, sigue
    siendo la misma contraseña.

## Eventos

firewall-event-listening =
    Mira la columna «Local Address»: 0.0.0.0:3306 quiere decir que MariaDB
    escucha en TODAS las interfaces, así que cualquiera en internet puede
    llamar a esa puerta. php-fpm, en cambio, solo escucha en 127.0.0.1: solo
    se le puede alcanzar desde la propia máquina.
firewall-event-locked-out =
    ATENCIÓN: el cortafuegos está activo y bloquea SSH. Tu sesión aguanta
    (el cortafuegos deja pasar las conexiones ya establecidas), pero
    cualquier conexión nueva fallará. ¡Permite SSH ahora, antes de cerrar la
    sesión!
firewall-event-site-cut =
    El cortafuegos está activo… y el sitio de las Cartas ya no responde:
    http (80) y https (443) están bloqueados. A Kofi le van a llegar
    mensajes preocupados.
firewall-event-base-open =
    El cortafuegos está activo, pero la base de datos (3306) todavía se puede
    alcanzar desde internet. Vuelve a leer lo que pide Kofi.
firewall-event-filter =
    El cortafuegos filtra como debe: el sitio web responde a todo el mundo,
    SSH te responde a ti, y la base de datos no responde a nadie de fuera.
    Compruébalo con sudo ufw status verbose.

    Último paso, como con SSH: comprueba que todavía puedes entrar.
    exit, y luego ssh cartas.
firewall-event-end =
    Nueva conexión correcta: el cortafuegos deja pasar SSH. Yasmine repite
    su escaneo: 22, 80 y 443 abiertos, 3306 filtrado. Kofi: «¡Dice que es un
    trabajo estupendo!».

    ¡Bien hecho! Has terminado el capítulo «El cortafuegos».

    QUÉ HA PASADO
    Un programa que escucha en 0.0.0.0 es accesible desde todo internet,
    aunque solo se use en local: era el caso de la base de datos. El
    cortafuegos rechaza ahora todo lo que entra, salvo las puertas útiles.

    BUENA PRÁCTICA
    - Empieza por mirar quién escucha: sudo ss -tlnp.
    - ufw default deny incoming, y luego permite las puertas útiles una a
      una.
    - Permite SSH ANTES de ufw enable, y prueba una conexión nueva.
    - Mejor aún: ufw limit OpenSSH (frena la fuerza bruta), o permite SSH
      solo desde tus propias direcciones.
    - El cortafuegos no justifica una mala configuración: una base de datos
      local también debería escuchar solo en 127.0.0.1 (bind-address).

    OTRA MANERA
    nftables directamente, como en La Colmena: más líneas que escribir, pero
    todo el cortafuegos ante los ojos, en un solo archivo
    (/etc/nftables.conf). ufw escribe esas reglas por ti (sudo nft list
    ruleset las muestra). firewalld (Fedora, RHEL) piensa en zonas. ufw para
    un servidor sencillo; nftables para un router, NAT o reglas finas.

    DOCUMENTACIÓN
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
