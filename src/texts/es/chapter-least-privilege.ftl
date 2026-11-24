### Historia «Los Huertos», capítulo «Mínimo privilegio»: la aplicación se
### conecta como root por la red, MariaDB escucha en todas las direcciones.
### Cuentas 'user'@'host', CREATE USER, GRANT, REVOKE, DROP USER,
### unix_socket, mariadb-secure-installation, bind-address, ufw. Los
### comandos, las opciones, las rutas, el SQL y las salidas no se traducen.

chapter-least-privilege = Mínimo privilegio
    .summary = La aplicación de reservas se mudó a un servidor nuevo, y para que volviera a funcionar alguien le dio las llaves de todo: la cuenta root de la base de datos, accesible desde todo internet. Dale a la aplicación lo que necesita, y nada más.

## Archivos

least-privilege-message-halima =
    De: Halima (presidenta, Asociación de Huertos de Greenholme)
    Martes 20 de mayo, 18:10

    Hola otra vez:

    Selin, que nos ayuda con los ordenadores, escaneó anoche nuestras
    direcciones desde la conexión de su casa (se lo pedimos) y está
    preocupada: mira su informe, lo he copiado junto a este mensaje.
    Lwazi mudó el domingo la aplicación a un servidor nuevo, barrow, y
    reconoce que «abrió cosas» para que funcionara. Su nota también está
    aquí.

    ¿Podrías cerrar lo que debería estar cerrado, sin romper el sitio?
    Los miembros están reservando sus parcelas de verano esta semana.

    Halima

least-privilege-scan-selin =
    Escaneo de puertos de las direcciones públicas de la asociación, desde fuera (Selin)
    Lunes 19 de mayo de 2031, 22:41

    Nmap scan report for 192.0.2.131
    Host is up (0.012s latency).
    Not shown: 997 filtered tcp ports (no-response)
    PORT     STATE SERVICE VERSION
    22/tcp   open  ssh     OpenSSH 10.0p2 Debian 7 (protocol 2.0)
    3306/tcp open  mysql   MariaDB 11.8.9-MariaDB-0+deb13u1
    8080/tcp closed http-proxy

    Selin: el 3306 es la base de datos. Cualquiera en internet puede
    probar contraseñas en ella. ¿Es a propósito?

least-privilege-note-lwazi =
    Lwazi, domingo 18 de mayo

    Perdón, tenía prisa. Plotline funciona ahora en barrow
    (198.51.100.134): shed ya no existe. En el primer arranque la
    aplicación recibió «Host '198.51.100.134' is not allowed to connect to
    this MariaDB server», así que:
    - creé root@'%' con una contraseña y la puse en la configuración de la
      aplicación (barrow: /srv/plotline/.env);
    - puse bind-address = 0.0.0.0 en 50-server.cnf «para asegurarme».
    Funciona. Sé que no es bonito. Puedes llegar a barrow con ssh desde
    paleta; sudo también funciona allí.

## Eventos

least-privilege-event-scan =
    3306/tcp open, desde casa de Selin: MariaDB responde a cualquiera en
    internet, en la conexión de la oficina de paleta. Eso por sí solo no
    es una intrusión, pero cada cuenta que acepta conexiones desde '%' se
    puede probar desde cualquier sitio. ¿Quién puede conectarse, desde
    dónde, con qué derechos? (sudo mariadb; SELECT user, host, plugin FROM
    mysql.user; SHOW GRANTS FOR …)
least-privilege-event-accounts =
    Lee las cuentas como 'user'@'host': una cuenta es un nombre Y la
    dirección desde la que puede venir. root@'%' es root desde cualquier
    sitio, con todos los privilegios; las cuentas con un nombre de usuario
    vacío son anónimas (cualquiera, con cualquier nombre);
    plotline@198.51.100.133 es de shed, que ya no existe; la base de datos
    test está abierta a todo el mundo. La aplicación necesita cuatro tipos
    de sentencias sobre una base de datos: ¿qué cuenta le bastaría justo?
least-privilege-event-all-on-all =
    ON *.* da a esa cuenta derechos sobre todas las bases de datos,
    incluidas las tablas de sistema de mysql, y algunos privilegios
    globales le permiten leer archivos, matar conexiones o cambiar la
    configuración del servidor. Una aplicación a la que se le entra lo
    entrega todo. Concede solo sobre plots.*, y solo lo que hace la
    aplicación (man mariadb: GRANT, REVOKE).
least-privilege-event-any-host =
    '%' como host significa «desde cualquier dirección»: con paleta
    escuchando en internet, cualquiera puede probar la contraseña de esa
    cuenta. La aplicación siempre viene de barrow: nombra su dirección (o
    la red interna, '198.51.100.%').
least-privilege-event-app-account =
    Esa cuenta le va a la aplicación: su host es el de barrow, sus
    derechos son SELECT, INSERT, UPDATE y DELETE sobre plots, nada global.
    Ahora la aplicación tiene que usarla: su configuración está en barrow.
