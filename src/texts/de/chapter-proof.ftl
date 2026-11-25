### Geschichte „Die Wache“, Kapitel „Ohne Beweis keine Gewissheit“: erneut
### beweisen, dass die Korrekturen halten, im Log nach einem früheren
### Versuch suchen. Die Befehle, die Pfade und das Format des Access-Logs
### von nginx werden nicht übersetzt.

chapter-proof = Ohne Beweis keine Gewissheit
    .summary = Erneut beweisen, dass die Korrekturen halten, und prüfen, ob die Schwachstelle schon ausprobiert worden war.

## Dateien

proof-email-salome =
    Von:     Salomé
    An:      dich
    Betreff: Noch eine Sache, bevor wir die Woche abschließen

    Zwei behobene CVEs sind gut; man muss es aber noch beweisen, nicht nur
    glauben. Bestätige mit apt (man apt), dass für nginx und rsync nichts
    mehr aussteht.

    Und eine Gewohnheit, die sich lohnt, auch im Nachhinein: War die
    Schwachstelle von nginx (HTTP/2) schon ausprobiert worden, bevor du sie
    behoben hast? Das Access-Log von nginx hält jede Anfrage fest (man
    grep, um darin zu suchen). Ein gescheiterter Versuch schadet niemandem,
    ist aber eine Notiz wert: Er heißt, dass jemand da draußen schon
    gesucht hat.

    Salomé

## Ereignisse

proof-event-versions =
    apt bestätigt: Für nginx und rsync ist nichts mehr zu aktualisieren.
    Erst wenn es geprüft ist, ist es wirklich behoben.
# { $address }: die Adresse des gefundenen Versuchs
proof-event-found =
    Eine Zeile des Access-Logs fällt auf: eine leere HTTP/2-Anfrage, ohne
    angegebenen Browser, von nginx abgelehnt (Code 400), von { $address },
    ein paar Tage vor der Korrektur. Das ist kein Beweis für ein
    gelungenes Eindringen (nginx hat abgelehnt), aber eine Spur, die es
    wert ist, aufbewahrt zu werden: Jemand hat schon gesucht.
proof-event-end =
    Salomé: „Das meine ich mit Beweis: nicht ‚ich glaube, es ist behoben‘,
    sondern ‚apt bestätigt es, und hier ist der Versuch, den wir entdeckt
    haben‘.“

    Gut gemacht! Du hast das Kapitel „Ohne Beweis keine Gewissheit“ abgeschlossen.

    WAS PASSIERT IST
    Eine Korrektur, die ohne Prüfung eingespielt wird, ist nur eine
    Absicht. Danach zu prüfen (ein leeres apt list --upgradable) macht aus
    „ich glaube, es ist erledigt“ eine festgestellte Tatsache. In den Logs
    nach einem früheren Versuch zu suchen, selbst einem gescheiterten,
    gibt eine Vorstellung davon, wer sich schon für diesen Server
    interessiert hat, und seit wann.

    GUTE PRAXIS
    - Eine Korrektur nach dem Einspielen immer erneut beweisen: apt list
      --upgradable, oder der eigene Befehl des korrigierten Werkzeugs.
    - Vor dem Abschluss eines Vorfalls nach Spuren eines Versuchs suchen,
      auch ohne Beweis, dass er gelungen ist: Das gehört zur Beobachtung,
      nicht nur zur Reaktion auf einen schon sichtbaren Vorfall.
    - Logs lange genug aufbewahren, um sie nachzulesen: Einen Versuch
      bemerkt man oft erst im Nachhinein, wenn man die Schwachstelle kennt.

    EIN ANDERER WEG
    Ein Intrusion-Detection-System (wie fail2ban, schon gesehen in „Der
    Wächter“, oder ein umfassenderes Werkzeug wie Suricata) kann diese Art
    von Versuch live statt im Nachhinein erkennen und von selbst reagieren
    (die Adresse sperren). Beides ergänzt sich: Live-Erkennung, um schnell
    zu reagieren, das Nachlesen der Logs, um zu verstehen, was entgangen
    ist.

    DOKUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - Das Format des Access-Logs von nginx: https://nginx.org/en/docs/http/ngx_http_log_module.html
