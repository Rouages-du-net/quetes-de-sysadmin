### Histoire « Le Syndicat des locataires », chapitre « Les clés changent
### de mains » : la clé age d'un nouveau bénévole ajoutée, celle d'un
### bénévole qui part retirée, la clé de données et le secret changés.
### Commandes, options, chemins, clés, noms de variables et sorties des
### outils : non traduits.

chapter-keys-change-hands = Les clés changent de mains
    .summary = Sept semaines plus tard, les secrets du syndicat sont chiffrés pour le serveur, pour toi et pour Makoa. Makoa déménage et quitte l'équipe technique ; Ikenna la rejoint. Donne l'accès à Ikenna, retire vraiment celui de Makoa, et fais en sorte que ce qu'il a pu lire ne serve plus à rien.

## Fichiers

keys-change-hands-message-taslima =
    De : Taslima (secrétaire du syndicat des locataires de Larkspur)
    Mardi 26 avril, 18 h 40

    Bonjour !

    Deux nouvelles. Makoa part s'installer chez sa sœur, à trois cents
    kilomètres, et quitte l'équipe technique à la fin de la semaine (il
    t'a laissé un mot). Et Ikenna, du bâtiment C, nous rejoint : il
    s'occupera des courriels de Repairline. Il t'a envoyé sa clé publique.

    Depuis mars, .env et mail.env sont chiffrés pour le serveur, pour toi
    et pour Makoa (voir .sops.yaml). Tu peux les ouvrir à Ikenna, et les
    fermer à Makoa ? J'ai entièrement confiance en Makoa, mais son
    portable part avec lui, et sa clé avec.

    Pour le mot de passe du relais de courriel, j'ai demandé au
    fournisseur de le changer : il le fera demain, et je mettrai le nouveau
    dans mail.env moi-même. Celui de la base, c'est pour toi.

    Comme toujours : commit, push, et l'appli doit continuer de marcher.

    Taslima

keys-change-hands-message-ikenna =
    De : Ikenna
    Mardi 26 avril, 17 h 12

    Salut ! Voici ma clé publique age, faite sur mon portable avec
    age-keygen :

    { $key }

    Taslima dit que tu vas l'ajouter. Si c'est plus simple, tu pourrais
    aussi juste m'envoyer ton keys.txt, comme ça j'aurais accès tout de
    suite ?

    Ikenna

keys-change-hands-message-makoa =
    De : Makoa
    Lundi 25 avril, 22 h 30

    Ce fut un plaisir, vraiment. Ma clé est encore dans .sops.yaml et dans
    les fichiers : enlève-la, bien sûr. Et ne te gêne pas pour le reste :
    j'ai lu le mot de passe de la base à chaque déploiement, alors
    change-le aussi. Je continuerai à suivre le syndicat de loin.

    Makoa

## Événements

keys-change-hands-event-shared-key =
    Ta clé age privée se trouve ailleurs que dans ton propre keys.txt, ou
    ce fichier peut être lu par d'autres comptes. Une clé privée partagée
    n'est plus à toi : qui l'a peut lire tout ce qui est chiffré pour toi,
    et personne ne peut plus vous distinguer. Ikenna a sa propre clé ;
    supprime la copie (ou chmod 600 ~/.config/sops/age/keys.txt).
keys-change-hands-event-hand-edit =
    sops refuse le fichier : une valeur ENC[…] a été changée en dehors de
    sops. Chaque valeur a sa propre étiquette d'authentification, et le MAC
    couvre toutes les valeurs ensemble : une valeur modifiée à la main, une
    ligne supprimée ou déplacée, et sops ne peut plus faire confiance au
    fichier. Reprends le fichier depuis git (git checkout -- FICHIER), puis
    change les valeurs avec sops edit ou sops set.
keys-change-hands-event-config-updated =
    Le fichier .sops.yaml nomme maintenant le serveur, toi et Ikenna. Cette
    règle est ce que reçoivent les nouveaux fichiers ; les fichiers déjà
    chiffrés gardent les clés pour lesquelles ils l'ont été tant que tu ne
    les mets pas à jour.
keys-change-hands-event-config-only =
    La règle a changé, mais .env ou mail.env sont toujours chiffrés pour
    Makoa : sops ne réécrit pas les fichiers existants quand .sops.yaml
    change. sops updatekeys le fait, fichier par fichier.
