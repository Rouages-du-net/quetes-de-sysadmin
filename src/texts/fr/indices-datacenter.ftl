### Indices gradués du Datacenter (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des fichiers sont ceux de noms.ftl.

## Chapitre 1 — Premier jour

indice-premier-jour-compte =
    .piste = Le journal est /var/log/nginx/access.log. Il faut garder les lignes en erreur 503, puis les compter : deux outils des notes d'Awa, branchés par un tube.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l (grep garde les lignes en 503, wc -l les compte).
indice-premier-jour-robot =
    .piste = L'adresse IP est le premier champ de chaque ligne. Garde-la seule, trie, compte les lignes identiques, puis trie par nombre : les notes d'Awa donnent la chaîne.
    .solution = cut -d " " -f 1 /var/log/nginx/access.log | sort | uniq -c | sort -n | tail -3 (la dernière ligne est l'adresse la plus bavarde).
indice-premier-jour-surcharge =
    .piste = Le site est lent : un processus doit dévorer le processeur. Une commande liste tous les processus de la machine, avec leur %CPU.
    .solution = ps aux (regarde la colonne %CPU : php-fpm: pool catalogue est à 99 %).
indice-premier-jour-regle =
    .piste = Bloque le robot dans /etc/nginx/blocked.conf, au format deny ADRESSE; sans effacer les règles déjà là. Le fichier appartient à root, et une redirection >> est faite par ton shell, pas par sudo : tee sait écrire à sa place.
    .solution = echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf (-a ajoute à la fin au lieu d'écraser).
indice-premier-jour-bloque =
    .piste = nginx ne relit pas son fichier tout seul : il faut le lui demander, par le gestionnaire de services.
    .solution = sudo systemctl reload nginx
indice-premier-jour-repare =
    .piste = Le processus surchargé tourne encore (ps aux). Arrête-le : il appartient à www-data, il faut donc sudo. systemd le relancera, propre.
    .solution = ps aux pour trouver son numéro, puis sudo kill PID (4242 au départ, ou celui du processus relancé à 99 %).
indice-premier-jour-rapport =
    .piste = Le rapport va dans ~/rapport.txt : le nombre d'erreurs 503 et l'adresse du robot. > crée le fichier, >> ajoute une ligne.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt, puis echo "Coupable : 198.51.100.77" >> ~/rapport.txt

## Chapitre 2 — Deuxième jour

indice-deuxieme-jour-malo-lit =
    .piste = ls -l /var/log/nginx montre à quel groupe appartiennent les journaux, et ce que ce groupe peut faire. Ajoute Malo à ce groupe, sans le retirer des siens (man usermod : attention à -G sans -a). Ne donne pas la lecture à tout le monde.
    .solution = sudo usermod -aG adm malo (-a ajoute le groupe, sans remplacer ses autres groupes ; vérifie avec groups malo).
indice-deuxieme-jour-partage =
    .piste = /srv/equipe appartient à root. Donne-le au groupe web-team, puis des droits pour le groupe et aucun pour les autres (man chgrp, man chmod). Pas de 777 !
    .solution = sudo chgrp web-team /srv/equipe puis sudo chmod 770 /srv/equipe (le groupe lit, écrit, entre ; les autres rien).
indice-deuxieme-jour-fin =
    .piste = Vérifie les deux missions : Malo lit les journaux (sans qu'ils soient ouverts à tous) et reste dans web-team ; le dossier partagé est fermé aux autres comptes.
    .solution = groups malo doit montrer adm et web-team (sinon : sudo usermod -aG web-team malo) ; les journaux en 640 (sudo chmod 640 /var/log/nginx/access.log /var/log/nginx/error.log) ; /srv/equipe en 770.

## Chapitre 3 — La nuit du redémarrage

indice-redemarrage-nginx =
    .piste = Quels services sont en panne, ou arrêtés ? systemctl sait les lister et dire l'état de chacun. Regarde aussi la ligne Loaded de nginx : démarrer ne suffit pas, il doit repartir avec la machine (man systemctl).
    .solution = sudo systemctl enable --now nginx (enable : il démarrera avec la machine ; --now : il démarre tout de suite).
indice-redemarrage-catalogue =
    .piste = Le catalogue refuse de démarrer : son journal dit pourquoi (journalctl -u). Le dossier de ses journaux appartient à root, alors que php-fpm tourne sous www-data. Changer le propriétaire, pas ouvrir à tous.
    .solution = sudo chown www-data: /var/log/catalogue, puis sudo systemctl restart catalogue
indice-redemarrage-fin =
    .piste = Le vrai test, c'est le prochain démarrage : redémarre toi-même la machine, puis vérifie que tout est reparti sans toi.
    .solution = sudo reboot, puis, une fois reconnecté·e : systemctl --failed (ou systemctl status nginx catalogue).

## Chapitre 4 — Le grand incendie

indice-incendie-nginx =
    .piste = La machine est neuve : avant d'installer, apt doit télécharger la liste des paquets disponibles (man apt). Le paquet s'appelle nginx.
    .solution = sudo apt update, puis sudo apt install nginx (curl http://localhost montre la page de bienvenue).
indice-incendie-fin =
    .piste = Suis le PRA (/mnt/sauvegarde/PRA.txt) : vérifie chaque archive en la listant (tar -t) avant de l'extraire, prends la plus récente qui se lit jusqu'au bout, extrais-la depuis la racine (man tar, -C). Puis nginx -t : deux sites ne peuvent pas être default_server sur le même port.
    .solution = sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-22.tar.gz -C /, puis sudo rm /etc/nginx/sites-enabled/default, sudo nginx -t, sudo systemctl reload nginx, et curl http://medialibrary.example

## Chapitre 5 — Le certificat a expiré

indice-certificat-expire =
    .piste = Commence par constater la panne : demande le site en HTTPS, ou demande à certbot l'état de ses certificats.
    .solution = curl https://medialibrary.example (ou sudo certbot certificates : INVALID: EXPIRED).
indice-certificat-defi =
    .piste = Pourquoi le renouvellement automatique a-t-il échoué ? Rejoue-le sans rien casser : man certbot parle d'une répétition générale.
    .solution = sudo certbot renew --dry-run (et journalctl -u certbot pour le journal des nuits précédentes).
indice-certificat-fin =
    .piste = certbot dépose le défi dans le dossier de /etc/letsencrypt/renewal/medialibrary.example.conf, mais nginx sert le site depuis /var/www/medialibrary. Corrige le dossier, renouvelle pour de vrai, recharge nginx, et fais-le recharger tout seul après chaque renouvellement (cherche « hook » dans man certbot).
    .solution = sudo certbot renew --webroot -w /var/www/medialibrary, puis sudo certbot reconfigure --cert-name medialibrary.example --deploy-hook "systemctl reload nginx", puis sudo systemctl reload nginx
