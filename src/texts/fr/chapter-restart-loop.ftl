### Histoire « La Cantine », chapitre 2 « La boucle » : Restart=,
### RestartSec=, la limite de démarrages, PartOf=. Les noms d'unités, les
### chemins et les messages de systemd ne se traduisent pas.

chapter-restart-loop = La boucle
    .summary = Restart=always devait relancer l'appli toute seule : cette nuit, il a abandonné au bout d'une demi-seconde. Fais-la survivre aux redémarrages de PostgreSQL.

## Fichiers

restart-loop-message-ibrahim =
    De :      Ibrahim
    À :       toi
    Objet :   Restart=always n'a servi à rien

    Bonjour,

    Depuis ta correction, les redémarrages se passent bien. Mais cette nuit,
    les mises à jour automatiques ont mis à jour PostgreSQL (elles le
    redémarrent quand elles le font), et ce matin les réservations étaient de
    nouveau en panne.

    J'avais lu que Restart=always fait relancer par systemd un service qui
    meurt, alors je l'avais ajouté dans /etc/systemd/system/menu.service il y
    a quelques jours. Apparemment systemd a bien essayé… puis abandonné ? Je
    ne comprends pas le journal.

    Les mises à jour redémarreront encore PostgreSQL : peux-tu faire en sorte
    que l'appli s'en remette toute seule ? Pour tester, tu peux faire comme
    les mises à jour : sudo systemctl restart postgresql. Les réservations
    doivent revenir sans que personne ne démarre l'appli à la main. Même mot
    de passe sudo : lentilles-2028.

    Ibrahim

## Événements

restart-loop-event-limit =
    « Start request repeated too quickly », Result: start-limit-hit. Quand
    PostgreSQL a redémarré, l'appli a perdu sa connexion et s'est arrêtée ;
    Restart= l'a relancée après RestartSec=, 100 ms par défaut… pendant que
    PostgreSQL redémarrait encore. Cinq échecs en une demi-seconde : au-delà
    de la limite de démarrages (5 en 10 s par défaut), systemd abandonne.
    Regarde les heures dans journalctl -u menu.
restart-loop-event-too-often =
    « start of the service was attempted too often » : systemd compte les
    démarrages, même les vôtres, et refuse tant que la limite est atteinte.
    Une fois la cause corrigée, sudo systemctl reset-failed menu oublie les
    échecs (systemctl start remarche aussi au bout de
    StartLimitIntervalSec=).
restart-loop-event-again =
    Même boucle : PostgreSQL a redémarré, l'appli est morte, est revenue cinq
    fois trop tôt, et systemd a encore abandonné. Tant que l'appli redémarre
    avant le retour de la base, Restart= seul n'y peut rien. Soit laisser le
    temps à PostgreSQL (RestartSec=), soit attacher l'appli à PostgreSQL
    pour qu'elle s'arrête et redémarre avec lui (man systemd.unit : PartOf=).
restart-loop-event-binds-to =
    BindsTo= a bien arrêté l'appli avec PostgreSQL, proprement cette fois.
    Mais rien ne l'a redémarrée : BindsTo= propage l'arrêt, pas le
    démarrage. Pour « redémarrer avec lui », c'est PartOf= (avec After=,
    pour revenir après lui).
restart-loop-event-end =
    PostgreSQL a redémarré, et l'appli est revenue toute seule, après lui.
    Ibrahim : « La cuisine ne s'est même rendu compte de rien. Je laisse
    tourner les mises à jour cette nuit. »

    Bravo ! Tu as terminé le chapitre « La boucle ».

    CE QUI S'EST PASSÉ
    Quand PostgreSQL redémarre, l'appli perd sa connexion et s'arrête en
    échec. Restart=always faisait relancer l'appli par systemd après
    RestartSec=, 100 ms par défaut : cinq fois en une demi-seconde, pendant
    que la base redémarrait encore. Au-delà de StartLimitBurst= démarrages
    (5) en StartLimitIntervalSec= (10 s), systemd arrête d'essayer :
    Result: start-limit-hit, et l'appli est restée arrêtée jusqu'au matin.

    DEUX SORTIES
    - PartOf=postgresql.service (avec After=) : quand PostgreSQL s'arrête ou
      redémarre, systemd arrête d'abord l'appli, puis la redémarre après la
      base. Aucun échec du tout.
    - Restart=on-failure avec RestartSec=5s : l'appli meurt, mais systemd
      attend assez longtemps pour que PostgreSQL revienne avant de réessayer.
    - BindsTo= arrête l'appli avec PostgreSQL mais ne la ramène pas.

    BONNES PRATIQUES
    - Restart=on-failure plutôt que always (un arrêt propre n'est pas un
      échec), et un RestartSec= de quelques secondes : une boucle de
      relances instantanées ne fait que remplir le journal.
    - Après un start-limit-hit : corriger la cause, puis systemctl
      reset-failed et systemctl start.
    - Tester ce qui se passera la nuit en le faisant de jour :
      sudo systemctl restart postgresql, puis systemctl status menu.

    DOCUMENTATION
    - Restart=, RestartSec= : https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=
    - StartLimitIntervalSec=, StartLimitBurst=, PartOf=, BindsTo= : https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
