### Story "The Airwaves", chapter "The Chain of Trust": an issuing CA, a
### server that sends its certificate without the intermediate, machines
### that don't trust the root. update-ca-certificates, nginx's chain,
### openssl s_client -showcerts and verify. Commands, options, paths and
### outputs are not translated.

chapter-chain-of-trust = Die Vertrauenskette
    .summary = Kwame hat eine Zwischenzertifizierungsstelle unter die Root gesetzt, Mateo hat eine Überwachungsprüfung geschrieben, die seitdem rot ist, und der neue Studio-PC lehnt jede Site ab. Die Zertifikate sind gültig: was fehlt, ist Vertrauen, und ein Glied der Kette.

## Files

chain-of-trust-message-adaeze =
    Von: Adaeze
    Montag, 18. März, 9:15
    
    Zwei Wochen Ruhe, und jetzt das.
    
    Kwame war letzte Woche da, um etwas einzurichten, das er eine
    „ausstellende CA“ nennt (siehe /srv/ca/README.txt), und hat damit das
    Zertifikat des neuen Archivs signiert: archive.airwaves.internal geht in
    Firefox an den Stationen gut.
    
    Aber Mateo sagt, seine Überwachung auf mast ist rot, seit er sie
    geschrieben hat (/usr/local/bin/check-sites, ihr Log in
    /var/log/check-sites.log), und der neue Studio-PC, den er in Riverside
    aufgestellt hat, kabine, lehnt sowohl das Archiv als auch das Intranet
    ab. Er hat vorgeschlagen, -k hinzuzufügen, „damit es grün wird“; ich
    habe gesagt, ich frage zuerst dich.
    
    Du erreichst kabine von mast aus: ssh kabine (dein Schlüssel liegt
    darauf).
    
    Adaeze
chain-of-trust-note-mateo =
    Notiz von Mateo, Freitag, 15. März
    
    Frisches Debian 13 auf diesem PC, für die Sendeabwicklung des Studios.
    Er holt das Programm von https://intranet.airwaves.internal/ und die
    Jingles von https://archive.airwaves.internal/, und lehnt beides ab:
    „SSL certificate problem: unable to get local issuer certificate“. An
    der Station geht Firefox. Kwame hat etwas auf unseren alten PCs
    installiert, aber ich weiß nicht, was.

## Events

chain-of-trust-event-red =
    „unable to get local issuer certificate“: der Client konnte das
    Zertifikat mit keiner Zertifizierungsstelle verbinden, der er vertraut.
    Eine frische Maschine vertraut nur den öffentlichen Stellen ihres
    Speichers (ca-certificates von Debian, in /etc/ssl/certs); unsere Root
    gehört nicht dazu, und Kwame hat sie nur von Hand auf den PCs der
    Stationen installiert. Woher nimmt Debian die Stellen, denen es
    vertraut? (man update-ca-certificates)
chain-of-trust-event-insecure =
    -k (--insecure) in der Überwachung würde sie grün machen… und blind: sie
    würde kein abgelaufenes Zertifikat mehr bemerken, keinen falschen
    Namen, keinen Server, der nicht unserer ist. Eine Prüfung, die nicht
    scheitern kann, prüft nichts. Lass mast stattdessen unserer Root
    vertrauen.
chain-of-trust-event-pem-ignored =
    In /usr/local/share/ca-certificates liegt eine .pem-Datei, und
    update-ca-certificates ignoriert sie: es nimmt nur Dateien, die auf .crt
    enden (der Inhalt ist dasselbe PEM). Benenne sie um.
chain-of-trust-event-key-on-booth =
    Ein privater Schlüssel der Zertifizierungsstelle liegt auf kabine! Ein
    Client braucht nur das Zertifikat, den öffentlichen Teil: wer den
    Schlüssel hat, kann Zertifikate signieren, denen jede Station vertrauen
    würde. Lösche ihn sofort von kabine (im echten Leben bedeutet ein
    geleakter Schlüssel eine neue Zertifizierungsstelle: hier ist kabine noch
    nicht im Netzwerk, Adaeze lässt es diesmal durchgehen).
chain-of-trust-event-mast-trusts =
    mast vertraut jetzt Airwaves Root CA: sie liegt in /etc/ssl/certs und
    im Bündel ca-certificates.crt, das curl und openssl lesen. Mal sehen,
    was die Überwachung jetzt sagt.
