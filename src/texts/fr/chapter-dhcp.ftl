### Histoire « La Ruche », chapitre « Le DHCP » : dnsmasq sert des adresses
### dans chaque VLAN. Les options de dnsmasq, les commandes et les chemins ne
### se traduisent pas.

chapter-dhcp = Le DHCP
    .summary = Les VLAN sont là, mais personne n'a d'adresse : une plage DHCP par VLAN avec dnsmasq, une réservation pour l'imprimante, et pas un mot vers la box.

## Fichiers

dhcp-email-malik =
    De :     Malik
    À :      toi
    Objet :  Les VLAN, c'est bien, mais…

    Le NAS et la caméra répondent, merci ! Mais les ordinateurs des bureaux
    et le wifi du café n'ont toujours pas d'adresse. Ils la demandent au
    routeur en DHCP : c'est dnsmasq qui s'en occupe (/etc/dnsmasq.d,
    man dnsmasq). Il sert encore l'ancien réseau à plat.

    Autre chose : on a reçu la nouvelle imprimante. Elle ne sait que
    demander son adresse en DHCP, mais tous les postes l'attendent à
    10.10.30.10. Son adresse MAC est sur l'étiquette : 00:00:5e:00:53:30.

    Et l'électricien m'a fait promettre de te dire : « surtout, que le
    DHCP ne réponde JAMAIS du côté de la box ». Je n'ai pas tout compris.

    Le journal (journalctl -u dnsmasq) et le fichier des baux
    (/var/lib/misc/dnsmasq.leases) disent qui a reçu quoi.

    Pour sudo : abeille-2027

## Événements

dhcp-event-wan =
    Attention : dnsmasq écoute toutes les interfaces, y compris eth0, le
    réseau du fournisseur d'accès. Un serveur DHCP qui répond chez le voisin
    (un « DHCP pirate »), c'est le genre de panne qui coupe tout un quartier.
    Dis à dnsmasq où il a le droit d'écouter (interface=, ou
    except-interface=eth0).
# { $address } : l'adresse attendue de l'imprimante
dhcp-event-printer-elsewhere =
    L'imprimante a reçu une adresse… mais pas { $address }, et les postes ne
    la trouvent pas. dnsmasq sait réserver une adresse à un appareil, d'après
    son adresse MAC (man dnsmasq : dhcp-host).
dhcp-event-end =
    Chaque appareil a son adresse dans son VLAN, l'imprimante est à sa place,
    et la box n'entend rien. Malik : « Le café a du wifi, les bureaux ont
    internet… enfin, presque : il paraît que ça ne sort pas encore. »

    Bravo ! Tu as terminé le chapitre « Le DHCP ».

    CE QUI S'EST PASSÉ
    Un appareil qui arrive sur un réseau crie « quelqu'un peut me donner une
    adresse ? » (DHCPDISCOVER). Le serveur DHCP du réseau répond (OFFER),
    l'appareil accepte (REQUEST), le serveur confirme (ACK) et note le bail.
    dnsmasq choisit la plage d'après l'interface où la demande arrive : une
    plage par VLAN, dans le réseau de chaque interface.

    LA BONNE PRATIQUE
    - Une plage par réseau, et des réservations (MAC → adresse) pour ce qui
      doit être trouvé : imprimantes, serveurs, caméras.
    - Limiter les interfaces où le DHCP écoute : jamais du côté internet.
    - dnsmasq --test avant de redémarrer ; le journal et le fichier des baux
      pour vérifier.

    UNE AUTRE VOIE
    Kea, le serveur DHCP de l'ISC, qui remplace isc-dhcp-server (en fin de
    vie depuis fin 2022) : bases de données, haute disponibilité, API,
    mais plus lourd à installer. dnsmasq fait DHCP et cache DNS en un seul
    petit programme : idéal pour un petit réseau.

    LA DOCUMENTATION
    - dnsmasq : https://dnsmasq.org/docs/dnsmasq-man.html
