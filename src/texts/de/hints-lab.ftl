### Die gestuften Hinweise von „Das Labor“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, mit .lead (eine Richtung, ohne den genauen
### Befehl) und .solution (fast die Antwort). Die Ortsnamen sind die von
### names.ftl.

## Kapitel 1 — Die müde Platte

hint-tired-disk-alert =
    .lead = Odile spricht von E-Mails von smartd: Lies sie (man mail, und die Datei deines Postfachs). Der Kernel seinerseits führt Buch über Lesefehler (man dmesg).
    .solution = mail, dann cat /var/mail/du (oder sudo dmesg): sdb hat unlesbare Sektoren.
hint-tired-disk-arrays =
    .lead = Bevor du eine Platte anfasst, schau, wofür sie benutzt wird: Software-RAID zeigt den Zustand seiner Arrays in einer Datei unter /proc (man mdadm).
    .solution = cat /proc/mdstat (oder sudo mdadm --detail /dev/md0): md0 und md1, jedes mit einer Partition von sda und einer von sdb.
hint-tired-disk-smart =
    .lead = Frag sdb nach seiner Gesundheit, vollständig: Identität, Urteil, Attribute (man smartctl). Vergleich dann mit sda.
    .solution = sudo smartctl -a /dev/sdb (Reallocated_Sector_Ct, Current_Pending_Sector), dann sudo smartctl -a /dev/sda.
hint-tired-disk-removed =
    .lead = Jede Partition von sdb muss ihr Array verlassen: zuerst für defekt erklärt, dann entfernt (man mdadm). Es gibt zwei Arrays.
    .solution = sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2, dann dasselbe für /dev/sdb3 in /dev/md1.
hint-tired-disk-ticket =
    .lead = Das Verfahren des Hosters verlangt eine einzige Angabe über die Platte: die, die sich nie ändert, auch wenn sich die Namen sda und sdb ändern (man smartctl, oder man lsblk).
    .solution = sudo smartctl -i /dev/sdb (Serial Number), dann nano ~/ticket.txt: eine Austauschanfrage mit dieser Nummer, und nicht der von sda.
hint-tired-disk-end =
    .lead = Du brauchst alles zugleich: nichts mehr von sdb in den Arrays, sda in beiden noch aktiv, und ein Ticket, das nur die Seriennummer von sdb nennt.
    .solution = cat /proc/mdstat ([U_] für md0 und md1, ohne sdb) und cat ~/ticket.txt (nur die Nummer von sdb).

## Kapitel 2 — Die neue Platte

hint-new-disk-new =
    .lead = Schau dir die Platten und ihre Partitionen an: Was wurde anstelle der alten sdb geliefert? (man lsblk)
    .solution = lsblk: sdb hat keine Partition; cat /proc/mdstat: Die Arrays sind [U_].
hint-new-disk-table =
    .lead = Die neue Platte muss genau wie sda aufgeteilt werden: sfdisk kann die Tabelle einer Platte als Skript schreiben, und ein anderes sfdisk kann sie wieder einlesen (man sfdisk). Achte auf die Richtung.
    .solution = sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (dann lsblk zum Prüfen).
hint-new-disk-added =
    .lead = Jede neue Partition kommt in das Array ihres Zwillings auf sda (man mdadm, ein Mitglied hinzufügen).
    .solution = sudo mdadm --manage /dev/md0 --add /dev/sdb2, dann sudo mdadm --manage /dev/md1 --add /dev/sdb3.
hint-new-disk-rebuilt =
    .lead = Der Neuaufbau braucht Zeit: Verfolg ihn in der Datei, die den Zustand der Arrays zeigt, bis sie vollständig sind.
    .solution = cat /proc/mdstat, mehrmals, bis [UU] für md0 und md1.
hint-new-disk-grub =
    .lead = Der Server muss von der neuen Platte booten können: Der Bootloader wird auf die ganze Platte installiert (man grub-install).
    .solution = sudo grub-install /dev/sdb
