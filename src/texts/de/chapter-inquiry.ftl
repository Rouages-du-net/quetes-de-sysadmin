### Geschichte „Das Auftragsbuch“, Kapitel „Warten auf Antwort“: ein
### Nacht-Job in MSGW auf einer IBM i, die Abfragenachricht in QSYSOPR, die
### Satzsperre dahinter. CL-Befehle, Nachrichten-IDs, Job- und Objektnamen
### werden nicht übersetzt.

chapter-inquiry = Warten auf Antwort
    .summary = Der nächtliche Import wartet seit 02:14 auf eine Antwort, die niemand gegeben hat, und die Kommissionierlisten mit ihm: die Frage finden, ihre Hilfe lesen, ihre Ursache beseitigen und sie dann beantworten.

## Von der Geschichte gemeinsam genutzt

order-book-notes-margit =
    Margits Notizen - muehle, die IBM i (für die Person, die sich als
    Nächstes darum kümmert)

    HINEINKOMMEN. Zwei Türen zur selben Maschine:
      - der grüne Bildschirm: tn5250 muehle von deinem Rechner; melde dich
        mit deinem Profil und Passwort an und tippe dann CL-Befehle bei ===>;
      - ssh muehle: PASE, eine Unix-Shell (bash, ls, cat, grep...). Von
        dort führt system "WRKACTJOB" einen CL-Befehl aus, db2 "SELECT ..."
        führt SQL aus.
    Eine Frage eines Jobs (eine Abfragenachricht) wird auf dem grünen
    Bildschirm beantwortet: DSPMSG QSYSOPR.

    CL IN EINER MINUTE. Ein Verb und ein Objekt: WRK (arbeiten mit), DSP
    (anzeigen), CHG (ändern), DLT (löschen), CRT (erstellen), END, STR,
    SAV. Parameter per Schlüsselwort, WRKSPLF SELECT(ORDBATCH), oder der
    Reihe nach, DSPLIB ORDERS. Sonderwerte beginnen mit *: *ALL, *CURRENT.
    Objekte leben in Bibliotheken: ORDERS/ORDHDR ist die Datei ORDHDR der
    Bibliothek ORDERS (ORDERS.ORDHDR in SQL, /QSYS.LIB/ORDERS.LIB/ORDHDR.FILE
    von PASE aus). CMD ? zeigt die Hilfe eines Befehls; von PASE aus man
    WRKACTJOB.

    DIE NACHT (Jobwarteschlange QBATCH: ein Job nach dem anderen)
      02:00  ORDIMPORT  importiert die Bestellungen aus dem Web (Programm
                        ORDERS/ORDIMP). Wenn er anhält, erneut
                        übergeben, er überspringt, was schon importiert
                        ist:
                        SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT)
      dann   ORDPICK    die Kommissionierlisten für die Morgenschicht
      dann   ACCTEXP    der Export für die Buchhaltung
      dann   ORDINV     die Rechnungen, nach QPRINT, gedruckt um 08:30.
                        Um sie noch einmal zu drucken:
                        SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV)
      23:00  NIGHTSAV   sichert die Bibliothek ORDERS in die Sicherungsdatei
                        BACKUP/ORDERS.
    ORDWEB, in seinem eigenen Subsystem ORDSBS, empfängt Tag und Nacht die
    Web-Bestellungen der Bäckereien.

    MEINE REGELN. Nie einen Batch-Job beenden, ohne sein Jobprotokoll zu
    lesen (DSPJOBLOG). Nie eine Abfrage beantworten, ohne ihre Hilfe zu
    lesen. QPRINT gehört allen.

    Margit

## Dateien

