### Histoire « La Ruche », chapitre « Le Wi-Fi des bureaux » : 802.1X avec
### FreeRADIUS et l'annuaire LDAP. Les commandes, les noms des fichiers et
### des attributs RADIUS ne se traduisent pas.

chapter-wifi = Le Wi-Fi des bureaux
    .summary = Fini le mot de passe Wi-Fi commun : chacun se connecte avec son compte de l'annuaire, et le serveur RADIUS place chaque personne dans son VLAN.

## Fichiers

wifi-email-malik =
    De :     Malik
    À :      toi
    Objet :  Le Wi-Fi des bureaux

    Le mot de passe du Wi-Fi des bureaux est sur un post-it depuis trois
    ans, et Camille le connaît toujours. L'électricien a installé une borne
    « d'entreprise » (WPA2-Entreprise, 802.1X) : chacun s'y connecte avec
    son propre compte de l'annuaire, et la borne met la personne dans le
    VLAN que lui indique le serveur RADIUS. Ses réglages sont dans
    borne-bureaux.txt.

    Le serveur RADIUS, c'est FreeRADIUS, déjà installé sur le routeur
    (/etc/freeradius/3.0, man freeradius). Ce qu'on veut :
    - les membres du groupe « bureaux » (Malik, Inès, Sami) : VLAN 10 ;
    - les autres comptes de l'annuaire (Léo, au café) : VLAN 20 ;
    - les comptes supprimés (Camille) : dehors.

    Pour tester sans la borne : radtest (man radtest). Et le journal du
    serveur : journalctl -u freeradius.

    Pour sudo : abeille-2027

# { $secret } : le secret partagé de la borne ; { $adresse } : son adresse
wifi-bound =
    BORNE WI-FI « BUREAUX » — réglages (l'électricien, février 2028)

    Adresse de la borne    : { $adresse } (VLAN 30, équipements)
    Réseau Wi-Fi (SSID)    : LaRuche-Bureaux
    Sécurité               : WPA2-Entreprise (802.1X), EAP-TTLS / PAP
    Serveur RADIUS         : 10.10.30.1, port 1812 (UDP)
    Secret partagé         : { $secret }
    VLAN dynamique         : oui (attribut Tunnel-Private-Group-Id)
    Port du commutateur    : 22, trunk : VLAN 10, 20, 30

## Événements

wifi-event-filter =
    La borne envoie ses demandes au routeur (UDP 1812)… et la chaîne input
    les jette : rien ne les laisse entrer depuis le VLAN des équipements.
    Le journal de freeradius reste muet : il ne les reçoit même pas.
wifi-event-not-reread =
    La configuration a changé sur le disque, mais freeradius tourne
    toujours avec l'ancienne : il ne relit ses fichiers qu'au démarrage
    (sudo freeradius -XC pour vérifier, puis systemctl restart freeradius).
wifi-event-unknown =
    Les demandes arrivent, mais freeradius ne répond pas (journalctl -u
    freeradius) : la borne n'est pas un client qu'il connaît, ou son secret
    partagé n'est pas le bon. Chaque borne se déclare dans clients.conf,
    avec son adresse et le même secret que dans ses réglages.
wifi-event-without-ldap =
    freeradius répond… non, à tout le monde : il ne connaît aucun mot de
    passe (« No known good password »). Les comptes sont dans l'annuaire,
    mais le module ldap n'est pas actif : les modules actifs sont des liens
    dans mods-enabled, vers mods-available.
wifi-event-anonymous =
    Le module ldap trouve bien les comptes… mais pas leurs mots de passe :
    il se présente en anonyme, et l'annuaire ne montre userPassword
    qu'aux comptes qui en ont le droit. Le module a besoin d'une identité
    (identity, password). Et sa base (base_dn) doit être celle de La Ruche.
wifi-event-groups =
    Malik entre, mais ne reçoit pas le VLAN 10 : Ldap-Group ne le trouve
    dans aucun groupe. Par défaut, le module ldap cherche l'attribut
    memberOf dans l'entrée de la personne… que cet annuaire n'a pas : ses
    groupes posixGroup listent leurs membres dans memberUid. Le module sait
    chercher autrement (membership_filter).
wifi-event-order =
    Malik reçoit le VLAN 20, comme Léo. Dans le fichier users, la première
    entrée qui correspond gagne : si l'entrée pour tout le monde passe
    avant celle du groupe bureaux, personne n'arrive jusqu'à la seconde.
wifi-event-in-place =
    Le Wi-Fi des bureaux marche… en ce moment. Au prochain démarrage ?
    La règle du pare-feu doit être dans /etc/nftables.conf (freeradius,
    lui, relit ses fichiers).
wifi-event-end =
    Malik, Inès et Sami entrent avec leur propre compte dans le VLAN des
    bureaux, Léo dans celui du café, et Camille reste dehors : il a suffi
    de supprimer son compte. Malik décolle le post-it.

    Bravo ! Tu as terminé le chapitre « Le Wi-Fi des bureaux », et
    l'histoire de La Ruche.

    CE QUI S'EST PASSÉ
    Avec 802.1X, la borne ne décide rien : elle demande au serveur RADIUS
    (Access-Request), qui vérifie le compte (ici, dans l'annuaire LDAP) et
    répond oui ou non, avec des attributs : Tunnel-Type = VLAN,
    Tunnel-Medium-Type = IEEE-802 et Tunnel-Private-Group-Id = 10 placent
    la personne dans le VLAN 10. La borne doit être déclarée (clients.conf)
    et partager un secret avec le serveur.

    LA BONNE PRATIQUE
    - Un compte par personne : un départ se règle en supprimant un compte,
      pas en changeant le mot de passe de tout le monde.
    - Pour lire l'annuaire, un compte de service à lui, en lecture seule,
      plutôt que l'administrateur (et les droits de slapd en conséquence).
    - freeradius -XC avant de redémarrer, freeradius -X (service arrêté)
      pour comprendre un refus, radtest pour tester.

    LA DOCUMENTATION
    - Le module ldap : https://wiki.freeradius.org/modules/Rlm_ldap
    - Le fichier users : https://wiki.freeradius.org/config/Users
    - VLAN par RADIUS (RFC 3580) : https://www.rfc-editor.org/rfc/rfc3580
