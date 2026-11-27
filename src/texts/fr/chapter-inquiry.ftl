### Histoire « Le carnet de commandes », chapitre « En attente de réponse » :
### un travail de nuit en MSGW sur un IBM i, la demande dans QSYSOPR, le
### verrou d'enregistrement derrière. Les commandes CL, les identifiants de
### messages, les noms de travaux et d'objets ne sont pas traduits.

chapter-inquiry = En attente de réponse
    .summary = L'import de la nuit attend depuis 2 h 14 une réponse que personne n'a donnée, et les listes de préparation avec lui : trouver la question, lire son aide, supprimer sa cause, puis y répondre.

## Partagé par l'histoire

order-book-notes-margit =
    Notes de Margit - moulin, l'IBM i (pour qui s'en occupera après moi)

    POUR ENTRER. Deux portes vers la même machine :
      - l'écran vert : tn5250 moulin depuis votre poste de travail ;
        ouvrez la session avec votre profil et votre mot de passe, puis
        tapez les commandes CL après ===> ;
      - ssh moulin : PASE, un shell Unix (bash, ls, cat, grep...). De là,
        system "WRKACTJOB" lance une commande CL, db2 "SELECT ..." du SQL.
    Une question d'un travail (un message d'interrogation, une « demande »)
    se répond sur l'écran vert : DSPMSG QSYSOPR.

    LE CL EN UNE MINUTE. Un verbe et un objet : WRK (gérer), DSP
    (afficher), CHG (modifier), DLT (supprimer), CRT (créer), END, STR,
    SAV. Les paramètres par mot-clé, WRKSPLF SELECT(ORDBATCH), ou dans
    l'ordre, DSPLIB ORDERS. Les valeurs spéciales commencent par une
    étoile : *ALL, *CURRENT. Les objets vivent dans des bibliothèques : ORDERS/ORDHDR,
    c'est le fichier ORDHDR de la bibliothèque ORDERS (ORDERS.ORDHDR en
    SQL, /QSYS.LIB/ORDERS.LIB/ORDHDR.FILE depuis PASE). CMD ? affiche
    l'aide d'une commande ; depuis PASE, man WRKACTJOB.

    LA NUIT (file de travaux QBATCH : un travail à la fois)
      02:00  ORDIMPORT  importe les commandes du web (programme
                        ORDERS/ORDIMP). S'il s'arrête, soumettez-le de
                        nouveau, il saute ce qui est déjà importé :
                        SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT)
      puis   ORDPICK    les listes de préparation de l'équipe du matin
      puis   ACCTEXP    l'export pour la comptable
      puis   ORDINV     les factures, dans QPRINT, imprimées à 8 h 30.
                        Pour les réimprimer :
                        SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV)
      23:00  NIGHTSAV   sauvegarde la bibliothèque ORDERS dans le fichier
                        de sauvegarde BACKUP/ORDERS.
    ORDWEB, dans son propre sous-système ORDSBS, reçoit jour et nuit les
    commandes web des boulangeries.

    MES RÈGLES. Ne jamais arrêter un travail par lots sans lire son
    historique (DSPJOBLOG). Ne jamais répondre à une demande sans lire son
    aide. QPRINT appartient à tout le monde.

    Margit

## Fichiers

inquiry-email-kwame =
    De :  Kwame
    À :   vous

    Bonjour, et bienvenue au moulin ! Il est 7 h 40, les chauffeur·ses
    attendent, et il n'y a pas de listes de préparation ce matin.

    Nos commandes vivent sur l'IBM i du bureau depuis 1996 (un AS/400 à
    l'époque). C'est Margit qui a tout mis en place ; elle est à la
    retraite et ne passe plus que le jeudi, mais elle a laissé ses notes
    dans votre dossier : notes-de-margit.txt.

    Pourriez-vous trouver pourquoi le travail de la nuit s'est arrêté, et
    le relancer, sans perdre les commandes web d'hier soir ? Les listes
    s'impriment toutes seules une fois les travaux de la nuit passés.

    Le bureau a ouvert à sept heures : les commandes par téléphone sont
    prises sur l'écran vert comme d'habitude, alors ne coupez personne,
    s'il vous plaît.

    Votre profil est VOUS, mot de passe meule-2029 : tn5250 moulin depuis
    votre poste de travail pour l'écran vert, ou ssh moulin pour le côté
    Unix.

    Kwame

## Événements

inquiry-event-linux-habit =
    Pas de systemd ici : c'est PASE, le côté Unix d'un IBM i. Les travaux,
    les messages et les imprimantes appartiennent à IBM i lui-même, et
    s'atteignent avec des commandes CL : sur l'écran vert (tn5250 moulin),
    ou d'ici avec system "WRKACTJOB". Les notes de Margit donnent les
    premiers pas.
inquiry-event-msgw =
    ORDIMPORT, l'import de la nuit, est en MSGW : il attend la réponse à
    un message. Un travail par lots qui pose une question s'arrête jusqu'à
    ce qu'on lui réponde, et personne n'était là à 2 h 14. La question est
    dans la file de messages de l'opérateur, QSYSOPR.
inquiry-event-queue =
    Derrière ORDIMPORT, la file de travaux de QBATCH attend : les listes de
    préparation (ORDPICK), l'export pour la comptable, les factures. QBATCH
    exécute un travail par lots à la fois : un travail bloqué retient toute
    la nuit.
