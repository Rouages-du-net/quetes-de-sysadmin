### Graded hints for The Order Book (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction) and .solution
### (almost the answer).

## Chapter 1 — Waiting for a Reply

hint-inquiry-msgw =
    .lead = Open the green screen from your workstation (tn5250 mill), and look at the jobs that are running and their status (WRKACTJOB ?).
    .solution = tn5250 mill, sign on, then WRKACTJOB: ORDIMPORT is in MSGW in QBATCH.
hint-inquiry-inquiry =
    .lead = A job in MSGW waits for a reply to a message in the operator's message queue (DSPMSG ?).
    .solution = DSPMSG QSYSOPR: RNQ1218, "Unable to allocate a record in file ORDHDR (R C G D F)".
hint-inquiry-cause =
    .lead = Before replying, read the message's help (? at the reply prompt), then the job's log, or who holds the file's records (DSPJOBLOG ?, DSPRCDLCK ?).
    .solution = DSPJOBLOG JOB(412907/ORDBATCH/ORDIMPORT) or DSPRCDLCK FILE(ORDERS/ORDHDR): record 28 held by 412655/SORAYA/QPADEV0004.
hint-inquiry-released =
    .lead = The record is held by a session nobody uses any more: end that one (ENDJOB ?), not the import, and not a session someone is working in.
    .solution = ENDJOB JOB(412655/SORAYA/QPADEV0004) OPTION(*IMMED).
hint-inquiry-end =
    .lead = The cause is gone: answer the question so that the import tries again. If the import was lost on the way, Margit's notes say how to submit it again.
    .solution = DSPMSG QSYSOPR, reply R. (If it was ended or cancelled: SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT).)

## Chapter 2 — Paper Nobody Prints

hint-spooled-storage =
    .lead = Read the operator's message, then the system's status: how full is the system ASP (WRKSYSSTS ?)?
    .solution = DSPMSG QSYSOPR (CPF0907), then WRKSYSSTS: % system ASP used, above 90.
hint-spooled-culprit =
    .lead = Nothing big in the libraries: look at the printed output waiting in the output queues (WRKOUTQ ?, WRKSPLF ?).
    .solution = WRKOUTQ: QPRINT holds 18,000 files; WRKSPLF SELECT(ORDBATCH): DBGLIST, user data ORDPICKDBG, HLD.
hint-spooled-cleaned =
    .lead = Delete the debug listings only, across all the night jobs, by a selection that leaves the invoices alone (DLTSPLF ?: FILE(*SELECT) and SELECT).
    .solution = DLTSPLF FILE(*SELECT) SELECT(ORDBATCH *ALL *ALL ORDPICKDBG)
hint-spooled-switched-off =
    .lead = Something tells ORDPICK to write its listing: look at the objects of the library ORDERS (DSPLIB ?), a data area perhaps (DSPDTAARA ?, CHGDTAARA ?).
    .solution = DSPDTAARA DTAARA(ORDERS/ORDDEBUG) shows Y; CHGDTAARA DTAARA(ORDERS/ORDDEBUG) VALUE('N').
hint-spooled-end =
    .lead = The listings gone, the switch off, and this morning's 31 invoices still in QPRINT (if they were deleted, Margit's notes say how to print them again).
    .solution = WRKSPLF SELECT(*ALL *ALL *ALL INVOICE); if they are gone: SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV).

## Chapter 3 — Saved, Except One

hint-save-file-not-saved =
    .lead = A job that ends normally may still have saved less than asked: read the history log, and what the save file holds (DSPLOG ?, DSPSAVF ?).
    .solution = DSPLOG JOB(NIGHTSAV): CPF3771, 15 objects saved, 1 not saved; DSPSAVF FILE(BACKUP/ORDERS): no ORDHDR.
hint-save-file-in-use =
    .lead = ORDHDR was "in use": find which job holds it (WRKOBJLCK ?).
    .solution = WRKOBJLCK OBJ(ORDERS/ORDHDR) OBJTYPE(*FILE): ORDWEB holds it.
hint-save-file-saved =
    .lead = Save the library again, either while it is active (SAVLIB ?: SAVACT), or with the subsystem that holds it stopped for a moment (ENDSBS, STRSBS).
    .solution = SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS) SAVACT(*LIB) CLEAR(*ALL), then DSPSAVF FILE(BACKUP/ORDERS).
hint-save-file-exported =
    .lead = Export the table to a stream file in your home, in UTF-8 (CPYTOIMPF ?: TOSTMF, STMFCCSID, MBROPT, RCDDLM).
    .solution = CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/you/orders.csv') MBROPT(*REPLACE) STMFCCSID(1208) RCDDLM(*LF)
hint-save-file-end =
    .lead = From PASE (ssh mill), check the file (file, head), then copy it into sieve's inbox (man scp). ORDSBS must be running.
    .solution = ssh mill, then file orders.csv and scp orders.csv sieve:/srv/reports/inbox/
