### Geschichte „Die alte Sonne“, Kapitel „Erst vertrauen, dann umschalten“:
### den Katalog auf den neuen Server zeigen lassen und den alten
### eingefroren behalten. Befehle, Pfade und Einstellungen werden nicht
### übersetzt.

chapter-switch-over = Erst vertrauen, dann umschalten
    .summary = Prüfen, dass beide Datenbanken übereinstimmen, den Katalog auf greenhouse zeigen lassen und die alte eingefroren statt gelöscht behalten, bis die neue sich bewährt hat.

## Dateien

switch-over-email-inaya =
    Von:  Inaya
    An:   dich

    Die Ausleihe öffnet morgen wieder. Mein Neffe hat das PostgreSQL von
    greenhouse für herbarium geöffnet (listen_addresses und pg_hba.conf,
    sagt er). Die Einstellungen des Katalogs stehen in
    /etc/opt/seed-catalogue/catalogue.ini.

    Odette bittet um eines: „Wirf die alte nicht gleich weg.“

    Inaya

switch-over-migration =
    # Der Katalog zieht von herbarium um

    ## Erledigt
    - Snapshot: data/postgres@before-migration.
    - Dump (LATIN1) auf greenhouse (UTF8) wiederhergestellt, Akzente geprüft.

    ## Noch zu tun
    - Prüfen: dieselben Anzahlen auf beiden Seiten.
    - Den Katalog auf greenhouse zeigen lassen und wieder starten.
    - Die alte Datenbank: behalten, aber sicherstellen, dass nichts mehr hineinschreibt.

## Ereignisse

switch-over-event-counted =
    Auf greenhouse gezählt. Dieselbe Abfrage auf herbarium sollte dieselben
    Zahlen liefern: Das ist der Beweis, bevor jemand in die neue schreibt.
switch-over-event-still-old =
    Der Katalog läuft wieder… aber immer noch auf der Datenbank von
    herbarium (db_host = localhost): Neue Ausleihen würden auf den alten
    Rechner gehen. Ändere catalogue.ini und starte ihn dann neu (svcadm
    restart).
switch-over-event-online =
    Der Katalog ist online und schreibt auf greenhouse.
switch-over-event-frozen =
    In die alte Datenbank kann nicht mehr geschrieben werden: Wenn noch
    etwas auf sie zeigt, scheitert es lautstark, statt still die falsche
    Datenbank zu füllen.
switch-over-event-not-kept =
    Vorsicht: Die alten Daten oder ihr Snapshot sind weg. Bis sich der neue
    Server bewährt hat (ein paar Wochen Betrieb, ein wiederhergestelltes
    Backup), ist der alte Rechner der Weg zurück.
switch-over-event-uncounted =
    Der Katalog schreibt jetzt auf greenhouse, und die alte Datenbank ist
    eingefroren. Aber niemand hat geprüft, ob greenhouse jede Zeile hat:
    Zähl sie dort (SELECT count(*)), der Beweis, den Inaya braucht, bevor
    die Ausleihe wieder öffnet.
switch-over-event-end =
    Inaya: „Erste Ausleihe auf dem neuen Server: Bohne ‚Mère Hélène‘, an
    Zoë. Und die Sun steht immer noch im Schrank, ruhig, für alle Fälle.“

    Gut gemacht! Du hast das Kapitel „Erst vertrauen, dann umschalten“ und
    die Geschichte „Die alte Sonne“ abgeschlossen.

    WAS PASSIERT IST
    Du hast geprüft, dass beide Datenbanken übereinstimmen, den Katalog auf
    greenhouse zeigen lassen und neu gestartet, und die alte Datenbank
    eingefroren, ohne sie zu löschen. Wenn in den nächsten Wochen etwas
    schiefgeht, ist der Weg zurück noch da: die Daten von herbarium, ihr
    ZFS-Snapshot und Odettes Notizen.

    GUTE PRAXIS
    - Vor dem Umschalten prüfen: Anzahlen auf beiden Seiten, ein paar
      Zeilen von Hand.
    - An einer Stelle umschalten (der Konfiguration der Anwendung), dann
      neu starten, was sie liest.
    - Das alte System einfrieren statt löschen: nur lesbar
      (default_transaction_read_only) oder gestoppt, aber behalten.
    - Vorher entscheiden, wann der alte Rechner wirklich geht: zum Beispiel
      nach dem ersten wiederhergestellten Backup des neuen.

    EIN ANDERER WEG
    Ein DNS-Name für die Datenbank (db.seeds.internal) ließe dich durch
    Ändern eines einzigen Eintrags umschalten, ohne die Anwendung
    anzufassen. Für einen Dienst, der nicht stoppen kann, kopiert logische
    Replikation die Änderungen laufend bis zum Umschalten.

    DOKUMENTATION
    - default_transaction_read_only: https://www.postgresql.org/docs/16/runtime-config-client.html
    - svcadm(1M): https://docs.oracle.com/cd/E26505_01/html/816-5166/svcadm-1m.html
