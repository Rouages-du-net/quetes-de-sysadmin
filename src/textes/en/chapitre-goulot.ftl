### Story "On Call", chapter 7 "The bottleneck": waiting on the disk
### (iowait), iostat, pidstat, ionice and systemd's bandwidth limit.
### Commands, paths, unit names and log lines are not translated.

chapitre-goulot = The bottleneck
    .resume = Every afternoon at 4 pm, the live stream stutters: find what is saturating the disk, and limit it without stopping it.

## Files

goulot-message-de-zoe =
    A message from Zoé (4:12 pm):

    "It's happening again! Every day, around 4 pm, the live stream has
    gaps: half-second silences, several per minute. Listeners are
    writing to us. The relay (radio-flux) is running, its journal
    mentions "read stall".

    I looked at top: the machine seems overloaded, but the processor is
    doing almost nothing. I don't understand it at all.

    What I do know: at 4 pm, the daily archiving (radio-archives) copies
    the recordings into /srv/archives. Whatever you do, don't stop it:
    the day's shows must be archived tonight. But it mustn't break the
    live stream, neither today nor tomorrow."

    To look at the disk: man iostat, man pidstat.

## Events

goulot-evenement-iowait =
    Look at top's %Cpu(s) line: the processor is almost never busy (us,
    sy), but "wa" is huge. That's iowait: the time processes spend
    waiting for the disk. The load (load average) counts these blocked
    processes, hence an "overloaded" machine that computes nothing.
    The bottleneck is the disk: iostat -x shows how busy it is (%util)
    and how long each request waits (r_await, in ms); pidstat -d shows
    who reads and writes.
goulot-evenement-ionice =
    ionice accepted the "idle" class… but look at iostat: nothing has
    changed. ionice priorities only count if the disk's scheduler
    handles them (bfq, mq-deadline). This virtual disk's scheduler is
    "none" (cat /sys/block/vda/queue/scheduler): it serves requests in
    order, with no priority. A bandwidth limit, however, works with
    every scheduler: systemd sets it on the service's cgroup
    (man systemd.resource-control, IOWriteBandwidthMax=).
goulot-evenement-arret =
    The archiving is no longer running. The live stream can breathe… but
    today's shows won't be archived, and tomorrow at 4 pm, the timer will
    start it again at full speed. Start it again (sudo systemctl start
    radio-archives), but with a bandwidth limit.
goulot-evenement-mauvais-disque =
    systemd recorded the limit, but it targets a disk that doesn't exist
    here: it slows nothing down. This machine's disk is vda (iostat
    shows it); you can also give a path, and systemd finds the disk that
    holds it.
goulot-evenement-trop-lent =
    A limit this low protects the live stream… but today's archiving
    won't be done before tomorrow. A few tens of MiB/s are enough: look
    at iostat after each try, and find the right balance.
goulot-evenement-fin =
    The live stream no longer stutters: its reads wait a few
    milliseconds, not hundreds. The archiving goes on, more slowly, and
    its limit is recorded: tomorrow at 4 pm, it will apply by itself.
    Zoé: "Not a single gap in five minutes. And the archive will be done
    around 6 pm, that's perfect."

    Well done! You have finished the chapter "The bottleneck".

    WHAT HAPPENED
    The machine wasn't overloaded: it was waiting for its disk. A
    full-speed copy was taking almost all of its bandwidth, and every
    read from the live stream queued up behind it (r_await in the
    hundreds of ms). top shows it (wa, the load), iostat -x proves it
    (%util, await), pidstat -d tells you who is causing it.

    GOOD PRACTICE
    - High load with an idle processor: think of the disk (iowait), and
      look at it with iostat -x 1.
    - Limit background tasks with systemd: IOWriteBandwidthMax= and
      IOReadBandwidthMax= (the service's cgroup, io.max), which work with
      every scheduler; ionice and IOSchedulingClass=idle only help with
      bfq or mq-deadline.
    - systemctl set-property applies immediately and records it (in
      /etc/systemd/system.control); a limit written with systemctl edit
      also applies to later runs.
    - And when possible, schedule big copies when nobody is listening.

    DOCUMENTATION
    - iostat(1): https://man7.org/linux/man-pages/man1/iostat.1.html
    - systemd.resource-control(5): https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - The cgroup v2 io controller: https://docs.kernel.org/admin-guide/cgroup-v2.html#io
