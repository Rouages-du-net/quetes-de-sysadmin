### Geschichte „Windows nebenan“, Kapitel „Die Freigabe nebenan“: die
### SMB-Freigabe eines Windows-Servers unter Linux eingehängt (mount -t
### cifs), ihre Zugangsdaten, ihre Besitzer und ihre Zeile in /etc/fstab.
### Befehle, Optionen, Pfade und Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-smb-mount = Die Freigabe nebenan
    .summary = Plotter soll seine PDFs auf der Freigabe des Windows-Servers ablegen: sie unter Linux mit einer Zugangsdatendatei einhängen, sie für den Dienst beschreibbar machen und die fstab-Zeile schreiben, die einen Boot ohne den Server übersteht.

## Dateien

smb-mount-email-ifeoma =
    Von:  Ifeoma
    An:   dich

    Hallo!

    Plotter, der Dienst auf kompass, der jeden Morgen unsere Zeichnungen
    als PDF exportiert (er läuft als Konto plotter), soll die PDFs auf
    schrank ablegen, in der Freigabe „plans“, Verzeichnis exports: Dort
    suchen alle danach. Bisher hat er sie auf kompass behalten, und wir
    haben sie von Hand kopiert.

    Priya hat ihre Notizen dagelassen (notizen-priya.txt): die Freigabe,
    das Konto, das sie für kompass angelegt hat, das Passwort. Könntest du
    die Freigabe auf kompass einhängen, in /mnt/plans, so dass Plotter
    dort schreiben kann und sie nach einem Neustart von selbst wiederkommt?
    Vorsicht: schrank startet manche Dienstagnächte für Windows Update neu,
    und kompass muss trotzdem booten, wenn schrank in dem Moment weg ist.

    Henrik sagt, bei seinem alten NAS musste er immer vers=1.0 hinzufügen.
    Keine Ahnung, was das heißt.

    Ifeoma

smb-mount-notes-priya =
    Für kompass (Priya, 28. Oktober 2029)

    Dateiserver: schrank.internal (Windows Server 2022)
    Freigabe für kompass: plans  (D:\Shares\plans auf dem Server)
    Konto: compass-svc   Passwort: Ruler-2029-cab
           (ein lokales Konto von schrank; es darf Dateien in plans ändern)
    Die Freigabe hat auch ein Verzeichnis exports, für Plotter.

    SMB1 ist auf schrank deaktiviert, absichtlich. SMB 3 ist in Ordnung.
    Lass dieses Passwort nicht herumliegen, sobald es eingerichtet ist.

## Ereignisse

smb-mount-event-listed =
    Die Freigaben von schrank: plans und scans, und die mit $ am Ende
    (ADMIN$, C$, D$, IPC$), die Windows für seine Admins anlegt. „SMB1
    disabled“: smbclient hat SMB 3 gesprochen, und es gibt kein
    NetBIOS-Browsing. Jetzt statt der einmaligen Sitzung von smbclient ein
    Einhängen: man mount.cifs.
smb-mount-event-helper-missing =
    mount kennt den Typ cifs, aber es braucht seinen Helfer,
    /sbin/mount.cifs, der die Optionen liest, nach dem Passwort fragt und
    den Rest an den Kernel übergibt. Er kommt in einem Paket, das nicht
    installiert ist: cifs-utils.
smb-mount-event-helper =
    cifs-utils ist installiert: mount -t cifs (und mount.cifs) können
    jetzt arbeiten.
smb-mount-event-smb1 =
    „Host is down“: schrank hat nicht mit einer Meldung abgelehnt, es hat
    die Verbindung gekappt. vers=1.0 verlangt SMB1, das Protokoll aus den
    1980ern hinter dem Wurm WannaCry von 2017; Windows Server installiert
    es seit 2019 nicht mehr, und Priya lässt es aus. Henriks altes NAS
    sprach nur SMB1; schrank spricht SMB 3. Lass vers= weg (der Kernel
    wählt das beste) oder verlange vers=3.0 oder 3.1.1.
smb-mount-event-denied =
    „Permission denied“ (Fehler 13): schrank hat das Konto oder das
    Passwort abgelehnt. Prüfe username= und das Passwort (in Priyas
    Notizen), und dass du schrank fragst.
smb-mount-event-password-visible =
    Es funktioniert, aber dieses Passwort steht jetzt in der History deiner
    Shell (history), und solange mount.cifs lief, konnte jeder auf kompass
    es in ps oder /proc/PID/cmdline lesen. Leg das Konto und sein Passwort
    in eine Datei, die nur root liest (man mount.cifs: credentials=), und
    verweise darauf.
smb-mount-event-mounted =
    Die Freigabe ist eingehängt: /mnt/plans ist D:\Shares\plans von
    schrank. Sieh dir an, wem darin was gehört (ls -l), und frag dich, als
    wer Plotter läuft.
