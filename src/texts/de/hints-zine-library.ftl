### Abgestufte Hinweise für „Die Zine-Bibliothek“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Verweigert

hint-denied-upload-denied =
    .lead = „Permission denied“, obwohl die Rechte stimmen: Etwas anderes verweigert. Der Kernel notiert die Verweigerungen von AppArmor (man journalctl, -k; Barteks Notizen).
    .solution = sudo journalctl -k | grep DENIED (oder sudo dmesg | grep DENIED)
hint-denied-upload-profile =
    .lead = Welches Profil schränkt php-fpm ein, und woher nimmt es die eigenen Regeln der Site? aa-status listet die Profile; lies die Datei des Profils.
    .solution = sudo aa-status; cat /etc/apparmor.d/php-fpm; cat /etc/apparmor.d/local/php-fpm
hint-denied-upload-fixed =
    .lead = Nenn den neuen Ort in der Datei der Site, wie den alten (das Verzeichnis selbst, und was darunter liegt, lesen und schreiben), dann lass den Kernel das Profil neu laden, das sie einbindet (man apparmor_parser).
    .solution = sudo nano /etc/apparmor.d/local/php-fpm: /srv/scans/ r, und /srv/scans/** rw, ; dann sudo apparmor_parser -r /etc/apparmor.d/php-fpm
hint-denied-upload-end =
    .lead = Alles an seinem Platz? Das Profil im Enforce-Modus und php-fpm einschränkend, die Datei des Pakets unangetastet, die Rechte wie vorher, und ein Upload, der durchgegangen ist.
    .solution = sudo aa-status; ls -ld /srv/scans; ls -l /srv/scans; sudo tail -3 /var/log/nginx/access.log

## Kapitel 2 — Ein eigenes Profil

hint-backup-profile-script =
    .lead = Was macht das Backup, und woher nimmt es seine Liste? Lies das Skript und seine Konfiguration.
    .solution = cat /usr/local/sbin/zine-backup; cat /etc/zine-backup.conf
hint-backup-profile-profile-file =
    .lead = Ein erstes Profil für ein Programm lässt sich erzeugen (man aa-autodep): Im Complain-Modus beobachtet es, ohne zu verweigern.
    .solution = sudo aa-autodep /usr/local/sbin/zine-backup; cat /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-observed =
    .lead = Lass den Kernel das Skript bei der Arbeit sehen: Führ das Backup aus, während sein Profil im Complain-Modus ist, dann schau ins Audit-Log.
    .solution = sudo zine-backup; sudo grep ALLOWED /var/log/audit/audit.log
hint-backup-profile-rules =
    .lead = Mach aus den ALLOWED-Zeilen Regeln: aa-logprof fragt nach jeder (Inherit für Programme, Glob für die Dateien eines Verzeichnisses und für das Archiv, Allow), dann speichern. Oder schreib sie von Hand (man apparmor.d).
    .solution = sudo aa-logprof: I für date, tar, gzip; A für die Capability; G bis /srv/backup/*, /srv/scans/** und /var/lib/zinecat/**, dann A; S zum Speichern
hint-backup-profile-enforced =
    .lead = Die Regeln sind geschrieben: Setz das Profil in den Enforce-Modus, in seiner Datei und im Kernel (man aa-enforce).
    .solution = sudo aa-enforce /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-end =
    .lead = Führ das Backup noch einmal aus, eingeschränkt: Es muss gelingen, mit den Scans und dem Katalog, und /etc/shadow muss unerreichbar bleiben (probier, es zu SOURCES hinzuzufügen, dann nimm es wieder heraus).
    .solution = sudo zine-backup; sudo aa-status; sudo grep DENIED /var/log/audit/audit.log
