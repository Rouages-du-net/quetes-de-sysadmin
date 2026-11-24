### Las pistas graduadas de la historia «Los Refugios»: una dirección, y
### luego casi la respuesta, para cada paso (ver src/engine/hints.ts).

## Capítulo 1 — Reunir los registros

hint-central-logs-silent =
    .lead = ¿Escucha aquí algo a los refugios? (man ss: -u, -l, -n, -p; la configuración de rsyslog: /etc/rsyslog.conf)
    .solution = ss -ulnp no muestra nada en 514; en /etc/rsyslog.conf, module(load="imudp") e input(type="imudp" port="514") están comentados.
hint-central-logs-listening =
    .lead = Activa la recepción UDP, comprueba la configuración, reinicia rsyslog (man rsyslogd: -N1).
    .solution = Descomenta las dos líneas imudp de /etc/rsyslog.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
hint-central-logs-end =
    .lead = Deja pasar a los refugios por el cortafuegos (man ufw), y luego una regla para sus mensajes: un archivo por refugio, y nada en syslog (man rsyslog.conf: template, stop).
    .solution = sudo ufw allow from 198.51.100.0/24 to any port 514 proto udp; en /etc/rsyslog.d/10-remote.conf: una plantilla "/var/log/remote/%HOSTNAME%.log", y luego if $fromhost-ip startswith '198.51.100.' then {"{"} action(type="omfile" dynaFile="…") stop {"}"}; reinicia rsyslog.

## Capítulo 2 — El journal lleno

hint-journal-full-disk =
    .lead = ¿Adónde va el espacio? (man df, man du: -s, -h)
    .solution = df -h: / al 93 %; sudo du -sh /var/log/* /var/lib/*: /var/log/journal ocupa 6G.
hint-journal-full-journal =
    .lead = ¿Cuánto ocupa el journal, y cómo se recorta? (man journalctl: --disk-usage, --vacuum-size)
    .solution = journalctl --disk-usage, y luego sudo journalctl --vacuum-size=500M.
hint-journal-full-end =
    .lead = Para que se quede pequeño: un límite para journald, que lee al arrancar (man journald.conf: SystemMaxUse=).
    .solution = SystemMaxUse=500M en {"["}Journal] de /etc/systemd/journald.conf, y luego sudo systemctl restart systemd-journald.

## Capítulo 3 — Inicios de sesión fallidos

hint-ssh-alerts-failures =
    .lead = ¿Qué aspecto tiene un inicio de sesión fallido en el archivo de un refugio? (grep en /var/log/remote)
    .solution = sudo grep Failed /var/log/remote/refugio-lago.log: sshd[…]: Failed password for invalid user admin from…
hint-ssh-alerts-rule =
    .lead = Una regla con una condición sobre el programa y sobre el mensaje (man rsyslog.conf: if … then).
    .solution = if $programname == 'sshd' and $msg contains 'Failed password' then /var/log/remote/ssh-failures.log
hint-ssh-alerts-end =
    .lead = Las reglas se ejecutan en orden, y los mensajes de los refugios se paran en la regla por refugio (10-remote.conf): pon la tuya antes, y luego reinicia rsyslog.
    .solution = Tu regla en /etc/rsyslog.d/05-ssh-failures.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
