### Geschichte „Die Mieterinitiative“, Kapitel „Schlüssel wechseln die
### Hände“: der age-Schlüssel eines neuen Ehrenamtlichen hinzugefügt, der
### eines gehenden entfernt, der Datenschlüssel und das Secret rotiert.
### Befehle, Optionen, Pfade, Schlüssel, Variablennamen und die Ausgaben der
### Werkzeuge werden nicht übersetzt.

chapter-keys-change-hands = Schlüssel wechseln die Hände
    .summary = Sieben Wochen später sind die Secrets der Initiative für den Server, für dich und für Makoa verschlüsselt. Makoa zieht weg und verlässt das Technikteam; Ikenna kommt dazu. Gib Ikenna Zugang, nimm Makoa seinen wirklich weg, und sorge dafür, dass das, was er lesen konnte, nichts mehr nützt.

## Files

keys-change-hands-message-taslima =
    Von: Taslima (Schriftführung, Mieterinitiative Larkspur)
    Dienstag, 26. April, 18:40

    Hallo!

    Zwei Neuigkeiten. Makoa zieht zu seiner Schwester, dreihundert
    Kilometer weit weg, und verlässt das Technikteam Ende der Woche (er hat
    dir ein paar Worte geschrieben). Und Ikenna, aus Block C, kommt zu uns:
    Er kümmert sich um die Mails von Repairline. Er hat dir seinen
    öffentlichen Schlüssel geschickt.

    Seit März sind .env und mail.env für den Server, für dich und für Makoa
    verschlüsselt (siehe .sops.yaml). Könntest du sie für Ikenna öffnen und
    für Makoa schließen? Ich vertraue Makoa voll und ganz, aber sein Laptop
    geht mit ihm, und sein Schlüssel damit.

    Für das Passwort des Mail-Relays habe ich den Anbieter gebeten, es zu
    ändern: Das machen sie morgen, und ich trage das neue selbst in
    mail.env ein. Das der Datenbank ist deins.

    Wie immer: committen, pushen, und die App muss weiter funktionieren.

    Taslima

keys-change-hands-message-ikenna =
    Von: Ikenna
    Dienstag, 26. April, 17:12

    Hallo! Hier ist mein öffentlicher age-Schlüssel, auf meinem Laptop mit
    age-keygen erzeugt:

    { $key }

    Taslima sagt, du fügst ihn hinzu. Wenn es einfacher ist, könntest du mir
    auch einfach deine keys.txt schicken, dann hätte ich sofort Zugang?

    Ikenna

keys-change-hands-message-makoa =
    Von: Makoa
    Montag, 25. April, 22:30

    Es war mir eine Freude, mit euch allen. Mein Schlüssel steht noch in
    .sops.yaml und in den Dateien: Nimm ihn natürlich heraus. Und sei beim
    Rest nicht zimperlich: Ich habe das Datenbankpasswort bei jedem
    Deployment gelesen, also ändere es auch. Ich verfolge die Initiative
    weiter aus der Ferne.

    Makoa

## Events

keys-change-hands-event-shared-key =
    Dein privater age-Schlüssel liegt woanders als in deiner eigenen
    keys.txt, oder diese Datei ist für andere Konten lesbar. Ein privater
    Schlüssel, der geteilt wird, gehört dir nicht mehr: Wer ihn hat, kann
    alles lesen, was für dich verschlüsselt ist, und niemand kann euch
    auseinanderhalten. Ikenna hat einen eigenen Schlüssel; lösch die Kopie
    (oder chmod 600 ~/.config/sops/age/keys.txt).
keys-change-hands-event-hand-edit =
    sops lehnt die Datei ab: Ein ENC[…]-Wert wurde außerhalb von sops
    geändert. Jeder Wert hat sein eigenes Authentifizierungs-Tag, und der
    MAC deckt alle Werte zusammen ab: ein von Hand bearbeiteter Wert, eine
    entfernte oder verschobene Zeile, und sops kann der Datei nicht mehr
    vertrauen. Hol die Datei aus git zurück (git checkout -- DATEI), dann
    ändere Werte mit sops edit oder sops set.
keys-change-hands-event-config-updated =
    Die Datei .sops.yaml nennt jetzt den Server, dich und Ikenna. Diese
    Regel bekommen neue Dateien; die schon verschlüsselten Dateien behalten
    die Schlüssel, für die sie verschlüsselt wurden, bis du sie
    aktualisierst.
keys-change-hands-event-config-only =
    Die Regel hat sich geändert, aber .env oder mail.env sind noch für Makoa
    verschlüsselt: sops schreibt vorhandene Dateien nicht neu, wenn sich
    .sops.yaml ändert. sops updatekeys tut es, Datei für Datei.
