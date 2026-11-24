### Pistas graduales de El Centro de Datos (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta). Los nombres de archivo,
### como en names.ftl.

## Capítulo 1 — Primer día

hint-first-day-account =
    .lead = El registro es /var/log/nginx/access.log. Quédate con las líneas que tienen un error 503 y luego cuéntalas: dos herramientas de las notas de Awa, unidas por una tubería.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l (grep se queda con las líneas 503, wc -l las cuenta).
hint-first-day-robot =
    .lead = La dirección IP es el primer campo de cada línea. Quédate solo con ella, ordena, cuenta las líneas idénticas y luego ordena por número: las notas de Awa dan la cadena.
    .solution = cut -d " " -f 1 /var/log/nginx/access.log | sort | uniq -c | sort -n | tail -3 (la última línea es la dirección más habladora).
hint-first-day-override =
    .lead = El sitio va lento: algún proceso debe de estar comiéndose el procesador. Un comando lista todos los procesos de la máquina, con su %CPU.
    .solution = ps aux (mira la columna %CPU: php-fpm: pool catalogue está al 99 %).
hint-first-day-rule =
    .lead = Bloquea el robot en /etc/nginx/blocked.conf, con el formato deny DIRECCIÓN; sin borrar las reglas que ya hay. El archivo pertenece a root, y una redirección >> la hace tu shell, no sudo: tee puede escribir por ti.
    .solution = echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf (-a añade en lugar de sobrescribir).
hint-first-day-blocked =
    .lead = nginx no vuelve a leer su archivo por sí solo: hay que pedírselo, a través del gestor de servicios.
    .solution = sudo systemctl reload nginx
hint-first-day-repaired =
    .lead = El proceso sobrecargado sigue en marcha (ps aux). Detenlo: pertenece a www-data, así que necesitas sudo. systemd lo reiniciará, limpio.
    .solution = ps aux para encontrar su número, luego sudo kill PID (4242 al principio, o el del proceso reiniciado al 99 %).
hint-first-day-report =
    .lead = El informe va en ~/informe.txt: el número de errores 503 y la dirección del robot. > crea el archivo, >> añade una línea.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l > ~/informe.txt, luego echo "Culpable: 198.51.100.77" >> ~/informe.txt

## Capítulo 2 — Segundo día

hint-second-day-malo-reads =
    .lead = ls -l /var/log/nginx muestra qué grupo posee los registros, y qué puede hacer ese grupo. Añade a Malo a ese grupo, sin quitarlo del suyo (man usermod: cuidado con -G sin -a). No des lectura a todo el mundo.
    .solution = sudo usermod -aG adm malo (-a añade el grupo sin sustituir sus otros grupos; compruébalo con groups malo).
hint-second-day-share =
    .lead = /srv/equipo pertenece a root. Dáselo al grupo web-team, y luego permisos para el grupo y ninguno para los demás (man chgrp, man chmod). ¡Nada de 777!
    .solution = sudo chgrp web-team /srv/equipo y luego sudo chmod 770 /srv/equipo (el grupo lee, escribe, entra; los demás, nada).
hint-second-day-end =
    .lead = Comprueba las dos tareas: Malo lee los registros (sin que estén abiertos a todos) y sigue en web-team; la carpeta compartida está cerrada a las demás cuentas.
    .solution = groups malo debe mostrar adm y web-team (si no: sudo usermod -aG web-team malo); los registros en 640 (sudo chmod 640 /var/log/nginx/access.log /var/log/nginx/error.log); /srv/equipo en 770.

## Capítulo 3 — La noche del reinicio

hint-reboot-night-nginx =
    .lead = ¿Qué servicios han fallado o están parados? systemctl puede listarlos y dar el estado de cada uno. Mira también la línea Loaded de nginx: no basta con arrancarlo, tiene que volver con la máquina (man systemctl).
    .solution = sudo systemctl enable --now nginx (enable: arrancará con la máquina; --now: arranca ya).
hint-reboot-night-catalogue =
    .lead = El catálogo se niega a arrancar: su registro dice por qué (journalctl -u). Su carpeta de registros pertenece a root, mientras que php-fpm funciona como www-data. Cambia el propietario, no la abras a todo el mundo.
    .solution = sudo chown www-data: /var/log/catalogue y luego sudo systemctl restart catalogue
hint-reboot-night-end =
    .lead = La verdadera prueba es el próximo arranque: reinicia tú la máquina y luego comprueba que todo ha vuelto sin ti.
    .solution = sudo reboot y luego, una vez reconectado: systemctl --failed (o systemctl status nginx catalogue).

## Capítulo 4 — El gran incendio

hint-fire-nginx =
    .lead = La máquina es nueva: antes de instalar, apt debe descargar la lista de paquetes disponibles (man apt). El paquete se llama nginx.
    .solution = sudo apt update y luego sudo apt install nginx (curl http://localhost muestra la página de bienvenida).
hint-fire-end =
    .lead = Sigue el PRD (/mnt/copia/PRD.txt): comprueba cada archivo comprimido listándolo (tar -t) antes de extraerlo, toma el más reciente que se lee hasta el final, extráelo desde la raíz (man tar, -C). Luego nginx -t: dos sitios no pueden ser ambos default_server en el mismo puerto.
    .solution = sudo tar -xzf /mnt/copia/medialibrary-2026-10-22.tar.gz -C /, luego sudo rm /etc/nginx/sites-enabled/default, sudo nginx -t, sudo systemctl reload nginx, y curl http://medialibrary.example

## Capítulo 5 — El certificado ha caducado

hint-certificate-expires =
    .lead = Empieza por confirmar la avería: pide el sitio por HTTPS, o pregunta a certbot por el estado de sus certificados.
    .solution = curl https://medialibrary.example (o sudo certbot certificates: INVALID: EXPIRED).
hint-certificate-challenge =
    .lead = ¿Por qué falló la renovación automática? Vuelve a lanzarla sin romper nada: man certbot habla de un ensayo general.
    .solution = sudo certbot renew --dry-run (y journalctl -u certbot para el registro de las noches anteriores).
hint-certificate-end =
    .lead = certbot deja el desafío en la carpeta de /etc/letsencrypt/renewal/medialibrary.example.conf, pero nginx sirve el sitio desde /var/www/medialibrary. Corrige la carpeta, renueva de verdad, recarga nginx, y haz que se recargue automáticamente después de cada renovación (busca «hook» en man certbot).
    .solution = sudo certbot renew --webroot -w /var/www/medialibrary, luego sudo certbot reconfigure --cert-name medialibrary.example --deploy-hook "systemctl reload nginx", y luego sudo systemctl reload nginx
