### Story "The Night Batch", chapter "Return Code": compile the batch
### again with GnuCOBOL (copybooks, the reference format's columns, -x), run
### it, and read its return code. Commands, paths, compiler messages and
### program outputs are not translated.

chapter-return-code = Return Code
    .summary = Compile the COBOL batch with cobc: find its copybooks, put Ayesha's lines in the columns COBOL expects, build an executable, then read what its return code says.

## Files

return-code-email-ayesha =
    From:  Ayesha
    To:    you

    The converted file is ready, thank you. Now the batch itself: the
    program the bureau ran is a load module for its mainframe, it can't run
    here. We compile it again from Ramón's source,
    /opt/batch/src/contrib.cob, with cobc (GnuCOBOL, already installed).

    On the mainframe, an operator read the job's log every morning and
    compared the totals with the trailer. Here, nobody will. So I added a
    check at the end of the program: if the totals don't match the
    trailer, return code 8. But cobc refuses my lines, and I don't see why:
    they look like the others.

    Once it compiles, could you run it on tonight's file
    (/srv/batch/in/contrib.dat), then on the bureau's test file
    (/srv/batch/in/test-bad.dat, a record is missing on purpose), and look
    at the return code each time? The program takes two arguments: the
    input file, and the report to write (in /srv/batch/out, for example).

    Ayesha

## Events

return-code-event-copy-missing =
    COPY CONTRIBA: cobc looks for the copybook in the current directory and
    in the directories it is given; Ramón's are in /opt/batch/copybooks.
    Tell cobc where to look (man cobc, -I).
return-code-event-indicator =
    "invalid indicator at column 7": COBOL's reference format comes from the
    punched card. Columns 1 to 6 hold a sequence number, column 7 the
    indicator (* for a comment, - for a continuation, a space for code),
    and the program text goes from column 8 (area A: divisions, paragraph
    names) or 12 (area B: statements) to column 72. Ayesha's lines start in
    column 1, so their 7th character is read as an indicator. Compare them
    with Ramón's lines just above.
return-code-event-free =
    -free switches cobc to free format, with no columns: Ramón's sequence
    numbers (000100, 000200…) become syntax errors. The file is in fixed
    format: move Ayesha's lines to the right columns instead.
return-code-event-module =
    Segmentation fault: without -x, cobc builds a module (NAME.so), made
    to be loaded by another program or by cobcrun, not run directly. -x
    builds an executable.
return-code-event-not-defined =
    PERFORM CHECK-TOTALS calls a paragraph that is no longer there: Ayesha's
    lines were taken out. Keep her check, in the right columns.
return-code-event-unchecked =
    This contrib doesn't compare the totals with the trailer: Ayesha's
    check was commented out or removed. It compiles, but a wrong file would
    go through with return code 0.
return-code-event-compiled =
    It compiles: an executable, with Ayesha's check. Run it with its two
    arguments (the input file, the report to write), then look at its
    return code: echo $?
return-code-event-report =
    Return code 0: the report is written, 12 contributions for 515.20, like
    the trailer. A program says how it went through its exit code
    (RETURN-CODE in COBOL, $? in the shell): 0 means all is well.
return-code-event-passed-bad =
    The test file went through with return code 0, and yet a record is
    missing: this contrib doesn't check the trailer. Ayesha's check has to
    be compiled in.
return-code-event-rc =
    Return code 8: the totals don't match the trailer (11 contributions
    instead of 12). On the mainframe, the job's next step would have been
    skipped (COND in the JCL); here, it's up to whatever runs the program
    to look at its code.
return-code-event-end =
    Ayesha: "Return code 8 on the bureau's test file: my check works! And
    the report of the 21st is identical to the mainframe's."

    Well done! You have finished the chapter "Return Code".

    WHAT HAPPENED
    The program itself didn't change: Ramón's source compiled with
    GnuCOBOL once cobc knew where the copybooks were (-I) and Ayesha's lines
    were in the reference format's columns (code from column 8, column 7
    for the indicator). Built with -x, it is an executable; run on the two
    files, it said how each went through its return code: 0, then 8.

    GOOD PRACTICE
    - Respect the format a source is written in: in fixed format, the
      columns are part of the language. Don't switch the whole file to
      -free to get around one line.
    - Keep the copybooks in one place and give it to the compiler (-I, or
      COB_COPY_DIR).
    - A batch program says how it went through its return code: 0 all is
      well, 4 a warning, 8 an error, 12 or 16 worse (the mainframe's
      convention). Always read it: echo $? by hand, and in scripts.

    ANOTHER WAY
    cobc -x -I ../copybooks -o /opt/batch/bin/contrib contrib.cob installs
    it where the batch looks for it. A module (cobc -m, the default) is run
    with cobcrun, or called by another COBOL program. GnuCOBOL can also
    write the listing (-t) to read the program with its copybooks expanded.

    DOCUMENTATION
    - GnuCOBOL manual (reference format, COPY, cobc options): https://gnucobol.sourceforge.io/doc/gnucobol.html
    - Bash, special parameters ($?): https://www.gnu.org/software/bash/manual/html_node/Special-Parameters.html
