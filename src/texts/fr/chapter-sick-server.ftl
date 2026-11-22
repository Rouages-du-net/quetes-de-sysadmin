### Histoire « La Collecte », chapitre « Le Serveur malade » : un serveur
### qui répond 500 reçoit toujours du trafic (aucune vérification de santé) ;
### un serveur à sortir pour maintenance sans couper de session. option
### httpchk, http-check expect, check, fall, rise, l'API d'exécution (socat,
### show stat, set server … state drain). Les commandes, options, chemins et
### sorties ne se traduisent pas.

chapter-sick-server = Le Serveur malade
    .summary = Un·e donneur·se sur trois tombe sur une page d'erreur, et un technicien attend à la porte pour réparer un serveur web. Apprenez à HAProxy à distinguer un serveur sain d'un serveur malade, et sortez un serveur du lot sans couper la réservation de personne.

## Fichiers

sick-server-message-zainab =
    De : Zainab (service des donneur·ses)
    Mercredi 22 mai, 10 h 05

    Rebonjour !

    Depuis ce matin, environ un·e donneur·se sur trois tombe sur une page
    d'erreur en choisissant une collecte (« Server Error (500) ») ; en
    réessayant, ça marche en général. Nous avons eu des plaintes.

    Autre chose : le technicien de l'hébergeur est là pour remplacer une
    barrette de mémoire de web2 (elle signale des erreurs mémoire). Il
    attend votre feu vert : il éteindra web2 dès que plus personne ne
    l'utilise, et j'aimerais que personne ne perde une réservation à
    moitié faite.

    Zainab

sick-server-message-teodor =
    De : Teodor (application de rendez-vous)

    Salut ! L'application a une page de santé : GET /health sur le port
    8080 répond 200 quand l'application et sa base vont bien, et 500
    sinon. Elle est là pour les répartiteurs, s'ils la demandent.

    La socket d'exécution de HAProxy est /run/haproxy/admin.sock (stats
    socket dans haproxy.cfg). Bastien utilisait quelque chose comme :
    echo "show stat" | sudo socat stdio /run/haproxy/admin.sock

    Teodor

## Événements

sick-server-event-errors =
    Les erreurs 500 viennent de web3 : HAProxy lui envoie une requête sur
    trois (balance roundrobin), et l'application de web3 répond « Server
    Error (500) » à chacune. Pourquoi HAProxy continue-t-il à lui envoyer
    des requêtes ? Demandez à HAProxy ce qu'il pense de ses serveurs.
sick-server-event-denied =
    La socket appartient à root et au groupe haproxy (mode 660) : socat a
    besoin de sudo.
sick-server-event-no-check =
    « no check » : HAProxy ne vérifie pas du tout ses serveurs. Il les
    croit tous en service, quoi qu'ils répondent. Les serveurs ont besoin de
    l'option check, et d'une vérification qui regarde l'application, pas
    seulement le port (man haproxy, et son manuel de configuration : option
    httpchk).
sick-server-event-tcp-only =
    Les serveurs sont vérifiés maintenant, mais web3 est toujours UP :
    « L4OK ». Sans option httpchk, une vérification ouvre seulement une
    connexion TCP vers le port 8080, et l'application de web3 l'accepte.
    C'est l'application qui est malade, pas son port : vérifiez /health en
    HTTP (option httpchk GET /health, http-check expect status 200).
sick-server-event-http-check =
    web3 est DOWN : « Layer7 wrong status, code: 500 » dans
    /var/log/haproxy.log, L7STS dans show stat. Après `fall` vérifications
    ratées, HAProxy cesse de lui envoyer des requêtes ; après `rise`
    réussies (quand Teodor aura réparé sa base), il reviendra tout seul.
sick-server-event-lb2-synced =
    lb2 vérifie de la même façon : si l'adresse passe sur lb2 demain, son
    HAProxy n'enverra pas non plus de donneur·ses vers un serveur malade.
sick-server-event-wrong-node =
    web2 est sorti du lot sur le répartiteur qui ne tient pas l'adresse :
    les requêtes des donneur·ses passent par l'autre. Faites-le sur le
    maître (ip a vous dit lequel).
sick-server-event-removed =
    La ligne server de web2 a disparu d'un haproxy.cfg. Il reviendra après
    la réparation : il faudra la réécrire, recharger, et la garder
    identique sur les deux répartiteurs. L'API d'exécution est faite pour
    ça : elle sort un serveur et le remet sans toucher au fichier.
sick-server-event-drained =
    web2 ne reçoit plus de nouvelles requêtes (drain : les sessions déjà
    ouvertes se terminent ; maint : plus de trafic ni de vérifications).
    Regardez ses sessions baisser (scur dans show stat) avant que le
    technicien l'éteigne.
sick-server-event-cut =
    L'application de web2 s'est arrêtée alors que des donneur·ses étaient
    encore dessus : leurs réservations se sont interrompues en route.
    D'abord drainer, attendre la fin des sessions, puis éteindre.
sick-server-event-tech-working =
    Zainab : « Le technicien a éteint web2, il en a pour une minute
    environ. » Pendant ce temps, la vérification de HAProxy sur web2
    échoue, c'est normal.
sick-server-event-tech-done =
    Zainab : « web2 est revenu, avec sa nouvelle mémoire. » Il tourne, mais
    HAProxy le garde encore hors du lot (drain ou maint) : remettez-le (set
    server … state ready).
sick-server-event-end =
    Zainab : « Plus de pages d'erreur, et le technicien dit que web2 se porte
    bien. Teodor répare les connexions de web3 à sa base. »

    Bravo ! Vous avez terminé Le Serveur malade.

    CE QUI S'EST PASSÉ
    L'application de web3 a perdu ses connexions à sa base et répondait 500
    à chaque requête, mais HAProxy n'avait aucune vérification de santé : il
    continuait d'envoyer à web3 un tiers des donneur·ses. Vous avez ajouté
    une vérification HTTP de /health sur les deux répartiteurs : web3 est
    passé DOWN et ne reçoit plus de trafic. Puis vous avez sorti web2 du lot
    par l'API d'exécution de HAProxy, attendu la fin de ses sessions,
    laissé le technicien travailler, et remis web2, sans toucher à la
    configuration.

    BONNES PRATIQUES
    - Une vérification de santé doit interroger l'application, pas
      seulement son port : option httpchk sur une page qui vérifie ce dont
      l'application a besoin (ici, sa base).
    - fall et rise évitent le yo-yo : un serveur sort du lot après quelques
      échecs et revient après quelques réussites.
    - Gardez les configurations des répartiteurs identiques (diff, ou mieux :
      la gestion de configuration).
    - Maintenance : drainer (plus de nouvelles requêtes), attendre que scur
      tombe à 0, puis arrêter. L'API d'exécution change l'état en marche ;
      le fichier reste la référence. Un rechargement repart du fichier.

    DOCUMENTATION
    - Manuel de configuration de HAProxy (option httpchk, http-check,
      server) : https://docs.haproxy.org/3.0/configuration.html
    - Guide d'administration de HAProxy (l'API d'exécution) : https://docs.haproxy.org/3.0/management.html
    - socat : http://www.dest-unreach.org/socat/doc/socat.html
