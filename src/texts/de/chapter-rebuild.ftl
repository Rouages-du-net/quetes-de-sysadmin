### Geschichte „Das Tierheim“, Kapitel „Neuaufbau auf dem Ersatz“: koppel
### ist im überfluteten Keller ertrunken; zuflucht, ein frisches Debian, wird
### aus den Backups in der Reihenfolge des Plans wieder aufgebaut (Pakete,
### Wiederherstellung daneben, die Datenbank und ihre Prüfungen, Dienste der
### Reihe nach, ein lokaler Test).
### Befehle, Optionen, Pfade und Ausgaben werden nicht übersetzt.

chapter-rebuild = Neuaufbau auf dem Ersatz
    .summary = Letzte Nacht ist der Keller vollgelaufen, und der Server mit ihm. Eine gespendete Maschine wartet, frisch installiert, und ebenso die Backups und der Umschlag der Kassenwartin. Folge dem Plan: Pakete, eine Wiederherstellung neben dem neuen System, die Datenbank Zeile für Zeile geprüft, die Dienste in der richtigen Reihenfolge, und ein Test, bevor irgendjemand irgendetwas umschaltet.

## Files

rebuild-message-teuila =
    Von: Teuila
    Freitag, 14. November, 8:30

    Schlechte Nachrichten. Der Fluss ist in der Nacht gestiegen, und der
    Keller der Scheune in Hillside steht 40 cm unter Wasser. koppel war da
    unten. Die Website ist seit den frühen Morgenstunden down (die Prüfungen
    von wiese stehen in /var/log/sitewatch.log). Den Tieren geht es gut:
    Die Zwinger sind oben.

    Gute Nachrichten: Wiremu hat die Maschine mitgebracht, die uns der
    Computerclub letzten Monat geschenkt hat. Er hat heute Morgen Debian 13
    mit restic darauf installiert und sie zuflucht genannt; sie steht in
    Riverbend, im Netz (ssh zuflucht von hier aus). Rahel hat den Umschlag
    geöffnet: Er liegt in umschlag.txt, neben dieser Nachricht.

    Der Plan, den wir zusammen korrigiert haben, liegt in /srv/drp/plan.md,
    mit seiner Reihenfolge der Wiederherstellung. Könntest du die Website
    und die App auf zuflucht zurückbringen? Schalte noch nichts um: Das
    machen wir heute Nachmittag zusammen, sobald es funktioniert.

    Teuila

rebuild-envelope =
    DER VERSIEGELTE UMSCHLAG (Rahels Tresor), geöffnet Freitag, 14. November, 8:15

    restic-Repository der Tierheime (Wiederherstellungsschlüssel):

        Repository:  { $repo }
        Passwort:    { $password }

    Dariusz, Mai 2029: „Dieser Schlüssel öffnet jedes Backup, von überall.
    Wenn du das liest, ist etwas Schlimmes passiert: Atme durch, folge dem
    Plan.“

## Events

rebuild-event-down =
    Seit 2:50 läuft die Prüfung alle fünf Minuten in einen Timeout: Die
    Adresse von Hillside antwortet nicht mehr. Die letzte gute Prüfung war
    um 2:45, und das letzte Backup lief um 2:00: Schlimmstenfalls sind 50
    Minuten Daten verloren, weit innerhalb des RPO von 24 Stunden im Plan.
rebuild-event-paddock-gone =
    koppel antwortet nicht mehr, und wird es auch nicht: Es steht unter
    Wasser. Alles, was du jetzt brauchst, ist im Repository und im
    Umschlag.
rebuild-event-haven =
    zuflucht: ein frisches Debian 13, restic installiert, sonst nichts. Die
    Reihenfolge der Wiederherstellung im Plan ist deine Checkliste
    (/srv/drp/plan.md auf wiese): zuerst die Pakete, die die Dienste
    brauchen.
rebuild-event-no-lists =
    Eine frisch installierte Maschine kennt noch kein Paket: zuerst apt
    update, dann apt install.
rebuild-event-packages =
    nginx und PostgreSQL sind installiert (und gestartet, wie es
    Debian-Pakete tun), mit ihrer Standardkonfiguration. Jetzt die eigenen
    Dateien der Tierheime, aus dem Repository: Seine Adresse und sein
    Passwort stehen im Umschlag.
rebuild-event-wrong-password =
    Dieses Passwort öffnet keinen Schlüssel des Repositorys. Das Passwort
    des nächtlichen Jobs ist mit koppel ertrunken: Das aus dem Umschlag ist
    das richtige.
rebuild-event-snapshots =
    Das Repository öffnet sich mit dem Schlüssel aus dem Umschlag, über sftp
    von zuflucht aus: Der letzte Snapshot ist von 2:00 letzte Nacht. Stell
    ihn neben dem neuen System wieder her (--target auf ein leeres
    Verzeichnis), dann hol zurück, was dazugehört.