hint-new-disk-end =
    .lead = Du brauchst alles zugleich: sdb wie sda aufgeteilt, beide Arrays vollständig und aktuell, und GRUB auf sdb.
    .solution = lsblk, cat /proc/mdstat (überall [UU]), sudo grub-install /dev/sdb, falls noch nicht geschehen.

## Kapitel 3 — Der Platz wird knapp

hint-more-room-full =
    .lead = Schau dir an, wie voll die Dateisysteme sind (man df): Welches ist voll, und auf welchem Gerät?
    .solution = df -h: /srv, auf /dev/mapper/labor-photos, ist zu 97 % voll.
hint-more-room-lvm =
    .lead = /srv ist ein logisches Volume von LVM: Schau dir seine drei Schichten an, physische Volumes, Gruppen und logische Volumes (man pvs, man vgs, man lvs).
    .solution = sudo vgs (VFree bei 0), sudo pvs (md1 allein), sudo lvs; dann lsblk: sdc und sdd sind neu.
hint-more-room-array =
    .lead = Bevor du die neuen Platten LVM gibst, mach aus ihnen ein RAID-1-Array, um zwei Kopien zu behalten (man mdadm, ein Array anlegen).
    .solution = sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd, dann y zum Bestätigen.
hint-more-room-extended =
    .lead = Das neue Array muss ein physisches Volume werden und dann in die Gruppe labor kommen (man pvcreate, man vgextend).
    .solution = sudo pvcreate /dev/md2, dann sudo vgextend labor /dev/md2 (sudo vgs: VFree ist gewachsen).
hint-more-room-grown =
    .lead = Vergrößere das logische Volume photos, dann das Dateisystem darauf (man lvextend, man resize2fs).
    .solution = sudo lvextend -r -l +100%FREE /dev/labor/photos (oder lvextend ohne -r, dann sudo resize2fs /dev/labor/photos); df -h /srv zum Prüfen.
hint-more-room-conf =
    .lead = Das neue Array muss in /etc/mdadm/mdadm.conf eingetragen werden, nur einmal: mdadm kann seine ARRAY-Zeile schreiben (man mdadm). Vorsicht, die Datei gehört root.
    .solution = sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf
hint-more-room-end =
    .lead = Der Bootvorgang liest eine Kopie von mdadm.conf, die im initramfs liegt: Bau es neu (man update-initramfs). Du brauchst auch mindestens 1,5 TB frei auf /srv, und keine einzelne Platte in der Gruppe.
    .solution = sudo update-initramfs -u

## Kapitel 4 — Der hängende Neustart

hint-stuck-boot-journal =
    .lead = Die Meldung des Notfallmodus sagt, wo du suchen sollst: das Journal dieses Bootvorgangs, mit seinen Erklärungen (man journalctl).
    .solution = journalctl -xb (oder journalctl -b -p err): „Timed out waiting for device /dev/sdc1“.
hint-stuck-boot-disks =
    .lead = Wer ist heute sdc, und wohin ist die USB-Platte verschwunden? Schau dir die Platten mit ihren Dateisystemen, Labels und UUIDs an (man lsblk, man blkid).
    .solution = lsblk -f (oder blkid): sdc ist in md2; die USB-Platte ist sde, ihre Partition sde1 trägt das Label SCANS und eine UUID.
hint-stuck-boot-fixed =
    .lead = In /etc/fstab muss die Zeile der Scans die Platte über das benennen, was sich nicht ändert, und den Bootvorgang nicht blockieren, wenn sie fehlt (man fstab: UUID=, nofail).
    .solution = nano /etc/fstab: UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults,nofail  0  2 (die UUID aus blkid), dann findmnt --verify.
hint-stuck-boot-mounted =
    .lead = Probier fstab aus, ohne neu zu starten: mount kann alles einhängen, was die Datei beschreibt (man mount). Und systemd muss die Datei neu lesen (man systemctl).
    .solution = systemctl daemon-reload, dann mount -a, dann df -h /srv/scans.
hint-stuck-boot-end =
    .lead = Bleibt, den Notfallmodus zu verlassen: Setz den normalen Bootvorgang fort, wie die Meldung der Konsole sagt (man systemctl).
    .solution = systemctl default (oder exit, oder reboot)
