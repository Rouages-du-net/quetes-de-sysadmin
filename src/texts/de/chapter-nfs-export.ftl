### Geschichte „Der Fotoclub“, Kapitel 1 „Das geteilte Verzeichnis“: ein
### NFS-Export (/etc/exports, exportfs), die Firewall, mount -t nfs und
### fstab. Konfiguration, Pfade und die Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-nfs-export = Das geteilte Verzeichnis
    .summary = Die Fotos des Clubs liegen auf dem NAS. Der Rechner in der Dunkelkammer soll sie wie eines seiner eigenen Verzeichnisse sehen, und auch nach einem Neustart noch.

## Dateien

nfs-export-message-margot =
    Von:     Margot
    An:      dich
    Betreff: Die Fotos auf dem Rechner in der Dunkelkammer

    Hallo,

    Willkommen auf den Maschinen des Clubs! Das NAS (wo du gerade bist)
    hält alle unsere Fotos in /srv/photos. In der Dunkelkammer steht ein
    Rechner (darkroom, du erreichst ihn von hier mit ssh darkroom), auf dem
    wir bearbeiten und drucken.

    Heute kopieren wir die Fotos auf USB-Sticks hin und her. Ich hätte so
    gern, dass der Rechner in der Dunkelkammer das Verzeichnis des NAS in
    /mnt/photos sieht, als wäre es sein eigenes, und dass es nach einem
    Neustart noch da ist.

    Nur der Rechner in der Dunkelkammer, bitte: Das NAS hängt im Netz des
    Clubs, wo auch die Laptops der Gäste sind.

    Dein sudo-Passwort (auf beiden Maschinen): verschluss-2028.

    Margot

## Ereignisse

nfs-export-event-exports =
    /etc/exports ist die Liste des NAS, was es über NFS teilt, und mit wem:
    eine Zeile pro Verzeichnis, dann jeder Client mit seinen Optionen in
    Klammern, ohne Leerzeichen davor (man exports):
    /srv/photos 192.0.2.32(rw,sync,no_subtree_check). Ohne rw ist ein
    Export nur lesbar.
nfs-export-event-not-loaded =
    Die Zeile steht in /etc/exports, aber das NAS liefert noch seine alte
    Liste aus: Der Server liest die Datei beim Start, oder wenn du ihn
    darum bittest (sudo exportfs -ra; exportfs -v zeigt, was er
    ausliefert).
nfs-export-event-loaded =
    Das NAS liefert /srv/photos jetzt an den Rechner in der Dunkelkammer
    aus (exportfs -v). Weiter zum Client: ssh darkroom, dann mount (man
    mount, man nfs).
nfs-export-event-too-open =
    Vorsicht: Dieser Export ist für alle (*), oder mit no_root_squash. Die
    Laptops der Gäste könnten ihn einhängen, und root auf einem Client wäre
    root auf den Fotos. Exportiere nur an den Rechner in der Dunkelkammer,
    und behalte root_squash (der Standard).
nfs-export-event-no-mount-point =
    Ein Einhängen braucht ein existierendes Verzeichnis, an dem es
    ansetzen kann: Leg zuerst /mnt/photos an (sudo mkdir).
nfs-export-event-firewall =
    Das Einhängen wartet und gibt dann auf: Nichts antwortet. Die Firewall
    des NAS lässt nur SSH herein, und NFS (Port 2049) wird verworfen. Öffne
    sie nur für den Rechner in der Dunkelkammer (man ufw). showmount fragt
    auch rpcbind (Port 111); mount allein braucht bei NFSv4 nur 2049.
nfs-export-event-denied =
    Das NAS antwortet, und lehnt ab: Seine Exportliste enthält diesen
    Client nicht (oder noch die alte). Prüf, was es ausliefert: sudo
    exportfs -v auf dem NAS, und die Adresse des Rechners in der
    Dunkelkammer.
nfs-export-event-mounted =
    /mnt/photos zeigt die Fotos des NAS (df -h, mount | grep nfs). Bis zum
    nächsten Neustart: Damit es zurückkommt, muss /etc/fstab auf dem
    Rechner in der Dunkelkammer es beschreiben (man fstab; _netdev wartet
    auf das Netz).
nfs-export-event-read-only =
    Es ist eingehängt, aber nur lesbar: Ein Export ohne rw ist ro. Füg rw
    zu den Optionen des Exports auf dem NAS hinzu, dann sudo exportfs -ra.
nfs-export-event-end =
    Der Rechner in der Dunkelkammer sieht die Fotos in /mnt/photos, und
    fstab bringt sie bei jedem Start zurück. Margot: „Keine USB-Sticks
    mehr! Sam druckt schon vom NAS.“

    Gut gemacht! Du hast das Kapitel „Das geteilte Verzeichnis“ abgeschlossen.

    WAS PASSIERT IST
    Das NAS exportierte nichts (das /etc/exports von Debian besteht nur
    aus Kommentaren), und seine Firewall verwarf NFS. Ein Export nur für
    den Rechner in der Dunkelkammer, die Firewall für ihn geöffnet, ein
    Einhängen, und eine Zeile in fstab.

    NFS IN KÜRZE
    - Auf dem Server: /etc/exports (Verzeichnis, Clients, Optionen), dann
      exportfs -ra; exportfs -v listet auf, was ausgeliefert wird.
    - Auf dem Client: mount -t nfs server:/verzeichnis /punkt; in
      /etc/fstab: server:/verzeichnis /punkt nfs defaults,_netdev 0 0.
    - NFSv4 braucht nur Port 2049 (TCP).

    GUTE PRAXIS
    - An benannte Clients oder ein kleines Netz exportieren, nie an *.
    - root_squash behalten: root auf einem Client wird auf dem Server zu
      nobody.
    - NFS mit sec=sys glaubt dem Client, wer wer ist: nur Maschinen, die du
      verwaltest. Für mehr: Kerberos (sec=krb5).

    DOKUMENTATION
    - exports(5): https://man7.org/linux/man-pages/man5/exports.5.html
    - nfs(5): https://man7.org/linux/man-pages/man5/nfs.5.html
    - Debian: https://wiki.debian.org/NFSServerSetup
