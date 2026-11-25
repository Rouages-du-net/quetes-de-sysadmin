### Story "The Allotments", chapter "Broken Replica": the replica stopped on
### a duplicate key. SHOW REPLICA STATUS, read_only, START/STOP REPLICA,
### sql_slave_skip_counter, GTID, CHECKSUM TABLE, mariadb-dump
### --single-transaction, a restore test. Commands, options, paths, SQL and
### outputs are not translated.

chapter-broken-replica = Die kaputte Replica
    .summary = Die Berichtskopie der Datenbank der Kleingärten hat am Samstagabend aufgehört, der echten zu folgen, und niemand hat es bemerkt: die Warteliste, die Moana druckt, ist zwei Tage alt, und jedes nächtliche Backup auch. Repariere die Replica richtig, dann beweise, dass sich die Backups wiederherstellen lassen.

## Files

broken-replica-message-moana =
    Von: Moana (Schriftführerin, Kleingartenverein Grünholm)
    Montag, 2. Juni, 8:45
    
    Kia ora,
    
    Heute Morgen zeigt mein Wartelistenbericht (der, den ich vom
    Berichtsserver rake mache) die Leute nicht, die sich gestern
    eingetragen haben. Und ich glaube, ich habe es vielleicht verursacht: am
    Samstagnachmittag habe ich meine Nachbarin, Esi Boateng, mit meinem
    Berichtswerkzeug auf die Warteliste gesetzt, direkt auf rake. Es hat
    mich gelassen, also dachte ich, das ist in Ordnung.
    
    Lwazi sagt, rake ist eine „Replica“ von kelle, und die nächtlichen
    Backups werden auch darauf gemacht. Ich hätte gern, dass Esi auf der
    Liste bleibt, bitte!
    
    Moana
broken-replica-note-lwazi =
    Lwazi, April 2031
    
    - kelle ist der Primary: Plotline (auf barrow) schreibt dorthin. Sein
      Binärlog geht nach /var/log/mysql. rake (198.51.100.132) repliziert
      ihn, mit GTIDs, als repl. Moanas Berichte lesen rake, damit sie die
      Site nie bremsen.
    - Auf rake: sudo mariadb, dann SHOW REPLICA STATUS\G.
    - Backups: /usr/local/sbin/plots-backup auf rake, jede Nacht um 2:30
      (/etc/cron.d/plots-backup), nach /var/backups/mariadb. Ich habe nie
      versucht, eines wiederherzustellen.
    - ssh rake von kelle aus; sudo funktioniert dort mit deinem Passwort.

## Events

broken-replica-event-stopped =
    Slave_IO_Running: Yes, Slave_SQL_Running: No. Der IO-Thread kopiert noch,
    was kelle schreibt, aber der SQL-Thread, der es anwendet, hat am
    Samstag um 18:12 angehalten, und Seconds_Behind_Master ist NULL.
    Last_SQL_Error sagt warum: eine Zeile, die kelle in plots.waitlist
    eingefügt hat, id 1043, existiert schon auf rake. Vergleiche diese Zeile
    auf beiden Servern.
broken-replica-event-cause =
    Auf rake ist der Wartelisteneintrag 1043 Esi, am Samstag um 17:46 von
    Hand geschrieben; auf kelle ist 1043 Wairimu, die sich um 18:12 auf
    der Site eingetragen hat. Eine Replica darf nur empfangen, was ihr
    Primary schickt: ein einziger Schreibvorgang auf ihr genügt, damit die
    beiden Kopien voneinander abweichen. Was hätte Moanas Werkzeug daran
    gehindert, dort zu schreiben? (man mariadb: read_only.)
broken-replica-event-skipped =
    Der SQL-Thread läuft wieder, am scheiternden Event vorbei: Wairimus
    Zeile wurde übersprungen, nicht angewendet. Die 1043 von rake ist immer
    noch Esi, und Wairimu existiert nur auf kelle. Die Replica enthält
    jetzt still eine andere Datenbank. Vergleiche die Tabellen auf beiden
    Servern (CHECKSUM TABLE plots.waitlist; auf jedem).
broken-replica-event-skip-again =
    Jetzt { $count } Events übersprungen. Jedes Überspringen wirft eine
    Änderung weg, die kelle gemacht hat: die Replica folgt, aber immer
    weiter weg von ihrem Primary. Überspringen versteckt einen Fehler, es
    repariert keine Daten.
broken-replica-event-read-only =
    read_only ist an: rake lehnt jetzt Schreibvorgänge gewöhnlicher Konten
    ab, Moanas Werkzeug inklusive („running with the --read-only option“).
    Die Replikation selbst und die Admins (READ_ONLY ADMIN) können
    weiterhin schreiben.
broken-replica-event-read-only-kept =
    read_only steht jetzt in der Konfiguration von rake: es ist auch nach
    einem Neustart noch an.
broken-replica-event-repaired =
    Beide Threads laufen, kein Fehler, Seconds_Behind_Master: 0. rake hat
    die zwei Tage Änderungen nachgeholt, die es verpasst hatte.
