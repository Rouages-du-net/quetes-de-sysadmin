### Story "The Other Unix", chapter "The Last Rule Wins": a pf configuration
### written with iptables habits. Commands, options, rules and paths are not
### translated.

chapter-last-rule = The Last Rule Wins
    .summary = The club's database answers the whole internet: switch pf on, without locking yourself out, and learn that in pf the last matching rule wins.

## Files

last-rule-message-romy =
    From:  Romy
    To:    you

    A member who works in IT scanned our server (with our permission): the
    database, port 3306, answers the whole internet. Only the site should
    talk to it, from the server itself.

    Yanis wrote a firewall configuration, /etc/pf.conf, "like iptables",
    he says. He didn't dare switch it on: last time he touched a firewall,
    nobody could connect for two days.

    Can you switch it on, without locking us out?

    Romy

## Events

last-rule-event-checked =
    pfctl -n reads the configuration and stops there: the syntax is fine
    if it says nothing. But a correct syntax doesn't mean the rules do what
    you want: pfctl -sr will show them as pf understands them, once loaded.
last-rule-event-locked-out =
    Careful: with these rules in force, your next ssh connection would be
    refused, and the site no longer answers. In pf, EVERY rule is read, and
    the last one that matches wins: "block in all", at the end, blocks ssh
    and the web too. Your current session stays open (pf keeps the
    connections it already knows): fix pf.conf, then reload it.
last-rule-event-on =
    pf is on, and ssh still gets in.
last-rule-event-not-at-boot =
    pf filters as it should… until the next reboot: without
    pf_enable="YES" in rc.conf, it won't start again.
last-rule-event-file-differs =
    The rules in force are not those of /etc/pf.conf any more: after
    editing the file, reload it (pfctl -f), or a reboot would bring back
    something else.
last-rule-event-end =
    Romy: "The scan says 22 and 80, nothing else. And we can still
    connect!"

    Well done! You have finished the chapter "The Last Rule Wins" and the
    story "The Other Unix".

    WHAT HAPPENED
    Yanis wrote his rules in the order iptables reads them: accept, then
    block the rest. pf reads them all, and the LAST rule that matches
    decides: his final "block in all" blocked everything, ssh included.
    Blocking first, then opening (or "quick" passes), says the same thing
    in pf's language. pf now starts at boot, with the rules of the file.

    GOOD PRACTICE
    - Check a configuration before loading it (pfctl -nf), then check what
      is really in force (pfctl -sr) and test from outside.
    - In pf: block first, then the passes; or quick on the rules that must
      decide at once.
    - Over ssh, keep your session open while you test a new firewall, and
      open a second one to check you can still get in.
    - Better still for a database: make it listen on 127.0.0.1 only. The
      firewall is a second line, not the only one.

    ANOTHER WAY
    pf can also keep lists of addresses (tables), slow down attackers
    (max-src-conn-rate with overload, the pf equivalent of fail2ban), and
    do NAT for a home or office router. FreeBSD also ships ipfw, its other
    firewall, with its own syntax (where the first rule wins).

    DOCUMENTATION
    - pf.conf(5): https://man.freebsd.org/cgi/man.cgi?query=pf.conf
    - pfctl(8): https://man.freebsd.org/cgi/man.cgi?query=pfctl
    - The Handbook, PF: https://docs.freebsd.org/en/books/handbook/firewalls/#firewalls-pf
