### Story "The Lost Packet": "the internet isn't working anymore" at the
### community café. Diagnose a network failure step by step with ping,
### dig, traceroute and curl. Commands, domain names and IP addresses are
### not translated; the network tools' output stays in English, as on a
### real system.

chapter-lost-packet = The Lost Packet
    .resume = Find where a message gets lost, layer by layer: ping, dig, traceroute, curl.

## Files

lost-packet-note-kofi =
    A note from Kofi, volunteer at La Fourmilière, the community café:

    "Help! The internet isn't working anymore on the café's computer. The
    Neighbourhood Letters website (letters.example) won't open, and that's
    where we publish the week's programme.

    I've already restarted the router. Nothing. Can you take a look? The
    password for this computer, if you need it: anthill

    There's a notebook next to the screen:  cat notebook.txt  "
lost-packet-notebook =
    TROUBLESHOOTING NOTEBOOK — find where the packet gets lost

    Test step by step, from the nearest to the farthest:

      1. Does my router answer?         ping 192.168.1.1
      2. Does the internet answer?      ping 9.9.9.9   (a public DNS server)
      3. Do names work?                 ping letters.example
                                        dig letters.example
      4. Which way do packets go?       traceroute letters.example
      5. Does the website answer?       curl -I https://letters.example

    DNS translates a name (letters.example) into an IP address (numbers).
    The computer knows which DNS server to ask thanks to the file
    /etc/resolv.conf (the "nameserver" line).

    Network commands answer in English, as on a real system:
    "packet loss" = lost packets, "timed out" = no answer in time.
# Comments in the files /etc/resolv.conf and /etc/resolv.conf.box (after "#")
lost-packet-resolv-comment = Written at installation time, with the old router
lost-packet-resolv-box-comment = Setting recommended by the new router

## The website's page, returned by curl (HTML)

lost-packet-site-title = The Neighbourhood Letters
lost-packet-site-text = The site works! Write to us.

## Events ({ $ip }: the website's IP address)

lost-packet-event-box =
    The router answers, in barely a millisecond: the local network (the
    cable or the Wi-Fi up to the router) works. ping sends a small ICMP
    "echo" message; the machine sends the ball back, and the round trip
    is measured.

    Further now: a server on the internet,  ping 9.9.9.9
lost-packet-event-internet =
    9.9.9.9 answers: packets do go out to the internet and come back.
    So "the internet" works! The problem is elsewhere. Try the site's name:
    ping letters.example
lost-packet-event-name =
    "Temporary failure in name resolution": the computer can't translate
    the name into an IP address. That's the job of DNS. Ask it the
    question directly: dig letters.example
lost-packet-event-dns-silent =
    The DNS server 192.168.1.250 doesn't answer: "timed out". Where does this
    address come from? Look at cat /etc/resolv.conf

    And to check that the name really exists, ask another DNS server:
    dig @9.9.9.9 letters.example
lost-packet-event-dns-other =
    With another DNS server, the answer comes back: letters.example = { $ip }.
    The name exists; it's the computer's setting that is wrong: it asks
    192.168.1.250, the address of the OLD router, which no longer exists.

    The right setting is in /etc/resolv.conf.box. This file belongs to root:
    sudo cp /etc/resolv.conf.box /etc/resolv.conf
lost-packet-event-dns-repaired = DNS is fixed: the computer now asks the new router. Try again:  ping letters.example
lost-packet-event-ping-lost =
    The name is translated ({ $ip })… but 100% of the packets are lost!
    Is the website down? Or are the packets getting lost on the way?
    Follow their trail:  traceroute letters.example
lost-packet-event-route =
    Here is the packet's journey, hop by hop:
     1. your router;
     2-3. your provider's routers (the ISP);
     4. an exchange point, where networks connect to one another;
     5. the router of the site's hosting provider.
    Then nothing more: "* * *". The packets make it to the hosting
    provider's door. Many servers deliberately ignore ping and traceroute
    (their firewall filters them): this silence doesn't prove a failure.

    The only real test is to ask for the page:  curl -I https://letters.example
lost-packet-event-curl =
    HTTP/2 200: the website answers perfectly! Kofi can publish the programme.

    Summary of the investigation: the local network worked (ping router), so
    did the internet (ping 9.9.9.9). The failure was in DNS: the computer was
    asking an old router that was gone. Once DNS was fixed, pinging the site
    failed… but only because its firewall ignores ping. curl proved it.

    END OF THE STORY "THE LOST PACKET".

    The method to remember: test step by step, and don't jump to
    conclusions. "No answer to ping" doesn't mean "down".
