### Geschichte „Das Archiv“, einziges Kapitel (src/engine/chapters/archives.ts):
### den Bestand einer Stadtteilbibliothek auf einen kleinen USB-Stick retten,
### mit du, df, find und tar. Namen der Orte und Dateien aus names.ftl.

chapter-archives = Das Archiv
    .summary = Einen Bestand messen, aussortieren und packen, um ihn auf einen Stick zu retten: du, df, find, tar.

## Dateien

archives-letter-rosa =
    Ein Brief von Rosa, Bibliothekarin der Stadtteilbibliothek:

    „Der Server der Bibliothek wird heute Nacht um Mitternacht abgeschaltet,
    für immer: Das Rathaus will ihn nicht mehr bezahlen. Unser ganzer Bestand
    liegt darauf: die von Leuten aus dem Viertel gespendeten Manuskripte, die
    alten Karten, die Zeitung, die Aufnahmen vom Markt.

    Ich habe nur einen alten USB-Stick mit 64 MB, eingesteckt unter
    /media/stick. Kannst du den Bestand darauf bringen, in EINEM EINZIGEN
    komprimierten Archiv? Ein Archiv lässt sich leichter herumtragen, und die
    Kompression spart Platz.

    Vorsicht, kopieren reicht nicht: Alles muss hineinpassen. Erst messen.
    Meine Notizen stehen in cat notes_rosa.txt“
archives-notes-rosa =
    ROSAS NOTIZEN

    Wie viel Platz?
      du -sh bestand        die Gesamtgröße des Verzeichnisses bestand
      du -h bestand         die Größe jedes Unterverzeichnisses
      df -h /media/stick    der freie Platz auf dem Stick

    Dateien finden, überall in einem Verzeichnis und seinen Unterverzeichnissen:
      find bestand -name "*.pdf"      alle PDFs
      find bestand -name "*.tmp"      alle temporären Dateien
    Die .tmp-Dateien sind Reste unserer Scan-Software: Die können wir ohne
    Bedauern wegwerfen. Um alles zu löschen, was find findet, hängt man
    -delete ans Ende (den Befehl vor der Eingabetaste noch einmal lesen!).

    Ein komprimiertes Archiv erstellen (tar = tape archive, z = gzip):
      tar -czf /media/stick/bestand.tar.gz bestand
    Prüfen, was es enthält:
      tar -tzf /media/stick/bestand.tar.gz
archives-readme = Bestand der Stadtteilbibliothek. Spenden der Leute aus dem Viertel, 1890-2026.
archives-journal-marie = Tagebuch von Marie, Schneiderin, 1931-1940 (Abschrift).
archives-letters-1914 = Briefe von Ahmed an seine Schwester, 1914-1918 (Abschrift).
archives-recipes-neighbourhood = Rezepte, gesammelt auf dem Markt, 1975-2020.
# Inhalt, den cat bei Dateien zeigt, die kein Text sind
archives-image-png = (PNG-Bild)
archives-document-pdf = (PDF-Dokument)
archives-its-ogg = (Ogg-Vorbis-Audio)
archives-file-temporary = (temporäre Datei)

## Ereignisse

archives-event-measure =
    Der Bestand wiegt weit mehr als die 64 MB des Sticks. Aber schau, wohin
    der Platz geht: ein paar große Dateien… Rosa hat temporäre Dateien erwähnt.
    find bestand -name "*.tmp"
archives-event-full =
    „Auf dem Gerät ist kein Speicherplatz mehr verfügbar“: Das Archiv passt
    nicht auf den Stick. Du musst VORHER Platz schaffen: Was im Bestand ist
    nicht wertvoll? (du -h bestand, dann find bestand -name "*.tmp")
archives-event-tmp =
    Überall temporäre Dateien: in jedem Ordner, tiefer unten bei den Scans,
    sogar in versteckten Ordnern (ihr Name beginnt mit einem Punkt: ls zeigt
    sie ohne -a nicht). Zusammen etwa 128 MB! Rosa sagt, wir dürfen sie
    wegwerfen. find sucht auf allen Ebenen und kann sie in einem Rutsch
    löschen, mit -delete am Ende:

      find bestand -name "*.tmp" -delete

    (Lies es vor der Eingabetaste noch einmal: Ohne das -name würde find den GANZEN Bestand löschen.)
archives-event-loss =
    Autsch: Eine wertvolle Datei des Bestands ist verschwunden, und
    find -delete geht, wie rm, über keinen Papierkorb… Im echten Leben macht man deshalb Backups, BEVOR man
    aufräumt. Hier kannst du das Kapitel neu starten (Link unter dem Terminal).
archives-event-leftovers =
    Das Archiv passt auf den Stick… aber es trägt noch temporäre Dateien mit
    (tar -tzf zeigt sie). Manche versteckten sich tiefer, oder in versteckten
    Ordnern: ls zeigt nur eine Ebene, und keine Namen, die mit einem Punkt
    beginnen. find sucht überall:  find bestand -name "*.tmp"
    Wirf sie weg und erstelle das Archiv neu.
archives-event-cleanup =
    Aufgeräumt. Prüfe mit du -sh bestand, dann erstelle das komprimierte
    Archiv direkt auf dem Stick:

      tar -czf /media/stick/bestand.tar.gz bestand
# { $size }: Größe des Archivs in MB (Zahl mit einer Nachkommastelle)
archives-event-saved =
    Das Archiv ist auf dem Stick: { NUMBER($size, minimumFractionDigits: 1, maximumFractionDigits: 1) } MB, mit dem ganzen Bestand. Die Texte ließen
    sich stark komprimieren; die Bilder, Töne und PDFs, schon komprimiert,
    kaum. Um seinen Inhalt zu prüfen, ohne es zu entpacken:
    tar -tzf /media/stick/bestand.tar.gz

    Rosa zieht den Stick um 23:58 Uhr ab. „Alles da. Danke!“

    (Ein zweites Kapitel wartet auf dich: Die Versionen.)

    Du kannst jetzt messen (du, df), suchen und aussortieren (find, -delete)
    und packen (tar). Und eine goldene Regel der Archivarinnen und Archivare:
    Eine einzige Kopie ist kein Backup. Rosa macht morgen früh als Erstes eine zweite.
