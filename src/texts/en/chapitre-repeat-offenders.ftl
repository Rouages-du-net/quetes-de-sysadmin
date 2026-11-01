### Story "The Neighbourhood Letters", chapter 8 "Repeat offenders":
### more fail2ban jails (recidive, nginx-limit-req). Commands,
### paths, jail names and log lines are never translated.

chapitre-repeat-offenders = Repeat offenders
    .resume = The same bots come back every hour, and the calendar's bot keeps at it: enable fail2ban's recidive and nginx-limit-req jails.

## Files

repeat-offenders-courriel-rania =
    From:    Rania
    To:      you
    Subject: Always the same ones

    Hello!

    Since SSH moved to port 2222, it's calmer, but look at
    /var/log/fail2ban.log: two addresses get banned for an hour,
    unbanned, banned again… nine times since yesterday for one of them. They
    found the new port, and a one-hour ban doesn't
    discourage them.

    And the bot that was scraping the calendar on the night of the concert
    is back. nginx does limit it (it gets refusals), but it keeps at it: the
    nginx error log (/var/log/nginx/error.log) is full of
    "limiting requests".

    fail2ban has ready-made jails for both cases, they are
    described in /etc/fail2ban/jail.conf (look for recidive, and the
    nginx jails). They're simply disabled. Remember:
    we don't touch jail.conf, we configure things in jail.local.

    Watch out for me: while testing the limit, I
    reloaded the calendar a bit too fast myself.

    To check: sudo fail2ban-client status, then the status of
    each jail. And sudo nft list ruleset shows what each jail
    blocks.

## Events

repeat-offenders-evenement-tout-active =
    fail2ban refuses to start: "Have not found any log file". With
    enabled = true in [DEFAULT], you enabled ALL the jails in
    jail.conf, including those for apache and postfix, which don't run
    here: fail2ban can't find their logs and stops. You enable a
    jail in its own section: [recidive], [nginx-limit-req]…
repeat-offenders-evenement-courte =
    The recidive jail is active, but it doesn't ban for longer
    than the sshd jail. That's its whole point: an address banned
    several times is then banned for a long time (a week, in
    jail.conf). Keep a much longer bantime for recidive.
repeat-offenders-evenement-recidive =
    The recidive jail read fail2ban.log, counted the bans of
    each address, and banned the repeat offenders for a week, on all
    ports (banaction_allports): SSH, but the website too.
repeat-offenders-evenement-agenda =
    The nginx-limit-req jail read nginx's error log and banned
    the calendar bot's addresses. nginx doesn't even see them
    arrive anymore: the firewall rejects them first.
repeat-offenders-evenement-fin =
    The repeat offenders are banned for a week, the calendar bot
    too, and neither Rania nor the visitors were affected. Rania:
    "fail2ban.log fits on one screen now!"

    Well done! You've finished the chapter "Repeat offenders".

    WHAT HAPPENED
    A fail2ban jail is a log to read, a filter (what counts as
    a failure) and an action (what gets blocked, and for how long).
    nginx-limit-req reads the refusals of nginx's rate limit;
    recidive reads fail2ban's own log: an address banned five
    times in one day is then banned for a week, on all ports.
    ignoreip, set in [DEFAULT], protects Rania in every jail.

    GOOD PRACTICE
    - Enable a jail in its section of jail.local (enabled = true),
      never in [DEFAULT], never in jail.conf.
    - fail2ban-client -t before reloading, then fail2ban-client status
      for each jail.
    - recidive bans for longer than the other jails; fail2ban's
      database (dbpurgeage) must keep bans at least as
      long as its findtime.
    - Another approach, since fail2ban 0.11: bantime.increment = true
      lengthens the ban at each repeat offence, in every jail.

    DOCUMENTATION
    - jail.conf (fail2ban): https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - The jails shipped with fail2ban: https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf
    - limit_req (nginx): https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
