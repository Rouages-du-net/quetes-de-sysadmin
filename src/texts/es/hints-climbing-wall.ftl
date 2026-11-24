### Pistas graduales de «El Rocódromo» (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — El último corte

hint-last-cut-blind =
    .lead = ¿Qué escribió upsmon (el servicio nut-monitor) en el diario, antes y después del fallo del martes? journalctl puede mostrar una unidad y un arranque anterior.
    .solution = journalctl --list-boots; sudo journalctl -u nut-monitor -b -1 | tail
hint-last-cut-renamed =
    .lead = ¿Qué nombres de SAI sirve upsd? Pregúntaselo (man upsc), o lee las secciones de ups.conf.
    .solution = upsc -l; upsc hallups; sudo cat /etc/nut/ups.conf
hint-last-cut-watching =
    .lead = Haz que la línea MONITOR de upsmon nombre el SAI que sirve upsd, luego haz que upsmon vuelva a leer su configuración y comprueba que se ha conectado.
    .solution = sudo nano /etc/nut/upsmon.conf: MONITOR hallups@localhost 1 upsmon … primary; sudo systemctl reload nut-monitor; upsc -c hallups
hint-last-cut-drill =
    .lead = El rocódromo está cerrado: la documentación de NUT prueba todo el apagado enviando a upsmon un apagado forzado (man upsmon, -c). Luego vuelve a conectarte y lee el final del arranque anterior.
    .solution = sudo upsmon -c fsd; luego vuelve a hacer ssh seguro y sudo journalctl -b -1 | tail -20
hint-last-cut-stayed-off =
    .lead = ¿Qué hace el firmware de seguro cuando vuelve la corriente? El BMC lo sabe (man ipmitool: chassis).
    .solution = sudo ipmitool chassis status; sudo ipmitool chassis policy list
hint-last-cut-policy =
    .lead = Configura la política de restauración de energía para que seguro arranque cada vez que vuelva su corriente.
    .solution = sudo ipmitool chassis policy always-on
hint-last-cut-end =
    .lead = ¿Todo en su sitio? upsmon vigilando hallups como primario, MINSUPPLIES 1, un SHUTDOWNCMD que detiene, always-on, y un simulacro más en el que seguro vuelve solo.
    .solution = upsc -c hallups; grep -E 'MONITOR|MINSUPPLIES|SHUTDOWNCMD' /etc/nut/upsmon.conf; sudo ipmitool chassis status; sudo upsmon -c fsd

## Capítulo 2 — Apagado en orden

hint-down-in-order-listen =
    .lead = ¿Dónde escucha upsd? harness tiene que llegar a él por la dirección de oficina de seguro (man upsd.conf: LISTEN; solo se lee al arrancar).
    .solution = sudo ss -tlnp | grep 3493; sudo nano /etc/nut/upsd.conf: LISTEN 127.0.0.1 3493 y LISTEN 198.51.100.141 3493; sudo systemctl restart nut-server
hint-down-in-order-secondary-user =
    .lead = harness necesita su propia cuenta en upsd.users, con solo lo que necesita un upsmon secundario (man upsd.users).
    .solution = sudo nano /etc/nut/upsd.users: [harness], password = …, upsmon secondary; sudo systemctl reload nut-server
hint-down-in-order-firewall =
    .lead = El cortafuegos de seguro descarta lo que no permite: deja que harness, y solo harness, llegue al puerto 3493.
    .solution = sudo ufw allow from 198.51.100.142 to any port 3493 proto tcp
hint-down-in-order-secondary =
    .lead = En harness: di qué SAI seguir, en qué servidor, como qué (man upsmon.conf: MONITOR); el modo en nut.conf; luego el servicio, arrancado y habilitado.
    .solution = ssh harness; sudo nano /etc/nut/upsmon.conf: MONITOR hallups@seguro 1 harness … secondary; nut.conf: MODE=netclient; sudo systemctl enable --now nut-monitor; upsc hallups@seguro
hint-down-in-order-drill-crash =
    .lead = harness necesita 150 s para pararse, pero el SAI corta sus enchufes poco después de la parada de seguro. ¿Qué plazo es ese, y dónde se configura (man usbhid-ups)?
    .solution = sudo nano /etc/nut/ups.conf: bajo [hallups], offdelay = 180 y ondelay = 240; luego otro simulacro: sudo upsmon -c fsd
hint-down-in-order-end =
    .lead = Un simulacro más, una vez todo en su sitio: las dos máquinas detenidas antes del corte, las dos de vuelta solas, el upsmon de harness conectado de nuevo.
    .solution = sudo upsmon -c fsd; luego ssh seguro, upsc -c hallups, y ssh harness: sudo journalctl -b -1 | tail

## Capítulo 3 — La batería vieja

hint-old-battery-runtime =
    .lead = ¿Qué dice el SAI de su batería: carga, autonomía, fecha, su última prueba (man upsc)?
    .solution = upsc hallups | grep -E 'battery|test'
hint-old-battery-denied =
    .lead = ¿Qué prueba puede hacer el SAI, y cuál no la vacía? Luego ejecútala con una cuenta que upsd permita (man upscmd, man upsd.users: instcmds).
    .solution = upscmd -l hallups; sudo nano /etc/nut/upsd.users: bajo [admin], instcmds = test.battery.start.quick; sudo systemctl reload nut-server; upscmd -u admin -p … hallups test.battery.start.quick
hint-old-battery-warning =
    .lead = Una prueba rápida tarda unos segundos: lee su resultado.
    .solution = upsc hallups ups.test.result; upsc hallups ups.status
hint-old-battery-date =
    .lead = Dile al SAI cuándo se fabricó su batería: ¿qué variables se pueden escribir (man upsrw)?
    .solution = upsrw -l hallups; upsrw -s battery.mfr.date=2032/12/02 -u admin -p … hallups (actions = SET ya está)
hint-old-battery-passed =
    .lead = Prueba la batería nueva igual que la vieja.
    .solution = upscmd -u admin -p … hallups test.battery.start.quick; luego upsc hallups ups.test.result
hint-old-battery-alerts =
    .lead = Haz que upsmon pase ONBATT y ONLINE a upssched, y que upssched solo envíe un correo si la corriente sigue sin volver tras un rato (man upssched, man upssched.conf; Haruto dejó un CMDSCRIPT).
    .solution = upsmon.conf: NOTIFYCMD /usr/sbin/upssched; upssched.conf: CMDSCRIPT /usr/local/bin/ups-alert, PIPEFN y LOCKFN sin comentar, AT ONBATT * START-TIMER onbatt 60, AT ONLINE * CANCEL-TIMER onbatt online; sudo systemctl reload nut-monitor
hint-old-battery-end =
    .lead = Todo: una prueba superada tras el cambio, la fecha nueva, alertas que ignoran un parpadeo y avisan de un corte, ninguna prueba profunda en curso.
    .solution = upsc hallups | grep -E 'mfr.date|test.result|status'; sudo grep -v '^#' /etc/nut/upssched.conf | grep .
