### Story "The Neighbourhood Letters", chapter "The firewall": ufw.
### Commands, ports, addresses and ufw keywords (allow, deny…) are not
### translated; the output of nmap and ss stays in English.

chapter-firewall = The firewall
    .summary = Who is listening, and who can get in: ss, ufw, and never locking yourself out.

## Files

firewall-email-kofi =
    From:    Kofi (La Fourmilière)
    To:      you
    Subject: One door too many?

    My friend Yasmine, who works in security, "scanned" our server from
    her home (with our permission!). Her report is in
    ~/scan_yasmine.txt. She says port 3306 is the website's database, and
    that it has no business being on the internet.

    Could you set up a firewall? We need:

    1. the website to stay reachable by everyone (http and https);
    2. you to still be able to connect over SSH from your computer;
    3. everything else to be refused, starting with the database.

    Yasmine recommends ufw, already installed (man ufw). She added: "And
    above all, allow SSH BEFORE enabling the firewall." For sudo, it's
    still the same password.

## Events

firewall-event-listening =
    Look at the "Local Address" column: 0.0.0.0:3306 means MariaDB is
    listening on ALL interfaces, so anyone on the internet can knock on
    that door. php-fpm, on the other hand, only listens on 127.0.0.1: it
    can only be reached from the machine itself.
firewall-event-locked-out =
    WARNING: the firewall is active and blocks SSH. Your session holds
    (the firewall lets already established connections through), but any
    new connection will fail. Allow SSH now, before you log out!
firewall-event-site-cut =
    The firewall is active… and the Letters website no longer answers:
    http (80) and https (443) are blocked. Kofi is going to get worried
    messages.
firewall-event-base-open =
    The firewall is active, but the database (3306) can still be reached
    from the internet. Read Kofi's request again.
firewall-event-filter =
    The firewall filters properly: the website answers everyone, SSH
    answers you, and the database answers nobody from outside. Check with
    sudo ufw status verbose.

    Last step, as with SSH: check that you can still get in.
    exit, then ssh letters.
firewall-event-end =
    New connection successful: the firewall lets SSH through. Yasmine
    runs her scan again: 22, 80 and 443 open, 3306 filtered. Kofi: "She
    says it's great work!"

    Well done! You have finished the chapter "The firewall".

    WHAT HAPPENED
    A program listening on 0.0.0.0 can be reached from the whole
    internet, even when it's only used locally: that was the case for the
    database. The firewall now refuses everything coming in, except the
    useful doors.

    GOOD PRACTICE
    - Start by looking at who is listening: sudo ss -tlnp.
    - ufw default deny incoming, then allow the useful doors one by one.
    - Allow SSH BEFORE ufw enable, and test a new connection.
    - Even better: ufw limit OpenSSH (slows down brute force), or only
      allow SSH from your own addresses.
    - The firewall doesn't excuse a bad configuration: a local database
      should also only listen on 127.0.0.1 (bind-address).

    ANOTHER WAY
    nftables directly, as in The Hive: more lines to write, but the whole
    firewall in front of you, in a single file (/etc/nftables.conf). ufw
    writes these rules for you (sudo nft list ruleset shows them).
    firewalld (Fedora, RHEL) thinks in zones. ufw for a simple server;
    nftables for a router, NAT or fine-grained rules.

    DOCUMENTATION
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
