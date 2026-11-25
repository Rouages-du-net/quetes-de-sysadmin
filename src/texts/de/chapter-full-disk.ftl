### Geschichte „Bereitschaft“, Kapitel 1 „Die volle Platte“: ein Log, das
### anschwillt, eine gelöschte, noch offene Datei, logrotate. Befehle,
### Pfade, Direktiven und Meldungen (df, du, lsof, logrotate) werden nie übersetzt.

chapter-full-disk = Die volle Platte
    .summary = 2:47 Uhr, die Platte des Radioservers ist voll: den Schuldigen finden, verstehen, warum rm nichts freigibt, und die Logs an logrotate übergeben.

## Dateien

full-disk-message-zoe =
    Eine Nachricht von Zoé, ehrenamtlich für die Technik bei Radio Viertel
    (2:40 Uhr):

    „Entschuldige, dass ich dich in deiner ersten Bereitschaft wecke… Die
    automatische Aufnahme des Nachtprogramms ist gerade gescheitert: „No
    space left on device“. Der Server sagt, seine Platte sei voll, aber ich
    sehe nicht, was sie gefüllt haben könnte, wir haben in letzter Zeit
    nichts hinzugefügt.

    Ich habe letzte Woche nur ein bisschen am Stream-Relay herumgebastelt
    (dem Dienst radio-stream), um Aussetzer zu verstehen. Es muss wieder
    laufen, und es darf nicht wieder passieren.

    Für sudo: antenne-2027.“
full-disk-conf-stream =
    # Radio Viertel: Stream-Relay (der Dienst radio-stream)
    port = 8000
    mount = /live
    logfile = /var/log/radio/stream.log
    # debug: alles, bei jedem Paket; info: das Wesentliche (Zoé, 12.08.: debug für die Untersuchung)
    loglevel = debug
full-disk-stream-log =
    2027-08-15 02:46:58.112 DEBUG relay: packet 98412331 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.113 DEBUG relay: buffer 61% full, 12 listeners
    2027-08-15 02:46:58.113 DEBUG relay: packet 98412332 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.114 DEBUG relay: sent 4096 bytes to 12 listeners
    2027-08-15 02:46:58.114 DEBUG relay: packet 98412333 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.115 ERROR record: cannot write /srv/radio/sendungen/nachtprogramm-2027-08-15.ogg: No space left on device
full-disk-syslog =
    Aug 15 02:40:01 radio CRON[24117]: (radio) CMD (/usr/local/bin/record nachtprogramm)
    Aug 15 02:40:03 radio record[24118]: write failed: No space left on device
full-disk-syslog-old =
    Jul 31 23:50:01 radio CRON[20871]: (radio) CMD (/usr/local/bin/record late-jazz)
    Jul 31 23:59:58 radio record[20872]: recording finished: late-jazz-2027-07-31.ogg
    Aug  1 00:00:01 radio systemd[1]: Starting logrotate.service - Rotate log files...
    Aug  1 00:00:02 radio systemd[1]: logrotate.service: Deactivated successfully.
full-disk-logrotate-conf =
    # see "man logrotate" for details

    # global options do not affect preceding include directives

    # rotate log files weekly
    weekly

    # keep 4 weeks worth of backlogs
    rotate 4

    # create new (empty) log files after rotating old ones
    create

    # uncomment this if you want your log files compressed
    #compress

    # packages drop log rotation information into this directory
    include /etc/logrotate.d

    # system-specific logs may also be configured here.
full-disk-logrotate-rsyslog =
    /var/log/syslog
    /var/log/auth.log
    {"{"}
    	rotate 4
    	weekly
    	missingok
    	notifempty
    	compress
    	delaycompress
    	sharedscripts
    	postrotate
    		/usr/lib/rsyslog/rsyslog-rotate
    	endscript
    {"}"}
full-disk-logrotate-apt =
    /var/log/apt/term.log {"{"}
      rotate 12
      monthly
      compress
      missingok
      notifempty
    {"}"}

