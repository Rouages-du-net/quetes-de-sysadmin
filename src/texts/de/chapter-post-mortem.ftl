### Geschichte „Bereitschaft“, Kapitel 6 „Das Post-Mortem“: die Fakten in
### den Logs finden (journalctl --since/--until, last, apt) und ein
### Post-Mortem ohne Schuldzuweisung schreiben. Befehle, Pfade und die
### Meldungen der Werkzeuge werden nicht übersetzt. Die Abschnittstitel der
### Vorlage (post-mortem-section-…) müssen dieselben sein wie in der Vorlage.

chapter-post-mortem = Das Post-Mortem
    .summary = Sonntagnacht hatte Théo Bereitschaft, und die Livesendung ist ausgefallen: aufschreiben, was passiert ist, mit den Fakten aus den Logs und ohne einen Schuldigen zu suchen.

## Dateien

post-mortem-message-zoe =
    Eine Nachricht von Zoé (Montag, 9:40 Uhr):

    „In der Nacht auf Montag hatte Théo Bereitschaft: Die Livesendung ist
    ausgefallen, und er hat sie repariert. Für den Verein schreiben wir
    ein Post-Mortem: was passiert ist, warum, und was wir ändern. Ohne
    Schuldzuweisung: Wir suchen niemanden, der schuld ist, wir suchen, was
    die Störung möglich gemacht hat.

    Kannst du es schreiben? Die Vorlage liegt in postmortem.md (nano). Théo
    hat seine Notizen dagelassen (notes_theo.txt), aber er war halb im
    Schlaf: Prüf die Uhrzeiten in den Logs. Ich lese es jedes Mal, wenn du
    speicherst.“
post-mortem-notes-theo =
    Théos Notizen (Sonntag, 3:10 Uhr):

    Vom Telefon geweckt, ich weiß nicht mehr, wann, gegen 2:30?
    Das Relay war ausgefallen, gegen 2:20, glaube ich. journalctl sagte
    eine unbekannte Option in stream.conf, Zeile 7 (bitrate_max). Ich habe
    sie auskommentiert, neu gestartet, und es kam zurück.

    Was ich nicht verstehe: Warum ist das Relay mitten in der Nacht neu
    gestartet? Niemand war angemeldet.
post-mortem-template =
    # Post-Mortem: Ausfall der Livesendung, Nacht vom 11. auf den 12. September 2027

    Ohne Schuldzuweisung: Wir suchen, was die Störung möglich gemacht hat, nicht wer schuld ist.

    ## Zusammenfassung
    (zu ergänzen: zwei oder drei Sätze)

    ## Zeitverlauf
    (zu ergänzen: die Uhrzeiten, in den Logs geprüft)

    ## Auswirkung
    (zu ergänzen: wie lange, für wen)

    ## Ursachen
    (zu ergänzen: was die Störung ausgelöst hat, und was sie möglich gemacht hat)

    ## Was gut lief
    (zu ergänzen)

    ## Maßnahmen
    (zu ergänzen: eine Zeile „-“ pro Maßnahme)
post-mortem-conf-stream =
    # Radio Viertel: Stream-Relay (der Dienst radio-stream)
    port = 8000
    mount = /live
    logfile = /var/log/radio/stream.log
    loglevel = info
    record_dir = /srv/radio/sendungen
    #bitrate_max = 192    # Théo, 12.09.: unbekannte Option, auskommentiert
    stats_dir = /srv/radio/stats
post-mortem-unattended-conf =
    // Sicherheitsupdates, jede Nacht automatisch installiert
    // (apt-daily-upgrade.timer). needrestart startet danach die Dienste
    // neu, die eine aktualisierte Bibliothek benutzen.
    Unattended-Upgrade::Origins-Pattern {"{"}
            "origin=Debian,codename=bookworm,label=Debian-Security";
    {"}"};
    Unattended-Upgrade::Automatic-Reboot "false";
post-mortem-apt-history =
    Start-Date: 2027-09-05  02:11:52
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: tzdata:amd64 (2027a-0+deb12u1, 2027b-0+deb12u1)
    End-Date: 2027-09-05  02:11:58

    Start-Date: 2027-09-12  02:12:44
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: libssl3:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2), openssl:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2)
    End-Date: 2027-09-12  02:13:04
post-mortem-unattended-dpkg =
    Log started: 2027-09-12  02:12:45
    (Reading database ... 41213 files and directories currently installed.)
    Preparing to unpack .../libssl3_3.0.15-1~deb12u2_amd64.deb ...
    Unpacking libssl3:amd64 (3.0.15-1~deb12u2) over (3.0.15-1~deb12u1) ...
    Setting up libssl3:amd64 (3.0.15-1~deb12u2) ...
    Processing triggers for libc-bin (2.36-9+deb12u9) ...

    Restarting services...
     systemctl restart radio-stream.service
    Log ended: 2027-09-12  02:13:04

## Was das Spiel im Post-Mortem prüft

