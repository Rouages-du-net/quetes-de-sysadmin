### Histoire « La Salle des profs », chapitre « Les Traces sur papier » : des
### journaux de débogage qui remplissent le disque et gardent les noms des
### élèves, un historique et des documents gardés pour toujours, n'importe
### qui annulant les travaux de n'importe qui, les pages d'administration
### ouvertes à l'école. cupsd.conf, cupsctl, journaux. Les commandes,
### options, chemins et sorties ne se traduisent pas.

chapter-paper-trail = Les Traces sur papier
    .summary = Le serveur d'impression se souvient de trop de choses : des semaines de journaux de débogage sur un disque plein, le titre de chaque bulletin, chaque document. Remettez les journaux à leur place, apprenez à CUPS à oublier, et fermez ce qui était resté ouvert.

## Fichiers

paper-trail-message-ines =
    De : Ines (secrétariat de l'école)
    Vendredi 7 décembre, 16 h

    Bonjour,

    Deux choses, et la seconde m'inquiète.

    craie a envoyé une alerte ce matin : /var est presque plein. Darius,
    qui s'en occupait avant vous, a « débogué le multifonction » en
    novembre ; je ne sais pas ce qu'il a laissé derrière lui.

    Et notre déléguée à la protection des données est passée (sa demande
    est dans votre dossier). Elle a vu, sur la page web de l'imprimante,
    la liste de tout ce qui a été imprimé ce trimestre : bulletins, plans
    d'accompagnement, fiches médicales, avec les noms des élèves dans les
    titres. N'importe qui à l'école peut la voir. Et la semaine dernière,
    Sven a annulé les bulletins d'Amara pour faire passer les siens : il
    paraît que n'importe qui peut annuler le travail de n'importe qui.

    Pouvez-vous mettre de l'ordre dans tout ça ? Le personnel doit
    continuer à imprimer, bien sûr.

    Ines

paper-trail-dpo-request =
    De : la déléguée à la protection des données de l'école
    À : Ines, et la personne qui s'occupe du serveur d'impression

    Les travaux d'impression sont des données personnelles quand leurs
    titres nomment des élèves. Je demande :

    - un historique des impressions d'une semaine au plus (pour les
      problèmes et les coûts) ;
    - aucun document gardé sur le serveur une fois imprimé (un jour au plus) ;
    - noms et titres visibles de leur propriétaire et des administrateur·rices
      seulement ;
    - des journaux qui n'enregistrent pas ce qui est imprimé, au-delà du
      nécessaire ;
    - l'administration du serveur accessible depuis le serveur lui-même
      seulement.

    Merci.

## Événements

paper-trail-event-big-log =
    /var est presque plein, et /var/log/cups/error_log pèse 3,9 Go.
    Qu'est-ce que cupsd a bien pu écrire ? (sudo tail
    /var/log/cups/error_log, grep LogLevel /etc/cups/cupsd.conf.)
paper-trail-event-names =
    LogLevel debug2 : cupsd écrit tout, y compris les attributs de chaque
    travail : son nom, son propriétaire, sa machine. Les noms des élèves
    finissent dans le journal, des gigaoctets durant. Et MaxLogSize 0 :
    cupsd ne le fait jamais tourner.
paper-trail-event-history =
    L'historique remonte à octobre (lpstat -W completed -o), et avec
    PreserveJobFiles Yes, chaque document est encore dans le spool
    (/var/spool/cups/d01188-001…). Par défaut, CUPS garde l'historique pour
    toujours (PreserveJobHistory Yes) et les documents un jour. La déléguée
    demande une semaine, et aucun.
