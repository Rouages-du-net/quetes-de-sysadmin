### Pistas graduales de La Gaceta (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Todo se escribe en el servidor
### gaceta.

## Capítulo 1 — El repositorio desnudo

hint-bare-repo-in-line =
    .lead = Necesitas un repositorio desnudo propio en /srv/git (man git, git init --bare), un hook hooks/post-receive ejecutable que extraiga cada push a /var/www/gazette, y la corrección de Théo llevada primero a ~/gazette (diff -r compara las dos carpetas).
    .solution = sudo git init --bare /srv/git/gazette.git y luego sudo chown -R tu: /srv/git/gazette.git; en hooks/post-receive: #!/bin/sh y luego git --work-tree=/var/www/gazette checkout -f main, y chmod +x; en ~/gazette: «Gazeta» pasa a «Gaceta» en index.html, git commit -am "Título", git remote add prod /srv/git/gazette.git, git push prod main.
hint-bare-repo-end =
    .lead = La fecha del rastro se corrige en ~/gazette/agenda.html (dos veces: el texto y datetime), nunca en el servidor: lo que no está en git desaparece en el próximo push.
    .solution = En ~/gazette: nano agenda.html (2027-06-21 pasa a 2027-06-12, y 21 pasa a 12), git commit -am "Agenda", y luego git push prod.

## Capítulo 2 — Marcha atrás

hint-rollback-restored =
    .lead = nginx sirve el enlace /srv/gazette/current, que apunta a la versión rota. La versión anterior está intacta en releases/: basta con que el enlace vuelva a apuntar a ella. Cuidado, current apunta a una carpeta (man ln, opción -n).
    .solution = ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current (luego curl -I http://gazette.example/ responde 200).
hint-rollback-safeguard =
    .lead = El hook (/srv/git/gazette.git/hooks/post-receive) debe ejecutar tests.sh en la carpeta de la nueva versión, ANTES de cambiar current; con set -e, un fallo detiene el script. Théo volverá a hacer push en cuanto cambie el hook.
    .solution = En el hook, justo antes de la línea ln -sfn, añade: cd /srv/gazette/releases/$VERSION y luego sh tests.sh
hint-rollback-end =
    .lead = La maquetación de Théo está en el servidor, pero le falta index.html: recupera sus commits en ~/gazette, dale a su página el nombre correcto, y publica por git.
    .solution = cd ~/gazette, git pull prod main, mv inicio.html index.html, git add ., git commit -m "Portada: index.html", git push prod main.

## Capítulo 3 — Azul y verde

hint-blue-green-end =
    .lead = Prepara verde (el enlace /srv/kiosk/green, el servicio kiosk-green), comprueba su /health en el puerto 3002 y lee sus notas de versión si no está bien; solo entonces apunta el proxy_pass de nginx a verde. Azul sigue en marcha.
    .solution = ln -sfn /srv/kiosk/versions/1.5.0 /srv/kiosk/green, sudo systemctl start kiosk-green; añade KIOSK_SMTP=smtp.gazette.example a /etc/kiosk/kiosk.env, sudo systemctl restart kiosk-green, curl localhost:3002/health; luego 3001 pasa a 3002 en /etc/nginx/sites-available/gazette, sudo nginx -t, sudo systemctl reload nginx.

## Capítulo 4 — El canario

hint-canary-canary-160 =
    .lead = La 1.6.0 va en azul (el enlace, y luego el servicio). Para enviarle solo una visita de cada diez, nginx reparte el tráfico entre los servidores de un bloque upstream, según su peso (man nginx).
    .solution = ln -sfn /srv/kiosk/versions/1.6.0 /srv/kiosk/blue, sudo systemctl restart kiosk-blue; en /etc/nginx/sites-available/gazette: upstream kiosk {"{"} server 127.0.0.1:3002 weight=9; server 127.0.0.1:3001 weight=1; {"}"} y proxy_pass http://kiosk/; luego sudo nginx -t y sudo systemctl reload nginx.
hint-canary-stopped =
    .lead = Mira los códigos de respuesta en /var/log/nginx/access.log: ¿qué página responde 500? Si es el canario, corta su tráfico (un servidor de upstream se puede marcar down).
    .solution = grep " 500 " /var/log/nginx/access.log (errores 500 en /kiosk/archives), luego server 127.0.0.1:3001 weight=1 down; en el upstream, sudo nginx -t, sudo systemctl reload nginx.
hint-canary-canary-161 =
    .lead = La 1.6.1 ha llegado a /srv/kiosk/versions/: vuelve a empezar, en azul, con el mismo canario pequeño, y mira el siguiente lote de visitas.
    .solution = ln -sfn /srv/kiosk/versions/1.6.1 /srv/kiosk/blue, sudo systemctl restart kiosk-blue, quita down de la línea 3001, sudo nginx -t, sudo systemctl reload nginx.
hint-canary-end =
    .lead = El canario está limpio: todo el tráfico puede ir a azul. Verde sigue en marcha, por si acaso.
    .solution = En el upstream: server 127.0.0.1:3002 weight=9 down; (o proxy_pass http://127.0.0.1:3001/;), luego sudo nginx -t y sudo systemctl reload nginx.

## Capítulo 5 — La migración

hint-migration-repaired =
    .lead = Consulta el /health de cada instancia, y luego lee el diario del servicio verde y las notas de la 2.0.0 (/srv/kiosk/versions/2.0.0/): la base de datos se ha migrado, así que se arregla hacia delante. Una variable de configuración ha cambiado de nombre.
    .solution = Añade KIOSK_SMTP_URL=smtp://smtp.gazette.example:587 a /etc/kiosk/kiosk.env (sudo nano), y luego sudo systemctl restart kiosk-green.
hint-migration-end =
    .lead = Azul ejecuta una versión que ya no puede leer la base de datos migrada: para volver a ser una red de seguridad, necesita la misma versión que verde.
    .solution = ln -sfn /srv/kiosk/versions/2.0.0 /srv/kiosk/blue y luego sudo systemctl restart kiosk-blue (curl localhost:3001/health responde ok).
