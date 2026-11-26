### Story "The Airwaves", chapter "The Expiry Date": the intranet's
### certificate, signed by the federation's own authority, has expired.
### openssl s_client, x509, req, x509 -req with -CA, subjectAltName.
### Commands, options, paths and outputs are not translated.

chapter-expiry-date = Das Ablaufdatum
    .summary = Montagmorgen, und der Browser jeder Station warnt, das Intranet sei nicht sicher. Sein Zertifikat stammt von der eigenen Zertifizierungsstelle des Verbunds, und es ist letzte Nacht abgelaufen. Erneuere es so, wie man ein Zertifikat heute macht, und kümmere dich dabei um den Schlüssel der Zertifizierungsstelle.

## Files

expiry-date-message-adaeze =
    Von: Adaeze (Koordination des Verbunds)
    Montag, 4. März, 8:40
    
    Hallo, und danke, dass du von Kwame übernimmst!
    
    Seit heute Morgen bekommt jede Station eine große rote Warnung im
    Intranet: „Dies ist keine sichere Verbindung“. Die Moderatorinnen und
    Moderatoren klicken sich durch (ich habe sie gebeten, das nicht zu
    tun…), und Mateo sagt, sein Browser spricht von einem abgelaufenen Datum
    und einem falschen Namen für board.airwaves.internal.
    
    Alles läuft auf mast. Unsere Namen enden auf airwaves.internal, also hat
    Kwame vor zwei Jahren unsere eigene Zertifizierungsstelle gebaut: sie
    liegt in /srv/ca, mit seinen Notizen (README.txt) und unserer
    Richtlinie (POLICY.txt).
    
    Kannst du das Zertifikat des Intranets erneuern, diesmal richtig? Kwame
    hat auch etwas über den Schlüssel der Zertifizierungsstelle gesagt, das
    mich beunruhigt hat, aber ich habe nicht verstanden, was.
    
    Adaeze

## Events

expiry-date-event-expired =
    Da ist es: das Datum notAfter des Zertifikats ist überschritten
    (Sonntag, 23:59 Pariser Zeit). Ein Zertifikat trägt sein eigenes
    Enddatum, und kein Client akzeptiert es danach, egal wer es signiert
    hat. Was sagt das Zertifikat über die Namen, die es abdeckt? openssl
    x509 -text zeigt alles.
expiry-date-event-cn-only =
    Das Zertifikat hat einen Subject (CN=intranet.airwaves.internal) und gar
    keine Erweiterung: kein subjectAltName. Seit 2017 ignorieren Browser
    (Chrome 58, dann die anderen) den Common Name und schauen nur auf
    subjectAltName, wie es RFC 2818 und das CA/Browser Forum verlangen. Ohne
    ihn bekommt selbst ein gültiges Zertifikat eine Warnung; und
    board.airwaves.internal war nie abgedeckt. Kwames Notizen in /srv/ca
    sagen, wie er dieses gemacht hat.
expiry-date-event-readme =
    Kwames Rezept funktioniert, aber es macht dasselbe Zertifikat noch
    einmal: x509 -req übernimmt standardmäßig keine der Erweiterungen der
    Anfrage (kein subjectAltName), und -days 825 widerspricht der
    Richtlinie. Die Namen kommen in eine Erweiterungsdatei (-extfile), oder
    in die Anfrage mit -addext und werden dann mit -copy_extensions copy
    übernommen. Wo du gerade in /srv/ca bist: wer kann den privaten
    Schlüssel der Zertifizierungsstelle lesen?
expiry-date-event-key-open =
    Der private Schlüssel der Root ist rw-r--r--: jedes Konto auf mast kann
    ihn lesen und damit ein Zertifikat für jeden Namen signieren, dem jede
    Station vertrauen würde. Der Schlüssel einer CA ist nur für root lesbar
    (chmod 600), in einem Verzeichnis, das sonst niemand betreten kann
    (chmod 700).
expiry-date-event-key-gone =
    Der private Schlüssel der Root liegt nicht mehr in
    /srv/ca/private/ca.key! Ohne ihn kann die Zertifizierungsstelle nichts
    mehr signieren, und jede Station müsste einer neuen Root vertrauen. Leg
    ihn zurück, wo er war (die zweite Regel der Richtlinie: nur seine Rechte
    ändern sich).
expiry-date-event-key-closed =
    Der Schlüssel der Zertifizierungsstelle ist jetzt nur für root lesbar:
    zum Signieren gehst du über sudo, und das hinterlässt eine Spur im
    Journal.
expiry-date-event-insecure =
    curl -k (--insecure) antwortet, aber nur, weil es nichts mehr prüft:
    weder das Datum noch den Namen noch, wer signiert hat. Es versteckt das
    Problem, ohne es zu lösen; schreib es nie in ein Skript oder eine
    Überwachungsprüfung. Um gegen unsere Zertifizierungsstelle zu prüfen:
    curl --cacert /srv/ca/ca.crt.
expiry-date-event-mismatch =
    nginx weigert sich zu laden: Zertifikat und Schlüssel passen nicht
    zusammen (key values mismatch). Ein Zertifikat enthält die öffentliche
    Hälfte eines Schlüsselpaars; ssl_certificate_key muss seine private
    Hälfte sein. openssl x509 -noout -pubkey und openssl pkey -pubout,
    jeweils in sha256sum geleitet, müssen denselben Fingerabdruck ergeben.
