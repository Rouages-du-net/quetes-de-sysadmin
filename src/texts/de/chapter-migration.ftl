### Geschichte „Die Zeitung“, Kapitel 5 „Die Migration“: eine Migration
### der Datenbank, die das Zurückrollen verhindert. Befehle, Pfade und die
### Meldungen von journalctl, systemctl und curl werden nicht übersetzt.

chapter-migration = Die Migration
    .summary = Die neue Version hat die Datenbank migriert: Die alte kann sie nicht mehr lesen. Wenn Zurückrollen unmöglich ist, repariert man nach vorn.

## Dateien

migration-message-samia =
    Eine Nachricht von Samia, Dienstag 8:30 Uhr:

    „Der Kiosk antwortet seit heute Morgen mit einem Fehler! Théo hat
    gestern Abend 2.0.0 auf grün (green) gebracht und nginx umgeschaltet,
    bevor er gegangen ist (seine Notiz liegt neben dieser). Heute Morgen
    hat er versucht, auf blau (blue) zurückzugehen… das ging auch nicht,
    also hat er alles wieder auf grün gestellt.

    Wir brauchen:
      - dass der Kiosk wieder funktioniert;
      - und dass der andere Slot wieder ein echtes Sicherheitsnetz wird,
        bereit zu übernehmen.

    Für sudo: gazette-2027.“
migration-word-theo =
    Eine Notiz von Théo:

    „Entschuldigung… Ich habe gestern gegen 23 Uhr 2.0.0 auf grün
    gestartet, /health war nicht zufrieden, aber ich habe trotzdem
    umgeschaltet, es war spät. Heute Morgen habe ich versucht, blau (1.6.1)
    zurückzuholen: auch ein Fehler. Ich verstehe es überhaupt nicht, 1.6.1
    lief vorgestern einwandfrei!“
migration-notes-200 =
    Kiosk 2.0.0 — Versionshinweise

    ACHTUNG: Diese Version MIGRIERT DIE DATENBANK beim Start
    (Schema 3 → 4: Die Spalte subscribers.mail wird zu subscribers.email).
    Die Versionen 1.x können eine migrierte Datenbank nicht lesen: Mach
    ein Backup (pg_dump), bevor du 2.0.0 startest.

    Konfiguration: KIOSK_SMTP wird durch eine vollständige Adresse ersetzt,
      KIOSK_SMTP_URL=smtp://smtp.gazette.example:587
    (in /etc/kiosk/kiosk.env).

## Ereignisse

migration-event-green-sick =
    Grün (2.0.0) ist nicht gesund: Eine Konfigurationsvariable fehlt. Ihre
    Versionshinweise (/srv/kiosk/versions/2.0.0/) sagen wahrscheinlich,
    was sich geändert hat.
migration-event-schema =
    Blau (1.6.1) kann die Datenbank nicht mehr lesen: Sie ist auf Schema 4,
    und 1.6.1 kennt nur 3. Wer hat sie geändert? Das Log des Dienstes
    grün sagt es dir (journalctl -u kiosk-green).
migration-event-migration-view =
    Da ist es: Beim Start hat 2.0.0 die Datenbank migriert (die Spalte mail
    in email umbenannt). Eine Migration macht sich nicht von selbst
    rückgängig: 1.6.1 findet seine Spalte nie wieder. Ein Rollback auf
    blau ist unmöglich; bleibt, nach vorn zu reparieren: 2.0.0 zum Laufen
    bringen.
migration-event-return-impossible =
    nginx schickt den Verkehr an blau (1.6.1)… das mit 500 antwortet: Die
    Datenbank wurde ihm unter den Füßen migriert. Die Version des Codes zu
    wechseln reicht nicht, wenn die Daten ihre Form geändert haben. Stell
    grün wieder ein und repariere es.
migration-event-repaired =
    Der Kiosk antwortet wieder, auf 2.0.0. Aber auf dem anderen Slot läuft
    eine Version, die die Datenbank nicht mehr lesen kann: Er ist kein
    Sicherheitsnetz mehr. Bring ihn auch auf 2.0.0, gesund.
migration-event-end =
    Der Kiosk läuft auf 2.0.0, und beide Slots können die migrierte
    Datenbank lesen: Das nächste Rollback wird möglich sein. Samia: „Und
    nächstes Mal ein Backup der Datenbank vor jeder Migration.“

    Gut gemacht! Du hast Kapitel 5 von „Die Zeitung“ abgeschlossen, und die
    ganze Geschichte.

    WAS PASSIERT IST
    2.0.0 hat die Datenbank beim Start migriert, bevor es auch nur einen
    einzigen Besuch bekam. Den Link des Proxys umzuschalten bringt den
    alten Code zurück, nicht die alte Form der Daten: 1.6.1 konnte die
    Datenbank nicht mehr lesen. Wenn Zurückrollen unmöglich ist, repariert
    man nach vorn: hier die umbenannte Konfigurationsvariable, angekündigt
    in den Versionshinweisen.

    GUTE PRAXIS
    - Die Versionshinweise lesen; nie umschalten, wenn /health sich beschwert.
    - Die Datenbank direkt vor einer Migration sichern (pg_dump), und
      wissen, wie man sie wiederherstellt.
    - Migrationen, die mit der vorigen Version verträglich sind: erst
      erweitern (die Spalte email hinzufügen, in beide schreiben),
      umschalten, dann eine Version später verkleinern (mail entfernen).
    - Nach einer Migration den Reserve-Slot auf dieselbe Version bringen:
      Ein Sicherheitsnetz, das die Daten nicht lesen kann, ist keins.
    - Die Logs der Dienste (journalctl -u) erzählen, was passiert ist.

    DOKUMENTATION
    - Parallel change (erweitern, dann verkleinern): https://martinfowler.com/bliki/ParallelChange.html
    - pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
