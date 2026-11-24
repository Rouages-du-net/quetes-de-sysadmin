### Histoire « Le Café des langues », chapitre « Un port et un booléen » :
### httpd ne peut écouter que sur http_port_t et ne peut, par défaut, se
### connecter à aucun autre port. semanage port, setsebool -P, les
### suggestions d'audit2why, une règle riche de firewalld. Commandes,
### options, chemins, étiquettes et sorties ne sont pas traduits.

chapter-port-and-boolean = Un port et un booléen
    .summary = Un planning des bénévoles sur son propre port, une appli d'inscription derrière httpd, et depuis vendredi tout le site est en panne. SELinux refuse à httpd un port et une connexion : donnez-lui exactement ces deux-là, gardez le planning sur le réseau du café, et vérifiez que tout tient après un redémarrage.

## Fichiers

port-and-boolean-message-dilnoza =
    De : Dilnoza
    Lundi 14 décembre, 18 h 40

    Re-bonjour,

    Le site est en panne depuis vendredi soir : l'écran est vide et des
    gens demandent si les tables de jeudi sont annulées (elles ne le sont
    pas !).

    Vendredi, Tenzin a ajouté deux choses, toutes deux pour nos bénévoles :
    une page d'inscription (https://signup.commontongue.example, pour qui
    veut aider) et le planning des bénévoles, sur un autre « port », qui ne
    doit être vu que depuis le réseau du café (les ordinateurs du café et le
    panneau). Puis il a redémarré quelque chose et a dû attraper son train ;
    il est en montagne sans téléphone jusqu'à mercredi. Ses notes sont dans
    votre répertoire.

    S'il vous plaît, remettez tout en marche, comme il faut, comme Seun
    l'aimerait.

    Dilnoza

port-and-boolean-notes-tenzin =
    Notes de Tenzin (vendredi 11 décembre, 17 h 55, pressé)

    - signup : mon appli, /opt/signup, un service systemd (signup.service),
      écoute sur 127.0.0.1:8086. httpd est sa porte d'entrée :
      /etc/httpd/conf.d/signup.conf (ProxyPass).
    - Le planning : /var/www/volunteers, sur le port 8010 :
      /etc/httpd/conf.d/volunteers.conf. Seul le réseau du café
      (198.51.100.0/24) doit le voir.
    - httpd -t disait « Syntax OK », puis systemctl restart httpd a échoué
      avec un « Permission denied » à propos d'une socket. Pas les fichiers,
      cette fois !
    - J'ai lancé audit2allow sur le journal d'audit et il m'a écrit un
      module qui autoriserait tout (dans mon répertoire :
      /home/tenzin/httpd-fix.te). Je ne l'ai pas chargé : ça m'a paru
      beaucoup. J'ai bien fait ?

## Événements

port-and-boolean-event-down =
    httpd n'a pas pu démarrer : « make_sock: could not bind to address
    …:8010 », (13) Permission denied. Rien d'autre n'écoute là (ss -tlnp) :
    le noyau a refusé ce port à httpd. Quelle partie du noyau refuse un port
    à un programme ? Le journal d'audit le sait.

port-and-boolean-event-bind-avc =
    { "{" } name_bind { "}" } sur une tcp_socket, tcontext unreserved_port_t :
    httpd_t ne peut écouter que sur les ports que la politique type
    http_port_t (80, 443, 8008, 8009, 8443, 9000… : semanage port -l), et
    8010 n'est pas un port web pour elle. Un port peut recevoir un type,
    comme un fichier une étiquette.

port-and-boolean-event-nis =
    nis_enabled laisse tout programme qui utilise NSS (presque tous les
    services) écouter et se connecter sur n'importe quel port non réservé :
    audit2why le propose parce que ça marcherait, pas parce que ça convient.
    Éteignez-le (et avec -P), et donnez à httpd seulement le port dont il a
    besoin.

port-and-boolean-event-module =
    Un module d'audit2allow est chargé : httpd_t peut maintenant écouter et
    se connecter sur tous les ports non réservés, bien plus que 8010 et 8086.
    Tenzin avait raison de ne pas le charger : retirez-le (semodule -r) et
    utilisez les moyens de la politique elle-même, un type de port et un
    booléen.

port-and-boolean-event-port =
    8010 est maintenant un port web pour la politique (semanage port -l |
    grep http). httpd a lu sa configuration la dernière fois qu'il a essayé
    de démarrer : démarrez-le de nouveau.

port-and-boolean-event-up =
    httpd est revenu, et avec lui le site du café. Maintenant les deux
    nouveautés : la page d'inscription (curl avec son nom :
    -H 'Host: signup.commontongue.example') et le planning sur 8010 (depuis
    le panneau).

