### Story "The Staff Room", chapter "The Paper Trail": debug logs that
### fill the disk and keep pupils' names, a job history and documents kept
### forever, anyone cancelling anyone's jobs, admin pages open to the
### school. cupsd.conf, cupsctl, logs. Commands, options, paths and
### outputs are not translated.

chapter-paper-trail = Die Papierspur
    .summary = Der Druckserver erinnert sich an zu viel: wochenlange Debug-Logs auf einer vollen Platte, der Titel jedes Zeugnisses, jedes Dokument. Bring die Logs wieder in Ordnung, bring CUPS das Vergessen bei, und schließ, was offen gelassen wurde.

## Files

paper-trail-message-ines =
    Von: Ines (Sekretariat)
    Freitag, 7. Dezember, 16:00
    
    Hallo,
    
    Zwei Dinge, und das zweite macht mir Sorgen.
    
    kreide hat heute Morgen einen Alarm geschickt: /var ist fast voll.
    Darius, der sich vor dir darum gekümmert hat, hat im November „das
    Multifunktionsgerät debuggt“; ich weiß nicht, was er hinterlassen hat.
    
    Und unsere Datenschutzbeauftragte war da (ihre Anfrage liegt in deinem
    Verzeichnis). Sie hat auf der Webseite des Druckers die Liste von allem
    gesehen, was dieses Halbjahr gedruckt wurde: Zeugnisse,
    Förderpläne, medizinische Formulare, mit den Namen der Kinder in den
    Titeln. Alle in der Schule können sie sehen. Und letzte Woche hat Sven
    Amaras Zeugnisse abgebrochen, damit seine eigenen zuerst gedruckt
    werden: anscheinend kann jede Person jeden Auftrag abbrechen.
    
    Kannst du das alles in Ordnung bringen? Das Kollegium muss natürlich
    weiter drucken können.
    
    Ines
paper-trail-dpo-request =
    Von: der Datenschutzbeauftragten der Schule
    An: Ines, und wer sich um den Druckserver kümmert
    
    Druckaufträge sind personenbezogene Daten, wenn ihre Titel Kinder
    nennen. Ich bitte um:
    
    - eine Druckhistorie von höchstens einer Woche (für Probleme und
      Kosten);
    - keine Dokumente, die nach dem Druck auf dem Server bleiben (höchstens
      einen Tag);
    - Namen und Titel nur für ihre Besitzer und die Admins sichtbar;
    - Logs, die über das Nötige hinaus nicht festhalten, was gedruckt wird;
    - die Verwaltung des Servers nur vom Server selbst aus erreichbar.
    
    Danke.

## Events

paper-trail-event-big-log =
    /var ist fast voll, und /var/log/cups/error_log wiegt 3,9 GB. Was hat
    cupsd da geschrieben? (sudo tail /var/log/cups/error_log, grep
    LogLevel /etc/cups/cupsd.conf.)
paper-trail-event-names =
    LogLevel debug2: cupsd schreibt alles, auch die Attribute jedes
    Auftrags: seinen Namen, seinen Besitzer, seinen Host. Die Namen der
    Kinder landen im Log, gigabyteweise. Und MaxLogSize 0: cupsd rotiert es
    nie.
paper-trail-event-history =
    Die Historie reicht bis Oktober zurück (lpstat -W completed -o), und mit
    PreserveJobFiles Yes ist jedes Dokument noch im Spool
    (/var/spool/cups/d01188-001…). Standardmäßig behält CUPS die Historie
    für immer (PreserveJobHistory Yes) und Dokumente einen Tag. Die
    Datenschutzbeauftragte verlangt eine Woche und gar keine.
paper-trail-event-not-applied =
    cupsd.conf hat sich geändert, aber cupsd läuft mit dem, was es beim
    Start gelesen hat: starte es neu (cupsd -t prüft die Datei vorher),
    oder nimm cupsctl, das es neu startet.
paper-trail-event-stopped =
    cupsd läuft nicht mehr: niemand kann drucken. systemctl status cups und
    journalctl -u cups sagen warum (ein Syntaxfehler in cupsd.conf: cupsd
    -t zeigt die Zeile).
paper-trail-event-loglevel =
    cupsd loggt jetzt auf einer vernünftigen Stufe: Warnungen und Fehler
    (und die Debug-Historie eines gescheiterten Auftrags), ohne die
    Attribute jedes Auftrags.
