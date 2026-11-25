### Geschichte „Die Werkstatt“, Kapitel 2 „Die Komposition“: Docker
### Compose. Befehle, Pfade, YAML-Schlüssel und die Meldungen von docker,
### PostgreSQL und der App (auf Englisch) werden nicht übersetzt.

chapter-compose = Die Komposition
    .summary = Eine App und ihre Datenbank mit Docker Compose: Dienstnamen, Volumes, Geheimnisse in .env, Neustart.

## Dateien

compose-message-yasmine =
    Eine Nachricht von Yasmine:

    „Wir möchten, dass die Leute die Maschinen des FabLabs (den
    Laserschneider, die 3D-Drucker) online buchen können. Ich habe eine
    App gefunden, ‚reservations‘, die eine PostgreSQL-Datenbank braucht.
    Ein Tutorial lieferte eine fertige Datei compose.yaml: Ich habe sie
    nach /srv/reservations/ kopiert.

    Ich kriege es nicht zum Laufen. Und bevor ich diese Datei in das
    git-Repository des FabLabs stelle, möchte ich, dass sie kein Passwort
    mehr enthält: Die kommen in eine Datei .env, nur für root lesbar.

    Natürlich muss nach einem Stromausfall alles von selbst wieder
    starten, und die Buchungen dürfen nicht verschwinden, wenn die
    Container neu erstellt werden. Die App muss auf http://localhost:8081
    antworten.

    Für sudo: fablab-2027. Meine Notizen: hilfe_compose.txt.“
compose-help-compose =
    YASMINES NOTIZEN — DOCKER COMPOSE

    Alles aus dem Projektverzeichnis ausführen (/srv/reservations):
      sudo docker compose up -d       erstellt und startet (oder erneuert) die Dienste
      sudo docker compose ps          der Zustand der Dienste
      sudo docker compose logs webapp das Log eines Dienstes
      sudo docker compose config      die Datei, wie Compose sie versteht
      sudo docker compose down        stoppt und entfernt die Container

    Der Rest: man docker-compose.

## Die App

compose-app-welcome =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Eine Maschine buchen — FabLab</title></head>
    <body>
    <h1>Eine Maschine buchen</h1>
    <p>Laserschneider, 3D-Drucker, Stickmaschine: Wähle ein Zeitfenster.</p>
    <footer>reservations 2.1 — Datenbank verbunden</footer>
    </body>
    </html>

## Ereignisse

compose-event-localhost =
    „connect ECONNREFUSED 127.0.0.1:5432“: Die App sucht die Datenbank auf
    localhost. Aber in einem Container bedeutet localhost den Container
    selbst, weder die Maschine noch die anderen Container. In einem
    Compose-Projekt ist jeder Dienst über seinen Namen erreichbar, im
    Netz des Projekts.
compose-event-without-password =
    PostgreSQL weigert sich, seine Datenbank ohne Passwort anzulegen: Die
    Variable POSTGRES_PASSWORD ist leer. docker compose config zeigt, was
    Compose verstanden hat, und die Warnungen sagen, welche Variable in der
    Datei .env fehlt.
compose-event-authentication =
    „password authentication failed“: Die App und die Datenbank haben
    nicht dasselbe Passwort. Eine klassische Falle: Das PostgreSQL-Image
    liest POSTGRES_PASSWORD nur einmal, wenn es die Datenbank in einem
    leeren Verzeichnis anlegt. Existiert die Datenbank schon im Volume,
    ändert eine geänderte Variable nichts. Solange die Datenbank nichts
    Wichtiges enthält, kannst du sie neu anlegen (down -v löscht die
    Volumes); sonst ändert man das Passwort in der Datenbank selbst.
compose-event-connected =
    Die App ist mit ihrer Datenbank verbunden: http://localhost:8081
    antwortet. Jetzt mach den Aufbau solide (Daten, Geheimnisse, Neustart).
compose-event-volumes-erased =
    docker compose down -v: Die Volumes des Projekts sind gelöscht, und
    mit ihnen alle Daten der Datenbank. Nützlich, solange sie leer ist; nie
    bei einer Datenbank im Betrieb tippen.
compose-event-in-clear =
    Alles funktioniert… aber das Passwort steht noch in compose.yaml, das
    ins git-Repository geht. Compose ersetzt ${"{"}VARIABLE{"}"} durch den Wert
    aus der Datei .env des Projekts (man docker-compose).
compose-event-env-readable =
    Das Passwort hat compose.yaml verlassen: gut. Aber .env ist für jedes
    Konto der Maschine lesbar (ls -la). Yasmine wollte, dass sie nur für
    root lesbar ist.
compose-event-without-reboot =
    Fast: Nach einem Stromausfall würden diese Container nicht wieder
    starten. In compose.yaml kann jeder Dienst seine Neustartregel haben.
compose-event-end =
    http://localhost:8081 antwortet, die Datenbank behält ihre Daten in
    einem Volume, das Passwort schläft in .env (nur für root lesbar), und
    alles startet nach einem Stromausfall wieder. Yasmine veröffentlicht
    compose.yaml im git-Repository des FabLabs, ohne ein einziges Geheimnis darin.

    Gut gemacht! Du hast Kapitel 2 von „Die Werkstatt“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: Das Loch in der Firewall.)

    WAS PASSIERT IST
    Die compose.yaml des Tutorials hatte vier Mängel: Die App suchte die
    Datenbank auf localhost (in einem Container ist das er selbst), die
    Datenbank hatte kein Volume, das Passwort stand im Klartext darin, und
    nichts startete neu.

    GUTE PRAXIS
    - Zwischen Containern desselben Projekts: der Dienstname (db), nie
      localhost.
    - Die Daten einer Datenbank in einem benannten Volume, deklariert
      unter volumes:.
    - Geheimnisse in .env (chmod 600), nie in der veröffentlichten Datei;
      ${"{"}VARIABLE{"}"} in compose.yaml.
    - POSTGRES_PASSWORD wird nur beim Anlegen der Datenbank benutzt.
    - docker compose config, um zu sehen, was Compose verstanden hat;
      down -v löscht die Daten.
    - restart: unless-stopped bei jedem Dienst.
    - Das Attribut version: ist veraltet: entfernen.

    EIN ANDERER WEG
    Podman, ohne Daemon, kann dieselben Compose-Dateien ausführen; seine
    Quadlets beschreiben Container als systemd-Units. Kubernetes, für
    viele Maschinen, um den Preis von viel mehr Komplexität. Für eine App
    und ihre Datenbank auf einem Server bleibt docker compose am einfachsten.

    DOKUMENTATION
    - Networking in Compose: https://docs.docker.com/compose/how-tos/networking/
    - Compose-Variablen: https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
    - Das PostgreSQL-Image: https://hub.docker.com/_/postgres
