### Geschichte „Die Genossenschaft“, Kapitel 6 „Automatische Updates“:
### unattended-upgrades. Befehle, Pfade, Konfigurationsschlüssel von apt und
### Paketnamen werden nicht übersetzt.

chapter-auto-updates = Automatische Updates
    .summary = Schon wieder Sicherheitsupdates: unattended-upgrades aktivieren, den Bericht bekommen, nachts neu starten und nodejs in Ruhe lassen.

## Dateien

auto-updates-email-awa =
    Von:      Awa
    An:       dich
    Betreff:  Noch mehr Updates?

    Danke noch mal für letztes Mal! Aber ich habe gerade gelesen, dass es
    schon neue Lücken in openssl und im Kernel gibt. Wir können dich nicht
    jede Woche anrufen…

    Marc hat mir erzählt, er habe vor einem Jahr „automatische Updates“
    installiert (unattended-upgrades). Anscheinend hat sich nie etwas von
    selbst installiert. Kannst du nachsehen? Was wir uns wünschen:
      - Sicherheitsupdates, die sich jeden Tag selbst installieren;
      - darüber informiert werden: eine E-Mail an root reicht, Lina liest sie;
      - wenn ein Neustart nötig ist, soll er von selbst passieren, aber
        während die Genossenschaft geschlossen ist (wir haben von 7 bis
        20 Uhr geöffnet);
      - vor allem nodejs nicht anfassen: Lina sagt, die Kasse funktioniert
        nur mit Version 20, und Marc hat das Repository für Version 22
        hinzugefügt, „um vorbereitet zu sein“.

    Die Konfiguration steht in /etc/apt/apt.conf.d (man apt.conf,
    man unattended-upgrade). Um zu prüfen, ohne bis morgen früh zu warten,
    lässt sich der Dienst, der jeden Morgen die Arbeit macht, von Hand
    starten.

## Ereignisse

auto-updates-event-syntax =
    apt versteht seine Konfiguration nicht mehr („E: Syntax error“): Es
    verweigert ALLES, automatische Updates eingeschlossen. Meistens ein
    vergessenes „;“ am Zeilenende, oder eine Klammer. apt-config dump nennt
    die Datei und die Zeile.
auto-updates-event-nothing =
    Der Dienst apt-daily-upgrade ist gelaufen… und hat nichts getan. Er
    startet apt.systemd.daily, das APT::Periodic::Unattended-Upgrade liest:
    Bei „0“ (so steht es in 20auto-upgrades) hört es sofort auf. Deshalb
    wurde nie etwas installiert. (apt-config dump APT::Periodic zeigt, was
    apt verstanden hat.)
auto-updates-event-nodejs =
    Autsch: nodejs ist gerade auf Version 22 gewechselt. Die Kasse läuft
    noch (mit dem alten Programm im Speicher), aber sie wird nicht neu
    starten: Sie verlangt Node.js 20. Ein zu breites Muster in
    Origins-Pattern lässt Fremd-Repositorys durch, die niemand mit der
    Kasse getestet hat. Um zurückzugehen, starte das Kapitel über das Menü
    neu; und halte nodejs heraus (seinen Ursprung nicht erlauben, oder
    Package-Blacklist benutzen).
auto-updates-event-in-day =
    Die Maschine hat gerade neu gestartet, mitten am Nachmittag:
    Automatic-Reboot ist aktiviert, aber ohne Uhrzeit startet
    unattended-upgrades sofort neu („now“). Zwei Minuten ohne Kasse, eine
    Schlange am Empfang. Du brauchst eine Uhrzeit, zu der die
    Genossenschaft geschlossen ist: Automatic-Reboot-Time.
auto-updates-event-without-report =
    Die Updates wurden installiert, aber niemand wird es je erfahren: Ohne
    Unattended-Upgrade::Mail wird kein Bericht verschickt.
auto-updates-event-end =
    Die Sicherheitsupdates installieren sich jeden Morgen selbst, der
    Bericht geht an root, die Maschine startet heute Nacht für den neuen
    Kernel neu, und nodejs bleibt bei Version 20. Lina: „Ich habe die
    E-Mail bekommen! Sie sagt, ein Neustart wird nötig sein, und dass er
    heute Nacht von selbst passiert.“

    Gut gemacht! Du hast das Kapitel „Automatische Updates“ abgeschlossen.

    WAS PASSIERT IST
    unattended-upgrades war installiert, aber ausgeschaltet:
    20auto-upgrades sagte „0“. Jeden Morgen startete der Timer
    apt-daily-upgrade den Dienst, der diese „0“ las und aufhörte. Einmal
    aktiviert, installiert er, was 50unattended-upgrades erlaubt: die
    Ursprünge von Debian und seinen Sicherheitsupdates, nicht das
    Repository von NodeSource.

    GUTE PRAXIS
    - Automatische Sicherheitsupdates auf jedem Server; Fremd-Repositorys
      und Hauptversionen von Hand, nach einem Test.
    - Ein Bericht per E-Mail (Mail), und ein Neustart, geplant, wenn
      niemand die Maschine benutzt (Automatic-Reboot-Time).
    - Prüfen, ohne zu warten: unattended-upgrade --dry-run --debug,
      apt-config dump, und das Log in /var/log/unattended-upgrades.
    - Ein Bericht, der nicht mehr ankommt, ist ein Alarm: Man muss ihn lesen.

    DOKUMENTATION
    - UnattendedUpgrades (Debian-Wiki): https://wiki.debian.org/UnattendedUpgrades
    - unattended-upgrade(8): https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html
    - apt.conf(5): https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
