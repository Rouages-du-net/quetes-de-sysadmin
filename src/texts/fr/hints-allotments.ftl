### Indices gradués des Jardins (voir src/engine/hints.ts) : un message par
### étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans la
### commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Connexions endormies

hint-sleeping-connections-crowd =
    .lead = Qui tient les connexions de la base ? Ouvrez MariaDB en root du système et listez les connexions (man mariadb).
    .solution = sudo mariadb -e "SHOW PROCESSLIST" | head ; sudo mariadb -e "SHOW PROCESSLIST" | grep -c Sleep
hint-sleeping-connections-timeout =
    .lead = Combien de temps une connexion peut-elle dormir avant que le serveur la ferme ? Regardez les variables de délai, et baissez la bonne pour le serveur en marche.
    .solution = sudo mariadb -e "SHOW VARIABLES LIKE 'wait_timeout'" ; sudo mariadb -e "SET GLOBAL wait_timeout = 300"
hint-sleeping-connections-cleared =
    .lead = Les connexions déjà ouvertes ont gardé leur ancien délai : listez leurs identifiants et fermez-les.
    .solution = sudo mariadb -N -e "SELECT id FROM information_schema.PROCESSLIST WHERE command = 'Sleep' AND user = 'plotline'" | sudo xargs -n1 mariadb-admin kill (ou KILL id; pour chacune)
hint-sleeping-connections-persisted =
    .lead = SET GLOBAL dure jusqu'au prochain démarrage : écrivez la même valeur là où le serveur lit ses réglages au démarrage.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf : wait_timeout = 300 sous [mariadbd]
hint-sleeping-connections-slow-log =
    .lead = Chaque page de parcelle est lente aussi : demandez à MariaDB de noter les requêtes lentes (le journal des requêtes lentes), puis lisez-le.
    .solution = sudo mariadb -e "SET GLOBAL slow_query_log = ON; SET GLOBAL long_query_time = 1" ; puis sudo tail /var/lib/mysql/truelle-slow.log (SHOW VARIABLES LIKE 'slow_query_log_file')
hint-sleeping-connections-explain =
    .lead = Demandez à MariaDB comment il exécute cette requête (EXPLAIN) : quel index, combien de lignes ?
    .solution = sudo mariadb plots -e "EXPLAIN SELECT * FROM bookings WHERE plot_id = 17 ORDER BY starts_on DESC"
hint-sleeping-connections-index =
    .lead = Donnez à bookings un index sur la colonne que filtre la clause WHERE (man mariadb : CREATE INDEX).
    .solution = sudo mariadb plots -e "CREATE INDEX idx_plot ON bookings (plot_id)"
hint-sleeping-connections-end =
    .lead = Vérifiez l'ensemble : le délai en marche et dans le fichier, plus de vieille connexion endormie, l'index, un max_connections raisonnable.
    .solution = sudo mariadb -e "SHOW PROCESSLIST" ; grep -E 'wait_timeout|max_connections' /etc/mysql/mariadb.conf.d/50-server.cnf ; sudo mariadb plots -e "SHOW INDEX FROM bookings"

## Chapitre 2 — Le moindre privilège

hint-least-privilege-scan =
    .lead = Lisez le rapport de Selin : quel port répond depuis internet, et qu'y a-t-il derrière ?
    .solution = cat scan_de_selin.txt ; sudo ss -tlnp | grep 3306
hint-least-privilege-accounts =
    .lead = Listez les comptes de la base, avec l'adresse d'où chacun peut venir et sa façon de s'authentifier, puis leurs droits.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user" ; sudo mariadb -e "SHOW GRANTS FOR 'root'@'%'"
hint-least-privilege-app-account =
    .lead = Créez un compte pour l'appli seule, depuis l'adresse de barrow, avec seulement les instructions qu'elle exécute sur plots (man mariadb : CREATE USER, GRANT).
    .solution = sudo mariadb -e "CREATE USER 'app'@'198.51.100.134' IDENTIFIED BY 'un-long-mot-de-passe-neuf'; GRANT SELECT, INSERT, UPDATE, DELETE ON plots.* TO 'app'@'198.51.100.134'"
hint-least-privilege-app-switched =
    .lead = Sur barrow, donnez à l'appli son nouveau compte dans ses réglages, puis redémarrez-la pour qu'elle les lise. Vérifiez son journal.
    .solution = ssh barrow ; sudo nano /srv/plotline/.env (DB_USER=app, DB_PASSWORD=…) ; sudo systemctl restart plotline ; sudo tail /var/log/plotline/app.log
