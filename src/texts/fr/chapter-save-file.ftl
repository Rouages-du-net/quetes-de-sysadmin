### Histoire « Le carnet de commandes », chapitre « Tout sauvegardé, sauf
### un » : la sauvegarde de nuit d'une bibliothèque IBM i a laissé un fichier
### de côté (utilisé) ; puis les commandes exportées en CSV vers un serveur
### Linux, dans le bon jeu de caractères. Les commandes CL, les identifiants
### de messages, les noms d'objets et les chemins ne sont pas traduits.

chapter-save-file = Tout sauvegardé, sauf un
    .summary = La sauvegarde de la nuit s'est « terminée normalement », sans les commandes. Les sauvegarder pendant qu'elles travaillent, puis les envoyer au nouveau serveur de rapports en un CSV que Linux sait lire, accents compris.

## Fichiers

save-file-email-kwame =
    De :  Kwame
    À :   vous

    Deux choses aujourd'hui, une ennuyeuse, une nouvelle.

    L'ennuyeuse : Margit m'a demandé au téléphone si « la sauvegarde de la
    nuit va bien ». J'ai dit oui, le travail NIGHTSAV dit « completed
    normally » tous les matins. Elle a répondu : « Ce n'est pas ce que je
    demandais. » Pourriez-vous vérifier que la sauvegarde d'hier soir du
    carnet de commandes (le fichier de sauvegarde BACKUP/ORDERS) contient
    vraiment tout, et la refaire sinon ? Les boulangeries commandent sur le
    web toute la journée : si quelque chose doit s'arrêter, faites court.

    La nouvelle : tamis, le serveur Debian de nos nouveaux rapports, veut
    les commandes ouvertes (la table ORDHDR) en fichier CSV, dans sa boîte
    de réception, /srv/reports/inbox/. L'outil de rapports lit l'UTF-8, et
    nos boulangeries ont des accents : Pâtisserie Müller, Boulangerie
    Éloïse... Chaque commande une seule fois, s'il vous plaît. Votre clé
    sur moulin (PASE) ouvre tamis : scp fonctionne.

    Kwame

## Événements

save-file-event-not-saved =
    « Completed normally », et pourtant : CPF3771, 15 objets sauvegardés
    depuis ORDERS, 1 non sauvegardé. Celui qui manque, c'est ORDHDR, les
    commandes elles-mêmes. Un travail peut se terminer normalement après
    une sauvegarde partielle : c'est le message de bilan qui le dit.
    Pourquoi n'a-t-il pas été sauvegardé ? L'historique le dit : il
    était utilisé (CPF3202).
save-file-event-in-use =
    ORDWEB, le récepteur web, garde ORDHDR ouvert (*SHRUPD) jour et nuit :
    une sauvegarde sans sauvegarde en cours d'activité saute un objet
    qu'un travail tient en mise à jour. Soit vous arrêtez ce qui le tient
    le temps de la sauvegarde (son sous-système, ORDSBS), soit vous
    sauvegardez en cours d'activité (le paramètre SAVACT de SAVLIB).
save-file-event-still-in-use =
    Encore la même chose : ORDHDR est utilisé, et SAVLIB sans SAVACT le
    saute. man SAVLIB : SAVACT.
save-file-event-web-down =
    ORDSBS est arrêté : ORDWEB ne reçoit plus les commandes des
    boulangeries. Très bien le temps d'une sauvegarde ; redémarrez-le dès
    qu'elle est faite (STRSBS ORDERS/ORDSBS).
save-file-event-saved =
    BACKUP/ORDERS contient maintenant tout ORDERS, ORDHDR compris
    (DSPSAVF). La sauvegarde de la nuit a besoin de la même correction,
    sinon demain elle sautera de nouveau ORDHDR : Margit modifiera NIGHTSAV
    jeudi, avec SAVACT.
save-file-event-ebcdic =
    Ce fichier est en CCSID 37 : de l'EBCDIC, comme la table, parce que
    STMFCCSID(*STMF), la valeur par défaut de CPYTOIMPF, donne à un
    nouveau fichier le CCSID de la table. Sous Linux, file dit « data » et
    cat affiche du charabia. Demandez de l'UTF-8 (STMFCCSID(1208)), ou
    convertissez-le en route (iconv -f IBM037).
save-file-event-latin1 =
    Ce fichier est dans une page de code ASCII à un octet (*PCASCII, c'est
    le Windows-1252, *STDASCII l'ISO 8859-1) : dans l'UTF-8 de tamis,
    chaque lettre accentuée s'affiche �. L'outil de rapports lit
    l'UTF-8 : le CCSID 1208.
save-file-event-exported =
    Un fichier STREAM en CCSID 1208 : de l'UTF-8, ce que lit tamis.
    Jetez-y un œil (head, file) avant de l'envoyer.
save-file-event-duplicates =
    Le fichier sur tamis a certaines commandes en double : MBROPT(*ADD), la
    valeur par défaut de CPYTOIMPF, ajoute à un fichier existant.
    MBROPT(*REPLACE) le réécrit ; puis envoyez-le de nouveau.
save-file-event-end =
    Kwame : « Le premier rapport est à l'écran, avec le nom de chaque
    boulangerie bien écrit. Et Margit dit que la sauvegarde est "enfin une
    sauvegarde". »

    Bravo ! Vous avez terminé le chapitre « Tout sauvegardé, sauf un ».

    CE QUI S'EST PASSÉ
    Le travail de sauvegarde de la nuit s'est terminé « normalement »
    après avoir sauvegardé 15 objets sur 16 : ORDHDR, ouvert en mise à jour
    par le récepteur web, a été sauté (CPF3202, CPF3741, CPF3771). Vous avez
    lu l'historique du système et le fichier de sauvegarde, trouvé le
    verrou (WRKOBJLCK), et sauvegardé la bibliothèque de nouveau, en cours
    d'activité (SAVACT) ou avec son sous-système arrêté un instant. Puis
    vous avez exporté les commandes avec CPYTOIMPF vers un fichier STREAM
    de l'IFS, en UTF-8 (CCSID 1208) plutôt que dans l'EBCDIC de la table
    (37), et l'avez copié sur tamis avec scp depuis PASE.

    BONNES PRATIQUES
    - Une sauvegarde se vérifie à ses messages, pas à la fin de son
      travail : CPF3771 « not saved », DSPSAVF face à DSPLIB.
    - La sauvegarde en cours d'activité (SAVACT) permet de sauvegarder une
      bibliothèque pendant que des travaux l'utilisent ; pour un point
      cohérent entre fichiers sous contrôle de validation, *SYNCLIB et une
      courte attente (SAVACTWAIT).
    - Entre IBM i et le reste du monde, dites le jeu de caractères :
      STMFCCSID(1208) pour l'UTF-8, MBROPT(*REPLACE) pour réécrire le
      fichier, RCDDLM(*LF) pour des fins de ligne Unix ; vérifiez avec file
      à l'arrivée.
    - Testez une restauration de temps en temps (RSTLIB dans une autre
      bibliothèque) : une sauvegarde que personne n'a restaurée est un
      espoir.

    DOCUMENTATION
    - SAVLIB : https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/savlib.html
    - La sauvegarde en cours d'activité : https://www.ibm.com/docs/en/i/7.5?topic=system-save-while-active
    - CPYTOIMPF : https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/cpytoimpf.html
    - Les CCSID : https://www.ibm.com/docs/en/i/7.5?topic=information-ccsid-values-defined-i
