### Geschichte „Die Vorratskammer“, Kapitel „Die Wiederherstellungsübung“:
### der Verlust des Servers, auf einem geliehenen Laptop (ersatz) geprobt,
### nur mit der Platte und dem Umschlag der Kassenwartin. cryptsetup open,
### restic check --read-data, restic restore, sha256sum -c, und die
### Datenbank, die der Job vergessen hat. Befehle, Optionen, Pfade und
### Ausgaben werden nicht übersetzt.

chapter-restore-drill = Die Wiederherstellungsübung
    .summary = Samstagmorgen probt die Vorratskammer den Verlust ihres Servers: ein geliehener Laptop, die Backup-Platte und der Umschlag der Kassenwartin, sonst nichts. Die Platte öffnen, das Repository bis zu seinen Daten lesen, wiederherstellen, beweisen, dass die Dateien unversehrt sind, und herausfinden, was das Backup nie enthalten hat.

## Dateien

restore-drill-message-fatou =
    Von: Fatou (Koordinatorin)
    Samstag, 17. März, 9:45

    Heute tun wir so, als wäre kiste weg: abgebrannt, gestohlen, was auch
    immer. Noor hat uns ihren alten Laptop geliehen, den wir ersatz nennen.
    Debian ist frisch darauf installiert (mit cryptsetup und restic), du
    erreichst ihn von kiste aus (ssh ersatz), und Joaquín hat die
    Backup-Platte daran angeschlossen.

    Die Spielregel: auf ersatz nur die Platte und was in Meis Umschlag
    ist. Nichts von kiste: Bei einer echten Katastrophe wären die Dateien
    von kiste Asche. Mei hat den Umschlag für uns geöffnet:

        Backup disk (LUKS):        { $disk }
        Backups (restic recovery): { $restic }

    (Danach versiegelt sie einen neuen.) Die Checkliste steht in uebung.txt.

    Fatou

restore-drill-checklist =
    WIEDERHERSTELLUNGSÜBUNG — Checkliste (Fatou, März 2029)

    1. Auf ersatz: die Backup-Platte finden, mit der Passphrase aus dem
       Umschlag öffnen, einhängen.
    2. Das Repository mit dem Passwort aus dem Umschlag öffnen; die
       Snapshots auflisten.
    3. Das Repository prüfen, ganz, Daten inklusive.
    4. Den neuesten Snapshot DANEBEN wiederherstellen (nicht über etwas),
       zum Beispiel unter /srv/restore.
    5. Beweisen, dass die Dateien unversehrt sind: Der Job schreibt vor
       jedem Backup ihre SHA-256 in SHA256SUMS.
    6. Könnte die App daraus wieder starten? Sie braucht ihre Dateien UND
       ihre Datenbank (den nächtlichen Dump, pantry.sql).
    7. Reparieren, was die Übung gezeigt hat. Die Platte auf ersatz
       schließen.

## Ereignisse

restore-drill-event-log =
    „backup completed“, jede Nacht. Das Log sagt, dass das Skript seine
    letzte Zeile erreicht hat: Es sagt nicht, was gesichert wurde, und
    auch nicht, ob es sich zurücklesen lässt. Dafür ist heute da.
restore-drill-event-plugged =
    Da ist sie, auf ersatz: sdb1, crypto_LUKS. ersatz hat keine
    Schlüsseldatei, keine crypttab, nichts: Die Passphrase im Umschlag ist
    der einzige Weg hinein (cryptsetup open).
restore-drill-event-copied-secret =
    Das ist ein Geheimnis von kiste (seine Schlüsseldatei oder das
    restic-Passwort des Jobs), auf ersatz kopiert. Bei einer echten
    Katastrophe wäre es mit kiste verbrannt: So beweist die Übung nichts.
    Lösch es von ersatz und nimm den Umschlag.
restore-drill-event-opened-key =
    Die Platte wurde mit der Schlüsseldatei von kiste geöffnet: Das ist
    der Schlüssel, der mit kiste stirbt. Schließ sie und öffne sie noch
    einmal mit Meis Passphrase.
restore-drill-event-opened =
    Die Platte öffnet sich allein mit der Passphrase aus dem Umschlag:
    erste Hälfte von Meis Frage, wirklich beantwortet. ersatz hat kein
    /mnt/offsite: Jedes leere Verzeichnis taugt als Einhängepunkt (mkdir).
restore-drill-event-mounted =
    Eingehängt. Das Repository liegt in restic/: ersatz hat kein
    /root/.restic-pass, also fragt restic nach dem Passwort (oder gib -r
    an und tippe das aus dem Umschlag).
restore-drill-event-nightly-key =
    Das ist das Passwort des Jobs, von kiste: Am Tag einer echten
    Katastrophe hättest du es nicht. Nimm das aus dem Umschlag.
restore-drill-event-snapshots =
    Das Repository öffnet sich mit dem Passwort aus dem Umschlag: zweite
    Hälfte der Frage. Bevor du ihm vertraust, prüfe es, bis zu den Daten.
