### Geschichte „Das Tierheim“, Kapitel „Was haben wir?“: der 2029
### geschriebene Notfallwiederherstellungsplan, verglichen mit dem, was
### koppel wirklich laufen hat (Units, Timer, Sockets, der Backup-Job), RPO
### und RTO pro Dienst, und ein Backup innerhalb jedes RPO. Auch die Texte,
### die die ganze Geschichte teilt (shelter-*). Befehle, Optionen, Pfade und
### Ausgaben werden nicht übersetzt.

chapter-what-we-have = Was haben wir?
    .summary = Die Tierheime haben einen schriftlichen Notfallwiederherstellungsplan. 2029 stimmte er. Bevor etwas schiefgeht, vergleiche ihn mit dem, was der Server wirklich laufen hat, gib jedem Dienst einen Wiederherstellungspunkt und eine Wiederherstellungszeit, die er wirklich einhalten kann, und sorge dafür, dass jeder ein Backup hat, das jung genug ist.

## Shared by the story: the world's data and files

shelter-animal-names =
    Keks
    Mango
    Pfeffer
    Wacholder
    Otis
    Klementine
    Rolo
    Haselnuss
    Gurke
    Nala
    Brombeere
    Ziggy
    Weide
    Fudge
    Pixel
    Safran
    Bohne
    Luna
    Tofu
    Ahorn
    Kiwi
    Staubi
    Kürbis
    Ingwer
    Moos
    Klee
    Bowie
    Erdnuss
    Socke
    Indigo
shelter-species =
    Hund
    Katze
    Katze
    Kaninchen
    Hund
    Meerschweinchen
shelter-volunteer-names =
    Teuila
    Mirela
    Rahel
    Wiremu
    Oyelaran
    Bilal
    Chiamaka
    Dmitri
    Ximena
    Farida
    Gideon
    Hyun-woo
    Isolde
    Jamal
    Kalinda
    Lorenzo
    Mahsa
    Nikolai
    Odessa
    Priyanka
shelter-site-hillside = Hillside
shelter-site-riverbend = Riverbend
shelter-env-comment = Einstellungen von Adopt (Dariusz, 2029). Beim Start des Dienstes gelesen.
shelter-adopt-readme =
    Adopt: die Adoptions-App der Tierheime (Flask, von gunicorn auf
    127.0.0.1:8000 ausgeliefert, hinter /adopt/ von nginx).
    Ihre Daten liegen in der PostgreSQL-Datenbank „shelter“ (Tiere,
    Adoptionen, Ehrenamtliche). Sie braucht die Datenbank zum Starten.
shelter-backup-comment = Nächtliches Backup von koppel nach wiese (Dariusz, 2029): der Dump der Datenbank, dann restic.
shelter-vetlink-comment = vetlink: holt die Akten der Tierarztpraxis zu unseren Tieren, jede Stunde (Mirela, 2031).
shelter-site-index =
    <!DOCTYPE html>
    <html lang="de">
    <head>
    <meta charset="utf-8">
    <title>Tierheime Hillside</title>
    </head>
    <body>
    <h1>Tierheime Hillside</h1>
    <p>Hunde, Katzen und Kaninchen, die auf ein Zuhause warten, in Hillside und Riverbend.</p>
    <p><a href="/adopt/">Adoptieren</a> · <a href="/adopt/animals">Die Tiere, die auf dich warten</a></p>
    </body>
    </html>
shelter-app-home =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Adoptieren — Tierheime Hillside</title></head>
    <body><h1>Adoptieren</h1><p>Lerne die Tiere kennen, buche einen Besuch, starte eine Adoption.</p></body>
    </html>
shelter-app-animals =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die wartenden Tiere — Adoptieren</title></head>
    <body><h1>Die wartenden Tiere</h1><p>{ $count } Tiere warten auf ein Zuhause.</p></body>
    </html>
