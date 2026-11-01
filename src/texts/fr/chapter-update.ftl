### Histoire « La Fabrique », chapitre 1 « La mise à jour » : Docker,
### conteneurs et volumes. Les commandes, chemins, noms d'images et
### messages de docker et de l'outilthèque (en anglais) ne se traduisent pas.

chapter-update = La mise à jour
    .summary = Mettre à jour une appli dans Docker sans perdre ses données : couche du conteneur, docker cp, volumes, --restart.

## Fichiers

update-message-yasmine =
    Un message de Yasmine, qui fait tourner le fablab :

    « Bonjour ! Ici, on prête des outils aux habitant·es du quartier, et on
    note tout dans l'outilthèque, une petite appli web. Je l'ai installée
    il y a deux semaines avec Docker, en suivant le mode d'emploi :

      docker run -d --name outiltheque -p 8080:8080 registry.example/outiltheque:1.4

    La version 1.5 vient de sortir (elle corrige un bug des dates de
    retour). Tu peux mettre à jour ? Surtout, ne perds pas les 37 prêts en
    cours : je n'ai rien d'autre que l'appli pour savoir qui a quoi !

    Autre chose : après la coupure de courant de mercredi, l'outilthèque
    n'est pas revenue toute seule, j'ai dû la relancer.

    Pour sudo, ton mot de passe est : fablab-2027
    Mes notes sont dans notes_docker.txt. »
update-notes-docker =
    NOTES DE YASMINE — DOCKER

      sudo docker ps -a              les conteneurs (même arrêtés)
      sudo docker logs outiltheque   ce que l'appli raconte
      curl http://localhost:8080     l'appli, comme dans un navigateur

    « Mettre à jour un conteneur » : on ne le met pas à jour, on le
    remplace par un neuf, créé avec la nouvelle image. Le reste est dans
    man docker (et la doc de l'outilthèque dit qu'elle range sa base dans
    /var/lib/outiltheque).
update-tools = perceuse, scie sauteuse, ponceuse, escabeau, visseuse, fer à souder, niveau laser, agrafeuse, décolleuse, tondeuse, machine à coudre, scie circulaire
update-people = Aya, Bilal, Chloé, Dmitri, Esra, Farid, Gaëlle, Hugo, Ines, Jun, Kenza, Lucas

## L'appli (pages)

update-app-welcome =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Outilthèque du fablab</title></head>
    <body>
    <h1>Outilthèque du fablab</h1>
    <p>{ $loans ->
        [0] Aucun prêt en cours.
        [one] Un prêt en cours.
       *[other] { $loans } prêts en cours.
    } <a href="/prets">Voir les prêts</a></p>
    <footer>outiltheque { $version }</footer>
    </body>
    </html>
update-app-loans = Prêts en cours : { $loans } (les cinq premiers)

## Événements

update-event-layer =
    « Mounts »: [] : ce conteneur n'a ni volume, ni dossier de la machine
    monté. Tout ce que l'appli écrit (sa base de données comprise) vit dans
    la couche du conteneur, qui disparaît avec lui. Avant de le supprimer,
    il faut mettre la base à l'abri (man docker : cp).
update-event-port-busy =
    « port is already allocated » : le port 8080 de la machine est déjà
    publié par un autre conteneur qui tourne (l'ancien). Deux conteneurs ne
    peuvent pas écouter sur le même port de la machine : il faut d'abord
    arrêter l'ancien.
update-event-lost =
    Les 37 prêts ont disparu : le conteneur a été supprimé avec sa couche,
    et la base n'avait été copiée nulle part. Sur un vrai serveur, ce
    serait perdu pour de bon. Ici, tu peux recommencer le chapitre depuis
    le menu. La règle : les données d'un conteneur vont dans un volume, et
    on les copie avant toute opération risquée.
update-event-new-empty =
    La version 1.5 tourne… avec une base toute neuve et vide (docker logs
    le dit : « creating a new one »). La base de l'ancien conteneur n'est
    pas dans le nouveau. Si tu l'as mise à l'abri, il reste à la remettre à
    sa place (et à redémarrer l'appli pour qu'elle la migre).
update-event-without-reboot =
    Les 37 prêts sont là, dans la version 1.5, et la base est enfin dans un
    volume. Mais Yasmine l'a dit : après une coupure de courant,
    l'outilthèque ne revient pas toute seule. Regarde l'option --restart de
    docker run (ou docker update).
update-event-end =
    L'outilthèque 1.5 tourne, avec ses 37 prêts, dans un volume qui
    survivra aux prochaines mises à jour, et elle repartira toute seule
    après une coupure. Yasmine : « Et la prochaine mise à jour, ce sera
    juste : nouveau conteneur, même volume ! »

    Bravo ! Tu as terminé le chapitre 1 de La Fabrique. (La suite t'attend :
    La composition.)

    CE QUI S'EST PASSÉ
    L'outilthèque avait été lancée sans volume : sa base vivait dans la
    couche du conteneur. Mettre à jour une appli dans Docker, c'est
    supprimer le conteneur et en créer un neuf ; sans précaution, la base
    partait avec l'ancien.

    LA BONNE PRATIQUE
    - Avant tout : docker inspect (les « Mounts ») pour savoir où sont les
      données.
    - Les données d'un conteneur vont dans un volume (-v nom:/chemin) ou un
      dossier de la machine (-v /srv/appli:/chemin), jamais dans sa couche.
    - Copier avant de toucher : docker cp conteneur:/chemin ./sauvegarde.
    - Arrêter l'ancien avant de lancer le nouveau sur le même port ; ne le
      supprimer qu'une fois le nouveau vérifié (docker logs, curl).
    - --restart unless-stopped : le conteneur repart avec la machine.
    - Le groupe docker vaut root : n'y mettre que des admins.

    LA DOCUMENTATION
    - Les volumes : https://docs.docker.com/engine/storage/volumes/
    - docker cp : https://docs.docker.com/reference/cli/docker/container/cp/
    - Redémarrer automatiquement : https://docs.docker.com/engine/containers/start-containers-automatically/
