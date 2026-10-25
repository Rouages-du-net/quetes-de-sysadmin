### Indices gradués de La Coopérative (voir src/moteur/indices.ts) : un
### message par étape, indice-<chapitre>-<événement>, avec .piste (une
### direction, sans la commande exacte) et .solution (presque la réponse : la
### commande, avec ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — Le départ

indice-depart-sauvegarde =
    .piste = Avant de fermer quoi que ce soit : que fait tourner Marc sous son compte ? Sa crontab (en root) lance un script rangé dans son dossier personnel. La tâche doit survivre à son départ : le script hors de /home, et un compte qui reste pour le lancer.
    .solution = sudo cp /home/marc/bin/sauvegarde-caisse.sh /usr/local/bin/, puis sudo crontab -e et la ligne : 30 2 * * * /usr/local/bin/sauvegarde-caisse.sh (la crontab de root)
indice-depart-ferme =
    .piste = Fermer un accès, c'est le fermer partout : son compte (usermod -L ne bloque que le mot de passe, pas la clé SSH : relis man usermod), le groupe sudo, sa clé dans le compte deploy (seulement sa ligne), et sa session encore ouverte (who, ps -u marc).
    .solution = sudo usermod -e 1 marc (le compte expire), sudo gpasswd -d marc sudo, sudo nano /home/deploy/.ssh/authorized_keys (efface la seule ligne marc@portable), puis sudo pkill -u marc
indice-depart-fin =
    .piste = Il reste un morceau : relis le courriel d'Awa point par point. Marc ne doit plus entrer d'aucune façon, la CI et Lina gardent leurs clés dans deploy, et la sauvegarde de nuit tourne sous root ou deploy.
    .solution = sudo crontab -l (la sauvegarde y est ?), sudo cat /home/deploy/.ssh/authorized_keys (deploy@ci et lina@atelier y sont, plus marc@portable), sudo chage -l marc, groups marc, who

## Chapitre 2 — Les droits partagés

indice-droits-dossier =
    .piste = ls -l /srv/till/releves : le dossier appartient à root, et chaque relevé au groupe de son auteur·rice. Il faut un dossier du groupe till, que le groupe peut écrire, et dont le bit setgid donne son groupe à tout ce qu'on y crée (man chmod).
    .solution = sudo chgrp -R till /srv/till/releves, sudo chmod -R g+w /srv/till/releves, puis sudo chmod g+s /srv/till/releves (ls -ld montre drwxrwsr-x)
indice-droits-masque =
    .piste = Les prochains fichiers de Lina et Karim naîtront en rw-r--r-- : c'est leur masque (umask 022). Il se règle à la connexion, dans leur ~/.profile ou pour tout le monde dans /etc/profile.d (man umask).
    .solution = sudo nano /home/lina/.profile et sudo nano /home/karim/.profile : remplace #umask 022 par umask 002 (ou un fichier /etc/profile.d/umask-equipe.sh avec umask 002)
indice-droits-sudo =
    .piste = Une règle sudo pour le groupe till, dans son propre fichier de /etc/sudoers.d (sans point dans le nom), écrite avec visudo, qui vérifie avant d'enregistrer. La commande s'écrit avec son chemin complet (which) et ses arguments, pour ne rien permettre d'autre (man sudoers).
    .solution = sudo visudo -f /etc/sudoers.d/till, avec la ligne %till ALL=(root) /usr/bin/systemctl restart till — puis sudo -l -U lina pour vérifier
indice-droits-fin =
    .piste = Le dossier, le masque et sudo sont réglés ? Regarde ce qui était déjà dans le dossier : les relevés d'hier doivent eux aussi appartenir au groupe till et être modifiables par lui.
    .solution = ls -l /srv/till/releves, puis sudo chgrp -R till /srv/till/releves et sudo chmod -R g+w /srv/till/releves

## Chapitre 3 — Le secret