shelter-plan-col-service = Dienst
shelter-plan-col-backup = Backup
shelter-plan-col-owner = Verantwortlich
shelter-zone-comment = hillsideshelters.example, versteckter Primary auf wiese; der Server des Registrars stellt sie bereit.
shelter-drill-draft =
    #!/bin/sh
    # Wiederherstellungsübung (Entwurf von Mirela, November 2031). Noch nicht geplant.
    set -e
    export RESTIC_REPOSITORY={ $repo }
    export RESTIC_PASSWORD_FILE=/root/.restic-drill
    restic snapshots --latest 1
    echo "$(date -Is) drill done"

shelter-plan-2029 =
    # Notfallwiederherstellungsplan — Tierheime Hillside

    Geschrieben von Dariusz, Mai 2029. Halte ihn aktuell, und halte ihn von
    koppel fern: Der Plan muss den Server überleben, den er beschreibt.

    ## Dienste

    | Dienst | RPO | RTO | Backup | Verantwortlich |
    |--------|-----|-----|--------|----------------|
    | Website (nginx) | 24h | 2 Tage | restic, jede Nacht um 02:00 | Dariusz |
    | Adoptions-App und ihre Datenbank (PostgreSQL) | 1h | 1 Tag | pg_dump, dann restic, jede Nacht um 02:00 | Dariusz |
    | Newsletter (phpList) | 1 Woche | 1 Woche | restic, jede Nacht um 02:00 | Dariusz |

    RPO (Recovery Point Objective): wie viele Daten wir verlieren dürfen,
    die Zeit seit dem letzten guten Backup.
    RTO (Recovery Time Objective): wie lange der Dienst ausfallen darf.
    Dauern als 30min, 4h, 1 Tag, 1 Woche.

    ## Backups

    Der nächtliche Job auf koppel (/usr/local/sbin/shelter-backup, gestartet
    von shelter-backup.timer) dumpt die Datenbank und schickt dann ihre
    Dateien in das restic-Repository auf wiese (/srv/restic, über sftp). Das
    Wiederherstellungspasswort liegt in einem versiegelten Umschlag in
    Rahels Tresor.

    ## Reihenfolge der Wiederherstellung

    Noch zu schreiben.

shelter-plan-2031 =
    # Notfallwiederherstellungsplan — Tierheime Hillside

    Geschrieben von Dariusz, Mai 2029; überarbeitet von Teuila und dir,
    November 2031. Halte ihn aktuell, und halte ihn von koppel fern: Der
    Plan muss den Server überleben, den er beschreibt.

    ## Dienste

    | Dienst | RPO | RTO | Backup | Verantwortlich |
    |--------|-----|-----|--------|----------------|
    | Website (nginx) | 24h | 8h | restic, jede Nacht um 02:00 | Teuila |
    | Adoptions-App und ihre Datenbank (PostgreSQL) | 24h | 8h | pg_dump, dann restic, jede Nacht um 02:00 | du |
    | Tierarztakten (vetlink) | 24h | 2 Tage | restic, jede Nacht um 02:00 | Mirela |

    ## Backups

    Der nächtliche Job auf koppel dumpt die Datenbank (shelter.sql, mit
    ihrer SHA-256 in shelter.sha256 und ihren Zeilenzahlen in
    shelter.counts) und schickt dann /etc, /var/www, /srv/adopt,
    /srv/vetlink und /var/backups in das restic-Repository auf wiese
    (/srv/restic, über sftp). Das Wiederherstellungspasswort liegt in einem
    versiegelten Umschlag in Rahels Tresor.

    ## Reihenfolge der Wiederherstellung

    1. Eine Maschine mit frischem Debian 13 und restic.
    2. Die Pakete, die die Dienste brauchen (die Tabelle des Plans), aus
       Debian.
    3. Der neueste Snapshot, NEBEN dem neuen System wiederhergestellt. /etc
       gehört der neuen Maschine: Nimm aus dem Backup nur, was unseres ist
       (die Website, die App, die Units), nie ihre Platten, ihre Identität
       oder ihre Schlüssel.
    4. Die Datenbank, aus dem Dump neu angelegt, gegen die SHA-256 und die
       Zeilenzahlen des Jobs geprüft, bevor irgendetwas sie benutzt.
    5. In der Reihenfolge der Abhängigkeiten starten: die Datenbank, die
       App, dann nginx.
    6. Auf der Maschine selbst testen, bevor irgendjemand irgendetwas
       umschaltet.
    7. www umschalten (seine TTL ist seit November 2031 dafür 300 Sekunden)
       und von außen prüfen.
    8. Die Nachbetrachtung schreiben; die nächste Übung planen.

