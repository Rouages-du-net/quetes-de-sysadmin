### Pistas graduales de Las Cartas del Barrio (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta). Los nombres de lugares,
### como en names.ftl.

## Capítulo 1 — Cerrar la puerta

hint-shut-the-door-closed =
    .lead = Dos opciones en /etc/ssh/sshd_config (man sshd_config): PermitRootLogin y PasswordAuthentication. Pero mira la línea Include del principio: para sshd, gana el primer valor leído. sshd -t comprueba, y luego hay que recargar el servicio.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no; en /etc/ssh/sshd_config.d/50-cloud-init.conf: PasswordAuthentication no. Luego sudo sshd -t y sudo systemctl reload ssh (sudo sshd -T muestra los valores en vigor).
hint-shut-the-door-end =
    .lead = La puerta está cerrada; ahora demuestra que todavía puedes entrar. Una sesión ya abierta no demuestra nada: hace falta una nueva.
    .solution = exit y luego, desde tu puesto: ssh cartas (y ssh root@cartas debe ser rechazado).

## Capítulo 2 — El cortafuegos

hint-firewall-listening =
    .lead = Antes de cerrar puertas, mira qué programas escuchan en qué puertos, en el propio servidor (man ss).
    .solution = ss -tlnp (sockets TCP en escucha, en números; 3306 es MariaDB).
hint-firewall-filter =
    .lead = Una vez activado, ufw rechaza por defecto el tráfico entrante; basta con permitir lo que debe seguir abierto (SSH, http, https) ANTES de activarlo (man ufw, ufw app list).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full" y luego sudo ufw enable (y sudo ufw status verbose para comprobarlo).
hint-firewall-end =
    .lead = El cortafuegos filtra; demuestra que SSH sigue pasando, con una conexión nueva desde tu puesto.
    .solution = exit y luego ssh cartas.

## Capítulo 3 — El centinela

hint-sentinel-rania =
    .lead = Rania (198.51.100.40) está en la jaula sshd de fail2ban. fail2ban-client puede mostrar el estado de una jaula, y levantar un baneo.
    .solution = sudo fail2ban-client status sshd y luego sudo fail2ban-client set sshd unbanip 198.51.100.40
hint-sentinel-set =
    .lead = No toques jail.conf: los ajustes van en /etc/fail2ban/jail.local (man jail.conf). Hace falta un bantime de al menos una hora, e ignoreip para Rania y para tu puesto (su dirección está en journalctl -u ssh). Luego recarga fail2ban.
    .solution = sudo nano /etc/fail2ban/jail.local: [DEFAULT], bantime = 1h, ignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40; luego sudo fail2ban-client -t y sudo systemctl reload fail2ban
hint-sentinel-end =
    .lead = Después de la recarga, comprueba el estado de la jaula: los robots baneados, ni Rania ni tú.
    .solution = sudo fail2ban-client status sshd

## Capítulo 4 — Compartir casa

hint-sharing-cafe =
    .lead = En Debian, un sitio nginx = un archivo en /etc/nginx/sites-available, habilitado por un enlace simbólico en sites-enabled (ver nota_de_rania.txt). El sitio del café tiene su propio server_name y su raíz /var/www/cafe, sin default_server.
    .solution = sudo cp /etc/nginx/sites-available/letters /etc/nginx/sites-available/cafe, sustituye en él letters por cafe y quita default_server (sudo nano), luego sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/, sudo nginx -t y sudo systemctl reload nginx
hint-sharing-end =
    .lead = La agenda escucha en 127.0.0.1:3000 y sus páginas empiezan en /: nginx debe pasarle /agenda/, quitando ese prefijo (proxy_pass, y la barra final). Y el servicio agenda debe funcionar, incluso después de un reinicio (man systemctl).
    .solution = En /etc/nginx/sites-available/letters: location /agenda/ {"{"} proxy_pass http://127.0.0.1:3000/; {"}"}; sudo nginx -t, sudo systemctl reload nginx y luego sudo systemctl enable --now agenda

## Capítulo 5 — En mi máquina funciona

hint-works-for-me-end =
    .lead = /etc/hosts solo cuenta para una máquina: hay que corregir la zona cafe.example (/etc/bind/zones/db.cafe.example, ver ayuda_dns.txt). Dirección nueva, un www, un número de serie mayor para que ns2 vuelva a copiar la zona, y el punto final de los nombres completos.
    .solution = sudo nano /etc/bind/zones/db.cafe.example: 203.0.113.10 en lugar de 198.51.100.80, serial 2027032001, y la línea www IN CNAME cafe.example. (con el punto); luego named-checkzone cafe.example /etc/bind/zones/db.cafe.example y sudo rndc reload

## Capítulo 6 — Noche de concierto

hint-concert-robot =
    .lead = ¿Quién pide qué? El registro de accesos de nginx tiene una línea por petición; awk la corta en campos (la dirección es el primero, ver ayuda_registros.txt), sort y uniq -c los cuentan.
    .solution = awk '{"{"}print $1{"}"}' /var/log/nginx/access.log | sort | uniq -c | sort -n (dominan tres direcciones en 198.51.100.x).
hint-concert-end =
    .lead = Bloquear direcciones no durará: limita el ritmo por dirección (limit_req_zone en el contexto http, limit_req en la location de la agenda). Un navegador pide una página y sus cuatro archivos a la vez: sin ráfaga (burst), también se rechaza a las visitas de verdad.
    .solution = Al principio de /etc/nginx/sites-available/letters: limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s; y en location /agenda/: limit_req zone=agenda burst=10 nodelay; luego sudo nginx -t y sudo systemctl reload nginx

