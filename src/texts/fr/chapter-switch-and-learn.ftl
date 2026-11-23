### Histoire « Le Refuge », chapitre « Basculer et apprendre » : le
### pare-feu d'abri, une vérification depuis l'extérieur, www basculé dans
### la zone (numéro de série, rndc reload, TTL), le retour d'expérience
### sans reproche, et le prochain exercice de restauration programmé.
### Le dernier chapitre de la série : son bilan referme l'arc.
### Les commandes, options, chemins et sorties ne se traduisent pas.

chapter-switch-and-learn = Basculer et apprendre
    .summary = Le site tourne de nouveau sur la machine de secours, mais le monde demande encore l'adresse du serveur noyé. Ouvrez le passage, vérifiez-le depuis l'extérieur, pointez le nom vers la nouvelle machine, et regardez l'ancienne réponse s'effacer. Puis les deux lignes du plan que tout le monde saute : le retour d'expérience, et le prochain exercice.

## Fichiers

switch-and-learn-message-teuila =
    De : Teuila
    Vendredi 14 novembre, 13 h 10

    abri marche de l'intérieur : Mirela y a parcouru les pages des animaux.
    Maintenant, le monde. Les visiteur·ses demandent toujours
    www.hillsideshelters.example et reçoivent l'adresse des Coteaux, qui
    est sous l'eau.

    Le routeur de la Rivière fait déjà suivre son adresse publique,
    203.0.113.163, port 80, vers abri (Wiremu l'a fait à midi). prairie est
    notre serveur DNS primaire caché pour la zone (/etc/bind), le serveur
    du registraire la recopie. Le plan de Dariusz nous a fait baisser le
    TTL de www à cinq minutes il y a quinze jours : la bascule devrait être
    rapide.

    Puis les deux dernières lignes du plan, celles que personne ne fait :
    - le retour d'expérience, dans retour.md ici (le modèle est prêt). Pas
      de nom à blâmer : ce qui s'est passé, ce qui a aidé, ce qu'il faut
      changer, et qui fait quoi ensuite.
    - le prochain exercice de restauration : Mirela a commencé un script,
      /usr/local/sbin/restore-drill. Il doit vraiment restaurer et
      vérifier, et tourner tout seul, chaque mois. Sa clé est dans
      /root/.restic-drill.

    Teuila

switch-and-learn-review-template =
    # Retour d'expérience : l'inondation des Coteaux, 14 novembre 2031

    <!-- Sans reproche : décrire ce qui s'est passé et pourquoi, pas qui est en faute. -->

    ## Résumé

    (à compléter)

    ## Chronologie

    <!-- Les heures, d'après les journaux : /var/log/sitewatch.log de prairie, les instantanés restic, le journal de named. -->
    (à compléter)

    ## Impact

    (à compléter)

    ## Ce qui a bien marché

    (à compléter)

    ## Ce qu'il faut améliorer

    (à compléter)

    ## Actions

    <!-- Une par ligne, chacune avec sa ou son responsable : Teuila, Mirela, Rahel, Wiremu, ou vous. -->
    (à compléter)

switch-and-learn-section-summary = Résumé
switch-and-learn-section-timeline = Chronologie
switch-and-learn-section-impact = Impact
switch-and-learn-section-went-well = Ce qui a bien marché
switch-and-learn-section-improve = Ce qu'il faut améliorer
switch-and-learn-section-actions = Actions
switch-and-learn-placeholder = (à compléter)
# Une expression régulière : les mots qui désignent un·e coupable.
switch-and-learn-blame-words = \b(faute|fautif|fautive|blâme|blâmer|coupable|négligent|négligente|négligence|stupide|incompétent|incompétente|aurait dû savoir)\b
# Une expression régulière : les personnes qui peuvent porter une action.
switch-and-learn-owners = \b(Teuila|Mirela|Rahel|Wiremu|vous|moi)\b

## Événements

switch-and-learn-event-outside-closed =
    Pas de réponse d'abri sur le port 80, depuis l'extérieur : le routeur
    fait suivre le port, mais le pare-feu d'abri le jette (Wiremu a activé
    ufw ce matin, avec ssh seulement). Basculer le nom maintenant enverrait
    chaque visiteur·se dans ce mur.
switch-and-learn-event-opened =
    Le pare-feu d'abri laisse entrer le web (port 80). Vérifiez depuis ici,
    par l'adresse publique de la Rivière, avant de toucher au nom.
switch-and-learn-event-outside =
    Depuis prairie, hors des deux refuges, l'adresse publique de la Rivière
    répond avec le site des refuges : abri est prêt pour le monde.
    Maintenant, le nom.
switch-and-learn-event-dark-switch =
    www pointe maintenant vers la Rivière, mais les visiteur·ses ne
    reçoivent rien : abri ne répond pas encore de l'extérieur (son
    pare-feu, ou nginx). Dans une vraie bascule, l'ordre est : ça marche
    d'abord de l'extérieur, puis le nom.
switch-and-learn-event-serial =
    named a chargé la nouvelle adresse, mais le serveur du registraire sert
    toujours l'ancienne : le numéro de série du SOA n'a pas augmenté, donc
    le secondaire ne recopie pas la zone (journalctl -u named le dit).
    Augmentez-le, et relancez rndc reload.
switch-and-learn-event-zone =
    named, sur prairie, sert la nouvelle adresse de www.
switch-and-learn-event-switched =
    Le serveur du registraire répond 203.0.113.163 pour www : les
    visiteur·ses qui demandent maintenant arrivent sur abri. Celles et ceux
    dont le résolveur se souvient de l'ancienne réponse suivent dans la
    limite de son TTL : cinq minutes, grâce au plan.
