### Histoire « La Gazette », chapitre 3 « Bleu et vert » : déployer sans
### coupure, avec deux emplacements et une vérification de santé. Les
### commandes, chemins, messages de nginx, systemctl et curl ne se traduisent pas.

chapitre-bleu-vert = Bleu et vert
    .resume = Mettre à jour l'appli des abonnements sans coupure : la nouvelle version à côté de l'ancienne, sa santé vérifiée, puis la bascule de nginx.

## Fichiers

bleu-vert-message-de-samia =
    Un message de Samia :

    « La Gazette a maintenant son Kiosque : l'appli des abonnements à la
    lettre d'information (curl http://gazette.example/kiosque/). C'est
    un programme Node.js, derrière nginx.

    Il tourne en deux exemplaires possibles, « bleu » et « vert » :
      - bleu : le service kiosque-bleu, port 3001, le code dans
        /srv/kiosque/bleu (un lien vers une version de /srv/kiosque/versions/) ;
      - vert : le service kiosque-vert, port 3002, /srv/kiosque/vert (arrêté).
    nginx envoie /kiosque/ vers l'un des deux
    (/etc/nginx/sites-available/gazette).

    Bleu fait tourner la 1.4.2. Il faut passer à la 1.5.0, déjà installée
    dans /srv/kiosque/versions/, sans que les lecteur·rices voient la
    moindre coupure. Chaque version répond sur /health quand elle va bien.

    Et garde l'ancienne version allumée tant qu'on n'est pas sûr·es de la
    nouvelle. Pour sudo : gazette-2027. »
bleu-vert-conf-commentaire = Le Kiosque (abonnements) : l'emplacement qui sert les lecteur·rices
bleu-vert-notes-150 =
    Kiosque 1.5.0 — notes de version

    Nouveau : la lettre d'information est envoyée par le Kiosque lui-même.

    À FAIRE AVANT DE METTRE EN SERVICE : indiquer le serveur de courrier
    dans la configuration (/etc/kiosque/kiosque.env), par exemple :
      KIOSQUE_SMTP=smtp.gazette.example
    Sans lui, /health répond 503 et l'inscription échoue.

## Le Kiosque (pages servies ; { $version } : la version de l'appli)

kiosque-accueil =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Le Kiosque de la Gazette</title></head>
    <body>
    <h1>Le Kiosque</h1>
    <p>Recevez la lettre de la Gazette chaque lundi.</p>
    <form method="post" action="inscription"><input name="courriel"><button>S'abonner</button></form>
    <footer>Kiosque { $version }</footer>
    </body>
    </html>
kiosque-archives =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Les lettres précédentes</title></head>
    <body>
    <h1>Les lettres précédentes</h1>
    <ul><li>Lettre du 17 mai</li><li>Lettre du 10 mai</li></ul>
    <footer>Kiosque { $version }</footer>
    </body>
    </html>

## Événements

bleu-vert-evenement-sante-ko =
    /health répond 503 : la version tourne, mais elle n'est pas en état de
    servir. Une version qui ne passe pas sa vérification de santé ne reçoit
    jamais de trafic. Ce qui lui manque est sans doute écrit dans ses notes
    de version (/srv/kiosque/versions/1.5.0/).
bleu-vert-evenement-pas-redemarre =
    Le lien vise la nouvelle version, mais le service répond encore avec
    l'ancienne : un programme lit son code (et sa configuration) quand il
    démarre. Il faut le redémarrer (man systemctl).
bleu-vert-evenement-trop-tot =
    Aïe : les lecteur·rices reçoivent une erreur sur /kiosque/. nginx envoie
    le trafic vers une instance qui ne répond pas, ou pas correctement. Le
    retour arrière est immédiat : remettre l'autre emplacement dans
    proxy_pass, nginx -t, reload. On vérifie /health AVANT de basculer.
bleu-vert-evenement-pas-recharge =
    Le fichier de nginx désigne bien vert (3002), mais nginx sert encore
    bleu : il ne relit sa configuration qu'au rechargement (nginx -t, puis
    systemctl reload nginx).
bleu-vert-evenement-plus-de-filet =
    Bleu est arrêté : si la 1.5.0 montre un problème ce soir, il n'y aura
    plus de retour arrière instantané. On garde l'ancienne version allumée
    un moment, le temps d'être sûr·es.
bleu-vert-evenement-fin =
    Les lecteur·rices sont passé·es à la 1.5.0 sans s'en rendre compte, et
    l'ancienne version attend, allumée, au cas où. Samia : « Si ça tourne
    mal, on rebascule en une commande. »

    Bravo ! Tu as terminé le chapitre 3 de La Gazette. (La suite t'attend :
    ssh gazette.)

    CE QUI S'EST PASSÉ
    Deux emplacements, bleu et vert : l'un sert le public, l'autre reçoit
    la nouvelle version. On la démarre, on vérifie sa santé (/health) avant
    qu'elle reçoive le moindre visiteur, on corrige ce qui manque (sa
    configuration), puis le proxy bascule d'un coup. Le reload de nginx ne
    coupe aucune connexion : les anciennes requêtes finissent, les
    nouvelles vont à vert.

    LA BONNE PRATIQUE
    - Lire les notes de version avant de déployer.
    - Une vérification de santé automatique (/health) avant toute bascule.
    - nginx -t avant chaque reload ; reload, pas restart.
    - Garder l'ancienne version allumée tant que la nouvelle n'a pas fait
      ses preuves : le retour arrière, c'est rebasculer le proxy.
    - Bleu et vert alternent : la prochaine version ira sur bleu.

    UNE AUTRE VOIE
    Le canari (chapitre suivant) n'envoie qu'une petite part des visites à
    la nouvelle version, pour la juger sur du vrai trafic ; le déploiement
    progressif (rolling) remplace les serveurs un à un. Bleu-vert :
    bascule instantanée et retour arrière immédiat, au prix de deux fois
    les ressources pendant la bascule.

    LA DOCUMENTATION
    - Le déploiement bleu/vert : https://martinfowler.com/bliki/BlueGreenDeployment.html
    - proxy_pass : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Recharger nginx : https://nginx.org/en/docs/beginners_guide.html#control
