### Geschichte „Der Bienenstock“, Kapitel „Die DMZ“: ein öffentlicher Server
### in einem eigenen VLAN, Zieladressübersetzung (dnat) und die Firewall.
### Befehle, Schlüsselwörter von nft, Namen der Schnittstellen und Pfade
### werden nicht übersetzt.

chapter-dmz = Die DMZ
    .summary = Die Website für Raumbuchungen läuft jetzt vor Ort: ein eigenes VLAN (die DMZ), Zieladressübersetzung, um sie aus dem Internet erreichbar zu machen, und ein Server, der nichts vom Rest sieht.

## Dateien

dmz-email-ines =
    Von:     Inès (Ehrenamtliche, Website des Bienenstocks)
    An:      dich
    Betreff: Die Buchungswebsite, bei uns!

    Hallo! Malik hat mir gesagt, dass du dich um den Router kümmerst. Wir
    bezahlen den Hoster nicht mehr: Die Website für Raumbuchungen läuft
    jetzt auf einem kleinen Server hier, „web“ (10.10.40.10, Gateway
    10.10.40.1). Er antwortet über HTTP und HTTPS (Ports 80 und 443).

    Der Elektriker hat ihn an Port 21 des Switches angeschlossen, in einem
    neuen VLAN 40: die „DMZ“, hat er gesagt. Sein Plan steht in
    switch-plan.txt.

    Damit die Leute sie finden, soll alles, was an der öffentlichen Adresse
    des Routers (192.0.2.21) auf den Ports 80 und 443 ankommt, zum Server
    gehen. Und er muss seine Updates aus dem Internet holen können.

    Malik fügt hinzu: „Ein Server, der zum Internet hin offen ist, ist der,
    der angegriffen wird. Wenn er fällt, darf er nichts anderes von uns
    sehen: nicht das NAS, nicht den Drucker.“ Die Büros müssen sich aber
    per ssh mit ihm verbinden können, um ihn zu administrieren.

    Um die Besuche vorbeiziehen zu sehen: sudo conntrack -L. Der Rest: man
    nft (dnat), man interfaces.

    Für sudo: biene-2027

dmz-plan-switch =
    SWITCH-PLAN — Der Bienenstock (Elektriker, aktualisiert im Januar 2028)

    Port 1     : zum Router (eth1). 802.1Q-TRUNK: VLAN 10, 20, 30, 40
                 getaggt.
    Ports 2-12 : VLAN 10 „bueros“
    Ports 13-16: VLAN 20 „gaeste“
    Ports 17-20: VLAN 30 „geraete“
    Port 21    : VLAN 40 „dmz“ (der Webserver)

    Adressen:
      VLAN 40  dmz          10.10.40.0/24   Router  : 10.10.40.1
                                            web     : 10.10.40.10 (statisch)

## Ereignisse

# { $address }: die öffentliche Adresse des Routers
dmz-event-address-public =
    Eine Regel in der Kette forward erwartet die Adresse { $address }…
    aber sie wird sie nie sehen: Die Zieladressübersetzung (dnat) passiert
    früher, am Hook prerouting. Wenn das Paket forward erreicht, geht es
    schon an 10.10.40.10. Diese Adresse muss forward durchlassen.
dmz-event-without-forward =
    Inès: „Die Website antwortet bei mir zu Hause immer noch nicht.“ Der
    Router übersetzt das Ziel zwar (sudo nft list ruleset), aber das
    übersetzte Paket geht danach durch die Kette forward, die
    standardmäßig geschlossen ist: Nichts dort lässt das Internet zur DMZ
    durch.
dmz-event-too-open =
    Vorsicht: Mit diesen Regeln ist die DMZ zu offen. Entweder erreicht das
    Internet den Server auf anderen Ports als 80 und 443 (ssh zum
    Beispiel), oder der Server kann Verbindungen ins interne Netz öffnen.
    Eine DMZ lässt nur herein, was sie veröffentlicht, und lässt nichts
    nach innen hinaus.
dmz-event-in-place =
    Die Website antwortet, und die DMZ hält… fürs Erste. Aber nach dem
    nächsten Neustart? Die Schnittstelle eth1.40 muss in
    /etc/network/interfaces stehen, und die Regeln in /etc/nftables.conf.
dmz-event-end =
    Die Buchungswebsite antwortet aus dem Internet, der Server holt seine
    Updates, die Büros administrieren ihn, und wenn er je gehackt wird,
    sieht er weder das NAS noch den Drucker. Inès: „Und das Hosting kostet
    uns nichts mehr!“

    Gut gemacht! Du hast das Kapitel „Die DMZ“ abgeschlossen.

    WAS PASSIERT IST
    Der Router hat nur eine öffentliche Adresse. Die Zieladressübersetzung
    (dnat, in einer nat-Kette am Hook prerouting) ändert das Ziel von
    Paketen, die auf bestimmten Ports ankommen: Sie werden an den Server
    weitergeschickt, und die Verbindungsverfolgung gibt die Antworten mit
    der Adresse des Routers zurück. Da diese Änderung VOR dem Routing
    passiert, sieht die Kette forward schon das neue Ziel. Die DMZ
    (demilitarisierte Zone) ist ein eigenes Netz für alles, was aus dem
    Internet sichtbar ist.

    GUTE PRAXIS
    - Nur die Ports veröffentlichen, die man braucht (80, 443), nie „alles“
      an einen Server.
    - Die DMZ kann nichts ins interne Netz öffnen; es ist das Innere, das
      zu ihr geht (Administration von den Büros aus).
    - In forward das Ziel NACH der Übersetzung schreiben (die Adresse des
      Servers), und mit sudo conntrack -L testen.

    DOKUMENTATION
    - NAT mit nftables: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - Der Weg der Pakete (Hooks): https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks
