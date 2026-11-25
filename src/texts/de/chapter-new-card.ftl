### Geschichte „Die Fähre“, Kapitel „Die neue Karte“: Die SLAAC-Adresse von
### kai ist seiner neuen Netzwerkkarte gefolgt, die AAAA-Einträge nennen
### noch die alte. ip -6, link-lokal und %eth0, eine statische Adresse
### (inet6 static), die BIND-Zone und ihre Seriennummer. Befehle,
### Optionen, Adressen, Pfade und Ausgaben werden nicht übersetzt.

chapter-new-card = Die neue Karte
    .summary = Seit der Server der Fährgenossenschaft eine neue Netzwerkkarte hat, antwortet seine Website nicht mehr in IPv6, nur für Fahrgäste mit mobilen Daten. Seine IPv6-Adressen und Routen lesen, ihm eine Adresse geben, die nicht mehr wandert, und sie in der DNS-Zone veröffentlichen.

## Dateien

new-card-message-amaru =
    Von: Amaru (Fährgenossenschaft)
    Dienstag, 10. April, 9:00

    Hallo, und willkommen an Bord!

    Mit der Website stimmt seit letzter Woche etwas nicht, und nur für
    manche Leute. Im WLAN des Büros erscheint der Fahrplan sofort. Auf
    meinem Handy, mit mobilen Daten, dreht es sich lange; manchmal
    erscheint er am Ende, manchmal heißt es, die Website sei nicht
    erreichbar. Fahrgäste haben deswegen angerufen.

    Letzten Dienstag ist die Netzwerkkarte des Servers gestorben. Der
    Computerladen auf dem Festland hat eine neue eingebaut, und alles lief
    wieder. Seitdem, glaube ich. Tevita, der den Server eingerichtet hat,
    ist aufs Festland gezogen; er hat mir am Telefon gesagt, dass das
    Internet der Insel vor einem Monat „auf IPv6 gegangen“ ist und dass er
    „das AAAA hinzugefügt“ hat.

    Rangi von islenet hat eine E-Mail über Adressen geschickt: Sie liegt
    in deinem Home-Verzeichnis. islenet leiht uns auch seine
    Überwachungsbox, ausguck, um den Server von außen anzusehen (ssh
    ausguck).

    Amaru

new-card-email-rangi =
    Von: Rangi (islenet, die Glasfasergenossenschaft der Insel)
    An: die Fährgenossenschaft
    Betreff: IPv6, die Adresse eures Servers

    Hallo,

    Wie angekündigt ist IPv6 seit dem 5. März eingeschaltet. Unser Router
    kündigt das Präfix eures Links an, { $prefix }, und euer Server baut
    darin seine eigene Adresse (SLAAC). Für einen Laptop ist das in
    Ordnung. Für einen Server, dessen Adresse im DNS steht, empfehle ich
    eine feste: Wir halten { $address } in unseren Unterlagen für euch
    frei. Unser Router ist auf diesem Link 2001:db8:4e1:20::1 (als Gateway
    seht ihr seine link-lokale Adresse).

    Eure DNS-Zone gehört weiter euch: ns1 ist euer Server, und
    ns2.islenet.example, unser Secondary, kopiert die Zone, wenn ihre
    Seriennummer steigt.

    Rangi

## Ereignisse

new-card-event-addresses =
    eth0 hat drei Arten von IPv6-Adressen. fe80::…/64, „scope link“: die
    link-lokale Adresse, die sich jede IPv6-Schnittstelle selbst gibt und
    die nur auf ihrem eigenen Link gilt. 2001:db8:4e1:20:…/64, „scope
    global dynamic“: eine globale Adresse, von SLAAC gebaut, aus dem
    Präfix des Routers (die ersten 64 Bits) und einer Kennung, die die
    Maschine selbst berechnet. Und lo hat ::1. Sieh dir das Ende der beiden
    eth0-Adressen genau an, und die MAC-Adresse der Karte (ip link).