keys-change-hands-event-keys-updated =
    Beide Dateien sind jetzt für den Server, für dich und für Ikenna
    verschlüsselt, nicht für Makoa. Aber updatekeys verschlüsselt nur
    denselben Datenschlüssel für die neue Liste neu: Die Werte selbst haben
    sich nicht geändert.
keys-change-hands-event-same-data-key =
    Der Datenschlüssel, der die Werte verschlüsselt, ist der, den Makoas
    Schlüssel öffnen konnte: Wer ihn aufbewahrt hat (oder eine alte Kopie
    der Datei), kann immer noch entschlüsseln, was du committest. sops
    rotate erzeugt einen neuen Datenschlüssel und verschlüsselt jeden Wert
    neu.
keys-change-hands-event-data-rotated =
    Neue Datenschlüssel für beide Dateien, nur für den Server, dich und
    Ikenna verschlüsselt. Was Makoa öffnen konnte, waren die alten.
keys-change-hands-event-rotated =
    Die Datenbank hat ein neues Passwort: Das, das Makoa beim Deployen
    gelesen hat, ist jetzt wertlos. Es muss in .env (mit sops, nie im
    Klartext) und in die deployten Einstellungen.
keys-change-hands-event-app-down =
    Repairline konnte nicht starten: Das Passwort, das es aus
    /etc/repairline/env gelesen hat, ist nicht das der Datenbank
    (journalctl -u repairline).
keys-change-hands-event-deployed =
    Das Deployment hat die neue .env mit dem Schlüssel des Servers
    entschlüsselt, und die App verbindet sich mit dem neuen Passwort.
keys-change-hands-event-clear-commit =
    Das neue Passwort steht in einem Commit, im Klartext. Wähl ein anderes,
    und trag es mit sops edit oder sops set in .env ein.
keys-change-hands-event-committed =
    Der Commit enthält die neue Regel, beide Dateien für die neue
    Schlüsselliste mit neuen Datenschlüsseln, und das neue Passwort,
    verschlüsselt.
keys-change-hands-event-pushed =
    origin hat es: Ikenna kann das Repository klonen und die Dateien mit
    seinem eigenen Schlüssel entschlüsseln.
keys-change-hands-event-end =
    Ikenna: „sops -d .env funktioniert auf meinem Laptop. Willkommen, ich!“

    Gut gemacht! Du hast „Schlüssel wechseln die Hände“ abgeschlossen.

    WAS PASSIERT IST
    Ikennas öffentlicher Schlüssel kam in .sops.yaml, und Makoas kam heraus;
    sops updatekeys hat den Datenschlüssel jeder Datei für die neue Liste
    neu verschlüsselt. Da Makoa den alten Datenschlüssel, oder einfach die
    Werte, behalten haben könnte, hast du rotiert, was zählte: ein neuer
    Datenschlüssel für jede Datei (sops rotate) und ein neues
    Datenbankpasswort, mit sops in .env gesetzt und deployt. Ikenna hat mit
    seinem eigenen Schlüssel Zugang bekommen; niemand hat einen privaten
    Schlüssel geteilt.

    GUTE PRAXIS
    - Ein Schlüssel pro Person (und pro Server): Jemanden hinzuzufügen heißt,
      einen öffentlichen Schlüssel hinzuzufügen, jemanden zu entfernen heißt,
      seinen zu entfernen.
    - .sops.yaml entscheidet für neue Dateien; updatekeys bringt vorhandene
      Dateien in Einklang; keins von beiden ändert den Datenschlüssel.
    - Wenn jemand geht, nimm an, dass die Person behalten hat, was sie lesen
      konnte: Rotiere den Datenschlüssel (sops rotate) und die Secrets
      selbst.
    - Bearbeite ENC[…]-Werte nie von Hand: sops edit, sops set, oder
      entschlüsseln und neu verschlüsseln.
    - Schick nie einen privaten Schlüssel; bitte um einen öffentlichen.

    EIN ANDERER WEG
    sops rotate --add-age und --rm-age ändern die Empfänger und den
    Datenschlüssel in einem Befehl, ohne .sops.yaml anzufassen (das dann
    auch geändert werden muss). Mit mehreren Schlüsselgruppen und
    shamir_threshold kann eine Datei Schlüssel von mehreren Personen
    gleichzeitig verlangen.

    DOKUMENTATION
    - sops updatekeys: https://getsops.io/docs/#updatekeys-command
    - Schlüsselrotation: https://getsops.io/docs/#key-rotation
    - Schlüssel hinzufügen und entfernen: https://getsops.io/docs/#adding-and-removing-keys
    - age-keygen: https://github.com/FiloSottile/age#readme
