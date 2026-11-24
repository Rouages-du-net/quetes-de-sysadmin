### Historia «Las Cartas del Barrio», capítulo «Cerrar la puerta»:
### endurecer SSH en un servidor nuevo atacado por fuerza bruta. Las
### palabras clave de sshd_config (PermitRootLogin…), los comandos, las
### rutas y los mensajes de OpenSSH (en inglés) no se traducen.

chapter-shut-the-door = Cerrar la puerta
    .summary = Endurecer SSH: sshd_config, sshd -t, reload, y no dejarse fuera.

## Archivos

door-email-kofi =
    De:      Kofi (El Hormiguero)
    Para:    tú
    Asunto:  El nuevo servidor de Las Cartas

    ¡Gracias a ti, el sitio de Las Cartas del Barrio vuelve a funcionar!
    Así que la asociación ha alquilado un pequeño servidor solo para él.
    La empresa de alojamiento lo instaló anoche y te creó una cuenta
    (nombre de usuario: tu), con tu clave SSH: así es como acabas de entrar.

    Pero una amiga me ha dicho que a un servidor nuevo lo atacan en menos
    de una hora. ¿Podrías mirar quién llama a la puerta (el registro del
    servicio ssh) y cerrarla bien?

    1. Nadie debe poder conectarse ya directamente como root.
    2. Nada de contraseñas para SSH: solo claves.
    3. Y sobre todo, ¡comprueba que TÚ todavía puedes entrar!

    La configuración del servidor SSH está en /etc/ssh/sshd_config
    (man sshd_config). Para sudo, tu contraseña es: hormigas-2026
    (sí, sigue haciendo falta una para sudo, aunque SSH ya no use
    contraseñas).

## Eventos

# { $config }: la ruta del archivo de configuración
door-event-error =
    ¡Hay un error en la configuración de SSH! Antes de recargar, comprueba
    siempre con  sudo sshd -t: te da el archivo y la línea culpables.

    (Buena noticia: mientras la configuración sea incorrecta, systemctl
    reload ssh se niega a aplicarla y sshd conserva la anterior. No te
    quedarás fuera por una errata.)
door-event-locked-out =
    ATENCIÓN: con la configuración que sshd acaba de cargar, una conexión
    nueva desde tu cuenta sería rechazada. Tu sesión actual, en cambio,
    sigue abierta: sshd nunca corta las sesiones en curso.

    Es el momento de corregirlo, ANTES de desconectarte. Por eso siempre
    se mantiene una sesión abierta al cambiar la configuración de SSH.
door-event-without-effect =
    Qué raro: has escrito PasswordAuthentication no y has recargado ssh…
    pero las contraseñas se siguen aceptando. Pregunta a sshd lo que
    aplica de verdad:

      sudo sshd -T | grep -i password

    Luego vuelve a leer el principio de /etc/ssh/sshd_config, y man
    sshd_config: para cada palabra clave, ¿qué valor gana cuando aparece
    dos veces?
door-event-closed =
    sshd aplica tu nueva configuración: ni root ni contraseñas. En el
    registro (journalctl -u ssh), los robots son rechazados ahora antes
    incluso de probar una contraseña («[preauth]»).

    Queda lo más importante: comprobar que TÚ todavía puedes entrar. En un
    servidor real, se mantiene esta sesión abierta y se abre una segunda
    para probar. Aquí: exit y luego ssh cartas.
door-event-end =
    Has entrado con tu clave: la puerta está cerrada para los robots, pero
    no para ti. Kofi: «¡Gracias! Dormiré más tranquilo».

    ¡Bien hecho! Has terminado el capítulo «Cerrar la puerta».

    QUÉ HA PASADO
    Un servidor expuesto en internet recibe intentos de conexión en pocos
    minutos: los robots prueban root y nombres comunes (admin, test,
    ubuntu) con contraseñas débiles. Aceptando solo claves, y nunca root
    directamente, les cierras la puerta: una clave no se adivina.

    BUENA PRÁCTICA
    - PermitRootLogin no y PasswordAuthentication no; uno se convierte en
      root con sudo, desde su propia cuenta.
    - Siempre sudo sshd -t antes de recargar, y sudo sshd -T para ver lo
      que se aplica de verdad.
    - Cuidado con los archivos incluidos (Include): para cada palabra
      clave, gana el PRIMER valor leído.
    - Mantén una sesión abierta durante los cambios, y prueba con una
      conexión nueva antes de cerrarla.
    - Para ir más allá: banear los robots insistentes (fail2ban) y
      filtrar los puertos (cortafuegos), en los próximos capítulos.

    DOCUMENTACIÓN
    - sshd_config: https://man.openbsd.org/sshd_config
    - sshd: https://man.openbsd.org/sshd
