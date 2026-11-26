### Geschichte „Das Auftragsbuch“, Kapitel „Gesichert, bis auf eine“: Die
### nächtliche Sicherung einer IBM-i-Bibliothek hat eine Datei ausgelassen
### (in Gebrauch); dann die Bestellungen als CSV auf einen Linux-Server
### exportieren, im richtigen Zeichensatz. CL-Befehle, Nachrichten-IDs,
### Objektnamen und Pfade werden nicht übersetzt.

chapter-save-file = Gesichert, bis auf eine
    .summary = Die nächtliche Sicherung ist „normal beendet“, ohne die Bestellungen. Sie sichern, während sie arbeiten, und sie dann als CSV, die Linux lesen kann, an den neuen Berichtsserver schicken, Akzente inklusive.

## Dateien

save-file-email-kwame =
    Von:  Kwame
    An:   dich

    Zwei Dinge heute, ein langweiliges und ein neues.

    Das langweilige: Margit hat mich am Telefon gefragt, ob „die
    nächtliche Sicherung in Ordnung ist“. Ich habe ja gesagt, der Job
    NIGHTSAV sagt jeden Morgen „completed normally“. Sie sagte: „Das habe
    ich nicht gefragt.“ Könntest du prüfen, ob die Sicherung des
    Auftragsbuchs von letzter Nacht (die Sicherungsdatei BACKUP/ORDERS)
    wirklich alles enthält, und sie sonst neu machen? Die Bäckereien
    bestellen den ganzen Tag im Web: Wenn etwas anhalten muss, dann kurz.

    Das neue: sieb, der Debian-Server für unsere neuen Berichte, möchte die
    offenen Bestellungen (die Tabelle ORDHDR) als CSV-Datei in seinem
    Eingang, /srv/reports/inbox/. Das Berichtswerkzeug liest UTF-8, und
    unsere Bäckereien haben Akzente: Pâtisserie Müller, Boulangerie
    Éloïse... Jede Bestellung einmal, bitte. Dein Schlüssel auf muehle
    (PASE) öffnet sieb: scp funktioniert.

    Kwame

## Ereignisse

save-file-event-not-saved =
    „Completed normally“, und doch: CPF3771, 15 Objekte aus ORDERS
    gesichert, 1 nicht gesichert. Das fehlende ist ORDHDR, die Bestellungen
    selbst. Ein Job kann nach einer Teilsicherung normal enden: Die
    Zusammenfassungsnachricht ist es, die es sagt. Warum wurde es nicht
    gesichert? Das Protokoll (History Log) sagt es: in Gebrauch (CPF3202).
save-file-event-in-use =
    ORDWEB, der Web-Empfänger, hält ORDHDR Tag und Nacht offen (*SHRUPD):
    Eine Sicherung ohne Sichern bei aktivem System überspringt ein Objekt,
    das ein Job zum Ändern hält. Entweder stoppst du für die Dauer der
    Sicherung, was es hält (sein Subsystem, ORDSBS), oder du sicherst bei
    aktivem System (der Parameter SAVACT von SAVLIB).
save-file-event-still-in-use =
    Wieder dasselbe: ORDHDR ist in Gebrauch, und SAVLIB ohne SAVACT
    überspringt es. man SAVLIB: SAVACT.
save-file-event-web-down =
    ORDSBS ist gestoppt: ORDWEB empfängt die Bestellungen der Bäckereien
    nicht mehr. In Ordnung für die Dauer einer Sicherung; starte es wieder,
    sobald sie fertig ist, mit STRSBS ORDERS/ORDSBS.
save-file-event-saved =
    BACKUP/ORDERS enthält jetzt ganz ORDERS, ORDHDR inklusive (DSPSAVF).
    Die nächtliche Sicherung braucht dieselbe Korrektur, sonst überspringt
    sie ORDHDR morgen wieder: Margit ändert NIGHTSAV am Donnerstag, mit
    SAVACT.
