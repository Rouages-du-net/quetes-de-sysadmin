### Story "The Choir", chapter "Forget Me": a leaving member asks to be
### erased (GDPR article 17); the accounting records stay; then a purge
### that really runs (a systemd timer) and backups that age out (restic
### forget --prune). Commands, options, paths and outputs are not translated.

chapter-forget-me = Vergiss mich
    .summary = Ein Tenor verlässt den Chor und bittet darum, vergessen zu werden. Lösch ihn dort, wo das Gesetz es erlaubt, behalte, was das Gesetz zu behalten verlangt, dann lass die Richtlinie von selbst geschehen: eine nächtliche Bereinigung, die wirklich läuft, und Backups, die sich nicht für immer erinnern.

## Files

forget-me-message-kenji =
    Von: Kenji (Kassenwart)
    Montag, 7. April, 9:30
    
    Guten Morgen,
    
    Tomas Novak hat uns am Samstag verlassen, und er bittet uns, seine Daten
    zu löschen (seine Nachricht liegt in deinem Home-Verzeichnis). Das ist
    in Ordnung. Eins aber, vom Kassenwart: seine Beiträge stehen in unserer
    Buchhaltung, und die Buchhaltung muss zehn Jahre aufbewahrt werden. Die
    Richtlinie sagt es auch. Bitte lass meine Bücher nicht lügen.
    
    Wo du gerade dabei bist: Amara fragt sich, ob das „2 Jahre nach dem
    Austritt“ der Richtlinie je passiert ist. Ruben hat dafür ein
    Bereinigungsskript geschrieben, glaube ich, und das wöchentliche Backup
    läuft seit 2029. Vergisst ein Backup irgendetwas?
    
    Kenji
forget-me-message-tomas =
    Von: Tomas Novak
    An: den Vorstand des Chors am Fluss
    Sonntag, 6. April
    
    Hallo,
    
    Wie ihr wisst, bin ich für die Arbeit nach Lissabon gezogen. Es war
    eine Freude, all die Jahre mit euch zu singen.
    
    Ich möchte, dass ihr meine personenbezogenen Daten löscht (Artikel 17
    der DSGVO): mein Profil, mein Foto, meine Anwesenheiten, den
    Newsletter. Ich weiß, dass ihr manches für die Buchhaltung behalten
    müsst; sagt mir einfach, was.
    
    Danke euch allen, und viel Glück für das Frühjahrskonzert!
    Tomas

## Events

forget-me-event-found =
    Das ist Tomas, Mitglied 41. Er steht in mehr als einer Tabelle: die
    Mitgliedertabelle, die Anwesenheiten, die Beiträge, der Newsletter
    (über seine E-Mail). Welche erreicht die Löschung, und welche verlangt
    das Gesetz zu behalten?
forget-me-event-payments-deleted =
    Seine Beiträge sind aus der Tabelle payments verschwunden: das sind die
    Buchhaltungsunterlagen des Chors, die die Richtlinie (und das Gesetz)
    zehn Jahre aufbewahrt. Die Löschung gilt nicht für Daten, die du
    aufbewahren musst (DSGVO, Artikel 17 Absatz 3). Stell sie wieder her:
    der Dump von letzter Nacht hat sie (grep SUB-20 /var/backups/choir.sql
    | grep 041), und INSERT INTO payments VALUES (…) holt sie zurück, eine
    Zeile pro Beitrag.
forget-me-event-erased =
    Tomas ist aus members, attendance und dem Newsletter verschwunden, und
    seine Beiträge bleiben mit seinem Namen in den Büchern: das wird Kenji
    ihm schreiben. Was enthält sonst noch seine Daten auf der Platte?
forget-me-event-uploads = Sein Foto und seine Einwilligung sind aus den Uploads verschwunden.
forget-me-event-purge-broken =
    Rubens Bereinigung ist nie gelaufen: ihr Timer wurde nie aktiviert, und
    ihr Dienst läuft als www-data, das in PostgreSQL keine Rolle hat („role
    "www-data" does not exist“). Und ihr Skript sagt „TODO attendance“.
    Repariere den Dienst, das Skript und den Timer (man systemd.timer,
    systemctl enable --now), oder plane den Job auf andere Weise.
forget-me-event-purge-too-much =
    Vorsicht: die Bereinigung, so wie sie heute Nacht laufen wird, würde
    Daten löschen, die die Richtlinie behält (aktuelle Mitglieder,
    Menschen, die vor weniger als zwei Jahren gegangen sind, neuere
    Anwesenheiten, die Zahlungen oder den Newsletter). Prüf ihre
    WHERE-Klauseln, bevor du sie jede Nacht von einem Timer ausführen lässt.
forget-me-event-purge-partial =
    Die Bereinigung, so wie sie laufen wird, macht die halbe Arbeit: die
    Richtlinie begrenzt auch die Anwesenheit bei Proben auf zwei Jahre und
    die Einträge früherer Mitglieder auf zwei Jahre nach ihrem Austritt.
    Beide Zeilen gehören in den Job.
forget-me-event-purge-idle =
    Ein Bereinigungsjob ist geplant, aber so ausgeführt, wie er laufen wird,
    löscht er nichts: schau, was er sagt, wenn er läuft (systemctl start,
    dann journalctl -u), unter welchem Konto er läuft und ob dieses Konto
    die Datenbank erreicht.
forget-me-event-purge =
    Heute Nacht, und jede Nacht, wird die Bereinigung die früheren
    Mitglieder löschen, die vor mehr als zwei Jahren gegangen sind, und die
    Anwesenheiten, die älter als zwei Jahre sind, und sonst nichts. Jetzt
    die Backups: was enthalten sie noch?
forget-me-event-snapshots =
    { $count } wöchentliche Snapshots, zurück bis September 2029: das Backup
    hat nie etwas vergessen. Alles, was heute gelöscht wurde, und alles, was
    die Bereinigung löscht, lebt darin für immer weiter. Die Richtlinie sagt
    drei Monate wöchentlicher Backups (man restic: forget, --keep-weekly,
    --keep-within, --prune).
forget-me-event-too-few =
    Es sind zu wenige Backups übrig: die Richtlinie sagt drei Monate
    wöchentlicher Backups, damit ein schlechtes Backup heute Nacht noch aus
    einem älteren wiederhergestellt werden kann. Vergessene und
    bereinigte Snapshots kommen nicht zurück: auf einem echten Server wären
    sie verloren; hier starte das Kapitel neu (oder nimm den
    Wiederherstellungspunkt) und wähle eine Policy, die etwa drei Monate
    behält.
forget-me-event-no-prune =
    Die alten Snapshots sind vergessen, aber ihre Daten sind noch im
    Repository: forget entfernt nur die Snapshots, prune löscht die Daten,
    die kein Snapshot mehr benutzt (oder forget --prune).
forget-me-event-trimmed =
    Das Repository enthält jetzt etwa drei Monate wöchentlicher Backups,
    bereinigt. Nächsten Sonntag fügt das Backup noch eines hinzu: wird
    irgendetwas das älteste verschwinden lassen?
forget-me-event-script-unchanged =
    Du hast das Repository von Hand gestutzt, aber das wöchentliche
    Backup-Skript vergisst nichts: in einem Jahr gibt es fünfzig Snapshots
    mehr. Die Policy gehört ins Skript (/usr/local/sbin/choir-backup), nach
    dem Backup.
forget-me-event-script =
    Das wöchentliche Backup vergisst jetzt, was älter als etwa drei Monate
    ist, und bereinigt: gelöschte Daten verlassen die Backups nach einem
    bekannten Zeitplan.
forget-me-event-end =
    Kenji: „Meine Bücher sind unversehrt, Tomas hat seine Antwort, und Amara
    sagt, die Richtlinie läuft endlich von selbst. Ich werde besser
    schlafen.“
    
    Gut gemacht! Du hast „Vergiss mich“ abgeschlossen.
    
    WAS PASSIERT IST
    Tomas hat um seine Löschung gebeten. Du hast seinen Eintrag, seine
    Anwesenheiten, sein Newsletter-Abonnement und seine Uploads gelöscht und
    seine Beiträge behalten, die Buchhaltungsunterlagen sind, die der Chor
    aufbewahren muss. Dann hast du die Richtlinie von selbst laufen lassen:
    Rubens Bereinigung war nie gelaufen (ein nie aktivierter Timer, ein
    Konto ohne Datenbankrolle, die Anwesenheiten vergessen), und das
    wöchentliche Backup behielt alles seit 2029. Die Bereinigung läuft
    jetzt jede Nacht, und die Backups behalten etwa drei Monate, bereinigt.
    
    GUTE PRAXIS
    - Das Recht auf Löschung (DSGVO, Artikel 17) hat Grenzen: Daten, die du
      gesetzlich aufbewahren musst (Buchhaltungsunterlagen), bleiben, und
      die Antwort sagt der Person, was und warum.
    - Überall löschen, wo die Person ist: jede Tabelle, die auf sie
      verweist, die Dateien, dann die Kopien.
    - Eine Bereinigung, die nicht geplant ist, ist ein Wunsch. Teste sie so,
      wie sie laufen wird (ihr Konto, ihr Timer: systemctl start,
      journalctl -u), und prüf, dass sie löscht, was die Richtlinie sagt, und
      sonst nichts.
    - Backups lassen sich nicht Person für Person bearbeiten: sie müssen
      nach einem bekannten Zeitplan altern (restic forget mit einer Policy,
      und prune), und wenn je eines wiederhergestellt wird, müssen die
      Löschungen erneut angewendet werden.
    - Den Nachweis der Anfrage selbst behalten (wer, wann, was getan wurde),
      nicht die Daten, die sie gelöscht hat.
    
    EIN ANDERER WEG
    Pseudonymisieren statt löschen (den Namen durch eine Kennung ersetzen)
    erhält Statistiken, aber pseudonymisierte Daten sind nach der DSGVO
    immer noch personenbezogene Daten (Erwägungsgrund 26): sie gelten erst
    als anonym, wenn niemand sie mehr auf die Person zurückführen kann.
    
    DOKUMENTATION
    - DSGVO, Artikel 5, 17 und Erwägungsgrund 26: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - Die CNIL: https://www.cnil.fr/
    - systemd.timer(5): https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - restic, Snapshots entfernen: https://restic.readthedocs.io/en/stable/060_forget.html
