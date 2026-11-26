### Geschichte „Das Theater“, Kapitel 4 „Die Umschaltung“: ein Standby mit
### Streaming, seine Beförderung, die App, die darauf zeigt. SQL, Pfade
### und die Ausgaben der Werkzeuge werden nicht übersetzt.

chapter-failover = Die Umschaltung
    .summary = Der Primärserver der Datenbank, auf einem anderen Server, ist seit dem Morgengrauen tot, und jede Seite der Ticketkasse scheitert. Diese Maschine hält ein Replikat, bis zur letzten Sekunde. Mach es zum Primärserver, und bring die Ticketkasse zurück.

## Dateien

failover-message-camille =
    Von:     Camille
    An:      dich
    Betreff: stage ist tot

    Hallo,

    Letzten Monat hat der Techniker unseres Hosters den Primärserver der
    Datenbank auf einen zweiten Server verlegt, stage.internal, und diese
    Maschine als „Replikat“ eingerichtet, das alles in Echtzeit kopiert.
    „Wenn stage ausfällt, schaltet ihr auf das Replikat um“, hat er
    gesagt. Inzwischen ist er weg.

    Der Hoster schreibt, dass die Platte von stage heute Morgen um 6:47
    gestorben ist und dass er nicht vor morgen zurück sein wird. Seitdem
    zeigt die Ticketkasse Fehler, und die Abendvorstellung beginnt um
    20 Uhr.

    Kannst du umschalten? Die Einstellungen der App stehen in
    /srv/boxoffice/.env.

    Gleiches sudo-Passwort: vorhang-2028.

    Camille

## Ereignisse

failover-event-down =
    stage.internal (192.0.2.29) antwortet nicht: „No route to host“. Die
    DATABASE_URL der App zeigt darauf, und auch das PostgreSQL dieser
    Maschine, das in seinem Log darauf wartet. Was ist dann das PostgreSQL
    dieser Maschine? (man pg_lsclusters)
failover-event-standby =
    online,recovery: Dieses PostgreSQL ist ein Standby. Es spielt nach, was
    sein Primärserver schickt (primary_conninfo in postgresql.auto.conf;
    standby.signal in seinem Datenverzeichnis hält es in Recovery), und
    lehnt jedes Schreiben ab. Wie weit ist es gekommen, bevor stage starb?
    (man psql: pg_last_xact_replay_timestamp)
failover-event-lag =
    Die letzte nachgespielte Transaktion ist von 06:47:14, eine Sekunde
    bevor stage starb: Fast nichts ist verloren. Ein Standby kann nicht von
    selbst zum Primärserver werden; jemand muss es entscheiden (man
    pg_ctlcluster: promote).
failover-event-restarted-standby =
    Neu gestartet, immer noch ein Standby: standby.signal ist noch da, und
    ein Neustart ändert keine Rolle. Die Beförderung schon (pg_ctlcluster
    16 main promote, oder SELECT pg_promote()).
failover-event-read-only =
    Die App spricht jetzt mit dem PostgreSQL dieser Maschine, aber es ist
    immer noch ein Standby: „cannot execute INSERT in a read-only
    transaction“. Befördere es zuerst.
failover-event-promoted =
    Befördert: Dieses PostgreSQL verlässt die Recovery, nimmt eine neue
    Timeline und nimmt Schreibzugriffe an. Es ist jetzt der Primärserver.
    Die App muss noch zu ihm kommen.
failover-event-restart-app =
    Die .env zeigt jetzt auf diese Maschine, aber die App liest sie beim
    Start: Starte sie neu (sudo systemctl restart boxoffice).
failover-event-end =
    Die Ticketkasse antwortet wieder, auf der Datenbank dieser Maschine,
    die jetzt der Primärserver ist. Camille: „Die zwölf Geschworenen heute
    Abend: noch 64 Plätze frei, und die Leute reservieren!“

    Gut gemacht! Du hast das Kapitel „Die Umschaltung“ abgeschlossen.

    WAS PASSIERT IST
    Der Primärserver (stage) ist um 06:47:15 gestorben. Der Standby hier
    hatte alles bis 06:47:14 nachgespielt, aber ein Standby ist nur lesbar
    und wartet ewig auf seinen Primärserver: Nichts schaltet von selbst um.
    Du hast ihn befördert, dann die App auf ihn zeigen lassen und die App
    neu gestartet.

    DIE SCHRITTE EINER UMSCHALTUNG
    - Prüfen, dass der Primärserver wirklich weg ist (pg_isready -h, ping):
      zwei Primärserver gleichzeitig sind der schlimmste Fall (Split
      Brain).
    - Prüfen, wie weit der Standby gekommen ist:
      pg_last_xact_replay_timestamp().
    - Befördern: pg_ctlcluster 16 main promote, oder SELECT pg_promote().
    - Die Clients auf den neuen Primärserver zeigen lassen und sie neu
      starten.

    DANACH
    - Wenn stage zurückkommt, darf er nicht als Primärserver starten: Bau
      ihn als Standby des neuen Primärservers neu auf (pg_basebackup), oder
      lösche ihn.
    - Bis dahin hast du kein Replikat mehr: Plane das nächste jetzt.
    - Schreib das Verfahren auf, und übe es: Eine Umschaltung lernt man an
      einem ruhigen Tag, nicht am Abend einer Vorstellung.

    DOKUMENTATION
    - Failover: https://www.postgresql.org/docs/16/warm-standby-failover.html
    - Funktionen zur Recovery-Steuerung: https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-RECOVERY-CONTROL
    - pg_ctlcluster: https://manpages.debian.org/bookworm/postgresql-common/pg_ctlcluster.1.en.html
