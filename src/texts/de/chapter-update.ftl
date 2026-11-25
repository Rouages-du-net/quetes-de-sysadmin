### Geschichte „Die Werkstatt“, Kapitel 1 „Das Update“: Docker, Container
### und Volumes. Befehle, Pfade und die Meldungen von docker und der App
### werkzeugschuppen (auf Englisch) werden nicht übersetzt.

chapter-update = Das Update
    .summary = Eine App in Docker aktualisieren, ohne ihre Daten zu verlieren: die Schicht des Containers, docker cp, Volumes, --restart.

## Dateien

update-message-yasmine =
    Eine Nachricht von Yasmine, die das FabLab leitet:

    „Hallo! Bei uns leihen sich Leute aus dem Viertel Werkzeuge aus, und
    wir tragen alles im Werkzeugschuppen ein, einer kleinen Web-App. Ich
    habe sie vor zwei Wochen mit Docker installiert, nach Anleitung:

      docker run -d --name werkzeugschuppen -p 8080:8080 registry.example/werkzeugschuppen:1.4

    Version 1.5 ist gerade erschienen (sie behebt einen Fehler bei den
    Rückgabedaten). Kannst du sie aktualisieren? Vor allem: Verlier nicht
    die 37 laufenden Ausleihen: Ich habe nur die App, um zu wissen, wer
    was hat!

    Noch etwas: Nach dem Stromausfall am Mittwoch ist der Werkzeugschuppen
    nicht von selbst zurückgekommen, ich musste ihn neu starten.

    Für sudo ist dein Passwort: fablab-2027
    Meine Notizen stehen in notes_docker.txt.“
update-notes-docker =
    YASMINES NOTIZEN — DOCKER

      sudo docker ps -a                    die Container (auch gestoppte)
      sudo docker logs werkzeugschuppen    was die App zu sagen hat
      curl http://localhost:8080           die App, wie im Browser

    „Einen Container aktualisieren“: Man aktualisiert ihn nicht, man
    ersetzt ihn durch einen neuen, aus dem neuen Image erstellt. Der Rest
    steht in man docker (und die Doku des Werkzeugschuppens sagt, dass er
    seine Datenbank in /var/lib/werkzeugschuppen ablegt).
update-tools = Bohrmaschine, Stichsäge, Schleifmaschine, Trittleiter, Akkuschrauber, Lötkolben, Laser-Wasserwaage, Tacker, Tapetenablöser, Rasenmäher, Nähmaschine, Kreissäge
update-people = Aya, Bilal, Chloé, Dmitri, Esra, Farid, Gaëlle, Hugo, Ines, Jun, Kenza, Lucas

## Die App (Seiten)

update-app-welcome =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Werkzeugverleih des FabLabs</title></head>
    <body>
    <h1>Werkzeugverleih des FabLabs</h1>
    <p>{ $loans ->
        [0] Keine laufenden Ausleihen.
        [one] Eine laufende Ausleihe.
       *[other] { $loans } laufende Ausleihen.
    } <a href="/ausleihen">Die Ausleihen ansehen</a></p>
    <footer>werkzeugschuppen { $version }</footer>
    </body>
    </html>
update-app-loans = Laufende Ausleihen: { $loans } (die ersten fünf)

## Ereignisse

update-event-layer =
    "Mounts": []: Dieser Container hat kein Volume und kein eingehängtes
    Verzeichnis der Maschine. Alles, was die App schreibt (ihre Datenbank
    eingeschlossen), lebt in der Schicht des Containers, die mit ihm
    verschwindet. Bevor du ihn löschst, musst du die Datenbank in
    Sicherheit bringen (man docker: cp).
update-event-port-busy =
    „port is already allocated“: Port 8080 der Maschine ist schon von
    einem anderen laufenden Container veröffentlicht (dem alten). Zwei
    Container können nicht auf demselben Port der Maschine lauschen: Du
    musst zuerst den alten stoppen.
update-event-lost =
    Die 37 Ausleihen sind weg: Der Container wurde mitsamt seiner Schicht
    gelöscht, und die Datenbank war nirgendwohin kopiert worden. Auf einem
    echten Server wäre sie für immer verloren. Hier kannst du das Kapitel
    über das Menü neu starten. Die Regel: Die Daten eines Containers
    gehören in ein Volume, und man kopiert sie vor jedem riskanten Eingriff.
update-event-new-empty =
    Version 1.5 läuft… mit einer nagelneuen, leeren Datenbank (docker logs
    sagt es: „creating a new one“). Die Datenbank des alten Containers ist
    nicht im neuen. Wenn du sie in Sicherheit gebracht hast, musst du sie
    noch an ihren Platz zurücklegen (und die App neu starten, damit sie
    sie migriert).
update-event-without-reboot =
    Die 37 Ausleihen sind da, in Version 1.5, und die Datenbank liegt
    endlich in einem Volume. Aber Yasmine hat es gesagt: Nach einem
    Stromausfall kommt der Werkzeugschuppen nicht von selbst zurück. Schau
    dir die Option --restart von docker run an (oder docker update).
update-event-end =
    Werkzeugschuppen 1.5 läuft, mit seinen 37 Ausleihen, in einem Volume,
    das die nächsten Updates überstehen wird, und er startet nach einem
    Stromausfall von selbst wieder. Yasmine: „Und das nächste Update heißt
    einfach: neuer Container, selbes Volume!“

    Gut gemacht! Du hast Kapitel 1 von „Die Werkstatt“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: Die Komposition.)

    WAS PASSIERT IST
    Der Werkzeugschuppen war ohne Volume gestartet worden: Seine Datenbank
    lebte in der Schicht des Containers. Eine App in Docker zu
    aktualisieren heißt, den Container zu löschen und einen neuen zu
    erstellen; ohne Vorsichtsmaßnahmen ging die Datenbank mit dem alten.

    GUTE PRAXIS
    - Vor allem anderen: docker inspect (die „Mounts“), um zu wissen, wo
      die Daten liegen.
    - Die Daten eines Containers gehören in ein Volume (-v name:/pfad) oder
      ein Verzeichnis der Maschine (-v /srv/app:/pfad), nie in seine Schicht.
    - Kopieren, bevor man etwas anfasst: docker cp container:/pfad ./sicherung.
    - Den alten stoppen, bevor man den neuen auf demselben Port startet;
      ihn erst löschen, wenn der neue geprüft ist (docker logs, curl).
    - --restart unless-stopped: Der Container startet mit der Maschine wieder.
    - Die Gruppe docker ist so viel wert wie root: Nur Admins gehören hinein.

    DOKUMENTATION
    - Volumes: https://docs.docker.com/engine/storage/volumes/
    - docker cp: https://docs.docker.com/reference/cli/docker/container/cp/
    - Start containers automatically: https://docs.docker.com/engine/containers/start-containers-automatically/
