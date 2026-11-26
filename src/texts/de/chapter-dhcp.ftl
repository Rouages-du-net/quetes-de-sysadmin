### Geschichte „Der Bienenstock“, Kapitel „DHCP“: dnsmasq verteilt
### Adressen in jedem VLAN. Optionen von dnsmasq, Befehle und Pfade werden
### nicht übersetzt.

chapter-dhcp = DHCP
    .summary = Die VLANs sind da, aber niemand hat eine Adresse: ein DHCP-Bereich pro VLAN mit dnsmasq, eine Reservierung für den Drucker, und kein Wort in Richtung der Box des Providers.

## Dateien

dhcp-email-malik =
    Von:     Malik
    An:      dich
    Betreff: VLANs sind toll, aber…

    Das NAS und die Kamera antworten, danke! Aber die Rechner der Büros und
    das WLAN des Cafés haben immer noch keine Adresse. Sie fragen den
    Router über DHCP danach: Darum kümmert sich dnsmasq (/etc/dnsmasq.d,
    man dnsmasq). Es bedient noch das alte flache Netz.

    Noch etwas: Der neue Drucker ist angekommen. Er kann seine Adresse nur
    über DHCP bekommen, aber jeder Rechner erwartet ihn unter 10.10.30.10.
    Seine MAC-Adresse steht auf dem Etikett: 00:00:5e:00:53:30.

    Und der Elektriker hat mir das Versprechen abgenommen, dir zu sagen:
    „Vor allem darf das DHCP NIE auf der Seite der Box des Providers
    antworten.“ Ich habe es nicht ganz verstanden.

    Das Journal (journalctl -u dnsmasq) und die Lease-Datei
    (/var/lib/misc/dnsmasq.leases) sagen, wer was bekommen hat.

    Für sudo: biene-2027

## Ereignisse

dhcp-event-wan =
    Vorsicht: dnsmasq lauscht auf jeder Schnittstelle, auch auf eth0, dem
    Netz des Internetproviders. Ein DHCP-Server, der bei den Nachbarn
    antwortet (ein „Rogue-DHCP-Server“), ist die Art von Panne, die ein
    ganzes Viertel vom Netz abschneidet. Sag dnsmasq, wo es lauschen darf
    (interface=, oder except-interface=eth0).
# { $address }: die erwartete Adresse des Druckers
dhcp-event-printer-elsewhere =
    Der Drucker hat eine Adresse bekommen… aber nicht { $address }, und die
    Rechner finden ihn nicht. dnsmasq kann eine Adresse für ein Gerät
    reservieren, anhand seiner MAC-Adresse (man dnsmasq: dhcp-host).
dhcp-event-end =
    Jedes Gerät hat seine Adresse in seinem VLAN, der Drucker ist an seinem
    Platz, und die Box des Providers hört nichts. Malik: „Das Café hat WLAN,
    die Büros haben Internet… na ja, fast: Anscheinend kommt noch nichts
    hinaus.“

    Gut gemacht! Du hast das Kapitel „DHCP“ abgeschlossen.

    WAS PASSIERT IST
    Ein Gerät, das einem Netz beitritt, ruft „kann mir jemand eine Adresse
    geben?“ (DHCPDISCOVER). Der DHCP-Server des Netzes antwortet (OFFER),
    das Gerät nimmt an (REQUEST), der Server bestätigt (ACK) und
    verzeichnet die Lease. dnsmasq wählt den Bereich danach, an welcher
    Schnittstelle die Anfrage ankommt: ein Bereich pro VLAN, im Netz jeder
    Schnittstelle.

    GUTE PRAXIS
    - Ein Bereich pro Netz, und Reservierungen (MAC → Adresse) für das, was
      gefunden werden muss: Drucker, Server, Kameras.
    - Die Schnittstellen begrenzen, auf denen DHCP lauscht: nie auf der
      Seite des Internets.
    - dnsmasq --test vor dem Neustart; das Journal und die Lease-Datei zum
      Prüfen.

    EIN ANDERER WEG
    Kea, der DHCP-Server von ISC, der isc-dhcp-server ersetzt (seit Ende
    2022 nicht mehr gepflegt): Datenbanken, Hochverfügbarkeit, API, aber
    schwerer zu installieren. dnsmasq macht DHCP und DNS-Cache in einem
    einzigen kleinen Programm: ideal für ein kleines Netz.

    DOKUMENTATION
    - dnsmasq: https://dnsmasq.org/docs/dnsmasq-man.html
