### Historia «La Cooperativa», capítulo «Las actualizaciones»: apt upgrade
### por una conexión frágil (tmux), reiniciar por el kernel, y un servicio
### que no vuelve. Los comandos, las rutas y la salida de apt, dpkg y tmux
### (en inglés) no se traducen.

chapter-updates = Las actualizaciones
    .summary = Meses de retraso: apt upgrade por un wifi que se corta (tmux, dpkg --configure -a), un kernel nuevo, y un reinicio que revela un servicio olvidado.

## Archivos

updates-email-awa =
    De:      Awa
    Para:    tú
    Asunto:  Actualizaciones

    Marc nunca actualizó el servidor («funciona, no lo toques»). El
    proveedor de pagos exige que se instalen las correcciones de
    seguridad. Esta mañana, antes de abrir (10:00), ¿podrías:

    1. instalar las actualizaciones (man apt: primero update);
    2. reiniciar el servidor si hace falta;
    3. comprobar que todo funciona después: el sitio Y la caja?

    Ojo: el wifi de la cooperativa se corta de vez en cuando (el router
    está cansado). Si tu conexión se corta en plena actualización…
    Gaspard, del Centro Cívico, me dijo que te hablara de tmux.

    Para sudo: rabano-2027

## Eventos

updates-event-interrupted =
    La conexión se ha cortado en plena actualización, y dpkg con ella:
    algunos paquetes están desempaquetados, pero no configurados. apt se
    niega a seguir hasta que se termine el trabajo: sudo dpkg --configure
    -a (man dpkg).

    La próxima vez, lanza una operación larga en un servidor dentro de
    tmux: sobrevive a la conexión.
updates-event-in-tmux =
    Tu conexión se ha cortado… pero la actualización funcionaba en tmux:
    ha llegado hasta el final, sin ti. Vuelve a engancharte a tu sesión
    (tmux ls, y luego tmux attach) para ver cómo ha terminado.
# { $oldest }: el kernel en marcha; { $new }: el que se acaba de instalar
updates-event-a-day =
    Las actualizaciones están instaladas. Pero el kernel nuevo ({ $new })
    todavía no está en marcha: uname -r sigue diciendo { $oldest }. Mira
    /var/run/reboot-required.pkgs: hay que reiniciar (¡antes de las 10:00!).
updates-event-till-down =
    El servidor se ha reiniciado con el kernel nuevo… pero la caja ya no
    responde. systemctl status till: «disabled». Marc la arrancaba a mano;
    su servicio nunca se habilitó en el arranque (man systemctl: enable).
updates-event-end =
    Las correcciones están instaladas, el kernel nuevo está en marcha, y
    tanto el sitio como la caja han vuelto solos. Son las 9:50. Awa:
    «Justo a tiempo. ¡Abrimos!»

    ¡Bien hecho! Has terminado el capítulo «Las actualizaciones».

    QUÉ HA PASADO
    apt upgrade descarga las versiones nuevas, las desempaqueta, y luego
    las configura. Si la sesión muere en medio, dpkg se queda a medias.
    tmux mantiene la sesión en el servidor: la conexión puede cortarse, el
    trabajo sigue. Un kernel nuevo solo se usa después de un reinicio
    (uname -r), y un reinicio solo arranca los servicios habilitados.

    BUENA PRÁCTICA
    - Actualizaciones de seguridad, a menudo (y automáticas: el paquete
      unattended-upgrades).
    - Las operaciones largas, dentro de tmux (o screen).
    - Lee /var/run/reboot-required antes de decir «ya está», y reinicia a
      una hora que tú elijas.
    - Después de un reinicio: systemctl --failed, y comprueba los
      servicios que importan; todo servicio útil debe estar habilitado
      (enable).

    DOCUMENTACIÓN
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - tmux: https://man.openbsd.org/tmux
    - Debian, las actualizaciones: https://www.debian.org/doc/manuals/debian-reference/ch02.es.html
