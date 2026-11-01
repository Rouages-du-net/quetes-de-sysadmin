### Histoire « La Cantine », chapitre 1 « L'ordre de démarrage » : l'appli
### démarre avant sa base de données (After=, Requires=, Wants=). Les noms
### d'unités, les chemins et les messages de systemd ne se traduisent pas.

chapter-boot-order = L'ordre de démarrage
    .summary = Après une coupure de courant, le serveur de la cantine redémarre, mais pas son appli de réservations : elle démarre avant sa base de données. Apprends l'ordre à systemd.

## Fichiers

boot-order-message-ibrahim =
    De :      Ibrahim
    À :       toi
    Objet :   Les réservations sont encore en panne

    Bonjour,

    Ce matin, il y a eu une coupure de courant dans le quartier. Le
    serveur a redémarré tout seul, mais pas les réservations : l'appli du
    menu (le service menu) est « failed ». Les bénévoles en cuisine ne
    voient pas qui vient déjeuner.

    La dernière fois, j'avais juste fait sudo systemctl start menu et ça
    marchait. Mais après chaque redémarrage, c'est la même histoire, et je
    ne suis pas toujours là. Le fichier d'unité, je l'ai écrit moi-même,
    /etc/systemd/system/menu.service, en suivant un tutoriel : ça marche
    quand je le démarre à la main, donc il ne doit pas être si mal ?

    Peux-tu faire en sorte que les réservations reviennent toutes seules
    après un redémarrage ? Tu peux redémarrer le serveur pour vérifier
    (sudo reboot) : personne ne réserve à cette heure-ci. Ton mot de passe
    sudo est lentilles-2028.

    Merci !
    Ibrahim

## Événements

boot-order-event-refused =
    « connect ECONNREFUSED 127.0.0.1:5432 » : l'appli a frappé à la porte de
    PostgreSQL (le port 5432)… et personne n'a répondu. Pourtant postgresql
    tourne maintenant. Regarde le journal de ce démarrage, unité par unité
    et dans l'ordre du temps (journalctl -b) : qui a démarré le premier ? Et
    que dit le fichier d'unité au sujet de la base ? (systemctl cat menu)
boot-order-event-by-hand =
    L'appli tourne à nouveau, démarrée à la main : la cuisine peut prendre
    les réservations. Mais rien n'a changé dans son unité : au prochain
    redémarrage, elle démarrera dans le même ordre que ce matin. Corrige la
    cause, puis redémarre pour vérifier (sudo reboot).
boot-order-event-wrong-name =
    Attention au nom : systemd connaît postgresql.service, pas
    postgres.service. Un After= ou un Wants= vers une unité qui n'existe pas
    est ignoré sans un mot (systemctl list-dependencies menu,
    systemd-analyze verify menu.service).
boot-order-event-requires-only =
    Toujours en échec après le redémarrage, même avec la dépendance déclarée.
    Requires= (ou Wants=) dit « démarre aussi PostgreSQL », pas « démarre-le
    d'abord » : les deux démarrent en même temps, et l'appli arrive encore
    trop tôt. L'ordre, c'est une autre ligne : After= (man systemd.unit).
boot-order-event-order =
    systemd sait maintenant que l'appli démarre après PostgreSQL (systemctl
    list-dependencies --after menu). Un redémarrage dira si ça suffit :
    sudo reboot, puis regarde les services.
boot-order-event-end =
    Après le redémarrage, PostgreSQL a démarré en premier, puis l'appli, puis
    nginx : tout est là sans que personne n'y touche. Ibrahim : « C'est donc
    à ça que sert After= ! Je l'ajoute à mon tutoriel. »

    Bravo ! Tu as terminé le chapitre « L'ordre de démarrage ».

    CE QUI S'EST PASSÉ
    Au démarrage, systemd lance les services activés en parallèle, aussi vite
    qu'il peut. Rien dans l'unité d'Ibrahim ne disait que l'appli avait
    besoin de la base : l'appli a démarré en même temps que PostgreSQL, a
    voulu s'y connecter avant qu'il soit prêt, et s'est arrêtée. Démarrée à
    la main plus tard, elle trouvait la base en route : « ça marche à la
    main », mais pas au démarrage.

    DÉPENDANCE OU ORDRE : DEUX CHOSES DIFFÉRENTES
    - Requires=postgresql.service : démarre aussi PostgreSQL, et s'il échoue,
      ne démarre pas l'appli. Wants= en est la version souple (le démarrer,
      mais continuer s'il échoue).
    - After=postgresql.service : si les deux démarrent, démarre PostgreSQL
      d'abord, et attends qu'il soit prêt.
    - Seuls, Requires= ou Wants= démarrent les deux en même temps ; seul,
      After= ordonne mais n'entraîne rien. La paire habituelle :
      After= + Requires= (ou Wants=).

    BONNES PRATIQUES
    - Mettre le changement dans une surcharge (sudo systemctl edit menu) ou
      dans le fichier d'unité, puis sudo systemctl daemon-reload ; vérifier
      avec systemctl cat menu et systemctl list-dependencies menu.
    - systemd-analyze verify menu.service repère les fautes de frappe (clés
      inconnues, unités qui n'existent pas).
    - Un service qui « marche à la main » ne prouve rien pour le prochain
      démarrage : le seul test, c'est un redémarrage (à un moment calme), puis
      systemctl --failed.
    - Le programme gagne aussi à être patient : une appli qui réessaie sa
      base pendant quelques secondes survit à un démarrage lent.

    DOCUMENTATION
    - systemd.unit, After= et Requires= : https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - systemctl (cat, list-dependencies, edit) : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
