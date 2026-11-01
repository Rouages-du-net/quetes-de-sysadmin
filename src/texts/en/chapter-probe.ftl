### Story "On Call", chapter 5 "The Probe": monitoring
### (monitoring-plugins plugins, mail -E), a systemd timer (or cron),
### and an outage drill at night. The tools' commands, options, directives
### and messages are not translated.

chapter-probe = The Probe
    .summary = Four nights of fixing things after the fact: this time, Zoé wants to be warned before things break. And tonight, she is organising a drill…

## Files

probe-message-zoe =
    A message from Zoé (Monday, 6:20 pm):

    "Four nights, four outages, and each time we found out too late.
    I've started a probe: /usr/local/bin/probe. It runs
    checks (the monitoring "plugins", the ones from Nagios or
    Icinga) and mails me everything that isn't OK. Root's
    mail comes to me (/etc/aliases), and from there to my
    phone.

    There's work left: it only looks at the system disk, and nothing
    runs it. Could you complete it, then make it run every
    5 minutes?

    And to know whether it really works, I suggest a drill: the
    following night, I'll cause two outages, without saying which. As soon
    as your probe is scheduled, I'll start the drill. If I'm
    warned in time, I fix things. But no false alarms, OK? I
    want to be able to sleep."
probe-script =
    #!/bin/sh
    # Radio Quartier's probe (Zoé, work in progress).
    # Each check that is not OK is sent by mail (mail -E: nothing if all is well).
    # The checks come from monitoring-plugins (like Nagios or Icinga):
    # they write one line, OK, WARNING or CRITICAL (man check_disk).
    P=/usr/lib/nagios/plugins
    ALERTE="mail -E -s Alerte-radio root"

    # The system disk: warning below 20% free, critical below 10%.
    $P/check_disk -w 20% -c 10% -p / | grep -v " OK" | $ALERTE

    # TODO: the data volume, /srv/radio (and its inodes: remember…)
    # TODO: is the live stream answering? (the relay listens on port 8000, path /direct)
    # TODO: run it every 5 minutes (cron? a systemd timer?)
probe-podcasts-readme =
    Podcast thumbnails: the automatic import drops them into
    thumbnails/ (one image per episode).

## The drill night

# { $runs }: how many times the probe (or a scheduled job) ran
probe-night =
    Your probe is scheduled: Zoé starts the drill. The evening, then the night
    go by ({ $runs ->
        [0] no scheduled job ran
        [one] a scheduled job ran once
       *[other] the scheduled jobs ran { $runs } times
    }).
# { $alert }, { $repaired }: times; { $minutes }: length of the silence
probe-night-relay-seen =
    1:10 am: Zoé stops the stream relay, all of a sudden. At { $alert }, her
    phone rings; she restarts the relay at { $repaired }. The live stream was
    silent for { $minutes } minutes.
probe-night-relay-missed =
    1:10 am: Zoé stops the stream relay, all of a sudden… and nobody is
    warned. The live stream stays silent until morning. What does your probe check
    when the relay stops answering? (man check_http, man check_procs)
probe-night-relay-slow =
    The alert arrived, but more than 15 minutes after the outage: for
    a radio station, that's long. How often does the probe run?
    (systemctl list-timers, systemd-analyze calendar)
# { $alert }: time
probe-night-inodes-seen =
    1:40 am: the thumbnail import runs wild and creates thousands of
    small files on /srv/radio. At { $alert }, well before the inodes
    run out, Zoé is warned and stops the import.
# { $full }: time
probe-night-inodes-missed =
    1:40 am: the thumbnail import runs wild and creates thousands of
    small files on /srv/radio. At { $full }, not a single free inode left:
    the night recording fails, without anyone being warned.
    Does check_disk watch this volume, and its inodes? (man check_disk:
    -W and -K)
# { $count }: alerts received when everything was fine
probe-night-false =
    { $count ->
        [one] Zoé received one alert
       *[other] Zoé received { $count } alerts
    } while everything was fine. Alerts for nothing, and after
    a few nights nobody reads them any more: a threshold too tight, a
    check that writes even when all is well (cron also mails
    everything a job writes)?
probe-night-never =
    Nothing ran all night. Is the timer started, and does it
    really fire (systemctl list-timers)? Careful:
    OnUnitActiveSec= alone never fires, since the service has never
    run yet (man systemd.timer).

## Events

# { $directory }: the plugins directory
probe-event-plugin-outside-path =
    The monitoring plugins are not in the PATH: on Debian, they
    live in { $directory }, and are run by their full path (as
    in Zoé's probe).
probe-event-first-alert =
    Zoé: "Got your mail!" Testing an alert before you
    need it is the right idea.
probe-event-end =
    Both outages of the drill were spotted in time, and the night was
    quiet the rest of the time. Zoé: "I've never slept so well
    during an outage."

    Well done! You have finished chapter 5 of On Call. (What comes next awaits you:
    ssh radio.)

    WHAT HAPPENED
    A probe runs checks (plugins: one line and a return
    code, 0 OK, 1 WARNING, 2 CRITICAL) and warns you when something
    is wrong. You had to watch what had already broken (the disk,
    the inodes, the live stream), run it often (a systemd timer),
    and test it with an outage drill.

    GOOD PRACTICE
    - Watch what matters to people (is the live stream answering?), not
      just the resources.
    - Thresholds that leave time to act (warning at 80%, critical at
      90%), inodes included.
    - No alerts for nothing: every alert should call for an action.
    - A systemd timer (or cron) for regularity; systemctl
      list-timers and journalctl -u to check it runs.
    - Test the alerts: an outage drill beats a real
      surprise. The full tools (Icinga, Zabbix, Prometheus…)
      build on the same ideas.

    ANOTHER WAY
    Central monitoring: Icinga or Nagios (which use these same
    check_* plugins), Prometheus and its alerts, Uptime Kuma to
    watch websites, Monit which also restarts services. A script
    and a timer are enough for a small machine; beyond that, a central
    tool sees all the machines and keeps the history.

    DOCUMENTATION
    - plugins and their return codes: https://www.monitoring-plugins.org/doc/guidelines.html
    - check_disk: https://www.monitoring-plugins.org/doc/man/check_disk.html
    - systemd timers: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