hint-least-privilege-root-local =
    .lead = Plus personne n'a besoin de root depuis le réseau : supprimez ce compte, et gardez root@localhost en unix_socket.
    .solution = sudo mariadb -e "DROP USER 'root'@'%'" ; sudo mariadb -e "SHOW GRANTS FOR 'root'@'localhost'"
hint-least-privilege-cleanup =
    .lead = Retirez ce qui ne sert à personne : les comptes anonymes, la base test et ses droits, le compte de l'ancien serveur shed (mariadb-secure-installation en fait une partie).
    .solution = sudo mariadb-secure-installation (répondre Y), puis sudo mariadb -e "DROP USER 'plotline'@'198.51.100.133'"
hint-least-privilege-network =
    .lead = MariaDB écoute sur toutes les adresses : faites-le écouter sur le réseau arrière seulement (bind-address, puis un redémarrage), ou ne laissez entrer que le réseau arrière avec le pare-feu.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf : bind-address = 198.51.100.131 ; sudo systemctl restart mariadb ; sudo ss -tlnp | grep 3306
hint-least-privilege-end =
    .lead = Vérifiez l'ensemble : le journal de l'appli sur barrow, les comptes et leurs droits, où MariaDB écoute.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user" ; sudo ss -tlnp ; ssh barrow sudo tail -n 3 /var/log/plotline/app.log

## Chapitre 3 — Le réplica en panne

hint-broken-replica-stopped =
    .lead = Allez sur rake et demandez au réplica son état : quel thread tourne, lequel s'est arrêté, et pourquoi ?
    .solution = ssh rake ; sudo mariadb -e "SHOW REPLICA STATUS\G"
hint-broken-replica-cause =
    .lead = L'erreur nomme une table et un identifiant : regardez cette ligne sur rake, puis sur truelle.
    .solution = sudo mariadb plots -e "SELECT * FROM waitlist WHERE id = 1043" (sur rake, puis sur truelle)
hint-broken-replica-read-only =
    .lead = D'abord, empêchez quiconque d'écrire de nouveau sur rake (man mariadb : read_only).
    .solution = sur rake : sudo mariadb -e "SET GLOBAL read_only = ON"
hint-broken-replica-read-only-kept =
    .lead = Faites-le survivre à un redémarrage : la configuration de rake a une ligne prête pour ça.
    .solution = sur rake : sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf : read_only = ON (décommenté)
hint-broken-replica-repaired =
    .lead = Retirez la ligne égarée sur rake (rake doit garder ce que truelle envoie), puis relancez le thread SQL et regardez-le rattraper.
    .solution = sur rake : sudo mariadb plots -e "DELETE FROM waitlist WHERE id = 1043" ; sudo mariadb -e "START REPLICA" ; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind|Error'
hint-broken-replica-identical =
    .lead = Prouvez que les deux serveurs ont les mêmes lignes : calculez les sommes de contrôle des tables sur chacun.
    .solution = sudo mariadb -e "CHECKSUM TABLE plots.members, plots.plots, plots.waitlist, plots.bookings" (sur truelle et sur rake)
hint-broken-replica-jun =
    .lead = La ligne d'Esi a disparu de rake : ajoutez-la de nouveau, là où vont les écritures.
    .solution = sur truelle : sudo mariadb plots -e "INSERT INTO waitlist (name, email, wants, added_on) VALUES ('Esi Boateng', 'esi.boateng@mail.example', 'half', '2031-05-31')"
hint-broken-replica-script =
    .lead = Le dump de la nuit lit les tables sans instantané cohérent : corrigez la ligne mariadb-dump du script (man mariadb-dump).
    .solution = sur rake : sudo nano /usr/local/sbin/plots-backup : mariadb-dump --single-transaction plots > …
hint-broken-replica-backup =
    .lead = Faites une sauvegarde maintenant, comme le script la fera.
    .solution = sur rake : sudo /usr/local/sbin/plots-backup (ou sudo mariadb-dump --single-transaction plots > /var/backups/mariadb/plots-check.sql)
hint-broken-replica-restored =
    .lead = Restaurez ce dump dans une base de travail sur rake, puis comparez-la avec plots.
    .solution = sur rake : sudo mariadb -e "CREATE DATABASE restore_check" ; sudo sh -c 'mariadb restore_check < /var/backups/mariadb/plots-2031-06-02.sql' ; sudo mariadb -e "CHECKSUM TABLE restore_check.waitlist, plots.waitlist"
hint-broken-replica-end =
    .lead = Vérifiez l'ensemble : read_only sur rake (maintenant et dans son fichier), l'état du réplica, les sommes de contrôle, Esi sur truelle, le script, un dump restauré.
    .solution = sur rake : sudo mariadb -e "SELECT @@read_only" ; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind'
