### Abgestufte Hinweise für Das Auftragsbuch (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine
### Richtung) und .solution (fast die Antwort).

## Kapitel 1 — Warten auf Antwort

hint-inquiry-msgw =
    .lead = Öffne den grünen Bildschirm von deinem Rechner aus (tn5250 muehle) und sieh dir die laufenden Jobs und ihren Status an (WRKACTJOB ?).
    .solution = tn5250 muehle, anmelden, dann WRKACTJOB: ORDIMPORT ist in MSGW in QBATCH.
hint-inquiry-inquiry =
    .lead = Ein Job in MSGW wartet auf eine Antwort auf eine Nachricht in der Nachrichtenwarteschlange des Operators (DSPMSG ?).
    .solution = DSPMSG QSYSOPR: RNQ1218, „Unable to allocate a record in file ORDHDR (R C G D F)“.
hint-inquiry-cause =
    .lead = Lies vor dem Antworten die Hilfe der Nachricht (? bei der Antwortaufforderung), dann das Protokoll des Jobs, oder wer die Sätze der Datei hält (DSPJOBLOG ?, DSPRCDLCK ?).
    .solution = DSPJOBLOG JOB(412907/ORDBATCH/ORDIMPORT) oder DSPRCDLCK FILE(ORDERS/ORDHDR): Satz 28 gehalten von 412655/SORAYA/QPADEV0004.
hint-inquiry-released =
    .lead = Der Satz wird von einer Sitzung gehalten, die niemand mehr benutzt: Beende sie (ENDJOB ?), nicht den Import.
    .solution = ENDJOB JOB(412655/SORAYA/QPADEV0004) OPTION(*IMMED).
hint-inquiry-end =
    .lead = Die Ursache ist weg: Beantworte die Frage, damit der Import es erneut versucht. Wenn der Import unterwegs verloren ging, sagen Margits Notizen, wie man ihn erneut übergibt.
    .solution = DSPMSG QSYSOPR, Antwort R. (Wenn er beendet oder abgebrochen wurde: SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT).)

## Kapitel 2 — Papier, das niemand druckt

hint-spooled-storage =
    .lead = Lies die Nachricht des Operators, dann den Status des Systems: Wie voll ist der System-ASP (WRKSYSSTS ?)?
    .solution = DSPMSG QSYSOPR (CPF0907), dann WRKSYSSTS: % system ASP used, über 90.
hint-spooled-culprit =
    .lead = Nichts Großes in den Bibliotheken: Sieh dir die Druckausgabe an, die in den Ausgabewarteschlangen wartet (WRKOUTQ ?, WRKSPLF ?).
    .solution = WRKOUTQ: QPRINT enthält 18.000 Dateien; WRKSPLF SELECT(ORDBATCH): DBGLIST, Benutzerdaten ORDPICKDBG, HLD.
hint-spooled-cleaned =
    .lead = Lösch nur die Debug-Listen, über alle Nacht-Jobs hinweg, mit einer Auswahl, die die Rechnungen in Ruhe lässt (DLTSPLF ?: FILE(*SELECT) und SELECT).
    .solution = DLTSPLF FILE(*SELECT) SELECT(ORDBATCH *ALL *ALL ORDPICKDBG)
hint-spooled-switched-off =
    .lead = Etwas sagt ORDPICK, seine Liste zu schreiben: Sieh dir die Objekte der Bibliothek ORDERS an (DSPLIB ?), vielleicht einen Datenbereich (DSPDTAARA ?, CHGDTAARA ?).
    .solution = DSPDTAARA DTAARA(ORDERS/ORDDEBUG) zeigt Y; CHGDTAARA DTAARA(ORDERS/ORDDEBUG) VALUE('N').
hint-spooled-end =
    .lead = Die Listen weg, der Schalter aus, und die 31 Rechnungen von heute Morgen immer noch in QPRINT (wenn sie gelöscht wurden, sagen Margits Notizen, wie man sie noch einmal druckt).
    .solution = WRKSPLF SELECT(*ALL *ALL *ALL INVOICE); wenn sie weg sind: SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV).

## Kapitel 3 — Gesichert, bis auf eine

hint-save-file-not-saved =
    .lead = Ein Job, der normal endet, kann trotzdem weniger gesichert haben als verlangt: Lies das Protokoll (History Log) und was die Sicherungsdatei enthält (DSPLOG ?, DSPSAVF ?).
    .solution = DSPLOG JOB(NIGHTSAV): CPF3771, 15 Objekte gesichert, 1 nicht gesichert; DSPSAVF FILE(BACKUP/ORDERS): kein ORDHDR.
hint-save-file-in-use =
    .lead = ORDHDR war „in Gebrauch“: Finde, welcher Job es hält (WRKOBJLCK ?).
    .solution = WRKOBJLCK OBJ(ORDERS/ORDHDR) OBJTYPE(*FILE): ORDWEB hält es.
hint-save-file-saved =
    .lead = Sichere die Bibliothek neu, entweder bei aktivem System (SAVLIB ?: SAVACT) oder mit kurz gestopptem Subsystem, das sie hält (ENDSBS, STRSBS).
    .solution = SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS) SAVACT(*LIB) CLEAR(*ALL), dann DSPSAVF FILE(BACKUP/ORDERS).
hint-save-file-exported =
    .lead = Exportiere die Tabelle in eine Stream-Datei in deinem Home-Verzeichnis, in UTF-8 (CPYTOIMPF ?: TOSTMF, STMFCCSID, MBROPT, RCDDLM).
    .solution = CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/du/orders.csv') MBROPT(*REPLACE) STMFCCSID(1208) RCDDLM(*LF)
hint-save-file-end =
    .lead = Prüfe von PASE aus (ssh muehle) die Datei (file, head) und kopiere sie dann in den Eingang von sieb (man scp). ORDSBS muss laufen.
    .solution = ssh muehle, dann file orders.csv und scp orders.csv sieb:/srv/reports/inbox/
