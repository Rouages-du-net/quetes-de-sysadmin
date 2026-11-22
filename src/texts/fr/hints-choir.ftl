### Indices gradués pour La Chorale (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans
### la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Gardé pour toujours

hint-kept-forever-policy =
    .lead = Qu'a promis le bureau ? Lisez la politique de conservation dont parle Amara.
    .solution = cat /srv/choir/docs/politique-de-conservation.txt
hint-kept-forever-forever =
    .lead = Comparez avec ce que garde le serveur : listez les journaux du serveur web, et lisez comment logrotate les fait tourner.
    .solution = ls /var/log/nginx | tail; ls /var/log/nginx | wc -l; cat /etc/logrotate.d/nginx
hint-kept-forever-rotation =
    .lead = Faites garder à logrotate trente jours de journaux d'accès au plus (man logrotate : daily, rotate, maxage).
    .solution = sudo nano /etc/logrotate.d/nginx : daily, rotate 30 (ou weekly avec rotate 3, ou ajoutez maxage 30) ; sudo logrotate -d /etc/logrotate.d/nginx
hint-kept-forever-purged =
    .lead = logrotate ne supprimera pas les centaines d'archives laissées par son ancien compte : trouvez-les par leur âge, vérifiez la liste, puis supprimez-les. Gardez les dernières semaines.
    .solution = find /var/log/nginx -name 'access.log.*' -mtime +30 ; puis sudo find /var/log/nginx -name 'access.log.*' -mtime +30 -delete
hint-kept-forever-anonymised =
    .lead = Écrivez une variable qui contient l'adresse tronquée (man nginx : map, avec une expression régulière pour IPv4, une pour IPv6, et une valeur par défaut), un log_format qui l'utilise, et donnez-le à access_log. Testez, rechargez.
    .solution = dans /etc/nginx/conf.d/anonymise.conf : map $remote_addr $remote_addr_anon {"{"} ~(?P<ip>\d+\.\d+\.\d+)\. $ip.0; ~(?P<ip>[^:]+:[^:]+): $ip::; default 0.0.0.0; {"}"} et log_format anonymised '$remote_addr_anon - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"'; puis access_log /var/log/nginx/access.log anonymised; dans nginx.conf ; sudo nginx -t ; sudo systemctl reload nginx
