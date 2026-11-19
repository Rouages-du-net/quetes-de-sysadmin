### Graded hints for The Ferry (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The New Card

hint-new-card-addresses =
    .lead = Look at the server's IPv6 addresses, interface by interface (man ip; -6 keeps one family).
    .solution = ip -6 addr (or ip a)
hint-new-card-route =
    .lead = Where does IPv6 traffic leave for the internet? The routes, IPv6 family (man ip).
    .solution = ip -6 route
hint-new-card-router =
    .lead = Ping the gateway of the IPv6 route. It is a link-local address: it needs its interface (man ping).
    .solution = ping -6 -c 3 fe80::200:5eff:fe00:5301%eth0
hint-new-card-old-record =
    .lead = Which IPv6 address does the DNS give for the site? Ask for the AAAA record (man dig).
    .solution = dig www.ferry.example AAAA
hint-new-card-static-now =
    .lead = Give eth0 the fixed address Rangi keeps for you, in the prefix, right away (man ip, the addr add action).
    .solution = sudo ip -6 addr add 2001:db8:4e1:20::80/64 dev eth0
hint-new-card-static-boot =
    .lead = Make it last: an inet6 static stanza for eth0 in /etc/network/interfaces, with the address and its prefix length (man interfaces).
    .solution = sudo nano /etc/network/interfaces, add: iface eth0 inet6 static, then address 2001:db8:4e1:20::80/64 and gateway fe80::200:5eff:fe00:5301 (indented).
hint-new-card-zone-loaded =
    .lead = The zone file of ferry.example lives in /etc/bind/zones: replace the old address in its AAAA records, check the file, and have named reread it (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/zones/db.ferry.example (the AAAA records), sudo named-checkzone ferry.example /etc/bind/zones/db.ferry.example, sudo rndc reload
hint-new-card-published =
    .lead = The zone's secondary only copies a zone whose serial (the first number of the SOA) has gone up. Compare what both servers give (dig @…).
    .solution = Raise the serial (2029041001), sudo rndc reload, then dig @ns2.islenet.example www.ferry.example AAAA
hint-new-card-end =
    .lead = Everything must hold together: the fixed address now and at boot, an IPv6 default route, and the three names (ferry.example, www, quay) giving that address.
    .solution = ip -6 route (a default route), ip -6 addr, dig @ns2.islenet.example quay.ferry.example AAAA

## Chapter 2 — The Other Door

hint-other-door-scan6 =
    .lead = From lookout, scan quay in IPv6, like islenet did (man nmap, the -6 option).
    .solution = ssh lookout, then nmap -6 quay.ferry.example
hint-other-door-scan4 =
    .lead = The same scan, in IPv4, to compare.
    .solution = nmap quay.ferry.example
hint-other-door-sockets =
    .lead = On quay: which programs listen, on which addresses (man ss)?
    .solution = sudo ss -tlnp
hint-other-door-ruleset =
    .lead = Read the firewall's rules, and note which family their table belongs to (man nft).
    .solution = sudo nft list ruleset (or cat /etc/nftables.conf)
hint-other-door-closed-now =
    .lead = One table for both families (inet), the same rules, plus the ICMPv6 that neighbour discovery needs; load the file (man nft).
    .solution = sudo nano /etc/nftables.conf: table inet filter, and icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, packet-too-big, echo-request {"}"} accept; then sudo nft -c -f /etc/nftables.conf and sudo systemctl reload nftables
hint-other-door-closed-boot =
    .lead = What is loaded must be what the file says: the nftables service loads /etc/nftables.conf at boot.
    .solution = Write the rules in /etc/nftables.conf, then sudo systemctl reload nftables
hint-other-door-end =
    .lead = Check from lookout, in both families: ssh, DNS and the site pass, 5432 and 8080 don't; and IPv6 must stay on.
    .solution = nmap -6 -p 22,53,80,5432,8080 quay.ferry.example, then the same without -6

## Chapter 3 — Both Ways

hint-both-ways-refused6 =
    .lead = From lookout, ask the site in IPv6 only, and watch the connection (man curl: -6, -v).
    .solution = ssh lookout, then curl -6 -v http://www.ferry.example/
hint-both-ways-sockets =
    .lead = On quay: who listens on port 80, and the app on 3000, on which addresses (man ss)?
    .solution = sudo ss -tlnp
hint-both-ways-bad-gateway =
    .lead = Ask for the booking page, through nginx (man curl).
    .solution = curl -i http://localhost/booking/
hint-both-ways-error-log =
    .lead = nginx writes why it couldn't reach the app in its error log.
    .solution = sudo tail /var/log/nginx/error.log
hint-both-ways-listen6 =
    .lead = The server block of /etc/nginx/sites-available/ferry listens on port 80 in IPv4 only: add a listen for IPv6, check, reload (man nginx).
    .solution = Add listen [::]:80 default_server; under listen 80 default_server;, then sudo nginx -t and sudo systemctl reload nginx
hint-both-ways-upstream-ok =
    .lead = nginx and the app must agree on one loopback address: either proxy_pass to [::1], or the app back on 127.0.0.1 (/etc/default/booking).
    .solution = sudo nano /etc/default/booking: HOST=127.0.0.1, then sudo systemctl restart booking (or proxy_pass http://[::1]:3000/; and a reload of nginx)
hint-both-ways-end =
    .lead = Check from lookout, in each family: the timetable and the booking page.
    .solution = curl -4 http://www.ferry.example/booking/ and curl -6 http://www.ferry.example/booking/
