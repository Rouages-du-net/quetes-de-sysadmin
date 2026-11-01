### Histoire « La Ruche », chapitre « L'Annexe » : relier deux sites par
### WireGuard. Les commandes, les mots-clés de wg-quick, les adresses et
### les chemins ne se traduisent pas.

chapter-annex = L'Annexe
    .resume = La Ruche ouvre un second lieu : relier ses deux réseaux par le VPN, avec des AllowedIPs qui servent de table de routage, et un passage gardé ouvert dans la box de l'Annexe.

## Fichiers

# { $cle } : la clé publique WireGuard du routeur de l'Annexe
annex-email-sami =
    De :     Sami (bénévole à l'Annexe)
    À :      toi
    Objet :  Relier l'Annexe à La Ruche

    Salut ! L'Annexe ouvre lundi. J'ai installé notre routeur (une Debian
    aussi, derrière la box de notre fournisseur) ; notre réseau, c'est
    10.20.10.0/24.

    Ce qu'il nous faut :
    - les postes de l'Annexe ouvrent les dossiers du NAS de La Ruche
      (10.10.10.5) ;
    - Malik imprime sur notre imprimante (10.20.10.20) depuis les bureaux ;
    - et pas plus : les caméras de La Ruche ne nous regardent pas.

    Malik dit que le VPN du télétravail peut servir : notre routeur sera un
    pair de plus sur wg0. Il a pris l'adresse 10.10.99.3 dans le tunnel,
    et sa clé publique est :

        { $cle }

    J'ai préparé annex-wg0.conf : complète la partie Peer (votre routeur)
    et je la recopie chez nous. Pour la clé publique de votre routeur :
    sudo wg show.

    Pour sudo : abeille-2027

annex-conf =
    # La configuration WireGuard du routeur de l'Annexe (Sami la recopiera).
    # Sa clé privée reste à l'Annexe.
    {"["}Interface]
    Address = 10.10.99.3/24
    ListenPort = 51820

    {"["}Peer]
    # Le routeur de La Ruche :
    PublicKey =
    Endpoint =
    # Les adresses de La Ruche à envoyer dans le tunnel :
    AllowedIPs =

## Événements

annex-event-not-reread =
    Le fichier /etc/wireguard/wg0.conf a un pair pour l'Annexe… mais wg0
    tourne toujours avec l'ancienne configuration (sudo wg show) :
    wg-quick ne relit pas le fichier tout seul. Il faut redémarrer
    l'interface (le service wg-quick@wg0).
annex-event-handshake =
    Sami : « Notre routeur dit : Handshake did not complete. » sudo wg show
    le confirme : pas de « latest handshake » pour le pair de l'Annexe.
    Chacun doit avoir la clé PUBLIQUE de l'autre, et l'Endpoint doit
    donner l'adresse et le port de votre routeur.
annex-event-allowed =
    Sami : « Le tunnel est monté, mais nos postes n'atteignent pas le
    NAS. » Les paquets arrivent… et le routeur les jette : ils viennent de
    10.20.10.15, et pour WireGuard, un pair n'a le droit d'envoyer que
    depuis les adresses de ses AllowedIPs. Pour un site entier, c'est tout
    son réseau.
annex-event-route =
    Sami : « Toujours rien vers le NAS. » Côté Annexe, les paquets pour
    10.10.10.5 ne partent pas dans le tunnel : dans annex-wg0.conf,
    AllowedIPs dit ce qui doit y entrer (et wg-quick en fait des routes).
annex-event-asleep =
    Sami : « Le NAS marche ! » Malik : « Et moi, j'imprime à l'Annexe…
    parfois. Puis plus rien pendant des heures. » Le routeur de l'Annexe
    est derrière la box de son fournisseur : tant qu'il n'envoie rien, la
    box oublie le passage, et La Ruche ne peut plus le joindre. WireGuard
    sait le garder ouvert en envoyant un petit paquet de temps en temps
    (man wg : PersistentKeepalive).
annex-event-cameras =
    Attention : l'Annexe atteint maintenant les caméras de La Ruche. Sami
    n'a demandé que le NAS : le tunnel n'ouvre pas tout, c'est le pare-feu
    (la chaîne forward) qui décide où il mène.
annex-event-malik =
    Attention : Malik ne joint plus le NAS depuis chez lui. Le pair de son
    portable doit rester dans wg0.conf, avec sa propre adresse.
annex-event-in-place =
    Les deux sites se parlent… en ce moment. Au prochain redémarrage,
    wg0 repart de /etc/wireguard/wg0.conf par le service wg-quick@wg0 :
    tout doit y être.
annex-event-end =
    Les postes de l'Annexe ouvrent le NAS, Malik imprime à l'Annexe, le
    tunnel reste ouvert malgré la box, et rien d'autre ne passe. Sami :
    « On dirait qu'on est dans le même bâtiment. »

    Bravo ! Tu as terminé le chapitre « L'Annexe ».

    CE QUI S'EST PASSÉ
    Pour WireGuard, AllowedIPs sert dans les deux sens : ce sont les
    adresses qu'on envoie à ce pair (wg-quick en fait des routes, visibles
    avec ip route) et celles d'où ce pair a le droit d'envoyer. Pour relier
    deux sites, chaque côté y met le réseau de l'autre. Et un site derrière
    une box (NAT) doit garder le passage ouvert : PersistentKeepalive
    envoie un paquet toutes les 25 secondes.

    LA BONNE PRATIQUE
    - Des réseaux qui ne se chevauchent pas (10.10.x pour La Ruche,
      10.20.x pour l'Annexe), choisis avant de relier les sites.
    - Le tunnel transporte, le pare-feu décide : ouvrir seulement ce qui
      est demandé.
    - Après une modification de wg0.conf, redémarrer l'interface (ou le
      service), et vérifier avec wg show et ip route.

    LA DOCUMENTATION
    - Le routage par clés (cryptokey routing) : https://www.wireguard.com/#cryptokey-routing
    - wg (PersistentKeepalive) : https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick (les routes) : https://man7.org/linux/man-pages/man8/wg-quick.8.html
