### Story "The Airwaves", chapter "The Stolen Laptop": a reporter's laptop
### stolen with its client certificate; revocation, CRL, nginx's ssl_crl;
### then a watch on expiry dates (openssl x509 -checkend, cron or a timer).
### Commands, options, paths and outputs are not translated.

chapter-stolen-laptop = Der gestohlene Laptop
    .summary = Der Laptop einer Reporterin wurde gestohlen, und mit ihm das Zertifikat, das das Beitragsportal öffnet. Jemand benutzt es schon. Schließ diese Tür, ohne die anderen auszusperren, dann sorg dafür, dass kein Zertifikat des Verbunds je wieder überraschend abläuft.

## Files

stolen-laptop-message-adaeze =
    Von: Adaeze
    Dienstag, 16. April, 10:05
    
    Schlechte Nachrichten: Lindiwes Laptop wurde Sonntagnacht nach dem
    Festival aus ihrem Auto gestohlen. Seine Platte ist nicht verschlüsselt
    (ich weiß…).
    
    Darauf ist der Uploader, der ihre Aufnahmen an das Beitragsportal
    schickt, https://contrib.airwaves.internal/. Das Portal lässt nur die
    Laptops der Reporterinnen und Reporter herein: jeder hat ein
    Client-Zertifikat unserer ausstellenden CA (Kwames Notizen liegen in
    /srv/ca/README.txt). Amina und Ravi müssen weiterarbeiten: Amina
    schickt heute Morgen die Interviews vom Festival.
    
    Lindiwe bekommt nächste Woche einen neuen Laptop; bis dahin darf
    niemand außer uns ihren benutzen können.
    
    Und noch etwas, nach der Überraschung mit dem Intranet im März: können
    wir selbst gewarnt werden, bevor ein Zertifikat abläuft? Die Richtlinie
    sagt 30 Tage vorher.
    
    Adaeze

## Events

stolen-laptop-event-thief =
    203.0.113.66: eine Adresse, die zu keiner der Stationen gehört,
    verbindet sich um 2 Uhr nachts und heute Morgen wieder mit dem Portal
    und wird angenommen (200). Sie präsentiert ein gültiges, von unserer CA
    signiertes Zertifikat: nginx kann sie nicht von Lindiwe unterscheiden.
    Ein Zertifikat bleibt bis zu seinem Enddatum gültig, außer die
    Zertifizierungsstelle sperrt es und die Server erfahren davon.
stolen-laptop-event-deleted =
    Die Datei des Zertifikats ist aus newcerts verschwunden, aber das sperrt
    nichts: der Dieb hat seine Kopie, mit ihrem Schlüssel, und nginx prüft
    nur, dass sie von unserer CA signiert wurde. Sperren heißt, es der
    Datenbank der Zertifizierungsstelle zu sagen (openssl ca -revoke), dann
    die Liste zu veröffentlichen. Eine Kopie des Zertifikats jedes Laptops
    liegt auch in /srv/ca/issuing/certs/.
stolen-laptop-event-new-ca =
    Eine ganz neue Zertifizierungsstelle? Gestohlen wurde nur der Schlüssel
    eines Laptops, nicht der der Zertifizierungsstelle: die Root zu wechseln
    hieße, sie überall zu installieren und jedes Zertifikat neu
    auszustellen, umsonst. Das eine Zertifikat zu sperren genügt.
stolen-laptop-event-revoked =
    Zertifikat 1003 ist jetzt in index.txt als R (revoked) markiert. Aber
    die Datenbank gehört der Zertifizierungsstelle: nginx liest sie nie. Was
    Server lesen, ist die Sperrliste, die CRL, die die Zertifizierungsstelle
    schreibt und signiert (openssl ca -gencrl).
stolen-laptop-event-crl =
    Die CRL listet die Seriennummer 1003, signiert von der ausstellenden CA,
    30 Tage gültig (default_crl_days: sie muss vorher neu geschrieben
    werden, selbst ohne Neues). nginx muss sie bekommen: die Direktive
    ssl_crl, bei jedem Neuladen gelesen.
stolen-laptop-event-stale-crl =
    nginx hat eine CRL, aber eine, die 1003 nicht listet: eine CRL ist eine
    Momentaufnahme der Datenbank zum Zeitpunkt, als sie geschrieben wurde.
    Schreib sie nach jeder Sperrung neu und lade nginx neu.
