### Indices gradués pour Le carnet de commandes (voir src/engine/hints.ts) :
### un message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction) et .solution (presque la réponse).

## Chapitre 1 — En attente de réponse

hint-inquiry-msgw =
    .lead = Ouvrez l'écran vert depuis votre poste de travail (tn5250 moulin), et regardez les travaux en cours et leur état (WRKACTJOB ?).
    .solution = tn5250 moulin, ouvrez la session, puis WRKACTJOB : ORDIMPORT est en MSGW dans QBATCH.
hint-inquiry-inquiry =
    .lead = Un travail en MSGW attend la réponse à un message dans la file de messages de l'opérateur (DSPMSG ?).
    .solution = DSPMSG QSYSOPR : RNQ1218, « Unable to allocate a record in file ORDHDR (R C G D F) ».
hint-inquiry-cause =
    .lead = Avant de répondre, lisez l'aide du message (? à l'invite de réponse), puis l'historique du travail, ou qui tient les enregistrements du fichier (DSPJOBLOG ?, DSPRCDLCK ?).
    .solution = DSPJOBLOG JOB(412907/ORDBATCH/ORDIMPORT) ou DSPRCDLCK FILE(ORDERS/ORDHDR) : l'enregistrement 28 est tenu par 412655/SORAYA/QPADEV0004.
hint-inquiry-released =
    .lead = L'enregistrement est tenu par une session que plus personne n'utilise : arrêtez-la (ENDJOB ?), pas l'import.
    .solution = ENDJOB JOB(412655/SORAYA/QPADEV0004) OPTION(*IMMED).
hint-inquiry-end =
    .lead = La cause est partie : répondez à la question pour que l'import réessaie. Si l'import a été perdu en route, les notes de Margit disent comment le soumettre de nouveau.
    .solution = DSPMSG QSYSOPR, répondez R. (S'il a été arrêté ou annulé : SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT).)

## Chapitre 2 — Du papier que personne n'imprime

hint-spooled-storage =
    .lead = Lisez le message de l'opérateur, puis l'état du système : à quel point l'ASP système est-il plein (WRKSYSSTS ?) ?
    .solution = DSPMSG QSYSOPR (CPF0907), puis WRKSYSSTS : % system ASP used, au-dessus de 90.
hint-spooled-culprit =
    .lead = Rien de gros dans les bibliothèques : regardez les sorties imprimées qui attendent dans les files de sortie (WRKOUTQ ?, WRKSPLF ?).
    .solution = WRKOUTQ : QPRINT contient 18 000 fichiers ; WRKSPLF SELECT(ORDBATCH) : DBGLIST, données utilisateur ORDPICKDBG, HLD.
hint-spooled-cleaned =
    .lead = Supprimez seulement les listings de débogage, à travers tous les travaux de nuit, par une sélection qui laisse les factures tranquilles (DLTSPLF ? : FILE(*SELECT) et SELECT).
    .solution = DLTSPLF FILE(*SELECT) SELECT(ORDBATCH *ALL *ALL ORDPICKDBG)
hint-spooled-switched-off =
    .lead = Quelque chose dit à ORDPICK d'écrire son listing : regardez les objets de la bibliothèque ORDERS (DSPLIB ?), une zone de données peut-être (DSPDTAARA ?, CHGDTAARA ?).
    .solution = DSPDTAARA DTAARA(ORDERS/ORDDEBUG) affiche Y ; CHGDTAARA DTAARA(ORDERS/ORDDEBUG) VALUE('N').
hint-spooled-end =
    .lead = Les listings partis, l'interrupteur éteint, et les 31 factures de ce matin toujours dans QPRINT (si elles ont été supprimées, les notes de Margit disent comment les réimprimer).
    .solution = WRKSPLF SELECT(*ALL *ALL *ALL INVOICE) ; si elles sont parties : SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV).

## Chapitre 3 — Tout sauvegardé, sauf un

hint-save-file-not-saved =
    .lead = Un travail qui se termine normalement peut avoir sauvegardé moins que demandé : lisez l'historique du système, et ce que contient le fichier de sauvegarde (DSPLOG ?, DSPSAVF ?).
    .solution = DSPLOG JOB(NIGHTSAV) : CPF3771, 15 objets sauvegardés, 1 non sauvegardé ; DSPSAVF FILE(BACKUP/ORDERS) : pas d'ORDHDR.
hint-save-file-in-use =
    .lead = ORDHDR était « utilisé » : trouvez quel travail le tient (WRKOBJLCK ?).
    .solution = WRKOBJLCK OBJ(ORDERS/ORDHDR) OBJTYPE(*FILE) : ORDWEB le tient.
hint-save-file-saved =
    .lead = Sauvegardez de nouveau la bibliothèque, soit en cours d'activité (SAVLIB ? : SAVACT), soit avec le sous-système qui la tient arrêté un instant (ENDSBS, STRSBS).
    .solution = SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS) SAVACT(*LIB) CLEAR(*ALL), puis DSPSAVF FILE(BACKUP/ORDERS).
hint-save-file-exported =
    .lead = Exportez la table vers un fichier STREAM de votre dossier, en UTF-8 (CPYTOIMPF ? : TOSTMF, STMFCCSID, MBROPT, RCDDLM).
    .solution = CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/vous/orders.csv') MBROPT(*REPLACE) STMFCCSID(1208) RCDDLM(*LF)
hint-save-file-end =
    .lead = Depuis PASE (ssh moulin), vérifiez le fichier (file, head), puis copiez-le dans la boîte de réception de tamis (man scp). ORDSBS doit tourner.
    .solution = ssh moulin, puis file orders.csv et scp orders.csv tamis:/srv/reports/inbox/
