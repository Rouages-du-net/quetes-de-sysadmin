### Geschichte „Die Werkstatt“, Kapitel 4 „Alle Macht“: keinen Container
### als root laufen lassen. Befehle, Pfade, Optionen und Meldungen von
### docker, chown, ls und ps werden nie übersetzt.

chapter-full-powers = Alle Macht
    .summary = Die Fotogalerie des FabLabs läuft als root: --user, die zwischen Container und Maschine geteilte uid, und das Verzeichnis, das dem richtigen Konto gehören muss.

## Dateien

full-powers-message-yasmine =
    Eine Nachricht von Yasmine:

    „Hallo! Kennst du die Fotogalerie des FabLabs (Port 8082)? Die
    Besucher laden dort Fotos ihrer Projekte hoch. Ich habe sie mit
    docker compose gestartet, in /srv/galerie.

    Zwei Probleme. Erstens: Ich kann in /srv/galerie/photos keine Fotos
    mehr ohne sudo hinzufügen oder entfernen, ‚Permission denied‘. Dabei
    ist es unser Verzeichnis! Zweitens: Rania sagt, die Galerie ‚läuft als
    root‘, und das sei gefährlich (ihre Notiz liegt neben dieser Nachricht).

    Was ich mir wünsche:
      - dass die Galerie nicht mehr als root läuft;
      - dass ich die Fotos selbst verwalten kann (ich bin yasmine, uid 1001);
      - und vor allem, dass keines der 14 Fotos verloren geht!

    Für sudo: fablab-2027.“
full-powers-word-rania =
    Eine Notiz von Rania:

    „Die Galerie empfängt Dateien, die Fremde hochladen: Genau diese Art
    Programm wird angegriffen. Findet jemand eine Lücke darin, läuft
    dessen Code mit den Rechten der Galerie.

    Und ein Container ist keine eigene Maschine: Seine Prozesse laufen auf
    dem Kernel der Maschine. root im Container ist dieselbe uid 0 wie root
    auf der Maschine, und alles, was in den Container eingehängt ist, ist
    ihm ausgeliefert.

    Schau zuerst nach, wer du bist, drinnen und draußen:
      sudo docker exec galerie-galerie-1 id
      ps aux
    Dann das Handbuch: man docker und man docker-compose.“
full-powers-readme =
    Galerie 3.2 — LIESMICH (mitgeliefert mit dem Image registry.example/galerie)

    Die Fotos liegen in /app/photos: Häng dort ein Verzeichnis oder ein
    Volume ein. Beim Start baut die Galerie ihren Vorschaubild-Index in
    /app/photos/.vorschaubilder neu auf: Sie muss in /app/photos schreiben
    können.

    Das Image basiert auf node:22 und wählt keinen Benutzer.
    Es funktioniert unter jeder uid, solange es in /app/photos schreiben
    kann.

# { $count }: die Zahl der Fotos
full-powers-gallery-welcome = { $count ->
        [one] Galerie des FabLabs: ein Projektfoto. Schick deins!
       *[other] Galerie des FabLabs: { $count } Projektfotos. Schick deins!
    }

## Ereignisse

full-powers-event-root =
    Die Galerie läuft als root: uid=0 im Container, und root in ps aux auf
    der Maschine, wie sshd. Ihr Image legt keinen Benutzer fest (kein
    USER), und compose.yaml auch nicht: Standardmäßig läuft ein Container
    also als root. Und ohne User-Namespace (userns-remap, standardmäßig
    deaktiviert) IST die uid 0 des Containers die uid 0 der Maschine.
    Deshalb gehören auch die Dateien in /srv/galerie/photos root. Such
    nach --user in man docker, und nach user: in man docker-compose.
full-powers-event-unknown =
    „unable to find user“: Ein Name für --user (oder user:) muss in der
    /etc/passwd des IMAGES existieren, nicht der Maschine. Mit Zahlen
    (uid:gid) gibt es kein Problem mehr: Der Kernel kennt nur Zahlen.
