### Geschichte „Die Herberge“, Kapitel „Durchgesickertes Token“: das Token
### einer App in einem öffentlichen Forum gepostet; lookup, das Audit-Log,
### revoke, ein neues Token, ein rotiertes Secret. Befehle, Optionen, Pfade,
### Namen von Policys und Tokens, Schlüssel und die Ausgaben von OpenBao
### werden nicht übersetzt.

chapter-leaked-token = Durchgesickertes Token
    .summary = Ein Ehrenamtlicher hat in einem öffentlichen Forum um Hilfe gebeten und die Konfiguration der Buchungsseite eingefügt, Token inbegriffen. Finde heraus, wessen Token es ist, was jemand damit gemacht hat, sperr es und ändere, was gelesen wurde, ohne die Seite kaputtzumachen.

## Files

leaked-token-message-desta =
    Von: Desta
    Montag, 22. März, 16:45

    Schlechte Nachrichten. Heute Nachmittag um 14:02 hat Nnamdi im
    öffentlichen Forum der Entwickler·innen von Bunks um Hilfe gebeten,
    wegen eines Fehlers bei den Zahlungen, und er hat den Anfang von
    bunks.env eingefügt, Token inbegriffen. Ich habe es um 16:40 gesehen und
    ihn gebeten, den Beitrag zu löschen, aber er war mehr als zwei Stunden
    öffentlich. Eine Kopie liegt in deinem Home-Verzeichnis.

    Was konnte dieses Token, und hat es jemand benutzt?

    Hiroko hat den Zahlungsanbieter schon um einen neuen API-Schlüssel
    gebeten, sicherheitshalber:

        { $key }

    Der alte Schlüssel funktioniert weiter, bis sie ihn im Dashboard des
    Anbieters widerruft: Sie macht das, sobald du ihr sagst, dass Bunks den
    neuen benutzt.

    Desta

leaked-token-forum-post =
    forum.bunks.example › Hilfe › „Zahlungsseite langsam nach dem Update“
    Gepostet von nnamdi_h, Montag, 22. März, 14:02 (öffentlich)

    Hallo zusammen, seit dem letzten Update ist die Zahlungsseite von Bunks
    in unserer Herberge sehr langsam. Hier ist der Anfang unserer
    Konfiguration, falls es hilft:

        { $env }

    Hat jemand eine Idee? Danke!

    Antwort einer Moderatorin, 14:20: Bitte postet keine Tokens oder
    Passwörter öffentlich. Bearbeite deinen Beitrag!

## Events

leaked-token-event-resealed =
    OpenBao wurde neu gestartet, also kam es versiegelt zurück. Desta,
    Hiroko und Nnamdi sind vorbeigekommen und haben ihre Teile getippt: Es
    ist wieder entsiegelt. Policys und Tokens wirken sofort; OpenBao braucht
    dafür nie einen Neustart.
leaked-token-event-identified =
    Das ist das Token von Bunks (display_name token-bunks, Policys bunks und
    default), noch wochenlang gültig (ttl). Sein Accessor benennt es, ohne
    es preiszugeben. Jetzt: Was hat jemand damit gemacht?
leaked-token-event-hash =
    OpenBao hat den HMAC des Werts mit dem Salt des Audit-Device berechnet:
    genau die Zeichenkette, die das Audit-Log statt des Tokens schreibt.
    Such sie im Log (sudo grep, oder jq).
leaked-token-event-traced =
    Das Audit-Log erzählt die Geschichte: Von 203.0.113.77 um 14:31 (13:31
    im Log, das in UTC zählt) hat das durchgesickerte Token sich selbst
    nachgeschlagen, versucht, secret/metadata/ zu listen (verweigert),
    secret/data/bunks/payments gelesen (erlaubt: Es ist das eigene Secret
    von Bunks), und die Bankdaten der Kasse, die Policys und ein neues Token
    wurden ihm verweigert. Die enge Policy hat gehalten; der
    Zahlungsschlüssel wurde allerdings gelesen.
leaked-token-event-revoked =
    Das durchgesickerte Token ist widerrufen: Ab jetzt wird es überall
    abgelehnt. Bunks, das noch läuft, behält seine Secrets im Speicher, aber
    sein nächster Start würde scheitern: Es braucht ein neues Token.
leaked-token-event-still-leaked =
    Bunks ist gescheitert: „permission denied“. bunks.env enthält noch das
    widerrufene Token. Ein neues Token für Bunks (dieselbe Policy), dann
    bunks.env, dann der Neustart.
