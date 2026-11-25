### Geschichte „Der Fahrradverleih“, Kapitel „Der tote Winkel“: Prometheus
### ist installiert, aber zwei seiner Targets scheitern lautlos, und eine
### Maschine fehlt. Die HTTP-API mit curl und jq, promtool, /metrics eines
### Exporters, ufw, scrape_configs und das Neuladen. Befehle, Optionen,
### Metriknamen, Adressen, Pfade und Ausgaben werden nicht übersetzt.

chapter-blind-spot = Der tote Winkel
    .summary = Letzten Samstag ist das Gateway der Ausleihstationen ausgefallen, und niemand wusste es, bis die Telefone klingelten, dabei sollte ein Prometheus alles überwachen. Ihn fragen, was er wirklich sieht, und ihn die ganze Genossenschaft sehen lassen.

## Dateien

blind-spot-message-ngozi =
    Von: Ngozi (Fahrradverleih-Genossenschaft)
    Montag, 7. Mai, 14:00

    Hallo, und willkommen an Bord!

    Letzten Samstag haben die Ausleihstationen drei Stunden lang keine
    Räder mehr verliehen: nabe, die Maschine, die mit den Stationen
    spricht, war ausgefallen, und niemand wusste es, bis die Telefone
    klingelten. Dabei hat Aroha Prometheus auf messuhr installiert, bevor
    sie weggezogen ist, genau damit er alles überwacht.

    Kannst du dir ansehen, was Prometheus tatsächlich sieht? Auf messuhr
    gibt es keinen Browser, aber Prometheus antwortet über seine HTTP-API,
    Port 9090: curl spricht mit ihm (jq macht sein JSON lesbar), und
    promtool kann ihn auch fragen.

    Er sollte sich selbst überwachen, unsere drei Maschinen (messuhr,
    sattel und nabe: auf jeder ein Node Exporter auf Port 9100) und die
    Verleih-App auf sattel (siehe Tomás' Notiz).

    Ngozi

blind-spot-note-tomas =
    Notiz von Tomás

    Die Verleih-App läuft seit März auf sattel, auf Port 3000. Sie stellt
    ihre Metriken unter /metrics bereit (prom-client, das übliche
    Textformat). Aroha hat sie vor dem Umzug zuerst hier ausprobiert, auf
    messuhr.

    Tomás

## Ereignisse

blind-spot-event-targets =
    Targets sind down („health“: „down“, oder up bei 0), jedes mit seinem
    lastError. Prometheus holt ab (pull): Alle 15 Sekunden scrapt er jedes
    Target (ein HTTP-GET auf /metrics) und zeichnet up auf, 1, wenn das
    Scrapen geklappt hat, sonst 0. Und such nabe in der Liste.
blind-spot-event-deadline =
    „context deadline exceeded“: Prometheus hat bis zum Scrape-Timeout auf
    den Exporter von sattel gewartet und nichts zurückbekommen, nicht
    einmal eine Ablehnung. Das tut eine Firewall, die Pakete verwirft. Auf
    sattel (ssh sattel): Antwortet der Exporter lokal (curl
    localhost:9100/metrics)? Was lässt seine Firewall durch (sudo ufw
    status)?
blind-spot-event-refused =
    „connection refused“ auf 127.0.0.1:3000: Der Job rental scrapt immer
    noch messuhr selbst, wo nichts auf Port 3000 lauscht. Tomás' Notiz
    sagt, wo die App jetzt lebt.
blind-spot-event-exporter =
    Der Node Exporter antwortet: Text, ein Messwert pro Zeile, mit # HELP
    und # TYPE vor jeder Metrikfamilie (ein counter wächst nur, ein gauge
    steigt und fällt). Das liest Prometheus bei jedem Scrapen.
blind-spot-event-app-metrics =
    Die Metriken der App: http_requests_total ist ein counter, mit den
    Labels method, route und status; http_request_duration_seconds ein
    histogram (_bucket, _sum, _count); rental_bikes_available ein gauge für
    jede Station.
blind-spot-event-too-open =
    Port 9100 ist jetzt für das ganze Internet offen: Ein Node Exporter
    erzählt jedem von deiner Maschine (ihrem Kernel, ihren Platten, ihrer
    Last). Nur messuhr braucht ihn: Erlaub ihn nur von 192.0.2.54 aus und
    lösch die breite Regel (sudo ufw status numbered, dann sudo ufw delete
    mit ihrer Nummer).
blind-spot-event-saddle-open =
    sattel lässt messuhr jetzt auf Port 9100 an seinen Exporter, und sonst
    niemanden. Beim nächsten Scrapen sollte das Target hochkommen.
blind-spot-event-config-invalid =
    promtool lehnt die Datei ab und sagt, welche Zeile und warum.
    Prometheus selbst würde sie beim Neulesen genauso ablehnen und seine
    alte Konfiguration behalten.
blind-spot-event-config-check =
    promtool check config ist einverstanden: Die Syntax ist gültig, und die
    Regeldateien, die sie nennt, wurden auch geprüft. Prometheus läuft
    immer noch mit der Konfiguration, die er vorher gelesen hat, bis er die
    Datei neu liest.
blind-spot-event-lifecycle =
    „Lifecycle API is not enabled“: POST /-/reload funktioniert nur, wenn
    Prometheus mit --web.enable-lifecycle gestartet wurde (ARGS in
    /etc/default/prometheus). Ohne das geht das Neuladen über ein Signal:
    sudo systemctl reload prometheus, das SIGHUP schickt.
blind-spot-event-bad-reload =
    Das Neuladen ist gescheitert: Prometheus behält die Konfiguration, die
    er hatte, und sagt in seinem Journal warum (sudo journalctl -u
    prometheus -n 20). systemctl hat es nicht bemerkt: Ein Reload schickt
    nur ein Signal. Prüf die Datei zuerst mit promtool.
blind-spot-event-not-reloaded =
    Die Datei stimmt, aber Prometheus läuft immer noch mit der
    Konfiguration, die er vorher gelesen hat: Lass ihn die Datei neu lesen
    (sudo systemctl reload prometheus).
blind-spot-event-saddle-up = Der Node Exporter von sattel ist up.
blind-spot-event-rental-up = Die Verleih-App ist up: Ihre Zähler erreichen Prometheus alle 15 Sekunden.
blind-spot-event-hub-up =
    nabe wird überwacht: Wenn sein Exporter nicht mehr antwortet, geht sein
    up innerhalb von 15 Sekunden auf 0. Das ist das Signal, das am Samstag
    gefehlt hat.
blind-spot-event-end =
    Ngozi: „Alles grün! Wenn nabe das nächste Mal ausfällt, sieht
    Prometheus es sofort. Jetzt muss es nur noch jemandem gesagt
    werden... nächste Woche?“

    Gut gemacht! Du hast Der tote Winkel abgeschlossen.

    WAS PASSIERT IST
    Prometheus holt ab: Alle scrape_interval scrapt er jedes Target seiner
    scrape_configs und zeichnet up auf, 1 oder 0. Zwei Targets scheiterten
    seit März lautlos: Die Firewall von sattel verwarf Port 9100 (context
    deadline exceeded), und der Job rental zeigte immer noch auf
    localhost:3000, den alten Platz der App (connection refused). nabe war
    nie hinzugefügt worden. Du hast die Targets über die API gelesen, 9100
    auf sattel nur für messuhr geöffnet, die Targets korrigiert, die Datei
    mit promtool geprüft und Prometheus sie neu lesen lassen: { $targets }
    Targets, alle up.

    GUTE PRAXIS
    - Den Wächter überwachen: Die Gesundheit der Targets (up) ist das
      Erste, was man prüft, und der erste Alarm, den man schreibt.
    - Keine Weboberfläche nötig: Die HTTP-API antwortet curl (jq zum
      Lesen), und promtool query instant führt eine Abfrage aus.
    - promtool check config vor jedem Neuladen: Ein gescheitertes Neuladen
      behält die alte Konfiguration und sagt es nur im Journal.
    - Ein Reload statt eines Neustarts (systemctl reload prometheus:
      SIGHUP): Prometheus behält den Zustand seiner Alarme.
    - Ein Exporter erzählt viel über eine Maschine: Öffne seinen Port nur
      für den Prometheus-Server.
    - Prometheus fügt jeder Serie job und instance hinzu; Labels unter
      static_configs sagen mehr über ein Target.

    DOKUMENTATION
    - scrape_config: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config
    - Die HTTP-API: https://prometheus.io/docs/prometheus/latest/querying/api/
    - promtool: https://prometheus.io/docs/prometheus/latest/command-line/promtool/
    - Der Node Exporter: https://prometheus.io/docs/guides/node-exporter/