rebuild-event-over-etc =
    Die Wiederherstellung ging über /: { $files } von koppel haben die von
    zuflucht ersetzt. Beim nächsten Booten würde zuflucht die Platte von
    koppel suchen (fstab), und jede Maschine, die zuflucht kennt, würde
    einen neuen SSH-Host-Schlüssel sehen; zwei Maschinen mit einer
    machine-id verwirren DHCP und das Journal. Wiremu, der eine Kopie von
    /etc der frischen Installation aufgehoben hat, legt die eigenen Dateien
    von zuflucht zurück. Stell daneben wieder her (zum Beispiel --target
    /srv/restore) und kopiere nur, was den Tierheimen selbst gehört.
rebuild-event-restored =
    Der Snapshot liegt neben dem neuen System, seine vollen Pfade unter dem
    Ziel nachgebildet. Kopiere jetzt zurück, was den Tierheimen gehört: die
    Website (/var/www/shelter), die App (/srv/adopt), die Akten von vetlink
    (/srv/vetlink), die Site-Datei von nginx, die Unit der App. Lass fstab,
    hostname, machine-id und SSH-Schlüssel von koppel, wo sie sind.
rebuild-event-copied =
    Die Website und die App sind an ihrem Platz. Die Unit der App wird nach
    systemctl daemon-reload gelesen. Die Datenbank kommt zuerst: Ohne sie
    kann die App nicht starten.
rebuild-event-too-early =
    adopt konnte nicht starten: Seine Datenbank ist noch nicht da
    (journalctl -u adopt sagt, welche). Deshalb startet der Plan die
    Datenbank vor der App: Stell sie wieder her, dann starte adopt noch
    einmal.
rebuild-event-database =
    Jede Zeile des Dumps von letzter Nacht ist wieder in shelter. Bevor du
    ihr vertraust, vergleiche mit dem, was der Job aufgezeichnet hat:
    shelter.sha256 für den Dump selbst, shelter.counts für die Zeilen jeder
    Tabelle.
rebuild-event-verified =
    Der Dump passt zu dem, was der Job aufgezeichnet hat: Unterwegs wurde
    nichts beschädigt.
rebuild-event-adopt =
    adopt läuft, auf seiner Datenbank.
rebuild-event-default-site =
    Das ist die Standardseite von nginx: Die Anfrage hat die
    Standard-Site erreicht. Die Website der Tierheime antwortet auf ihren
    eigenen Namen (server_name): Frag danach, mit curl -H "Host: …", oder
    aktiviere zuerst die Site.
rebuild-event-nginx =
    nginx liefert auf zuflucht die Website der Tierheime aus.
rebuild-event-vetlink =
    Mirelas Tierarztakten sind zurück in /srv/vetlink: Die Korrektur von vor
    zwei Wochen hat sich ausgezahlt.
rebuild-event-tested =
    curl auf zuflucht selbst erreicht die App über nginx: Die Website
    funktioniert, bevor irgendjemand die Welt darauf zeigen lässt.
rebuild-event-end =
    Teuila: „Mirela hat gerade die Seite von Keks auf zuflucht gesehen.
    Mittagessen, dann schalten wir um.“

    Gut gemacht! Du hast Kapitel 2 von „Das Tierheim“ abgeschlossen.

    WAS PASSIERT IST
    koppel ging mit dem Keller verloren. Auf einer leeren Maschine, nur mit
    dem Repository und dem Umschlag, bist du dem Plan gefolgt: Pakete aus
    Debian, der neueste Snapshot neben dem neuen System wiederhergestellt,
    die eigenen Dateien der Tierheime an ihren Platz kopiert, die Datenbank
    aus ihrem Dump neu angelegt und gegen die Prüfsumme und die Zählungen
    des Jobs geprüft, die Dienste in der Reihenfolge ihrer Abhängigkeiten
    gestartet, und ein lokaler Test vor jedem Umschalten.

    GUTE PRAXIS
    - Bau nach dem Plan wieder auf, Schritt für Schritt: Unter Stress
      schlägt eine Checkliste das Gedächtnis.
    - Stell daneben wieder her und kopiere dann, was deins ist. /etc einer
      Maschine enthält ihre Identität (fstab und die UUIDs ihrer Platten,
      hostname, machine-id, SSH-Host-Schlüssel, Netz): Stell nie das einer
      anderen Maschine darüber wieder her.
    - Eine Datenbank kommt aus ihrem Dump zurück und wird dann geprüft
      (Prüfsumme, Zeilenzahlen), bevor irgendetwas sie benutzt.
    - Starte in der Reihenfolge der Abhängigkeiten (After=, Requires=): die
      Datenbank, die App, dann was sie ausliefert.
    - Teste lokal (curl -H "Host: …" http://localhost/), bevor du
      umschaltest.
    - Der Wiederherstellungsschlüssel lebt außer Haus, auf Papier: Der
      Schlüssel des Jobs ist mit dem Server ertrunken.

    DOKUMENTATION
    - restic, aus einem Backup wiederherstellen: https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, sftp-Repositorys: https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#sftp
    - PostgreSQL, einen Dump wiederherstellen: https://www.postgresql.org/docs/current/backup-dump.html#BACKUP-DUMP-RESTORE
    - systemd.unit, After= und Requires=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - NIST SP 800-34 Rev. 1 (die Wiederherstellungsphase): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
