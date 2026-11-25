### Geschichte „Der Bienenstock“, Kapitel „VLANs“: ein Debian-Router hinter
### einem in VLANs aufgeteilten Switch. Die Befehle, die Namen der
### Schnittstellen und die Syntax von /etc/network/interfaces werden nicht
### übersetzt.

chapter-vlan = VLANs
    .summary = Der Switch wurde in drei VLANs aufgeteilt; der Router spricht noch flach. 802.1Q-Schnittstellen, und dafür sorgen, dass sie einen Neustart überstehen.

## Dateien

vlan-email-malik =
    Von:     Malik (Haustechnik im Bienenstock)
    An:      dich
    Betreff: Seit heute Morgen kein Netz

    Der Elektriker war am Wochenende da: Er hat auf dem Switch „das Netz in
    VLANs aufgeteilt“, damit das WLAN für Gäste unsere Rechner, den Drucker
    und die Kameras nicht mehr sieht. Sein Plan steht in switch-plan.txt.

    Seitdem geht nichts mehr: Sogar das NAS des Büros antwortet nicht mehr!
    Er hat mir gesagt: „Der Router muss nachziehen, auf ihm müsst ihr die
    VLAN-Schnittstellen anlegen.“ Der Router ist diese Maschine (eth0 zur
    Box des Providers, eth1 zum Switch).

    Der vorige Dienstleister hat das Netz in /etc/network/interfaces
    konfiguriert (man interfaces). Und um zu sehen, was gerade passiert:
    man ip.

    Für sudo: biene-2027

vlan-plan-switch =
    SWITCH-PLAN — Der Bienenstock (Elektriker, November 2027)

    Port 1     : zum Router (eth1). 802.1Q-TRUNK: VLAN 10, 20, 30
                 getaggt. Nichts mehr im nativen VLAN.
    Ports 2-12 : VLAN 10 „bueros“       (ungetaggt, Büros)
    Ports 13-16: VLAN 20 „gaeste“       (WLAN-Zugangspunkte des Cafés)
    Ports 17-20: VLAN 30 „geraete“      (Drucker, Kameras)

    Adressen (auf dem Router zu konfigurieren):
      VLAN 10  bueros       10.10.10.0/24   Router: 10.10.10.1
      VLAN 20  gaeste       10.10.20.0/24   Router: 10.10.20.1
      VLAN 30  geraete      10.10.30.0/24   Router: 10.10.30.1

    Geräte mit fester Adresse:
      nas             10.10.10.5   (VLAN 10)
      drucker         10.10.30.10  (VLAN 30)
      eingangskamera  10.10.30.11  (VLAN 30)

## Ereignisse

vlan-event-bad-number =
    Eine deiner VLAN-Schnittstellen hat eine Adresse in einem Netz… aber
    nicht die richtige VLAN-Nummer: Ihre Frames gehen mit einer anderen
    Nummer getaggt hinaus, und der Switch steckt sie nicht ins richtige
    VLAN. Ein Ping zu einem Gerät in diesem Netz zeigt es (Destination Host
    Unreachable). Prüf mit ip -d link show.
vlan-event-in-place =
    Alle drei VLANs antworten: das NAS, der Drucker und die Kamera auch
    (ping). Aber was du mit ip gemacht hast, verschwindet beim nächsten
    Neustart: Nur /etc/network/interfaces wird beim Booten wieder gelesen.
    Schreib die drei VLANs dort hinein (man interfaces), dann ifup.
vlan-event-end =
    Die drei VLANs laufen, und sind dauerhaft eingetragen. Malik: „Das NAS
    ist zurück! Und das WLAN des Cafés sieht den Drucker nicht mehr, das
    wollte der Elektriker.“

    Gut gemacht! Du hast das Kapitel „VLANs“ abgeschlossen.

    WAS PASSIERT IST
    Ein VLAN teilt einen Switch in mehrere getrennte Netze auf. Auf einem
    „Trunk“-Port teilen sich mehrere VLANs dasselbe Kabel: Jeder Frame
    trägt ein 802.1Q-Tag mit seiner Nummer. Also braucht der Router eine
    Schnittstelle pro VLAN (eth1.10, eth1.20, eth1.30), mit seiner Adresse
    in jedem Netz. Ohne Tag landeten seine Frames im nativen VLAN, wo
    niemand mehr ist.

    GUTE PRAXIS
    - Ein VLAN pro Verwendung: Büros, Gäste, Geräte (Drucker, Kameras,
      Telefone), Administration.
    - Der Plan irgendwo aufgeschrieben (Nummern, Netze, Ports), und aktuell
      gehalten.
    - ip zum Ausprobieren, /etc/network/interfaces (oder systemd-networkd),
      damit es dauerhaft wird; ip -d link show, um die Nummer zu prüfen.
    - Das native VLAN eines Trunks: leer, oder zumindest nicht das der
      sensiblen Geräte.

    EIN ANDERER WEG
    systemd-networkd (Dateien .netdev und .network) oder NetworkManager
    (nmcli) beschreiben dieselben VLANs anders. Debian behält ifupdown auf
    Servern; Ubuntu geht über netplan, das die Konfiguration für
    systemd-networkd schreibt. Das Prinzip ändert sich nicht: eine
    Schnittstelle pro VLAN, auf der Karte, die am Trunk hängt.

    DOKUMENTATION
    - interfaces (Debian): https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - VLAN in interfaces: https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html
    - ip link: https://man7.org/linux/man-pages/man8/ip-link.8.html
