### Geschichte „Windows nebenan“, Kapitel „Unsichtbare Zeichen“: ein unter
### Windows geschriebenes Skript (Zeilenenden CR LF), das bash nicht
### ausführen kann, wie man es sieht, umwandelt und verhindert, dass git es
### zurückbringt. Befehle, Dateiinhalte und Ausgaben der Werkzeuge werden
### nicht übersetzt.

chapter-line-endings = Unsichtbare Zeichen
    .summary = Ein auf einem Windows-Laptop geschriebenes Backup-Skript startet unter Linux nicht einmal: das unsichtbare Zeichen am Ende jeder Zeile finden, die Datei umwandeln und git dazu bringen, es richtig zu halten.

## Von der Geschichte gemeinsam genutzt

mixed-fleet-ops-readme =
    ops - die Skripte des Zeichenbüros (kompass)

    nightly-copy.sh    nächtliche Kopie von /srv/projects/current nach /srv/nightly
                 (cron, 01:30, als du)

    Schreibt sie, wo ihr wollt, pusht sie hierher, führt sie auf kompass aus.
    Henrik

mixed-fleet-project-notes =
    Laufende Projekte - Zeichenbüro
    harbour-library: Fassade, Revision C, fällig am 30. November
    school-canteen: Küchenplan, Abnahme mit dem Kunden am Freitag

mixed-fleet-plotter-conf =
    # Plotter - exportiert die Zeichnungen jeden Morgen um 06:00 als PDF
    {"["}export]
    source = /srv/projects/current
    target = /mnt/plans/exports
    user = plotter

mixed-fleet-templates-readme =
    Schriftfelder und Vorlagen des Zeichenbüros. Vor Änderungen Ifeoma fragen.

mixed-fleet-handover =
    schrank - Übergabenotizen (Priya, Dienstleisterin), 28. Oktober 2029

    Windows Server 2022 Standard, Dateiserver des Zeichenbüros.
    C: System (100 GB), D: Data (500 GB): Die Freigaben liegen in D:\Shares.

    Freigaben: plans (D:\Shares\plans): Projekte, PDF-Exporte, Vorlagen.
               scans (D:\Shares\scans): Der Kopierer legt dort seine Scans ab.
    kompass erreicht plans mit dem lokalen Konto compass-svc.

    OpenSSH Server ist aktiv (in Windows eingebaut): ssh landet in
    PowerShell. Dein Schlüssel liegt in
    C:\ProgramData\ssh\administrators_authorized_keys (für Admins liest
    Windows diese Datei, nicht die deines Profils).

    SMB1 ist aus und bleibt aus. Windows Update startet den Server
    dienstagnachts neu, zwischen 03:00 und 03:30.

    Ich kümmere mich am ersten Montag des Monats um diesen Server; für
    alles andere schreib mir, was du gesehen hast, ich übernehme dann.
    Priya

## Dateien

line-endings-email-ifeoma =
    Von:  Ifeoma
    An:   dich

    Hallo, und willkommen im Zeichenbüro!

    Unsere Server sind ein bisschen gemischt. kompass, wo du gerade bist,
    ist unser Linux-Server: Er hält die Backups der Projekte und betreibt
    Plotter, den Dienst, der unsere Zeichnungen als PDF exportiert.
    Daneben ist schrank der Windows-Server, auf dem alle ihre Pläne
    speichern; Priya, unsere Dienstleisterin, hat ihn installiert und
    kümmert sich darum.

    Als Erstes: Henrik hat auf seinem Laptop (Windows) ein Skript für das
    nächtliche Backup der laufenden Projekte geschrieben und es in ~/ops
    gelegt, das git-Repository unserer Skripte. Es ist nie gelaufen: Letzte
    Nacht blieb /srv/nightly leer, und wenn ich es selbst probiere, sagt
    es etwas von einem „bad interpreter“. Die Datei sieht für mich völlig
    normal aus.

    Könntest du herausfinden, was nicht stimmt, ein Backup hinbekommen und
    dafür sorgen, dass das nächste Skript von einer Windows-Maschine das
    nicht wieder macht?

    Danke!
    Ifeoma

## Ereignisse

line-endings-event-bad-interpreter =
    „/bin/bash^M: bad interpreter“: Der Kernel hat die Zeile #! gelesen
    und ein Programm namens /bin/bash gefolgt von einem unsichtbaren
    Zeichen gesucht, angezeigt als ^M. Dieses Zeichen ist ein
    Wagenrücklauf (CR, \r, Byte 0x0D): Windows beendet jede Zeile mit CR
    LF (\r\n), Linux mit LF (\n) allein. Sieh dir die Bytes der Datei an
    statt ihres Texts: file, cat -A, od -c.
line-endings-event-carriage-return =
    „$'\r': command not found“: bash schreibt den Wagenrücklauf in
    $'…'-Quoting, seine Art, Zeichen zu zeigen, die man nicht sieht. Für
    bash ist die leere Zeile 5 ein Befehl namens \r, und SRC enthält
    „/srv/projects\r“: Dieses Verzeichnis gibt es nicht. Jede Zeile trägt
    an ihrem Ende ein \r.
line-endings-event-chmod =
    Das Skript war schon ausführbar (rwx in ls -l): Die Rechte waren nie
    das Problem. Der Interpreter in der ersten Zeile schon.
line-endings-event-crlf =
    Da ist es: Jede Zeile endet mit \r\n (^M$ bei cat -A, \r \n bei od -c,
    „with CRLF line terminators“ bei file). Ein Editor unter Windows
    schreibt das; bash kennt nur \n. Wandle die Datei in Unix-Zeilenenden
    um (man dos2unix; sed und tr können das auch).
line-endings-event-converted =
    nightly-copy.sh ist jetzt im Unix-Format: kein \r mehr, die Befehle
    unverändert. Führe es aus.
line-endings-event-ran =
    /srv/nightly/current ist da: Das Backup ist gelaufen. Damit Henriks
    nächster Push die \r nicht zurückbringt: Sag git, dass diese Dateien
    Text mit LF-Zeilenenden sind (man gitattributes), und committe das mit
    dem umgewandelten Skript.
line-endings-event-committed =
    Das Repository sagt jetzt, dass *.sh Text mit LF-Zeilenenden sind, und
    sein Skript ist in LF: Welchen Editor Henrik auch benutzt, git
    speichert LF und checkt LF aus.
line-endings-event-end =
    Ifeoma: „Es ist gelaufen! Und Henrik sagt, er macht nächstes Mal ein
    pull, bevor er etwas ändert. Danke.“

    Gut gemacht! Du hast das Kapitel „Unsichtbare Zeichen“ abgeschlossen.

    WAS PASSIERT IST
    Henriks Editor unter Windows hat das Skript mit CR-LF-Zeilenenden
    gespeichert. Unter Linux wurde der Wagenrücklauf (\r, ^M) Teil des
    letzten Worts jeder Zeile: Die Zeile #! verlangte „/bin/bash\r“ (bad
    interpreter), das von Hand gestartete bash hielt eine leere Zeile für
    einen Befehl namens $'\r', und die Variablen behielten ein \r am Ende
    ihrer Werte. Du hast es mit file, cat -A oder od -c gesehen, die Datei
    umgewandelt, sie ausgeführt und eine .gitattributes hinzugefügt,
    damit git die Skripte des Repositorys in LF hält.

    GUTE PRAXIS
    - Wenn ein Skript „gut aussieht“, aber seltsam scheitert, sieh dir
      seine Bytes an: file, cat -A (^M$ am Ende jeder Zeile), od -c
      (\r \n).
    - dos2unix (oder sed -i 's/\r$//', oder tr -d '\r' in einer Pipe) zum
      Umwandeln; unix2dos für die andere Richtung.
    - Im Repository eine .gitattributes mit „*.sh text eol=lf“ (oder
      „* text=auto eol=lf“): git speichert LF und schreibt beim Auschecken
      LF, egal auf welcher Maschine. Committe sie zuerst, dann die
      Dateien.
    - Unter Windows können Editoren in LF speichern (VS Code, Notepad++),
      und die git-Einstellung core.autocrlf wandelt beim Auschecken um;
      die .gitattributes gewinnt und reist mit dem Repository.

    EIN ANDERER WEG
    WSL (das Windows-Subsystem für Linux) lässt ein echtes Linux auf dem
    Laptop laufen: Ein dort geschriebenes und getestetes Skript hat
    LF-Zeilenenden und trifft auf bash, bevor es auf kompass trifft.

    DOKUMENTATION
    - dos2unix(1): https://waterlan.home.xs4all.nl/dos2unix/dos2unix.htm
    - gitattributes, die Attribute eol und text: https://git-scm.com/docs/gitattributes
    - bash, ANSI-C-Quoting ($'…'): https://www.gnu.org/software/bash/manual/bash.html#ANSI_002dC-Quoting
