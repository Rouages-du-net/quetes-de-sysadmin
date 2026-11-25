### Geschichte „Die Zeitung“, Kapitel 4 „Der Kanarienvogel“: einen kleinen
### Teil des Verkehrs an die neue Version schicken und die Logs ansehen,
### bevor man weitergeht. Befehle, Pfade und die Meldungen von nginx, curl
### und den Logs werden nicht übersetzt.

chapter-canary = Der Kanarienvogel
    .summary = Eine Version, die ihre Gesundheitsprüfungen besteht, aber auf einer Seite abstürzt: ein Kanarienvogel (ein Besuch von zehn), die Logs, und das Umschalten erst, wenn alles sauber ist.

## Dateien

canary-message-samia =
    Eine Nachricht von Samia:

    „Kiosk 1.6.0 ist erschienen (/srv/kiosk/versions/1.6.0), mit einer
    neuen Suche im Archiv. Grün liefert noch 1.5.0 aus; die neue Version
    kommt auf blau, wie vereinbart.

    Aber diese Version ändert vieles, und /health prüft nicht alles. Also
    diesmal kein Umschalten auf einen Schlag: zuerst ein Kanarienvogel.
    Ein Besuch von zehn für blau, der Rest für grün, und wir schauen, was
    die Leserschaft bekommt (/var/log/nginx/access.log), bevor wir
    weitergehen. man nginx erklärt, wie man auf zwei Server aufteilt
    (upstream, weight).

    Für sudo: gazette-2027.“
canary-notes-160 =
    Kiosk 1.6.0 — Versionshinweise

    Neu: Suche in früheren Newslettern (/archives).
    In der Konfiguration ist nichts zu ändern.
canary-notes-161 =
    Kiosk 1.6.1 — Versionshinweise

    Korrektur: Die Archivseite (/archives) antwortete mit 500, wenn die
    Suche leer war. Danke an das Team der Zeitung für die Meldung!

## Ereignisse

# { $visits }: die Zahl der simulierten Besuche
canary-one-time =
    Eine Stunde vergeht: { $visits } Besuche beim Kiosk, über nginx.
    Alles steht in /var/log/nginx/access.log.
# { $errors }: die Zahl der Besuche, die einen Fehler bekommen haben
canary-event-all-at-once =
    Der ganze Verkehr ist auf einen Schlag zu 1.6.0 gewechselt… und
    { $errors } Besuche haben in dieser Stunde einen 500-Fehler bekommen:
    Alle kommen in den Genuss. Genau das hätte der Kanarienvogel vermieden.
    Geh zurück auf grün (proxy_pass, nginx -t, reload) und versuch es dann
    mit einem kleinen Teil des Verkehrs.
canary-event-canary-160 =
    Der Kanarienvogel ist eingerichtet: Blau (1.6.0) bekommt einen kleinen
    Teil der Besuche. Schau dir jetzt an, was die Leserschaft bekommen hat:
    Die Antwortcodes stehen in access.log (die Zahl nach der Anfrage: 200,
    404, 500…). grep oder awk helfen beim Sortieren.
canary-event-too-big =
    Ein großer Teil des Verkehrs geht an die neue Version: Hat sie ein
    Problem, sehen es viele Leute. Ein Kanarienvogel ist ein kleiner Teil
    (ein Besuch von zehn, oder weniger): weight=1 gegen weight=9.
canary-event-found =
    500er auf /kiosk/archives! Sie müssen von blau kommen: Grün liefert
    dieselbe Seite seit Wochen aus. Probier es direkt auf jeder Instanz
    (curl http://localhost:3001/archives, dann 3002), um sicher zu sein.
    /health hat diese Seite nicht geprüft. Stopp den Kanarienvogel: keine
    Besuche mehr für blau (down, oder den Server entfernen).
canary-event-stopped =
    Kanarienvogel gestoppt: Nur ein Besuch von zehn hat den Fehler
    gesehen, eine Stunde lang, statt aller. Samia gibt das Problem an die
    Entwickler weiter… die sofort 1.6.1 veröffentlichen
    (/srv/kiosk/versions/). Fang neu an: blau, /health, Kanarienvogel, Logs.
canary-event-canary-161 =
    Eine Stunde Kanarienvogel mit 1.6.1: keine Fehler in diesem Schwung
    Besuche. Die neue Version kann den ganzen Verkehr übernehmen. Lass grün
    für alle Fälle laufen.
canary-event-end =
    Der ganze Kiosk läuft über 1.6.1, ohne Fehler, und grün wartet in
    Reserve. Samia: „Der erste Versuch hat nur einen Besuch von zehn
    gestört, eine Stunde lang. Ohne Kanarienvogel hätten wir ihn allen
    serviert.“

    Gut gemacht! Du hast Kapitel 4 von „Die Zeitung“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: ssh zeitung.)

    WAS PASSIERT IST
    1.6.0 antwortete auf /health einwandfrei, stürzte aber auf einer
    bestimmten Seite ab. Ein upstream von nginx schickte einen kleinen Teil
    der Besuche an die neue Version (weight=1 gegen weight=9): Die Fehler
    tauchten in access.log auf, nur für wenige Leute. Wir haben den
    Kanarienvogel gestoppt, auf die Korrektur gewartet, einen sauberen
    Kanarienvogel wiederholt und dann alles umgeschaltet.

    GUTE PRAXIS
    - Ein Kanarienvogel: ein kleiner Teil des Verkehrs (ein paar %), für
      eine feste Zeit, mit vorher festgelegten Abbruchkriterien (Rate der 5xx).
    - Schauen, was die Nutzer sehen (die Zugriffslogs), nicht nur /health.
    - Den Kanarienvogel mit einem Handgriff stoppen können (down, reload).
    - In Stufen erhöhen (10 %, 50 %, 100 %); die alte Version bis zum Ende
      laufen lassen.
    - Um zu wissen, welcher Server jeden Besuch bearbeitet hat,
      $upstream_addr ins Log-Format aufnehmen (log_format).

    DOKUMENTATION
    - upstream und weight: https://nginx.org/en/docs/http/ngx_http_upstream_module.html
    - Canary release: https://martinfowler.com/bliki/CanaryRelease.html
    - Canarying releases (Google SRE): https://sre.google/workbook/canarying-releases/
