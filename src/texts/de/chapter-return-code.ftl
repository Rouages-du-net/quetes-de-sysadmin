### Geschichte „Der Nachtlauf“, Kapitel „Rückgabewert“: den Batch mit
### GnuCOBOL neu kompilieren (Copybooks, die Spalten des Referenzformats,
### -x), ihn ausführen und seinen Rückgabewert lesen. Befehle, Pfade,
### Compilermeldungen und Programmausgaben werden nicht übersetzt.

chapter-return-code = Rückgabewert
    .summary = Den COBOL-Batch mit cobc kompilieren: seine Copybooks finden, Ayeshas Zeilen in die Spalten setzen, die COBOL erwartet, ein ausführbares Programm bauen und dann lesen, was sein Rückgabewert sagt.

## Dateien

return-code-email-ayesha =
    Von:  Ayesha
    An:   dich

    Die umgewandelte Datei ist fertig, danke. Jetzt der Batch selbst: Das
    Programm, das das Rechenzentrum ausgeführt hat, ist ein Lademodul für
    seinen Mainframe, es kann hier nicht laufen. Wir kompilieren es aus
    Ramóns Quelltext neu, /opt/batch/src/contrib.cob, mit cobc (GnuCOBOL,
    schon installiert).

    Auf dem Mainframe hat jeden Morgen jemand vom Operating das Log des
    Jobs gelesen und die Summen mit dem Schlusssatz verglichen. Hier wird
    das niemand tun. Also habe ich am Ende des Programms eine Prüfung
    eingefügt: Wenn die Summen nicht zum Schlusssatz passen, Rückgabewert
    8. Aber cobc lehnt meine Zeilen ab, und ich sehe nicht, warum: Sie
    sehen aus wie die anderen.

    Sobald es kompiliert, könntest du es auf die Datei von heute Nacht
    anwenden (/srv/batch/in/contrib.dat), dann auf die Testdatei des
    Rechenzentrums (/srv/batch/in/test-bad.dat, ein Satz fehlt absichtlich),
    und jedes Mal den Rückgabewert ansehen? Das Programm nimmt zwei
    Argumente: die Eingabedatei und den zu schreibenden Bericht (zum
    Beispiel in /srv/batch/out).

    Ayesha

## Ereignisse

return-code-event-copy-missing =
    COPY CONTRIBA: cobc sucht das Copybook im aktuellen Verzeichnis und in
    den Verzeichnissen, die man ihm nennt; Ramóns liegen in
    /opt/batch/copybooks. Sag cobc, wo es suchen soll (man cobc, -I).
return-code-event-indicator =
    „invalid indicator at column 7“: Das Referenzformat von COBOL stammt
    von der Lochkarte. Die Spalten 1 bis 6 enthalten eine Folgenummer,
    Spalte 7 das Kennzeichen (* für einen Kommentar, - für eine
    Fortsetzung, ein Leerzeichen für Code), und der Programmtext geht von
    Spalte 8 (Bereich A: Divisions, Paragraphennamen) oder 12 (Bereich B:
    Anweisungen) bis Spalte 72. Ayeshas Zeilen beginnen in Spalte 1, also
    wird ihr 7. Zeichen als Kennzeichen gelesen. Vergleiche sie mit Ramóns
    Zeilen direkt darüber.
return-code-event-free =
    -free schaltet cobc auf freies Format, ohne Spalten: Ramóns
    Folgenummern (000100, 000200…) werden zu Syntaxfehlern. Die Datei ist
    im festen Format: Verschieb lieber Ayeshas Zeilen in die richtigen
    Spalten.
return-code-event-module =
    Segmentation fault: Ohne -x baut cobc ein Modul (NAME.so), das von
    einem anderen Programm oder von cobcrun geladen werden soll, nicht
    direkt ausgeführt. -x baut ein ausführbares Programm.
return-code-event-not-defined =
    PERFORM CHECK-TOTALS ruft einen Paragraphen auf, der nicht mehr da ist:
    Ayeshas Zeilen wurden herausgenommen. Behalte ihre Prüfung, in den
    richtigen Spalten.
