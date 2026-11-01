### Histoire « La Ruche », chapitre « Les zones » : le routage, le NAT et un
### pare-feu entre les VLAN, avec sysctl et nftables. Les commandes, les
### mots-clés de nft, les noms d'interfaces et les chemins ne se traduisent pas.

chapter-zones = Les zones
    .summary = Rien ne sort sur internet, et tout le monde voit tout : le routage, la traduction d'adresses (NAT) et un pare-feu entre les VLAN, avec nftables, et qui tiennent au redémarrage.

## Fichiers

zones-email-malik =
    De :     Malik
    À :      toi
    Objet :  Internet ne sort pas

    Tout le monde a son adresse, merci ! Mais rien ne sort sur internet :
    ni les bureaux, ni le wifi du café. Sacha, le bénévole qui s'occupait
    du réseau avant toi, dit qu'il avait « tout réglé à la main » ; ses
    notes sont dans notes-de-sacha.txt. Le routeur a redémarré samedi,
    pendant la coupure de courant.

    Et puisqu'on y est, ce qu'on voulait vraiment avec les VLAN :

    - les bureaux (VLAN 10) : internet, et l'imprimante ;
    - le wifi des invité·es (VLAN 20) : internet, et RIEN d'autre. Le NAS
      garde les dossiers des bénéficiaires de l'épicerie solidaire, et il
      y a les caméras ;
    - les équipements (VLAN 30) : pas d'internet du tout. Les caméras
      essaient d'envoyer leurs images chez leur fabricant, on n'en veut
      pas. Le NAS, lui, doit continuer à enregistrer les caméras.

    Tu travailles depuis le poste d'administration (192.0.2.2), en ssh :
    ne t'enferme pas dehors !

    Pour voir qui parle à qui à travers le routeur : sudo conntrack -L.
    Le reste : man nft, man sysctl.

    Pour sudo : abeille-2027

zones-notes-sacha =
    NOTES DE SACHA (réseau de La Ruche)

    Pour que le réseau sorte sur internet, après un redémarrage du routeur
    (un jour je mettrai ça dans un fichier) :

      sudo sysctl -w net.ipv4.ip_forward=1
      sudo nft add table ip nat
      sudo nft 'add chain ip nat postrouting {"{"} type nat hook postrouting priority srcnat; {"}"}'
      sudo nft add rule ip nat postrouting oifname "eth0" masquerade

    Pas de filtrage : tout le monde voit tout, mais bon, on est entre nous.

## Événements

zones-event-without-translation =
    Le routeur transmet maintenant les paquets… et ils sortent par eth0
    avec leur adresse privée (10.10.x.x). Sur internet, personne ne sait
    où répondre à une adresse privée : elles sont réservées aux réseaux
    locaux (RFC 1918), et la box les jette. Il faut que le routeur les
    fasse sortir sous sa propre adresse (de la traduction d'adresses, ou
    NAT : man nft, masquerade). sudo conntrack -L montre les échanges
    restés sans réponse ([UNREPLIED]).
zones-event-responses =
    Les questions passent, mais pas les réponses : avec une politique
    drop, la réponse d'un serveur est un paquet comme un autre, qui entre
    par une interface où rien ne la permet. Le pare-feu suit les échanges
    (ct state) : il sait reconnaître une réponse à un échange déjà permis
    (established) et la laisser revenir.
zones-event-all-open =
    Internet marche partout… y compris là où il ne faut pas : le téléphone
    d'un visiteur atteint le NAS ou une caméra, ou la caméra sort sur
    internet. Par défaut, la chaîne forward laisse tout passer. La bonne
    méthode : tout fermer (policy drop), puis ouvrir seulement ce qui est
    voulu, zone par zone.
zones-event-ssh =
    Attention : avec ces règles, une nouvelle connexion ssh depuis le poste
    d'administration (192.0.2.2) serait refusée par la chaîne input. Ta
    session actuelle ne tient qu'à un fil : si elle se coupe, plus personne
    n'entre sur le routeur (sauf à brancher un écran dessus). Laisse passer
    ssh avant de fermer le reste.
zones-event-in-place =
    Tout marche comme Malik le voulait… en ce moment. Mais si le routeur
    redémarre, comme samedi ? sysctl -w et nft en ligne de commande ne
    durent pas. Les réglages du noyau s'écrivent dans /etc/sysctl.d (man
    sysctl.d), les règles dans /etc/nftables.conf, que le service nftables
    charge au démarrage… s'il est activé.
zones-event-end =
    Les bureaux sortent sur internet et impriment, le café a du wifi et ne
    voit que lui, les caméras restent à la maison, et tout tiendra au
    prochain redémarrage. Malik : « Sacha dit que c'est la première fois
    que le pare-feu est écrit quelque part. »

    Bravo ! Tu as terminé le chapitre « Les zones ».

    CE QUI S'EST PASSÉ
    Un routeur Linux ne transmet les paquets d'un réseau à l'autre que si
    on le lui permet (net.ipv4.ip_forward = 1). Les adresses des VLAN sont
    privées : pour sortir sur internet, le routeur remplace l'adresse
    source par la sienne (masquerade) et note l'échange pour rendre la
    réponse au bon appareil (le suivi de connexion, conntrack). La chaîne
    forward décide de ce qui traverse : on y ferme tout (policy drop), on
    laisse revenir les réponses (ct state established,related), puis on
    ouvre zone par zone (iifname, oifname).

    LA BONNE PRATIQUE
    - Fermer par défaut, ouvrir ce qui est voulu ; laisser passer les
      réponses une seule fois, en tête de chaîne.
    - Ne jamais s'enfermer dehors : ouvrir ssh (chaîne input) avant de
      fermer le reste, et tester avec nft -c avant de charger.
    - Ce qui doit durer va dans des fichiers : /etc/sysctl.d,
      /etc/nftables.conf, et systemctl enable nftables.
    - Un exemple de chaîne forward, pour ce réseau :

        chain forward {"{"}
            type filter hook forward priority filter; policy drop;
            ct state established,related accept
            iifname "eth1.10" accept
            iifname "eth1.20" oifname "eth0" accept
        {"}"}

    LA DOCUMENTATION
    - nft : https://www.netfilter.org/projects/nftables/manpage.html
    - NAT avec nftables : https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - Un routeur domestique : https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_home_router
    - sysctl.d : https://man7.org/linux/man-pages/man5/sysctl.d.5.html
