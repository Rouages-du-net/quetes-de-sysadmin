### Histoire « Le Bac », chapitre « La nouvelle carte » : l'adresse SLAAC
### de quai a suivi sa nouvelle carte réseau, les enregistrements AAAA
### nomment toujours l'ancienne. ip -6, lien local et %eth0, une adresse
### fixe (inet6 static), la zone BIND et son numéro de série. Les
### commandes, options, adresses, chemins et sorties ne sont pas traduits.

chapter-new-card = La nouvelle carte
    .summary = Depuis que le serveur de la coopérative du bac a une nouvelle carte réseau, son site ne répond plus en IPv6, seulement pour les passager·es sur données mobiles. Lisez ses adresses et ses routes IPv6, donnez-lui une adresse qui ne bougera plus, et publiez-la dans la zone DNS.

## Fichiers

new-card-message-amaru =
    De : Amaru (coopérative du bac)
    Mardi 10 avril, 9 h

    Bonjour, et bienvenue à bord !

    Quelque chose cloche avec le site depuis la semaine dernière, et
    seulement pour certaines personnes. Sur le Wi-Fi du bureau, les
    horaires s'affichent tout de suite. Sur mon téléphone, en données
    mobiles, ça tourne longtemps ; parfois ça finit par s'afficher, parfois
    le site est « inaccessible ». Des passager·es ont appelé.

    Mardi dernier, la carte réseau du serveur a lâché. Le magasin
    d'informatique du continent en a mis une neuve, et tout est reparti.
    Depuis, je crois. Tevita, qui avait installé le serveur, est parti sur
    le continent ; au téléphone, il m'a dit que l'internet de l'île était
    « passé en IPv6 » il y a un mois, et qu'il avait « ajouté les AAAA ».

    Rangi, chez islenet, a envoyé un courriel au sujet des adresses : il
    est dans votre dossier personnel. islenet nous prête aussi sa machine
    de surveillance, vigie, pour regarder le serveur depuis l'extérieur
    (ssh vigie).

    Amaru

new-card-email-rangi =
    De : Rangi (islenet, la coopérative de fibre de l'île)
    À : la coopérative du bac
    Objet : IPv6, l'adresse de votre serveur

    Bonjour,

    Comme annoncé, l'IPv6 est actif depuis le 5 mars. Notre routeur annonce
    le préfixe de votre lien, { $prefix }, et votre serveur s'y construit
    lui-même une adresse (SLAAC). C'est très bien pour un portable. Pour un
    serveur dont l'adresse est dans le DNS, je conseille une adresse fixe :
    nous vous réservons { $address } dans nos registres. Notre routeur est
    2001:db8:4e1:20::1 sur ce lien (vous verrez son adresse de lien local
    comme passerelle).

    Votre zone DNS reste la vôtre : ns1, c'est votre serveur, et
    ns2.islenet.example, notre secondaire, recopie la zone quand son numéro
    de série augmente.

    Rangi

## Événements

new-card-event-addresses =
    eth0 a trois sortes d'adresses IPv6. fe80::…/64, « scope link » :
    l'adresse de lien local, que toute interface IPv6 se donne et qui ne
    vaut que sur son propre lien. 2001:db8:4e1:20:…/64, « scope global
    dynamic » : une adresse globale, construite par SLAAC, avec le préfixe
    du routeur (les 64 premiers bits) et un identifiant que la machine
    calcule elle-même. Et lo a ::1. Regardez bien la fin des deux adresses
    d'eth0, et l'adresse MAC de la carte (ip link).
new-card-event-mac =
    L'adresse MAC de la nouvelle carte est 00:00:5e:00:53:7c. Insérez ff:fe
    au milieu, inversez un bit du premier octet (00 devient 02) :
    0200:5eff:fe00:537c. C'est la fin des deux adresses d'eth0 :
    l'identifiant d'interface « EUI-64 modifié ». Nouvelle carte, nouvelle
    MAC, donc nouvelle adresse IPv6.
new-card-event-route =
    La route IPv6 par défaut passe « via fe80::200:5eff:fe00:5301 dev eth0
    proto ra » : par l'adresse de lien local du routeur, apprise par ses
    annonces (ra : router advertisement). Une adresse de lien local existe
    sur tous les liens à la fois : pour la joindre, il faut dire lequel.
new-card-event-zone-needed =
    ping ne sait pas sur quel lien envoyer vers une adresse de lien local :
    chaque interface a son fe80::/64. Ajoutez l'interface après un % :
    fe80::200:5eff:fe00:5301%eth0 (ou ping -I eth0).
new-card-event-router =
    Le routeur répond sur son adresse de lien local : le lien marche en
    IPv6. Le serveur est donc joignable… à sa nouvelle adresse. Que donne
    le DNS ? (dig, le type AAAA)
new-card-event-old-record =
    Voilà : le DNS donne toujours 2001:db8:4e1:20:200:5eff:fe00:532a,
    l'adresse que l'ancienne carte s'était construite (sa MAC finissait par
    53:2a). Plus personne n'a cette adresse : les téléphones qui essaient
    d'abord l'IPv6 attendent dans le vide, puis se rabattent sur l'IPv4
    quand ils le peuvent. Le conseil de Rangi : une adresse qui ne dépend
    pas de la carte.