broken-replica-event-diverged =
    Die Replica läuft, aber die Prüfsummen unterscheiden sich: rake enthält
    nicht dieselben Zeilen wie kelle. Die Replikation wendet nur Änderungen
    an; sie vergleicht und repariert nie, was schon abweicht. Finde die
    Zeilen, die sich unterscheiden, oder bau rake aus einem konsistenten
    Dump von kelle neu (mariadb-dump --single-transaction --master-data
    --gtid).
broken-replica-event-identical =
    Dieselben Prüfsummen auf beiden Servern: rake ist wieder eine genaue
    Kopie von kelle.
broken-replica-event-jun =
    Esi steht auf der Warteliste, auf kelle, wo Schreibvorgänge hingehören;
    rake empfängt ihre Zeile wie jede andere.
broken-replica-event-locking-dump =
    Ohne --single-transaction hat mariadb-dump die Tabellen gesperrt,
    während es sie las (LOCK TABLES): während des ganzen Dumps wartete der
    SQL-Thread von rake dahinter (beobachte Seconds_Behind_Master), und auf
    kelle hätte die Site gewartet. Für InnoDB-Tabellen liest
    --single-transaction einen konsistenten Snapshot, ohne etwas zu sperren.
broken-replica-event-inconsistent-dump =
    Dieser Dump hat jede Tabelle zu einem anderen Zeitpunkt gelesen,
    während rake weiter Änderungen anwandte (keine Sperre, keine
    Transaktion): eine Buchung kann darin sein ohne ihr Mitglied, eine
    Wartelistenzeile ohne ihre Aktualisierung. Er sieht gut aus und lässt
    sich ohne Fehler wiederherstellen, aber er ist kein Bild eines
    Moments. --single-transaction liefert eines.
broken-replica-event-script =
    Das nächtliche Skript macht seine Dumps jetzt mit --single-transaction:
    ein konsistenter Snapshot, ohne die Replikation anzuhalten.
broken-replica-event-backup =
    Ein konsistenter Dump von rake, gemacht, während es mit kelle im
    Gleichschritt war. Ein Backup zählt allerdings erst, wenn du es
    wiederhergestellt hast.
broken-replica-event-restored =
    Der Dump wurde in eine andere Datenbank wiederhergestellt, mit denselben
    Zeilen: dieses Backup ist bewiesen. Lösch die Schmierdatenbank, wenn du
    fertig bist.
broken-replica-event-end =
    Moana: „Esi und die Anmeldungen von gestern sind alle in meinem Bericht.
    Ich schreibe nicht mehr auf rake, und jetzt würde es mich sowieso nicht
    lassen!“
    
    Gut gemacht! Du hast „Die kaputte Replica“ abgeschlossen.
    
    WAS PASSIERT IST
    Eine von Hand auf der Replica geschriebene Zeile nahm eine id, die der
    Primary Minuten später jemand anderem gab; als diese Zeile ankam, hielt
    der SQL-Thread von rake bei einem doppelten Schlüssel an, und die
    Replica fiel zwei Tage zurück, mit ihr die nächtlichen Backups. Du hast
    rake schreibgeschützt gemacht, die verirrte Zeile dort entfernt und Esi
    auf kelle hinzugefügt, die Replikation neu gestartet und geprüft, dass
    beide Server dieselben Zeilen enthalten; dann hast du das Backup
    konsistent gemacht und es durch eine Wiederherstellung bewiesen.
    
    GUTE PRAXIS
    - Eine Replica ist read_only (in ihrer Konfiguration): Schreibvorgänge
      gehen nur an den Primary. Slave_SQL_Running und
      Seconds_Behind_Master überwachen, nicht nur, ob der Server antwortet.
    - sql_slave_skip_counter wirft eine Änderung weg: die Replica läuft
      wieder, weicht aber von ihrem Primary ab. Die Daten reparieren, oder
      die Replica aus einem konsistenten Dump mit seiner GTID-Position neu
      bauen.
    - Vergleichen statt hoffen: CHECKSUM TABLE auf beiden Seiten
      (pt-table-checksum oder mariadb-dump und diff bei einer großen Basis).
    - mariadb-dump --single-transaction liefert einen konsistenten Snapshot
      von InnoDB-Tabellen ohne Sperre; --skip-lock-tables allein liefert
      Tabellen, die zu verschiedenen Zeitpunkten gelesen wurden.
    - Ein Backup wird durch eine Wiederherstellung bewiesen: in eine
      Schmierdatenbank, dann vergleichen.
    
    DOKUMENTATION
    - SHOW REPLICA STATUS: https://mariadb.com/kb/en/show-replica-status/
    - Globale Transaktions-IDs: https://mariadb.com/kb/en/gtid/
    - read_only: https://mariadb.com/kb/en/server-system-variables/#read_only
    - sql_slave_skip_counter: https://mariadb.com/kb/en/replication-and-binary-log-system-variables/#sql_slave_skip_counter
    - CHECKSUM TABLE: https://mariadb.com/kb/en/checksum-table/
    - mariadb-dump: https://mariadb.com/kb/en/mariadb-dump/
