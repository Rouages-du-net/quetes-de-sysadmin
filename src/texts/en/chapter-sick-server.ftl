### Story "The Blood Drive", chapter "The Sick Server": a backend that
### answers 500 still gets traffic (no health check); a backend to take out
### for maintenance without cutting sessions. option httpchk, http-check
### expect, check, fall, rise, the runtime API (socat, show stat, set
### server … state drain). Commands, options, paths and outputs are not
### translated.

chapter-sick-server = The Sick Server
    .summary = One donor in three gets an error page, and a technician is waiting at the door to repair a web server. Teach HAProxy to tell a healthy server from a sick one, and take a server out of the pool without cutting anyone's booking.

## Files

sick-server-message-zainab =
    From: Zainab (donor services)
    Wednesday 22 May, 10:05

    Hello again!

    Since this morning, about one donor in three gets an error page when
    they choose a session ("Server Error (500)"); if they try again, it
    usually works. We've had complaints.

    Also: the hosting company's technician is here to replace a memory
    module in web2 (it has been reporting memory errors). He is waiting
    for your go: he'll switch web2 off as soon as nobody is using it, and
    I'd rather nobody lose a half-finished booking.

    Zainab

sick-server-message-teodor =
    From: Teodor (booking app)

    Hi! The app has a health page: GET /health on port 8080 answers 200
    when the app and its database are fine, and 500 when they aren't.
    It's there for the load balancers, if they ask.

    HAProxy's runtime socket is /run/haproxy/admin.sock (stats socket in
    haproxy.cfg). Bastien used something like:
    echo "show stat" | sudo socat stdio /run/haproxy/admin.sock

    Teodor

## Events

sick-server-event-errors =
    The 500 errors come from web3: HAProxy sends it one request in three
    (balance roundrobin), and web3's app answers "Server Error (500)" to
    every one. Why does HAProxy keep sending it requests? Ask HAProxy what
    it thinks of its servers.
sick-server-event-denied =
    The socket belongs to root and the haproxy group (mode 660): socat
    needs sudo.
sick-server-event-no-check =
    "no check": HAProxy doesn't check its servers at all. It considers
    every server up, whatever it answers. Servers need the check option,
    and a check that looks at the application, not only at the port (man
    haproxy, and its configuration manual: option httpchk).
sick-server-event-tcp-only =
    The servers are checked now, but web3 is still UP: "L4OK". Without
    option httpchk, a check only opens a TCP connection to port 8080, and
    web3's app accepts it. The app is sick, not its port: check /health
    over HTTP (option httpchk GET /health, http-check expect status 200).
sick-server-event-http-check =
    web3 is DOWN: "Layer7 wrong status, code: 500" in /var/log/haproxy.log,
    L7STS in show stat. After `fall` failed checks HAProxy stops sending
    it requests; after `rise` good ones (once Teodor fixes its database)
    it will come back by itself.
sick-server-event-lb2-synced =
    lb2 checks the same way: if the address moves to lb2 tomorrow, its
    HAProxy won't send donors to a sick server either.
sick-server-event-wrong-node =
    web2 is out of the pool on the load balancer that doesn't hold the
    address: the donors' requests go through the other one. Do it on the
    master (ip a tells which).
sick-server-event-removed =
    web2's server line is gone from a haproxy.cfg. It will come back after
    the repair, so it will have to be written again, reloaded, and kept the
    same on both load balancers. The runtime API was made for this: it
    takes a server out and puts it back without touching the file.
sick-server-event-drained =
    web2 receives no new requests (drain: the sessions already open
    finish; maint: no traffic and no checks). Watch its sessions go down
    (scur in show stat) before the technician switches it off.
sick-server-event-cut =
    web2's app stopped while donors were still on it: their bookings broke
    half-way. Drain first, wait for the sessions to end, then switch off.
sick-server-event-tech-working =
    Zainab: "The technician has switched web2 off, he'll be about a
    minute." HAProxy's check on web2 fails meanwhile, which is expected.
sick-server-event-tech-done =
    Zainab: "web2 is back, with its new memory." It runs, but HAProxy still
    keeps it out of the pool (drain or maint): put it back (set server …
    state ready).
sick-server-event-end =
    Zainab: "No more error pages, and the technician says web2 is happy.
    Teodor is fixing web3's database connections."

    Well done! You finished The Sick Server.

    WHAT HAPPENED
    web3's app lost its database connections and answered 500 to every
    request, but HAProxy had no health checks: it kept sending web3 a third
    of the donors. You added an HTTP check of /health on both load
    balancers: web3 went DOWN and stopped receiving traffic. Then you took
    web2 out of the pool through HAProxy's runtime API, waited for its
    sessions to end, let the technician work, and put it back, without
    touching the configuration.

    GOOD PRACTICE
    - A health check must ask the application, not just its port: option
      httpchk on a page that checks what the app needs (here its database).
    - fall and rise avoid flapping: a server leaves the pool after a few
      failures and comes back after a few successes.
    - Keep the load balancers' configurations identical (diff, or better:
      configuration management).
    - Maintenance: drain (no new requests), wait for scur to reach 0, then
      stop. The runtime API changes the running state; the file stays the
      reference. A reload starts from the file again.

    DOCUMENTATION
    - HAProxy configuration manual (option httpchk, http-check, server):
      https://docs.haproxy.org/3.0/configuration.html
    - HAProxy management guide (the runtime API): https://docs.haproxy.org/3.0/management.html
    - socat: http://www.dest-unreach.org/socat/doc/socat.html
