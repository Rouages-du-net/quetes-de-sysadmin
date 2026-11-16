### Story "The Bastion", chapter "Containment": cut the miner and the
### intruder off with iptables without locking yourself out, stop the
### miner and its watchdog, close the deploy account. Commands, paths and
### addresses are not translated.

chapter-containment = Containment
    .summary = Cut the miner and the intruder off without locking yourself out, stop what runs, and close the account they used.

## Files

containment-email-nadia =
    From:     Nadia
    To:       you
    Subject:  Re: Abuse report

    Thank you for the notes. My cousin says we should just unplug the
    server. But the drivers need the rounds at 11. Can we stop the damage
    without stopping the deliveries?

    Nadia

containment-incident =
    # Incident — oven (deliveries)

    ## What runs
    /tmp/.cache/kworkerd (deploy), watched by /bin/sh /tmp/.cache/.w.

    ## Where it talks to
    198.51.100.66, port 3333 (the pool).

    ## How it got in
    deploy, by password, from 203.0.113.66, 13/04 at 02:40:57.

    ## Containment
    (to do: cut the pool and the intruder's address, stop what runs, close
    deploy — without cutting your own ssh, and without stopping the
    deliveries)

## Events

# { $pool }: the pool's address
containment-event-pool =
    The miner can no longer reach { $pool }: whatever it computes, it
    can't hand it in. The host will see the connection stop.
# { $address }: the intruder's address
containment-event-attacker =
    { $address } can no longer open a connection to this server. It won't
    stop someone who changes address, but it closes the way they used.
containment-event-locked-out =
    Careful: with these rules, your next ssh connection from your
    workstation would be refused. Your current session stays open (the
    firewall doesn't cut an established connection), but log out now and
    you're locked outside. Accept your own ssh first (iptables -L
    --line-numbers to see the order).
# { $pid }: the new miner's PID
containment-event-respawn =
    kworkerd is back, as PID { $pid }: the watchdog (/bin/sh
    /tmp/.cache/.w) restarts it whenever it's missing. Stop the watchdog
    first, or freeze it (kill -STOP), then the miner.
containment-event-app-down =
    The delivery app has stopped: it ran as deploy too, so it went with the
    rest. The drivers need it at 11: start it again (systemctl).
containment-event-relaunched =
    The app has started again… and so have the watchdog and the miner.
    Starting the app relaunched them: something in the app itself does it.
    Note it in incident.md; stop them again, and keep this for the next
    step.
containment-event-stopped =
    Nothing left running from /tmp/.cache. The files are still there, and
    whatever relaunches them too: that will be the next step's work.
containment-event-password-only =
    usermod -L locks deploy's password, not the account: sshd still accepts
    a key, and the intruder may have left one. usermod's manual says what
    to add to lock the account for good (the EXPIRE_DATE).
containment-event-closed =
    deploy can no longer log in at all, key or password. Selma will need
    it back on Monday; it will be reopened properly then.
containment-event-end =
    Nadia: "The rounds are up and the host says the connection has
    stopped. Thank you. And we didn't have to unplug anything."

    Well done! You have finished the chapter "Containment".

    WHAT HAPPENED
    You stopped the damage without stopping the business: the pool and the
    intruder's address are blocked, the miner and its watchdog are stopped
    in the right order, and deploy is closed for good, key included. And
    the delivery app still runs.

    GOOD PRACTICE
    - Contain first, clean up afterwards: the goal is to stop the harm
      while keeping the evidence and the service.
    - Before a firewall rule, think of your own access: an established
      session survives, the next one doesn't.
    - A process that comes back has a parent that restarts it: look at the
      tree (ps -ef, the PPID column) and stop the parent first.
    - usermod -L locks the password, not the account: with sshd and PAM,
      a key still opens it. Expire the account (usermod -e 1) or give it
      nologin.

    ANOTHER WAY
    On a virtual machine, the host can take a snapshot of the memory and
    the disk before anything is touched: the most faithful evidence there
    is. On a physical server, isolating it on the network (one switch port)
    does the same work as the firewall rules, from outside the machine.

    DOCUMENTATION
    - iptables: https://man7.org/linux/man-pages/man8/iptables.8.html
    - kill and signals: https://man7.org/linux/man-pages/man7/signal.7.html
    - usermod (-L, -e): https://man7.org/linux/man-pages/man8/usermod.8.html
    - NIST SP 800-61r2, containment: https://csrc.nist.gov/pubs/sp/800/61/r2/final
