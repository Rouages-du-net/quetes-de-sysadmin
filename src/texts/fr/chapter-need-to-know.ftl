### Histoire « L'Auberge », chapitre « Besoin d'en connaître » : une
### application qui lit ses secrets avec le jeton root ; une politique pour
### elle seule, un jeton qui la porte, le jeton root révoqué. Commandes,
### options, chemins, noms de politiques et de jetons et sorties d'OpenBao :
### non traduits.

chapter-need-to-know = Besoin d'en connaître
    .summary = Le site de réservation lit ses mots de passe dans le coffre avec le jeton root, le tout-puissant affiché à l'installation. Écris une politique qui le laisse lire ses propres secrets et rien d'autre, donne-lui un jeton à lui, et débarrasse-toi du jeton root.

## Fichiers

need-to-know-message-desta =
    De : Desta
    Mardi 9 mars, 10:15

    Re-bonjour !

    Ruslan est rentré de sa randonnée, et il a envoyé ses notes
    d'installation (elles sont chez toi). Une ligne m'a inquiétée :
    « bunks.env : jeton root pour l'instant, à remplacer ». Il avoue que
    « pour l'instant » veut dire « jusqu'à ce que quelqu'un s'en occupe ».

    Tu veux bien être ce quelqu'un ? Si je comprends bien, Bunks ne devrait
    pouvoir lire que ses deux secrets : pas les coordonnées bancaires
    d'Hiroko, pas le Wi-Fi des voyageur·ses, et surtout ne rien modifier. Et
    ensuite, le jeton root devrait disparaître : Ruslan dit que personne ne
    devrait en garder un qui traîne.

    Desta

