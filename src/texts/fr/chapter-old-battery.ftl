### Histoire « Le Mur d'escalade », chapitre « Vieille Batterie » : une
### batterie usée, son test rapide (upscmd, instcmds dans upsd.users), la
### date d'une nouvelle cartouche (upsrw battery.mfr.date), des alertes avec
### upssched (NOTIFYCMD, AT … START-TIMER, CANCEL-TIMER). Commandes,
### options, chemins, lignes de configuration et sorties ne sont pas
### traduits.

chapter-old-battery = Vieille Batterie
    .summary = Deux mois après la tempête, l'onduleur promet dix minutes de batterie au lieu de cinquante, et la boîte de l'accueil se noie sous les « UPS: ONBATT » chaque fois que les ventilateurs démarrent. Testez la batterie sans la vider, faites-en poser une neuve, et apprenez aux alertes à distinguer un clignement d'une coupure.

## Fichiers

old-battery-message-thandiwe =
    De : Thandiwe (accueil, le Dévers)
    Lundi 17 janvier, 10 h 20

    Bonjour,

    Deux choses, et c'est peut-être la même.

    1. Ma boîte mail. Chaque fois que les gros ventilateurs de la salle de
       bloc démarrent, la lumière clignote et je reçois deux mails :
       « UPS: ONBATT », puis « UPS: ONLINE ». 38 rien que samedi. J'ai
       commencé à les ignorer, ce qui n'est sûrement pas le but. Pourrait-on
       recevoir un mail seulement quand le courant est vraiment coupé ? (Ils
       vont à « volunteers », c'est-à-dire moi : /var/mail/thandiwe sur
       relais.)

    2. Ikaika a lu l'écran de l'onduleur ce matin : il annonce une dizaine
       de minutes de batterie. En novembre c'était presque une heure. Les
       notes d'Haruto disent que la batterie date de 2028. Ikaika a une
       cartouche de rechange au bureau (une APC RBC, elle se change
       onduleur allumé) mais il voudrait une preuve avant d'ouvrir quoi que
       ce soit.

    La salle est ouverte (le cours de 10 h est sur les murs), donc rien qui
    coupe le courant, s'il vous plaît ! Haruto a laissé un compte admin dans
    upsd.users pour ce genre de choses ; son mot de passe est dans le
    fichier.

    Thandiwe

## Événements

old-battery-event-runtime =
    battery.runtime est en secondes : dix minutes à la charge d'aujourd'hui,
    pour une batterie qui en donnait cinquante en novembre. ups.test.result
    dit quand l'onduleur s'est testé pour la dernière fois. Un test rapide
    (quelques secondes sur batterie) donne l'état de la batterie sans la
    vider : upscmd -l hallups liste ce que sait faire l'onduleur.

old-battery-event-flapping =
    Encore une paire de mails dans la boîte de Thandiwe : le courant a
    clignoté quelques secondes, upsmon a vu ONBATT puis ONLINE, et
    NOTIFYCMD a envoyé les deux. upsmon envoie chaque événement tout de
    suite ; pour attendre de voir si un événement dure, upsmon le confie à
    upssched (man upssched).

old-battery-event-denied =
    upsd a refusé : une commande instantanée demande un compte autorisé à
    la lancer. Dans upsd.users, instcmds liste les commandes qu'un compte
    peut lancer (ou ALL) ; actions = SET ne sert qu'à changer des
    variables. upsd relit upsd.users à un reload.

old-battery-event-deep =
    Un test profond est un étalonnage : l'onduleur fait tourner la salle sur
    sa batterie jusqu'à ce qu'elle soit presque vide. Salle ouverte et
    batterie usée, une vraie coupure pendant ce temps ne laisserait rien.
    Arrêtez-le (test.battery.stop) et gardez les tests profonds pour les
    heures de fermeture, avec une batterie saine.

old-battery-event-warning =
    « Done and warning », et ups.status montre maintenant RB : l'onduleur
    réclame une batterie neuve. Ikaika, ravi d'avoir sa preuve, change la
    cartouche onduleur allumé (« clic, clic : c'est fait »). La neuve est
    chargée à 92 %. L'onduleur croit toujours que sa batterie date de 2028
    (battery.mfr.date) : cette date s'écrit sur ce modèle (upsrw -l
    hallups). L'étiquette de la cartouche indique 2032/12/02.

