### Histoire « La Collecte », chapitre « La Bascule qui n'a pas eu lieu » :
### haproxy est mort sur lb1 mais keepalived y a gardé l'adresse virtuelle.
### keepalived.conf, vrrp_script, track_script, weight, nopreempt,
### systemctl reload, ip a, journalctl. Les commandes, options, chemins et
### sorties ne se traduisent pas.

chapter-no-failover = La Bascule qui n'a pas eu lieu
    .summary = Deux répartiteurs de charge, une adresse virtuelle, et pourtant le site de rendez-vous des donneur·ses est en panne depuis l'aube. Trouvez pourquoi le second n'a pas pris le relais, apprenez à keepalived ce qu'il doit surveiller, et prouvez que la bascule marche vraiment.

## Fichiers

no-failover-message-zainab =
    De : Zainab (service des donneur·ses)
    Lundi 13 mai, 7 h 40

    Bonjour, et bienvenue à l'établissement du sang de Lindenvale !

    Nos donneur·ses prennent rendez-vous sur donate.lindenvale.example, et
    depuis sept heures environ, personne n'y arrive : la page ne s'affiche
    même pas. Le lundi matin est notre moment le plus chargé, et les
    stocks de plaquettes sont bas.

    Bastien nous a toujours dit que le site ne pouvait pas tomber : il y a
    deux répartiteurs de charge, lb1 et lb2, « et si l'un meurt, l'autre
    prend le relais en une seconde ». Visiblement, quelque chose cloche.
    Il est parti en mars ; ses notes sont dans votre répertoire.

    Vous êtes sur lb1 ; d'ici, vous joignez lb2 et les serveurs web (web1,
    web2, web3) en ssh, et sudo marche avec votre mot de passe.

    Remettez les rendez-vous en route, s'il vous plaît, et faites que ça
    ne puisse plus arriver.

    Zainab

no-failover-note-bastien =
    Notes de Bastien (répartiteurs de charge)

    - lb1 (192.0.2.104) et lb2 (192.0.2.105) partagent 192.0.2.108,
      l'adresse vers laquelle pointe donate.lindenvale.example. keepalived
      (VRRP) la pose sur le maître ; lb1 est le maître, lb2 le secours.
      /etc/keepalived/keepalived.conf sur chacun.
    - Derrière l'adresse, HAProxy envoie les requêtes, sur chaque
      répartiteur, à web1, web2 et web3 (/etc/haproxy/haproxy.cfg, le même
      fichier sur les deux).
    - Si lb1 meurt, lb2 prend l'adresse en trois ou quatre secondes. Testé
      en 2029 en débranchant le câble d'alimentation de lb1. Ça marche
      très bien.
    - ip a montre qui tient l'adresse. journalctl -u keepalived dit
      pourquoi.

    Bastien

## Événements

no-failover-event-haproxy-dead =
    haproxy est mort sur lb1 : son processus de travail a avorté à 6 h 58,
    systemd l'a relancé quatre fois, et après cinq échecs en dix secondes il
    a abandonné (« Start request repeated too quickly »). Alors pourquoi lb2
    n'a-t-il pas pris le relais ? Regardez qui tient 192.0.2.108.
no-failover-event-vip-on-lb1 =
    lb1 tient toujours 192.0.2.108 (l'adresse « secondary » sur eth0), et
    lb1 n'a plus de haproxy : les requêtes des donneur·ses arrivent sur une
    machine où personne n'écoute le port 80. Comparez avec lb2 (ssh lb2),
    puis lisez le keepalived.conf de lb1 : que surveille keepalived ?
no-failover-event-no-tracking =
    keepalived ne surveille que keepalived. Le test de Bastien (débrancher
    le câble) a marché parce que toute la machine se taisait ; mais ici lb1
    est vivant et continue d'envoyer ses annonces VRRP : lb2 n'a aucune
    raison de prendre le relais. keepalived doit savoir que haproxy existe :
    un vrrp_script qui le vérifie, et un track_script dans l'instance (man
    keepalived.conf).
no-failover-event-restart-only =
    haproxy tourne de nouveau sur lb1 et les donneur·ses peuvent réserver.
    Mais rien n'a changé dans la conception : la prochaine fois que haproxy
    meurt, l'adresse reste encore sur lb1, et le site tombe avec un lb2 en
    parfaite santé à côté. Apprenez à keepalived à surveiller haproxy.
no-failover-event-both-master =
    « state MASTER » sur les deux nœuds avec la même priorité ne fait ni
    deux maîtres, ni une meilleure bascule : l'état n'est que celui où une
    instance démarre. L'élection se fait sur la priorité, et une égalité va
    à l'adresse la plus haute. Et cela ne dit toujours rien de haproxy.
