### Geschichte „Die Hütten“, Kapitel 1 „Die Logs sammeln“: rsyslog als
### zentraler Server (imudp), die Firewall, eine Datei pro Hütte, stop.
### Konfiguration, Pfade und die Ausgaben der Werkzeuge werden nicht
### übersetzt.

chapter-central-logs = Die Logs sammeln
    .summary = Die drei Berghütten schicken ihre Logs an den Server im Tal, und nichts kommt an. Lass das Tal lauschen, lass die Hütten herein, und gib jeder Hütte ihre eigene Datei.

## Dateien

central-logs-message-lou =
    Von:     Lou
    An:      dich
    Betreff: Die Logs der Hütten

    Hallo,

    Diesen Frühling habe ich die kleinen Maschinen der drei Hütten
    (huette-see, huette-pass, huette-grat) so eingerichtet, dass sie alle
    ihre Logs an diesen Server im Tal schicken, mit einer Zeile in ihrem
    rsyslog: *.* @tal.internal:514 (UDP).

    Die Idee: alles hier lesen, ohne zu jeder Hütte hinaufzusteigen. Aber
    auf tal kommt nichts an. Könntest du nachsehen, warum?

    Und wenn es geht, hätte ich gern eine Datei pro Hütte, in
    /var/log/remote/, nicht alles vermischt im eigenen /var/log/syslog
    des Tals.

    Dein sudo-Passwort: gipfel-2028.

    Lou

## Ereignisse

central-logs-event-silent =
    Hier lauscht nichts auf UDP 514: In /etc/rsyslog.conf sind das Modul,
    das Syslog über UDP empfängt (imudp), und sein Input auskommentiert,
    so wie Debian es installiert. Ein Server empfängt nur das, worauf er
    lauschen soll.
central-logs-event-restart-needed =
    Die Konfigurationsdatei stimmt, aber das laufende rsyslog hat sie beim
    Start gelesen: Starte es neu (sudo systemctl restart rsyslog). Vorher
    prüft sudo rsyslogd -N1 die Konfiguration, ohne den laufenden Dienst
    anzufassen.
central-logs-event-listening =
    rsyslog lauscht jetzt auf UDP 514 (ss -ulnp zeigt es). Kommen die
    Nachrichten der Hütten aber auch herein? Schau dir an, was ankommt,
    und was zwischen den Hütten und dem Port steht.
central-logs-event-firewall =
    rsyslog lauscht, aber von den Hütten kommt nichts herein: ufw lässt nur
    SSH herein, und UDP 514 wird verworfen, bevor rsyslog etwas sieht. Lass
    die Hütten herein, und wenn möglich nur sie (man ufw: from … to any
    port … proto udp).
central-logs-event-mixed =
    Die Nachrichten der Hütten kommen an… im /var/log/syslog des Tals,
    vermischt mit seinen eigenen. rsyslog wendet der Reihe nach jede
    passende Regel an: Eine Regel für die Hütten (eine Datei pro Hütte:
    eine Vorlage mit %HOSTNAME%) muss zuerst kommen und mit stop enden,
    damit die Standardregeln sie nicht auch bekommen. Die Dateien in
    /etc/rsyslog.d werden vor den Regeln von rsyslog.conf gelesen.
central-logs-event-config-error =
    rsyslog ist mit Fehlern in seiner Konfiguration gestartet: Sein Journal
    sagt, welche (journalctl -u rsyslog), und sudo rsyslogd -N1 auch. Die
    fehlerhaften Regeln werden ignoriert.
central-logs-event-end =
    Jede Hütte hat jetzt ihre eigene Datei ({ $file }…), und das Syslog
    des Tals bleibt das des Tals. Lou: „Ich sehe von hier aus den
    Kühlschrank der Hütte am See. Magie.“

    Gut gemacht! Du hast das Kapitel „Die Logs sammeln“ abgeschlossen.

    WAS PASSIERT IST
    Die Hütten schickten ihre Logs über UDP an tal, aber das rsyslog von
    tal lauschte nicht (imudp auskommentiert), und seine Firewall verwarf
    UDP 514 sowieso. UDP beschwert sich nie: Die Hütten ahnten nicht, dass
    nichts ankam.

    DER ZENTRALE SERVER
    - module(load="imudp") und input(type="imudp" port="514") in
      rsyslog.conf (oder TCP: imtcp, zuverlässiger).
    - Die Firewall nur für die Absender geöffnet.
    - Eine Vorlage mit %HOSTNAME% (oder %FROMHOST-IP%) für eine Datei pro
      Maschine, und stop, damit die Nachrichten nirgendwo sonst hingehen.

    GUTE PRAXIS
    - sudo rsyslogd -N1 nach jeder Änderung, vor dem Neustart.
    - Vom Absender aus testen: logger "Test von der Hütte am See", dann auf
      dem Server danach suchen.
    - UDP verliert Nachrichten, ohne es zu sagen: TCP (imtcp, @@server bei
      den Absendern), mit einer Warteschlange, ist besser für Logs, auf
      die es ankommt.

    DOKUMENTATION
    - imudp: https://www.rsyslog.com/doc/configuration/modules/imudp.html
    - Vorlagen: https://www.rsyslog.com/doc/configuration/templates.html
    - Filter: https://www.rsyslog.com/doc/configuration/filters.html
