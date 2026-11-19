### Histoire « L'Épicerie solidaire », chapitre « Le double des clés » : le
### dépôt restic du disque chiffré n'a qu'une clé, dont le mot de passe ne
### vit que sur le serveur qu'il sauvegarde. restic key list/add, variables
### RESTIC_*, check. Les commandes, options, chemins, variables et sorties
### ne sont pas traduits.

chapter-spare-key = Le double des clés
    .summary = La sauvegarde de nuit écrit maintenant dans un dépôt restic sur le disque chiffré. La trésorière demande si son enveloppe suffirait pour lire les sauvegardes si le serveur brûlait : non. Donnez au dépôt une deuxième clé qui vit hors du serveur, sans casser la sauvegarde de nuit.

spare-key-script-comment = Sauvegarde de nuit vers le disque externe (Noor). Ouvre le disque avec le fichier de clé, restic, referme.

## Fichiers

spare-key-message-fatou =
    De : Fatou (coordinatrice)
    Lundi 12 mars, 8 h 50

    Bonjour !

    Le disque est revenu de chez Joaquín ce matin ; il est branché, et
    fermé, comme il se doit. Depuis lundi dernier, Noor a passé la
    sauvegarde de nuit à restic (le script est
    /usr/local/sbin/nightly-backup) : elle dit qu'il garde la version de
    chaque nuit et ne stocke que ce qui a changé.

    Mercredi, Mei m'a posé une question à laquelle je n'ai pas su
    répondre : « Si cagette brûlait ce soir, avec ce qu'il y a dans mon
    enveloppe, pourrait-on lire les sauvegardes ? » Pouvez-vous vérifier,
    et corriger ce qui doit l'être ? Elle vous a laissé un mot.

    Fatou

