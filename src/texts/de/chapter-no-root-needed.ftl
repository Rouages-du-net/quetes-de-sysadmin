### Geschichte „Der Wanderverein“, Kapitel „Ganz ohne root“: eine Web-App,
### die von Docker als root zu rootless Podman unter einem Dienstkonto
### umzieht: untergeordnete IDs (/etc/subuid, /etc/subgid), unprivilegierte
### Ports, der Besitzer der Daten durch den User-Namespace gesehen (:U,
### --userns=keep-id, podman unshare). Befehle, Optionen, Pfade und Ausgaben
### werden nicht übersetzt.

chapter-no-root-needed = Ganz ohne root
    .summary = Die Anmelde-App eines Wandervereins lief in einem Docker-Container, als root, seit ein Ehrenamtlicher sie eingerichtet hat. Zieh sie auf rootless Podman unter einem eigenen Konto um, mit den Daten des Vereins unversehrt und der Website weiter hinter nginx.

## Files

# { $you }: the player's account on the machine ("you").
no-root-needed-message-soo-ah =
    Von: Soo-ah (Vorsitz, Wanderverein Open Paths)
    Montag, 12. April, 09:20

    Hallo, und danke, dass du zum Helfen kommst!

    Unsere Anmeldeseite, https://walks.openpaths.example, ist seit heute
    Morgen down, und zwar mit Absicht: Ich habe Docker angehalten.

    Bolat hat die Website 2031 eingerichtet: Trailbook (die App, die unsere
    Wanderungen auflistet und die Anmeldungen entgegennimmt) läuft in einem
    Container, hinter nginx. Letzte Woche hat sich eine Freundin, die
    beruflich IT-Sicherheit macht, zaunstieg mit uns angesehen. Ihr Urteil:
    Der Docker-Daemon läuft als root, wer in der Gruppe docker ist, ist root
    auf der Maschine, und eine App, mit der den ganzen Tag Fremde reden,
    sollte nichts mit root zu tun haben. „Lass sie rootless laufen, unter
    einem eigenen Konto.“

    Ayasha hat das Konto schon angelegt, trailbook (sudo useradd --system
    --create-home --home-dir /var/lib/trailbook --shell /bin/bash
    trailbook), und das podman von Debian installiert. Sie musste zur
    Arbeit, bevor sie weitermachen konnte.

    Was wir vor den Anmeldungen am Samstag brauchen:
      - Trailbook läuft wieder mit rootless Podman, als trailbook;
      - die Website antwortet über nginx, wie vorher;
      - unsere Daten bleiben erhalten: /srv/trailbook/data/trailbook.db (412
        Wanderungen, 1873 Anmeldungen seit 2031).

    Bolats Notizen liegen in deinem Home-Verzeichnis. Dein sudo-Passwort:
    serpentine-27.

    Soo-ah

no-root-needed-notes-bolat =
    Notizen von Bolat (zaunstieg, 2031)

    - Trailbook ist ein einziges Image:
      registry.example/openpaths/trailbook:2.3. Es bewahrt alles in einer
      SQLite-Datei auf, /data/trailbook.db, und lauscht im Container auf
      8080.
    - Ich habe es so gestartet, einmal (es startet von selbst neu):
        sudo docker run -d --name trailbook --restart=always -p 8080:8080 -v /srv/trailbook/data:/data registry.example/openpaths/trailbook:2.3
    - nginx (/etc/nginx/sites-enabled/walks) nimmt 80 und 443 und reicht
      alles an 127.0.0.1:8080 weiter.
    - Das Image läuft nicht als root: Es hat einen eigenen Benutzer,
      trailbook, UID 1000 im Image. Komische Sache: Auf der Maschine gehören
      die Dateien in /srv/trailbook/data { $you }. Ich habe nie verstanden,
      warum.

## Events

no-root-needed-event-single-mapping =
    podman hat in /etc/subuid (oder /etc/subgid) keine untergeordneten IDs
    für trailbook gefunden. Ohne sie enthält der User-Namespace, den es
    baut, eine einzige ID: trailbook selbst, das darin root ist. Aber ein
    Image ist ein Baum von Dateien, die vielen IDs gehören (hier gehört
    /etc/gshadow der Gruppe shadow, 42), und keine davon kann in einem
    Namespace mit einer einzigen ID existieren.

    Konten, die adduser oder useradd anlegt, bekommen einen Bereich von
    65536 untergeordneten IDs; Systemkonten (useradd --system) nicht. Schau
    dir /etc/subuid und /etc/subgid an, dann man subuid und man usermod.
