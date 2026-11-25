### Geschichte „Die alte Sonne“, Kapitel „Erst lesen, dann anfassen“: ein
### unbekanntes Solaris-10-System lesen, bevor man etwas davon wegbewegt.
### Befehle, FMRIs, Pfade und Ausgaben werden nicht übersetzt.

chapter-read-first = Erst lesen, dann anfassen
    .summary = Der alte Sun-Rechner der Saatgutbibliothek läuft unter Solaris 10: finden, was den Katalog betreibt, wo seine Daten liegen und in welchem Zeichensatz, und vor allem anderen einen Sicherheits-Snapshot machen.

## Dateien

read-first-email-inaya =
    Von:  Inaya
    An:   dich

    Hallo! Ich koordiniere die Ehrenamtlichen der Saatgutbibliothek. Unser
    Katalog (die Sorten, die Mitglieder, wer was ausgeliehen hat) lebt seit
    2009 auf dem alten Sun-Server im Schrank, herbarium. Odette hat ihn
    eingerichtet; sie ist ans Meer in Rente gegangen und geht nur sonntags
    ans Telefon.

    Wir haben einen neuen Server gekauft, greenhouse (Debian, viel kleiner
    und viel leiser), und wir möchten, dass der Katalog dorthin umzieht.
    Aber niemand traut sich, die Sun anzufassen: Das ist kein Linux, und
    als jemand sie das letzte Mal neu gestartet hat, hat es den ganzen
    Nachmittag gedauert.

    Könntest du dir erst einmal ansehen, wie sie aufgebaut ist, und es in
    migration.md aufschreiben? Odettes Notizen liegen in deinem Verzeichnis.

    Inaya

read-first-notes-odette =
    Odettes Notizen (2014)
    - Der Katalog = PostgreSQL + PHP. Alles wird von SMF gestartet.
    - Wöchentliches Backup: /export/backup/pgdata-weekly.tar (das ganze
      Datenverzeichnis, jeden Sonntagabend).
    - Platten: ZFS, zwei Spiegel. Nie rm in /var/postgres!
    - grep kennt hier kein -q: /usr/xpg4/bin/grep schon.

read-first-template =
    # Der Katalog zieht von herbarium um

    ## Der Datenbankdienst (sein SMF-Name)
    (zu ergänzen)

    ## Wo seine Daten liegen (Verzeichnis, ZFS-Dataset)
    (zu ergänzen)

    ## Die Datenbank (Name, PostgreSQL-Version, Zeichensatz)
    (zu ergänzen)

    ## Bevor du etwas anfasst
    (zu ergänzen: das Sicherheitsnetz)

## Ereignisse

read-first-event-linux-habit =
    Nicht gefunden: Solaris 10 hat weder systemd noch top. Seine Dienste
    werden von SMF betrieben: svcs listet sie auf, svcs -x erklärt, was
    nicht stimmt, svcadm steuert sie. Und prstat übernimmt die Rolle von top
    (man prstat).
read-first-event-old-grep =
    Das /usr/bin/grep von Solaris stammt aus der Zeit vor POSIX: kein -q,
    kein -E, kein -r. Die POSIX-Version liegt in /usr/xpg4/bin/grep (das
    stand in Odettes Notizen). Dasselbe gilt für sed, tar und andere:
    /usr/bin behält das alte Verhalten, für die Skripte der 1990er.
read-first-event-smf =
    Da ist er: svc:/application/database/postgresql_84:default_64bit,
    online. Unter Solaris wird ein Dienst durch ein FMRI benannt; svcs -l
    und svcprop verraten mehr darüber. Und daneben
    svc:/site/seed-catalogue:default: der Katalog selbst, ein Manifest, das
    Odette geschrieben hat.
read-first-event-maintenance =
    sendmail ist seit März 2025 in maintenance: Das hat nichts mit dem
    Katalog zu tun und ist wahrscheinlich seit Jahren kaputt. Notier es,
    repariere es jetzt nicht: eine Änderung nach der anderen, vor allem auf
    einem Rechner, den niemand kennt.
read-first-event-data-dir =
    Die Daten von PostgreSQL liegen in /var/postgres/8.4/data_64 (die
    64-Bit-Instanz). Fass diese Dateien nie von Hand an.
read-first-event-sparc =
    sun4u, sparcv9: ein SPARC-Prozessor. Er schreibt seine Zahlen mit dem
    höchstwertigen Byte zuerst (Big-Endian), umgekehrt wie der x86 in
    greenhouse. Gut zu wissen, wenn es Zeit wird, die Daten umzuziehen.
read-first-event-zfs =
    /var/postgres ist ein eigenes ZFS-Dataset, data/postgres, im Pool
    „data“ (zwei gespiegelte Platten). ZFS kann davon im Nu einen Snapshot
    machen.
read-first-event-encoding =
    seeds, LATIN1: Die Datenbank wurde in ISO 8859-1 angelegt, ein Byte pro
    Buchstabe, wie es 2009 üblich war. Das PostgreSQL von greenhouse
    arbeitet in UTF-8. Die Akzente brauchen beim Umzug Sorgfalt.
read-first-event-snapshot =
    Ein Snapshot von data/postgres: Was auch immer als Nächstes passiert,
    die Daten, wie sie jetzt sind, können in Sekunden zurückkommen (zfs
    rollback). Er braucht fast keinen Platz: ZFS behält nur die Blöcke, die
    sich danach ändern.
read-first-event-end =
    Inaya: „Ich habe deine Notizen gelesen. Zum ersten Mal verstehe ich,
    was in diesem Schrank steht!“

    Gut gemacht! Du hast das Kapitel „Erst lesen, dann anfassen“
    abgeschlossen.

    WAS PASSIERT IST
    Du hast ein unbekanntes System gelesen, ohne etwas zu ändern, mit
    seinen eigenen Werkzeugen: SMF für die Dienste, ZFS für die Platten,
    psql für die Datenbank. migration.md sagt jetzt, was den Katalog
    betreibt, wo seine Daten liegen und in welchem Zeichensatz; und ein
    ZFS-Snapshot hält die Daten von heute in Reichweite.

    GUTE PRAXIS
    - Auf einem System, das du nicht kennst, erst lesen, dann handeln:
      seine Dienste, seine Platten, seine Versionen und was schon kaputt
      ist (svcs -x).
    - Unterwegs aufschreiben: Die Notizen sind für dich und für die
      Person, die nach dir kommt.
    - Vor der ersten Änderung ein Sicherheitsnetz: ein Snapshot, ein
      Backup, von dem du weißt, wie man es wiederherstellt.
    - Die eigenen Werkzeuge des Systems benutzen, statt ihm deine
      Gewohnheiten aufzuzwingen: svcs statt ps | grep, /usr/xpg4/bin, wenn
      POSIX-Verhalten gebraucht wird.

    EIN ANDERER WEG
    Eine vollständige Bestandsaufnahme würde auch die cron-Jobs (crontab -l
    für jeden Benutzer), die Netzwerkkonfiguration (ifconfig -a,
    /etc/hosts) und die Pakete (pkginfo) auflisten. Unter Solaris 11 macht
    man dasselbe mit dem Paketsystem IPS (pkg list) und ipadm.

    DOKUMENTATION
    - svcs(1): https://docs.oracle.com/cd/E26505_01/html/816-5165/svcs-1.html
    - zfs(1M): https://docs.oracle.com/cd/E26505_01/html/816-5166/zfs-1m.html
    - PostgreSQL 8.4, Unterstützung von Zeichensätzen: https://www.postgresql.org/docs/8.4/multibyte.html
