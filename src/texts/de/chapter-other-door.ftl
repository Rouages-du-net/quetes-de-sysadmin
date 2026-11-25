### Geschichte „Die Fähre“, Kapitel „Die andere Tür“: Die Firewall ist eine
### „table ip“, also geht IPv6 unberührt durch: PostgreSQL und die
### Admin-Seiten sind aus dem Internet über IPv6 offen. nmap -6, ss,
### nftables-Familien (inet), ICMPv6. Befehle, Optionen, Adressen, Pfade
### und Ausgaben werden nicht übersetzt.

chapter-other-door = Die andere Tür
    .summary = Der monatliche Scan der Glasfasergenossenschaft findet die Datenbank und die Admin-Seiten der Buchungs-App auf dem Server der Fähre offen, aber nur in IPv6. Beide Ansichten von außen vergleichen, finden, warum die Firewall IPv6 durchlässt, und eine Richtlinie für beide Familien schreiben, ohne IPv6 abzuschneiden.

## Dateien

other-door-message-amaru =
    Von: Amaru (Fährgenossenschaft)
    Donnerstag, 12. April, 13:50

    Hallo noch einmal,

    Rangi hat den monatlichen Scan von islenet über die Server seiner
    Mitglieder weitergeleitet (er liegt in deinem Home-Verzeichnis). Seit
    IPv6 scannen sie beides. Er hat einen Satz darübergeschrieben: „Eure
    Datenbank ist in IPv6 für das ganze Internet offen. Nicht in IPv4.“

    Ich verstehe das nicht: Tevita hat mir gesagt, die Firewall schließt
    alles außer der Website und ssh. Die Datenbank darf nur vom
    Buchungsschalter gelesen werden, hier im Hafenbüro (198.51.100.40).
    Und die Admin-Seiten der Buchungs-App sind für uns, nicht für die
    Welt.

    Könntest du nachsehen? ausguck ist immer noch da, um von außen zu
    schauen.

    Amaru

other-door-scan-report =
    islenet, monatlicher Scan der Server der Mitglieder, April 2029
    Mitglied: Fährgenossenschaft, Server kai.ferry.example

    IPv4 192.0.2.52
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    open      http
      5432/tcp  filtered  postgresql
      8080/tcp  filtered  http-proxy

    IPv6 { $address }
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    closed    http
      5432/tcp  open      postgresql    <-- !
      8080/tcp  open      http-proxy    <-- !

    Zur Erinnerung: Ein Dienst, den nur das Büro benutzt, sollte aus dem
    Internet nicht erreichbar sein, in keiner der beiden Familien.

## Ereignisse

other-door-event-scan6 =
    Aus dem Internet gesehen, in IPv6, antwortet PostgreSQL (5432). Jetzt
    derselbe Scan in IPv4 (nmap ohne -6), zum Vergleich.
other-door-event-scan4 =
    In IPv4 ist 5432 „filtered“: Etwas verwirft die Pakete. Tevitas
    Firewall tut ihre Arbeit, in IPv4. Zwei Türen, eine bewacht. Auf kai:
    Wer lauscht, und auf welchen Adressen? (ss -tlnp)
other-door-event-sockets =
    PostgreSQL lauscht zweimal: 0.0.0.0:5432 (jede IPv4-Adresse) und
    auf [::]:5432 (jede IPv6-Adresse). Die Admin-Seiten lauschen auf *:8080: ein
    IPv6-Socket, der auch IPv4 annimmt (IPV6_V6ONLY aus). Daran ist nichts
    falsch: Das Büro braucht die Datenbank. Es ist Aufgabe der Firewall,
    zu wählen, wer hereinkommt. Lies ihre Regeln (nft list ruleset).
other-door-event-ruleset =
    „table ip filter“: Eine Tabelle der Familie ip sieht nur IPv4-Pakete.
    IPv6-Pakete gehen durch die Familie ip6, und die Familie inet bedient
    beide. Hier gibt es keine Tabelle ip6 oder inet: In IPv6 wird
    überhaupt nichts gefiltert. Eine Richtlinie für beide Familien: eine
    table inet (man nft).
other-door-event-disabled =
    IPv6 ist aus: Die offenen Ports sind versteckt, aber die AAAA-Einträge
    schicken IPv6-Besucher weiter zu kai, und die laufen jetzt gegen eine
    Wand. Und es wieder einzuschalten (sysctl -w …disable_ipv6=0) bringt
    die link-lokale und die SLAAC-Adresse zurück, nicht die feste: Die kommt
    mit ip -6 addr add zurück (oder systemctl restart networking). Die
    Firewall ist der Ort, wo man das repariert.
