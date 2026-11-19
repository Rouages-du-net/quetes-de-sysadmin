### Histoire « Le Bac », chapitre « L'autre porte » : le pare-feu est une
### « table ip », alors l'IPv6 passe sans contrôle : PostgreSQL et les pages
### d'administration sont ouverts depuis internet en IPv6. nmap -6, ss, les
### familles de nftables (inet), ICMPv6. Les commandes, options, adresses,
### chemins et sorties ne sont pas traduits.

chapter-other-door = L'autre porte
    .summary = Le scan mensuel de la coopérative de fibre trouve la base de données et les pages d'administration de l'appli de réservation ouvertes sur le serveur du bac, mais seulement en IPv6. Comparez les deux vues depuis l'extérieur, trouvez pourquoi le pare-feu laisse passer l'IPv6, et écrivez une seule politique pour les deux familles sans couper l'IPv6.

## Fichiers

other-door-message-amaru =
    De : Amaru (coopérative du bac)
    Jeudi 12 avril, 13 h 50

    Re-bonjour,

    Rangi nous a transmis le scan mensuel qu'islenet fait des serveurs de
    ses membres (il est dans votre dossier personnel). Depuis l'IPv6, ils
    scannent les deux. Il a écrit une phrase au-dessus : « Votre base de
    données est ouverte à tout internet en IPv6. Pas en IPv4. »

    Je ne comprends pas : Tevita m'avait dit que le pare-feu fermait tout
    sauf le site et ssh. La base ne doit être lue que par le poste de
    réservation, ici au bureau du port (198.51.100.40). Et les pages
    d'administration de l'appli sont pour nous, pas pour le monde.

    Vous pouvez regarder ? La vigie est toujours là pour voir depuis
    l'extérieur.

    Amaru

other-door-scan-report =
    islenet, scan mensuel des serveurs des membres, avril 2029
    Membre : coopérative du bac, serveur quai.ferry.example

    IPv4 192.0.2.52
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    open      http
      5432/tcp  filtered  postgresql
      8080/tcp  filtered  http-proxy

    IPv6 { $address }
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    closed    http
      5432/tcp  open      postgresql    <-- !
      8080/tcp  open      http-proxy    <-- !

    Rappel : un service que seul le bureau utilise ne doit pas être
    joignable depuis internet, dans aucune des deux familles.

## Événements

other-door-event-scan6 =
    Vu d'internet, en IPv6, PostgreSQL (5432) répond. Maintenant le même
    scan en IPv4 (nmap sans -6), pour comparer.
other-door-event-scan4 =
    En IPv4, 5432 est « filtered » : quelque chose jette les paquets. Le
    pare-feu de Tevita fait son travail, en IPv4. Deux portes, une seule
    gardée. Sur quai : qui écoute, et sur quelles adresses ? (ss -tlnp)
other-door-event-sockets =
    PostgreSQL écoute deux fois : 0.0.0.0:5432 (toutes les adresses IPv4)
    et [::]:5432 (toutes les adresses IPv6). Les pages d'administration
    écoutent sur *:8080 : une seule socket IPv6 qui prend aussi l'IPv4
    (IPV6_V6ONLY désactivé). Rien d'anormal : le bureau a besoin de la
    base. C'est au pare-feu de choisir qui entre. Lisez ses règles (nft
    list ruleset).
other-door-event-ruleset =
    « table ip filter » : une table de la famille ip ne voit que les
    paquets IPv4. Les paquets IPv6 passent par la famille ip6, et la
    famille inet sert les deux. Il n'y a ici aucune table ip6 ni inet : en
    IPv6, rien n'est filtré du tout. Une politique pour les deux familles :
    une table inet (man nft).
other-door-event-disabled =
    L'IPv6 est coupé : les ports ouverts sont cachés, mais les
    enregistrements AAAA envoient toujours les visiteur·ses IPv6 vers quai,
    qui trouvent maintenant porte close. Et le rallumer (sysctl -w
    …disable_ipv6=0) rend les adresses de lien local et SLAAC, pas
    l'adresse fixe : celle-ci revient avec ip -6 addr add (ou systemctl
    restart networking). C'est le pare-feu qu'il faut corriger.
