### Geschichte „Der Bienenstock“, Kapitel „Die Nebenstelle“: zwei Standorte
### mit WireGuard verbinden. Befehle, Schlüsselwörter von wg-quick,
### Adressen und Pfade werden nie übersetzt.

chapter-annex = Die Nebenstelle
    .summary = Der Bienenstock eröffnet einen zweiten Standort: Verbinde seine zwei Netze über das VPN, mit AllowedIPs als Routing-Tabelle, und einem Weg, der durch die Box des Providers der Nebenstelle offen gehalten wird.

## Dateien

# { $key }: der öffentliche WireGuard-Schlüssel des Routers der Nebenstelle
annex-email-sami =
    Von:     Sami (Ehrenamtlicher in der Nebenstelle)
    An:      dich
    Betreff: Die Nebenstelle mit dem Bienenstock verbinden

    Hallo! Die Nebenstelle öffnet am Montag. Ich habe unseren Router
    eingerichtet (auch ein Debian, hinter der Box unseres Providers);
    unser Netz ist 10.20.10.0/24.

    Was wir brauchen:
    - die Rechner der Nebenstelle können die Verzeichnisse auf dem NAS des
      Bienenstocks öffnen (10.10.10.5);
    - Malik kann von den Büros aus auf unserem Drucker drucken
      (10.20.10.20);
    - und mehr nicht: Die Kameras des Bienenstocks schauen nicht zu uns.

    Malik sagt, das VPN fürs Homeoffice kann das übernehmen: Unser Router
    wird ein Peer mehr auf wg0. Er hat im Tunnel die Adresse 10.10.99.3
    genommen, und sein öffentlicher Schlüssel ist:

        { $key }

    Ich habe annex-wg0.conf vorbereitet: Füll den Teil Peer aus (dein
    Router), und ich kopiere sie hierher. Für den öffentlichen Schlüssel
    deines Routers: sudo wg show.

    Für sudo: biene-2027

annex-conf =
    # Die WireGuard-Konfiguration des Routers der Nebenstelle (Sami kopiert sie).
    # Sein privater Schlüssel bleibt in der Nebenstelle.
    {"["}Interface]
    Address = 10.10.99.3/24
    ListenPort = 51820

    {"["}Peer]
    # Der Router des Bienenstocks:
    PublicKey =
    Endpoint =
    # Die Adressen des Bienenstocks, die in den Tunnel geschickt werden:
    AllowedIPs =

## Ereignisse

annex-event-not-reread =
    Die Datei /etc/wireguard/wg0.conf hat einen Peer für die
    Nebenstelle… aber wg0 läuft noch mit der alten Konfiguration (sudo wg
    show): wg-quick liest die Datei nicht von selbst neu. Du musst die
    Schnittstelle neu starten (der Dienst wg-quick@wg0).
annex-event-handshake =
    Sami: „Unser Router sagt: Handshake did not complete.“ sudo wg show
    bestätigt es: kein „latest handshake“ für den Peer der Nebenstelle.
    Jede Seite muss den ÖFFENTLICHEN Schlüssel der anderen haben, und der
    Endpoint muss Adresse und Port deines Routers angeben.
annex-event-allowed =
    Sami: „Der Tunnel steht, aber unsere Rechner erreichen das NAS nicht.“
    Die Pakete kommen an… und der Router verwirft sie: Sie kommen von
    10.20.10.15, und für WireGuard darf ein Peer nur von den Adressen in
    seinen AllowedIPs aus senden. Für einen ganzen Standort ist das sein
    ganzes Netz.
annex-event-route =
    Sami: „Immer noch nichts zum NAS.“ Auf der Seite der Nebenstelle gehen
    Pakete für 10.10.10.5 nicht in den Tunnel: In annex-wg0.conf sagt
    AllowedIPs, was hinein muss (und wg-quick macht daraus Routen).
annex-event-asleep =
    Sami: „Das NAS geht!“ Malik: „Und ich kann in der Nebenstelle
    drucken… manchmal. Dann stundenlang nichts.“ Der Router der
    Nebenstelle steht hinter der Box seines Providers: Solange er nichts
    schickt, vergisst die Box den Weg, und der Bienenstock kann ihn nicht
    mehr erreichen. WireGuard kann ihn offen halten, indem es ab und zu
    ein kleines Paket schickt (man wg: PersistentKeepalive).
annex-event-cameras =
    Vorsicht: Die Nebenstelle kann jetzt die Kameras des Bienenstocks
    erreichen. Sami hat nur nach dem NAS gefragt: Der Tunnel öffnet nicht
    alles, die Firewall (die Kette forward) entscheidet, wohin er führt.
annex-event-malik =
    Vorsicht: Malik kann das NAS von zu Hause nicht mehr erreichen. Der
    Peer seines Laptops muss in wg0.conf bleiben, mit seiner eigenen
    Adresse.
annex-event-in-place =
    Die zwei Standorte können miteinander sprechen… gerade jetzt. Beim
    nächsten Neustart startet wg0 wieder aus /etc/wireguard/wg0.conf über
    den Dienst wg-quick@wg0: Alles muss dort drinstehen.
annex-event-end =
    Die Rechner der Nebenstelle öffnen das NAS, Malik druckt in der
    Nebenstelle, der Tunnel bleibt trotz der Box offen, und sonst kommt
    nichts durch. Sami: „Es fühlt sich an, als wären wir im selben
    Gebäude.“

    Gut gemacht! Du hast das Kapitel „Die Nebenstelle“ abgeschlossen.

    WAS PASSIERT IST
    Bei WireGuard wirkt AllowedIPs in beide Richtungen: Es listet die
    Adressen auf, die an diesen Peer geschickt werden (wg-quick macht
    daraus Routen, sichtbar mit ip route), und die, von denen aus dieser
    Peer senden darf. Um zwei Standorte zu verbinden, trägt jede Seite dort
    das Netz der anderen ein. Und ein Standort hinter einer Box (NAT) muss
    den Weg offen halten: PersistentKeepalive schickt alle 25 Sekunden ein
    Paket.

    GUTE PRAXIS
    - Netze, die sich nicht überschneiden (10.10.x für den Bienenstock,
      10.20.x für die Nebenstelle), gewählt, bevor man die Standorte
      verbindet.
    - Der Tunnel transportiert, die Firewall entscheidet: nur öffnen, was
      verlangt wurde.
    - Nach einer Änderung von wg0.conf die Schnittstelle (oder den Dienst)
      neu starten, und mit wg show und ip route prüfen.

    DOKUMENTATION
    - Cryptokey Routing: https://www.wireguard.com/#cryptokey-routing
    - wg (PersistentKeepalive): https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick (Routen): https://man7.org/linux/man-pages/man8/wg-quick.8.html

# Der Kommentar über dem Peer der Nebenstelle in wg0.conf.
annex-peer-comment = Nebenstelle
