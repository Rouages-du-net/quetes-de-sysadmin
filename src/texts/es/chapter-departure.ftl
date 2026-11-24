### Historia «La Cooperativa», capítulo «La salida»: retirar todos los
### accesos de un voluntario que se va, sin romper nada. Los comandos, las
### rutas y los nombres de cuenta no se traducen.

chapter-departure = La salida
    .summary = Marc se va: cerrar su cuenta (de verdad), quitar su clave en todas partes, su sudo, su sesión, y conservar la copia de seguridad que hacía.

## Archivos

departure-email-awa =
    De:      Awa (coordinadora de la cooperativa de consumo)
    Para:    tú
    Asunto:  Marc se va

    Como sabes, Marc se muda a Brest a final de semana. Es quien ha cuidado
    del servidor desde el principio: ¡gracias por tomar el relevo! Está de
    acuerdo en que cerremos sus accesos hoy (lo ha devuelto todo, es solo
    una buena práctica).

    Lo que hay que hacer, según él:
    1. su cuenta ya no debe dejar entrar a nadie, de ninguna manera (él
       se conectaba con una clave SSH, man usermod);
    2. ya no debe tener sudo;
    3. su clave también está en la cuenta compartida deploy (la de las
       publicaciones): quita SU clave, pero no la de los demás;
    4. puede que todavía tenga una sesión abierta (who);
    5. y sobre todo: ejecutaba «cosas» con su cuenta. Sé que está la copia
       de seguridad nocturna de la caja: ¡tiene que seguir funcionando!
       (crontab -l -u marc, como root)

    Para sudo, tu contraseña es: rabano-2027

departure-notes-marc =
    Mis notas (Marc)

    - La caja funciona como servicio (till.service), con la cuenta till.
    - Publicaciones: por la cuenta deploy (claves en
      /home/deploy/.ssh/authorized_keys: la CI, Lina y yo).
    - Copia de seguridad: mi script ~/bin/copia-caja.sh, cada noche a las
      2:30, en mi crontab. Habría que rehacerlo bien algún día…

## Eventos

departure-event-lock-only =
    La contraseña de marc está bloqueada… pero él se conectaba con una
    clave SSH, y usermod -L no cambia nada en eso. Vuelve a leer man
    usermod: para cerrar de verdad una cuenta, también hay que hacerla
    caducar (o quitarle su shell de inicio de sesión, o sus claves).
# { $file }: the deploy account's key file
departure-event-deploy-empty =
    Cuidado: ¡faltan claves en { $file }! La CI y Lina ya no podrán publicar
    la caja. Quita solo la línea de Marc (su clave termina en
    marc@portatil). Vuelve a poner las demás: nano, conservando las líneas
    deploy@ci y lina@taller.
departure-event-script-lost =
    La carpeta de Marc ha desaparecido, y con ella su script de copia… y la
    copia de esta noche no se hará (cron ignora el crontab de una cuenta
    borrada).

    Por suerte, la copia de ayer contiene /home: busca en /srv/backups (como
    root). La próxima vez: mira primero lo que ejecuta una cuenta, y luego
    bórrala.
departure-event-task-personal =
    La copia está en TU crontab. Funciona… hasta el día en que tú también
    pases el relevo: es exactamente la trampa de Marc. Una tarea de la
    cooperativa va en el crontab de root (sudo crontab -e), o en un archivo
    de /etc/cron.d, y su script fuera de cualquier carpeta personal (por
    ejemplo /usr/local/bin).
departure-event-backup =
    La copia de la caja ya no depende de la cuenta de Marc: su script está
    fuera de /home/marc, y lo ejecuta una cuenta que se queda.
departure-event-closed =
    Marc ya no puede entrar: ni por su cuenta, ni por deploy, ya no tiene
    sudo, ni ninguna sesión abierta.
departure-event-end =
    Todo está cerrado y no se ha roto nada. Awa: «Marc te da las gracias… ¡y
    bienvenida o bienvenido al equipo!».

    ¡Bien hecho! Has terminado el capítulo «La salida».

    QUÉ HA PASADO
    Cerrar una cuenta no es una sola acción. usermod -L solo bloquea la
    contraseña: una clave SSH sigue pasando. Hay que hacer caducar la cuenta
    (usermod -e 1, o chage -E 0), o quitarle su shell, o borrarla. Y los
    accesos también viven en otros sitios: una clave en una cuenta
    compartida, un sitio en el grupo sudo, una sesión todavía abierta, tareas
    programadas de las que depende el equipo.

    BUENA PRÁCTICA
    - Una lista de comprobación de salida: cuenta (caducada o borrada),
      claves (en todas partes, también en las cuentas compartidas), grupos
      (¡sudo!), sesiones (who, pkill -u), el crontab y los servicios de la
      cuenta.
    - Mira lo que ejecuta una cuenta ANTES de borrarla (crontab -l -u,
      ps -u, find / -user).
    - Las tareas del equipo no viven en una cuenta personal: el crontab de
      root o de una cuenta de servicio, /etc/cron.d, temporizadores de
      systemd.
    - Mejor aún: una clave por persona y ninguna cuenta compartida, para
      saber quién hizo qué, y poder quitar un acceso sin molestar a los
      demás.

    DOCUMENTACIÓN
    - usermod: https://man7.org/linux/man-pages/man8/usermod.8.html
    - userdel: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chage: https://man7.org/linux/man-pages/man1/chage.1.html

## The computers named in the team's SSH keys (marc@laptop): host names,
## lowercase, no accents or spaces (shared by the chapters of The Co-op)
departure-host-marc = portatil
departure-host-lina = taller
