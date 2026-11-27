### Pistas graduadas de La Auditoría (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el
### comando exacto) y .solution (casi la respuesta: el comando, con lo que
### hace). Los nombres de lugares son los de names.ftl.

## Capítulo 2 — El informe

hint-report-ssh =
    .lead = Hallazgo C1: una opción de /etc/ssh/sshd_config (man sshd_config). Después de cambiarla, sshd tiene que releer su configuración: compruébala antes (man sshd) y luego haz que el servicio la recargue.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no. Luego sudo sshd -t, sudo systemctl reload ssh (y sudo sshd -T | grep permitroot para ver lo que se aplica).
hint-report-account =
    .lead = Hallazgo C2: la cuenta de Lucas ya no debe servir para nada. Lo más limpio es borrarla (man userdel); si no, bloquearla, hacerla caducar Y sacarla del grupo sudo (man usermod, man chage, man gpasswd).
    .solution = sudo userdel lucas (añade -r para borrar la carpeta personal). O bien: sudo usermod -L -e 1 lucas, y luego sudo gpasswd -d lucas sudo.
hint-report-sudo =
    .lead = Hallazgo C3: sudo -l muestra las reglas de tu cuenta. Una viene de un archivo de /etc/sudoers.d, escrito por cloud-init. Un archivo sudoers se edita con visudo (man visudo, man sudoers).
    .solution = sudo grep -r NOPASSWD /etc/sudoers.d encuentra el archivo; sudo visudo -f /etc/sudoers.d/90-cloud-init-users, quita el NOPASSWD: (o borra el archivo con sudo rm: el grupo sudo conserva su derecho, con contraseña).
hint-report-secret =
    .lead = Hallazgo C4: ls -l muestra quién puede leer /srv/pedidos/.env (man chmod). Ciérralo a las demás cuentas, pero no a su dueño: es la aplicación la que lo lee.
    .solution = sudo chmod 600 /srv/pedidos/.env (o 640 si el grupo pedidos tiene que leerlo), y luego ls -l para comprobar que el dueño sigue siendo pedidos.

## Capítulo 3 — La exposición

hint-exposure-listening =
    .lead = Antes de cerrar puertas, mira qué programas escuchan en qué puertos, en el propio servidor (man ss). El escaneo de Salomé está en escaneo_auditoria.txt.
    .solution = sudo ss -tlnp (los sockets TCP en escucha, en numérico, con el programa). 0.0.0.0: todas las interfaces; 127.0.0.1: solo esta máquina.
hint-exposure-firewall =
    .lead = ufw deniega la entrada por defecto en cuanto está activo; solo tienes que permitir lo que debe seguir abierto (SSH, http, https) ANTES de activarlo (man ufw).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", y luego sudo ufw enable (sudo ufw status verbose para comprobar).
hint-exposure-redis-local =
    .lead = El cortafuegos es una capa; Redis también debe escuchar solo a la máquina: una directiva de /etc/redis/redis.conf. Un programa relee su configuración cuando se reinicia.
    .solution = sudo nano /etc/redis/redis.conf: bind 127.0.0.1 -::1 (en lugar de bind * -::*). Luego sudo systemctl restart redis-server, y sudo ss -tlnp para comprobar.
hint-exposure-end =
    .lead = El cortafuegos filtra y Redis es local; demuestra que SSH sigue pasando, con una conexión nueva desde tu puesto.
    .solution = exit, y luego ssh obrador.

## Capítulo 4 — Los rastros

hint-traces-found =
    .lead = El journal del servicio ssh guarda los inicios de sesión correctos, con la dirección y la huella de la clave; last resume quién se conectó, cuándo y desde dónde (man journalctl, man last).
    .solution = journalctl -u ssh | grep Accepted (o sudo grep, o last nadia): la línea de las 3:12, desde 203.0.113.99.
hint-traces-key-identified =
    .lead = ssh-keygen puede mostrar la huella de cada clave de un archivo (man ssh-keygen, opción -l). El archivo de Nadia solo lo puede leer ella: necesitas sudo.
    .solution = sudo ssh-keygen -l -f /home/nadia/.ssh/authorized_keys, y luego compara con la huella SHA256 del journal.
hint-traces-key-revoked =
    .lead = Quita de authorized_keys la línea cuya huella es la del inicio de sesión nocturno, y solo esa: la de Nadia tiene que quedarse.
    .solution = sudo nano /home/nadia/.ssh/authorized_keys: borra la línea cuya huella es la del journal (la segunda: las dos dicen nadia@tienda) y guarda.
hint-traces-cron-found =
    .lead = Lo que se ejecuta solo para una cuenta: su crontab (man crontab). Para leer el de otra cuenta, hay que ser root.
    .solution = sudo crontab -u nadia -l
