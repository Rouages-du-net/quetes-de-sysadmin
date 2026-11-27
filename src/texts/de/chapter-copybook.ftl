### Geschichte „Der Nachtlauf“, Kapitel „Feste Breite“: die EBCDIC-Datei des
### Rechenzentrums, ihre Sätze fester Breite, beschrieben durch ein
### Copybook, und warum ihre gepackten Beträge keine Textumwandlung
### überstehen. Befehle, Pfade, Satzaufbauten und Programmausgaben werden
### nicht übersetzt.

chapter-copybook = Feste Breite
    .summary = Die nächtliche Datei des Mainframes ist auf Linux gelandet und sieht aus wie Kauderwelsch: ihre Bytes, ihre Sätze und ihr Copybook lesen und sie umwandeln, ohne die Beträge zu beschädigen.

## Von der Geschichte gemeinsam genutzt

night-batch-notes-ramon =
    Ramóns Notizen - der Nachtlauf (Job NIGHTLY), für die Person, die nach mir kommt

    DIE DATEI. Jede Nacht schickt das Rechenzentrum die Beiträge des Tages:
    /srv/drop/contrib.ebc. Sie kommt so vom Mainframe, wie sie ist: EBCDIC
    (Codepage 037), feste Sätze zu 40 Bytes hintereinander, kein
    Zeilenumbruch (RECFM=FB, LRECL=40). Der Aufbau steht in
    copybooks/CONTRIB.cpy: ein Kopfsatz (H), ein Satz pro Beitrag (D) und
    ein Schlusssatz (T), der die Anzahl der Beiträge und ihre Summe angibt.
    Jedes Mal prüfen.

    DIE BETRÄGE sind gepackte Dezimalzahlen (COMP-3): zwei Ziffern pro
    Byte, das Vorzeichen im letzten Halbbyte. 42.50 wird als 00 00 04 25 0C
    geschrieben.

    DIE UMWANDLUNG. ebc2asc (in bin/, sein Quelltext in src/) wandelt Feld
    für Feld um, nach dem Copybook. Es schreibt die ASCII-Datei, die der
    Batch liest (copybooks/CONTRIBA.cpy, ein Satz pro Zeile):
        bin/ebc2asc EBCDIC-DATEI ASCII-DATEI

    DER BATCH. src/contrib.cob liest die umgewandelte Datei und schreibt
    den Einzugsbericht, den die Buchhaltung an die Bank schickt. Er wird mit
    cobc (GnuCOBOL) kompiliert. In dreißig Jahren ist er kein einziges Mal
    gescheitert. Was jedes Mal scheiterte, war das Drumherum: eine Datei,
    die nicht kam, zweimal kam oder abgeschnitten kam.

    Ramón

## Dateien

copybook-email-ayesha =
    Von:  Ayesha
    An:   dich

    Hallo, und danke, dass du hilfst! Seit dreißig Jahren werden die
    Beiträge unserer Mitglieder von einem COBOL-Programm eingezogen, das
    jede Nacht auf dem Mainframe eines Rechenzentrums läuft. Das
    Rechenzentrum schließt seinen Rechnerraum Ende des Monats, also zieht
    der Batch hierher um, auf abakus.

    Ramón hat diese Programme 1994 geschrieben und geht am Freitag in
    Rente. Er hat alles in /opt/batch hinterlassen: seine Notizen
    (NOTES.txt), die Copybooks (die Beschreibung der Sätze) und die
    Quelltexte. Das Rechenzentrum schickt uns weiterhin jede Nacht die
    Beiträge des Tages, nach /srv/drop; die Datei von letzter Nacht liegt
    dort, contrib.ebc.

    Ich habe versucht, sie zu öffnen: Kauderwelsch. In einem Forum heißt
    es „iconv -f EBCDIC-US -t ASCII“, aber das bricht mit einem Fehler ab.
    Ramón hat einen eigenen Konverter, aber bevor wir ihm vertrauen, möchte
    ich, dass wir verstehen, was in dieser Datei steckt.

    Könntest du die umgewandelte Datei dorthin legen, wo der Batch sie
    lesen wird, /srv/batch/in/contrib.dat, und pruefung.txt ausfüllen? Wir
    vergleichen heute Abend.

    Ayesha

copybook-check =
    Die Datei des Rechenzentrums vom 21. November - Prüfungen vor der ersten Nacht unter Linux

    Größe der Datei, in Bytes:
    Anzahl der Sätze (einer alle 40 Bytes):
    Beiträge (Detailsätze):
    Kontrollsumme (im Schlusssatz):
    Betrag des ersten Beitrags, seine 5 Bytes in der Datei (hex):

## Ereignisse

copybook-event-garbage =
    Überall � und @: Das ist kein Text, den dein Terminal lesen kann. Seine
    Buchstaben sind EBCDIC, der Zeichensatz des Mainframes: Ein großes A ist
    das Byte 0xC1, das kein gültiges UTF-8 ist (�), und das Leerzeichen ist
    0x40, ein @ in ASCII. Und es gibt keinen Zeilenumbruch: Die Sätze folgen
    einander. Schau dir seine Bytes an (od -c, xxd, hexdump -C) und seine
    Größe (wc -c).
copybook-event-data =
    file sagt „data“: kein Zeichensatz, den es kennt. libmagic erkennt
    EBCDIC nicht; das Copybook und Ramóns Notizen sagen, was das ist.
