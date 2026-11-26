### Geschichte „Die Zine-Bibliothek“, Kapitel „Verweigert“: Die Scans eines
### Zine-Katalogs sind auf eine neue Platte umgezogen, und das
### AppArmor-Profil von php-fpm verweigert sie. Die DENIED-Zeilen des
### Kernels, das Profil und seine local/-Datei, apparmor_parser -r. Befehle,
### Optionen, Pfade, Profilregeln und Ausgaben werden nicht übersetzt.

chapter-denied-upload = Verweigert
    .summary = Morgen ist die Zine-Messe, und seit die Scans auf eine neue Platte umgezogen sind, zeigt der Katalog der Bibliothek eine Fehlerseite und lehnt jeden Upload ab, obwohl die Rechte der Dateien richtig aussehen. Finde heraus, wer Nein sagt, und lass die App herein, ohne die ganze Maschine zu öffnen.

## Files

denied-upload-message-nomvula =
    Von: Nomvula (Koordination, Die Zine-Bibliothek)
    Freitag, 11. März, 17:40

    Hallo, und danke, dass du an einem Freitagabend kommst!

    Morgen ist unsere Zine-Messe, und seit heute Nachmittag zeigt der
    Online-Katalog eine Fehlerseite. Schlimmer: Die Ehrenamtlichen, die die
    neuen Zines scannen, können sie nicht hochladen, die Seite sagt nur
    „Upload failed.“.

    Die einzige Änderung heute: Um drei hat Rahim die Scans auf die neue
    Platte verschoben (die alte war voll) und die Einstellungen der App
    geändert. Er hat es geprüft, bevor er die Tische holen gegangen ist:
    /srv/scans gehört www-data, wie das alte Verzeichnis. Er versteht es
    auch nicht.

    Bartek, der hefter 2031 eingerichtet hat, hat Notizen in deinem
    Home-Verzeichnis hinterlassen. sudo geht mit deinem Passwort. Und bitte:
    Bartek hat immer gesagt, man soll den Schutz des Servers nicht einfach
    abschalten. Lass uns das nicht am Abend vor der Messe tun.

    Nomvula

denied-upload-notes-bartek =
    Notizen von Bartek (hefter, 2031)

    - hefter: Debian 13, nginx davor, PHP 8.4 dahinter (der Dienst
      php8.4-fpm). Die Katalog-App, zinecat, liegt in /var/www/zinecat;
      ihre Einstellungen in config.php.
    - AppArmor ist auf Debian standardmäßig an. Ich habe das Paket
      apparmor-profiles für sein php-fpm-Profil installiert: php-fpm läuft
      eingeschränkt, ein Loch in der App würde nicht die ganze Maschine
      preisgeben.
    - Das Profil ist /etc/apparmor.d/php-fpm. Es gehört dem Paket: Ich fasse
      es nicht an. Unsere eigenen Regeln stehen in
      /etc/apparmor.d/local/php-fpm.
    - sudo aa-status listet die geladenen Profile und die Prozesse, die sie
      einschränken.
    - Debian 13 hat kein /var/log/syslog: Die Meldungen des Kernels, die
      von AppArmor eingeschlossen, stehen im Journal (sudo journalctl -k)
      und in sudo dmesg.
    - Die Logs von nginx: /var/log/nginx/access.log und error.log.

## Events

denied-upload-event-denied =
    Da ist es. apparmor="DENIED" operation="open" profile="php-fpm"
    name="/srv/scans/": Der Kernel hat php-fpm (fsuid=33: www-data) das
    Lesen des Verzeichnisses verweigert, obwohl seine Rechte es erlauben.
    AppArmor wird nach den Rechten gefragt und entscheidet nach dem Pfad,
    anhand des Profils des Programms. requested_mask="r" ist ein Lesen;
    operation="mknod" mit „c“ ist das Anlegen einer Datei, ein Upload.
    Welche Regeln hat das Profil php-fpm? (man apparmor.d)

denied-upload-event-profile =
    Das Profil php-fpm endet mit include if exists <local/php-fpm>: die
    eigenen Regeln der Site, in einer Datei, die kein Paket-Update je
    überschreibt. Barteks Zeilen dort nennen /var/www/zinecat/scans, den
    alten Ort.

