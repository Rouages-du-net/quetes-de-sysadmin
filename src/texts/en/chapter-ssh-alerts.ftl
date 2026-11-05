### Story "The Huts", chapter 3 "Failed Logins": an rsyslog rule with a
### condition, the order of the rules, stop. Configuration, paths and the
### tools' outputs are not translated.

chapter-ssh-alerts = Failed Logins
    .summary = Robots try passwords on every hut. Lou's alert reads a single file: put the failed logins of all the huts in it, and nothing else, without breaking the per-hut files.

## Files

ssh-alerts-message-lou =
    From:     Lou
    To:       you
    Subject:  An alert for SSH attacks

    Hello,

    I wrote a little check, run by cron every five minutes: it counts the
    lines of /var/log/remote/ssh-failures.log, and sends me a text message
    if it grows too fast. Someone trying passwords on a hut, in short.

    Could you make rsyslog write in it the failed SSH logins of all the
    huts (and only those)? The per-hut files must keep working.

    Same sudo password: summit-2028.

    Lou

## Events

ssh-alerts-event-failures =
    "Failed password for invalid user admin…": sshd's message for a wrong
    password. In rsyslog, a message has properties: $programname (sshd),
    $msg (the text), $fromhost-ip… An "if" tests them (man rsyslog.conf).
ssh-alerts-event-rule =
    A rule writes to ssh-failures.log. Is rsyslog using it yet? It reads
    its configuration when it starts (sudo rsyslogd -N1 to check, then a
    restart).
ssh-alerts-event-after-stop =
    The rule is there, rsyslog restarted, and ssh-failures.log stays
    empty: the rules run in order, and the huts' messages stop at the
    per-hut rule of 10-remote.conf. A rule placed after it never sees
    them. Put yours before (a file read earlier: 05-…, or inside the
    same block, before the stop).
ssh-alerts-event-too-wide =
    ssh-failures.log gets more than failed logins: the filter is too wide
    (the program alone also takes "Accepted publickey…"). Add a condition
    on the message ($msg contains 'Failed password').
ssh-alerts-event-per-hut-broken =
    The per-hut files don't receive any more: a rule now stops the huts'
    messages before them, or the per-hut rule was changed. Both must
    work.
ssh-alerts-event-end =
    ssh-failures.log gathers the failed logins of all the huts, and only
    those; each hut keeps its file. Lou: "Three robots at once on the pass
    hut, and my phone rang. Perfect."

    Well done! You have finished the chapter "Failed Logins".

    WHAT HAPPENED
    rsyslog applies its rules in order, and stop ends a message's journey.
    The per-hut rule ended with stop: a new rule had to come before it,
    and test both the program and the message.

    RSYSLOG'S RULES
    - if $programname == 'sshd' and $msg contains 'Failed password' then
      /var/log/remote/ssh-failures.log
    - The files of /etc/rsyslog.d are read in alphabetical order (05-…
      before 10-…), before the rules of rsyslog.conf.
    - A message may go to several files, until a stop.

    GOOD PRACTICE
    - rsyslogd -N1, then restart, then try it: logger -t sshd "Failed
      password for test".
    - An alert on a rate (lines per minute), not on each line.
    - Against password guessing itself: keys only, and fail2ban.

    DOCUMENTATION
    - RainerScript conditions: https://www.rsyslog.com/doc/rainerscript/control_structures.html
    - The properties: https://www.rsyslog.com/doc/configuration/properties.html
