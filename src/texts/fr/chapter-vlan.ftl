### Histoire « La Ruche », chapitre « Les VLAN » : un routeur Debian derrière
### un commutateur découpé en VLAN. Les commandes, les noms d'interfaces et la
### syntaxe de /etc/network/interfaces ne se traduisent pas.

chapter-vlan = Les VLAN
    .summary = Le commutateur a été découpé en trois VLAN ; le routeur, lui, parle encore à plat. Des interfaces 802.1Q, et qu'elles tiennent au redémarrage.

## Fichiers

vlan-email-malik =
    De :     Malik (régisseur de La Ruche)
    À :      toi
    Objet :  Plus de réseau depuis ce matin

    L'électricien est passé ce week-end : il a « découpé le réseau en VLAN »
    sur le commutateur, pour que le wifi des invité·es ne voie plus nos
    ordinateurs, ni l'imprimante, ni les caméras. Son plan est dans
    plan-commutateur.txt.

    Depuis, plus rien ne marche : même le NAS des bureaux ne répond plus !
    Il m'a dit : « c'est au routeur de suivre, il faut lui créer les
    interfaces VLAN ». Le routeur, c'est cette machine (eth0 vers la box du
    fournisseur, eth1 vers le commutateur).

    Le prestataire d'avant configurait le réseau dans /etc/network/interfaces
    (man interfaces). Et pour voir ce qui se passe en ce moment : man ip.

    Pour sudo : abeille-2027

vlan-plan-switch =
    PLAN DU COMMUTATEUR — La Ruche (électricien, novembre 2027)

    Port 1     : vers le routeur (eth1). TRUNK 802.1Q : VLAN 10, 20, 30
                 étiquetés (tagged). Plus rien en VLAN natif.
    Ports 2-12 : VLAN 10 « bureaux »      (non étiquetés)
    Ports 13-16: VLAN 20 « invites »      (bornes wifi du café)
    Ports 17-20: VLAN 30 « equipements »  (imprimante, caméras)

    Adresses (à configurer sur le routeur) :
      VLAN 10  bureaux      10.10.10.0/24   routeur : 10.10.10.1
      VLAN 20  invites      10.10.20.0/24   routeur : 10.10.20.1
      VLAN 30  equipements  10.10.30.0/24   routeur : 10.10.30.1

    Appareils à adresse fixe :
      nas           10.10.10.5   (VLAN 10)
      imprimante    10.10.30.10  (VLAN 30)
      camera-entree 10.10.30.11  (VLAN 30)

## Événements

vlan-event-bad-number =
    Une de tes interfaces VLAN porte l'adresse d'un réseau… mais pas le bon
    numéro de VLAN : ses trames partent étiquetées avec un autre numéro, et
    le commutateur ne les met pas dans le bon VLAN. Un ping vers un appareil
    de ce réseau le montre (Destination Host Unreachable). Vérifie avec
    ip -d link show.
vlan-event-in-place =
    Les trois VLAN répondent : le NAS, l'imprimante et la caméra aussi (ping).
    Mais ce que tu as fait avec ip disparaîtra au prochain redémarrage : seul
    /etc/network/interfaces est relu au démarrage. Écris-y les trois VLAN
    (man interfaces), puis ifup.
vlan-event-end =
    Les trois VLAN sont montés, et écrits pour durer. Malik : « Le NAS est
    revenu ! Et le wifi du café ne voit plus l'imprimante, c'est ce que
    voulait l'électricien. »

    Bravo ! Tu as terminé le chapitre « Les VLAN ».

    CE QUI S'EST PASSÉ
    Un VLAN découpe un commutateur en plusieurs réseaux séparés. Sur un port
    « trunk », plusieurs VLAN passent par le même câble : chaque trame porte
    une étiquette 802.1Q avec son numéro. Le routeur doit donc avoir une
    interface par VLAN (eth1.10, eth1.20, eth1.30), avec son adresse dans
    chaque réseau. Sans étiquette, ses trames tombaient dans le VLAN natif,
    où il n'y a plus personne.

    LA BONNE PRATIQUE
    - Un VLAN par usage : bureaux, invité·es, équipements (imprimantes,
      caméras, téléphones), administration.
    - Le plan écrit quelque part (numéros, réseaux, ports), et tenu à jour.
    - ip pour essayer, /etc/network/interfaces (ou systemd-networkd) pour
      que ça dure ; ip -d link show pour vérifier le numéro.
    - Le VLAN natif d'un trunk : vide, ou au moins pas celui des
      équipements sensibles.

    UNE AUTRE VOIE
    systemd-networkd (fichiers .netdev et .network) ou NetworkManager
    (nmcli) décrivent les mêmes VLAN autrement. Debian garde ifupdown sur
    les serveurs ; Ubuntu passe par netplan, qui écrit la configuration de
    systemd-networkd. Le principe ne change pas : une interface par VLAN,
    sur la carte reliée au trunk.

    LA DOCUMENTATION
    - interfaces (Debian) : https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - VLAN dans interfaces : https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html
    - ip link : https://man7.org/linux/man-pages/man8/ip-link.8.html
