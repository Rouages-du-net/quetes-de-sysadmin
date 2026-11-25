### Geschichte „Bereitschaft“, Kapitel 3 „Die Inodes“: ein Volume voller
### Inodes und fast ohne Bytes (df -i, du --inodes), „Argument list too
### long“, find -mtime -delete und cron. Befehle, Optionen und die
### Meldungen der Werkzeuge werden nicht übersetzt.

chapter-inodes = Die Inodes
    .summary = 3:20 Uhr, „No space left on device“… auf einer fast leeren Platte. Was fehlt, wenn nicht Platz?

## Dateien

inodes-message-zoe =
    Eine Nachricht von Zoé (3:05 Uhr):

    „Ich verstehe gar nichts mehr. Die Aufnahme des Nachtprogramms ist
    wieder gescheitert: ‚No space left on device‘, genau wie letzte Woche!
    Nur sagt df -h diesmal, dass das Datenvolume (/srv/radio) fast leer
    ist. Und das Relay kann die Hörvorgänge nicht mehr protokollieren
    (journalctl -u radio-stream).

    PS: Die Hörstatistiken werden für den Monatsbericht an das Rathaus
    gebraucht. Wir müssen mindestens die letzten 30 Tage behalten.“
inodes-conf-stream =
    # Radio Viertel: Stream-Relay (der Dienst radio-stream)
    port = 8000
    mount = /live
    logfile = /var/log/radio/stream.log
    loglevel = info
    # Aufnahmen der Sendungen
    record_dir = /srv/radio/sendungen
    # Statistiken: eine Datei pro Hörvorgang (Monatsbericht für das Rathaus)
    stats_dir = /srv/radio/stats
inodes-stats-readme =
    Hörstatistiken, vom Relay geschrieben: eine kleine Datei pro
    Hörvorgang (anonymisierte Adresse, Dauer). Der Monatsbericht für das
    Rathaus liest die Dateien des vergangenen Monats.
    (Zoé, März 2027: daran denken, ab und zu aufzuräumen…)

## Die simulierte Nacht

# { $command }: der Befehl des cron-Auftrags; { $output }: was er geschrieben hat
inodes-mail =
    Post von cron (Cron Daemon) zu: { $command }
    { $output }
# { $jobs }: ausgeführte Aufträge; { $deleted }: gelöschte Dateien; { $oldest }: Alter der ältesten, in Tagen; { $percent }: belegte Inodes
inodes-night =
    Ein Tag und eine Nacht vergehen. Das Relay protokolliert seine
    Hörvorgänge; cron führt { $jobs ->
        [0] keinen Auftrag
        [one] einen Auftrag
       *[other] { $jobs } Aufträge
    } aus. Am Morgen: { $deleted ->
        [one] { $deleted } Statistikdatei weniger
       *[other] { $deleted } Statistikdateien weniger
    }, die älteste ist { $oldest } Tage alt, und { $percent } % der
    Inodes von /srv/radio sind belegt.
inodes-night-recent-lost =
    Autsch: Statistiken, die weniger als 30 Tage alt sind, sind
    verschwunden, die für den Bericht ans Rathaus. Ein Auftrag, der alles
    löscht, ohne auf das Alter der Dateien zu schauen? Starte das Kapitel
    neu, um einen anderen Weg zu versuchen (Link unter dem Terminal), und
    teste deinen Befehl von Hand, bevor du ihn cron übergibst.
inodes-night-nothing =
    Dein Auftrag ist heute Nacht nicht gelaufen: Sein Zeitplan fällt
    nicht in die Nacht. Die fünf Felder (Minute, Stunde, Tag des Monats,
    Monat, Wochentag) erklärt man crontab.
# { $days }: Alter der ältesten Datei
inodes-night-too-old =
    Am Morgen gibt es noch Statistiken, die { $days } Tage alt sind: Der
    Auftrag hat nicht aufgeräumt. Führ seinen Befehl von Hand aus, um zu
    sehen, was er tut (und sudo crontab -l, um die Zeile noch einmal zu lesen).
# { $percent }: belegte Inodes
inodes-night-full =
    { $percent } % der Inodes sind noch belegt: Das Volume wird sich sehr
    schnell wieder füllen. Du solltest sie kürzer behalten (aber
    mindestens 30 Tage).