copybook-event-records =
    560 Bytes: 14 Sätze zu 40 Bytes (LRECL=40), ein Kopfsatz, zwölf
    Beiträge und ein Schlusssatz. Eine Größe, die kein Vielfaches der
    Satzlänge ist, würde eine abgeschnittene Datei bedeuten.
copybook-event-bytes =
    Die Bytes, wie sie sind. C8 ist ein H in EBCDIC, F0 bis F9 sind die
    Ziffern, 40 ist das Leerzeichen. Aber in jedem Satz sind die Bytes 34
    bis 38 (CR-AMOUNT im Copybook) überhaupt keine Zeichen: 00 00 04 25 0C
    ist 42.50, gepackt (COMP-3), zwei Ziffern pro Byte und das Vorzeichen
    am Ende (C: positiv).
copybook-event-illegal =
    iconv hält bei Position 75 an: dem 36. Byte des zweiten Satzes, mitten
    in seinem Betrag (Bytes 34 bis 38). Dieses Byte, 0x04, ist kein
    Zeichen: Es ist die Hälfte einer gepackten Zahl. Ein Zeichensatz kann
    aus etwas, das kein Text ist, keinen Text machen.
copybook-event-text-converted =
    Es ist durchgegangen, aber sieh dir die Beträge an: Eine Textumwandlung
    behandelt jedes Byte als Zeichen. Von IBM037 nach UTF-8 wurde das Byte
    0x25 (die Ziffern 2 und 5 von 42.50) zu einem Zeilenumbruch, und die
    Sätze haben nicht mehr 40 Bytes; mit dd conv=ascii bleibt die Länge,
    aber 0x04 wurde zu 0x9C: Der Betrag ist verloren. Nur die Textfelder
    dürfen durch eine Tabelle gehen; die Beträge müssen entpackt werden.
    Ramóns Notizen sagen, wie.
copybook-event-wrong-dat =
    /srv/batch/in/contrib.dat ist nicht, was der Batch erwartet: 14 Zeilen
    zu 43 Zeichen, jeder Betrag mit Vorzeichen entpackt (+000004250). Wenn
    sie aus iconv oder dd kommt, wurden die Beträge unterwegs beschädigt.
    Ramóns Notizen sagen, welches Werkzeug Feld für Feld umwandelt.
copybook-event-converted =
    contrib.dat stimmt: 14 Zeilen, der Text in ASCII, jeder Betrag mit
    Vorzeichen entpackt (+000004250 ist 42.50). Die letzte Zeile ist der
    Schlusssatz: die Anzahl der Beiträge und ihre Kontrollsumme.
copybook-event-end =
    Ayesha: „Das war also da drin! Ich vergleiche deine Zahlen heute Abend
    mit denen des Rechenzentrums. Und ich nehme nie wieder iconv dafür.“

    Gut gemacht! Du hast das Kapitel „Feste Breite“ abgeschlossen.

    WAS PASSIERT IST
    Die Datei des Rechenzentrums ist die Datei des Mainframes, wie sie ist:
    EBCDIC, feste Sätze zu 40 Bytes ohne Zeilenumbruch, und Beträge als
    gepackte Dezimalzahlen. Du hast sie mit Werkzeugen gelesen, die Bytes
    statt Text zeigen (wc -c, od, xxd, hexdump), ihren Aufbau im Copybook
    gefunden und gesehen, warum eine Textumwandlung der ganzen Datei die
    Beträge beschädigt: iconv hält bei ihnen an oder macht aus einem ihrer
    Bytes einen Zeilenumbruch; dd conv=ascii verändert sie stillschweigend.
    Ramóns ebc2asc wandelt Feld für Feld um: den Text über die
    EBCDIC-Tabelle, die Beträge entpackt.

    GUTE PRAXIS
    - Sich die Bytes ansehen, bevor man dem Namen traut: file, wc -c, od
      -c, xxd.
    - Eine Satzdatei liest man mit ihrer Beschreibung (dem Copybook):
      Satzlänge, Typ jedes Felds. Die Größe muss ein Vielfaches der
      Satzlänge sein.
    - Binäre Felder (COMP-3, COMP) nie durch eine Textumwandlung schicken:
      Feld für Feld umwandeln oder vom Absender eine reine Textdatei
      verlangen (Beträge in DISPLAY, Vorzeichen getrennt).
    - Mit dem Schlusssatz prüfen: Die Anzahl der Sätze und die
      Kontrollsumme sind genau dafür da.

    EIN ANDERER WEG
    Wenn die Datei nur aus Text besteht (kein COMP-3), wandelt dd
    conv=ascii cbs=80 feste Sätze um und fügt nach jedem einen
    Zeilenumbruch ein; iconv -f IBM037 tut dasselbe Zeichen für Zeichen.
    Manche Übertragungswerkzeuge (FTP im ASCII-Modus vom Mainframe)
    wandeln unterwegs um, was für gepackte Felder genauso gefährlich ist:
    binär übertragen, bei der Ankunft umwandeln.

    DOKUMENTATION
    - iconv(1): https://man7.org/linux/man-pages/man1/iconv.1.html
    - dd, conv=ascii: https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html
    - od: https://www.gnu.org/software/coreutils/manual/html_node/od-invocation.html
    - GnuCOBOL, USAGE COMP-3: https://gnucobol.sourceforge.io/doc/gnucobol.html
