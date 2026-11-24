### Pistas graduales de La Ludoteca (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en
### names.ftl.

## Capítulo 1 — El rescate

hint-ransom-restored =
    .lead = Primero detén el ataque: un programa sigue funcionando (ps aux), y el crontab de su cuenta lo vuelve a lanzar. Solo entonces, la copia desconectada: el disco USB del cajón (lsblk -f), montado en solo lectura, contiene un repositorio restic. La copia del NAS también está cifrada.
    .solution = sudo kill 3141 ; sudo crontab -u recepcion -r ; sudo mount -o ro /dev/sdb1 /mnt/memoria ; sudo restic -r /mnt/memoria/repositorio restore latest --target / (contraseña: peon-caballo-torre-27)
hint-ransom-end =
    .lead = Los archivos han vuelto. Ahora cierra la puerta de entrada (la cuenta cuya contraseña se adivinó), tira los archivos .locked y las notas de rescate, y vuelve a desconectar la copia (sal de /mnt/memoria para desmontarla).
    .solution = sudo usermod -L recepcion ; sudo find /srv/compartido -name "*.locked" -delete ; sudo find /srv/compartido -name LEEME-PARA-RECUPERAR.txt -delete ; cd ; sudo umount /mnt/memoria

## Capítulo 2 — Instantáneas

hint-snapshots-error-berenice =
    .lead = Configura /etc/rsnapshot.conf: snapshot_root en el segundo disco, los niveles retain (7 daily, 4 weekly), una línea backup para /srv/compartido/ — con TABULACIONES entre los campos. rsnapshot configtest lo comprueba, y luego cron (el de root) lo ejecuta.
    .solution = En sudo nano /etc/rsnapshot.conf: snapshot_root⇥/mnt/instantaneas/, retain⇥daily⇥7 y retain⇥weekly⇥4 (en lugar de las líneas alpha, beta y gamma), backup⇥/srv/compartido/⇥localhost/ (⇥ = Tab); sudo rsnapshot configtest; luego en sudo crontab -e: 30 3 * * * /usr/bin/rsnapshot daily y 0 3 * * 1 /usr/bin/rsnapshot weekly
hint-snapshots-end =
    .lead = La instantánea más reciente (.0) se tomó después del error de Bérénice. Compara el inventario de las instantáneas más antiguas con diff, y toma el de la noche anterior.
    .solution = sudo cp /mnt/instantaneas/daily.1/localhost/srv/compartido/inventario.csv /srv/compartido/ (daily.1: la noche anterior, si tus niveles se llaman daily).

## Capítulo 3 — La base de datos

hint-database-test-succeeded =
    .lead = Una copia de verdad de una base de datos en marcha es pg_dump, ejecutado con la cuenta postgres (sudo -u). Y una copia solo vale si se restaura: pruébala en una base de datos de prueba aparte (man createdb, man pg_restore), nunca sobre ludo.
    .solution = sudo -u postgres pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo ; sudo -u postgres createdb ludo_test ; sudo -u postgres pg_restore -d ludo_test /var/backups/postgresql/ludo.dump
hint-database-loans-returned =
    .lead = La tabla prestamos de ludo está vacía, lo demás está intacto. pg_restore puede reponer una sola tabla (-t), y solo sus datos en una tabla vacía.
    .solution = sudo -u postgres pg_restore -d ludo --data-only -t prestamos /var/backups/postgresql/ludo.dump
hint-database-end =
    .lead = Ahora ejecuta ese pg_dump cada noche, como un rol de la base de datos: root no lo es. ¿El crontab de quién, entonces?
    .solution = sudo crontab -u postgres -e, y añade: 15 2 * * * pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo
