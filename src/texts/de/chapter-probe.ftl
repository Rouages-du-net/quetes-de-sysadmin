### Geschichte „Bereitschaft“, Kapitel 5 „Die Sonde“: Monitoring (Plugins
### von monitoring-plugins, mail -E), ein systemd-Timer (oder cron) und
### eine nächtliche Störungsübung. Befehle, Optionen, Direktiven und die
### Meldungen der Werkzeuge werden nicht übersetzt.

chapter-probe = Die Sonde
    .summary = Vier Nächte lang hinterher repariert: Diesmal will Zoé gewarnt werden, bevor etwas kaputtgeht. Und heute Nacht organisiert sie eine Übung…

## Dateien

probe-message-zoe =
    Eine Nachricht von Zoé (Montag, 18:20 Uhr):

    „Vier Nächte, vier Störungen, und jedes Mal haben wir es zu spät
    gemerkt. Ich habe eine Sonde angefangen: /usr/local/bin/probe. Sie
    führt Prüfungen aus (die ‚Plugins‘ des Monitorings, die von Nagios
    oder Icinga) und schickt mir per Mail alles, was nicht OK ist. Die
    Post von root kommt bei mir an (/etc/aliases), und von dort auf mein
    Handy.

    Es gibt noch Arbeit: Sie schaut nur auf die Systemplatte, und nichts
    führt sie aus. Könntest du sie vervollständigen und dafür sorgen, dass
    sie alle 5 Minuten läuft?

    Und um zu wissen, ob sie wirklich funktioniert, schlage ich eine Übung
    vor: In der Nacht darauf verursache ich zwei Störungen, ohne zu sagen,
    welche. Sobald deine Sonde geplant ist, starte ich die Übung. Werde ich
    rechtzeitig gewarnt, repariere ich. Aber keine Fehlalarme, okay? Ich
    will schlafen können.“
probe-script =
    #!/bin/sh
    # Die Sonde von Radio Viertel (Zoé, in Arbeit).
    # Jede Prüfung, die nicht OK ist, wird per Mail geschickt (mail -E: nichts, wenn alles gut ist).
    # Die Prüfungen kommen aus monitoring-plugins (wie bei Nagios oder Icinga):
    # Sie schreiben eine Zeile, OK, WARNING oder CRITICAL (man check_disk).
    P=/usr/lib/nagios/plugins
    ALERT="mail -E -s Radio-Alarm root"

    # Die Systemplatte: Warnung unter 20 % frei, kritisch unter 10 %.
    $P/check_disk -w 20% -c 10% -p / | grep -v " OK" | $ALERT

    # TODO: das Datenvolume, /srv/radio (und seine Inodes: denk dran…)
    # TODO: Antwortet der Livestream? (das Relay lauscht auf Port 8000, Pfad /live)
    # TODO: alle 5 Minuten ausführen (cron? ein systemd-Timer?)
probe-podcasts-readme =
    Vorschaubilder der Podcasts: Der automatische Import legt sie in
    vorschaubilder/ ab (ein Bild pro Folge).

## Die Nacht der Übung

# { $runs }: wie oft die Sonde (oder ein geplanter Auftrag) gelaufen ist
probe-night =
    Deine Sonde ist geplant: Zoé startet die Übung. Der Abend, dann die
    Nacht vergehen ({ $runs ->
        [0] kein geplanter Auftrag ist gelaufen
        [one] ein geplanter Auftrag ist einmal gelaufen
       *[other] die geplanten Aufträge sind { $runs }-mal gelaufen
    }).
# { $alert }, { $repaired }: Uhrzeiten; { $minutes }: Dauer der Stille
probe-night-relay-seen =
    1:10 Uhr: Zoé stoppt das Stream-Relay, ganz plötzlich. Um { $alert }
    klingelt ihr Handy; sie startet das Relay um { $repaired } neu. Der
    Livestream war { $minutes } Minuten lang still.
probe-night-relay-missed =
    1:10 Uhr: Zoé stoppt das Stream-Relay, ganz plötzlich… und niemand
    wird gewarnt. Der Livestream bleibt bis zum Morgen still. Was prüft
    deine Sonde, wenn das Relay nicht mehr antwortet? (man check_http,
    man check_procs)
probe-night-relay-slow =
    Der Alarm ist angekommen, aber mehr als 15 Minuten nach der Störung:
    Für einen Radiosender ist das lang. Wie oft läuft die Sonde?
    (systemctl list-timers, systemd-analyze calendar)
