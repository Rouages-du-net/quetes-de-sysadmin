### Geschichte „Die Vorratskammer“, Kapitel „Die verlorene Platte“: Die
### Backup-Platte, in der Straßenbahn verloren und wiedergefunden, war
### nicht verschlüsselt. LUKS (cryptsetup), eine Schlüsseldatei und eine
### Passphrase, /etc/crypttab und /etc/fstab. Befehle, Optionen, Pfade,
### Gerätenamen und Ausgaben werden nicht übersetzt.

chapter-lost-disk = Die verlorene Platte
    .summary = Die Backup-Platte der Vorratskammer hat ein Wochenende im Fundbüro der Straßenbahn verbracht, unverschlüsselt, mit der Liste der Haushalte, denen sie hilft. Sie mit LUKS verschlüsseln, dem nächtlichen Job eine Schlüsseldatei und der Kassenwartin eine Passphrase geben, sie in crypttab und fstab beschreiben und das Backup wieder darauf legen.

## Dateien

lost-disk-message-fatou =
    Von: Fatou (Koordinatorin)
    Montag, 9:02

    Hallo, und danke, dass du so schnell kommst.

    Am Freitagabend hat Joaquín die Backup-Platte mit nach Hause genommen,
    wie jede Woche (die Platte, die das Gebäude verlässt, falls es brennt).
    Er hat seine Tasche in der Straßenbahn liegen lassen. Das Fundbüro hat
    sie heute Morgen zurückgegeben, die Platte darin, anscheinend
    unberührt.

    Anscheinend. Diese Platte enthält eine Kopie von allem: die Liste der
    Haushalte, denen wir helfen (familien.csv), mit ihren Notizen. Wenn
    jemand sie an einen Laptop angeschlossen hätte, hätte er alles lesen
    können.

    Ich will, dass das nie wieder möglich ist. Joaquín hat die Platte
    wieder an kiste angeschlossen (sie ist auf /mnt/offsite eingehängt, wie
    jede Woche). Mei, unsere Kassenwartin, hat dir eine Notiz
    hinterlassen.

    Fatou

lost-disk-note-mei =
    Notiz von Mei (Kassenwartin)

    Ich bewahre die Passwörter des Vereins in unserem Passwortmanager auf,
    und eine Papierkopie in einem versiegelten Umschlag bei der Bank. Für
    die Backup-Platte habe ich diese Passphrase erzeugt:

        { $passphrase }

    Sie steht schon im Passwortmanager („Backup disk — LUKS“) und im
    Umschlag. Benutz sie für die Platte, als Zugang, der nicht vom Server
    abhängt. Lösch dann diese Notiz: Sie hat auf kiste nichts zu suchen.

lost-disk-last-sync =
    rsync auf die externe Platte: Freitag, 2. März 2029, 18:40, OK.

## Ereignisse

lost-disk-event-disk =
    Da ist sie: sdb, eine Wechselplatte (RM 1), und ihre Partition sdb1,
    ein einfaches ext4-Dateisystem mit dem Label OFFSITE, eingehängt auf
    /mnt/offsite. Jeder kann sie an jedem Computer lesen. Um sie zu
    verschlüsseln, muss sie zuerst frei sein: nichts eingehängt, niemand
    benutzt sie.
lost-disk-event-system-disk =
    cryptsetup hat abgelehnt: Dieses Gerät ist in Gebrauch. Zum Glück, denn
    sda ist die eigene Platte von kiste, die, von der das System läuft. Sie
    zu verschlüsseln hätte den Server gelöscht. Die Backup-Platte ist die
    andere: Prüfe mit lsblk (RM, SIZE, MOUNTPOINTS), bevor du ein Gerät
    nennst.
lost-disk-event-in-use =
    cryptsetup formatiert kein eingehängtes Gerät: Häng es zuerst aus
    (umount). Keine Sorge um das, was darauf ist: Es ist die Kopie vom
    letzten Freitag, und die Originale liegen auf kiste, in /srv.
lost-disk-event-unmounted =
    Die Platte ist frei. Sie mit LUKS zu formatieren löscht, was sie
    enthält, und schreibt an ihren Anfang einen Header mit
    Schlüsselplätzen (man cryptsetup, luksFormat). Nenn das Gerät mit
    Bedacht: die Partition sdb1 (oder die ganze Platte sdb).
