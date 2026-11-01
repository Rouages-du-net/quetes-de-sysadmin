### Story "The Neighbourhood Letters", chapter "The sentinel":
### fail2ban. Commands, paths, addresses, configuration keywords
### (bantime, ignoreip…) and fail2ban's output (in English) are not
### translated.

chapter-sentinel = The sentinel
    .resume = Ban the robots without banning your friends: fail2ban, jail.local, ignoreip.

## Files

sentinel-email-kofi =
    From:    Kofi (La Fourmilière)
    To:      you
    Subject: Rania can't log in anymore

    Rania, our webmaster, hasn't been able to log in to the server since
    this morning: "Connection refused". She says she got her user name wrong
    several times. Yasmine thinks it's fail2ban, the guard installed with the
    server, that mistook her for a robot. Her
    address: 198.51.100.40.

    Yasmine also noticed that the robots come back every ten
    minutes: look at /var/log/fail2ban.log. They are knocking at the door
    right now; to watch them live (Ctrl-C to stop):

      journalctl -fu ssh
      tail -f /var/log/fail2ban.log

    Could you:

    1. give Rania her access back;
    2. make sure that neither Rania nor you ever get banned again;
    3. ban the robots for longer, at least an hour?

    According to Yasmine, it's all in man fail2ban-client and man jail.conf, and
    "whatever you do, don't touch jail.conf". The sudo password hasn't
    changed.

## Events

sentinel-event-jail-conf =
    You changed /etc/fail2ban/jail.conf. It works… until the next
    fail2ban update, which will replace this file, and your settings along
    with it. The file says so itself at the top: "YOU SHOULD NOT MODIFY THIS
    FILE". Better put your settings in /etc/fail2ban/jail.local.
sentinel-event-error =
    fail2ban's configuration has an error. Before reloading, check it
    with  sudo fail2ban-client -t: it gives the file and the line at fault.
sentinel-event-rania =
    Rania is no longer banned: she can log in again. But if she
    gets it wrong five more times, fail2ban will ban her again…
# { $adresse }: the address of the workstation
sentinel-event-banned-self =
    WARNING: fail2ban just banned { $adresse }… the address of your own
    workstation! Yesterday you had three failed logins (look for "Failed publickey"
    in journalctl -u ssh), and with these settings, that's enough. Unban yourself,
    and add your address to ignoreip, before you disconnect.
sentinel-event-set =
    fail2ban applies your settings: the robots stay banned for
    longer, and neither Rania nor you will be banned again. Check the state of the
    jail: sudo fail2ban-client status sshd.
sentinel-event-end =
    The robots are banned for good, Rania can log in again, and your workstation
    is no longer at risk. Kofi: "Rania says thank you, she was able to publish the
    programme!"

    Well done! You have finished the chapter "The sentinel".

    WHAT HAPPENED
    fail2ban reads the SSH log and bans an address after a certain
    number of failures. With the default settings, the ban only lasted
    ten minutes: the robots came straight back. And a human who
    gets it wrong five times looks like a robot.

    GOOD PRACTICE
    - Never modify jail.conf: put your settings in jail.local.
    - ignoreip for your own addresses and your team's, BEFORE
      tightening maxretry.
    - A longer bantime for repeat offenders (1h, 1d); to go
      further, the "recidive" jail bans those who come back
      for a week.
    - fail2ban-client -t before reloading, status sshd to check, and
      set sshd unbanip to undo a mistake.
    - fail2ban doesn't replace SSH keys: it reduces noise and
      load; the real protection is still PasswordAuthentication no.

    ANOTHER WAY
    ufw limit 22/tcp denies an address that opens 6 or more connections in
    30 seconds, without reading any log: simple, but blind (it doesn't
    see failed logins, and it also slows down a colleague in a
    hurry). fail2ban reads the failures themselves. Even better: keys
    only (PasswordAuthentication no), which make brute force
    pointless.

    DOCUMENTATION
    - jail.conf: https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - fail2ban-client: https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html
