### Indices gradués du Refuge (voir src/engine/hints.ts) : un message par
### étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans la
### commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Qu'avons-nous ?

hint-what-we-have-paddock =
    .lead = Le plan est sur prairie ; ce qu'il décrit tourne sur enclos. Lisez le plan, puis allez voir (man ssh).
    .solution = cat /srv/drp/plan.md, puis ssh enclos
hint-what-we-have-units =
    .lead = Commencez par ce que systemd fait tourner sur enclos : les services, chargés et actifs (man systemctl, list-units).
    .solution = systemctl list-units --type=service
hint-what-we-have-timers =
    .lead = Ce qui tourne tout seul, à heure fixe : les minuteries de systemd, et cron (man systemctl, list-timers ; man crontab).
    .solution = systemctl list-timers, puis systemctl cat vetlink-sync.service
hint-what-we-have-sockets =
    .lead = Ce qui écoute, et pour qui : les sockets TCP en LISTEN, avec leur processus (man ss).
    .solution = sudo ss -tlnp
hint-what-we-have-script =
    .lead = Le plan dit qu'une tâche nocturne fait les sauvegardes : la minuterie nomme le service, le service nomme le script. Que sauvegarde-t-il ?
    .solution = systemctl cat shelter-backup.service, puis cat /usr/local/sbin/shelter-backup
hint-what-we-have-snapshots =
    .lead = Ce que contient vraiment le dépôt : ses instantanés, leurs chemins, leurs dates. La tâche connaît le dépôt et son fichier de mot de passe (man restic).
    .solution = sur enclos : sudo restic -r sftp:restic@prairie.internal:/srv/restic -p /root/.restic-pass snapshots
hint-what-we-have-rows =
    .lead = Réécrivez le tableau du plan : une ligne par service qui tourne vraiment, un RPO que la tâche nocturne peut tenir, un RTO, sa sauvegarde, un·e responsable encore là.
    .solution = nano /srv/drp/plan.md : retirez phpList, RPO 24h pour l'appli, ajoutez | Fiches vétérinaires (vetlink) | 24h | 2j | restic, chaque nuit | Mirela |, responsables Teuila, vous, Mirela.
hint-what-we-have-fixed =
    .lead = Les fiches de vetlink doivent entrer dans la sauvegarde nocturne : sa ligne restic backup liste les chemins qu'elle prend.
    .solution = sur enclos : sudo nano /usr/local/sbin/shelter-backup, ajoutez /srv/vetlink à la ligne restic backup.
hint-what-we-have-saved =
    .lead = La tâche ne passe qu'à 2 h. D'ici là, vetlink n'a toujours aucune copie : une sauvegarde maintenant referme le trou.
    .solution = sur enclos : sudo /usr/local/sbin/shelter-backup (ou sudo systemctl start shelter-backup.service)
hint-what-we-have-end =
    .lead = Chaque service du tableau a besoin d'un instantané plus jeune que son RPO, et le tableau ne doit contenir que ce qui tourne.
    .solution = Vérifiez restic snapshots : le dernier contient /srv/vetlink, et aucun RPO du tableau n'est plus court que 24h.

## Chapitre 2 — Reconstruire sur la machine de secours

hint-rebuild-haven =
    .lead = Le message de Teuila, l'enveloppe et l'ordre de restauration du plan sont sur prairie ; la nouvelle machine s'appelle abri.
    .solution = cat /srv/drp/plan.md, cat enveloppe.txt, puis ssh abri
hint-rebuild-packages =
    .lead = La première étape du plan sur une machine vierge : les paquets dont ses services ont besoin, depuis Debian (man apt).
    .solution = sudo apt update, puis sudo apt install nginx postgresql
hint-rebuild-snapshots =
    .lead = L'adresse du dépôt et le mot de passe de secours sont dans l'enveloppe ; restic demande le mot de passe quand on n'en donne pas (man restic).
    .solution = sudo restic -r sftp:restic@prairie.internal:/srv/restic snapshots, puis le mot de passe de l'enveloppe.
hint-rebuild-restored =
    .lead = Restaurez le dernier instantané à côté du nouveau système, jamais par-dessus : --target nomme un répertoire vide, restic y recrée les chemins complets.
    .solution = sudo restic -r sftp:restic@prairie.internal:/srv/restic restore latest --target /srv/restore
hint-rebuild-copied =
    .lead = De ce qui a été restauré, ne recopiez que ce qui est aux refuges : le site, l'appli, les fiches de vetlink (man cp).
    .solution = sudo cp -r /srv/restore/var/www/shelter /var/www/, sudo cp -r /srv/restore/srv/adopt /srv/restore/srv/vetlink /srv/
hint-rebuild-database =
    .lead = La base revient depuis le dump de /srv/restore/var/backups : une base vide d'abord, puis le dump lu dedans, en tant que postgres (man createdb, man psql).
    .solution = sudo -u postgres createdb shelter, puis sudo -u postgres psql shelter -f /srv/restore/var/backups/shelter.sql
