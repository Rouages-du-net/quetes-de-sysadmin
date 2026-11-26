### Geschichte „Die Genossenschaft“, Kapitel „Der Proxy“: Die App hinter
### nginx sieht nur 127.0.0.1 (X-Forwarded-For, trust proxy). Direktiven,
### Variablen und Pfade von nginx werden nicht übersetzt.

chapter-proxy = Der Proxy
    .summary = Ein Bot sorgt dafür, dass alle gesperrt werden: Hinter nginx sieht die Kasse jeden Client als 127.0.0.1. X-Forwarded-For, und wem man vertraut.

## Dateien

proxy-email-awa =
    Von:      Awa
    An:       dich
    Betreff:  Niemand kommt mehr in die Kasse

    Seit heute Morgen antwortet die Kasse allen „Zu viele Versuche,
    versuch es in 15 Minuten wieder“: Lina, Karim, mir… Wir versuchen es
    noch einmal, und es geht von vorn los.

    Karim glaubt, ein Bot probiert Passwörter (die Kasse sperrt eine
    Adresse nach 5 Fehlschlägen). Aber warum wir? Vergleiche das Log der
    Kasse (/var/log/till/app.log) und das von nginx
    (/var/log/nginx/access.log): Sie sehen nicht dieselben Adressen.

    Die App ist eine Node-App (Express): Schau dir ihre Einstellung
    TRUST_PROXY in /srv/till/app/.env an (und den Express-Leitfaden,
    „behind proxies“). Auf der Seite von nginx: die Dokumentation von
    proxy_set_header.

    Für sudo: radieschen-2027

## Ereignisse

proxy-event-all-world =
    Fünf Minuten später: Der Bot hat 127.0.0.1 wieder sperren lassen… und
    Lina gleich mit. Für die Kasse kommt jede Anfrage von nginx
    (127.0.0.1): nginx muss die Adresse des echten Clients weiterreichen
    (einen Header X-Forwarded-For), UND die Kasse muss bereit sein, ihn zu
    lesen (TRUST_PROXY), dann müssen beide neu gestartet werden.
# { $robot }: die Adresse des Bots
proxy-event-spoofed =
    Lina kommt hinein… aber der Bot ({ $robot }) wird nie gesperrt: Er
    schreibt selbst einen falschen X-Forwarded-For, bei jedem Versuch einen
    anderen, und die Kasse glaubt ihm. Schau in /var/log/till/app.log:
    10.1.0.4, 10.2.7.5…

    Eine App sollte X-Forwarded-For nur für das glauben, was IHR Proxy
    hinzugefügt hat: TRUST_PROXY=true nimmt die erste Adresse der Liste
    (die, die der Client geschrieben hat). Lies den Express-Leitfaden noch
    einmal: loopback vertraut nur 127.0.0.1. Und auf der Seite von nginx
    muss dieser Header von nginx geschrieben oder ergänzt werden, nicht
    nur weitergereicht.
# { $robot }: die Adresse des Bots
proxy-event-end =
    Fünf Minuten später: Der Bot ({ $robot }) ist gesperrt, und Lina kommt
    problemlos hinein. Awa: „Wir können die Kassen wieder öffnen!“

    Gut gemacht! Du hast das Kapitel „Der Proxy“ abgeschlossen.

    WAS PASSIERT IST
    Hinter einem Proxy (nginx) bekommt eine App alle ihre Verbindungen
    vom Proxy selbst. Um den echten Client zu kennen, braucht sie den
    Header X-Forwarded-For, den der Proxy ausfüllt. Aber ein Client kann
    ihn auch selbst schreiben: Die App darf nur den Adressen trauen, die
    die Proxys hinzugefügt haben, die sie kennt, und liest die Liste von
    rechts.

    GUTE PRAXIS
    - In nginx: proxy_set_header X-Forwarded-For
      $proxy_add_x_forwarded_for (und oft X-Real-IP $remote_addr,
      X-Forwarded-Proto $scheme).
    - In der App: nur dem Proxy vertrauen (loopback, oder seine Adresse),
      nie „allen“ (true).
    - Die Logs des Proxys und der App vergleichen, wenn eine Adresse
      seltsam aussieht: 127.0.0.1 überall in der App ist genau dieses Symptom.
    - Eine Sperre pro Adresse schützt hinter einem falsch eingestellten
      Proxy schlecht: Sie bestraft alle, oder niemanden.

    DOKUMENTATION
    - proxy_set_header: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
    - Express behind proxies: https://expressjs.com/en/guide/behind-proxies.html
