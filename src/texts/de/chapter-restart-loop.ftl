### Geschichte „Die Kantine“, Kapitel 2 „Die Neustartschleife“: Restart=,
### RestartSec=, das Startlimit, PartOf=. Unit-Namen, Pfade und die
### Meldungen von systemd werden nicht übersetzt.

chapter-restart-loop = Die Neustartschleife
    .summary = Restart=always sollte die App von selbst zurückbringen: Letzte Nacht hat es nach einer halben Sekunde aufgegeben. Sorg dafür, dass sie die Neustarts von PostgreSQL übersteht.

## Dateien

restart-loop-message-ibrahim =
    Von:     Ibrahim
    An:      dich
    Betreff: Restart=always hat nichts gebracht

    Hallo,

    Seit deiner Korrektur laufen die Neustarts gut. Aber letzte Nacht
    haben die automatischen Updates PostgreSQL aktualisiert (dabei starten
    sie es neu), und heute Morgen gingen die Reservierungen wieder nicht.

    Ich hatte gelesen, dass Restart=always systemd einen Dienst neu
    starten lässt, der stirbt, also hatte ich es vor ein paar Tagen in
    /etc/systemd/system/menu.service eingetragen. Anscheinend hat systemd
    es versucht… und dann aufgegeben? Ich verstehe das Journal nicht.

    Die Updates werden PostgreSQL wieder neu starten: Kannst du dafür
    sorgen, dass die App allein damit zurechtkommt? Zum Testen kannst du
    machen, was die Updates machen: sudo systemctl restart postgresql. Die
    Reservierungen müssen zurückkommen, ohne dass jemand die App von Hand
    startet. Gleiches sudo-Passwort: linsen-2028.

    Ibrahim

## Ereignisse

restart-loop-event-limit =
    „Start request repeated too quickly“, Result: start-limit-hit. Als
    PostgreSQL neu startete, verlor die App ihre Verbindung und beendete
    sich; Restart= startete sie nach RestartSec= neu, standardmäßig
    100 ms… während PostgreSQL noch neu startete. Fünf Fehlschläge in einer
    halben Sekunde: Über dem Startlimit (standardmäßig 5 Starts in 10 s)
    gibt systemd auf. Schau dir die Zeiten in journalctl -u menu an.
restart-loop-event-too-often =
    „start of the service was attempted too often“: systemd zählt die
    Starts, auch deine, und lehnt ab, solange das Limit erreicht ist.
    Sobald die Ursache behoben ist, vergisst sudo systemctl reset-failed
    menu die Fehlschläge (systemctl start geht auch nach
    StartLimitIntervalSec= wieder).
restart-loop-event-again =
    Dieselbe Schleife: PostgreSQL ist neu gestartet, die App ist
    gestorben, fünfmal zu früh zurückgekommen, und systemd hat wieder
    aufgegeben. Solange die App neu startet, bevor die Datenbank zurück
    ist, hilft Restart= allein nicht. Gib entweder PostgreSQL Zeit
    (RestartSec=), oder binde die App an PostgreSQL, sodass sie mit ihm
    stoppt und neu startet (man systemd.unit: PartOf=).
restart-loop-event-binds-to =
    BindsTo= hat die App tatsächlich mit PostgreSQL gestoppt, diesmal
    sauber. Aber nichts hat sie wieder gestartet: BindsTo= gibt den Stopp
    weiter, nicht den Start. Für „mit ihm neu starten“ ist es PartOf= (mit
    After=, um nach ihm zurückzukommen).
restart-loop-event-end =
    PostgreSQL ist neu gestartet, und die App ist von selbst zurückgekommen,
    nach ihm. Ibrahim: „Die Küche hat nicht einmal etwas gemerkt. Heute
    Nacht lasse ich die Updates laufen.“

    Gut gemacht! Du hast das Kapitel „Die Neustartschleife“ abgeschlossen.

    WAS PASSIERT IST
    Wenn PostgreSQL neu startet, verliert die App ihre Verbindung und
    beendet sich mit einem Fehler. Restart=always ließ systemd sie nach
    RestartSec= neu starten, standardmäßig 100 ms: fünfmal in einer halben
    Sekunde, während die Datenbank noch neu startete. Nach
    StartLimitBurst= Starts (5) in StartLimitIntervalSec= (10 s) hört
    systemd auf, es zu versuchen: Result: start-limit-hit, und die App
    blieb bis zum Morgen unten.

    ZWEI AUSWEGE
    - PartOf=postgresql.service (mit After=): Wenn PostgreSQL stoppt oder
      neu startet, stoppt systemd zuerst die App und startet sie nach der
      Datenbank wieder. Gar kein Fehlschlag.
    - Restart=on-failure mit RestartSec=5s: Die App stirbt, aber systemd
      wartet lange genug, bis PostgreSQL zurück ist, bevor es neu versucht.
    - BindsTo= stoppt die App mit PostgreSQL, bringt sie aber nicht zurück.

    GUTE PRAXIS
    - Restart=on-failure statt always (ein sauberer Stopp ist kein
      Fehlschlag), und ein RestartSec= von ein paar Sekunden: Eine Schleife
      sofortiger Neustarts füllt nur das Journal.
    - Nach einem start-limit-hit die Ursache beheben, dann systemctl
      reset-failed und systemctl start.
    - Teste tagsüber, was nachts passieren wird:
      sudo systemctl restart postgresql, dann systemctl status menu.

    DOKUMENTATION
    - Restart=, RestartSec=: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=
    - StartLimitIntervalSec=, StartLimitBurst=, PartOf=, BindsTo=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
