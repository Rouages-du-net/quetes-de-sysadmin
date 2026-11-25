### Histoire « L'Auberge », chapitre « Scellé » : OpenBao scellé après une
### coupure de courant (status, trois parts de clé, l'application relancée,
### sa santé vérifiée). Commandes, options, chemins, noms de politiques et
### de jetons, parts de clé et sorties d'OpenBao : non traduits.

chapter-sealed = Scellé
    .summary = Un orage a coupé le courant dans la nuit. Le serveur de l'auberge est revenu tout seul, mais le coffre-fort à secrets est revenu scellé, et le site de réservation a abandonné. Les voyageur·ses arrivent à neuf heures : reconstitue la clé du coffre avec les parts de trois personnes, et remets le site en route.

## Fichiers

sealed-message-desta =
    De : Desta (coordination de l'auberge)
    Samedi 6 mars, 07:40

    Bonjour, et pardon pour ce message si matinal !

    L'orage a coupé le courant à 03:12. cadenas est revenu tout seul à
    03:58, mais le site de réservation, Bunks, est en panne, et douze
    personnes arrivent à neuf heures pour leur enregistrement.

    Ruslan a installé cadenas le mois dernier. Bunks garde ses mots de passe
    (la base de données, le prestataire de paiement) dans OpenBao, un
    coffre-fort à secrets sur la même machine. Il nous a dit qu'après un
    redémarrage OpenBao est « scellé », et que trois d'entre nous doivent
    chacun·e donner leur « part de clé » pour l'ouvrir. Il y a cinq parts :
    la mienne, celle de Ruslan, la tienne, celle d'Hiroko et celle de Nnamdi.

    Ruslan est en randonnée sans réseau jusqu'à lundi. Ma part est sur papier
    dans le coffre de l'auberge ; je suis dans le train, mais je l'ai prise
    en photo la semaine dernière. Elle est un peu floue, voici ce que je lis :

        { $share }

    Je ne suis pas sûre de chaque caractère. Hiroko et Nnamdi ont envoyé les
    leurs (leurs messages sont chez toi), et la tienne devrait être sur ta
    clé USB.

    Tu peux ouvrir le coffre et remettre Bunks en route avant neuf heures ?

    Desta

sealed-message-hiroko =
    De : Hiroko (trésorerie)
    Samedi 6 mars, 07:22

    Desta m'a appelée. Je suis chez ma sœur, à deux heures d'ici, alors voici
    ma part, recopiée depuis mon enveloppe :

        { $share }

    Efface ce message une fois le coffre ouvert : Ruslan a dit que si une
    part voyage un jour, il faudra en refaire de nouvelles.

    Hiroko

sealed-message-nnamdi =
    De : Nnamdi
    Samedi 6 mars, 07:31

    Debout tôt pour une fois ! Ma part, depuis mon gestionnaire de mots de
    passe :

        { $share }

    Je ne peux pas passer aujourd'hui ; dis-moi si le site a besoin de
    quelque chose.

    Nnamdi

sealed-usb-comment = Ta part de clé (numéro 3 sur 5), remise par Ruslan le 14 février. À garder hors ligne.

## Événements

sealed-event-status =
    OpenBao répond, mais il est scellé : ses données sont chiffrées sur le
    disque, et il ne peut pas les déchiffrer avant d'avoir reconstitué sa clé
    racine avec trois des cinq parts (le partage de secret de Shamir).
    Unseal Progress 0/3 : personne n'a encore donné de part. Chaque
    démarrage du serveur commence ainsi.
sealed-event-init =
    bao operator init sert pour un serveur tout neuf : il crée la clé
    racine, les parts et le premier jeton root. Celui-ci est déjà initialisé
    (Initialized true) : il faut seulement le desceller.
sealed-event-first-share =
    OpenBao a compté une part : la progression a avancé, et un Unseal Nonce
    nomme cette tentative. Les parts déjà données restent en mémoire jusqu'à
    ce que le seuil soit atteint. Taper une part à l'invite (bao operator
    unseal sans argument) la garde hors de l'historique du shell.
sealed-event-duplicate =
    La progression n'a pas bougé : cette part était déjà comptée. Trois
    parts, c'est trois détenteur·rices différent·es ; c'est tout l'intérêt du
    seuil : personne ne peut ouvrir le coffre seul·e.