restore-drill-event-check-only =
    restic check ohne Optionen prüft die Struktur des Repositorys
    (Indizes, Snapshots, Bäume): nicht den Inhalt der Packs. Um jedes Byte
    von der Platte zurückzulesen, braucht es --read-data (man restic).
restore-drill-event-read-data =
    Jedes Pack zurückgelesen und geprüft: Die Daten auf dieser Platte sind
    vollständig. Stell jetzt den neuesten Snapshot wieder her, daneben:
    restore … --target VERZEICHNIS legt darunter den vollständigen Pfad
    neu an.
restore-drill-event-over-root =
    --target / schreibt die Dateien dorthin, wo sie waren. Auf einem leeren
    ersatz schadet das nicht, aber auf einer Maschine im Betrieb würde es
    die Daten von heute mit denen von letzter Nacht überschreiben. Bei
    einer Übung daneben wiederherstellen und vergleichen.
restore-drill-event-restored =
    Die Dateien sind zurück, unter dem vollständigen Pfad, den restic neu
    angelegt hat. Wiederhergestellt ist nicht dasselbe wie richtig:
    Vergleiche sie mit dem, was der Job vor dem Backup aufgezeichnet hat
    (SHA256SUMS, sha256sum -c, aus ihrem Verzeichnis).
restore-drill-event-mismatch =
    sha256sum meldet eine Datei, die nicht passt, oder eine, die es nicht
    lesen kann. Führ es in dem Verzeichnis aus, in dem SHA256SUMS liegt:
    Die Namen darin sind relativ.
restore-drill-event-verified =
    Jede Datei passt zu ihrer SHA-256: Die Wiederherstellung ist exakt. Die
    Checkliste hat noch eine Zeile: die Datenbank.
restore-drill-event-no-dump =
    Kein pantry.sql in irgendeinem Snapshot: Der Job sichert nur
    /srv/vorratskammer. Der nächtliche Dump wird auf kiste geschrieben, in
    { $dump }, und nichts nimmt ihn je mit. Ohne ihn würde die App leer
    neu starten: keine Besuche, keine Termine. Repariere den Job auf kiste
    (seine Zeile restic backup).
restore-drill-event-fixed =
    Der Job sichert jetzt auch den Dump der Datenbank: Ab heute Nacht
    bringt eine Wiederherstellung die App vollständig zurück. (Der Dump
    wird um 23:30 geschrieben, das Backup läuft um 1:00: Die Reihenfolge
    stimmt.)
restore-drill-event-closed =
    Die Platte ist auf ersatz ausgehängt und geschlossen: Joaquín kann sie
    mitnehmen.
restore-drill-event-end =
    Fatou: „Also: Der Umschlag öffnet alles, die Dateien kommen
    unversehrt zurück, und wir haben das Loch vor dem Feuer gefunden.
    Dieselbe Übung in sechs Monaten?“ Mei versiegelt schon einen neuen
    Umschlag.

    Gut gemacht! Du hast Die Vorratskammer abgeschlossen.

    WAS PASSIERT IST
    Du hast den Verlust von kiste auf einer leeren Maschine geprobt, nur
    mit der Platte und dem Umschlag: Die Passphrase hat die Platte
    geöffnet, das Wiederherstellungspasswort das Repository, check
    --read-data hat jedes Pack gelesen, der neueste Snapshot ist daneben
    zurückgekommen, und sha256sum -c hat bewiesen, dass die Dateien exakt
    sind. Die Übung hat auch gefunden, was kein Log gezeigt hat: Der Dump
    der Datenbank wurde nie gesichert. Der Job nimmt ihn jetzt mit.

    GUTE PRAXIS
    - Ein Backup, das du nicht wiederhergestellt hast, ist eine Hoffnung.
      Regelmäßig üben, auf einer anderen Maschine, nur mit dem, was eine
      Katastrophe überleben würde.
    - „backup completed“ beweist, dass das Skript geendet hat, nicht, dass
      die richtigen Dinge darin sind: Liste auf, was eine Wiederherstellung
      braucht (Dateien, Datenbank, Konfiguration), und such nach jedem
      davon.
    - restic check --read-data liest jedes Byte zurück: ab und zu
      ausführen (oder --read-data-subset bei großen Repositorys).
    - Daneben wiederherstellen, dann vergleichen (Prüfsummen, diff): nie
      über laufende Daten.
    - Aufschreiben, wie lange die Übung gedauert hat: Das ist deine echte
      Wiederherstellungszeit.
    - Datenbank: einen Dump sichern (pg_dump), der vor dem Backup erstellt
      wird.

    DOKUMENTATION
    - restic, wiederherstellen: https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, prüfen: https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
    - sha256sum: https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html
    - PostgreSQL, Sicherung und Wiederherstellung: https://www.postgresql.org/docs/current/backup-dump.html
