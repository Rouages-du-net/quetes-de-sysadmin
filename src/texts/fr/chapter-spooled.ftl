### Histoire « Le carnet de commandes », chapitre « Du papier que personne
### n'imprime » : l'ASP système d'un IBM i rempli par des fichiers spoule.
### Les commandes CL, les identifiants de messages, les noms d'objets ne sont
### pas traduits.

chapter-spooled = Du papier que personne n'imprime
    .summary = Le disque de l'IBM i a passé son seuil, et aucun fichier n'est en cause : des milliers de listings que personne n'imprime. Supprimer seulement ceux-là, garder les factures, et arrêter la cause.

## Fichiers

spooled-email-kwame =
    De :  Kwame
    À :   vous

    Re-bonjour ! Ce matin, il y a pour l'opérateur un message qui
    m'inquiète, une histoire de « storage » (dans QSYSOPR, dit Soraya). Le
    disque de l'IBM i est plein ? On n'y garde rien de gros, le carnet de
    commandes est tout petit.

    Attention à la file d'impression : les factures de ce matin y
    attendent, Soraya les imprime à 8 h 30 et elles partent avec les
    livraisons.

    Pourriez-vous trouver ce qui prend la place, faire le ménage, et faire
    en sorte que ça ne se remplisse plus ?

    Kwame

## Événements

spooled-event-storage =
    L'ASP système (les disques de l'IBM i, en un seul pool) a dépassé son
    seuil de 90 % : QSYSOPR a reçu CPF0907. À 100 %, le système s'arrête.
    Sous Linux, vous chercheriez un gros fichier avec du ; ici, regardez
    les objets qui s'accumulent sans que personne ne les voie : les sorties
    imprimées qui attendent dans les files de sortie (WRKOUTQ, WRKSPLF).
spooled-event-culprit =
    DBGLIST, données utilisateur ORDPICKDBG, état HLD : des listings de
    débogage d'ORDPICK, un par commande, chaque nuit, suspendus et jamais
    imprimés. Des milliers, dans QPRINT, la file partagée, juste à côté des
    factures (INVOICE). Quelque chose fait écrire ORDPICK : un interrupteur
    du programme, peut-être, dans sa bibliothèque.
spooled-event-flag =
    ORDDEBUG vaut « Y » : ORDPICK écrit son listing de débogage pour chaque
    commande. Margit a dû l'allumer pour chasser un bogue, et ne jamais
    l'éteindre. Tant qu'il est allumé, chaque nuit ajoute six cents
    listings.
spooled-event-invoices-lost =
    Les factures sont parties aussi : elles étaient dans la même file, en
    attente d'impression à 8 h 30. Une file entière, ou tous les fichiers
    d'un utilisateur, emporte tout ce qu'elle contient. Les notes de Margit
    disent comment les réimprimer.
spooled-event-cleaned =
    Les listings de débogage sont supprimés : l'ASP a de nouveau de la
    place (WRKSYSSTS).
spooled-event-switched-off =
    ORDDEBUG est éteint : ORDPICK n'écrit plus son listing. Cette nuit ne
    remplira pas la file de nouveau.
spooled-event-end =
    Kwame : « Sous les 85 %, et les factures s'impriment. Margit a ri au
    téléphone : elle avait oublié cet interrupteur depuis 2027 ! »

    Bravo ! Vous avez terminé le chapitre « Du papier que personne n'imprime ».

    CE QUI S'EST PASSÉ
    Le disque n'était pas rempli par des données, mais par des sorties
    imprimées : des fichiers spoule. Depuis deux ans, un interrupteur de
    débogage (la zone de données ORDERS/ORDDEBUG) faisait écrire à ORDPICK
    un listing par commande, par un fichier d'impression qui les suspend et
    les conserve (HOLD, SAVE) : 18 000 fichiers spoule dans QPRINT, la file
    par où passent aussi les factures. Vous les avez trouvés (WRKSYSSTS,
    WRKOUTQ, WRKSPLF), supprimé eux seuls (DLTSPLF FILE(*SELECT) avec les
    données utilisateur, ou travail par travail), et éteint
    l'interrupteur.

    BONNES PRATIQUES
    - Les fichiers spoule sont des objets : ils prennent du disque, ont
      des propriétaires, survivent aux travaux qui les ont faits.
      Surveillez WRKSYSSTS et les files.
    - Supprimez avec la sélection la plus étroite : utilisateur, file,
      données utilisateur. CLROUTQ sur une file partagée, ou tous les
      fichiers d'un utilisateur, supprime ce qui doit encore être imprimé.
    - Supprimez la cause, pas seulement le symptôme : l'interrupteur, ou
      le fichier d'impression (CHGPRTF ... HOLD(*NO) SAVE(*NO), ou une file
      à lui).
    - Laissez le système faire le ménage : le nettoyage automatique
      d'Operational Assistant (GO CLEANUP) supprime les anciens historiques
      et sorties du système après un nombre de jours.

    DOCUMENTATION
    - DLTSPLF : https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dltsplf.html
    - CLROUTQ : https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/clroutq.html
    - Fichiers spoule et files de sortie : https://www.ibm.com/docs/en/i/7.5?topic=concepts-spooled-files-output-queues
    - Le nettoyage automatique : https://www.ibm.com/docs/en/i/7.5?topic=cleanup-starting-automatic
