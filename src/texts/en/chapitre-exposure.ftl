### Story "The Audit", chapter "The Exposure": the auditor's port scan finds
### the database and Redis reachable from the internet. ufw and the Redis
### configuration. The commands, the paths, the redis.conf keywords and the
### tools' messages are not translated.

chapter-exposure = The Exposure
    .resume = Close what a port scan finds open: ufw, and make Redis listen on the local machine only.

## Files

exposure-email-salome =
    From:     Salomé (auditor)
    To:       you
    Subject:  Bakery audit — part two: exposure

    Hello,

    Thank you for handling the first part: SSH, the accounts, sudo and the
    secrets file are in order. The second part is about what can be seen of
    the server from the internet.

    My port scan is in audit_scan.txt. Two lines bother me: the database
    (5432) and Redis (6379) answer anyone. Redis doesn't even have a
    password, and it was installed to listen on every interface.

    What I expect:
    1. Only SSH (from your admin workstation) and the website (80 and 443)
       reachable from the internet. A firewall is installed (ufw), but it
       is switched off.
    2. Redis, on top of that, listening only on the machine itself: a
       firewall gets disabled, forgotten, or misconfigured; a service that
       only listens to itself is safer.
    3. The orders app to keep working: it uses the database and Redis,
       locally.

    Please test with a new SSH connection before closing the session you
    opened.

    Salomé
    (For sudo, your password is still: flour-2028)

## Events

exposure-event-listening =
    There is who listens, and where. Look at the "Local Address:Port"
    column: 0.0.0.0 means "all interfaces", so reachable from anywhere (if
    nothing filters); 127.0.0.1 means "this machine only". Port 3000 (the
    app) is already local: that is the right example.
exposure-event-locked-out =
    WARNING: the firewall is active and no longer lets SSH in from your
    workstation. Your current session holds (established connections are not
    cut), but the next one will not. Allow SSH right now (sudo ufw status to
    look, man ufw for the rule).
exposure-event-site-cut =
    The firewall now blocks the website: customers can no longer order.
    Allow ports 80 and 443 (a ufw profile names them: ufw app list, or just
    the numbers).
exposure-event-base-open =
    The firewall is active, but a database or Redis port still gets through:
    a rule that is too broad ("allow" without a port, a range…) or a default
    policy set to "allow". Reread  sudo ufw status verbose  : by default,
    whatever is not allowed must be denied inbound.
exposure-event-redis-stopped =
    Redis is stopped: the orders app needs it (sessions and queue), online
    orders no longer go through! Shutting a service down is not fixing it:
    start it again, and change its listening address instead.
exposure-event-without-effect =
    redis.conf does say "bind 127.0.0.1"… but Redis is still listening on all
    interfaces: a program reads its configuration when it starts, not when
    the file changes. Have it restart, then run
      ss -tln
    to see the new address.
exposure-event-firewall =
    The firewall is active: SSH (from your workstation), 80 and 443 get
    through; the database and Redis are closed from the internet. But that
    is only one layer: Redis still listens on all interfaces.
exposure-event-redis-local =
    Redis now listens only on 127.0.0.1: even without a firewall it would no
    longer be reachable from outside, and the app still reaches it.
exposure-event-end =
    You got in with the firewall active: SSH gets through, so does the
    website, and the database and Redis are closed. Salomé: "My scan sees
    only three ports now. Thank you! The third part remains, the login
    traces."

    Well done! You have finished the chapter "The Exposure".

    WHAT HAPPENED
    A service listening on 0.0.0.0 is reachable by anything that reaches the
    machine. Plenty of software (databases, caches like Redis) is installed
    open "so that it works"; without a password, Redis lets anyone read and
    write all its data, and bots scan the internet to find them. A port scan
    (nmap) is the first move of an audit, as of an attack: see what the
    outside sees.

    GOOD PRACTICE
    - Two layers: a firewall that denies inbound by default and allows only
      what must be allowed (SSH, 80, 443), AND services that listen only
      where they should (bind 127.0.0.1, listen_addresses = 'localhost' for
      PostgreSQL).
    - ss -tlnp to know who listens; redo the scan after every change.
    - Allow SSH BEFORE enabling the firewall, and test with a new
      connection. Restart the service so it rereads its configuration.
    - For a service that must stay reachable by one specific machine: a ufw
      rule limited to its address (ufw allow from 192.0.2.30 to any port
      5432).

    ANOTHER WAY
    nftables (or iptables) does the same job as ufw, more finely, and ufw is
    only a front end: the principle stays the same (default policy, rules,
    order). Redis can also listen on a Unix socket only (unixsocket, port
    0), with no network port at all.

    DOCUMENTATION
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - Redis security: https://redis.io/docs/latest/operate/oss_and_stack/management/security/
    - PostgreSQL connections: https://www.postgresql.org/docs/current/runtime-config-connection.html
