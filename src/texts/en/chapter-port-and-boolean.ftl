### Story "The Language Café", chapter "A Port and a Boolean": httpd may
### bind only http_port_t and may not connect to other ports by default.
### semanage port, setsebool -P, audit2why's suggestions, a firewalld rich
### rule. Commands, options, paths, labels and outputs are not translated.

chapter-port-and-boolean = A Port and a Boolean
    .summary = A volunteers' rota on its own port, a sign-up app behind httpd, and since Friday the whole site is down. SELinux refuses httpd a port and a connection: give it exactly those two, keep the rota on the café's network, and make sure it all holds after a reboot.

## Files

port-and-boolean-message-dilnoza =
    From: Dilnoza
    Monday 14 December, 18:40

    Hello again,

    The site has been down since Friday evening: the screen is blank and
    people ask whether Thursday's tables are cancelled (they are not!).

    On Friday Tenzin added two things, both for our volunteers: a sign-up
    page (https://signup.commontongue.example, for anyone who wants to
    help) and the volunteers' rota, on another "port", which should only be
    seen from the café's own network (the café's computers and the
    noticeboard). Then he restarted something and had to catch his train;
    he is in the mountains without a phone until Wednesday. His notes are in
    your home.

    Please bring everything back, the right way, the way Seun would like.

    Dilnoza

port-and-boolean-notes-tenzin =
    Notes from Tenzin (Friday 11 December, 17:55, in a hurry)

    - signup: my app, /opt/signup, a systemd service (signup.service),
      listens on 127.0.0.1:8086. httpd is its front door:
      /etc/httpd/conf.d/signup.conf (ProxyPass).
    - The rota: /var/www/volunteers, on port 8010:
      /etc/httpd/conf.d/volunteers.conf. Only the café's network
      (198.51.100.0/24) should see it.
    - httpd -t said "Syntax OK", then systemctl restart httpd failed with
      some "Permission denied" about a socket. Not the files this time!
    - I ran audit2allow on the audit log and it wrote me a module that would
      allow it all (in my home: /home/tenzin/httpd-fix.te). I didn't load
      it: it looked like a lot. Did I do right?

## Events

port-and-boolean-event-down =
    httpd failed to start: "make_sock: could not bind to address …:8010",
    (13) Permission denied. Nothing else listens there (ss -tlnp): the
    kernel refused httpd that port. Which part of the kernel refuses a
    program a port? The audit log knows.

port-and-boolean-event-bind-avc =
    { "{" } name_bind { "}" } on a tcp_socket, tcontext unreserved_port_t:
    httpd_t may only listen on ports the policy types http_port_t (80, 443,
    8008, 8009, 8443, 9000…: semanage port -l), and 8010 is no web port in
    the policy. A port can be given a type, like a file a label.

port-and-boolean-event-nis =
    nis_enabled lets every program that uses NSS (almost every service)
    listen and connect on any unreserved port: audit2why suggests it because
    it would work, not because it fits. Switch it off (and off with -P),
    and give httpd just the port it needs.

port-and-boolean-event-module =
    A module from audit2allow is loaded: httpd_t may now listen and connect
    on every unreserved port, which is far more than 8010 and 8086. Tenzin
    was right not to load it: remove it (semodule -r) and use the policy's
    own means, a port type and a boolean.

port-and-boolean-event-port =
    8010 is now a web port for the policy (semanage port -l | grep http).
    httpd read its configuration when it last tried to start: start it again.

port-and-boolean-event-up =
    httpd is back, and with it the café's site. Now the two new things: the
    sign-up page (curl with its name: -H 'Host: signup.commontongue.example')
    and the rota on 8010 (from the noticeboard).

port-and-boolean-event-proxy-503 =
    503 for the sign-up page: httpd couldn't reach the app behind it
    (AH01114 in its error log). The app runs (systemctl status signup, curl
    127.0.0.1:8086 on kettle answers): who refused httpd the connection?

port-and-boolean-event-connect-avc =
    { "{" } name_connect { "}" }: httpd_t connecting to port 8086 was refused. By
    default httpd may connect to no other port at all; the policy offers a
    boolean for a reverse proxy. audit2why names it (and one more, too
    broad: read the descriptions).

port-and-boolean-event-label-8086 =
    8086 is now http_port_t, but httpd still may not connect to it: by
    default httpd_t may connect to no port, not even a web port (only with
    httpd_can_network_relay or httpd_graceful_shutdown, both off). Typing
    ports helps listening; connecting is a boolean's business.

port-and-boolean-event-boolean-runtime =
    httpd_can_network_connect is on, until the next reboot: setsebool
    without -P changes only the running policy. At the next boot, the
    sign-up page would answer 503 again.

port-and-boolean-event-boolean =
    httpd_can_network_connect is on, now and at the next boot: httpd may
    connect to its backend. Check the sign-up page.

port-and-boolean-event-open-to-all =
    Port 8010 is open to everyone: the rota, with volunteers' names and
    times, is on the internet. Only the café's network (198.51.100.0/24)
    should reach it: firewalld's rich rules can say "from this source
    only" (man firewall-cmd, and firewalld.richlanguage).

port-and-boolean-event-rota-office =
    The rota is reachable from the café's network and only from there. Keep
    the rule both at runtime and in the permanent configuration.

port-and-boolean-event-end =
    Dilnoza: "The screen shows the tables, Hamza signed up for Thursday, and
    the rota is back on the café's computer. Tenzin will be relieved."

    Well done! You finished A Port and a Boolean.

    WHAT HAPPENED
    Tenzin's new virtual host listened on 8010, a port SELinux doesn't type
    for the web (unreserved_port_t): httpd_t was refused name_bind, and an
    httpd that can't open one of its sockets doesn't start at all. You gave
    8010 the type http_port_t (semanage port -a), so httpd starts. Behind
    the sign-up page, httpd must connect to the app on 127.0.0.1:8086, which
    httpd_t may not do by default: httpd_can_network_connect, set with -P,
    allows it for good. And a rich rule lets only the café's network reach
    the rota.

    GOOD PRACTICE
    - A service that can't bind a port with "Permission denied", nothing
      else listening: look for an AVC (name_bind), then semanage port -a -t
      with the type its domain may use (http_port_t for httpd).
    - A reverse proxy that answers 503: name_connect. The policy has booleans
      for the common needs (getsebool -a | grep httpd); set them with -P, or
      they are gone at the next boot.
    - Read audit2why's suggestions: nis_enabled works, and opens every
      unreserved port to every NSS-using service. Choose the narrowest.
    - audit2allow -M writes what was refused, as broadly as it was refused:
      it is the last resort, after the labels, the port types and the
      booleans; read the .te file before any semodule -i.
    - A rich rule (source address, port, accept) keeps a service on one
      network; firewall-cmd --add-port opens it to all.

    DOCUMENTATION
    - RHEL 10, Using SELinux, non-standard configurations: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/configuring-selinux-for-applications-and-services-with-non-standard-configurations_using-selinux
    - semanage-port(8): https://man7.org/linux/man-pages/man8/semanage-port.8.html
    - setsebool(8): https://man7.org/linux/man-pages/man8/setsebool.8.html
    - firewalld rich language: https://firewalld.org/documentation/man-pages/firewalld.richlanguage.html
    - Apache, reverse proxy guide: https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html
