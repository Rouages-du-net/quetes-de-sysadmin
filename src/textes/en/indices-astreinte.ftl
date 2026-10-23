### Graded hints for On Call (see src/moteur/indices.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in noms.ftl.

## Chapter 1 — The full disk

indice-disque-plein-plein =
    .piste = Zoé talks about a full disk. Before looking for anything, check how full the file systems are (man df, the option that shows human-readable sizes).
    .solution = df -h (/ is at 100%)
indice-disque-plein-coupable =
    .piste = What is taking up the space? du measures, directory by directory: start with the logs, in /var/log, then go down where it is heavy.
    .solution = sudo du -sh /var/log/* (the password is in Zoé's message), then sudo du -sh /var/log/radio/*: flux.log weighs more than 15 GB.
indice-disque-plein-debug =
    .piste = Before deleting this huge log, look at what it contains: its last lines tell you why it grows so fast.
    .solution = sudo tail /var/log/radio/flux.log (DEBUG lines for every packet)
indice-disque-plein-respire =
    .piste = The space must be given back, but rm is not enough: the relay holds the file open. Empty it without deleting it (man truncate), or restart the program that holds it.
    .solution = sudo truncate -s 0 /var/log/radio/flux.log (then df -h to check; if you already deleted it: sudo systemctl restart radio-flux)
indice-disque-plein-fin =
    .piste = So that it does not happen again: set the normal log level back in /etc/radio/flux.conf (the relay only rereads it when it starts), and hand the log over to logrotate, in /etc/logrotate.d, with a way to make it reopen the file (man logrotate).
    .solution = sudo nano /etc/radio/flux.conf (loglevel = info), sudo systemctl restart radio-flux, then sudo nano /etc/logrotate.d/radio: /var/log/radio/*.log {"{"} daily, rotate 7, compress, missingok, copytruncate {"}"} (one directive per line; sudo logrotate -d /etc/logrotate.d/radio to check).

## Chapter 2 — Memory

indice-memoire-oom =
    .piste = The playlist stopped on its own. What does systemctl status say about it? And the kernel log, which keeps track of the processes it had to kill?
    .solution = systemctl status radio-playlist (Result: oom-kill), then sudo dmesg -T (Out of memory: Killed process…)
indice-memoire-zombies =
    .piste = Look at the list of all processes and their state: some are marked <defunct>. The PPID column tells you who their parent is.
    .solution = ps -ef (or ps aux): zombies [convertir] <defunct>, children of PID 2305 (the radio-podcast service)
indice-memoire-contenue =
    .piste = The playlist leaks: restarted as it is, it grows again. systemd can limit a service's memory and restart it if it dies, with an override (man systemctl: edit; man systemd.resource-control: MemoryMax=). Then watch it grow with top.
    .solution = sudo systemctl edit radio-playlist, write [Service] then MemoryMax=600M and Restart=on-failure; sudo systemctl start radio-playlist, then top (or free -h) several times: systemd kills it and restarts it.
indice-memoire-sans-zombies =
    .piste = A zombie cannot be killed: it is already dead. Only its parent can make it go away, or go away itself (init then reaps the zombies).
    .solution = sudo systemctl restart radio-podcast (the parent's service, PID 2305)
indice-memoire-fin =
    .piste = To finish, you need everything at once: the playlist running, a reasonable memory limit (a few hundred MB), an automatic restart, no zombies left, and the relay active. If you wrote a unit file by hand, systemd must reread it.
    .solution = systemctl status radio-playlist (Memory … max), ps aux without <defunct>; after a file written by hand: sudo systemctl daemon-reload, then sudo systemctl start radio-playlist

## Chapter 3 — Inodes

indice-inodes-presque-vide =
    .piste = "No space left on device" again: start by checking the free space on the data volume, /srv/radio.
    .solution = df -h (/srv/radio is almost empty)
indice-inodes-plus-d-inodes =
    .piste = Space is not the only resource of a file system: each file needs an inode, and their number is fixed. An option of df counts them (man df).
    .solution = df -i (or df -ih): 100% of the inodes of /srv/radio are used
indice-inodes-coupable =
    .piste = Who created so many files? du can count inodes instead of bytes (man du), directory by directory.
    .solution = sudo du --inodes -d 1 /srv/radio (the stats directory holds more than 65,000 files)
indice-inodes-repart =
    .piste = Zoé wants to keep the last 30 days. rm * will fail (too many arguments); find walks the directory itself, picks files by age and can delete them (man find: -mtime, -delete).
    .solution = sudo find /srv/radio/stats -type f -mtime +30 -delete (try it first without -delete, with | wc -l)
indice-inodes-fin =
    .piste = So that it does not happen again, the clean-up must run every night: a cron job, in the crontab of an account allowed to delete these files (root, or radio).
    .solution = sudo crontab -e, and add: 15 4 * * * find /srv/radio/stats -type f -mtime +30 -delete

## Chapter 4 — The clock

indice-horloge-utc =
    .piste = The cron job has not changed, yet it starts two hours late. What time, and in which time zone, does the machine think it lives?
    .solution = date, or timedatectl (Time zone: Etc/UTC)
indice-horloge-retard =
    .piste = timedatectl also tells you whether the clock is synchronised, and whether the NTP service is running. Compare with your workstation's time.
    .solution = timedatectl (System clock synchronized: no, NTP service: inactive)
indice-horloge-synchro =
    .piste = Synchronisation is systemd-timesyncd's job: it must be enabled, and given an NTP server that answers. The host's email says which one; the configuration is in /etc/systemd/timesyncd.conf (reread at start-up).
    .solution = sudo nano /etc/systemd/timesyncd.conf (NTP=ntp.hebergeur.example), then sudo timedatectl set-ntp true (or sudo systemctl restart systemd-timesyncd if it is already running)
indice-horloge-cron =
    .piste = The machine must live on Paris time. The time zone is set with timedatectl (man timedatectl: set-timezone, list-timezones).
    .solution = sudo timedatectl set-timezone Europe/Paris
indice-horloge-fin =
    .piste = cron read the time zone when it started, on Saturday: it still counts in UTC. And timesyncd must be enabled, to start again at the machine's next boot.
    .solution = sudo systemctl restart cron (and, if not done yet, sudo timedatectl set-ntp true)

## Chapter 5 — The Probe

indice-sonde-fin =
    .piste = Zoé's probe (/usr/local/bin/sonde) has three TODOs: watch /srv/radio, space AND inodes (man check_disk: -W, -K), check that the live stream answers (man check_http, port 8000, /direct), and run it every 5 minutes (a systemd timer or cron). Thresholds that are too tight give alerts for nothing.
    .solution = In sudo nano /usr/local/bin/sonde, add: $P/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio | grep -v " OK" | $ALERTE and $P/check_http -H localhost -p 8000 -u /direct | grep -v " OK" | $ALERTE; then sudo crontab -e: */5 * * * * /usr/local/bin/sonde (or sonde.service + sonde.timer with OnCalendar=*:0/5, and sudo systemctl enable --now sonde.timer).

