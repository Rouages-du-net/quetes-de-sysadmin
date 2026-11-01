### Indices gradués de L'Audit (voir src/engine/hints.ts) : un message par
### étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans la
### commande exacte) et .solution (presque la réponse : la commande, avec ce
### qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 2 — Le rapport

indice-report-ssh =
    .piste = Constat C1 : une option de /etc/ssh/sshd_config (man sshd_config). Après l'avoir changée, sshd doit relire sa configuration : vérifie-la d'abord (man sshd), puis fais recharger le service.
    .solution = sudo nano /etc/ssh/sshd_config : PermitRootLogin no. Puis sudo sshd -t, sudo systemctl reload ssh (et sudo sshd -T | grep permitroot pour voir ce qui est appliqué).
indice-report-compte =
    .piste = Constat C2 : le compte de Lucas ne doit plus servir à rien. Le plus net est de le supprimer (man userdel) ; sinon il faut le verrouiller, le faire expirer ET le sortir du groupe sudo (man usermod, man chage, man gpasswd).
    .solution = sudo userdel lucas (ajoute -r pour effacer son dossier personnel). Ou : sudo usermod -L -e 1 lucas, puis sudo gpasswd -d lucas sudo.
indice-report-sudo =
    .piste = Constat C3 : sudo -l montre les règles de ton compte. L'une vient d'un fichier de /etc/sudoers.d, écrit par cloud-init. Un fichier de sudoers se modifie avec visudo (man visudo, man sudoers).
    .solution = sudo grep -r NOPASSWD /etc/sudoers.d trouve le fichier ; sudo visudo -f /etc/sudoers.d/90-cloud-init-users, retire le NOPASSWD: (ou supprime le fichier avec sudo rm : le groupe sudo garde son droit, avec mot de passe).
indice-report-secret =
    .piste = Constat C4 : ls -l montre qui peut lire /srv/commandes/.env (man chmod). Ferme-le aux autres comptes, mais pas à son propriétaire : c'est l'appli qui le lit.
    .solution = sudo chmod 600 /srv/commandes/.env (ou 640 si le groupe commandes doit le lire), puis ls -l pour vérifier que le propriétaire est toujours commandes.

## Chapitre 3 — L'exposition

indice-exposure-ecoute =
    .piste = Avant de fermer des portes, regarde quels programmes écoutent sur quels ports, sur le serveur lui-même (man ss). Le balayage de Salomé est dans balayage-audit.txt.
    .solution = sudo ss -tlnp (les sockets TCP en écoute, en chiffres, avec le programme). 0.0.0.0 : toutes les interfaces ; 127.0.0.1 : cette machine seulement.
indice-exposure-pare-feu =
    .piste = ufw refuse l'entrant par défaut une fois actif ; il suffit d'autoriser ce qui doit rester ouvert (SSH, http, https) AVANT de l'activer (man ufw).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", puis sudo ufw enable (sudo ufw status verbose pour vérifier).
indice-exposure-redis-local =
    .piste = Le pare-feu est une couche ; Redis, lui, doit aussi ne plus tendre l'oreille qu'à la machine : une directive de /etc/redis/redis.conf. Un programme relit sa configuration quand il redémarre.
    .solution = sudo nano /etc/redis/redis.conf : bind 127.0.0.1 -::1 (à la place de bind * -::*). Puis sudo systemctl restart redis-server, et sudo ss -tlnp pour vérifier.
indice-exposure-fin =
    .piste = Le pare-feu filtre et Redis est en local ; prouve que SSH passe encore, avec une nouvelle connexion depuis ton poste.
    .solution = exit, puis ssh fournil.

## Chapitre 4 — Les traces

indice-traces-trouve =
    .piste = Le journal du service ssh garde les connexions réussies, avec l'adresse et l'empreinte de la clé ; last résume qui s'est connecté, quand et d'où (man journalctl, man last).
    .solution = journalctl -u ssh | grep Accepted (ou sudo grep, ou last nadia) : la ligne de 3 h 12, depuis 203.0.113.99.
indice-traces-cle-identifiee =
    .piste = ssh-keygen sait afficher l'empreinte de chaque clé d'un fichier (man ssh-keygen, option -l). Le fichier de Nadia n'est lisible que par elle : il faut sudo.
    .solution = sudo ssh-keygen -l -f /home/nadia/.ssh/authorized_keys, puis compare avec l'empreinte SHA256 du journal.
indice-traces-cle-revoquee =
    .piste = Retire de authorized_keys la ligne dont l'empreinte est celle de la connexion de nuit, et seulement elle : celle de Nadia doit rester.
    .solution = sudo nano /home/nadia/.ssh/authorized_keys : supprime la ligne « … nadia@portable » (la deuxième), enregistre.
indice-traces-cron-decouvert =
    .piste = Ce qui se lance tout seul, pour un compte : sa crontab (man crontab). Pour lire celle d'un autre compte, il faut être root.
    .solution = sudo crontab -u nadia -l