need-to-know-notes-ruslan =
    Notes de Ruslan (cadenas, OpenBao, février 2027)

    - OpenBao 2.7.3, depuis le .deb d'OpenBao lui-même (il n'est pas dans
      l'archive de Debian). Configuration : /etc/openbao/openbao.hcl ;
      données dans /opt/openbao/data ; API sur le port 8200 (TLS, le
      certificat autosigné du paquet) ; journal d'audit :
      /var/log/openbao/audit.log.
    - Initialisé le 14 février : 5 parts, seuil 3. Le jeton root de l'init
      est celui de /etc/bunks/bunks.env (provisoire !).
    - Secrets : un moteur KV version 2 sur secret/. Bunks : secret/bunks/db
      (username, password) et secret/bunks/payments (account, api_key).
      Aussi secret/treasurer/bank (Hiroko) et secret/wifi/guests.
    - KV version 2 garde des versions : la CLI dit bao kv get
      secret/bunks/db, mais l'API, et donc les politiques, voient
      secret/data/bunks/db (et les métadonnées sous secret/metadata/).
    - Chaque admin a un jeton orphelin avec la politique admin (bao policy
      read admin), dans ~/.vault-token. Orphelin : il ne dépend pas du jeton
      root.
    - Bunks lit BAO_TOKEN dans bunks.env quand il démarre (sudo systemctl
      restart bunks pour qu'il le relise). Sa santé :
      curl http://127.0.0.1:8080/health
    - man bao.

## Événements

need-to-know-event-resealed =
    OpenBao a été redémarré, il est donc revenu scellé. Desta, Hiroko et
    Nnamdi sont passé·es taper leurs parts : il est de nouveau descellé. Les
    politiques et les jetons prennent effet aussitôt ; OpenBao n'a jamais
    besoin d'un redémarrage pour eux.
need-to-know-event-no-data =
    Cette politique a une règle sur secret/… sans data/ : elle ne correspond
    à aucune requête de Bunks. Avec KV version 2, le chemin d'API du secret
    bunks/db est secret/data/bunks/db (et ses métadonnées,
    secret/metadata/bunks/db). Les commandes bao kv cachent ce préfixe ; les
    politiques, non.
need-to-know-event-too-wide =
    Cette politique donne plus que ce dont Bunks a besoin. Vérifie avec bao
    token capabilities : Bunks doit lire secret/data/bunks/*, et rien
    d'autre : ni create, ni update, ni delete, rien sous treasurer ou wifi,
    pas de politiques, pas de jetons.
need-to-know-event-policy =
    La politique est enregistrée dans OpenBao (bao policy list, bao policy
    read). Une politique ne fait rien toute seule : elle s'applique aux
    jetons qui la portent.
need-to-know-event-from-root =
    Ce jeton a été créé avec le jeton root : c'est son enfant, et révoquer un
    jeton révoque tous ses enfants. Quand le jeton root partira, celui-ci
    partira avec. Crée le jeton de Bunks avec ton propre jeton admin, qui est
    orphelin.
need-to-know-event-token =
    Un jeton qui porte la politique. bao token lookup montre ses politiques,
    sa durée de vie (creation_ttl, expire_time) ; bao token capabilities
    JETON CHEMIN montre ce qu'il peut faire sur un chemin.
need-to-know-event-denied =
    Bunks n'a pas pu démarrer : « permission denied » sur son secret
    (journalctl -u bunks). Le jeton de bunks.env n'a pas le droit de lire ce
    chemin : quelles politiques porte-t-il, et que dit bao token
    capabilities sur secret/data/bunks/db ?
need-to-know-event-switched =
    Bunks a redémarré avec son propre jeton : il lit ses deux secrets, et
    rien d'autre.
need-to-know-event-wide-app =
    Bunks tourne avec un jeton qui peut faire plus que lire ses deux secrets
    (bao token capabilities). Qui le vole obtient tout cela.
need-to-know-event-checked =
    La page de santé répond, avec le nouveau jeton.
need-to-know-event-early-revoke =
    Le jeton root est révoqué, mais Bunks a démarré avec : il garde ses
    secrets en mémoire et ne remarque rien pour l'instant, mais son prochain
    démarrage échouera. Donne-lui son propre jeton maintenant.
need-to-know-event-root-revoked =
    Le jeton root est révoqué : bao token lookup dessus répond maintenant
    « bad token ». S'il en faut un jour un autre, trois détenteur·rices de
    parts peuvent le générer (bao operator generate-root), pour le révoquer
    juste après.
need-to-know-event-end =
    Desta : « Ruslan a lu ta politique et a dit : besoin d'en connaître,
    comme il se doit. Il raye "pour l'instant". »

    Bravo ! Tu as terminé Besoin d'en connaître.

    CE QUI S'EST PASSÉ
    Bunks démarrait avec le jeton root de l'init : illimité, et sans
    expiration. Tu as écrit une politique pour Bunks seul (read sur
    secret/data/bunks/* : l'API de KV version 2 met data/ dans le chemin),
    l'as chargée avec bao policy write, as créé un jeton qui la porte (avec
    ton jeton admin orphelin : il a donc une durée de vie et ne dépend pas de
    root), l'as mis dans bunks.env et as relancé Bunks ; puis tu as révoqué
    le jeton root. bao token capabilities prouve ce qu'un jeton peut faire ou
    non.

    BONNE PRATIQUE
    - Une politique par application, le moindre privilège : les chemins
      qu'elle lit, les capacités dont elle a besoin (read), rien d'autre ;
      tout le reste est refusé par défaut.
    - Les jetons expirent : une application qui tourne longtemps renouvelle
      son jeton (renew-self) ou en reçoit un nouveau avant la fin de son TTL.
    - Attention à la hiérarchie : un jeton enfant meurt avec son parent ;
      les services reçoivent des jetons orphelins (ou un rôle).
    - Le jeton root : généré quand il le faut (bao operator generate-root),
      révoqué juste après, jamais gardé dans un fichier.
    - Le fichier de jeton d'une application n'est lisible que par son compte
      (bunks.env est root:bunks, 0640).

    UNE AUTRE FAÇON DE FAIRE
    Plutôt qu'un jeton dans un fichier, une application peut se connecter
    elle-même : AppRole (un identifiant de rôle et un identifiant secret
    remis séparément), ou une identité de machine (certificat TLS, JWT,
    Kubernetes) ; OpenBao Agent peut se connecter et renouveler pour
    l'application, et écrire ses secrets dans un fichier. Plus de pièces
    mobiles, moins de secrets à longue durée de vie.

    DOCUMENTATION
    - Les politiques : https://openbao.org/docs/concepts/policies/
    - Les jetons : https://openbao.org/docs/concepts/tokens/
    - KV version 2 et ses chemins : https://openbao.org/docs/secrets/kv/kv-v2/
    - bao token create : https://openbao.org/docs/commands/token/create/
    - AppRole : https://openbao.org/docs/auth/approle/
