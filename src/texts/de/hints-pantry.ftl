### Abgestufte Hinweise für Die Vorratskammer (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine
### Richtung, ohne den genauen Befehl) und .solution (fast die Antwort).
### Die Ortsnamen sind die aus names.ftl.

## Kapitel 1 — Die verlorene Platte

hint-lost-disk-disk =
    .lead = Finde die Backup-Platte unter den Platten des Servers: Welche ist eine Wechselplatte, welches Dateisystem trägt sie, wo ist sie eingehängt (man lsblk)?
    .solution = lsblk, dann lsblk -f: sdb1, ext4 mit dem Label OFFSITE, eingehängt auf /mnt/offsite.
hint-lost-disk-unmounted =
    .lead = Ein Gerät lässt sich nicht verschlüsseln, solange es eingehängt ist (man umount).
    .solution = sudo umount /mnt/offsite
hint-lost-disk-formatted =
    .lead = LUKS richtet man mit cryptsetup ein: Seine Aktion, die einen neuen Header auf ein Gerät schreibt, verlangt YES in Großbuchstaben, dann zweimal eine Passphrase. Meis Passphrase steht in ihrer Notiz (man cryptsetup).
    .solution = sudo cryptsetup luksFormat /dev/sdb1, dann YES, dann zweimal Meis Passphrase.
hint-lost-disk-filesystem =
    .lead = Das verschlüsselte Gerät muss unter einem Namen geöffnet werden, und das Dateisystem kommt auf das Klartext-Gerät, das in /dev/mapper erscheint (man cryptsetup, man mkfs.ext4).
    .solution = sudo cryptsetup open /dev/sdb1 offsite (Meis Passphrase), dann sudo mkfs.ext4 /dev/mapper/offsite.
hint-lost-disk-keyfile =
    .lead = Der nächtliche Job braucht eine Schlüsseldatei: zufällige Bytes (dd liest /dev/urandom), nur für root lesbar, dann in einem anderen Schlüsselplatz hinzugefügt (man dd, man chmod, man cryptsetup luksAddKey).
    .solution = sudo dd if=/dev/urandom of=/root/offsite.key bs=512 count=8, sudo chmod 400 /root/offsite.key, sudo cryptsetup luksAddKey /dev/sdb1 /root/offsite.key (Meis Passphrase).
hint-lost-disk-passphrase =
    .lead = Ein Platz muss sich mit der Passphrase öffnen lassen, die Mei im Passwortmanager aufbewahrt: die aus ihrer Notiz (man cryptsetup luksAddKey).
    .solution = sudo cryptsetup luksAddKey /dev/sdb1 --key-file /root/offsite.key, dann zweimal Meis Passphrase.
hint-lost-disk-crypttab =
    .lead = /etc/crypttab nennt die Platte: den Namen des Mappings, seine LUKS-UUID, die Schlüsseldatei und Optionen für eine Wechselplatte (man crypttab; die UUID: cryptsetup luksUUID oder blkid).
    .solution = sudo nano /etc/crypttab, hinzufügen: offsite UUID=<die UUID von sdb1> /root/offsite.key luks,noauto
hint-lost-disk-fstab =
    .lead = Die alte fstab-Zeile hängt ein Label ein, das es nicht mehr gibt: Sie sollte stattdessen das geöffnete Gerät einhängen, ohne den Boot warten zu lassen (man fstab).
    .solution = sudo nano /etc/fstab, die Zeile LABEL=OFFSITE ersetzen durch: /dev/mapper/offsite /mnt/offsite ext4 noauto,nofail 0 2
hint-lost-disk-copied =
    .lead = Die Platte ist leer: Öffne sie, häng sie ein und kopier die Dateien der Vorratskammer aus /srv darauf (man cryptdisks_start, man rsync).
    .solution = sudo cryptdisks_start offsite (wenn geschlossen), sudo mount /mnt/offsite, sudo rsync -a /srv/vorratskammer /mnt/offsite/
hint-lost-disk-closed =
    .lead = Bevor die Platte geht: aushängen, dann das verschlüsselte Gerät schließen (man umount, man cryptsetup close oder man cryptdisks_stop).
    .solution = cd (raus aus /mnt/offsite), sudo umount /mnt/offsite, sudo cryptsetup close offsite
hint-lost-disk-note =
    .lead = Meis Passphrase hat auf dem Server nichts zu suchen, sobald sie in einem Platz steht.
    .solution = rm notiz_von_mei.txt
hint-lost-disk-end =
    .lead = Alles auf einmal: LUKS mit Meis Passphrase und einer Schlüsseldatei, die nur root liest, crypttab (UUID, noauto) und fstab, die Dateien auf der Platte, die Platte geschlossen, die Notiz gelöscht.
    .solution = sudo cryptsetup luksDump /dev/sdb1 (zwei Plätze), cat /etc/crypttab /etc/fstab, sudo ls -l /root, lsblk (nichts offen unter sdb1), ls (keine Notiz).

## Kapitel 2 — Der Zweitschlüssel

hint-spare-key-opened =
    .lead = Die Platte ist geschlossen: Öffne sie so, wie crypttab sie beschreibt, und häng sie dann ein wie fstab (man cryptdisks_start).
    .solution = sudo cryptdisks_start offsite, dann sudo mount /mnt/offsite.