# { $alert }: Uhrzeit
probe-night-inodes-seen =
    1:40 Uhr: Der Import der Vorschaubilder gerät außer Kontrolle und legt
    Tausende kleiner Dateien auf /srv/radio an. Um { $alert }, lange bevor
    die Inodes ausgehen, wird Zoé gewarnt und stoppt den Import.
# { $full }: Uhrzeit
probe-night-inodes-missed =
    1:40 Uhr: Der Import der Vorschaubilder gerät außer Kontrolle und legt
    Tausende kleiner Dateien auf /srv/radio an. Um { $full } ist keine
    einzige Inode mehr frei: Die nächtliche Aufnahme scheitert, ohne dass
    jemand gewarnt wird. Überwacht check_disk dieses Volume, und seine
    Inodes? (man check_disk: -W und -K)
# { $count }: Alarme, die eingingen, als alles in Ordnung war
probe-night-false =
    { $count ->
        [one] Zoé hat einen Alarm bekommen
       *[other] Zoé hat { $count } Alarme bekommen
    }, während alles in Ordnung war. Alarme für nichts, und nach ein paar
    Nächten liest sie niemand mehr: eine zu enge Schwelle, eine Prüfung,
    die auch schreibt, wenn alles gut ist (cron schickt auch alles per
    Mail, was ein Auftrag schreibt)?
probe-night-never =
    Die ganze Nacht ist nichts gelaufen. Ist der Timer gestartet, und
    löst er wirklich aus (systemctl list-timers)? Vorsicht:
    OnUnitActiveSec= allein löst nie aus, weil der Dienst noch nie
    gelaufen ist (man systemd.timer).

## Ereignisse

# { $directory }: das Verzeichnis der Plugins
probe-event-plugin-outside-path =
    Die Monitoring-Plugins sind nicht im PATH: Unter Debian liegen sie in
    { $directory } und werden über ihren vollständigen Pfad ausgeführt
    (wie in Zoés Sonde).
probe-event-first-alert =
    Zoé: „Deine Mail ist angekommen!“ Einen Alarm zu testen, bevor man ihn
    braucht, ist die richtige Idee.
probe-event-end =
    Beide Störungen der Übung wurden rechtzeitig erkannt, und den Rest der
    Zeit war die Nacht ruhig. Zoé: „Ich habe während einer Störung noch nie
    so gut geschlafen.“

    Gut gemacht! Du hast Kapitel 5 von „Bereitschaft“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: ssh radio.)

    WAS PASSIERT IST
    Eine Sonde führt Prüfungen aus (Plugins: eine Zeile und ein
    Rückgabewert, 0 OK, 1 WARNING, 2 CRITICAL) und warnt dich, wenn etwas
    nicht stimmt. Man musste überwachen, was schon einmal kaputtgegangen
    war (die Platte, die Inodes, der Livestream), sie oft ausführen (ein
    systemd-Timer) und sie mit einer Störungsübung testen.

    GUTE PRAXIS
    - Überwachen, was für die Leute zählt (antwortet der Livestream?),
      nicht nur die Ressourcen.
    - Schwellen, die Zeit zum Handeln lassen (Warnung bei 80 %, kritisch
      bei 90 %), Inodes eingeschlossen.
    - Keine Alarme für nichts: Jeder Alarm sollte eine Handlung verlangen.
    - Ein systemd-Timer (oder cron) für die Regelmäßigkeit; systemctl
      list-timers und journalctl -u, um zu prüfen, dass er läuft.
    - Die Alarme testen: Eine Störungsübung ist besser als eine echte
      Überraschung. Die vollständigen Werkzeuge (Icinga, Zabbix,
      Prometheus…) bauen auf denselben Ideen auf.

    EIN ANDERER WEG
    Zentrales Monitoring: Icinga oder Nagios (die dieselben
    check_*-Plugins benutzen), Prometheus und seine Alarme, Uptime Kuma,
    um Websites zu überwachen, Monit, das auch Dienste neu startet. Ein
    Skript und ein Timer reichen für eine kleine Maschine; darüber hinaus
    sieht ein zentrales Werkzeug alle Maschinen und behält die Historie.

    DOKUMENTATION
    - Plugins und ihre Rückgabewerte: https://www.monitoring-plugins.org/doc/guidelines.html
    - check_disk: https://www.monitoring-plugins.org/doc/man/check_disk.html
    - systemd-Timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
