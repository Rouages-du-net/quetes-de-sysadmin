### Indices gradués des Lettres du quartier (voir src/moteur/indices.ts) : un
### message par étape, indice-<chapitre>-<événement>, avec .piste (une
### direction, sans la commande exacte) et .solution (presque la réponse : la
### commande, avec ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — Fermer la porte

indice-fermer-la-porte-fermee =
    .piste = Deux options de /etc/ssh/sshd_config (man sshd_config) : PermitRootLogin et PasswordAuthentication. Mais regarde la ligne Include en tête : pour sshd, la première valeur lue l'emporte. sshd -t vérifie, puis il faut recharger le service.
    .solution = sudo nano /etc/ssh/sshd_config : PermitRootLogin no ; dans /etc/ssh/sshd_config.d/50-cloud-init.conf : PasswordAuthentication no. Puis sudo sshd -t et sudo systemctl reload ssh (sudo sshd -T montre les valeurs retenues).
indice-fermer-la-porte-fin =
    .piste = La porte est fermée ; reste à prouver que toi, tu peux encore entrer. Une session déjà ouverte ne prouve rien : il en faut une nouvelle.
    .solution = exit, puis depuis ton poste : ssh lettres (et ssh root@lettres doit être refusé).

## Chapitre 2 — Le pare-feu

indice-pare-feu-ecoute =
    .piste = Avant de fermer des portes, regarde quels programmes écoutent sur quels ports, sur le serveur lui-même (man ss).
    .solution = ss -tlnp (les sockets TCP en écoute, en chiffres ; 3306, c'est MariaDB).
indice-pare-feu-filtre =
    .piste = ufw refuse l'entrant par défaut une fois actif ; il suffit d'autoriser ce qui doit rester ouvert (SSH, http, https) AVANT de l'activer (man ufw, ufw app list).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", puis sudo ufw enable (et sudo ufw status verbose pour vérifier).
indice-pare-feu-fin =
    .piste = Le pare-feu filtre ; prouve que SSH passe encore, avec une nouvelle connexion depuis ton poste.
    .solution = exit, puis ssh lettres.

## Chapitre 3 — La sentinelle

indice-sentinelle-rania =
    .piste = Rania (198.51.100.40) est dans la prison sshd de fail2ban. fail2ban-client sait montrer l'état d'une prison, et lever un bannissement.
    .solution = sudo fail2ban-client status sshd, puis sudo fail2ban-client set sshd unbanip 198.51.100.40
indice-sentinelle-reglee =
    .piste = On ne touche pas à jail.conf : les réglages vont dans /etc/fail2ban/jail.local (man jail.conf). Il faut un bantime d'une heure au moins, et ignoreip pour Rania et pour ton poste (son adresse est dans journalctl -u ssh). Puis recharger fail2ban.
    .solution = sudo nano /etc/fail2ban/jail.local : [DEFAULT], bantime = 1h, ignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40 ; puis sudo fail2ban-client -t et sudo systemctl reload fail2ban
indice-sentinelle-fin =
    .piste = Après le rechargement, vérifie l'état de la prison : les robots bannis, ni Rania ni toi.
    .solution = sudo fail2ban-client status sshd

## Chapitre 4 — La colocation

indice-colocation-cafe =
    .piste = Sur Debian, un site nginx = un fichier dans /etc/nginx/sites-available, activé par un lien symbolique dans sites-enabled (voir note_de_rania.txt). Le site du café a son propre server_name et sa racine /var/www/cafe, sans default_server.
    .solution = sudo cp /etc/nginx/sites-available/letters /etc/nginx/sites-available/cafe, y remplacer letters par cafe et retirer default_server (sudo nano), puis sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/, sudo nginx -t et sudo systemctl reload nginx
indice-colocation-fin =
    .piste = L'agenda écoute sur 127.0.0.1:3000 et ses pages commencent à / : nginx doit lui passer /agenda/ en retirant ce préfixe (proxy_pass, et la barre finale). Et le service agenda doit tourner, même après un redémarrage (man systemctl).
    .solution = Dans /etc/nginx/sites-available/letters : location /agenda/ {"{"} proxy_pass http://127.0.0.1:3000/; {"}"} ; sudo nginx -t, sudo systemctl reload nginx, puis sudo systemctl enable --now agenda

## Chapitre 5 — Ça marche chez moi

indice-chez-moi-fin =
    .piste = /etc/hosts ne vaut que pour une machine : il faut corriger la zone de cafe.example (/etc/bind/zones/db.cafe.example, voir aide_dns.txt). Nouvelle adresse, un www, un numéro de série augmenté pour que ns2 recopie la zone, et le point final des noms complets.
    .solution = sudo nano /etc/bind/zones/db.cafe.example : 203.0.113.10 à la place de 198.51.100.80, serial 2027032001, et la ligne www IN CNAME cafe.example. (avec le point) ; puis named-checkzone cafe.example /etc/bind/zones/db.cafe.example et sudo rndc reload

## Chapitre 6 — Le soir du concert

indice-concert-robot =
    .piste = Qui demande quoi ? Le journal d'accès de nginx a une ligne par requête ; awk en découpe les champs (l'adresse est le premier, voir aide_journaux.txt), sort et uniq -c les comptent.
    .solution = awk '{"{"}print $1{"}"}' /var/log/nginx/access.log | sort | uniq -c | sort -n (trois adresses en 198.51.100.x dominent).