spare-key-note-mei =
    Mot de Mei (trésorière)

    Pour le disque, j'ai la phrase de passe. Mais Noor me dit que les
    sauvegardes, dedans, ont leur propre mot de passe, et qu'il est
    « dans un fichier sur le serveur ». Si le serveur disparaît, le
    fichier aussi, non ?

    Au cas où, j'ai généré un mot de passe pour les sauvegardes dans le
    gestionnaire (« Sauvegardes de l'épicerie — secours restic »), et il
    est aussi dans l'enveloppe :

        { $password }

    Supprimez ce mot une fois que vous l'avez utilisé.

## Événements

spare-key-event-opened =
    Le disque est ouvert et monté. Avant de toucher à quoi que ce soit,
    lisez comment la sauvegarde de nuit atteint le dépôt : le script est
    dans /usr/local/sbin.
spare-key-event-job =
    Le script ne donne ni -r ni mot de passe : il exporte deux variables,
    RESTIC_REPOSITORY et RESTIC_PASSWORD_FILE, que restic lit dans son
    environnement. Le mot de passe est dans /root/.restic-pass. Vous
    pouvez faire pareil (export), ou donner -r et --password-file (-p)
    sur la ligne de commande. Et restic doit tourner en root ici : le
    dépôt appartient à root.
spare-key-event-sudo-env =
    restic ne voit pas vos variables : sudo le lance avec un
    environnement vide (env_reset, voir man sudoers). Écrivez-les après
    sudo (sudo RESTIC_REPOSITORY=… restic …), utilisez sudo -E, ou donnez
    -r et -p.
spare-key-event-snapshots =
    Un instantané par nuit de semaine : la sauvegarde fonctionne.
    Maintenant, la question de Mei : qui peut ouvrir ce dépôt ? Chaque
    clé est un accès (man restic, la commande key).
spare-key-event-one-key =
    La liste des clés : ce que le chiffrement de restic accepte comme
    accès. Comptez-les, et demandez-vous où vit chaque mot de passe.
spare-key-event-envelope-fails =
    « wrong password or no key found » : le mot de passe de Mei n'ouvre
    rien aujourd'hui. Son enveloppe lui permettrait d'ouvrir le disque,
    puis de s'arrêter à la porte du dépôt. Cette porte a besoin d'une
    deuxième clé.
spare-key-event-init =
    restic init crée un NOUVEAU dépôt : celui-ci existe déjà, et contient
    les sauvegardes. Gardez-le : c'est une clé qui manque, pas un dépôt.
spare-key-event-remove-current =
    restic refuse de retirer la clé avec laquelle vous lui parlez : tant
    mieux, c'est celle de la sauvegarde de nuit.
spare-key-event-nightly-broken =
    Attention : plus aucune clé n'ouvre le dépôt avec /root/.restic-pass.
    Cette nuit, la sauvegarde échouera sur « wrong password or no key
    found ». La clé de nuit doit rester ; celle de Mei vient en plus
    (restic key add, pas passwd). Remettez la clé du script (key add avec
    le contenu de /root/.restic-pass).
spare-key-event-escrowed =
    Deux clés maintenant : celle du script (son mot de passe sur cagette)
    et celle de Mei (son mot de passe dans le gestionnaire et
    l'enveloppe). Chacune ouvre les mêmes données : restic chiffre les
    données avec une clé maîtresse, et chaque clé ne fait que déverrouiller
    cette clé maîtresse. Vérifiez maintenant que le dépôt est sain.
spare-key-event-checked =
    restic check : aucune erreur. Le dépôt est sain, et il s'ouvre avec un
    mot de passe qui ne vit pas sur cagette.
spare-key-event-written-down =
    Le mot de passe de Mei est maintenant dans un fichier sur cagette (ou
    sur le disque lui-même). C'est justement le piège dont vous vous
    débarrassez : le mot de passe doit vivre hors de cette machine.
    Supprimez ce fichier.
spare-key-event-note =
    Le mot de Mei a disparu : son mot de passe ne vit plus que dans le
    gestionnaire et dans l'enveloppe.
spare-key-event-note-early =
    Vous avez supprimé le mot de Mei avant que sa clé soit dans le dépôt :
    elle l'a renvoyé (cat du mot). Supprimez-le une fois la clé ajoutée.
spare-key-event-closed =
    Le disque est démonté et fermé, prêt à partir vendredi.
spare-key-event-end =
    Mei : « Donc avec mon enveloppe seule, le disque s'ouvre, et les
    sauvegardes aussi ? Même si cagette n'est plus qu'un tas de cendres ? »
    Oui. Fatou : « Alors essayons pour de vrai, samedi. »

    Bravo ! Vous avez terminé le chapitre 2 de L'Épicerie solidaire. (La
    suite vous attend : ssh cagette.)

    CE QUI S'EST PASSÉ
    Le dépôt était chiffré, mais sa seule clé était un mot de passe rangé
    sur cagette, la machine qu'il sauvegarde : si cagette mourait, les
    sauvegardes mouraient avec elle, illisibles. Vous avez lu comment le
    script atteint le dépôt (RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE),
    listé les clés, ajouté une deuxième clé dont Mei garde le mot de
    passe hors du serveur (restic key add), vérifié le dépôt, et fermé le
    disque.

    BONNES PRATIQUES
    - Chaque secret dont une restauration a besoin doit exister ailleurs
      que sur la machine sauvegardée : la phrase de passe du disque ET le
      mot de passe du dépôt.
    - Une clé par usage : celle du script peut être changée ou retirée
      sans toucher à la clé de secours (restic key list, key remove ID).
    - restic key add ajoute un accès ; key passwd remplace la clé
      courante : le script perdrait la sienne.
    - sudo vide l'environnement : les variables vont après sudo, ou
      utilisez -E.
    - restic check après un changement ; check --read-data de temps en
      temps relit chaque paquet (plus lent, mais il trouve les données
      abîmées).
    - Un mot de passe laissé « pour l'instant » dans un fichier sur le
      serveur, c'est exactement le piège : supprimez les mots.

    DOCUMENTATION
    - restic, clés et chiffrement : https://restic.readthedocs.io/en/stable/070_encryption.html
    - restic, variables d'environnement : https://restic.readthedocs.io/en/stable/040_backup.html#environment-variables
    - restic, vérifier un dépôt : https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