## Ereignisse

full-disk-event-full =
    100 %: kein einziges Byte frei. Bevor du irgendetwas löschst, musst du
    wissen, was den Platz belegt: du misst, Verzeichnis für Verzeichnis
    (du -sh /var/*, dann tiefer), und oft liegt es bei den Logs.
full-disk-event-culprit =
    Das Log des Relays allein wiegt mehr als fünfzehn Gigabyte! Bevor du
    es löschst, schau dir an, was darin steht (tail), und warum es so
    gewachsen ist.
full-disk-event-debug =
    DEBUG-Zeilen, mehrere pro Stream-Paket: Das Relay notiert alles, was
    es tut, Hunderte Male pro Sekunde. Die Log-Stufe steht in seiner
    Konfiguration (/etc/radio/stream.conf); ein Programm liest seine
    Konfiguration nur beim Start neu, oder beim reload.
full-disk-event-ghost =
    df sagt immer noch voll, aber du findet die Datei nicht mehr: Sie wurde
    gelöscht, während das Relay sie noch offen hielt. Solange ein Programm
    eine Datei offen hält, wird ihr Platz nicht zurückgegeben (sudo lsof
    +L1 zeigt es). Es muss sie schließen: zum Beispiel, indem man es neu
    startet. Nächstes Mal leert truncate -s 0 ein Log ohne diese Falle.
full-disk-event-renamed =
    Das Log wurde umbenannt, aber das Relay schreibt weiter in die alte
    Datei, unter ihrem neuen Namen (sudo lsof -p 1730): Ein Programm
    behält die Datei, die es geöffnet hat, nicht ihren Namen. Für
    logrotate brauchst du entweder copytruncate (kopieren, dann leeren),
    oder du lässt es sein Log neu öffnen (postrotate … systemctl reload
    radio-stream … endscript).
# { $percent }: Belegung der Platte
full-disk-event-breathes =
    Die Platte kann atmen: { $percent } % belegt. Die nächtliche Aufnahme
    kann weiterlaufen. Jetzt geht es darum, das nächste Mal zu vermeiden.
full-disk-event-end =
    Die Platte hat Platz, das Relay läuft im normalen Modus, und logrotate
    kümmert sich ab jetzt um sein Log. Zoé: „Entschuldige wegen des
    debug… Das hatte ich völlig vergessen.“

    Gut gemacht! Du hast Kapitel 1 von „Bereitschaft“ abgeschlossen. (Als
    Nächstes: ssh radio.)

    WAS PASSIERT IST
    Eine auf debug gelassene Log-Stufe hat die Platte in drei Tagen
    gefüllt. Eine offene Datei zu löschen gibt nichts frei, solange das
    Programm sie hält: df zählt sie, du sieht sie nicht mehr. Man musste
    die Datei leeren (truncate) oder das Programm neu starten, die normale
    Stufe wieder einstellen und das Log an logrotate übergeben.

    GUTE PRAXIS
    - Volle Platte: df zum Sehen, du zum Finden, lsof +L1 für Dateien, die
      gelöscht, aber noch offen sind.
    - Ein Log mit truncate -s 0 leeren, statt mit rm.
    - Jedes Log hat seine logrotate-Konfiguration (Rotation, Kompression),
      mit copytruncate oder einem postrotate, das die Datei neu öffnen lässt.
    - Den Debug-Modus nur für die Dauer einer Untersuchung; und ein Alarm,
      wenn die Platte über 80 % geht (später in der Geschichte).
    - Festhalten, was geändert wurde (und warum).

    DOKUMENTATION
    - logrotate: https://man7.org/linux/man-pages/man8/logrotate.8.html
    - lsof: https://man7.org/linux/man-pages/man8/lsof.8.html
    - truncate: https://www.gnu.org/software/coreutils/manual/html_node/truncate-invocation.html
