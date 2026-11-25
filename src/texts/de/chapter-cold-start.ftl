### Story "The Health Centre", chapter "The Cold Start": after a power
### cut, the accounting VM didn't come back; started by hand, it pauses on a
### full /var: a chain of forgotten external snapshots. virsh list, dominfo,
### domstate, domblkerror, qemu-img info, blockcommit, snapshot-delete,
### autostart. Commands, options, paths and outputs are not translated.

chapter-cold-start = Der Kaltstart
    .summary = Samstagnacht hat ein Sturm im Tal den Strom abgeschaltet. Am Montag ist das Terminbuch des Empfangs zurück, aber der Buchhaltungsserver nicht, und Priya muss die Gehaltsabrechnung verschicken. Finde heraus, warum eine virtuelle Maschine aus geblieben ist, warum sie einfriert, sobald sie startet, und schaff Platz auf dem Hypervisor, ohne ein Jahr Buchhaltung zu verlieren.

## Files

cold-start-message-grace =
    Von: Grace (Praxisleitung)
    Montag, 11. März, 8:05
    
    Guten Morgen, und willkommen im Gesundheitszentrum Mühlbach!
    
    Der Sturm in der Samstagnacht hat den Strom für drei Stunden
    abgeschaltet, länger als die USV hält. herd, der Server im
    Hinterzimmer, ist von selbst wieder gestartet, als der Strom zurückkam.
    Das Terminbuch (agenda) und die Patientenakten (records) funktionieren;
    die Buchhaltung (ledger) nicht, und Priya muss am Mittwoch die
    Gehaltsabrechnung verschicken.
    
    Alle unsere Server sind virtuelle Maschinen auf herd (KVM, mit
    libvirt): du bist in der Gruppe libvirt, und sudo funktioniert mit
    deinem Passwort. Ilse, die alles eingerichtet hat, ist an die Küste
    gezogen; sie hat eine Notiz in deinem Home-Verzeichnis hinterlassen.
    Priya auch.
    
    Bitte verlier Priyas Buchhaltung nicht.
    
    Grace
cold-start-note-ilse =
    Notizen von Ilse (herd)
    
    - virsh ist dein Freund: virsh list --all zeigt jede VM, ob sie läuft
      oder nicht. ~/.config/libvirt/libvirt.conf lässt virsh auf
      qemu:///system zeigen.
    - Images in /var/lib/libvirt/images (nur root: benutze sudo).
    - Vor allem Riskanten auf ledger habe ich einen Snapshot gemacht (virsh
      snapshot-create-as --disk-only): vor dem Software-Update, vor dem
      Jahresabschluss, vor dem Upgrade auf Debian 13. Ich wollte sie danach
      aufräumen…
    - ledger-test-clone.qcow2 ist eine Kopie, die ich im Januar gemacht
      habe, um mit Priya die neue Version der Buchhaltung zu testen. Nichts
      benutzt sie; sie kann weg, sobald Priya sagt, dass der Test vorbei
      ist.
    
    Ilse
cold-start-message-priya =
    Von: Priya (Buchhaltung, montags und mittwochs)
    
    Hallo! Der Test der neuen Version, den Ilse im Januar gemacht hat, ist
    vorbei: wir sind bei der alten geblieben. Ihre Testkopie kann gelöscht
    werden, ich brauche sie nicht.
    
    Die echte Buchhaltung ist auf ledger, und ich brauche sie bis Mittwoch.
    
    Priya

## Events

cold-start-event-list =
    ledger ist „shut off“: agenda und records kamen mit herd zurück,
    ledger nicht. Eine Domain startet nur mit ihrem Host, wenn sie als
    autostart markiert ist (virsh dominfo zeigt es). Bevor du sie startest,
    schau sie dir an: virsh dominfo ledger.
cold-start-event-autostart-off =
    Autostart: disable. ledger ist nach einem Neustart nie von selbst
    zurückgekommen: jemand hat sie immer von Hand gestartet. Das lässt sich
    ändern (man virsh, autostart), aber zuerst: startet sie überhaupt?
    virsh start ledger.
cold-start-event-paused =
    ledger ist gestartet… und ein paar Sekunden später eingefroren: sie ist
    jetzt „paused“ (virsh list). Einen Gast, der nicht auf seine Platte
    schreiben kann, pausiert QEMU, statt ihn sein Dateisystem beschädigen zu
    lassen (seine Standard-Policy werror=enospc). Warum? virsh domstate
    ledger --reason, virsh domblkerror ledger, und was sagt die Platte des
    Hosts (df -h)?