full-powers-event-eacces =
    Die Galerie startet nicht mehr: EACCES, Zugriff verweigert (sudo docker
    logs, oder docker compose logs). Sie läuft nicht mehr als root, also
    gelten für sie die Unix-Rechte der Maschine, nach Zahl: uid und gid.
    Aber /srv/galerie/photos und sein Inhalt gehören noch root. Schau dir
    ls -lan /srv/galerie/photos an (-n: die Zahlen, -a: auch versteckte
    Dateien). Docker startet sie von selbst neu (restart:
    unless-stopped): Sie kommt zurück, sobald sie schreiben kann.
full-powers-event-uid-1000 =
    Die Galerie läuft unter uid 1000… und auf dieser Maschine ist uid 1000
    du (dein Konto, du)! In ls -l gehören ihre Dateien dir: Der Kernel
    sieht nur Zahlen, und jede /etc/passwd gibt ihnen ihren eigenen Namen
    (node im Image, du auf der Maschine). Yasmine (uid 1001) kann aber
    immer noch nicht in das Fotoverzeichnis schreiben.
full-powers-event-open-to-all =
    Ein Verzeichnis, in das alle schreiben dürfen (chmod 777, o+w): Es
    „funktioniert“, aber dann kann jedes Konto, jedes Programm auf der
    Maschine dort Dateien ablegen oder löschen. Gib das Verzeichnis
    stattdessen dem richtigen Besitzer (chown), ohne die Rechte der
    anderen zu öffnen.
# { $count }: die Zahl der fehlenden Fotos
full-powers-event-photos-lost =
    { $count ->
        [one] Ein Foto ist aus /srv/galerie/photos verschwunden. Auf einem echten Server wäre es ohne Backup verloren.
       *[other] { $count } Fotos sind aus /srv/galerie/photos verschwunden. Auf einem echten Server wären sie ohne Backup verloren.
    } Hier kannst du das Kapitel über das Menü neu starten.
full-powers-event-end =
    Die Galerie läuft unter einem gewöhnlichen Konto, Yasmine verwaltet die
    Fotos ohne sudo, und alle 14 Fotos sind da. Rania: „Wenn jemand in die
    Galerie einbricht, bekommt er nur die Rechte eines gewöhnlichen
    Kontos. Nicht die von root.“

    Gut gemacht! Du hast Kapitel 4 von „Die Werkstatt“ abgeschlossen, und
    die ganze Geschichte.

    WAS PASSIERT IST
    Das Image der Galerie legt keinen Benutzer fest: Ohne --user (oder
    user:) läuft ein Container als root. Ein Container teilt den Kernel der
    Maschine; ohne User-Namespace ist seine uid 0 die uid 0 der Maschine.
    Die Dateien, die er in ein eingehängtes Verzeichnis schreibt, gehören
    root, und eine Lücke in der App gäbe root-Rechte über alles, was
    eingehängt ist. Unter einer gewöhnlichen uid unterliegt die Galerie
    den Unix-Rechten wie jedes andere Programm: Du musstest ihr ihr
    Verzeichnis geben (chown -R).

    GUTE PRAXIS
    - Prüfen: docker exec container id, und ps aux auf der Maschine.
    - Eine gewöhnliche uid für jeden Container: USER im Dockerfile, sonst
      --user uid:gid oder user: "uid:gid".
    - Lieber Zahlen als Namen: Ein Name muss im Image existieren.
    - Die eingehängten Verzeichnisse dieser uid geben (chown -R), nie chmod 777.
    - Entfernen, was nicht gebraucht wird: --cap-drop ALL, --security-opt
      no-new-privileges, --read-only.
    - Nie --privileged, und nie /var/run/docker.sock in einem exponierten
      Container eingehängt: Das ist root auf der Maschine. Die Gruppe
      docker auch.
    - Weiter gehen: userns-remap, oder Docker im Rootless-Modus.

    DOKUMENTATION
    - docker run --user: https://docs.docker.com/reference/cli/docker/container/run/#user
    - user: in Compose: https://docs.docker.com/reference/compose-file/services/#user
    - Docker-Sicherheit: https://docs.docker.com/engine/security/
    - userns-remap: https://docs.docker.com/engine/security/userns-remap/
    - Rootless Docker: https://docs.docker.com/engine/security/rootless/
