### Graded hints for The Blood Drive (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Failover That Didn't Happen

hint-no-failover-haproxy-dead =
    .lead = The site is down: is the load balancer's service running on lb1? Ask systemd about it.
    .solution = systemctl status haproxy (and journalctl -u haproxy)
hint-no-failover-vip-on-lb1 =
    .lead = Which load balancer holds the site's address, 192.0.2.108? Look at lb1's interfaces.
    .solution = ip a (the address is on eth0, "secondary")
hint-no-failover-no-tracking =
    .lead = What does keepalived watch on lb1? Read its configuration, and look for a check of haproxy (man keepalived.conf).
    .solution = cat /etc/keepalived/keepalived.conf
hint-no-failover-tracking =
    .lead = Add a vrrp_script that checks haproxy runs (with a weight that brings lb1 below lb2, or 0), track it in the vrrp_instance, check the file and reload keepalived.
    .solution = sudo nano /etc/keepalived/keepalived.conf: vrrp_script chk_haproxy with script "/usr/bin/killall -0 haproxy", interval 2, weight -20, and track_script with chk_haproxy in VI_1; sudo keepalived -t; sudo systemctl reload keepalived
hint-no-failover-failed-over =
    .lead = With haproxy dead on lb1, the check fails and the address should move: watch keepalived's journal and the interfaces of both nodes. If it doesn't move, is lb2 allowed to take it (nopreempt)?
    .solution = sudo journalctl -u keepalived; ip a; ssh lb2 and ip a; curl -s http://donate.lindenvale.example/
hint-no-failover-haproxy-back =
    .lead = Bring haproxy back on lb1 (systemd gave up on it after too many failures).
    .solution = sudo systemctl restart haproxy (or sudo systemctl reset-failed haproxy, then start)
hint-no-failover-lb2-tracked =
    .lead = A failover must work both ways: lb2 must watch its own haproxy the same way.
    .solution = ssh lb2; the same vrrp_script and track_script in its keepalived.conf; sudo keepalived -t; sudo systemctl reload keepalived
hint-no-failover-end =
    .lead = Prove it: stop haproxy on the master, see the address move and the site still answer, then start it again.
    .solution = sudo systemctl stop haproxy; sleep 10; ip a; curl -s http://donate.lindenvale.example/; sudo systemctl start haproxy

## Chapter 2 — The Sick Server

hint-sick-server-errors =
    .lead = Which server answers the errors? HAProxy's log says which server served each request; or ask the site several times.
    .solution = sudo tail /var/log/haproxy.log (or curl -si http://donate.lindenvale.example/ a few times: x-served-by)
hint-sick-server-no-check =
    .lead = Ask HAProxy, through its runtime socket, how it sees its servers (Teodor's message, man socat).
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f1,2,18,37
hint-sick-server-http-check =
    .lead = Give the servers a check that asks the app's /health page over HTTP and expects 200 (man haproxy; check, option httpchk, http-check expect), check the file, reload.
    .solution = in backend be_booking: option httpchk GET /health, http-check expect status 200, and check on each server line; sudo haproxy -c -f /etc/haproxy/haproxy.cfg; sudo systemctl reload haproxy
hint-sick-server-lb2-synced =
    .lead = lb2 must check the same way, in case it takes the address.
    .solution = ssh lb2; the same changes in /etc/haproxy/haproxy.cfg; sudo haproxy -c -f /etc/haproxy/haproxy.cfg; sudo systemctl reload haproxy
hint-sick-server-drained =
    .lead = Take web2 out of the pool on the master without editing the file: the runtime API can change a server's state (drain).
    .solution = echo "set server be_booking/web2 state drain" | sudo socat stdio /run/haproxy/admin.sock
hint-sick-server-tech-working =
    .lead = The technician waits until web2 has no session left: watch its scur in show stat.
    .solution = echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | grep web2 | cut -d, -f2,5,18
hint-sick-server-tech-done =
    .lead = Wait for the technician to finish (a minute or so): sleep, and watch HAProxy's log.
    .solution = sleep 30; sudo tail /var/log/haproxy.log
hint-sick-server-end =
    .lead = web2 is repaired: put it back in the pool through the runtime API.
    .solution = echo "set server be_booking/web2 state ready" | sudo socat stdio /run/haproxy/admin.sock

## Chapter 3 — Split Brain

hint-split-brain-two-masters =
    .lead = Who holds 192.0.2.108? Look on both load balancers.
    .solution = ip a; ssh lb2 and ip a
hint-split-brain-lower-priority =
    .lead = Ask keepalived on lb1 what it hears.
    .solution = sudo journalctl -u keepalived -n 30
hint-split-brain-on-the-wire =
    .lead = Does lb2 receive lb1's advertisements? Capture VRRP on lb2's eth0 (man tcpdump).
    .solution = on lb2: sudo tcpdump -i eth0 -c 10 vrrp
hint-split-brain-ruleset =
    .lead = The adverts reach the card but not keepalived: look at lb2's firewall.
    .solution = on lb2: sudo nft list ruleset
hint-split-brain-single-master =
    .lead = Let VRRP (IP protocol 112, to 224.0.0.18) into lb2's input chain (man nft).
    .solution = on lb2: sudo nft add rule inet filter input ip protocol vrrp accept
hint-split-brain-persisted =
    .lead = A rule added with nft is gone at the next boot: write it in /etc/nftables.conf, check it, and load it.
    .solution = on lb2: sudo nano /etc/nftables.conf (ip protocol vrrp accept in chain input); sudo nft -c -f /etc/nftables.conf; sudo systemctl restart nftables
hint-split-brain-clash =
    .lead = Who else speaks VRRP on this link? Capture on lb1, or read keepalived's journal for "bogus" packets.
    .solution = sudo tcpdump -i eth0 -c 10 vrrp; sudo journalctl -u keepalived | grep bogus
hint-split-brain-vrid =
    .lead = Move your pair off the routers' virtual_router_id, the same new value on both nodes (or use unicast_peer on both), and reload keepalived on both.
    .solution = virtual_router_id 61 in /etc/keepalived/keepalived.conf on lb1 and on lb2; sudo keepalived -t; sudo systemctl reload keepalived (on both)
hint-split-brain-end =
    .lead = Check that one node holds the address and the other is BACKUP, and that the site answers every time.
    .solution = ip a on both; sudo journalctl -u keepalived -n 5; curl -s http://donate.lindenvale.example/
