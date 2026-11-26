### Geschichte „Die Sternwarte“, Kapitel 2 „Das Kontingent“: nice
### begrenzt nicht, CPUQuota= schon. Befehle, Pfade, Unit-Namen und die
### Meldungen von systemd werden nicht übersetzt.

chapter-quota = Das Kontingent
    .summary = Das Stacking ist jetzt ein Dienst mit Nice=19, und der Galerie geht es gut. Aber der Hoster wird die Maschine drosseln: die ganze Nacht über ihrer CPU-Baseline. Begrenze das Stacking, ohne dass Jules seine Nacht verliert.

## Dateien

quota-message-amara =
    Von:     Amara
    An:      dich
    Betreff: Der Hoster wird uns drosseln

    Hallo,

    Seit deiner Korrektur hat Jules sein Stacking in einen Dienst
    verwandelt: /etc/systemd/system/stacking.service, mit Nice=19, wie du
    geraten hast. Er startet ihn, wenn er ins Bett geht. Die Galerie leidet
    nicht mehr.

    Aber lies die Mail des Hosters (mail_vom_hoster.txt): Die Maschine
    liegt die ganze Nacht über ihrer „Baseline“, und sie werden sie
    verlangsamen. Kannst du das Stacking unter dieser Grenze halten, für
    heute Nacht und für die nächsten Nächte?

    Es läuft noch (seit 1:10 Uhr, bis etwa 11): Wenn du kannst, starte es
    nicht neu, sonst verliert Jules seine Nacht.

    Gleiches sudo-Passwort: nebel-2028.

    Amara
quota-mail-host =
    Von:     support@cloud.example
    An:      astro-club@cloud.example
    Betreff: [sternwarte] CPU-Guthaben aufgebraucht

    Guten Tag,

    Ihre Instanz „sternwarte“ (2 vCPU, Tarif „Burst“) hat 7 Stunden am
    Stück mehr als ihre Baseline von 40 % ihrer vCPUs genutzt. Ihr
    CPU-Guthaben ist aufgebraucht: Ab heute 12:00 Uhr wird sie auf diese
    Baseline begrenzt, bis sich ihr Guthaben wieder aufgebaut hat.

    Um das zu vermeiden, halten Sie die durchschnittliche Nutzung der
    Instanz unter 40 %.

    Ihr Team von cloud.example

## Ereignisse

quota-event-measure =
    Die Worker stehen auf nice 19 und nehmen trotzdem fast beide CPUs ganz:
    Um diese Uhrzeit blättert niemand in der Galerie, also beansprucht
    niemand den Rest. nice teilt zwischen Prozessen, die die CPU wollen; es
    begrenzt nichts. Über die ganze Nacht liegt die Maschine bei 100 %
    ihrer zwei vCPUs: weit über den 40 % des Hosters.
quota-event-nice-property =
    systemctl set-property ändert nur Einstellungen der Ressourcenkontrolle,
    die systemd auf einen laufenden Dienst anwenden kann (CPUQuota=,
    CPUWeight=, MemoryMax=…). Nice= wird angewendet, wenn die Prozesse
    starten. Und nice ist hier nicht das, was du brauchst: man
    systemd.resource-control.
quota-event-reload =
    In der Datei steht CPUQuota=, aber systemd hat sie noch nicht gelesen:
    Nachdem du eine Unit-Datei oder ein Drop-in von Hand geändert hast,
    sudo systemctl daemon-reload. (systemctl edit und systemctl
    set-property machen das von selbst.)
quota-event-per-cpu =
    Ein Kontingent ist gesetzt, aber es ist zu hoch für den Hoster.
    CPUQuota= zählt in Prozent EINER CPU: 100 % ist eine ganze CPU, 200 %
    beide. Der Hoster erlaubt 40 % der zwei vCPUs: 0,8 CPU, also höchstens
    CPUQuota=80%.
quota-event-stopped =
    Das Stacking ist gestoppt. Jules: „Meine Nacht!“ Damit es fertig wird,
    muss es laufen: sudo systemctl start stacking (es fängt wieder von
    vorn an) — und begrenze es, sonst verlangsamt der Hoster alles.
quota-event-restarted =
    Das Stacking ist neu gestartet: Es fängt wieder beim ersten Foto der
    Nacht an. Jules seufzt, aber es wird heute Nachmittag fertig. Ein
    Neustart war nicht nötig: systemd wendet CPUQuota= auf einen laufenden
    Dienst an (set-property, oder daemon-reload nach einem Drop-in).
quota-event-end =
    Das Stacking bleibt jetzt unter 0,8 CPU: 40 % der Maschine. Es läuft
    weiter, etwas länger, und die Grenze des Hosters wird eingehalten; die
    Einstellung liegt auf der Platte, also gilt sie auch für die nächsten
    Nächte. Amara: „Perfekt, ich antworte dem Hoster.“

    Gut gemacht! Du hast das Kapitel „Das Kontingent“ abgeschlossen.

    WAS PASSIERT IST
    Nice=19 hat das Stacking hinter jeden anderen Prozess gestellt, aber
    es begrenzt nichts: Wenn sonst niemand die CPU will, nimmt ein Prozess
    mit nice sie ganz. Die ganze Nacht lag die Maschine bei 100 % ihrer
    zwei vCPUs, mehr als die 40 %, die der Tarif des Hosters auf Dauer
    erlaubt.

    NICE TEILT, DAS KONTINGENT BEGRENZT
    - nice (Nice=, renice): wer zuerst drankommt, wenn es nicht für alle
      reicht. Keine Grenze, wenn die CPU frei ist.
    - CPUQuota= (systemd, die cgroups des Kernels): höchstens so viel
      CPU-Zeit pro Sekunde, auch wenn die CPU frei ist. 100 % = eine CPU,
      200 % = zwei.
    - CPUWeight=: wie nice, aber zwischen Diensten (cgroups).

    GUTE PRAXIS
    - sudo systemctl set-property stacking CPUQuota=80%: sofort angewendet
      und auf der Platte behalten (in /etc/systemd/system.control).
    - Oder sudo systemctl edit stacking ({"["}Service] CPUQuota=80%): ein
      Drop-in, von systemctl edit sofort gelesen. Von Hand: daemon-reload.
    - Prüf mit systemd-cgtop oder top: Die Worker bleiben zusammen unter
      dem Kontingent.

    DOKUMENTATION
    - CPUQuota=, CPUWeight=: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - systemctl set-property: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - systemd-cgtop: https://www.freedesktop.org/software/systemd/man/latest/systemd-cgtop.html
