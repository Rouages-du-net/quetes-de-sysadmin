### Geschichte „Das Audit“, Kapitel „Der Bericht“: vier Hygiene-Befunde
### auf dem Server der Bäckerei (SSH, ein vergessenes Konto, sudo ohne
### Passwort, ein für alle lesbares Geheimnis). Die Schlüsselwörter
### (PermitRootLogin, NOPASSWD…), die Befehle, die Pfade und die Meldungen
### der Werkzeuge werden nicht übersetzt.

chapter-report = Der Bericht
    .summary = Die Befunde eines Audits beheben: SSH, ein vergessenes Konto, sudo ohne Passwort, ein für alle lesbares Geheimnis.

## Dateien

report-email-nadia =
    Von:      Nadia (Die Bäckerei)
    An:       dich
    Betreff:  Das Audit meines Servers

    Ich führe die Bäckerei, nicht den Server: Um den kümmerst du dich
    jetzt. Meine Versicherung will vor der Vertragsverlängerung ein
    Sicherheitsaudit, also habe ich Salomé geholt, eine unabhängige
    Auditorin. Sie hat sich gestern den Server angesehen und mir ihren
    Bericht dagelassen, den ich in dein Verzeichnis kopiert habe:
    auditbericht.txt.

    Ich verstehe nicht alles, aber sie wirkt seriös. Könntest du die
    Befunde einen nach dem anderen angehen, ohne die Online-Bestellungen
    lahmzulegen? Jeden Morgen ist die Theke voll, und die Seite darf nicht
    ausfallen.

    Für sudo ist dein Passwort: mehl-2028
    Und bitte prüfe jede Korrektur: Salomé kommt zur Kontrolle wieder.

# The orders app's service, as systemctl status describes it.
audit-orders-description = Bestellungen der Bäckerei (Online-Bestell-App)

report-report-audit =
    AUDITBERICHT — Die Bäckerei (baeckerei.example)
    Auditorin: Salomé, unabhängig
    Umfang: der Server der Bäckerei (192.0.2.22)
    Methode: Durchsicht der Konten und der Konfiguration, Portscan aus dem
    Internet, Lesen der Logs

    Dieser Bericht hat drei Teile. Hier ist der erste, die Hygiene des
    Servers. Die anderen beiden folgen (Exposition im Netz, Login-Spuren).

    C1 — SSH nimmt direkte Logins des Kontos root an               [hoch]
         Ein Bot, der ein Passwort errät, oder ein gestohlener Schlüssel
         würde auf einen Schlag alle Rechte ausliefern. Referenz:
         sshd_config(5), PermitRootLogin.

    C2 — Das Konto einer ausgeschiedenen Person existiert noch     [hoch]
         lucas, ein Praktikant, dessen Vertrag am 28. Februar endete, hat
         noch ein Konto und ist Mitglied der Gruppe sudo.

    C3 — sudo ohne Passwort für das Administrationskonto           [mittel]
         Eine gestohlene Sitzung oder ein nicht gesperrter Bildschirm
         genügt, um root zu werden, ohne etwas einzutippen. Referenz:
         sudoers(5), NOPASSWD.

    C4 — Eine Datei mit Geheimnissen ist für alle lesbar           [mittel]
         /srv/bestellungen/.env enthält die Adresse der Datenbank mit ihrem
         Passwort. Jedes Konto auf dem Server kann sie lesen.

    Erwartet: für jeden Befund die Korrektur, dann die Prüfung, dass sie
    hält (und dass nichts kaputt ist: die Seite, die Bestell-App und der
    Administrationszugang bleiben in Betrieb).

## Ereignisse

report-event-sudoers-broken =
    Es gibt einen Fehler in der sudo-Policy! Wenn eine sudoers-Datei
    falsch ist, verweigert sudo alles, für alle. Diese Dateien bearbeitet
    man mit visudo (man visudo): Es prüft die Syntax vor dem Speichern.
report-event-locked-out =
    ACHTUNG: Mit der Konfiguration, die sshd gerade geladen hat, würde ein
    neues Login von deinem Konto abgewiesen. Deine aktuelle Sitzung bleibt
    offen (sshd kappt nie laufende Sitzungen): Jetzt ist der Moment, das zu
    korrigieren, BEVOR du dich abmeldest.
