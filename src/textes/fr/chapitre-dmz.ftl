### Histoire « La Ruche », chapitre « La DMZ » : un serveur public dans un
### VLAN à part, la traduction de destination (dnat) et le pare-feu. Les
### commandes, les mots-clés de nft, les noms d'interfaces et les chemins
### ne se traduisent pas.

chapitre-dmz = La DMZ
    .resume = Le site de réservation des salles est hébergé sur place : un VLAN à part (la DMZ), une traduction de destination pour le rendre visible d'internet, et un serveur qui ne voit rien du reste.

## Fichiers

dmz-courriel-ines =
    De :     Inès (bénévole, le site de La Ruche)
    À :      toi
    Objet :  Le site de réservation, chez nous !

    Bonjour ! Malik m'a dit que tu t'occupais du routeur. On arrête de payer
    l'hébergeur : le site de réservation des salles tourne maintenant sur un
    petit serveur ici, « web » (10.10.40.10, passerelle 10.10.40.1). Il
    répond en HTTP et HTTPS (ports 80 et 443).

    L'électricien l'a branché sur le port 21 du commutateur, dans un nouveau
    VLAN 40 : la « DMZ », il a dit. Son plan est dans
    plan-commutateur.txt.

    Pour que les gens le trouvent, il faudrait que ce qui arrive sur
    l'adresse publique du routeur (192.0.2.21), ports 80 et 443, aille au
    serveur. Et il doit pouvoir faire ses mises à jour sur internet.

    Malik ajoute : « Un serveur ouvert sur internet, c'est celui qu'on
    attaque. S'il tombe, il ne doit rien voir d'autre chez nous : ni le
    NAS, ni l'imprimante. » Les bureaux, eux, doivent pouvoir s'y
    connecter en ssh pour l'administrer.

    Pour voir passer les visites : sudo conntrack -L. Le reste : man nft
    (dnat), man interfaces.

    Pour sudo : abeille-2027

dmz-plan-commutateur =
    PLAN DU COMMUTATEUR — La Ruche (électricien, mise à jour de janvier 2028)

    Port 1     : vers le routeur (eth1). TRUNK 802.1Q : VLAN 10, 20, 30, 40
                 étiquetés (tagged).
    Ports 2-12 : VLAN 10 « bureaux »
    Ports 13-16: VLAN 20 « invites »
    Ports 17-20: VLAN 30 « equipements »
    Port 21    : VLAN 40 « dmz » (le serveur web)

    Adresses :
      VLAN 40  dmz          10.10.40.0/24   routeur : 10.10.40.1
                                            web     : 10.10.40.10 (fixe)

## Événements

# { $adresse } : l'adresse publique du routeur
dmz-evenement-adresse-publique =
    Une règle de la chaîne forward attend l'adresse { $adresse }… mais elle
    ne la verra jamais : la traduction de destination (dnat) a lieu avant,
    au hook prerouting. Quand le paquet arrive dans forward, il va déjà à
    10.10.40.10. C'est cette adresse-là que forward doit laisser passer.
dmz-evenement-sans-forward =
    Inès : « Le site ne répond toujours pas de chez moi. » Le routeur traduit
    bien la destination (sudo nft list ruleset), mais le paquet traduit
    traverse ensuite la chaîne forward, fermée par défaut : rien n'y laisse
    passer internet vers la DMZ.
dmz-evenement-trop-ouvert =
    Attention : avec ces règles, la DMZ est trop ouverte. Soit internet
    atteint le serveur sur d'autres ports que 80 et 443 (ssh, par exemple),
    soit le serveur peut ouvrir des connexions vers le réseau interne. Une
    DMZ ne laisse entrer que ce qu'elle publie, et ne laisse rien sortir
    vers l'intérieur.
dmz-evenement-en-place =
    Le site répond, et la DMZ tient… en ce moment. Mais au prochain
    redémarrage ? L'interface eth1.40 doit être dans
    /etc/network/interfaces, et les règles dans /etc/nftables.conf.
dmz-evenement-fin =
    Le site de réservation répond depuis internet, le serveur fait ses
    mises à jour, les bureaux l'administrent, et s'il est un jour piraté,
    il ne voit ni le NAS, ni l'imprimante. Inès : « Et l'hébergeur ne nous
    coûte plus rien ! »

    Bravo ! Tu as terminé le chapitre « La DMZ ».

    CE QUI S'EST PASSÉ
    Le routeur n'a qu'une adresse publique. La traduction de destination
    (dnat, dans une chaîne nat au hook prerouting) change la destination
    des paquets qui arrivent sur certains ports : ils repartent vers le
    serveur, et le suivi de connexion rend les réponses avec l'adresse du
    routeur. Comme ce changement a lieu AVANT le routage, la chaîne forward
    voit déjà la nouvelle destination. La DMZ (zone démilitarisée) est un
    réseau à part pour ce qui est visible d'internet.

    LA BONNE PRATIQUE
    - Ne publier que les ports utiles (80, 443), jamais « tout » vers un
      serveur.
    - La DMZ ne peut rien ouvrir vers le réseau interne ; c'est l'intérieur
      qui va vers elle (l'administration depuis les bureaux).
    - Dans forward, écrire la destination APRÈS traduction (l'adresse du
      serveur), et tester avec sudo conntrack -L.

    LA DOCUMENTATION
    - NAT avec nftables : https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - Le trajet des paquets (hooks) : https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks
