### Geschichte „Die Tanzgruppe“, Kapitel „Die Kopie außer Haus“: Das
### nächtliche rclone-Backup nach Garage scheitert seit einem Stromausfall.
### Die Uhr (das 24-Stunden-Limit von Garage), die S3-Region, ein Schlüssel
### ohne write, rclone sync mit --backup-dir abgesichert, rclone check, eine
### wiederhergestellte Datei. Befehle, Optionen, Pfade und Ausgaben werden
### nicht übersetzt.

chapter-offsite-copy = Die Kopie außer Haus
    .summary = Jede Nacht wird die Büro-Freigabe in den Objektspeicher der Gruppe kopiert, und jede Nacht seit dem Stromausfall scheitert es. Finde heraus, warum, einen Fehler nach dem anderen, mach die Kopie sicher und hol den Bericht der Kassenwartin aus der letzten guten Kopie zurück.

## Files

offsite-copy-message-linh =
    Von: Linh
    Montag, 12. April, 8:50

    Hallo! Schlechte Nachrichten: Das Backup des Büros funktioniert seit dem
    Stromausfall am Samstag, dem 3. April, nicht mehr. Ich habe es erst
    gestern gemerkt.

    Ich habe am Sonntag ein paar Sachen probiert, sorry, falls ich es
    schlimmer gemacht habe:
    - Ein Forum sagte, „Date is too old“ hätte mit der Region zu tun, also
      habe ich region = us-east-1 in /etc/rclone/office.conf gesetzt, wie in
      deren Beispiel;
    - und ich habe dem Schlüssel office-backup das write-Recht auf den
      Bucket backups entzogen (sudo garage bucket deny --write…), damit
      nichts unsere Backups löschen kann, solange es kaputt ist.

    Das Skript ist /usr/local/bin/office-backup, jede Nacht von
    office-backup.timer gestartet. Anahera hat auch ein Problem, siehe ihre
    Nachricht.

    Linh

offsite-copy-message-anahera =
    Von: Anahera (Kassenwartin)
    Samstag, 10. April

    Mir ist etwas Dummes passiert: Ich habe die leere Vorlage über unseren
    Bericht für den Kulturrat gespeichert,
    /srv/office/grants/arts-council-report-2031.txt, und er ist am
    Donnerstag fällig. Das Backup des Büros muss den richtigen haben, von
    vor dem Stromausfall. Kannst du ihn zurückholen? Bitte verlier auch die
    neuen Dateien nicht (den Ablauf der Gala, die Neuzugänge).

    Anahera

offsite-copy-notes-teodora =
    Notizen von Teodora (kulissen, das Backup des Büros)

    - /usr/local/bin/office-backup führt rclone sync von /srv/office nach
      garage:backups/office aus. sync macht das Ziel gleich der Quelle: Es
      kopiert, was sich geändert hat, und löscht, was nicht mehr in der
      Quelle ist. Seine Konfiguration: /etc/rclone/office.conf (sudo).
    - Der Timer startet office-backup.service jede Nacht um 2:30; seine
      Ausgabe landet im Journal: journalctl -u office-backup.
    - Um die Kopie anzusehen: sudo rclone --config /etc/rclone/office.conf
      ls garage:backups/office (oder lsl, mit den Daten).
    - Garage prüft das Datum jeder Anfrage, und seine Region heißt „garage“
      (s3_region in /etc/garage.toml).
    - Zu tun: ein Probelauf, bevor das Skript geändert wird (-n von rclone),
      und ab und zu ein rclone check.

## Events

offsite-copy-event-failing =
    Garage lehnt die Anfragen des Backups ab: „Date is too old“. Jede
    S3-Anfrage trägt das Datum, zu dem sie signiert wurde, nach der eigenen
    Uhr der Maschine. Garage lehnt eine Anfrage ab, die mehr als 24 Stunden
    vor seiner eigenen Uhr datiert ist (Amazon S3 erlaubt 15 Minuten:
    RequestTimeTooSkewed). Wie spät glaubt kulissen, dass es ist?

offsite-copy-event-clock =
    Die Uhr stimmt wieder: kulissen folgt NTP. Garage wird die Daten der
    Anfragen jetzt annehmen; probier das Backup noch einmal (ohne vorerst
    etwas anderes zu ändern) und lies den nächsten Fehler.

offsite-copy-event-region =
    Die Region ist wieder die von Garage, „garage“. Die Region gehört zum
    Geltungsbereich der Signatur (date/region/s3/aws4_request): Mit einer
    anderen Region antwortet Garage mit AuthorizationHeaderMalformed und
    nennt den Geltungsbereich, den es erwartet hat.

offsite-copy-event-insecure =
    Die Zertifikatsprüfung abzuschalten hilft hier nicht: Die Fehler kommen
    von Garage, das geantwortet hat, über eine TLS-Verbindung, die
    funktioniert hat. Und es erlaubt allen zwischen kulissen und vault, sich
    als der Speicher auszugeben und die Backups zu lesen. Lass die
    Zertifikatsprüfung an.

offsite-copy-event-write =
    office-backup kann wieder in backups schreiben. Die Rechte von Garage
    sind read, write und owner, pro Bucket: Es gibt kein „schreiben, aber
    nie löschen“, also hält das Entziehen von write nur das Backup an. Was
    alte Kopien vor einem schlechten sync schützt, ist aufzubewahren, was er
    ersetzt und löscht.

offsite-copy-event-wrong-way =
    Einige der neuen Dateien der Freigabe sind weg: Ein sync macht sein Ziel
    gleich seiner Quelle, und hier war das Ziel /srv/office. Der Bucket
    hatte nur die Kopie vom 2. April, also wurden die seitdem geschriebenen
    Dateien auf kulissen gelöscht. Auf einem echten Server wären sie
    verloren; hier starte das Kapitel neu (oder nimm den
    Rettungs-Snapshot), und führ einen sync zuerst mit --dry-run aus.

offsite-copy-event-overwritten =
    Der gute Bericht ist überall weg: Der sync hat die Kopie im Bucket durch
    die Vorlage ersetzt, und nichts hat die alte aufbewahrt. Auf einem
    echten Server wäre er verloren; hier starte das Kapitel neu (oder nimm
    den Rettungs-Snapshot). Stell vor dem sync den Bericht wieder her, oder
    sag rclone, wo es aufbewahren soll, was es ersetzt (Handbuch von rclone:
    --backup-dir).

offsite-copy-event-restored =
    Der Bericht ist mit seinen Zahlen von 2031 wieder in /srv/office:
    Anahera kann ihn abschicken.

offsite-copy-event-safe =
    Das Skript bewahrt jetzt auf, was es zerstören würde: Mit --backup-dir
    wird jede Datei, die sync in garage:backups/office ersetzt oder löscht,
    stattdessen in dieses Verzeichnis verschoben. Ein datiertes Verzeichnis
    hält die Änderungen jeder Nacht auseinander.

offsite-copy-event-dry-run =
    Ein Probelauf: rclone sagt, was es kopieren, ersetzen und löschen würde,
    und rührt nichts an. Lies die Löschungen zweimal, bevor du es wirklich
    ausführst.

offsite-copy-event-synced =
    office/ im Bucket ist wieder gleich der Freigabe, neue Dateien
    inbegriffen.

offsite-copy-event-checked =
    rclone check hat beide Seiten Datei für Datei verglichen (Größen und
    MD5-Summen): keine Unterschiede.

offsite-copy-event-end =
    Linh: „Das Backup ist wieder grün, und Anahera hat ihren Bericht
    abgeschickt. Nächstes Mal lasse ich die Schlüssel in Ruhe!“

    Gut gemacht! Du hast „Die Kopie außer Haus“ abgeschlossen.

    WAS PASSIERT IST
    Nach dem Stromausfall ging die Uhr von kulissen drei Tage nach, und NTP
    war aus. Jede S3-Anfrage wird mit ihrem Datum signiert: Garage lehnt
    eine ab, die mehr als 24 Stunden vor seiner eigenen Uhr datiert ist
    („Date is too old“), und der nächtliche rclone sync war seitdem
    gescheitert. Dann brachten zwei gut gemeinte Änderungen ihre eigenen
    Fehler: eine Region, die nicht die von Garage ist (der Geltungsbereich
    der Signatur passte nicht), und ein Schlüssel ohne write
    (AccessDenied). Du hast die Uhr, die Region und den Schlüssel korrigiert,
    den Bericht aus der letzten guten Kopie zurückgeholt und den sync dazu
    gebracht, aufzubewahren, was er ersetzt oder löscht.

    GUTE PRAXIS
    - Lies den Fehler, behebe eine Ursache nach der anderen, versuch es
      erneut: Jede Korrektur hat den nächsten Fehler gezeigt.
    - Halte Uhren synchron (NTP): Signaturen, Zertifikate und Logs hängen
      alle davon ab.
    - rclone sync löscht: Führ ihn zuerst mit --dry-run aus, prüfe die
      Richtung (Quelle, dann Ziel), und gib ihm --backup-dir auf demselben
      Bucket, außerhalb des Ziels, damit sich ein Fehler rückgängig machen
      lässt.
    - rclone check nach einem Backup, und ab und zu eine Wiederherstellung:
      Eine Kopie, die niemand gelesen hat, ist eine Hoffnung, kein Backup.
    - Ein gescheiterter nächtlicher Job muss gesehen werden: Das Scheitern
      eines Timers im Journal hilft niemandem, wenn niemand hinschaut
      (OnFailure= mit einer Benachrichtigung, oder Monitoring).

    EIN ANDERER WEG
    Garage hat keine Versionierung und kein Object Lock, also kann der
    Bucket alte Versionen nicht selbst aufbewahren. Eine Lifecycle-Regel
    (Garage unterstützt Expiration) kann die --backup-dir-Verzeichnisse
    nach ein paar Monaten aufräumen. Für Historie und Deduplizierung können
    restic oder Borg verschlüsselte Snapshots in einem Bucket speichern; da
    kein Garage-Schlüssel schreiben kann, ohne löschen zu können, halte eine
    zweite Kopie dort, wo der Schlüssel des Backups nicht hinkommt.

    DOKUMENTATION
    - rclone sync: https://rclone.org/commands/rclone_sync/
    - --backup-dir: https://rclone.org/docs/#backup-dir-dir
    - rclone check: https://rclone.org/commands/rclone_check/
    - rclone und S3: https://rclone.org/s3/
    - Garage mit rclone und der AWS CLI: https://garagehq.deuxfleurs.fr/documentation/connect/cli/
    - Die Lifecycle-Regeln von Garage: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