indice-traces-cron-nettoye =
    .piste = Retire la ligne de l'intrus de la crontab de Nadia, sans effacer sa sauvegarde : crontab -r efface tout, crontab -e laisse choisir.
    .solution = sudo crontab -u nadia -e : supprime la ligne qui contient curl … | sh, garde celle de sauvegarde.sh.
indice-traces-secret-vu =
    .piste = L'historique des commandes de Nadia (.bash_history, lisible seulement par elle) dit ce qui a été tapé pendant la session de la nuit. Pour le lire à sa place, il faut sudo.
    .solution = sudo cat /home/nadia/.bash_history : la personne a lu /srv/commandes/.env, donc le mot de passe de la base est compromis.
indice-traces-mot-de-passe =
    .piste = Un mot de passe de base se change des deux côtés : dans PostgreSQL (psql, ALTER ROLE, depuis le compte postgres : man psql) ET dans DATABASE_URL du fichier .env ; l'appli ne relit .env qu'en redémarrant. Au moins douze caractères.
    .solution = sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD 'une-phrase-de-passe-longue'", puis sudo nano /srv/commandes/.env (le même mot de passe dans DATABASE_URL), puis sudo systemctl restart commandes et systemctl status commandes.

## Chapitre 1 — Le périmètre

indice-scope-lettre =
    .piste = Avant de balayer quoi que ce soit : la lettre de mission est dans ton dossier. Elle dit ce que tu as le droit de sonder, et ce que tu n'as pas le droit de toucher.
    .solution = cat lettre-de-mission.txt : le périmètre est UNE machine, fournil.internal (192.0.2.22). Le voisin (192.0.2.24) n'y est pas.
indice-scope-balayage =
    .piste = nmap balaie les ports d'une machine (man nmap) : donne-lui l'adresse ou le nom exact de la machine du périmètre, et demande aussi les versions des services.
    .solution = nmap -sV fournil.internal (pas 192.0.2.0/24 : ça sonderait aussi le voisin).
indice-scope-trace =
    .piste = Une preuve se garde : nmap sait écrire son résultat, tel qu'on le lit, dans un fichier (man nmap, l'option -oN).
    .solution = nmap -sV -oN inventaire.txt fournil.internal
indice-scope-fin =
    .piste = Complète notes-audit.md avec nano : ce que tu as trouvé (les ports de la base de données et de Redis n'ont rien à faire sur internet) et ce que tu as repéré sans y toucher (le serveur du voisin).
    .solution = nano notes-audit.md : sous « Ce que j'ai trouvé », cite 5432 (PostgreSQL) et 6379 (Redis) ; sous « Hors périmètre », cite voisin.internal (192.0.2.24), hors périmètre, pas sondé.

## Chapitre 5 — La contre-visite

indice-follow-up-balayage =
    .piste = Refais l'inventaire comme au premier jour, avec les versions, sur le serveur et seulement sur lui (man nmap).
    .solution = nmap -sV fournil.internal
indice-follow-up-lynis =
    .piste = Lynis audite la machine où il est lancé ; il a besoin de root pour tout lire (man lynis). Il ne corrige rien.
    .solution = sudo lynis audit system
indice-follow-up-mise-a-jour =
    .piste = L'avertissement de Lynis (PKGS-7392) parle de paquets vulnérables : apt sait ce qui attend (man apt).
    .solution = sudo apt update, sudo apt upgrade (apt list --upgradable montre ce qui attend).
indice-follow-up-durci =
    .piste = Parmi les suggestions, celles qui valent l'effort : SSH (sshd_config, man sshd_config), l'UMASK de /etc/login.defs, la bannière /etc/issue. Il faut un indice d'au moins 70, sans avertissement, et appliquer la configuration de SSH.
    .solution = sudo grep suggestion /var/log/lynis-report.dat. Par exemple : X11Forwarding no et MaxAuthTries 3 dans /etc/ssh/sshd_config (puis sudo sshd -t, sudo systemctl reload ssh), UMASK 027 dans /etc/login.defs, un avertissement légal dans /etc/issue.
indice-follow-up-preuve-lynis =
    .piste = Un correctif non prouvé n'est qu'une intention : relance Lynis pour qu'il reflète l'état actuel.
    .solution = sudo lynis audit system
indice-follow-up-nmap-propre =
    .piste = Refais le balayage avec les versions, maintenant que les mises à jour sont faites : la version de SSH affichée a changé.
    .solution = nmap -sV fournil.internal
indice-follow-up-fin =
    .piste = Complète rapport-cloture.md avec nano : un résumé, les constats corrigés (parties 1 à 4), les preuves (l'indice exact de ton dernier Lynis et les ports vus), et ce qui reste à faire avec un identifiant Lynis encore ouvert.
    .solution = nano rapport-cloture.md : sous « Preuves », l'indice du dernier audit et les ports 22, 80, 443 ; sous « Reste à faire », par exemple FINT-4350 (intégrité des fichiers) ou LOGG-2154 (journaux distants).
