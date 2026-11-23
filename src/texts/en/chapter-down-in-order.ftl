### Story "The Climbing Wall", chapter "Down in Order": the NAS on the same
### UPS becomes upsmon's secondary. upsd.conf (LISTEN, a restart),
### upsd.users (upsmon secondary), ufw, the secondary's upsmon.conf and
### nut.conf, HOSTSYNC, offdelay and ondelay in ups.conf, a drill.
### Commands, options, paths, configuration lines and outputs are not
### translated.

chapter-down-in-order = Down in Order
    .summary = The NAS that keeps the hall's photos and signed waivers now shares the server's UPS, but nobody tells it when to stop. Make it the UPS's secondary over the network, without opening the UPS to the whole internet, and make sure it is halted before the UPS cuts the power.

## Files

down-in-order-message-akosua =
    From: Akosua (photo archive and waivers, Overhang)
    Friday 26 November, 21:45

    Hi! Nkechi told me about last week's drill: belay goes down cleanly
    now. Brilliant.

    Since the storm, harness (the NAS, 198.51.100.142) is plugged into the
    same UPS as belay, in the office rack. But it doesn't know anything
    about the UPS: on Tuesday it died with the power, and its disks spent
    the night checking themselves. The waivers are on it, we must keep
    them five years.

    Haruto once said the NAS could listen to belay: belay talks to the UPS
    over USB and could pass the news on over the network. I don't know how.
    harness has nut-client installed, nothing configured. You can ssh from
    belay to harness with your key; sudo works there too.

    One thing I do know: harness is slow to stop. Samba first, then it
    flushes its disks' cache. Count two minutes and a half.

    The hall is closed: you may drill again tonight.

    Akosua

## Events

down-in-order-event-listen-restart =
    upsd.conf has its new LISTEN line, but upsd still listens where it did
    (ss -tlnp): upsd reads LISTEN only when it starts. A reload rereads
    upsd.users and ups.conf, not this: restart nut-server.

down-in-order-event-listen =
    upsd now listens on the office network too: harness can reach it on
    port 3493, if belay's firewall lets it through.

down-in-order-event-exposed =
    Careful: from the internet, port 3493 on belay's public address now
    answers. upsd tells anyone the UPS's state, and with a guessed password
    someone could ask for a forced shutdown. Listen on the office address
    only, or let only harness through the firewall.

down-in-order-event-secondary-user =
    harness has an account in upsd.users. "upsmon secondary" gives it what a
    secondary needs: to log in and follow the UPS, nothing more.

down-in-order-event-too-much =
    A second "primary": a primary may set FSD and shut every machine on the
    UPS down. Only belay, which drives the UPS and cuts it last, must be
    primary; harness follows as a secondary (in upsd.users and in harness's
    MONITOR line).

down-in-order-event-firewall =
    belay's firewall lets harness in on 3493.

down-in-order-event-blocked =
    The connection times out: belay's ufw drops what isn't allowed. Allow
    3493/tcp from harness (man ufw: allow from ADDRESS to any port PORT).

down-in-order-event-secondary =
    harness's upsmon is logged into hallups on belay as a secondary (upsc -c
    hallups on belay lists two clients). When the battery runs low, belay
    sets FSD, harness sees it and shuts down, belay waits for it to log out
    (HOSTSYNC) before its own shutdown.

down-in-order-event-drill-crash =
    During the drill, harness lost its power while it was still shutting
    down (its journal: the previous boot ends in the middle of stopping;
    this one starts with a disk check). It logged out at once, so belay went
    on; belay halted in half a minute, then told the UPS to cut its outlets
    after offdelay seconds: 20 by default, while harness needs 150. Give the
    UPS a longer delay before it cuts (man usbhid-ups: offdelay, ondelay).

down-in-order-event-ondelay =
    In ups.conf, ondelay is not greater than offdelay. usbhid-ups(8): ondelay
    "must be greater" than offdelay, or the UPS may not give the power back
    after a cut.

down-in-order-event-not-enabled =
    After the drill, harness's upsmon didn't come back: nut-monitor is
    started but not enabled on harness, so a boot doesn't start it. Until
    someone notices, harness is unprotected again.

down-in-order-event-end =
    Akosua: "I watched the NAS's lights during the drill: it went dark a
    good minute before the UPS clicked, and both came back on their own.
    The waivers thank you."

    Well done! You finished Down in Order.

    WHAT HAPPENED
    harness shared belay's UPS without knowing it. You made belay's upsd
    listen on the office network (LISTEN, read only at start), gave harness
    a secondary's account and its own MONITOR line, opened 3493 to harness
    alone, and enabled its nut-monitor. The first drill showed the last
    trap: belay waited for harness to log out, but harness logs out as it
    starts shutting down, and needs two minutes and a half; the UPS cut its
    outlets 20 seconds after belay's halt. A longer offdelay (and an ondelay
    greater still) gives every machine time to stop.

    GOOD PRACTICE
    - One primary per UPS: the machine wired to it, which halts last and
      tells the UPS to cut. The others are secondaries over the network.
    - Open upsd to the machines that need it, not to the world: LISTEN on
      the inside address, and a firewall rule from each secondary.
    - Time the slowest machine's shutdown and set offdelay above it, with a
      margin; check the battery holds that long at low battery
      (battery.runtime.low, battery.charge.low).
    - Enable the services, then prove it with a drill: what isn't started
      at boot protects nothing after the first cut.

    ANOTHER WAY
    A secondary may shut itself down earlier than the low battery, with
    upssched (a timer after ONBATT): slow machines then leave first, and the
    battery is kept for the others.

    DOCUMENTATION
    - upsd.conf(5): https://networkupstools.org/docs/man/upsd.conf.html
    - upsd.users(5): https://networkupstools.org/docs/man/upsd.users.html
    - upsmon(8), the shutdown sequence: https://networkupstools.org/docs/man/upsmon.html
    - usbhid-ups(8), offdelay and ondelay: https://networkupstools.org/docs/man/usbhid-ups.html
    - nut.conf(5): https://networkupstools.org/docs/man/nut.conf.html
