### Story "The Bastion", chapter "The Alarm": a hosting provider's abuse
### notice; find what runs, where it talks to and how it got in, and write
### it down before acting. Commands, paths, addresses and log lines are not
### translated.

chapter-alarm = The Alarm
    .summary = The hosting provider says the server talks to a mining pool: find what runs, where it talks to and how it got in, before touching anything.

## Files

alarm-email-nadia =
    From:     Nadia
    To:       you
    Subject:  Fwd: Abuse report for 192.0.2.33

    Sorry for the Saturday. Our host sent this at 7 am, I don't understand
    half of it. The deliveries site feels slow this morning too. Can you
    look? Selma (the developer of the delivery app) is away until Monday.

    ---------- Forwarded message ----------
    From:     abuse@host.example
    Subject:  Abuse report for 192.0.2.33

    Our monitoring shows that your server 192.0.2.33 has kept a connection
    open to 198.51.100.66, port 3333, since 13 April around 02:41 UTC. This
    address is a known cryptocurrency mining pool. This activity usually
    means a compromised machine. Please investigate and reply within 48
    hours.

    Nadia

    P.S. The incident notes Salomé taught us to keep are in incident.md.

alarm-incident-template =
    # Incident — oven (deliveries)

    Opened Saturday 14 April 2029, 8:20, after the host's abuse report.

    ## What runs
    (to complete: which program, as which account, from which folder)

    ## Where it talks to
    (to complete: which address and port)

    ## How it got in
    (to complete: which account, from which address, at what time, how)

    ## Timeline
    - 13/04 02:41 — first connection to the pool, says the host.

## Events

alarm-event-process =
    A "kworkerd" takes almost two whole processors, as deploy, and runs
    from /tmp/.cache. Its name imitates a kernel thread, but a real one
    shows in brackets ([kworker/0:1]), belongs to root, and has no path on
    disk. And its parent, a shell running /tmp/.cache/.w, isn't anything
    the app should start.
# { $pool }: the pool's address
alarm-event-connection =
    Here it is: kworkerd has a connection established to { $pool }, port
    3333, the address in the host's report. The program and the connection
    are the same thing.
alarm-event-connection-anonymous =
    A connection established to { $pool }, port 3333: the host's address.
    But which program holds it? The process column only shows with -p, and
    for other accounts' sockets, only to root.
# { $address }: the intruder's address
alarm-event-entry =
    In ssh's log, fourteen failed passwords for deploy from { $address },
    then "Accepted password" from the same address at 02:40:57. Someone
    guessed deploy's password. And yet this server only accepts keys… or
    so you thought.
alarm-event-stopped-early =
    You stopped it, and it came back with another PID straight away:
    something restarts it. That's for the next step; for now, note what
    you see before anything changes.
alarm-event-end =
    Nadia: "So someone's using our server to make money. I'd rather know
    exactly what before we touch anything, you're right."

    Well done! You have finished the chapter "The Alarm".

    WHAT HAPPENED
    In the night of 12 to 13 April, someone tried passwords on the deploy
    account from 203.0.113.66, and found the right one at 02:40. They left
    a miner disguised as a kernel thread (kworkerd, in /tmp/.cache), and a
    small shell loop that watches it. Since then, the server has been
    working for them, and the host noticed.

    GOOD PRACTICE
    - Observe before acting: what runs (ps, top), where it talks to (ss -tnp
      or netstat -tnp, with sudo to see the processes), how it got in
      (journalctl -u ssh, last).
    - Write it down as you go, with the times: incident.md is the memory
      of the incident, and the basis of what you'll tell Nadia, the host,
      and maybe others.
    - Don't turn the machine off on reflex: what runs in memory and the
      open connections are part of the evidence.

    ANOTHER WAY
    A host-based intrusion detection tool (auditd, AIDE, or a monitoring
    of processes and outgoing connections) would have raised the alarm
    before the host did. The host's report is a second line of defence,
    not the first.

    DOCUMENTATION
    - ps: https://man7.org/linux/man-pages/man1/ps.1.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - NIST SP 800-61r2, incident handling: https://csrc.nist.gov/pubs/sp/800/61/r2/final