new-card-event-cut =
    La session ssh est tombée : ifdown eth0 a éteint l'interface même par
    laquelle vous étiez connecté·e. Amaru, au bureau, a tapé ifup eth0 sur
    l'écran du serveur, et c'est reparti (ssh quai). Par ssh, on change une
    adresse avec ip, ou on relance le réseau d'un seul coup (systemctl
    restart networking), jamais ifdown seul.
new-card-event-already =
    ifup refuse : eth0 est déjà montée (ifupdown s'en souvient dans
    /run/network/ifstate). Pour appliquer le fichier sans couper votre
    propre session, systemctl restart networking descend et remonte tout
    d'un coup ; ou ajoutez l'adresse tout de suite avec ip -6 addr add, et
    laissez le fichier pour le prochain démarrage.
new-card-event-wrong-prefix =
    Cette adresse n'est pas dans le préfixe du lien ({ $prefix }) : le
    routeur ne lui enverra jamais rien. Supprimez-la (ip -6 addr del, et le
    fichier) et prenez-en une dans le préfixe, celle que Rangi vous réserve.
new-card-event-static-now =
    eth0 porte maintenant une adresse fixe dans le préfixe, à côté de
    l'adresse SLAAC. Elle n'est là que jusqu'au prochain redémarrage :
    écrivez-la dans /etc/network/interfaces (une strophe « iface eth0 inet6
    static », man interfaces).
new-card-event-static-boot =
    Au prochain démarrage, ifupdown donnera à eth0 son adresse fixe, et la
    route IPv6 sera toujours là. Maintenant, le DNS.
new-card-event-no-route-boot =
    Attention : avec ce fichier, eth0 démarrerait avec son adresse mais sans
    route IPv6 par défaut (accept_ra 0 refuse les annonces du routeur, et il
    n'y a pas de gateway). Ajoutez la passerelle (l'adresse de lien local du
    routeur), ou laissez accept_ra tranquille.
new-card-event-no-route =
    quai n'a plus de route IPv6 par défaut : il ne joint plus que son propre
    lien. Rétablissez les annonces du routeur (accept_ra), ou donnez une
    passerelle : ip -6 route add default via fe80::200:5eff:fe00:5301 dev eth0.
new-card-event-zone-loaded =
    named a chargé la nouvelle zone : dig @localhost donne la nouvelle
    adresse. Et le reste d'internet ? Il interroge aussi ns2.islenet.example.
new-card-event-serial =
    Votre serveur donne la nouvelle adresse, mais ns2.islenet.example, le
    secondaire, donne toujours l'ancienne : il ne recopie la zone que si
    son numéro de série (le premier nombre du SOA) augmente.
    Augmentez-le (la convention : la date et un compteur, 2029041001),
    vérifiez le fichier (named-checkzone), rndc reload.
new-card-event-slaac-record =
    Le DNS donne maintenant l'adresse construite par la nouvelle carte. Ça
    marche aujourd'hui, et ça recassera au prochain changement de carte (ou
    de carte mère). L'adresse d'un serveur dans le DNS doit être fixe.
new-card-event-published =
    Les serveurs publics de la zone donnent l'adresse fixe de quai, pour
    ferry.example, www et quai. La vigie peut le vérifier depuis
    l'extérieur (ssh vigie, puis ping6 www.ferry.example).
new-card-event-seen-outside =
    Depuis internet, www.ferry.example répond au ping en IPv6, à son
    adresse fixe.
new-card-event-end =
    Amaru : « Sur mon téléphone, les horaires s'affichent tout de suite
    maintenant. Merci ! » (Entre nous, son téléphone reçoit encore la page
    en IPv4 : essayez curl -6 depuis la vigie. Ce sera pour un autre jour.)

    Bravo ! Vous avez terminé le chapitre 1 du Bac. (La suite vous attend :
    ssh quai.)

    CE QUI S'EST PASSÉ
    quai se construisait lui-même son adresse IPv6 (SLAAC) : le préfixe
    annoncé par le routeur, puis un identifiant calculé à partir de
    l'adresse MAC de la carte réseau (EUI-64 modifié). La nouvelle carte a
    apporté une nouvelle adresse, mais les enregistrements AAAA nommaient
    toujours l'ancienne : les clients IPv6 frappaient à une adresse que
    personne n'avait. Vous avez donné à quai une adresse fixe,
    { $address }, tout de suite (ip -6 addr add) et au démarrage (iface
    eth0 inet6 static), et vous l'avez publiée : les enregistrements AAAA,
    un numéro de série plus grand, named-checkzone, rndc reload.

    BONNES PRATIQUES
    - Un serveur dans le DNS a une adresse IPv6 fixe ; SLAAC, c'est pour
      les machines que personne ne cherche par leur nom.
    - ip -6 addr : scope link (fe80::, valable sur un seul lien) et scope
      global ; ip -6 route : la passerelle est souvent l'adresse de lien
      local du routeur.
    - Une adresse de lien local a besoin de son interface : fe80::…%eth0.
    - Par ssh, on ne fait jamais ifdown sur l'interface par laquelle on est
      connecté·e.
    - Chaque modification d'une zone augmente son numéro de série, sinon
      les secondaires gardent l'ancienne version.
    - On vérifie depuis l'extérieur, dans chaque famille : ping -6, curl -6.

    DOCUMENTATION
    - SLAAC (RFC 4862) : https://www.rfc-editor.org/rfc/rfc4862
    - Le fichier interfaces, famille inet6 : https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - ip address : https://man7.org/linux/man-pages/man8/ip-address.8.html
    - BIND 9, les fichiers de zone : https://bind9.readthedocs.io/en/stable/chapter3.html