new-card-event-mac =
    Die MAC-Adresse der neuen Karte ist 00:00:5e:00:53:7c. Füg ff:fe in
    der Mitte ein, kipp ein Bit des ersten Bytes (aus 00 wird 02):
    0200:5eff:fe00:537c. Das ist das Ende beider eth0-Adressen: die
    Schnittstellenkennung „modified EUI-64“. Neue Karte, neue MAC, also
    eine neue IPv6-Adresse.
new-card-event-route =
    Die IPv6-Standardroute geht „via fe80::200:5eff:fe00:5301 dev eth0
    proto ra“: über die link-lokale Adresse des Routers, aus seinen
    Ankündigungen gelernt (ra: router advertisement). Eine link-lokale
    Adresse existiert auf jedem Link gleichzeitig: Um sie zu erreichen,
    muss man sagen, auf welchem.
new-card-event-zone-needed =
    ping weiß nicht, auf welchem Link es eine link-lokale Adresse schicken
    soll: Jede Schnittstelle hat ihr eigenes fe80::/64. Häng die
    Schnittstelle nach einem % an: fe80::200:5eff:fe00:5301%eth0 (oder ping
    -I eth0).
new-card-event-router =
    Der Router antwortet auf seiner link-lokalen Adresse: Der Link
    funktioniert in IPv6. Der Server ist also erreichbar... unter seiner
    neuen Adresse. Was gibt das DNS heraus? (dig, der Typ AAAA)
new-card-event-old-record =
    Da ist es: Das DNS gibt immer noch 2001:db8:4e1:20:200:5eff:fe00:532a
    heraus, die Adresse, die die alte Karte gebaut hat (ihre MAC endete
    auf 53:2a). Niemand hat diese Adresse mehr: Handys, die zuerst IPv6
    versuchen, warten auf nichts und fallen dann auf IPv4 zurück, wenn sie
    können. Rangis Rat: eine Adresse, die nicht von der Karte abhängt.
new-card-event-cut =
    Die ssh-Sitzung ist abgebrochen: ifdown eth0 hat genau die
    Schnittstelle heruntergefahren, über die du verbunden warst. Amaru hat
    im Büro am Bildschirm des Servers ifup eth0 getippt, und es läuft
    wieder (ssh kai). Über ssh ändert man eine Adresse mit ip, oder bringt
    das Netz in einem Zug wieder hoch (systemctl restart networking), nie
    ifdown allein.
new-card-event-already =
    ifup lehnt ab: eth0 ist schon oben (ifupdown merkt es sich in
    /run/network/ifstate). Um die Datei anzuwenden, ohne deine eigene
    Sitzung zu kappen, fährt systemctl restart networking alles in einem
    Zug herunter und wieder hoch; oder füg die Adresse sofort mit ip -6
    addr add hinzu und lass die Datei für den nächsten Boot.
new-card-event-wrong-prefix =
    Diese Adresse liegt nicht im Präfix des Links ({ $prefix }): Der Router
    wird ihr nie etwas schicken. Lösch sie (ip -6 addr del, und die Datei)
    und nimm eine im Präfix, die, die Rangi für euch freihält.
new-card-event-static-now =
    eth0 trägt jetzt eine feste Adresse im Präfix, neben der SLAAC-Adresse.
    Sie ist nur bis zum nächsten Neustart da: Schreib sie in
    /etc/network/interfaces (ein Abschnitt „iface eth0 inet6 static“, man
    interfaces).
new-card-event-static-boot =
    Beim nächsten Boot gibt ifupdown eth0 seine feste Adresse, und die
    IPv6-Route ist weiterhin da. Jetzt das DNS.
new-card-event-no-route-boot =
    Vorsicht: Mit dieser Datei würde eth0 mit seiner Adresse booten, aber
    ohne IPv6-Standardroute (accept_ra 0 lehnt die Ankündigungen des
    Routers ab, und es gibt kein Gateway). Füg das Gateway hinzu (die
    link-lokale Adresse des Routers), oder lass accept_ra in Ruhe.