## Capítulo 7 — El puerto

hint-port-two-ports =
    .lead = Abre la puerta nueva sin cerrar la antigua: sshd puede escuchar en varios puertos (varias líneas Port, man sshd_config), y el cortafuegos debe dejar pasar el nuevo.
    .solution = En /etc/ssh/sshd_config: Port 22 y Port 2222; luego sudo sshd -t, sudo ufw allow 2222/tcp y sudo systemctl reload ssh
hint-port-attempt =
    .lead = Prueba la puerta nueva desde tu puesto. Para que ssh cartas vaya ahí solo, el ~/.ssh/config del puesto tiene una opción Port (man ssh_config).
    .solution = exit y luego, en el puesto: nano ~/.ssh/config, añade Port 2222 bajo Host cartas, y ssh cartas (acepta la clave del servidor en ese puerto: yes).
hint-port-end =
    .lead = La puerta nueva funciona: cierra la antigua, en sshd y en ufw. Luego fail2ban: su jaula sshd sigue vigilando el puerto «ssh» (22). Un puerto puesto en [DEFAULT] no basta, hace falta la sección propia de la jaula.
    .solution = Quita Port 22 de sshd_config, sudo systemctl reload ssh, sudo ufw delete allow OpenSSH; en /etc/fail2ban/jail.local, [sshd] port = 2222, y luego sudo systemctl reload fail2ban

## Capítulo 8 — Reincidentes

hint-repeat-offenders-repeat-offence =
    .lead = jail.conf describe una jaula recidive, desactivada: lee fail2ban.log y banea durante mucho tiempo las direcciones ya baneadas varias veces. Actívala en su propia sección de jail.local, no en [DEFAULT].
    .solution = Añade a /etc/fail2ban/jail.local: [recidive] y luego enabled = true; sudo fail2ban-client -t y sudo systemctl reload fail2ban
hint-repeat-offenders-agenda =
    .lead = El robot de la agenda llena /var/log/nginx/error.log de «limiting requests». Una jaula de jail.conf lee exactamente esas líneas: busca las jaulas de nginx (grep "^\[" /etc/fail2ban/jail.conf).
    .solution = Añade a /etc/fail2ban/jail.local: [nginx-limit-req] y luego enabled = true; sudo systemctl reload fail2ban
hint-repeat-offenders-end =
    .lead = Las jaulas están cargadas: comprueba a quién banean (a los reincidentes y al robot, pero ni a Rania ni a las visitas).
    .solution = sudo fail2ban-client status, y luego sudo fail2ban-client status recidive y sudo fail2ban-client status nginx-limit-req

## Capítulo 9 — El Café de Reparaciones

hint-repair-cafe-busy =
    .lead = apt dijo «Job for apache2.service failed». systemctl status apache2 y journalctl -u apache2 dicen por qué; sudo ss -tlnp muestra quién escucha en qué puerto.
    .solution = journalctl -u apache2: «Address already in use» en el puerto 80; sudo ss -tlnp: nginx lo ocupa.
hint-repair-cafe-listening =
    .lead = Los puertos de Apache están en /etc/apache2/ports.conf (Listen). Rania lo espera en 127.0.0.1:8080, como la agenda. Luego arranca el servicio.
    .solution = sudo nano /etc/apache2/ports.conf: Listen 127.0.0.1:8080 en lugar de Listen 80; sudo apache2ctl configtest; sudo systemctl restart apache2
hint-repair-cafe-site =
    .lead = sudo apache2ctl -S lista los sitios que ha leído Apache: ¿está el del café? Apache solo lee de sites-enabled los archivos que terminan en .conf (man a2ensite). Y el VirtualHost del sitio debe estar en el puerto donde escucha Apache.
    .solution = sudo a2ensite repair; en /etc/apache2/sites-available/repair.conf, <VirtualHost 127.0.0.1:8080> (o *:8080); sudo apache2ctl configtest; sudo systemctl reload apache2; curl -H "Host: repair.example" http://127.0.0.1:8080/
hint-repair-cafe-proxy =
    .lead = El sitio nginx del café está listo en /etc/nginx/sites-available/repair, pero no habilitado (como el del café, en «Compartir casa»).
    .solution = sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/; sudo nginx -t; sudo systemctl reload nginx; curl http://repair.example/
hint-repair-cafe-rewrite =
    .lead = /guide/42 no es un archivo: una regla del .htaccess de /var/www/repair transforma la dirección. Apache solo lee los .htaccess si AllowOverride lo permite (man apache2ctl), y RewriteRule viene de un módulo (man a2enmod). El registro de errores del sitio dice qué falla.
    .solution = En el VirtualHost de repair.conf: <Directory /var/www/repair>, AllowOverride All, </Directory> (tres líneas); sudo a2enmod rewrite; sudo apache2ctl configtest; sudo systemctl restart apache2; curl http://repair.example/guide/42
hint-repair-cafe-end =
    .lead = Compruébalo todo: Apache habilitado en el arranque y solo en 127.0.0.1, http://repair.example/ y /guide/42 a través de nginx, letters.example intacto.
    .solution = systemctl is-enabled apache2; sudo ss -tlnp; curl http://repair.example/guide/42; curl http://letters.example/