indice-secret-fermee =
    .piste = Demande toi-même /.env au site avec curl : nginx sert tout le dossier de l'appli, fichiers cachés compris (.env, mais aussi .git). Dans la configuration du site, une location avec une expression régulière peut refuser tout chemin qui contient « /. » (la documentation de location et de deny).
    .solution = sudo nano /etc/nginx/sites-available/coop : ajoute location ~ /\. {"{"} deny all; {"}"} dans le bloc server, puis sudo nginx -t et sudo systemctl reload nginx
indice-secret-attaquant =
    .piste = Qui a pris la clé ? Le journal d'accès de nginx (/var/log/nginx/access.log) garde chaque requête vers /.env, avec l'adresse et la réponse 200. Une directive de nginx refuse une adresse.
    .solution = sudo grep '\.env' /var/log/nginx/access.log (c'est 203.0.113.77), puis deny 203.0.113.77; dans le bloc server du site, et sudo systemctl reload nginx
indice-secret-cle-ecrite =
    .piste = L'ancienne clé est désactivée : la nouvelle est dans le courriel d'Awa, et sa place dans le fichier .env de l'appli de caisse (/srv/till/app).
    .solution = sudo nano /srv/till/app/.env : remplace la valeur de PAIEMENT_CLE= par la nouvelle clé du courriel
indice-secret-fin =
    .piste = La nouvelle clé est écrite, mais l'appli ne lit son .env qu'au démarrage. Sa route /health dit quelle clé elle utilise.
    .solution = sudo systemctl restart till, puis curl http://127.0.0.1:3000/health (« paiement »: « ok »)

## Chapitre 4 — Le proxy

indice-proxy-fin =
    .piste = Compare les deux journaux : nginx voit le robot (198.51.100.66), la caisse ne voit que 127.0.0.1. nginx doit transmettre l'adresse du client dans un en-tête (proxy_set_header), et l'appli ne doit croire cet en-tête que s'il vient de nginx (TRUST_PROXY, guide d'Express « behind proxies ») : pas true, le robot écrit son propre X-Forwarded-For.
    .solution = Dans la location /till/ de /etc/nginx/sites-available/coop : proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; — dans /srv/till/app/.env : TRUST_PROXY=loopback — puis sudo systemctl reload nginx et sudo systemctl restart till

## Chapitre 5 — Les mises à jour

indice-mises-a-jour-a-jour =
    .piste = apt ne connaît les nouvelles versions qu'après avoir relu les dépôts (man apt : update d'abord, puis upgrade). Le wifi va couper : une longue opération se lance dans une session qui survit à la connexion (man tmux). Si dpkg a été interrompu, apt te dit quoi lancer.
    .solution = sudo apt update, puis tmux new -s maj et sudo apt upgrade ; si la connexion tombe : ssh cooperative et tmux attach -t maj (sans tmux : sudo dpkg --configure -a, puis sudo apt upgrade)
indice-mises-a-jour-caisse-tombee =
    .piste = Les paquets sont installés, mais uname -r donne toujours l'ancien noyau. Un fichier de /var/run dit pourquoi il faut redémarrer.
    .solution = cat /var/run/reboot-required.pkgs, puis sudo reboot (et ssh cooperative pour revenir)
indice-mises-a-jour-fin =
    .piste = Après un redémarrage, seuls les services activés repartent. Vérifie le site et la caisse (systemctl --failed, systemctl status till : « disabled »).
    .solution = sudo systemctl enable --now till (activée au démarrage, et lancée tout de suite)

## Chapitre 6 — Les mises à jour automatiques

indice-automatiques-fin =
    .piste = Tout est dans /etc/apt/apt.conf.d : 20auto-upgrades allume ou éteint les tâches quotidiennes (à « 0 », rien ne se fait), 50unattended-upgrades règle le rapport (Mail), le redémarrage et son heure (Automatic-Reboot-Time, la nuit). Laisse Origins-Pattern tel quel : nodejs vient d'un autre dépôt. Puis lance le service qui fait le travail chaque matin (systemctl list-timers).
    .solution = Dans 20auto-upgrades : les deux valeurs à "1" ; dans 50unattended-upgrades, décommente Unattended-Upgrade::Mail "root";, Automatic-Reboot "true"; et Automatic-Reboot-Time "02:00"; — puis sudo systemctl start apt-daily-upgrade
