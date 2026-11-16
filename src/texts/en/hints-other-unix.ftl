### Graded hints for The Other Unix (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction) and .solution
### (almost the answer).

## Chapter 1 — The Script That Broke

hint-portable-script-not-found =
    .lead = Run the script, and read what the system answers (./nightly-backup.sh). Then look at its first line.
    .solution = ./nightly-backup.sh says "not found": its first line, #!/bin/bash, names an interpreter FreeBSD doesn't have. nano nightly-backup.sh, and make it #!/bin/sh.
hint-portable-script-date =
    .lead = The script now stops on date. This date isn't Debian's: read ITS manual (man date) for how to get yesterday.
    .solution = Replace date -d yesterday with date -v-1d (in nano), keeping +%F.
hint-portable-script-stat =
    .lead = Next comes stat: man stat on this machine tells which option takes a format, and how to ask for the size.
    .solution = Replace stat -c %s with stat -f %z.
hint-portable-script-sed =
    .lead = Last, sed -i: on BSD, -i always wants a word after it (man sed).
    .solution = Write sed -i '' "s/^last=.*/last=$DAY/" /var/backups/state.conf (the '' is an empty suffix: no backup copy).
hint-portable-script-end =
    .lead = Run the script to the end: yesterday's archive must be in /var/backups, and state.conf must say last=2029-10-05.
    .solution = ./nightly-backup.sh, then ls -l /var/backups and cat /var/backups/state.conf.

## Chapter 2 — No systemd Here

hint-rc-services-installed =
    .lead = No apt here: FreeBSD has its own package manager (man pkg).
    .solution = sudo pkg install nginx (answer y).
hint-rc-services-not-enabled =
    .lead = Services are driven by service (man service): try to start nginx.
    .solution = sudo service nginx start (and read why it refuses).
hint-rc-services-enabled =
    .lead = The message names the rc.conf variable. sysrc writes it for you (man sysrc).
    .solution = sudo sysrc nginx_enable=YES (or sudo service nginx enable).
hint-rc-services-end =
    .lead = Start it now, and check that it listens on port 80 (man sockstat).
    .solution = sudo service nginx start, then sockstat -4l.

## Chapter 3 — The Last Rule Wins

hint-last-rule-checked =
    .lead = Read /etc/pf.conf, and check it without loading it (man pfctl).
    .solution = cat /etc/pf.conf, then sudo pfctl -nf /etc/pf.conf.
hint-last-rule-on =
    .lead = In pf, the LAST rule that matches decides (man pf.conf). Put the rules in pf's order before switching it on.
    .solution = sudo nano /etc/pf.conf: "block in all" first, then "pass in proto tcp to port {"{"} 22 80 {"}"}", then "pass out all keep state". Then sudo sysrc pf_enable=YES and sudo service pf start.
hint-last-rule-end =
    .lead = pf must start at boot, with the rules of the file: check what is in force (pfctl -sr), and from your workstation, what answers (nc -zv).
    .solution = sudo pfctl -f /etc/pf.conf after any change, sudo pfctl -sr; exit, then nc -zv projector 3306 (it must not answer) and nc -zv projector 80.
