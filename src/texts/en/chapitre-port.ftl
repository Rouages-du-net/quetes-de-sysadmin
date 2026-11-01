### Story "The Neighbourhood Letters", chapter 7 "The port":
### moving SSH to another port without locking yourself out (sshd, ufw,
### ~/.ssh/config, the fail2ban jail). Commands, paths, options
### and log lines are not translated.

chapitre-port = The port
    .resume = Robots are flooding the SSH log: move it to port 2222, without locking yourself out, and without forgetting fail2ban.

## Files

# { $port }: the new SSH port
port-courriel-kofi =
    From:    Kofi
    To:      you
    Subject: The SSH port

    Rania looked at the SSH log (journalctl -u ssh): hundreds of
    "Invalid user" every night, always on port 22. fail2ban bans
    some, but others keep coming, and we can't see anything useful
    in that log any more.

    She suggests moving SSH to port { $port }: "It doesn't protect
    against anything (our keys and fail2ban do), but most robots only
    knock on 22. The log will be readable again."

    Fine, but I remember the firewall: we nearly locked
    ourselves out. This time, there are several doors to open before
    closing one:
      - the SSH server itself (man sshd_config, Port);
      - the firewall (sudo ufw status);
      - your workstation, which must know where to knock (man ssh_config);
      - and fail2ban: is its sshd jail watching the right port?

    Rania adds: "ufw is only a front. The real rules, the kernel's,
    can be read with sudo nft list ruleset. Worth a look."

## Events

port-evenement-enferme =
    WARNING: sshd is no longer listening on any port the firewall lets
    through. Your session holds (neither sshd nor ufw cuts existing
    connections), but the next connection will fail. Fix it BEFORE you
    disconnect: put the old port back, or open the new one in ufw.
# { $port }: the new port
port-evenement-deux-ports =
    Well played: sshd listens on both ports, 22 and { $port }, and the
    firewall lets { $port } through. That's the safe manoeuvre: the old
    door stays open while you try the new one. Test it from
    your workstation, in another connection, before closing anything.
    (sudo nft list ruleset shows the rule ufw just wrote, in the
    ufw-user-input chain.)
# { $port }: the new port
port-evenement-essai =
    There you are, connected through port { $port }. The new door works:
    you can now close the old one, in sshd and in the firewall.
port-evenement-defaut =
    fail2ban reloaded jail.local, but its sshd jail still keeps
    port 22. A "port = 2222" placed in [DEFAULT] only applies to
    jails that say nothing about their port; but the [sshd] in jail.conf says
    "port = ssh", and a value in a jail's own section always wins
    over [DEFAULT], whatever the file (man jail.conf). The
    setting goes in an [sshd] section of jail.local.
port-evenement-sentinelle =
    SSH now only listens on 2222… but fail2ban's sshd jail still bans
    on the "ssh" port, that is 22 (port = ssh, in
    jail.conf). A banned address could keep trying on 2222.
    sudo nft list ruleset shows it: in the f2b-table table, the rule
    rejects banned addresses towards "tcp dport {"{"} 22 {"}"}" only.
port-evenement-fin =
    SSH now only listens on port 2222, the firewall only lets that
    through, fail2ban watches it, and your workstation knows where to knock.
    The next day, Rania: "Three attempts last night instead of four
    hundred. The log is readable again."

    Well done! You've finished the chapter "The port".

    WHAT HAPPENED
    Changing the SSH port doesn't make the server any safer: a port
    scan finds it in seconds, and it's the keys, the sshd
    configuration and fail2ban that protect it. But the robots that
    only knock on 22 disappear from the log, and real alerts
    become visible again. The risk, though, is real: close a port too
    early, and you're stuck outside.

    GOOD PRACTICE
    - Open before you close: sshd on both ports, ufw allows the
      new one, test from another connection, then close the old one.
    - Everything that mentions the port follows: firewall, fail2ban (the
      jail's port, in an [sshd] section), ~/.ssh/config on workstations,
      monitoring tools.
    - ufw and fail2ban write nftables rules: sudo nft list ruleset
      shows what the kernel really applies.
    - On Ubuntu 22.10 and later, SSH starts from a systemd socket
      (ssh.socket): after changing the port, systemctl daemon-reload,
      then systemctl restart ssh.socket.

    DOCUMENTATION
    - sshd_config, Port: https://man.openbsd.org/sshd_config#Port
    - ssh_config, Port: https://man.openbsd.org/ssh_config#Port
    - jail.conf (fail2ban): https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