save-file-event-ebcdic =
    Diese Datei ist in CCSID 37: EBCDIC, wie die Tabelle, weil
    STMFCCSID(*STMF) von CPYTOIMPF, die Voreinstellung, einer neuen Datei
    die CCSID der Tabelle gibt. Unter Linux sagt file „data“, und cat zeigt
    Kauderwelsch. Verlange UTF-8 (STMFCCSID(1208)) oder wandle sie
    unterwegs um (iconv -f IBM037).
save-file-event-latin1 =
    Diese Datei ist in einer Ein-Byte-ASCII-Codepage (*PCASCII ist
    Windows-1252, *STDASCII ISO 8859-1): Im UTF-8 von sieb erscheint jeder
    Buchstabe mit Akzent als �. Das Berichtswerkzeug liest UTF-8: CCSID
    1208.
save-file-event-exported =
    Eine Stream-Datei in CCSID 1208: UTF-8, was sieb liest. Schau sie dir
    an (head, file), bevor du sie schickst.
save-file-event-duplicates =
    Die Datei auf sieb enthält manche Bestellungen doppelt: MBROPT(*ADD)
    von CPYTOIMPF, die Voreinstellung, hängt an eine bestehende
    Stream-Datei an. MBROPT(*REPLACE) schreibt sie neu; schick sie dann
    noch einmal.
save-file-event-end =
    Kwame: „Der erste Bericht ist auf dem Bildschirm, mit dem Namen jeder
    Bäckerei richtig geschrieben. Und Margit sagt, die Sicherung ist
    ‚endlich eine Sicherung‘.“

    Gut gemacht! Du hast das Kapitel „Gesichert, bis auf eine“
    abgeschlossen.

    WAS PASSIERT IST
    Der nächtliche Sicherungsjob endete „normal“, nachdem er 15 von 16
    Objekten gesichert hatte: ORDHDR, vom Web-Empfänger zum Ändern offen,
    wurde übersprungen (CPF3202, CPF3741, CPF3771). Du hast das Protokoll
    und die Sicherungsdatei gelesen, die Sperre gefunden (WRKOBJLCK) und
    die Bibliothek neu gesichert, bei aktivem System (SAVACT) oder mit
    kurz gestopptem Subsystem. Dann hast du die Bestellungen mit CPYTOIMPF
    in eine Stream-Datei des IFS exportiert, in UTF-8 (CCSID 1208) statt
    dem EBCDIC der Tabelle (37), und sie mit scp von PASE aus nach sieb
    kopiert.

    GUTE PRAXIS
    - Eine Sicherung prüft man an ihren Nachrichten, nicht am Ende ihres
      Jobs: CPF3771 „not saved“, DSPSAVF gegen DSPLIB.
    - Sichern bei aktivem System (SAVACT) erlaubt, eine Bibliothek zu
      sichern, während Jobs sie benutzen; für einen konsistenten Punkt
      über Dateien unter Commitment Control SAVACT(*SYNCLIB) und eine kurze
      Wartezeit (SAVACTWAIT).
    - Zwischen der IBM i und dem Rest der Welt den Zeichensatz nennen:
      STMFCCSID(1208) für UTF-8, MBROPT(*REPLACE), um die Datei neu zu
      schreiben, RCDDLM(*LF) für Unix-Zeilenenden; bei der Ankunft mit
      file prüfen.
    - Ab und zu eine Wiederherstellung testen (RSTLIB in eine andere
      Bibliothek): Eine Sicherung, die nie jemand wiederhergestellt hat,
      ist eine Hoffnung.

    DOKUMENTATION
    - SAVLIB: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/savlib.html
    - Sichern bei aktivem System: https://www.ibm.com/docs/en/i/7.5?topic=system-save-while-active
    - CPYTOIMPF: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/cpytoimpf.html
    - CCSIDs: https://www.ibm.com/docs/en/i/7.5?topic=information-ccsid-values-defined-i