stolen-laptop-event-all-refused =
    Jetzt lehnt nginx alle ab, auch Amina! Sein Fehlerlog sagt warum:
    „unable to get certificate CRL“. Mit ssl_crl prüft nginx die Sperrung
    jedes Zertifikats der Kette, auch das der ausstellenden CA, und dieses
    steht in der CRL der Root (/srv/ca/crl/root.crl): die Datei für ssl_crl
    muss beide CRLs enthalten, eine nach der anderen.
stolen-laptop-event-not-loaded =
    Die Konfiguration erwähnt ssl_crl, aber nginx hat sie noch nicht
    geladen: prüfe sie (sudo nginx -t), dann lade neu.
stolen-laptop-event-refused =
    Der gestohlene Laptop wird abgewiesen (400, „The SSL certificate error“,
    certificate revoked im Fehlerlog), und Aminas Uploads kommen weiter
    durch. Jetzt die zweite Bitte: eine Überwachung der Ablaufdaten.
stolen-laptop-event-watch-quiet =
    Ein Job läuft von selbst, aber er hat nichts über das Zertifikat des
    Streaming-Servers gesagt, das in 20 Tagen abläuft
    (/srv/ca/issued/stream.crt). Die Zertifikate liegen in /srv/ca/issued
    und /srv/ca/issuing/newcerts; openssl x509 -checkend antwortet mit
    seinem Rückgabewert.
stolen-laptop-event-watch-noisy =
    Der Job listet jedes Zertifikat gleich auf: das, das abläuft, geht
    zwischen den gesunden unter, und niemand wird eine tägliche Mail lesen,
    die immer dasselbe sagt. Ein Alarm spricht nur, wenn es etwas zu tun
    gibt.
stolen-laptop-event-watch =
    Die Überwachung funktioniert: so ausgeführt, wie sie laufen wird, meldet
    sie das Zertifikat des Streaming-Servers, das am 6. Mai abläuft, und
    schweigt über die anderen.
stolen-laptop-event-end =
    Adaeze: „Die Interviews vom Festival sind da, und der gestohlene Laptop
    kann nichts mehr schicken. Ich habe schon den ersten Alarm in meinem
    Postfach: das Streaming-Zertifikat. Ich bitte Kwame, es diese Woche zu
    erneuern!“
    
    Gut gemacht! Du hast „Der gestohlene Laptop“ abgeschlossen.
    
    WAS PASSIERT IST
    Ein Client-Zertifikat beweist „dieser Laptop gehört einer Reporterin“,
    solange es gültig ist: gestohlen funktioniert es für alle, die es haben.
    Du hast die Verbindungen des Diebs im Access-Log von nginx gefunden, das
    Zertifikat in der Datenbank der ausstellenden CA gesperrt (openssl ca
    -revoke, keyCompromise), die Sperrliste geschrieben (openssl ca -gencrl)
    und nginx beide CRLs gegeben (die der ausstellenden CA und die der Root,
    da nginx die ganze Kette prüft), bevor du neu geladen hast. Dann hast
    du eine Überwachung eingerichtet, die openssl x509 -checkend über jedes
    ausgestellte Zertifikat laufen lässt und nur für die spricht, die
    innerhalb von 30 Tagen ablaufen.
    
    GUTE PRAXIS
    - Ein verlorener oder gestohlener Schlüssel: das Zertifikat sofort
      sperren (openssl ca -revoke datei -crl_reason keyCompromise); eine
      Datei zu löschen sperrt nichts.
    - Sperren hat zwei Schritte: die Datenbank, dann eine neue CRL
      (-gencrl), die die Server laden (nginx: ssl_crl, dann neu laden).
    - Eine CRL läuft ab (default_crl_days): schreib sie nach Plan neu, sonst
      wird an dem Tag, an dem sie verfällt, jeder Client abgewiesen.
    - nginx prüft die CRLs der ganzen Kette: auch die CRL der Root.
    - Die Ablaufdaten überwachen: openssl x509 -checkend $((30*86400)) in
      einem täglichen Job (cron, oder ein systemd-Timer), der nur meldet,
      was abläuft.
    - Die Platten von Laptops verschlüsseln: ein gestohlener Schlüssel ist
      der Anfang jeder solchen Geschichte.
    
    DOKUMENTATION
    - openssl-ca (-revoke, -gencrl): https://docs.openssl.org/3.0/man1/openssl-ca/
    - openssl-crl: https://docs.openssl.org/3.0/man1/openssl-crl/
    - nginx, ssl_crl und ssl_verify_client: https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_crl
    - CRLs (RFC 5280, Abschnitt 5): https://www.rfc-editor.org/rfc/rfc5280#section-5
    - openssl-x509 (-checkend): https://docs.openssl.org/3.0/man1/openssl-x509/