no-root-needed-event-overlap =
    Der Bereich von trailbook überschneidet sich in /etc/subuid oder
    /etc/subgid mit dem eines anderen Kontos. Zwei Konten, deren Container
    sich Host-IDs teilen, können gegenseitig ihre Dateien lesen und
    schreiben: Jeder Bereich muss für sich sein. Nimm den ersten freien
    Block nach dem letzten Bereich der Datei.
no-root-needed-event-ranges =
    trailbook hat jetzt einen eigenen Bereich untergeordneter UIDs und GIDs:
    In seinem Namespace ist 0 trailbook, und 1 bis 65536 sind der Bereich,
    den du ihm gegeben hast. Podman behält einen Namespace pro Konto (seinen
    Pause-Prozess), gebaut, bevor du die Dateien geändert hast: Wenn es sich
    noch beschwert, sagt seine Fehlermeldung, was auszuführen ist.
no-root-needed-event-stale-namespace =
    /etc/subuid und /etc/subgid stimmen, und doch sieht podman immer noch
    eine einzige ID: Der Namespace von trailbook wurde vorher gebaut, und
    podman behält ihn, bis man ihm sagt, dass sich die Konfiguration
    geändert hat. Lies das Ende der Fehlermeldung (und man
    podman-system-migrate).
no-root-needed-event-pulled =
    Das Image liegt im eigenen Speicher von trailbook, unter
    /var/lib/trailbook/.local/share/containers. Das podman von root sieht es
    nicht, und die Container von trailbook sehen die von root nicht:
    Vergleiche podman images als trailbook und mit sudo.
no-root-needed-event-sudo-podman =
    sudo podman führt Podman als root aus: rootful, mit den Images und
    Containern von root, ohne User-Namespace, und die Prozesse des
    Containers sind wieder die IDs des Hosts; root ist zurück, genau das,
    was wir verlassen. Rootless heißt, podman als trailbook selbst
    auszuführen (sudo -iu trailbook, oder sudo -u trailbook podman …).
    Entferne, was root gestartet hat (sudo podman rm -f NAME).
no-root-needed-event-port-80 =
    Ein gewöhnlicher Prozess kann nicht auf einem Port unterhalb von
    net.ipv4.ip_unprivileged_port_start (standardmäßig 1024) lauschen, und
    pasta, das die Ports der Container von trailbook veröffentlicht, ist
    einer. Und 80 ist sowieso belegt: nginx lauscht auf 80 und 443 und
    reicht die Website schon an 127.0.0.1:8080 weiter
    (/etc/nginx/sites-enabled/walks).

    Veröffentliche den Container auf 8080, auf 127.0.0.1, wenn nur nginx ihn
    braucht, und überlass die Eingangstür nginx. Ein Container, der nicht
    starten konnte, ist unter seinem Namen noch da (podman ps -a).
no-root-needed-event-lowered =
    net.ipv4.ip_unprivileged_port_start ist jetzt unter 1024 (oder wird es
    beim nächsten Booten sein, aus /etc/sysctl.d). Das ist keine Einstellung
    für ein Konto: Jedes Programm jedes Benutzers darf dann 22, 80 oder 443
    nehmen. Wenn sshd oder nginx eine Minute anhält, kann der Prozess von
    irgendjemandem an ihrer Stelle antworten. Der Reverse Proxy, den du
    schon hast, ist die sicherere Tür: Setz den Wert zurück auf 1024
    (sysctl -w, und entferne die Datei, die du hinzugefügt hast).
no-root-needed-event-chown-refused =
    :U bittet podman, das Verzeichnis dem Benutzer des Containers zu geben,
    aber podman tut es aus dem Namespace von trailbook heraus, als root des
    Namespace: Es kann nur Dateien ändern, deren Besitzer der Namespace
    abbildet (trailbook und seine untergeordneten IDs). Diese Dateien
    gehören auf dem Host jemand anderem. Wem (ls -ln /srv/trailbook/data)?
    root kann sie zuerst trailbook geben.
no-root-needed-event-cant-write =
    Die App ist sofort stehen geblieben: „unable to open database file:
    permission denied“. Drinnen läuft Trailbook als UID 1000, der USER des
    Images. Im Namespace von trailbook ist diese UID nicht die 1000 des
    Hosts: Die 1 des Namespace ist die erste ID des Bereichs, also ist seine
    1000 die erste ID + 999. Auf dem Host gehören die Daten UID 1000, weil
    unter Docker (ohne User-Namespace) die 1000 des Containers die 1000 des
    Hosts WAR.

    Vergleiche podman unshare cat /proc/self/uid_map, podman unshare ls -ln
    /srv/trailbook/data und ls -ln /srv/trailbook/data. Dann lass die
    richtige ID das Verzeichnis besitzen: die Volume-Option U und
    --userns=keep-id in man podman-run, oder podman unshare chown.