cold-start-event-no-space =
    „vda: no space“, und /var ist zu 100 % voll: der Gast hat geschrieben,
    sein Image ist gewachsen, und das Dateisystem, das die Images enthält,
    ist voll. Was belegt so viel Platz? sudo ls -lh
    /var/lib/libvirt/images, und welche Images benutzt ledger wirklich?
    virsh domblklist ledger, dann qemu-img info auf ihre Platte (sudo).
cold-start-event-lock =
    qemu-img lehnt ab: das Image wird benutzt, und QEMU hält eine Sperre
    darauf, damit niemand hinter seinem Rücken schreibt. Um es nur zu lesen,
    verlange ein geteiltes Öffnen: qemu-img info -U (--force-share). Schreib
    nie in ein Image, das ein laufender Gast benutzt.
cold-start-event-chain =
    Die Platte von ledger ist eine Kette: before-upgrade liegt auf
    before-yearend, das auf before-update liegt, das auf ledger.qcow2
    liegt. Jeder externe Snapshot hat das Image darunter eingefroren und
    eine neue Datei darüber angelegt, in die seitdem jeder Schreibvorgang
    gegangen ist. Vier Dateien für eine Platte von 200 GiB (virtual size:
    was der Gast sieht; disk size: was der Host ihr gibt). Schau dir auch
    die Snapshots an: virsh snapshot-list ledger.
cold-start-event-acpi-paused =
    virsh shutdown drückt den virtuellen Einschaltknopf (ACPI): das System
    des Gasts muss ihn hören und sich selbst herunterfahren. Ein pausierter
    Gast hört nichts: ledger ist immer noch pausiert. Ihre Platte ist das
    Problem, nicht ihr Strom.
cold-start-event-destroyed =
    virsh destroy zieht den Stecker: kein Herunterfahren, der Gast steht
    sofort still, wie es der Sturm mit ihm gemacht hat. Er war pausiert,
    also wurde diesmal nichts halb geschrieben; bei einem laufenden Gast ist
    destroy der letzte Ausweg. Die Kette und das volle /var sind immer noch
    da.
cold-start-event-revert =
    Glückliche Ablehnung. Zu before-update zurückzukehren würde ledger so
    zurücksetzen, wie sie im März letzten Jahres war: ein Jahr Buchhaltung
    weg. Ein Snapshot ist ein Punkt, zu dem man zurückkehrt, kein Ort, von
    dem aus man weiterlebt.
cold-start-event-undefine =
    libvirt weigert sich, eine Domain zu entfernen, die noch Snapshots hat,
    und hat recht: ledger zu entfernen würde ihre Platte nicht reparieren,
    und mit --remove-all-storage würde es sie löschen.
cold-start-event-rm-held =
    Du hast ein Image entfernt, das ledger benutzt. Schau dir df an: kein
    Platz ist zurückgekommen. QEMU hält die Datei noch offen (sudo lsof
    zeigt sie „(deleted)“): ihre Blöcke werden erst freigegeben, wenn der
    Gast stoppt. Und wenn er stoppt, zeigt die Kette auf eine Datei, die es
    nicht mehr gibt. Stoppe ledger nicht: solange QEMU die Datei hält, kann
    ein Block Commit sie noch lesen und alles in die Basis zusammenführen.
cold-start-event-broken =
    Die Kette von ledger ist zerbrochen: ein Image, das sie braucht, ist
    weg, und QEMU hält es nicht mehr. libvirt kann die Domain nicht mehr
    starten („Cannot access backing file“). Die Daten, die in dieses Image
    geschrieben wurden, sind verloren. Starte das Kapitel neu (oder nimm den
    Wiederherstellungspunkt): lösch nie ein Image, ohne zu prüfen, was es
    benutzt (virsh domblklist, qemu-img info --backing-chain).
cold-start-event-commit-failed =
    Das Zusammenführen ist gescheitert: ein Image in seine Basis zu
    committen lässt die Basis um das wachsen, was sie empfängt, und /var
    hat keinen Platz mehr. Schaff zuerst Platz, mit etwas, das nichts
    benutzt (Ilses Notiz, Priyas Nachricht), dann führe zusammen.
cold-start-event-room =
    Der Testklon ist weg: etwa 12 GiB frei auf /var. Nicht viel: die Kette
    hält immer noch ein Jahr Schreibvorgänge über der Basis. Führe sie
    zusammen: virsh blockcommit mit --active --pivot führt die ganze Kette
    in die Basis zusammen, während der Gast läuft (oder pausiert ist);
    virsh snapshot-delete führt einen externen Snapshot nach dem anderen
    zusammen (man virsh).