lost-disk-event-lowercase =
    cryptsetup macht nur weiter, wenn du YES tippst, in Großbuchstaben:
    Alles andere, „yes“ inklusive, bricht ab. Das ist eine absichtliche
    Bremsschwelle: der letzte Moment, den Namen des Geräts zu prüfen.
lost-disk-event-formatted =
    Das Gerät ist jetzt LUKS: ein Header (cryptsetup luksDump zeigt seine
    Schlüsselplätze) und danach nur verschlüsselte Daten. Nichts lässt sich
    direkt einhängen: Es muss geöffnet werden (cryptsetup open GERÄT NAME),
    was ein Klartext-Gerät erzeugt, /dev/mapper/NAME. Achtung: Das
    Dateisystem kommt auf dieses.
lost-disk-event-mounted-luks =
    mount weiß mit crypto_LUKS nichts anzufangen: Das verschlüsselte Gerät
    selbst wird nie eingehängt. Öffne es (cryptsetup open GERÄT NAME) und
    häng dann /dev/mapper/NAME ein, sobald es ein Dateisystem trägt.
lost-disk-event-mkfs-header =
    mkfs.ext4 hat die verschlüsselte Partition selbst überschrieben: Der
    LUKS-Header ist weg, und die Platte ist wieder im Klartext. Das
    Dateisystem kommt auf das geöffnete Mapping, /dev/mapper/NAME, nie auf
    das Gerät darunter. Fang noch einmal mit luksFormat an.
lost-disk-event-filesystem =
    Ein ext4-Dateisystem lebt im verschlüsselten Gerät: Was du nach
    /dev/mapper/NAME schreibst, wird auf dem Weg zur Platte verschlüsselt.
    Jetzt die Schlüssel. Der nächtliche Job kann keine Passphrase tippen:
    Er braucht eine Schlüsseldatei (zufällige Bytes: dd aus
    /dev/urandom), nur für root lesbar, in einem zweiten Platz
    hinzugefügt (luksAddKey).
lost-disk-event-keyfile-open =
    Diese Schlüsseldatei öffnet die Platte, und jemand anderes als root
    kann sie lesen (ls -l: ihre Rechte, ihr Besitzer). Eine
    Schlüsseldatei ist ein Passwort: chmod 400, im Besitz von root, in
    einem Verzeichnis, das nur root betritt (/root).
lost-disk-event-keyfile-on-disk =
    Diese Schlüsseldatei liegt auf der Backup-Platte selbst: ein Schlüssel,
    der im Schloss steckt. Er würde mit der Platte verschwinden, und er
    kann ohnehin nicht öffnen, worauf er liegt. Bewahr ihn auf kiste auf,
    in /root.
lost-disk-event-keyfile =
    Die Schlüsseldatei öffnet die Platte, und nur root kann sie lesen: Der
    nächtliche Job kann sie öffnen, ohne dass jemand etwas eintippt. Aber
    wenn kiste stirbt, stirbt dieser Schlüssel mit. Die Platte muss sich
    auch mit etwas öffnen lassen, das anderswo aufbewahrt wird: Meis
    Passphrase.
lost-disk-event-own-passphrase =
    Diese Passphrase steht in einem Platz, aber es ist nicht die, die Mei
    aufbewahrt: Wenn du sie vergisst, kann niemand sonst die Platte öffnen.
    Füg auch ihre hinzu (luksAddKey), dann kannst du deine danach
    entfernen (luksRemoveKey).
lost-disk-event-passphrase =
    Meis Passphrase öffnet die Platte: Wenn kiste abbrennt, reicht ihr
    Umschlag, um das Backup auf jeder Linux-Maschine zu lesen.
lost-disk-event-insecure =
    cryptdisks_start warnt wegen der Rechte der Schlüsseldatei: Sie sollte
    root gehören und für niemanden sonst lesbar sein (chmod 400 oder 600).
lost-disk-event-crypttab-name =
    Diese crypttab-Zeile nennt die Platte über /dev/sdX: Der Name einer
    USB-Platte ändert sich mit der Reihenfolge, in der Platten eingesteckt
    werden. Nimm ihre LUKS-UUID (UUID=…, siehe blkid oder cryptsetup
    luksUUID).
lost-disk-event-crypttab-auto =
    Diese crypttab-Zeile würde den Boot auf eine Platte warten lassen, die
    jedes Wochenende weg ist. Eine Wechselplatte bekommt noauto (bei Bedarf
    geöffnet, cryptdisks_start) oder nofail.
