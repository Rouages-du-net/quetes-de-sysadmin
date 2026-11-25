### Geschichte „Die Kantine“, Kapitel 3 „Der langsame Start“:
### network-online.target, systemd-networkd-wait-online, systemd-analyze.
### Unit-Namen, Pfade und die Meldungen von systemd werden nicht übersetzt.

chapter-slow-boot = Der langsame Start
    .summary = Seit der zweiten Netzwerkkarte braucht der Server nach einem Neustart zwei Minuten, bis er wieder da ist. Finde heraus, auf wen er wartet.

## Dateien

slow-boot-message-ibrahim =
    Von:     Ibrahim
    An:      dich
    Betreff: Zwei Minuten 502

    Hallo,

    Ich habe dem Server eine zweite Netzwerkkarte eingebaut, eth1, für die
    Ersatzleitung, die uns das Rathaus geben wird (sie ist noch nicht
    angeschlossen). Konfiguriert habe ich sie schon,
    /etc/systemd/network/20-eth1.network, damit sie am Tag X bereit ist.

    Seitdem dauert jeder Neustart ewig: mehr als zwei Minuten, bis die
    Website wieder da ist, und in der Zwischenzeit bekommen die
    Ehrenamtlichen „502 Bad Gateway“. Am Ende läuft alles, aber zwei
    Minuten zur Mittagszeit sind lang.

    Kannst du herausfinden, worauf der Server wartet, und dafür sorgen,
    dass er wieder schnell startet? Die Ersatzleitung kommt irgendwann:
    Ihre Konfiguration darf nicht endgültig verloren gehen. Du darfst neu
    starten (sudo reboot), Passwort linsen-2028.

    Ibrahim

## Ereignisse

slow-boot-event-blame =
    systemd-networkd-wait-online.service: mehr als zwei Minuten, fast der
    ganze Bootvorgang. Seine Aufgabe ist es, zu warten, bis das Netz
    „online“ ist, damit network-online.target erreicht wird; nginx und die
    App warten auf dieses Target (systemd-analyze critical-chain). Worauf
    wartet es? networkctl listet die Links und ihren Zustand auf.
slow-boot-event-no-carrier =
    eth1: no-carrier. Die Karte hat eine Konfiguration (20-eth1.network),
    also wartet wait-online, bis sie online ist… aber kein Kabel, kein
    Netz: Nach zwei Minuten gibt es auf, und der Bootvorgang geht weiter.
    Sag ihm, dass es auf diesen Link nicht warten soll (man
    systemd.network: RequiredForOnline=), oder worauf es warten soll (man
    systemd-networkd-wait-online: --any, --interface=).
slow-boot-event-menu-only =
    Immer noch langsam: Die App wartet nicht mehr auf das Netz, aber nginx
    schon (seine Unit, After=network-online.target). Solange wait-online
    auf eth1 wartet, wartet alles, was das Netz braucht, mit
    (systemd-analyze critical-chain).
slow-boot-event-disabled =
    Ohne wait-online wird network-online.target sofort erreicht: schnell,
    tatsächlich. Auf diesem Server ist das vertretbar (die Dienste lauschen
    lokal oder auf eth0, das in einer Sekunde hochkommt), aber das Target
    bedeutet nicht mehr „das Netz funktioniert“. Die feinere Lösung behält
    wait-online und sagt ihm, worauf es warten soll.
slow-boot-event-end =
    Der Server ist nach einem Neustart in ein paar Sekunden da, und die
    Website antwortet sofort. Ibrahim: „Und wenn die Ersatzleitung
    angeschlossen ist, kommt eth1 von selbst hoch?“ Ja: Seine
    Konfiguration ist noch da.

    Gut gemacht! Du hast das Kapitel „Der langsame Start“ abgeschlossen.

    WAS PASSIERT IST
    nginx (die Unit von Debian) und die App warten auf
    network-online.target. Dieses Target ist erreicht, wenn
    systemd-networkd-wait-online fertig ist, und wait-online wartet, bis
    jeder Link mit einer Konfiguration (.network-Datei) online ist. eth1
    hatte eine, aber kein Kabel: wait-online wartete zwei Minuten, gab auf,
    und erst dann starteten nginx und die App.

    DIE WERKZEUGE FÜR EINEN LANGSAMEN START
    - systemd-analyze time: wie lange Kernel und Userspace gebraucht haben.
    - systemd-analyze blame: jede Unit, nach der Zeit, die ihr Start
      gebraucht hat.
    - systemd-analyze critical-chain: die Kette der Units, die das Ende des
      Bootvorgangs verzögert hat (@ wann sie startete, + wie lange sie
      brauchte).
    - systemctl list-dependencies --after nginx: worauf eine Unit wartet.
    - networkctl: die Links, und wie weit jeder gekommen ist.

    GUTE PRAXIS
    - Ein Link, der fehlen darf: RequiredForOnline=no in seiner .network-Datei
      (Abschnitt [Link]); er kommt von selbst hoch, wenn er angeschlossen
      ist.
    - Oder sag wait-online, was „online“ hier heißt: ein Drop-in mit
      ExecStart= und dann ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --any
      (oder --interface=eth0).
    - After=network-online.target nur, wo es gebraucht wird (ein Dienst,
      der sich beim Start mit einer anderen Maschine verbindet); ein
      Dienst, der lauscht, braucht es nicht.

    DOKUMENTATION
    - Dienste nach dem Netz starten: https://systemd.io/NETWORK_ONLINE/
    - systemd-networkd-wait-online: https://www.freedesktop.org/software/systemd/man/latest/systemd-networkd-wait-online.service.html
    - RequiredForOnline=: https://www.freedesktop.org/software/systemd/man/latest/systemd.network.html#RequiredForOnline=
    - systemd-analyze: https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html