## Chapter 6 — The Post-Mortem

indice-post-mortem-notes =
    .piste = Start with what Théo wrote down that night, in your home. They are leads to check, not facts.
    .solution = cat notes_theo.txt
indice-post-mortem-redemarrage =
    .piste = The logs are accurate to the second. Read those of the night of 11 to 12 September, between 2:00 and 3:30 (man journalctl: --since, --until): what started just before the relay stopped?
    .solution = sudo journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30" (apt-daily-upgrade, then Stopping radio-flux.service); then sudo cat /var/log/unattended-upgrades/unattended-upgrades-dpkg.log and last
indice-post-mortem-origine =
    .piste = The unknown option was waiting in flux.conf. Since when? The journal also keeps track of commands run with sudo: look for who opened that file, and when.
    .solution = sudo journalctl | grep flux.conf (on 20 August, sudo nano /etc/radio/flux.conf, never restarted)
indice-post-mortem-fin =
    .piste = Complete postmortem.md (nano), keeping the template's "##" headings and leaving no "(to be completed": Summary; Timeline with the times from the logs (outage, first alert, stream back); Impact in minutes; Causes (the trigger, and since when the error had been waiting); What went well; Actions (at least two "-" lines). Blameless: no "at fault" or "to blame".
    .solution = Timeline: 02:13 (the update restarts the relay), 02:15 (first alert), 02:58 (the relay is back); Impact: 45 minutes; Causes: unattended-upgrades (needrestart) restarted the relay, an unknown option (bitrate_max) had been waiting in flux.conf since 20 August; What went well: the probe alerted within 2 minutes; Actions: - check the configuration before every restart (ExecStartPre=) - restart the relay after every change.

## Chapter 7 — The bottleneck

indice-goulot-iowait =
    .piste = Zoé says the processor is doing almost nothing. Look at top's %Cpu(s) line: each column has its meaning (man top), and one of them counts the time spent waiting for the disk.
    .solution = top ("wa" is huge: that is iowait); then iostat -x and sudo pidstat -d to see the saturated disk and who keeps it busy
indice-goulot-fin =
    .piste = The archiving (radio-archives) saturates the disk, but it must not be stopped. ionice is useless with the "none" scheduler; a bandwidth limit set by systemd always works (man systemd.resource-control: IOWriteBandwidthMax=), on the right disk (iostat names it), neither too low nor too high.
    .solution = sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 20M" (saved in /etc), then iostat -x to check; if the archiving is stopped: sudo systemctl start radio-archives