lost-disk-event-crypttab =
    /etc/crypttab beschreibt die Platte: ihren Namen, ihre UUID, die
    Schlüsseldatei und noauto. cryptdisks_start NAME öffnet sie mit der
    Schlüsseldatei, so wie es der nächtliche Job tun wird. Jetzt
    /etc/fstab: Die alte Zeile hängt ein Label ein, das es nicht mehr gibt.
lost-disk-event-fstab =
    /etc/fstab hängt /dev/mapper/NAME ein, nicht beim Booten (noauto oder
    nofail): Sobald die Platte offen ist, genügt mount /mnt/offsite.
lost-disk-event-copied =
    Die Dateien der Vorratskammer sind wieder auf der verschlüsselten
    Platte: Diese Woche gibt es zumindest ein Backup.
lost-disk-event-busy =
    Das Mapping ist noch in Gebrauch: Etwas ist darauf eingehängt. Erst
    aushängen (umount), dann schließen.
lost-disk-event-closed =
    Die Platte ist geschlossen: Ohne Schlüssel ist sie nichts als Rauschen.
    Joaquín kann sie am Freitag mitnehmen.
lost-disk-event-note =
    Meis Notiz ist von kiste verschwunden: Die Passphrase lebt nur noch
    dort, wo sie soll, im Passwortmanager und im Umschlag.
lost-disk-event-note-early =
    Du hast Meis Notiz gelöscht, bevor ihre Passphrase in einem Platz
    stand: Sie hat sie gerade noch einmal geschickt (cat auf die Notiz).
    Lösch sie, sobald sich die Platte damit öffnen lässt.
lost-disk-event-end =
    Fatou: „Wenn die Tasche also wieder verloren geht, bekommt der Finder
    einen Ziegelstein? Und wenn kiste stirbt, öffnet Meis Umschlag sie?
    Perfekt.“

    Gut gemacht! Du hast Kapitel 1 von Die Vorratskammer abgeschlossen.
    (Was als Nächstes kommt, wartet auf dich: ssh kiste.)

    WAS PASSIERT IST
    Die Backup-Platte ist im Klartext gereist. Du hast sie ausgehängt, mit
    LUKS verschlüsselt (cryptsetup luksFormat, nach einem YES in
    Großbuchstaben), sie geöffnet und das Dateisystem auf dem Mapping
    angelegt (/dev/mapper/NAME), ihr zwei Schlüssel gegeben: eine
    Schlüsseldatei, die nur root liest, für den nächtlichen Job, und Meis
    Passphrase, außerhalb des Servers aufbewahrt. crypttab und fstab
    beschreiben sie, die Dateien sind wieder darauf, und sie verlässt das
    Gebäude geschlossen.

    GUTE PRAXIS
    - Jede Platte, die das Gebäude verlässt, ist verschlüsselt: Ein
      verlorenes Backup muss ein verlorener Gegenstand sein, kein
      Datenleck.
    - Das Gerät vor luksFormat zweimal prüfen (lsblk: RM, SIZE, das
      Modell).
    - Nie nur ein Schlüssel: ein automatischer (eine Schlüsseldatei, nur
      root) und ein menschlicher, anderswo aufbewahrt (Passwortmanager,
      versiegelter Umschlag).
    - Eine Schlüsseldatei wird nie auf der Platte gespeichert, die sie
      öffnet, und ist nie für jemand anderen als root lesbar.
    - crypttab und fstab: die UUID statt /dev/sdX, noauto oder nofail für
      eine Wechselplatte, damit der Boot nicht auf sie wartet.
    - Auch den LUKS-Header sichern (cryptsetup luksHeaderBackup): Ein
      beschädigter Header macht jeden Schlüssel nutzlos.
    - Verschlüsselt heißt nicht gesichert: die Dateien zurückkopieren und
      das Öffnen mit jedem Schlüssel testen.

    DOKUMENTATION
    - cryptsetup: https://man7.org/linux/man-pages/man8/cryptsetup.8.html
    - crypttab: https://man7.org/linux/man-pages/man5/crypttab.5.html
    - cryptsetup-FAQ: https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions
    - crypttab und cryptdisks bei Debian: https://cryptsetup-team.pages.debian.net/cryptsetup/README.Debian.html