## Files

what-we-have-message-teuila =
    Von: Teuila (Koordination)
    Montag, 3. November, 9:20

    Hallo, und willkommen in den Tierheimen!

    Der Vorstand hat mir eine einfache Frage gestellt: „Wenn koppel heute
    Nacht stirbt, was tun wir?“ Auf dem Papier haben wir eine Antwort: den
    Notfallwiederherstellungsplan von Dariusz, /srv/drp/plan.md hier auf
    wiese. Aber Dariusz ist 2030 an die Küste gezogen, und der Plan hat sich
    seit 2029 nicht bewegt.

    Könntest du ihn wieder wahr machen? Schau dir an, was koppel wirklich
    laufen hat (ssh koppel von hier aus), vergleiche mit dem Plan und
    korrigiere die Tabelle: eine Zeile pro Dienst, mit einem RPO und einem
    RTO, die wir wirklich einhalten können, ihrem Backup und jemandem, der
    noch da ist, um dafür geradezustehen (ich, Mirela, Rahel, Wiremu oder
    du).

    Und prüf, dass jeder Dienst darin wirklich ein ausreichend aktuelles
    Backup hat. Das Repository liegt hier auf wiese, in /srv/restic; der
    nächtliche Job von koppel hat das Passwort.

    Danke!
    Teuila

## Events

what-we-have-event-plan =
    Die Tabelle von Dariusz: drei Dienste, ihr RPO (wie viele Daten du
    verlieren darfst) und RTO (wie lange sie ausfallen dürfen). Ist das noch,
    was koppel laufen hat? Die Worte des Plans selbst sind der Ausgangspunkt,
    nicht die Antwort: Schau dir die Maschine an.
what-we-have-event-paddock =
    Du bist auf koppel, im Keller von Hillside. Eine Bestandsaufnahme beginnt
    mit dem, was läuft, nicht mit dem, was geschrieben wurde: die Dienste
    (systemctl list-units --type=service), was geplant ist (systemctl
    list-timers, crontab -l), was lauscht (ss -tlnp).
what-we-have-event-units =
    nginx, postgresql und adopt: die Adoptions-App, die der Plan erwähnt, ein
    eigener Dienst (ihre Unit liegt in /etc/systemd/system). Und nirgendwo
    phpList.
what-we-have-event-timers =
    Zwei eigene Timer der Tierheime: shelter-backup (der nächtliche Job) und
    vetlink-sync, jede Stunde. vetlink ist in keiner Zeile des Plans.
    systemctl cat vetlink-sync.service sagt, was er ausführt und wohin seine
    Daten gehen.
what-we-have-event-sockets =
    ssh und nginx zum Netz hin; PostgreSQL (5432) und gunicorn der App (8000)
    nur auf 127.0.0.1, hinter nginx. Was lauscht, passt zu dem, was läuft:
    Da ist nichts versteckt.
what-we-have-event-no-phplist =
    Kein phpList auf koppel: Es wurde 2030 entfernt (der Newsletter ist zu
    einem Mailing-Dienst gewechselt). Ein Plan, der wiederherstellt, was es
    nicht mehr gibt, schickt dich in der schlimmsten Nacht des Jahres auf
    die Suche danach: Seine Zeile fliegt raus.
what-we-have-event-script =
    Der nächtliche Job sichert /etc, /var/www, /srv/adopt und /var/backups.
    vetlink schreibt seine Akten nach { $path }: Das ist nicht in der Liste.
    Mirelas Akten sind in überhaupt keinem Backup.
what-we-have-event-snapshots =
    Die Snapshots des Repositorys: einer pro Nacht, um 2:00, 14 Tage und 8
    Wochen aufbewahrt. Die Pfade jedes Snapshots sagen, was er enthält;
    restic ls oder find sagen, ob eine Datei darin ist. Das RPO eines Plans
    stimmt nur, wenn die Backups so jung sind.
