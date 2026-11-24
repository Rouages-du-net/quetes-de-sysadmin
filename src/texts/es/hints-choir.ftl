### Pistas graduales de «El Coro» (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta).

## Capítulo 1 — Guardado para siempre

hint-kept-forever-policy =
    .lead = ¿Qué prometió la junta? Lee la política de conservación que menciona Amara.
    .solution = cat /srv/choir/docs/politica-de-conservacion.txt
hint-kept-forever-forever =
    .lead = Compara con lo que guarda el servidor: lista los registros del servidor web, y lee cómo los rota logrotate.
    .solution = ls /var/log/nginx | tail; ls /var/log/nginx | wc -l; cat /etc/logrotate.d/nginx
hint-kept-forever-rotation =
    .lead = Haz que logrotate guarde como mucho treinta días de registros de acceso (man logrotate: daily, rotate, maxage).
    .solution = sudo nano /etc/logrotate.d/nginx: daily, rotate 30 (o conserva weekly con rotate 3, o añade maxage 30); sudo logrotate -d /etc/logrotate.d/nginx
hint-kept-forever-purged =
    .lead = logrotate no quitará los cientos de archivos que dejó atrás su antigua cuenta: encuéntralos por su antigüedad, comprueba la lista, y luego bórralos. Conserva las últimas semanas.
    .solution = find /var/log/nginx -name 'access.log.*' -mtime +30; luego sudo find /var/log/nginx -name 'access.log.*' -mtime +30 -delete
hint-kept-forever-anonymised =
    .lead = Escribe una variable que contenga la dirección truncada (man nginx: map, con una expresión regular para IPv4 y otra para IPv6, y un valor por defecto), un log_format que la use, y dáselo a access_log. Prueba, recarga.
    .solution = en /etc/nginx/conf.d/anonymise.conf: map $remote_addr $remote_addr_anon {"{"} ~(?P<ip>\d+\.\d+\.\d+)\. $ip.0; ~(?P<ip>[^:]+:[^:]+): $ip::; default 0.0.0.0; {"}"} y log_format anonymised '$remote_addr_anon - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"'; luego access_log /var/log/nginx/access.log anonymised; en nginx.conf; sudo nginx -t; sudo systemctl reload nginx
