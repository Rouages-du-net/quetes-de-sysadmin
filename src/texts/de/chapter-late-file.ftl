### Geschichte „Der Nachtlauf“, Kapitel „Die verspätete Datei“: Der Timer
### hat den Batch gestartet, bevor die Datei des Rechenzentrums ankam. Auf
### die vollständige Datei warten, sie nie zweimal verarbeiten und ein
### Scheitern sichtbar machen. Befehle, Pfade, Unit-Dateien und
### Programmausgaben werden nicht übersetzt.

chapter-late-file = Die verspätete Datei
    .summary = Der Batch lief um 02:00 auf der Datei von gestern und hat nichts gesagt: ihn auf die vollständige Datei warten lassen, sie einmal verarbeiten, und dich benachrichtigen, wenn er scheitert.

## Dateien

late-file-email-ayesha =
    Von:  Ayesha
    An:   dich

    Schlechte Nachrichten. Heute Morgen hat die Buchhaltung bemerkt, dass
    der Einzugsbericht dasselbe Laufdatum hatte wie der von gestern: Um
    02:00 hat der Batch die Datei vom 22. ein zweites Mal verarbeitet. Die
    Datei des Rechenzentrums kam letzte Nacht um 02:41 an, nach unserem
    Timer. Und der Batch hat nichts gesagt: Der Dienst endete
    „erfolgreich“.

    Ich habe ihn um 8:10 von Hand auf die richtige Datei angewandt und das
    .done weggenommen (das Rechenzentrum schreibt contrib.ebc.done, sobald
    sein Upload vollständig ist). Der Bericht stimmt jetzt: Niemand wird
    doppelt belastet.

    Das Rechenzentrum warnt, dass seine Datei wieder zu spät kommen kann.
    Könntest du die Verrohrung reparieren? Der Batch muss auf die
    vollständige Datei warten, darf dieselbe Datei nie zweimal verarbeiten,
    und wenn das Programm schlecht endet, müssen wir es erfahren (eine Mail
    an mich oder an dich reicht). Der Timer und der Dienst liegen in
    /etc/systemd/system, das Wrapper-Skript ist /opt/batch/run-night.sh.

    Das Rechenzentrum ist mit einer Probe einverstanden: Jedes Mal, wenn
    du das Wrapper-Skript, die Units oder eine crontab änderst, kommen
    seine nächsten beiden Nächte absichtlich zu spät, und in der zweiten
    Datei fehlt ein Satz.

    Ayesha

## Die Probe

late-file-rehearsal = Probe mit dem Rechenzentrum: die nächsten beiden Nächte (Ayesha nimmt vorher jedes in /srv/drop liegen gebliebene .done weg).
late-file-night-first = Nacht vom { $date }: Die Datei ist zu spät, ihr .done kommt um { $done }.
late-file-night-second = Nacht vom { $date }: Die Datei ist noch später, ihr .done kommt um { $done }, und ein Satz fehlt (der Schlusssatz zählt ihn noch).
late-file-run = { $time }: Der Batch lief auf der Datei vom { $date }, Rückgabewert { $rc }.
late-file-more-runs = …und { $count } weitere Läufe.
late-file-no-run = Der Batch hat keine Datei verarbeitet.
late-file-verdict-stale = Falsch: Er hat eine alte Datei verarbeitet, und die Mitglieder würden doppelt belastet. Verarbeite nur eine Datei, deren .done da ist.
late-file-verdict-partial = Falsch: Er hat mit einer Datei angefangen, die noch geschrieben wurde (noch kein Schlusssatz: Rückgabewert 12). Warte auf das .done.
late-file-verdict-none = Falsch: Die Datei von heute Nacht wurde nie verarbeitet. Versucht es der Batch nach 02:00 noch einmal? Hat systemd den Timer neu geladen, und ist er aktiv (systemctl daemon-reload, systemctl list-timers)? Oder ist die crontab installiert?
late-file-verdict-twice = Falsch: Die Datei von heute Nacht wurde { $count }-mal verarbeitet. Sobald sie verarbeitet ist, nimm ihr .done weg (rm oder mv).
late-file-verdict-too-late = Falsch: um { $time } verarbeitet, nach 07:00, wenn die Buchhaltung den Bericht an die Bank schickt. Versuch es öfter.
late-file-verdict-ok = Richtig: einmal verarbeitet, vollständig, mit Rückgabewert 0.
late-file-verdict-mailed = Richtig: Rückgabewert 8, und { $who } hat um { $time } eine Mail bekommen.
late-file-verdict-failed = Richtig: Rückgabewert 8, und systemd hat { $unit } um { $time } als fehlgeschlagen markiert (systemctl status, journalctl -u).
late-file-verdict-silent = Falsch: Rückgabewert 8, aber niemand weiß es. Der Dienst endete erfolgreich, und niemand hat eine Mail bekommen: Das Wrapper-Skript muss den Code des Programms weitergeben (set -e, oder mit ihm beenden) oder eine Mail schicken.
late-file-rehearsal-again = Ändere, was zu ändern ist: Das Rechenzentrum probt die nächsten beiden Nächte noch einmal.

