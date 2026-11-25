### Geschichte „Das Bürgerhaus“, Kapitel „Der Webhoster“: sftp, dann eine
### Website bei einem Shared Hoster über FTPS mit lftp veröffentlichen.
### Befehle, Maschinennamen, Pfade und HTML werden nicht übersetzt (der
### Text der Seiten schon).

chapter-web-host = Der Webhoster
    .summary = Die neue Website liegt fertig im Wiki: mit sftp holen, dann beim Webhoster veröffentlichen, der kein reines FTP mehr annimmt. FTPS, der richtige Servername, und nichts Altes, das herumliegt.

## Dateien

# { $account }: das FTP-Konto beim Webhoster; { $password }: sein Passwort
web-host-email-yasmine =
    Von:     Yasmine
    An:      dich
    Betreff: Die neue Website

    Die neue Website des Bürgerhauses ist fertig! Sie liegt im Wiki, in
    /srv/wiki/site. Sie muss bei unserem Webhoster online gehen, und vor
    allem muss die Preisseite von 2025 weg, diese Preise sind veraltet.

    Gaspard hat das gemacht, mit FileZilla; seine Notizen stehen in
    notes-gaspard.txt. Aber der Webhoster hat uns geschrieben
    (email_hoster.txt): Seit dem 1. März kein reines FTP mehr.

    Seine Zugangsdaten, die mir der Webhoster noch einmal geschickt hat:
        Konto        : { $account }
        Passwort     : { $password }

    Ins Wiki kommst du wie gewohnt von deinem Rechner aus (die Abkürzung
    ssh wiki); um zu schauen, bevor du etwas holst: man sftp. Für den
    Webhoster, der nur FTP anbietet: man lftp, auf deinem Rechner
    installiert.

web-host-email-host =
    Von:     Support des Webhosters <support@hosting.example>
    Betreff: Ende des unverschlüsselten FTP am 1. März

    Guten Tag,

    um Ihre Zugangsdaten zu schützen, lehnen unsere Server ab sofort
    unverschlüsselte FTP-Verbindungen ab. Benutzen Sie FTPS (explizites
    FTP über TLS, Port 21): Die meisten Clients tun das standardmäßig.

    Server: ftp.hosting.example
    Unser Zertifikat ist für *.hosting.example ausgestellt: Verbinden Sie
    sich über diesen Namen, damit es erkannt wird. Schalten Sie die
    Prüfung der Zertifikate niemals ab.

    Ihre Website liegt im Verzeichnis public_html Ihres Kontos.

    Das Technik-Team

web-host-notes-gaspard =
    GASPARDS NOTIZEN — die Website veröffentlichen

    FileZilla:
      Server       : ftp.community.example
      Port         : 21
      Verschlüsselung: „Nur unverschlüsseltes FTP verwenden (unsicher)“
                     (mit Verschlüsselung bekam ich einen
                     Zertifikatsfehler, also habe ich sie abgeschaltet)
      Verzeichnis  : public_html

    Ich ziehe die Dateien von einer Seite auf die andere. Die alten Dateien
    lasse ich dort, man weiß ja nie.

## Die Website

web-host-old-index =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Bürgerhaus</title></head>
    <body><h1>Bürgerhaus</h1>
    <p>Willkommen! Sieh dir den Kalender und die Preise 2025 an.</p></body></html>
web-host-old-agenda =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Kalender</title></head>
    <body><h1>Kalender 2025</h1><p>Nachbarschaftsfest: 23. Mai 2025.</p></body></html>
web-host-old-prices =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Preise 2025</title></head>
    <body><h1>Preise 2025</h1><p>Raummiete: 15 € pro Stunde.</p></body></html>
web-host-index =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Bürgerhaus</title>
    <link rel="stylesheet" href="style.css"></head>
    <body><header><img src="images/logo.svg" alt="" width="48"><h1>Bürgerhaus</h1></header>
    <p>Willkommen! Der Kalender der Aktivitäten und die Mitgliedschaft sind online.</p>
    <p><a href="agenda.html">Kalender</a> · <a href="mitgliedschaft.html">Mitglied werden</a></p></body></html>