inquiry-event-inquiry =
    La question : RNQ1218, « Unable to allocate a record in file ORDHDR (R
    C G D F) » (impossible d'obtenir un enregistrement du fichier ORDHDR).
    Les lettres entre parenthèses sont les réponses valides. Avant de
    choisir, lisez l'aide du message (? à l'invite de réponse, F1 sur un
    vrai écran) : ce que fait chaque réponse, et pourquoi l'enregistrement
    n'a pas pu être obtenu.
inquiry-event-cause =
    Le voilà : l'enregistrement 28 d'ORDHDR, la commande 1847, est tenu
    par le travail 412655/SORAYA/QPADEV0004, l'écran vert de Soraya,
    laissé ouvert hier soir sur cette commande. Tant que sa session le
    tient, l'import ne peut pas modifier la commande. Kwame l'appelle : le
    téléphone a sonné, elle est partie en vitesse, et n'a rien modifié.
    Sa session peut être arrêtée.
inquiry-event-retry-locked =
    R a réessayé, mais l'enregistrement est toujours tenu : le travail a
    attendu de nouveau, et la même question est revenue. Réessayer n'aide
    qu'une fois la cause supprimée : libérez d'abord l'enregistrement.
inquiry-event-killed =
    L'import a été arrêté au milieu de son travail : les commandes après la
    1847 n'ont pas été importées, et la file a continué sans elles. Les
    notes de Margit disent comment le soumettre de nouveau (il saute ce qui
    est déjà là), une fois l'enregistrement libre.
inquiry-event-cancelled =
    L'import a été annulé : le travail s'est terminé anormalement, avec une
    partie seulement des commandes de la nuit. Les notes de Margit disent
    comment le soumettre de nouveau (il saute ce qui est déjà là), une fois
    l'enregistrement libre.
inquiry-event-skipped =
    G a sauté l'enregistrement : l'import a continué, mais la modification
    de la commande 1847 a été laissée de côté, sans bruit. La boulangerie
    recevra l'ancienne quantité. Libérez l'enregistrement, puis soumettez
    l'import de nouveau : il applique ce qu'il a sauté.
inquiry-event-wrong-session =
    Vous avez arrêté la session de Diego : il saisissait la commande d'une
    boulangerie au téléphone, et elle est perdue. Sa session tenait
    ORDHDR ouvert, comme tout écran de saisie, mais aucun
    enregistrement : le verrou d'enregistrement (DSPRCDLCK, ou
    l'historique du travail de l'import) nomme le travail qui tient la
    commande 1847. « Annuler la dernière saisie » (Instantané de secours)
    vous ramène avant cette commande.
inquiry-event-web-ended =
    ORDWEB a été arrêté : les commandes web des boulangeries n'arrivent
    plus. Il appartient au sous-système ORDSBS : redémarrez-le (ENDSBS
    puis STRSBS ORDERS/ORDSBS, man STRSBS).
inquiry-event-released =
    La session de Soraya est partie, et son verrou avec : l'enregistrement
    28 est libre. On peut maintenant répondre à la question.
inquiry-event-end =
    Kwame : « Les listes sortent de l'imprimante ! Et Soraya fermera sa
    session avant de partir, promis. »

    Bravo ! Vous avez terminé le chapitre « En attente de réponse ».

    CE QUI S'EST PASSÉ
    À 2 h 14, l'import (ORDIMPORT) avait besoin de la commande 1847, que
    la session de Soraya gardait verrouillée depuis la veille. Il a
    attendu, puis posé une question à l'opérateur, la demande RNQ1218, et
    il est passé en MSGW. Personne ne répond à QSYSOPR la nuit : le
    travail a attendu, et la file de QBATCH derrière lui. Vous avez trouvé
    le travail (WRKACTJOB), la question (DSPMSG QSYSOPR), son aide et
    l'historique du travail (CPF5027 : le travail qui tient
    l'enregistrement), libéré l'enregistrement en arrêtant la session
    oubliée, puis répondu R : l'import a continué, s'est terminé
    normalement, et les travaux de la nuit sont passés.

    BONNES PRATIQUES
    - Une demande, c'est une décision : lisez son texte de second niveau
      (F1) et l'historique du travail avant de répondre. R n'aide qu'une
      fois la cause supprimée ; C ou ENDJOB perdent le traitement ; G saute
      des données sans bruit.
    - Trouvez qui tient un verrou : DSPRCDLCK, WRKOBJLCK, le message
      CPF5027.
    - Quelqu'un doit surveiller QSYSOPR la nuit, ou les réponses doivent
      être connues d'avance : la liste de réponses du système (WRKRPYLE)
      répond seule aux messages choisis, et un moniteur de messages peut
      prévenir quelqu'un.
    - Fermez la session en fin de journée (ou laissez QINACTITV arrêter
      les sessions inactives).

    DOCUMENTATION
    - Les messages d'interrogation : https://www.ibm.com/docs/en/i/7.5?topic=types-inquiry-messages
    - DSPMSG : https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dspmsg.html
    - DSPRCDLCK : https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dsprcdlck.html
    - La liste de réponses du système : https://www.ibm.com/docs/en/i/7.5?topic=messages-using-system-reply-list

## Partagé par l'histoire : une commande CL (ou tn5250) tapée dans PASE
order-book-event-cl-in-pase =
    Vous êtes dans PASE, le côté Unix de l'IBM i : les commandes CL n'y
    sont pas des programmes. D'ici, system en lance une (system
    "WRKACTJOB"). Pour l'écran vert, où l'on peut aussi répondre à un
    message, revenez à votre poste de travail (exit), puis tn5250 moulin.