no-root-needed-event-world-writable =
    chmod 777 (oder o+w) auf den Daten lässt den Container schreiben, und
    auch jedes Konto auf zaunstieg und jeden anderen Container: 1873
    Anmeldungen, mit Namen und Telefonnummern, offen für alle, die eine
    Shell bekommen. Setz die Rechte zurück (755 für das Verzeichnis, 644 für
    die Datei) und korrigiere stattdessen den Besitzer.
no-root-needed-event-empty =
    Trailbook läuft, aber auf einer leeren Datenbank („database created …
    walks=0“): In diesem Container ist /data nicht /srv/trailbook/data (ein
    benanntes Volume, ein anderer Pfad, oder gar kein -v). Die 412
    Wanderungen des Vereins sind noch in /srv/trailbook/data: Entferne
    diesen Container und starte einen mit diesem Verzeichnis eingehängt.
no-root-needed-event-running =
    Trailbook läuft rootless unter trailbook, auf den Daten des Vereins. ps
    aux zeigt seinen Prozess unter einer großen UID: nicht root, und nicht
    du. Prüf die Website über nginx (curl -k
    https://walks.openpaths.example/), und dass nichts zurückgeblieben ist.
no-root-needed-event-end =
    Soo-ah: „Die Anmeldungen sind wieder offen. Und unsere Freundin aus der
    IT-Sicherheit sagt: viel besser.“

    Gut gemacht! Du hast „Ganz ohne root“ abgeschlossen.

    WAS PASSIERT IST
    Trailbook lief unter Docker: ein Daemon als root, und ein Container,
    dessen UID 1000 die UID 1000 des Hosts war (darum gehörten dir die
    Daten). Du hast es auf rootless Podman unter trailbook umgezogen. Ein
    Systemkonto hat keine untergeordneten IDs, also konnte podman nur
    trailbook selbst abbilden, und die Dateien des Images (darunter Gruppe
    42) ließen sich nicht entpacken; sobald das Konto einen eigenen Bereich
    hatte und podman system migrate seinen Namespace neu gebaut hatte, kam
    das Image herein. Port 80 gehört nginx, und ist für einen gewöhnlichen
    Prozess unerreichbar: Der Container veröffentlicht 8080, und nginx
    bleibt davor. Die UID 1000 der App drinnen ist draußen eine
    untergeordnete ID: Die Daten mussten dieser ID gehören (:U, oder podman
    unshare chown), oder die eigene UID des Kontos musste in den Container
    abgebildet werden (--userns=keep-id).

    GUTE PRAXIS
    - Ein unprivilegiertes Konto pro Dienst, mit einem eigenen Bereich
      untergeordneter IDs (usermod --add-subuids, --add-subgids), nie
      geteilt.
    - Lies die Abbildung, bevor du Rechte anfasst: podman unshare cat
      /proc/self/uid_map, podman unshare ls -ln, podman top CONTAINER user
      huser.
    - Korrigiere Besitzer, nicht Rechte: chmod 777 öffnet die Daten für
      alle.
    - Überlass die privilegierten Ports einem Reverse Proxy; senke
      net.ipv4.ip_unprivileged_port_start nicht für eine App.
    - :Z kennzeichnet Dateien für SELinux neu. Auf Debian (AppArmor) ändert
      es nichts, und nie die Besitzer.

    EIN ANDERER WEG
    --userns=keep-id bildet die eigene UID von trailbook in den Container
    ab: Auf dem Host bleiben die Dateien bei trailbook, leichter zu sichern
    und zu lesen. Die App läuft dann drinnen mit der UID von trailbook; ein
    Image, das seinen eigenen USER erwartet, braucht vielleicht
    keep-id:uid=1000,gid=1000.

    DOKUMENTATION
    - podman-run(1): https://docs.podman.io/en/v5.4.2/markdown/podman-run.1.html
    - podman-unshare(1): https://docs.podman.io/en/v5.4.2/markdown/podman-unshare.1.html
    - Grundeinrichtung von rootless Podman: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
    - subuid(5): https://man7.org/linux/man-pages/man5/subuid.5.html

## What the story's chapters share: kept here so that they load with the story.

walking-club-readme =
    Die Daten von Trailbook (Open Paths).
    trailbook.db: die Wanderungen, die Wandernden und die Anmeldungen. Jede
    Nacht auf Bolats NAS kopiert.
# The page Trailbook serves (curl shows it as is): { $walks } and { $signups } are numbers.
walking-club-page =
    <!doctype html>
    <html lang="de">
    <title>Open Paths: die nächsten Wanderungen</title>
    <h1>Open Paths: die nächsten Wanderungen</h1>
    <p>{ $walks } Wanderungen, { $signups } Anmeldungen.</p>
    <p>Samstag: die Gratrunde, 14 km, Treffpunkt 08:30 am Bahnhof.</p>
    </html>
