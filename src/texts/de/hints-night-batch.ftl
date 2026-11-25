### Abgestufte Hinweise für Der Nachtlauf (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung)
### und .solution (fast die Antwort).

## Kapitel 1 — Feste Breite

hint-copybook-records =
    .lead = Die Datei hat keine Zeilen: Zähle ihre Bytes und vergleiche mit der Satzlänge aus dem Copybook (man wc; /opt/batch/copybooks/CONTRIB.cpy).
    .solution = wc -c /srv/drop/contrib.ebc: 560 Bytes, also 14 Sätze zu 40 (LRECL=40).
hint-copybook-bytes =
    .lead = Sieh dir die Bytes selbst an, hexadezimal oder als Zeichen (man od, man xxd, man hexdump).
    .solution = xxd /srv/drop/contrib.ebc | head, oder od -c, oder hexdump -C: C8 F0 F0… ist „H00…“ in EBCDIC; die Bytes 34 bis 38 jedes Satzes sind der gepackte Betrag.
hint-copybook-converted =
    .lead = Eine Umwandlung der ganzen Datei beschädigt die gepackten Beträge. Ramóns Notizen (/opt/batch/NOTES.txt) nennen das Werkzeug, das Feld für Feld umwandelt.
    .solution = /opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat, dann cat /srv/batch/in/contrib.dat.
hint-copybook-end =
    .lead = Füll pruefung.txt aus: die Größe, die Sätze und was der Schlusssatz sagt (die letzte Zeile der umgewandelten Datei).
    .solution = nano pruefung.txt: 560 Bytes, 14 Sätze, 12 Beiträge, Kontrollsumme 515.20 (T000012…+000051520).

## Kapitel 2 — Rückgabewert

hint-return-code-compiled =
    .lead = cobc muss wissen, wo die Copybooks sind, will ein ausführbares Programm statt eines Moduls und liest den Quelltext nach seinen Spalten (man cobc).
    .solution = Setz Ayeshas Zeilen in die Spalten (Code ab Spalte 8: CHECK-TOTALS. nach 7 Leerzeichen, die Anweisungen nach 11), dann cd /opt/batch/src und cobc -x -I /opt/batch/copybooks contrib.cob.
hint-return-code-report =
    .lead = Führe das kompilierte Programm mit seinen zwei Argumenten aus: die Eingabedatei, dann der zu schreibende Bericht.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt, dann echo $? und cat /srv/batch/out/contrib.rpt.
hint-return-code-rc =
    .lead = Jetzt die Testdatei des Rechenzentrums, und ihr Rückgabewert.
    .solution = ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt, dann echo $? (8).
hint-return-code-end =
    .lead = Beide Läufe sind nötig: die Datei von heute Nacht (0) und die Testdatei (8), mit eingebauter Prüfung von Ayesha.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt und ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt.

## Kapitel 3 — Die verspätete Datei

hint-late-file-diagnosed =
    .lead = Was hat der Batch letzte Nacht verarbeitet? Seine Ausgabe steht im Journal seines Dienstes (man journalctl).
    .solution = journalctl -u night-batch: zwei Läufe mit RUN DATE 291122; stat /srv/drop/contrib.ebc: Die neue Datei kam um 02:39.
hint-late-file-first-night =
    .lead = Das Wrapper-Skript darf erst starten, wenn contrib.ebc.done da ist, muss es wegnehmen, sobald die Datei verarbeitet ist, und muss in der Nacht erneut gestartet werden (man systemd.timer, man test).
    .solution = In run-night.sh: set -e, dann test -f /srv/drop/contrib.ebc.done || exit 0, dann rm /srv/drop/contrib.ebc.done vor den beiden Programmen; im Timer OnCalendar=*-*-* 02..06:00/10, dann sudo systemctl daemon-reload.
hint-late-file-second-night =
    .lead = Wenn das Programm mit 8 endet, muss auch das Wrapper-Skript damit enden (nicht mit dem echo), oder eine Mail schicken.
    .solution = set -e oben in run-night.sh und das abschließende echo entfernen: systemd markiert night-batch als fehlgeschlagen; oder /opt/batch/bin/contrib … || echo "contrib failed" | mail -s "night batch" du.
hint-late-file-end =
    .lead = Beide Nächte einer Probe müssen gut laufen: die verspätete Datei einmal verarbeitet, die unvollständige gestoppt und jemand gewarnt.
    .solution = set -e; test -f /srv/drop/contrib.ebc.done || exit 0; rm /srv/drop/contrib.ebc.done; ebc2asc; contrib (kein echo); OnCalendar=*-*-* 02..06:00/10 und daemon-reload.