port-and-boolean-event-proxy-503 =
    503 pour la page d'inscription : httpd n'a pas pu joindre l'appli
    derrière elle (AH01114 dans son journal d'erreurs). L'appli tourne
    (systemctl status signup, curl 127.0.0.1:8086 sur bouilloire répond) :
    qui a refusé la connexion à httpd ?

port-and-boolean-event-connect-avc =
    { "{" } name_connect { "}" } : httpd_t qui se connecte au port 8086 a été
    refusé. Par défaut, httpd ne peut se connecter à aucun autre port ; la
    politique offre un booléen pour un proxy inverse. audit2why le nomme (et
    un autre, trop large : lisez les descriptions).

port-and-boolean-event-label-8086 =
    8086 est maintenant http_port_t, mais httpd n'a toujours pas le droit de
    s'y connecter : par défaut, httpd_t ne peut se connecter à aucun port,
    pas même un port web (seulement avec httpd_can_network_relay ou
    httpd_graceful_shutdown, tous deux éteints). Typer les ports sert à
    écouter ; se connecter, c'est l'affaire d'un booléen.

port-and-boolean-event-boolean-runtime =
    httpd_can_network_connect est allumé, jusqu'au prochain redémarrage :
    setsebool sans -P ne change que la politique en cours. Au prochain
    démarrage, la page d'inscription répondrait de nouveau 503.

port-and-boolean-event-boolean =
    httpd_can_network_connect est allumé, maintenant et au prochain
    démarrage : httpd peut joindre son application. Vérifiez la page
    d'inscription.

port-and-boolean-event-open-to-all =
    Le port 8010 est ouvert à tout le monde : le planning, avec les noms et
    les horaires des bénévoles, est sur internet. Seul le réseau du café
    (198.51.100.0/24) devrait le joindre : les règles riches de firewalld
    savent dire « depuis cette source seulement » (man firewall-cmd, et
    firewalld.richlanguage).

port-and-boolean-event-rota-office =
    Le planning est joignable depuis le réseau du café, et seulement de là.
    Gardez la règle à la fois à l'exécution et dans la configuration
    permanente.

port-and-boolean-event-end =
    Dilnoza : « L'écran affiche les tables, Hamza s'est inscrit pour jeudi,
    et le planning est revenu sur l'ordinateur du café. Tenzin va être
    soulagé. »

    Bravo ! Vous avez terminé Un port et un booléen.

    CE QUI S'EST PASSÉ
    Le nouvel hôte virtuel de Tenzin écoutait sur 8010, un port que SELinux
    ne type pas pour le web (unreserved_port_t) : httpd_t s'est vu refuser
    name_bind, et un httpd qui ne peut pas ouvrir une de ses sockets ne
    démarre pas du tout. Vous avez donné à 8010 le type http_port_t
    (semanage port -a), donc httpd démarre. Derrière la page d'inscription,
    httpd doit se connecter à l'appli sur 127.0.0.1:8086, ce que httpd_t ne
    peut pas faire par défaut : httpd_can_network_connect, posé avec -P,
    l'autorise pour de bon. Et une règle riche ne laisse que le réseau du
    café joindre le planning.

    BONNES PRATIQUES
    - Un service qui ne peut pas écouter sur un port avec « Permission
      denied », rien d'autre ne l'occupant : cherchez un AVC (name_bind),
      puis semanage port -a -t avec le type que son domaine peut utiliser
      (http_port_t pour httpd).
    - Un proxy inverse qui répond 503 : name_connect. La politique a des
      booléens pour les besoins courants (getsebool -a | grep httpd) ;
      posez-les avec -P, sinon ils disparaissent au prochain démarrage.
    - Lisez les suggestions d'audit2why : nis_enabled marche, et ouvre tous
      les ports non réservés à tous les services qui utilisent NSS.
      Choisissez la plus étroite.
    - audit2allow -M écrit ce qui a été refusé, aussi largement que ça a été
      refusé : c'est le dernier recours, après les étiquettes, les types de
      port et les booléens ; lisez le fichier .te avant tout semodule -i.
    - Une règle riche (adresse source, port, accept) garde un service sur un
      réseau ; firewall-cmd --add-port l'ouvre à tous.

    DOCUMENTATION
    - RHEL 10, utiliser SELinux, configurations non standard : https://docs.redhat.com/fr/documentation/red_hat_enterprise_linux/10/html/using_selinux/configuring-selinux-for-applications-and-services-with-non-standard-configurations_using-selinux
    - semanage-port(8) : https://man7.org/linux/man-pages/man8/semanage-port.8.html
    - setsebool(8) : https://man7.org/linux/man-pages/man8/setsebool.8.html
    - Le langage riche de firewalld : https://firewalld.org/documentation/man-pages/firewalld.richlanguage.html
    - Apache, guide du proxy inverse : https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html
