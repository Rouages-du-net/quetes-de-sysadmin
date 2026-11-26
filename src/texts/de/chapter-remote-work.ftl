### Geschichte „Der Bienenstock“, Kapitel „Homeoffice“: ein WireGuard-VPN
### auf dem Router. Befehle, Schlüsselwörter von wg-quick, Namen der
### Schnittstellen und Pfade werden nicht übersetzt.

chapter-remote-work = Homeoffice
    .summary = Malik will das NAS von zu Hause aus öffnen: nicht, indem man einen Port zum Internet öffnet, sondern mit einem WireGuard-VPN, gut gehüteten Schlüsseln und einer Firewall, die ihn hereinlässt.

## Dateien

# { $key }: der öffentliche WireGuard-Schlüssel von Maliks Laptop
remote-work-email-malik =
    Von:     Malik
    An:      dich
    Betreff: Das NAS von zu Hause

    Das Netz läuft, danke! Eine letzte Bitte: Ich würde abends gern von zu
    Hause aus die Verzeichnisse des NAS öffnen. Der Neffe des Kassenwarts
    schlägt vor, „Port 445 auf der Box des Routers zu öffnen“. Ich habe
    meine Zweifel.

    Mir ist lieber, was du geraten hast: ein WireGuard-VPN auf dem Router.
    Ich habe die App auf meinem Laptop installiert. Sie hat meine
    Schlüssel erzeugt und gibt mir meinen öffentlichen Schlüssel:

        { $key }

    Im Tunnel wird mein Laptop die Adresse 10.10.99.2 haben. Die App fragt
    mich nach dem öffentlichen Schlüssel des Routers, seiner Adresse
    (hive.example, oder 192.0.2.21) und seinem Port: Füll
    malik-laptop.conf aus, ich kopiere sie dann.

    WireGuard ist auf dem Router installiert (man wg, man wg-quick; die
    Konfigurationen gehören nach /etc/wireguard). Und vergiss die Firewall
    der Zonen nicht: Die Kette input ist standardmäßig geschlossen.

    Für sudo: biene-2027

remote-work-laptop-malik =
    # Die WireGuard-Konfiguration von Maliks Laptop. Sein privater Schlüssel
    # bleibt auf dem Laptop: Die App zeigt ihn nie.
    # Auszufüllen: der Abschnitt Peer, also der Router.
    {"["}Interface]
    Address = 10.10.99.2/32

    {"["}Peer]
    # Der öffentliche Schlüssel des Routers:
    PublicKey =
    # Adresse und Port des Routers, aus dem Internet gesehen:
    Endpoint =
    # Die Adressen, die über den Tunnel erreicht werden:
    AllowedIPs =

## Ereignisse

# { $file }: die Datei mit dem privaten Schlüssel
remote-work-event-key-exposed =
    Vorsicht: { $file } enthält den privaten Schlüssel des Routers, und
    jedes Konto auf der Maschine kann sie lesen. Mit diesem Schlüssel
    könnte sich jede Person als der Router ausgeben. Ein privater Schlüssel
    ist nur für seinen Besitzer lesbar (chmod 600, oder umask 077, bevor man
    ihn erzeugt); einmal nach /etc/wireguard kopiert, das root vorbehalten
    ist, haben die anderen Kopien keinen Grund mehr zu existieren.
remote-work-event-filter =
    Malik: „Meine App sagt: Handshake did not complete after 5 seconds.“
    Seine Pakete erreichen zwar den Router… und die Kette input verwirft
    sie: Sie ist standardmäßig geschlossen (policy drop), und nichts darin
    lässt den Port durch, auf dem WireGuard lauscht (über UDP).
remote-work-event-handshake =
    Malik: „Immer noch nichts: Handshake did not complete.“ sudo wg show
    bestätigt es: kein „latest handshake“ für seinen Peer. Um sich
    gegenseitig zu erkennen, braucht jede Seite den ÖFFENTLICHEN Schlüssel
    der anderen: Maliks im Peer von wg0.conf, den des Routers in
    malik-laptop.conf. Und der Endpoint muss die Adresse des Routers und
    den Port angeben, auf dem er lauscht (ListenPort).
remote-work-event-without-nas =
    Malik: „Verbunden! … aber das NAS antwortet nicht.“ Der Handshake hat
    stattgefunden (sudo wg show: latest handshake). Bleibt der Weg der
    Pakete: Die Adresse des Laptops muss in den AllowedIPs seines Peers
    stehen, auf der Seite des Routers; das NAS in den AllowedIPs auf der
    Seite des Laptops; und die Kette forward muss wg0 zu den Büros
    durchlassen.
remote-work-event-in-place =
    Malik öffnet seine Verzeichnisse von zu Hause aus… gerade jetzt. Beim
    nächsten Neustart kommt wg0 nur zurück, wenn der Dienst wg-quick@wg0
    aktiviert ist, und die Firewall nur, wenn ihre Regeln in
    /etc/nftables.conf stehen. (Eine von Hand mit wg-quick up
    hochgefahrene Schnittstelle hindert den Dienst am Starten: zuerst
    wg-quick down.)
remote-work-event-end =
    Malik öffnet die Verzeichnisse des NAS von zu Hause aus, durch einen
    verschlüsselten Tunnel, ohne dass irgendetwas vom NAS aus dem Internet
    sichtbar ist. Und alles kommt beim nächsten Neustart zurück. Malik:
    „Der Neffe des Kassenwarts ist ein bisschen eingeschnappt.“

    Gut gemacht! Du hast das Kapitel „Homeoffice“ abgeschlossen.

    WAS PASSIERT IST
    WireGuard verbindet zwei Maschinen mit Schlüsseln, wie ssh: Jede hat
    einen privaten Schlüssel, der sie nie verlässt, und gibt der anderen
    ihren öffentlichen Schlüssel. Der Laptop schickt seine verschlüsselten
    Pakete über UDP an den Router (Endpoint); der Router nimmt sie an, wenn
    sie von einem Schlüssel kommen, den er kennt (Peer), und nur für die
    Adressen, die dieser Peer benutzen darf (AllowedIPs). AllowedIPs wirkt
    in beide Richtungen: Auf der Seite des Laptops listet es die Netze auf,
    die in den Tunnel geschickt werden.

    GUTE PRAXIS
    - Nie eine Dateifreigabe (445) zum Internet hin öffnen: ein VPN, und
      ein einziger offener UDP-Port.
    - Ein privater Schlüssel ist nur für seinen Besitzer lesbar: umask 077
      vor wg genkey, /etc/wireguard root vorbehalten.
    - Eine Adresse pro Peer, als /32, in AllowedIPs; und die Firewall
      entscheidet, wohin der Tunnel führt (hier nur zu den Büros).
    - systemctl enable wg-quick@wg0, damit der Tunnel beim Booten
      zurückkommt.

    EIN ANDERER WEG
    OpenVPN: älter und sehr verbreitet, beruht auf TLS und Zertifikaten,
    kann über TCP 443 gehen; aufwendiger zu konfigurieren. Ein SSH-Tunnel
    (ssh -L, „Das Bürgerhaus“) reicht für einen gelegentlichen Dienst,
    nicht für ein ganzes Netz. Tailscale, oder Headscale, das man selbst
    hostet, bauen ein WireGuard-Mesh auf und verteilen die Schlüssel.

    DOKUMENTATION
    - Schnellstart: https://www.wireguard.com/quickstart/
    - wg: https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick: https://man7.org/linux/man-pages/man8/wg-quick.8.html
    - WireGuard unter Debian: https://wiki.debian.org/WireGuard