other-door-event-nd-dropped =
    quai ne répond plus du tout en IPv6, pas même au ping ni à ssh : le
    routeur demande « qui a 2001:db8:4e1:20::80 ? » par une sollicitation
    de voisin ICMPv6, et votre chaîne input la jette. L'IPv4 a ARP, hors du
    pare-feu ; l'IPv6 fait la même chose en ICMPv6, donc les règles doivent
    le laisser entrer :
    icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert {"}"}
    accept (la RFC 4890 liste les autres à garder : packet-too-big…).
other-door-event-v6-stricter =
    Un service qui passe en IPv4 ne passe plus en IPv6 : une règle de la
    table IPv4 manque dans la table IPv6. C'est le piège des deux copies
    tenues à la main : une table inet garde un seul jeu de règles pour les
    deux.
other-door-event-office-cut =
    Le poste de réservation (198.51.100.40, IPv4) n'atteint plus la base :
    gardez sa règle (ip saddr 198.51.100.40 tcp dport 5432 accept).
other-door-event-ssh-cut =
    Le poste de travail n'atteindrait plus ssh : gardez le port 22 ouvert.
other-door-event-closed-now =
    Le jeu de règles chargé tient maintenant dans les deux familles : ssh,
    le DNS et le site passent, la base et les pages d'administration non,
    le bureau lit toujours, et la découverte des voisins passe. Pour
    l'instant : le service nftables charge /etc/nftables.conf au démarrage
    (et au reload).
other-door-event-not-saved =
    Les règles chargées ne sont pas celles de /etc/nftables.conf : au
    prochain redémarrage (ou systemctl reload nftables), la porte IPv6 se
    rouvre. Écrivez-les dans le fichier, nft -c -f pour le vérifier, puis
    chargez-le.
other-door-event-closed-boot =
    /etc/nftables.conf contient la politique pour les deux familles, et le
    service nftables est actif : il la chargera au démarrage.
other-door-event-end =
    Rangi : « Deuxième scan ce matin : 5432 et 8080 filtrés en IPv4 et en
    IPv6. Propre. » Amaru : « Et le poste de réservation marche toujours.
    Parfait. »

    Bravo ! Vous avez terminé le chapitre 2 du Bac. (La suite vous attend :
    ssh quai.)

    CE QUI S'EST PASSÉ
    Le pare-feu de quai était une table de la famille ip : il n'a jamais vu
    que l'IPv4. Quand l'IPv6 est arrivé, tout service qui écoutait sur [::]
    ou * est devenu joignable en IPv6 sans aucun filtre : la base de
    données, les pages d'administration. Vous avez comparé les deux
    familles depuis l'extérieur (nmap, nmap -6), vu les sockets (ss -tlnp),
    et écrit une seule politique pour les deux, dans une table inet, avec
    l'ICMPv6 sans lequel l'IPv6 ne vit pas, dans le fichier et chargée.

    BONNES PRATIQUES
    - Activer l'IPv6, c'est auditer le pare-feu en IPv6 : scanner les deux
      familles, depuis l'extérieur.
    - nftables : une table inet garde les règles des deux familles ; ip
      saddr ne correspond qu'à l'IPv4, ip6 saddr qu'à l'IPv6.
    - Ne jamais jeter tout l'ICMPv6 : la découverte des voisins et les
      annonces des routeurs passent par lui (RFC 4890).
    - Couper l'IPv6 pour cacher un trou casse ce qui en dépend (les
      enregistrements AAAA) : corrigez le filtre.
    - ufw : IPV6=yes dans /etc/default/ufw ; les règles ajoutées quand il
      valait « no » n'existent qu'en IPv4.
    - Mieux vaut un service qui n'écoute que là où il faut (127.0.0.1, ::1)
      qu'un pare-feu qui le cache.

    DOCUMENTATION
    - Les familles de nftables : https://wiki.nftables.org/wiki-nftables/index.php/Nftables_families
    - Un jeu de règles simple pour un serveur : https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_server
    - Filtrer l'ICMPv6 (RFC 4890) : https://www.rfc-editor.org/rfc/rfc4890
    - nmap et l'IPv6 : https://nmap.org/book/man-ipv6.html
