### Story "The Co-op", chapter "Updates": apt upgrade over a fragile
### connection (tmux), rebooting for the kernel, and a service that doesn't
### come back. Commands, paths and the output of apt, dpkg and tmux (in
### English) are not translated.

chapter-updates = Updates
    .summary = Months behind: apt upgrade over Wi-Fi that keeps dropping (tmux, dpkg --configure -a), a new kernel, and a reboot that reveals a forgotten service.

## Files

updates-email-awa =
    From:    Awa
    To:      you
    Subject: Updates

    Marc never updated the server ("it works, don't touch it"). The
    payment provider requires security fixes to be installed. This
    morning, before opening time (10 a.m.), could you:

    1. install the updates (man apt: update first);
    2. reboot the server if needed;
    3. check that everything runs afterwards: the website AND the till.

    Careful: the co-op's Wi-Fi drops now and then (the router is tired).
    If your connection drops in the middle of the update… Gaspard, from
    the Community Centre, told me to mention tmux to you.

    For sudo: radish-2027

## Events

updates-event-interrupted =
    The connection dropped in the middle of the update, and dpkg with it:
    some packages are unpacked, but not configured. apt refuses to go on
    until the job is finished: sudo dpkg --configure -a (man dpkg).

    Next time, start a long operation on a server inside tmux: it survives
    the connection.
updates-event-in-tmux =
    Your connection dropped… but the update was running in tmux: it went
    all the way, without you. Reattach to your session (tmux ls, then
    tmux attach) to see how it ended.
# { $oldest }: the running kernel; { $new }: the one just installed
updates-event-a-day =
    The updates are installed. But the new kernel ({ $new }) isn't
    running yet: uname -r still says { $oldest }. Look at
    /var/run/reboot-required.pkgs: you need to reboot (before 10 a.m.!).
updates-event-till-down =
    The server rebooted on the new kernel… but the till no longer answers.
    systemctl status till: "disabled". Marc used to start it by hand; its
    service was never enabled at boot (man systemctl: enable).
updates-event-end =
    The fixes are installed, the new kernel is running, and both the
    website and the till came back on their own. It's 9:50 a.m. Awa: "Right
    on time. Let's open!"

    Well done! You have finished the chapter "Updates".

    WHAT HAPPENED
    apt upgrade downloads the new versions, unpacks them, then configures
    them. If the session dies in between, dpkg is left halfway. tmux keeps
    the session on the server: the connection can drop, the work goes on.
    A new kernel is only used after a reboot (uname -r), and a reboot only
    starts services that are enabled.

    GOOD PRACTICE
    - Security updates, often (and automatically: the
      unattended-upgrades package).
    - Long operations inside tmux (or screen).
    - Read /var/run/reboot-required before saying "it's done", and
      reboot at a time you choose.
    - After a reboot: systemctl --failed, and check the services that
      matter; every useful service must be enabled (enable).

    DOCUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - tmux: https://man.openbsd.org/tmux
    - Debian, updates: https://www.debian.org/doc/manuals/debian-reference/ch02.en.html
