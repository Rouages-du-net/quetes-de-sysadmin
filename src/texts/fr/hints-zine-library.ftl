### Indices gradués de La Fanzinothèque (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Refusé

hint-denied-upload-denied =
    .lead = « Permission denied » alors que les droits sont bons : quelque chose d'autre refuse. Le noyau note les refus d'AppArmor (man journalctl, -k ; les notes de Bartek).
    .solution = sudo journalctl -k | grep DENIED (ou sudo dmesg | grep DENIED)
hint-denied-upload-profile =
    .lead = Quel profil confine php-fpm, et où prend-il les règles propres au site ? aa-status liste les profils ; lisez le fichier du profil.
    .solution = sudo aa-status ; cat /etc/apparmor.d/php-fpm ; cat /etc/apparmor.d/local/php-fpm
hint-denied-upload-fixed =
    .lead = Nommez la nouvelle place dans le fichier du site, comme l'ancienne (le répertoire lui-même, et ce qu'il contient, en lecture et écriture), puis faites recharger au noyau le profil qui l'inclut (man apparmor_parser).
    .solution = sudo nano /etc/apparmor.d/local/php-fpm : /srv/scans/ r, et /srv/scans/** rw, ; puis sudo apparmor_parser -r /etc/apparmor.d/php-fpm
hint-denied-upload-end =
    .lead = Tout est en place ? Le profil en mode enforce et qui confine php-fpm, le fichier du paquet intact, les droits comme avant, et un envoi passé.
    .solution = sudo aa-status ; ls -ld /srv/scans ; ls -l /srv/scans ; sudo tail -3 /var/log/nginx/access.log

## Chapitre 2 — Un profil à nous

hint-backup-profile-script =
    .lead = Que fait la sauvegarde, et où prend-elle sa liste ? Lisez le script et sa configuration.
    .solution = cat /usr/local/sbin/zine-backup ; cat /etc/zine-backup.conf
hint-backup-profile-profile-file =
    .lead = Un premier profil pour un programme peut se générer (man aa-autodep) : en mode complain, il observe sans refuser.
    .solution = sudo aa-autodep /usr/local/sbin/zine-backup ; cat /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-observed =
    .lead = Laissez le noyau voir le script au travail : lancez la sauvegarde pendant que son profil est en mode complain, puis regardez le journal d'audit.
    .solution = sudo zine-backup ; sudo grep ALLOWED /var/log/audit/audit.log
hint-backup-profile-rules =
    .lead = Transformez les lignes ALLOWED en règles : aa-logprof les demande une à une (Inherit pour les programmes, Glob pour les fichiers d'un répertoire et pour l'archive, Allow), puis sauvegardez. Ou écrivez-les à la main (man apparmor.d).
    .solution = sudo aa-logprof : I pour date, tar, gzip ; A pour la capacité ; G jusqu'à /srv/backup/*, /srv/scans/** et /var/lib/zinecat/**, puis A ; S pour sauvegarder
hint-backup-profile-enforced =
    .lead = Les règles sont écrites : passez le profil en mode enforce, dans son fichier et dans le noyau (man aa-enforce).
    .solution = sudo aa-enforce /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-end =
    .lead = Lancez la sauvegarde une fois de plus, confinée : elle doit réussir, avec les scans et le catalogue, et /etc/shadow doit rester hors d'atteinte (essayez de l'ajouter à SOURCES, puis retirez-le).
    .solution = sudo zine-backup ; sudo aa-status ; sudo grep DENIED /var/log/audit/audit.log
