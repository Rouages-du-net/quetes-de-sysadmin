### Pistas graduadas de El Club de Senderismo (ver src/engine/hints.ts): un
### mensaje por etapa, hint-<capítulo>-<evento>, con .lead (una dirección,
### sin el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — Sin root

hint-no-root-needed-single-mapping =
    .lead = Trabaja como trailbook, no como root, y deja que podman te diga lo que le falta: descarga la imagen que nombran las notas de Bolat.
    .solution = sudo -iu trailbook, luego podman pull registry.example/openpaths/trailbook:2.3; luego cat /etc/subuid /etc/subgid
hint-no-root-needed-ranges =
    .lead = Dale a trailbook su propio bloque de 65536 uid y gid subordinados, después del último bloque de /etc/subuid y /etc/subgid (man usermod).
    .solution = sudo usermod --add-subuids 296608-362143 --add-subgids 296608-362143 trailbook
hint-no-root-needed-stale-namespace =
    .lead = Podman conserva el espacio de nombres antiguo de la cuenta: el final de su mensaje de error nombra el comando que lo reconstruye.
    .solution = como trailbook: podman system migrate, y luego podman pull otra vez
hint-no-root-needed-pulled =
    .lead = Con la imagen en el almacenamiento de trailbook, arranca el contenedor como Bolat, pero piensa en el puerto: ¿quién escucha ya en el 80?
    .solution = como trailbook: podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-port-80 =
    .lead = nginx tiene el 80 y el 443 y pasa el sitio a 127.0.0.1:8080 (/etc/nginx/sites-enabled/walks): publica el contenedor ahí.
    .solution = podman rm trailbook; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
hint-no-root-needed-cant-write =
    .lead = Compara quién es propietario de los datos en el anfitrión, y en el espacio de nombres de trailbook (podman unshare). Luego cede los datos al propietario correcto (man podman-run: la opción de volumen U).
    .solution = sudo chown -R trailbook:trailbook /srv/trailbook/data; como trailbook: podman rm trailbook; podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v /srv/trailbook/data:/data:U registry.example/openpaths/trailbook:2.3
hint-no-root-needed-running =
    .lead = Comprueba el sitio como llegan a él los visitantes, a través de nginx, y que no queda ningún contenedor root ni permisos abiertos.
    .solution = curl -k https://walks.openpaths.example/; sudo podman ps -a; ls -l /srv/trailbook/data
hint-no-root-needed-end =
    .lead = ¿Todo en su sitio? Los rangos propios de trailbook, su contenedor sirviendo /srv/trailbook/data en el 8080, el sitio a través de nginx, nada como root, nada de 777, los ajustes de puertos intactos.
    .solution = cat /etc/subuid; sudo -u trailbook podman ps; curl -k https://walks.openpaths.example/; sysctl net.ipv4.ip_unprivileged_port_start

## Capítulo 2 — Sesión cerrada

hint-logged-out-logout =
    .lead = ¿Qué pasó ayer a las 18:02? El registro de esa hora: la sesión ssh, logind y el gestor de servicios de trailbook.
    .solution = sudo journalctl --since "2033-04-13 18:00" --until "2033-04-13 18:05"
hint-logged-out-quadlet =
    .lead = Describe el contenedor en un archivo Quadlet en el directorio de trailbook (man podman-systemd.unit: [Container], Image=, PublishPort=, Volume=, y una sección [Install]).
    .solution = sudo -iu trailbook; nano ~/.config/containers/systemd/trailbook.container: [Container] Image=registry.example/openpaths/trailbook:2.3 PublishPort=127.0.0.1:8080:8080 Volume=/srv/trailbook/data:/data:U [Install] WantedBy=default.target
hint-logged-out-linger =
    .lead = El gestor de trailbook tiene que funcionar sin nadie con la sesión abierta, desde el arranque (man loginctl).
    .solution = sudo loginctl enable-linger trailbook
hint-logged-out-no-bus =
    .lead = systemctl --user encuentra el gestor con $XDG_RUNTIME_DIR, que sudo no define; o pregunta desde root con -M.
    .solution = como trailbook: export XDG_RUNTIME_DIR=/run/user/$(id -u); systemctl --user daemon-reload; systemctl --user start trailbook
hint-logged-out-unit-running =
    .lead = Ahora la prueba que pidió Ayasha: reinicia portillo, vuelve a conectarte, comprueba el sitio.
    .solution = sudo reboot; ssh portillo; curl -k https://walks.openpaths.example/
hint-logged-out-rebooted =
    .lead = ¿Qué hizo el gestor de trailbook al arrancar? Su registro, la persistencia de la cuenta, la sección [Install] de la unidad.
    .solution = sudo journalctl -u user@997 -b; loginctl show-user trailbook -p Linger; sudo cat /var/lib/trailbook/.config/containers/systemd/trailbook.container
hint-logged-out-end =
    .lead = ¿Todo en su sitio? trailbook persistiendo, su unidad Quadlet querida por default.target, arrancada por el gestor en este arranque, el sitio respondiendo.
    .solution = loginctl list-users; sudo systemctl --user -M trailbook@ status trailbook; curl -k https://walks.openpaths.example/
