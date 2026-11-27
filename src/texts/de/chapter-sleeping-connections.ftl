### Story "The Allotments", chapter "Sleeping Connections": the
### allotments' site answers "Too many connections". MariaDB's connections
### (SHOW PROCESSLIST), wait_timeout, max_connections, KILL, the slow query
### log, EXPLAIN, CREATE INDEX. Commands, options, paths, SQL and outputs
### are not translated.

chapter-sleeping-connections = Schlafende Verbindungen
    .summary = An einem Frühlingssamstag antwortet die Buchungs-Site der Kleingärten „Too many connections“, gerade als alle eine Gießzeit wollen. Finde heraus, wer die Verbindungen der Datenbank hält, warum sie nie gehen, und warum jede Seite vierzig Sekunden braucht.

## Files

sleeping-connections-message-halima =
    Von: Halima (Vorsitzende, Kleingartenverein Grünholm)
    Samstag, 10. Mai, 9:20
    
    Hallo, und willkommen an Bord!
    
    Es ist der erste sonnige Samstag der Saison, und alle versuchen, auf
    www.greenholme.example eine Gießzeit oder die Bodenfräse zu buchen. Die
    Hälfte bekommt eine Seite, die „Too many connections“ sagt, die andere
    Hälfte wartet ewig. Lwazi, der Plotline geschrieben hat (unsere
    Buchungs-App), sitzt bis heute Abend im Zug; er sagt, es ist „die
    Datenbank“, und hat dir eine Notiz hinterlassen.
    
    Die Datenbank lebt auf kelle, wo du gerade bist. sudo funktioniert mit
    deinem Passwort. Könntest du nachsehen? Bitte lass das Problem nicht nur
    für eine Stunde verschwinden: nächsten Samstag wird es genauso sein.
    
    Halima
sleeping-connections-note-lwazi =
    Notizen von Lwazi (kelle, 2027, letzten Frühling ergänzt)
    
    - Auf kelle läuft MariaDB (das Debian-Paket, der Dienst mariadb). Die
      Datenbank ist plots: members, plots, waitlist, bookings.
    - Plotline läuft auf shed (198.51.100.133) und verbindet sich über das
      hintere Netzwerk als plotline mit kelle.
    - Als root auf kelle öffnet sudo mariadb die Datenbank (Debian lässt
      den root des Systems über den Socket herein, ohne Passwort).
    - Die Konfiguration: /etc/mysql/mariadb.conf.d/50-server.cnf. Die Logs
      gehen ins Journal: journalctl -u mariadb.
    - Ich weiß, dass die App ihre Verbindungen nicht richtig schließt. Steht
      auf meiner Liste. MariaDB räumt sie irgendwann auf, glaube ich?
    
    Lwazi

## Events

sleeping-connections-event-crowd =
    Schau dir die Spalte Command an: fast jede Verbindung ist Sleep. Alle
    kommen von shed (198.51.100.133) als plotline, und ihre Time wächst
    immer weiter: tausende Sekunden im Schlaf. Jede hält einen der 151
    Plätze (max_connections); wenn alle belegt sind, bekommt der nächste
    Besucher „Too many connections“ (du bist nur hereingekommen, weil root
    einen Platz extra behält). Wie lange lässt MariaDB eine Verbindung
    schlafen, bevor es sie schließt? (SHOW VARIABLES LIKE '%timeout%'; man
    mariadb.)
sleeping-connections-event-too-big =
    max_connections in dieser Größe verschiebt nur die Wand: die App würde
    zehntausend Plätze füllen, so wie sie 151 füllt, und jede Verbindung
    kostet Speicher (Puffer, ein Thread), bis dem Server der Speicher
    ausgeht. Das Limit ist eine Schutzvorrichtung; falsch ist, dass nichts
    die schlafenden Verbindungen je schließt. Setz es auf einen
    vernünftigen Wert zurück (151 ist der Standard).
sleeping-connections-event-restart-only =
    Der Neustart hat jede Verbindung geschlossen, und die Site atmet wieder.
    Aber die App öffnet jede halbe Minute drei neue und schließt sie nie,
    und wait_timeout lässt jede immer noch acht Stunden schlafen: in weniger
    als einer Stunde sind die 151 Plätze wieder voll. Was entscheidet, wie
    lange eine schlafende Verbindung bleiben darf, auch beim nächsten
    Start?
sleeping-connections-event-timeout =
    wait_timeout ist für den Server jetzt kürzer: die Verbindungen, die sich
    ab jetzt öffnen, werden nach so viel Schlaf geschlossen („Aborted
    connection … Got timeout reading communication packets“ im Journal).
    Sind die schon vorhandenen betroffen?
sleeping-connections-event-old-sessions =
    { $count } schlafende Verbindungen sind noch da, und ihre Time wächst
    weiter über dein neues Limit hinaus. SET GLOBAL ändert nur den
    Standardwert, den neue Sitzungen beim Verbinden kopieren: jede
    bestehende Sitzung behält das wait_timeout, das sie bekommen hat, acht
    Stunden. Sie müssen geschlossen werden (KILL id;, oder mariadb-admin
    kill id,id,…; SELECT id FROM information_schema.PROCESSLIST WHERE …
    listet sie auf).
