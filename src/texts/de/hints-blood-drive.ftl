### Graded hints for The Blood Drive (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — The Failover That Didn't Happen

hint-no-failover-haproxy-dead =
    .lead = Die Site ist tot: läuft der Dienst des Load Balancers auf lb1? Frag systemd danach.
    .solution = systemctl status haproxy (und journalctl -u haproxy)
hint-no-failover-vip-on-lb1 =
    .lead = Welcher Load Balancer hält die Adresse der Site, 192.0.2.108? Schau dir die Schnittstellen von lb1 an.
    .solution = ip a (die Adresse liegt auf eth0, „secondary“)
hint-no-failover-no-tracking =
    .lead = Was überwacht keepalived auf lb1? Lies seine Konfiguration und such nach einer Prüfung von haproxy (man keepalived.conf).
    .solution = cat /etc/keepalived/keepalived.conf
hint-no-failover-tracking =
    .lead = Füge ein vrrp_script hinzu, das prüft, dass haproxy läuft (mit einem Gewicht, das lb1 unter lb2 bringt, oder 0), verfolge es in der vrrp_instance, prüfe die Datei und lade keepalived neu.
    .solution = sudo nano /etc/keepalived/keepalived.conf: vrrp_script chk_haproxy mit script "/usr/bin/killall -0 haproxy", interval 2, weight -20, und track_script mit chk_haproxy in VI_1; sudo keepalived -t; sudo systemctl reload keepalived
hint-no-failover-failed-over =
    .lead = Mit totem haproxy auf lb1 scheitert die Prüfung, und die Adresse sollte umziehen: beobachte das Journal von keepalived und die Schnittstellen beider Nodes. Wenn sie nicht umzieht: darf lb2 sie nehmen (nopreempt)?
    .solution = sudo journalctl -u keepalived; ip a; ssh lb2 und ip a; curl -s http://donate.lindenvale.example/
hint-no-failover-haproxy-back =
    .lead = Bring haproxy auf lb1 zurück (systemd hat nach zu vielen Fehlschlägen aufgegeben).
    .solution = sudo systemctl restart haproxy (oder sudo systemctl reset-failed haproxy, dann start)
hint-no-failover-lb2-tracked =
    .lead = Eine Umschaltung muss in beide Richtungen funktionieren: lb2 muss sein eigenes haproxy genauso überwachen.
    .solution = ssh lb2; dasselbe vrrp_script und track_script in seiner keepalived.conf; sudo keepalived -t; sudo systemctl reload keepalived
hint-no-failover-end =
    .lead = Beweise es: stoppe haproxy auf dem Master, sieh zu, wie die Adresse umzieht und die Site weiter antwortet, dann starte es wieder.
    .solution = sudo systemctl stop haproxy; sleep 10; ip a; curl -s http://donate.lindenvale.example/; sudo systemctl start haproxy

## Chapter 2 — The Sick Server