keys-change-hands-event-keys-updated =
    Les deux fichiers sont maintenant chiffrés pour le serveur, pour toi et
    pour Ikenna, pas pour Makoa. Mais updatekeys ne fait que chiffrer à
    nouveau la même clé de données pour la nouvelle liste : les valeurs
    elles-mêmes n'ont pas changé.
keys-change-hands-event-same-data-key =
    La clé de données qui chiffre les valeurs est celle que la clé de Makoa
    pouvait ouvrir : qui l'a gardée (ou une ancienne copie du fichier) peut
    encore déchiffrer ce que tu commites. sops rotate fabrique une nouvelle
    clé de données et chiffre à nouveau chaque valeur.
keys-change-hands-event-data-rotated =
    De nouvelles clés de données pour les deux fichiers, chiffrées pour le
    serveur, toi et Ikenna seulement. Ce que Makoa pouvait ouvrir, c'était
    les anciennes.
keys-change-hands-event-rotated =
    La base a un nouveau mot de passe : celui que Makoa lisait en déployant
    ne vaut plus rien. Il doit arriver dans .env (avec sops, jamais en
    clair) et dans les réglages déployés.
keys-change-hands-event-app-down =
    Repairline n'a pas pu démarrer : le mot de passe qu'elle a lu dans
    /etc/repairline/env n'est pas celui de la base (journalctl -u
    repairline).
keys-change-hands-event-deployed =
    Le déploiement a déchiffré le nouveau .env avec la clé du serveur, et
    l'appli se connecte avec le nouveau mot de passe.
keys-change-hands-event-clear-commit =
    Le nouveau mot de passe est dans un commit, en clair. Choisis-en un
    autre, et mets-le dans .env avec sops edit ou sops set.
keys-change-hands-event-committed =
    Le commit contient la nouvelle règle, les deux fichiers pour la
    nouvelle liste de clés avec de nouvelles clés de données, et le nouveau
    mot de passe, chiffré.
keys-change-hands-event-pushed =
    origin l'a : Ikenna peut cloner le dépôt et déchiffrer les fichiers
    avec sa propre clé.
keys-change-hands-event-end =
    Ikenna : « sops -d .env marche sur mon portable. Bienvenue à moi ! »

    Bravo ! Tu as terminé Les clés changent de mains.

    CE QUI S'EST PASSÉ
    La clé publique d'Ikenna est entrée dans .sops.yaml et celle de Makoa en
    est sortie ; sops updatekeys a chiffré à nouveau la clé de données de
    chaque fichier pour la nouvelle liste. Comme Makoa a pu garder
    l'ancienne clé de données, ou simplement les valeurs, tu as changé ce
    qui comptait : une nouvelle clé de données pour chaque fichier (sops
    rotate), et un nouveau mot de passe pour la base, mis dans .env avec
    sops et déployé. Ikenna a eu l'accès avec sa propre clé ; personne n'a
    partagé de clé privée.

    BONNE PRATIQUE
    - Une clé par personne (et par serveur) : ajouter quelqu'un, c'est
      ajouter une clé publique, retirer quelqu'un, retirer la sienne.
    - Le fichier .sops.yaml décide pour les nouveaux fichiers ; updatekeys
      met les fichiers existants en accord ; aucun des deux ne change la
      clé de données.
    - Quand quelqu'un part, suppose qu'il a gardé ce qu'il pouvait lire :
      change la clé de données (sops rotate) et les secrets eux-mêmes.
    - Ne modifie jamais les valeurs ENC[…] à la main : sops edit, sops set,
      ou déchiffrer et chiffrer à nouveau.
    - N'envoie jamais une clé privée ; demande une clé publique.

    UNE AUTRE FAÇON DE FAIRE
    sops rotate --add-age et --rm-age changent les destinataires et la clé
    de données en une seule commande, sans toucher .sops.yaml (qu'il faut
    alors changer aussi). Avec plusieurs groupes de clés et
    shamir_threshold, un fichier peut exiger les clés de plusieurs
    personnes à la fois.

    DOCUMENTATION
    - sops updatekeys : https://getsops.io/docs/#updatekeys-command
    - La rotation des clés : https://getsops.io/docs/#key-rotation
    - Ajouter et retirer des clés : https://getsops.io/docs/#adding-and-removing-keys
    - age-keygen : https://github.com/FiloSottile/age#readme