indice-concert-fin =
    .piste = Bloquer les adresses ne tiendra pas : il faut limiter le débit par adresse (limit_req_zone dans le contexte http, limit_req dans la location de l'agenda). Un navigateur demande une page et ses quatre fichiers d'un coup : sans rafale (burst), les vrais visiteurs sont refusés aussi.
    .solution = En tête de /etc/nginx/sites-available/letters : limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s; et dans location /agenda/ : limit_req zone=agenda burst=10 nodelay; puis sudo nginx -t et sudo systemctl reload nginx

## Chapitre 7 — Le port

indice-port-deux-ports =
    .piste = Ouvre la nouvelle porte sans fermer l'ancienne : sshd peut écouter sur plusieurs ports (plusieurs lignes Port, man sshd_config), et le pare-feu doit laisser passer le nouveau.
    .solution = Dans /etc/ssh/sshd_config : Port 22 et Port 2222 ; puis sudo sshd -t, sudo ufw allow 2222/tcp et sudo systemctl reload ssh
indice-port-essai =
    .piste = Teste la nouvelle porte depuis ton poste. Pour que ssh lettres y aille tout seul, le ~/.ssh/config du poste a une option Port (man ssh_config).
    .solution = exit, puis sur le poste : nano ~/.ssh/config, ajouter Port 2222 sous Host lettres, et ssh lettres (accepte la clé du serveur sur ce port : yes).
indice-port-fin =
    .piste = La nouvelle porte marche : ferme l'ancienne, dans sshd et dans ufw. Puis fail2ban : sa prison sshd surveille encore le port « ssh » (22). Un port réglé dans [DEFAULT] ne suffit pas, il faut la section de la prison.
    .solution = Retirer Port 22 de sshd_config, sudo systemctl reload ssh, sudo ufw delete allow OpenSSH ; dans /etc/fail2ban/jail.local, [sshd] port = 2222, puis sudo systemctl reload fail2ban

## Chapitre 8 — La récidive

indice-recidive-recidive =
    .piste = jail.conf décrit une prison recidive, désactivée : elle lit fail2ban.log et bannit longtemps les adresses déjà bannies plusieurs fois. On l'active dans sa propre section de jail.local, pas dans [DEFAULT].
    .solution = Ajouter à /etc/fail2ban/jail.local : [recidive] puis enabled = true ; sudo fail2ban-client -t et sudo systemctl reload fail2ban
indice-recidive-agenda =
    .piste = Le robot de l'agenda remplit /var/log/nginx/error.log de « limiting requests ». Une prison de jail.conf lit justement ces lignes : cherche les prisons nginx (grep "^\[" /etc/fail2ban/jail.conf).
    .solution = Ajouter à /etc/fail2ban/jail.local : [nginx-limit-req] puis enabled = true ; sudo systemctl reload fail2ban
indice-recidive-fin =
    .piste = Les prisons sont chargées : vérifie qui elles bannissent (les récidivistes et le robot, mais ni Rania ni les visiteur·ses).
    .solution = sudo fail2ban-client status, puis sudo fail2ban-client status recidive et sudo fail2ban-client status nginx-limit-req

## Chapitre 9 — L'atelier de réparation

indice-atelier-occupe =
    .piste = apt a dit « Job for apache2.service failed ». systemctl status apache2 et journalctl -u apache2 disent pourquoi ; sudo ss -tlnp montre qui écoute sur quel port.
    .solution = journalctl -u apache2 : « Address already in use » sur le port 80 ; sudo ss -tlnp : c'est nginx qui le tient.
indice-atelier-ecoute =
    .piste = Les ports d'Apache sont dans /etc/apache2/ports.conf (Listen). Rania l'attend sur 127.0.0.1:8080, comme l'agenda. Puis démarrer le service.
    .solution = sudo nano /etc/apache2/ports.conf : Listen 127.0.0.1:8080 à la place de Listen 80 ; sudo apache2ctl configtest ; sudo systemctl restart apache2
indice-atelier-site =
    .piste = sudo apache2ctl -S liste les sites qu'Apache a lus : celui de l'atelier y est-il ? Apache ne lit dans sites-enabled que les fichiers en .conf (man a2ensite). Et le VirtualHost du site doit être sur le port où Apache écoute.
    .solution = sudo a2ensite repair ; dans /etc/apache2/sites-available/repair.conf, <VirtualHost 127.0.0.1:8080> (ou *:8080) ; sudo apache2ctl configtest ; sudo systemctl reload apache2 ; curl -H "Host: repair.example" http://127.0.0.1:8080/
indice-atelier-proxy =
    .piste = Le site nginx de l'atelier est prêt dans /etc/nginx/sites-available/repair, mais pas activé (comme celui du café, dans « La colocation »).
    .solution = sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/ ; sudo nginx -t ; sudo systemctl reload nginx ; curl http://repair.example/
indice-atelier-reecriture =
    .piste = /guide/42 n'est pas un fichier : une règle du .htaccess de /var/www/repair transforme l'adresse. Apache ne lit les .htaccess que si AllowOverride le permet (man apache2ctl), et RewriteRule vient d'un module (man a2enmod). Le journal d'erreurs du site dit ce qui coince.
    .solution = Dans le VirtualHost de repair.conf : <Directory /var/www/repair>, AllowOverride All, </Directory> (trois lignes) ; sudo a2enmod rewrite ; sudo apache2ctl configtest ; sudo systemctl restart apache2 ; curl http://repair.example/guide/42
indice-atelier-fin =
    .piste = Vérifie tout : Apache activé au démarrage et seulement sur 127.0.0.1, http://repair.example/ et /guide/42 par nginx, letters.example intact.
    .solution = systemctl is-enabled apache2 ; sudo ss -tlnp ; curl http://repair.example/guide/42 ; curl http://letters.example/
