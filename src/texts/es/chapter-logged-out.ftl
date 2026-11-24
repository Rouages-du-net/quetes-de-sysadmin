### Historia «El Club de Senderismo», capítulo «Sesión cerrada»: un
### contenedor sin root que murió con la sesión de su usuaria. El gestor de
### servicios de la cuenta (user@UID.service), la persistencia (loginctl
### enable-linger), Quadlet (archivos .container, systemctl --user), y un
### reinicio para demostrarlo. Los comandos, las opciones, las rutas y las
### salidas nunca se traducen.

chapter-logged-out = Sesión cerrada
    .summary = La aplicación del club funcionaba sin root, hasta que la voluntaria que la arrancó cerró su sesión: el sitio cayó con ella. Conviértela en un servicio de su propia cuenta, que no necesite a nadie con la sesión abierta y sobreviva a un reinicio.

## Archivos

logged-out-message-ayasha =
    De: Ayasha
    Miércoles 14 de abril, 09:05

    ¡Hola!

    ¡Gracias por lo del lunes! Ayer por la tarde quise probar yo misma.
    Entré como trailbook desde mi PC (ssh trailbook@hito: mi clave está en
    su authorized_keys), borré tu contenedor y arranqué el mío, el mismo
    comando, con el nombre trailbook. El sitio funcionaba. Cerré la sesión a
    las 18:02, y a las 18:02 el sitio se cayó: nginx responde 502 desde
    entonces.

    ¿Entonces el contenedor solo vive mientras alguien tenga la sesión
    abierta como trailbook? No puede ser así como se ejecutan los servicios.
    Necesitamos:
      - Trailbook funcionando sin nadie con la sesión abierta;
      - y que vuelva solo después de un reinicio. La actualización del
        núcleo espera uno de todas formas (/var/run/reboot-required):
        reinicia hito cuando termines, para que lo sepamos seguro.

    La gente de Podman parece recomendar algo llamado Quadlet. No pasé del
    nombre.

    Tu contraseña de sudo no ha cambiado: zigzag-27.

    Ayasha

## Eventos

logged-out-event-logout =
    Ahí está, a las 18:02: la sesión de Ayasha se cierra, y logind detiene
    user@997.service, el gestor de servicios propio de trailbook, con todo lo
    que contiene. Un contenedor sin root arrancado desde una sesión vive en
    ese gestor (podman pone su conmon en un scope debajo). Cuando termina la
    última sesión de la cuenta, el gestor solo se queda si la cuenta
    persiste (man loginctl). E incluso entonces: ¿quién volvería a arrancar
    el contenedor después de un reinicio?
logged-out-event-nohup =
    nohup solo protege un proceso de la señal de colgar cuando su terminal
    se cierra. No es eso lo que detuvo Trailbook: logind detuvo el gestor de
    trailbook, y todo su cgroup con él. Y tras un reinicio nada vuelve a
    arrancar el contenedor. Un contenedor que tiene que seguir en pie es un
    servicio: la manera de Podman es Quadlet (man podman-systemd.unit).
logged-out-event-root-unit =
    Una unidad del sistema que ejecuta podman para trailbook (sudo -u, o
    User=) vuelve a poner el lanzador root, y se pelea con Podman: sin
    sesión de usuario, no hay gestor de cgroups de systemd (los avisos),
    conmon queda fuera de la vista de la unidad, no hay parada limpia. Deja
    que lo ejecute el gestor propio de trailbook: un archivo Quadlet en su
    directorio, y la cuenta persistiendo. Luego quita esta unidad (systemctl
    disable --now, y después el archivo).
logged-out-event-generate =
    podman generate systemd todavía funciona, pero está obsoleto (lo dice):
    escribe una unidad para un contenedor que ya tiene que existir. Podman 5
    recomienda Quadlet: describes el contenedor en un archivo .container, y
    el generador de systemd escribe la unidad en cada daemon-reload.
logged-out-event-quadlet-error =
    Quadlet ha rechazado el archivo: su mensaje nombra la clave y el grupo.
    Las claves de [Container] están todas en man podman-systemd.unit, y
    puedes probar el archivo sin systemd: /usr/libexec/podman/quadlet
    -dryrun -user (como trailbook).
