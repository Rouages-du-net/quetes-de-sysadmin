### Histoire « La Troupe de danse », chapitre « Le Bucket public » : les
### documents des membres publiés avec le site, depuis le même bucket Garage.
### Commandes, options, chemins, noms de buckets et de clés, sorties : non
### traduits.

chapter-public-bucket = Le Bucket public
    .summary = Un parent a trouvé la liste des contacts médicaux de la troupe avec un moteur de recherche. Le site et les documents des membres partagent un bucket du stockage objet de la troupe : sépare-les, vérifie depuis l'extérieur, et donne à chaque outil une clé qui n'ouvre que ce dont il a besoin.

## Fichiers

public-bucket-message-esperanza =
    De : Esperanza (directrice artistique, Compagnie de danse Kestrel)
    Mardi 9 mars, 9 h 20

    Bonjour, et merci d'être venu·e si vite.

    Hier soir, le père d'une de nos jeunes danseuses m'a appelée : en
    cherchant nos horaires de cours, il est tombé sur une liste avec les
    contacts d'urgence et les remarques médicales des enfants, à l'adresse
    de notre site. J'ai essayé moi-même :
    https://www.kestrel.example/members/medical-contacts-2032.csv s'ouvre
    pour n'importe qui.

    Nos fichiers sont sur coulisses, où tu es (sudo marche avec ton mot de
    passe), et sur les deux autres machines de ce que Teodora appelait « la
    grappe ». Teodora a tout installé avant de déménager et a laissé des
    notes. Hiroshi, qui a fait le site, le publie avec un petit script.

    Rends ces documents privés, s'il te plaît, sans en perdre aucun : le
    bureau en a besoin. Et le site doit rester en ligne, les billets du gala
    de printemps y sont vendus.

    Esperanza

public-bucket-notes-teodora =
    Notes de Teodora (coulisses, 2029, quelques mises à jour depuis)

    - Nos fichiers sont dans Garage, un stockage objet avec une API S3, sur
      trois nœuds : wings (ici, au studio), vault (au théâtre du Vieux
      Moulin, il a la fibre) et porch (chez Siosaia). Chaque objet est
      stocké sur les trois. sudo garage status les montre.
    - Garage range les objets dans des buckets. sudo garage bucket list,
      sudo garage bucket info NOM (ce qu'il contient, l'accès web, les clés
      qui peuvent s'en servir).
    - Un programme parle à Garage avec une clé d'accès (un ID qui commence
      par GK, et un secret). Chaque clé a des droits par bucket : read,
      write, owner. sudo garage key list, sudo garage key info NOM.
    - Le site est le bucket www.kestrel.example, avec l'« accès web » : le
      point d'accès web de Garage le sert à tout le monde, sans clé. L'API
      S3, elle, ne répond jamais sans clé.
    - Les clients : l'outil en ligne de commande d'AWS (aws s3 ls, aws s3
      cp… ; ses clés dans ~/.aws/credentials, son point d'accès et sa région
      dans ~/.aws/config) et rclone (la sauvegarde du bureau :
      /etc/rclone/office.conf, lancée chaque nuit par office-backup.timer).
    - J'ai tout mis sur la clé troupe-admin. C'est plus simple.

## Événements

public-bucket-event-exposed =
    N'importe qui peut le lire : pas de clé, pas de mot de passe. Avant de
    changer quoi que ce soit, trouve pourquoi Garage sert ce fichier. Dans
    quel bucket est-il, et qu'est-ce qui permet au point d'accès web de
    servir ce bucket au monde entier ?

public-bucket-event-website =
    C'est ça : www.kestrel.example a l'accès web, et avec lui le point
    d'accès web de Garage sert chaque objet du bucket, sous n'importe quel
    chemin, à tout le monde. Le site et les documents des membres partagent
    ce bucket. L'accès web, c'est tout ou rien, pour un bucket entier : les
    documents ont besoin d'un bucket à eux, sans lui.

public-bucket-event-deleted =
    Un document des membres n'est plus dans aucun bucket. Le bureau en a
    besoin, et Garage ne garde aucune version précédente d'un objet (il n'a
    pas de versionnage) : recommence le chapitre (ou utilise le point de
    restauration). Déplace les documents vers un bucket privé plutôt que de
    les supprimer.

public-bucket-event-site-down =
    Le site ne répond plus : www.kestrel.example doit garder son accès web
    et son index.html, les billets du gala s'y vendent. Les documents
    quittent le bucket ; le site, lui, reste.

public-bucket-event-moved =
    Les documents des membres ne sont plus que dans des buckets sans accès
    web : le point d'accès web ne les servira pas, et l'API S3 ne répond
    qu'avec une clé qui a un droit sur leur bucket. Vérifie-le depuis
    l'extérieur, comme le parent les a trouvés.