chain-of-trust-event-still-red =
    Fürs Archiv immer noch rot, aber das Intranet besteht. Das Zertifikat
    des Intranets ist direkt von der Root signiert; das des Archivs von der
    ausstellenden CA, die der Client nicht kennt. Ein Server muss nach
    seinem eigenen Zertifikat die Zwischenzertifikate bis zur Root schicken
    (nicht die Root selbst, die der Client schon hat). Was schickt das
    Archiv? openssl s_client -showcerts listet die empfangene Kette.
chain-of-trust-event-intermediate-trusted =
    Der ausstellenden CA auf den Clients zu vertrauen, lässt das Archiv hier
    funktionieren, aber auf jedem anderen Client bleibt das Problem: die
    Lösung liegt auf dem Server, der das Zwischenzertifikat mit seinem
    Zertifikat schicken muss.
chain-of-trust-event-root-served =
    Das Archiv schickt jetzt auch die Root. Das funktioniert, ist aber
    nutzlos: ein Client vertraut nur einer Root, die er schon in seinem
    Speicher hat, nie einer, die ihm der Server reicht; das sind ein paar
    hundert Bytes umsonst bei jedem Handshake.
chain-of-trust-event-chain =
    Das Archiv schickt jetzt sein Zertifikat, gefolgt von dem der
    ausstellenden CA: jeder Client, der der Root vertraut, kann die Kette
    bauen (Blatt, ausstellende CA, Root). Firefox an den Stationen ging,
    weil es sich die Zwischenzertifikate merkt, denen es begegnet ist; curl
    und eine frische Maschine tun das nicht.
chain-of-trust-event-booth =
    kabine vertraut jetzt der Root des Verbunds (nur ihr Zertifikat liegt
    dort, nicht ihr Schlüssel).
chain-of-trust-event-end =
    Mateo: „Alles grün, und kabine spielt die Jingles. Ich habe -k aus meinen
    Notizen genommen, versprochen.“
    
    Gut gemacht! Du hast „Die Vertrauenskette“ abgeschlossen.
    
    WAS PASSIERT IST
    Zwei getrennte Probleme ergaben dieselbe Meldung, „unable to get local
    issuer certificate“. Erstens vertrauten weder mast noch kabine der Root
    des Verbunds: Debian vertraut dem, was update-ca-certificates in
    /etc/ssl/certs legt, aus der Liste von Mozilla und aus den .crt-Dateien
    von /usr/local/share/ca-certificates. Dann schickte das Archiv sein
    Zertifikat allein, ohne die ausstellende CA, die es mit der Root
    verbindet; Browser, die diesem Zwischenzertifikat schon begegnet waren,
    kamen zurecht, andere Clients nicht. Du hast das Zertifikat der Root
    (und nur das) auf beiden Maschinen installiert und nginx die Kette
    gegeben: das Blatt, dann das Zwischenzertifikat.
    
    GUTE PRAXIS
    - Das Zertifikat der Root verteilen, nie einen Schlüssel: ein Client
      braucht nie einen privaten Schlüssel der Zertifizierungsstelle.
    - Unter Debian: /usr/local/share/ca-certificates/name.crt, dann
      update-ca-certificates (eine .pem wird ignoriert).
    - Ein Server schickt sein Zertifikat und die Zwischenzertifikate, in
      dieser Reihenfolge; nicht die Root (cat leaf.crt issuing.crt >
      chain.crt für ssl_certificate).
    - openssl s_client -showcerts zeigt, was wirklich geschickt wird;
      openssl verify -CAfile root.crt -untrusted issuing.crt prüft die
      Kette.
    - „Geht in meinem Browser“ beweist wenig: Browser cachen
      Zwischenzertifikate.
    - Nie die Prüfung in einer Überwachung abschalten: sie muss scheitern
      können.
    
    DOKUMENTATION
    - update-ca-certificates: https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html
    - nginx, SSL-Zertifikatsketten: https://nginx.org/en/docs/http/configuring_https_servers.html#chains
    - openssl-verify: https://docs.openssl.org/3.0/man1/openssl-verify/
    - openssl-s_client: https://docs.openssl.org/3.0/man1/openssl-s_client/
    - Die TLS-Empfehlungen von Mozilla: https://wiki.mozilla.org/Security/Server_Side_TLS
