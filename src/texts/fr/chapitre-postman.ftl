### Histoire « Le courrier indésirable », chapitre 1 « Le facteur » : SPF.
### Les commandes, chemins, enregistrements DNS et messages de Postfix ne se
### traduisent pas.

chapitre-postman = Le facteur
    .resume = Les courriels de bienvenue des Jardins partagés restent bloqués : le SPF publié est encore celui de l'ancien hébergeur.

## Fichiers

postman-courriel-nour =
    De :     Nour
    À :      toi
    Objet :  Les courriels de bienvenue n'arrivent plus

    Bonjour, et merci de nous donner un coup de main !

    La semaine dernière, on a quitté notre ancien hébergeur
    (old-hosting.example) : le site et le courrier des Jardins partagés
    tournent maintenant sur notre propre serveur, celui-ci. Tout allait
    bien… jusqu'à ce que cinq nouveaux membres nous écrivent : ils n'ont
    jamais reçu le courriel de bienvenue que le site envoie à l'inscription.
    Tous les cinq ont une adresse chez mailbox.example.

    Je n'y connais pas grand-chose, mais j'ai vu une commande mailq qui
    montre le courrier qui attend. Et il y a /var/log/mail.log.

    Le DNS de gardens.example est sur ce serveur aussi (BIND), avec une
    copie chez le registre (ns2.registry.example), comme avant chez
    l'hébergeur.

    Le mot de passe pour sudo : semis-2027.

    Merci !
    Nour

## Événements

postman-evenement-differe =
    mailbox.example ne refuse pas le courrier pour toujours : 451 est un
    code « temporaire » (4xx), Postfix garde le message et réessaiera. Mais
    la raison est claire : « neither SPF nor DKIM passed ». Ni SPF (qui dit
    quelles machines ont le droit d'envoyer pour un domaine) ni DKIM (une
    signature) ne prouvent que ce serveur parle bien au nom de
    gardens.example. Commence par SPF : c'est un enregistrement TXT du
    domaine, qui commence par v=spf1 (dig TXT gardens.example).
postman-evenement-ancien =
    Voilà le SPF de gardens.example : « include:_spf.old-hosting.example
    -all ». Il autorise seulement les serveurs de l'ancien hébergeur (ce que
    publie _spf.old-hosting.example), et -all refuse tous les autres… dont
    ce serveur, 203.0.113.30. L'enregistrement est dans la zone, sur ce
    serveur : /etc/bind/zones/db.gardens.example.
postman-evenement-deux =
    Attention : la zone contient maintenant deux enregistrements qui
    commencent par v=spf1. La RFC 7208 est stricte : avec deux SPF, le
    résultat est « permerror », comme s'il n'y en avait aucun de valable.
    Remplace l'ancien plutôt que d'en ajouter un.
postman-evenement-serie =
    Ce serveur publie le bon SPF, mais le reste d'internet interroge aussi
    le secondaire du registre, qui garde l'ancienne version : dig TXT
    gardens.example @ns2.registry.example. Le secondaire ne recopie la zone
    que si son numéro de série (serial, dans le SOA) augmente.
postman-evenement-spf =
    Le SPF publié par internet autorise maintenant 203.0.113.30 à envoyer
    pour gardens.example. Les courriels en attente ne partiront qu'au
    prochain essai de Postfix (toutes les quelques minutes) ; pour ne pas
    attendre : sudo postqueue -f, puis mailq.
postman-evenement-fin =
    La file d'attente est vide : mailbox.example a accepté les cinq
    courriels de bienvenue. Nour : « Amina vient de me répondre, elle l'a
    reçu ! … dans ses indésirables, mais elle l'a reçu. »

    Bravo ! Tu as terminé le chapitre « Le facteur ».

    CE QUI S'EST PASSÉ
    Un serveur qui reçoit du courrier vérifie que l'expéditeur a le droit
    d'envoyer au nom de son domaine. SPF répond à la question « cette
    adresse IP peut-elle envoyer pour gardens.example ? » : c'est un
    enregistrement TXT du domaine (v=spf1 …). Après le déménagement, il
    autorisait encore l'ancien hébergeur, pas ce serveur. 451 est une
    erreur temporaire : Postfix a gardé les messages et les a renvoyés.

    LA BONNE PRATIQUE
    - Un seul enregistrement SPF par domaine ; le modifier quand on change
      de serveur d'envoi (mx, a, ip4:…, include:… pour un prestataire).
    - Finir par -all (refuser le reste) ou ~all (le signaler), jamais +all.
    - Changer la zone, c'est aussi augmenter le serial, puis vérifier ce
      que voit internet : dig @ns2.registry.example.
    - mailq et /var/log/mail.log disent pourquoi un message attend.

    LA DOCUMENTATION
    - SPF, la RFC 7208 : https://www.rfc-editor.org/rfc/rfc7208
    - postqueue : https://www.postfix.org/postqueue.1.html
    - Les fichiers de zone de BIND : https://bind9.readthedocs.io/en/stable/chapter3.html
