### Story "The Ferry", chapter "Both Ways": nginx only listens in IPv4,
### and the updated booking app listens on ::1 while nginx asks 127.0.0.1.
### curl -4/-6 -v, ss, listen [::]:80, proxy_pass and localhost. Commands,
### options, addresses, paths and outputs are not translated.

chapter-both-ways = Both Ways
    .summary = The first Saturday of the season: on mobile data the ferry's site hesitates or fails, and since last night's update the booking page answers "502 Bad Gateway" to everyone. One fault per address family: find both from outside and fix them before the bookings open.

## Files

both-ways-message-amaru =
    From: Amaru (ferry cooperative)
    Saturday 14 April, 8:30

    Good morning! Opening day: bookings open at nine.

    Two problems, I'm afraid. On my phone, on mobile data, the site
    "can't be reached" one time out of two; on the office Wi-Fi, the
    timetable shows. But "Book a crossing" answers "502 Bad Gateway",
    here and everywhere, since Lucía updated the app last night. She left
    a note before taking the first boat to the mainland.

    lookout is still there.

    Amaru

both-ways-note-lucia =
    Note from Lucía

    Last night I updated the booking app (Node.js 22). On the way, I
    tidied /etc/default/booking: HOST=localhost rather than 127.0.0.1,
    it's cleaner, isn't it? It started without an error
    (journalctl -u booking). Back on Monday!

    Lucía

## Events

both-ways-event-refused6 =
    In IPv6, port 80 refuses the connection: the address answers (ping6
    works), but nobody listens on 80 in IPv6. Without -6, curl tries IPv6
    first, then falls back to IPv4 (happy eyeballs): that's why the page
    sometimes shows. A phone on a network without that fallback, or
    whose IPv4 is poor, waits or fails. On quay: ss -tlnp.
both-ways-event-sockets =
    nginx listens on 0.0.0.0:80: IPv4 only. And the app listens
    on [::1]:3000, the IPv6 loopback, no longer on 127.0.0.1. Two clues,
    one per family.
both-ways-event-bad-gateway =
    502 Bad Gateway: nginx answered, but couldn't reach the app behind it.
    Its reason is in /var/log/nginx/error.log.
both-ways-event-error-log =
    "connect() failed (111: Connection refused) while connecting to
    upstream, … upstream: http://127.0.0.1:3000/": nginx knocks on
    127.0.0.1, the app listens on ::1. Since Node.js 17, "localhost"
    gives the addresses in the system's order, ::1 first, and the app
    only listens on the first one. Either nginx asks [::1]
    (proxy_pass http://[::1]:3000/;), or the app listens on 127.0.0.1
    again (HOST in /etc/default/booking, then restart it).
both-ways-event-not-reloaded =
    The file is right and nginx -t agrees, but nginx still serves the
    configuration it read at start: systemctl reload nginx.
both-ways-event-bind-conflict =
    nginx can't open [::]:80: with ipv6only=off, that socket also takes
    IPv4, and "listen 80" already holds IPv4's port 80. nginx -t doesn't
    see it (it doesn't open the sockets). Either two lines, listen 80 and
    listen [::]:80 (IPv6 only, the default), or a single line,
    listen [::]:80 ipv6only=off.
both-ways-event-listen6 =
    nginx now listens in IPv6 too ([::]:80). From lookout, curl -6 should
    get the timetable.
both-ways-event-exposed =
    The app now listens on every address: it only stays private because
    the firewall drops port 3000. Its place is the loopback (127.0.0.1 or
    ::1), where only nginx reaches it.
both-ways-event-upstream-ok =
    The booking page answers again through nginx.
both-ways-event-end =
    8:58. Amaru: "My phone shows everything, the bookings work, and the
    first passengers are booking. Go and have a coffee on the quay!"

    Well done! You finished The Ferry.

    WHAT HAPPENED
    Two faults, one per family. nginx only listened in IPv4 (listen 80):
    in IPv6, the connection was refused at { $v6 }, and only clients
    able to fall back on IPv4 ({ $v4 }) got the page, late. And the
    updated app listened on "localhost", which Node.js turned into ::1,
    while nginx asked 127.0.0.1: 502 for everyone. You added the IPv6
    listen, pointed nginx and the app at the same loopback, checked
    (nginx -t), reloaded, and checked from outside in both families.

    GOOD PRACTICE
    - An AAAA record is a promise: every service behind the name must
      answer in IPv6 too (listen [::]:80 next to listen 80).
    - nginx: listen [::]:80 is IPv6 only by default (ipv6only=on); with
      ipv6only=off it takes both, and must not sit next to listen 80.
    - "localhost" is two addresses: write 127.0.0.1 or [::1] where one is
      meant (proxy_pass, HOST).
    - curl -4 and curl -6 -v test each road separately; a working page
      in a browser can hide a broken IPv6 (happy eyeballs).
    - ss -tlnp: 0.0.0.0 is IPv4, [::] IPv6, * both.

    DOCUMENTATION
    - nginx, listen (ipv6only): https://nginx.org/en/docs/http/ngx_http_core_module.html#listen
    - nginx, proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Node.js, the order of DNS results: https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder
    - Happy eyeballs (RFC 8305): https://www.rfc-editor.org/rfc/rfc8305