leaked-token-event-lost-field =
    Die neueste Version des Zahlungs-Secrets hat kein account mehr: bao kv
    put schreibt eine ganz neue Version nur mit den angegebenen Feldern.
    Bunks braucht beide. bao kv patch ändert ein Feld und behält die anderen
    (oder kv put mit beiden; kv rollback bringt eine frühere Version
    zurück).
leaked-token-event-wrong-key =
    Das Zahlungs-Secret enthält jetzt einen Schlüssel, den der Anbieter
    nicht kennt. Der neue Schlüssel steht in Destas Nachricht.
leaked-token-event-db-touched =
    Das Datenbankpasswort wurde in OpenBao geändert, nicht in der Datenbank:
    OpenBao bewahrt es nur auf, und Bunks könnte sich nicht verbinden. Und
    das Audit-Log zeigt, dass das durchgesickerte Token es nie gelesen hat.
    Hol die vorherige Version zurück (bao kv rollback -version=1, oder kv
    patch mit dem alten Wert).
leaked-token-event-rotated =
    Das Zahlungs-Secret hat eine neue Version: der neue Schlüssel, account
    behalten (bao kv metadata get listet die Versionen). Bunks benutzt noch
    den alten Schlüssel, beim Start geladen.
leaked-token-event-wide-app =
    Bunks läuft mit einem Token, das mehr kann, als seine zwei Secrets zu
    lesen (bao token capabilities). Wer es als Nächstes stiehlt, bekommt
    all das.
leaked-token-event-old-key-loaded =
    Bunks ist neu gestartet, bevor sich der Schlüssel geändert hat: Es
    benutzt noch den alten. Starte es noch einmal neu, jetzt, wo das Secret
    den neuen Schlüssel enthält.
leaked-token-event-switched =
    Bunks ist mit einem neuen Token neu gestartet und hat den neuen
    Schlüssel geladen.
leaked-token-event-end =
    Hiroko: „Der alte Schlüssel ist beim Anbieter widerrufen. Nichts wurde
    abgebucht; sie haben es erst heute Nachmittag versucht.“

    Gut gemacht! Du hast „Durchgesickertes Token“ abgeschlossen.

    WAS PASSIERT IST
    Das Token von Bunks war zwei Stunden öffentlich. bao token lookup hat es
    identifiziert (token-bunks, Policys bunks und default, ein Accessor).
    Das Audit-Device hatte jede Anfrage mit dem Token als HMAC protokolliert:
    bao write sys/audit-hash/file input=TOKEN gab denselben HMAC, und grep
    oder jq haben gefunden, was 203.0.113.77 um 14:31 getan hat: Es hat
    secret/data/bunks/payments gelesen, und alles andere wurde ihm
    verweigert, dank der Policy aus dem vorigen Kapitel. Das Token wurde
    widerrufen, Bunks hat ein neues bekommen, der gelesene
    Zahlungsschlüssel wurde rotiert (eine neue Version, account behalten),
    Bunks wurde neu gestartet, um ihn zu laden, und der alte Schlüssel
    konnte beim Anbieter widerrufen werden. Das Datenbankpasswort, nie
    gelesen, blieb, wie es war.

    GUTE PRAXIS
    - Ein durchgesickertes Secret wird zuerst widerrufen, dann untersucht:
      Das Audit-Log sagt, was rotiert werden muss und was nicht.
    - Behalte Audit-Devices (zwei in Produktion), auf eine andere Maschine
      verschickt: OpenBao lehnt Anfragen ab, die es nicht protokollieren
      kann.
    - Rotiere an der Quelle und im Tresor: ein neuer Schlüssel vom Anbieter,
      eine neue Version in OpenBao, die App neu gestartet, dann der alte
      Schlüssel widerrufen.
    - kv put ersetzt das ganze Secret, kv patch ändert Felder, und Versionen
      erlauben einen Rollback.
    - Kurze TTLs verringern, was ein Leck wert ist; füge nie eine env-Datei
      ein, und lass einen Secret-Scanner deine Beiträge und Commits
      überwachen.

    EIN ANDERER WEG
    Dynamische Secrets: Die Datenbank-Engine von OpenBao legt für jedes
    Lease ein Konto an und löscht es, wenn es abläuft, sodass ein
    durchgesickerter Zugang von selbst stirbt. Response Wrapping übergibt
    ein Secret über ein Einmal-Token.

    DOKUMENTATION
    - bao token: https://openbao.org/docs/commands/token/
    - Audit-Devices: https://openbao.org/docs/audit/
    - /sys/audit-hash: https://openbao.org/docs/api/system/audit-hash/
    - bao kv patch: https://openbao.org/docs/commands/kv/patch/
    - Response Wrapping: https://openbao.org/docs/concepts/response-wrapping/