switch-and-learn-event-cache =
    Toujours l'ancienne adresse : le résolveur répond depuis son cache tant
    que le TTL qu'on lui a donné n'est pas écoulé (dig montre les secondes
    restantes). Interrogez directement le serveur du registraire (dig
    @ns1.registrar.example) pour voir ce qu'il sert maintenant ; le
    résolveur suit dans les cinq minutes.
switch-and-learn-event-resolver =
    Le résolveur public donne lui aussi la nouvelle adresse : l'ancienne
    réponse a expiré. Tout le monde arrive sur abri maintenant.
switch-and-learn-event-blame =
    Le retour d'expérience désigne quelqu'un. Un retour sans reproche décrit
    ce que le système et l'organisation ont permis, pour que chacun·e
    raconte tout la prochaine fois : écrivez ce qui s'est passé, pas la
    faute de qui.
switch-and-learn-event-no-owners =
    Chaque action a besoin d'un·e responsable (Teuila, Mirela, Rahel,
    Wiremu, ou vous), une action par ligne : une action que personne ne
    porte est un vœu.
switch-and-learn-event-no-timeline =
    La chronologie a besoin des heures des journaux : quand le site est
    tombé ({ $time }, la première vérification ratée dans sitewatch.log),
    et au moins deux autres (la dernière sauvegarde, la bascule…).
switch-and-learn-event-review =
    Le retour d'expérience est écrit : ce qui s'est passé, son impact, ce
    qui a aidé, ce qu'il faut changer, et qui fait quoi.
switch-and-learn-event-drill-list-only =
    L'exercice, lancé comme il le sera, ne fait que lister les instantanés :
    cela prouve que le dépôt s'ouvre, pas qu'une sauvegarde revient. Un
    exercice restaure (à côté : --target), puis vérifie ce qui est revenu.
switch-and-learn-event-drill-over-root =
    L'exercice restaure par-dessus / : sur prairie, il écrirait le /etc
    d'enclos par-dessus celui de prairie. Restaurez à côté, dans un
    répertoire de travail.
switch-and-learn-event-drill-unchecked =
    L'exercice restaure, mais ne vérifie pas ce qui est revenu : le SHA-256
    du dump est dans shelter.sha256, à côté de lui (sha256sum -c, depuis ce
    répertoire).
switch-and-learn-event-drill-failed =
    La tâche tourne, mais restic n'est jamais allé au bout : lisez ce
    qu'il affiche (lancez le script à la main, en root).
switch-and-learn-event-drill =
    L'exercice, lancé comme cron ou la minuterie le lanceront, restaure le
    dernier instantané à côté et vérifie le dump avec son SHA-256.
switch-and-learn-event-end =
    Teuila : « Le site est revenu, le retour d'expérience est sur la table
    du bureau, et le prochain exercice est dans le calendrier. Merci.
    Vraiment. »

    Bravo ! Vous avez terminé Le Refuge, et avec lui la dernière histoire
    des Quêtes de Sysadmin.

    CE QUI S'EST PASSÉ
    abri servait le site de l'intérieur ; vous avez ouvert son pare-feu au
    web et vérifié depuis l'extérieur avant de toucher au nom. Puis www a
    changé dans la zone, avec un numéro de série augmenté pour que le
    serveur du registraire suive, et le TTL de cinq minutes baissé à
    l'avance a laissé l'ancienne réponse s'effacer vite. Le retour
    d'expérience raconte la nuit sans reproche, avec des actions et leurs
    responsables, et le prochain exercice restaurera et vérifiera tout seul,
    chaque mois.

    BONNES PRATIQUES
    - Basculer en dernier : le nouveau service marche d'abord depuis
      l'extérieur, puis le nom bouge.
    - Baisser le TTL bien avant d'en avoir besoin (des jours, pas des
      minutes) : c'est l'ancien TTL que les caches retiennent.
    - Un changement de zone demande un numéro de série plus grand, sinon
      les secondaires gardent l'ancienne zone.
    - Un retour d'expérience sans reproche : une chronologie tirée des
      journaux, l'impact, ce qui a aidé, ce qu'il faut changer, des actions
      avec un·e responsable et une date.
    - Un exercice qui ne restaure pas ne teste rien : restaurer à côté,
      vérifier (sommes de contrôle, nombres de lignes), chronométrer, et
      noter le résultat dans le plan.
    - Le plan est un document vivant : chaque nouveau service, chaque
      exercice, chaque incident le change.

    Depuis la première commande de l'Effaceur, vous avez listé des fichiers,
    lu des journaux, ouvert des ports et refermé d'autres, signé, chiffré,
    restauré. Cette dernière nuit a tout rassemblé : un plan, les
    sauvegardes qu'il promettait, une reconstruction dans le bon ordre, une
    bascule calme, et les leçons écrites pour la personne d'après. C'est
    cela, le métier, plus qu'aucune commande. Gardez vos plans vrais,
    continuez les exercices, et soyez bienveillant·es dans vos retours.
    Merci d'avoir joué.

    DOCUMENTATION
    - NIST SP 800-34 Rev. 1 (tests, exercices et maintien du plan) : https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - BIND 9, fichiers de zone et numéro de série du SOA : https://bind9.readthedocs.io/en/stable/chapter3.html
    - RFC 1034, cache et TTL : https://www.rfc-editor.org/rfc/rfc1034#section-4.3.5
    - ufw : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - Livre SRE de Google, la culture du post-mortem : https://sre.google/sre-book/postmortem-culture/
    - restic, restaurer : https://restic.readthedocs.io/en/stable/050_restore.html
