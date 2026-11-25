### Geschichte „Die Genossenschaft“, Kapitel „Die Updates“: apt upgrade über
### eine wacklige Verbindung (tmux), Neustart für den Kernel, und ein Dienst,
### der nicht zurückkommt. Befehle, Pfade und die Ausgaben von apt, dpkg und
### tmux (auf Englisch) werden nicht übersetzt.

chapter-updates = Die Updates
    .summary = Monate im Rückstand: apt upgrade über ein WLAN, das ständig abbricht (tmux, dpkg --configure -a), ein neuer Kernel, und ein Neustart, der einen vergessenen Dienst ans Licht bringt.

## Dateien

updates-email-awa =
    Von:     Awa
    An:      dich
    Betreff: Updates

    Marc hat den Server nie aktualisiert („es läuft, nicht anfassen“). Der
    Zahlungsanbieter verlangt, dass Sicherheitskorrekturen installiert
    werden. Könntest du heute Morgen, vor der Öffnung (10 Uhr):

    1. die Updates installieren (man apt: zuerst update);
    2. den Server neu starten, falls nötig;
    3. prüfen, dass danach alles läuft: die Website UND die Kasse.

    Vorsicht: Das WLAN der Genossenschaft bricht ab und zu ab (der Router
    ist müde). Falls deine Verbindung mitten im Update abbricht… Gaspard,
    vom Bürgerhaus, hat gesagt, ich soll dir tmux nennen.

    Für sudo: radieschen-2027

## Ereignisse

updates-event-interrupted =
    Die Verbindung ist mitten im Update abgebrochen, und dpkg mit ihr:
    Einige Pakete sind entpackt, aber nicht konfiguriert. apt weigert sich
    weiterzumachen, bis die Arbeit zu Ende ist: sudo dpkg --configure -a
    (man dpkg).

    Nächstes Mal: Starte eine lange Operation auf einem Server in tmux:
    Sie übersteht die Verbindung.
updates-event-in-tmux =
    Deine Verbindung ist abgebrochen… aber das Update lief in tmux: Es ist
    bis zum Ende durchgelaufen, ohne dich. Häng dich wieder an deine
    Sitzung (tmux ls, dann tmux attach), um zu sehen, wie es ausgegangen ist.
# { $oldest }: der laufende Kernel; { $new }: der gerade installierte
updates-event-a-day =
    Die Updates sind installiert. Aber der neue Kernel ({ $new }) läuft
    noch nicht: uname -r sagt noch { $oldest }. Schau in
    /var/run/reboot-required.pkgs: Du musst neu starten (vor 10 Uhr!).
updates-event-till-down =
    Der Server ist mit dem neuen Kernel neu gestartet… aber die Kasse
    antwortet nicht mehr. systemctl status till: „disabled“. Marc hat sie
    von Hand gestartet; ihr Dienst wurde nie für den Start aktiviert
    (man systemctl: enable).
updates-event-end =
    Die Korrekturen sind installiert, der neue Kernel läuft, und sowohl
    die Website als auch die Kasse sind von selbst zurückgekommen. Es ist
    9:50 Uhr. Awa: „Genau rechtzeitig. Wir machen auf!“

    Gut gemacht! Du hast das Kapitel „Die Updates“ abgeschlossen.

    WAS PASSIERT IST
    apt upgrade lädt die neuen Versionen herunter, entpackt sie und
    konfiguriert sie dann. Stirbt die Sitzung dazwischen, bleibt dpkg auf
    halbem Weg stehen. tmux hält die Sitzung auf dem Server: Die
    Verbindung kann abbrechen, die Arbeit geht weiter. Ein neuer Kernel
    wird erst nach einem Neustart benutzt (uname -r), und ein Neustart
    startet nur Dienste, die aktiviert sind.

    GUTE PRAXIS
    - Sicherheitsupdates, oft (und automatisch: das Paket
      unattended-upgrades).
    - Lange Operationen in tmux (oder screen).
    - /var/run/reboot-required lesen, bevor man „fertig“ sagt, und zu
      einem selbst gewählten Zeitpunkt neu starten.
    - Nach einem Neustart: systemctl --failed, und die wichtigen Dienste
      prüfen; jeder nützliche Dienst muss aktiviert sein (enable).

    DOKUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - tmux: https://man.openbsd.org/tmux
    - Debian, Updates: https://www.debian.org/doc/manuals/debian-reference/ch02.en.html
