### Histoire « La Collecte », chapitre « Le Cerveau coupé en deux » : les
### deux répartiteurs tiennent l'adresse virtuelle après des travaux réseau
### (un pare-feu qui jette VRRP sur lb2, de nouveaux routeurs avec le même
### virtual_router_id). ip a, journalctl, tcpdump, nft, virtual_router_id,
### unicast_peer. Les commandes, options, chemins et sorties ne se
### traduisent pas.

chapter-split-brain = Le Cerveau coupé en deux
    .summary = Après une nuit de travaux réseau, la moitié des connexions des donneur·ses se coupent. Les deux répartiteurs se croient chacun aux commandes : trouvez pourquoi ils ne s'entendent plus, et rendez-leur une seule voix.

## Fichiers

split-brain-message-kirsi =
    De : Kirsi (équipe réseau)
    Mercredi 5 juin, 9 h 20

    Bonjour,

    Cette nuit (mardi, à partir de 21 h 30), nous avons installé les
    nouveaux routeurs de bordure : une paire, edge-a (192.0.2.252) et
    edge-b (192.0.2.253), qui partagent la passerelle 192.0.2.254 avec
    VRRP, pour que la passerelle survive à la panne d'un routeur. Tant
    qu'on y était, nous avons appliqué notre socle de durcissement (v3,
    nftables) à lb2 ; lb1 l'aura la semaine prochaine.

    Ce matin, le journal des routeurs est plein de lignes comme celles-ci :
      arp: 192.0.2.108 moved from 52:54:00:6c:01:04 to 52:54:00:6c:01:05 on vlan20
      arp: 192.0.2.108 moved from 52:54:00:6c:01:05 to 52:54:00:6c:01:04 on vlan20
      vrrp: VRID 51: advert from 192.0.2.104 with a different address list, ignored

    Deux machines répondent pour 192.0.2.108. Je suis sûre que ce ne sont
    pas les routeurs ;)

    Kirsi

split-brain-message-zainab =
    De : Zainab (service des donneur·ses)

    Des donneur·ses écrivent que le site « plante une fois sur deux » : la
    page s'affiche, puis le clic suivant échoue, puis ça remarche. Vous
    pouvez regarder ?

    Zainab

## Événements

split-brain-event-two-masters =
    lb2 tient aussi 192.0.2.108 : deux maîtres. La passerelle apprend
    l'adresse MAC de celui qui a répondu en dernier, et chaque bascule coupe
    les connexions qui étaient sur l'autre. Cerveau coupé en deux (split
    brain) : chaque nœud croit l'autre disparu. Demandez pourquoi à
    keepalived sur chacun (journalctl -u keepalived).
split-brain-event-lower-priority =
    lb1 entend les annonces de lb2 (priorité 100, plus basse que ses 101)
    et le lui dit chaque seconde (« forcing new election »). Mais lb2 se
    comporte comme s'il n'entendait rien. lb2 reçoit-il les annonces de
    lb1 ? tcpdump sur lb2 montre ce qui arrive à sa carte réseau (VRRP est
    le protocole IP 112).
split-brain-event-on-the-wire =
    Les annonces de lb1 arrivent à la carte réseau de lb2 : tcpdump les
    voit. Mais tcpdump regarde les paquets avant le pare-feu, keepalived
    après. Quelque chose les jette à l'entrée de lb2 : regardez son
    pare-feu (nft list ruleset).
split-brain-event-ruleset =
    La chaîne input du socle jette tout ce qu'elle n'autorise pas (policy
    drop), et rien n'autorise VRRP : le protocole 112, envoyé à 224.0.0.18.
    lb2 n'entend jamais lb1, alors il a pris l'adresse. Laissez entrer VRRP
    (man nft : ip protocol, ip daddr), maintenant et dans /etc/nftables.conf.
split-brain-event-stopped =
    Avec keepalived arrêté sur un nœud, il n'y a plus qu'un maître, mais
    plus de secours non plus : la prochaine panne fera tomber le site. Le
    nœud doit rester dans le groupe, et entendre l'autre.
