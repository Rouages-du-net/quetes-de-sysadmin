### Story "The Data Centre", chapter "Second day": accounts and
### groups. Malo must read the nginx logs without sudo (adm group), and
### the web team needs a shared directory (/srv/team).
### Account and group names (malo, adm, web-team), commands,
### paths and modes (640, 770) are not translated.

chapter-second-day = Second day
    .summary = A new recruit: accounts and groups, id, usermod -aG, chgrp, chmod for the group.

## Files

second-day-email-awa =
    From:    Awa (operations manager)
    To:      you
    Subject: Second day, two small things

    Thanks for yesterday! Today, Malo joins us to help out. His account
    already exists (malo). Two things to sort out before he arrives:

    1. Malo must be able to READ the nginx logs (/var/log/nginx), to
       spot robots like yesterday's. But no sudo for him: he doesn't
       need to be an administrator to read a log. You read them
       without sudo… why? Compare  id  and  id malo , and look at
       the permissions with  ls -l /var/log/nginx

    2. The web team (the web-team group) needs a shared directory,
       /srv/team, where everyone can drop their reports. No other
       account on the machine must be able to read or write there,
       especially not www-data: the site runs under that account, and if
       it ever gets hacked, the attacker will act with its permissions.

    The sudo password hasn't changed. My notes on permissions are in
    ~/notes_awa.txt, and the manual is your friend: man usermod, man chgrp.
second-day-notes-awa =
    AWA'S NOTES — READING  ls -l

      -rw-r----- www-data adm      84211 access.log
       ^^^             ^^^  owner, then group
          ^^^          permissions of the owner (rw-), the group (r--),
             ^^^       then others (---)

    To know which permissions apply to someone, check in order:
    are they the owner? If not, are they a member of the group?
    If not, they are "other". Only one triplet counts, the first one
    that matches.

    An account's groups:  id name  or  groups name
    On Debian, the adm group is for monitoring the machine: its members
    can read the logs in /var/log.

    For a directory, r = see the list, w = create or delete inside,
    x = enter it. In numbers: r = 4, w = 2, x = 1, so 7 = rwx, 5 = r-x,
    0 = nothing (see man chmod).

## Events

second-day-event-replaced =
    Ouch: Malo is no longer in the web-team group!

    Without the -a option, usermod -G REPLACES the list of secondary groups
    instead of adding the new one to it. It's a classic trap, which has
    already locked more than one admin out of their own sudo access. Check
    with groups malo, then reread man usermod to give Malo his groups back.
# { $logs }: the log directory
second-day-event-logs-open =
    Careful: with these permissions, ALL accounts on the machine can read
    the logs in { $logs }, including www-data, the website's account.

    An access log contains visitors' IP addresses: that is personal
    data, which must be protected (GDPR). Take the permissions away from
    others again (640), and use the group meant for this instead.
second-day-event-malo-reads =
    Malo can read the logs, without sudo and without opening them to
    everyone: he is a member of the adm group, and the logs grant read
    permission to that group (r-- in the middle of rw-r-----).

    By the way, on a real machine, Malo will have to log in again: a
    session's groups are read at login.
# { $share }: the path of the shared directory
second-day-event-share-open =
    Careful: any account can now write in { $share },
    including www-data. If the site gets hacked, the attacker can drop
    whatever they want there. Remove all permissions for others (last digit 0).
second-day-event-share =
    The directory { $share } is ready: the web team can enter it, read
    and write there, and other accounts see nothing in it.
second-day-event-end =
    Awa pops her head through the door: "Perfect. Malo reads the logs, the
    share is closed to others, and nobody got more permissions than
    needed."

    Well done! You've finished chapter 2 of The Data Centre.

    WHAT HAPPENED
    On Linux, a file's permissions are decided in three boxes:
    owner, group, others. Adding Malo to the adm group gave him
    exactly what he needed, without sudo and without opening the
    logs to everyone. For /srv/team, a group and mode 770
    (rwx for the owner and the group, nothing for others) make a
    real team directory.

    GOOD PRACTICE
    - Least privilege: grant a group rather than sudo, and never
      chmod 777 or o+r "to make it work".
    - usermod -aG to add a group; -G alone replaces the list.
    - Going further: chmod g+s on a shared directory (setgid bit)
      makes new files take the directory's group.

    DOCUMENTATION
    - usermod: https://man7.org/linux/man-pages/man8/usermod.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
    - Debian system groups (adm…): https://wiki.debian.org/SystemGroups
