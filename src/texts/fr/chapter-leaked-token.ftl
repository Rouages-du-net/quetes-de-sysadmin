### Histoire « L'Auberge », chapitre « Jeton divulgué » : le jeton d'une
### application publié sur un forum public ; lookup, le journal d'audit,
### revoke, un nouveau jeton, un secret renouvelé. Commandes, options,
### chemins, noms de politiques et de jetons, clés et sorties d'OpenBao :
### non traduits.

chapter-leaked-token = Jeton divulgué
    .summary = Un bénévole a demandé de l'aide sur un forum public en collant la configuration du site de réservation, jeton compris. Découvre à qui est ce jeton, ce que quelqu'un en a fait, coupe-le, et change ce qui a été lu, sans casser le site.

## Fichiers

leaked-token-message-desta =
    De : Desta
    Lundi 22 mars, 16:45

    Mauvaise nouvelle. Cet après-midi à 14:02, Nnamdi a demandé de l'aide
    sur le forum public des développeur·ses de Bunks, à propos d'une erreur
    de paiement, et il a collé le début de bunks.env, jeton compris. Je l'ai
    vu à 16:40 et lui ai demandé d'effacer le message, mais il est resté
    public plus de deux heures. Une copie est chez toi.

    Que pouvait faire ce jeton, et quelqu'un s'en est-il servi ?

    Hiroko a déjà demandé une nouvelle clé d'API au prestataire de paiement,
    au cas où :

        { $key }

    L'ancienne clé fonctionne jusqu'à ce qu'elle la révoque dans le tableau
    de bord du prestataire : elle le fera dès que tu lui diras que Bunks
    utilise la nouvelle.

    Desta

leaked-token-forum-post =
    forum.bunks.example › Aide › « page de paiement lente après la mise à jour »
    Publié par nnamdi_h, lundi 22 mars, 14:02 (public)

    Bonjour à toutes et tous, depuis la dernière mise à jour, la page de
    paiement du Bunks de notre auberge est très lente. Voici le début de
    notre configuration, au cas où :

        { $env }

    Une idée ? Merci !

    Réponse d'une modératrice, 14:20 : ne publiez pas de jetons ni de mots
    de passe en public. Modifiez votre message !

## Événements

leaked-token-event-resealed =
    OpenBao a été redémarré, il est donc revenu scellé. Desta, Hiroko et
    Nnamdi sont passé·es taper leurs parts : il est de nouveau descellé. Les
    politiques et les jetons prennent effet aussitôt ; OpenBao n'a jamais
    besoin d'un redémarrage pour eux.
leaked-token-event-identified =
    C'est le jeton de Bunks (display_name token-bunks, politiques bunks et
    default), encore valable des semaines (ttl). Son accesseur le désigne
    sans le révéler. Maintenant : qu'en a-t-on fait ?
leaked-token-event-hash =
    OpenBao a calculé le HMAC de la valeur avec le sel du périphérique
    d'audit : la chaîne même que le journal d'audit écrit à la place du
    jeton. Cherche-la dans le journal (sudo grep, ou jq).
