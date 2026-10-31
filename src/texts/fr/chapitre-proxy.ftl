### Histoire « La Coopérative », chapitre « Le proxy » : l'appli derrière
### nginx ne voit que 127.0.0.1 (X-Forwarded-For, trust proxy). Les
### directives de nginx, les variables et les chemins ne se traduisent pas.

chapitre-proxy = Le proxy
    .resume = Un robot fait verrouiller tout le monde : derrière nginx, la caisse voit chaque client en 127.0.0.1. X-Forwarded-For, et à qui faire confiance.

## Fichiers

proxy-courriel-awa =
    De :     Awa
    À :      toi
    Objet :  Plus personne ne peut se connecter à la caisse

    Depuis ce matin, la caisse répond « Too many attempts, try again in 15
    minutes » à tout le monde : Lina, Karim, moi… On réessaie, ça recommence.

    Karim pense qu'un robot essaie des mots de passe (la caisse verrouille une
    adresse après 5 échecs). Mais pourquoi nous ? Compare le journal de la
    caisse (/var/log/till/app.log) et celui de nginx
    (/var/log/nginx/access.log) : ils ne voient pas les mêmes adresses.

    L'appli est une appli Node (Express) : regarde son réglage TRUST_PROXY
    dans /srv/till/app/.env (et le guide d'Express, « behind proxies »).
    Côté nginx : la documentation de proxy_set_header.

    Pour sudo : radis-2027

## Événements

proxy-evenement-tout-le-monde =
    Cinq minutes plus tard : le robot a encore fait verrouiller 127.0.0.1…
    et Lina avec. Pour la caisse, toutes les requêtes viennent de nginx
    (127.0.0.1) : il faut que nginx lui transmette l'adresse du vrai client
    (un en-tête X-Forwarded-For), ET qu'elle accepte de le lire (TRUST_PROXY),
    puis relancer les deux.
# { $robot } : l'adresse du robot
proxy-evenement-usurpe =
    Lina peut entrer… mais le robot ({ $robot }) n'est jamais verrouillé : il
    écrit lui-même un faux X-Forwarded-For, différent à chaque essai, et la
    caisse le croit. Regarde /var/log/till/app.log : 10.1.0.4, 10.2.7.5…

    Une appli ne doit croire X-Forwarded-For que pour ce qu'y a ajouté SON
    proxy : TRUST_PROXY=true prend la première adresse de la liste (celle que
    le client a écrite). Relis le guide d'Express : loopback ne fait confiance
    qu'à 127.0.0.1. Et côté nginx, cet en-tête doit être écrit ou complété
    par nginx, pas seulement transmis.
# { $robot } : l'adresse du robot
proxy-evenement-fin =
    Cinq minutes plus tard : le robot ({ $robot }) est verrouillé, et Lina
    entre sans souci. Awa : « On peut rouvrir les caisses ! »

    Bravo ! Tu as terminé le chapitre « Le proxy ».

    CE QUI S'EST PASSÉ
    Derrière un proxy (nginx), une appli reçoit toutes ses connexions du
    proxy lui-même. Pour connaître le vrai client, il lui faut l'en-tête
    X-Forwarded-For, que le proxy remplit. Mais un client peut aussi l'écrire
    lui-même : l'appli ne doit faire confiance qu'aux adresses ajoutées par
    les proxys qu'elle connaît, en lisant la liste depuis la droite.

    LA BONNE PRATIQUE
    - Dans nginx : proxy_set_header X-Forwarded-For
      $proxy_add_x_forwarded_for (et souvent X-Real-IP $remote_addr,
      X-Forwarded-Proto $scheme).
    - Dans l'appli : faire confiance au seul proxy (loopback, ou son
      adresse), jamais à « tout le monde » (true).
    - Comparer les journaux du proxy et de l'appli quand une adresse
      étonne : 127.0.0.1 partout dans l'appli, c'est ce symptôme.
    - Un verrou par adresse protège mal derrière un proxy mal réglé : il
      punit tout le monde, ou personne.

    LA DOCUMENTATION
    - proxy_set_header : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
    - Express derrière un proxy : https://expressjs.com/en/guide/behind-proxies.html