old-battery-event-date =
    battery.mfr.date est celle de la nouvelle cartouche : la prochaine
    personne qui lira upsc saura l'âge de la batterie.

old-battery-event-passed =
    Le test rapide passe avec la batterie neuve : « Done and passed », RB a
    disparu, battery.runtime revient à une cinquantaine de minutes.

old-battery-event-sched-error =
    NOTIFYCMD est upssched, mais upssched.conf l'arrête : il lui faut
    CMDSCRIPT, PIPEFN et LOCKFN avant sa première ligne AT (journalctl -u
    nut-monitor : « must be set before any ATs »).

old-battery-event-silenced =
    Maintenant même une vraie coupure n'enverrait de mail à personne : les
    alertes sont réduites au silence au lieu d'être triées. Une coupure qui
    dure doit toujours prévenir les bénévoles.

old-battery-event-still-flapping =
    Un clignement de quelques secondes envoie encore un mail : quelque chose
    tourne à chaque ONBATT ou à chaque ONLINE. Une minuterie lancée sur
    ONBATT et annulée sur ONLINE ne se déclenche que si le courant reste
    coupé (la commande facultative de CANCEL-TIMER ne tourne que si la
    minuterie s'était déjà déclenchée).

old-battery-event-alerts =
    Les alertes sont triées : un clignement de quelques secondes lance la
    minuterie d'upssched et ONLINE l'annule, en silence ; une coupure qui
    dure la laisse se déclencher et prévient les bénévoles une fois.

old-battery-event-end =
    Thandiwe : « Pas un seul mail depuis midi, et Ikaika a mis la vieille
    cartouche dans le bac de recyclage avec le sourire. Merci ! »

    Bravo ! Vous avez terminé Vieille Batterie.

    CE QUI S'EST PASSÉ
    La batterie, de 2028 et entièrement vidée par la coupure de novembre,
    avait perdu l'essentiel de sa capacité. Un test rapide (upscmd, une fois
    que le compte admin avait instcmds dans upsd.users) a donné le verdict
    de l'onduleur, « Done and warning », et le drapeau RB. Après le
    changement, vous avez écrit la date de la batterie neuve avec upsrw et
    refait le test. Pendant ce temps, le NOTIFYCMD d'upsmon envoyait un
    mail à chaque clignement ; avec upssched, ONBATT lance une minuterie
    qu'ONLINE annule, et seule une coupure qui dure envoie un mail.

    BONNES PRATIQUES
    - Tester la batterie régulièrement avec le test rapide, aux heures
      calmes : il donne son état en quelques secondes. Garder les tests
      profonds (étalonnage) pour les heures de fermeture, batterie saine.
    - Les batteries au plomb des onduleurs durent trois à cinq ans, moins
      après des décharges profondes : noter la date quand on en change
      (battery.mfr.date ou battery.date, là où l'onduleur le permet), et
      prévoir la suivante.
    - Ne donner aux comptes que ce qu'il leur faut : instcmds pour les
      tests, actions = SET pour les variables, rien pour qui lit upsc.
    - Une alerte doit vouloir dire quelque chose : attendre (les minuteries
      d'upssched) avant d'écrire pour un état qui peut durer quelques
      secondes ; ne jamais tout faire taire.
    - REPLBATT (RB) mérite aussi un mail : AT REPLBATT * EXECUTE replbatt.

    DOCUMENTATION
    - upscmd(8) : https://networkupstools.org/docs/man/upscmd.html
    - upsrw(8) : https://networkupstools.org/docs/man/upsrw.html
    - upssched(8) : https://networkupstools.org/docs/man/upssched.html
    - upssched.conf(5) : https://networkupstools.org/docs/man/upssched.conf.html
    - Notifications et minuteries : https://networkupstools.org/docs/user-manual.chunked/Advanced_usage_scheduling_notes.html
    - upsd.users(5) : https://networkupstools.org/docs/man/upsd.users.html