leaked-token-event-traced =
    Le journal d'audit raconte l'histoire : depuis 203.0.113.77 à 14:31
    (13:31 dans le journal, qui compte en UTC), le jeton divulgué s'est
    consulté lui-même, a tenté de lister secret/metadata/ (refusé), a lu
    secret/data/bunks/payments (autorisé : c'est le secret de Bunks), et
    s'est vu refuser les coordonnées bancaires de la trésorerie, les
    politiques et un nouveau jeton. La politique étroite a tenu ; la clé de
    paiement, elle, a été lue.
leaked-token-event-revoked =
    Le jeton divulgué est révoqué : désormais il est refusé partout. Bunks,
    qui tourne encore, garde ses secrets en mémoire, mais son prochain
    démarrage échouerait : il lui faut un nouveau jeton.
leaked-token-event-still-leaked =
    Bunks a échoué : « permission denied ». bunks.env contient toujours le
    jeton révoqué. Un nouveau jeton pour Bunks (la même politique), puis
    bunks.env, puis le redémarrage.
leaked-token-event-lost-field =
    La dernière version du secret payments n'a plus d'account : bao kv put
    écrit une version entière avec seulement les champs donnés. Bunks a
    besoin des deux. bao kv patch change un champ et garde les autres (ou kv
    put avec les deux ; kv rollback ramène une version précédente).
leaked-token-event-wrong-key =
    Le secret payments contient maintenant une clé que le prestataire ne
    connaît pas. La nouvelle clé est dans le message de Desta.
leaked-token-event-db-touched =
    Le mot de passe de la base de données a changé dans OpenBao, pas dans la
    base de données : OpenBao ne fait que le garder, et Bunks n'arriverait
    plus à se connecter. Et le journal d'audit montre que le jeton divulgué
    ne l'a jamais lu. Remets la version précédente (bao kv rollback
    -version=1, ou kv patch avec l'ancienne valeur).
leaked-token-event-rotated =
    Le secret payments a une nouvelle version : la nouvelle clé, avec
    l'account gardé (bao kv metadata get liste les versions). Bunks utilise
    encore l'ancienne clé, chargée à son démarrage.
leaked-token-event-wide-app =
    Bunks tourne avec un jeton qui peut faire plus que lire ses deux secrets
    (bao token capabilities). Le prochain qui le vole obtiendra tout cela.
leaked-token-event-old-key-loaded =
    Bunks a redémarré avant que la clé change : il utilise encore
    l'ancienne. Relance-le une fois de plus maintenant que le secret contient
    la nouvelle clé.
leaked-token-event-switched =
    Bunks a redémarré avec un nouveau jeton, et chargé la nouvelle clé.
leaked-token-event-end =
    Hiroko : « L'ancienne clé est révoquée chez le prestataire. Rien n'a été
    débité ; les essais datent de cet après-midi seulement. »

    Bravo ! Tu as terminé Jeton divulgué.

    CE QUI S'EST PASSÉ
    Le jeton de Bunks est resté public deux heures. bao token lookup l'a
    identifié (token-bunks, politiques bunks et default, un accesseur). Le
    périphérique d'audit avait noté chaque requête avec le jeton passé au
    HMAC : bao write sys/audit-hash/file input=JETON a donné le même HMAC,
    et grep ou jq ont trouvé ce que 203.0.113.77 a fait à 14:31 : il a lu
    secret/data/bunks/payments et s'est vu refuser tout le reste, grâce à la
    politique du chapitre précédent. Le jeton a été révoqué, Bunks en a reçu
    un nouveau, la clé de paiement qui avait été lue a été renouvelée (une
    nouvelle version, l'account gardé), Bunks a redémarré pour la charger,
    et l'ancienne clé a pu être révoquée chez le prestataire. Le mot de
    passe de la base, jamais lu, est resté tel quel.

    BONNE PRATIQUE
    - Un secret divulgué se révoque d'abord, et s'examine ensuite : le
      journal d'audit dit ce qu'il faut renouveler, et ce qui peut rester.
    - Garde des périphériques d'audit (deux en production), envoyés vers une
      autre machine : OpenBao refuse les requêtes qu'il ne peut pas auditer.
    - Renouvelle à la source et dans le coffre : une nouvelle clé chez le
      prestataire, une nouvelle version dans OpenBao, l'application relancée,
      puis l'ancienne clé révoquée.
    - kv put remplace tout le secret, kv patch change des champs, et les
      versions permettent de revenir en arrière.
    - Des TTL courts réduisent ce que vaut une fuite ; ne colle jamais un
      fichier d'environnement, et laisse un détecteur de secrets surveiller
      tes messages et tes commits.

    UNE AUTRE FAÇON DE FAIRE
    Les secrets dynamiques : le moteur database d'OpenBao crée un compte par
    bail et le supprime à son expiration, si bien qu'un identifiant divulgué
    meurt tout seul. L'emballage des réponses (response wrapping) remet un
    secret par un jeton à usage unique.

    DOCUMENTATION
    - bao token : https://openbao.org/docs/commands/token/
    - Les périphériques d'audit : https://openbao.org/docs/audit/
    - /sys/audit-hash : https://openbao.org/docs/api/system/audit-hash/
    - bao kv patch : https://openbao.org/docs/commands/kv/patch/
    - L'emballage des réponses : https://openbao.org/docs/concepts/response-wrapping/
