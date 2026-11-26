### Geschichte „Die Kantine“, Kapitel 4 „Die verspätete Platte“: ein
### Einhängen, das nach dem Dienst kommt, der es braucht
### (RequiresMountsFor=, nofail, was ein Einhängepunkt verdeckt).
### Unit-Namen, Pfade und die Meldungen von systemd werden nicht übersetzt.

chapter-late-disk = Die verspätete Platte
    .summary = Die Reservierungen von heute Morgen sind von der USB-Platte der Kantine verschwunden. Sie sind nicht verloren: Sie sind versteckt. Finde sie, und lass die App auf ihre Platte warten.

## Dateien

late-disk-message-ibrahim =
    Von:     Ibrahim
    An:      dich
    Betreff: Die Reservierungen von heute Morgen sind weg!

    Hallo,

    Katastrophe: Die Küche öffnet die Liste von heute (die App schreibt
    sie nach /srv/data/bookings/, eine Datei pro Tag), und die
    Reservierungen von heute Morgen sind nicht da. Die Leute haben
    zwischen 6:30 und 9:00 reserviert, ich habe sie in der App gesehen,
    und die Datei des Tages existiert nicht einmal auf der Platte.

    /srv/data ist unsere alte USB-Platte (in /etc/fstab, mit nofail seit
    dem Tag, an dem sie abgesteckt war und der Server nicht booten wollte,
    erinnerst du dich, „Das Labor“). Heute früh gab es einen Neustart, für
    die Updates.

    Kannst du die Reservierungen von heute Morgen finden und sie wieder
    auf die Platte legen? Und dafür sorgen, dass es beim nächsten Neustart
    nicht wieder passiert. Passwort linsen-2028.

    Ibrahim

late-disk-header = uhrzeit;name;personen
late-disk-bookings =
    06:41;Amadou;2
    06:58;Claire;1
    07:12;Rui;4
    07:30;Mei;2
    07:52;Youssef;3
    08:05;Hanna;1
    08:17;Kwame;2
    08:33;Lucia;5
    08:46;Tomasz;1
    08:59;Nadia;2
late-disk-old-bookings =
    10:02;Amadou;2
    10:45;Rui;3
    11:10;Hanna;1

## Ereignisse

late-disk-event-hidden =
    Da ist sie: die Liste von heute, mit den Reservierungen von heute
    Morgen. Sie lag genau dort, in /srv/data… aber auf der Systemplatte,
    in dem Verzeichnis, in das die USB-Platte eingehängt wird. Ein
    Einhängen verdeckt, was das Verzeichnis enthielt (es ist noch da,
    unberührt); ausgehängt wird es wieder sichtbar. Bring sie in
    Sicherheit, und leg sie dann auf die USB-Platte.
late-disk-event-order =
    „Mounted srv-data.mount“: Die USB-Platte kam etwa 25 Sekunden nach
    Beginn des Bootvorgangs, und die App war lange vorher gestartet. Mit
    nofail wartet nichts auf dieses Einhängen. Wohin hat die App die Liste
    von heute Morgen dann geschrieben? (findmnt, und was enthält /srv/data
    ohne seine Platte?)
late-disk-event-recovered =
    Die Reservierungen von heute Morgen sind wieder auf der USB-Platte: Die
    Küche hat ihre Liste. Jetzt die Ursache: Beim nächsten Neustart startet
    die App wieder vor der Platte. Sag systemd, dass sie /srv/data braucht
    (man systemd.unit: RequiresMountsFor=), und starte dann zum Prüfen neu.
late-disk-event-no-nofail =
    Ohne nofail wartet der ganze Bootvorgang auf die USB-Platte: Die App
    startet tatsächlich danach. Aber an dem Tag, an dem die Platte fehlt,
    bleibt der Server im Notfallmodus stehen, wie schon einmal.
    RequiresMountsFor= nur an der App hätte den Server weiter booten
    lassen.
late-disk-event-end =
    Nach dem Neustart wurde zuerst die USB-Platte eingehängt, dann startete
    die App und schrieb darauf. Ibrahim: „Und die Reservierungen von heute
    Morgen sind da. Die Küche kann servieren!“

    Gut gemacht! Du hast das Kapitel „Die verspätete Platte“ abgeschlossen.

    WAS PASSIERT IST
    Die USB-Platte braucht beim Booten etwa 25 Sekunden, bis sie
    erscheint. Ihre fstab-Zeile hat nofail (damit der Server auch ohne sie
    bootet), und mit nofail wartet nichts auf das Einhängen. Die App
    startete zuerst und schrieb die Liste von heute nach /srv/data… in das
    leere Verzeichnis der Systemplatte. Als die USB-Platte darüber
    eingehängt wurde, verdeckte sie diese Datei: Für alle war die Liste
    verschwunden. Sie war nur versteckt.

    WAS EIN EINHÄNGEPUNKT VERDECKT
    - Eine Platte in ein Verzeichnis einzuhängen verdeckt dessen Inhalt,
      ohne ihn zu löschen; Aushängen zeigt ihn wieder.
    - Um nachzusehen, ohne auszuhängen: Häng die Systemplatte woanders ein
      (mount --bind / /mnt/root) und schau in /mnt/root/srv/data nach.
    - Eine klassische Falle: ein Dienst, der schreibt, bevor seine Platte
      da ist, oder ein Backup, das die Systemplatte füllt, während die
      Backup-Platte fehlt.

    DIE LÖSUNG
    - RequiresMountsFor=/srv/data im [Unit] der App: Die App verlangt das
      Einhängen von /srv/data und startet danach. Fehlt die Platte, startet
      die App nicht (besser, als an die falsche Stelle zu schreiben), und
      der Server bootet trotzdem.
    - nofail behalten für eine Platte, die fehlen darf; ohne nofail wartet
      der ganze Bootvorgang, und er bleibt im Notfallmodus stehen, wenn die
      Platte nicht da ist.

    DOKUMENTATION
    - RequiresMountsFor=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#RequiresMountsFor=
    - nofail und das Einhängen beim Booten: https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - mount, umount: https://man7.org/linux/man-pages/man8/mount.8.html