hint-rebuild-verified =
    .lead = La tâche a noté le SHA-256 du dump et les lignes de chaque table, à côté du dump : comparez (man sha256sum, man psql).
    .solution = cd /srv/restore/var/backups && sha256sum -c shelter.sha256 (et sudo -u postgres psql shelter -c "SELECT count(*) FROM animals" comparé à shelter.counts)
hint-rebuild-adopt =
    .lead = L'unité de l'appli est dans le /etc/systemd/system restauré : mettez-la en place, faites-la lire à systemd, démarrez-la une fois sa base là (man systemctl).
    .solution = sudo cp /srv/restore/etc/systemd/system/adopt.service /etc/systemd/system/, sudo systemctl daemon-reload, sudo systemctl enable --now adopt
hint-rebuild-nginx =
    .lead = nginx a besoin du fichier de site des refuges, activé, sa configuration vérifiée, puis rechargée (man nginx).
    .solution = sudo cp /srv/restore/etc/nginx/sites-available/shelter /etc/nginx/sites-available/, sudo ln -s /etc/nginx/sites-available/shelter /etc/nginx/sites-enabled/, sudo nginx -t, sudo systemctl reload nginx
hint-rebuild-vetlink =
    .lead = Les fiches vétérinaires de Mirela sont aussi dans l'instantané, sous /srv/vetlink.
    .solution = sudo cp -r /srv/restore/srv/vetlink /srv/
hint-rebuild-tested =
    .lead = Testez sur abri même, en demandant le site par son nom et l'appli derrière /adopt/ (man curl, -H).
    .solution = curl -H "Host: www.hillsideshelters.example" http://localhost/adopt/animals
hint-rebuild-end =
    .lead = L'ordre de restauration du plan, jusqu'au bout : le site, l'appli sur sa base vérifiée, les fiches de vetlink, un test local.
    .solution = Vérifiez avec curl -H "Host: www.hillsideshelters.example" http://localhost/ et /adopt/animals sur abri.

## Chapitre 3 — Basculer et apprendre

hint-switch-and-learn-outside-closed =
    .lead = Avant de bouger le nom, vérifiez depuis ici que l'adresse publique de la Rivière répond avec le site (man curl).
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/
hint-switch-and-learn-opened =
    .lead = Le pare-feu d'abri ne laisse entrer que ssh : le web doit passer aussi (man ufw).
    .solution = sur abri : sudo ufw allow 80/tcp (ou sudo ufw allow "Nginx HTTP"), puis sudo ufw status
hint-switch-and-learn-outside =
    .lead = Maintenant qu'abri laisse entrer le web, vérifiez de nouveau depuis prairie, par l'adresse publique.
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/adopt/animals
hint-switch-and-learn-zone =
    .lead = La zone est sur prairie, dans /etc/bind : l'adresse de www change, et le numéro de série aussi, avant que named ne la recharge (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/db.hillsideshelters.example : www → 203.0.113.163, série 2031111401 ; sudo named-checkzone hillsideshelters.example /etc/bind/db.hillsideshelters.example ; sudo rndc reload
hint-switch-and-learn-switched =
    .lead = Interrogez le serveur du registraire, celui que le monde interroge : sert-il la nouvelle adresse (man dig) ?
    .solution = dig @ns1.registrar.example www.hillsideshelters.example
hint-switch-and-learn-resolver =
    .lead = Le résolveur public garde ce qu'on lui a dit pendant le TTL : interrogez-le, et encore quelques minutes plus tard.
    .solution = dig www.hillsideshelters.example (le TTL de la réponse décompte)
hint-switch-and-learn-review =
    .lead = Remplissez chaque section de retour.md : les heures de la chronologie viennent des journaux (sitewatch.log, les instantanés, le journal de named) ; chaque action a un·e responsable ; personne à blâmer.
    .solution = nano retour.md : Chronologie avec 02:00 (dernière sauvegarde), 02:50 (première vérification ratée), l'heure de la bascule ; Actions sous la forme « - Sortir le serveur de la cave (Wiremu) ».
hint-switch-and-learn-drill =
    .lead = Le script de Mirela ne fait que lister les instantanés. Un exercice restaure à côté, vérifie ce qui est revenu, et tourne tout seul (man restic, man sha256sum, man crontab).
    .solution = sudo nano /usr/local/sbin/restore-drill : restic restore latest --target /tmp/drill --include /var/backups, puis cd /tmp/drill/var/backups && sha256sum -c shelter.sha256 ; sudo crontab -e : 0 4 1 * * /usr/local/sbin/restore-drill
hint-switch-and-learn-end =
    .lead = Tout à la fois : www servi par abri au monde, vérifié de l'extérieur, le retour écrit, l'exercice programmé.
    .solution = dig @ns1.registrar.example www.hillsideshelters.example, curl depuis prairie, retour.md complet, l'exercice dans la crontab de root.
