### Geschichte „Das Archiv“, Kapitel 2 „Die Versionen“: restic.
### Befehle, Pfade, Snapshot-IDs und die Meldungen von restic (auf Englisch)
### werden nicht übersetzt.

chapter-versions = Die Versionen
    .summary = Ein Backup, das den Fehler aufbewahrt: mit restic die richtige Version finden, dann Platz schaffen, ohne sie zu verlieren.

## Dateien

versions-word-rosa =
    Eine Notiz von Rosa, der Bibliothekarin:

    „Seit Januar lebt der Bestand auf diesem neuen Server, und ich sichere
    ihn jede Nacht mit restic auf die Platte, die uns das Rathaus leiht
    (/mnt/rathaus). Die Backups sind verschlüsselt: Die Leute im Rathaus
    können unsere Archive nicht lesen. Das Passwort steht in
    ~/.config/restic/passwort (und auf Papier, im Tresor).

    Katastrophe: Heute Morgen ist die Abschrift von Maries Tagebuch voller
    absurder Fehler. Der Praktikant hat vor ein paar Nächten ein Skript zur
    „automatischen Korrektur“ laufen lassen. Und das Backup jeder Nacht hat
    die beschädigte Version treu gesichert…

    Zwei weitere Sorgen: Das Rathaus sagt, unsere Platte sei fast voll
    (df -h /mnt/rathaus), und ich bin nicht mehr sicher, ob unser Repository
    in gutem Zustand ist.

    Könntest du:
    1. die richtige Version des Tagebuchs finden und an ihren Platz zurücklegen;
    2. Platz auf der Platte schaffen, ohne die richtige Version wegzuwerfen;
    3. prüfen, ob das Repository gesund ist?

    Meine üblichen Befehle stehen in notes_restic.txt.“
versions-notes-restic =
    ROSAS NOTIZEN — RESTIC

    Jeder Befehl braucht das Repository und das Passwort:
      restic -r /mnt/rathaus/restic-bibliothek --password-file ~/.config/restic/passwort BEFEHL

    Die Befehle, die ich schon benutzt habe:
      snapshots      die Liste der Backups (Snapshots)
      ls ID          was ein Snapshot enthält

    Die anderen (dump, find, diff, restore, forget, prune, check…) stehen in
    man restic. ID: Die ersten 8 Zeichen reichen, oder latest.
versions-journal =
    TAGEBUCH VON MARIE, SCHNEIDERIN (1931-1940) — ABSCHRIFT

    12. März 1931. Der Markt ist letzte Nacht abgebrannt. Die Marktfrauen
    haben gerettet, was sie konnten; Fatou hat alle ihre Stoffe verloren.
    Wir haben bis zum Morgen genäht, damit sie am Samstag etwas zu
    verkaufen hat.

    3. Juni 1936. Streik in der Werkstatt. Wir haben im Hof gesungen. Der
    Chef hat nachgegeben: zwei Wochen bezahlter Urlaub, zum ersten Mal in
    meinem Leben.

    9. September 1939. Ahmed ist heute Morgen fortgegangen. Ich habe seinen
    Namen ins Futter seiner Jacke gestickt, damit er ihn dort drüben nicht
    vergisst.
versions-journal-damaged =
    TAGEBUCH VON MARIE, SCHNEIDERIN (1931-1940) — ABSCHRIFT

    12. März 1931. Der Markt ist lezte Nacht abgebrant. Die Markfrauen
    haben gerettet, was sie konten; Fatou hat alle ihre Stofe verlohren.
    Wir haben bis zum Morgen genet, damit sie am Samstag etwas zu
    verkaufen hätte.

    3. Juni 1936. Streick in der Werk statt. Wir haben im Hof gesingt. Der
    Schef hat nach gegeben: zwei Woche bezahlter Urlaub, zum ersten mahl in
    meinem Leeben.

    9. September 1939. Ahmed ist heute Morgen fortgegeht. Ich habe seinen
    Namen ins Futer seiner Jake gestickt, damit er ihn dort drüben nicht
    vergist.
versions-recipe-added = Hinzugefügt im Januar 2027: Fatous Mafé, diktiert von ihrer Enkelin.
versions-image-tiff = (TIFF-Bild, Roh-Scan)

## Ereignisse

# { $file }: die Passwortdatei
versions-event-password =
    Das Repository ist verschlüsselt… aber sein Passwort steht in { $file },
    lesbar für jedes Konto auf der Maschine (ls -l). Rosa hat hier ein Konto,
    und morgen vielleicht ein weiterer Praktikant. Wer sollte es lesen können?