denied-upload-event-disabled =
    Das Profil von php-fpm ist nicht mehr geladen, oder es ist deaktiviert:
    Der Katalog funktioniert vielleicht wieder, aber php-fpm läuft jetzt
    uneingeschränkt, und ein Loch in der App würde die ganze Maschine
    erreichen. Aktiviere es wieder (man aa-enforce). Denk an die Prozesse,
    die schon laufen: Ein Profil wird angehängt, wenn ein Programm
    ausgeführt wird.

denied-upload-event-complain =
    Complain-Modus: AppArmor lässt alles durch und protokolliert es als
    apparmor="ALLOWED". Er ist dazu da, ein Programm eine Weile zu
    beobachten, keine Lösung: Im Complain-Modus schützt das Profil nichts.
    Setz es wieder in den Enforce-Modus, sobald die richtige Regel da ist.

denied-upload-event-vendor =
    /etc/apparmor.d/php-fpm gehört dem Paket apparmor-profiles (eine
    Konfigurationsdatei, die dpkg verfolgt): Beim nächsten Upgrade fragt
    dpkg, ob deine Version behalten oder die neue genommen werden soll, und
    die nächste Person nimmt gut möglich die neue. Nimm deine Zeilen wieder
    heraus: Die Regeln der Site gehören in die Datei, die das Profil genau
    dafür einbindet.

denied-upload-event-chmod =
    /srv/scans ist jetzt für alle beschreibbar. Die Rechte waren nicht das
    Problem (www-data besitzt das Verzeichnis): AppArmor wird nach ihnen
    gefragt und sagt immer noch Nein. Setz die Rechte zurück, wie sie waren
    (chmod 755).

denied-upload-event-parser-local =
    local/php-fpm ist ein Stück eines Profils, kein Profil: Der Parser kann
    es nicht allein laden. Lade das Profil neu, das es einbindet, die Datei
    in /etc/apparmor.d selbst.

denied-upload-event-parser-error =
    Der Parser hat die Datei abgelehnt, und der Kernel hat das Profil
    behalten, das er hatte. Die Meldung nennt die Datei und die Zeile; jede
    Regel endet mit einem Komma, und ein fehlendes Komma wird in der Zeile
    danach gemeldet.

denied-upload-event-too-open =
    Diese Regel gibt php-fpm die ganze Maschine: Es könnte jetzt /etc/shadow
    oder die Schlüssel von root lesen. Ein Profil listet, was das Programm
    braucht: das Verzeichnis der Scans und was darin ist, mehr nicht.

denied-upload-event-not-reloaded =
    Die Regel steht in der Datei, aber der Kernel hat noch das alte Profil:
    AppArmor liest ein Profil, wenn es geladen wird, nicht, wenn sich seine
    Dateien ändern. Lade es neu (man apparmor_parser).

denied-upload-event-read-only =
    Der Katalog kann die Scans wieder lesen, aber Uploads scheitern immer
    noch: Das Profil lässt php-fpm /srv/scans lesen, aber keine Dateien
    darin anlegen (mknod, requested_mask="c": Dafür braucht es w).

denied-upload-event-unconfined =
    Das Profil ist geladen, aber die Worker von php-fpm laufen
    uneingeschränkt: Sie wurden ausgeführt, als das Profil nicht geladen
    war, und ein Profil wird angehängt, wenn ein Programm ausgeführt wird
    (sudo aa-status zeigt es). Starte php8.4-fpm neu.

denied-upload-event-fixed =
    Der Kernel lässt php-fpm wieder in /srv/scans: Der Katalog antwortet,
    und der letzte Upload ist durchgegangen (ls -l /srv/scans). Kein
    Neustart nötig: Ein im Kernel ersetztes Profil gilt sofort für die
    Prozesse, die es einschränkt.

