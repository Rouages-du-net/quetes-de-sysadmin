### Story "The Neighbourhood Letters", chapter "Shut the Door":
### hardening SSH on a new server under brute-force attack. sshd_config
### keywords (PermitRootLogin…), commands, paths and OpenSSH messages
### (in English) are not translated.

chapter-shut-the-door = Shut the Door
    .summary = Harden SSH: sshd_config, sshd -t, reload, and don't lock yourself out.

## Files

door-email-kofi =
    From:    Kofi (The Anthill)
    To:      you
    Subject: The Letters' new server

    Thanks to you, the Neighbourhood Letters website works again! So the
    association has rented a small server just for it. The hosting company
    installed it last night and created an account for you (user name: you), with
    your SSH key: that's how you just got in.

    But a friend told me a new server gets attacked within the hour.
    Could you look at who's knocking at the door (the ssh service's log)
    and shut it properly?

    1. Nobody should be able to log in directly as root any more.
    2. No more passwords at all for SSH: keys only.
    3. And above all, check that YOU can still get in!

    The SSH server's configuration is in /etc/ssh/sshd_config
    (man sshd_config). For sudo, your password is: ants-2026
    (yes, you still need one for sudo, even without passwords for SSH).

## Events

# { $config }: the path of the configuration file
door-event-error =
    There's an error in the SSH configuration! Before reloading, always
    check with  sudo sshd -t: it gives the file and line at fault.

    (Good news: as long as the configuration is wrong, systemctl reload
    ssh refuses to apply it and sshd keeps the old one. You won't lock
    yourself out because of a typo.)
door-event-locked-out =
    WARNING: with the configuration sshd has just loaded, a new connection
    from your account would be refused. Your current session, however,
    stays open: sshd never cuts off sessions in progress.

    Now is the time to fix it, BEFORE you log out. That's why you always
    keep a session open when you change the SSH configuration.
door-event-without-effect =
    Strange: you wrote PasswordAuthentication no and reloaded ssh… but
    passwords are still accepted. Ask sshd what it really applies:

      sudo sshd -T | grep -i password

    Then reread the beginning of /etc/ssh/sshd_config, and man sshd_config:
    for each keyword, which value wins when it appears twice?
door-event-closed =
    sshd is applying your new configuration: no more root, no more
    passwords. In the log (journalctl -u ssh), the bots are now turned
    away before they even try a password ("[preauth]").

    The most important thing remains: checking that YOU can still get in.
    On a real server, you keep this session open and open a second one
    to test. Here: exit, then ssh letters.
door-event-end =
    You got in with your key: the door is shut to the bots, but not to you.
    Kofi: "Thanks! I'll sleep better."

    Well done! You have finished the chapter "Shut the Door".

    WHAT HAPPENED
    A server exposed on the internet receives login attempts within
    minutes: bots try root and common names (admin, test, ubuntu) with
    weak passwords. By accepting only keys, and never root directly, you
    shut the door on them: a key can't be guessed.

    GOOD PRACTICE
    - PermitRootLogin no and PasswordAuthentication no; you become root
      with sudo, from your own account.
    - Always sudo sshd -t before reloading, and sudo sshd -T to see what
      is really applied.
    - Watch out for included files (Include): for each keyword, the
      FIRST value read wins.
    - Keep a session open during changes, and test with a new connection
      before closing it.
    - To go further: ban persistent bots (fail2ban) and filter ports
      (firewall), in the next chapters.

    DOCUMENTATION
    - sshd_config: https://man.openbsd.org/sshd_config
    - sshd: https://man.openbsd.org/sshd
