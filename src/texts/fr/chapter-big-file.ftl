### Histoire « La Troupe de danse », chapitre « Le Gros Fichier » : une URL
### présignée pour une semaine avec sa propre clé, et un nœud Garage en panne
### remplacé dans l'agencement. Commandes, options, chemins, ID de nœuds et
### sorties : non traduits.

chapter-big-file = Le Gros Fichier
    .summary = Un festival veut le film du gala de printemps, presque 4 Go, pour une semaine. Partage-le sans ouvrir le bucket au monde. Et l'une des trois machines qui gardent les fichiers de la troupe est morte : les données sont-elles à l'abri, et comment la nouvelle machine prend-elle sa place ?

## Fichiers

big-file-message-farrukh =
    De : Farrukh (vidéo)
    Jeudi 13 mai, 10 h 05

    Bonjour ! Zuri, qui produit le festival Harbourlight, veut le film
    complet de notre gala de printemps pour son comité de sélection : il se
    réunit la semaine prochaine. Le fichier est dans le bucket media :
    videos/spring-gala-2032-full.mp4 (3,8 Go, bien trop gros pour un
    courriel).

    Elle doit pouvoir le télécharger avec un simple lien, depuis son bureau,
    pendant une semaine : pas de compte, pas de logiciel. Tu peux mettre le
    lien dans ~/lien_pour_zuri.txt ? Je le lui enverrai.

    Je préfère ne pas rendre le bucket public : nos répétitions y sont
    aussi.

    Farrukh

big-file-message-siosaia =
    De : Siosaia
    Mercredi 12 mai

    Salut ! La machine qui porte porch, chez moi, est morte mardi matin (le
    disque, je crois : il cliquette). J'ai installé Garage sur mon ordinateur
    de secours, avec le même garage.toml que celui de Teodora (le même
    rpc_secret), et il est connecté : sudo garage status devrait le
    montrer. Il a un disque de 4 To. Je n'ai pas osé toucher à
    l'agencement, Teodora disait que c'est la partie dangereuse. Nos données
    sont-elles toujours à l'abri ?

    Siosaia

big-file-notes-teodora =
    Notes de Teodora (coulisses, la grappe)

    - replication_factor = 3 : chaque donnée est sur trois nœuds, un par
      zone : studio (wings), mill (vault), home (porch). Garage a besoin de
      deux réponses sur trois pour lire ou écrire (un quorum).
    - L'agencement (layout), c'est qui stocke quoi : le rôle de chaque nœud
      (zone, capacité). Les changements sont d'abord préparés (garage layout
      assign, remove), montrés par garage layout show, et appliqués
      seulement par garage layout apply --version N.
    - Un nœud se reconnaît à son ID (une longue chaîne hexadécimale ; ses
      premiers caractères suffisent en ligne de commande), pas à son nom
      d'hôte.
    - Partager un fichier : aws s3 presign donne un lien signé avec une clé,
      qui marche un temps limité.

## Événements

big-file-event-failed-node =
    porch est un nœud en panne : il a toujours son rôle dans l'agencement
    (zone home), et Garage n'a plus de ses nouvelles depuis deux jours. La
    nouvelle machine est là aussi, en bonne santé, avec « NO ROLE ASSIGNED » :
    connectée, mais elle ne stocke rien. Combien de copies reste-t-il de
    chaque donnée ?

big-file-event-safe =
    Trois copies étaient prévues, une par zone ; avec porch en panne, deux
    restent, sur wings et vault. Garage lit et écrit avec deux réponses sur
    trois : tout marche encore. Mais une panne de plus et les données
    seraient injoignables : le nouveau nœud doit vite prendre la place de
    porch.

big-file-event-too-long =
    Garage refuse ce lien : « X-Amz-Expires may not exceed a week ». Une URL
    présignée (Signature Version 4) dure au plus 604800 secondes, sept
    jours ; aws s3 presign signe n'importe quelle durée sans vérifier, et
    l'erreur n'apparaît que quand quelqu'un utilise le lien.

big-file-event-public-media =
    Avec l'accès web, le point d'accès web sert chaque objet de media à
    n'importe qui, les répétitions et les photos d'enfants comprises, et
    tant que personne ne le coupe. Un lien qui expire, pour ce seul objet,
    fait le travail sans cela.

