### Histoire « La Maison des associations », chapitre « Le tunnel » : joindre
### un service qui n'écoute que sur 127.0.0.1 d'une machine interne (ssh -L).
### Les commandes, les options, les chemins et les messages d'OpenSSH et de
### curl (en anglais) ne se traduisent pas.

chapter-tunnel = Le tunnel
    .summary = L'administration du wiki n'écoute que sur 127.0.0.1 : un tunnel ssh -L, curl, puis refermer le tunnel.

## Fichiers

tunnel-email-yasmine =
    De :     Yasmine
    À :      toi
    Objet :  Des inscriptions en attente

    Trois inscriptions attendent d'être validées sur le wiki. Il y a celles
    de Samir (l'atelier vélo) et de Léa (la chorale). La troisième, c'est
    sûrement de la publicité : surtout ne la valide pas.

    Le problème : la page d'administration du wiki n'est pas sur internet.
    Gaspard l'a fait exprès, elle n'écoute que sur 127.0.0.1, le port 8080,
    DU WIKI. Il n'y a pas de navigateur sur le wiki (pas même curl) : il
    l'ouvrait depuis son poste, avec un « tunnel » ssh (man ssh, option -L ;
    et -f -N pour qu'il reste ouvert sans session).

    Sur la page, chaque inscription a son adresse pour la valider ou la
    refuser.

    Et quand tu as fini, referme le tunnel : un port ouvert sur ton poste
    vers notre réseau interne, ça ne traîne pas.

tunnel-note-gaspard =
    Note de Gaspard (juin 2021)

    L'administration du wiki tourne ici (service wiki-admin, port 8080).
    Elle n'écoute que sur 127.0.0.1 : personne ne peut la joindre de
    l'extérieur, même pas depuis maison. Pour vérifier :

      ss -tln
      systemctl status wiki-admin

## La page d'administration (servie par le wiki)

# { $lines } : une ligne par inscription (tunnel-admin-line)
tunnel-admin-page =
    Wiki des associations — administration

    Inscriptions :
    { $lines }

    Valider :   /admin/valider/<compte>
    Refuser :   /admin/refuser/<compte>
# { $name } : le compte ; { $state } : attente, validee ou refusee
tunnel-admin-line = { $state ->
        [approved] - { $name } : validée
        [refused] - { $name } : refusée
       *[pending] - { $name } : en attente
    }
tunnel-admin-approve = Inscription de { $name } validée.
tunnel-admin-reject = Inscription de { $name } refusée.
tunnel-admin-not-found = Page introuvable.

## Événements

# { $account } : le compte publicitaire
tunnel-event-advert =
    Oups : le compte { $account } est validé. Yasmine : « Il va remplir le wiki
    de publicités ! » Refuse-le (l'adresse est sur la page d'administration).
tunnel-event-approved =
    Samir et Léa sont inscrit·es, et la publicité reste à la porte.

    Reste à refermer le tunnel : il tourne en arrière-plan sur ton poste.
    Retrouve son processus (ps), puis arrête-le (kill).
tunnel-event-end =
    Inscriptions validées, tunnel refermé. Yasmine : « Samir a déjà créé la
    page de l'atelier vélo ! »

    Bravo ! Tu as terminé le chapitre « Le tunnel ».

    CE QUI S'EST PASSÉ
    Avec ssh -L 8080:localhost:8080 wiki, ssh ouvre le port 8080 de ton poste.
    Tout ce qui y entre voyage, chiffré, dans la connexion ssh, et ressort
    côté wiki vers « localhost:8080 ». Ce localhost s'entend du point de vue
    du WIKI : c'est sa propre adresse 127.0.0.1, là où l'administration
    écoute. Le service n'a jamais été exposé à internet ; seul ssh l'était.

    LA BONNE PRATIQUE
    - Laisser les interfaces d'administration sur 127.0.0.1 et y accéder par
      un tunnel ssh, plutôt que d'ouvrir un port de plus dans le pare-feu.
    - Le nom dans -L est résolu par la machine d'en face : -L
      8080:localhost:8080 maison mène à maison, pas au wiki.
    - -f -N : un tunnel sans session ; il faut penser à le refermer (ps,
      kill), ou le garder au premier plan et l'arrêter avec Ctrl+C.

    LA DOCUMENTATION
    - ssh, option -L : https://man.openbsd.org/ssh#L
    - ssh, options -f et -N : https://man.openbsd.org/ssh#f