cold-start-event-merged =
    Die Kette ist zusammengeführt: die Platte von ledger ist allein
    ledger.qcow2, mit allem, was darüber geschrieben wurde. Die Overlays und
    die Snapshots sind mit ihr verschwunden.
cold-start-event-merged-leftovers =
    Die Kette ist zusammengeführt: ledger schreibt jetzt allein in
    ledger.qcow2. Aber die Overlay-Dateien liegen noch auf /var
    (blockcommit löscht sie nicht ohne --delete), und libvirt listet noch
    die Snapshots, die auf Images zeigen, die nicht mehr in der Kette sind.
    Entferne die Dateien, die nichts mehr benutzt (prüfe mit virsh
    domblklist ledger), und die veralteten Metadaten: virsh snapshot-delete
    --metadata.
cold-start-event-paused-again =
    Wieder pausiert: der Gast hat weiter geschrieben, und /var war immer
    noch voll mit den alten Overlays. Ein Zusammenführen kopiert Daten in
    die Basis; es gibt nichts frei, solange die alten Dateien auf der Platte
    bleiben.
cold-start-event-cleaned =
    /var hat wieder Platz: ein Image für ledger, kein übrig gebliebenes
    Overlay, und Snapshot-Metadaten, die zur Platte passen.
cold-start-event-resumed =
    ledger läuft wieder (virsh resume weckt einen pausierten Gast; er macht
    dort weiter, wo er eingefroren ist). Gib ihr ein paar Sekunden, um
    fertig zu booten.
cold-start-event-autostart =
    ledger ist als autostart markiert: /etc/libvirt/qemu/autostart/ledger.xml
    verweist auf ihre Definition, und der nächste Sturm wird sie nicht
    zurücklassen.
cold-start-event-ssh =
    Du bist auf ledger: Priyas Buchhaltung liegt in /srv/ledger/books. Komm
    mit exit zurück zu herd.
cold-start-event-end =
    Grace: „Priya sagt, die Buchhaltung ist vollständig da, die
    Gehaltsabrechnung am Mittwoch wie geplant. Danke!“
    
    Gut gemacht! Du hast „Der Kaltstart“ abgeschlossen.
    
    WAS PASSIERT IST
    Der Stromausfall vom Samstag hat herd neu gestartet. agenda und
    records waren als autostart markiert; ledger nicht. Von Hand gestartet,
    pausierte sie sofort: über ein Jahr hatte Ilse drei externe
    Disk-only-Snapshots davon gemacht und sie nie zusammengeführt. Jeder
    legte ein neues Overlay an, in das jeder Schreibvorgang ging, und die
    Kette aus vier Images hatte /var gefüllt. Du hast mit dem, was nichts
    benutzte, Platz geschaffen (der Testklon), die Kette in ihre Basis
    zusammengeführt, die Reste und die veralteten Metadaten entfernt, ledger
    fortgesetzt, sie als autostart markiert und sie von innen geprüft.
    
    GUTE PRAXIS
    - virsh list --all, nicht virsh list: eine gestoppte Domain erscheint
      sonst nicht. virsh autostart für jeden Gast, der mit seinem Host
      zurückkommen muss.
    - „paused (I/O error)“ mit „no space“: schau aufs Dateisystem des
      Hosts, bevor du den Gast anfasst.
    - Ein dünnes Image (qcow2) kann bis zu seiner virtuellen Größe wachsen:
      die Summe der virtuellen Größen kann die Platte durchaus übersteigen.
      Behalte df auf dem Host im Auge.
    - Ein externer Snapshot ist eine neue Datei über der alten: führe sie
      zurück (blockcommit, oder snapshot-delete seit libvirt 9), sobald sie
      nicht mehr gebraucht wird. Nie ein Image einer Kette mit rm löschen.
    - qemu-img info -U, um ein benutztes Image zu lesen; nie hineinschreiben.
    - Ein Snapshot ist ein Punkt zum Zurückkehren, auf derselben Platte: er
      ist kein Backup.
    
    DOKUMENTATION
    - virsh: https://libvirt.org/manpages/virsh.html
    - Ketten von Disk-Images zusammenführen: https://libvirt.org/kbase/merging_disk_image_chains.html
    - Snapshots in libvirt: https://libvirt.org/kbase/snapshots.html
    - qemu-img: https://www.qemu.org/docs/master/tools/qemu-img.html
    - KVM unter Debian: https://wiki.debian.org/KVM
