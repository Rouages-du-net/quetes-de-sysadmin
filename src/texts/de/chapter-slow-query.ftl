### Geschichte „Das Theater“, Kapitel 2 „Die langsame Abfrage“: EXPLAIN,
### ein sequenzieller Scan, CREATE INDEX. SQL, Pfade und die Ausgaben der
### Werkzeuge werden nicht übersetzt.

chapter-slow-query = Die langsame Abfrage
    .summary = Der Saalplan braucht fünf Sekunden, bis er erscheint, für jedes Stück. PostgreSQL loggt die langsame Abfrage; frag es, wie es sie ausführt, und gib ihm eine Abkürzung.

## Dateien

slow-query-message-camille =
    Von:     Camille
    An:      dich
    Betreff: Der Saalplan ist so langsam

    Hallo,

    Noch einmal danke für die Premiere! Jetzt ist der Saalplan sehr
    langsam: fünf Sekunden, bis die Plätze erscheinen, für jedes Stück.
    Als das Theater eröffnet hat, kam er sofort. Zum Messen:
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:3000/shows/42/seats

    Die Tabelle bookings enthält jeden Platz, der seit der Eröffnung des
    Theaters verkauft wurde. Ich will unsere Geschichte nicht löschen.

    Gleiches sudo-Passwort: vorhang-2028.

    Camille

## Ereignisse

slow-query-event-slow =
    4812 ms für eine Abfrage: SELECT seat, status FROM bookings WHERE
    show_id = 42. PostgreSQL loggt jede Anweisung, die langsamer als 1 s
    ist (log_min_duration_statement in postgresql.conf). Wie führt es sie
    aus? (man psql: EXPLAIN)
slow-query-event-seqscan =
    Seq Scan on bookings: Um die 380 Plätze von Stück 42 zu finden, liest
    PostgreSQL die ganze Tabelle, alle 480.000 Zeilen (mit zwei parallelen
    Workern, aber trotzdem). „Rows Removed by Filter“ in EXPLAIN ANALYZE
    sagt, wie viele es umsonst gelesen hat. Ein Inhaltsverzeichnis für
    show_id würde es direkt zu den richtigen Zeilen führen.
slow-query-event-wrong-column =
    Ein Index auf bookings, aber nicht auf der Spalte der Bedingung: Die
    Abfrage sucht show_id = 42, und EXPLAIN liest immer noch die ganze
    Tabelle. Ein Index hilft den Abfragen, die nach seiner Spalte filtern
    (oder sortieren).
slow-query-event-vacuum =
    VACUUM räumt tote Zeilen auf, ANALYZE frischt die Statistiken auf, die
    der Planer benutzt: Beides ist gesund, aber keins von beiden schafft
    einen Weg, die Zeilen eines Stücks zu finden, ohne alle zu lesen.
slow-query-event-end =
    Der Saalplan erscheint wieder sofort: EXPLAIN benutzt jetzt den Index
    { $index } (Index Scan) und liest 380 Zeilen statt 480.000. Camille:
    „Und wir behalten die ganze Geschichte!“

    Gut gemacht! Du hast das Kapitel „Die langsame Abfrage“ abgeschlossen.

    WAS PASSIERT IST
    Die Tabelle bookings wächst mit jedem Stück. Ohne Index auf show_id
    heißt die Plätze eines Stücks zu finden, jede Zeile zu lesen: kein
    Problem bei ein paar Tausend, fünf Sekunden bei 480.000. EXPLAIN hat es
    gesagt: Seq Scan, Filter, Rows Removed by Filter.

    DER INDEX
    Ein Index (standardmäßig ein B-Baum) ist eine sortierte Kopie einer
    Spalte, mit dem Ort jeder Zeile: PostgreSQL findet die Zeilen von
    Stück 42 in wenigen Schritten, egal wie groß die Tabelle ist. Er
    braucht Platz auf der Platte und verlangsamt jedes INSERT ein wenig:
    Man indiziert die Spalten, nach denen die Abfragen filtern, nicht jede
    Spalte.

    GUTE PRAXIS
    - Finde die langsamen Abfragen: log_min_duration_statement (oder die
      Erweiterung pg_stat_statements).
    - EXPLAIN zeigt den Plan; EXPLAIN ANALYZE führt ihn aus und fügt die
      echten Zeiten hinzu.
    - Auf einer viel benutzten Produktionstabelle blockiert CREATE INDEX
      CONCURRENTLY die Schreibzugriffe nicht, während der Index entsteht.

    DOKUMENTATION
    - EXPLAIN: https://www.postgresql.org/docs/16/using-explain.html
    - Indizes: https://www.postgresql.org/docs/16/indexes-intro.html
    - CREATE INDEX: https://www.postgresql.org/docs/16/sql-createindex.html
