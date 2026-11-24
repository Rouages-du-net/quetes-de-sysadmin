### Historia «El Bastión», capítulo «El refuerzo»: desactivar de verdad el
### inicio de sesión por contraseña (el drop-in que gana), un cortafuegos que
### deniega por defecto y sobrevive a un reinicio, y devolver deploy por
### clave. Los comandos, las rutas y las opciones no se traducen.

chapter-hardening = El refuerzo
    .summary = Desactivar de verdad los inicios de sesión por contraseña, un cortafuegos que deniega por defecto y sobrevive a un reinicio, y devolverle a Selma su cuenta, solo por clave.

## Archivos

hardening-email-nadia =
    De:      Nadia
    Para:    tú
    Asunto:  El lunes

    A Selma le gustaría desplegar esta tarde. ¿Puede hacerlo sin riesgo? ¿Y
    cómo nos aseguramos de que esto no vuelva a pasar? El proveedor pregunta
    qué hemos cambiado.

    Nadia

hardening-incident =
    # Incidente — horno (reparto)

    ## Limpiado (14/04)
    Crontab, clave, /tmp/.cache, server.js restaurado desde la versión
    firmada.

    ## Por qué fue posible
    - Contraseñas aceptadas en ssh, y eso que sshd_config dice «no».
    - Ningún cortafuegos: todos los puertos abiertos, también el 3000 de la
      aplicación.

    ## Lecciones (por hacer)
    - Contraseñas desactivadas, de verdad.
    - Cortafuegos: denegar por defecto, abrir solo lo necesario, y
      conservarlo tras un reinicio (/etc/iptables/rules.v4).
    - deploy de vuelta para Selma, solo por clave.

## Eventos

hardening-event-looked =
    sshd -T dice «passwordauthentication yes», mientras que sshd_config dice
    no. sshd_config empieza con un Include de sshd_config.d/*.conf, y para
    cada palabra clave gana el primer valor leído: el drop-in, leído
    primero, gana.
hardening-event-not-reloaded =
    Los archivos dicen ahora no, pero sshd sigue aplicando la configuración
    que leyó en su último arranque o recarga: recarga ssh (systemctl).
hardening-event-passwords =
    Los inicios de sesión por contraseña están desactivados en la
    configuración que aplica sshd: ahora solo las claves abren una sesión.
hardening-event-locked-out =
    Cuidado: con estas reglas, tu próxima conexión ssh sería rechazada. Tu
    sesión actual está a salvo, pero acepta el puerto 22 antes de cerrar la
    sesión.
hardening-event-no-loopback =
    La política descarta por defecto, pero nada acepta el bucle local (lo):
    nginx alcanza la aplicación en 127.0.0.1, y eso también se descartaría.
    La primera regla de un cortafuegos que deniega por defecto suele dejar
    pasar lo.
# { $port }: the app's port
hardening-event-firewall =
    La denegación por defecto está en su sitio: se aceptan lo, las
    respuestas a las conexiones del propio servidor, ssh, http y https; el
    resto se descarta, incluido { $port }, que estaba abierto al mundo.
hardening-event-saved =
    Las reglas están guardadas en /etc/iptables/rules.v4:
    iptables-persistent las vuelve a cargar al arrancar. Sin eso, un
    reinicio lo habría vuelto a abrir todo al mundo.
hardening-event-deploy =
    deploy vuelve a poder usarse, y con las contraseñas desactivadas, solo la
    clave de Selma la abre.
hardening-event-end =
    Nadia: «He enviado tus notas al proveedor. Dicen que es la primera vez
    que alguien les responde con una cronología».

    ¡Bien hecho! Has terminado el capítulo «El refuerzo» y la historia «El
    Bastión».

    QUÉ HA PASADO
    La puerta de entrada era un drop-in dejado «para un tiempo»: una sola
    línea en sshd_config.d, leída antes que sshd_config, que volvía a
    aceptar contraseñas. Las desactivaste de verdad, cerraste todos los
    puertos que no tenían por qué estar abiertos con un cortafuegos que
    deniega por defecto guardado para el próximo arranque, y le devolviste a
    Selma su cuenta, solo por clave.

    BUENA PRÁCTICA
    - Comprueba lo que se aplica, no lo que crees: sshd -T para ssh,
      iptables -L o nmap desde fuera para el cortafuegos.
    - Una excepción temporal necesita una fecha de fin y alguien que la
      quite: escríbelo en el propio archivo, y en un recordatorio.
    - Denegar por defecto, y luego abrir lo necesario: lo, las respuestas
      (ESTABLISHED, RELATED), y luego cada servicio. Y guardarlo, o el
      próximo reinicio lo deshace.
    - Cierra el incidente con un informe: qué pasó, cuándo, qué se hizo, qué
      cambia. incident.md está listo para enviarse.

    OTRA MANERA
    fail2ban (visto en «El centinela») habría bloqueado 203.0.113.66 al cabo
    de unos pocos fallos. ufw escribe las mismas reglas iptables con
    comandos más sencillos, y nftables es su sucesor. Y una revisión de los
    drop-ins (sshd_config.d, sudoers.d…) tiene su sitio en la vigilancia
    semanal de «La Vigilancia».

    DOCUMENTACIÓN
    - sshd_config (Include, primer valor): https://man.openbsd.org/sshd_config
    - iptables: https://man7.org/linux/man-pages/man8/iptables.8.html
    - iptables-save: https://man7.org/linux/man-pages/man8/iptables-save.8.html
    - iptables en Debian (iptables-persistent): https://wiki.debian.org/iptables
    - NIST SP 800-61r2, actividad posterior al incidente: https://csrc.nist.gov/pubs/sp/800/61/r2/final
