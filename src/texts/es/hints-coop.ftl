### Pistas graduales de La Cooperativa (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en
### names.ftl.

## Capítulo 1 — La marcha

hint-departure-backup =
    .lead = Antes de cerrar nada: ¿qué ejecuta Marc con su cuenta? Su crontab (como root) lanza un script guardado en su carpeta personal. La tarea tiene que sobrevivir a su marcha: el script fuera de /home, y una cuenta que se quede para ejecutarlo.
    .solution = sudo cp /home/marc/bin/copia-caja.sh /usr/local/bin/, luego sudo crontab -e y la línea: 30 2 * * * /usr/local/bin/copia-caja.sh (el crontab de root)
hint-departure-closed =
    .lead = Cerrar los accesos es cerrarlos en todas partes: su cuenta (usermod -L solo bloquea la contraseña, no la clave SSH: vuelve a leer man usermod), el grupo sudo, su clave en la cuenta deploy (solo su línea), y su sesión todavía abierta (who, ps -u marc).
    .solution = sudo usermod -e 1 marc (la cuenta caduca), sudo gpasswd -d marc sudo, sudo nano /home/deploy/.ssh/authorized_keys (borra solo la línea marc@portatil), y luego sudo pkill -u marc
hint-departure-end =
    .lead = Falta una pieza: repasa el correo de Awa punto por punto. Marc no debe entrar por ningún camino, la CI y Lina conservan sus claves en deploy, y la copia nocturna se ejecuta como root o deploy.
    .solution = sudo crontab -l (¿está la copia?), sudo cat /home/deploy/.ssh/authorized_keys (deploy@ci y lina@taller presentes, marc@portatil fuera), sudo chage -l marc, groups marc, who

## Capítulo 2 — Permisos compartidos

hint-shared-rights-directory =
    .lead = ls -l /srv/till/extractos: la carpeta pertenece a root, y cada extracto al grupo de su autor. Hace falta una carpeta del grupo till, en la que el grupo pueda escribir, y cuyo bit setgid transmita su grupo a todo lo que se cree dentro (man chmod).
    .solution = sudo chgrp -R till /srv/till/extractos, sudo chmod -R g+w /srv/till/extractos, y luego sudo chmod g+s /srv/till/extractos (ls -ld muestra drwxrwsr-x)
hint-shared-rights-mask =
    .lead = Los próximos archivos de Lina y Karim nacerán rw-r--r--: es su máscara (umask 022). Se fija al conectarse, en su ~/.profile o para todo el mundo en /etc/profile.d (man umask).
    .solution = sudo nano /home/lina/.profile y sudo nano /home/karim/.profile: sustituye #umask 022 por umask 002 (o un archivo /etc/profile.d/umask-team.sh que contenga umask 002)
hint-shared-rights-sudo =
    .lead = Una regla sudo para el grupo till, en su propio archivo de /etc/sudoers.d (sin punto en el nombre), escrita con visudo, que comprueba antes de guardar. El comando se escribe con su ruta completa (which) y sus argumentos, para que no se permita nada más (man sudoers).
    .solution = sudo visudo -f /etc/sudoers.d/till, con la línea %till ALL=(root) /usr/bin/systemctl restart till — y luego sudo -l -U lina para comprobarlo
hint-shared-rights-end =
    .lead = ¿Carpeta, máscara y sudo, todo listo? Mira lo que ya había en la carpeta: los extractos de ayer también deben pertenecer al grupo till y poder modificarlos el grupo.
    .solution = ls -l /srv/till/extractos, y luego sudo chgrp -R till /srv/till/extractos y sudo chmod -R g+w /srv/till/extractos

## Capítulo 3 — El secreto

hint-secret-closed =
    .lead = Pide tú mismo /.env al sitio con curl: nginx sirve toda la carpeta de la aplicación, archivos ocultos incluidos (.env, pero también .git). En la configuración del sitio, una location con una expresión regular puede rechazar cualquier ruta que contenga «/.» (la documentación de location y deny).
    .solution = sudo nano /etc/nginx/sites-available/coop: añade location ~ /\. {"{"} deny all; {"}"} en el bloque server, y luego sudo nginx -t y sudo systemctl reload nginx
