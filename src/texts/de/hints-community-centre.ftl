### Abgestufte Hinweise für „Das Bürgerhaus“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort). Jeder
### Hinweis sagt, wo getippt wird: auf deinem Rechner, auf buergerhaus (dem
### Gateway) oder auf einer internen Maschine (wiki).

## Kapitel 1 — Die Schlüssel

hint-keys-copied =
    .lead = Ein Schlüsselpaar wird auf DEINEM Rechner erstellt, nie auf dem Server (man ssh-keygen). Dann kommt seine öffentliche Hälfte nach ~/.ssh/authorized_keys auf buergerhaus (man ssh-copy-id).
    .solution = Auf deinem Rechner: ssh-keygen (Eingabetaste, um den Pfad zu übernehmen, Passphrase nach Wahl), dann ssh-copy-id buergerhaus (vorläufiges Passwort: flieder-2027).
hint-keys-by-key =
    .lead = Dein öffentlicher Schlüssel ist eingerichtet: Melde dich neu an, ssh sollte nicht mehr nach dem Passwort des Kontos fragen.
    .solution = Wenn du auf buergerhaus bist: exit; dann auf deinem Rechner: ssh buergerhaus
hint-keys-closed =
    .lead = Auf buergerhaus entscheidet der SSH-Server, ob er Passwörter akzeptiert: Such PasswordAuthentication in /etc/ssh/sshd_config (man sshd_config). Prüf die Syntax vor dem Neuladen.
    .solution = Auf buergerhaus: sudo nano /etc/ssh/sshd_config, die Zeile #PasswordAuthentication yes wird zu PasswordAuthentication no; dann sudo sshd -t und sudo systemctl reload ssh.
hint-keys-end =
    .lead = Bevor du gehst, prüf, ob du noch hereinkommst, mit dem Schlüssel, jetzt wo Passwörter verweigert werden.
    .solution = Auf buergerhaus: exit; dann auf deinem Rechner: ssh buergerhaus

## Kapitel 2 — Der Sprung

hint-jump-to-wiki =
    .lead = Das Wiki ist nur von buergerhaus aus erreichbar, aber dein privater Schlüssel muss auf deinem Rechner bleiben: ssh kann über eine Maschine springen (man ssh, Option -J).
    .solution = Auf deinem Rechner: ssh -J buergerhaus wiki (für jede der beiden Maschinen mit yes antworten).
hint-jump-shortcut =
    .lead = Damit ein einfaches „ssh wiki“ reicht, schreib den Weg ein für alle Mal in ~/.ssh/config, auf deinem Rechner (man ssh_config, Host und ProxyJump).
    .solution = Auf deinem Rechner: nano ~/.ssh/config, und einen Block Host wiki ergänzen, darunter HostName wiki, User du und ProxyJump buergerhaus.
hint-jump-end =
    .lead = Die Abkürzung und der Sprung reichen: Auf dem Gateway darf kein privater Schlüssel bleiben.
    .solution = Auf deinem Rechner: ssh wiki. Wenn du deinen privaten Schlüssel auf buergerhaus kopiert hattest, lösch ihn dort: rm ~/.ssh/id_ed25519

## Kapitel 3 — Der Tunnel

hint-tunnel-approved =
    .lead = Die Admin-Seite lauscht nur auf 127.0.0.1:8080 DES WIKIS: Ein ssh-Tunnel trägt einen Port deines Rechners bis dorthin (man ssh, -L, und -f -N, damit er offen bleibt). Dann liest curl, von deinem Rechner aus, die Seite und ihre Adressen.
    .solution = Auf deinem Rechner: ssh -f -N -L 8080:localhost:8080 wiki (oder mit -J buergerhaus), curl localhost:8080/admin, dann curl localhost:8080/admin/freigeben/samir und curl localhost:8080/admin/freigeben/lea (nicht promo-casino).
hint-tunnel-end =
    .lead = Der Tunnel läuft noch im Hintergrund auf deinem Rechner: Finde seinen Prozess und stopp ihn dann.
    .solution = Auf deinem Rechner: ps (die Zeile ssh -f -N -L…), dann kill, gefolgt von seiner PID.

## Kapitel 4 — Die Übertragungen

hint-transfers-report =
    .lead = scp kopiert eine Datei zwischen Maschinen, wie cp, wobei vor dem entfernten Pfad der Name der Maschine steht; die Abkürzung zum Wiki in ~/.ssh/config funktioniert auch dafür (man scp).
    .solution = Auf deinem Rechner: scp wiki:/srv/wiki/exports/bericht-2027.pdf .
hint-transfers-backup =
    .lead = Das Backup läuft von buergerhaus nach archives, mit rsync (man rsync). Achte auf den Schrägstrich am Ende der Quelle: Mit ihm kopiert rsync den INHALT des Verzeichnisses. Mach zuerst einen Probelauf, mit -n.
    .solution = Auf buergerhaus: rsync -av /srv/freigabe/ archives:/srv/sicherungen/freigabe/ (--delete ergänzen, wenn auf der anderen Seite ein zusätzliches Verzeichnis freigabe aufgetaucht ist).
hint-transfers-end =
    .lead = Du brauchst beides: den Bericht, unversehrt, auf deinem Rechner, und auf archives ein Backup, das mit /srv/freigabe identisch ist, ohne verschachteltes Verzeichnis.
    .solution = Auf deinem Rechner: scp wiki:/srv/wiki/exports/bericht-2027.pdf . ; auf buergerhaus: rsync -av --delete /srv/freigabe/ archives:/srv/sicherungen/freigabe/

## Kapitel 5 — Der Webhoster

hint-web-host-end =
    .lead = Hol zuerst /srv/wiki/site auf deinen Rechner, über SSH (man sftp, get -r). Dann veröffentliche es mit lftp unter dem Namen, den das Zertifikat des Hosters abdeckt (email_hoster.txt, auf buergerhaus), nach public_html: mirror -R schickt zum Hosting, --delete entfernt, was nicht mehr in der Website ist (man lftp).
    .solution = Auf deinem Rechner: sftp wiki, get -r /srv/wiki/site, bye; dann lftp -u buergerhaus ftp.hosting.example (Passwort in email_yasmine.txt, auf buergerhaus), mirror -R --delete site public_html, bye.
