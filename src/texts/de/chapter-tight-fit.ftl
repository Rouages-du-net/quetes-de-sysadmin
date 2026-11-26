### Story "The Health Centre", chapter "The Tight Fit": the hypervisor
### swaps (its guests' memory is overcommitted), and a guest's disk is full.
### free, virsh dommemstat, setmem --live --config, snapshot-create-as,
### blockresize (or qemu-img resize while off), growpart, resize2fs,
### snapshot-delete. Commands, options, paths and outputs are not translated.

chapter-tight-fit = Eng bemessen
    .summary = In Mühlbach ist alles langsam, und die Patientenakten lassen sich nicht speichern. Der Hypervisor hat seinen Gästen mehr Speicher versprochen, als er hat, und die Platte eines Gasts ist voll mit Dateien, die das Gesetz aufzubewahren verlangt. Teil den Speicher vernünftig auf, vergrößere eine Platte sicher, mit einem Snapshot als Sicherheitsnetz, und behalte das Netz nicht für immer.

## Files

tight-fit-message-grace =
    Von: Grace (Praxisleitung)
    Donnerstag, 18. April, 14:00
    
    Alles ist heute so langsam: agenda braucht zehn Sekunden, um einen Tag
    zu öffnen, das Portal läuft in Timeouts. Und Joon sagt, die
    Akten-Anwendung weigert sich, die Notizen ihrer Sprechstunden zu
    speichern (ihre Notiz liegt in deinem Home-Verzeichnis).
    
    Bevor du etwas an records änderst, sorg bitte dafür, dass wir zurück
    können, wenn es schiefgeht. Das Backup von letzter Nacht liegt wie
    immer auf dem NAS.
    
    Grace
tight-fit-note-joon =
    Notiz von Joon (Pflege)
    
    Die Akten-Anwendung sagt „could not write to file“. Die IT-Firma, die
    sie installiert hat, sagt, die Platte des Servers ist voll, und dass
    die monatlichen Exporte in /srv/records/exports NICHT gelöscht werden
    dürfen: wir müssen sie aufbewahren (siehe RETENTION.txt auf records).
    
    Joon
tight-fit-retention =
    AUFBEWAHRUNG - Exporte der Akten
    
    Monatliche Exporte der Anwendung für Patientenakten. An Ort und Stelle
    aufbewahren, für die Frist, die die Richtlinie der Praxis verlangt.
    Nicht löschen, nicht verschieben. Fragen: Grace.

## Events

tight-fit-event-swap =
    herd swappt: sein RAM ist voll, und der Kernel schiebt Speicherseiten
    auf die Platte und holt sie dann zurück. Jeder Gast wird langsamer. Wer
    nimmt was? virsh list, virsh dominfo für jeden Gast (Used memory), virsh
    nodeinfo für herd, und von innen: virsh dommemstat records.
tight-fit-event-memstat =
    records hat 16 GiB bekommen. Was es wirklich braucht, ist „actual“ minus
    dem, was „unused“ ist, und dem, was nur Cache ist (disk_caches): etwa
    3,4 GiB. Ein Gast füllt den Speicher, den er bekommt, mit Cache, und
    dieser Speicher ist für den Host weg. Der Balloon kann ihn zurückgeben:
    virsh setmem (man virsh, seine Optionen --live und --config).
tight-fit-event-too-high =
    setmem kann nicht über den Maximalspeicher der Domain gehen (<memory>):
    der ändert sich mit setmaxmem --config und greift erst beim nächsten
    Start.
tight-fit-event-config-only =
    --config ändert die Definition, für den nächsten Start: records hält
    jetzt immer noch 16 GiB, und herd swappt weiter. --live ändert den
    laufenden Gast (der Balloon); beides zusammen ist die übliche Antwort.
tight-fit-event-memory-fixed =
    herd swappt nicht mehr, und die Definitionen passen auch beim nächsten
    Start in sein RAM: die Gäste bekommen zusammen weniger, als der Host
    hat, mit Platz für herd selbst.
tight-fit-event-guest-full =
    Das Root-Dateisystem von records ist voll: 20 GiB, und die Exporte
    müssen bleiben. Die Platte muss wachsen: zuerst das Image (von herd
    aus), dann die Partition und das Dateisystem (im Gast). Aber Grace hat
    zuerst um einen Weg zurück gebeten.
tight-fit-event-lock =
    qemu-img lehnt ab: records läuft, und QEMU hält eine Schreibsperre auf
    seinem Image. Ein Image hinter dem Rücken eines laufenden Gasts in der
    Größe zu ändern würde es beschädigen. Während er läuft: virsh
    blockresize, über QEMU. Oder fahr ihn herunter, dann qemu-img resize.
