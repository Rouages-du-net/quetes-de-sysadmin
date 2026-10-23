### Indices gradués de L'Audit (voir src/moteur/indices.ts) : un message par
### étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans la
### commande exacte) et .solution (presque la réponse : la commande, avec ce
### qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — Le rapport

indice-rapport-ssh =
    .piste = Constat C1 : une option de /etc/ssh/sshd_config (man sshd_config). Après l'avoir changée, sshd doit relire sa configuration : vérifie-la d'abord (man sshd), puis fais recharger le service.
    .solution = sudo nano /etc/ssh/sshd_config : PermitRootLogin no. Puis sudo sshd -t, sudo systemctl reload ssh (et sudo sshd -T | grep permitroot pour voir ce qui est appliqué).
indice-rapport-compte =
    .piste = Constat C2 : le compte de Lucas ne doit plus servir à rien. Le plus net est de le supprimer (man userdel) ; sinon il faut le verrouiller, le faire expirer ET le sortir du groupe sudo (man usermod, man chage, man gpasswd).
    .solution = sudo userdel lucas (ajoute -r pour effacer son dossier personnel). Ou : sudo usermod -L -e 1 lucas, puis sudo gpasswd -d lucas sudo.
indice-rapport-sudo =
    .piste = Constat C3 : sudo -l montre les règles de ton compte. L'une vient d'un fichier de /etc/sudoers.d, écrit par cloud-init. Un fichier de sudoers se modifie avec visudo (man visudo, man sudoers).
    .solution = sudo grep -r NOPASSWD /etc/sudoers.d trouve le fichier ; sudo visudo -f /etc/sudoers.d/90-cloud-init-users, retire le NOPASSWD: (ou supprime le fichier avec sudo rm : le groupe sudo garde son droit, avec mot de passe).
indice-rapport-secret =
    .piste = Constat C4 : ls -l montre qui peut lire /srv/commandes/.env (man chmod). Ferme-le aux autres comptes, mais pas à son propriétaire : c'est l'appli qui le lit.
    .solution = sudo chmod 600 /srv/commandes/.env (ou 640 si le groupe commandes doit le lire), puis ls -l pour vérifier que le propriétaire est toujours commandes.

## Chapitre 2 — L'exposition

indice-exposition-ecoute =
    .piste = Avant de fermer des portes, regarde quels programmes écoutent sur quels ports, sur le serveur lui-même (man ss). Le balayage de Salomé est dans balayage-audit.txt.
    .solution = sudo ss -tlnp (les sockets TCP en écoute, en chiffres, avec le programme). 0.0.0.0 : toutes les interfaces ; 127.0.0.1 : cette machine seulement.
indice-exposition-pare-feu =
    .piste = ufw refuse l'entrant par défaut une fois actif ; il suffit d'autoriser ce qui doit rester ouvert (SSH, http, https) AVANT de l'activer (man ufw).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", puis sudo ufw enable (sudo ufw status verbose pour vérifier).
indice-exposition-redis-local =
    .piste = Le pare-feu est une couche ; Redis, lui, doit aussi ne plus tendre l'oreille qu'à la machine : une directive de /etc/redis/redis.conf. Un programme relit sa configuration quand il redémarre.
    .solution = sudo nano /etc/redis/redis.conf : bind 127.0.0.1 -::1 (à la place de bind * -::*). Puis sudo systemctl restart redis-server, et sudo ss -tlnp pour vérifier.
indice-exposition-fin =
    .piste = Le pare-feu filtre et Redis est en local ; prouve que SSH passe encore, avec une nouvelle connexion depuis ton poste.
    .solution = exit, puis ssh fournil.

## Chapitre 3 — Les traces

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