big-file-event-wide-key =
    Ce lien marche, mais pense à sa clé : une URL présignée agit avec les
    droits de la clé qui l'a signée, et ne se révoque pas toute seule.
    Signée avec une clé qui peut écrire, ou que d'autres outils utilisent,
    la seule façon de la couper plus tôt est de retirer ces droits à tous
    ceux qui se servent de la clé. Une clé faite pour ce partage, qui ne
    peut que lire media, se supprime le jour où le comité a fini.

big-file-event-local-url =
    Ce lien nomme un hôte que seule coulisses connaît (localhost, ou
    coulisses elle-même) : depuis le bureau de Zuri, il ne mène nulle part.
    Le point d'accès public est s3.kestrel.example (l'endpoint_url de
    ~/.aws/config).

big-file-event-read-key =
    Une clé qui ne peut que lire media : un lien signé avec elle ne pourra
    jamais écrire ni supprimer, et supprimer la clé révoque tous les liens
    qu'elle a signés.

big-file-event-shared =
    Le lien est prêt : un seul objet, une semaine au plus, signé avec une
    clé qui ne peut que lire media, sur le point d'accès public. Le bucket
    reste privé.

big-file-event-staged =
    Le changement est préparé, pas appliqué : garage layout show dit ce que
    serait le nouvel agencement, et la version à donner à garage layout
    apply.

big-file-event-same-zone =
    Le nouveau nœud est dans la même zone qu'un autre : Garage place au plus
    une copie par zone quand il le peut, donc avec deux zones restantes,
    deux copies de chaque donnée finissent dans le même bâtiment. Un
    incendie ou une inondation là-bas, et elles sont perdues toutes les
    deux. Le remplaçant de porch va dans la zone de porch.

big-file-event-replaced =
    Le nouveau nœud a pris le rôle de porch : trois nœuds dans trois zones,
    de nouveau. Garage y recopie maintenant les morceaux manquants (garage
    stats montre la file de resynchronisation) ; l'ancien porch a quitté
    l'agencement.

big-file-event-end =
    Farrukh : « Zuri l'a téléchargé en vingt minutes. Merci ! »
    Siosaia : « garage status est tout vert, et mon vieux disque peut
    prendre sa retraite. »

    Bravo ! Tu as terminé Le Gros Fichier.

    CE QUI S'EST PASSÉ
    Le film du gala devait parvenir à un festival sans rendre public le
    bucket media : tu as créé une clé qui ne peut que lire media et signé
    avec elle une URL présignée, pour une semaine, le plus long que permet
    Signature Version 4. Puis la grappe : porch était en panne, et ses
    données avaient encore deux copies sur trois, assez pour le quorum de
    Garage. Tu as donné le rôle de porch au nouveau nœud, dans la même zone,
    et appliqué le nouvel agencement.

    BONNE PRATIQUE
    - Partager un objet, pas un bucket : une URL présignée donne un objet,
      pour un temps limité, à qui a le lien (à traiter comme un mot de
      passe).
    - La signer avec une clé faite pour le partage, en lecture seule :
      supprimer la clé révoque le lien plus tôt. Un lien ne peut pas durer
      plus de sept jours ; pour plus longtemps, en signer un nouveau.
    - Garder les répliques dans des lieux différents (des zones) : le
      remplaçant d'un nœud va dans sa zone. Avec trois copies, Garage
      continue de marcher quand un nœud tombe, mais il faut réparer avant
      la panne suivante.
    - Changer un agencement en deux temps : préparer, lire garage layout
      show, puis appliquer avec la version qu'il donne.

    UNE AUTRE FAÇON DE FAIRE
    garage layout remove suivi de garage layout assign fait la même chose
    que --replace. Pour un partage durable, un bucket à part avec l'accès
    web et seulement ce qui doit être public est une option ; Amazon S3 et
    MinIO ont aussi des politiques de bucket, que Garage n'implémente pas.

    DOCUMENTATION
    - aws s3 presign : https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/presign.html
    - Les URL présignées et leurs sept jours : https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    - Garage, se remettre d'une panne : https://garagehq.deuxfleurs.fr/documentation/operations/recovering/
    - Garage, l'agencement de la grappe : https://garagehq.deuxfleurs.fr/documentation/operations/layout/
