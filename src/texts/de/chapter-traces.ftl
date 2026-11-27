### Geschichte „Das Audit“, Kapitel „Die Spuren“: eine nächtliche
### Anmeldung, die niemand erwartet hat. journalctl, last, Fingerabdrücke
### von Schlüsseln (ssh-keygen -l), authorized_keys und eine cron-Aufgabe
### des Eindringlings. Die Befehle, die Pfade und die Meldungen der
### Werkzeuge werden nicht übersetzt.

chapter-traces = Die Spuren
    .summary = Einer unerwarteten Anmeldung nachgehen: Journal, last, der Fingerabdruck eines Schlüssels, der Schlüssel und die cron-Aufgabe des Eindringlings.

## Dateien

traces-email-salome =
    Von:     Salomé (Auditorin)
    An:      dich
    Betreff: Audit der Bäckerei — dritter Teil: die Spuren

    Hallo,

    Danke für den zweiten Teil: Mein Scan sieht jetzt nur noch SSH, die
    Website und ihren sicheren Port. Eine Sache bleibt, die mir nicht
    gefällt, und es ist keine Konfiguration mehr: Beim Lesen des
    ssh-Journals habe ich eine Anmeldung von Nadias Konto in der Nacht von
    Sonntag auf Montag gesehen, um 3:12 Uhr, von einer Adresse, die sie
    nicht kennt.

    Nadia sagt mir: „Ich habe geschlafen, und mein Schlüssel ist nur auf
    dem Rechner im Laden.“

    Was ich erwarte:
    1. Dass du diese Anmeldung findest: wann, von wo, und mit welchem
       Schlüssel (das Journal bewahrt seinen Fingerabdruck auf).
    2. Dass du den Schlüssel entfernst, der nicht Nadias ist, ohne sie
       auszusperren.
    3. Dass du suchst, was die Person hinterlassen haben könnte, und
       aufräumst. Nadias geplante Aufgaben sind ein klassischer Ort: Aber
       pass auf, dass du nicht ihr echtes Backup löschst.
    4. Dass du dir ansiehst, was sie GELESEN haben könnte: Nadias
       Befehlsverlauf (.bash_history) sagt, was während der Sitzung getippt
       wurde. Ein gelesenes Geheimnis ist ein Geheimnis, das man ändern
       muss, wirklich: Das neue muss überall funktionieren, und die
       Bestell-App darf nicht ausfallen.

    Hinweis: Beide Schlüssel in ihrer Datei enden auf „nadia@laden“. Der
    Kommentar eines Schlüssels beweist nichts, jede Person kann
    hineinschreiben, was sie will. Vergleich die Fingerabdrücke.

    Salomé
    (Für sudo ist dein Passwort immer noch: mehl-2028)

## Ereignisse

# { $address }: die Adresse, von der die Anmeldung kam
traces-event-found =
    Da ist die Anmeldung: eine Sitzung des Kontos „nadia“ von { $address },
    um 3:12 Uhr, während Nadia sich normalerweise vom Laden aus verbindet
    (198.51.100.7), abends. Das ssh-Journal hat den Fingerabdruck des
    benutzten Schlüssels aufbewahrt: „ED25519 SHA256:…“.

    Welcher Schlüssel in /home/nadia/.ssh/authorized_keys hat diesen
    Fingerabdruck? (man ssh-keygen, Option -l)
traces-event-key-identified =
    Da ist der Fingerabdruck jedes Schlüssels in der Datei: Beide tragen den
    Kommentar „nadia@laden“, nur ihre Fingerabdrücke unterscheiden sich. Der
    Kommentar ist nur ein Etikett.

    Der Schlüssel aus dieser Nacht ist der, dessen Fingerabdruck in der
    Zeile von 3:12 Uhr im Journal steht: Entferne diese Zeile (und nur
    diese) aus authorized_keys.
