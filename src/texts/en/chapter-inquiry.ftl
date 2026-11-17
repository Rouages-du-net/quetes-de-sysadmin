### Story "The Order Book", chapter "Waiting for a Reply": a night job in
### MSGW on an IBM i, the inquiry message in QSYSOPR, the record lock behind
### it. CL commands, message IDs, job and object names are not translated.

chapter-inquiry = Waiting for a Reply
    .summary = The night's import has been waiting since 02:14 for a reply nobody gave, and the picking lists with it: find the question, read its help, remove its cause, then answer it.

## Shared by the story

order-book-notes-margit =
    Margit's notes - mill, the IBM i (for whoever looks after it next)

    GETTING IN. Two doors to the same machine:
      - the green screen: tn5250 mill from your workstation; sign on with
        your profile and password, then type CL commands at ===>;
      - ssh mill: PASE, a Unix shell (bash, ls, cat, grep...). From there,
        system "WRKACTJOB" runs a CL command, db2 "SELECT ..." runs SQL.
    A question from a job (an inquiry message) is answered on the green
    screen: DSPMSG QSYSOPR.

    CL IN ONE MINUTE. A verb and an object: WRK (work with), DSP
    (display), CHG (change), DLT (delete), CRT (create), END, STR, SAV.
    Parameters by keyword, WRKSPLF SELECT(ORDBATCH), or in order,
    DSPLIB ORDERS. Special values start with *: *ALL, *CURRENT. Objects
    live in libraries: ORDERS/ORDHDR is the file ORDHDR of the library
    ORDERS (ORDERS.ORDHDR in SQL, /QSYS.LIB/ORDERS.LIB/ORDHDR.FILE from
    PASE). CMD ? shows a command's help; from PASE, man WRKACTJOB.

    THE NIGHT (job queue QBATCH: one job at a time)
      02:00  ORDIMPORT  imports the web's orders (program ORDERS/ORDIMP).
                        If it stops, submit it again, it skips what is
                        already imported:
                        SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT)
      then   ORDPICK    the picking lists for the morning shift
      then   ACCTEXP    the accountant's export
      then   ORDINV     the invoices, into QPRINT, printed at 08:30.
                        To print them again:
                        SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV)
      23:00  NIGHTSAV   saves the library ORDERS into the save file
                        BACKUP/ORDERS.
    ORDWEB, in its own subsystem ORDSBS, receives the bakeries' web
    orders day and night.

    MY RULES. Never end a batch job without reading its job log
    (DSPJOBLOG). Never answer an inquiry without reading its help. QPRINT
    belongs to everybody.

    Margit

## Files

inquiry-email-kwame =
    From:  Kwame
    To:    you

    Good morning, and welcome to the mill! It's 07:40, the drivers are
    waiting, and there are no picking lists this morning.

    Our orders have lived on the IBM i in the office since 1996 (an AS/400
    back then). Margit set everything up; she has retired and only comes
    on Thursdays, but she left her notes in your home: notes-margit.txt.

    Could you find out why the night's work stopped, and get it going
    again, without losing last night's web orders? The lists print by
    themselves once the night's jobs have run.

    Soraya adds: "I left in a hurry last night, the phone rang while I was
    on order 1847 (La Mie d'Inès), on the green screen. I didn't
    change anything, I think I left it open."

    Your profile is YOU, password millstone-2029: tn5250 mill from your
    workstation for the green screen, or ssh mill for the Unix side.

    Kwame

## Events

inquiry-event-linux-habit =
    No systemd here: this is PASE, the Unix side of an IBM i. Jobs,
    messages and printers belong to IBM i itself, and are reached with CL
    commands: on the green screen (tn5250 mill), or from here with
    system "WRKACTJOB". Margit's notes give the first steps.
inquiry-event-msgw =
    ORDIMPORT, the night's import, is in MSGW: waiting for a reply to a
    message. A batch job that asks a question stops until someone answers
    it, and nobody was there at 02:14. The question is in the operator's
    message queue, QSYSOPR.
inquiry-event-queue =
    Behind ORDIMPORT, QBATCH's job queue waits: the picking lists
    (ORDPICK), the accountant's export, the invoices. QBATCH runs one batch
    job at a time: one stuck job holds back the whole night.
inquiry-event-inquiry =
    The question: RNQ1218, "Unable to allocate a record in file ORDHDR (R
    C G D F)". The letters in parentheses are the valid replies. Before
    choosing, read the message's help (? at the reply prompt, F1 on a real
    screen): what each reply does, and why the record couldn't be had.