logged-out-event-quadlet =
    El gestor de trailbook ha generado un servicio a partir del
    archivo .container (systemctl --user cat lo muestra: podman run con --replace,
    --rm y --sdnotify=conmon, con el nombre de la unidad). ¿Está arrancado?
    ¿Y arrancará con el gestor al arrancar la máquina? Para eso sirve una
    sección [Install] con WantedBy=default.target en el archivo .container.
logged-out-event-no-bus =
    systemctl --user habla con el gestor de la cuenta a través de su bus,
    que encuentra con $XDG_RUNTIME_DIR, que define un inicio de sesión
    (pam_systemd) y sudo no. Dáselo (export XDG_RUNTIME_DIR=/run/user/$(id
    -u)) una vez que el gestor esté en marcha, o pregunta desde tu propia
    cuenta: sudo systemctl --user -M trailbook@ …. Y el gestor tiene que
    estar en marcha: sin sesión, solo la persistencia lo mantiene.
logged-out-event-generated =
    Una unidad que genera Quadlet no se puede habilitar: no hay ningún
    archivo que enlazar, se vuelve a escribir en cada daemon-reload. Su
    sección [Install] va en el archivo .container: con
    WantedBy=default.target, el generador hace que el gestor la arranque
    cada vez que él arranca.
logged-out-event-linger =
    trailbook persiste: su gestor (user@997.service) arranca con la máquina
    y se queda sin ninguna sesión (/var/lib/systemd/linger/trailbook). Ahora
    el contenedor tiene que ser una de sus unidades.
logged-out-event-not-wanted =
    La unidad funciona, pero nada la arrancará en el próximo arranque: su
    archivo .container no tiene sección [Install] con
    WantedBy=default.target.
logged-out-event-unit-running =
    Trailbook funciona como un servicio del gestor de trailbook. Ayasha
    pidió la prueba: reinicia hito (el núcleo lo espera), vuelve a
    conectarte y comprueba el sitio.
logged-out-event-rebooted =
    hito se ha reiniciado, y el sitio no responde. Mira lo que ha vuelto:
    ¿funciona el gestor de trailbook (systemctl status user@997), arrancó la
    unidad (journalctl -u user@997 -b), persiste la cuenta, quiere
    default.target la unidad?
logged-out-event-end =
    Ayasha: «He entrado, he salido, y las salidas seguían ahí. Luego el
    reinicio, y seguían ahí. ¡Ya puede llegar el sábado!»

    ¡Bien hecho! Has terminado Sesión cerrada.

    QUÉ HA PASADO
    Ayasha arrancó Trailbook desde una sesión ssh como trailbook: podman
    puso el contenedor en el gestor de servicios de la cuenta,
    user@997.service, que logind arrancó con su sesión y detuvo con ella,
    contenedor incluido. Has descrito el contenedor en un archivo Quadlet,
    ~/.config/containers/systemd/trailbook.container; en cada daemon-reload,
    y cada vez que arranca el gestor, el generador de Podman lo convierte en
    trailbook.service. Con WantedBy=default.target en su sección [Install],
    el gestor lo arranca solo. loginctl enable-linger trailbook hace que
    logind arranque el gestor con la máquina y lo mantenga sin ninguna
    sesión. El reinicio ha demostrado toda la cadena.

    BUENA PRÁCTICA
    - Un servicio sin root es una unidad de usuario de su cuenta: Quadlet,
      una sección [Install], y la cuenta persistiendo.
    - Hablar con el gestor de una cuenta con una sesión de verdad,
      $XDG_RUNTIME_DIR definido, o desde root con systemctl --user -M
      CUENTA@.
    - Su registro está en el del sistema (cuentas del sistema): journalctl
      -u user@997, o journalctl --user-unit trailbook.
    - Probar un archivo .container con /usr/libexec/podman/quadlet -dryrun
      -user.
    - Demostrarlo: un reinicio que eliges vale más que un corte que sufres.

    OTRA MANERA
    Una unidad de usuario escrita a mano (~/.config/systemd/user/) también
    puede ejecutar podman, y podman generate systemd escribía una; las dos
    son más difíciles de hacer bien (la limpieza del contenedor, el tipo
    notify) y Podman 5 declara obsoleta la segunda. Quadlet escribe esos
    detalles por ti.

    DOCUMENTACIÓN
    - podman-systemd.unit(5): https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html
    - loginctl(1), enable-linger: https://www.freedesktop.org/software/systemd/man/latest/loginctl.html
    - logind.conf(5), KillUserProcesses y UserStopDelaySec: https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
    - systemctl(1), --user y --machine: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
