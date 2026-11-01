### Story "The Audit", chapter "The Report": four hygiene findings on the
### Bakery's server (SSH, a forgotten account, passwordless sudo, a secret
### readable by everyone). The keywords (PermitRootLogin, NOPASSWD…), the
### commands, the paths and the tools' messages are not translated.

chapter-report = The Report
    .resume = Fix an audit's findings: SSH, a forgotten account, passwordless sudo, a secret readable by everyone.

## Files

report-email-nadia =
    From:     Nadia (The Bakery)
    To:       you
    Subject:  The audit of my server

    I run the bakery, not the server: you look after it now. My insurer
    wants a security audit before renewing the contract, so I brought in
    Salomé, an independent auditor. She went through the server yesterday
    and left me her report, which I copied into your folder:
    audit_report.txt.

    I don't understand all of it, but she seems serious. Could you handle
    the findings one by one without taking the online orders down? We have
    a crowd at the counter every morning, and the site must not go down.

    For sudo, your password is: flour-2028
    And please check each fix: Salomé will come back to verify.

report-report-audit =
    AUDIT REPORT — The Bakery (bakery.example)
    Auditor: Salomé, independent
    Scope: the bakery server (192.0.2.22)
    Method: review of accounts and configuration, port scan from the
    internet, reading the logs

    This report has three parts. Here is the first one, the server's
    hygiene. The other two will follow (network exposure, login traces).

    C1 — SSH accepts direct logins by the root account          [high]
         A bot guessing a password, or a stolen key, would hand over every
         right at once. Reference: sshd_config(5), PermitRootLogin.

    C2 — A departed person's account still exists               [high]
         lucas, an intern whose contract ended on 28 February, still has an
         account, and is a member of the sudo group.

    C3 — Passwordless sudo for the administration account      [medium]
         A stolen session or an unlocked screen is enough to get root
         without typing anything. Reference: sudoers(5), NOPASSWD.

    C4 — A secrets file is readable by everyone                [medium]
         /srv/commandes/.env holds the database address with its password.
         Any account on the server can read it.

    Expected: for each finding, fix it, then check that the fix holds (and
    that nothing is broken: the site, the orders app and the
    administration access stay in service).

## Events

report-event-sudoers-broken =
    There is an error in the sudo policy! When a sudoers file is wrong, sudo
    refuses everything, for everyone. These files are edited with visudo
    (man visudo): it checks the syntax before saving.
report-event-locked-out =
    WARNING: with the configuration sshd has just loaded, a new login from
    your account would be refused. Your current session stays open (sshd
    never cuts the sessions in progress): now is the time to fix it, BEFORE
    you disconnect.
report-event-without-effect =
    The file does say "PermitRootLogin no"… but sshd has not applied it yet:
    it reads its configuration at startup and when it is told to reload.
    Check with  sudo sshd -t  (the syntax), then have the service reload. To
    see what sshd really applies:  sudo sshd -T
report-event-account-incomplete =
    You have handled only part of finding C2. A "closed" account means: no
    way to log in any more (locked password, expired account) AND no rights
    left (removed from the sudo group). See what remains with  id lucas  and
    sudo chage -l lucas  (man chage, man usermod).
report-event-app-blind =
    The secret is no longer readable by everyone… but the orders app can't
    read it either! It runs as the "commandes" account and reads .env at
    startup: it would not come back at the next reboot. Look at who owns the
    file (ls -l): the goal is to close the door to the other accounts, not
    to the app.
report-event-ssh =
    sshd applies your new configuration: root can no longer log in, and your
    account still can. C1 is handled.

    On a real server you keep one session open and test with a second one
    before closing the first.
report-event-account =
    Nobody can log in with Lucas's account any more, and it has no rights
    left on the server. C2 is handled.
report-event-sudo =
    No NOPASSWD rule left for your account: sudo asks for your password, as
    it should, and you can still administer. C3 is handled.
report-event-secret =
    The secrets file is now readable only by the app (and its owner), and the
    app can still read it. C4 is handled.
report-event-end =
    All four findings are fixed, and nothing is broken. Nadia: "The site
    didn't move a bit. I'll pass this on to Salomé!"

    Well done! You have finished the chapter "The Report".

    WHAT HAPPENED
    An audit does not look for hackers: it compares the server with what it
    should be. These four findings are the most common ones: an entrance
    that is too wide (root over SSH), an access forgotten after a departure
    (account and sudo), a privilege without a safeguard (passwordless sudo)
    and a secret within everyone's reach (.env as rw-r--r--). None is an
    attack: each one makes an attack easier.

    GOOD PRACTICE
    - PermitRootLogin no: you become root with sudo, from your own account,
      which leaves a trace of who did what. Always sshd -t before reloading,
      and keep a session open to test.
    - At every departure, close the account: userdel (or usermod -L, a
      chage -E and removal from sudo if you want to keep their files). A
      list of accounts reviewed regularly prevents oversights.
    - sudo with a password, or rules limited to one command: least
      privilege. The files in /etc/sudoers.d are edited with visudo.
    - A secrets file: chmod 600, owned by the account that uses it. Better:
      never keep a plain-text secret in a repository or on a share.

    ANOTHER WAY
    For C2, deleting the account is cleanest; locking it, expiring it and
    removing it from sudo keeps its files for a handover, but leaves a door
    to watch: an account that is only locked (usermod -L) would still accept
    an SSH key; it is the expiry (usermod -e, chage -E) that really closes
    it, along with removal from sudo.

    DOCUMENTATION
    - sshd_config: https://man.openbsd.org/sshd_config
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - userdel and usermod: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
