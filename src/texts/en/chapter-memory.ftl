### Story "On Call", chapter 2 "Memory": the OOM killer, a memory leak
### contained by systemd (MemoryMax=, Restart=), zombie processes.
### Commands, options, directives and messages (free, top, dmesg,
### systemctl) are not translated.

chapter-memory = Memory
    .summary = 4:31 a.m., the live stream is broadcasting nothing but silence: who killed the night playlist, and how do you stop it from taking everything down next time?

## Files

memory-message-zoe =
    A message from Zoé (4:25 a.m.):

    "Me again… Since 4:12, the live stream has been broadcasting nothing
    but silence. The relay is running (systemctl status radio-stream), but
    the automatic night playlist (the radio-playlist service) seems dead.
    I didn't touch anything, I promise.

    Something else, maybe unrelated: in ps, there are processes marked
    <defunct>, "zombies" according to a forum. I tried kill -9 on them:
    they're still there."
memory-server-js =
    // Radio Quartier: the automatic night playlist.
    const cache = new Map(); // tracks already decoded

    function decoder(morceau) {"{"}
      if (!cache.has(morceau.id)) cache.set(morceau.id, lire(morceau)); // TODO: empty the cache some day
      return cache.get(morceau.id);
    {"}"}
memory-convert-py =
    # Radio Quartier: converts shows into podcasts.
    import subprocess

    for emission in nouvelles_emissions():
        # Starts the conversion... and never waits for it to finish (no wait()).
        subprocess.Popen(["convertir", emission])

## Events

memory-event-oom =
    "Out of memory", "oom-kill": the machine ran out of memory, and the
    kernel chose a process to kill in order to survive. That's the OOM
    killer (Out Of Memory): it targets the process using the most memory.
    Its messages are in the kernel log: sudo dmesg (or sudo
    journalctl -k). How much memory is left, and who is taking it? free -h
    and top.
memory-event-zombies =
    Zombies: processes that have already finished, whose parent hasn't yet
    read their result (the wait system call). They take up almost nothing,
    but they give away a parent that isn't doing its job. Who is this
    parent? ps -ef shows the PPID column.
memory-event-kill-zombie =
    kill does nothing to a zombie: it's already dead! Only its parent can
    make it disappear… or disappear itself: when the parent dies, init
    (PID 1) adopts the zombies and reaps them at once. Restarting the
    parent service is enough.
memory-event-grows =
    Watch the playlist in top (or top -o %MEM) from one command to the
    next: it keeps growing, by tens of megabytes each time. A memory leak!
    The code is in /opt/playlist. If nothing stops it, the kernel will have
    to kill someone again…
memory-event-still =
    There you go: out of memory, the OOM killer has struck again (sudo
    dmesg). Restarting isn't enough, the leak starts again. Fixing the
    program is the developers' job; tonight, it has to be contained.
    systemd can limit a service's memory (MemoryMax=, see man systemctl:
    edit, set-property) and restart it if it dies (Restart=).
memory-event-too-down =
    This limit is too low: the playlist needs about 200 MB just to start,
    it would be killed almost as soon as it was launched. Give it enough
    to run for a while (a few hundred megabytes), without putting the
    machine at risk.
memory-event-too-up =
    This limit is higher than what the machine can offer without suffering
    (2 GB in total, 1 GB of which is taken by everything else): the kernel
    would strike before systemd. Aim for a few hundred megabytes instead.
memory-event-without-restart =
    systemd killed the playlist when it went over its limit, as planned:
    the machine and the relay didn't feel a thing. But it stayed stopped
    (systemctl status radio-playlist: Result: oom-kill). For systemd to
    restart it on its own, you need to add Restart=on-failure to the
    {"["}Service] section of the override (sudo systemctl edit radio-playlist).
memory-event-contained =
    The playlist reached its limit: systemd killed it, and immediately
    restarted it (systemctl status radio-playlist). Only the playlist
    suffered, not the machine. The silence only lasted a moment.
memory-event-without-zombies =
    No more zombies: with their parent restarted, init reaped them.
memory-event-end =
    The playlist is running, contained by its limit and restarted if it
    goes over it; the zombies are gone. The live stream has its music
    back. Zoé: "I'm opening a ticket about the playlist's cache. Thanks!"

    Well done! You have finished chapter 2 of On Call. (What comes next:
    ssh radio.)

    WHAT HAPPENED
    The playlist kept every decoded track in memory, without ever
    forgetting anything: a memory leak. At 4:12 a.m., not a single byte
    was free, and the kernel killed the biggest process (the OOM killer).
    Here it was the culprit, but it could have been the database or the
    relay. A per-service limit (MemoryMax=) makes only the faulty service
    pay for the leak, and Restart=on-failure restarts it. The zombies came
    from another program, which never waited for its children.

    GOOD PRACTICE
    - A service killed for no apparent reason: sudo dmesg or journalctl -k
      (Out of memory), systemctl status (Result: oom-kill).
    - free -h for the state of memory, top -o %MEM to find out who is
      taking it, and follow it over time.
    - A memory limit per service (MemoryMax=), with automatic restart
      (Restart=on-failure), while the leak gets fixed.
    - Change a service with an override (systemctl edit), never by
      touching the file shipped in /usr/lib/systemd.
    - You can't kill a zombie: deal with its parent (and report the
      bug).

    ANOTHER WAY
    Fixing the leak is still the real solution: the limit only contains
    it. Other systemd settings: MemoryHigh= throttles the service (the
    kernel takes memory back from it) before it comes to killing it;
    OOMScoreAdjust= tells the kernel whom to sacrifice first; systemd-oomd
    stops a service before the whole machine chokes.

    DOCUMENTATION
    - MemoryMax=: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - Restart=: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
    - free: https://man7.org/linux/man-pages/man1/free.1.html
    - zombies and wait: https://man7.org/linux/man-pages/man2/wait.2.html
