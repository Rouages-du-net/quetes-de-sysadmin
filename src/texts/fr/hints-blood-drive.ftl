### Indices gradués de La Collecte (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans
### la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — La Bascule qui n'a pas eu lieu

hint-no-failover-haproxy-dead =
    .lead = Le site est en panne : le service du répartiteur tourne-t-il sur lb1 ? Demandez à systemd.
    .solution = systemctl status haproxy (et journalctl -u haproxy)
hint-no-failover-vip-on-lb1 =
    .lead = Quel répartiteur tient l'adresse du site, 192.0.2.108 ? Regardez les interfaces de lb1.
    .solution = ip a (l'adresse est sur eth0, « secondary »)
hint-no-failover-no-tracking =
    .lead = Que surveille keepalived sur lb1 ? Lisez sa configuration, et cherchez une vérification de haproxy (man keepalived.conf).
    .solution = cat /etc/keepalived/keepalived.conf
hint-no-failover-tracking =
    .lead = Ajoutez un vrrp_script qui vérifie que haproxy tourne (avec un poids qui fait passer lb1 sous lb2, ou 0), suivez-le dans le vrrp_instance, vérifiez le fichier et rechargez keepalived.
    .solution = sudo nano /etc/keepalived/keepalived.conf : vrrp_script chk_haproxy avec script "/usr/bin/killall -0 haproxy", interval 2, weight -20, et track_script avec chk_haproxy dans VI_1 ; sudo keepalived -t ; sudo systemctl reload keepalived
hint-no-failover-failed-over =
    .lead = haproxy étant mort sur lb1, la vérification échoue et l'adresse devrait bouger : regardez le journal de keepalived et les interfaces des deux nœuds. Si elle ne bouge pas, lb2 a-t-il le droit de la prendre (nopreempt) ?
    .solution = sudo journalctl -u keepalived ; ip a ; ssh lb2 puis ip a ; curl -s http://donate.lindenvale.example/
hint-no-failover-haproxy-back =
    .lead = Remettez haproxy en route sur lb1 (systemd l'a abandonné après trop d'échecs).
    .solution = sudo systemctl restart haproxy (ou sudo systemctl reset-failed haproxy, puis start)
hint-no-failover-lb2-tracked =
    .lead = Une bascule doit marcher dans les deux sens : lb2 doit surveiller son propre haproxy de la même façon.
    .solution = ssh lb2 ; le même vrrp_script et le même track_script dans son keepalived.conf ; sudo keepalived -t ; sudo systemctl reload keepalived
hint-no-failover-end =
    .lead = Prouvez-le : arrêtez haproxy sur le maître, voyez l'adresse bouger et le site répondre encore, puis relancez-le.
    .solution = sudo systemctl stop haproxy ; sleep 10 ; ip a ; curl -s http://donate.lindenvale.example/ ; sudo systemctl start haproxy

## Chapitre 2 — Le Serveur malade

hint-sick-server-errors =
    .lead = Quel serveur répond les erreurs ? Le journal de HAProxy dit quel serveur a servi chaque requête ; ou interrogez le site plusieurs fois.
    .solution = sudo tail /var/log/haproxy.log (ou curl -si http://donate.lindenvale.example/ plusieurs fois : x-served-by)
hint-sick-server-no-check =
    .lead = Demandez à HAProxy, par sa socket d'exécution, comment il voit ses serveurs (le message de Teodor, man socat).
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f1,2,18,37
hint-sick-server-http-check =
    .lead = Donnez aux serveurs une vérification qui demande la page /health de l'application en HTTP et attend 200 (man haproxy ; check, option httpchk, http-check expect), vérifiez le fichier, rechargez.
    .solution = dans le backend be_booking : option httpchk GET /health, http-check expect status 200, et check sur chaque ligne server ; sudo haproxy -c -f /etc/haproxy/haproxy.cfg ; sudo systemctl reload haproxy
hint-sick-server-lb2-synced =
    .lead = lb2 doit vérifier de la même façon, au cas où il prendrait l'adresse.
    .solution = ssh lb2 ; les mêmes modifications dans /etc/haproxy/haproxy.cfg ; sudo haproxy -c -f /etc/haproxy/haproxy.cfg ; sudo systemctl reload haproxy
hint-sick-server-drained =
    .lead = Sortez web2 du lot sur le maître sans modifier le fichier : l'API d'exécution peut changer l'état d'un serveur (drain).
    .solution = echo "set server be_booking/web2 state drain" | sudo socat stdio /run/haproxy/admin.sock
hint-sick-server-tech-working =
    .lead = Le technicien attend que web2 n'ait plus aucune session : surveillez son scur dans show stat.
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | grep web2 | cut -d, -f2,5,18
hint-sick-server-tech-done =
    .lead = Laissez le technicien finir (une minute environ) : sleep, et regardez le journal de HAProxy.
    .solution = sleep 30 ; sudo tail /var/log/haproxy.log
hint-sick-server-end =
    .lead = web2 est réparé : remettez-le dans le lot par l'API d'exécution.
    .solution = echo "set server be_booking/web2 state ready" | sudo socat stdio /run/haproxy/admin.sock

## Chapitre 3 — Le Cerveau coupé en deux

hint-split-brain-two-masters =
    .lead = Qui tient 192.0.2.108 ? Regardez sur les deux répartiteurs.
    .solution = ip a ; ssh lb2 puis ip a
hint-split-brain-lower-priority =
    .lead = Demandez à keepalived sur lb1 ce qu'il entend.
    .solution = sudo journalctl -u keepalived -n 30
hint-split-brain-on-the-wire =
    .lead = lb2 reçoit-il les annonces de lb1 ? Capturez VRRP sur l'eth0 de lb2 (man tcpdump).
    .solution = sur lb2 : sudo tcpdump -i eth0 -c 10 vrrp
hint-split-brain-ruleset =
    .lead = Les annonces arrivent à la carte mais pas à keepalived : regardez le pare-feu de lb2.
    .solution = sur lb2 : sudo nft list ruleset
hint-split-brain-single-master =
    .lead = Laissez entrer VRRP (le protocole IP 112, vers 224.0.0.18) dans la chaîne input de lb2 (man nft).
    .solution = sur lb2 : sudo nft add rule inet filter input ip protocol vrrp accept
hint-split-brain-persisted =
    .lead = Une règle ajoutée avec nft disparaît au prochain démarrage : écrivez-la dans /etc/nftables.conf, vérifiez-le, et chargez-le.
    .solution = sur lb2 : sudo nano /etc/nftables.conf (ip protocol vrrp accept dans la chaîne input) ; sudo nft -c -f /etc/nftables.conf ; sudo systemctl restart nftables
hint-split-brain-clash =
    .lead = Qui d'autre parle VRRP sur ce lien ? Capturez sur lb1, ou cherchez des paquets « bogus » dans le journal de keepalived.
    .solution = sudo tcpdump -i eth0 -c 10 vrrp ; sudo journalctl -u keepalived | grep bogus
hint-split-brain-vrid =
    .lead = Sortez votre paire du virtual_router_id des routeurs, la même nouvelle valeur sur les deux nœuds (ou unicast_peer sur les deux), et rechargez keepalived sur les deux.
    .solution = virtual_router_id 61 dans /etc/keepalived/keepalived.conf sur lb1 et sur lb2 ; sudo keepalived -t ; sudo systemctl reload keepalived (sur les deux)
hint-split-brain-end =
    .lead = Vérifiez qu'un seul nœud tient l'adresse et que l'autre est BACKUP, et que le site répond à chaque fois.
    .solution = ip a sur les deux ; sudo journalctl -u keepalived -n 5 ; curl -s http://donate.lindenvale.example/
