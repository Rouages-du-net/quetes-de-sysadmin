### Geschichte „Die Kletterhalle“, Kapitel „Alte Batterie“: eine
### verschlissene Batterie, ihr Schnelltest (upscmd, instcmds in upsd.users),
### das Datum einer neuen Kartusche (upsrw battery.mfr.date), Alarme über
### upssched (NOTIFYCMD, AT … START-TIMER, CANCEL-TIMER). Befehle, Optionen,
### Pfade, Konfigurationszeilen und Ausgaben werden nicht übersetzt.

chapter-old-battery = Alte Batterie
    .summary = Zwei Monate nach dem Sturm verspricht die USV zehn Minuten Batterie statt fünfzig, und das Postfach des Empfangs ertrinkt in „UPS: ONBATT“, jedes Mal wenn die Ventilatoren anlaufen. Teste die Batterie, ohne sie zu leeren, lass eine neue einsetzen und bring den Alarmen bei, ein Flackern von einem Stromausfall zu unterscheiden.

## Files

old-battery-message-thandiwe =
    Von: Thandiwe (Empfang, Overhang)
    Montag, 17. Januar, 10:20

    Guten Morgen,

    zwei Dinge, und vielleicht sind sie eins.

    1. Mein Postfach. Jedes Mal, wenn die großen Ventilatoren im
       Boulderraum anlaufen, flackert das Licht, und ich bekomme zwei Mails:
       „UPS: ONBATT“, dann „UPS: ONLINE“. 38 allein am Samstag. Ich habe
       angefangen, sie zu ignorieren, und das ist sicher nicht der Sinn der
       Sache. Können wir nur dann eine Mail bekommen, wenn der Strom wirklich
       weg ist? (Sie gehen an „volunteers“, also an mich: /var/mail/thandiwe
       auf sicherung.)

    2. Ikaika hat heute Morgen das Display der USV gelesen: Es sagt etwa
       zehn Minuten Batterie. Im November waren es fast eine Stunde. Harutos
       Notizen sagen, die Batterie ist von 2028. Ikaika hat eine
       Ersatzkartusche im Büro (eine APC RBC, sie lässt sich im laufenden
       Betrieb der USV tauschen), aber er hätte gern einen Beweis, bevor er
       etwas öffnet.

    Die Halle ist offen (der Kurs um 10:00 ist an den Wänden), also bitte
    nichts, was den Strom abschaltet! Haruto hat für so etwas ein
    Admin-Konto in upsd.users hinterlassen; sein Passwort steht in der
    Datei.

    Thandiwe

## Events

old-battery-event-runtime =
    battery.runtime ist in Sekunden: zehn Minuten bei der heutigen Last, für
    eine Batterie, die im November fünfzig hergab. ups.test.result sagt, wann
    die USV sich zuletzt selbst getestet hat. Ein Schnelltest (ein paar
    Sekunden auf Batterie) zeigt den Zustand der Batterie, ohne sie zu
    leeren: upscmd -l hallups listet, was die USV kann.

old-battery-event-flapping =
    Wieder ein Paar Mails in Thandiwes Postfach: Die Leitung hat ein paar
    Sekunden lang geflackert, upsmon sah ONBATT und dann ONLINE, und
    NOTIFYCMD hat beides gemailt. upsmon schickt jedes Ereignis sofort; um
    abzuwarten, ob ein Ereignis anhält, gibt upsmon es an upssched weiter
    (man upssched).

old-battery-event-denied =
    upsd hat abgelehnt: Ein Sofortbefehl braucht ein Konto, das ihn ausführen
    darf. In upsd.users listet instcmds die Befehle, die ein Konto ausführen
    darf (oder ALL); actions = SET ist nur zum Ändern von Variablen. upsd
    liest upsd.users bei einem reload neu.

old-battery-event-deep =
    Ein Tiefentest ist eine Kalibrierung: Die USV betreibt die Halle mit
    ihrer Batterie, bis sie fast leer ist. Bei offener Halle und
    verschlissener Batterie bliebe bei einem echten Ausfall währenddessen
    nichts übrig. Stoppe ihn (test.battery.stop) und heb Tiefentests für
    Schließzeiten auf, mit einer gesunden Batterie.

old-battery-event-warning =
    „Done and warning“, und ups.status zeigt jetzt RB: Die USV verlangt eine
    neue Batterie. Ikaika, glücklich über seinen Beweis, tauscht die
    Kartusche im laufenden Betrieb („klick, klick: fertig“). Die neue ist zu
    92 % geladen. Die USV glaubt noch, ihre Batterie sei von 2028
    (battery.mfr.date): Dieses Datum ist bei diesem Modell beschreibbar
    (upsrw -l hallups). Auf dem Etikett der Kartusche steht 2032/12/02.

