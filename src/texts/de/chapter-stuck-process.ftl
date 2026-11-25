### Geschichte „Die Sternwarte“, Kapitel 4 „Der hängende Prozess“: Signale
### (TERM, KILL), der trap eines Skripts, eine verwaiste PID-Datei.
### Befehle, Pfade und die Ausgaben der Werkzeuge werden nicht übersetzt.

chapter-stuck-process = Der hängende Prozess
    .summary = Die Kopie der letzten Nacht auf das NAS des Vereins ist nie fertig geworden: rsync wartet, sein Skript versucht es endlos erneut und lässt sich nicht stoppen. Werd es sauber los, damit die Kopie heute Nacht läuft.

## Dateien

stuck-process-message-amara =
    Von:     Amara
    An:      dich
    Betreff: Die NAS-Kopie hängt

    Hallo,

    Jede Nacht um 2 Uhr startet cron /usr/local/bin/sync-photos, das die
    Galerie auf das NAS des Vereins kopiert. Letzte Nacht war das NAS aus
    (ein Stromausfall im Vereinsraum). Seit 9 Uhr ist es wieder da, aber
    die Kopie, die um 2 Uhr gestartet ist, ist immer noch da und hängt.

    Und wenn sie heute Nacht noch da ist, startet die neue Kopie gar nicht
    erst: Das Skript führt eine PID-Datei und gibt auf, wenn es eine
    findet.

    Ich habe kill darauf versucht, nichts ist passiert. Kannst du sie
    verschwinden lassen, und prüfen, dass die Kopie heute Nacht läuft?

    Gleiches sudo-Passwort: nebel-2028.

    Amara

## Ereignisse

stuck-process-event-stuck =
    Die Kopie: ein /bin/bash-Skript (sync-photos) und sein Kind, rsync,
    das seit 2 Uhr auf das NAS wartet. ps -ef zeigt, wer wen gestartet hat
    (die Spalte PPID).
stuck-process-event-ignored =
    SIG{ $signal } geschickt, und das Skript ist immer noch da: kein Fehler,
    nichts. Ein Prozess kann ein Signal ignorieren, oder auf seine eigene
    Art behandeln (schau dir das Skript an: trap). Nur zwei Signale können
    weder abgefangen noch ignoriert werden (man 7 signal).
stuck-process-event-respawn =
    rsync ist gestorben… und ein neues ist aufgetaucht (PID { $pid }): Das
    Skript versucht es in einer Schleife erneut („until rsync …; do sleep
    60; done“). Solange das Skript lebt, bringt es nichts, sein Kind zu
    beenden.
stuck-process-event-orphan =
    Das Skript ist weg, aber sein rsync ist noch da: Die Kinder eines
    Prozesses, der stirbt, werden nicht mit ihm beendet, sie werden von
    init adoptiert (PPID 1). rsync selbst ist ein gewöhnlicher Prozess: Es
    nimmt TERM an.
stuck-process-event-stale =
    Keine Prozesse mehr. Aber das Skript endete mit KILL: Es konnte seine
    letzte Zeile nicht ausführen (rm -f "$LOCK"). Seine PID-Datei sagt
    immer noch 3301, ein Prozess, den es nicht mehr gibt: Heute Nacht wird
    die neue Kopie sie finden und aufgeben („already running“). Eine
    verwaiste PID-Datei entfernt man von Hand, nachdem man geprüft hat,
    dass der Prozess wirklich weg ist.
stuck-process-event-early-lock =
    Die PID-Datei ist weg, aber das hängende Skript läuft noch: Heute Nacht
    startet eine zweite Kopie daneben. Die Datei kommt erst weg, wenn
    niemand sie mehr hält.
stuck-process-event-cron-stopped =
    cron ist gestoppt: Heute Nacht startet überhaupt nichts die Kopie.
    Starte ihn wieder (sudo systemctl start cron).
stuck-process-event-end =
    Keine Kopie läuft mehr, keine PID-Datei: Heute Nacht um 2 Uhr startet
    cron sync-photos, und es wird das NAS finden. Amara: „Ich gebe rsync
    ein Timeout mit (--timeout), damit es nächstes Mal von selbst aufgibt.“

    Gut gemacht! Du hast das Kapitel „Der hängende Prozess“ abgeschlossen.

    WAS PASSIERT IST
    rsync hat die ganze Nacht auf das NAS gewartet. Sein Skript ignorierte
    TERM, INT und HUP (trap '' …) und startete rsync jedes Mal neu, wenn
    es starb. kill ohne Option schickt TERM: ignoriert.

    DIE SIGNALE
    - TERM (15): „bitte beende dich“; der Standard von kill. Ein Programm
      kann es abfangen, um aufzuräumen, oder es ignorieren.
    - KILL (9): Der Kernel beendet den Prozess sofort. Es kann nicht
      abgefangen werden: gar kein Aufräumen (hier bleibt die PID-Datei).
    - HUP (1): bei einem Daemon oft „lies deine Konfiguration neu“; INT
      (2): Strg-C; STOP und CONT: anhalten, fortsetzen.
    - Die Kinder eines beendeten Prozesses sterben nicht mit ihm: Sie
      werden von init adoptiert.

    GUTE PRAXIS
    - Zuerst TERM, ein wenig warten, KILL nur wenn nötig, und dann
      aufräumen, was das Programm selbst aufgeräumt hätte.
    - Schau dir die Eltern an: ps -ef, ps -o pid,ppid,stat,args.
    - Bevor du eine PID-Datei entfernst, prüf ihren Prozess: ps -p PID.
    - Eine Kopie über das Netz braucht ein Timeout (rsync --timeout).

    DOKUMENTATION
    - Die Signale: https://man7.org/linux/man-pages/man7/signal.7.html
    - kill: https://man7.org/linux/man-pages/man1/kill.1.html
    - trap: https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html#index-trap
