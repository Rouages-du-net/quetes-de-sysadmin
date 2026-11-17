### Story "The Order Book", chapter "Paper Nobody Prints": the system ASP
### filled by spooled files on an IBM i. CL commands, message IDs, object
### names are not translated.

chapter-spooled = Paper Nobody Prints
    .summary = The IBM i's disk is past its threshold, and no file is to blame: thousands of printed listings nobody prints. Delete only those, keep the invoices, and stop the cause.

## Files

spooled-email-kwame =
    From:  Kwame
    To:    you

    Hello again! This morning there's a message for the operator that
    worries me, something about "storage" (in QSYSOPR, Soraya says). The
    disk of the IBM i is full? We don't keep anything big on it, the order
    book is tiny.

    Careful with the printer queue: this morning's invoices are waiting
    in it, Soraya prints them at 08:30 and they go out with the
    deliveries.

    Could you find what takes the room, clean it, and make sure it doesn't
    fill up again?

    Kwame

## Events

spooled-event-storage =
    The system ASP (the IBM i's disks, as one pool) is past its threshold
    of 90 %: QSYSOPR received CPF0907. At 100 %, the system stops. On
    Linux you would look for a big file with du; here, look at the
    objects that pile up without anyone noticing: printed output waiting
    in the output queues (WRKOUTQ, WRKSPLF).
spooled-event-culprit =
    DBGLIST, user data ORDPICKDBG, status HLD: debug listings of ORDPICK,
    one per order, every night, held and never printed. Thousands of
    them, in QPRINT, the shared queue, right next to the invoices
    (INVOICE). Something makes ORDPICK write them: a program's switch,
    maybe, in its library.
spooled-event-flag =
    ORDDEBUG is "Y": ORDPICK writes its debug listing for every order.
    Margit must have turned it on to chase a bug, and never turned it off.
    As long as it's on, every night adds six hundred listings.
spooled-event-invoices-lost =
    The invoices are gone too: they were in the same queue, waiting to be
    printed at 08:30. A whole queue, or all of a user's files, takes
    everything in it. Margit's notes say how to print them again.
spooled-event-cleaned =
    The debug listings are deleted: the ASP has room again (WRKSYSSTS).
spooled-event-switched-off =
    ORDDEBUG is off: ORDPICK no longer writes its listing. Tonight won't
    fill the queue again.
spooled-event-end =
    Kwame: "Below 85 %, and the invoices are printing. Margit laughed on
    the phone: she had forgotten that switch since 2027!"

    Well done! You have finished the chapter "Paper Nobody Prints".

    WHAT HAPPENED
    The disk wasn't filled by data, but by printed output: spooled files.
    For two years, a debug switch (the data area ORDERS/ORDDEBUG) made
    ORDPICK write a listing for every order, through a printer file that
    holds and saves them (HOLD, SAVE): 18,000 spooled files in QPRINT,
    the queue the invoices go through too. You found them (WRKSYSSTS,
    WRKOUTQ, WRKSPLF), deleted only them (DLTSPLF FILE(*SELECT) with the
    user data, or job by job), and turned the switch off.

    GOOD PRACTICE
    - Spooled files are objects: they take disk, they have owners, they
      outlive the jobs that made them. Watch WRKSYSSTS and the queues.
    - Delete with the narrowest selection: user, queue, user data. CLROUTQ
      on a shared queue, or every file of a user, deletes what still has
      to print.
    - Remove the cause, not only the symptom: the switch, or the printer
      file (CHGPRTF ... HOLD(*NO) SAVE(*NO), or its own output queue).
    - Let the system clean up: Operational Assistant's automatic cleanup
      (GO CLEANUP) deletes old job logs and system output after a number
      of days.

    DOCUMENTATION
    - DLTSPLF: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dltsplf.html
    - CLROUTQ: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/clroutq.html
    - Spooled files and output queues: https://www.ibm.com/docs/en/i/7.5?topic=concepts-spooled-files-output-queues
    - Automatic cleanup: https://www.ibm.com/docs/en/i/7.5?topic=cleanup-starting-automatic