traces-event-nadia-locked-out =
    Achtung: Nadias Schlüssel ist nicht mehr in authorized_keys! Sie
    könnte sich nicht mehr anmelden. Leg ihren Schlüssel zurück (den,
    dessen Fingerabdruck in den abendlichen Anmeldungen aus dem Laden
    steht): Wir entfernen den Schlüssel des Eindringlings, nicht Nadias.
traces-event-key-revoked =
    In authorized_keys ist nur noch Nadias Schlüssel: Der Schlüssel des
    Eindringlings kann keine Sitzung mehr öffnen.

    Aber den Schlüssel zu entfernen, schließt nur die Tür, durch die er
    gekommen ist. Was hat er in diesen drei Minuten drinnen hinterlassen?
    Schau dir an, was für Nadias Konto von selbst läuft (man crontab).
traces-event-cron-found =
    Zwei Aufgaben für Nadia: sicherung.sh um 4 Uhr (die gehört ihr), und
    eine Zeile, die alle zehn Minuten ein Programm von 203.0.113.99
    herunterlädt und ausführt. Das ist das Funkfeuer des Eindringlings: Er
    kann aus der Ferne ändern, was der Server tut, sogar ohne Schlüssel.

    Entferne diese Zeile, und nur diese.
traces-event-secret-seen =
    Da ist, was die Person in ihren drei Minuten getippt hat: Sie hat
    /srv/bestellungen/.env gelesen. Damals war diese Datei für alle lesbar
    („Der Bericht“): Das Passwort der Datenbank ist kompromittiert, auch
    wenn Schlüssel und Aufgabe entfernt sind. Die Tür zu schließen ändert
    keinen Schlüssel, der schon kopiert wurde.

    Du musst dieses Passwort ändern, auf beiden Seiten: in PostgreSQL (man
    psql; ALTER ROLE ... PASSWORD, vom Konto postgres aus) UND in der
    Datei .env, und dann die App neu starten. Wähl ein langes Passwort
    (mindestens zwölf Zeichen), das sich vom alten unterscheidet.
traces-event-password-weak =
    Das Passwort der Datenbank hat sich geändert, aber es ist zu kurz:
    mindestens zwölf Zeichen, und eine Passphrase schlägt ein Wort. Ein
    Geheimnis, das sich erraten lässt, ist ein genauso schlechter Ersatz
    wie das, das du verloren hast.
traces-event-a-restart =
    Die Datenbank und .env haben dasselbe neue Passwort, aber die App läuft
    noch mit dem alten: Sie liest .env, wenn sie startet, nicht wenn sich
    die Datei ändert. Starte sie neu (systemctl restart bestellungen) und
    prüf dann, dass sie aktiv bleibt (systemctl status bestellungen).
traces-event-app-down =
    Die Bestell-App ist gestoppt: Beim Start hat sie in .env ein Passwort
    gelesen, das die Datenbank nicht annimmt (journalctl -u bestellungen:
    „password authentication failed“). Beide Seiten müssen dasselbe sagen:
    das Passwort der Rolle bestellungen in PostgreSQL, und das in
    DATABASE_URL in der Datei .env. Korrigiere das, das abweicht, und
    starte die App dann neu.
traces-event-password =
    Das Passwort der Datenbank ist durchgehend geändert: die Rolle in
    PostgreSQL, die Datei .env (weiterhin für die anderen Konten
    geschlossen), und die neu gestartete App, die sich damit verbindet. Das
    alte, das der Eindringling gelesen hat, öffnet nichts mehr.
traces-event-backup-lost =
    Nadias Backup (sicherung.sh, um 4 Uhr) ist nicht mehr geplant:
    crontab -r löscht die GANZE crontab. Leg ihre Zeile zurück:
      0 4 * * * /srv/bestellungen/bin/sicherung.sh
    und entferne nur die Zeile des Eindringlings.
traces-event-cron-cleaned =
    Kein Funkfeuer mehr, und Nadias echtes Backup ist noch da.
