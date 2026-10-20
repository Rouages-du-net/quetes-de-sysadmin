### Story "On Call", chapter 1 "The full disk": a log that
### swells, a deleted file still open, logrotate. Commands,
### paths, directives and messages (df, du, lsof, logrotate) are never translated.

chapitre-disque-plein = The full disk
    .resume = 2:47 am, the radio's server disk is full: find the culprit, understand why rm frees nothing, and hand the logs over to logrotate.

## Files

disque-plein-message-de-zoe =
    A message from Zoé, tech volunteer at Radio Quartier (2:40 am):

    "Sorry to wake you up on your first on-call shift… The automatic
    recording of the night show just failed: "No space left on
    device". The server says its disk is full, but I can't see
    what could have filled it, we haven't added anything lately.

    I just tinkered a bit with the stream relay (the radio-flux
    service) last week, to understand some dropouts. It needs to
    get going again, and it mustn't happen again.

    For sudo: antenne-2027."
disque-plein-conf-flux =
    # Radio Quartier: stream relay (the radio-flux service)
    port = 8000
    mount = /direct
    logfile = /var/log/radio/flux.log
    # debug: everything, on every packet; info: the essentials (Zoé, 12/08: debug for the investigation)
    loglevel = debug
disque-plein-flux-log =
    2027-08-15 02:46:58.112 DEBUG relay: packet 98412331 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.113 DEBUG relay: buffer 61% full, 12 listeners
    2027-08-15 02:46:58.113 DEBUG relay: packet 98412332 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.114 DEBUG relay: sent 4096 bytes to 12 listeners
    2027-08-15 02:46:58.114 DEBUG relay: packet 98412333 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.115 ERROR record: cannot write /srv/radio/shows/nuit-2027-08-15.ogg: No space left on device
disque-plein-syslog =
    Aug 15 02:40:01 radio CRON[24117]: (radio) CMD (/usr/local/bin/enregistrer nuit)
    Aug 15 02:40:03 radio enregistrer[24118]: write failed: No space left on device
disque-plein-logrotate-conf =
    # see "man logrotate" for details

    # global options do not affect preceding include directives

    # rotate log files weekly
    weekly

    # keep 4 weeks worth of backlogs
    rotate 4

    # create new (empty) log files after rotating old ones
    create

    # uncomment this if you want your log files compressed
    #compress

    # packages drop log rotation information into this directory
    include /etc/logrotate.d

    # system-specific logs may also be configured here.
disque-plein-logrotate-rsyslog =
    /var/log/syslog
    /var/log/auth.log
    {"{"}
    	rotate 4
    	weekly
    	missingok
    	notifempty
    	compress
    	delaycompress
    	sharedscripts
    	postrotate
    		/usr/lib/rsyslog/rsyslog-rotate
    	endscript
    {"}"}
disque-plein-logrotate-apt =
    /var/log/apt/term.log {"{"}
      rotate 12
      monthly
      compress
      missingok
      notifempty
    {"}"}

## Events

disque-plein-evenement-plein =
    100%: not a single byte free. Before deleting anything, you need to
    know what takes up the space: du measures, directory by directory (du -sh
    /var/*, then deeper), and it's often on the logs' side.
disque-plein-evenement-coupable =
    The relay's log alone weighs more than fifteen gigabytes! Before
    deleting it, look at what it contains (tail), and why it grew
    so much.
disque-plein-evenement-debug =
    DEBUG lines, several per stream packet: the relay writes down everything
    it does, hundreds of times per second. The log level is set in its
    configuration (/etc/radio/flux.conf); a program only rereads its
    configuration at startup, or on reload.
disque-plein-evenement-fantome =
    df still says full, but du can no longer find the file: it was
    deleted while the relay still held it open. As long as a
    program keeps a file open, its space isn't given back (sudo lsof
    +L1 shows it). It has to close it: by restarting it, for example.
    Next time, truncate -s 0 empties a log without this trap.
disque-plein-evenement-renomme =
    The log was renamed, but the relay still writes into the old
    file, under its new name (sudo lsof -p 1730): a program keeps
    the file it opened, not its name. For logrotate, you need either
    copytruncate (copy then empty), or to make it reopen its log
    (postrotate … systemctl reload radio-flux … endscript).
# { $pourcent }: disk usage
disque-plein-evenement-respire =
    The disk can breathe: { $pourcent }% used. The night recording
    can resume. Now to avoid the next time.
disque-plein-evenement-fin =
    The disk has room, the relay runs in normal mode, and logrotate
    will take care of its log from now on. Zoé: "Sorry about the debug…
    I'd completely forgotten about it."

    Well done! You've finished chapter 1 of On Call. (Next up:
    ssh radio.)

    WHAT HAPPENED
    A log level left on debug filled the disk in three days.
    Deleting an open file frees nothing as long as the program
    holds it: df counts it, du no longer sees it. You had to empty the file
    (truncate) or restart the program, set the normal level back,
    and hand the log over to logrotate.

    GOOD PRACTICE
    - Full disk: df to see, du to find, lsof +L1 for files that
      are deleted but still open.
    - Empty a log with truncate -s 0, rather than rm.
    - Each log has its logrotate configuration (rotation, compression),
      with copytruncate or a postrotate that makes the file reopen.
    - Debug mode only for the duration of an investigation; and an alert when
      the disk goes over 80% (later in the story).
    - Keep a record of what was changed (and why).

    DOCUMENTATION
    - logrotate: https://man7.org/linux/man-pages/man8/logrotate.8.html
    - lsof: https://man7.org/linux/man-pages/man8/lsof.8.html
    - truncate: https://www.gnu.org/software/coreutils/manual/html_node/truncate-invocation.html