hint-kept-forever-journal =
    .lead = El diario también guarda años (journalctl --disk-usage, ls /var/log/journal/*). Dale a journald una antigüedad máxima (man journald.conf), y luego reinícialo.
    .solution = sudo nano /etc/systemd/journald.conf: MaxRetentionSec=30day bajo [Journal]; sudo systemctl restart systemd-journald
hint-kept-forever-end =
    .lead = Comprueba todo con la política: los registros web (treinta días, direcciones truncadas), el registro de auditoría (doce meses, sin tocar), el diario (treinta días).
    .solution = sudo tail -n 3 /var/log/nginx/access.log; ls -l /var/log/nginx /var/log/choir; journalctl --disk-usage

## Capítulo 2 — La solicitud de acceso

hint-access-request-her-row =
    .lead = Empieza por la base de datos de la aplicación de miembros: qué tablas, y su fila en la tabla de miembros (man psql; la base de datos es choir, su administrador es postgres).
    .solution = sudo -u postgres psql choir -c '\dt'; sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Raman'"
hint-access-request-tables =
    .lead = Otras tablas apuntan a ella por su id (27) o su correo: consulta cada una, y escribe los resultados en la carpeta de la respuesta.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM attendance WHERE member_id = 27" > /srv/choir/solicitudes-rgpd/priya-raman/asistencia.txt (lo mismo para payments; newsletter WHERE email = 'priya.raman@mail.example'; y members WHERE id = 27)
hint-access-request-uploads =
    .lead = El área de miembros guarda los archivos subidos en una carpeta por id de miembro.
    .solution = sudo ls /srv/choir/uploads/27; sudo cp /srv/choir/uploads/27/* /srv/choir/solicitudes-rgpd/priya-raman/
hint-access-request-logs =
    .lead = Busca su correo en los registros, también en los comprimidos con gzip (man zgrep), y conserva solo sus líneas.
    .solution = grep -rl priya.raman /var/log; grep priya.raman@mail.example /var/log/choir/audit.log; zgrep priya.raman@mail.example /var/log/choir/audit.log.1.gz; grep priya.raman@mail.example /var/log/mail.log (cada uno > un archivo de la respuesta)
hint-access-request-old-copy =
    .lead = ¿Está en algún otro sitio del disco? Busca su nombre o su número de teléfono en los archivos del coro.
    .solution = sudo grep -r 'Priya Raman' /srv/choir; sudo grep 'Priya Raman' /srv/choir/exports/phone-tree-2030-10.csv > /srv/choir/solicitudes-rgpd/priya-raman/cadena-telefonica.txt
hint-access-request-end =
    .lead = Comprueba la respuesta: todos sus datos, y los de nadie más (ningún otro correo ni número de teléfono).
    .solution = ls -l /srv/choir/solicitudes-rgpd/priya-raman; grep -rh '@' /srv/choir/solicitudes-rgpd/priya-raman | grep -v priya.raman

## Capítulo 3 — Olvídame

hint-forget-me-found =
    .lead = Encuentra a Tomas en la base de datos, y cada tabla que apunta a él.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Novak'"; luego attendance y payments WHERE member_id = 41, newsletter WHERE email = 'tomas.novak@mail.example'
hint-forget-me-erased =
    .lead = Bórralo de las tablas a las que llega la supresión, y no toques las cuotas (la política guarda los documentos contables diez años).
    .solution = sudo -u postgres psql choir -c "DELETE FROM attendance WHERE member_id = 41; DELETE FROM newsletter WHERE email = 'tomas.novak@mail.example'; DELETE FROM members WHERE id = 41"
hint-forget-me-uploads =
    .lead = Su foto y su formulario de consentimiento están en los archivos subidos, bajo su id.
    .solution = sudo ls /srv/choir/uploads/41; sudo rm /srv/choir/uploads/41/photo.jpg /srv/choir/uploads/41/consent-form.pdf; sudo rmdir /srv/choir/uploads/41
hint-forget-me-purge-broken =
    .lead = ¿Se ha ejecutado alguna vez la purga de Ruben? Mira los temporizadores (todos), el servicio y su diario.
    .solution = systemctl list-timers --all; systemctl cat choir-purge.service; sudo systemctl start choir-purge.service; sudo journalctl -u choir-purge
hint-forget-me-purge =
    .lead = Arregla la cuenta con la que se ejecuta (una con un rol en la base de datos), añade la asistencia al script, recarga systemd, arranca el servicio para probar, y activa el temporizador.
    .solution = sudo nano /etc/systemd/system/choir-purge.service (User=postgres); sudo nano /usr/local/sbin/choir-purge (psql choir -c "DELETE FROM attendance WHERE rehearsed_on < current_date - interval '2 years'"); sudo systemctl daemon-reload; sudo systemctl start choir-purge.service; sudo systemctl enable --now choir-purge.timer
hint-forget-me-snapshots =
    .lead = ¿Qué contienen las copias de seguridad? Lista las instantáneas del repositorio restic (su ubicación y su contraseña están en el script de copia).
    .solution = sudo cat /usr/local/sbin/choir-backup; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
hint-forget-me-trimmed =
    .lead = Olvida las instantáneas de más de unos tres meses, y borra sus datos (man restic: forget, --keep-weekly, --keep-within, --prune). Prueba antes --dry-run.
    .solution = sudo restic -r /var/backups/restic --password-file /root/.restic-pass forget --keep-weekly 13 --prune
hint-forget-me-script =
    .lead = Haz que la copia semanal olvide sola: el mismo forget, con --prune, después de la copia en su script.
    .solution = sudo nano /usr/local/sbin/choir-backup: restic forget --keep-weekly 13 --prune después de restic backup
hint-forget-me-end =
    .lead = Compruébalo todo: Tomas borrado pero sus pagos conservados, el temporizador de la purga activo, las copias recortadas y el script listo.
    .solution = systemctl list-timers; sudo -u postgres psql choir -c "SELECT * FROM payments WHERE member_id = 41"; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
