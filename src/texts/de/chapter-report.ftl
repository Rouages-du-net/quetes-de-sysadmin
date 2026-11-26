### Geschichte „Das Audit“, Kapitel „Der Bericht“: vier Befunde zur
### Grundhygiene auf dem Server der Bäckerei (SSH, ein vergessenes Konto,
### sudo ohne Passwort, ein für alle lesbares Geheimnis). Die
### Schlüsselwörter (PermitRootLogin, NOPASSWD…), die Befehle, die Pfade
### und die Meldungen der Werkzeuge werden nicht übersetzt.

chapter-report = Der Bericht
    .summary = Die Befunde eines Audits beheben: SSH, ein vergessenes Konto, sudo ohne Passwort, ein Geheimnis, das alle lesen können.

## Dateien

report-email-nadia =
    Von:     Nadia (Die Bäckerei)
    An:      dich
    Betreff: Das Audit meines Servers

    Ich führe die Bäckerei, nicht den Server: Um den kümmerst jetzt du
    dich. Meine Versicherung will ein Sicherheitsaudit, bevor sie den
    Vertrag verlängert, also habe ich Salomé geholt, eine unabhängige
    Auditorin. Sie ist gestern den Server durchgegangen und hat mir ihren
    Bericht dagelassen, den ich in dein Verzeichnis kopiert habe:
    auditbericht.txt.

    Ich verstehe nicht alles, aber sie wirkt seriös. Könntest du die
    Befunde einen nach dem anderen behandeln, ohne die Online-Bestellungen
    lahmzulegen? Jeden Morgen ist an der Theke viel los, und die Website
    darf nicht ausfallen.

    Für sudo ist dein Passwort: mehl-2028
    Und bitte prüf jede Korrektur: Salomé kommt zum Nachprüfen wieder.

# Der Dienst der Bestell-App, wie systemctl status ihn beschreibt.
audit-orders-description = Bestellungen der Bäckerei (Online-Bestell-App)

report-report-audit =
    AUDITBERICHT — Die Bäckerei (baeckerei.example)
    Auditorin: Salomé, unabhängig
    Rahmen: der Server baeckerei (192.0.2.22)
    Methode: Durchsicht der Konten und der Konfiguration, Portscan aus dem
    Internet, Lesen der Logs

    Dieser Bericht hat drei Teile. Hier ist der erste, die Grundhygiene des
    Servers. Die anderen beiden folgen (Netzwerk-Exposition,
    Anmeldespuren).

    C1 — SSH nimmt direkte Anmeldungen des Kontos root an        [hoch]
         Ein Bot, der ein Passwort errät, oder ein gestohlener Schlüssel
         würde auf einen Schlag jedes Recht ausliefern. Referenz:
         sshd_config(5), PermitRootLogin.

    C2 — Das Konto einer ausgeschiedenen Person existiert noch   [hoch]
         lucas, ein Praktikant, dessen Vertrag am 28. Februar endete, hat
         noch ein Konto und ist Mitglied der Gruppe sudo.

    C3 — sudo ohne Passwort für das Administrationskonto         [mittel]
         Eine gestohlene Sitzung oder ein nicht gesperrter Bildschirm
         reicht, um root zu werden, ohne etwas zu tippen. Referenz:
         sudoers(5), NOPASSWD.

    C4 — Eine Datei mit Geheimnissen ist für alle lesbar          [mittel]
         /srv/bestellungen/.env enthält die Adresse der Datenbank mit
         ihrem Passwort. Jedes Konto auf dem Server kann sie lesen.

    Erwartet: für jeden Befund beheben, dann prüfen, dass die Korrektur
    hält (und dass nichts kaputt ist: die Website, die Bestell-App und der
    Administrationszugang bleiben in Betrieb).

## Ereignisse

report-event-sudoers-broken =
    In der sudo-Richtlinie ist ein Fehler! Wenn eine sudoers-Datei falsch
    ist, lehnt sudo alles ab, für alle. Diese Dateien bearbeitet man mit
    visudo (man visudo): Es prüft die Syntax vor dem Speichern.
report-event-locked-out =
    ACHTUNG: Mit der Konfiguration, die sshd gerade geladen hat, würde eine
    neue Anmeldung mit deinem Konto abgelehnt. Deine aktuelle Sitzung
    bleibt offen (sshd trennt laufende Sitzungen nie): Jetzt ist der
    Moment, es zu korrigieren, BEVOR du dich abmeldest.