least-privilege-event-env-not-loaded =
    El archivo .env dice la cuenta nueva, pero la aplicación sigue
    conectándose como root: leyó su configuración al arrancar, y la
    mantiene en memoria (mira /srv/plotline/LEEME.txt).
least-privilege-event-app-denied =
    La aplicación no puede funcionar con su nueva configuración: { $error }.
    Su registro dice lo mismo (barrow: /var/log/plotline/app.log).
    Comprueba el host de la cuenta, su contraseña (IDENTIFIED BY) frente
    al archivo .env, y sus permisos (SHOW GRANTS FOR …).
least-privilege-event-app-switched =
    Plotline se conecta ahora con su propia cuenta (lo dice el registro de
    barrow) y solo puede tocar plots, con las cuatro sentencias que usa.
    Ya nadie necesita root@'%'.
least-privilege-event-locked-out =
    root@localhost ya no puede entrar por el socket. Si nada más tiene los
    privilegios, ya nadie puede administrar el servidor. Debian guarda una
    segunda entrada: mysql@localhost, con unix_socket, para la cuenta
    mysql del sistema (sudo -u mysql mariadb). Vuelve a poner root:
    ALTER USER root@localhost IDENTIFIED VIA unix_socket;
least-privilege-event-sys-dropped =
    mariadb.sys no es un resto: es una cuenta bloqueada que posee las
    vistas del sistema, mysql.user entre ellas. Sin ella, fallan con «The
    user specified as a definer does not exist». Vuelve a crearla:
    CREATE USER 'mariadb.sys'@'localhost' ACCOUNT LOCK;
least-privilege-event-root-local =
    root ahora es solo para esta máquina, mediante unix_socket: solo entra
    el root del sistema (sudo mariadb), sin contraseña que adivinar.
least-privilege-event-cleanup =
    Ninguna cuenta anónima, ninguna base de datos test abierta a todos,
    ninguna cuenta para un servidor que ya no existe: lo que queda es lo
    que se usa.
least-privilege-event-still-open =
    MariaDB se ha reiniciado, pero sigue escuchando en todas las
    direcciones, y nada filtra delante: el escaneo de Selin seguiría
    encontrando el 3306 abierto. Dónde escucha lo decide bind-address;
    quién puede llegar al puerto también puede ser trabajo del cortafuegos
    (ufw).
least-privilege-event-app-cut =
    La aplicación ya no puede llegar al servidor («Can't connect to
    server»). La base de datos tiene que seguir siendo accesible desde
    barrow, por la red interna: 127.0.0.1 es solo la propia paleta, y una
    regla del cortafuegos tiene que dejar entrar a barrow.
least-privilege-event-network =
    El puerto 3306 está cerrado desde internet, y barrow sigue llegando a
    él por la red interna.
least-privilege-event-end =
    Halima: «Selin ha vuelto a escanear: solo responde ssh. Y las reservas
    no se han parado ni un segundo. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «Mínimo privilegio».

    QUÉ HA PASADO
    Para que la aplicación funcionara en su servidor nuevo, se le había
    dado la cuenta root, desde cualquier dirección, con una contraseña
    escrita en un archivo, y MariaDB escuchaba en todas las direcciones,
    internet incluido. Diste a la aplicación una cuenta propia, solo desde
    barrow, con las cuatro sentencias que necesita sobre su base de datos;
    dejaste root para la propia máquina, por el socket; quitaste lo que
    había dejado una instalación antigua (cuentas anónimas, la base de
    datos test, la cuenta de un servidor que ya no existe); y cerraste el
    puerto a internet.

    BUENA PRÁCTICA
    - Una cuenta por aplicación, nombrada con la dirección de la que
      viene, con los privilegios que necesitan sus sentencias sobre su
      base de datos, nada ON *.*.
    - En Debian, root@localhost usa unix_socket: el root del sistema entra
      sin contraseña, y nadie puede adivinar ninguna. Déjalo así.
    - mariadb-secure-installation quita de una vez las cuentas anónimas,
      la base de datos test y el root remoto, en un servidor nuevo.
    - Escucha solo donde están los clientes (bind-address), y filtra
      delante (ufw): dos cerraduras mejor que una.
    - Una contraseña en un archivo sigue siendo un secreto: haz que ese
      archivo solo lo pueda leer la aplicación (chmod 640, dueño root,
      grupo de la aplicación).

    DOCUMENTACIÓN
    - CREATE USER y los nombres de cuenta: https://mariadb.com/kb/en/create-user/
    - GRANT: https://mariadb.com/kb/en/grant/
    - Autenticación con unix_socket: https://mariadb.com/kb/en/authentication-plugin-unix-socket/
    - mariadb-secure-installation: https://mariadb.com/kb/en/mariadb-secure-installation/
    - Configurar MariaDB para el acceso remoto: https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/
    - La cuenta mariadb.sys: https://mariadb.com/kb/en/mariadbsys-user/