what-we-have-event-rpo-unmet =
    Ein RPO, das kürzer ist als der Rhythmus der Backups, lässt sich nicht
    einhalten: Der Job läuft einmal pro Nacht, also verlierst du in der
    schlimmsten Nacht bis zu 24 Stunden. Entweder sagt das RPO die Wahrheit
    (24h), oder der Zeitplan ändert sich, um es einzuhalten.
what-we-have-event-old-owner =
    Dariusz steht noch in der Tabelle. Verantwortlich ist die Person, die du
    um 3 Uhr nachts anrufst, und Dariusz ist vor zwei Jahren gegangen:
    Teuila, Mirela, Rahel, Wiremu oder du.
what-we-have-event-stale-row =
    Die Zeile von phpList ist noch da: Der Plan würde einen Dienst
    wiederherstellen, der auf koppel seit 2030 nicht mehr läuft. Entferne
    sie.
what-we-have-event-rows =
    Die Tabelle stimmt: die Website, die App und ihre Datenbank, vetlink,
    jeweils mit einem RPO, das der Job einhalten kann, einem RTO, einem
    Backup, einer verantwortlichen Person. Jetzt müssen auch die Backups das
    Versprechen halten.
what-we-have-event-unsaved =
    vetlink hat seine Zeile, mit einem RPO: Aber kein Snapshot enthält seine
    Akten. Der Plan verspricht ein Backup, das es noch nicht gibt. Die Zeile
    restic backup des Jobs auf koppel entscheidet, was hineinkommt.
what-we-have-event-fixed =
    Der nächtliche Job nimmt ab heute Nacht die Akten von vetlink mit. Bis
    heute Nacht gibt es noch keine Kopie: Ein Backup jetzt (den Job
    ausführen oder selbst restic backup) schließt die Lücke heute.
what-we-have-event-saved =
    Ein Snapshot enthält die Akten von vetlink: Mirelas Arbeit überlebt
    jetzt koppel.
what-we-have-event-end =
    Teuila: „Das ist also, was wir wirklich haben. Ich drucke es für den
    Vorstand aus und gebe Rahel eine Kopie für den Tresor, zum Umschlag.“

    Gut gemacht! Du hast Kapitel 1 von „Das Tierheim“ abgeschlossen.

    WAS PASSIERT IST
    Der Plan beschrieb koppel, wie es 2029 war. Die Bestandsaufnahme (die
    Units und Timer von systemd, die Sockets, der Job) fand einen
    verschwundenen Dienst (phpList), einen Dienst, der sowohl im Plan als
    auch in den Backups fehlte (vetlink), ein RPO von einer Stunde für eine
    Datenbank, die einmal pro Nacht gesichert wird, und eine verantwortliche
    Person, die gegangen war. Die Tabelle sagt jetzt, was läuft, was jeder
    Dienst verlieren darf und wie lange er warten kann, wer dafür
    geradesteht; und jeder Dienst hat einen Snapshot, der jünger ist als
    sein RPO.

    GUTE PRAXIS
    - Ein Plan wird an der Maschine geprüft, nicht an sich selbst: was läuft
      (systemctl list-units, list-timers, crontab -l), was lauscht
      (ss -tlnp), was gesichert wird (der Job, restic snapshots und ls).
    - RPO und RTO sind Entscheidungen der Organisation, schriftlich
      festgehalten: Der Rhythmus der Backups muss das RPO einhalten, die
      Wiederherstellung muss ins RTO passen.
    - Jeder Dienst hat eine verantwortliche Person, die noch da ist.
    - Halte den Plan fern von dem Server, den er beschreibt, und irgendwo
      auf Papier.
    - Jeder neue Dienst (ein an einem Nachmittag hinzugefügter Timer) kommt
      am selben Tag in den Plan und in die Backups.

    DOKUMENTATION
    - NIST SP 800-34 Rev. 1, Contingency Planning Guide (Business Impact Analysis, RPO, RTO): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - restic, mit Repositorys arbeiten: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - systemctl: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