# Die Abschnittstitel (wie in der Vorlage, ohne „##“).
post-mortem-section-summary = Zusammenfassung
post-mortem-section-timeline = Zeitverlauf
post-mortem-section-impact = Auswirkung
post-mortem-section-causes = Ursachen
post-mortem-section-went-well = Was gut lief
post-mortem-section-actions = Maßnahmen
# Der Anfang der Vorlagenzeilen, die ersetzt werden müssen.
post-mortem-a-complete = (zu ergänzen
# Wörter, von denen eines in „Ursachen“ stehen muss (durch Komma getrennt, kleingeschrieben).
post-mortem-words-trigger = unattended, upgrade, apt, needrestart, update, aktualisierung
post-mortem-words-origin = august, 20. aug, 20.08, 20.8., 2027-08-20
# Wörter, die einen Schuldigen suchen (das Post-Mortem muss sie vermeiden).
# (Nicht „schuld“ allein: Es steckt in „Schuldzuweisung“ und „schuldlos“.)
post-mortem-words-blame = ist schuld, sind schuld, die schuld, schuld daran, schuldig, fahrlässig, nachlässig, unachtsam, inkompetent, versagt, hätte aufpassen, théos fehler, theos fehler, zoés fehler, zoes fehler, fehler von théo, fehler von theo, fehler von zoé, fehler von zoe

post-mortem-review = Zoé liest dein Post-Mortem noch einmal:
# { $word }: das Wort, das einen Schuldigen sucht
post-mortem-blame = „{ $word }“: Wir suchen, was die Störung möglich gemacht hat, nicht wer sie verursacht hat. Niemand hat falsch gehandelt; verbessert wird das System (die Werkzeuge, die Gewohnheiten). Könntest du es umformulieren?
post-mortem-missing-template = Es gibt noch Zeilen „(zu ergänzen)“ aus der Vorlage.
post-mortem-missing-timeline = Der Zeitverlauf muss, in den Logs geprüft, die Uhrzeit des Ausfalls, des ersten Alarms und der Rückkehr der Livesendung nennen (journalctl --since … --until …, die Mail des Alarms).
post-mortem-missing-impact = Die Auswirkung: Wie viele Minuten Stille für die Hörerschaft?
post-mortem-missing-cause = Die Ursachen: was das Relay mitten in der Nacht neu gestartet hat (die Historie von apt, /var/log/unattended-upgrades), und der Konfigurationsfehler, der es am Wiederanlaufen gehindert hat.
post-mortem-missing-origin = Und seit wann wartete dieser Fehler in stream.conf? Das Log hält die mit sudo ausgeführten Befehle fest.
post-mortem-missing-actions = Mindestens zwei Maßnahmen, eine pro Zeile „-“.
post-mortem-missing-works = Die Zusammenfassung, und was gut lief (da gibt es einiges!).

## Ereignisse

post-mortem-event-notes =
    Théos Notizen liefern Spuren, keine Fakten: „gegen 2:30?“, „gegen
    2:20, glaube ich“. Die Logs dagegen sind sekundengenau
    (journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30").
    Und wer hat sich in dieser Nacht angemeldet? (last)
post-mortem-event-reboot =
    Kurz bevor das Relay ausfiel, ist apt-daily-upgrade gestartet: das
    automatische Update der Nacht. Was hat es installiert, und was hat es
    danach getan? (/var/log/apt/history.log, /var/log/unattended-upgrades)
post-mortem-event-origin =
    Am 20. August hat Zoé stream.conf geändert… ohne das Relay neu zu
    starten, das mit der alten Konfiguration weiterlief. Der Fehler hat
    drei Wochen auf den ersten Neustart gewartet. Das ist niemandes
    Schuld: Nichts hat die Konfiguration nach einer Änderung geprüft.
post-mortem-event-end =
    Zoé: „Perfekt. Ich lese es beim Treffen am Donnerstag vor, und wir
    machen uns an die Maßnahmen. Danke für diese Nächte; du hast aus
    diesem Radio einen Ort gemacht, an dem uns Störungen etwas lehren.“

    Gut gemacht! Du hast „Bereitschaft“ abgeschlossen.

    WAS PASSIERT IST
    Ein automatisches Sicherheitsupdate (unattended-upgrades) hat das
    Relay um 2:13 Uhr neu gestartet (needrestart). Es konnte nicht wieder
    anlaufen: Eine unbekannte Option (bitrate_max) wartete seit dem
    20. August in seiner Konfiguration, nie geprüft und nie angewendet.
    Die Sonde hat um 2:15 alarmiert, Théo hat es um 2:58 repariert:
    45 Minuten Stille.

    GUTE PRAXIS
    - Zuerst die Fakten: die Logs (journalctl --since/--until, last, die
      Historie von apt), keine Erinnerungen.
    - Ohne Schuldzuweisung: die Bedingungen suchen, die die Störung
      möglich gemacht haben (eine nie geprüfte Konfiguration, ein Neustart
      in der Nacht), keinen Schuldigen; sonst spricht niemand mehr über
      seine Fehler.
    - Konkrete Maßnahmen, mit wer und wann: die Konfiguration vor dem
      Neustart prüfen (ExecStartPre=), nach jeder Änderung neu starten, die
      Person in Bereitschaft lauter wecken…
    - Das Post-Mortem teilen: So lernt das ganze Team.

    DOKUMENTATION
    - Postmortem culture (Google SRE): https://sre.google/sre-book/postmortem-culture/
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - unattended-upgrades: https://wiki.debian.org/UnattendedUpgrades