sleeping-connections-event-cleared =
    Die alten schlafenden Verbindungen sind weg, und die neuen bleiben nur
    ein paar Minuten: die Plätze sind frei, die Site antwortet wieder.
sleeping-connections-event-persisted =
    Das kürzere wait_timeout steht jetzt in 50-server.cnf: der Server liest
    es bei jedem Start, nicht nur bis zum nächsten Neustart.
sleeping-connections-event-slow-log =
    Das Slow Query Log ist an: jede Abfrage, die länger als long_query_time
    dauert, wird dort mit ihrer Zeit und den untersuchten Zeilen
    geschrieben. Lies es (die Datei ist slow_query_log_file; SHOW VARIABLES
    LIKE 'slow_query%'): welche Abfrage ist langsam, und wie viele Zeilen
    liest sie für ihre Antwort?
sleeping-connections-event-explain =
    type ALL, key NULL, rows 1834212: um die Buchungen einer Parzelle zu
    finden, liest MariaDB die ganze Tabelle, jedes Mal, wenn jemand die
    Seite einer Parzelle öffnet, und jede dieser Verbindungen bleibt vierzig
    Sekunden beschäftigt. Ein Index auf der Spalte der WHERE-Klausel lässt
    es direkt zu den richtigen Zeilen gehen (man mariadb: CREATE INDEX).
sleeping-connections-event-wrong-index =
    Dieser Index beginnt mit einer anderen Spalte: für WHERE plot_id = …
    kann MariaDB ihn nicht benutzen (EXPLAIN sagt immer noch type ALL). Ein
    Index hilft den Abfragen, deren WHERE (oder ORDER BY) mit seiner ersten
    Spalte beginnt.
sleeping-connections-event-index =
    Mit dem Index sagt EXPLAIN type ref, ein paar hundert Zeilen: die Seite
    einer Parzelle antwortet in ein paar Millisekunden statt vierzig
    Sekunden.
sleeping-connections-event-end =
    Halima: „Es geht! Jemand hat schon die Bodenfräse für 14 Uhr gebucht.
    Lwazi sagt, er repariert heute Abend die Verbindungen der App, und dankt
    dir für den Index.“
    
    Gut gemacht! Du hast „Schlafende Verbindungen“ abgeschlossen.
    
    WAS PASSIERT IST
    Plotline öffnete Verbindungen zu MariaDB und schloss sie nie. Mit
    wait_timeout auf seinem Standardwert, 28800 Sekunden, hielt der Server
    jede acht Stunden schlafend, bis die 151 Plätze von max_connections alle
    belegt waren und Besucher „Too many connections“ bekamen. Gleichzeitig
    las jede Parzellenseite die 1,8 Millionen Zeilen von bookings, weil kein
    Index plot_id abdeckte. Du hast wait_timeout für den laufenden Server
    und in seiner Konfiguration verkürzt, die Sitzungen geschlossen, die
    ihr altes Timeout behielten, die langsame Abfrage gefunden und ihr ihren
    Index gegeben.
    
    GUTE PRAXIS
    - Zuerst SHOW PROCESSLIST: wer verbunden ist, von wo, und was er tut
      (Sleep, oder eine Abfrage und wie lange schon).
    - SET GLOBAL ändert den laufenden Server, und nur neue Sitzungen
      kopieren es; die Konfigurationsdatei liest der nächste Start. Beides
      tun.
    - max_connections ist eine Schutzvorrichtung: es anzuheben versteckt ein
      Leck, bis der Speicher ausgeht. Die echte Lösung liegt in der App
      (Verbindungen schließen, oder ein Verbindungspool), und wait_timeout
      räumt hinter ihr auf.
    - Das Slow Query Log und EXPLAIN sagen dir, welche Abfrage wehtut und
      warum; ein Index auf der Spalte der WHERE-Klausel ist oft die ganze
      Antwort.
    - Root behält eine Verbindung extra (extra_max_connections): lass nie
      eine App sich mit einem Konto verbinden, das dieses Recht hat.
    
    DOKUMENTATION
    - Systemvariablen des Servers (wait_timeout, max_connections): https://mariadb.com/kb/en/server-system-variables/
    - SHOW PROCESSLIST: https://mariadb.com/kb/en/show-processlist/
    - KILL: https://mariadb.com/kb/en/kill/
    - Das Slow Query Log: https://mariadb.com/kb/en/slow-query-log-overview/
    - EXPLAIN: https://mariadb.com/kb/en/explain/
    - CREATE INDEX: https://mariadb.com/kb/en/create-index/

## What the three chapters of the story share: kept here so that they load with the story.

allotments-plotline-readme =
    Plotline, die Buchungs-App des Kleingartenvereins Grünholm (Lwazi).
    gunicorn auf 0.0.0.0:8000, hinter dem nginx der Site.
    Ihre Einstellungen stehen in /srv/plotline/.env, gelesen, wenn der
    Dienst plotline startet: nach einer Änderung sudo systemctl restart
    plotline.
    Ihr Log: /var/log/plotline/app.log.
