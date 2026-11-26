### Abgestufte Hinweise für „Die Tanzgruppe“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Der öffentliche Bucket

hint-public-bucket-exposed =
    .lead = Sieh selbst, was der Vater gesehen hat: Ruf Esperanzas Link von der Kommandozeile ab, ohne Schlüssel (man curl).
    .solution = curl https://www.kestrel.example/members/medical-contacts-2032.csv
hint-public-bucket-website =
    .lead = Welcher Bucket enthält die Website, und was erlaubt allen, ihn zu lesen? Die CLI von Garage beschreibt einen Bucket (sie braucht sudo).
    .solution = sudo garage bucket list, dann sudo garage bucket info www.kestrel.example (schau auf „Website access“)
hint-public-bucket-moved =
    .lead = Leg für die Dokumente einen Bucket ohne Website-Zugriff an, gib dem Admin-Schlüssel Rechte darauf und verschieb die Objekte von members/ mit der AWS CLI dorthin (man garage, man aws).
    .solution = sudo garage bucket create members; sudo garage bucket allow --read --write --owner members --key troupe-admin; aws s3 mv s3://www.kestrel.example/members/ s3://members/ --recursive
hint-public-bucket-closed =
    .lead = Prüf die alte öffentliche Adresse des Dokuments noch einmal, von außen.
    .solution = curl -i https://www.kestrel.example/members/medical-contacts-2032.csv (es sollte mit 404 antworten)
hint-public-bucket-deploy-key =
    .lead = Leg einen Schlüssel nur für das Deployment an, erlaube ihm, den Bucket der Website zu lesen und zu schreiben, und sonst nichts, trag ihn ins Profil deploy von ~/.aws/credentials ein und führ das Deploy-Skript aus.
    .solution = sudo garage key create site-deploy; sudo garage bucket allow --read --write www.kestrel.example --key site-deploy; aws configure set aws_access_key_id GK… --profile deploy (und das Secret); ~/bin/deploy-site
hint-public-bucket-backup-key =
    .lead = Dasselbe für das Backup des Büros: ein eigener Schlüssel, read und write nur auf backups, in /etc/rclone/office.conf; dann probier es mit rclone.
    .solution = sudo garage key create office-backup; sudo garage bucket allow --read --write backups --key office-backup; sudo nano /etc/rclone/office.conf (access_key_id, secret_access_key); sudo rclone --config /etc/rclone/office.conf ls garage:backups
hint-public-bucket-end =
    .lead = Prüfe jeden Teil: die Dokumente nur in einem privaten Bucket, die Website wird noch ausgeliefert, der Schlüssel jedes Werkzeugs auf seinen Bucket beschränkt und ausprobiert.
    .solution = sudo garage bucket info www.kestrel.example; sudo garage key info site-deploy; ~/bin/deploy-site; sudo rclone --config /etc/rclone/office.conf ls garage:backups

## Kapitel 2 — Die Kopie außer Haus

hint-offsite-copy-failing =
    .lead = Warum ist das Backup letzte Nacht gescheitert? Die Ausgabe des Dienstes steht im Journal.
    .solution = journalctl -u office-backup (oder sudo /usr/local/bin/office-backup)
hint-offsite-copy-clock =
    .lead = Vergleiche das Datum von kulissen mit dem Datum von Linhs Nachricht; dann schau, wie die Maschine ihre Zeit hält (man timedatectl).
    .solution = date; timedatectl; sudo timedatectl set-ntp true
hint-offsite-copy-region =
    .lead = Führ das Backup noch einmal aus und lies den neuen Fehler: Der erwartete Geltungsbereich nennt die Region, die Garage will.
    .solution = sudo nano /etc/rclone/office.conf: region = garage
hint-offsite-copy-write =
    .lead = Nächster Fehler: AccessDenied. Was darf der Schlüssel office-backup jetzt auf backups? (man garage)
    .solution = sudo garage bucket info backups; sudo garage bucket allow --read --write backups --key office-backup
hint-offsite-copy-restored =
    .lead = Der gute Bericht liegt im Bucket, vom 2. April: Kopier genau dieses Objekt zurück nach /srv/office (man rclone, man aws), bevor ein sync es ersetzt.
    .solution = sudo rclone --config /etc/rclone/office.conf copyto garage:backups/office/grants/arts-council-report-2031.txt /srv/office/grants/arts-council-report-2031.txt
hint-offsite-copy-safe =
    .lead = Bring das Skript dazu, aufzubewahren, was sync ersetzt oder löscht, im selben Bucket, aber außerhalb von office/ (man rclone: --backup-dir); probier es zuerst mit --dry-run.
    .solution = sudo nano /usr/local/bin/office-backup: --backup-dir garage:backups/office-old/$(date +%F) zur rclone-Zeile hinzufügen; dann sudo rclone --config /etc/rclone/office.conf sync -n /srv/office garage:backups/office --backup-dir garage:backups/office-old/test
hint-offsite-copy-synced =
    .lead = Führ das Backup wirklich aus, so wie der Timer es tut.
    .solution = sudo systemctl start office-backup (oder sudo /usr/local/bin/office-backup), dann journalctl -u office-backup -n 5
hint-offsite-copy-checked =
    .lead = Vergleiche die Freigabe und ihre Kopie Datei für Datei (man rclone).
    .solution = sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office
hint-offsite-copy-end =
    .lead = Prüfe jeden Teil: die Uhr, die Konfiguration, den Schlüssel, das Skript, den Bericht, die Kopie.
    .solution = timedatectl; sudo cat /etc/rclone/office.conf /usr/local/bin/office-backup; sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office

## Kapitel 3 — Die große Datei

hint-big-file-failed-node =
    .lead = Siosaias Maschine ist gestorben: Was sagt der Cluster über seine Knoten? (man garage)
    .solution = sudo garage status
hint-big-file-safe =
    .lead = Bevor du etwas änderst, schau dir das Layout an: die Rollen, die Zonen, die Version.
    .solution = sudo garage layout show
hint-big-file-read-key =
    .lead = Leg einen Schlüssel nur für diese Freigabe an, der media lesen kann und sonst nichts.
    .solution = sudo garage key create festival-share; sudo garage bucket allow --read media --key festival-share
hint-big-file-shared =
    .lead = Signiere mit diesem Schlüssel einen Link für das Video, für höchstens eine Woche (man aws: presign, --expires-in in Sekunden), und schreib ihn in die Datei, die Farrukh genannt hat. Ein Profil für den Schlüssel hält ihn aus deiner History heraus.
    .solution = aws configure set aws_access_key_id GK… --profile festival (und das Secret, region garage, endpoint_url https://s3.kestrel.example); aws --profile festival s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 604800 > ~/link_fuer_zuri.txt
hint-big-file-replaced =
    .lead = Gib dem neuen Knoten die Rolle von porch, in der Zone von porch (garage layout assign, --replace), schau dir das vorgemerkte Layout an und wende es dann mit seiner Version an.
    .solution = sudo garage layout assign -z home -c 4T NEUEID --replace ALTEID (die IDs aus garage status); sudo garage layout show; sudo garage layout apply --version 4
hint-big-file-end =
    .lead = Prüfe beides: Der Link funktioniert von außen, und der Cluster ist gesund.
    .solution = curl -I "$(cat ~/link_fuer_zuri.txt)"; sudo garage status
