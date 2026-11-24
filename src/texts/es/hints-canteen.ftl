### Las pistas graduadas de la historia «El Comedor»: una dirección, y luego
### casi la respuesta, para cada paso (ver src/engine/hints.ts).

## Capítulo 1 — El orden de arranque

hint-boot-order-refused =
    .lead = ¿Por qué falló la aplicación esta mañana? systemctl status menu, y luego journalctl -b -u menu (man journalctl).
    .solution = journalctl -b -u menu muestra «connect ECONNREFUSED 127.0.0.1:5432»: PostgreSQL todavía no estaba listo.
hint-boot-order-order =
    .lead = ¿Qué dice el archivo de unidad sobre la base de datos? systemctl cat menu. ¿Y cómo se le dice a systemd «después de PostgreSQL»? (man systemd.unit: After=, Requires=)
    .solution = sudo systemctl edit menu, y luego escribe [Unit] After=postgresql.service Requires=postgresql.service (dos líneas); systemctl edit recarga solo.
hint-boot-order-end =
    .lead = La única prueba: un reinicio. Luego mira los servicios (man reboot, man systemctl).
    .solution = sudo reboot, y luego ssh comedor y systemctl status menu (o systemctl --failed).

## Capítulo 2 — El bucle de reinicios

hint-restart-loop-limit =
    .lead = ¿Qué hizo systemd anoche? systemctl status menu, journalctl -u menu: mira las horas de los reinicios.
    .solution = El estado dice Result: start-limit-hit: cinco reinicios separados por 100 ms, mientras PostgreSQL se reiniciaba.
hint-restart-loop-end =
    .lead = Haz que la aplicación se pare y vuelva a arrancar con PostgreSQL, o que espere lo suficiente (man systemd.unit: PartOf=; man systemd.service: RestartSec=). Luego prueba como lo hacen las actualizaciones.
    .solution = sudo systemctl edit menu: [Unit] PartOf=postgresql.service; luego sudo systemctl reset-failed menu, sudo systemctl start menu, y sudo systemctl restart postgresql; systemctl status menu.

## Capítulo 3 — El arranque lento

hint-slow-boot-blame =
    .lead = ¿Qué tardó tanto durante el arranque? (man systemd-analyze: time, blame, critical-chain)
    .solution = systemd-analyze blame: systemd-networkd-wait-online.service, más de 2 min.
hint-slow-boot-no-carrier =
    .lead = ¿A qué espera wait-online? Mira los enlaces y su estado (man networkctl).
    .solution = networkctl: eth1 está en no-carrier (sin cable) pero configurado por /etc/systemd/network/20-eth1.network.
hint-slow-boot-end =
    .lead = Dile a wait-online que no espere a eth1 (man systemd.network: RequiredForOnline=), y luego reinicia y vuelve a medir.
    .solution = En /etc/systemd/network/20-eth1.network añade [Link] y luego RequiredForOnline=no; sudo reboot, y luego systemd-analyze time.

## Capítulo 4 — El disco que llega tarde

hint-late-disk-hidden =
    .lead = ¿Cuándo se montó /srv/data, y cuándo arrancó la aplicación? (journalctl -b, findmnt /srv/data). Luego: ¿qué contiene /srv/data sin su disco? (man umount)
    .solution = sudo umount /srv/data, y luego ls /srv/data/bookings: el archivo del día está ahí, en el disco del sistema.
hint-late-disk-recovered =
    .lead = Copia el archivo a un sitio seguro, vuelve a montar el disco (man mount: mount /srv/data lee /etc/fstab), y luego cópialo en el disco.
    .solution = sudo cp /srv/data/bookings/2027-11-29.csv /root/, sudo mount /srv/data, sudo cp /root/2027-11-29.csv /srv/data/bookings/
hint-late-disk-end =
    .lead = Dile a systemd que la aplicación necesita /srv/data (man systemd.unit: RequiresMountsFor=), y luego reinicia.
    .solution = sudo systemctl edit menu: {"["}Unit] y luego RequiresMountsFor=/srv/data; sudo reboot, y luego systemctl status menu.