hint-kept-forever-journal =
    .lead = Le journal garde des années lui aussi (journalctl --disk-usage, ls /var/log/journal/*). Donnez à journald un âge maximum (man journald.conf), puis redémarrez-le.
    .solution = sudo nano /etc/systemd/journald.conf : MaxRetentionSec=30day sous [Journal] ; sudo systemctl restart systemd-journald
hint-kept-forever-end =
    .lead = Vérifiez tout au regard de la politique : les journaux web (trente jours, adresses tronquées), le journal d'audit (douze mois, intact), le journal du système (trente jours).
    .solution = sudo tail -n 3 /var/log/nginx/access.log ; ls -l /var/log/nginx /var/log/choir ; journalctl --disk-usage

## Chapitre 2 — La Demande d'accès

hint-access-request-her-row =
    .lead = Commencez par la base de l'appli des choristes : quelles tables, et sa ligne dans la table des choristes (man psql ; la base s'appelle choir, son administrateur est postgres).
    .solution = sudo -u postgres psql choir -c '\dt' ; sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Raman'"
hint-access-request-tables =
    .lead = D'autres tables pointent vers elle par son identifiant (27) ou son adresse électronique : interrogez chacune, et écrivez les résultats dans le dossier de la réponse.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM attendance WHERE member_id = 27" > /srv/choir/demandes-rgpd/priya-raman/presences.txt (de même pour payments ; newsletter WHERE email = 'priya.raman@mail.example' ; et members WHERE id = 27)
hint-access-request-uploads =
    .lead = L'espace choristes range les fichiers envoyés dans un dossier par identifiant de choriste.
    .solution = sudo ls /srv/choir/uploads/27 ; sudo cp /srv/choir/uploads/27/* /srv/choir/demandes-rgpd/priya-raman/
hint-access-request-logs =
    .lead = Cherchez son adresse électronique dans les journaux, compressés compris (man zgrep), et ne gardez que ses lignes.
    .solution = grep -rl priya.raman /var/log ; grep priya.raman@mail.example /var/log/choir/audit.log ; zgrep priya.raman@mail.example /var/log/choir/audit.log.1.gz ; grep priya.raman@mail.example /var/log/mail.log (chacun > un fichier de la réponse)
hint-access-request-old-copy =
    .lead = Est-elle ailleurs sur le disque ? Cherchez son nom ou son téléphone dans les fichiers de la chorale.
    .solution = sudo grep -r 'Priya Raman' /srv/choir ; sudo grep 'Priya Raman' /srv/choir/exports/phone-tree-2030-10.csv > /srv/choir/demandes-rgpd/priya-raman/chaine.txt
hint-access-request-end =
    .lead = Vérifiez la réponse : toutes ses données, et celles de personne d'autre (aucune autre adresse électronique, aucun autre téléphone).
    .solution = ls -l /srv/choir/demandes-rgpd/priya-raman ; grep -rh '@' /srv/choir/demandes-rgpd/priya-raman | grep -v priya.raman

## Chapitre 3 — Oubliez-moi

hint-forget-me-found =
    .lead = Trouvez Tomas dans la base, et chaque table qui pointe vers lui.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Novak'" ; puis attendance et payments WHERE member_id = 41, newsletter WHERE email = 'tomas.novak@mail.example'
hint-forget-me-erased =
    .lead = Supprimez-le des tables que l'effacement atteint, et laissez les cotisations (la politique garde les pièces comptables dix ans).
    .solution = sudo -u postgres psql choir -c "DELETE FROM attendance WHERE member_id = 41; DELETE FROM newsletter WHERE email = 'tomas.novak@mail.example'; DELETE FROM members WHERE id = 41"
hint-forget-me-uploads =
    .lead = Sa photo et son formulaire de consentement sont dans les fichiers envoyés, sous son identifiant.
    .solution = sudo ls /srv/choir/uploads/41 ; sudo rm /srv/choir/uploads/41/photo.jpg /srv/choir/uploads/41/consent-form.pdf ; sudo rmdir /srv/choir/uploads/41
hint-forget-me-purge-broken =
    .lead = La purge de Ruben a-t-elle jamais tourné ? Regardez les minuteurs (tous), le service et son journal.
    .solution = systemctl list-timers --all ; systemctl cat choir-purge.service ; sudo systemctl start choir-purge.service ; sudo journalctl -u choir-purge
hint-forget-me-purge =
    .lead = Corrigez le compte sous lequel elle tourne (un compte qui a un rôle dans la base), ajoutez les présences au script, rechargez systemd, démarrez le service pour tester, et activez le minuteur.
    .solution = sudo nano /etc/systemd/system/choir-purge.service (User=postgres) ; sudo nano /usr/local/sbin/choir-purge (psql choir -c "DELETE FROM attendance WHERE rehearsed_on < current_date - interval '2 years'") ; sudo systemctl daemon-reload ; sudo systemctl start choir-purge.service ; sudo systemctl enable --now choir-purge.timer
hint-forget-me-snapshots =
    .lead = Que contiennent les sauvegardes ? Listez les instantanés du dépôt restic (son emplacement et son mot de passe sont dans le script de sauvegarde).
    .solution = sudo cat /usr/local/sbin/choir-backup ; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
hint-forget-me-trimmed =
    .lead = Oubliez les instantanés de plus de trois mois environ, et supprimez leurs données (man restic : forget, --keep-weekly, --keep-within, --prune). Essayez d'abord --dry-run.
    .solution = sudo restic -r /var/backups/restic --password-file /root/.restic-pass forget --keep-weekly 13 --prune
hint-forget-me-script =
    .lead = Faites oublier la sauvegarde hebdomadaire toute seule : le même forget, avec --prune, après la sauvegarde dans son script.
    .solution = sudo nano /usr/local/sbin/choir-backup : restic forget --keep-weekly 13 --prune après restic backup
hint-forget-me-end =
    .lead = Vérifiez tout : Tomas parti mais ses paiements gardés, le minuteur de purge actif, les sauvegardes taillées et le script prêt.
    .solution = systemctl list-timers ; sudo -u postgres psql choir -c "SELECT * FROM payments WHERE member_id = 41" ; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
