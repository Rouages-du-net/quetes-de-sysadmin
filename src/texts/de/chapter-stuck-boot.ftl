### Geschichte „Das Labor“, Kapitel 4 „Der hängende Neustart“: der
### Notfallmodus, /etc/fstab über UUID, nofail, findmnt --verify, mount -a,
### systemctl daemon-reload. Befehle, Optionen, Pfade und Ausgaben werden
### nicht übersetzt.

chapter-stuck-boot = Der hängende Neustart
    .summary = Der Server startet nicht mehr neu: Er wartet auf eine Platte, die ihren Namen geändert hat. Versteh den Notfallmodus, benenne die Platte über ihre UUID, prüf fstab, bevor du den Bootvorgang fortsetzt.

## Dateien

# Die Zeile, die Théo zu /etc/fstab hinzugefügt hat (ein Kommentar)
stuck-boot-fstab-comment = # USB-Platte für die Scans (Théo, nach einem Tutorial, das ich auf meinem Laptop befolgt habe)
# { $banner }: die Meldung des Notfallmodus, auf Englisch wie auf der echten Konsole
stuck-boot-message-odile =
    Eine Nachricht von Odile (Dienstag, 25. Januar, 7:50 Uhr):

    „Die Website ist seit gestern Abend weg! Der Hoster sagt, der Server
    hat für ein Update neu gestartet (ein neuer Kernel) und ist ‚im
    Notfallmodus stehen geblieben‘. Sie haben uns ihre Konsole geöffnet:
    Es ist, als säßen wir vor dem Bildschirm des Servers, als root. Das
    steht da:

    { $banner }

    Letzte Woche hat Théo seine USB-Platte angeschlossen, die mit den Scans
    der alten Negative, und sie hinzugefügt, ‚damit sie sich von selbst
    einhängt‘. Er nimmt sie manchmal mit in den Club zum Scannen. Hängt
    das damit zusammen?“

## Ereignisse

stuck-boot-event-journal =
    systemd hat 90 Sekunden auf /dev/sdc1 gewartet und dann aufgegeben:
    Ohne sie kann /srv/scans nicht eingehängt werden, und local-fs.target
    (alle lokalen Dateisysteme) scheitert. Die Maschine bleibt dann im
    Notfallmodus stehen, ohne ihre Dienste zu starten. Aber wer ist heute
    sdc? (lsblk -f, blkid)
stuck-boot-event-disks =
    sdc ist eine der beiden 4-TB-Platten, die im vorigen Kapitel zu md2
    gekommen sind: Sie hat nicht einmal mehr eine Partition. Théos
    USB-Platte heißt jetzt sde (RM = 1: wechselbar), und ihre Partition
    trägt das Label SCANS. Die Namen sdX folgen der Reihenfolge, in der der
    Kernel die Platten findet; die UUID ändert sich nicht.
stuck-boot-event-name =
    /dev/sde1 würde heute funktionieren… bis zur nächsten hinzugefügten
    Platte, oder bis zum nächsten Bootvorgang, bei dem die USB-Platte vor
    einer anderen gefunden wird. Wie bei den ersten beiden Zeilen von
    fstab: Benenne sie über das, was sich nicht ändert: UUID=… (oder
    LABEL=…).
stuck-boot-event-deleted =
    Ohne ihre Zeile in fstab würde der Server booten… aber Théos Scans
    würden nie wieder eingehängt. Behalte die Zeile, und korrigiere sie.
stuck-boot-event-read =
    fstab hat jetzt eine unlesbare Zeile (sie braucht mindestens vier
    Felder: Quelle, Einhängepunkt, Typ, Optionen): mount -a meldet sie, und
    der Bootvorgang würde sie ignorieren. Lies die Datei noch einmal.
stuck-boot-event-without-nofail =
    Die UUID stimmt. Aber Théo nimmt die Platte manchmal mit: An dem Tag
    würde der Server wieder im Notfallmodus stehen bleiben. Die Option
    nofail (man fstab) sagt systemd, ohne sie weiterzumachen.
stuck-boot-event-fixed =
    fstab stimmt: die Scan-Platte über ihre UUID, mit nofail. Bevor du den
    Bootvorgang fortsetzt, prüf sie (findmnt --verify), probier sie aus
    (mount -a), und lass systemd sie neu lesen: Es hat seine Mount-Units
    aus der alten Version abgeleitet (systemctl daemon-reload).
stuck-boot-event-relapse =
    Der Bootvorgang ging weiter… und blieb wieder im Notfallmodus stehen:
    systemd wartet immer noch auf eine Platte, die nicht zu finden ist.
    Korrigiere zuerst fstab.
stuck-boot-event-relapse-reload =
    Der Bootvorgang ging weiter… und blieb wieder im Notfallmodus stehen:
    fstab stimmt, aber systemd benutzt noch die alte Version, die es beim
    Booten gelesen hat. systemctl daemon-reload lässt es sie neu lesen.
stuck-boot-event-mounted =
    Die Scan-Platte ist unter /srv/scans eingehängt (df -h, findmnt). Bleibt,
    den Notfallmodus zu verlassen: Setz den normalen Bootvorgang fort (man
    systemctl: default, oder exit), oder starte neu.
stuck-boot-event-end =
    Odile: „Die Website ist zurück! Und Théo hat seine Scans wieder. Er
    sagt, er kopiert nie wieder ein Tutorial, ohne es zu verstehen.“

    Gut gemacht! Du hast Kapitel 4 und die Geschichte „Das Labor“
    abgeschlossen.

    WAS PASSIERT IST
    Eine Zeile von /etc/fstab benannte die USB-Platte über ihren Namen,
    /dev/sdc1. Die zwei 4-TB-Platten aus Kapitel 3 haben die Namen sdc und
    sdd bekommen; die USB-Platte wurde zu sde. Beim Neustart wartete
    systemd auf /dev/sdc1 und hielt die Maschine dann im Notfallmodus an.
    Du hast die Platte über ihre UUID gefunden, fstab mit nofail
    korrigiert, sie geprüft, systemd die Datei neu lesen lassen und den
    Bootvorgang fortgesetzt.

    GUTE PRAXIS
    - In fstab UUID=… oder LABEL=…, nie /dev/sdX.
    - nofail für jede Platte, die fehlen kann (USB, externe Platte);
      x-systemd.device-timeout=10s, um nicht 90 Sekunden zu warten.
    - Nach jeder Änderung: findmnt --verify, mount -a, dann systemctl
      daemon-reload, vor dem Neustart.
    - Der Notfallmodus ist keine Panne: eine root-Shell, das Journal
      (journalctl -xb), und was du zum Reparieren brauchst. Besorg dir den
      Konsolenzugang des Hosters, bevor du ihn brauchst.
    - Notier, was du dem Server hinzufügst, und warum.

    DOKUMENTATION
    - fstab: https://man7.org/linux/man-pages/man5/fstab.5.html
    - systemd.mount (nofail, x-systemd.*): https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - findmnt: https://man7.org/linux/man-pages/man8/findmnt.8.html
    - fstab unter Debian: https://wiki.debian.org/fstab
