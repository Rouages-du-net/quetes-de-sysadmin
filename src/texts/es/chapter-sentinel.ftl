### Historia «Las Cartas del Barrio», capítulo «El centinela»:
### fail2ban. Los comandos, las rutas, las direcciones, las palabras clave
### de configuración (bantime, ignoreip…) y la salida de fail2ban (en
### inglés) no se traducen.

chapter-sentinel = El centinela
    .summary = Banear a los robots sin banear a tus amistades: fail2ban, jail.local, ignoreip.

## Archivos

sentinel-email-kofi =
    De:      Kofi (El Hormiguero)
    Para:    tú
    Asunto:  Rania ya no puede conectarse

    Rania, nuestra webmaster, no puede conectarse al servidor desde esta
    mañana: «Connection refused». Dice que se equivocó varias veces de
    nombre de usuario. Yasmine cree que es fail2ban, el guardián instalado
    con el servidor, que la ha tomado por un robot. Su dirección:
    198.51.100.40.

    Yasmine también ha visto que los robots vuelven cada diez minutos:
    mira /var/log/fail2ban.log. Están llamando a la puerta ahora mismo;
    para verlos en directo (Ctrl-C para parar):

      journalctl -fu ssh
      tail -f /var/log/fail2ban.log

    ¿Podrías:

    1. devolverle el acceso a Rania;
    2. asegurarte de que ni Rania ni tú volváis a ser baneados;
    3. banear a los robots durante más tiempo, al menos una hora?

    Según Yasmine, todo está en man fail2ban-client y man jail.conf, y
    «hagas lo que hagas, no toques jail.conf». La contraseña de sudo no ha
    cambiado.

## Eventos

sentinel-event-jail-conf =
    Has cambiado /etc/fail2ban/jail.conf. Funciona… hasta la próxima
    actualización de fail2ban, que sustituirá este archivo, y tus ajustes
    con él. El propio archivo lo dice al principio: «YOU SHOULD NOT MODIFY
    THIS FILE». Mejor pon tus ajustes en /etc/fail2ban/jail.local.
sentinel-event-error =
    La configuración de fail2ban tiene un error. Antes de recargar,
    compruébala con  sudo fail2ban-client -t: te da el archivo y la línea
    culpables.
sentinel-event-rania =
    Rania ya no está baneada: puede volver a conectarse. Pero si se
    equivoca cinco veces más, fail2ban la volverá a banear…
# { $address }: la dirección del puesto
sentinel-event-banned-self =
    ATENCIÓN: fail2ban acaba de banear { $address }… ¡la dirección de tu
    propio puesto! Ayer tuviste tres conexiones fallidas (busca «Failed
    publickey» en journalctl -u ssh), y con estos ajustes, basta. Quítate
    el baneo y añade tu dirección a ignoreip, antes de desconectarte.
sentinel-event-set =
    fail2ban aplica tus ajustes: los robots se quedan baneados más
    tiempo, y ni Rania ni tú volveréis a ser baneados. Comprueba el estado
    de la jaula: sudo fail2ban-client status sshd.
sentinel-event-end =
    Los robots están baneados de verdad, Rania puede volver a conectarse y
    tu puesto ya no corre peligro. Kofi: «¡Rania te da las gracias, ha
    podido publicar la programación!»

    ¡Bien hecho! Has terminado el capítulo «El centinela».

    QUÉ HA PASADO
    fail2ban lee el registro de SSH y banea una dirección después de un
    cierto número de fallos. Con los ajustes por defecto, el baneo solo
    duraba diez minutos: los robots volvían enseguida. Y una persona que
    se equivoca cinco veces parece un robot.

    BUENA PRÁCTICA
    - Nunca modifiques jail.conf: pon tus ajustes en jail.local.
    - ignoreip para tus propias direcciones y las de tu equipo, ANTES de
      endurecer maxretry.
    - Un bantime más largo para los reincidentes (1h, 1d); para ir más
      allá, la jaula «recidive» banea durante una semana a quienes
      vuelven.
    - fail2ban-client -t antes de recargar, status sshd para comprobar, y
      set sshd unbanip para deshacer un error.
    - fail2ban no sustituye a las claves SSH: reduce el ruido y la carga;
      la verdadera protección sigue siendo PasswordAuthentication no.

    OTRA MANERA
    ufw limit 22/tcp rechaza una dirección que abre 6 conexiones o más en
    30 segundos, sin leer ningún registro: sencillo, pero ciego (no ve los
    fallos de conexión, y también frena a un compañero con prisa).
    fail2ban lee los propios fallos. Mejor aún: solo claves
    (PasswordAuthentication no), que hacen inútil la fuerza bruta.

    DOCUMENTACIÓN
    - jail.conf: https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - fail2ban-client: https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html