## Ereignisse

late-file-event-diagnosed =
    Da ist es: Der Batch lief am Donnerstag um 02:00 und am Freitag noch
    einmal, und beide Läufe haben die Datei vom 22. gelesen (RUN DATE
    291122). Am Freitag um 02:00 war die neue Datei noch nicht da; der
    Timer weiß das nicht, er kennt nur die Uhrzeit.
late-file-event-unscheduled =
    Nichts ist mehr geplant: kein aktiver Timer, keine crontab. Heute Nacht
    läuft der Batch überhaupt nicht.
late-file-event-first-night =
    Die verspätete Nacht ist gut gelaufen: Der Batch hat auf das .done
    gewartet und die Datei dann einmal verarbeitet, mit Rückgabewert 0.
late-file-event-second-night =
    Die unvollständige Datei wurde erwischt: Rückgabewert 8, und jemand
    weiß es.
late-file-event-end =
    Ayesha: „Zwei Nächte, zwei Fallen, und der Batch ist durch beide
    gekommen. Ramón hat dein Wrapper-Skript gelesen: Er sagt, es ist das
    erste Mal in dreißig Jahren, dass der Batch jemandem Bescheid sagt,
    wenn etwas nicht stimmt.“

    Gut gemacht! Du hast das Kapitel „Die verspätete Datei“ und die
    Geschichte „Der Nachtlauf“ abgeschlossen.

    WAS PASSIERT IST
    Der Timer startete den Batch zu einer festen Uhrzeit, ob die Datei da
    war oder nicht, und das Wrapper-Skript endete mit einem echo: Sein
    Exit-Code war immer 0. Das Programm hatte getan, was man ihm sagte. Du
    hast die Verrohrung drumherum geändert: Der Batch wartet jetzt auf das
    .done des Rechenzentrums (das Zeichen, dass der Upload vollständig
    ist), nimmt es weg, sobald die Datei verarbeitet ist, versucht es in
    der Nacht erneut und gibt den Rückgabewert des Programms weiter, damit
    ein Scheitern gesehen wird.

    GUTE PRAXIS
    - Einen Job auf ein Ereignis hin starten (die Datei ist vollständig:
      ein .done, eine Größe, die sich nicht mehr ändert), nicht nur zu
      einer Uhrzeit.
    - Einen Job idempotent machen: Dieselbe Datei darf nie zweimal
      verarbeitet werden (ihr Kennzeichen wegnehmen, sie in ein Archiv
      verschieben).
    - Ein Wrapper-Skript gibt die Rückgabewerte seiner Programme weiter
      (set -e, exit $RC): systemd markiert den Dienst als fehlgeschlagen
      (systemctl --failed), cron schickt die Ausgabe per Mail.
    - Einen Menschen warnen und eine Frist setzen: Eine Datei, die nie
      kommt, ist auch ein Vorfall.

    EIN ANDERER WEG
    Eine systemd-Path-Unit (PathExists=/srv/drop/contrib.ebc.done) startet
    den Dienst, sobald das .done erscheint, ohne es alle zehn Minuten zu
    versuchen; OnFailure= startet eine andere Unit (eine Mail), wenn der
    Dienst scheitert. Auf einem Mainframe hat der Scheduler (und das COND
    der JCL) all das erledigt: Das ist der Teil, der beim Umzug die meiste
    Sorgfalt braucht.

    DOKUMENTATION
    - systemd.timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - systemd.path: https://www.freedesktop.org/software/systemd/man/latest/systemd.path.html
    - sh, set -e und exit: https://manpages.debian.org/bookworm/dash/sh.1.en.html
    - crontab(5): https://manpages.debian.org/bookworm/cron/crontab.5.en.html
