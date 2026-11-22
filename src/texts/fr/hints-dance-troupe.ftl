### Indices gradués de La Troupe de danse (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Le Bucket public

hint-public-bucket-exposed =
    .lead = Vois par toi-même ce qu'a vu le parent : demande le lien d'Esperanza en ligne de commande, sans aucune clé (man curl).
    .solution = curl https://www.kestrel.example/members/medical-contacts-2032.csv
hint-public-bucket-website =
    .lead = Quel bucket contient le site, et qu'est-ce qui permet à tout le monde de le lire ? L'outil de Garage décrit un bucket (il lui faut sudo).
    .solution = sudo garage bucket list, puis sudo garage bucket info www.kestrel.example (regarde « Website access »)
hint-public-bucket-moved =
    .lead = Crée un bucket sans accès web pour les documents, donne des droits dessus à la clé d'administration, et déplaces-y les objets de members/ avec l'outil AWS (man garage, man aws).
    .solution = sudo garage bucket create members ; sudo garage bucket allow --read --write --owner members --key troupe-admin ; aws s3 mv s3://www.kestrel.example/members/ s3://members/ --recursive
hint-public-bucket-closed =
    .lead = Vérifie de nouveau l'ancienne adresse publique du document, depuis l'extérieur.
    .solution = curl -i https://www.kestrel.example/members/medical-contacts-2032.csv (elle doit répondre 404)
hint-public-bucket-deploy-key =
    .lead = Crée une clé pour la seule publication, permets-lui de lire et d'écrire le bucket du site et rien d'autre, mets-la dans le profil deploy de ~/.aws/credentials, et lance le script de publication.
    .solution = sudo garage key create site-deploy ; sudo garage bucket allow --read --write www.kestrel.example --key site-deploy ; aws configure set aws_access_key_id GK… --profile deploy (et le secret) ; ~/bin/deploy-site
hint-public-bucket-backup-key =
    .lead = Pareil pour la sauvegarde du bureau : sa propre clé, read et write sur backups seulement, dans /etc/rclone/office.conf ; puis essaie-la avec rclone.
    .solution = sudo garage key create office-backup ; sudo garage bucket allow --read --write backups --key office-backup ; sudo nano /etc/rclone/office.conf (access_key_id, secret_access_key) ; sudo rclone --config /etc/rclone/office.conf ls garage:backups
hint-public-bucket-end =
    .lead = Vérifie chaque partie : les documents seulement dans un bucket privé, le site toujours servi, la clé de chaque outil limitée à son bucket et essayée.
    .solution = sudo garage bucket info www.kestrel.example ; sudo garage key info site-deploy ; ~/bin/deploy-site ; sudo rclone --config /etc/rclone/office.conf ls garage:backups

## Chapitre 2 — La Copie hors site

hint-offsite-copy-failing =
    .lead = Pourquoi la sauvegarde de cette nuit a-t-elle échoué ? La sortie du service est dans le journal.
    .solution = journalctl -u office-backup (ou sudo /usr/local/bin/office-backup)
hint-offsite-copy-clock =
    .lead = Compare la date de coulisses avec celle du message de Linh ; puis regarde comment la machine garde l'heure (man timedatectl).
    .solution = date ; timedatectl ; sudo timedatectl set-ntp true
hint-offsite-copy-region =
    .lead = Relance la sauvegarde et lis la nouvelle erreur : la portée attendue donne la région que veut Garage.
    .solution = sudo nano /etc/rclone/office.conf : region = garage
hint-offsite-copy-write =
    .lead = Erreur suivante : AccessDenied. Que peut faire la clé office-backup sur backups maintenant ? (man garage)
    .solution = sudo garage bucket info backups ; sudo garage bucket allow --read --write backups --key office-backup
hint-offsite-copy-restored =
    .lead = Le bon rapport est dans le bucket, du 2 avril : recopie ce seul objet dans /srv/office (man rclone, man aws), avant qu'un sync ne le remplace.
    .solution = sudo rclone --config /etc/rclone/office.conf copyto garage:backups/office/grants/arts-council-report-2031.txt /srv/office/grants/arts-council-report-2031.txt
hint-offsite-copy-safe =
    .lead = Fais garder au script ce que sync remplace ou supprime, dans le même bucket mais hors de office/ (man rclone : --backup-dir) ; essaie d'abord avec --dry-run.
    .solution = sudo nano /usr/local/bin/office-backup : ajoute --backup-dir garage:backups/office-old/$(date +%F) à la ligne rclone ; puis sudo rclone --config /etc/rclone/office.conf sync -n /srv/office garage:backups/office --backup-dir garage:backups/office-old/test
hint-offsite-copy-synced =
    .lead = Lance la sauvegarde pour de vrai, comme le fait le minuteur.
    .solution = sudo systemctl start office-backup (ou sudo /usr/local/bin/office-backup), puis journalctl -u office-backup -n 5
hint-offsite-copy-checked =
    .lead = Compare le partage et sa copie fichier par fichier (man rclone).
    .solution = sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office
hint-offsite-copy-end =
    .lead = Vérifie chaque partie : l'horloge, la configuration, la clé, le script, le rapport, la copie.
    .solution = timedatectl ; sudo cat /etc/rclone/office.conf /usr/local/bin/office-backup ; sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office

## Chapitre 3 — Le Gros Fichier

hint-big-file-failed-node =
    .lead = La machine de Siosaia est morte : que dit la grappe de ses nœuds ? (man garage)
    .solution = sudo garage status
hint-big-file-safe =
    .lead = Avant de changer quoi que ce soit, regarde l'agencement : les rôles, les zones, la version.
    .solution = sudo garage layout show
hint-big-file-read-key =
    .lead = Crée une clé pour ce seul partage, qui peut lire media et rien d'autre.
    .solution = sudo garage key create festival-share ; sudo garage bucket allow --read media --key festival-share
hint-big-file-shared =
    .lead = Signe un lien pour la vidéo avec cette clé, pour une semaine au plus (man aws : presign, --expires-in en secondes), et écris-le dans le fichier nommé par Farrukh. Un profil pour la clé la garde hors de ton historique.
    .solution = aws configure set aws_access_key_id GK… --profile festival (et le secret, region garage, endpoint_url https://s3.kestrel.example) ; aws --profile festival s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 604800 > ~/lien_pour_zuri.txt
hint-big-file-replaced =
    .lead = Donne au nouveau nœud le rôle de porch, dans la zone de porch (garage layout assign, --replace), regarde l'agencement préparé, puis applique-le avec sa version.
    .solution = sudo garage layout assign -z home -c 4T NOUVEL_ID --replace ANCIEN_ID (les ID de garage status) ; sudo garage layout show ; sudo garage layout apply --version 4
hint-big-file-end =
    .lead = Vérifie les deux : le lien marche depuis l'extérieur, et la grappe est en bonne santé.
    .solution = curl -I "$(cat ~/lien_pour_zuri.txt)" ; sudo garage status