versions-event-bad-password =
    Falsches Passwort: Ohne es kann restic nichts entschlüsseln, nicht einmal
    die Liste der Backups. Das ist Absicht. Dieses Passwort verlieren heißt
    alle Backups verlieren: Bewahre immer eine Kopie davon woanders auf
    (Rosa hat ihre im Tresor).
versions-event-elsewhere =
    Die richtige Version des Tagebuchs ist zurück… aber nicht an ihrem Platz:
    restic legt den vollständigen Pfad unter dem bei --target angegebenen
    Verzeichnis neu an. Du musst sie noch nach ~/bestand/manuskripte/
    zurücklegen.
versions-event-restored =
    Maries Tagebuch ist zurück, Wort für Wort. Genau dafür hat man
    Versionen: Eine Spiegelkopie (rsync --delete) hätte den Fehler schon in
    der ersten Nacht mitkopiert.

    Denk auch an das Backup heute Nacht: Solange kein neuer Snapshot die
    richtige Version enthält, hängt ihr Erhalt an den alten.
versions-event-lost =
    Kein Snapshot enthält die richtige Version des Tagebuchs mehr: Die
    forget-Regel hat sie alle entfernt. Auf einem echten Server wäre sie
    verloren (außer es gibt woanders noch eine Kopie). Hier kannst du das
    Kapitel über das Menü neu starten. Vor dem Löschen zeigt
    forget --dry-run, was wegfallen würde.
versions-event-forgotten-without-prune =
    forget hat Snapshots aus der Liste entfernt… aber df -h /mnt/rathaus
    rührt sich nicht: forget löscht nur die „Etiketten“. Die Daten
    verschwinden erst mit prune (oder forget --prune).
versions-event-place =
    Die Platte kann atmen: prune hat die Daten gelöscht, die kein
    verbleibender Snapshot mehr nutzt (vor allem die Roh-Scans vom Januar).
    df -h /mnt/rathaus zeigt es.
versions-event-end =
    Rosa liest Maries Tagebuch noch einmal: „Der Markt ist letzte Nacht
    abgebrannt“, wie im Originalheft. Die Platte des Rathauses hat Platz,
    das Repository ist geprüft, und das Passwort liegt nicht mehr für alle
    offen herum.

    Gut gemacht! Du hast Kapitel 2 von „Das Archiv“ abgeschlossen.

    WAS PASSIERT IST
    Ein Skript hat eine Datei beschädigt; jede Nacht hat das Backup die
    beschädigte Version aufbewahrt. Weil restic Snapshots behält, war die
    richtige Version noch in denen von vor dem 2. Februar. Ein Spiegel
    hätte sie schon in der ersten Nacht verloren.

    GUTE PRAXIS
    - Versionen behalten, mit einer klaren Regel: zum Beispiel 7 tägliche,
      4 wöchentliche, 12 monatliche (forget --keep-daily 7 --keep-weekly 4
      --keep-monthly 12 --prune). Probier es mit --dry-run.
    - Ein Fehler kann tagelang unbemerkt bleiben: Du brauchst Versionen,
      die älter sind als die Zeit, die man braucht, um ihn zu bemerken.
    - forget entfernt Snapshots; erst prune gibt den Platz zurück.
    - Regelmäßig restic check, und ab und zu eine echte Wiederherstellung:
      Ein Backup, das nie wiederhergestellt wurde, ist nur eine Hoffnung.
    - Backups, die bei anderen liegen, verschlüsseln und das Passwort gut
      aufbewahren (Datei mit 600, und eine Kopie außerhalb der Maschine).

    EIN ANDERER WEG
    rsnapshot („Die Snapshots“, Die Ludothek): Jeder Snapshot ist ein
    einfaches Verzeichnis, das du mit ls liest und mit cp zurückkopierst,
    ohne Werkzeug zum Wiederherstellen; aber keine Verschlüsselung, und
    Deduplizierung nur ganzer Dateien. restic: verschlüsselt, in Stücken
    dedupliziert, und ein Repository, das woanders leben kann (sftp,
    Object Storage).

    DOKUMENTATION
    - Working with repositories: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - Restoring: https://restic.readthedocs.io/en/stable/050_restore.html
    - Removing snapshots: https://restic.readthedocs.io/en/stable/060_forget.html