hint-traces-cron-cleaned =
    .lead = Quita la línea del intruso del crontab de Nadia sin borrar su copia de seguridad: crontab -r lo borra todo, crontab -e te deja elegir.
    .solution = sudo crontab -u nadia -e: borra la línea que contiene curl … | sh, conserva la de copia.sh.
hint-traces-secret-seen =
    .lead = El historial de comandos de Nadia (.bash_history, que solo ella puede leer) dice lo que se escribió durante la sesión de la noche. Para leerlo en su lugar, necesitas sudo.
    .solution = sudo cat /home/nadia/.bash_history: la persona leyó /srv/pedidos/.env, así que la contraseña de la base de datos está comprometida.
hint-traces-password =
    .lead = La contraseña de una base de datos se cambia en los dos lados: en PostgreSQL (psql, ALTER ROLE, desde la cuenta postgres: man psql) Y en DATABASE_URL del archivo .env; la aplicación solo relee .env al reiniciarse. Doce caracteres como mínimo.
    .solution = sudo -u postgres psql -c "ALTER ROLE pedidos PASSWORD 'una-frase-larga'", luego sudo nano /srv/pedidos/.env (la misma contraseña en DATABASE_URL), y luego sudo systemctl restart pedidos y systemctl status pedidos.

## Capítulo 1 — El perímetro

hint-scope-letter =
    .lead = Antes de escanear nada: la carta de encargo está en tu carpeta. Dice lo que puedes sondear, y lo que no puedes tocar.
    .solution = cat carta_de_encargo.txt: el perímetro es UNA máquina, obrador.internal (192.0.2.22). El vecino (192.0.2.24) no está incluido.
hint-scope-scan =
    .lead = nmap escanea los puertos de una máquina (man nmap): dale la dirección o el nombre exacto de la máquina del perímetro, y pídele también las versiones de los servicios.
    .solution = nmap -sV obrador.internal (no 192.0.2.0/24: eso sondearía también al vecino).
hint-scope-trace =
    .lead = Las pruebas se guardan: nmap puede escribir su resultado, tal como lo lees, en un archivo (man nmap, la opción -oN).
    .solution = nmap -sV -oN inventario.txt obrador.internal
hint-scope-end =
    .lead = Completa notas_auditoria.md con nano: lo que has encontrado (los puertos de la base de datos y de Redis no pintan nada en internet) y lo que has visto sin tocarlo (el servidor del vecino).
    .solution = nano notas_auditoria.md: en «Lo que he encontrado», cita 5432 (PostgreSQL) y 6379 (Redis); en «Fuera del perímetro», cita vecino.internal (192.0.2.24), fuera del perímetro, no sondeado.

## Capítulo 5 — La visita de control

hint-follow-up-scan =
    .lead = Repite el inventario como el primer día, con las versiones, sobre el servidor y solo sobre él (man nmap).
    .solution = nmap -sV obrador.internal
hint-follow-up-lynis =
    .lead = Lynis audita la máquina en la que se ejecuta; necesita root para leerlo todo (man lynis). No arregla nada.
    .solution = sudo lynis audit system
hint-follow-up-update =
    .lead = El aviso de Lynis (PKGS-7392) trata de paquetes vulnerables: apt sabe lo que está esperando (man apt).
    .solution = sudo apt update, sudo apt upgrade (apt list --upgradable muestra lo que está esperando).
hint-follow-up-hardened =
    .lead = Entre las sugerencias, las que merecen la pena: SSH (sshd_config, man sshd_config), el UMASK de /etc/login.defs, el aviso /etc/issue. Necesitas un índice de al menos 70, sin ningún aviso, y la configuración de SSH aplicada.
    .solution = sudo grep suggestion /var/log/lynis-report.dat. Por ejemplo: X11Forwarding no y MaxAuthTries 3 en /etc/ssh/sshd_config (luego sudo sshd -t, sudo systemctl reload ssh), UMASK 027 en /etc/login.defs, un aviso legal en /etc/issue.
hint-follow-up-proof-lynis =
    .lead = Una corrección que no se demuestra no es más que una intención: vuelve a ejecutar Lynis para que refleje el estado actual.
    .solution = sudo lynis audit system
hint-follow-up-nmap-own =
    .lead = Repite el escaneo con las versiones, ahora que las actualizaciones están hechas: la versión de SSH que se muestra ha cambiado.
    .solution = nmap -sV obrador.internal
hint-follow-up-end =
    .lead = Completa informe_cierre.md con nano: un resumen, los hallazgos corregidos (partes 1 a 4), las pruebas (el índice exacto de tu última ejecución de Lynis y los puertos vistos), y lo que queda con un identificador de Lynis todavía abierto.
    .solution = nano informe_cierre.md: en «Pruebas», el índice de la última auditoría y los puertos 22, 80, 443; en «Pendiente», por ejemplo FINT-4350 (integridad de archivos) o LOGG-2154 (registros remotos).
