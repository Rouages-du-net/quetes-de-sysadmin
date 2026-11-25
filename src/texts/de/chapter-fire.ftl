### Geschichte „Das Rechenzentrum“, Kapitel 4 „Der große Brand“: einen
### Server aus den Backups neu aufbauen. Befehle, Pfade, Dateinamen und die
### Meldungen von apt, nginx und tar werden nicht übersetzt. Die HTML-Seiten
### der Website (fire-site-*) gehören der Mediathek: Sie werden übersetzt.

chapter-fire = Der große Brand
    .summary = Das Rechenzentrum ist abgebrannt: mit den Backups, apt, tar und nginx -t von einer leeren Maschine neu anfangen.

## Dateien

fire-email-awa =
    Von:     Awa (Leiterin des Betriebs)
    An:      dich
    Betreff: Brand im Rechenzentrum: Wir bauen neu auf

    Letzte Nacht gegen 0:47 Uhr ist im Rechenzentrum unseres Hosters ein
    Feuer ausgebrochen. Niemand wurde verletzt. Aber der Raum unseres
    Servers ist abgebrannt: der Server, seine Platten und alles, was darauf war.

    Heute Morgen hat der Hoster eine nagelneue Maschine geliefert: ein
    blitzsauberes Debian, mit demselben Namen und derselben IP-Adresse
    (sie haben sie auf die neue Maschine umgezogen). Dein Konto ist da,
    mit deinem üblichen Passwort (willkommen-2026). Sonst nichts: kein
    nginx, keine Website.

    Zum Glück gehen unsere Backups jede Nacht in ein anderes
    Rechenzentrum, in einer anderen Stadt. Der Hoster hat sie unter
    /mnt/sicherung eingehängt. Mein Notfallplan liegt auch dort: NFP.txt.

    Ich bin vor Ort bei der Feuerwehr. Bring die Website der Mediathek
    wieder online, und sag mir, was wir verloren haben.
fire-drp =
    NOTFALLPLAN (NFP) — WEBSITE DER MEDIATHEK
    Zu befolgen, wenn der Server verloren ist: Wir fangen auf einer neuen
    Maschine neu an.

    Jede Nacht um 0:30 Uhr gesichert, in einem anderen Rechenzentrum:
      /etc/nginx/sites-available/medialibrary   die Website, für nginx
      /etc/nginx/sites-enabled/medialibrary     dieselbe, aktiviert
      /etc/nginx/blocked.conf                  die gesperrten Adressen
      /var/www/medialibrary/                    die Seiten

    Ein Archiv pro Nacht: /mnt/sicherung/medialibrary-JJJJ-MM-TT.tar.gz

    Die Pfade sind darin ab der Wurzel gespeichert, ohne das / am Anfang.

    1. nginx installieren (Debian-Paket).
    2. Das Archiv VOR dem Entpacken prüfen: es vollständig auflisten.
    3. Es an seinem Platz entpacken, ab der Wurzel.
    4. Die Konfiguration von nginx prüfen, dann neu laden.
    5. Mit curl testen und die Website über ihren Namen anfordern.

    Die Einzelheiten jedes Befehls stehen in seinem Handbuch (man apt,
    man tar, man nginx, man curl).

## Die Website der Mediathek (wiederhergestellte Seiten)

fire-site-index-1 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Mediathek im Viertel</title></head>
    <body>
    <h1>Mediathek im Viertel</h1>
    <p>Geöffnet Dienstag bis Samstag, 10 bis 18 Uhr.</p>
    <p>Der Online-Katalog ist bald wieder da.</p>
    </body>
    </html>
fire-site-index-2 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Mediathek im Viertel</title></head>
    <body>
    <h1>Mediathek im Viertel</h1>
    <p>Geöffnet Dienstag bis Samstag, 10 bis 18 Uhr.</p>
    <p>Herbstferien: Sonderöffnung am Sonntag, 25. Oktober, 14 bis 17 Uhr.</p>
    <p>Der Online-Katalog ist bald wieder da.</p>
    </body>
    </html>
fire-site-index-3 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Mediathek im Viertel</title></head>
    <body>
    <h1>Mediathek im Viertel</h1>
    <p>Geöffnet Dienstag bis Samstag, 10 bis 18 Uhr.</p>
    <p>Herbstferien: Sonderöffnung am Sonntag, 25. Oktober, 14 bis 17 Uhr.</p>
    <p>Donnerstag, 29. Oktober, 18 Uhr: Begegnung mit einer Comicautorin.</p>
    <p>Der Online-Katalog ist bald wieder da.</p>
    </body>
    </html>
fire-site-hours =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Öffnungszeiten — Mediathek im Viertel</title></head>
    <body>
    <h1>Öffnungszeiten</h1>
    <p>Dienstag bis Samstag, 10 bis 18 Uhr. Sonntags und montags geschlossen.</p>
    </body>
    </html>

## Ereignisse