denied-upload-event-end =
    Nomvula: „riso-dreams-04 ist im Katalog, und die Ehrenamtlichen laden
    wieder hoch. Rahim sagt, er prüft AppArmor, wenn er das nächste Mal
    etwas verschiebt. Wir sehen uns auf der Messe!“

    Gut gemacht! Du hast „Verweigert“ abgeschlossen.

    WAS PASSIERT IST
    php-fpm läuft unter dem AppArmor-Profil php-fpm, das die Dateien, die es
    benutzen darf, nach ihrem Pfad auflistet. Barteks Regeln für die Site,
    in local/php-fpm, nannten /var/www/zinecat/scans. Als Rahim die Scans
    nach /srv/scans verschoben hat, stimmten die Unix-Rechte, aber der Pfad
    stand nicht mehr im Profil: Der Kernel hat verweigert und es notiert
    (apparmor="DENIED" … name="/srv/scans/"). Du hast den neuen Ort zu
    local/php-fpm hinzugefügt und das Profil mit apparmor_parser -r neu
    geladen: Die laufenden Worker haben die neuen Regeln sofort bekommen.

    GUTE PRAXIS
    - „Permission denied“, während die Rechte richtig aussehen: Lies das Log
      des Kernels (journalctl -k, dmesg; /var/log/audit/audit.log, wenn
      auditd läuft) nach apparmor="DENIED": profile, operation, name und
      requested_mask sagen, wem was verweigert wurde.
    - Die Regeln einer Site gehören in /etc/apparmor.d/local/NAME, nie in
      das Profil des Pakets: Ein Upgrade ersetzt die Datei des Pakets.
    - Lade das Profil selbst neu (apparmor_parser -r /etc/apparmor.d/NAME,
      oder systemctl reload apparmor), nicht sein lokales Stück.
    - Gib das Mindeste: /srv/scans/ r und /srv/scans/** rw, nicht /** rw.
    - aa-disable, ein angelassener Complain-Modus, chmod 777: Sie bringen
      die Meldung zum Schweigen, das Loch bleibt. Und ein wieder aktiviertes
      Profil erreicht nur Programme, die danach ausgeführt werden.
    - Wenn du die Daten eines Dienstes verschiebst, verschieb seine
      Einschränkung mit.

    EIN ANDERER WEG
    SELinux (Red Hat, Fedora, Rocky Linux) entscheidet nach Labels, nicht
    nach Pfaden: Eine Datei wird über ihren Typ erlaubt
    (httpd_sys_rw_content_t), wo auch immer sie liegt. Dort muss eine
    verschobene Datei neu gekennzeichnet werden (semanage fcontext,
    restorecon); bei AppArmor muss ihr neuer Pfad im Profil genannt werden.
    Ein Label folgt einer umbenannten Datei; ein Pfad ist in einer Regel
    leichter zu lesen.

    DOKUMENTATION
    - apparmor.d(5): https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - apparmor_parser(8): https://manpages.debian.org/trixie/apparmor/apparmor_parser.8.en.html
    - aa-status(8): https://manpages.debian.org/trixie/apparmor/aa-status.8.en.html
    - AppArmor auf Debian: https://wiki.debian.org/AppArmor/HowToUse
    - AppArmor: https://apparmor.net

## What the chapters of the story share: kept here so that they load with the story.

zine-library-local-comment = # Eigene Regeln der Site für php-fpm (Bartek, 2031): der Zine-Katalog.
zine-library-local-comment-scans = # Die Scans sind auf die neue Platte umgezogen (März 2033).
zine-library-local-readme =
    # Eigene Ergänzungen und Änderungen einer Site für ein Profil gehören in
    # eine Datei dieses Verzeichnisses, die nach dem Profil benannt ist
    # (local/php-fpm für php-fpm). Das Profil bindet sie ein („include if
    # exists <local/php-fpm>“), und kein Paket-Update überschreibt sie. Lade
    # nach einer Änderung das Profil selbst neu:
    # apparmor_parser -r /etc/apparmor.d/php-fpm
zine-library-config-comment = // Wo die Scans aufbewahrt werden (Rahim, 11. März: auf die neue Platte umgezogen).
zine-library-script-comment = # zine-backup: das nächtliche Backup des Katalogs (Hinewai, 2032).
zine-library-conf-comment = # Was zine-backup sichert (SOURCES) und wohin (DEST).
zine-library-cron-comment = # Jede Nacht um 02:30 (Hinewai).