split-brain-event-priorities =
    Les priorités ne comptent qu'entre des nœuds qui s'entendent : tant que
    le pare-feu de lb2 jette les annonces de lb1, chaque nœud est seul dans
    son élection, et chacun la gagne.
split-brain-event-single-master =
    Un seul maître de nouveau : lb2 entend lb1, voit une priorité plus
    haute, et est repassé BACKUP (il a retiré l'adresse). Les connexions
    des donneur·ses cessent de se couper.
split-brain-event-persisted =
    Et le /etc/nftables.conf de lb2 laisse entrer VRRP lui aussi : le
    prochain redémarrage, de la machine ou de nftables, ne ramènera pas le
    cerveau coupé. Prévenez Kirsi, pour que le socle v4 l'inclue pour lb1.
split-brain-event-clash =
    Un autre groupe VRRP partage le lien : edge-a annonce le VRID 51
    (priorité 120, adresse 192.0.2.254), le même virtual_router_id que
    votre paire. keepalived jette ses annonces comme « bogus » (une autre
    liste d'adresses), et les routeurs notent les vôtres. Le même VRID pour
    deux groupes sur un lien, c'est chercher les ennuis : l'un des deux
    doit changer, et le VRID des routeurs appartient à l'équipe réseau.
split-brain-event-vrid-half =
    lb1 et lb2 n'ont plus le même virtual_router_id : ils sont maintenant
    dans deux groupes VRRP différents, et chacun est maître du sien. Les
    deux nœuds doivent utiliser le même VRID.
split-brain-event-vrid =
    Votre paire ne croise plus le groupe des routeurs : son propre
    virtual_router_id sur les deux nœuds (ou des annonces en unicast entre
    les deux).
split-brain-event-end =
    Kirsi : « Le journal des routeurs est calme, et le socle v4 autorisera
    VRRP sur les deux répartiteurs. Désolée pour lb2 ! » Zainab : « Les
    donneur·ses ont arrêté d'écrire. Merci ! »

    Bravo ! Vous avez terminé Le Cerveau coupé en deux.

    CE QUI S'EST PASSÉ
    Mardi soir, le socle de durcissement a donné à lb2 une chaîne input qui
    jetait tout ce qu'elle n'autorisait pas, VRRP compris. lb2 a cessé
    d'entendre lb1 et a pris l'adresse lui aussi : deux maîtres, une
    passerelle dont l'entrée ARP basculait de l'un à l'autre, une connexion
    de donneur·se sur deux coupée. La même nuit, les nouveaux routeurs de
    bordure ont lancé un groupe VRRP avec le même VRID, 51. Vous avez
    trouvé les deux maîtres (ip a), vu que les annonces de lb1 arrivaient
    à la carte de lb2 (tcpdump) mais pas à son keepalived (nft), laissé
    entrer VRRP pour de bon, et sorti votre paire du VRID 51.

    BONNES PRATIQUES
    - Deux maîtres, c'est deux nœuds qui ne s'entendent pas : suivez le
      chemin des annonces (tcpdump côté récepteur, puis son pare-feu), pas
      les priorités.
    - Le pare-feu d'un nœud VRRP doit laisser entrer le protocole 112 (du
      voisin, vers 224.0.0.18 ou vers l'adresse du voisin avec
      unicast_peer). Rendez-le persistant.
    - Un VRID par groupe sur un lien. Convenez des numéros avec l'équipe
      réseau, ou utilisez unicast_peer.
    - Surveillez « deux maîtres » (l'adresse sur les deux nœuds) comme une
      alerte à part entière : un cerveau coupé n'arrête pas un site, il le
      rend peu fiable.

    DOCUMENTATION
    - keepalived.conf(5) : https://www.keepalived.org/manpage.html
    - nft(8) : https://www.netfilter.org/projects/nftables/manpage.html
    - tcpdump(1) : https://www.tcpdump.org/manpages/tcpdump.1.html
    - VRRP (RFC 3768) : https://www.rfc-editor.org/rfc/rfc3768
