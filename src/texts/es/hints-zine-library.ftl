### Pistas graduadas de La Fanzinoteca (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección,
### sin el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — Denegado

hint-denied-upload-denied =
    .lead = "Permission denied" aunque los permisos son correctos: otra cosa deniega. El núcleo anota las denegaciones de AppArmor (man journalctl, -k; las notas de Bartek).
    .solution = sudo journalctl -k | grep DENIED (o sudo dmesg | grep DENIED)
hint-denied-upload-profile =
    .lead = ¿Qué perfil confina php-fpm, y de dónde toma las reglas propias del sitio? aa-status lista los perfiles; lee el archivo del perfil.
    .solution = sudo aa-status; cat /etc/apparmor.d/php-fpm; cat /etc/apparmor.d/local/php-fpm
hint-denied-upload-fixed =
    .lead = Nombra el sitio nuevo en el archivo del sitio, como el antiguo (el directorio mismo, y lo que contiene, en lectura y escritura), y luego haz que el núcleo vuelva a cargar el perfil que lo incluye (man apparmor_parser).
    .solution = sudo nano /etc/apparmor.d/local/php-fpm: /srv/scans/ r, y /srv/scans/** rw, ; luego sudo apparmor_parser -r /etc/apparmor.d/php-fpm
hint-denied-upload-end =
    .lead = ¿Todo en su sitio? El perfil en modo enforce y confinando php-fpm, el archivo del paquete intacto, los permisos como estaban, y una subida que ha funcionado.
    .solution = sudo aa-status; ls -ld /srv/scans; ls -l /srv/scans; sudo tail -3 /var/log/nginx/access.log

## Capítulo 2 — Un perfil propio

hint-backup-profile-script =
    .lead = ¿Qué hace la copia, y de dónde toma su lista? Lee el script y su configuración.
    .solution = cat /usr/local/sbin/zine-backup; cat /etc/zine-backup.conf
hint-backup-profile-profile-file =
    .lead = Un primer perfil para un programa se puede generar (man aa-autodep): en modo complain, observa sin denegar.
    .solution = sudo aa-autodep /usr/local/sbin/zine-backup; cat /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-observed =
    .lead = Deja que el núcleo vea el script trabajando: lanza la copia mientras su perfil está en modo complain, y luego mira el registro de auditoría.
    .solution = sudo zine-backup; sudo grep ALLOWED /var/log/audit/audit.log
hint-backup-profile-rules =
    .lead = Convierte las líneas ALLOWED en reglas: aa-logprof pregunta por cada una (Inherit para los programas, Glob para los archivos de un directorio y para el archivo comprimido, Allow), y luego guarda. O escríbelas a mano (man apparmor.d).
    .solution = sudo aa-logprof: I para date, tar, gzip; A para la capacidad; G hasta /srv/backup/*, /srv/scans/** y /var/lib/zinecat/**, luego A; S para guardar
hint-backup-profile-enforced =
    .lead = Las reglas están escritas: pon el perfil en modo enforce, en su archivo y en el núcleo (man aa-enforce).
    .solution = sudo aa-enforce /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-end =
    .lead = Lanza la copia una vez más, confinada: tiene que funcionar, con los escaneos y el catálogo, y /etc/shadow tiene que quedar fuera de su alcance (prueba a añadirlo a SOURCES, y luego quítalo).
    .solution = sudo zine-backup; sudo aa-status; sudo grep DENIED /var/log/audit/audit.log