traces-event-end =
    Der Schlüssel des Eindringlings ist entfernt, seine Aufgabe auch, das
    Passwort, das er gelesen hat, ist überall ersetzt, und Nadia kann sich
    weiter anmelden und sichern. Salomé: „Mein Bericht ist vollständig. Ich
    komme in sechs Monaten wieder, um zu sehen, ob alles hält.“

    Gut gemacht! Du hast das Kapitel „Die Spuren“ und die Geschichte „Das
    Audit“ abgeschlossen.

    WAS PASSIERT IST
    Jemand ist mit einem Schlüssel hereingekommen, der Nadias Konto
    hinzugefügt wurde (wir wissen noch nicht, wie: ein gestohlener Zugang,
    ein altes Geheimnis…), und hat eine cron-Aufgabe hinterlassen, um
    wiederzukommen. Ein Schlüssel in authorized_keys ist eine dauerhafte
    Tür: Er übersteht eine Passwortänderung. Deshalb vergleicht man in
    einem Audit Fingerabdrücke statt Kommentare und sucht nach der
    „Persistenz“, nachdem man den Weg hinein gefunden hat.

    GUTE PRAXIS
    - Zuerst die Spuren lesen (journalctl -u ssh, last) UND EINE KOPIE
      AUFBEWAHREN, bevor man aufräumt: Die Beweise helfen beim Verstehen.
    - Einen Schlüssel über seinen Fingerabdruck erkennen (ssh-keygen -l -f)
      und nur diesen entfernen. Die authorized_keys jedes Kontos
      regelmäßig durchsehen.
    - Nach Persistenz suchen: crontabs (sudo crontab -u konto -l,
      /etc/cron.d), Timer und Dienste von systemd, ~/.bashrc,
      authorized_keys.
    - Jedes Geheimnis, das während des Eindringens lesbar war, als
      kompromittiert behandeln: Die .env-Datei der Bestellungen war in
      dieser Nacht für alle lesbar („Der Bericht“). Es auf beiden Seiten
      ändern (die Datenbank UND die Datei), die App neu starten, prüfen,
      dass es hält. Ein Passwort, das in
      „psql -c "ALTER ROLE ... PASSWORD '...'"“ getippt wird, bleibt im
      Verlauf der Shell: Der Metabefehl \password von psql vermeidet das
      (er fragt danach, ohne es anzuzeigen).
    - Benachrichtigen, wer es wissen muss: die Versicherung und, wenn
      personenbezogene Daten betroffen waren, die Datenschutzbehörde deines
      Landes, oft mit einer kurzen Frist (72 Stunden in Europa, nach der
      DSGVO). Zum Beispiel: der BfDI und die Landesdatenschutzbehörden
      (Deutschland), die DSB (Österreich), der EDÖB (Schweiz), die CNPD
      (Luxemburg), die CNIL (Frankreich), die AEPD (Spanien), das ICO
      (Vereinigtes Königreich), die APD-GBA (Belgien), das Office of the
      Privacy Commissioner (Kanada), die FTC und die Behörden der
      Bundesstaaten (Vereinigte Staaten). Die Liste der europäischen
      Behörden führt der Europäische Datenschutzausschuss (edpb.europa.eu).

    EIN ANDERER WEG
    Um früher gewarnt zu werden: fail2ban überwacht Fehlschläge, keine
    Erfolge; ein Alarm bei jeder Anmeldung von außerhalb der bekannten
    Adressen (ein Skript, das das Journal liest und mailt, wie in „Die
    Sonde“) oder eine Liste erlaubter Adressen (AllowUsers
    nadia@198.51.100.7) hätte diese Sitzung gemeldet oder blockiert.

    DOKUMENTATION
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
    - sshd (authorized_keys): https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
    - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
    - last: https://man7.org/linux/man-pages/man1/last.1.html
    - ALTER ROLE: https://www.postgresql.org/docs/current/sql-alterrole.html
    - Meldung einer Verletzung des Schutzes personenbezogener Daten (DSGVO, Artikel 33): https://dsgvo-gesetz.de/art-33-dsgvo/
