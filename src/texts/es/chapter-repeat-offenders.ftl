### Historia «Las Cartas del Barrio», capítulo 8 «Reincidentes»:
### más jaulas de fail2ban (recidive, nginx-limit-req). Los comandos, las
### rutas, los nombres de jaulas y las líneas de registro nunca se traducen.

chapter-repeat-offenders = Reincidentes
    .summary = Los mismos robots vuelven cada hora, y el robot de la agenda insiste: activar las jaulas recidive y nginx-limit-req de fail2ban.

## Archivos

repeat-offenders-email-rania =
    De:      Rania
    Para:    tú
    Asunto:  Siempre los mismos

    ¡Hola!

    Desde que SSH se mudó al puerto 2222, hay más calma, pero mira
    /var/log/fail2ban.log: dos direcciones se banean una hora, se
    desbanean, se vuelven a banear… nueve veces desde ayer una de ellas.
    Han encontrado el puerto nuevo, y un baneo de una hora no las
    desanima.

    Y el robot que rastreaba la agenda la noche del concierto ha vuelto.
    nginx sí lo limita (recibe rechazos), pero insiste: el registro de
    errores de nginx (/var/log/nginx/error.log) está lleno de
    «limiting requests».

    fail2ban tiene jaulas ya hechas para los dos casos, descritas en
    /etc/fail2ban/jail.conf (busca recidive, y las jaulas de nginx).
    Simplemente están desactivadas. Acuérdate: jail.conf no se toca, la
    configuración se hace en jail.local.

    Cuidado conmigo: probando el límite, yo misma recargué la agenda un
    poco demasiado rápido.

    Para comprobar: sudo fail2ban-client status, y luego el estado de
    cada jaula. Y sudo nft list ruleset muestra lo que bloquea cada
    jaula.

## Eventos

repeat-offenders-event-all-active =
    fail2ban se niega a arrancar: «Have not found any log file». Con
    enabled = true en [DEFAULT], has activado TODAS las jaulas de
    jail.conf, incluidas las de apache y postfix, que aquí no funcionan:
    fail2ban no encuentra sus registros y se detiene. Una jaula se activa
    en su propia sección: [recidive], [nginx-limit-req]…
repeat-offenders-event-short =
    La jaula recidive está activa, pero no banea durante más tiempo que
    la jaula sshd. Para eso sirve: una dirección baneada varias veces se
    banea luego durante mucho tiempo (una semana, en jail.conf). Deja un
    bantime mucho más largo para recidive.
repeat-offenders-event-repeat-offence =
    La jaula recidive ha leído fail2ban.log, ha contado los baneos de cada
    dirección y ha baneado a los reincidentes durante una semana, en todos
    los puertos (banaction_allports): SSH, pero también el sitio web.
repeat-offenders-event-agenda =
    La jaula nginx-limit-req ha leído el registro de errores de nginx y ha
    baneado las direcciones del robot de la agenda. nginx ya ni las ve
    llegar: el cortafuegos las rechaza antes.
repeat-offenders-event-end =
    Los reincidentes están baneados una semana, el robot de la agenda
    también, y ni Rania ni las visitas se han visto afectadas. Rania:
    «¡fail2ban.log ya cabe en una pantalla!»

    ¡Bien hecho! Has terminado el capítulo «Reincidentes».

    QUÉ HA PASADO
    Una jaula de fail2ban es un registro que leer, un filtro (lo que
    cuenta como fallo) y una acción (lo que se bloquea, y durante cuánto
    tiempo). nginx-limit-req lee los rechazos del límite de ritmo de
    nginx; recidive lee el propio registro de fail2ban: una dirección
    baneada cinco veces en un día se banea luego una semana, en todos los
    puertos. ignoreip, puesto en [DEFAULT], protege a Rania en todas las
    jaulas.

    BUENA PRÁCTICA
    - Activa una jaula en su sección de jail.local (enabled = true), nunca
      en [DEFAULT], nunca en jail.conf.
    - fail2ban-client -t antes de recargar, y luego fail2ban-client status
      para cada jaula.
    - recidive banea durante más tiempo que las demás jaulas; la base de
      datos de fail2ban (dbpurgeage) debe conservar los baneos al menos
      tanto como su findtime.
    - Otro enfoque, desde fail2ban 0.11: bantime.increment = true alarga
      el baneo en cada reincidencia, en todas las jaulas.

    DOCUMENTACIÓN
    - jail.conf (fail2ban): https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - Las jaulas que trae fail2ban: https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf
    - limit_req (nginx): https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