sealed-event-bad-format =
    OpenBao n'a pas pu décoder cette part : une part est une chaîne base64
    (ou hexadécimale) de longueur fixe. Copie-la en entier, sans espace ni
    la ligne de commentaire.
sealed-event-bad-share =
    La troisième part a complété le seuil, OpenBao a combiné les trois… et
    le résultat n'a pas déchiffré son trousseau : l'une d'elles était
    fausse. Toute la tentative est perdue et la progression revient à 0/3,
    car OpenBao ne peut pas savoir laquelle était fausse. L'une d'elles
    a-t-elle été lue sur une photo floue ?
sealed-event-restart-early =
    Bunks a encore échoué : OpenBao est toujours scellé, ses secrets ne
    peuvent pas être lus (journalctl -u bunks : « Vault is sealed »).
    Descelle d'abord, puis relance l'application.
sealed-event-openbao-restarted =
    OpenBao a été redémarré : il revient scellé, et les parts déjà données
    sont oubliées. Un redémarrage ne descelle jamais ; seules les parts le
    font.
sealed-event-unsealed =
    Sealed false : OpenBao a reconstitué sa clé racine en mémoire et ouvert
    son trousseau. Il reste descellé jusqu'à son arrêt (un redémarrage, une
    coupure, bao operator seal). Bunks, lui, a abandonné dans la nuit : après
    cinq démarrages ratés, systemd a cessé d'essayer (start-limit-hit).
sealed-event-restarted =
    Bunks tourne de nouveau : au démarrage, il a lu ses deux secrets dans
    OpenBao (journalctl -u bunks). Répond-il vraiment ?
sealed-event-checked =
    La page de santé répond : Bunks joint OpenBao, sa base de données et le
    prestataire de paiement.
sealed-event-end =
    Desta : « Les premières personnes s'enregistrent. Merci ! »

    Bravo ! Tu as terminé Scellé.

    CE QUI S'EST PASSÉ
    La coupure a redémarré cadenas, et OpenBao a démarré scellé, comme
    toujours : ses données sont chiffrées avec une clé elle-même chiffrée par
    la clé racine, et la clé racine n'est jamais écrite nulle part. bao
    status montrait Sealed true et Unseal Progress 0/3. Trois parts
    différentes données à bao operator unseal l'ont reconstituée (le partage
    de secret de Shamir : trois quelconques des cinq, jamais moins). Bunks
    avait abandonné après cinq démarrages ratés ; relancé, il a lu ses
    secrets et sa page de santé a répondu.

    BONNE PRATIQUE
    - Les parts appartiennent à des personnes différentes, rangées à part et
      hors ligne ; chaque détenteur·rice tape la sienne (bao operator unseal
      sans argument : la part n'est ni affichée ni gardée dans l'historique).
    - Une part qui a voyagé (un message, une photo) est affaiblie : une fois
      le coffre ouvert, fais de nouvelles parts (bao operator rekey) et
      détruis les anciennes.
    - Le jeton root affiché par bao operator init ne sert qu'à la première
      configuration. Le travail quotidien utilise des jetons limités par des
      politiques ; quand un jeton root est vraiment nécessaire, trois
      détenteur·rices de parts en génèrent un (bao operator generate-root),
      révoqué juste après.
    - Une application qui dépend du coffre doit réessayer patiemment
      (Restart=on-failure, un RestartSec= assez long), et la supervision
      devrait dire « scellé » avant les voyageur·ses.

    UNE AUTRE FAÇON DE FAIRE
    Le descellement automatique (auto-unseal) : la clé racine est protégée
    par un service de gestion de clés (un KMS dans le nuage, un HSM via
    PKCS#11, le moteur transit d'un autre OpenBao) et le serveur se descelle
    seul au démarrage ; les parts deviennent des clés de récupération. Fini
    les appels matinaux, mais la confiance passe à ce service.

    DOCUMENTATION
    - Sceller et desceller : https://openbao.org/docs/concepts/seal/
    - bao operator unseal : https://openbao.org/docs/commands/operator/unseal/
    - bao status : https://openbao.org/docs/commands/status/
    - Les jetons root : https://openbao.org/docs/concepts/tokens/#root-tokens