inquiry-event-cause =
    There it is: record 28 of ORDHDR, order 1847, is held by job
    412655/SORAYA/QPADEV0004, Soraya's green screen, left open last night
    on that order. As long as her session holds it, the import can't
    change the order. Soraya says she changed nothing: her session can be
    ended.
inquiry-event-retry-locked =
    R retried, but the record is still held: the job waited again, and
    the same question came back. Retrying only helps once the cause is
    gone: release the record first.
inquiry-event-killed =
    The import was ended in the middle of its work: the orders after 1847
    weren't imported, and the queue moved on without them. Margit's notes
    say how to submit it again (it skips what is already there), once the
    record is free.
inquiry-event-cancelled =
    The import was cancelled: the job ended abnormally, with only part of
    the night's orders. Margit's notes say how to submit it again (it
    skips what is already there), once the record is free.
inquiry-event-skipped =
    G skipped the record: the import went on, but order 1847's change was
    left out, silently. The bakery will receive the old quantity. Free the
    record, then submit the import again: it applies what it skipped.
inquiry-event-web-ended =
    ORDWEB was ended: the bakeries' web orders no longer arrive. It
    belongs to the subsystem ORDSBS: start it again (ENDSBS then STRSBS
    ORDERS/ORDSBS, man STRSBS).
inquiry-event-released =
    Soraya's session is gone, and its lock with it: record 28 is free. Now
    the question can be answered.
inquiry-event-end =
    Kwame: "The lists are coming out of the printer! And Soraya will log
    off before leaving, promise."

    Well done! You have finished the chapter "Waiting for a Reply".

    WHAT HAPPENED
    At 02:14, the import (ORDIMPORT) needed order 1847, which Soraya's
    session had kept locked since the evening. It waited, then asked the
    operator a question, the inquiry RNQ1218, and went into MSGW. Nobody
    answers QSYSOPR at night: the job waited, and QBATCH's job queue behind
    it. You found the job (WRKACTJOB), the question (DSPMSG QSYSOPR), its
    help and the job log (CPF5027: the job holding the record), released
    the record by ending the forgotten session, then answered R: the
    import went on, ended normally, and the night's jobs ran.

    GOOD PRACTICE
    - An inquiry is a decision: read its second-level text (F1) and the
      job log before replying. R only helps once the cause is gone; C or
      ENDJOB lose the run; G skips data silently.
    - Find who holds a lock: DSPRCDLCK, WRKOBJLCK, the CPF5027 message.
    - Someone must watch QSYSOPR at night, or the replies must be known in
      advance: the system reply list (WRKRPYLE) answers chosen messages by
      itself, and a message monitor can alert someone.
    - Sign off at the end of the day (or let QINACTITV end idle sessions).

    DOCUMENTATION
    - Inquiry messages: https://www.ibm.com/docs/en/i/7.5?topic=types-inquiry-messages
    - DSPMSG: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dspmsg.html
    - DSPRCDLCK: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dsprcdlck.html
    - The system reply list: https://www.ibm.com/docs/en/i/7.5?topic=messages-using-system-reply-list

## Shared by the story: a CL command (or tn5250) typed in PASE
order-book-event-cl-in-pase =
    You are in PASE, the Unix side of the IBM i: CL commands aren't its
    programs. From here, system runs one (system "WRKACTJOB"). For the
    green screen, where you can also answer a message, go back to your
    workstation (exit), then tn5250 mill.
