### Geschichte „Das Theater“, Kapitel 1 „Premiere“: max_connections,
### pg_stat_activity, idle in transaction,
### idle_in_transaction_session_timeout. SQL, Pfade und die Ausgaben der
### Werkzeuge werden nicht übersetzt.

chapter-too-many-clients = Premiere
    .summary = Der Kartenverkauf für die Premiere hat um 10 Uhr begonnen, und seitdem antwortet die Ticketkasse mit Fehlern: PostgreSQL lehnt neue Verbindungen ab. Finde heraus, wer sie hält, und sorg dafür, dass es nicht wieder passiert.

## Dateien

too-many-clients-message-camille =
    Von:     Camille
    An:      dich
    Betreff: DRINGEND: Ticketkasse ausgefallen

    Hallo,

    Der Verkauf für „Der Leuchtturmwärter“ (Premiere, 28. Februar) hat um
    10 Uhr begonnen, und seit etwa 10:05 zeigt die Ticketkasse
    „Entschuldigung! Die Ticketkasse ist nicht erreichbar“. Die Leute
    rufen im Theater an. Die Website: curl -i http://localhost:3000/

    Es ist eine kleine Maschine, also haben wir letztes Jahr
    max_connections von PostgreSQL auf 20 gesenkt. Aber wir haben doch nur
    eine App!

    Das sudo-Passwort: vorhang-2028. Der Administrator von PostgreSQL ist
    das Konto postgres: sudo -u postgres psql.

    Camille

## Ereignisse

too-many-clients-event-full =
    „remaining connection slots are reserved for roles with the SUPERUSER
    attribute“: Jede gewöhnliche Verbindung ist belegt. PostgreSQL behält
    3 seiner max_connections für Superuser: Du kommst also noch mit
    sudo -u postgres psql hinein. Wer hält die anderen? (man psql:
    pg_stat_activity)
too-many-clients-event-idle =
    „idle in transaction“: Die App hat eine Transaktion geöffnet (BEGIN,
    dann SELECT … FOR UPDATE: Der Platz ist reserviert) und wartet seitdem,
    ohne COMMIT oder ROLLBACK. Schau dir state_change an: manche seit
    10:00. Jede Person, die einen Platz wählt und ohne zu bezahlen geht,
    hält für immer eine Verbindung.
too-many-clients-event-terminated =
    Einige Verbindungen wurden beendet, und die Ticketkasse atmet auf… eine
    Weile: Jede neue Person, die einen Platz wählt, hält wieder eine. Sie
    von Hand zu beenden ist Erste Hilfe. PostgreSQL kann sie nach einer
    Weile selbst beenden (man psql: SHOW, ALTER SYSTEM; die Einstellung
    betrifft Sitzungen, die in einer Transaktion untätig sind).
too-many-clients-event-restart-needed =
    max_connections hat sich in der Datei geändert, aber SHOW
    max_connections zeigt noch den alten Wert: Diese Einstellung ändert
    sich nur mit einem Neustart von PostgreSQL („change requires
    restart“), der jede Verbindung schließt.
too-many-clients-event-more-room =
    Mehr Platz: Die Ticketkasse geht wieder, fürs Erste. Aber das Leck ist
    noch da: Jeder verlassene Platz hält eine Verbindung, und die neuen
    Plätze füllen sich genauso (und jede Verbindung kostet Speicher auf
    einer kleinen Maschine). Was beendet die verlassenen Transaktionen?
too-many-clients-event-reload-needed =
    In der Datei steht idle_in_transaction_session_timeout, aber der Server
    hat sie noch nicht gelesen: SHOW zeigt den alten Wert. Diese
    Einstellung braucht keinen Neustart: sudo systemctl reload postgresql
    (oder SELECT pg_reload_conf();).
too-many-clients-event-too-long =
    Ein Timeout ist gesetzt, aber ein langes: Ein so lange reservierter
    Platz blockiert die anderen Kaufenden, und die Verbindungen stauen sich
    während des Ansturms trotzdem. Höchstens ein paar Minuten (1min reicht
    für eine Bezahlseite völlig).
too-many-clients-event-stopped =
    Ein Dienst ist gestoppt: PostgreSQL und die Ticketkasse müssen für den
    Verkauf laufen (sudo systemctl start …).
too-many-clients-event-end =
    Die verlassenen Transaktionen enden jetzt von selbst: Die Ticketkasse
    bekommt ihre Verbindungen zurück, und der Verkauf geht weiter. Camille:
    „Noch sieben Plätze in Reihe A, und niemand wartet mehr!“

    Gut gemacht! Du hast das Kapitel „Premiere“ abgeschlossen.

    WAS PASSIERT IST
    PostgreSQL nimmt max_connections Verbindungen an (hier 20) und behält 3
    für Superuser. Wenn eine Person einen Platz wählte, öffnete die App
    eine Transaktion, um ihn zu reservieren (FOR UPDATE), und behielt sie,
    samt ihrer Verbindung, bis zur Zahlung. Wer ging, hat nie bezahlt: Jede
    dieser Personen hinterließ eine Verbindung „idle in transaction“. Um
    10:05 hielt die App alle.

    DIE WERKZEUGE
    - pg_stat_activity: eine Zeile pro Verbindung; state und state_change
      sagen, wer wartet, und seit wann.
    - pg_terminate_backend(pid): beendet eine; Erste Hilfe.
    - idle_in_transaction_session_timeout: Der Server beendet jede
      Sitzung, die länger als das in einer Transaktion untätig ist. Gilt
      nach einem Reload.
    - max_connections braucht einen Neustart, und mehr Platz verzögert ein
      Leck nur.

    GUTE PRAXIS
    - Halte nie eine Transaktion offen, während du auf einen Menschen
      wartest: Reserviere einen Platz mit einer Zeile und einem
      Ablaufdatum, nicht mit einer Sperre.
    - Setz idle_in_transaction_session_timeout (und statement_timeout) auf
      jedem Server, auf dem eine App eine Transaktion vergessen kann.
    - Die reservierten Plätze für Superuser sind das, was dich während des
      Vorfalls hineinlässt: Gib der App nicht die Superuser-Rolle.

    DOKUMENTATION
    - Die Verbindungseinstellungen: https://www.postgresql.org/docs/16/runtime-config-connection.html
    - idle_in_transaction_session_timeout: https://www.postgresql.org/docs/16/runtime-config-client.html
    - pg_stat_activity: https://www.postgresql.org/docs/16/monitoring-stats.html
