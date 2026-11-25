### Geschichte „Bereitschaft“, Kapitel 2 „Der Speicher“: der OOM-Killer,
### ein Speicherleck, von systemd eingedämmt (MemoryMax=, Restart=),
### Zombie-Prozesse. Befehle, Optionen, Direktiven und Meldungen (free, top,
### dmesg, systemctl) werden nicht übersetzt.

chapter-memory = Der Speicher
    .summary = 4:31 Uhr morgens, der Livestream sendet nur noch Stille: Wer hat die Nacht-Playlist getötet, und wie verhinderst du, dass sie beim nächsten Mal alles mitreißt?

## Files

memory-message-zoe =
    Eine Nachricht von Zoé (4:25 Uhr):

    „Ich schon wieder… Seit 4:12 sendet der Livestream nur noch Stille. Das
    Relay läuft (systemctl status radio-stream), aber die automatische
    Nacht-Playlist (der Dienst radio-playlist) scheint tot zu sein. Ich habe
    nichts angefasst, versprochen.

    Noch etwas, vielleicht ohne Zusammenhang: In ps gibt es Prozesse, die
    als <defunct> markiert sind, „Zombies“ laut einem Forum. Ich habe kill
    -9 auf sie probiert: Sie sind immer noch da.“
memory-server-js =
    // Nachbarschaftsradio: die automatische Nacht-Playlist.
    const cache = new Map(); // bereits dekodierte Titel

    function decode(track) {"{"}
      if (!cache.has(track.id)) cache.set(track.id, read(track)); // TODO: den Cache irgendwann leeren
      return cache.get(track.id);
    {"}"}
memory-convert-py =
    # Nachbarschaftsradio: wandelt Sendungen in Podcasts um.
    import subprocess

    for show in new_shows():
        # Startet die Umwandlung... und wartet nie, bis sie fertig ist (kein wait()).
        subprocess.Popen(["convert", show])

## Events

memory-event-oom =
    „Out of memory“, „oom-kill“: Der Maschine ist der Speicher ausgegangen,
    und der Kernel hat einen Prozess ausgewählt, den er tötet, um zu
    überleben. Das ist der OOM-Killer (Out Of Memory): Er zielt auf den
    Prozess, der den meisten Speicher belegt. Seine Meldungen stehen im Log
    des Kernels: sudo dmesg (oder sudo journalctl -k). Wie viel Speicher ist
    noch übrig, und wer nimmt ihn? free -h und top.
memory-event-zombies =
    Zombies: Prozesse, die schon beendet sind, deren Elternprozess ihr
    Ergebnis aber noch nicht gelesen hat (der Systemaufruf wait). Sie
    belegen fast nichts, aber sie verraten einen Elternprozess, der seine
    Arbeit nicht macht. Wer ist dieser Elternprozess? ps -ef zeigt die
    Spalte PPID.
memory-event-kill-zombie =
    kill bewirkt bei einem Zombie nichts: Er ist schon tot! Nur sein
    Elternprozess kann ihn verschwinden lassen… oder selbst verschwinden:
    Wenn der Elternprozess stirbt, adoptiert init (PID 1) die Zombies und
    räumt sie sofort weg. Den Eltern-Dienst neu zu starten reicht.
memory-event-grows =
    Beobachte die Playlist in top (oder top -o %MEM) von einem Befehl zum
    nächsten: Sie wächst immer weiter, jedes Mal um Dutzende Megabyte. Ein
    Speicherleck! Der Code liegt in /opt/playlist. Wenn nichts ihn
    aufhält, muss der Kernel wieder jemanden töten…
memory-event-still =
    Da haben wir es: kein Speicher mehr, der OOM-Killer hat wieder
    zugeschlagen (sudo dmesg). Neu starten reicht nicht, das Leck beginnt
    von vorn. Das Programm zu reparieren ist Sache der Entwickler·innen;
    heute Nacht muss es eingedämmt werden. systemd kann den Speicher eines
    Dienstes begrenzen (MemoryMax=, siehe man systemctl: edit,
    set-property) und ihn neu starten, wenn er stirbt (Restart=).
