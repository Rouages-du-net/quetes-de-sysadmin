### Story "The Observatory", chapter 2 "The Quota": nice doesn't cap,
### CPUQuota= does. Commands, paths, unit names and systemd's messages are
### not translated.

chapter-quota = The Quota
    .summary = The stacking is now a service with Nice=19, and the gallery is fine. But the hosting provider will throttle the machine: all night above its CPU baseline. Cap the stacking without losing Jules's night.

## Files

quota-message-amara =
    From:     Amara
    To:       you
    Subject:  The host is going to throttle us

    Hello,

    Since your fix, Jules turned his stacking into a service:
    /etc/systemd/system/stacking.service, with Nice=19, as you advised. He
    starts it when he goes to bed. The gallery doesn't suffer any more.

    But read the host's mail (mail_from_the_host.txt): the machine is
    above its "baseline" all night, and they will slow it down. Can you
    keep the stacking under that limit, for tonight and for the next
    nights?

    It is still running (since 1:10 am, until about 11): if you can, don't
    restart it, Jules would lose his night.

    Same sudo password: nebula-2028.

    Amara
quota-mail-host =
    From:     support@cloud.example
    To:       astro-club@cloud.example
    Subject:  [observatory] CPU credits exhausted

    Hello,

    Your instance "observatory" (2 vCPU, "burst" plan) has used more than
    its baseline of 40 % of its vCPUs for 7 hours in a row. Its CPU credits
    are exhausted: from 12:00 today, it will be limited to that baseline
    until its credits rebuild.

    To avoid this, keep the average use of the instance under 40 %.

    The cloud.example team

## Events

quota-event-measure =
    The workers are at nice 19, and yet they take almost all of both CPUs:
    nobody browses the gallery at this hour, so nobody claims the rest. Nice shares between processes that want the CPU; it caps
    nothing. Over the whole night, the machine is at 100 % of its two
    vCPUs: far above the 40 % of the host.
quota-event-nice-property =
    systemctl set-property only changes resource-control settings, those
    systemd can apply to a running service (CPUQuota=, CPUWeight=,
    MemoryMax=…). Nice= is applied when the processes start. And nice is
    not what you need here: man systemd.resource-control.
quota-event-reload =
    The file says CPUQuota=, but systemd hasn't read it yet: after
    changing a unit file or a drop-in by hand, sudo systemctl
    daemon-reload. (systemctl edit and systemctl set-property do it by
    themselves.)
quota-event-per-cpu =
    A quota is set, but it is too high for the host. CPUQuota= counts in
    percent of ONE CPU: 100 % is a whole CPU, 200 % both. The host allows
    40 % of the two vCPUs: 0.8 CPU, so CPUQuota=80% at most.
quota-event-stopped =
    The stacking is stopped. Jules: "My night!" For it to finish, it must
    run: sudo systemctl start stacking (it starts again from the
    beginning) — and cap it, otherwise the host will slow everything down.
quota-event-restarted =
    The stacking restarted: it starts again from the beginning of the
    night's photos. Jules sighs, but it will finish this afternoon. No
    restart was needed: systemd applies CPUQuota= to a running service
    (set-property, or daemon-reload after a drop-in).
quota-event-end =
    The stacking now stays under 0.8 CPU: 40 % of the machine. It still
    runs, a little longer, and the host's limit is respected; the setting
    is on disk, so it will apply to the next nights too. Amara: "Perfect,
    I'll answer the host."

    Well done! You have finished the chapter "The Quota".

    WHAT HAPPENED
    Nice=19 put the stacking behind every other process, but it caps
    nothing: when nobody else wants the CPU, a niced process takes all of
    it. All night, the machine was at 100 % of its two vCPUs, more than
    the 40 % the host's plan allows over time.

    NICE SHARES, THE QUOTA CAPS
    - nice (Nice=, renice): who goes first when there isn't enough for
      everyone. No limit when the CPU is free.
    - CPUQuota= (systemd, the kernel's cgroups): at most this much CPU time
      per second, even when the CPU is free. 100 % = one CPU, 200 % = two.
    - CPUWeight=: like nice, but between services (cgroups).

    GOOD PRACTICE
    - sudo systemctl set-property stacking CPUQuota=80%: applied at once,
      and kept on disk (in /etc/systemd/system.control).
    - Or sudo systemctl edit stacking ({"["}Service] CPUQuota=80%): a drop-in,
      read at once by systemctl edit. By hand: daemon-reload.
    - Check with systemd-cgtop, or top: the workers together stay under
      the quota.

    DOCUMENTATION
    - CPUQuota=, CPUWeight=: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
    - systemctl set-property: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - systemd-cgtop: https://www.freedesktop.org/software/systemd/man/latest/systemd-cgtop.html
