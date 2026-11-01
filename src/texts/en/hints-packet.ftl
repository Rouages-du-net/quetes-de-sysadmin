### Graded hints for The Lost Packet (see src/engine/hints.ts): one message
### per step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). File names as in names.ftl.

## Chapter 1 — The Lost Packet

hint-lost-packet-box =
    .lead = Test step by step, from nearest to furthest (Kofi's notebook.txt). The nearest is the router: one command sends a small message and waits for it to come back.
    .solution = ping 192.168.1.1 (the router; 0% packet loss: the local network works).
hint-lost-packet-internet =
    .lead = The router answers. One step further: a server on the internet, by its IP address (the notebook gives one).
    .solution = ping 9.9.9.9 (Quad9's public DNS server).
hint-lost-packet-name =
    .lead = The internet answers by address. And by name? Try the website itself, by its name.
    .solution = ping letters.example
hint-lost-packet-dns-silent =
    .lead = The name does not turn into an address: that is DNS's job. One command asks the DNS server directly (man dig).
    .solution = dig letters.example (then cat /etc/resolv.conf: which DNS server does the computer ask?).
hint-lost-packet-dns-other =
    .lead = The configured DNS server does not answer. Does the name really exist? dig can ask a server other than the one in /etc/resolv.conf (man dig, the @).
    .solution = dig @9.9.9.9 letters.example
hint-lost-packet-dns-repaired =
    .lead = /etc/resolv.conf points to the old router, which no longer exists. The right setting is in a file next to it. /etc belongs to root: sudo (the password is in Kofi's note).
    .solution = sudo cp /etc/resolv.conf.box /etc/resolv.conf (password: anthill).
hint-lost-packet-ping-lost =
    .lead = DNS is fixed: try to reach the website by its name again.
    .solution = ping letters.example
hint-lost-packet-route =
    .lead = The name is translated, but the ping gets lost. Where do the packets stop? One command shows their path, router by router.
    .solution = traceroute letters.example
hint-lost-packet-curl =
    .lead = Many servers ignore ping on purpose. The only real test: ask for the page itself, over HTTPS (the notebook, step 5).
    .solution = curl -I https://letters.example (HTTP/2 200: the website answers).
