### Histoire « Les Refuges », chapitre 1 « Rassembler les journaux » :
### rsyslog en serveur central (imudp), le pare-feu, un fichier par
### refuge, stop. La configuration, les chemins et les sorties des outils
### ne sont pas traduits.

chapter-central-logs = Rassembler les journaux
    .summary = Les trois refuges de montagne envoient leurs journaux au serveur de la vallée, et rien n'arrive. Fais écouter la vallée, laisse entrer les refuges, et donne à chaque refuge son propre fichier.

## Fichiers

central-logs-message-lou =
    De :     Lou
    À :      toi
    Objet :  Les journaux des refuges

    Bonjour,

    Ce printemps, j'ai réglé les petites machines des trois refuges
    (refuge-lac, refuge-col, refuge-crete) pour qu'elles envoient tous
    leurs journaux à ce serveur de la vallée, avec une ligne dans leur
    rsyslog : *.* @vallee.internal:514 (UDP).

    L'idée : tout lire d'ici, sans monter à chaque refuge. Mais rien
    n'arrive sur vallee. Tu pourrais voir pourquoi ?

    Et quand ça marchera, j'aimerais un fichier par refuge, dans
    /var/log/remote/, pas tout mélangé dans le /var/log/syslog de la
    vallée.

    Ton mot de passe sudo : sommet-2028.

    Lou

## Événements

central-logs-event-silent =
    Rien n'écoute en UDP sur le port 514 ici : dans /etc/rsyslog.conf, le
    module qui reçoit syslog en UDP (imudp) et son entrée sont en
    commentaire, comme Debian l'installe. Un serveur ne reçoit que ce
    qu'on lui a dit d'écouter.
central-logs-event-restart-needed =
    Le fichier de configuration est bon, mais le rsyslog en marche l'a lu
    à son démarrage : redémarre-le (sudo systemctl restart rsyslog). Avant,
    sudo rsyslogd -N1 vérifie la configuration sans toucher au service en
    marche.
central-logs-event-listening =
    rsyslog écoute en UDP sur le port 514 maintenant (ss -ulnp le montre).
    Mais les messages des refuges entrent-ils ? Regarde ce qui arrive, et
    ce qui se trouve entre les refuges et le port.
central-logs-event-firewall =
    rsyslog écoute, mais rien n'arrive des refuges : ufw ne laisse entrer
    que SSH, et l'UDP 514 est jeté avant que rsyslog voie quoi que ce
    soit. Laisse entrer les refuges, et seulement eux si tu peux (man ufw :
    from … to any port … proto udp).
central-logs-event-mixed =
    Les messages des refuges arrivent… dans le /var/log/syslog de la
    vallée, mêlés aux siens. rsyslog applique toutes les règles qui
    correspondent, dans l'ordre : une règle pour les refuges (un fichier
    par refuge : un modèle avec %HOSTNAME%) doit venir en premier, et finir
    par stop, pour que les règles par défaut ne les reçoivent pas aussi.
    Les fichiers de /etc/rsyslog.d sont lus avant les règles de
    rsyslog.conf.
central-logs-event-config-error =
    rsyslog a démarré avec des erreurs dans sa configuration : son journal
    dit lesquelles (journalctl -u rsyslog), et sudo rsyslogd -N1 aussi. Les
    règles fautives sont ignorées.
central-logs-event-end =
    Chaque refuge a son fichier maintenant ({ $file }…), et le syslog de
    la vallée reste celui de la vallée. Lou : « Je vois le frigo du refuge
    du lac d'ici. Magique. »

    Bravo ! Tu as terminé le chapitre « Rassembler les journaux ».

    CE QUI S'EST PASSÉ
    Les refuges envoyaient leurs journaux à vallee en UDP, mais le
    rsyslog de vallee n'écoutait pas (imudp en commentaire), et son
    pare-feu jetait l'UDP 514 de toute façon. L'UDP ne se plaint jamais :
    les refuges ne savaient pas que rien n'arrivait.

    LE SERVEUR CENTRAL
    - module(load="imudp") et input(type="imudp" port="514") dans
      rsyslog.conf (ou TCP : imtcp, plus fiable).
    - Le pare-feu ouvert pour les expéditeurs seulement.
    - Un modèle (template) avec %HOSTNAME% (ou %FROMHOST-IP%) pour un
      fichier par machine, et stop pour que les messages n'aillent nulle
      part ailleurs.

    BONNES PRATIQUES
    - sudo rsyslogd -N1 après chaque modification, avant de redémarrer.
    - Tester depuis l'expéditeur : logger "test depuis le refuge du lac",
      puis le chercher sur le serveur.
    - L'UDP perd des messages sans le dire : TCP (imtcp, @@serveur chez
      les expéditeurs), avec une file d'attente, vaut mieux pour les
      journaux qui comptent.

    DOCUMENTATION
    - imudp : https://www.rsyslog.com/doc/configuration/modules/imudp.html
    - Les modèles : https://www.rsyslog.com/doc/configuration/templates.html
    - Les filtres : https://www.rsyslog.com/doc/configuration/filters.html
