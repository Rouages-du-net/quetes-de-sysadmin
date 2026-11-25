### Geschichte „Der Fahrradverleih“, Kapitel „Ruhezeiten“: Routing,
### Gruppierung und Wiederholungsintervall des Alertmanagers, und eine
### Stummschaltung für eine geplante Wartung. amtool, alertmanager.yml, das
### Log des Relays. Befehle, Optionen, Labels, Pfade und Ausgaben werden
### nicht übersetzt.

chapter-quiet-hours = Ruhezeiten
    .summary = Die Alarme erreichen den Chat, aber die falschen Leute, immer und immer wieder, und eine geplante Wartung wird gleich umsonst die Person in Bereitschaft anpiepen. Die Alarme richtig leiten, sie beruhigen und stummschalten, was bekannt ist, ohne alles stummzuschalten.

## Dateien

quiet-hours-message-ngozi =
    Von: Ngozi (Fahrradverleih-Genossenschaft)
    Samstag, 19. Mai, 9:35

    Hallo,

    Zwei Dinge, und eins ist dringend.

    1. Die Alarme erreichen den Chat (das Relay auf messuhr postet, was der
       Alertmanager ihm schickt: /var/log/alert-relay/relay.log), aber
       schlecht. #team bekommt alle fünf Minuten dieselbe Warnung über die
       Platte von sattel (Tomás räumt sie am Montag auf, das kann warten).
       Und am Dienstagabend war sattel vier Minuten lang down: Der Alarm
       ging an #team, und niemand in Bereitschaft wurde angepiept. Pages
       gehen an #on-call, Warnungen an #team, und bitte nicht öfter als
       einmal pro Stunde.

    2. Um 10:00 tausche ich die Platte von nabe. Sie ist dann bis etwa
       11:30 down. Ich will nicht, dass die Person in Bereitschaft wegen
       etwas geweckt wird, das wir schon kennen. Aber ich will wissen, wenn
       inzwischen sattel oder etwas anderes kaputtgeht!

    amtool ist installiert (es liest /etc/amtool/config.yml).

    Ngozi

## Ereignisse

quiet-hours-event-repeats =
    Dieselbe Warnung, alle fünf Minuten: repeat_interval: 1m in
    /etc/prometheus/alertmanager.yml. Der Alertmanager schickt einen
    feuernden Alarm nach repeat_interval erneut (standardmäßig 4h), sieht
    sich eine Gruppe aber nur alle group_interval an (hier 5m): So oft kann
    er höchstens wiederholen. group_by entscheidet, was zusammengehört.
quiet-hours-event-routes =
    Der Routing-Baum: unter der Standardroute eine einzige Route, für
    severity="critical". Deine Regeln sagen page oder warning: critical
    passt auf nichts, also fällt alles an den Standardempfänger, team.
    (amtool config routes test severity=page zeigt, wohin ein Alarm gehen
    würde.)
quiet-hours-event-am-invalid =
    amtool lehnt die Datei ab und sagt warum. Der Alertmanager würde sie
    auch ablehnen und seine alte Konfiguration behalten.
quiet-hours-event-am-check =
    amtool check-config: Die Datei ist gültig. Der Alertmanager läuft immer
    noch mit der Konfiguration, die er vorher gelesen hat, bis er die Datei
    neu liest.
quiet-hours-event-am-not-reloaded =
    Die Datei stimmt, aber der Alertmanager hat sie nicht neu gelesen: sudo
    systemctl reload prometheus-alertmanager (oder ein POST auf
    /-/reload).
quiet-hours-event-am-bad-reload =
    Das Neuladen ist gescheitert: Der Alertmanager behält seine alte
    Konfiguration, und sein Journal sagt warum (sudo journalctl -u
    prometheus-alertmanager -n 20).
quiet-hours-event-routing =
    Das Routing funktioniert: Eine page geht an on-call, eine Warnung an
    team.
quiet-hours-event-repeat-interval =
    Nicht mehr als eine Erinnerung pro Stunde: Der Kanal kann aufatmen. Ein
    aufgelöster Alarm wird weiterhin angekündigt (send_resolved, bei einem
    Webhook standardmäßig true).
