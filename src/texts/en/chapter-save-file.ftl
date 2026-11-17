### Story "The Order Book", chapter "Saved, Except One": the night's save
### of an IBM i library left a file out (in use); then the orders exported
### as CSV to a Linux server, in the right character set. CL commands,
### message IDs, object names and paths are not translated.

chapter-save-file = Saved, Except One
    .summary = The night's save "completed normally", without the orders. Save them while they work, then send them to the new reporting server as a CSV Linux can read, accents included.

## Files

save-file-email-kwame =
    From:  Kwame
    To:    you

    Two things today, one boring, one new.

    The boring one: Margit asked me on the phone whether "the night's save
    is fine". I said yes, the job NIGHTSAV says "completed normally" every
    morning. She said: "That's not what I asked." Could you check that
    last night's save of the order book (the save file BACKUP/ORDERS)
    really holds everything, and save it again if not? The bakeries order
    on the web all day: if anything has to stop, keep it short.

    The new one: sieve, the Debian server for our new reports, wants the
    open orders (the table ORDHDR) as a CSV file, in its inbox,
    /srv/reports/inbox/. The reporting tool reads UTF-8, and our bakeries
    have accents: Pâtisserie Müller, Boulangerie Éloïse... Every order
    once, please. Your key on mill (PASE) opens sieve: scp works.

    Kwame

## Events

save-file-event-not-saved =
    "Completed normally", and yet: CPF3771, 15 objects saved from ORDERS,
    1 not saved. The missing one is ORDHDR, the orders themselves. A job
    can end normally after a partial save: the summary message is what
    tells. Why wasn't it saved? The history log says: in use (CPF3202).
save-file-event-in-use =
    ORDWEB, the web receiver, keeps ORDHDR open (*SHRUPD) day and night:
    a save without save-while-active skips an object a job holds for
    update. Either stop what holds it for the time of the save (its
    subsystem, ORDSBS), or save while active (SAVLIB's SAVACT parameter).
save-file-event-still-in-use =
    The same thing again: ORDHDR is in use, and SAVLIB without SAVACT
    skips it. man SAVLIB: SAVACT.
save-file-event-web-down =
    ORDSBS is stopped: ORDWEB no longer receives the bakeries' orders.
    Fine for the time of a save; start it again as soon as it's done,
    with STRSBS ORDERS/ORDSBS.
save-file-event-saved =
    BACKUP/ORDERS now holds all of ORDERS, ORDHDR included (DSPSAVF). The
    night's save needs the same fix, or tomorrow it skips ORDHDR again:
    Margit will change NIGHTSAV on Thursday, with SAVACT.
save-file-event-ebcdic =
    That file is in CCSID 37: EBCDIC, like the table, because CPYTOIMPF's
    STMFCCSID(*STMF), the default, gives a new file the table's CCSID. On
    Linux, file says "data" and cat shows garbage. Ask for UTF-8
    (STMFCCSID(1208)), or convert it on the way (iconv -f IBM037).
save-file-event-latin1 =
    That file is in a single-byte ASCII code page (*PCASCII is
    Windows-1252, *STDASCII ISO 8859-1): on sieve's UTF-8, every accented
    letter shows as �. The reporting tool reads UTF-8: CCSID 1208.
save-file-event-exported =
    A stream file in CCSID 1208: UTF-8, what sieve reads. Have a look at
    it (head, file) before sending it.
save-file-event-duplicates =
    The file on sieve has some orders twice: CPYTOIMPF's MBROPT(*ADD),
    the default, appends to an existing stream file. MBROPT(*REPLACE)
    writes it again, then send it again.
save-file-event-end =
    Kwame: "The first report is on the screen, with every bakery's name
    spelled right. And Margit says the save is 'finally a save'."

    Well done! You have finished the chapter "Saved, Except One".

    WHAT HAPPENED
    The night's save job ended "normally" after saving 15 objects of 16:
    ORDHDR, open for update by the web receiver, was skipped (CPF3202,
    CPF3741, CPF3771). You read the history log and the save file, found
    the lock (WRKOBJLCK), and saved the library again, while active
    (SAVACT) or with its subsystem stopped for a moment. Then you exported
    the orders with CPYTOIMPF to a stream file of the IFS, in UTF-8 (CCSID
    1208) rather than the table's EBCDIC (37), and copied it to sieve with
    scp from PASE.

    GOOD PRACTICE
    - A save is checked by its messages, not by its job's end: CPF3771
      "not saved", DSPSAVF against DSPLIB.
    - Save-while-active (SAVACT) lets a library be saved while jobs use
      it; for a consistent point across files under commitment control,
      SAVACT(*SYNCLIB) and a short wait (SAVACTWAIT).
    - Between IBM i and the rest of the world, say the character set:
      STMFCCSID(1208) for UTF-8, MBROPT(*REPLACE) to write the file again,
      RCDDLM(*LF) for Unix line ends; check with file on arrival.
    - Test a restore now and then (RSTLIB into another library): a save
      nobody has restored is a hope.

    DOCUMENTATION
    - SAVLIB: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/savlib.html
    - Save-while-active: https://www.ibm.com/docs/en/i/7.5?topic=system-save-while-active
    - CPYTOIMPF: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/cpytoimpf.html
    - CCSIDs: https://www.ibm.com/docs/en/i/7.5?topic=information-ccsid-values-defined-i