memory-event-too-down =
    Diese Grenze ist zu niedrig: Die Playlist braucht etwa 200 MB, nur um
    zu starten, sie würde fast sofort nach dem Start getötet. Gib ihr genug,
    um eine Weile zu laufen (ein paar hundert Megabyte), ohne die Maschine
    zu gefährden.
memory-event-too-up =
    Diese Grenze ist höher als das, was die Maschine bieten kann, ohne zu
    leiden (2 GB insgesamt, davon 1 GB von allem anderen belegt): Der Kernel
    würde vor systemd zuschlagen. Ziel eher auf ein paar hundert Megabyte.
memory-event-without-restart =
    systemd hat die Playlist getötet, als sie ihre Grenze überschritten hat,
    wie geplant: Die Maschine und das Relay haben nichts gespürt. Aber sie
    ist angehalten geblieben (systemctl status radio-playlist: Result:
    oom-kill). Damit systemd sie von selbst neu startet, musst du
    Restart=on-failure zum Abschnitt {"["}Service] des Overrides hinzufügen
    (sudo systemctl edit radio-playlist).
memory-event-contained =
    Die Playlist hat ihre Grenze erreicht: systemd hat sie getötet und
    sofort neu gestartet (systemctl status radio-playlist). Nur die Playlist
    hat gelitten, nicht die Maschine. Die Stille hat nur einen Moment
    gedauert.
memory-event-without-zombies =
    Keine Zombies mehr: Mit ihrem neu gestarteten Elternprozess hat init sie
    weggeräumt.
memory-event-end =
    Die Playlist läuft, von ihrer Grenze eingedämmt und neu gestartet, wenn
    sie sie überschreitet; die Zombies sind weg. Der Livestream hat seine
    Musik zurück. Zoé: „Ich mache ein Ticket wegen des Caches der Playlist
    auf. Danke!“

    Gut gemacht! Du hast Kapitel 2 von „Bereitschaft“ abgeschlossen. (Wie es
    weitergeht: ssh radio.)

    WAS PASSIERT IST
    Die Playlist hat jeden dekodierten Titel im Speicher behalten, ohne je
    etwas zu vergessen: ein Speicherleck. Um 4:12 Uhr war kein einziges Byte
    mehr frei, und der Kernel hat den größten Prozess getötet (der
    OOM-Killer). Hier war es der Schuldige, aber es hätte die Datenbank oder
    das Relay sein können. Eine Grenze pro Dienst (MemoryMax=) lässt nur den
    fehlerhaften Dienst für das Leck bezahlen, und Restart=on-failure
    startet ihn neu. Die Zombies kamen von einem anderen Programm, das nie
    auf seine Kindprozesse gewartet hat.

    GUTE PRAXIS
    - Ein Dienst, ohne erkennbaren Grund getötet: sudo dmesg oder
      journalctl -k (Out of memory), systemctl status (Result: oom-kill).
    - free -h für den Zustand des Speichers, top -o %MEM, um herauszufinden,
      wer ihn nimmt, und das über die Zeit verfolgen.
    - Eine Speichergrenze pro Dienst (MemoryMax=), mit automatischem
      Neustart (Restart=on-failure), solange das Leck repariert wird.
    - Ändere einen Dienst mit einem Override (systemctl edit), nie durch
      Anfassen der mitgelieferten Datei in /usr/lib/systemd.
    - Einen Zombie kann man nicht töten: Kümmere dich um seinen
      Elternprozess (und melde den Fehler).

    EIN ANDERER WEG
    Das Leck zu reparieren bleibt die echte Lösung: Die Grenze dämmt es nur
    ein. Andere Einstellungen von systemd: MemoryHigh= bremst den Dienst
    (der Kernel holt sich Speicher von ihm zurück), bevor es ans Töten geht;
    OOMScoreAdjust= sagt dem Kernel, wen er zuerst opfern soll;
    systemd-oomd hält einen Dienst an, bevor die ganze Maschine erstickt.

    DOKUMENTATION
    - MemoryMax=: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - Restart=: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
    - free: https://man7.org/linux/man-pages/man1/free.1.html
    - Zombies und wait: https://man7.org/linux/man-pages/man2/wait.2.html