no-failover-event-edited-not-loaded =
    Le fichier contient un track_script, mais le keepalived en marche
    utilise toujours la configuration lue à son démarrage : rechargez-le
    (systemctl reload keepalived) pour qu'il la relise.
no-failover-event-tracking =
    Le keepalived de lb1 lance maintenant votre vérification. Comme haproxy
    est mort, elle échoue : regardez journalctl -u keepalived sur lb1
    (« VRRP_Script(…) failed », puis la priorité ou l'état FAULT), et ip a
    sur les deux nœuds.
no-failover-event-stuck =
    La vérification de lb1 échoue, sa priorité a baissé, mais il est
    toujours maître : lb2 entend les annonces de lb1 avec une priorité plus
    basse et ne prend pas le relais. lb2 a-t-il le droit de préempter ?
    Avec nopreempt, un secours ne prend jamais l'adresse à un maître qui
    annonce encore, quelle que soit sa priorité. Laissez lb2 préempter, ou
    donnez à la vérification un poids de 0 (un échec met le nœud en FAULT :
    il cesse d'annoncer).
no-failover-event-failed-over =
    L'adresse a bougé : lb2 tient 192.0.2.108 et son haproxy sert les
    donneur·ses (regardez curl sur le site, et le /var/log/haproxy.log de
    lb2). C'est la bascule que la conception aurait dû faire à 6 h 58.
    Remettez maintenant haproxy en route sur lb1.
no-failover-event-haproxy-back-preempt =
    haproxy tourne de nouveau sur lb1, sa vérification réussit, sa priorité
    repasse au-dessus de celle de lb2, et lb1 a repris l'adresse
    (préemption, le comportement par défaut). Une seconde bascule, quelques
    connexions perdues : certain·es préfèrent nopreempt (state BACKUP sur
    les deux) pour que l'adresse reste où elle est jusqu'à la prochaine
    panne. Les deux se défendent ; choisissez en connaissance de cause.
no-failover-event-haproxy-back-stays =
    haproxy tourne de nouveau sur lb1, mais l'adresse reste sur lb2
    (nopreempt) : pas de seconde bascule, pas de connexions perdues pour
    rien. Elle bougera de nouveau à la prochaine panne. Les deux choix se
    défendent ; choisissez en connaissance de cause.
no-failover-event-lb2-tracked =
    lb2 surveille aussi son propre haproxy : la bascule marche dans les deux
    sens, quel que soit le nœud maître.
no-failover-event-end =
    Zainab : « Les rendez-vous affluent, et Teodor dit que les donneur·ses
    de ce matin ont déjà reçu leur courriel de confirmation. Merci ! »

    Bravo ! Vous avez terminé La Bascule qui n'a pas eu lieu.

    CE QUI S'EST PASSÉ
    haproxy est mort sur lb1 à 6 h 58 (un plantage que systemd n'a pas pu
    relancer). lb1 lui-même allait bien, et keepalived ne surveille que la
    vie de son voisin : lb1 a continué d'annoncer, lb2 a continué
    d'attendre, et l'adresse est restée sur une machine qui ne servait
    rien. Vous avez donné à keepalived un vrrp_script qui vérifie haproxy,
    suivi par l'instance sur les deux nœuds, vous l'avez rechargé, vous
    avez vu l'adresse passer sur lb2, remis haproxy en route sur lb1, et
    vérifié que l'ensemble fonctionne.

    BONNES PRATIQUES
    - La redondance couvre ce qui est surveillé. Une paire VRRP sait
      seulement que l'autre nœud est vivant : dites à keepalived ce dont le
      service a besoin (vrrp_script, track_script).
    - Le poids doit changer le résultat : la priorité du maître en panne
      doit passer sous celle du secours (101 - 20 < 100), ou utilisez un
      poids de 0 (FAULT).
    - nopreempt sur un secours et une vérification pondérée ne vont pas
      ensemble : un maître qui annonce encore n'est jamais préempté.
    - Testez la panne que vous craignez (le service qui s'arrête), pas
      seulement celle qui est facile à simuler (un câble).
    - Relancer le service répare aujourd'hui ; la conception répare la
      prochaine fois.

    DOCUMENTATION
    - keepalived.conf(5) : https://www.keepalived.org/manpage.html
    - La documentation de keepalived : https://keepalived.readthedocs.io/en/latest/
    - VRRP (RFC 3768) : https://www.rfc-editor.org/rfc/rfc3768