web-host-agenda =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Kalender</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Kalender 2028</h1><p>Mitgliederversammlung: 12. April. Nachbarschaftsfest: 26. Mai.</p></body></html>
web-host-membership =
    <!doctype html>
    <html lang="de"><head><meta charset="utf-8"><title>Mitglied werden</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Mitglied werden</h1><p>Der Beitrag ist frei wählbar, am Empfang oder per E-Mail.</p></body></html>

## Ereignisse

web-host-event-clear =
    Der Webhoster lehnt ab: kein reines FTP mehr, wie angekündigt. Und
    das ist gut so: Bei reinem FTP reist das Passwort des Kontos im
    Klartext durchs Netz, lesbar für jeden auf dem Weg (das WLAN eines
    Cafés…). lftp verschlüsselt von selbst (FTPS), außer man sagt ihm,
    dass es das nicht soll.
web-host-event-certificate =
    Die Verbindung ist verschlüsselt, aber lftp lehnt das Zertifikat ab:
    Es ist für *.hosting.example ausgestellt, und du hast
    ftp.community.example angefragt. Das ist der Fehler, den Gaspard
    bekam. Man behebt ihn nicht, indem man die Prüfung abschaltet,
    sondern indem man den Server unter dem Namen anfragt, den sein
    Zertifikat trägt (email_hoster.txt).
web-host-event-without-verification =
    Vorsicht: Die Prüfung der Zertifikate ist abgeschaltet
    (ssl:verify-certificate). Die Verbindung ist verschlüsselt… aber mit
    irgendwem: Jemand, der sich als Webhoster ausgibt, bekäme das Passwort,
    ohne dass lftp sich beschwert. Schalte die Prüfung wieder ein und
    benutze den Namen, den das Zertifikat abdeckt.
web-host-event-bad-direction =
    Hoppla: mirror ohne -R kopiert VOM Hosting AUF deinen Rechner. Du hast
    gerade die alte Website geholt (die Preisseite von 2025 ist auf deiner
    Maschine gelandet). -R (reverse) schickt in die andere Richtung. Die
    neue Website liegt noch im Wiki, falls du sie wieder brauchst.
web-host-event-bad-directory =
    Die Website ist beim Webhoster angekommen… aber nicht in public_html:
    mirror -R site, ohne Ziel, legt daneben ein gleichnamiges Verzeichnis
    an. Das Verzeichnis, das der Webserver veröffentlicht, ist public_html
    (und das zusätzliche Verzeichnis lässt sich entfernen: rm -r).
web-host-event-rest =
    Die neue Website ist online… und die Preisseite von 2025 auch: mirror
    löscht ohne --delete nichts auf der anderen Seite. (Um zu sehen, was
    es täte, bevor es das tut: --dry-run.)
web-host-event-end =
    Die neue Website ist online, genau die aus dem Wiki, und die Preise
    von 2025 sind weg. Das Passwort ist nie im Klartext gereist. Yasmine:
    „Gaspard fragt, ob du ihm das fürs nächste Mal zeigen könntest.“

    Gut gemacht! Du hast das Kapitel „Der Webhoster“ abgeschlossen.

    WAS PASSIERT IST
    sftp überträgt Dateien über SSH, wie scp, aber interaktiv: Man schaut
    sich um (ls, cd) und nimmt dann (get) oder schickt (put). Shared
    Hosting dagegen bietet oft nur FTP: Dann braucht man FTPS, mit TLS
    verschlüsseltes FTP, wie eine Website über HTTPS. Die Verschlüsselung
    schützt nur, wenn das Zertifikat geprüft wird, und es lässt sich nur
    unter dem Namen prüfen, den es trägt: dem des Webhosters, nicht dem
    deiner eigenen Website.

    GUTE PRAXIS
    - SFTP (oder scp, rsync), sobald man SSH hat; sonst FTPS; nie reines FTP.
    - Nie die Prüfung der Zertifikate abschalten: den Namen ändern, nicht
      die Einstellungen.
    - Mit mirror -R --delete veröffentlichen (nach einem --dry-run): Die
      Website online ist genau die, die man vorbereitet hat, ohne alte Dateien.

    DOKUMENTATION
    - sftp: https://man.openbsd.org/sftp
    - lftp: https://lftp.yar.ru/lftp-man.html
    - FTP über TLS (RFC 4217): https://www.rfc-editor.org/rfc/rfc4217
