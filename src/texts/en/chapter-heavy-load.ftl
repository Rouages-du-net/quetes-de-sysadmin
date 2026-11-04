### Story "The Observatory", chapter 1 "Heavy Load": the load average,
### top, nice and renice. Commands, paths and the tools' outputs are not
### translated.

chapter-heavy-load = Heavy Load
    .summary = The club's gallery takes five seconds per page since Jules started stacking last night's photos. Make it fast again without stopping his work.

## Files

heavy-load-message-amara =
    From:     Amara
    To:       you
    Subject:  The gallery is crawling

    Hello,

    I'm away until Sunday (clear skies at last!), and the club's members
    write to me that the gallery takes forever to open this morning. Last
    night was the peak of the Geminids: Jules started the stacking of his
    photos on the server at 6 am, from his session.

    Please don't stop his stacking: it has been running for three hours,
    and it would start again from zero. Just make the gallery usable
    again while it finishes.

    To time the gallery, I do:
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/
    Normally it answers in about 0.25 s.

    Your sudo password: nebula-2028.

    Amara

## Events

heavy-load-event-load =
    The load average: how many processes, on average over 1, 5 and 15
    minutes, are running or waiting for a CPU. Compare it with the number
    of CPUs (nproc): above it, some are waiting their turn.
heavy-load-event-workers =
    stack-worker, eight times, each at about 22 % of a CPU: Jules's
    stacking (stack-night) started eight worker processes, on a machine
    that has two CPUs. The gallery (node) gets the same share as each of
    them: one ninth of the machine, when it needs a whole CPU.
heavy-load-event-parent-only =
    The parent, stack-night, now has a nice value; its eight workers kept
    theirs (look at the NI column of top, or ps -o pid,ni,comm). A nice
    value belongs to each process: the children already started don't
    follow. And the parent only waits: the workers are the ones computing.
heavy-load-event-some-workers =
    Some workers are niced, not all: those still at 0 keep their full
    share, and the gallery still waits. renice can take several PIDs, or
    all the processes of an account (man renice: -u).
heavy-load-event-killed =
    A part of the stacking is gone. Jules: "Three hours of computing… it
    will have to start again from zero tonight." That was what Amara
    asked to avoid: to try again, use "Restart this chapter", under the
    terminal.
heavy-load-event-gallery-stopped =
    The gallery is stopped: the members now get no page at all. Start it
    again (sudo systemctl start gallery).
heavy-load-event-end =
    The gallery answers in a quarter of a second again, and the stacking
    goes on. Jules: "Ah, it took a little longer, but nobody noticed!"

    Well done! You have finished the chapter "Heavy Load".

    WHAT HAPPENED
    The machine has two CPUs. Jules's stacking started eight workers,
    each wanting a CPU: with the gallery, nine processes for two CPUs.
    The load average said so (about 9 for 2 CPUs), and the scheduler gave
    each one the same share: the gallery got 0.2 CPU instead of 1, and
    its requests queued up.

    WHAT NICE CHANGES
    The nice value goes from -20 (served first) to 19 (served last). The
    scheduler shares the CPU in proportion to a weight that drops by
    about 25 % for each step: at nice 19, a process weighs 15 against 1024
    at 0. The workers still get everything nobody else wants: the
    stacking slows down only while the gallery is busy.
    The load average did not go down: it counts the processes that want
    to run, whatever their priority. A high load is not a problem in
    itself; a service that waits for a CPU is.

    GOOD PRACTICE
    - Compare the load with nproc, then find who takes the CPU: top (sorted
      by %CPU), ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Start long jobs already niced: nice -n 19 stack-night…
    - renice -n 19 -u ACCOUNT reaches all of an account's processes; on a
      PID, only that process (its children keep their value).
    - Only root may lower a nice value (give more priority).

    DOCUMENTATION
    - renice: https://man7.org/linux/man-pages/man1/renice.1.html
    - The scheduler and nice: https://man7.org/linux/man-pages/man7/sched.7.html
    - The load average: https://man7.org/linux/man-pages/man5/proc_loadavg.5.html
heavy-load-event-end-gallery =
    The gallery answers in a quarter of a second again, and the stacking
    goes on: you gave the gallery a higher priority (a negative nice
    value, which only root may set). It works; the usual way is the
    other: lower the priority of the batch job (renice -n 19 on the
    workers), so that every service of the machine goes before it.

    Well done! You have finished the chapter "Heavy Load".

    WHAT HAPPENED
    The machine has two CPUs. Jules's stacking started eight workers,
    each wanting a CPU: with the gallery, nine processes for two CPUs.
    The load average said so (about 9 for 2 CPUs), and the scheduler gave
    each one the same share: the gallery got 0.2 CPU instead of 1.

    WHAT NICE CHANGES
    The nice value goes from -20 (served first) to 19 (served last). The
    scheduler shares the CPU in proportion to a weight that changes by
    about 25 % for each step. The load average did not go down: it counts
    the processes that want to run, whatever their priority.

    GOOD PRACTICE
    - Compare the load with nproc, then find who takes the CPU: top, ps
      -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Start long jobs already niced: nice -n 19 stack-night…
    - renice -n 19 -u ACCOUNT reaches all of an account's processes.

    DOCUMENTATION
    - renice: https://man7.org/linux/man-pages/man1/renice.1.html
    - The scheduler and nice: https://man7.org/linux/man-pages/man7/sched.7.html