## Ereignisse

inodes-event-almost-empty =
    Das Datenvolume ist kaum gefüllt, und trotzdem lässt sich keine Datei
    mehr darauf anlegen. Platz ist nicht die einzige Ressource eines
    Dateisystems: Jede seiner Dateien braucht auch eine Inode (ihre
    Karteikarte: Besitzer, Rechte, Daten, wo ihre Daten liegen), und ihre
    Zahl wird beim Anlegen festgelegt. In man df zählt eine Option sie.
inodes-event-more-inodes =
    100 % der Inodes von /srv/radio sind belegt: Dort lässt sich keine
    einzige Datei mehr anlegen, nicht einmal eine leere, egal wie viel
    Platz frei ist. Wer hat so viele Dateien angelegt? du kann Inodes
    statt Bytes zählen (man du).
inodes-event-culprit =
    Zehntausende Dateien! Eine pro Hörvorgang, vom Relay seit März
    geschrieben, und nie gelöscht. Vor dem Löschen: Zoé will mindestens
    die letzten 30 Tage behalten. find kann Dateien nach ihrem Alter
    auswählen (man find).
inodes-event-too-long =
    „Argument list too long“: Die Shell ersetzt * durch alle Namen im
    Verzeichnis, BEVOR sie den Befehl ausführt, und die Liste passt nicht
    in den Platz, der für die Argumente eines Programms reserviert ist
    (etwa 2 MB). find dagegen durchläuft das Verzeichnis selbst: Es kann
    löschen, was es findet, ohne riesige Liste.
inodes-event-recent-lost =
    Vorsicht: Statistiken, die weniger als 30 Tage alt sind, sind
    verschwunden, die, die das Rathaus braucht. Starte das Kapitel neu, um
    einen anderen Weg zu versuchen (Link unter dem Terminal).
# { $percent }: belegte Inodes
inodes-event-restarts =
    Einige Inodes sind frei geworden ({ $percent } % belegt): Die
    nächtliche Aufnahme läuft wieder, und das Relay protokolliert wieder
    Hörvorgänge. Jetzt geht es darum, dass es nicht wieder passiert: ein
    cron-Auftrag, jede Nacht, der nur den letzten Monat behält (das Spiel
    lässt eine Nacht vergehen, um ihn bei der Arbeit zu sehen).
inodes-event-end =
    Die Nacht ist vergangen, der Auftrag hat aufgeräumt, und der letzte
    Monat der Statistiken ist unversehrt. Zoé: „Inodes… Ich kannte nicht
    einmal das Wort. Danke!“

    Gut gemacht! Du hast Kapitel 3 von „Bereitschaft“ abgeschlossen.

    WAS PASSIERT IST
    Das Relay hat sechs Monate lang eine kleine Datei pro Hörvorgang
    geschrieben, ohne sie je zu löschen. Das Volume hatte noch seinen
    ganzen Platz, aber keine einzige Inode mehr: Jede Datei braucht eine,
    und ihre Zahl wird beim Anlegen des Dateisystems festgelegt
    (standardmäßig eine pro 16 KiB). rm * kam nicht zurecht (zu viele
    Argumente); find hat mit -mtime und -delete die alten gelöscht und
    dabei den letzten Monat behalten, und cron macht es jede Nacht wieder.

    GUTE PRAXIS
    - „No space left on device“ bei freiem Platz: df -i.
    - Finden, wo die Dateien liegen: du --inodes (mit -d 1 oder -s).
    - Massenhaft mit find … -delete (oder -exec) löschen, nie rm * auf
      Tausende Dateien; erst ohne -delete testen.
    - Alle Daten, die sich anhäufen (Logs, Statistiken, Sitzungen, Caches),
      haben eine Aufbewahrungsdauer und einen Auftrag, der sie durchsetzt.
    - Die Inodes wie den Platz überwachen (ein Alarm bei 80 %).

    DOKUMENTATION
    - df (-i): https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html
    - find (-mtime, -delete): https://www.gnu.org/software/findutils/manual/html_mono/find.html
    - ARG_MAX und „Argument list too long“: https://man7.org/linux/man-pages/man2/execve.2.html
