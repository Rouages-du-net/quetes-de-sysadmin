### Geschichte „Die Kantine“, Kapitel 1 „Die Startreihenfolge“: Die App
### startet vor ihrer Datenbank (After=, Requires=, Wants=). Unit-Namen,
### Pfade und die Meldungen von systemd werden nicht übersetzt.

chapter-boot-order = Die Startreihenfolge
    .summary = Nach einem Stromausfall fährt der Server der Kantine wieder hoch, aber nicht die Reservierungs-App: Sie startet vor ihrer Datenbank. Bring systemd die Reihenfolge bei.

## Dateien

boot-order-message-ibrahim =
    Von:     Ibrahim
    An:      dich
    Betreff: Die Reservierungen gehen schon wieder nicht

    Hallo,

    Heute Morgen gab es im Viertel einen Stromausfall. Der Server ist von
    selbst wieder hochgefahren, aber nicht die Reservierungen: Die
    Speiseplan-App (der Dienst menu) steht auf „failed“. Die Ehrenamtlichen
    in der Küche sehen nicht, wer zum Mittagessen kommt.

    Letztes Mal habe ich einfach sudo systemctl start menu gemacht, und es
    ging. Aber nach jedem Neustart ist es dasselbe, und ich bin nicht
    immer da. Die Unit-Datei habe ich selbst geschrieben,
    /etc/systemd/system/menu.service, nach einem Tutorial: Wenn ich sie von
    Hand starte, geht es, so schlecht kann sie also nicht sein, oder?

    Kannst du dafür sorgen, dass die Reservierungen nach einem Neustart
    von selbst zurückkommen? Du darfst den Server zum Prüfen neu starten
    (sudo reboot): Um diese Uhrzeit reserviert niemand. Dein sudo-Passwort
    ist linsen-2028.

    Danke!
    Ibrahim

## Ereignisse

boot-order-event-refused =
    „connect ECONNREFUSED 127.0.0.1:5432“: Die App hat an die Tür von
    PostgreSQL geklopft (Port 5432)… und niemand hat geantwortet. Dabei
    läuft postgresql jetzt. Schau dir das Journal dieses Bootvorgangs an,
    Unit für Unit und in zeitlicher Reihenfolge (journalctl -b): Wer ist
    zuerst gestartet? Und was sagt die Unit-Datei über die Datenbank?
    (systemctl cat menu)
boot-order-event-by-hand =
    Die App läuft wieder, von Hand gestartet: Die Küche kann Reservierungen
    annehmen. Aber an ihrer Unit hat sich nichts geändert: Beim nächsten
    Neustart startet sie in derselben Reihenfolge wie heute Morgen. Behebe
    die Ursache, und starte dann zum Prüfen neu (sudo reboot).
boot-order-event-wrong-name =
    Vorsicht mit dem Namen: systemd kennt postgresql.service, nicht
    postgres.service. Ein After= oder Wants= auf eine Unit, die es nicht
    gibt, wird stillschweigend ignoriert (systemctl list-dependencies menu,
    systemd-analyze verify menu.service).
boot-order-event-requires-only =
    Nach dem Neustart immer noch failed, obwohl die Abhängigkeit
    eingetragen ist. Requires= (oder Wants=) heißt „starte PostgreSQL
    auch“, nicht „starte es zuerst“: Beide starten gleichzeitig, und die
    App kommt immer noch zu früh. Die Reihenfolge ist eine andere Zeile:
    After= (man systemd.unit).
boot-order-event-order =
    systemd weiß jetzt, dass die App nach PostgreSQL startet (systemctl
    list-dependencies --after menu). Ein Neustart wird zeigen, ob das
    reicht: sudo reboot, dann schau dir die Dienste an.
boot-order-event-end =
    Nach dem Neustart ist zuerst PostgreSQL gestartet, dann die App, dann
    nginx: Alles läuft, ohne dass jemand etwas angefasst hat. Ibrahim:
    „Dafür ist After= also da! Das schreibe ich in mein Tutorial.“

    Gut gemacht! Du hast das Kapitel „Die Startreihenfolge“ abgeschlossen.

    WAS PASSIERT IST
    Beim Booten startet systemd die aktivierten Dienste parallel, so
    schnell es kann. Nichts in Ibrahims Unit sagte, dass die App die
    Datenbank braucht: Die App startete gleichzeitig mit PostgreSQL,
    versuchte sich zu verbinden, bevor PostgreSQL bereit war, und beendete
    sich. Später von Hand gestartet, fand sie die Datenbank laufend vor:
    „Von Hand geht es“, aber nicht beim Booten.

    ABHÄNGIGKEIT ODER REIHENFOLGE: ZWEI VERSCHIEDENE DINGE
    - Requires=postgresql.service: starte PostgreSQL auch, und wenn es
      scheitert, starte die App nicht. Wants= ist die weiche Variante
      (starte es, aber mach weiter, wenn es scheitert).
    - After=postgresql.service: Wenn beide starten, starte PostgreSQL
      zuerst und warte, bis es bereit ist.
    - Allein starten Requires= oder Wants= beide gleichzeitig; allein
      ordnet After=, zieht aber nichts mit. Das übliche Paar:
      After= + Requires= (oder Wants=).

    GUTE PRAXIS
    - Leg die Änderung in ein Drop-in (sudo systemctl edit menu) oder in
      die Unit-Datei, dann sudo systemctl daemon-reload; prüf mit
      systemctl cat menu und systemctl list-dependencies menu.
    - systemd-analyze verify menu.service findet Tippfehler (unbekannte
      Schlüssel, Units, die es nicht gibt).
    - Ein Dienst, der „von Hand geht“, beweist nichts für den nächsten
      Bootvorgang: Der einzige Test ist ein Neustart (in einem ruhigen
      Moment), dann systemctl --failed.
    - Auch das Programm sollte geduldig sein: Eine App, die ihre Datenbank
      ein paar Sekunden lang erneut versucht, übersteht einen langsamen
      Start.

    DOKUMENTATION
    - systemd.unit, After= und Requires=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - systemctl (cat, list-dependencies, edit): https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
