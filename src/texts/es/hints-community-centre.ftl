### Pistas graduales de El Centro Cívico (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta). Cada pista dice dónde
### escribir: en tu puesto, en civico (la pasarela) o en una máquina interna
### (wiki).

## Capítulo 1 — Las llaves

hint-keys-copied =
    .lead = Un par de claves se crea en TU puesto, nunca en el servidor (man ssh-keygen). Luego su mitad pública va a ~/.ssh/authorized_keys en civico (man ssh-copy-id).
    .solution = En tu puesto: ssh-keygen (Intro para aceptar la ruta, la frase de paso que quieras), y luego ssh-copy-id civico (contraseña provisional: lila-2027).
hint-keys-by-key =
    .lead = Tu clave pública está en su sitio: vuelve a conectarte, ssh ya no debería pedirte la contraseña de la cuenta.
    .solution = Si estás en civico: exit; luego, en tu puesto: ssh civico
hint-keys-closed =
    .lead = En civico, el servidor SSH decide si acepta contraseñas: busca PasswordAuthentication en /etc/ssh/sshd_config (man sshd_config). Comprueba la sintaxis antes de recargar.
    .solution = En civico: sudo nano /etc/ssh/sshd_config, la línea #PasswordAuthentication yes pasa a PasswordAuthentication no; luego sudo sshd -t y sudo systemctl reload ssh.
hint-keys-end =
    .lead = Antes de irte, comprueba que todavía puedes entrar, con la clave, ahora que se rechazan las contraseñas.
    .solution = En civico: exit; luego, en tu puesto: ssh civico

## Capítulo 2 — El salto

hint-jump-to-wiki =
    .lead = A la wiki solo se llega desde civico, pero tu clave privada tiene que quedarse en tu puesto: ssh puede saltar a través de una máquina (man ssh, opción -J).
    .solution = En tu puesto: ssh -J civico wiki (responde yes para cada una de las dos máquinas).
hint-jump-shortcut =
    .lead = Para que baste con un simple «ssh wiki», escribe el camino de una vez por todas en ~/.ssh/config, en tu puesto (man ssh_config, Host y ProxyJump).
    .solution = En tu puesto: nano ~/.ssh/config, y añade un bloque Host wiki con, debajo, HostName wiki, User tu y ProxyJump civico.
hint-jump-end =
    .lead = El atajo y el salto bastan: no debe quedar ninguna clave privada en la pasarela.
    .solution = En tu puesto: ssh wiki. Si habías copiado tu clave privada en civico, bórrala allí: rm ~/.ssh/id_ed25519

## Capítulo 3 — El túnel

hint-tunnel-approved =
    .lead = La página de administración solo escucha en 127.0.0.1:8080 DE LA WIKI: un túnel ssh lleva hasta allí un puerto de tu puesto (man ssh, -L, y -f -N para que se quede abierto). Luego curl, desde tu puesto, lee la página y sus direcciones.
    .solution = En tu puesto: ssh -f -N -L 8080:localhost:8080 wiki (o con -J civico), curl localhost:8080/admin, y luego curl localhost:8080/admin/aprobar/samir y curl localhost:8080/admin/aprobar/lea (no promo-casino).
hint-tunnel-end =
    .lead = El túnel sigue funcionando en segundo plano en tu puesto: encuentra su proceso, y luego detenlo.
    .solution = En tu puesto: ps (la línea ssh -f -N -L…), y luego kill seguido de su PID.

## Capítulo 4 — Transferencias

hint-transfers-report =
    .lead = scp copia un archivo entre máquinas, como cp, con la ruta remota precedida del nombre de la máquina; el atajo de la wiki de ~/.ssh/config también le sirve (man scp).
    .solution = En tu puesto: scp wiki:/srv/wiki/exports/informe-2027.pdf .
hint-transfers-backup =
    .lead = La copia se hace desde civico hacia archives, con rsync (man rsync). Cuidado con la barra final del origen: con ella, rsync copia el CONTENIDO de la carpeta. Prueba primero un ensayo, con -n.
    .solution = En civico: rsync -av /srv/compartido/ archives:/srv/copias/compartido/ (añade --delete si ha aparecido del otro lado una carpeta compartido de más).
hint-transfers-end =
    .lead = Hacen falta las dos cosas: el informe, intacto, en tu puesto, y en archives una copia idéntica a /srv/compartido, sin carpeta anidada.
    .solution = En tu puesto: scp wiki:/srv/wiki/exports/informe-2027.pdf . ; en civico: rsync -av --delete /srv/compartido/ archives:/srv/copias/compartido/

## Capítulo 5 — El alojamiento

hint-web-host-end =
    .lead = Primero trae /srv/wiki/site a tu puesto, por SSH (man sftp, get -r). Luego publícalo con lftp con el nombre que cubre el certificado del alojamiento (email_alojamiento.txt, en civico), en public_html: mirror -R envía hacia el alojamiento, --delete quita lo que ya no está en el sitio (man lftp).
    .solution = En tu puesto: sftp wiki, get -r /srv/wiki/site, bye; luego lftp -u centrocivico ftp.hosting.example (contraseña en correo_yasmine.txt, en civico), mirror -R --delete site public_html, bye.
