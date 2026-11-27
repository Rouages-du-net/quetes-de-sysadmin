### Geschichte „Bereitschaft“, Kapitel 7 „Der Engpass“: Warten auf die
### Platte (iowait), iostat, pidstat, ionice und die Bandbreitengrenze von
### systemd. Befehle, Pfade, Namen der Units und Log-Zeilen werden nicht übersetzt.

chapter-bottleneck = Der Engpass
    .summary = Jeden Nachmittag um 16 Uhr stottert der Livestream: finden, was die Platte auslastet, und es begrenzen, ohne es zu stoppen.

## Dateien

bottleneck-message-zoe =
    Eine Nachricht von Zoé (16:12 Uhr):

    „Es geht schon wieder los! Jeden Tag gegen 16 Uhr hat der Livestream
    Lücken: halbsekündige Stille, mehrmals pro Minute. Die Hörerschaft
    schreibt uns. Das Relay (radio-stream) läuft, sein Journal erwähnt
    ‚read stall‘.

    Ich habe in top geschaut: Die Maschine wirkt überlastet, aber der
    Prozessor tut fast nichts. Ich verstehe es überhaupt nicht.

    Was auch immer du findest, schalte nichts einfach ab: Alles, was auf
    diesem Server läuft, hat seine Aufgabe, und die Sendungen des Tages
    müssen heute Abend archiviert sein. Aber der Livestream darf nicht
    kaputtgehen, weder heute noch morgen.“

    Um dir die Platte anzusehen: man iostat, man pidstat.

## Ereignisse

bottleneck-event-iowait =
    Schau auf die Zeile %Cpu(s) von top: Der Prozessor ist fast nie
    beschäftigt (us, sy), aber „wa“ ist riesig. Das ist iowait: die Zeit,
    die Prozesse auf die Platte warten. Die Last (load average) zählt
    diese blockierten Prozesse, daher eine „überlastete“ Maschine, die
    nichts rechnet. Der Engpass ist die Platte: iostat -x zeigt, wie
    ausgelastet sie ist (%util) und wie lange jede Anfrage wartet
    (r_await, in ms); pidstat -d zeigt, wer liest und schreibt.
bottleneck-event-ionice =
    ionice hat die Klasse „idle“ akzeptiert… aber schau dir iostat an:
    Nichts hat sich geändert. Die Prioritäten von ionice zählen nur, wenn
    der Scheduler der Platte sie berücksichtigt (bfq, mq-deadline). Der
    Scheduler dieser virtuellen Platte ist „none“ (cat
    /sys/block/vda/queue/scheduler): Er bedient die Anfragen der Reihe
    nach, ohne Priorität. Eine Bandbreitengrenze dagegen funktioniert mit
    jedem Scheduler: systemd setzt sie auf der cgroup des Dienstes
    (man systemd.resource-control, IOWriteBandwidthMax=).
bottleneck-event-stop =
    Die Archivierung läuft nicht mehr. Der Livestream kann atmen… aber die
    Sendungen von heute werden nicht archiviert, und morgen um 16 Uhr
    startet der Timer sie wieder mit voller Geschwindigkeit. Starte sie
    wieder (sudo systemctl start radio-archives), aber mit einer
    Bandbreitengrenze.
bottleneck-event-bad-disk =
    systemd hat die Grenze gespeichert, aber sie zielt auf eine Platte,
    die es hier nicht gibt: Sie bremst nichts. Die Platte dieser Maschine
    ist vda (iostat zeigt sie); du kannst auch einen Pfad angeben, und
    systemd findet die Platte, auf der er liegt.
bottleneck-event-too-slow =
    Eine so niedrige Grenze schützt den Livestream… aber die Archivierung
    von heute wäre vor morgen nicht fertig. Ein paar Dutzend MiB/s
    reichen: Schau nach jedem Versuch in iostat und finde das richtige
    Gleichgewicht.
bottleneck-event-end =
    Der Livestream stottert nicht mehr: Seine Lesevorgänge warten ein paar
    Millisekunden, nicht Hunderte. Die Archivierung läuft weiter,
    langsamer, und ihre Grenze ist gespeichert: Morgen um 16 Uhr gilt sie
    von selbst. Zoé: „Keine einzige Lücke in fünf Minuten. Und das Archiv
    ist gegen 18 Uhr fertig, das ist perfekt.“

    Gut gemacht! Du hast das Kapitel „Der Engpass“ abgeschlossen.

    WAS PASSIERT IST
    Die Maschine war nicht überlastet: Sie wartete auf ihre Platte. Eine
    Kopie mit voller Geschwindigkeit nahm fast ihre ganze Bandbreite, und
    jeder Lesevorgang des Livestreams stellte sich dahinter an (r_await im
    Bereich von Hunderten ms). top zeigt es (wa, die Last), iostat -x
    beweist es (%util, await), pidstat -d sagt dir, wer es verursacht.

    GUTE PRAXIS
    - Hohe Last bei untätigem Prozessor: an die Platte denken (iowait) und
      sie mit iostat -x 1 ansehen.
    - Hintergrundaufgaben mit systemd begrenzen: IOWriteBandwidthMax= und
      IOReadBandwidthMax= (die cgroup des Dienstes, io.max), die mit jedem
      Scheduler funktionieren; ionice und IOSchedulingClass=idle helfen
      nur mit bfq oder mq-deadline.
    - systemctl set-property wirkt sofort und speichert es (in
      /etc/systemd/system.control); eine mit systemctl edit geschriebene
      Grenze gilt auch für spätere Läufe.
    - Und wenn möglich große Kopien planen, wenn niemand zuhört.

    DOKUMENTATION
    - iostat(1): https://man7.org/linux/man-pages/man1/iostat.1.html
    - systemd.resource-control(5): https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - Der io-Controller von cgroup v2: https://docs.kernel.org/admin-guide/cgroup-v2.html#io