inquiry-email-kwame =
    Von:  Kwame
    An:   dich

    Guten Morgen, und willkommen in der Mühle! Es ist 07:40, die
    Fahrer·innen warten, und heute Morgen gibt es keine
    Kommissionierlisten.

    Unsere Bestellungen leben seit 1996 auf der IBM i im Büro (damals eine
    AS/400). Margit hat alles eingerichtet; sie ist in Rente und kommt nur
    donnerstags, aber sie hat ihre Notizen in deinem Home-Verzeichnis
    hinterlassen: notizen-margit.txt.

    Könntest du herausfinden, warum die Arbeit der Nacht angehalten hat,
    und sie wieder in Gang bringen, ohne die Web-Bestellungen von letzter
    Nacht zu verlieren? Die Listen drucken sich von selbst, sobald die
    Nacht-Jobs gelaufen sind.

    Das Büro hat um sieben aufgemacht: Die Telefonbestellungen werden wie
    immer am grünen Bildschirm aufgenommen, also bitte niemanden
    rauswerfen.

    Dein Profil ist DU, Passwort muehlstein-2029: tn5250 muehle von deinem
    Rechner für den grünen Bildschirm, oder ssh muehle für die Unix-Seite.

    Kwame

## Ereignisse

inquiry-event-linux-habit =
    Hier gibt es kein systemd: Das ist PASE, die Unix-Seite einer IBM i.
    Jobs, Nachrichten und Drucker gehören zur IBM i selbst und werden mit
    CL-Befehlen erreicht: auf dem grünen Bildschirm (tn5250 muehle) oder
    von hier aus mit system "WRKACTJOB". Margits Notizen geben die ersten
    Schritte vor.
inquiry-event-msgw =
    ORDIMPORT, der nächtliche Import, ist in MSGW: Er wartet auf eine
    Antwort auf eine Nachricht. Ein Batch-Job, der eine Frage stellt, hält
    an, bis jemand antwortet, und um 02:14 war niemand da. Die Frage steht
    in der Nachrichtenwarteschlange des Operators, QSYSOPR.
inquiry-event-queue =
    Hinter ORDIMPORT wartet die Jobwarteschlange QBATCH: die
    Kommissionierlisten (ORDPICK), der Export für die Buchhaltung, die
    Rechnungen. QBATCH führt einen Batch-Job nach dem anderen aus: Ein
    hängender Job hält die ganze Nacht auf.
inquiry-event-inquiry =
    Die Frage: RNQ1218, „Unable to allocate a record in file ORDHDR (R C G
    D F)“. Die Buchstaben in Klammern sind die gültigen Antworten. Lies vor
    der Wahl die Hilfe der Nachricht (? bei der Antwortaufforderung, F1 auf
    einem echten Bildschirm): was jede Antwort tut und warum der Satz nicht
    zu haben war.
inquiry-event-cause =
    Da ist es: Satz 28 von ORDHDR, Bestellung 1847, wird vom Job
    412655/SORAYA/QPADEV0004 gehalten, Sorayas grünem Bildschirm, gestern
    Abend auf dieser Bestellung offen gelassen. Solange ihre Sitzung ihn
    hält, kann der Import die Bestellung nicht ändern. Kwame ruft sie an:
    Das Telefon hat geklingelt, sie ist in Eile gegangen und hat nichts
    geändert. Ihre Sitzung kann beendet werden.
inquiry-event-retry-locked =
    R hat es erneut versucht, aber der Satz ist immer noch gesperrt: Der
    Job hat wieder gewartet, und dieselbe Frage ist zurückgekommen. Ein
    erneuter Versuch hilft erst, wenn die Ursache weg ist: Gib zuerst den
    Satz frei.
inquiry-event-killed =
    Der Import wurde mitten in seiner Arbeit beendet: Die Bestellungen nach
    1847 wurden nicht importiert, und die Warteschlange ist ohne sie
    weitergegangen. Margits Notizen sagen, wie man ihn erneut übergibt (er
    überspringt, was schon da ist), sobald der Satz frei ist.
inquiry-event-cancelled =
    Der Import wurde abgebrochen: Der Job endete abnormal, mit nur einem
    Teil der Bestellungen der Nacht. Margits Notizen sagen, wie man ihn
    erneut übergibt (er überspringt, was schon da ist), sobald der Satz
    frei ist.
inquiry-event-skipped =
    G hat den Satz übersprungen: Der Import ging weiter, aber die Änderung
    an Bestellung 1847 wurde stillschweigend ausgelassen. Die Bäckerei
    bekommt die alte Menge. Gib den Satz frei und übergib den Import dann
    erneut: Er wendet an, was er übersprungen hat.
