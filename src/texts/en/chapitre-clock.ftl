### Story "On Call", chapter 4 "The clock": time zone, NTP
### (systemd-timesyncd), timedatectl, cron reading the time zone at
### startup. Commands, options, directives and tool messages are not
### translated.

chapitre-clock = The clock
    .resume = Monday, 9:12 a.m.: the morning show was only recorded from 8:09 on. Has the server, migrated this weekend, lost track of time?

## Files

clock-message-de-zoe =
    A message from Zoé (Monday, 9:05 a.m.):

    "The morning show ("matinale", 6 a.m. to 9 a.m.) was only recorded
    from 8:09 on: we lost two hours of broadcast! It's the cron job of
    the radio account that starts the recording (sudo crontab -u radio
    -l), and it hasn't changed.

    What has changed: the hosting provider migrated the server to a new
    machine this weekend (their email is in mail_hosting.txt). And
    yet, the recording log does say "06:00"…"
clock-mail-hebergeur =
    From: support@hosting.example
    Subject: Migration of your radio server completed

    Hello,

    Your server was migrated to our new infrastructure on Saturday
    evening, from a standard system image: your data and your
    configuration have been copied over.

    Reminder: from our network, access to public NTP servers is
    filtered. Use our time server: ntp.hosting.example
    (the old one, ntp.old-hosting.example, has been shut down).

    The support team
clock-timesyncd-conf =
    #  This file is part of systemd.
    #
    # Entries in this file show the compile time defaults. Local configuration
    # should be created by either modifying this file (or a copy of it placed in
    # /etc/ if the original file is shipped in /usr/), or by creating "drop-ins" in
    # the /etc/systemd/timesyncd.conf.d/ directory. The latter is generally
    # recommended. Defaults can be restored by simply deleting the main
    # configuration file and all drop-ins located in /etc/.
    #
    # See timesyncd.conf(5) for details.

    {"[Time]"}
    NTP=ntp.old-hosting.example
    #FallbackNTP=0.debian.pool.ntp.org 1.debian.pool.ntp.org 2.debian.pool.ntp.org 3.debian.pool.ntp.org
    #RootDistanceMaxSec=5
    #PollIntervalMinSec=32
    #PollIntervalMaxSec=2048
clock-script-enregistrer =
    #!/bin/sh
    # record SHOW DURATION: records the live stream for DURATION minutes.
    # The time in the log is the machine's time (date).
    echo "$(date '+%F %T') $1: start ($2 min)" >> /var/log/radio/record.log
    exec /usr/local/bin/stream-record --mount /direct --minutes "$2" --out "/srv/radio/shows/$1-$(date +%F).ogg"
clock-journal-enregistrer =
    2027-08-26 06:00:01 matinale: start (180 min)
    2027-08-26 23:00:01 nuit: start (240 min)
    2027-08-27 06:00:01 matinale: start (180 min)
    2027-08-27 23:00:01 nuit: start (240 min)
    2027-08-28 23:00:01 nuit: start (240 min)
    2027-08-29 23:00:01 nuit: start (240 min)
    2027-08-30 06:00:01 matinale: start (180 min)

## Events

clock-evenement-utc =
    UTC: the machine lives on Greenwich time, not Paris time (two hours
    ahead in summer). And cron starts jobs at the machine's local time:
    "6 a.m." in the crontab means 6 a.m. UTC, so 8 a.m. in Paris. The
    provider's image kept the default time zone. The time zone is set
    with timedatectl (man timedatectl).
clock-evenement-retard =
    "System clock synchronized: no": nobody puts the clock right. A
    computer clock drifts by a few seconds a day… and this one is
    already nine minutes slow (your workstation says 9:12). That's the
    job of NTP (Network Time Protocol): here, the systemd-timesyncd
    service, which is stopped (NTP service: inactive).
clock-evenement-manuel =
    The clock is set right… for now. Without NTP, it keeps drifting, and
    nobody will correct it next time. Better to leave this job to
    systemd-timesyncd.
clock-evenement-muet =
    systemd-timesyncd is running, but the clock still isn't
    synchronized: the NTP server it queries doesn't answer (sudo
    journalctl -u systemd-timesyncd, or timedatectl timesync-status). Its
    configuration is in /etc/systemd/timesyncd.conf; it only reads it
    again at startup. The provider's email happens to mention NTP.
clock-evenement-synchro =
    "Contacted time server": the clock is synchronized, and
    systemd-timesyncd will keep it on time (timedatectl).
clock-evenement-non-active =
    systemd-timesyncd is running, but it isn't enabled: the next time
    the machine reboots, it won't start again. timedatectl set-ntp
    true does both (or systemctl enable).
clock-evenement-cron =
    The time zone has changed, but cron read it when it started, on
    Saturday: until it restarts, it still counts in UTC, and tomorrow's
    morning show would still start at 8 a.m. (This is true of many
    services that have been running for a long time: a time zone change
    should be followed by a restart.)
clock-evenement-fin =
    The machine is on Paris time, synchronized by NTP, and cron knows
    it. Tomorrow, the morning show will be recorded at 6 a.m. Zoé: "I'll
    ask the provider to set the time zone in their image…"

    Well done! You have finished chapter 4 of On Call.

    WHAT HAPPENED
    The new machine was on UTC, the image's default time zone: cron
    started the recording at 6 a.m. UTC, 8 a.m. in Paris. And without
    NTP (timesyncd stopped, and pointed at a server that no longer
    exists), its clock was nine minutes slow. The logs wrote "06:00"
    without saying in which time zone.

    GOOD PRACTICE
    - timedatectl first: time zone, synchronization, NTP service.
    - The time zone: timedatectl set-timezone Europe/Paris, then restart
      the services that schedule things (cron).
    - NTP always on: timedatectl set-ntp true, with the provider's
      server if public servers are filtered (NTP= in
      /etc/systemd/timesyncd.conf, then restart systemd-timesyncd).
    - Don't set the time by hand (date -s): it doesn't last.
    - Many teams keep servers on UTC and write their crontabs
      accordingly: what matters is knowing it, and writing it down.
      Logs benefit from showing the time zone (date +%z).

    DOCUMENTATION
    - timedatectl: https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html
    - timesyncd.conf: https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html
    - changing the time zone on Debian: https://wiki.debian.org/TimeZoneChanges
