### Pistas graduadas de La Vigilancia (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el
### comando exacto) y .solution (casi la respuesta: el comando, con lo que
### hace). Los nombres de lugares son los de names.ftl.

## Capítulo 1 — El boletín

hint-bulletin-read =
    .lead = El boletín de esta semana está en tu carpeta. Para cada CVE, comprueba si el paquete está siquiera instalado aquí, y en qué versión (man apt, la opción list).
    .solution = cat boletin_seguridad.txt, y luego apt list --installed para ver lo que está instalado en este servidor, y en qué versión.
hint-bulletin-sort =
    .lead = Escribe tu clasificación en vigilancia.md: ¿está certbot siquiera en este servidor? ¿Ya ha pasado curl la versión corregida del boletín?
    .solution = sudo nano vigilancia.md: en «No aplicable», certbot (no está instalado) y curl (ya al día); en «Afecta a este servidor», nginx, rsync y openssh-server.
hint-bulletin-end =
    .lead = Comprueba que tu clasificación no mezcla nada: en «Afecta a este servidor» solo van nginx, rsync y openssh-server.
    .solution = Vuelve a leer vigilancia.md entero: nada de certbot ni de curl en «Afecta a este servidor», nada de nginx ni de rsync en «No aplicable».

## Capítulo 2 — La prioridad

hint-priority-expose =
    .lead = Antes de ordenar, mira lo que escucha de verdad en este servidor, y lo que no tiene ningún puerto (man ss, man nmap).
    .solution = ss -tlnp (o nmap -sV amasadora.internal): 80 y 443 responden a cualquier dirección, nada escucha para rsync.
hint-priority-order =
    .lead = La puntuación de rsync es más alta, pero una puntuación mide lo grave que es SI se alcanza el servicio, no lo fácil que es alcanzarlo. Escribe tu decisión en prioridad.md, con el porqué.
    .solution = sudo nano prioridad.md: nginx primero (expuesto a internet, 80/443), rsync después (puntuación más alta, pero ningún puerto en escucha); y una palabra sobre openssh-server (ya protegido, KbdInteractiveAuthentication a no).
hint-priority-end =
    .lead = Comprueba que tu texto dice POR QUÉ, no solo el orden: ¿qué hace que nginx sea accesible, qué impide que rsync lo sea?
    .solution = Vuelve a leer prioridad.md: el motivo del orden tiene que citar la exposición (internet, puerto), no solo la puntuación.

## Capítulo 3 — La corrección

hint-fix-fixed =
    .lead = apt upgrade instala las correcciones disponibles, pero solo las que apt conoce: refresca antes la lista de paquetes (man apt).
    .solution = sudo apt update, y luego sudo apt upgrade (las dos correcciones, nginx y rsync, se instalan juntas).
hint-fix-checked =
    .lead = Antes de seguir: ¿el sitio sigue respondiendo? (man curl)
    .solution = curl -I http://obrador.example/ (se espera el código 200).
hint-fix-end =
    .lead = Los dos paquetes tienen que estar en la versión corregida del boletín, y el sitio tiene que seguir respondiendo.
    .solution = apt list --installed | grep -E 'nginx|rsync' para comprobar las versiones, y luego curl -I http://obrador.example/.

## Capítulo 4 — Sin prueba no hay certeza

hint-proof-versions =
    .lead = Una corrección se vuelve a demostrar: pregúntale a apt lo que queda por actualizar (man apt).
    .solution = apt list --upgradable (ya no debería aparecer nada para nginx ni para rsync).
hint-proof-found =
    .lead = El registro de accesos de nginx guarda cada petición. El fallo de nginx estaba en HTTP/2: busca una petición de ese tipo (man grep).
    .solution = grep "HTTP/2" /var/log/nginx/access.log (una línea con el código 400, sin navegador declarado, unos días antes de la corrección).
hint-proof-end =
    .lead = Necesitas dos cosas: la prueba de que los paquetes están al día, y haber buscado en el registro de accesos un intento anterior.
    .solution = apt list --upgradable (vacío), y luego grep "HTTP/2" /var/log/nginx/access.log.

## Capítulo 5 — Crear una rutina

hint-routine-active =
    .lead = unattended-upgrades está instalado pero apagado: mira /etc/apt/apt.conf.d/20auto-upgrades (man apt.conf).
    .solution = sudo nano /etc/apt/apt.conf.d/20auto-upgrades: pon las dos líneas a "1".
hint-routine-security =
    .lead = En /etc/apt/apt.conf.d/50unattended-upgrades, una línea Origins-Pattern permite TODAS las actualizaciones, no solo las de seguridad; y Unattended-Upgrade::Mail está comentado.
    .solution = sudo nano /etc/apt/apt.conf.d/50unattended-upgrades: comenta la línea "label=Debian" (sin -Security), conserva las dos líneas "label=Debian-Security", y descomenta Unattended-Upgrade::Mail con una dirección (por ejemplo "root").
hint-routine-periodic =
    .lead = Necesitas un recordatorio semanal que sobreviva a un reinicio: un temporizador de systemd en /etc/systemd/system, o una tarea cron, que mire las actualizaciones pendientes y te envíe el resultado por correo (man systemd.timer, man crontab).
    .solution = Un temporizador: sudo nano /etc/systemd/system/vigilancia.service (ExecStart=/bin/sh -c "apt list --upgradable | mail -s Vigilancia root") y /etc/systemd/system/vigilancia.timer (OnCalendar=weekly), y luego sudo systemctl daemon-reload && sudo systemctl enable --now vigilancia.timer. O una tarea cron: sudo crontab -e, una línea semanal que haga lo mismo.
hint-routine-end =
    .lead = Tres cosas que comprobar: las dos tareas de 20auto-upgrades activadas, 50unattended-upgrades limitado a la seguridad con un informe, y un recordatorio periódico activo.
    .solution = sudo apt-config dump | grep Periodic, cat /etc/apt/apt.conf.d/50unattended-upgrades, systemctl list-timers (o crontab -l).
