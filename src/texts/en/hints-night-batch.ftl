### Graded hints for The Night Batch (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction) and .solution
### (almost the answer).

## Chapter 1 — Fixed Width

hint-copybook-records =
    .lead = The file has no lines: count its bytes, and compare with the record length the copybook gives (man wc; /opt/batch/copybooks/CONTRIB.cpy).
    .solution = wc -c /srv/drop/contrib.ebc: 560 bytes, so 14 records of 40 (LRECL=40).
hint-copybook-bytes =
    .lead = Look at the bytes themselves, in hexadecimal or as characters (man od, man xxd, man hexdump).
    .solution = xxd /srv/drop/contrib.ebc | head, or od -c, or hexdump -C: C8 F0 F0… is "H00…" in EBCDIC; bytes 34 to 38 of each record are the packed amount.
hint-copybook-converted =
    .lead = A conversion of the whole file damages the packed amounts. Ramón's notes (/opt/batch/NOTES.txt) name the tool that converts field by field.
    .solution = /opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat, then cat /srv/batch/in/contrib.dat.
hint-copybook-end =
    .lead = Fill in check.txt: the size, the records, what the trailer says (the last line of the converted file), and the first amount as the original file stores it (bytes 34 to 38 of the second record, in od or xxd).
    .solution = nano check.txt: 560 bytes, 14 records, 12 contributions, control total 515.20 (T000012…+000051520), first amount 00 00 04 25 0C.

## Chapter 2 — Return Code

hint-return-code-compiled =
    .lead = cobc needs to know where the copybooks are, wants an executable rather than a module, and reads the source by its columns (man cobc).
    .solution = Put Ayesha's lines in the columns (code from column 8: CHECK-TOTALS. after 7 spaces, the statements after 11), then cd /opt/batch/src and cobc -x -I /opt/batch/copybooks contrib.cob.
hint-return-code-report =
    .lead = Run the program you compiled with its two arguments: the input file, then the report to write.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt, then echo $? and cat /srv/batch/out/contrib.rpt.
hint-return-code-rc =
    .lead = Now the bureau's test file, and its return code.
    .solution = ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt, then echo $? (8).
hint-return-code-end =
    .lead = Both runs are needed: tonight's file (0) and the test file (8), with Ayesha's check compiled in.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt and ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt.

## Chapter 3 — The Late File

hint-late-file-diagnosed =
    .lead = What did the batch process last night? Its output is in the journal of its service (man journalctl).
    .solution = journalctl -u night-batch: two runs on RUN DATE 291122; stat /srv/drop/contrib.ebc: the new file came at 02:39.
hint-late-file-first-night =
    .lead = The wrapper must start only when contrib.ebc.done is there, take it away once the file is processed, and be started again during the night (man systemd.timer, man test).
    .solution = In run-night.sh: set -e, then test -f /srv/drop/contrib.ebc.done || exit 0, then rm /srv/drop/contrib.ebc.done before the two programs; in the timer, OnCalendar=*-*-* 02..06:00/10, then sudo systemctl daemon-reload.
hint-late-file-second-night =
    .lead = When the program ends with 8, the wrapper must end with it too (not with the echo), or send a mail.
    .solution = set -e at the top of run-night.sh and remove the final echo: systemd marks night-batch failed; or /opt/batch/bin/contrib … || echo "contrib failed" | mail -s "night batch" you.
hint-late-file-end =
    .lead = Both nights of a rehearsal must go well: the late file processed once, the incomplete one stopped with someone warned.
    .solution = set -e; test -f /srv/drop/contrib.ebc.done || exit 0; rm /srv/drop/contrib.ebc.done; ebc2asc; contrib (no echo); OnCalendar=*-*-* 02..06:00/10 and daemon-reload.