expiry-date-event-self-signed =
    nginx liefert jetzt ein Zertifikat aus, das mit seinem eigenen
    Schlüssel signiert ist: selbstsigniert. Keine Station vertraut ihm (die
    rote Warnung bleibt, jetzt wegen eines unbekannten Ausstellers), und mit
    der Standardkonfiguration von req -x509 ist es sogar ein CA-Zertifikat.
    Es muss von Airwaves Root CA signiert sein, der die Stationen schon
    vertrauen: x509 -req mit -CA und -CAkey.
expiry-date-event-no-san =
    Ein neues Zertifikat, von unserer Root signiert, aber immer noch ohne
    subjectAltName: die Browser werden weiter warnen. Vorsicht: x509 -req
    verwirft die Erweiterungen der Anfrage, außer du sagst etwas anderes
    (-copy_extensions copy, oder die Namen in -extfile).
expiry-date-event-one-name =
    Endlich ein subjectAltName, aber er listet nicht beide Namen, die die
    Stationen benutzen: intranet.airwaves.internal und
    board.airwaves.internal (server_name von nginx).
expiry-date-event-too-long =
    Dieses Zertifikat ist { $days } Tage gültig: die Richtlinie sagt ein
    Jahr, nie mehr als 398. Öffentliche Stellen dürfen nicht über 398 Tage
    hinausgehen, und Apples Systeme lehnen mehr als 825 ab, selbst von einer
    privaten Stelle; eine kurze Gültigkeit begrenzt den Schaden eines
    verlorenen Schlüssels und sorgt dafür, dass die Erneuerung eine bekannte
    Routine bleibt.
expiry-date-event-short =
    Dieses Zertifikat ist nur einen Monat gültig: ohne -days signiert x509
    -req für 30 Tage. Das Intranet wäre im April wieder rot. Die Richtlinie
    verlangt ein Jahr.
expiry-date-event-ca-leaf =
    Dieses Zertifikat sagt CA:TRUE: wer den Schlüssel des Intranets hat,
    könnte Zertifikate für jeden Namen signieren. Das Zertifikat eines
    Servers ist keine CA (basicConstraints = CA:FALSE).
expiry-date-event-not-reloaded =
    Das neue Zertifikat liegt auf der Platte bereit, aber nginx liefert noch
    das alte aus: es liest seine Zertifikate beim Start oder beim Neuladen.
    Prüfe die Konfiguration (sudo nginx -t), dann lade neu.
expiry-date-event-renewed =
    nginx präsentiert jetzt ein Zertifikat von Airwaves Root CA, ein Jahr
    gültig, mit beiden Namen in subjectAltName. curl --cacert
    /srv/ca/ca.crt https://board.airwaves.internal/ ist einverstanden.
expiry-date-event-end =
    Adaeze: „Keine rote Warnung mehr, an keiner Station. Und board geht
    wieder für Mateo! Danke. Ich habe eine Erinnerung für nächsten Februar
    in den Kalender eingetragen…“
    
    Gut gemacht! Du hast „Das Ablaufdatum“ abgeschlossen.
    
    WAS PASSIERT IST
    2028 hat Kwame das Zertifikat des Intranets mit der Root des Verbunds
    signiert, so wie es viele Tutorials taten: der Name nur im Common Name,
    und 825 Tage. Es ist in der Nacht auf Montag abgelaufen; und schon
    vorher hatten Browser aufgehört, den CN zu lesen, deshalb warnte
    board.airwaves.internal. Du hast gelesen, was der Server präsentiert
    (openssl s_client, x509 -dates, -checkend), eine Anfrage gemacht, sie
    von der Root mit den Namen in subjectAltName für ein Jahr signieren
    lassen, sie installiert und nginx neu geladen, dann mit curl --cacert
    geprüft. Und der Schlüssel der Root, für alle lesbar, gehört jetzt
    allein root.
    
    GUTE PRAXIS
    - Jeder Name, den ein Client benutzt, kommt in subjectAltName; der CN
      wird ignoriert.
    - x509 -req übernimmt standardmäßig keine Erweiterung aus der Anfrage:
      -extfile, oder -copy_extensions copy (und das Ergebnis mit x509 -text
      prüfen).
    - Eine Gültigkeit von höchstens einem Jahr (398 Tage ist die
      öffentliche Obergrenze), und eine Erinnerung im Kalender, oder besser,
      eine Überwachung der Ablaufdaten.
    - Ein Zertifikat und sein Schlüssel gehören zusammen: vergleiche ihre
      öffentlichen Schlüssel (x509 -pubkey, pkey -pubout, sha256sum).
    - Nie curl -k als Lösung: --cacert mit dem Zertifikat deiner
      Zertifizierungsstelle.
    - Der private Schlüssel einer CA ist nur für root lesbar, und ihre Root
      idealerweise offline.
    
    DOKUMENTATION
    - openssl-x509: https://docs.openssl.org/3.0/man1/openssl-x509/
    - openssl-req: https://docs.openssl.org/3.0/man1/openssl-req/
    - subjectAltName (RFC 5280, 4.2.1.6): https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.6
    - Die TLS-Empfehlungen von Mozilla: https://wiki.mozilla.org/Security/Server_Side_TLS