old-battery-event-date =
    battery.mfr.date ist jetzt das der neuen Kartusche: Wer als Nächstes
    upsc liest, weiß, wie alt die Batterie ist.

old-battery-event-passed =
    Der Schnelltest besteht mit der neuen Batterie: „Done and passed“, RB
    ist weg, battery.runtime wieder bei etwa fünfzig Minuten.

old-battery-event-sched-error =
    NOTIFYCMD ist upssched, aber upssched.conf hält es an: Es braucht
    CMDSCRIPT, PIPEFN und LOCKFN vor seiner ersten AT-Zeile (journalctl -u
    nut-monitor: „must be set before any ATs“).

old-battery-event-silenced =
    Jetzt würde nicht einmal ein echter Ausfall jemandem eine Mail schicken:
    Die Alarme sind stummgeschaltet statt sortiert. Ein anhaltender Ausfall
    muss die Ehrenamtlichen immer noch warnen.

old-battery-event-still-flapping =
    Ein Flackern von ein paar Sekunden schickt immer noch eine Mail: Bei
    jedem ONBATT oder jedem ONLINE läuft etwas. Ein Timer, der bei ONBATT
    gestartet und bei ONLINE abgebrochen wird, löst nur aus, wenn der Strom
    weg bleibt (der optionale Befehl von CANCEL-TIMER läuft nur, wenn der
    Timer schon ausgelöst hatte).

old-battery-event-alerts =
    Die Alarme sind sortiert: Ein Flackern von ein paar Sekunden startet den
    Timer von upssched, und ONLINE bricht ihn still ab; ein anhaltender
    Ausfall lässt ihn auslösen und mailt den Ehrenamtlichen einmal.

old-battery-event-end =
    Thandiwe: „Keine einzige Mail seit dem Mittagessen, und Ikaika hat die
    alte Kartusche mit einem Lächeln in die Recyclingkiste gelegt. Danke!“

    Gut gemacht! Du hast „Alte Batterie“ abgeschlossen.

    WAS PASSIERT IST
    Die Batterie, von 2028 und beim Ausfall im November völlig entladen,
    hatte den größten Teil ihrer Kapazität verloren. Ein Schnelltest
    (upscmd, sobald das Admin-Konto instcmds in upsd.users hatte) gab das
    Urteil der USV, „Done and warning“, und das Flag RB. Nach dem Tausch hast
    du das Datum der neuen Batterie mit upsrw geschrieben und erneut
    getestet. Inzwischen mailte NOTIFYCMD von upsmon jedes Flackern; mit
    upssched startet ONBATT einen Timer, den ONLINE abbricht, sodass nur ein
    anhaltender Ausfall mailt.

    GUTE PRAXIS
    - Teste die Batterie regelmäßig mit dem Schnelltest, zu ruhigen Zeiten:
      Er zeigt den Zustand der Batterie in Sekunden. Heb Tiefentests
      (Kalibrierung) für Schließzeiten auf, mit einer gesunden Batterie.
    - Blei-Säure-Batterien von USVs halten drei bis fünf Jahre, weniger nach
      Tiefentladungen: Schreib das Datum auf, wenn du eine wechselst
      (battery.mfr.date oder battery.date, wo die USV es zulässt), und plane
      die nächste.
    - Gib Konten nur, was sie brauchen: instcmds für die Tests, actions =
      SET für Variablen, nichts für die Leser von upsc.
    - Ein Alarm muss etwas bedeuten: Warte (die Timer von upssched), bevor du
      über einen Zustand mailst, der vielleicht nur Sekunden dauert; schalte
      nie alles stumm.
    - REPLBATT (RB) verdient auch eine Mail: AT REPLBATT * EXECUTE replbatt.

    DOKUMENTATION
    - upscmd(8): https://networkupstools.org/docs/man/upscmd.html
    - upsrw(8): https://networkupstools.org/docs/man/upsrw.html
    - upssched(8): https://networkupstools.org/docs/man/upssched.html
    - upssched.conf(5): https://networkupstools.org/docs/man/upssched.conf.html
    - Benachrichtigung und Planung: https://networkupstools.org/docs/user-manual.chunked/Advanced_usage_scheduling_notes.html
    - upsd.users(5): https://networkupstools.org/docs/man/upsd.users.html
