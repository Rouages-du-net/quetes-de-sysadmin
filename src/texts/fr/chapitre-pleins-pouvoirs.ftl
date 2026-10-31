### Histoire « La Fabrique », chapitre 4 « Les pleins pouvoirs » : ne pas
### faire tourner un conteneur en root. Les commandes, chemins, options et
### messages de docker, chown, ls et ps ne se traduisent pas.

chapitre-pleins-pouvoirs = Les pleins pouvoirs
    .resume = La galerie photo du fablab tourne en root : --user, l'uid partagé entre le conteneur et la machine, et le dossier à donner au bon compte.

## Fichiers

pleins-pouvoirs-message-de-yasmine =
    Un message de Yasmine :

    « Salut ! Tu connais la galerie photo du fablab (port 8082) ? Les
    visiteur·ses y envoient les photos de leurs projets. Je l'ai lancée
    avec docker compose, dans /srv/galerie.

    Deux soucis. Un : je ne peux plus ajouter ni retirer de photo dans
    /srv/galerie/photos sans sudo, « Permission denied ». C'est pourtant
    notre dossier ! Deux : Rania dit que la galerie « tourne en root », et
    que c'est dangereux (son mot est à côté de ce message).

    Ce que je voudrais :
      - que la galerie ne tourne plus en root ;
      - pouvoir gérer les photos moi-même (je suis yasmine, uid 1001) ;
      - et surtout ne perdre aucune des 14 photos !

    Pour sudo : fablab-2027. »
pleins-pouvoirs-mot-de-rania =
    Un mot de Rania :

    « La galerie reçoit des fichiers envoyés par des inconnu·es : c'est
    exactement le genre de programme qu'on attaque. Si quelqu'un y trouve
    une faille, son code s'exécute avec les droits de la galerie.

    Or un conteneur n'est pas une machine à part : ses processus tournent
    sur le noyau de la machine. Root dans le conteneur, c'est le même
    uid 0 que root sur la machine, et tout ce qui est monté dans le
    conteneur est à sa merci.

    Commence par regarder qui tu es, dedans et dehors :
      sudo docker exec galerie-galerie-1 id
      ps aux
    Puis le manuel : man docker et man docker-compose. »
pleins-pouvoirs-lisezmoi =
    Galerie 3.2 — LISEZMOI (fourni avec l'image registry.example/galerie)

    Les photos vivent dans /app/photos : montez-y un dossier ou un volume.
    Au démarrage, la galerie refait l'index de ses miniatures dans
    /app/photos/.miniatures : elle doit pouvoir écrire dans /app/photos.

    L'image est construite sur node:22 et ne choisit pas d'utilisateur.
    Elle fonctionne sous n'importe quel uid, pourvu qu'il puisse écrire
    dans /app/photos.

# { $nombre } : le nombre de photos
pleins-pouvoirs-galerie-accueil = { $nombre ->
        [one] Galerie du fablab : une photo de projet. Envoie la tienne !
       *[other] Galerie du fablab : { $nombre } photos de projets. Envoie la tienne !
    }

## Événements

pleins-pouvoirs-evenement-root =
    La galerie tourne en root : uid=0 dans le conteneur, et root dans ps aux
    sur la machine, comme sshd. Son image ne déclare pas d'utilisateur (pas
    de USER), et compose.yaml non plus : par défaut, un conteneur tourne
    donc en root. Et sans espace de noms utilisateur (userns-remap,
    désactivé par défaut), l'uid 0 du conteneur EST l'uid 0 de la machine.
    C'est aussi pour cela que les fichiers de /srv/galerie/photos
    appartiennent à root. Cherche --user dans man docker, et user: dans
    man docker-compose.
pleins-pouvoirs-evenement-inconnu =
    « unable to find user » : un nom donné à --user (ou à user:) doit exister
    dans le /etc/passwd DE L'IMAGE, pas dans celui de la machine. Avec des
    numéros (uid:gid), plus de problème : le noyau ne connaît que des
    numéros.
