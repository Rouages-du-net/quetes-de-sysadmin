### Histoire « La Cantine », chapitre 3 « Le démarrage lent » :
### network-online.target, systemd-networkd-wait-online, systemd-analyze.
### Les noms d'unités, les chemins et les messages de systemd ne se
### traduisent pas.

chapter-slow-boot = Le démarrage lent
    .summary = Depuis la deuxième carte réseau, le serveur met deux minutes à revenir après un redémarrage. Trouve qui il attend.

## Fichiers

slow-boot-message-ibrahim =
    De :      Ibrahim
    À :       toi
    Objet :   Deux minutes de 502

    Bonjour,

    J'ai ajouté une deuxième carte réseau au serveur, eth1, pour la ligne de
    secours que la mairie va nous donner (elle n'est pas encore branchée).
    Je l'ai déjà configurée, /etc/systemd/network/20-eth1.network, pour être
    prêt le jour venu.

    Depuis, chaque redémarrage n'en finit pas : plus de deux minutes avant
    que le site revienne, et pendant ce temps les bénévoles ont « 502 Bad
    Gateway ». À la fin tout marche, mais deux minutes à l'heure du déjeuner,
    c'est long.

    Peux-tu trouver ce que le serveur attend, et le faire redémarrer vite à
    nouveau ? La ligne de secours viendra un jour : sa configuration ne doit
    pas être perdue pour de bon. Tu peux redémarrer (sudo reboot), mot de
    passe lentilles-2028.

    Ibrahim

## Événements

slow-boot-event-blame =
    systemd-networkd-wait-online.service : plus de deux minutes, presque tout
    le démarrage. Son travail : attendre que le réseau soit « en ligne »,
    pour que network-online.target soit atteint ; nginx et l'appli attendent
    cette cible (systemd-analyze critical-chain). Qu'attend-il ? networkctl
    liste les liens et leur état.
slow-boot-event-no-carrier =
    eth1 : no-carrier. La carte a une configuration (20-eth1.network), donc
    wait-online attend qu'elle soit en ligne… mais sans câble, pas de réseau :
    au bout de deux minutes, il abandonne, et le démarrage continue. Dis-lui
    de ne pas attendre ce lien (man systemd.network : RequiredForOnline=), ou
    quoi attendre (man systemd-networkd-wait-online : --any, --interface=).
slow-boot-event-menu-only =
    Toujours lent : l'appli n'attend plus le réseau, mais nginx, si (son
    unité, After=network-online.target). Tant que wait-online attend eth1,
    tout ce qui a besoin du réseau attend avec lui (systemd-analyze
    critical-chain).
slow-boot-event-disabled =
    Sans wait-online, network-online.target est atteint tout de suite : c'est
    rapide, en effet. Sur ce serveur c'est acceptable (les services écoutent
    en local ou sur eth0, qui monte en une seconde), mais la cible ne veut
    plus dire « le réseau marche ». La correction plus fine garde
    wait-online et lui dit quoi attendre.
slow-boot-event-end =
    Le serveur est là en quelques secondes après un redémarrage, et le site
    répond tout de suite. Ibrahim : « Et quand la ligne de secours sera
    branchée, eth1 montera tout seul ? » Oui : sa configuration est toujours
    là.

    Bravo ! Tu as terminé le chapitre « Le démarrage lent ».

    CE QUI S'EST PASSÉ
    nginx (l'unité de Debian) et l'appli attendent network-online.target.
    Cette cible est atteinte quand systemd-networkd-wait-online a fini, et
    wait-online attend que chaque lien qui a une configuration (un
    fichier .network) soit en ligne. eth1 en avait une, mais pas de câble :
    wait-online a attendu deux minutes, a abandonné, et alors seulement nginx
    et l'appli ont démarré.

    LES OUTILS D'UN DÉMARRAGE LENT
    - systemd-analyze time : combien de temps ont pris le noyau et l'espace
      utilisateur.
    - systemd-analyze blame : chaque unité, selon le temps qu'elle a mis à
      démarrer.
    - systemd-analyze critical-chain : la chaîne d'unités qui a retardé la
      fin du démarrage (@ quand elle a démarré, + combien de temps).
    - systemctl list-dependencies --after nginx : ce qu'une unité attend.
    - networkctl : les liens, et où en est chacun.

    BONNES PRATIQUES
    - Un lien qui peut manquer : RequiredForOnline=no dans son
      fichier .network (section {"["}Link]) ; il monte tout seul quand il
      est branché.
    - Ou dire à wait-online ce que « en ligne » veut dire ici : une
      surcharge avec ExecStart= puis
      ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --any
      (ou --interface=eth0).
    - After=network-online.target seulement là où il faut (un service qui
      se connecte à une autre machine au démarrage) ; un service qui écoute
      n'en a pas besoin.

    DOCUMENTATION
    - Lancer des services après la mise en route du réseau : https://systemd.io/NETWORK_ONLINE/
    - systemd-networkd-wait-online : https://www.freedesktop.org/software/systemd/man/latest/systemd-networkd-wait-online.service.html
    - RequiredForOnline= : https://www.freedesktop.org/software/systemd/man/latest/systemd.network.html#RequiredForOnline=
    - systemd-analyze : https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html