inquiry-event-wrong-session =
    Du hast Diegos Sitzung beendet: Er hat gerade die Bestellung einer
    Bäckerei am Telefon eingetippt, und sie ist verloren. Seine Sitzung
    hatte ORDHDR offen, wie jeder Bestellbildschirm, aber keinen Satz:
    Die Satzsperre (DSPRCDLCK oder das Jobprotokoll des Imports) nennt
    den Job, der Bestellung 1847 hält. „Letzte Eingabe rückgängig machen“
    (Wiederherstellungspunkt) bringt dich vor diesen Befehl zurück.
inquiry-event-web-ended =
    ORDWEB wurde beendet: Die Web-Bestellungen der Bäckereien kommen nicht
    mehr an. Er gehört zum Subsystem ORDSBS: Starte es wieder (ENDSBS, dann
    STRSBS ORDERS/ORDSBS, man STRSBS).
inquiry-event-released =
    Sorayas Sitzung ist weg, und ihre Sperre mit ihr: Satz 28 ist frei.
    Jetzt kann die Frage beantwortet werden.
inquiry-event-end =
    Kwame: „Die Listen kommen aus dem Drucker! Und Soraya meldet sich vor
    dem Gehen ab, versprochen.“

    Gut gemacht! Du hast das Kapitel „Warten auf Antwort“ abgeschlossen.

    WAS PASSIERT IST
    Um 02:14 brauchte der Import (ORDIMPORT) Bestellung 1847, die Sorayas
    Sitzung seit dem Abend gesperrt hielt. Er hat gewartet, dann dem
    Operator eine Frage gestellt, die Abfrage RNQ1218, und ist in MSGW
    gegangen. Nachts antwortet niemand auf QSYSOPR: Der Job hat gewartet,
    und die Jobwarteschlange QBATCH hinter ihm auch. Du hast den Job
    gefunden (WRKACTJOB), die Frage (DSPMSG QSYSOPR), ihre Hilfe und das
    Jobprotokoll (CPF5027: der Job, der den Satz hält), den Satz durch
    Beenden der vergessenen Sitzung freigegeben und dann R geantwortet:
    Der Import ging weiter, endete normal, und die Nacht-Jobs sind
    gelaufen.

    GUTE PRAXIS
    - Eine Abfrage ist eine Entscheidung: Lies ihren Text der zweiten Ebene
      (F1) und das Jobprotokoll, bevor du antwortest. R hilft erst, wenn
      die Ursache weg ist; C oder ENDJOB verlieren den Lauf; G überspringt
      stillschweigend Daten.
    - Finden, wer eine Sperre hält: DSPRCDLCK, WRKOBJLCK, die Nachricht
      CPF5027.
    - Jemand muss nachts QSYSOPR im Auge behalten, oder die Antworten
      müssen im Voraus bekannt sein: Die Systemantwortliste (WRKRPYLE)
      beantwortet ausgewählte Nachrichten von selbst, und ein
      Nachrichtenmonitor kann jemanden alarmieren.
    - Sich am Ende des Tages abmelden (oder QINACTITV untätige Sitzungen
      beenden lassen).

    DOKUMENTATION
    - Abfragenachrichten: https://www.ibm.com/docs/en/i/7.5?topic=types-inquiry-messages
    - DSPMSG: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dspmsg.html
    - DSPRCDLCK: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dsprcdlck.html
    - Die Systemantwortliste: https://www.ibm.com/docs/en/i/7.5?topic=messages-using-system-reply-list

## Shared by the story: a CL command (or tn5250) typed in PASE
order-book-event-cl-in-pase =
    Du bist in PASE, der Unix-Seite der IBM i: CL-Befehle sind nicht seine
    Programme. Von hier aus führt system einen aus (system "WRKACTJOB").
    Für den grünen Bildschirm, auf dem du auch eine Nachricht beantworten
    kannst, geh zurück zu deinem Rechner (exit) und dann tn5250 muehle.