report-event-without-effect =
    In der Datei steht zwar „PermitRootLogin no“… aber sshd hat es noch
    nicht angewendet: Es liest seine Konfiguration beim Start und wenn man
    es zum Neuladen auffordert. Prüfe mit  sudo sshd -t  (die Syntax) und
    lass dann den Dienst neu laden. Um zu sehen, was sshd wirklich
    anwendet:  sudo sshd -T
report-event-account-incomplete =
    Du hast nur einen Teil von Befund C2 erledigt. Ein „geschlossenes“
    Konto heißt: keine Möglichkeit mehr, sich anzumelden (gesperrtes
    Passwort, abgelaufenes Konto) UND keine Rechte mehr (aus der Gruppe
    sudo entfernt). Sieh dir an, was übrig ist, mit  id lucas  und
    sudo chage -l lucas  (man chage, man usermod).
report-event-app-blind =
    Das Geheimnis ist nicht mehr für alle lesbar… aber die Bestell-App kann
    es auch nicht mehr lesen! Sie läuft als Konto „bestellungen“ und liest .env
    beim Start: Beim nächsten Neustart käme sie nicht wieder hoch. Schau,
    wem die Datei gehört (ls -l): Ziel ist, den anderen Konten die Tür zu
    schließen, nicht der App.
report-event-ssh =
    sshd wendet deine neue Konfiguration an: root kann sich nicht mehr
    anmelden, und dein Konto kann es weiterhin. C1 ist erledigt.

    Auf einem echten Server behält man eine Sitzung offen und testet mit
    einer zweiten, bevor man die erste schließt.
report-event-account =
    Niemand kann sich mehr mit dem Konto von Lucas anmelden, und es hat
    keine Rechte mehr auf dem Server. C2 ist erledigt.
report-event-sudo =
    Keine NOPASSWD-Regel mehr für dein Konto: sudo fragt nach deinem
    Passwort, wie es sein soll, und du kannst weiterhin administrieren. C3
    ist erledigt.
report-event-secret =
    Die Datei mit Geheimnissen ist jetzt nur noch für die App (und ihren
    Besitzer) lesbar, und die App kann sie weiterhin lesen. C4 ist
    erledigt.
report-event-end =
    Alle vier Befunde sind behoben, und nichts ist kaputt. Nadia: „Die
    Seite hat sich keinen Millimeter bewegt. Ich gebe das an Salomé
    weiter!“

    Gut gemacht! Du hast das Kapitel „Der Bericht“ abgeschlossen.

    WAS PASSIERT IST
    Ein Audit sucht keine Hacker: Es vergleicht den Server mit dem, was er
    sein sollte. Diese vier Befunde sind die häufigsten: ein zu breiter
    Eingang (root über SSH), ein nach einem Abschied vergessener Zugang
    (Konto und sudo), ein Privileg ohne Absicherung (sudo ohne Passwort)
    und ein Geheimnis in Reichweite aller (.env als rw-r--r--). Keiner ist
    ein Angriff: Jeder erleichtert einen.

    GUTE PRAXIS
    - PermitRootLogin no: Root wird man mit sudo, vom eigenen Konto aus,
      was eine Spur hinterlässt, wer was getan hat. Immer sshd -t vor dem
      Neuladen, und eine Sitzung zum Testen offen lassen.
    - Bei jedem Abschied das Konto schließen: userdel (oder usermod -L, ein
      chage -E und Entfernen aus sudo, wenn man die Dateien behalten will).
      Eine regelmäßig durchgesehene Kontenliste verhindert Versäumnisse.
    - sudo mit Passwort, oder auf einen Befehl beschränkte Regeln: das
      Prinzip der geringsten Rechte. Die Dateien in /etc/sudoers.d
      bearbeitet man mit visudo.
    - Eine Datei mit Geheimnissen: chmod 600, im Besitz des Kontos, das sie
      benutzt. Besser: nie ein Geheimnis im Klartext in einem Repository
      oder auf einer Freigabe.

    EIN ANDERER WEG
    Für C2 ist das Löschen des Kontos am saubersten; es zu sperren,
    ablaufen zu lassen und aus sudo zu entfernen bewahrt seine Dateien für
    eine Übergabe, lässt aber eine Tür, die man im Auge behalten muss: Ein
    nur gesperrtes Konto (usermod -L) würde weiterhin einen SSH-Schlüssel
    annehmen; erst das Ablaufen (usermod -e, chage -E) schließt es
    wirklich, zusammen mit dem Entfernen aus sudo.

    DOKUMENTATION
    - sshd_config: https://man.openbsd.org/sshd_config
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - userdel und usermod: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
