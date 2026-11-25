### Geschichte „Die Hütten“, Kapitel 3 „Fehlgeschlagene Anmeldungen“:
### eine rsyslog-Regel mit Bedingung, die Reihenfolge der Regeln, stop.
### Konfiguration, Pfade und die Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-ssh-alerts = Fehlgeschlagene Anmeldungen
    .summary = Roboter probieren Passwörter auf jeder Hütte aus. Lous Alarm liest eine einzige Datei: Leg die fehlgeschlagenen Anmeldungen aller Hütten hinein, und nichts anderes, ohne die Dateien pro Hütte kaputtzumachen.

## Dateien

ssh-alerts-message-lou =
    Von:     Lou
    An:      dich
    Betreff: Ein Alarm für SSH-Angriffe

    Hallo,

    Ich habe eine kleine Prüfung geschrieben, die cron alle fünf Minuten
    startet: Sie zählt die Zeilen von /var/log/remote/ssh-failures.log und
    schickt mir eine SMS, wenn die Datei zu schnell wächst. Kurz gesagt:
    jemand, der Passwörter auf einer Hütte ausprobiert.

    Könntest du rsyslog die fehlgeschlagenen SSH-Anmeldungen aller Hütten
    hineinschreiben lassen (und nur die)? Die Dateien pro Hütte müssen
    weiter funktionieren.

    Gleiches sudo-Passwort: gipfel-2028.

    Lou

## Ereignisse

ssh-alerts-event-failures =
    „Failed password for invalid user admin…“: die Meldung von sshd für
    ein falsches Passwort. In rsyslog hat eine Nachricht Eigenschaften:
    $programname (sshd), $msg (der Text), $fromhost-ip… Ein „if“ prüft sie
    (man rsyslog.conf).
ssh-alerts-event-rule =
    Eine Regel schreibt nach ssh-failures.log. Benutzt rsyslog sie schon?
    Es liest seine Konfiguration beim Start (sudo rsyslogd -N1 zum Prüfen,
    dann ein Neustart).
ssh-alerts-event-after-stop =
    Die Regel ist da, rsyslog ist neu gestartet, und ssh-failures.log
    bleibt leer: Die Regeln laufen der Reihe nach, und die Nachrichten der
    Hütten halten bei der Regel pro Hütte in 10-remote.conf an. Eine
    Regel dahinter sieht sie nie. Stell deine davor (eine Datei, die früher
    gelesen wird: 05-…, oder im selben Block, vor dem stop).
ssh-alerts-event-too-wide =
    ssh-failures.log bekommt mehr als fehlgeschlagene Anmeldungen: Der
    Filter ist zu weit (das Programm allein nimmt auch „Accepted
    publickey…“). Füg eine Bedingung auf die Nachricht hinzu ($msg contains
    'Failed password').
ssh-alerts-event-per-hut-broken =
    Die Dateien pro Hütte bekommen nichts mehr: Eine Regel hält die
    Nachrichten der Hütten jetzt vor ihnen an, oder die Regel pro Hütte
    wurde geändert. Beides muss funktionieren.
ssh-alerts-event-end =
    ssh-failures.log sammelt die fehlgeschlagenen Anmeldungen aller Hütten,
    und nur die; jede Hütte behält ihre Datei. Lou: „Drei Roboter
    gleichzeitig auf der Hütte am Pass, und mein Handy hat geklingelt.
    Perfekt.“

    Gut gemacht! Du hast das Kapitel „Fehlgeschlagene Anmeldungen“ abgeschlossen.

    WAS PASSIERT IST
    rsyslog wendet seine Regeln der Reihe nach an, und stop beendet die
    Reise einer Nachricht. Die Regel pro Hütte endete mit stop: Eine neue
    Regel musste davor kommen und sowohl das Programm als auch die
    Nachricht prüfen.

    DIE REGELN VON RSYSLOG
    - if $programname == 'sshd' and $msg contains 'Failed password' then
      /var/log/remote/ssh-failures.log
    - Die Dateien in /etc/rsyslog.d werden in alphabetischer Reihenfolge
      gelesen (05-… vor 10-…), vor den Regeln von rsyslog.conf.
    - Eine Nachricht kann in mehrere Dateien gehen, bis zu einem stop.

    GUTE PRAXIS
    - rsyslogd -N1, dann Neustart, dann ausprobieren: logger -t sshd
      "Failed password for test".
    - Ein Alarm auf eine Rate (Zeilen pro Minute), nicht auf jede Zeile.
    - Gegen das Erraten von Passwörtern selbst: nur Schlüssel, und
      fail2ban.

    DOKUMENTATION
    - Bedingungen in RainerScript: https://www.rsyslog.com/doc/rainerscript/control_structures.html
    - Die Eigenschaften: https://www.rsyslog.com/doc/configuration/properties.html
