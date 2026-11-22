### Story "The Climbing Wall", chapter "Old Battery": a worn battery, its
### quick test (upscmd, instcmds in upsd.users), a new cartridge's date
### (upsrw battery.mfr.date), alerts through upssched (NOTIFYCMD, AT …
### START-TIMER, CANCEL-TIMER). Commands, options, paths, configuration
### lines and outputs are not translated.

chapter-old-battery = Old Battery
    .summary = Two months after the storm, the UPS promises ten minutes of battery instead of fifty, and the front desk's mailbox drowns in "UPS: ONBATT" every time the fans start. Test the battery without draining it, get a new one in, and teach the alerts to tell a flicker from a power cut.

## Files

old-battery-message-thandiwe =
    From: Thandiwe (front desk, Overhang)
    Monday 17 January, 10:20

    Good morning,

    Two things, and they may be one.

    1. My mailbox. Every time the big fans of the bouldering room start,
       the lights flicker and I get two mails: "UPS: ONBATT", then
       "UPS: ONLINE". 38 on Saturday alone. I've started ignoring them,
       which is surely not the point. Can we get a mail only when the power
       is really out? (They go to "volunteers", which is me:
       /var/mail/thandiwe on belay.)

    2. Ikaika read the UPS's screen this morning: it says about ten minutes
       of battery. In November it was almost an hour. Haruto's notes say
       the battery is from 2028. Ikaika has a spare cartridge in the office
       (an APC RBC, it can be swapped with the UPS running) but he'd like
       proof before he opens anything.

    The hall is open (the 10:00 class is on the walls), so nothing that
    cuts the power, please! Haruto left an admin account in upsd.users
    for this kind of thing; its password is in the file.

    Thandiwe

## Events

old-battery-event-runtime =
    battery.runtime is in seconds: ten minutes at today's load, for a
    battery that gave fifty in November. ups.test.result tells when the UPS
    last tested itself. A quick test (a few seconds on battery) tells the
    battery's state without draining it: upscmd -l hallups lists what the
    UPS can do.

old-battery-event-flapping =
    Another pair of mails in Thandiwe's mailbox: the line flickered for a few
    seconds, upsmon saw ONBATT then ONLINE, and NOTIFYCMD mailed both. upsmon
    sends each event at once; to wait and see whether an event lasts,
    upsmon hands it to upssched (man upssched).

old-battery-event-denied =
    upsd refused: an instant command needs an account allowed to run it.
    In upsd.users, instcmds lists the commands an account may run (or
    ALL); actions = SET is only for changing variables. upsd rereads
    upsd.users on a reload.

old-battery-event-deep =
    A deep test is a calibration: the UPS runs the hall on its battery until
    it is nearly empty. With the hall open and a worn battery, a real cut
    during it would leave nothing. Stop it (test.battery.stop) and keep
    deep tests for closed hours, with a healthy battery.

old-battery-event-warning =
    "Done and warning", and ups.status now shows RB: the UPS asks for a new
    battery. Ikaika, delighted to have his proof, swaps the cartridge with
    the UPS running ("click, click: done"). The new one is charged at 92 %.
    The UPS still believes its battery is from 2028 (battery.mfr.date):
    that date is writable on this model (upsrw -l hallups). The cartridge's
    label says 2032/12/02.

old-battery-event-date =
    battery.mfr.date is the new cartridge's: the next person who reads upsc
    knows how old the battery is.

old-battery-event-passed =
    The quick test passes with the new battery: "Done and passed", RB gone,
    battery.runtime back to about fifty minutes.

old-battery-event-sched-error =
    NOTIFYCMD is upssched, but upssched.conf stops it: it needs CMDSCRIPT,
    PIPEFN and LOCKFN before its first AT line (journalctl -u nut-monitor:
    "must be set before any ATs").

old-battery-event-silenced =
    Now even a real outage wouldn't mail anyone: the alerts are silenced
    rather than sorted. A cut that lasts must still warn the volunteers.

old-battery-event-still-flapping =
    A flicker of a few seconds still sends a mail: something runs at every
    ONBATT or every ONLINE. A timer started on ONBATT and cancelled on
    ONLINE only fires if the power stays out (CANCEL-TIMER's optional
    command runs only when the timer had already fired).

old-battery-event-alerts =
    The alerts are sorted: a flicker of a few seconds starts upssched's
    timer and ONLINE cancels it, silently; an outage that lasts lets it fire
    and mails the volunteers once.

old-battery-event-end =
    Thandiwe: "Not a single mail since lunch, and Ikaika put the old
    cartridge in the recycling crate with a smile. Thank you!"

    Well done! You finished Old Battery.

    WHAT HAPPENED
    The battery, from 2028 and fully drained by the November cut, had lost
    most of its capacity. A quick test (upscmd, once the admin account had
    instcmds in upsd.users) gave the UPS's verdict, "Done and warning", and
    the RB flag. After the swap you wrote the new battery's date with upsrw
    and tested again. Meanwhile, upsmon's NOTIFYCMD mailed each flicker; with
    upssched, ONBATT starts a timer that ONLINE cancels, so only a lasting
    outage mails.

    GOOD PRACTICE
    - Test the battery regularly with the quick test, at quiet hours: it
      tells the battery's state in seconds. Keep deep tests (calibration)
      for closed hours, with a healthy battery.
    - Lead-acid UPS batteries last three to five years, less after deep
      discharges: write the date when you change one (battery.mfr.date or
      battery.date, where the UPS lets you), and plan the next one.
    - Give accounts only what they need: instcmds for the tests, actions =
      SET for variables, nothing for upsc's readers.
    - An alert must mean something: wait (upssched's timers) before
      mailing about a state that may last seconds; never silence everything.
    - REPLBATT (RB) deserves a mail too: AT REPLBATT * EXECUTE replbatt.

    DOCUMENTATION
    - upscmd(8): https://networkupstools.org/docs/man/upscmd.html
    - upsrw(8): https://networkupstools.org/docs/man/upsrw.html
    - upssched(8): https://networkupstools.org/docs/man/upssched.html
    - upssched.conf(5): https://networkupstools.org/docs/man/upssched.conf.html
    - Notification and scheduling: https://networkupstools.org/docs/user-manual.chunked/Advanced_usage_scheduling_notes.html
    - upsd.users(5): https://networkupstools.org/docs/man/upsd.users.html
