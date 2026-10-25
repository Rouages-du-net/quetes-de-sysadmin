### Histoire « La Ruche », chapitre « Le télétravail » : un VPN WireGuard
### sur le routeur. Les commandes, les mots-clés de wg-quick, les noms
### d'interfaces et les chemins ne se traduisent pas.

chapitre-vpn = Le télétravail
    .resume = Malik veut ouvrir le NAS depuis chez lui : pas en ouvrant un port sur internet, mais avec un VPN WireGuard, des clés bien gardées et un pare-feu qui le laisse entrer.

## Fichiers

# { $cle } : la clé publique WireGuard du portable de Malik
vpn-courriel-malik =
    De :     Malik
    À :      toi
    Objet :  Le NAS depuis chez moi

    Le réseau tourne, merci ! Dernière demande : j'aimerais ouvrir les
    dossiers du NAS depuis chez moi, le soir. Le neveu de la trésorière
    propose « d'ouvrir le port 445 sur la box ». J'ai comme un doute.

    Je préfère ce que tu m'as conseillé : un VPN WireGuard sur le routeur.
    J'ai installé l'appli sur mon portable. Elle a créé mes clés, et me
    donne ma clé publique :

        { $cle }

    Dans le tunnel, mon portable aura l'adresse 10.10.99.2. L'appli me
    demande la clé publique du routeur, son adresse (hive.example, ou
    192.0.2.21) et son port : complète malik-laptop.conf, je le
    recopierai.

    WireGuard est installé sur le routeur (man wg, man wg-quick ; les
    configurations vont dans /etc/wireguard). Et n'oublie pas le pare-feu
    des zones : la chaîne input est fermée par défaut.

    Pour sudo : abeille-2027

vpn-portable-malik =
    # La configuration WireGuard du portable de Malik. Sa clé privée reste
    # sur le portable : l'appli ne la montre jamais.
    # À compléter : la partie Peer, c'est-à-dire le routeur.
    {"["}Interface]
    Address = 10.10.99.2/32

    {"["}Peer]
    # La clé publique du routeur :
    PublicKey =
    # L'adresse et le port du routeur, vus d'internet :
    Endpoint =
    # Les adresses à joindre par le tunnel :
    AllowedIPs =

## Événements

# { $fichier } : le fichier qui contient la clé privée
vpn-evenement-cle-exposee =
    Attention : { $fichier } contient la clé privée du routeur, et tous les
    comptes de la machine peuvent le lire. Avec cette clé, n'importe qui
    pourrait se faire passer pour le routeur. Une clé privée n'est lisible
    que par son propriétaire (chmod 600, ou umask 077 avant de la créer) ;
    une fois recopiée dans /etc/wireguard, réservé à root, les autres
    copies n'ont plus de raison d'exister.
vpn-evenement-filtre =
    Malik : « Mon appli dit : Handshake did not complete after 5 seconds. »
    Ses paquets arrivent bien au routeur… et la chaîne input les jette :
    elle est fermée par défaut (policy drop), et rien n'y laisse passer le
    port où WireGuard écoute (en UDP).
vpn-evenement-poignee =
    Malik : « Toujours rien : Handshake did not complete. » sudo wg show le
    confirme : pas de « latest handshake » pour son pair. Pour se
    reconnaître, chacun doit avoir la clé PUBLIQUE de l'autre : celle de
    Malik dans le Peer de wg0.conf, celle du routeur dans
    malik-laptop.conf. Et l'Endpoint doit donner l'adresse du routeur et
    le port où il écoute (ListenPort).
vpn-evenement-sans-nas =
    Malik : « Connecté ! … mais le NAS ne répond pas. » La poignée de main a
    eu lieu (sudo wg show : latest handshake). Reste le chemin des paquets :
    l'adresse du portable doit être dans les AllowedIPs de son pair, côté
    routeur ; le NAS dans les AllowedIPs, côté portable ; et la chaîne
    forward doit laisser passer wg0 vers les bureaux.
vpn-evenement-en-place =
    Malik ouvre ses dossiers depuis chez lui… en ce moment. Au prochain
    redémarrage, wg0 ne reviendra que si le service wg-quick@wg0 est
    activé, et le pare-feu que si ses règles sont dans /etc/nftables.conf.
    (Une interface montée à la main avec wg-quick up empêche le service de
    démarrer : wg-quick down d'abord.)
vpn-evenement-fin =
    Malik ouvre les dossiers du NAS depuis chez lui, à travers un tunnel
    chiffré, sans que rien du NAS ne soit visible d'internet. Et tout
    reviendra au prochain redémarrage. Malik : « Le neveu de la trésorière
    est un peu vexé. »

    Bravo ! Tu as terminé le chapitre « Le télétravail ».

    CE QUI S'EST PASSÉ
    WireGuard relie deux machines par des clés, comme ssh : chacune a une
    clé privée, qui ne la quitte jamais, et donne sa clé publique à
    l'autre. Le portable envoie ses paquets chiffrés en UDP au routeur
    (Endpoint) ; le routeur les accepte s'ils viennent d'une clé qu'il
    connaît (Peer), et seulement pour les adresses que ce pair a le droit
    d'utiliser (AllowedIPs). AllowedIPs sert dans les deux sens : côté
    portable, ce sont les réseaux à envoyer dans le tunnel.

    LA BONNE PRATIQUE
    - Ne jamais ouvrir un partage de fichiers (445) sur internet : un VPN,
      et un seul port UDP ouvert.
    - Une clé privée n'est lisible que par son propriétaire : umask 077
      avant wg genkey, /etc/wireguard réservé à root.
    - Une adresse par pair, en /32, dans AllowedIPs ; et le pare-feu décide
      où le tunnel mène (ici, seulement les bureaux).
    - systemctl enable wg-quick@wg0, pour que le tunnel revienne au
      démarrage.

    UNE AUTRE VOIE
    OpenVPN : plus ancien et très répandu, fondé sur TLS et des
    certificats, capable de passer par TCP 443 ; plus lourd à configurer.
    Un tunnel SSH (ssh -L, La Maison des associations) suffit pour un
    service ponctuel, pas pour tout un réseau. Tailscale, ou Headscale
    qu'on héberge soi-même, construisent un maillage WireGuard et
    distribuent les clés.

    LA DOCUMENTATION
    - Démarrage rapide : https://www.wireguard.com/quickstart/
    - wg : https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick : https://man7.org/linux/man-pages/man8/wg-quick.8.html
    - WireGuard sur Debian : https://wiki.debian.org/WireGuard