fire-event-list-empty =
    Eine neue Maschine kennt noch kein Paket: Ihre Liste der verfügbaren
    Pakete ist leer. Zuerst musst du sie aus den Debian-Repositorys
    herunterladen. Das Handbuch sagt dir, wie: man apt.
fire-event-nginx =
    nginx ist installiert, und es läuft schon: Unter Debian wird ein Dienst
    bei der Installation gestartet und aktiviert. Probier
    curl http://localhost: Das ist die Willkommensseite von nginx. Der
    Webserver ist da; die Website fehlt noch.
fire-event-truncated =
    „Unexpected EOF“: Das Archiv von letzter Nacht ist abgeschnitten. Das
    Backup begann um 0:30 Uhr; um 0:47 Uhr brach das Feuer aus, und die
    Übertragung brach mittendrin ab. Schau dir seine Größe mit ls -l an,
    neben den anderen.

    tar liest, was vor dem Schnitt steht, und hört dann auf: Entpackt
    würde dieses Archiv die Konfiguration zurückgeben, aber keine einzige Seite der Website. Ein Backup, das du nie zurückgelesen hast, ist nur eine Hoffnung. Nimm
    das neueste Archiv, das sich bis zum Ende lesen lässt.
fire-event-bad-place =
    Das Archiv wurde dort entpackt, wo du warst: in deinem Verzeichnis,
    nicht an der Stelle der verlorenen Dateien. nginx findet sie dort
    nicht. Lies noch einmal man tar: Eine Option lässt dich wählen, wohin
    entpackt wird. (Was hier entpackt wurde, kannst du löschen.)
fire-event-duplicate =
    nginx lehnt die Konfiguration ab: „a duplicate default server“. Zwei
    Websites wollen die Standard-Website auf Port 80 sein: die der
    Mediathek, aus dem Backup wiederhergestellt, und die, die Debian mit
    nginx installiert, in /etc/nginx/sites-enabled/. Auf dem alten Server
    gab es nur eine. Welche solltest du behalten? (man nginx, und nginx -t
    nach jeder Änderung.)

    Gute Nachricht: Solange die neue Konfiguration abgelehnt wird, behält
    nginx die alte. Der Server fällt nicht aus.
fire-event-wednesday =
    Die Website antwortet… mit der Seite von Mittwoch: Es fehlen die
    Öffnungszeiten in den Ferien, die Awa am Mittwochnachmittag ergänzt
    hat. Dieses Archiv ist nicht das neueste intakte.
fire-event-end =
    curl http://medialibrary.example antwortet: Die Mediathek ist wieder
    online, auf einer Maschine, die es letzte Nacht noch nicht gab.

    Awa: „Danke. Wir haben die Arbeit vom Donnerstag verloren: Die
    Ankündigung der Veranstaltung am nächsten Donnerstag war im Backup von
    letzter Nacht, dem, das der Brand abgeschnitten hat. Ich trage sie
    wieder ein. Alles andere ist da, weil die Backups WOANDERS waren.“

    Gut gemacht! Du hast Kapitel 4 von „Das Rechenzentrum“ abgeschlossen.
    (Ein letztes Kapitel wartet auf dich, drei Monate später: Das
    Zertifikat ist abgelaufen.)

    WAS PASSIERT IST
    Der Brand hat den Server und seine Platten zerstört. Was die Website
    gerettet hat: ein Backup jede Nacht, in einem anderen Rechenzentrum,
    und ein im Voraus geschriebener Notfallplan. Das neueste Archiv war
    allerdings mitten beim Schreiben abgeschnitten worden: Ohne tar -tzf
    hättest du eine halb leere Website wiederhergestellt.

    Das ist keine Fiktion. In der Nacht vom 9. auf den 10. März 2021 hat
    ein Brand ein Gebäude des Rechenzentrums von OVHcloud in Straßburg
    (SBG2) zerstört. Tausende Kunden waren betroffen, und manche haben
    alles verloren: Ihre Backups lagen am selben Standort wie ihre Server.

    GUTE PRAXIS
    - 3-2-1: drei Kopien, auf zwei Medien, eine davon weit weg (eine andere
      Stadt, nicht nur ein anderes Gebäude).
    - Den Notfallplan VOR dem Brand schreiben und ihn wirklich auf einer
      leeren Maschine ausprobieren.
    - Die Backups zurücklesen (tar -tzf) und ihre Größe überwachen: Ein
      abgeschnittenes Archiv sieht aus wie ein Archiv.
    - Im Voraus entscheiden, wie viel man zu verlieren bereit ist (hier
      ein Tag) und wie schnell man wieder laufen muss.
    - Ein SSH-Hostschlüssel, der sich ändert: den neuen Fingerabdruck auf
      einem anderen Weg prüfen, bevor man den alten entfernt
      (ssh-keygen -R).
    - sudo nginx -t vor jedem reload; nur ein default_server pro Port.

    DOKUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - nginx, die Kommandozeile: https://nginx.org/en/docs/switches.html
    - nginx, die Wahl der Website: https://nginx.org/en/docs/http/request_processing.html
    - GNU tar: https://www.gnu.org/software/tar/manual/
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