hint-secret-attacker =
    .lead = ¿Quién se llevó la clave? El registro de accesos de nginx (/var/log/nginx/access.log) guarda cada petición de /.env, con la dirección y la respuesta 200. Una directiva de nginx rechaza una dirección.
    .solution = sudo grep '\.env' /var/log/nginx/access.log (es 203.0.113.77), y luego deny 203.0.113.77; en el bloque server del sitio, y sudo systemctl reload nginx
hint-secret-key-written =
    .lead = La clave antigua está desactivada: la nueva está en el correo de Awa, y va en el archivo .env de la aplicación de la caja (/srv/till/app).
    .solution = sudo nano /srv/till/app/.env: sustituye el valor de CLAVE_PAGO= por la nueva clave del correo
hint-secret-end =
    .lead = La nueva clave está escrita, pero la aplicación solo lee su .env al arrancar. Su ruta /health te dice qué clave usa.
    .solution = sudo systemctl restart till, y luego curl http://127.0.0.1:3000/health ("pago": "ok")

## Capítulo 4 — El proxy

hint-proxy-end =
    .lead = Compara los dos registros: nginx ve al robot (198.51.100.66), la caja solo ve 127.0.0.1. nginx tiene que transmitir la dirección del cliente en una cabecera (proxy_set_header), y la aplicación solo debe creerse esa cabecera cuando viene de nginx (TRUST_PROXY, guía de Express «behind proxies»): no true, el robot escribe su propio X-Forwarded-For.
    .solution = En la location /till/ de /etc/nginx/sites-available/coop: proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; — en /srv/till/app/.env: TRUST_PROXY=loopback — y luego sudo systemctl reload nginx y sudo systemctl restart till

## Capítulo 5 — Las actualizaciones

hint-updates-a-day =
    .lead = apt solo conoce las versiones nuevas después de volver a leer los repositorios (man apt: primero update, luego upgrade). El wifi se va a cortar: una operación larga va en una sesión que sobreviva a la conexión (man tmux). Si se interrumpió dpkg, apt te dice qué ejecutar.
    .solution = sudo apt update, luego tmux new -s upgrade y sudo apt upgrade; si se corta la conexión: ssh cooperativa y tmux attach -t upgrade (sin tmux: sudo dpkg --configure -a, y luego sudo apt upgrade)
hint-updates-till-down =
    .lead = Los paquetes están instalados, pero uname -r sigue dando el kernel antiguo. Un archivo de /var/run dice por qué hay que reiniciar.
    .solution = cat /var/run/reboot-required.pkgs, y luego sudo reboot (y ssh cooperativa para volver)
hint-updates-end =
    .lead = Después de un reinicio, solo vuelven los servicios habilitados. Comprueba el sitio y la caja (systemctl --failed, systemctl status till: «disabled»).
    .solution = sudo systemctl enable --now till (habilitada en el arranque, y arrancada ya)

## Capítulo 6 — Las actualizaciones automáticas

hint-auto-updates-end =
    .lead = Todo está en /etc/apt/apt.conf.d: 20auto-upgrades enciende o apaga las tareas diarias (a «0», no pasa nada), 50unattended-upgrades fija el informe (Mail), el reinicio y su hora (Automatic-Reboot-Time, de noche). Deja Origins-Pattern como está: nodejs viene de otro repositorio. Luego lanza el servicio que hace el trabajo cada mañana (systemctl list-timers).
    .solution = En 20auto-upgrades: los dos valores a «1»; en 50unattended-upgrades, descomenta Unattended-Upgrade::Mail "root";, Automatic-Reboot "true"; y Automatic-Reboot-Time "02:00"; — y luego sudo systemctl start apt-daily-upgrade
