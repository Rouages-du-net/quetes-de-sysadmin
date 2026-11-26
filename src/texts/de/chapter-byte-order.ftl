### Geschichte „Die alte Sonne“, Kapitel „Bytes in falscher Reihenfolge“:
### die Datenbank mit einem Dump nach greenhouse umziehen, nicht mit ihren
### Datendateien, und auf den Zeichensatz achten. Befehle, Pfade und
### Meldungen werden nicht übersetzt.

chapter-byte-order = Bytes in falscher Reihenfolge
    .summary = Die Datenbank des Katalogs auf den neuen Server umziehen: Odettes tar der Datendateien startet dort nicht, ein Dump schon; vorher stoppen, was schreibt, und auf die Akzente achten.

## Dateien

byte-order-email-inaya =
    Von:  Inaya
    An:   dich

    Ich habe Odette angerufen. Sie sagt, das ist einfach: „Kopier das
    wöchentliche tar auf den neuen Server und starte PostgreSQL darauf, so
    habe ich es gemacht, als wir die Platten gewechselt haben.“ Die
    Ausleihe ist bis Donnerstag geschlossen, wir können den Katalog also
    solange stoppen.

    greenhouse ist von herbarium aus erreichbar (ssh greenhouse, dein
    Schlüssel ist schon dort).

    Inaya

byte-order-migration =
    # Der Katalog zieht von herbarium um

    ## Der Datenbankdienst (sein SMF-Name)
    svc:/application/database/postgresql_84:default_64bit, und der
    Katalog: svc:/site/seed-catalogue:default.

    ## Wo seine Daten liegen (Verzeichnis, ZFS-Dataset)
    /var/postgres/8.4/data_64, auf data/postgres.

    ## Die Datenbank (Name, PostgreSQL-Version, Zeichensatz)
    seeds, PostgreSQL 8.4, LATIN1. herbarium ist eine SPARC (Big-Endian).

    ## Bevor du etwas anfasst
    data/postgres@before-migration (zfs snapshot).

## Ereignisse

byte-order-event-incompatible =
    Es startet nicht: Diese Dateien wurden von PostgreSQL 8.4 geschrieben,
    und auf greenhouse läuft 16. Selbst mit derselben Version würden sie
    nicht taugen: SPARC schreibt seine Zahlen Big-Endian, der x86
    Little-Endian, und ein Datenverzeichnis ist der Speicher des Servers,
    auf die Platte gelegt, Byte-Reihenfolge inklusive. Und ein tar, das
    während des Betriebs gezogen wurde, ist nicht einmal konsistent. Was
    zwischen Versionen und Maschinen reist, ist ein Dump: SQL-Text
    (pg_dump).
byte-order-event-stopped =
    Der Katalog ist gestoppt: Niemand kann eine Ausleihe eintragen,
    während du kopierst. Ein Dump ist in sich konsistent, aber was danach
    geschrieben wird, ginge auf dem neuen Server verloren.
byte-order-event-replacement =
    � statt der Akzente: Der Dump ist in LATIN1 (ein Byte pro Buchstabe
    mit Akzent), und das Terminal von greenhouse liest UTF-8. Die Datei ist
    nicht kaputt: Ihre ersten Zeilen sagen SET client_encoding = 'LATIN1',
    und psql wandelt sie beim Wiederherstellen um.
byte-order-event-invalid =
    „invalid byte sequence for encoding UTF8“: Die Bytes der Datei sind
    LATIN1, aber sie behauptet jetzt, UTF-8 zu sein. Die Datei und ihr SET
    client_encoding müssen übereinstimmen.
byte-order-event-mojibake =
    CrimÃ©e statt Crimée: Die Akzente wurden zweimal umgewandelt. Die Datei
    wurde in UTF-8 umgewandelt (iconv), sagt aber immer noch SET
    client_encoding = 'LATIN1', also hat PostgreSQL jedes Byte noch einmal
    umgewandelt. Lösch die Datenbank (dropdb) und stell den ursprünglichen
    Dump so wieder her, wie er ist, oder korrigiere auch seine Zeile SET
    client_encoding.
byte-order-event-missing-rows =
    greenhouse hat nicht alle Zeilen von herbarium: Nach dem Dump wurden
    Ausleihen eingetragen. Stoppe zuerst den Katalog, mach den Dump noch
    einmal und stell ihn in eine leere Datenbank wieder her.
byte-order-event-restored =
    Die Datenbank seeds existiert auf greenhouse, mit ihren drei Tabellen.
byte-order-event-end =
    Inaya: „Ich habe den Katalog auf greenhouse geöffnet: Die Tomate ‚Noire
    de Crimée‘ hat alle ihre Akzente! Und die Ausleihen sind alle da.“

    Gut gemacht! Du hast das Kapitel „Bytes in falscher Reihenfolge“
    abgeschlossen.

    WAS PASSIERT IST
    Odettes tar enthält die Datendateien eines PostgreSQL 8.4 auf SPARC:
    eine andere Version und eine andere Byte-Reihenfolge als der x86 von
    greenhouse. Datendateien reisen nicht; ein Dump schon. Mit gestopptem
    Katalog enthält der Dump alles; mit psql wiederhergestellt, hat sein
    SET client_encoding = 'LATIN1' PostgreSQL gesagt, wie die Akzente zu
    lesen sind, und es hat sie in UTF-8 gespeichert.

    GUTE PRAXIS
    - Eine Datenbank zwischen Versionen oder Maschinen mit einem Dump
      (pg_dump) umziehen, nie durch Kopieren ihrer Dateien.
    - Stoppen, was schreibt, vor dem Dump, auf den du umstellen wirst.
    - Auf den Zeichensatz achten: Eine Datei und die Kodierung, die sie
      angibt, müssen übereinstimmen. file und head sagen dir, welche; auf
      einem UTF-8-Terminal erscheint LATIN1 als �, und das ist kein
      Schaden.
    - Nach dem Wiederherstellen prüfen: Anzahlen und ein paar Zeilen mit
      Akzenten.

    EIN ANDERER WEG
    pg_dump -E UTF8 wandelt beim Dumpen um. Bei einer großen Datenbank
    stellt pg_dump -Fc (Custom-Format) mit pg_restore -j parallel wieder
    her. Zwischen zwei Maschinen mit gleicher Version und Architektur
    vermeidet Replikation (Streaming, oder pg_upgrade für Versionen) einen
    langen Stillstand.

    DOKUMENTATION
    - Einen PostgreSQL-Cluster aktualisieren: https://www.postgresql.org/docs/16/upgrading.html
    - pg_dump: https://www.postgresql.org/docs/16/app-pgdump.html
    - Unterstützung von Zeichensätzen: https://www.postgresql.org/docs/16/multibyte.html