hint-spare-key-job =
    .lead = Lies den nächtlichen Job: Wie sagt er restic, wo das Repository ist und wo das Passwort?
    .solution = sudo cat /usr/local/sbin/nightly-backup: RESTIC_REPOSITORY=/mnt/offsite/restic, RESTIC_PASSWORD_FILE=/root/.restic-pass.
hint-spare-key-snapshots =
    .lead = Liste die Snapshots des Repositorys auf, als root, mit dem Repository und der Passwortdatei, die der Job benutzt (man restic; sudo setzt die Umgebung zurück).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass snapshots (oder sudo RESTIC_REPOSITORY=… RESTIC_PASSWORD_FILE=… restic snapshots).
hint-spare-key-one-key =
    .lead = restic hat einen Befehl für die Schlüssel, die ein Repository öffnen (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key list: ein Schlüssel, sein Passwort nur auf kiste.
hint-spare-key-escrowed =
    .lead = Füg einen Weg hinein hinzu, dessen Passwort Mei aufbewahrt: das aus ihrer Notiz. Behalte den Schlüssel des Jobs (man restic, key add).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key add, dann zweimal Meis Passwort.
hint-spare-key-checked =
    .lead = Prüfe das Repository, nachdem du seine Schlüssel geändert hast (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass check
hint-spare-key-note =
    .lead = Meis Passwort muss außerhalb des Servers leben.
    .solution = rm notiz_von_mei.txt
hint-spare-key-closed =
    .lead = Lass die Platte so, wie du sie gefunden hast: ausgehängt und geschlossen (man cryptdisks_stop).
    .solution = sudo umount /mnt/offsite, dann sudo cryptdisks_stop offsite.
hint-spare-key-end =
    .lead = Alles auf einmal: zwei Schlüssel (der des Jobs und der von Mei), ein check nach dem Hinzufügen ihres, keine Kopie ihres Passworts auf kiste, die Platte geschlossen.
    .solution = key list (zwei Schlüssel), check, rm auf die Notiz, umount, cryptdisks_stop.

## Kapitel 3 — Die Wiederherstellungsübung

hint-restore-drill-plugged =
    .lead = Die Übung findet auf dem geliehenen Laptop statt: Verbinde dich mit ihm und finde dann die Platte und ihren Typ (man ssh, man lsblk).
    .solution = ssh ersatz, dann lsblk -f: sdb1 crypto_LUKS.
hint-restore-drill-opened =
    .lead = Öffne die verschlüsselte Platte mit der Passphrase aus Fatous Nachricht, der aus dem Umschlag (man cryptsetup open).
    .solution = sudo cryptsetup open /dev/sdb1 offsite, dann die Passphrase der Platte.
hint-restore-drill-mounted =
    .lead = Häng das geöffnete Gerät auf ein leeres Verzeichnis deiner Wahl ein (man mkdir, man mount).
    .solution = sudo mkdir /mnt/offsite, dann sudo mount /dev/mapper/offsite /mnt/offsite.
hint-restore-drill-snapshots =
    .lead = Öffne das Repository mit dem restic-Passwort aus dem Umschlag, eingetippt, wenn restic danach fragt (man restic).
    .solution = sudo restic -r /mnt/offsite/restic snapshots, dann das Wiederherstellungspasswort für restic.
hint-restore-drill-read-data =
    .lead = Prüfe das Repository und lies dabei jedes Byte seiner Daten zurück, nicht nur seine Struktur (man restic, check).
    .solution = sudo restic -r /mnt/offsite/restic check --read-data
hint-restore-drill-restored =
    .lead = Stell den letzten Snapshot daneben wieder her, unter einem Verzeichnis deiner Wahl (man restic, restore).
    .solution = sudo restic -r /mnt/offsite/restic restore latest --target /srv/restore
hint-restore-drill-verified =
    .lead = Der Job hat die Fingerabdrücke der Dateien in SHA256SUMS geschrieben: Prüfe sie aus dem Verzeichnis, in das wiederhergestellt wurde (man sha256sum).
    .solution = cd /srv/restore/srv/vorratskammer, dann sha256sum -c SHA256SUMS.
hint-restore-drill-no-dump =
    .lead = Zeile 6 der Checkliste: Such den Dump der Datenbank in den Backups (man restic, find).
    .solution = sudo restic -r /mnt/offsite/restic find pantry.sql: nichts.
hint-restore-drill-fixed =
    .lead = Auf kiste muss der Job auch den Dump sichern: Seine Zeile restic backup nennt nur ein Verzeichnis.
    .solution = exit (zurück auf kiste), sudo nano /usr/local/sbin/nightly-backup: restic backup /srv/vorratskammer /var/backups/pantry.sql
hint-restore-drill-closed =
    .lead = Lass die Platte auf ersatz ausgehängt und geschlossen (man umount, man cryptsetup close).
    .solution = ssh ersatz, cd, sudo umount /mnt/offsite, sudo cryptsetup close offsite.
hint-restore-drill-end =
    .lead = Alles auf einmal: auf ersatz die Platte mit der Passphrase geöffnet, das Repository mit dem Passwort aus dem Umschlag, check --read-data, die Dateien wiederhergestellt und geprüft, nichts von kiste kopiert, die Platte geschlossen; auf kiste sichert der Job den Dump.
    .solution = Hol auf ersatz nach, was fehlt (ssh ersatz), und prüfe /usr/local/sbin/nightly-backup auf kiste.