tight-fit-event-shrink-refused =
    Eine Platte zu verkleinern schneidet ihr Ende ab, mit allem, was dort
    geschrieben ist: QEMU lehnt ab, außer man sagt --shrink, und erst
    nachdem vorher das Dateisystem und die Partition verkleinert wurden.
    Hier muss die Platte wachsen.
tight-fit-event-shrunk =
    Das Image wurde unter das verkleinert, was records geschrieben hatte:
    das Ende seiner Platte ist weg, Dateisystem inklusive. Wenn du vorher
    einen Snapshot gemacht hast, bringt virsh snapshot-revert die Platte
    zurück; sonst starte das Kapitel neu (oder nimm den
    Wiederherstellungspunkt).
tight-fit-event-snapshot =
    Ein Snapshot von records, gemacht, bevor du seine Platte anfasst: ein
    Weg zurück, falls die Größenänderung schiefgeht (virsh
    snapshot-revert). Er lebt in records.qcow2: auf derselben Platte
    schützt er vor einem Fehler, nicht vor dem Verlust der Platte.
tight-fit-event-grown =
    Das Image von records ist größer: der Kernel des Gasts hat es sofort
    gesehen (dmesg im Gast, lsblk). Die Partition und das Dateisystem sind
    nicht gewachsen: im Gast growpart, dann resize2fs (man growpart).
tight-fit-event-grown-no-net =
    Das Image von records ist größer. Es ging gut, aber ohne Snapshot
    vorher: wäre es schiefgegangen, wäre das Backup von letzter Nacht der
    einzige Weg zurück gewesen. Als Nächstes die Partition und das
    Dateisystem: im Gast growpart, dann resize2fs.
tight-fit-event-partition =
    Die Partition füllt jetzt die Platte (lsblk). Das Dateisystem hat noch
    seine alte Größe: resize2fs vergrößert ein ext4-Dateisystem, während es
    eingehängt ist.
tight-fit-event-filesystem =
    Das Dateisystem von records hat Platz (df -h im Gast): die Anwendung
    kann wieder schreiben, und die Exporte sind noch da. Prüfe, dann vergiss
    die Snapshots nicht: virsh snapshot-list records.
tight-fit-event-cleaned =
    Kein Snapshot mehr auf records: weder deiner, jetzt nutzlos, noch der
    von Ilse aus dem Oktober, zu dem niemand je zurückkehren würde (es würde
    sechs Monate Patientenakten rückgängig machen).
tight-fit-event-end =
    Grace: „agenda öffnet sofort, und Joons Notizen werden gespeichert.
    Danke!“
    
    Gut gemacht! Du hast „Eng bemessen“ abgeschlossen.
    
    WAS PASSIERT IST
    Den Gästen von herd war mehr Speicher versprochen worden, als herd
    hat; records allein hielt 16 GiB, mit Cache gefüllt, für 3,4 GiB
    echten Bedarf, und herd swappte. Du hast records 6 GiB gegeben, jetzt
    und bei seinem nächsten Start (setmem --live --config). Seine Platte war
    voll mit Exporten, die bleiben müssen: du hast einen Snapshot gemacht,
    das Image vergrößert (virsh blockresize, während er läuft, oder
    qemu-img resize, während er aus ist), die Partition (growpart) und das
    Dateisystem (resize2fs) im Gast vergrößert, geprüft und die Snapshots
    gelöscht.
    
    GUTE PRAXIS
    - Zusammenzählen, was die Gäste bekommen (ihren aktuellen Speicher), und
      es unter dem halten, was der Host hat, mit Platz für den Host selbst.
      Ein Gast füllt seinen Speicher mit Cache: dommemstat sagt, was er
      wirklich braucht.
    - setmem --live für jetzt, --config für den nächsten Start; setmaxmem
      nur, während die Domain aus ist.
    - Eine Platte in drei Schritten vergrößern: das Image, die Partition,
      das Dateisystem. Nie ein Image hinter dem Rücken eines laufenden QEMU
      in der Größe ändern, und nie verkleinern, ohne vorher zu verkleinern,
      was darin ist.
    - Ein Snapshot vor einer riskanten Änderung, gleich danach gelöscht: ein
      Snapshot liegt auf derselben Platte, er ist kein Backup, und ein alter
      belastet das Image für immer.
    
    DOKUMENTATION
    - virsh (setmem, dommemstat, blockresize, Snapshots): https://libvirt.org/manpages/virsh.html
    - qemu-img resize: https://www.qemu.org/docs/master/tools/qemu-img.html
    - growpart: https://manpages.debian.org/trixie/cloud-guest-utils/growpart.1.en.html
    - resize2fs: https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - Speicher im XML einer Domain: https://libvirt.org/formatdomain.html#memory-allocation
