### Geschichte „Die Genossenschaft“, Kapitel „Das Geheimnis“: eine .env, die
### nginx ausliefert. Direktiven von nginx, Pfade und die Ausgaben der
### Werkzeuge werden nicht übersetzt.

chapter-secret = Das Geheimnis
    .summary = Der Zahlungsschlüssel liegt offen im Internet: herausfinden, wie er hinausgekommen ist, das Leck in nginx schließen, wer ihn genommen hat sperren, den Schlüssel wechseln.

## Dateien

# { $key }: der neue Zahlungsschlüssel
secret-email-awa =
    Von:     Awa
    An:      dich
    Betreff: DRINGEND: unser Zahlungsschlüssel

    Der Anbieter des Kartenterminals hat gerade angerufen: Unser geheimer
    Schlüssel wurde letzte Nacht im Internet gesehen. Sie haben ihn
    deaktiviert und uns einen neuen gegeben:

      { $key }

    Solange die Kasse den alten benutzt, keine Kartenzahlungen mehr! Der
    Schlüssel steht in der Datei .env der Kassen-App (/srv/till/app), die
    die App beim Start liest.

    Aber zuerst: Wie ist er hinausgekommen? Versuch selbst, ihn von der
    Website anzufordern (curl http://coop.example/.env), schau ins Log von
    nginx (/var/log/nginx/access.log) und mach die Tür zu. Wenn du
    herausfindest, wer ihn genommen hat, sperr ihn auch (man nginx… und die
    Dokumentation von deny).

    Für sudo: radieschen-2027

## Ereignisse

secret-event-env-only =
    /.env kommt nicht mehr hinaus… aber /.git/config schon (probier curl).
    Das Verzeichnis .git enthält die Adresse des Repositorys, mit einem
    Zugriffstoken darin. Nicht nur .env-Dateien muss man verstecken,
    sondern ALLE versteckten Dateien: eine location mit einem regulären
    Ausdruck (location ~ /\. ), oder eine Wurzel, die nur enthält, was
    öffentlich sein soll.
secret-event-site-broken =
    Vorsicht: Das Leck ist geschlossen, aber die Website (/) oder die
    Kasse (/till/) antwortet nicht mehr normal. Prüf mit curl und lies
    deine Konfiguration noch einmal (sudo nginx -t).
secret-event-closed =
    Versteckte Dateien kommen nicht mehr hinaus, und die Website antwortet noch.
# { $address }: die gesperrte Adresse
secret-event-attacker =
    { $address } bekommt jetzt 403: Das ist die Adresse, die letzte Nacht
    die Dateien .env und .git/config heruntergeladen hat (python-requests,
    um 3:12 Uhr). Über diese Website kommt sie nicht wieder… aber was sie
    genommen hat, hat sie schon: Die Geheimnisse müssen gewechselt werden.
secret-event-key-written =
    Der neue Schlüssel steht in .env… aber die Kasse läuft noch mit dem
    alten: Die App liest ihre .env nur beim Start. Prüf mit
    curl http://127.0.0.1:3000/health.
secret-event-end =
    Kein Leck mehr, die Adresse ist gesperrt, und die Kasse nimmt wieder
    Karten an. Awa: „Puh. Wir sprechen beim nächsten Treffen darüber.“

    Gut gemacht! Du hast das Kapitel „Das Geheimnis“ abgeschlossen.

    WAS PASSIERT IST
    Die Website wurde aus dem Verzeichnis der App ausgeliefert: nginx gab
    alles heraus, was darin lag, auch versteckte Dateien (.env, .git). Bots
    fragen diese Adressen jede Nacht bei jeder Website an. Das Zugriffslog
    von nginx hält jede Anfrage fest: die Uhrzeit, die Adresse, den Code
    (200: Die Datei ist hinausgegangen).

    GUTE PRAXIS
    - Eine Wurzel, die NUR enthält, was öffentlich sein soll; nie das
      Verzeichnis einer App, mit ihrem Code und ihren Geheimnissen.
    - Versteckte Dateien überall verweigern: location ~ /\. {"{"} deny all; {"}"}.
    - Geheimnisse nur für die App lesbar (chmod 600, im Besitz des Kontos
      der App), und nie in git.
    - Ein Geheimnis, das hinausgelangt ist, ist verloren: wechseln (den
      Zahlungsschlüssel, aber auch das Datenbankpasswort und das git-Token,
      als Nächstes!).
    - Nach einem Leck: das Zugriffslog lesen (grep '\.env' access.log),
      notieren wer, wann, was.

    DOKUMENTATION
    - location: https://nginx.org/en/docs/http/ngx_http_core_module.html#location
    - deny: https://nginx.org/en/docs/http/ngx_http_access_module.html

## Die Kassen-App (gemeinsam mit den nächsten Kapiteln, siehe till-web.ts):
## die Wörter, die man sieht, in der Sprache
secret-till-env-payment = ZAHLUNG_SCHLUESSEL
secret-till-login = anmelden
secret-till-health-payment = zahlung
secret-till-health-revoked = schluessel_widerrufen
secret-till-title = Kasse
secret-till-site = Genossenschaft
secret-till-lang = de