paper-trail-event-not-applied =
    cupsd.conf a changé, mais cupsd tourne avec ce qu'il a lu au
    démarrage : redémarrez-le (cupsd -t vérifie d'abord le fichier), ou
    utilisez cupsctl, qui le redémarre.
paper-trail-event-stopped =
    cupsd ne tourne plus : personne ne peut imprimer. systemctl status cups
    et journalctl -u cups disent pourquoi (une erreur de syntaxe dans
    cupsd.conf : cupsd -t montre la ligne).
paper-trail-event-loglevel =
    cupsd journalise maintenant à un niveau raisonnable : avertissements
    et erreurs (et l'historique de débogage d'un travail en échec), sans
    les attributs de chaque travail.
paper-trail-event-rotation =
    Les journaux tourneront : cupsd lui-même à MaxLogSize (error_log
    devient error_log.O), ou le fichier de logrotate pour /var/log/cups.
paper-trail-event-rotated-o =
    cupsd a fait tourner le gros journal : il s'appelle maintenant
    error_log.O, et il prend toujours 3,9 Go. L'ancien journal ne sert
    plus à rien : il peut partir (et avec lui, les noms d'élèves qu'il
    contient).
paper-trail-event-small =
    /var/log/cups a retrouvé une taille raisonnable, et le disque respire
    (df -h /var).
paper-trail-event-kept =
    CUPS oublie maintenant : l'historique au-delà d'une semaine et les
    documents imprimés sont purgés (lpstat -W completed -o, sudo ls
    /var/spool/cups).
paper-trail-event-private =
    JobPrivateValues cache les noms, propriétaires et machines d'un
    travail à tout le monde sauf son propriétaire et les
    administrateur·rices.
paper-trail-event-cancel-policy =
    Cancel-Job exige de nouveau son propriétaire ou un·e administrateur·rice
    (Require user @OWNER @SYSTEM, la politique par défaut).
paper-trail-event-admin-closed =
    /admin ne répond plus qu'à localhost : depuis les réseaux du personnel
    ou des élèves, 403 (access_log).
paper-trail-event-cancel-all =
    cancel -a a aussi annulé les travaux d'aujourd'hui : le personnel va
    les renvoyer. Les anciens travaux étaient déjà terminés ; ce sont les
    réglages de CUPS qui les gardent.
paper-trail-event-broke-printing =
    Le personnel (ou les Chromebooks de la bibliothèque) ne peut plus
    imprimer : le changement est allé trop loin. C'est /admin qu'il faut
    fermer ; /printers doit rester ouvert à l'école.
paper-trail-event-end =
    Ines : « La déléguée est contente, le disque est content, et les
    bulletins d'Amara sont sortis les premiers. Bon week-end ! »

    Bravo ! Vous avez terminé Les Traces sur papier.

    CE QUI S'EST PASSÉ
    Darius avait laissé LogLevel debug2 et MaxLogSize 0 : 3,9 Go
    d'error_log, avec le nom de chaque travail dedans, et le fichier de
    logrotate supprimé. CUPS gardait l'historique et le document de chaque
    travail du trimestre (PreserveJobHistory et PreserveJobFiles Yes),
    montrait les titres à tout le monde (JobPrivateValues none), laissait
    n'importe qui annuler n'importe quoi, et servait /admin à toute
    l'école. Vous avez remis LogLevel à warn avec une rotation, supprimé
    l'ancien journal, limité l'historique à une semaine et les documents
    à un jour ou rien, caché les valeurs privées, exigé le propriétaire
    pour annuler, et fermé /admin, le tout appliqué par un redémarrage.

    BONNES PRATIQUES
    - Le débogage, c'est pour un moment : remettez LogLevel (cupsctl
      --no-debug-logging), et gardez une rotation (MaxLogSize ou logrotate).
    - Ce qu'un serveur imprime, ce sont des données : décidez combien de
      temps vous les gardez (PreserveJobHistory, PreserveJobFiles,
      page_log), et écrivez-le.
    - Gardez la politique par défaut de CUPS : JobPrivateValues default,
      Cancel-Job pour @OWNER @SYSTEM.
    - L'administration depuis localhost (cupsctl --no-remote-admin), ou
      par ssh avec un tunnel quand il faut les pages web.
    - cupsctl modifie cupsd.conf et redémarre cupsd ; après nano, cupsd -t
      puis systemctl restart cups.
    - Un journal qui a tourné prend toujours sa place tant qu'il n'est pas
      supprimé.

    DOCUMENTATION
    - cupsd.conf : https://www.cups.org/doc/man-cupsd.conf.html
    - cupsctl : https://www.cups.org/doc/man-cupsctl.html
    - Gérer les politiques d'opérations : https://www.cups.org/doc/policies.html
    - Les journaux de CUPS : https://www.cups.org/doc/man-cupsd-logs.html
