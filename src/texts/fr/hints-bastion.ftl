### Indices gradués du Bastion (voir src/engine/hints.ts) : un message par
### étape, hint-<chapitre>-<événement>, avec .lead (une piste, sans la
### commande exacte) et .solution (presque la réponse : la commande, avec ce
### qu'elle fait).

## Chapitre 1 — L'Alarme

hint-alarm-process =
    .lead = Quelque chose occupe le processeur : regarde ce qui tourne, sous quel compte, depuis quel dossier (man ps, man top).
    .solution = ps aux (ou top) : un « kworkerd » à presque 200 % de CPU, sous deploy, lancé depuis /tmp/.cache.
hint-alarm-connection =
    .lead = L'hébergeur donne une adresse et un port : trouve quel programme tient cette connexion (man ss, ou man netstat). La colonne des processus demande root.
    .solution = sudo ss -tnp (ou sudo netstat -tnp) : kworkerd, connecté à 198.51.100.66:3333.
hint-alarm-entry =
    .lead = Par où est-on entré ? Le journal de ssh garde chaque tentative et chaque connexion (man journalctl) ; last liste les sessions.
    .solution = sudo journalctl -u ssh | grep deploy : des mots de passe refusés, puis « Accepted password for deploy from 203.0.113.66 » à 02:40:57.
hint-alarm-end =
    .lead = Complète incident.md : le programme et son dossier, l'adresse du pool, le compte, l'adresse de l'intrus·e et l'heure de la connexion.
    .solution = nano incident.md : /tmp/.cache/kworkerd (deploy), 198.51.100.66 port 3333, deploy par mot de passe depuis 203.0.113.66 à 02:40.

## Chapitre 2 — Le Confinement

hint-containment-pool =
    .lead = Empêche le mineur de joindre le pool : une règle de pare-feu sur ce qui sort de la machine (man iptables, la chaîne OUTPUT).
    .solution = sudo iptables -A OUTPUT -d 198.51.100.66 -j DROP
hint-containment-attacker =
    .lead = Ferme la porte à l'adresse d'où l'on est venu : une règle sur ce qui entre (INPUT, par source). Attention à ton propre ssh.
    .solution = sudo iptables -A INPUT -s 203.0.113.66 -j DROP (un ajout ne touche pas à ton propre accès ; vérifie avec sudo iptables -L -n).
hint-containment-stopped =
    .lead = Le mineur revient quand tu l'arrêtes : quelque chose le surveille. Regarde son parent (ps -ef, la colonne PPID) et arrête-le d'abord (man kill).
    .solution = sudo kill 4410 (le chien de garde, /bin/sh /tmp/.cache/.w), puis sudo kill sur le PID de kworkerd (ou sudo killall kworkerd une fois le chien de garde parti).
hint-containment-closed =
    .lead = Ferme deploy pour de bon, clé comprise : man usermod dit ce que -L ne couvre pas.
    .solution = sudo usermod -L -e 1 deploy (mot de passe verrouillé ET compte expiré ; sudo chage -E 0 deploy le fait expirer aussi).
hint-containment-end =
    .lead = Vérifie tout : pool et adresse bloqués, ton ssh toujours accepté, rien de /tmp/.cache en marche, deploy fermé, et l'appli de livraison en marche.
    .solution = sudo iptables -L -n, ps aux | grep cache, systemctl status delivery (sudo systemctl start delivery si elle s'est arrêtée, puis arrête ce qu'elle a relancé).

## Chapitre 3 — L'Éradication

hint-eradication-cron =
    .lead = Un compte peut laisser une tâche qui démarre à chaque démarrage : lis la crontab de deploy, et retire seulement ce qui n'est pas à Selma (man crontab, -u).
    .solution = sudo crontab -u deploy -e : supprime la ligne « @reboot /bin/sh /tmp/.cache/.w », garde sync-orders.
hint-eradication-key =
    .lead = Deux clés sur deploy : compare leurs empreintes avec celle du courriel de Selma (man ssh-keygen, -l).
    .solution = sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, puis sudo nano /home/deploy/.ssh/authorized_keys : retire la ligne dont l'empreinte n'est pas celle de Selma.
hint-eradication-files =
    .lead = Le mineur et son chien de garde sont toujours sur le disque (man rm).
    .solution = sudo ls -la /tmp/.cache, puis sudo rm /tmp/.cache/kworkerd /tmp/.cache/.w (le .w caché aussi).
hint-eradication-verified =
    .lead = Qu'a-t-on modifié ? find sait lister les fichiers modifiés récemment (man find, -mtime) ; l'historique de deploy le dit aussi. Avant de restaurer, vérifie la signature de la version (man gpg, --verify).
    .solution = sudo find /srv/delivery -type f -mtime -3 (server.js), puis gpg --verify /srv/releases/delivery-2.3.1.tar.gz.asc /srv/releases/delivery-2.3.1.tar.gz (Good signature ; la copie de /home/deploy est BAD).
hint-eradication-restored =
    .lead = Restaure server.js depuis l'archive dont la signature est bonne (man tar, -x et -C).
    .solution = sudo tar -xzf /srv/releases/delivery-2.3.1.tar.gz -C /srv (cela réécrit /srv/delivery/server.js ; compare avec diff en cas de doute).
hint-eradication-end =
    .lead = Vérifie : plus de @reboot, sync-orders gardé, seulement la clé de Selma, /tmp/.cache vidé, server.js comme dans la version dont tu as vérifié la signature, l'appli en marche et rien de relancé.
    .solution = sudo crontab -u deploy -l, sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys, sudo ls -la /tmp/.cache, sudo systemctl restart delivery, ps aux | grep cache.

## Chapitre 4 — Le Durcissement

hint-hardening-passwords =
    .lead = sshd_config dit non aux mots de passe, et pourtant ils étaient acceptés : demande à sshd ce qu'il applique (man sshd, -T), et regarde ce qu'il inclut en premier.
    .solution = sudo sshd -T | grep passwordauthentication, puis sudo rm /etc/ssh/sshd_config.d/50-delivery.conf et sudo systemctl reload ssh.
hint-hardening-firewall =
    .lead = Refuser par défaut (iptables -P INPUT DROP), mais accepter d'abord lo, les réponses (-m state --state ESTABLISHED,RELATED) et les ports 22, 80, 443 (man iptables).
    .solution = sudo iptables -A INPUT -i lo -j ACCEPT ; sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT ; sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT (pareil pour 80 et 443) ; puis sudo iptables -P INPUT DROP.
hint-hardening-saved =
    .lead = Les règles vivent en mémoire : écris-les là où iptables-persistent les lit au démarrage (man iptables-save). Attention, une redirection s'exécute sous ton compte, pas sous root.
    .solution = sudo iptables-save | sudo tee /etc/iptables/rules.v4
hint-hardening-deploy =
    .lead = Selma a besoin de deploy : lève ce qui l'a fermé (man usermod, -e ; man chage).
    .solution = sudo usermod -e "" deploy (ou sudo chage -E -1 deploy) ; avec les mots de passe coupés, seule sa clé l'ouvre.
hint-hardening-end =
    .lead = Vérifie : sshd -T dit no, iptables -L montre la politique DROP avec lo, ESTABLISHED, 22, 80, 443, les règles enregistrées, deploy utilisable.
    .solution = sudo sshd -T | grep password, sudo iptables -L -n, sudo cat /etc/iptables/rules.v4, sudo chage -l deploy.
