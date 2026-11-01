### Story "The Data Centre", chapter "First day": first day of the
### internship, the media library website is down. Read an nginx log,
### chain commands with |, write with > and >>, stop a
### process, write to a root-owned file with sudo tee.
### Commands, paths and IP addresses are not translated.

chapter-first-day = First day
    .summary = Read a server log, chain commands with |, write with > and >>, stop a process.

## Files

first-day-email-awa =
    From:    Awa (operations manager)
    To:      you, intern
    Subject: Welcome… and it's urgent!

    Welcome to the team! Your timing is perfect: since 8:25 pm, the media
    library website has been answering with 503 errors ("Service Unavailable").

    I'm stuck in a meeting. Can you investigate? The web server's log
    is here:

      /var/log/nginx/access.log

    Each line is one visit: the visitor's IP address, the date, the page
    requested, then the response code (200 = OK, 503 = down).

    1. How many 503 errors are there in the log?
    2. Who is sending so many requests?
    3. Get the site working again, then write me a short report in
       ~/rapport.txt: the number of 503 errors and the culprit's address.

    The log has hundreds of lines: don't count them by hand! Start by
    reading my notes, the commands you need are in there:

      cat notes_awa.txt

    Your temporary password (for sudo): welcome-2026
    Change it soon, and don't write it down anywhere!
first-day-notes-awa =
    AWA'S NOTES — EVERYDAY COMMANDS

      head file           the beginning (10 lines)   tail file      the end
      tail -f file        the end, then the new lines as they arrive, live (Ctrl-C to stop)
      wc -l file          counts the lines
      grep pattern file   the lines that contain the pattern

    The real power of Unix: the PIPE |. The output of one command becomes
    the input of the next. For example:

      grep " 503 " access.log | wc -l     counts the lines containing "503"

    (the quotes keep the spaces: we look for "503" surrounded by spaces,
    so we don't hit a 503 hidden inside an address or a size).

    To find out who makes the most requests:

      cut -d " " -f 1 file        keeps the 1st field of each line (the IP)
      sort                        sorts the lines
      uniq -c                     counts identical consecutive lines
      sort -n                     sorts by number
      tail -3                     keeps the last 3 (the largest)

    Chain them all with | . Give it a try!

    Writing to a file:
      command > file         OVERWRITES the file with the result
      command >> file        APPENDS the result at the end

    Forgot sudo? No need to retype everything: sudo !! runs the last
    command again, with sudo in front. And history shows everything you typed.

    The web server (nginx) blocks the addresses listed in
    /etc/nginx/blocked.conf, in the format: deny ADDRESS;
    This file belongs to root. After changing it, you must ask
    nginx to reload it: sudo systemctl reload nginx
# Comment at the top of /etc/nginx/blocked.conf (after "#")
first-day-blocked-comment = Addresses blocked by nginx (one rule per line)
# Service description, shown by "systemctl status catalogue"
first-day-service-catalogue = Media library online catalogue (php-fpm)

## Service restarted by systemd after kill ({ $pid }: number of the new process)

first-day-restart-calm = systemd restarts the catalogue service: new process { $pid }. With the robot blocked, it stays calm.
first-day-restart-robot = systemd immediately restarts the catalogue service: new process { $pid }… and the robot starts again. It's already at 99%!

## Events ({ $robot }: the robot's IP address; { $blocked }: path of blocked.conf)

# Nudges, when the player heads down a path that is too long (without giving the command).
first-day-event-all-read =
    That's a lot of lines! Counting them by hand would take ages, and you
    would make mistakes. A sysadmin lets the machine count: in
    ~/notes_awa.txt, Awa noted a tool that keeps only the lines you care
    about, and another one that counts lines.
first-day-event-grep-only =
    Well spotted: grep kept only the lines with 503 errors. But that is still
    a lot to count. What if grep's output went straight into a command that
    counts lines? Look at the pipe | in ~/notes_awa.txt.
first-day-event-addresses-only =
    One address per line… impossible to see which one comes up most often.
    Sort them so that identical ones follow each other, then count the
    duplicates: Awa's notes chain four small commands for that.

# { $errors }: number of 503 errors in the log
first-day-event-account =
    Correct: { $errors } 503 errors. You just chained two small tools:
    grep filters the lines, wc counts them. That's the whole Unix philosophy:
    simple tools that you plug into each other.

    Next question: who is sending so many requests? (see ~/notes_awa.txt)
# { $requests }: number of requests from the robot
first-day-event-robot =
    { $robot }: { $requests } requests in a few minutes, all to
    /catalogue/recherche. That's not a human: it's a robot scraping
    the catalogue, and the "catalogue" service can't keep up anymore.

    Look at what's happening on the machine:  ps aux
first-day-event-override =
    Process 4242 (php-fpm: pool catalogue) is using 99% of the CPU.
    You could stop it with kill… but if the robot keeps going, it will fall
    over again right away. First block the robot in /etc/nginx/blocked.conf.

    This file belongs to root, and  sudo echo … >> file  doesn't work:
    the >> redirection is done by YOUR shell, not by sudo. The classic
    trick is tee, which writes whatever it receives to a file:

      echo "deny { $robot };" | sudo tee -a { $blocked }
first-day-event-overwritten =
    Oops! The old rules in blocked.conf are gone: the file was
    OVERWRITTEN (> or tee without -a) instead of appended to (>> or tee -a). Don't
    panic: a backup copy exists. Restore it with
    sudo cp /etc/nginx/blocked.conf.bak { $blocked }, then try again with -a.
first-day-event-rule = The rule is written. But nginx doesn't reread its file by itself: sudo systemctl reload nginx
first-day-event-blocked =
    nginx has reloaded its configuration: { $robot } now gets "403 Forbidden"
    instead of pages.
# Variant when the overloaded process is still running ({ $pid }: its number)
first-day-event-blocked-process =
    nginx has reloaded its configuration: { $robot } now gets "403 Forbidden"
    instead of pages. There's still process { $pid }, stuck at 99%: stop it
    (it belongs to www-data, so… sudo). systemd will restart it nice and clean.
first-day-event-repaired =
    The media library website is answering again! One last thing: the report
    for Awa, in ~/rapport.txt. With > you create the file, with >> you append
    a line. For example:

      grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt
      echo "Culprit: { $robot }" >> ~/rapport.txt
first-day-event-report =
    Awa comes out of her meeting and reads your report: "{ $errors } errors, robot
    identified, blocked, service restarted. For a first day… well done!"

    END OF CHAPTER "FIRST DAY".

    You now know how to read a log (head, tail, grep), count and sort
    (wc, cut, sort, uniq), chain tools with |, write to a file
    (> overwrites, >> appends), and manage processes and services (ps, kill,
    systemctl). These are the everyday moves of the people who keep
    the internet's servers running.