pleins-pouvoirs-evenement-eacces =
    La galerie ne démarre plus : EACCES, permission refusée (sudo docker
    logs, ou docker compose logs). Elle ne tourne plus en root, alors les
    droits Unix de la machine s'appliquent à elle, par numéro : uid et gid.
    Or /srv/galerie/photos et ce qu'il contient appartiennent encore à root.
    Regarde ls -lan /srv/galerie/photos (-n : les numéros, -a : les fichiers
    cachés aussi). Docker la relance tout seul (restart: unless-stopped) :
    elle repartira dès qu'elle pourra écrire.
pleins-pouvoirs-evenement-uid-1000 =
    La galerie tourne sous l'uid 1000… et sur cette machine, l'uid 1000,
    c'est toi (vous) ! Dans ls -l, ses fichiers t'appartiennent : le noyau
    ne voit que des numéros, et chaque /etc/passwd leur donne son nom (node
    dans l'image, vous sur la machine). Yasmine (uid 1001), elle, ne peut
    toujours pas écrire dans le dossier des photos.
pleins-pouvoirs-evenement-ouvert-a-tous =
    Un dossier ouvert en écriture à tous (chmod 777, o+w) : ça « marche »,
    mais n'importe quel compte, n'importe quel programme de la machine peut
    alors y déposer ou y effacer des fichiers. On donne plutôt le dossier au
    bon propriétaire (chown), sans ouvrir les droits des autres.
# { $nombre } : le nombre de photos disparues
pleins-pouvoirs-evenement-photos-perdues =
    { $nombre ->
        [one] Une photo a disparu de /srv/galerie/photos. Sur un vrai serveur, sans sauvegarde, elle serait perdue.
       *[other] { $nombre } photos ont disparu de /srv/galerie/photos. Sur un vrai serveur, sans sauvegarde, elles seraient perdues.
    } Ici, tu peux recommencer le chapitre depuis le menu.
pleins-pouvoirs-evenement-fin =
    La galerie tourne sous un compte ordinaire, Yasmine gère les photos
    sans sudo, et les 14 photos sont toutes là. Rania : « Si quelqu'un perce
    la galerie, il n'aura plus que les droits d'un compte ordinaire. Pas
    ceux de root. »

    Bravo ! Tu as terminé le chapitre 4 de La Fabrique, et toute l'histoire.

    CE QUI S'EST PASSÉ
    L'image de la galerie ne déclare pas d'utilisateur : sans --user (ou
    user:), un conteneur tourne en root. Un conteneur partage le noyau de
    la machine ; sans espace de noms utilisateur, son uid 0 est l'uid 0 de
    la machine. Les fichiers qu'il écrit dans un dossier monté appartiennent
    à root, et une faille dans l'appli donnerait les droits de root sur tout
    ce qui est monté. Sous un uid ordinaire, la galerie est soumise aux
    droits Unix comme n'importe quel programme : il fallait lui donner son
    dossier (chown -R).

    LA BONNE PRATIQUE
    - Vérifier : docker exec conteneur id, et ps aux sur la machine.
    - Un uid ordinaire pour chaque conteneur : USER dans le Dockerfile,
      sinon --user uid:gid ou user: "uid:gid".
    - Des numéros plutôt que des noms : un nom doit exister dans l'image.
    - Donner les dossiers montés à cet uid (chown -R), jamais chmod 777.
    - Retirer ce qui ne sert pas : --cap-drop ALL, --security-opt
      no-new-privileges, --read-only.
    - Jamais --privileged, ni /var/run/docker.sock monté dans un conteneur
      exposé : c'est root sur la machine. Le groupe docker aussi.
    - Plus loin : userns-remap, ou Docker en mode rootless.

    LA DOCUMENTATION
    - docker run --user : https://docs.docker.com/reference/cli/docker/container/run/#user
    - user: dans Compose : https://docs.docker.com/reference/compose-file/services/#user
    - La sécurité de Docker : https://docs.docker.com/engine/security/
    - userns-remap : https://docs.docker.com/engine/security/userns-remap/
    - Docker sans root : https://docs.docker.com/engine/security/rootless/
