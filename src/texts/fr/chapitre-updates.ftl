### Histoire « La Coopérative », chapitre « Les mises à jour » : apt upgrade
### sur une connexion fragile (tmux), le redémarrage pour le noyau, et un
### service qui ne repart pas. Les commandes, les chemins et les sorties
### d'apt, de dpkg et de tmux (en anglais) ne se traduisent pas.

chapter-updates = Les mises à jour
    .resume = Des mois de retard : apt upgrade sur un wifi qui coupe (tmux, dpkg --configure -a), un nouveau noyau, et un redémarrage qui révèle un service oublié.

## Fichiers

updates-email-awa =
    De :     Awa
    À :      toi
    Objet :  Les mises à jour

    Marc ne faisait jamais les mises à jour du serveur (« ça marche, on n'y
    touche pas »). Le prestataire de paiement exige que les correctifs de
    sécurité soient installés. Ce matin, avant l'ouverture (10 h), peux-tu :

    1. installer les mises à jour (man apt : update d'abord) ;
    2. redémarrer le serveur si c'est nécessaire ;
    3. vérifier qu'après, tout tourne : le site ET la caisse.

    Attention : le wifi de la coopérative coupe de temps en temps (la box
    est fatiguée). Si ta connexion tombe au milieu de la mise à jour… Gaspard,
    de la Maison des associations, m'a dit de te parler de tmux.

    Pour sudo : radis-2027

## Événements

updates-event-interrupted =
    La connexion est tombée en pleine mise à jour, et dpkg avec elle : des
    paquets sont dépaquetés, mais pas configurés. apt refuse de continuer
    tant qu'on n'a pas fini le travail : sudo dpkg --configure -a (man dpkg).

    La prochaine fois, une longue opération sur un serveur se lance dans tmux :
    elle survit à la connexion.
updates-event-in-tmux =
    Ta connexion est tombée… mais la mise à jour tournait dans tmux : elle
    est allée au bout, sans toi. Rattache-toi à ta session (tmux ls, puis
    tmux attach) pour voir comment elle s'est terminée.
# { $ancien } : le noyau qui tourne ; { $nouveau } : celui qui vient d'être installé
updates-event-a-day =
    Les mises à jour sont installées. Mais le nouveau noyau ({ $nouveau }) ne
    tourne pas encore : uname -r dit toujours { $ancien }. Regarde
    /var/run/reboot-required.pkgs : il faut redémarrer (avant 10 h !).
updates-event-till-down =
    Le serveur a redémarré sur le nouveau noyau… mais la caisse ne répond plus.
    systemctl status till : « disabled ». Marc la lançait à la main, son
    service n'a jamais été activé au démarrage (man systemctl : enable).
updates-event-end =
    Les correctifs sont installés, le nouveau noyau tourne, et le site comme
    la caisse sont repartis tout seuls. Il est 9 h 50. Awa : « Pile à
    l'heure. On ouvre ! »

    Bravo ! Tu as terminé le chapitre « Les mises à jour ».

    CE QUI S'EST PASSÉ
    apt upgrade télécharge les nouvelles versions, les dépaquette, puis les
    configure. Si la session meurt entre les deux, dpkg reste à mi-chemin.
    tmux garde la session sur le serveur : la connexion peut tomber, le
    travail continue. Un nouveau noyau ne sert qu'au redémarrage
    (uname -r), et un redémarrage ne relance que les services activés.

    LA BONNE PRATIQUE
    - Les mises à jour de sécurité, souvent (et automatiquement : le paquet
      unattended-upgrades).
    - Les longues opérations dans tmux (ou screen).
    - Lire /var/run/reboot-required avant de dire « c'est fini », et
      redémarrer à une heure choisie.
    - Après un redémarrage : systemctl --failed, et vérifier les services
      qui comptent ; tout service utile doit être activé (enable).

    LA DOCUMENTATION
    - apt : https://manpages.debian.org/trixie/apt/apt.8.en.html
    - tmux : https://man.openbsd.org/tmux
    - Debian, mises à jour : https://www.debian.org/doc/manuals/debian-reference/ch02.en.html
