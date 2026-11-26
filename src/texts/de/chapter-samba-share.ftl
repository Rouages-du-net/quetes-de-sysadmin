### Geschichte „Der Fotoclub“, Kapitel 3 „Die Laptops“: eine
### Samba-Freigabe (smb.conf, testparm, smbpasswd, Masken, smbclient).
### Konfiguration, Pfade und die Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-samba-share = Die Laptops
    .summary = Die Windows-Laptops der Mitglieder sollen die Fotos auch öffnen, über das WLAN des Clubs. Eine Samba-Freigabe nur für den Club, in der ein Foto, das ein Mitglied hinzufügt, von den anderen nachbearbeitet werden kann.

## Dateien

samba-share-message-margot =
    Von:     Margot
    An:      dich
    Betreff: Und unsere Laptops?

    Hallo,

    Der Rechner in der Dunkelkammer wirkt Wunder. Jetzt möchten Sam und
    Nora die Fotos von ihren Laptops (Windows) aus öffnen, über das WLAN
    des Clubs (192.0.2.0/24). Samba ist auf dem NAS installiert (smbd
    läuft), teilt aber noch nichts.

    - Eine Freigabe „photos“ mit /srv/photos, nur für die Mitglieder des
      Clubs. Tom hat den Club verlassen: Er behält sein Konto auf dem NAS
      für seine alten Dateien, aber keinen Zugang zur Freigabe.
    - Ein Foto, das ein Mitglied hinzufügt, muss von den anderen
      nachbearbeitet werden können.
    - Kein Gastzugang, natürlich.

    Gleiches sudo-Passwort: verschluss-2028. Für die Tests ist das
    Laptop-Passwort von Sam negativ-2028, das von Nora dia-2028 (sie
    werden sie ändern).

    Margot

## Ereignisse

samba-share-event-share =
    Eine Freigabe liefert /srv/photos aus. testparm prüft smb.conf (sudo
    testparm -s), smbclient probiert sie von hier aus: smbclient
    //localhost/photos -U sam -c "ls". smbd liest smb.conf bei jeder neuen
    Verbindung: Für eine Freigabe ist kein Neustart nötig.
samba-share-event-unknown =
    testparm kennt einen der Parameter nicht: Er wird ignoriert, als wäre
    er nicht da. Prüf seine Schreibweise in man smb.conf (valid users,
    read only, create mask…).
samba-share-event-logon-failure =
    Samba lehnt die Anmeldung ab: Es führt seine eigenen Passwörter,
    getrennt von denen unter Unix (man smbpasswd: -a). Jedes Mitglied
    braucht eins: sudo smbpasswd -a sam.
samba-share-event-read-only =
    Die Freigabe ist nur lesbar: Das ist der Standard von Samba. read only
    = no (oder writable = yes) im Abschnitt der Freigabe.
samba-share-event-guest =
    guest ok = yes lässt jede Person im WLAN herein, ohne Passwort (als
    nobody). Der Club wollte das Gegenteil: Entferne es, und liste auf,
    wer hinein darf (valid users = @club).
samba-share-event-tom =
    Jedes Konto des NAS kann in diese Freigabe, Tom eingeschlossen, sobald
    er ein Samba-Passwort hat. valid users = @club behält die Freigabe den
    Mitgliedern der Gruppe vor.
samba-share-event-passwords =
    Sam und Nora können sich anmelden. Probier, als Sam ein Foto
    hinzuzufügen (smbclient … -c "put /tmp/contact-sheet.jpg sheet.jpg"),
    und schau dir dann seine Rechte auf dem NAS an: Könnte Nora es
    nachbearbeiten?
samba-share-event-masks =
    Schau dir die Rechte der neuen Datei an (ls -l): Standardmäßig legt
    Samba Dateien mit rw-r--r-- an (create mask = 0744), und nur wer sie
    angelegt hat, kann sie ändern. Für den Club: create mask = 0664 und
    directory mask = 2775 (und die Dateien müssen der Gruppe club gehören:
    force group = club, oder das setgid von /srv/photos).
samba-share-event-firewall =
    Die Freigabe ist bereit, aber die Laptops sind im WLAN, und die
    Firewall des NAS lässt nur SSH und NFS herein: SMB benutzt Port 445
    (ufw kennt die Anwendung „Samba“). Öffne ihn nur für das Netz des
    Clubs.
samba-share-event-end =
    Die Laptops öffnen \\nas\photos mit dem Samba-Passwort jedes Mitglieds;
    Tom und die Gäste bleiben draußen, und ein Foto, das eine Person
    hinzufügt, können die anderen nachbearbeiten. Margot: „Nora hat Sams
    Reiher nachbearbeitet. Er ist begeistert. Größtenteils.“

    Gut gemacht! Du hast das Kapitel „Die Laptops“ abgeschlossen.

    WAS PASSIERT IST
    Samba war installiert, teilte aber nichts. Eine Freigabe für die
    Gruppe des Clubs, Samba-Passwörter für ihre Mitglieder, Masken, damit
    die Gruppe schreiben kann, und die Firewall für das Netz des Clubs
    geöffnet.

    EINE SAMBA-FREIGABE
    - In /etc/samba/smb.conf: [photos], path = /srv/photos, read only =
      no, valid users = @club, create mask = 0664, directory mask = 2775,
      force group = club.
    - testparm -s nach jeder Änderung; smbd liest die Datei bei jeder
      neuen Verbindung.
    - smbpasswd -a NAME: das eigene Passwort von Samba; pdbedit -L listet
      sie auf.
    - smbclient //server/freigabe -U NAME -c "ls" zum Ausprobieren.

    GUTE PRAXIS
    - Kein guest ok auf einer Freigabe mit persönlichen Dateien.
    - Die Linux-Rechte gelten auch unter Samba: Die Masken und die Gruppe
      entscheiden, wer was ändern kann.
    - SMB nur im lokalen Netz (445), nie zum Internet hin offen.

    DOKUMENTATION
    - smb.conf(5): https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html
    - smbpasswd(8): https://www.samba.org/samba/docs/current/man-html/smbpasswd.8.html
    - Debian: https://wiki.debian.org/Samba/ServerSimple
