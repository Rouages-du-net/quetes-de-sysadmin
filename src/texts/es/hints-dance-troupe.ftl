### Pistas graduales de «La Compañía de Danza» (ver src/engine/hints.ts):
### un mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin
### el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — El bucket público

hint-public-bucket-exposed =
    .lead = Mira tú lo que vio el padre: pide el enlace de Esperanza desde la línea de comandos, sin ninguna clave (man curl).
    .solution = curl https://www.kestrel.example/members/medical-contacts-2032.csv
hint-public-bucket-website =
    .lead = ¿Qué bucket contiene el sitio web, y qué permite que cualquiera lo lea? La CLI de Garage describe un bucket (necesita sudo).
    .solution = sudo garage bucket list, luego sudo garage bucket info www.kestrel.example (mira «Website access»)
hint-public-bucket-moved =
    .lead = Crea un bucket sin acceso web para los documentos, da a la clave de administración derechos sobre él, y mueve allí los objetos de members/ con la AWS CLI (man garage, man aws).
    .solution = sudo garage bucket create members; sudo garage bucket allow --read --write --owner members --key troupe-admin; aws s3 mv s3://www.kestrel.example/members/ s3://members/ --recursive
hint-public-bucket-closed =
    .lead = Vuelve a comprobar la antigua dirección pública del documento, desde fuera.
    .solution = curl -i https://www.kestrel.example/members/medical-contacts-2032.csv (debería responder 404)
hint-public-bucket-deploy-key =
    .lead = Crea una clave solo para el despliegue, permítele leer y escribir el bucket del sitio web y nada más, ponla en el perfil deploy de ~/.aws/credentials, y ejecuta el script de despliegue.
    .solution = sudo garage key create site-deploy; sudo garage bucket allow --read --write www.kestrel.example --key site-deploy; aws configure set aws_access_key_id GK… --profile deploy (y el secreto); ~/bin/deploy-site
hint-public-bucket-backup-key =
    .lead = Lo mismo para la copia de seguridad de la oficina: su propia clave, lectura y escritura solo en backups, en /etc/rclone/office.conf; luego pruébala con rclone.
    .solution = sudo garage key create office-backup; sudo garage bucket allow --read --write backups --key office-backup; sudo nano /etc/rclone/office.conf (access_key_id, secret_access_key); sudo rclone --config /etc/rclone/office.conf ls garage:backups
hint-public-bucket-end =
    .lead = Comprueba cada parte: los documentos solo en un bucket privado, el sitio todavía servido, la clave de cada herramienta limitada a su bucket y probada.
    .solution = sudo garage bucket info www.kestrel.example; sudo garage key info site-deploy; ~/bin/deploy-site; sudo rclone --config /etc/rclone/office.conf ls garage:backups

## Capítulo 2 — La copia externa

hint-offsite-copy-failing =
    .lead = ¿Por qué falló la copia de anoche? La salida del servicio está en el diario.
    .solution = journalctl -u office-backup (o sudo /usr/local/bin/office-backup)
hint-offsite-copy-clock =
    .lead = Compara la fecha de bastidores con la del mensaje de Linh; luego mira cómo lleva la hora la máquina (man timedatectl).
    .solution = date; timedatectl; sudo timedatectl set-ntp true
hint-offsite-copy-region =
    .lead = Vuelve a ejecutar la copia y lee el nuevo error: el ámbito que esperaba nombra la región que quiere Garage.
    .solution = sudo nano /etc/rclone/office.conf: region = garage
hint-offsite-copy-write =
    .lead = Siguiente error: AccessDenied. ¿Qué puede hacer ahora la clave office-backup en backups? (man garage)
    .solution = sudo garage bucket info backups; sudo garage bucket allow --read --write backups --key office-backup
hint-offsite-copy-restored =
    .lead = El informe bueno está en el bucket, del 2 de abril: copia ese único objeto de vuelta a /srv/office (man rclone, man aws), antes de que un sync lo sustituya.
    .solution = sudo rclone --config /etc/rclone/office.conf copyto garage:backups/office/grants/arts-council-report-2031.txt /srv/office/grants/arts-council-report-2031.txt
hint-offsite-copy-safe =
    .lead = Haz que el script conserve lo que sync sustituye o borra, en el mismo bucket pero fuera de office/ (man rclone: --backup-dir); pruébalo antes con --dry-run.
    .solution = sudo nano /usr/local/bin/office-backup: añade --backup-dir garage:backups/office-old/$(date +%F) a la línea de rclone; luego sudo rclone --config /etc/rclone/office.conf sync -n /srv/office garage:backups/office --backup-dir garage:backups/office-old/test
hint-offsite-copy-synced =
    .lead = Ejecuta la copia de verdad, como lo hace el temporizador.
    .solution = sudo systemctl start office-backup (o sudo /usr/local/bin/office-backup), luego journalctl -u office-backup -n 5
hint-offsite-copy-checked =
    .lead = Compara el recurso compartido y su copia archivo por archivo (man rclone).
    .solution = sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office
hint-offsite-copy-end =
    .lead = Comprueba cada parte: el reloj, la configuración, la clave, el script, el informe, la copia.
    .solution = timedatectl; sudo cat /etc/rclone/office.conf /usr/local/bin/office-backup; sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office

## Capítulo 3 — El archivo grande

hint-big-file-failed-node =
    .lead = La máquina de Siosaia ha muerto: ¿qué dice el clúster de sus nodos? (man garage)
    .solution = sudo garage status
hint-big-file-safe =
    .lead = Antes de cambiar nada, mira el layout: los roles, las zonas, la versión.
    .solution = sudo garage layout show
hint-big-file-read-key =
    .lead = Crea una clave solo para este envío, que pueda leer media y nada más.
    .solution = sudo garage key create festival-share; sudo garage bucket allow --read media --key festival-share
hint-big-file-shared =
    .lead = Firma con esa clave un enlace para el vídeo, para una semana como mucho (man aws: presign, --expires-in en segundos), y escríbelo en el archivo que nombró Farrukh. Un perfil para la clave la mantiene fuera de tu historial.
    .solution = aws configure set aws_access_key_id GK… --profile festival (y el secreto, region garage, endpoint_url https://s3.kestrel.example); aws --profile festival s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 604800 > ~/enlace_para_zuri.txt
hint-big-file-replaced =
    .lead = Da al nodo nuevo el rol de porch, en la zona de porch (garage layout assign, --replace), mira el layout preparado, y luego aplícalo con su versión.
    .solution = sudo garage layout assign -z home -c 4T NEWID --replace OLDID (los ID de garage status); sudo garage layout show; sudo garage layout apply --version 4
hint-big-file-end =
    .lead = Comprueba las dos cosas: el enlace funciona desde fuera, y el clúster está sano.
    .solution = curl -I "$(cat ~/enlace_para_zuri.txt)"; sudo garage status
