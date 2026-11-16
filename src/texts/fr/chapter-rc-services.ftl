### Histoire « L'Autre Unix », chapitre « Pas de systemd ici » : installer et
### démarrer un service à la manière de FreeBSD (pkg, rc.conf, service,
### sysrc, sockstat). Les commandes, options, chemins et messages ne sont pas
### traduits.

chapter-rc-services = Pas de systemd ici
    .summary = Le programme doit être en ligne ce soir : installer nginx avec pkg, l'activer dans rc.conf, le démarrer avec service, et vérifier qui écoute.

## Fichiers

rc-services-message-romy =
    De :  Romy
    À :   toi

    Ce soir, c'est la séance du mois, et le programme n'est toujours pas en
    ligne ! Les notes de Lucien disent que le site était servi par nginx,
    mais il n'y a plus de nginx sur le serveur (on l'a réinstallé au
    printemps, et personne n'a refait la partie web). Tu peux le remettre
    avant 20 h ? Le site lui-même est toujours dans /usr/local/www/club.

    Romy

rc-services-notes-lucien =
    Notes de Lucien (2024)
    - nginx vient des paquets ; sa configuration dans /usr/local/etc/nginx.
    - Tout ce qui démarre au boot est dans /etc/rc.conf.
    - Pas de systemd, pas d'apt. man est ton ami.

## Événements

rc-services-event-no-systemd =
    Introuvable : FreeBSD n'a ni systemd ni apt. Les paquets viennent de
    pkg (man pkg), et les services sont des scripts rc, pilotés par service
    (man service).
rc-services-event-ps-ef =
    ps -ef, sur FreeBSD, ne veut pas dire « tous les processus, format
    complet » : -e montre l'environnement de chaque processus (ces HOME=,
    PATH=…), et sans a ni x, ps ne liste que tes propres processus attachés
    à un terminal. À la manière de BSD : ps aux (ou ps -ax), et ps -axj pour
    les parents. man ps, sur cette machine.
rc-services-event-installed =
    nginx est installé, sous /usr/local : sa configuration dans
    /usr/local/etc/nginx, son script rc dans /usr/local/etc/rc.d/nginx.
    Installé ne veut dire ni démarré, ni lancé au boot.
rc-services-event-not-enabled =
    « Cannot 'start' nginx » : sur FreeBSD, un service ne démarre que si
    /etc/rc.conf l'active (nginx_enable="YES"). Le message nomme même la
    variable. sysrc l'écrit sans ouvrir d'éditeur (man sysrc).
rc-services-event-onestart =
    nginx tourne… mais grâce à onestart, pas parce que rc.conf le dit : au
    prochain redémarrage, il ne reviendra pas. Le site disparaîtrait une
    nuit sans que personne n'ait rien touché.
rc-services-event-enabled =
    nginx_enable="YES" est dans rc.conf : nginx démarrera à chaque boot.
rc-services-event-end =
    Romy : « Le programme est en ligne ! Yanis a vérifié de chez lui, ça
    marche. »

    Bravo ! Tu as terminé le chapitre « Pas de systemd ici ».

    CE QUI S'EST PASSÉ
    nginx n'était plus installé. pkg l'a installé sous /usr/local, rc.conf
    l'active désormais au démarrage (nginx_enable="YES"), et service l'a
    lancé ; sockstat le montre à l'écoute sur le port 80.

    BONNE PRATIQUE
    - Sur FreeBSD, un service tourne parce que /etc/rc.conf le dit : une
      ligne par service, NOM_enable="YES", l'équivalent de systemctl
      enable.
    - sysrc modifie rc.conf sans risquer une faute de frappe dans le reste
      du fichier.
    - Les paquets vivent sous /usr/local : leur configuration est dans
      /usr/local/etc, pas dans /etc.
    - Lire ce que pkg affiche après l'installation : les paquets y laissent
      des messages utiles.

    UNE AUTRE FAÇON DE FAIRE
    service nginx enable écrit la même ligne dans rc.conf (depuis FreeBSD
    12). Les ports (/usr/ports) compilent les mêmes logiciels depuis les
    sources, avec les options de son choix : plus lent, plus souple. Les
    jails isolent un service dans son petit système à lui, sur la même
    machine.

    DOCUMENTATION
    - Le Handbook, les paquets : https://docs.freebsd.org/en/books/handbook/ports/#pkgng-intro
    - Le Handbook, démarrer des services : https://docs.freebsd.org/en/books/handbook/config/#configtuning-starting-services
    - rc.conf(5) : https://man.freebsd.org/cgi/man.cgi?query=rc.conf
    - sysrc(8) : https://man.freebsd.org/cgi/man.cgi?query=sysrc
