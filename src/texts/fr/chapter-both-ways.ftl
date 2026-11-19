### Histoire « Le Bac », chapitre « Les deux voies » : nginx n'écoute qu'en
### IPv4, et l'appli de réservation mise à jour écoute sur ::1 alors que
### nginx demande 127.0.0.1. curl -4/-6 -v, ss, listen [::]:80, proxy_pass
### et localhost. Les commandes, options, adresses, chemins et sorties ne
### sont pas traduits.

chapter-both-ways = Les deux voies
    .summary = Premier samedi de la saison : en données mobiles, le site du bac hésite ou échoue, et depuis la mise à jour d'hier soir la page de réservation répond « 502 Bad Gateway » à tout le monde. Une panne par famille d'adresses : trouvez les deux depuis l'extérieur et corrigez-les avant l'ouverture des réservations.

## Fichiers

both-ways-message-amaru =
    De : Amaru (coopérative du bac)
    Samedi 14 avril, 8 h 30

    Bonjour ! Jour d'ouverture : les réservations ouvrent à neuf heures.

    Deux problèmes, j'en ai peur. Sur mon téléphone, en données mobiles, le
    site est « inaccessible » une fois sur deux ; sur le Wi-Fi du bureau,
    les horaires s'affichent. Mais « Réserver une traversée » répond
    « 502 Bad Gateway », ici comme partout, depuis que Lucía a mis à jour
    l'appli hier soir. Elle a laissé un mot avant de prendre le premier
    bateau pour le continent.

    La vigie est toujours là.

    Amaru

both-ways-note-lucia =
    Mot de Lucía

    Hier soir, j'ai mis à jour l'appli de réservation (Node.js 22). Au
    passage, j'ai rangé /etc/default/booking : HOST=localhost plutôt que
    127.0.0.1, c'est plus propre, non ? Elle a démarré sans erreur
    (journalctl -u booking). Je rentre lundi !

    Lucía

## Événements

both-ways-event-refused6 =
    En IPv6, le port 80 refuse la connexion : l'adresse répond (ping6
    marche), mais personne n'écoute sur le 80 en IPv6. Sans -6, curl essaie
    d'abord l'IPv6, puis se rabat sur l'IPv4 (happy eyeballs) : voilà
    pourquoi la page s'affiche parfois. Un téléphone sur un réseau sans ce
    repli, ou dont l'IPv4 est médiocre, attend ou échoue. Sur quai :
    ss -tlnp.
both-ways-event-sockets =
    nginx écoute sur 0.0.0.0:80 : en IPv4 seulement. Et l'appli écoute
    sur [::1]:3000, la boucle locale IPv6, plus sur 127.0.0.1. Deux
    indices, un par famille.
both-ways-event-bad-gateway =
    502 Bad Gateway : nginx a répondu, mais n'a pas pu joindre l'appli
    derrière lui. Sa raison est dans /var/log/nginx/error.log.
both-ways-event-error-log =
    « connect() failed (111: Connection refused) while connecting to
    upstream, … upstream: http://127.0.0.1:3000/ » : nginx frappe à
    127.0.0.1, l'appli écoute sur ::1. Depuis Node.js 17, « localhost »
    donne les adresses dans l'ordre du système, ::1 d'abord, et l'appli
    n'écoute que sur la première. Soit nginx demande [::1]
    (proxy_pass http://[::1]:3000/;), soit l'appli écoute de nouveau sur
    127.0.0.1 (HOST dans /etc/default/booking, puis redémarrez-la).
both-ways-event-not-reloaded =
    Le fichier est bon et nginx -t est d'accord, mais nginx sert toujours la
    configuration lue au démarrage : systemctl reload nginx.
both-ways-event-bind-conflict =
    nginx ne peut pas ouvrir [::]:80 : avec ipv6only=off, cette socket prend
    aussi l'IPv4, et « listen 80 » tient déjà le port 80 de l'IPv4. nginx -t
    ne le voit pas (il n'ouvre pas les sockets). Soit deux lignes, listen
    80 et listen [::]:80 (IPv6 seulement, par défaut), soit une seule,
    listen [::]:80 ipv6only=off.
both-ways-event-listen6 =
    nginx écoute maintenant aussi en IPv6 ([::]:80). Depuis la vigie,
    curl -6 devrait obtenir les horaires.
both-ways-event-exposed =
    L'appli écoute maintenant sur toutes les adresses : elle ne reste privée
    que parce que le pare-feu jette le port 3000. Sa place est la boucle
    locale (127.0.0.1 ou ::1), où seul nginx la joint.
both-ways-event-upstream-ok =
    La page de réservation répond de nouveau à travers nginx.
both-ways-event-end =
    8 h 58. Amaru : « Mon téléphone affiche tout, les réservations
    marchent, et les premier·es passager·es réservent. Allez prendre un café
    sur le quai ! »

    Bravo ! Vous avez terminé Le Bac.

    CE QUI S'EST PASSÉ
    Deux pannes, une par famille. nginx n'écoutait qu'en IPv4 (listen 80) :
    en IPv6, la connexion était refusée sur { $v6 }, et seuls les clients
    capables de se rabattre sur l'IPv4 ({ $v4 }) obtenaient la page, en
    retard. Et l'appli mise à jour écoutait sur « localhost », dont Node.js
    a fait ::1, alors que nginx demandait 127.0.0.1 : 502 pour tout le
    monde. Vous avez ajouté l'écoute IPv6, mis nginx et l'appli d'accord
    sur la même boucle locale, vérifié (nginx -t), rechargé, et contrôlé
    depuis l'extérieur dans les deux familles.

    BONNES PRATIQUES
    - Un enregistrement AAAA est une promesse : chaque service derrière le
      nom doit aussi répondre en IPv6 (listen [::]:80 à côté de listen 80).
    - nginx : listen [::]:80 est IPv6 seulement par défaut (ipv6only=on) ;
      avec ipv6only=off il prend les deux, et ne doit pas côtoyer listen 80.
    - « localhost », c'est deux adresses : écrivez 127.0.0.1 ou [::1] là
      où vous en voulez une (proxy_pass, HOST).
    - curl -4 et curl -6 -v testent chaque route séparément ; une page qui
      marche dans un navigateur peut cacher un IPv6 cassé (happy eyeballs).
    - ss -tlnp : 0.0.0.0, c'est l'IPv4, [::] l'IPv6, * les deux.

    DOCUMENTATION
    - nginx, listen (ipv6only) : https://nginx.org/en/docs/http/ngx_http_core_module.html#listen
    - nginx, proxy_pass : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Node.js, l'ordre des résultats DNS : https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder
    - Happy eyeballs (RFC 8305) : https://www.rfc-editor.org/rfc/rfc8305
