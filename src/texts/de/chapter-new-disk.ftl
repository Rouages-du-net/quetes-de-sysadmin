### Geschichte „Das Labor“, Kapitel 2 „Die neue Platte“: eine
### Partitionstabelle kopieren (sfdisk), das RAID neu aufbauen (mdadm --add,
### /proc/mdstat), GRUB auf der neuen Platte installieren. Befehle,
### Optionen, Pfade und Ausgaben werden nicht übersetzt.

chapter-new-disk = Die neue Platte
    .summary = Die neue Platte ist da, leer: Teil sie auf wie die andere, ohne dich in der Richtung zu irren, bau beide RAID-Arrays neu auf, und sorg dafür, dass der Server von jeder der beiden Platten booten kann.

## Dateien

new-disk-message-odile =
    Eine Nachricht von Odile (Sonntag, 8:05 Uhr):

    „Der Hoster hat über Nacht geantwortet: ‚Die defekte Platte wurde
    ausgetauscht. Die neue Platte wird leer geliefert: Es ist an Ihnen,
    sie zu partitionieren und Ihr RAID neu aufzubauen.‘ Ich muss zugeben,
    dass ich nicht weiß, was das heißt… Die Website läuft jedenfalls.

    Der frühere Ehrenamtliche hatte eine Notiz hinterlassen: ‚Beide
    Platten sind gleich aufgeteilt, und GRUB ist auf beiden, also bootet
    der Server auch, wenn eine ausfällt.‘“

## Ereignisse

new-disk-event-new =
    Die neue sdb: 1,8 T, keine Partition. Die Arrays laufen nur auf sda
    ([U_] in /proc/mdstat). Bevor sie ins RAID kommt, muss sie genau wie
    sda aufgeteilt werden: sfdisk kann die Tabelle einer Platte als Skript
    schreiben und wieder einlesen (man sfdisk).
new-disk-event-too-early =
    mdadm findet diese Partition nicht: sdb ist noch leer. Zuerst die
    Partitionstabelle (dieselbe wie bei sda), dann die Arrays.
new-disk-event-direction =
    sfdisk hat sich geweigert, auf eine Platte in Benutzung zu schreiben:
    zum Glück! Das war sda, die Platte, auf der der Server läuft. In einer
    Pipe wird die zuletzt genannte Platte überschrieben: sfdisk -d
    /dev/sda liest sda, sfdisk /dev/sdb schreibt auf sdb.
new-disk-event-disk-whole =
    Du hast die GANZE Platte sdb in ein Array gesteckt: Ihr
    RAID-Superblock hat ihre Partitionstabelle überschrieben, und es ist
    kein Platz mehr für GRUB oder für das andere Array. Nimm sie wieder
    heraus (--fail, dann --remove), kopier die Tabelle von sda, und füg die
    richtige Partition hinzu: sdb2 in md0, sdb3 in md1.
new-disk-event-table =
    sdb ist wie sda aufgeteilt: sdb1 (BIOS boot, der Platz von GRUB), sdb2
    und sdb3 (Linux RAID). Jede Partition kommt jetzt in das Array ihres
    Zwillings: sdb2 in md0, sdb3 in md1.
new-disk-event-added =
    Beide Partitionen sind in ihrem Array. Schau dir /proc/mdstat an: Ein
    Array wird nach dem anderen neu aufgebaut (recovery), das andere wartet,
    bis es dran ist (DELAYED). In der Zwischenzeit liefert der Server
    weiter die Fotos aus. Die Zeit vergeht hier schnell: Jeder Befehl zählt
    eine halbe Stunde.
new-disk-event-rebuilt =
    Überall [UU]: Beide Arrays haben wieder ihre zwei Kopien. Was bleibt,
    ist das, was an dem Tag zählt, an dem sda stirbt: von sdb booten zu
    können.
new-disk-event-grub =
    GRUB ist auf sdb installiert: Wenn sda ausfällt, kann der Server von
    der anderen Platte booten.
new-disk-event-end =
    Odile: „Wenn also wieder eine Platte ausfällt, verlieren wir nichts,
    und der Server startet trotzdem neu? Super.“

    Gut gemacht! Du hast Kapitel 2 von „Das Labor“ abgeschlossen. (Was als
    Nächstes kommt, wartet auf dich: ssh labor.)

    WAS PASSIERT IST
    Die neue Platte war leer. Du hast die Partitionstabelle von sda kopiert
    (sfdisk -d, dann sfdisk auf sdb: Die Richtung zählt), jede Partition zum
    Array ihres Zwillings hinzugefügt, den Neuaufbau verfolgt und GRUB auf
    der neuen Platte installiert.

    GUTE PRAXIS
    - Die Zielplatte zweimal prüfen, bevor du eine Tabelle schreibst: lsblk,
      und ihre Seriennummer.
    - Partitionen zu den Arrays hinzufügen, nicht die ganze Platte, wenn
      die Platte auch GRUB trägt.
    - Den Neuaufbau verfolgen (cat /proc/mdstat) und nichts neu starten,
      bevor [UU] dasteht.
    - GRUB auf jede Platte eines RAID 1, sonst verhindert der Ausfall der
      ersten das Booten.
    - Die kopierte Tabelle behält die Kennungen der anderen Platte
      (label-id, uuid): Auf einem echten Server zieht sgdisk -G /dev/sdb
      neue.
    - mdadm warnt, wenn ein Array degradiert (MAILADDR in
      /etc/mdadm/mdadm.conf): Jemand muss die Mail von root aber auch
      lesen.

    DOKUMENTATION
    - sfdisk: https://man7.org/linux/man-pages/man8/sfdisk.8.html
    - mdadm: https://man7.org/linux/man-pages/man8/mdadm.8.html
    - GRUB und das BIOS: https://www.gnu.org/software/grub/manual/grub/html_node/BIOS-installation.html
