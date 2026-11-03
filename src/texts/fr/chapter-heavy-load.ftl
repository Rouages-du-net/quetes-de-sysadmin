### Histoire « L'Observatoire », chapitre 1 « Grosse charge » : la charge
### moyenne, top, nice et renice. Les commandes, les chemins et les sorties
### des outils ne sont pas traduits.

chapter-heavy-load = Grosse charge
    .summary = La galerie du club met cinq secondes par page depuis que Jules a lancé l'empilement des photos de la nuit. Rends-la rapide sans arrêter son travail.

## Fichiers

heavy-load-message-amara =
    De :     Amara
    À :      toi
    Objet :  La galerie rame

    Bonjour,

    Je suis absente jusqu'à dimanche (enfin du ciel dégagé !), et les
    membres du club m'écrivent que la galerie met une éternité à s'ouvrir
    ce matin. Cette nuit, c'était le pic des Géminides : Jules a lancé
    l'empilement de ses photos sur le serveur à 6 h, depuis sa session.

    Surtout, n'arrête pas son empilement : il tourne depuis trois heures,
    et il repartirait de zéro. Rends juste la galerie utilisable pendant
    qu'il finit.

    Pour chronométrer la galerie, je fais :
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/
    D'habitude, elle répond en 0,25 s environ.

    Ton mot de passe sudo : nebuleuse-2028.

    Amara

## Évènements

heavy-load-event-load =
    La charge moyenne (load average) : combien de processus, en moyenne
    sur 1, 5 et 15 minutes, tournent ou attendent un processeur. À
    comparer au nombre de processeurs (nproc) : au-delà, certains
    attendent leur tour.
heavy-load-event-workers =
    stack-worker, huit fois, chacun à 22 % d'un processeur environ :
    l'empilement de Jules (stack-night) a lancé huit processus de calcul,
    sur une machine qui a deux processeurs. La galerie (node) reçoit la
    même part que chacun d'eux : un neuvième de la machine, alors qu'il
    lui faut un processeur entier.
heavy-load-event-parent-only =
    Le parent, stack-night, a maintenant une valeur nice ; ses huit
    processus de calcul ont gardé la leur (regarde la colonne NI de top,
    ou ps -o pid,ni,comm). La valeur nice appartient à chaque processus :
    les enfants déjà lancés ne suivent pas. Et le parent ne fait
    qu'attendre : ce sont les workers qui calculent.
heavy-load-event-some-workers =
    Une partie des workers a une valeur nice, pas tous : ceux restés à 0
    gardent leur pleine part, et la galerie attend toujours. renice
    accepte plusieurs PID, ou tous les processus d'un compte (man renice :
    -u).
heavy-load-event-killed =
    Une partie de l'empilement a disparu. Jules : « Trois heures de
    calcul… il faudra tout reprendre ce soir. » C'est ce qu'Amara voulait
    éviter : pour réessayer, utilise « Recommencer ce chapitre », sous le
    terminal.
heavy-load-event-gallery-stopped =
    La galerie est arrêtée : les membres n'ont plus de page du tout.
    Relance-la (sudo systemctl start gallery).
heavy-load-event-end =
    La galerie répond de nouveau en un quart de seconde, et l'empilement
    continue. Jules : « Ah, ça a pris un peu plus longtemps, mais personne
    n'a rien vu ! »

    Bravo ! Tu as terminé le chapitre « Grosse charge ».

    CE QUI S'EST PASSÉ
    La machine a deux processeurs. L'empilement de Jules a lancé huit
    processus de calcul, qui veulent chacun un processeur : avec la
    galerie, neuf processus pour deux processeurs. La charge le disait
    (environ 9 pour 2 processeurs), et l'ordonnanceur donnait à chacun la
    même part : la galerie recevait 0,2 processeur au lieu de 1, et ses
    requêtes faisaient la queue.

    CE QUE CHANGE NICE
    La valeur nice va de -20 (servi en premier) à 19 (servi en dernier).
    L'ordonnanceur partage le processeur selon un poids qui baisse
    d'environ 25 % à chaque cran : à nice 19, un processus pèse 15 contre
    1024 à 0. Les workers prennent toujours tout ce que personne d'autre
    ne veut : l'empilement ne ralentit que quand la galerie travaille.
    La charge n'a pas baissé : elle compte les processus qui veulent
    tourner, quelle que soit leur priorité. Une charge élevée n'est pas
    un problème en soi ; un service qui attend un processeur, si.

    BONNES PRATIQUES
    - Comparer la charge à nproc, puis chercher qui prend le processeur :
      top (trié par %CPU), ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Lancer les longs calculs déjà « gentils » : nice -n 19 stack-night…
    - renice -n 19 -u COMPTE atteint tous les processus d'un compte ; sur
      un PID, seulement ce processus (ses enfants gardent leur valeur).
    - Seul root peut baisser une valeur nice (donner plus de priorité).

    DOCUMENTATION
    - renice : https://man7.org/linux/man-pages/man1/renice.1.html
    - L'ordonnanceur et nice : https://man7.org/linux/man-pages/man7/sched.7.html
    - La charge moyenne : https://man7.org/linux/man-pages/man5/proc_loadavg.5.html
heavy-load-event-end-gallery =
    La galerie répond de nouveau en un quart de seconde, et l'empilement
    continue : tu as donné plus de priorité à la galerie (une valeur nice
    négative, que seul root peut donner). Ça marche ; l'usage est plutôt
    l'inverse : baisser la priorité du calcul (renice -n 19 sur les
    workers), pour que tous les services de la machine passent avant lui.

    Bravo ! Tu as terminé le chapitre « Grosse charge ».

    CE QUI S'EST PASSÉ
    La machine a deux processeurs. L'empilement de Jules a lancé huit
    processus de calcul, qui veulent chacun un processeur : avec la
    galerie, neuf processus pour deux processeurs. La charge le disait
    (environ 9 pour 2 processeurs), et l'ordonnanceur donnait à chacun la
    même part : la galerie recevait 0,2 processeur au lieu de 1.

    CE QUE CHANGE NICE
    La valeur nice va de -20 (servi en premier) à 19 (servi en dernier).
    L'ordonnanceur partage le processeur selon un poids qui change
    d'environ 25 % à chaque cran. La charge n'a pas baissé : elle compte
    les processus qui veulent tourner, quelle que soit leur priorité.

    BONNES PRATIQUES
    - Comparer la charge à nproc, puis chercher qui prend le processeur :
      top, ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Lancer les longs calculs déjà « gentils » : nice -n 19 stack-night…
    - renice -n 19 -u COMPTE atteint tous les processus d'un compte.

    DOCUMENTATION
    - renice : https://man7.org/linux/man-pages/man1/renice.1.html
    - L'ordonnanceur et nice : https://man7.org/linux/man-pages/man7/sched.7.html