return-code-event-unchecked =
    Dieses contrib vergleicht die Summen nicht mit dem Schlusssatz: Ayeshas
    Prüfung wurde auskommentiert oder entfernt. Es kompiliert, aber eine
    falsche Datei käme mit Rückgabewert 0 durch.
return-code-event-compiled =
    Es kompiliert: ein ausführbares Programm, mit Ayeshas Prüfung. Führe es
    mit seinen zwei Argumenten aus (die Eingabedatei, der zu schreibende
    Bericht) und sieh dir dann seinen Rückgabewert an: echo $?
return-code-event-report =
    Rückgabewert 0: Der Bericht ist geschrieben, 12 Beiträge über 515.20,
    wie im Schlusssatz. Ein Programm sagt über seinen Exit-Code, wie es
    gelaufen ist (RETURN-CODE in COBOL, $? in der Shell): 0 heißt, alles
    ist gut.
return-code-event-passed-bad =
    Die Testdatei ist mit Rückgabewert 0 durchgegangen, und doch fehlt ein
    Satz: Dieses contrib prüft den Schlusssatz nicht. Ayeshas Prüfung muss
    mitkompiliert werden.
return-code-event-rc =
    Rückgabewert 8: Die Summen passen nicht zum Schlusssatz (11 Beiträge
    statt 12). Auf dem Mainframe wäre der nächste Schritt des Jobs
    übersprungen worden (COND in der JCL); hier liegt es an dem, was das
    Programm startet, seinen Code anzusehen.
return-code-event-end =
    Ayesha: „Rückgabewert 8 bei der Testdatei des Rechenzentrums: Meine
    Prüfung funktioniert! Und der Bericht vom 21. ist identisch mit dem des
    Mainframes.“

    Gut gemacht! Du hast das Kapitel „Rückgabewert“ abgeschlossen.

    WAS PASSIERT IST
    Das Programm selbst hat sich nicht verändert: Ramóns Quelltext hat sich
    mit GnuCOBOL kompilieren lassen, sobald cobc wusste, wo die Copybooks
    sind (-I), und Ayeshas Zeilen in den Spalten des Referenzformats
    standen (Code ab Spalte 8, Spalte 7 für das Kennzeichen). Mit -x gebaut
    ist es ein ausführbares Programm; auf die zwei Dateien angewandt, hat
    es über seinen Rückgabewert gesagt, wie es jeweils gelaufen ist: 0,
    dann 8.

    GUTE PRAXIS
    - Das Format respektieren, in dem ein Quelltext geschrieben ist: Im
      festen Format gehören die Spalten zur Sprache. Nicht die ganze Datei
      auf -free umstellen, um eine Zeile zu umgehen.
    - Die Copybooks an einem Ort aufbewahren und ihn dem Compiler nennen
      (-I oder COB_COPY_DIR).
    - Ein Batch-Programm sagt über seinen Rückgabewert, wie es gelaufen
      ist: 0 alles gut, 4 eine Warnung, 8 ein Fehler, 12 oder 16 Schlimmeres
      (die Konvention des Mainframes). Immer lesen: echo $? von Hand, und in
      Skripten.

    EIN ANDERER WEG
    cobc -x -I ../copybooks -o /opt/batch/bin/contrib contrib.cob
    installiert es dort, wo der Batch es sucht. Ein Modul (cobc -m, die
    Voreinstellung) wird mit cobcrun ausgeführt oder von einem anderen
    COBOL-Programm aufgerufen. GnuCOBOL kann auch das Listing schreiben
    (-t), um das Programm mit aufgelösten Copybooks zu lesen.

    DOKUMENTATION
    - GnuCOBOL-Handbuch (Referenzformat, COPY, Optionen von cobc): https://gnucobol.sourceforge.io/doc/gnucobol.html
    - Bash, spezielle Parameter ($?): https://www.gnu.org/software/bash/manual/html_node/Special-Parameters.html
