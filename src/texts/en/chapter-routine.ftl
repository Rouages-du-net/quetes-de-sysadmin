### Story "The Watch", chapter "Settling Into a Routine": automate security
### updates (without doing everything on its own) and schedule a weekly
### check-in. apt.conf keywords, commands and paths are not translated.

chapter-routine = Settling Into a Routine
    .summary = Automate what can be automated (security updates, a weekly check-in), without replacing human judgment.

## Files

routine-email-salome =
    From:     Salomé
    To:       you
    Subject:  The last piece: making it a habit

    The week is done, but a watch isn't something you do once. Two things
    to set up before I'm really gone for good:

    1. unattended-upgrades is installed, but not enabled (look at
       /etc/apt/apt.conf.d/20auto-upgrades: both periodic tasks are set to
       "0"). Turn them on. And limit it to SECURITY updates only
       (/etc/apt/apt.conf.d/50unattended-upgrades): auto-updating
       everything would break something one day without warning. Give
       yourself a report by mail (Unattended-Upgrade::Mail).
    2. A weekly check-in that reminds you to read the next bulletin: a
       systemd timer or a cron job, that mails you the list of packages
       waiting for an update (man systemd.timer, man crontab).

    unattended-upgrades will handle security updates on its own; the rest
    (a CVE with no fix yet, a package outside of security) stays your job,
    every week, with the next bulletin.

    Salomé
    (For sudo, your password is still: levain-2028)

## Events

routine-event-syntax =
    There is a syntax error in apt's configuration! An assignment is
    written "Key "value";", a list "Key {"{"} "a"; "b"; {"}"};" (man apt.conf).
    Fix it before moving on: apt refuses to read the rest while it's there.
routine-event-active =
    Both periodic tasks are enabled. What's left is limiting what
    unattended-upgrades touches, and giving yourself a report.
routine-event-security =
    unattended-upgrades is active, limited to security updates
    (Debian-Security), and a report will go out by mail. The weekly
    check-in remains.
routine-event-periodic =
    A check-in exists, and it's one that survives a reboot. It will remind
    you, every week, to read the next bulletin — even for what
    unattended-upgrades doesn't fix on its own.
routine-event-end =
    Salomé: "There you go. unattended-upgrades for what fixes itself, a
    check-in for the rest. You don't need me for this any more."

    Well done! You have finished the chapter "Settling Into a Routine", and
    the story "The Watch".

    WHAT HAPPENED
    A security watch that depends entirely on one person's memory
    eventually skips a week. Two complementary safety nets: automation for
    what needs no judgment (a security update already published, already
    tested by Debian), and a regular check-in for what does (reading a
    bulletin, deciding on a priority, writing down what was found).

    GOOD PRACTICE
    - Limit automation to security updates: the rest (a new major version,
      a dependency changing behaviour) deserves to be seen before being
      applied.
    - Give yourself a report (by mail, or any other means you actually
      look at): a silent automation nobody ever watches is as good as
      having done nothing.
    - Write scheduled tasks under /etc (system files, not a script lost in
      a personal folder): they must survive a reboot and a change of
      account.
    - A routine doesn't replace judgment: it frees up time to spend it
      where it's truly needed.

    ANOTHER WAY
    Instead of an email, a weekly check-in can also be a task in a project
    manager, an alert in a monitoring tool (like the plugins from "The
    Probe"), or simply a reminder in a shared team calendar: what matters
    is that someone actually sees it, not the exact form of the reminder.

    DOCUMENTATION
    - unattended-upgrades: https://wiki.debian.org/UnattendedUpgrades
    - systemd.timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - crontab: https://manpages.debian.org/bookworm/cron/crontab.5.en.html
