### Die gestuften Hinweise der Geschichte „Der Fotoclub“: eine Spur, dann
### fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Das geteilte Verzeichnis

hint-nfs-export-exports =
    .lead = Was teilt das NAS über NFS, und mit wem? (/etc/exports, man exports)
    .solution = In /etc/exports: /srv/photos  192.0.2.32(rw,sync,no_subtree_check)
hint-nfs-export-loaded =
    .lead = Die Datei wird gelesen, wenn der Server startet, oder auf Anfrage (man exportfs: -r, -a, -v).
    .solution = sudo exportfs -ra, dann sudo exportfs -v.
hint-nfs-export-firewall =
    .lead = Kommt NFS durch die Firewall des NAS? (man ufw; NFSv4: Port 2049)
    .solution = sudo ufw allow from 192.0.2.32 to any port 2049 proto tcp
hint-nfs-export-mounted =
    .lead = Auf dem Rechner in der Dunkelkammer (ssh darkroom): ein Einhängepunkt, dann mount (man mount, man nfs).
    .solution = sudo mkdir /mnt/photos, dann sudo mount -t nfs nas.internal:/srv/photos /mnt/photos
hint-nfs-export-end =
    .lead = Damit es nach einem Neustart zurückkommt: /etc/fstab auf dem Rechner in der Dunkelkammer (man fstab).
    .solution = nas.internal:/srv/photos  /mnt/photos  nfs  defaults,_netdev  0  0 (sudo mount -a zum Prüfen)

## Kapitel 2 — Wem gehören die Dateien?

hint-nfs-owners-numbers =
    .lead = Wer ist wer, in Nummern, auf jeder Maschine? (man id, man ls: -n)
    .solution = id sam auf dem NAS (1002) und auf dem Rechner in der Dunkelkammer (1001); 1001 ist auf dem NAS nora.
hint-nfs-owners-squash =
    .lead = Warum hilft sudo auf dem Rechner in der Dunkelkammer nicht? (man exports: root_squash)
    .solution = root wird auf dem NAS zu nobody: Das ist root_squash, behalte es.
hint-nfs-owners-uid =
    .lead = Gib Sam auf dem Rechner in der Dunkelkammer die Nummer des NAS (man usermod: -u); seine Sitzung muss vorher geschlossen sein.
    .solution = Auf darkroom: sudo pkill -u sam, dann sudo usermod -u 1002 sam.
hint-nfs-owners-end =
    .lead = Die vorher kopierten Scans tragen auf dem NAS noch Noras Nummer (man chown: -R).
    .solution = Auf dem NAS: sudo chown -R sam:club /srv/photos/2028-film-scans

## Kapitel 3 — Die Laptops

hint-samba-share-share =
    .lead = Eine Freigabe ist ein Abschnitt von smb.conf (man smb.conf: path, read only, valid users).
    .solution = In /etc/samba/smb.conf: [photos], path = /srv/photos, read only = no, valid users = @club; dann sudo testparm -s.
hint-samba-share-passwords =
    .lead = Samba hat seine eigenen Passwörter (man smbpasswd: -a).
    .solution = sudo smbpasswd -a sam (negativ-2028), sudo smbpasswd -a nora (dia-2028).
hint-samba-share-masks =
    .lead = Mit welchen Rechten legt Samba Dateien an? (man smb.conf: create mask, directory mask, force group)
    .solution = create mask = 0664, directory mask = 2775, force group = club in [photos].
hint-samba-share-end =
    .lead = Und die Laptops im WLAN: Kommt SMB durch die Firewall? (man ufw; Port 445, Anwendung Samba)
    .solution = sudo ufw allow from 192.0.2.0/24 to any app Samba
