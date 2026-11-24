### Pistas graduadas de El Bastión (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el comando
### exacto) y .solution (casi la respuesta: el comando, con lo que hace).

## Capítulo 1 — La alarma

hint-alarm-process =
    .lead = Algo se lleva el procesador: mira lo que se ejecuta, con qué cuenta, desde qué carpeta (man ps, man top).
    .solution = ps aux (o top): un «kworkerd» a casi el 200 % de CPU, que pertenece a deploy, lanzado desde /tmp/.cache.
hint-alarm-connection =
    .lead = El proveedor da una dirección y un puerto: busca qué programa tiene esa conexión (man ss, o man netstat). La columna del proceso necesita root.
    .solution = sudo ss -tnp (o sudo netstat -tnp): kworkerd, conectado a 198.51.100.66:3333.
hint-alarm-entry =
    .lead = ¿Cómo entraron? El registro de ssh guarda cada intento y cada inicio de sesión (man journalctl); last lista las sesiones.
    .solution = sudo journalctl -u ssh | grep deploy: contraseñas fallidas, y luego «Accepted password for deploy from 203.0.113.66» a las 02:40:57.
hint-alarm-end =
    .lead = Completa incident.md: el programa y su carpeta, la dirección del pool, la cuenta, la dirección del intruso y la hora del inicio de sesión.
    .solution = nano incident.md: /tmp/.cache/kworkerd (deploy), 198.51.100.66 puerto 3333, deploy por contraseña desde 203.0.113.66 a las 02:40.

## Capítulo 2 — La contención

hint-containment-pool =
    .lead = Impide que el minero alcance el pool: una regla de cortafuegos sobre lo que sale de la máquina (man iptables, la cadena OUTPUT).
    .solution = sudo iptables -A OUTPUT -d 198.51.100.66 -j DROP
hint-containment-attacker =
    .lead = Cierra la puerta a la dirección desde la que vinieron: una regla sobre lo que entra (INPUT, por origen). Cuidado con tu propio ssh.
    .solution = sudo iptables -A INPUT -s 203.0.113.66 -j DROP (añadir al final no toca tu propio acceso; compruébalo con sudo iptables -L -n).
hint-containment-stopped =
    .lead = El minero vuelve cuando lo paras: algo lo vigila. Mira su padre (ps -ef, la columna PPID) y páralo primero (man kill).
    .solution = sudo kill 4410 (el vigilante, /bin/sh /tmp/.cache/.w), y luego sudo kill sobre el PID de kworkerd (o sudo killall kworkerd una vez desaparecido el vigilante).
hint-containment-closed =
    .lead = Cierra deploy de verdad, clave incluida: man usermod dice lo que -L no cubre.
    .solution = sudo usermod -L -e 1 deploy (contraseña bloqueada Y cuenta caducada; sudo chage -E 0 deploy también la hace caducar).
hint-containment-end =
    .lead = Compruébalo todo: pool y dirección bloqueados, tu ssh todavía aceptado, nada de /tmp/.cache en marcha, deploy cerrada, y la aplicación de reparto funcionando.
    .solution = sudo iptables -L -n, ps aux | grep cache, systemctl status delivery (sudo systemctl start delivery si se ha parado, y luego para lo que haya relanzado).

## Capítulo 3 — La erradicación

hint-eradication-cron =
    .lead = Una cuenta puede dejar una tarea que arranca en cada inicio: lee el crontab de deploy, y quita solo lo que no es de Selma (man crontab, -u).
    .solution = sudo crontab -u deploy -e: borra la línea «@reboot /bin/sh /tmp/.cache/.w», conserva sync-orders.
hint-eradication-key =
    .lead = Dos claves en deploy: compara sus huellas con la del correo de Selma (man ssh-keygen, -l).
    .solution = sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, y luego sudo nano /home/deploy/.ssh/authorized_keys: quita la línea cuya huella no es la de Selma.
hint-eradication-files =
    .lead = El minero y su vigilante siguen en el disco (man rm).
    .solution = sudo ls -la /tmp/.cache, y luego sudo rm /tmp/.cache/kworkerd /tmp/.cache/.w (también el .w oculto).
hint-eradication-verified =
    .lead = ¿Qué cambiaron? find puede listar los archivos modificados recientemente (man find, -mtime); el historial de deploy también lo dice. Antes de restaurar, comprueba la firma de la versión (man gpg, --verify).
    .solution = sudo find /srv/delivery -type f -mtime -3 (server.js), y luego gpg --verify /srv/releases/delivery-2.3.1.tar.gz.asc /srv/releases/delivery-2.3.1.tar.gz (Good signature; la copia de /home/deploy es BAD).
hint-eradication-restored =
    .lead = Restaura server.js desde el archivo cuya firma es correcta (man tar, -x y -C).
    .solution = sudo tar -xzf /srv/releases/delivery-2.3.1.tar.gz -C /srv (reescribe /srv/delivery/server.js; compáralo con el del archivo con diff si tienes dudas).
hint-eradication-end =
    .lead = Comprueba: ningún @reboot, sync-orders conservado, solo la clave de Selma, /tmp/.cache desaparecido, server.js como en la versión, la aplicación funcionando y nada relanzado.
    .solution = sudo crontab -u deploy -l, sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, sudo ls -la /tmp/.cache, sudo systemctl restart delivery, ps aux | grep cache.

## Capítulo 4 — El refuerzo

hint-hardening-passwords =
    .lead = sshd_config dice no a las contraseñas, y sin embargo se aceptaron: pregúntale a sshd lo que aplica (man sshd, -T), y mira lo que incluye primero.
    .solution = sudo sshd -T | grep passwordauthentication, y luego sudo rm /etc/ssh/sshd_config.d/50-delivery.conf y sudo systemctl reload ssh.
hint-hardening-firewall =
    .lead = Denegar por defecto (iptables -P INPUT DROP), pero antes aceptar lo, las respuestas (-m state --state ESTABLISHED,RELATED), y los puertos 22, 80, 443 (man iptables).
    .solution = sudo iptables -A INPUT -i lo -j ACCEPT; sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT; sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT (lo mismo para 80 y 443); y luego sudo iptables -P INPUT DROP.
hint-hardening-saved =
    .lead = Las reglas viven en memoria: escríbelas donde iptables-persistent las lee al arrancar (man iptables-save). Cuidado: una redirección se ejecuta como tú, no como root.
    .solution = sudo iptables-save | sudo tee /etc/iptables/rules.v4
hint-hardening-deploy =
    .lead = Selma necesita recuperar deploy: quita lo que la cerró (man usermod, -e; man chage).
    .solution = sudo usermod -e "" deploy (o sudo chage -E -1 deploy); con las contraseñas desactivadas, solo su clave la abre.
hint-hardening-end =
    .lead = Comprueba: sshd -T dice no, iptables -L muestra la política DROP con lo, ESTABLISHED, 22, 80, 443, las reglas guardadas, deploy utilizable.
    .solution = sudo sshd -T | grep password, sudo iptables -L -n, sudo cat /etc/iptables/rules.v4, sudo chage -l deploy.
