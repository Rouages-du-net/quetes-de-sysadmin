### Histoire « La Coopérative », chapitre « Le secret » : un .env servi par
### nginx. Les directives de nginx, les chemins et les sorties des outils ne
### se traduisent pas.

chapter-secret = Le secret
    .resume = La clé de paiement traîne sur internet : trouver par où elle est sortie, fermer la fuite dans nginx, bloquer qui l'a prise, changer la clé.

## Fichiers

# { $cle } : la nouvelle clé de paiement
secret-email-awa =
    De :     Awa
    À :      toi
    Objet :  URGENT : notre clé de paiement

    Le prestataire du terminal de paiement vient d'appeler : notre clé
    secrète a été vue sur internet cette nuit. Ils l'ont désactivée, et nous
    en ont donné une nouvelle :

      { $cle }

    Tant que la caisse utilise l'ancienne, plus aucun paiement par carte !
    La clé est dans le fichier .env de l'appli de caisse (/srv/till/app),
    que l'appli lit au démarrage.

    Mais d'abord : comment est-elle sortie ? Essaie de la demander au site
    toi-même (curl http://coop.example/.env), regarde le journal de
    nginx (/var/log/nginx/access.log), et ferme la porte. Si tu trouves qui l'a
    prise, bloque-le aussi (man nginx… et la documentation de deny).

    Pour sudo : radis-2027

## Événements

secret-event-env-only =
    /.env ne sort plus… mais /.git/config, si (essaie curl). Le dossier .git
    contient l'adresse du dépôt, avec un jeton d'accès dedans. Ce ne sont pas
    seulement les .env qu'il faut cacher, ce sont TOUS les fichiers cachés :
    une location avec une expression régulière (location ~ /\. ),
    ou un root qui ne contient que ce qui doit être public.
secret-event-site-broken =
    Attention : la fuite est fermée, mais le site (/) ou la caisse (/till/)
    ne répond plus normalement. Vérifie avec curl, et relis ta configuration
    (sudo nginx -t).
secret-event-closed =
    Les fichiers cachés ne sortent plus, et le site répond toujours.
# { $adresse } : l'adresse bloquée
secret-event-attacker =
    { $adresse } reçoit maintenant 403 : c'est elle qui a téléchargé
    les fichiers .env et .git/config cette nuit (python-requests, à 3 h 12). Elle ne reviendra pas
    par ce site… mais ce qu'elle a pris, elle l'a déjà : il faut changer les
    secrets.
secret-event-key-written =
    La nouvelle clé est dans .env… mais la caisse tourne toujours avec
    l'ancienne : l'appli ne lit son .env qu'au démarrage. Vérifie avec
    curl http://127.0.0.1:3000/health.
secret-event-end =
    Plus de fuite, l'adresse bloquée, et la caisse accepte de nouveau les
    cartes. Awa : « Ouf. On en parlera à la prochaine réunion. »

    Bravo ! Tu as terminé le chapitre « Le secret ».

    CE QUI S'EST PASSÉ
    Le site était servi depuis le dossier de l'appli : nginx donnait tout ce
    qui s'y trouvait, y compris les fichiers cachés (.env, .git). Des robots
    demandent ces adresses à tous les sites, toutes les nuits. Le journal
    d'accès de nginx garde la trace de chaque requête : l'heure, l'adresse,
    le code (200 : le fichier est parti).

    LA BONNE PRATIQUE
    - Un root qui ne contient QUE ce qui doit être public ; jamais le dossier
      d'une appli, avec son code et ses secrets.
    - Refuser les fichiers cachés partout : location ~ /\. {"{"} deny all; {"}"}.
    - Les secrets lisibles par l'appli seulement (chmod 600, propriétaire le
      compte de l'appli), et jamais dans git.
    - Un secret qui a fuité est perdu : on le change (la clé de paiement, mais
      aussi le mot de passe de la base et le jeton git, à faire ensuite !).
    - Après une fuite : lire le journal d'accès (grep '\.env' access.log),
      noter qui, quand, quoi.

    LA DOCUMENTATION
    - location : https://nginx.org/en/docs/http/ngx_http_core_module.html#location
    - deny : https://nginx.org/en/docs/http/ngx_http_access_module.html