smb-mount-event-root-owned =
    Alles in /mnt/plans gehört root, mit den Rechten 755: Plotter (das
    Konto plotter) kann lesen, nicht schreiben. Ein Windows-Server hat
    keine Unix-Besitzer zu vergeben: Der Linux-Client zeigt die aus den
    Optionen des Einhängens, standardmäßig root und 0755. Man wählt sie
    beim Einhängen (man mount.cifs: uid=, gid=, file_mode=, dir_mode=).
smb-mount-event-chown =
    chown und chmod haben nichts gesagt, und nichts hat sich geändert: Auf
    einer Freigabe eines Windows-Servers kommen der angezeigte Besitzer und
    die Rechte aus den Optionen des Einhängens, nicht aus den Dateien.
    Häng neu ein mit uid= und gid= (umount, dann wieder mount).
smb-mount-event-writable =
    plotter kann jetzt in /mnt/plans schreiben: Das Einhängen stellt die
    Freigabe als seine eigene dar. Auf schrank schreibt immer noch
    compass-svc, mit den Rechten dieses Kontos auf der Freigabe.
smb-mount-event-world-readable =
    Diese Zugangsdatendatei können andere als root lesen: Das Passwort von
    compass-svc wäre für jedes Konto auf kompass lesbar. chmod 600, im
    Besitz von root.
smb-mount-event-credentials =
    Die Zugangsdatendatei stimmt: im Besitz von root, rw------- (600), mit
    dem Konto und seinem Passwort, und nichts anderes auf der
    Befehlszeile.
smb-mount-event-no-nofail =
    Ohne nofail wartet ein Boot, während dessen schrank nicht erreichbar
    ist, auf das Einhängen und markiert es als fehlgeschlagen (und was es
    voraussetzt, mit ihm). Mit nofail bootet kompass trotzdem, und mount
    -a hängt es später ein. _netdev sagt, dass es ein Netzwerkdateisystem
    ist: zuerst auf das Netz warten.
smb-mount-event-fstab-password =
    /etc/fstab kann jedes Konto auf kompass lesen: kein Passwort da drin.
    credentials= zeigt auf die Datei, die nur root liest.
smb-mount-event-fstab =
    Die fstab-Zeile stimmt: die Freigabe plans von schrank auf /mnt/plans,
    die Zugangsdatendatei, die Besitzer, die Plotter braucht, _netdev und
    nofail. Probier es aus: umount /mnt/plans, dann mount -a (oder mount
    /mnt/plans).
smb-mount-event-end =
    Ifeoma: „Die PDFs von heute Morgen sind in exports! Und Henrik hat
    gelernt, was vers=1.0 bedeutete. Danke.“

    Gut gemacht! Du hast das Kapitel „Die Freigabe nebenan“
    abgeschlossen.

    WAS PASSIERT IST
    schrank gibt seine Verzeichnisse über SMB frei, das Dateifreigabe-
    Protokoll von Windows. Linux hängt sie mit dem cifs-Client des Kernels
    und seinem Helfer mount.cifs (Paket cifs-utils) ein. Du hast die
    Freigaben mit smbclient aufgelistet, plans mit einer
    Zugangsdatendatei statt einem Passwort auf der Befehlszeile
    eingehängt, den Dateien den Besitzer gegeben, den Plotter brauchte
    (uid=, gid=: Ein Windows-Server hat keine Unix-Besitzer zu zeigen), und
    die fstab-Zeile mit _netdev und nofail geschrieben.

    GUTE PRAXIS
    - Das Passwort in einer Datei von root, Modus 600 (credentials=), nie
      auf einer Befehlszeile (history, ps) noch in /etc/fstab (für alle
      lesbar).
    - Ein für den Server angelegtes Konto (compass-svc), mit nur den
      Rechten, die es auf der Freigabe braucht.
    - uid=, gid=, file_mode=, dir_mode=: Wem die Dateien unter Linux
      gehören, entscheidet sich beim Einhängen; chown und chmod ändern dort
      nichts.
    - Nie vers=1.0: SMB1 ist veraltet und gefährlich; lass den Kernel
      wählen (SMB 3.1.1 mit einem aktuellen Windows) oder verlange
      vers=3.0.
    - In fstab _netdev und nofail für eine Netzwerkfreigabe: Der Boot hängt
      nicht von einer anderen Maschine ab. Teste die Zeile mit umount, dann
      mount -a.

    EIN ANDERER WEG
    x-systemd.automount hängt die Freigabe beim ersten Zugriff ein statt
    beim Booten (und hängt sie wieder ein, wenn schrank später zurückkam).
    Für eine Freigabe, die mehrere Linux-Benutzer mit ihren eigenen
    Windows-Konten erreichen, siehe die Option multiuser und Kerberos
    (sec=krb5) in mount.cifs(8).

    DOKUMENTATION
    - mount.cifs(8): https://manpages.debian.org/mount.cifs.8
    - Der cifs-Client des Kernels: https://www.kernel.org/doc/html/latest/admin-guide/cifs/usage.html
    - SMBv1 unter Windows: https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3
    - systemd.mount, _netdev und nofail: https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
