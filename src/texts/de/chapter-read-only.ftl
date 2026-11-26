### Geschichte „Das Theater“, Kapitel 3 „Nur lesen“: Rollen, GRANT,
### Standardrechte. SQL, Pfade und die Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-read-only = Nur lesen
    .summary = Das Statistikwerkzeug von Inès benutzt das Konto der App selbst, das jede Tabelle besitzt: Letzte Woche hat sie aus Versehen jedes Stück umbenannt. Gib ihr ein Konto, das alles liest und nichts ändert, auch die Tabellen, die noch kommen.

## Dateien

read-only-message-camille =
    Von:     Camille
    An:      dich
    Betreff: Inès und die Datenbank

    Hallo,

    Inès, unsere Ehrenamtliche für die Zahlen, hat ein kleines Werkzeug,
    das den Wochenbericht über den Kartenverkauf erstellt (ticket-stats,
    ein Dienst auf dem Server). Ich habe ihm zum Verbinden das Konto der
    App gegeben, weil ich das gerade hatte (siehe
    /etc/ticket-stats/config.env).

    Letzte Woche hat Inès beim Erkunden der Datenbank mit demselben Konto
    aus Versehen jedes Stück in „test“ umbenannt. Ich habe das Backup der
    letzten Nacht wiederhergestellt; wir haben zwei Stunden Reservierungen
    verloren.

    Könntest du ihr ein Konto geben, das alles lesen, aber nichts ändern
    kann? Und es in das Werkzeug eintragen. Vorsicht: Diese Woche füge ich
    eine Tabelle donations hinzu (die Migration läuft als boxoffice, wie
    jede Migration), und die wird sie in ihrem Bericht auch brauchen.

    Gleiches sudo-Passwort: vorhang-2028.

    Camille

## Ereignisse

read-only-event-account =
    Das Werkzeug meldet sich als boxoffice an: die Rolle der App, die jede
    Tabelle besitzt. Ein Besitzer darf mit seinen Tabellen alles: lesen,
    ändern, leeren, löschen. Wer darf was? (man psql: \du für die Rollen,
    \dp für die Rechte jeder Tabelle)
read-only-event-role =
    Eine neue Rolle kann die Stücke lesen. Um sie ohne ihr Passwort
    auszuprobieren: als Superuser SET ROLE name; dann eine Abfrage (im
    selben -c, getrennt durch „;“): Alles läuft mit den Rechten dieser
    Rolle.
read-only-event-too-much =
    Diese Rolle kann auch Daten ändern (INSERT, UPDATE, DELETE oder
    TRUNCATE auf eine Tabelle): Genau das darf nicht wieder passieren.
    Nur GRANT SELECT, und den Rest per REVOKE entziehen (REVOKE ALL ON …
    FROM rolle, dann GRANT SELECT).
read-only-event-superuser =
    Ein Superuser überspringt jede Rechteprüfung: Er kann alles lesen,
    ändern und löschen, in jeder Datenbank. Nie für ein Konto, das nur
    liest (ALTER ROLE … NOSUPERUSER).
read-only-event-member =
    Ein Mitglied von boxoffice erbt alle Rechte von boxoffice, auch den
    Besitz der Tabellen: Es darf sie ändern und löschen. Gib die Rechte
    selbst, nicht die Rolle des Besitzers (REVOKE boxoffice FROM …).
read-only-event-migration =
    Camille: „Die Migration ist gelaufen: Es gibt jetzt eine Tabelle
    donations.“ Sie wurde von boxoffice angelegt, nach deinem GRANT. Kann
    die neue Rolle sie lesen?
read-only-event-donations-denied =
    Die neue Rolle kann donations nicht lesen: GRANT … ON ALL TABLES gilt
    nur für die Tabellen, die es zu dem Zeitpunkt gibt. Für die Tabellen,
    die noch kommen, hat PostgreSQL Standardrechte (man psql: ALTER
    DEFAULT PRIVILEGES), vergeben für die Tabellen, die eine bestimmte
    Rolle anlegen wird.
read-only-event-wrong-creator =
    Standardrechte gelten für die Tabellen, die eine Rolle anlegt: ohne
    FOR ROLE die, die den Befehl ausführt (hier postgres). Die Migrationen
    laufen als boxoffice: ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN
    SCHEMA public GRANT SELECT ON TABLES TO …
read-only-event-no-defaults =
    Die neue Rolle liest jetzt donations, aber die nächste Tabelle wird
    genauso fehlen. Füg Standardrechte für die Tabellen hinzu, die
    boxoffice anlegen wird (ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice …).
read-only-event-tool =
    Die Rolle ist bereit. Das Werkzeug meldet sich immer noch als
    boxoffice an: Ändere seine DATABASE_URL in /etc/ticket-stats/config.env
    (mit der neuen Rolle und ihrem Passwort), und starte es dann neu.
read-only-event-tool-failed =
    ticket-stats konnte nicht starten: systemctl status ticket-stats und
    journalctl -u ticket-stats sagen, warum (die Rolle, ihr Passwort, ihr
    LOGIN, oder eine Tabelle, die sie nicht lesen kann).
read-only-event-end =
    Der Wochenbericht läuft mit { $role }: Er liest jede Tabelle, donations
    eingeschlossen, und kann keine ändern. Inès: „Jetzt kann ich ohne Angst
    erkunden!“ Camille: „Und die nächsten Migrationen machen den Bericht
    nicht kaputt.“

    Gut gemacht! Du hast das Kapitel „Nur lesen“ abgeschlossen.

    WAS PASSIERT IST
    Das Werkzeug, und Inès, benutzten boxoffice, den Besitzer jeder
    Tabelle. Ein Besitzer darf alles, und PostgreSQL kann einen Fehler
    nicht von einem Befehl unterscheiden: UPDATE shows SET title = 'test'
    war erlaubt.

    ROLLEN UND RECHTE
    - CREATE ROLE … LOGIN PASSWORD '…': ein Konto, das sich anmelden darf.
    - GRANT SELECT ON ALL TABLES IN SCHEMA public TO …: die Tabellen, die
      es jetzt gibt.
    - ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT
      SELECT ON TABLES TO …: die Tabellen, die boxoffice anlegen wird.
    - Kein Superuser, kein Mitglied der Rolle des Besitzers: Beides gibt
      jedes Recht.

    GUTE PRAXIS
    - Eine Rolle pro Verwendung: die App, die Migrationen, die Berichte,
      jede Person. Die geringsten Rechte, die jede braucht.
    - Probier eine Rolle aus, bevor du sie herausgibst: SET ROLE …; dann
      die Abfragen, die sie machen wird, und eine, die sie nicht machen
      darf.
    - \dp und \ddp zeigen, wer was darf.

    DOKUMENTATION
    - Rechte: https://www.postgresql.org/docs/16/ddl-priv.html
    - GRANT: https://www.postgresql.org/docs/16/sql-grant.html
    - ALTER DEFAULT PRIVILEGES: https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html
