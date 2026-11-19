### Indices gradués du Bac (voir src/engine/hints.ts) : un message par
### étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans la
### commande exacte) et .solution (presque la réponse).

## Chapitre 1 — La nouvelle carte

hint-new-card-addresses =
    .lead = Regardez les adresses IPv6 du serveur, interface par interface (man ip ; -6 ne garde qu'une famille).
    .solution = ip -6 addr (ou ip a)
hint-new-card-route =
    .lead = Par où le trafic IPv6 part-il vers internet ? Les routes, famille IPv6 (man ip).
    .solution = ip -6 route
hint-new-card-router =
    .lead = Pinguez la passerelle de la route IPv6. C'est une adresse de lien local : elle a besoin de son interface (man ping).
    .solution = ping -6 -c 3 fe80::200:5eff:fe00:5301%eth0
hint-new-card-old-record =
    .lead = Quelle adresse IPv6 le DNS donne-t-il pour le site ? Demandez l'enregistrement AAAA (man dig).
    .solution = dig www.ferry.example AAAA
hint-new-card-static-now =
    .lead = Donnez tout de suite à eth0 l'adresse fixe que Rangi vous réserve, dans le préfixe (man ip, l'action addr add).
    .solution = sudo ip -6 addr add 2001:db8:4e1:20::80/64 dev eth0
hint-new-card-static-boot =
    .lead = Rendez-la durable : une strophe inet6 static pour eth0 dans /etc/network/interfaces, avec l'adresse et la longueur de son préfixe (man interfaces).
    .solution = sudo nano /etc/network/interfaces, ajoutez : iface eth0 inet6 static, puis address 2001:db8:4e1:20::80/64 et gateway fe80::200:5eff:fe00:5301 (en retrait).
hint-new-card-zone-loaded =
    .lead = Le fichier de zone de ferry.example est dans /etc/bind/zones : remplacez l'ancienne adresse dans ses enregistrements AAAA, vérifiez le fichier, et faites-le relire par named (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/zones/db.ferry.example (les AAAA), sudo named-checkzone ferry.example /etc/bind/zones/db.ferry.example, sudo rndc reload
hint-new-card-published =
    .lead = Le secondaire de la zone ne recopie une zone que si son numéro de série (le premier nombre du SOA) a augmenté. Comparez ce que donnent les deux serveurs (dig @…).
    .solution = Augmentez le numéro de série (2029041001), sudo rndc reload, puis dig @ns2.islenet.example www.ferry.example AAAA
hint-new-card-end =
    .lead = Tout doit tenir ensemble : l'adresse fixe maintenant et au démarrage, une route IPv6 par défaut, et les trois noms (ferry.example, www, quai) qui donnent cette adresse.
    .solution = ip -6 route (une route par défaut), ip -6 addr, dig @ns2.islenet.example quai.ferry.example AAAA

## Chapitre 2 — L'autre porte

hint-other-door-scan6 =
    .lead = Depuis la vigie, scannez quai en IPv6, comme islenet (man nmap, l'option -6).
    .solution = ssh vigie, puis nmap -6 quai.ferry.example
hint-other-door-scan4 =
    .lead = Le même scan, en IPv4, pour comparer.
    .solution = nmap quai.ferry.example
hint-other-door-sockets =
    .lead = Sur quai : quels programmes écoutent, sur quelles adresses (man ss) ?
    .solution = sudo ss -tlnp
hint-other-door-ruleset =
    .lead = Lisez les règles du pare-feu, et notez à quelle famille appartient leur table (man nft).
    .solution = sudo nft list ruleset (ou cat /etc/nftables.conf)
hint-other-door-closed-now =
    .lead = Une table pour les deux familles (inet), les mêmes règles, plus l'ICMPv6 dont la découverte des voisins a besoin ; chargez le fichier (man nft).
    .solution = sudo nano /etc/nftables.conf : table inet filter, et icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, packet-too-big, echo-request {"}"} accept ; puis sudo nft -c -f /etc/nftables.conf et sudo systemctl reload nftables
hint-other-door-closed-boot =
    .lead = Ce qui est chargé doit être ce que dit le fichier : le service nftables charge /etc/nftables.conf au démarrage.
    .solution = Écrivez les règles dans /etc/nftables.conf, puis sudo systemctl reload nftables
hint-other-door-end =
    .lead = Vérifiez depuis la vigie, dans les deux familles : ssh, le DNS et le site passent, 5432 et 8080 non ; et l'IPv6 doit rester allumé.
    .solution = nmap -6 -p 22,53,80,5432,8080 quai.ferry.example, puis la même chose sans -6

## Chapitre 3 — Les deux voies

hint-both-ways-refused6 =
    .lead = Depuis la vigie, demandez le site en IPv6 seulement, et observez la connexion (man curl : -6, -v).
    .solution = ssh vigie, puis curl -6 -v http://www.ferry.example/
hint-both-ways-sockets =
    .lead = Sur quai : qui écoute sur le port 80, et l'appli sur le 3000, sur quelles adresses (man ss) ?
    .solution = sudo ss -tlnp
hint-both-ways-bad-gateway =
    .lead = Demandez la page de réservation, à travers nginx (man curl).
    .solution = curl -i http://localhost/booking/
hint-both-ways-error-log =
    .lead = nginx écrit dans son journal d'erreurs pourquoi il n'a pas pu joindre l'appli.
    .solution = sudo tail /var/log/nginx/error.log
hint-both-ways-listen6 =
    .lead = Le bloc server de /etc/nginx/sites-available/ferry n'écoute le port 80 qu'en IPv4 : ajoutez une écoute IPv6, vérifiez, rechargez (man nginx).
    .solution = Ajoutez listen [::]:80 default_server; sous listen 80 default_server;, puis sudo nginx -t et sudo systemctl reload nginx
hint-both-ways-upstream-ok =
    .lead = nginx et l'appli doivent s'accorder sur une seule adresse de boucle locale : soit proxy_pass vers [::1], soit l'appli de retour sur 127.0.0.1 (/etc/default/booking).
    .solution = sudo nano /etc/default/booking : HOST=127.0.0.1, puis sudo systemctl restart booking (ou proxy_pass http://[::1]:3000/; et un reload de nginx)
hint-both-ways-end =
    .lead = Vérifiez depuis la vigie, dans chaque famille : les horaires et la page de réservation.
    .solution = curl -4 http://www.ferry.example/booking/ et curl -6 http://www.ferry.example/booking/
