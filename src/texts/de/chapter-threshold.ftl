### Geschichte „Der Fahrradverleih“, Kapitel „Der Schwellenwert“: zwei
### Alarmregeln, eine volle Platte und eine Fehlerrate. PromQL (ein gauge
### direkt verglichen, rate() auf Countern, summieren vor dem Teilen),
### Regeldateien, for:, Labels und Annotationen, promtool check rules, die
### Zustände der Alarme. Befehle, Optionen, Metriknamen, PromQL, Pfade und
### Ausgaben werden nicht übersetzt.

chapter-threshold = Der Schwellenwert
    .summary = Prometheus sieht jetzt jede Maschine, aber niemand schaut hin. Die beiden Alarme schreiben, die die Genossenschaft braucht, eine Platte, die vollläuft, und eine App, die mit Fehlern antwortet, so dass sie losgehen, wenn wirklich etwas nicht stimmt, und den Rest der Zeit still bleiben.

## Dateien

threshold-message-ngozi =
    Von: Ngozi (Fahrradverleih-Genossenschaft)
    Dienstag, 15. Mai, 9:00

    Guten Morgen,

    Prometheus sieht jetzt alles, aber niemand schaut den ganzen Tag hin.
    Zwei Alarme bitte, in /etc/prometheus/rules/ (prometheus.yml liest
    schon rules/*.yml):

    1. Eine Platte mit weniger als 10 % freiem Platz, auf irgendeiner
       unserer Maschinen. Severity: warning.
    2. Die Verleih-App, die mehr als 5 % ihrer Anfragen mit Fehlern (5xx)
       beantwortet. Severity: page: Der weckt, wer Bereitschaft hat.

    Jeder mit einem summary: ein Satz, der sagt, was nicht stimmt, und wo.

    Vorsicht: Tomás sagt, die App hat ein paarmal pro Stunde kurze
    Fehlerschübe (eine Station, die sich neu verbindet). Die sind normal
    und dürfen niemanden wecken.

    Um deine Alarme zu testen: Gerade stimmen zwei Dinge nicht. Die Platte
    von nabe ist seit dem Backup letzte Woche fast voll
    (/var/backups/docks-2029-04.tar.gz, schon anderswohin kopiert: lösch
    es, sobald dein Alarm losgegangen ist). Und sieh dir Tomás' Notiz an.

    Ngozi

threshold-note-tomas =
    Notiz von Tomás

    Seit dem Release heute Morgen (2.4.0) scheitert etwa jede zweite
    Rückgabe mit einem Fehler 500 (ein Bug mit den Batteriecodes der
    Stationen). Die Korrektur, 2.4.1, liegt schon auf sattel
    (/srv/rental/VERSION); sie wirkt, wenn der Dienst neu startet (auf
    sattel: sudo systemctl restart rental).

    Starte ihn erst neu, wenn dein Alarm losgegangen ist: Wir wollen
    wissen, dass er funktioniert.

    Tomás

threshold-release-notes =
    rental 2.4.1

    - Behebt die Fehler 500 bei POST /returns, wenn eine Station einen
      Batteriecode schickt (2.4.0).

## Ereignisse

threshold-event-disk-query =
    Jedes Dateisystem, mit seinem Anteil an freiem Platz. Welches ist
    knapp? (Ein tmpfs wie /run lebt im Speicher: Lass es weg, mit
    fstype!="tmpfs" oder mountpoint="/".)
threshold-event-error-query =
    rate() macht aus einem Counter eine Rate pro Sekunde, gemittelt über
    sein Fenster ([5m]). Um die Fehler mit allen Anfragen zu vergleichen,
    teil eine Rate durch die andere. Aber welche Serien durch welche? Sieh
    dir die Labels auf jeder Seite an.
threshold-event-rate-gauge =
    rate() ist für Counter gedacht, die nur wachsen (ihre Namen enden auf
    _total). Auf einem gauge wie node_filesystem_avail_bytes hält es jeden
    Rückgang für ein Zurücksetzen des Counters: Unsinn, und Prometheus warnt
    davor („metric might not be a counter“). Vergleich den Wert eines gauge
    direkt; um zu sehen, wohin er sich bewegt, deriv() oder
    predict_linear().
threshold-event-raw-counter =
    Eine Regel auf dem Rohwert eines Counters: http_requests_total wächst
    nur, seit dem Start der App. Einmal über dem Schwellenwert, kommt er nie
    wieder herunter: Der Alarm würde für immer losgehen, bis der nächste
    Neustart ihn auf null setzt. Alarmiere auf seine rate().
threshold-event-unsummed =
    Diese Regel teilt jede Serie durch sich selbst: die 500er-Serie von
    /returns durch dieselbe Serie, also 1, hundert Prozent Fehler, die ganze
    Zeit. Erst summieren, dann teilen: sum by (job) der 5xx-Rate, geteilt
    durch sum by (job) der Rate aller Anfragen.
threshold-event-not-errors =
    status!="200" zählt auch 201 (ein angelegter Verleih) und 404 (eine
    unbekannte Station): nicht die Fehler der App. Serverfehler sind die
    5xx: status=~"5..".
threshold-event-no-for =
    Ohne for: geht ein Alarm los, sobald sein Ausdruck wahr ist, bei einer
    einzigen Auswertung: Jeder Fehlerschub (zwei Minuten, ein paarmal pro
    Stunde) würde jemanden anpiepen, sich auflösen, dann wieder anpiepen.
    for: 10m verlangt, dass die Bedingung anhält, bevor er losgeht;
    inzwischen ist der Alarm „pending“.
threshold-event-disk-rule =
    Die Plattenregel ist geladen. An erfundenen Tagen ausprobiert, warnt
    sie für jede Maschine mit 7 % frei und bleibt bei 12 % still. Beobachte
    /api/v1/alerts: Der Alarm von nabe sollte pending sein, dann firing,
    sobald sein for: verstrichen ist (sleep lässt Zeit vergehen).
threshold-event-error-rule =
    Die Fehlerregel ist geladen und hält an erfundenen Tagen: Sie geht bei
    einem anhaltenden Vorfall los und bleibt bei den Schüben eines normalen
    Tages still.
threshold-event-labels =
    Eine Regel ohne Label severity oder Annotation summary: Der
    Alertmanager leitet Alarme nach ihren Labels weiter (severity), und wer
    einen bekommt, liest zuerst sein summary. Füg beides hinzu.
threshold-event-pending =
    „pending“: Der Ausdruck ist wahr, und der Alarm wartet, bis sein for:
    verstrichen ist, bevor er losgeht. Wenn die Bedingung inzwischen
    aufhört, wird er wieder inactive, und niemand erfährt davon.
threshold-event-disk-firing =
    Der Plattenalarm von nabe geht los (firing). Wie Ngozi gesagt hat, kann
    das alte Backup jetzt weg (auf nabe: /var/backups/docks-2029-04.tar.gz).
threshold-event-photos =
    Ngozi: „Die Fotos der Stationen! Sie belegen den Zustand jedes Rads bei
    der Rückgabe... Ich habe sie aus der externen Kopie zurückgeholt.“ Die
    zu löschende Datei war das alte Backup, in /var/backups.
threshold-event-disk-resolved =
    Platz freigegeben: Bei der nächsten Auswertung ist der Ausdruck falsch,
    und der Alarm löst sich auf (Prometheus sagt es dem Alertmanager noch
    eine Weile, damit das „resolved“ alle erreicht).
threshold-event-restart-early =
    Tomás: „Die Fehler haben aufgehört, danke! Aber wir haben den Alarm nie
    losgehen sehen. Ist die Regel bereit fürs nächste Mal?“ Sie muss noch an
    erfundenen Tagen halten: /api/v1/rules zeigt, was geladen ist.
threshold-event-error-firing =
    Der Fehleralarm geht los (firing): Die Fehler haben länger gedauert als
    sein for:. Jetzt die Korrektur: rental auf sattel neu starten.
threshold-event-error-resolved =
    Die App läuft mit 2.4.1; ihre Fehlerrate ist wieder normal, und der
    Alarm löst sich auf, sobald die schlechten Minuten sein Fenster
    verlassen haben.
threshold-event-end =
    Ngozi: „Beide Alarme funktionieren, und sie wissen, wann sie still sein
    müssen. Nächste Woche: dafür sorgen, dass sie jemanden erreichen, zur
    richtigen Zeit.“

    Gut gemacht! Du hast Der Schwellenwert abgeschlossen.

    WAS PASSIERT IST
    Du hast zwei Fragen in PromQL übersetzt. Die Platte:
    node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.10, ein
    gauge, direkt verglichen. Die Fehler: die Rate der 5xx über der Rate
    aller Anfragen, jede zuerst summiert, > 0.05. In einer Regeldatei, mit
    einem for: (wie lange die Bedingung halten muss), einem Label severity
    und einem summary; dann promtool check rules, ein Reload, und du hast
    zugesehen, wie die Alarme pending wurden, losgingen und sich nach jeder
    Korrektur auflösten.

    GUTE PRAXIS
    - Auf das alarmieren, was die Leute spüren (Fehler, eine volle Platte),
      mit einem Schwellenwert und einer Dauer.
    - rate() für Counter (…_total), nie ihr Rohwert; nie rate() auf einem
      gauge.
    - Vor dem Teilen summieren (sum by (job)): ein Verhältnis zweier
      Summen.
    - for: fängt kurze Schübe ab: zu kurz piept umsonst, zu lang kommt zu
      spät.
    - Einen Alarm testen: ihn einmal losgehen sehen (hier echte Fehler;
      anderswo promtool test rules mit erfundenen Serien).
    - Labels leiten den Alarm weiter (severity), Annotationen erklären ihn
      (summary, description, runbook_url).

    DOKUMENTATION
    - Alarmregeln: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
    - rate(): https://prometheus.io/docs/prometheus/latest/querying/functions/#rate
    - Operatoren und Vektor-Matching: https://prometheus.io/docs/prometheus/latest/querying/operators/
    - Alarmierung, gute Praxis: https://prometheus.io/docs/practices/alerting/