hint-sick-server-errors =
    .lead = Welcher Server antwortet mit den Fehlern? Das Log von HAProxy sagt, welcher Server jede Anfrage bedient hat; oder frag die Site mehrmals.
    .solution = sudo tail /var/log/haproxy.log (oder ein paarmal curl -si http://donate.lindenvale.example/: x-served-by)
hint-sick-server-no-check =
    .lead = Frag HAProxy über seinen Runtime-Socket, wie es seine Server sieht (Teodors Nachricht, man socat).
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f1,2,18,37
hint-sick-server-http-check =
    .lead = Gib den Servern eine Prüfung, die über HTTP die Seite /health der App abfragt und 200 erwartet (man haproxy; check, option httpchk, http-check expect), prüfe die Datei, lade neu.
    .solution = im backend be_booking: option httpchk GET /health, http-check expect status 200, und check auf jeder server-Zeile; sudo haproxy -c -f /etc/haproxy/haproxy.cfg; sudo systemctl reload haproxy
hint-sick-server-lb2-synced =
    .lead = lb2 muss genauso prüfen, falls es die Adresse übernimmt.
    .solution = ssh lb2; dieselben Änderungen in /etc/haproxy/haproxy.cfg; sudo haproxy -c -f /etc/haproxy/haproxy.cfg; sudo systemctl reload haproxy
hint-sick-server-drained =
    .lead = Nimm web2 auf dem Master aus dem Pool, ohne die Datei zu bearbeiten: die Runtime-API kann den Zustand eines Servers ändern (drain).
    .solution = echo "set server be_booking/web2 state drain" | sudo socat stdio /run/haproxy/admin.sock
hint-sick-server-tech-working =
    .lead = Der Techniker wartet, bis web2 keine Sitzung mehr hat: beobachte sein scur in show stat.
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | grep web2 | cut -d, -f2,5,18
hint-sick-server-tech-done =
    .lead = Warte, bis der Techniker fertig ist (etwa eine Minute): sleep, und beobachte das Log von HAProxy.
    .solution = sleep 30; sudo tail /var/log/haproxy.log
hint-sick-server-end =
    .lead = web2 ist repariert: setz ihn über die Runtime-API wieder in den Pool.
    .solution = echo "set server be_booking/web2 state ready" | sudo socat stdio /run/haproxy/admin.sock

## Chapter 3 — Split Brain

hint-split-brain-two-masters =
    .lead = Wer hält 192.0.2.108? Schau auf beiden Load Balancern nach.
    .solution = ip a; ssh lb2 und ip a
hint-split-brain-lower-priority =
    .lead = Frag keepalived auf lb1, was es hört.
    .solution = sudo journalctl -u keepalived -n 30
hint-split-brain-on-the-wire =
    .lead = Empfängt lb2 die Advertisements von lb1? Zeichne VRRP auf eth0 von lb2 auf (man tcpdump).
    .solution = auf lb2: sudo tcpdump -i eth0 -c 10 vrrp
hint-split-brain-ruleset =
    .lead = Die Advertisements erreichen die Karte, aber nicht keepalived: schau dir die Firewall von lb2 an.
    .solution = auf lb2: sudo nft list ruleset
hint-split-brain-single-master =
    .lead = Lass VRRP (IP-Protokoll 112, an 224.0.0.18) in die input-Chain von lb2 (man nft).
    .solution = auf lb2: sudo nft add rule inet filter input ip protocol vrrp accept
hint-split-brain-persisted =
    .lead = Eine mit nft hinzugefügte Regel ist beim nächsten Start weg: schreib sie in /etc/nftables.conf, prüfe sie und lade sie.
    .solution = auf lb2: sudo nano /etc/nftables.conf (ip protocol vrrp accept in chain input); sudo nft -c -f /etc/nftables.conf; sudo systemctl restart nftables
hint-split-brain-clash =
    .lead = Wer spricht sonst noch VRRP auf diesem Link? Zeichne auf lb1 auf, oder lies im Journal von keepalived die „bogus“-Pakete.
    .solution = sudo tcpdump -i eth0 -c 10 vrrp; sudo journalctl -u keepalived | grep bogus
hint-split-brain-vrid =
    .lead = Beweg dein Paar weg von der virtual_router_id der Router, derselbe neue Wert auf beiden Nodes (oder unicast_peer auf beiden), und lade keepalived auf beiden neu.
    .solution = virtual_router_id 61 in /etc/keepalived/keepalived.conf auf lb1 und auf lb2; sudo keepalived -t; sudo systemctl reload keepalived (auf beiden)
hint-split-brain-end =
    .lead = Prüfe, dass ein Node die Adresse hält und der andere BACKUP ist, und dass die Site jedes Mal antwortet.
    .solution = ip a auf beiden; sudo journalctl -u keepalived -n 5; curl -s http://donate.lindenvale.example/