other-door-event-nd-dropped =
    kai antwortet in IPv6 auf gar nichts mehr, nicht einmal auf ping oder
    ssh: Der Router fragt mit einer ICMPv6-Nachbaranfrage „Wer hat
    2001:db8:4e1:20::80?“, und deine Input-Kette verwirft sie. IPv4 hat ARP
    außerhalb der Firewall; IPv6 macht das mit ICMPv6, also müssen die
    Regeln es hereinlassen: icmpv6 type {"{"} nd-neighbor-solicit,
    nd-neighbor-advert, nd-router-advert {"}"} accept (RFC 4890 listet die
    anderen auf, die es wert sind, behalten zu werden: packet-too-big…).
other-door-event-v6-stricter =
    Ein Dienst, der in IPv4 durchkommt, kommt in IPv6 nicht mehr durch: Eine
    Regel der IPv4-Tabelle fehlt in der IPv6-Tabelle. Das ist die Falle
    zweier von Hand gepflegter Kopien: Eine table inet enthält einen Satz
    Regeln für beide.
other-door-event-office-cut =
    Der Buchungsschalter (198.51.100.40, IPv4) erreicht die Datenbank nicht
    mehr: Behalte seine Regel (ip saddr 198.51.100.40 tcp dport 5432
    accept).
other-door-event-ssh-cut =
    Der Rechner würde ssh nicht mehr erreichen: Lass Port 22 offen.
other-door-event-closed-now =
    Der geladene Regelsatz hält jetzt in beiden Familien: ssh, DNS und die
    Website kommen durch, die Datenbank und die Admin-Seiten nicht, das
    Büro liest weiter, und die Nachbarerkennung kommt durch. Vorerst: Der
    Dienst nftables lädt /etc/nftables.conf beim Booten (und beim Reload).
other-door-event-not-saved =
    Die jetzt geladenen Regeln sind nicht die aus /etc/nftables.conf: Beim
    nächsten Neustart (oder systemctl reload nftables) öffnet sich die
    IPv6-Tür wieder. Schreib sie in die Datei, prüf sie mit nft -c -f und
    lade sie dann.
other-door-event-closed-boot =
    /etc/nftables.conf enthält die Richtlinie für beide Familien, und der
    Dienst nftables ist aktiv: Er lädt sie beim Booten.
other-door-event-end =
    Rangi: „Zweiter Scan heute Morgen: 5432 und 8080 gefiltert in IPv4 und
    in IPv6. Sauber.“ Amaru: „Und der Buchungsschalter funktioniert
    weiter. Perfekt.“

    Gut gemacht! Du hast Kapitel 2 von Die Fähre abgeschlossen. (Was als
    Nächstes kommt, wartet auf dich: ssh kai.)

    WAS PASSIERT IST
    Die Firewall von kai war eine Tabelle der Familie ip: Sie hat immer nur
    IPv4 gesehen. Als IPv6 kam, wurde jeder Dienst, der auf [::] oder *
    lauscht, in IPv6 ganz ohne Filter erreichbar: die Datenbank, die
    Admin-Seiten. Du hast beide Familien von außen verglichen (nmap, nmap
    -6), die Sockets gesehen (ss -tlnp) und eine Richtlinie für beide
    geschrieben, in einer table inet, mit dem ICMPv6, ohne das IPv6 nicht
    leben kann, in der Datei und geladen.

    GUTE PRAXIS
    - IPv6 einzuschalten heißt, die Firewall in IPv6 zu prüfen: beide
      Familien scannen, von außen.
    - nftables: Eine table inet enthält die Regeln beider Familien; ip
      saddr passt nur auf IPv4, ip6 saddr nur auf IPv6.
    - ICMPv6 nie pauschal verwerfen: Nachbarerkennung und
      Router-Ankündigungen laufen darüber (RFC 4890).
    - IPv6 abzuschalten, um ein Loch zu verstecken, macht kaputt, was davon
      abhängt (die AAAA-Einträge): Repariere stattdessen den Filter.
    - ufw: IPV6=yes in /etc/default/ufw; Regeln, die hinzugefügt wurden,
      als es „no“ war, existieren nur für IPv4.
    - Lieber ein Dienst, der nur dort lauscht, wo es nötig ist (127.0.0.1,
      ::1), als eine Firewall, die ihn versteckt.

    DOKUMENTATION
    - nftables-Familien: https://wiki.nftables.org/wiki-nftables/index.php/Nftables_families
    - Ein einfacher Regelsatz für einen Server: https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_server
    - ICMPv6 filtern (RFC 4890): https://www.rfc-editor.org/rfc/rfc4890
    - nmap und IPv6: https://nmap.org/book/man-ipv6.html