quiet-hours-event-stopped =
    Prometheus oder der Alertmanager ist gestoppt: Nichts wird bemerkt,
    weder während der Wartung noch danach, und sattel könnte unbemerkt
    ausfallen. Ngozi hat um das Gegenteil gebeten. Starte ihn wieder und
    schalte nur stumm, was bekannt ist.
quiet-hours-event-rule-removed =
    Die Regel NodeDown ist weg: Die Wartung von nabe wird nicht anpiepen,
    aber auch nicht der nächste Ausfall von sattel, und auch nicht nabe,
    wenn es um 11:30 nicht zurückkommt. Eine Stummschaltung ist für eine
    bekannte, begrenzte Zeit; eine Regel zu entfernen ist für immer.
quiet-hours-event-too-broad =
    Diese Stummschaltung deckt auch die Alarme anderer Maschinen ab (oder
    jede page): Wenn sattel während der Wartung ausfällt, erfährt es
    niemand. Beschränk sie auf nabe (seine instance) und lass die breite
    ablaufen (amtool silence expire mit ihrer ID).
quiet-hours-event-too-short =
    Diese Stummschaltung deckt nicht die ganze Wartung ab, von 10:00 bis
    11:30: Sie beginnt zu spät, oder ihr Ende würde jemanden anpiepen.
    --duration zählt ab jetzt (oder ab --start). Eine Stummschaltung lässt
    sich nicht verlängern, aber ersetzen: eine neue hinzufügen, die alte
    ablaufen lassen.
quiet-hours-event-silenced =
    Die Alarme von nabe sind für die Wartung stummgeschaltet: Der
    Alertmanager bekommt sie weiterhin (amtool alert query --silenced),
    schickt aber nichts. Die Stummschaltung endet von selbst.
quiet-hours-event-paged =
    Das Bereitschaftstelefon hat geklingelt: NodeDown von nabe, während
    einer Wartung, von der alle wussten. Eine vorher gesetzte
    Stummschaltung hätte es still gehalten.
quiet-hours-event-end =
    Ngozi: „Perfekt. Ich gehe mit der neuen Platte in den Keller. Wenn
    sattel auch nur blinzelt, erfahre ich es.“ (Du kannst dem Vormittag
    beim Vergehen zusehen: sleep 1800, dann amtool alert query
    --silenced.)

    Gut gemacht! Du hast Ruhezeiten und Der Fahrradverleih abgeschlossen.

    WAS PASSIERT IST
    Prometheus entscheidet, dass ein Alarm losgeht; der Alertmanager
    entscheidet, wer davon erfährt, wie oft und wann nicht. Seine einzige
    Route passte auf severity="critical", ein Label, das keine Regel setzte:
    Jeder Alarm fiel an den Standardempfänger (#team), und repeat_interval:
    1m wiederholte ihn bei jedem group_interval, alle fünf Minuten. Du hast
    den Matcher korrigiert (page geht an on-call), ein vernünftiges
    Wiederholungsintervall gesetzt, die Datei geprüft (amtool
    check-config), neu geladen und nabe für seine Wartung mit amtool
    stummgeschaltet, ohne die Regeln anzufassen oder etwas zu stoppen.

    GUTE PRAXIS
    - Nach den Labels leiten, die die Regeln wirklich setzen; amtool config
      routes test zeigt, wohin ein Alarm geht.
    - Gruppieren, was zusammengehört (group_by), und in Stunden wiederholen,
      nicht in Minuten.
    - Eine geplante Wartung ist eine Stummschaltung: enge Matcher
      (instance=…), ein Anfang und ein Ende, die das Fenster mit Puffer
      abdecken, ein Kommentar, eine Urheberin oder ein Urheber. Nie die
      Regel löschen, nie die Überwachung stoppen.
    - Inhibition (inhibit_rules) kann die Alarme der Dienste einer
      Maschine stumm halten, während die Maschine selbst down ist.
    - Eine Konfiguration prüfen, bevor man sie neu lädt (amtool
      check-config, promtool check config).

    DOKUMENTATION
    - Alertmanager, route: https://prometheus.io/docs/alerting/latest/configuration/#route
    - Gruppierung, Inhibition, Stummschaltungen: https://prometheus.io/docs/alerting/latest/alertmanager/
    - amtool: https://github.com/prometheus/alertmanager#amtool