public-bucket-event-closed =
    L'adresse publique du document répond maintenant 404 : le point d'accès
    web ne le trouve plus. Les moteurs de recherche oublieront le lien.
    Reste l'autre moitié du problème : une seule clé ouvre tout, et deux
    scripts la portent.

public-bucket-event-too-wide =
    Cette clé peut plus que son travail : le droit owner (elle pourrait
    changer l'accès web du bucket, ou le supprimer), le droit de créer des
    buckets, ou des droits sur d'autres buckets. Si la machine du script de
    publication ou la configuration de la sauvegarde fuit, cette clé fuit
    avec. Donne à chaque outil read et write sur son propre bucket, rien
    d'autre.

public-bucket-event-deploy-key =
    La publication du site a maintenant sa propre clé : read et write sur
    www.kestrel.example, rien d'autre, et elle marche.

public-bucket-event-backup-key =
    La sauvegarde du bureau a maintenant sa propre clé : read et write sur
    backups, rien d'autre, et elle atteint son bucket.

public-bucket-event-end =
    Esperanza : « La liste ne s'ouvre plus, et le site est toujours là. Je
    rappelle le papa. Merci ! »

    Bravo ! Tu as terminé Le Bucket public.

    CE QUI S'EST PASSÉ
    Le site était un bucket Garage avec l'accès web, et les documents des
    membres avaient été rangés dans ce même bucket, sous members/. L'accès
    web fait servir chaque objet du bucket à n'importe qui par le point
    d'accès web de Garage : les documents étaient publics, et un moteur de
    recherche les avait trouvés. Et une seule clé, avec tous les droits sur
    tous les buckets, servait au script de publication comme à la
    sauvegarde du bureau. Tu as déplacé les documents dans un bucket privé,
    vérifié leur ancienne adresse depuis l'extérieur, et donné à chaque
    outil sa propre clé, avec seulement ce dont il a besoin.

    BONNE PRATIQUE
    - Un bucket par usage et par public : ce qui est public dans un bucket
      à part, jamais à côté de fichiers privés. Un préfixe (un « dossier »)
      n'est pas une frontière : l'accès web, et les droits, se donnent par
      bucket.
    - Vérifier depuis l'extérieur (curl, une fenêtre privée) : ce que sert
      le point d'accès web, c'est ce que voit le monde.
    - Une clé par programme, avec le moindre privilège : read et write sur
      son bucket, pas de droit owner, pas d'autre bucket. Une clé
      d'administration reste aux admins, hors des scripts.
    - Une clé qui a fui se supprime (garage key delete), elle ne se
      remplace pas seulement dans un fichier. Garage n'a pas de
      versionnage : un objet supprimé est perdu, donc réfléchir avant rm,
      et garder des sauvegardes.
    - Des documents restés publics un moment ont pu être copiés : prévenir
      les personnes concernées, comme le droit des données personnelles
      l'exige en général.

    UNE AUTRE FAÇON DE FAIRE
    La troupe utilise Garage, un petit serveur S3 géodistribué écrit pour
    l'auto-hébergement par l'association Deuxfleurs. MinIO est
    l'alternative la plus connue, mais son édition communautaire a perdu sa
    console d'administration en 2025 et n'est plus distribuée qu'en code
    source. Avec MinIO ou Amazon S3, un bucket peut aussi devenir public par
    une politique de bucket ou des ACL, que Garage n'implémente pas : l'accès
    web est sa seule porte publique.

    DOCUMENTATION
    - Garage, exposer des sites web : https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/
    - Garage, buckets et clés : https://garagehq.deuxfleurs.fr/documentation/quick-start/
    - La compatibilité S3 de Garage : https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
    - aws s3 mv : https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/mv.html
    - Les fichiers de configuration de l'outil AWS : https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

## Ce que partagent les trois chapitres, gardé ici pour se charger avec
## l'histoire : le site de la troupe, les documents des membres (personnes
## inventées ; les numéros sont dans la plage britannique réservée à la
## fiction), les fichiers du partage du bureau.

troupe-site-index =
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Compagnie de danse Kestrel</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <header><h1>Compagnie de danse Kestrel</h1><nav><a href="/">Accueil</a><a href="/classes.html">Cours</a><a href="/agenda.html">Agenda</a></nav></header>
    <main>
    <p>Une troupe de danse amateur : des cours pour tous les âges, de 4 à 84 ans, et un gala de printemps sur la scène du Vieux Moulin.</p>
    <p><img src="/images/gala-2031.jpg" alt="Le gala 2031 : quarante danseur·ses sur scène"></p>
    <p>Gala de printemps, samedi 1er mai : billets au studio et sur ce site.</p>
    </main>
    </body>
    </html>
troupe-site-agenda =
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Agenda, Compagnie de danse Kestrel</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Agenda</h1>
    <ul>
    <li>13 mars : cours ouvert aux débutant·es</li>
    <li>3 avril : début des répétitions au Vieux Moulin</li>
    <li>1er mai : gala de printemps</li>
    </ul>
    </main>
    </body>
    </html>
troupe-site-classes =
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Cours, Compagnie de danse Kestrel</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Cours</h1>
    <p>Petits pas (4-7 ans) : mercredi 16 h 30. Ados : mercredi 18 h. Contemporain, adultes : jeudi 19 h 30. Danse douce, 60 ans et plus : vendredi 10 h.</p>
    </main>
    </body>
    </html>
troupe-site-404 =
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Page introuvable</title></head>
    <body><main><h1>Cette page n'existe pas</h1><p><a href="/">Retour à l'accueil</a></p></main></body>
    </html>

troupe-doc-register =
    membre,groupe,arrivée,cotisation_payée
    Ayo Bankole,ados,2029-09,oui
    Ilka Carvalho,adultes,2031-01,oui
    Kalani Akana,petits pas,2031-09,non
    Rasmus Ekholm,danse douce,2030-02,oui
    Wren Okonkwo,ados,2032-01,oui
troupe-doc-medical =
    danseur·se,groupe,contact d'urgence,téléphone,remarques médicales
    Kalani Akana,petits pas,Malia Akana (mère),07700 900127,asthme (inhalateur dans le sac)
    Ayo Bankole,ados,Folasade Bankole (tante),07700 900341,aucune
    Wren Okonkwo,ados,Chidi Okonkwo (père),07700 900562,allergie aux fruits à coque
    Rasmus Ekholm,danse douce,Saga Ekholm (fille),07700 900718,prothèse du genou 2030
troupe-doc-minutes =
    Réunion du bureau, 24 février 2032 (compte rendu)
    Présent·es : Esperanza, Anahera, Linh, Farrukh, Siosaia.
    1. Comptes : la subvention du conseil des arts est arrivée ; le rapport 2031 est à rendre le 15 avril.
    2. Gala : le Vieux Moulin est réservé pour le 1er mai ; Farrukh le filmera.
    3. Cotisations : deux familles ont demandé le tarif réduit, accordé.
troupe-doc-consent =
    membre,photos sur le site,photos dans la presse
    Ayo Bankole,oui,non
    Ilka Carvalho,oui,oui
    Kalani Akana,non,non
    Rasmus Ekholm,oui,oui
    Wren Okonkwo,oui,non

troupe-office-report =
    Conseil des arts : rapport d'activité 2031, Compagnie de danse Kestrel
    1. Cours : 6 cours par semaine, 112 membres (31 de moins de 12 ans, 27 de plus de 60 ans).
    2. Gala de printemps 2031 : 2 représentations, 640 billets, 14 places offertes à des familles du quartier.
    3. Actions : 9 ateliers dans deux écoles primaires et à l'accueil de jour.
    4. Comptes : subvention de 6 000 dépensée pour le plancher du studio et les lumières du gala (détail dans budget-2032.csv).
    Rédigé par Anahera, trésorière.
troupe-office-report-template =
    Conseil des arts : rapport d'activité (MODÈLE)
    1. Cours : [nombre de cours, de membres]
    2. Spectacles : [dates, billets]
    3. Actions : [ateliers]
    4. Comptes : [emploi de la subvention]
troupe-office-budget =
    poste,2031,2032 (prévu)
    loyer du studio,7200,7400
    professeur·es,9800,10200
    gala (salle et lumières),2650,2800
    réparation du plancher,3100,0
troupe-office-schedule =
    Répétitions de printemps, Vieux Moulin
    Samedis du 3 au 24 avril, 10 h-13 h : tous les groupes.
    Mercredi 28 avril, 18 h : générale.
troupe-office-hall =
    Au théâtre du Vieux Moulin : nous confirmons la réservation de la grande
    salle le samedi 1er mai 2032, de 9 h à 23 h, pour notre gala de printemps.
troupe-office-running-order =
    Ordre de passage du gala (version 3)
    1. Petits pas : Le Nid du faucon
    2. Ados : Traversées
    3. Danse douce : Le Thé de quatre heures
    4. Adultes : Marée
    5. Tout le monde : final
troupe-office-thanks =
    Chers amis de la boulangerie de la rue du Moulin, merci pour les gâteaux
    à chaque répétition : les danseur·ses vous remercient chaleureusement.
troupe-office-joiners =
    nom,groupe,début
    Noa Benali,ados,2032-04
    Bea Ferreira,adultes,2032-04
troupe-office-old-plan =
    Plan d'hiver (annulé) : répétitions en janvier à la salle paroissiale.