new-card-event-no-route =
    kai hat keine IPv6-Standardroute mehr: Es erreicht nur noch seinen
    eigenen Link. Hol die Ankündigungen des Routers zurück (accept_ra),
    oder gib ein Gateway an: ip -6 route add default via
    fe80::200:5eff:fe00:5301 dev eth0.
new-card-event-zone-loaded =
    named hat die neue Zone geladen: dig @localhost gibt die neue Adresse.
    Und der Rest des Internets? Er fragt auch ns2.islenet.example.
new-card-event-serial =
    Dein Server gibt die neue Adresse heraus, aber ns2.islenet.example, der
    Secondary, gibt noch die alte: Er kopiert die Zone nur, wenn ihre
    Seriennummer (die erste Zahl des SOA) steigt. Erhöhe sie (die
    Konvention: das Datum und ein Zähler, 2029041001), prüfe die Datei
    (named-checkzone), rndc reload.
new-card-event-slaac-record =
    Das DNS gibt jetzt die Adresse heraus, die aus der neuen Karte gebaut
    wurde. Heute funktioniert das, und beim nächsten Wechsel der Karte
    (oder des Mainboards) bricht es wieder. Die Adresse eines Servers im
    DNS sollte eine feste sein.
new-card-event-published =
    Die öffentlichen Server der Zone geben die feste Adresse von kai
    heraus, für ferry.example, www und kai. ausguck kann es von außen
    prüfen (ssh ausguck, dann ping6 www.ferry.example).
new-card-event-seen-outside =
    Aus dem Internet antwortet www.ferry.example auf ping in IPv6, unter
    seiner festen Adresse.
new-card-event-end =
    Amaru: „Auf meinem Handy erscheint der Fahrplan jetzt sofort. Danke!“
    (Unter uns: Sein Handy bekommt die Seite immer noch in IPv4: Probier
    curl -6 von ausguck aus. Das ist etwas für einen anderen Tag.)

    Gut gemacht! Du hast Kapitel 1 von Die Fähre abgeschlossen. (Was als
    Nächstes kommt, wartet auf dich: ssh kai.)

    WAS PASSIERT IST
    kai hat seine IPv6-Adresse selbst gebaut (SLAAC): das Präfix, das der
    Router ankündigt, dann eine Kennung, berechnet aus der MAC-Adresse der
    Netzwerkkarte (modified EUI-64). Die neue Karte hat eine neue Adresse
    mitgebracht, aber die AAAA-Einträge nannten noch die alte: IPv6-Clients
    haben an eine Adresse geklopft, die niemand hatte. Du hast kai eine
    feste Adresse gegeben, { $address }, sofort (ip -6 addr add) und beim
    Booten (iface eth0 inet6 static), und sie veröffentlicht: die
    AAAA-Einträge, eine höhere Seriennummer, named-checkzone, rndc reload.

    GUTE PRAXIS
    - Ein Server im DNS bekommt eine feste IPv6-Adresse; SLAAC ist für
      Maschinen, die niemand beim Namen sucht.
    - ip -6 addr: scope link (fe80::, auf einem Link gültig) und scope
      global; ip -6 route: Das Gateway ist oft die link-lokale Adresse des
      Routers.
    - Eine link-lokale Adresse braucht ihre Schnittstelle: fe80::…%eth0.
    - Über ssh nie ifdown auf die Schnittstelle, über die du verbunden bist.
    - Jede Änderung einer Zone erhöht ihre Seriennummer, sonst behalten
      die Secondaries die alte Version.
    - Von außen prüfen, in jeder Familie: ping -6, curl -6.

    DOKUMENTATION
    - SLAAC (RFC 4862): https://www.rfc-editor.org/rfc/rfc4862
    - Die Datei interfaces, Familie inet6: https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - ip address: https://man7.org/linux/man-pages/man8/ip-address.8.html
    - BIND 9, Zonendateien: https://bind9.readthedocs.io/en/stable/chapter3.html
