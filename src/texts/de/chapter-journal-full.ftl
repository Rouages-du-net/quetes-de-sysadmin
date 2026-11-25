### Geschichte „Die Hütten“, Kapitel 2 „Das volle Journal“: das Journal
### von systemd auf der Platte, journalctl --disk-usage und --vacuum-*,
### SystemMaxUse=. Konfiguration, Pfade und die Ausgaben der Werkzeuge
### werden nicht übersetzt.

chapter-journal-full = Das volle Journal
    .summary = Die Platte im Tal ist zu 93 % voll. Die Dateien der Hütten sind klein; etwas anderes nimmt Gigabytes in /var/log. Gib den Platz zurück, und sorg dafür, dass er zurückgegeben bleibt.

## Dateien

journal-full-message-lou =
    Von:     Lou
    An:      dich
    Betreff: Platte fast voll

    Hallo,

    Das Panel des Hosters sagt, die Platte von tal ist zu 93 % voll. Die
    Log-Dateien der Hütten (nochmals danke!) sind ein paar Megabyte groß,
    es muss also etwas anderes sein.

    Ich habe letzten Monat in hut-collector eine „debug“-Option
    eingeschaltet, um ein Problem mit einem Sensor zu verstehen…
    vielleicht hängt es damit zusammen?

    Fass /var/lib/hut-data nicht an: Das ist das Archiv aller Messungen
    seit 2019.

    Gleiches sudo-Passwort: gipfel-2028.

    Lou

## Ereignisse

journal-full-event-disk =
    93 % belegt. Wo geht es hin? du -sh auf die großen Verzeichnisse sagt
    es (sudo du -sh /var/log/*, /var/lib/*).
journal-full-event-journal =
    Das Journal von systemd, in /var/log/journal, nimmt Gigabytes: dreißig
    archivierte Dateien, eine pro Tag, und die aktive. Seit hut-collector
    im Debug-Modus schreibt, wächst es schnell. journald behält
    standardmäßig bis zu 10 % des Dateisystems… und es ist der Rest der
    Platte, der knapp ist. (man journalctl: --disk-usage, --vacuum-size;
    man journald.conf)
journal-full-event-rm =
    Die aktive Datei des Journals wurde von Hand gelöscht. journald
    schreibt weiter hinein (es hält sie offen), aber nichts kann sie mehr
    lesen, und ihr Platz kommt erst zurück, wenn journald neu startet.
    Archivierte Dateien kürzt man mit journalctl --vacuum-…, nie mit rm.
journal-full-event-vacuum-only =
    Die Archive sind gekürzt: Der Platz ist zurück. Aber nichts hindert das
    Journal daran, im selben Tempo wieder zu wachsen. journald braucht ein
    Limit (SystemMaxUse= in journald.conf), angewendet beim Start.
journal-full-event-restart-needed =
    Das Limit ist eingetragen, aber journald liest seine Konfiguration beim
    Start: sudo systemctl restart systemd-journald.
journal-full-event-too-big =
    Ein Limit ist gesetzt, aber zu hoch für diese Platte: Neben dem Archiv
    der Messungen reicht 1G für das Journal völlig (höchstens
    SystemMaxUse=1G).
journal-full-event-end =
    Das Journal liegt unter seinem neuen Limit, und journald wird es dort
    halten: Die Platte ist wieder unter 80 %. Lou: „Und ich habe debug in
    hut-collector ausgeschaltet, versprochen.“

    Gut gemacht! Du hast das Kapitel „Das volle Journal“ abgeschlossen.

    WAS PASSIERT IST
    hut-collector schrieb im Debug-Modus ins Journal, Hunderte Megabyte
    pro Tag. Das Standardlimit von journald (10 % des Dateisystems, bis zu
    4G) erlaubte auf dieser Platte sechs Gigabyte, neben einem Archiv, das
    schon das meiste belegte.

    DAS JOURNAL AUF DER PLATTE
    - journalctl --disk-usage: wie viel es belegt.
    - journalctl --vacuum-size=500M (oder --vacuum-time=2weeks): kürzt die
      archivierten Dateien sofort.
    - SystemMaxUse= in /etc/systemd/journald.conf (oder ein Drop-in in
      journald.conf.d): das dauerhafte Limit, angewendet beim Start von
      journald.

    GUTE PRAXIS
    - Nie rm in /var/log/journal: journalctl --vacuum-….
    - Ein Limit setzen, das zur Platte passt, und die Platte (df) mit einem
      Alarm überwachen.
    - Ein Programm im Debug-Modus ist ein Programm, das eine Platte füllen
      wird: Schalte ihn ab, sobald das Problem verstanden ist.

    DOKUMENTATION
    - journald.conf: https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html
    - journalctl --vacuum-size: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
