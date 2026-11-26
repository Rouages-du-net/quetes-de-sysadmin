### Abgestufte Hinweise für Die Fähre (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung,
### ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Die neue Karte

hint-new-card-addresses =
    .lead = Sieh dir die IPv6-Adressen des Servers an, Schnittstelle für Schnittstelle (man ip; -6 behält eine Familie).
    .solution = ip -6 addr (oder ip a)
hint-new-card-route =
    .lead = Wo verlässt der IPv6-Verkehr die Maschine Richtung Internet? Die Routen, Familie IPv6 (man ip).
    .solution = ip -6 route
hint-new-card-router =
    .lead = Ping das Gateway der IPv6-Route. Es ist eine link-lokale Adresse: Sie braucht ihre Schnittstelle (man ping).
    .solution = ping -6 -c 3 fe80::200:5eff:fe00:5301%eth0
hint-new-card-old-record =
    .lead = Welche IPv6-Adresse gibt das DNS für die Website heraus? Frag nach dem AAAA-Eintrag (man dig).
    .solution = dig www.ferry.example AAAA
hint-new-card-static-now =
    .lead = Gib eth0 sofort die feste Adresse, die Rangi für euch freihält, im Präfix (man ip, die Aktion addr add).
    .solution = sudo ip -6 addr add 2001:db8:4e1:20::80/64 dev eth0
hint-new-card-static-boot =
    .lead = Mach es dauerhaft: ein Abschnitt inet6 static für eth0 in /etc/network/interfaces, mit der Adresse und ihrer Präfixlänge (man interfaces).
    .solution = sudo nano /etc/network/interfaces, hinzufügen: iface eth0 inet6 static, dann address 2001:db8:4e1:20::80/64 und gateway fe80::200:5eff:fe00:5301 (eingerückt).
hint-new-card-zone-loaded =
    .lead = Die Zonendatei von ferry.example liegt in /etc/bind/zones: Ersetze die alte Adresse in ihren AAAA-Einträgen, prüfe die Datei und lass named sie neu lesen (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/zones/db.ferry.example (die AAAA-Einträge), sudo named-checkzone ferry.example /etc/bind/zones/db.ferry.example, sudo rndc reload
hint-new-card-published =
    .lead = Der Secondary der Zone kopiert eine Zone nur, wenn ihre Seriennummer (die erste Zahl des SOA) gestiegen ist. Vergleiche, was beide Server herausgeben (dig @…).
    .solution = Erhöhe die Seriennummer (2029041001), sudo rndc reload, dann dig @ns2.islenet.example www.ferry.example AAAA
hint-new-card-end =
    .lead = Alles muss zusammenpassen: die feste Adresse jetzt und beim Booten, eine IPv6-Standardroute und die drei Namen (ferry.example, www, kai), die diese Adresse herausgeben.
    .solution = ip -6 route (eine Standardroute), ip -6 addr, dig @ns2.islenet.example kai.ferry.example AAAA

## Kapitel 2 — Die andere Tür

hint-other-door-scan6 =
    .lead = Scanne kai von ausguck aus in IPv6, wie islenet es getan hat (man nmap, die Option -6).
    .solution = ssh ausguck, dann nmap -6 kai.ferry.example
hint-other-door-scan4 =
    .lead = Derselbe Scan, in IPv4, zum Vergleich.
    .solution = nmap kai.ferry.example
hint-other-door-sockets =
    .lead = Auf kai: Welche Programme lauschen, auf welchen Adressen (man ss)?
    .solution = sudo ss -tlnp
hint-other-door-ruleset =
    .lead = Lies die Regeln der Firewall und achte darauf, zu welcher Familie ihre Tabelle gehört (man nft).
    .solution = sudo nft list ruleset (oder cat /etc/nftables.conf)
hint-other-door-closed-now =
    .lead = Eine Tabelle für beide Familien (inet), dieselben Regeln, plus das ICMPv6, das die Nachbarerkennung braucht; lade die Datei (man nft).
    .solution = sudo nano /etc/nftables.conf: table inet filter, und icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, packet-too-big, echo-request {"}"} accept; dann sudo nft -c -f /etc/nftables.conf und sudo systemctl reload nftables
hint-other-door-closed-boot =
    .lead = Was geladen ist, muss sein, was die Datei sagt: Der Dienst nftables lädt /etc/nftables.conf beim Booten.
    .solution = Schreib die Regeln in /etc/nftables.conf, dann sudo systemctl reload nftables
hint-other-door-end =
    .lead = Prüfe von ausguck aus, in beiden Familien: ssh, DNS und die Website kommen durch, 5432 und 8080 nicht; und IPv6 muss an bleiben.
    .solution = nmap -6 -p 22,53,80,5432,8080 kai.ferry.example, dann dasselbe ohne -6

## Kapitel 3 — In beide Richtungen

hint-both-ways-refused6 =
    .lead = Frag die Website von ausguck aus nur in IPv6 an und beobachte die Verbindung (man curl: -6, -v).
    .solution = ssh ausguck, dann curl -6 -v http://www.ferry.example/
hint-both-ways-sockets =
    .lead = Auf kai: Wer lauscht auf Port 80, und die App auf 3000, auf welchen Adressen (man ss)?
    .solution = sudo ss -tlnp
hint-both-ways-bad-gateway =
    .lead = Frag die Buchungsseite an, über nginx (man curl).
    .solution = curl -i http://localhost/booking/
hint-both-ways-error-log =
    .lead = nginx schreibt in sein Fehlerlog, warum es die App nicht erreichen konnte.
    .solution = sudo tail /var/log/nginx/error.log
hint-both-ways-listen6 =
    .lead = Der server-Block von /etc/nginx/sites-available/ferry lauscht auf Port 80 nur in IPv4: Füg ein listen für IPv6 hinzu, prüfe, lade neu (man nginx).
    .solution = Füg listen [::]:80 default_server; unter listen 80 default_server; hinzu, dann sudo nginx -t und sudo systemctl reload nginx
hint-both-ways-upstream-ok =
    .lead = nginx und die App müssen sich auf eine Loopback-Adresse einigen: entweder proxy_pass auf [::1], oder die App zurück auf 127.0.0.1 (/etc/default/booking).
    .solution = sudo nano /etc/default/booking: HOST=127.0.0.1, dann sudo systemctl restart booking (oder proxy_pass http://[::1]:3000/; und ein Reload von nginx)
hint-both-ways-end =
    .lead = Prüfe von ausguck aus, in jeder Familie: den Fahrplan und die Buchungsseite.
    .solution = curl -4 http://www.ferry.example/booking/ und curl -6 http://www.ferry.example/booking/
