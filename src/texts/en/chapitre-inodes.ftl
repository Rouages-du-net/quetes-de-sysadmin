### Story "On Call", chapter 3 "Inodes": a volume full of inodes and
### almost empty of bytes (df -i, du --inodes), "Argument list too
### long", find -mtime -delete and cron. Commands, options and tool
### messages are not translated.

chapitre-inodes = Inodes
    .resume = 3:20 a.m., "No space left on device"… on an almost empty disk. What is missing, if not space?

## Files

inodes-message-de-zoe =
    A message from Zoé (3:05 a.m.):

    "I don't understand anything any more. The recording of the night
    show failed again: "No space left on device", just like last week!
    Except this time, df -h says the data volume (/srv/radio) is almost
    empty. And the relay can no longer log the listens
    (journalctl -u radio-stream).

    PS: the listening statistics are used for the monthly report to the
    town hall. We must keep at least the last 30 days."
inodes-conf-flux =
    # Radio Quartier: stream relay (the radio-stream service)
    port = 8000
    mount = /direct
    logfile = /var/log/radio/stream.log
    loglevel = info
    # Show recordings
    record_dir = /srv/radio/shows
    # Statistics: one file per listen (monthly report for the town hall)
    stats_dir = /srv/radio/stats
inodes-stats-lisezmoi =
    Listening statistics, written by the relay: one small file per
    listen (anonymised address, duration). The monthly report for the
    town hall reads the files of the past month.
    (Zoé, March 2027: remember to clean up from time to time…)

## The simulated night

# { $commande }: the cron job's command; { $sortie }: what it wrote
inodes-courrier =
    Mail from cron (Cron Daemon) about: { $commande }
    { $sortie }
# { $taches }: jobs run; { $effaces }: files deleted; { $ancien }: age of the oldest, in days; { $pourcent }: inodes in use
inodes-nuit =
    A day and a night go by. The relay logs its listens; cron
    runs { $taches ->
        [0] no job
        [one] one job
       *[other] { $taches } jobs
    }. In the morning: { $effaces ->
        [one] { $effaces } statistics file fewer
       *[other] { $effaces } statistics files fewer
    }, the
    oldest is { $ancien } days old, and { $pourcent } % of the inodes of
    /srv/radio are in use.
inodes-nuit-recentes-perdues =
    Ouch: statistics less than 30 days old have disappeared, the ones for
    the town hall report. A job that deletes everything, without looking
    at the files' age? Restart the chapter to try another way (link
    below the terminal), and test your command by hand before handing it
    to cron.
inodes-nuit-rien =
    Your job didn't run tonight: its schedule doesn't fall during the
    night. The five fields (minute, hour, day of month, month, day of
    week) are explained in man crontab.
# { $jours }: age of the oldest file
inodes-nuit-trop-vieux =
    In the morning, there are still statistics { $jours } days old: the
    job didn't clean up. Run its command by hand to see what it does
    (and sudo crontab -l, to reread the line).
# { $pourcent }: inodes in use
inodes-nuit-plein =
    { $pourcent } % of the inodes are still in use: the volume will fill
    up again very quickly. You should keep them for less time (but at
    least 30 days).

## Events

inodes-evenement-presque-vide =
    The data volume is hardly filled at all, and yet no file can be
    created on it any more. Space isn't the only resource of a file
    system: each of its files also needs an inode (its record card:
    owner, permissions, dates, where its data is), and their number is
    fixed when it is created. In man df, an option counts them.
inodes-evenement-plus-d-inodes =
    100 % of the inodes of /srv/radio are taken: not a single file can be
    created there any more, even an empty one, however much space is
    free. Who created so many files? du can count inodes instead of
    bytes (man du).
inodes-evenement-coupable =
    Tens of thousands of files! One per listen, written by the relay
    since March, and never deleted. Before deleting: Zoé wants to keep
    at least the last 30 days. find can select files by their age
    (man find).
inodes-evenement-trop-long =
    "Argument list too long": the shell replaces * with all the names in
    the directory BEFORE running the command, and the list doesn't fit
    in the space reserved for a program's arguments (about 2 MB).
    find, on the other hand, walks the directory by itself: it can
    delete what it finds, with no giant list.
inodes-evenement-recentes-perdues =
    Careful: statistics less than 30 days old have disappeared, the ones
    the town hall needs. Restart the chapter to try another way (link
    below the terminal).
# { $pourcent }: inodes in use
inodes-evenement-repart =
    Some inodes have been freed ({ $pourcent } % in use): the night
    recording has resumed, and the relay is logging listens again. Now
    to stop it happening again: a cron job, every night, to keep only
    the last month (the game will let a night go by to see it at
    work).
inodes-evenement-fin =
    The night has passed, the job has cleaned up, and the last month of
    statistics is intact. Zoé: "Inodes… I didn't even know the word.
    Thank you!"

    Well done! You have finished chapter 3 of On Call.

    WHAT HAPPENED
    The relay wrote a small file per listen, for six months, without
    ever deleting them. The volume still had all its space, but not a
    single inode left: each file takes one, and their number is fixed
    when the file system is created (one per 16 KiB by default). rm *
    couldn't cope (too many arguments); find, with -mtime and -delete,
    deleted the old ones while keeping the last month, and cron does it
    again every night.

    GOOD PRACTICE
    - "No space left on device" with space to spare: df -i.
    - Find where the files are: du --inodes (with -d 1 or -s).
    - Delete in bulk with find … -delete (or -exec), never rm * on
      thousands of files; test without -delete first.
    - Any data that piles up (logs, statistics, sessions, caches) has a
      retention period and a job that enforces it.
    - Monitor inodes like space (an alert at 80 %).

    DOCUMENTATION
    - df (-i): https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html
    - find (-mtime, -delete): https://www.gnu.org/software/findutils/manual/html_mono/find.html
    - ARG_MAX and "Argument list too long": https://man7.org/linux/man-pages/man2/execve.2.html