report-event-without-effect =
    In der Datei steht zwar „PermitRootLogin no“… aber sshd hat es noch
    nicht angewendet: Es liest seine Konfiguration beim Start und wenn man
    es neu laden lässt. Prüf mit  sudo sshd -t  (die Syntax), und lass den
    Dienst dann neu laden. Um zu sehen, was sshd wirklich anwendet:
    sudo sshd -T
report-event-account-incomplete =
    Du hast nur einen Teil des Befunds C2 behandelt. Ein „geschlossenes“
    Konto heißt: keine Möglichkeit mehr, sich anzumelden (gesperrtes
    Passwort, abgelaufenes Konto) UND keine Rechte mehr (aus der Gruppe
    sudo entfernt). Schau, was übrig ist, mit  id lucas  und
    sudo chage -l lucas  (man chage, man usermod).
report-event-app-blind =
    Das Geheimnis ist nicht mehr für alle lesbar… aber die Bestell-App
    kann es auch nicht mehr lesen! Sie läuft als Konto „bestellungen“ und
    liest .env beim Start: Beim nächsten Neustart käme sie nicht zurück.
    Schau, wem die Datei gehört (ls -l): Das Ziel ist, den anderen Konten
    die Tür zu schließen, nicht der App.
report-event-ssh =
    sshd wendet deine neue Konfiguration an: root kann sich nicht mehr
    anmelden, und dein Konto schon. C1 ist behandelt.

    Auf einem echten Server hält man eine Sitzung offen und testet mit
    einer zweiten, bevor man die erste schließt.
report-event-account =
    Mit Lucas' Konto kann sich niemand mehr anmelden, und es hat keine
    Rechte mehr auf dem Server. C2 ist behandelt.
report-event-sudo =
    Keine NOPASSWD-Regel mehr für dein Konto: sudo fragt nach deinem
    Passwort, wie es sein soll, und du kannst weiter administrieren. C3 ist
    behandelt.
report-event-secret =
    Die Datei mit den Geheimnissen ist jetzt nur noch für die App (und
    ihren Besitzer) lesbar, und die App kann sie weiter lesen. C4 ist
    behandelt.
report-event-end =
    Alle vier Befunde sind behoben, und nichts ist kaputt. Nadia: „Die
    Website hat sich nicht gerührt. Ich gebe das an Salomé weiter!“

    Gut gemacht! Du hast das Kapitel „Der Bericht“ abgeschlossen.

    WAS PASSIERT IST
    Ein Audit sucht keine Hacker: Es vergleicht den Server mit dem, was er
    sein sollte. Diese vier Befunde sind die häufigsten: ein zu weiter
    Eingang (root über SSH), ein nach einem Weggang vergessener Zugang
    (Konto und sudo), ein Privileg ohne Absicherung (sudo ohne Passwort)
    und ein Geheimnis in Reichweite aller (.env mit rw-r--r--). Keiner ist
    ein Angriff: Jeder macht einen Angriff leichter.

    GUTE PRAXIS
    - PermitRootLogin no: Man wird root mit sudo, vom eigenen Konto aus,
      was eine Spur hinterlässt, wer was getan hat. Immer sshd -t vor dem
      Reload, und eine Sitzung zum Testen offen halten.
    - Bei jedem Weggang das Konto schließen: userdel (oder usermod -L, ein
      chage -E und das Entfernen aus sudo, wenn man die Dateien behalten
      will). Eine regelmäßig durchgesehene Liste der Konten verhindert
      Versäumnisse.
    - sudo mit Passwort, oder Regeln, die auf einen Befehl begrenzt sind:
      geringste Rechte. Die Dateien in /etc/sudoers.d bearbeitet man mit
      visudo.
    - Eine Datei mit Geheimnissen: chmod 600, im Besitz des Kontos, das sie
      benutzt. Besser: nie ein Geheimnis im Klartext in einem Repository
      oder auf einer Freigabe aufbewahren.

    EIN ANDERER WEG
    Für C2 ist das Löschen des Kontos am saubersten; es zu sperren, ablaufen
    zu lassen und aus sudo zu entfernen, behält seine Dateien für eine
    Übergabe, lässt aber eine Tür, die man im Auge behalten muss: Ein nur
    gesperrtes Konto (usermod -L) würde noch einen SSH-Schlüssel annehmen;
    erst das Ablaufdatum (usermod -e, chage -E) schließt es wirklich,
    zusammen mit dem Entfernen aus sudo.

    DOKUMENTATION
    - sshd_config: https://man.openbsd.org/sshd_config
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - userdel und usermod: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
