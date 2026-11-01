### Histoire « L'Audit », chapitre « Le périmètre » : lire la lettre de mission,
### faire l'inventaire du serveur vu d'internet avec nmap, rester dans le
### périmètre. Les commandes, les options, les chemins et les sorties de nmap
### (en anglais) ne se traduisent pas.

chapter-scope = Le périmètre
    .summary = Avant de balayer : lire la lettre de mission, faire l'inventaire avec nmap, et ne pas toucher à ce qui n'est pas dans le périmètre.

## Fichiers

scope-email-salome =
    De :     Salomé (auditrice)
    À :      toi
    Objet :  Mission d'audit du Fournil — par où commencer

    Bonjour,

    Nadia m'a confié l'audit de sécurité de son serveur. Je commence toujours
    de la même façon, et je te demande de le faire avec moi : la lettre de
    mission d'abord (lettre-de-mission.txt, signée de nous deux), puis
    l'inventaire. Un audit commence par « qu'est-ce qui est visible, et qu'ai-je
    le droit de regarder ? ».

    Ce que j'attends de toi :
    1. Lis la lettre de mission : elle fixe le périmètre, et ce qui est permis.
    2. Fais l'inventaire du serveur tel qu'on le voit d'internet, avec nmap
       (man nmap) : les ports ouverts ET la version de ce qui répond. Garde la
       trace dans un fichier (l'option -oN) : c'est la preuve de ce que tu as vu.
    3. Complète notes-audit.md : le périmètre, ce que tu as trouvé, et ce que tu
       as repéré sans y toucher.

    Une précaution : Nadia m'a prévenue que le serveur de la pizzeria d'à côté
    (voisin.internal, 192.0.2.24) est branché sur la même box. Il n'est pas
    dans notre mandat.

    Salomé
    (Pour sudo, ton mot de passe est : farine-2028)

scope-letter-mission =
    LETTRE DE MISSION

    Entre : la boulangerie Le Fournil, représentée par Nadia, gérante
            (« le client »)
    Et :    Salomé, auditrice indépendante

    Objet : audit de sécurité externe du service de commande en ligne.

    Périmètre autorisé :
      - le serveur fournil.internal (192.0.2.22), qui porte aussi le site
        public bakery.example.

    Hors périmètre (à ne pas sonder, même si c'est techniquement possible) :
      - tout autre équipement, notamment ceux des voisins qui partagent la
        box du client.

    Permis :
      - balayer les ports du serveur et lire les versions des services (nmap) ;
      - des requêtes inoffensives (un code de réponse, un en-tête) ;
      - lire la configuration, avec l'accord de l'administration.

    Interdit :
      - exploiter une faille, lire ou copier des données des clients ;
      - deviner des mots de passe ;
      - gêner le service ;
      - sonder quoi que ce soit hors du périmètre.

    Période : du 6 au 17 mars 2028, de 9 h à 18 h.
    Les constats ne sont remis qu'au client.

    Signé : Nadia (gérante) et Salomé, le 3 mars 2028.

scope-notes-template =
    # Notes d'audit — Le Fournil

    ## Périmètre
    (à compléter : ce que la lettre de mission autorise)

    ## Ce que j'ai trouvé
    (à compléter : les ports ouverts vus d'internet, les services et leurs versions)

    ## Hors périmètre
    (à compléter : ce que j'ai repéré et que je n'ai PAS sondé, et pourquoi)

scope-section-scope = Périmètre
scope-section-found = Ce que j'ai trouvé
scope-section-outside = Hors périmètre
scope-a-complete = (à compléter
scope-words-outside = hors périmètre, hors perimetre, pas dans la lettre, pas dans le mandat, pas sondé, sans y toucher, pas touché, non sondé

## Relecture

scope-review = Salomé relit tes notes :
scope-missing-template = Il reste des lignes « (à compléter) » du modèle.
scope-missing-ports = Dans « Ce que j'ai trouvé », il manque ce qui n'a rien à faire sur internet : les numéros de port de la base de données et de Redis (ce que nmap a montré).
scope-missing-neighbour = Il manque la machine que tu as repérée sans y toucher : le serveur du voisin (nom ou adresse).
scope-missing-outside = Tu cites le serveur du voisin : dis aussi que c'est hors périmètre (et que tu ne l'as pas sondé).

## Événements

scope-event-letter =
    La lettre de mission est le document qui te protège autant qu'elle
    protège le client : elle dit où tu as le droit d'aller. Retiens deux
    choses : le périmètre (UNE machine : fournil, 192.0.2.22) et la liste de
    ce qui est interdit. Sans autorisation écrite, un balayage de ports est
    au mieux mal vu, au pire une infraction.

    Passe à l'inventaire : nmap, avec les versions (man nmap).
scope-event-scan =
    Voilà ce que voit internet du Fournil. Lis la colonne STATE : « open »
    veut dire qu'un programme répond ; « filtered », qu'un pare-feu jette le
    paquet ; « closed », que personne n'écoute. Et la colonne VERSION : une
    version périmée est une piste de plus pour un attaquant.

    Une question d'auditrice : parmi ces services ouverts, lesquels ont une
    raison d'être joignables par n'importe qui ? Garde la trace dans un
    fichier (l'option -oN) : un constat sans preuve n'est qu'une opinion.
# { $addresses } : les adresses sondées hors de la lettre de mission ; { $neighbour } : « oui » si le serveur du voisin en fait partie
scope-event-outside-scope =
    ATTENTION : tu viens de sonder une adresse qui n'est pas dans ta lettre
    de mission ({ $addresses }{ $neighbour ->
        [yes] , dont le serveur du voisin
       *[no] {""}
    }). Ici, il ne s'est rien
    passé ; pour de vrai, c'est une faute professionnelle, et selon le
    pays une infraction : l'autorisation du client ne couvre pas le matériel
    d'autrui. La bonne réponse, face à une machine qui paraît « intéressante » :
    ne pas y toucher, et le signaler.

    (Un balayage d'un réseau entier, comme 192.0.2.0/24, sonde aussi tout ce
    qui s'y trouve : donne toujours les adresses exactes du périmètre.)
scope-event-trace =
    Tu as une preuve : un fichier avec la commande exacte, la date, les ports
    et les versions. Dans le rapport, on peut dire « au 6 mars, depuis internet,
    la base de données répondait sur le port 5432 » et le montrer.

    Reste à écrire tes notes (notes-audit.md) : ce que tu as trouvé, et ce que
    tu as vu sans y toucher.
# { $mistake } : « oui » si le balayage a débordé du périmètre, « non » sinon
scope-event-end =
    Salomé : « Voilà un inventaire propre : un périmètre, des preuves, et des
    notes honnêtes. On pourra s'en servir pour le rapport. »

    Bravo ! Tu as terminé le chapitre « Le périmètre ».

    CE QUI S'EST PASSÉ
    Tu as lu la lettre de mission avant de toucher à quoi que ce soit, puis tu
    as fait l'inventaire du Fournil tel qu'on le voit d'internet : SSH, le
    site, mais aussi PostgreSQL et Redis, que rien ne justifie d'exposer, et
    une version de SSH qui n'est pas la dernière. Tu as gardé la trace du
    balayage dans un fichier. Et tu as noté sans y toucher une machine
    « intéressante » qui n'est pas la tienne : le serveur du voisin.
    { $mistake ->
        [yes] Mais ton balayage a aussi sondé l'adresse du voisin : l'erreur la plus courante, parce que balayer « tout le réseau » est un réflexe. Ici, ça ne coûte rien ; pour de vrai, c'est la faute qui met fin à une mission, parfois à une carrière.
       *[no] Ton balayage est resté dans le périmètre : c'est ce qu'on attend d'une auditrice.
    }

    LA BONNE PRATIQUE
    - Pas d'audit sans autorisation écrite : qui, quoi (les adresses
      exactes), quand, ce qui est permis, ce qui est interdit.
    - Rester dans le périmètre, même quand le reste du réseau est à portée.
      Ce qu'on voit hors périmètre se signale, ne se teste pas.
    - Noter la commande exacte et garder la sortie (nmap -oN) : un constat
      se prouve et se rejoue.
    - Constater, ne pas exploiter : voir qu'une base répond n'autorise pas à
      s'y connecter.
    - Un port ouvert n'est pas forcément un problème : c'est une question
      (« est-ce voulu ? »). Le rapport dit lesquels, et pourquoi.

    UNE AUTRE VOIE
    Sans nmap, ss -tlnp sur le serveur donne les services qui écoutent, mais
    pas ce que voit l'extérieur : un pare-feu peut en cacher. Les deux se
    complètent : ss dit ce qui écoute, nmap dit ce qui passe.

    LA DOCUMENTATION
    - nmap : https://nmap.org/book/man.html
    - Questions légales : https://nmap.org/book/legal-issues.html
    - Guides d'hygiène et d'audit des autorités nationales : l'ANSSI (France, cyber.gouv.fr), le BSI (Allemagne, bsi.bund.de), le NCSC (Royaume-Uni, ncsc.gov.uk), le CCN-CERT (Espagne, ccn-cert.cni.es), le CCB (Belgique, ccb.belgium.be), le NCSC (Suisse, ncsc.admin.ch), la CISA (États-Unis, cisa.gov)