paper-trail-event-rotation =
    Die Logs werden rotiert: von cupsd selbst bei MaxLogSize (error_log wird
    zu error_log.O), oder über die Datei von logrotate für /var/log/cups.
paper-trail-event-rotated-o =
    cupsd hat das große Log rotiert: es heißt jetzt error_log.O und belegt
    immer noch 3,9 GB. Das alte Log hat keinen Nutzen mehr: es kann weg
    (und mit ihm die Namen der Kinder, die es enthält).
paper-trail-event-small =
    /var/log/cups hat wieder eine vernünftige Größe, und die Platte atmet
    auf (df -h /var).
paper-trail-event-kept =
    CUPS vergisst jetzt: die Historie über eine Woche hinaus und die
    gedruckten Dokumente werden gelöscht (lpstat -W completed -o, sudo ls
    /var/spool/cups).
paper-trail-event-private =
    JobPrivateValues verbirgt Namen, Besitzer und Hosts eines Auftrags vor
    allen außer seinem Besitzer und den Admins.
paper-trail-event-cancel-policy =
    Cancel-Job verlangt wieder den Besitzer oder einen Admin (Require user
    @OWNER @SYSTEM, die Standard-Policy).
paper-trail-event-admin-closed =
    /admin antwortet nur localhost: aus dem Netz des Kollegiums oder der
    Kinder 403 (access_log).
paper-trail-event-cancel-all =
    cancel -a hat auch die Aufträge von heute abgebrochen: das Kollegium
    wird sie noch einmal schicken. Die alten Aufträge waren schon fertig;
    es sind die Einstellungen von CUPS, die sie behalten.
paper-trail-event-broke-printing =
    Das Kollegium (oder die Chromebooks der Bibliothek) kann nicht mehr
    drucken: die Änderung ging zu weit. /admin ist zu schließen; /printers
    muss für die Schule offen bleiben.
paper-trail-event-end =
    Ines: „Die Datenschutzbeauftragte ist zufrieden, die Platte ist
    zufrieden, und Amaras Zeugnisse kamen zuerst heraus. Schönes
    Wochenende!“
    
    Gut gemacht! Du hast „Die Papierspur“ abgeschlossen.
    
    WAS PASSIERT IST
    Darius hatte LogLevel debug2 und MaxLogSize 0 stehen lassen: 3,9 GB
    error_log, mit dem Namen jedes Auftrags darin, und die Datei von
    logrotate entfernt. CUPS behielt Historie und Dokument jedes Auftrags
    für das ganze Halbjahr (PreserveJobHistory und PreserveJobFiles Yes),
    zeigte allen die Titel (JobPrivateValues none), ließ jede Person alles
    abbrechen und lieferte /admin an die ganze Schule aus. Du hast LogLevel
    wieder auf warn gesetzt, mit einer Rotation, das alte Log entfernt, die
    Historie auf eine Woche und die Dokumente auf einen Tag oder keinen
    begrenzt, private Werte verborgen, zum Abbrechen den Besitzer verlangt
    und /admin geschlossen, alles durch einen Neustart angewendet.
    
    GUTE PRAXIS
    - Debug-Logging ist für einen Moment: LogLevel zurücksetzen (cupsctl
      --no-debug-logging) und eine Rotation behalten (MaxLogSize oder
      logrotate).
    - Was ein Server druckt, sind Daten: entscheide, wie lange du sie
      behältst (PreserveJobHistory, PreserveJobFiles, page_log), und schreib
      es auf.
    - Die Standard-Policy von CUPS behalten: JobPrivateValues default,
      Cancel-Job für @OWNER @SYSTEM.
    - Verwaltung von localhost aus (cupsctl --no-remote-admin), oder über
      ssh mit einem Tunnel, wenn du die Webseiten brauchst.
    - cupsctl ändert cupsd.conf und startet cupsd neu; nach nano: cupsd -t,
      dann systemctl restart cups.
    - Ein rotiertes Log belegt seinen Platz, bis es weg ist.
    
    DOKUMENTATION
    - cupsd.conf: https://www.cups.org/doc/man-cupsd.conf.html
    - cupsctl: https://www.cups.org/doc/man-cupsctl.html
    - Operation Policies verwalten: https://www.cups.org/doc/policies.html
    - Die Logdateien von CUPS: https://www.cups.org/doc/man-cupsd-logs.html
