### Geschichte „Der Bienenstock“, Kapitel „Die Zonen“: Routing, NAT und eine
### Firewall zwischen den VLANs, mit sysctl und nftables. Befehle,
### Schlüsselwörter von nft, Namen der Schnittstellen und Pfade werden
### nicht übersetzt.

chapter-zones = Die Zonen
    .summary = Nichts kommt ins Internet hinaus, und alle sehen alles: Routing, Adressübersetzung (NAT) und eine Firewall zwischen den VLANs, mit nftables, und alles übersteht einen Neustart.

## Dateien

zones-email-malik =
    Von:     Malik
    An:      dich
    Betreff: Das Internet kommt nicht hinaus

    Alle haben ihre Adresse, danke! Aber nichts kommt ins Internet hinaus:
    nicht die Büros, nicht das WLAN des Cafés. Sacha, der Ehrenamtliche,
    der sich vor dir um das Netz gekümmert hat, sagt, er hatte „alles von
    Hand eingerichtet“; seine Notizen stehen in notizen-von-sacha.txt. Der
    Router hat am Samstag neu gestartet, beim Stromausfall.

    Und wo wir schon dabei sind, was wir mit den VLANs eigentlich wollten:

    - die Büros (VLAN 10): Internet, und der Drucker;
    - das WLAN für Gäste (VLAN 20): Internet, und SONST NICHTS. Auf dem NAS
      liegen die Akten der Berechtigten des Gemeinschaftsladens, und dann
      sind da die Kameras;
    - die Geräte (VLAN 30): gar kein Internet. Die Kameras versuchen, ihre
      Aufnahmen an ihren Hersteller zu schicken, und das wollen wir nicht.
      Das NAS muss die Kameras aber weiter aufzeichnen.

    Du arbeitest vom Admin-Rechner aus (192.0.2.2), über ssh: Sperr dich
    nicht aus!

    Um zu sehen, wer über den Router mit wem spricht: sudo conntrack -L.
    Der Rest: man nft, man sysctl.

    Für sudo: biene-2027

zones-notes-sacha =
    SACHAS NOTIZEN (das Netz des Bienenstocks)

    Um das Netz nach einem Neustart des Routers ins Internet zu bringen
    (eines Tages schreibe ich das in eine Datei):

      sudo sysctl -w net.ipv4.ip_forward=1
      sudo nft add table ip nat
      sudo nft 'add chain ip nat postrouting {"{"} type nat hook postrouting priority srcnat; {"}"}'
      sudo nft add rule ip nat postrouting oifname "eth0" masquerade

    Keine Filterung: Alle sehen alles, aber hey, wir sind unter Freunden.

## Ereignisse

zones-event-without-translation =
    Der Router leitet jetzt Pakete weiter… und sie gehen mit ihrer privaten
    Adresse (10.10.x.x) über eth0 hinaus. Im Internet weiß niemand, wohin
    er einer privaten Adresse antworten soll: Sie sind für lokale Netze
    reserviert (RFC 1918), und die Box des Providers verwirft sie. Der
    Router muss sie unter seiner eigenen Adresse hinausschicken
    (Adressübersetzung, oder NAT: man nft, masquerade). sudo conntrack -L
    zeigt den Austausch, der ohne Antwort geblieben ist ([UNREPLIED]).
zones-event-responses =
    Die Fragen kommen durch, aber nicht die Antworten: Mit einer
    drop-Richtlinie ist die Antwort eines Servers ein Paket wie jedes
    andere, das über eine Schnittstelle hereinkommt, auf der nichts es
    erlaubt. Die Firewall verfolgt den Austausch (ct state): Sie kann eine
    Antwort auf einen schon erlaubten Austausch erkennen (established) und
    sie zurückkommen lassen.
zones-event-all-open =
    Das Internet geht überall… auch dort, wo es nicht soll: Das Handy
    eines Gastes erreicht das NAS oder eine Kamera, oder die Kamera kommt
    ins Internet hinaus. Standardmäßig lässt die Kette forward alles
    durch. Die richtige Methode: alles schließen (policy drop), dann nur
    öffnen, was gewollt ist, Zone für Zone.
zones-event-ssh =
    Vorsicht: Mit diesen Regeln würde eine neue ssh-Verbindung vom
    Admin-Rechner (192.0.2.2) von der Kette input abgelehnt. Deine aktuelle
    Sitzung hängt an einem seidenen Faden: Wenn sie abbricht, kommt
    niemand mehr in den Router (außer man schließt einen Bildschirm an).
    Lass ssh durch, bevor du den Rest schließt.
zones-event-in-place =
    Alles funktioniert so, wie Malik es wollte… fürs Erste. Aber was, wenn
    der Router neu startet, wie am Samstag? sysctl -w und nft auf der
    Kommandozeile halten nicht. Kernel-Einstellungen schreibt man nach
    /etc/sysctl.d (man sysctl.d), die Regeln nach /etc/nftables.conf, die
    der Dienst nftables beim Booten lädt… wenn er aktiviert ist.
zones-event-end =
    Die Büros kommen ins Internet und können drucken, das Café hat WLAN und
    sieht nur das, die Kameras bleiben zu Hause, und alles hält beim
    nächsten Neustart. Malik: „Sacha sagt, es ist das erste Mal, dass die
    Firewall irgendwo aufgeschrieben ist.“

    Gut gemacht! Du hast das Kapitel „Die Zonen“ abgeschlossen.

    WAS PASSIERT IST
    Ein Linux-Router leitet Pakete von einem Netz in ein anderes nur
    weiter, wenn er es darf (net.ipv4.ip_forward = 1). Die Adressen der
    VLANs sind privat: Um ins Internet zu kommen, ersetzt der Router die
    Quelladresse durch seine eigene (masquerade) und verzeichnet den
    Austausch, um die Antwort dem richtigen Gerät zurückzugeben
    (Verbindungsverfolgung, conntrack). Die Kette forward entscheidet, was
    durchkommt: Man schließt dort alles (policy drop), lässt Antworten
    zurückkommen (ct state established,related), dann öffnet man Zone für
    Zone (iifname, oifname).

    GUTE PRAXIS
    - Standardmäßig schließen, öffnen, was gewollt ist; Antworten nur
      einmal durchlassen, oben in der Kette.
    - Sich nie aussperren: ssh öffnen (Kette input), bevor man den Rest
      schließt, und mit nft -c testen, bevor man lädt.
    - Was halten muss, gehört in Dateien: /etc/sysctl.d,
      /etc/nftables.conf, und systemctl enable nftables.
    - Ein Beispiel für die Kette forward, für dieses Netz:

        chain forward {"{"}
            type filter hook forward priority filter; policy drop;
            ct state established,related accept
            iifname "eth1.10" accept
            iifname "eth1.20" oifname "eth0" accept
        {"}"}

    DOKUMENTATION
    - nft: https://www.netfilter.org/projects/nftables/manpage.html
    - NAT mit nftables: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - Ein Router für zu Hause: https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_home_router
    - sysctl.d: https://man7.org/linux/man-pages/man5/sysctl.d.5.html
