### Geschichte „Die Zeitung“, Kapitel 3 „Blau und Grün“: ohne Unterbrechung
### deployen, mit zwei Slots und einer Gesundheitsprüfung. Befehle, Pfade
### und die Meldungen von nginx, systemctl und curl werden nicht übersetzt.

chapter-blue-green = Blau und Grün
    .summary = Die Abo-App ohne Unterbrechung aktualisieren: die neue Version neben der alten, ihre Gesundheit geprüft, dann schaltet nginx um.

## Dateien

blue-green-message-samia =
    Eine Nachricht von Samia:

    „Die Zeitung hat jetzt ihren Kiosk: die App, um den Newsletter zu
    abonnieren (curl http://gazette.example/kiosk/). Es ist ein
    Node.js-Programm, hinter nginx.

    Er kann als zwei Kopien laufen, „blau“ (blue) und „grün“ (green):
      - blau: der Dienst kiosk-blue, Port 3001, der Code in
        /srv/kiosk/blue (ein Link auf eine Version in /srv/kiosk/versions/);
      - grün: der Dienst kiosk-green, Port 3002, /srv/kiosk/green (gestoppt).
    nginx schickt /kiosk/ an einen der beiden
    (/etc/nginx/sites-available/gazette).

    Blau läuft mit 1.4.2. Wir müssen auf 1.5.0 wechseln, schon installiert
    in /srv/kiosk/versions/, ohne dass die Leserschaft die geringste
    Unterbrechung sieht. Jede Version antwortet auf /health, wenn es ihr
    gut geht.

    Und lass die alte Version laufen, bis wir uns bei der neuen sicher
    sind. Für sudo: gazette-2027.“
blue-green-conf-comment = Der Kiosk (Abos): der Slot, der die Leserschaft bedient
blue-green-notes-150 =
    Kiosk 1.5.0 — Versionshinweise

    Neu: Der Newsletter wird vom Kiosk selbst verschickt.

    VOR DEM LIVEGANG ZU TUN: den Mailserver in der Konfiguration
    eintragen (/etc/kiosk/kiosk.env), zum Beispiel:
      KIOSK_SMTP=smtp.gazette.example
    Ohne ihn antwortet /health mit 503, und das Abonnieren scheitert.

## Der Kiosk (ausgelieferte Seiten; { $version }: die Version der App)

kiosk-welcome =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Der Kiosk der Zeitung</title></head>
    <body>
    <h1>Der Kiosk</h1>
    <p>Bekomm jeden Montag den Newsletter der Zeitung.</p>
    <form method="post" action="subscribe"><input name="email"><button>Abonnieren</button></form>
    <footer>Kiosk { $version }</footer>
    </body>
    </html>
kiosk-archives =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Frühere Newsletter</title></head>
    <body>
    <h1>Frühere Newsletter</h1>
    <ul><li>Newsletter vom 17. Mai</li><li>Newsletter vom 10. Mai</li></ul>
    <footer>Kiosk { $version }</footer>
    </body>
    </html>
kiosk-migration-4 = rename_subscribers_mail_to_email

## Ereignisse

blue-green-event-health-ko =
    /health antwortet mit 503: Die Version läuft, ist aber nicht in der
    Lage zu bedienen. Eine Version, die ihre Gesundheitsprüfung nicht
    besteht, bekommt nie Verkehr. Was ihr fehlt, steht wahrscheinlich in
    ihren Versionshinweisen (/srv/kiosk/versions/1.5.0/).
blue-green-event-not-restarts =
    Der Link zeigt auf die neue Version, aber der Dienst antwortet noch mit
    der alten: Ein Programm liest seinen Code (und seine Konfiguration)
    beim Start. Er muss neu gestartet werden (man systemctl).
blue-green-event-too-early =
    Autsch: Die Leserschaft bekommt einen Fehler auf /kiosk/. nginx
    schickt den Verkehr an eine Instanz, die nicht oder nicht richtig
    antwortet. Das Rollback geht sofort: den anderen Slot wieder in
    proxy_pass eintragen, nginx -t, reload. Prüfe /health, BEVOR du umschaltest.
blue-green-event-not-reload =
    Die nginx-Datei zeigt zwar auf grün (3002), aber nginx liefert noch
    blau aus: Es liest seine Konfiguration nur beim reload neu (nginx -t,
    dann systemctl reload nginx).
blue-green-event-more-net =
    Blau ist gestoppt: Wenn 1.5.0 heute Abend ein Problem zeigt, gibt es
    kein sofortiges Rollback mehr. Lass die alte Version eine Weile
    laufen, bis du sicher bist.
blue-green-event-end =
    Die Leserschaft ist auf 1.5.0 umgezogen, ohne es zu merken, und die
    alte Version wartet, noch laufend, für alle Fälle. Samia: „Wenn es
    schiefgeht, schalten wir mit einem Befehl zurück.“

    Gut gemacht! Du hast Kapitel 3 von „Die Zeitung“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: ssh zeitung.)

    WAS PASSIERT IST
    Zwei Slots, blau und grün: Einer bedient die Öffentlichkeit, der andere
    bekommt die neue Version. Man startet sie, prüft ihre Gesundheit
    (/health), bevor sie einen einzigen Besuch bekommt, ergänzt, was fehlt
    (ihre Konfiguration), dann schaltet der Proxy in einem Schritt um. Das
    Neuladen von nginx kappt keine Verbindung: Alte Anfragen laufen zu
    Ende, neue gehen an grün.

    GUTE PRAXIS
    - Die Versionshinweise vor dem Deployment lesen.
    - Eine automatische Gesundheitsprüfung (/health) vor jedem Umschalten.
    - nginx -t vor jedem Neuladen; reload, nicht restart.
    - Die alte Version laufen lassen, bis die neue sich bewährt hat:
      Zurückrollen heißt, den Proxy zurückzuschalten.
    - Blau und grün wechseln sich ab: Die nächste Version kommt auf blau.

    EIN ANDERER WEG
    Der Kanarienvogel (nächstes Kapitel) schickt nur einen kleinen Teil der
    Besuche an die neue Version, um sie an echtem Verkehr zu beurteilen;
    ein Rolling Deployment ersetzt die Server einen nach dem anderen.
    Blue-Green: sofortiges Umschalten und sofortiges Rollback, um den
    Preis doppelter Ressourcen während des Wechsels.

    DOKUMENTATION
    - Blue-green deployment: https://martinfowler.com/bliki/BlueGreenDeployment.html
    - proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - nginx neu laden: https://nginx.org/en/docs/beginners_guide.html#control
