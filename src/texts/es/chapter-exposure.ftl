### Historia «La Auditoría», capítulo «La exposición»: el escaneo de puertos
### de la auditora encuentra la base de datos y Redis accesibles desde
### internet. ufw y la configuración de Redis. Los comandos, las rutas, las
### palabras clave de redis.conf y los mensajes de las herramientas no se
### traducen.

chapter-exposure = La exposición
    .summary = Cerrar lo que un escaneo de puertos encuentra abierto: ufw, y hacer que Redis escuche solo en la máquina local.

## Archivos

exposure-email-salome =
    De:      Salomé (auditora)
    Para:    tú
    Asunto:  Auditoría de la Panadería — segunda parte: la exposición

    Hola:

    Gracias por tratar la primera parte: SSH, las cuentas, sudo y el archivo
    de secretos están en orden. La segunda parte trata de lo que se ve del
    servidor desde internet.

    Mi escaneo de puertos está en escaneo_auditoria.txt. Hay dos líneas que
    me preocupan: la base de datos (5432) y Redis (6379) responden a
    cualquiera. Redis ni siquiera tiene contraseña, y se instaló para
    escuchar en todas las interfaces.

    Lo que espero:
    1. Solo SSH (desde tu puesto de administración) y el sitio web (80 y
       443) accesibles desde internet. Hay un cortafuegos instalado (ufw),
       pero está desactivado.
    2. Redis, además, escuchando solo en la propia máquina: un cortafuegos se
       desactiva, se olvida o se configura mal; un servicio que solo se
       escucha a sí mismo es más seguro.
    3. Que la aplicación de pedidos siga funcionando: usa la base de datos y
       Redis, en local.

    Por favor, prueba con una nueva conexión SSH antes de cerrar la sesión
    que tienes abierta.

    Salomé
    (Para sudo, tu contraseña sigue siendo: harina-2028)

## Eventos

exposure-event-listening =
    Ahí está quién escucha, y dónde. Mira la columna «Local Address:Port»:
    0.0.0.0 quiere decir «todas las interfaces», o sea, accesible desde
    cualquier sitio (si nada filtra); 127.0.0.1 quiere decir «solo esta
    máquina». El puerto 3000 (la aplicación) ya es local: ese es el buen
    ejemplo.
exposure-event-locked-out =
    ATENCIÓN: el cortafuegos está activo y ya no deja entrar SSH desde tu
    puesto. Tu sesión actual aguanta (las conexiones establecidas no se
    cortan), pero la siguiente no. Permite SSH ahora mismo (sudo ufw status
    para mirar, man ufw para la regla).
exposure-event-site-cut =
    El cortafuegos bloquea ahora el sitio web: la clientela ya no puede hacer
    pedidos. Permite los puertos 80 y 443 (un perfil de ufw los nombra: ufw
    app list, o simplemente los números).
exposure-event-base-open =
    El cortafuegos está activo, pero todavía pasa un puerto de la base de
    datos o de Redis: una regla demasiado amplia («allow» sin puerto, un
    rango…) o una política por defecto en «allow». Vuelve a leer
    sudo ufw status verbose  : por defecto, lo que no está permitido debe
    denegarse en la entrada.
exposure-event-redis-stopped =
    Redis está parado: la aplicación de pedidos lo necesita (sesiones y cola
    de espera), ¡los pedidos en línea ya no pasan! Apagar un servicio no es
    arreglarlo: vuelve a arrancarlo y cambia más bien su dirección de
    escucha.
exposure-event-without-effect =
    redis.conf dice «bind 127.0.0.1»… pero Redis sigue escuchando en todas
    las interfaces: un programa lee su configuración cuando arranca, no
    cuando cambia el archivo. Haz que se reinicie y luego ejecuta
      ss -tln
    para ver la nueva dirección.
exposure-event-firewall =
    El cortafuegos está activo: pasan SSH (desde tu puesto), 80 y 443; la
    base de datos y Redis están cerrados desde internet. Pero eso es solo una
    capa: Redis sigue escuchando en todas las interfaces.
exposure-event-redis-local =
    Redis escucha ahora solo en 127.0.0.1: aun sin cortafuegos, ya no sería
    accesible desde fuera, y la aplicación lo sigue alcanzando.
exposure-event-end =
    Has entrado con el cortafuegos activo: SSH pasa, el sitio web también, y
    la base de datos y Redis están cerrados. Salomé: «Mi escaneo ya solo ve
    tres puertos. ¡Gracias! Queda la tercera parte, los rastros de inicio de
    sesión».

    ¡Bien hecho! Has terminado el capítulo «La exposición».

    QUÉ HA PASADO
    Un servicio que escucha en 0.0.0.0 es accesible para todo lo que alcanza
    la máquina. Muchos programas (bases de datos, cachés como Redis) se
    instalan abiertos «para que funcionen»; sin contraseña, Redis deja que
    cualquiera lea y escriba todos sus datos, y hay bots que recorren
    internet para encontrarlos. Un escaneo de puertos (nmap) es el primer
    movimiento de una auditoría, como de un ataque: ver lo que ve el
    exterior.

    BUENA PRÁCTICA
    - Dos capas: un cortafuegos que deniega la entrada por defecto y solo
      permite lo necesario (SSH, 80, 443), Y servicios que solo escuchan
      donde deben (bind 127.0.0.1, listen_addresses = 'localhost' para
      PostgreSQL).
    - ss -tlnp para saber quién escucha; repite el escaneo tras cada cambio.
    - Permite SSH ANTES de activar el cortafuegos, y prueba con una conexión
      nueva. Reinicia el servicio para que relea su configuración.
    - Para un servicio que debe seguir accesible desde una máquina concreta:
      una regla de ufw limitada a su dirección (ufw allow from 192.0.2.30 to
      any port 5432).

    OTRA MANERA
    nftables (o iptables) hace el mismo trabajo que ufw, con más detalle, y
    ufw no es más que una interfaz: el principio es el mismo (política por
    defecto, reglas, orden). Redis también puede escuchar solo en un socket
    Unix (unixsocket, port 0), sin ningún puerto de red.

    DOCUMENTACIÓN
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - Seguridad de Redis: https://redis.io/docs/latest/operate/oss_and_stack/management/security/
    - Conexiones de PostgreSQL: https://www.postgresql.org/docs/current/runtime-config-connection.html
