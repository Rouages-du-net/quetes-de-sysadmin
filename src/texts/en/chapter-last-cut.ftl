### Story "The Climbing Wall", chapter "The Last Cut": after a power cut,
### the hall's server crashed instead of shutting down. Network UPS Tools
### (upsc, upsmon, MONITOR, MINSUPPLIES, SHUTDOWNCMD, upsmon -c fsd) and the
### server's power restore policy (ipmitool chassis policy). Commands,
### options, paths, configuration lines and outputs are not translated.

chapter-last-cut = The Last Cut
    .summary = A storm cut the climbing hall's power for an hour and a half. The server sat on a UPS bought for exactly that, and still died like a pulled plug. Find out why it never heard the UPS, make it listen, and prove it with a real drill.

## Files

last-cut-message-nkechi =
    From: Nkechi (chair, Overhang climbing hall)
    Thursday 18 November, 21:40

    Hello, and thank you for staying after closing time!

    On Tuesday evening the storm cut the power in the whole street from
    19:42 to 21:05. The emergency lights came on, we got everyone off the
    walls, and the UPS in the office rack beeped bravely for almost an hour.
    Then it went quiet, and belay (our server: bookings, memberships, the
    door's badges) died with it. When the power came back it started again
    by itself, but the bookings database needed a repair and we lost the
    evening's entries.

    The UPS is there precisely so that belay shuts down cleanly before the
    battery is empty. Haruto set it all up in 2028; he lives in Sapporo now
    but left notes in your home directory.

    The hall is closed until tomorrow 10:00, so tonight you may really test
    it: Ikaika, our volunteer electrician, is in the office if a button must
    be pressed. sudo works with your password.

    Nkechi

last-cut-notes-haruto =
    Notes from Haruto (belay, 2028, last updated 2030)

    - The UPS talks to belay over USB. Network UPS Tools (NUT, Debian's
      nut-server and nut-client packages) has three layers: the driver
      (nut-driver@NAME, for the UPS named NAME in /etc/nut/ups.conf), upsd
      (nut-server: it serves the UPS's data), and upsmon (nut-monitor: it
      watches upsd and shuts belay down when the battery runs low).
    - upsc lists what upsd knows: upsc -l for the UPS names, upsc NAME for
      everything a UPS says.
    - 2030: the old Eaton died, we bought an APC Back-UPS RS 1500. I renamed
      its section in ups.conf to something more telling.
    - upsmon kept filling the journal with "Poll UPS failed" lines; I made it
      quieter in upsmon.conf (POLLFAIL_LOG_THROTTLE_MAX).
    - To test the shutdown, NUT's documentation says: upsmon -c fsd. It is a
      REAL shutdown: belay stops, then the UPS cuts its outlets for a moment.
      Only when the hall is closed!
    - The server's board has a BMC: ipmitool works as root.

## Events

last-cut-event-blind =
    upsmon has been polling a UPS called eaton on localhost, and upsd
    answers that it doesn't exist. Since 2030, the only UPS upsd knows has
    another name. A UPS that upsmon never heard from is never "on battery"
    for it, so on Tuesday it sat still until the battery was empty. Which
    UPS does upsd serve? (man upsc)

last-cut-event-renamed =
    There it is: upsd serves one UPS, under the name of its section in
    /etc/nut/ups.conf. upsmon's MONITOR line must name it exactly, as
    NAME@HOST (man upsmon.conf).

last-cut-event-minsupplies =
    MINSUPPLIES says how many power supplies must stay healthy for upsmon
    to keep the machine running. At 0, upsmon never finds too few: it never
    shuts belay down, whatever the battery says. belay has one power supply:
    MINSUPPLIES 1.

last-cut-event-no-shutdown =
    upsmon.conf's SHUTDOWNCMD no longer halts the machine. When the battery
    runs low, upsmon would run it and belay would carry on until the UPS
    goes dark: exactly Tuesday's crash. Debian's default is "/sbin/shutdown -h +0".

last-cut-event-monitor-down =
    nut-monitor (upsmon) isn't running, or won't start at the next boot.
    Without upsmon, nothing watches the UPS: it must be active and enabled
    (systemctl status nut-monitor, systemctl enable --now).

last-cut-event-killed =
    upsdrvctl shutdown sends the UPS its "kill power" command: after
    offdelay seconds it cuts its outlets, whatever is still running behind
    them. NUT does it itself at the very end of a shutdown, once the
    machines are halted; typed by hand, it pulls the plug on belay.

last-cut-event-watching =
    upsmon now watches hallups: logged in to upsd as a primary (upsc -c
    hallups lists it as a client, and the journal says "UPS: …
    (primary)"). On battery, then on low battery, it will warn and shut
    belay down, and tell the UPS to cut and come back.

last-cut-event-blind-drill =
    The drill shut belay down… but upsmon still watched the UPS that
    doesn't exist: it tried to set "forced shutdown" on it, failed, and
    halted belay all the same. upsmon -c fsd tests the shutdown, not the
    detection: on a real cut, this upsmon would still have seen nothing.
    Fix the MONITOR line first, then drill again.

last-cut-event-drill =
    The drill went as it should: upsmon set FSD on the UPS, belay shut down
    cleanly, and at the very end the UPS cut its outlets for a moment
    (journalctl -b -1: the end of the previous boot).

last-cut-event-stayed-off =
    But belay didn't come back by itself: Ikaika had to press its power
    button. Its firmware's power restore policy is "previous": it powers on
    when power returns only if it was running when power went. On Tuesday it
    crashed while running, so it came back; tonight it had shut down
    cleanly, so it stayed off. On a cut at 3 am, nobody presses the button.
    Look at ipmitool chassis status (man ipmitool).

last-cut-event-policy =
    Power Restore Policy: always-on. Whenever the UPS gives its outlets back,
    belay starts. A new drill will tell.

last-cut-event-end =
    Nkechi: "Ikaika says the UPS clicked, went quiet, and belay came back on
    its own two minutes later. The best show we've had in the office."

    Well done! You finished The Last Cut.

    WHAT HAPPENED
    upsmon watched eaton@localhost, the name of a UPS replaced in 2030: upsd
    answered "does not exist", and a UPS upsmon has never heard from is
    never on battery for it. On Tuesday the battery ran flat and belay
    crashed. You made upsmon watch hallups as a primary, then drilled with
    upsmon -c fsd: FSD on the UPS, a clean shutdown, and the UPS's kill
    power at the very end (upsmon's POWERDOWNFLAG, then upsdrvctl shutdown
    from the shutdown scripts). After a clean shutdown, the firmware's
    "previous" policy kept belay off: always-on brings it back with the
    power.

    GOOD PRACTICE
    - Check the chain end to end: upsc -l (which names upsd serves), upsc -c
      UPS (is upsmon logged in?), the journal of nut-monitor (no "Poll UPS
      failed").
    - Never silence an error you haven't understood: throttling "Poll UPS
      failed" hid this one for two years.
    - MINSUPPLIES 1 and a real SHUTDOWNCMD: there is no "safe" setting that
      disables the shutdown; that is the crash you were avoiding.
    - Drill when nobody needs the machine: upsmon -c fsd really shuts down
      and the UPS really cuts its outlets. It doesn't test the detection:
      read the logs for that, or pull the UPS's plug (with an electrician).
    - Machines behind a UPS that cuts and gives power back need "power on
      when AC returns" (always-on) in their firmware.
    - NUT 2.8 renamed master and slave to primary and secondary; the old
      words still work, the new ones are clearer.

    DOCUMENTATION
    - upsmon(8): https://networkupstools.org/docs/man/upsmon.html
    - upsmon.conf(5): https://networkupstools.org/docs/man/upsmon.conf.html
    - upsc(8): https://networkupstools.org/docs/man/upsc.html
    - Testing shutdowns (upsdrvctl -t shutdown, then upsmon -c fsd): https://networkupstools.org/docs/user-manual.chunked/Configuration_notes.html
    - ipmitool: https://codeberg.org/IPMITool/ipmitool

## What the three chapters of the story share: kept here so that they load with the story.

climbing-wall-archive-readme =
    harness: Overhang's NAS (Akosua)
    /srv/archive/photos: the competitions' and the courses' photos
    /srv/archive/waivers: the signed waivers (scans), kept five years
    Shared with Samba to the office and the front desk.
