### Story "The Co-op", chapter 6 "Automatic updates":
### unattended-upgrades. Commands, paths, apt configuration keys and
### package names are not translated.

chapter-auto-updates = Automatic updates
    .summary = New security updates already: enable unattended-upgrades, get the report, reboot at night, and leave nodejs alone.

## Files

auto-updates-email-awa =
    From:     Awa
    To:       you
    Subject:  More updates?

    Thanks again for last time! But I just read that there are already
    new flaws in openssl and in the kernel. We can't call you every
    week…

    Marc told me he had installed "automatic updates"
    (unattended-upgrades) a year ago. Apparently, nothing has ever
    installed itself. Can you take a look? What we'd like:
      - security updates installing themselves, every day;
      - being told about it: an email to root is enough, Lina reads it;
      - if a reboot is needed, it should happen on its own, but while
        the co-op is closed (we're open from 7 a.m. to 8 p.m.);
      - above all, don't touch nodejs: Lina says the till only works
        with version 20, and Marc added the version 22 repository
        "to get ready".

    The configuration is in /etc/apt/apt.conf.d (man apt.conf,
    man unattended-upgrade). To check without waiting for tomorrow
    morning, the service that does the work every morning can be
    started by hand.

## Events

auto-updates-event-syntax =
    apt no longer understands its configuration ("E: Syntax error"): it
    refuses EVERYTHING, automatic updates included. Most often, a ";"
    forgotten at the end of a line, or a brace. apt-config dump gives
    the file and the line.
auto-updates-event-nothing =
    The apt-daily-upgrade service ran… and did nothing. It starts
    apt.systemd.daily, which reads APT::Periodic::Unattended-Upgrade: at
    "0" (which is the case in 20auto-upgrades), it stops right away.
    That's why nothing has ever been installed. (apt-config dump
    APT::Periodic shows what apt understood.)
auto-updates-event-nodejs =
    Ouch: nodejs just moved to version 22. The till still runs (with
    the old program in memory), but it won't restart: it requires
    Node.js 20. A pattern that is too broad in Origins-Pattern lets
    third-party repositories through, which nobody has tested with the
    till. To go back, restart the chapter from the menu; and keep
    nodejs out of it (don't allow its origin, or use
    Package-Blacklist).
auto-updates-event-in-day =
    The machine just rebooted, in the middle of the afternoon:
    Automatic-Reboot is enabled, but without a time, unattended-upgrades
    reboots right away ("now"). Two minutes without a till, a queue at
    the front desk. You need a time when the co-op is closed:
    Automatic-Reboot-Time.
auto-updates-event-without-report =
    The updates were installed, but nobody will ever know: without
    Unattended-Upgrade::Mail, no report is sent.
auto-updates-event-end =
    Security updates install themselves every morning, the report goes
    to root, the machine will reboot tonight for the new kernel, and
    nodejs stays at version 20. Lina: "I got the email! It says a
    reboot will be needed, and that it will happen on its own
    tonight."

    Well done! You have finished the chapter "Automatic updates".

    WHAT HAPPENED
    unattended-upgrades was installed, but switched off: 20auto-upgrades
    said "0". Every morning, the apt-daily-upgrade timer started the
    service, which read that "0" and stopped. Once enabled, it
    installs what 50unattended-upgrades allows: the origins of Debian
    and its security updates, not the NodeSource repository.

    GOOD PRACTICE
    - Automatic security updates on every server; third-party
      repositories and major versions by hand, after a test.
    - A report by email (Mail), and a reboot scheduled when nobody
      is using the machine (Automatic-Reboot-Time).
    - Check without waiting: unattended-upgrade --dry-run --debug,
      apt-config dump, and the log in /var/log/unattended-upgrades.
    - A report that stops arriving is an alert: it has to be read.

    DOCUMENTATION
    - UnattendedUpgrades (Debian wiki): https://wiki.debian.org/UnattendedUpgrades
    - unattended-upgrade(8): https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html
    - apt.conf(5): https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
