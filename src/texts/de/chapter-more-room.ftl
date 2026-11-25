### Geschichte „Das Labor“, Kapitel 3 „Der Platz wird knapp“: ein neues
### Array (mdadm --create), LVM (pvcreate, vgextend, lvextend), das
### Dateisystem (resize2fs), mdadm.conf und das initramfs. Befehle,
### Optionen, Pfade und Ausgaben werden nicht übersetzt.

chapter-more-room = Der Platz wird knapp
    .summary = Die Fotoplatte ist voll, und der Winterwettbewerb kommt: Mach aus den zwei neuen Platten ein RAID-Array, gib es LVM, vergrößere das Volume und sein Dateisystem, und sorg dafür, dass der Bootvorgang es sich merkt.

## Dateien

more-room-message-odile =
    Eine Nachricht von Odile (Samstag, 15. Januar, 9:50 Uhr):

    „Frohes neues Jahr! Am Montag beginnt der Winterwettbewerb, und wir
    erwarten etwa 1,5 TB Fotos. Aber die Galerie sagt schon ‚Platte fast
    voll‘: Gestern haben wir das ganze Herbstarchiv hochgeladen.

    Ich habe gemacht, was du mir gesagt hast: Ich habe den Hoster um zwei
    weitere Platten gebeten. Sie haben sie heute Morgen angeschlossen,
    zwei Platten mit 4 TB. Sie sagen, sie sind ‚leer, jetzt seid ihr
    dran‘.

    Können wir den Platz für die Fotos vergrößern, ohne etwas kaputtzumachen?
    Und ohne die Sicherheit der zwei Platten zu verlieren, natürlich.“

## Ereignisse

more-room-event-full =
    /srv ist zu 97 % voll. Es liegt nicht auf einer Partition, sondern auf
    /dev/mapper/labor-photos: einem logischen Volume von LVM. Was ist in
    seiner Gruppe noch übrig? (man vgs, man lvs, man pvs)
more-room-event-lvm =
    LVM stapelt drei Schichten: physische Volumes (PV, hier das Array
    md1), zu einer Gruppe zusammengefasst (VG labor), aus der logische
    Volumes geschnitten werden (LV photos, eingehängt unter /srv). Die
    Gruppe hat kein einziges freies Extent mehr. Die zwei neuen Platten,
    sdc und sdd, warten: zuerst ein RAID-1-Array mit ihnen, um die
    Sicherheit von zwei Platten zu behalten (man mdadm, --create).
# { $disk }: die einzelne Platte in der Gruppe
more-room-event-only =
    Vorsicht: { $disk } ist so, wie sie ist, ohne RAID, in die Gruppe
    labor gekommen. Wenn diese Platte stirbt, ist alles verloren, was LVM
    darauf gelegt hat, und damit das ganze Fotovolume. Nimm sie aus der
    Gruppe heraus (man vgreduce). Wenn schon Daten darauf liegen, verschieb
    sie zuerst (man pvmove) auf ein Array: Ein Array kann mit einer
    einzigen Platte und einem leeren Platz geboren werden („missing“, man
    mdadm) und seine zweite Platte später bekommen.
# { $array }: das neue Array
more-room-event-array =
    { $array } ist angelegt und schon benutzbar: Seine erste
    Synchronisation (resync, in /proc/mdstat) läuft im Hintergrund. Jetzt
    wird es ein physisches Volume der Gruppe labor (man pvcreate, man
    vgextend).
more-room-event-extended =
    Die Gruppe labor hat Platz: vgs zeigt es (VFree). Das Fotovolume hat
    sich noch nicht bewegt: Vergrößere es (man lvextend).
more-room-event-lv-only =
    Das logische Volume ist gewachsen (lvs), aber df sieht nichts: Das
    Dateisystem darauf hat seine Größe behalten. Es muss auch vergrößert
    werden (man resize2fs; nächstes Mal macht lvextend -r beides).
more-room-event-grown =
    /srv hat Platz für den Winterwettbewerb, weiterhin auf zwei Kopien.
    Bleibt der Bootvorgang: Das neue Array muss in /etc/mdadm/mdadm.conf
    eingetragen werden (seine ARRAY-Zeile: man mdadm, --detail --brief),
    sonst kommt es vielleicht unter einem anderen Namen zurück.
more-room-event-duplicates =
    mdadm.conf beschreibt jetzt ein Array zweimal: mdadm --detail --scan
    gibt auch md0 und md1 aus, die schon da sind. Beim Booten würde mdadm
    sich beschweren. Behalte eine einzige ARRAY-Zeile pro Array (sudo
    nano).
more-room-event-conf =
    Das neue Array steht in mdadm.conf. Aber beim Booten zählt die Kopie
    dieser Datei im initramfs: Bau es neu (man update-initramfs).
more-room-event-end =
    Odile: „3,6 TB mehr? Her mit dem Wettbewerb!“

    Gut gemacht! Du hast Kapitel 3 von „Das Labor“ abgeschlossen. (Was als
    Nächstes kommt, wartet auf dich: ssh labor.)

    WAS PASSIERT IST
    Das Fotovolume (LVM, auf dem Array md1) war voll. Du hast aus den zwei
    neuen Platten ein RAID-1-Array gemacht, es der Volume-Gruppe gegeben,
    dann das logische Volume und sein Dateisystem vergrößert, ohne etwas
    auszuhängen. Zuletzt ist das neue Array in mdadm.conf eingetragen, und
    das initramfs kennt es.

    GUTE PRAXIS
    - Zuerst RAID, LVM obendrauf: Jedes physische Volume muss redundant
      sein; eine einzelne Platte in der Gruppe gefährdet das ganze Volume.
    - lvextend vergrößert nur das Volume: resize2fs (oder lvextend -r) für
      das Dateisystem; ext4 wächst im laufenden Betrieb, schrumpft aber
      nicht im laufenden Betrieb.
    - Ein wenig freien Platz in der Gruppe lassen: Er dient für einen
      Snapshot (lvcreate -s) oder einen Notfall.
    - Nach einem neuen Array: seine ARRAY-Zeile in mdadm.conf, nur einmal,
      dann update-initramfs -u.
    - RAID ersetzt immer noch kein Backup.

    DOKUMENTATION
    - LVM: https://man7.org/linux/man-pages/man8/lvm.8.html
    - lvextend: https://man7.org/linux/man-pages/man8/lvextend.8.html
    - resize2fs: https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - Software-RAID unter Debian: https://wiki.debian.org/SoftwareRAID
