### Story "The Canteen", chapter 1 "The Boot Order": the app starts before
### its database (After=, Requires=, Wants=). Unit names, paths and
### systemd's messages are not translated.

chapter-boot-order = The Boot Order
    .summary = After a power cut, the canteen's server comes back up, but its bookings app doesn't: it starts before its database. Teach systemd the order.

## Files

boot-order-message-ibrahim =
    From:     Ibrahim
    To:       you
    Subject:  The bookings are down again

    Hello,

    This morning there was a power cut in the neighbourhood. The server
    came back up by itself, but not the bookings: the menu app (the menu
    service) is "failed". The volunteers in the kitchen can't see who's
    coming for lunch.

    Last time I just did sudo systemctl start menu and it worked. But
    after every reboot it's the same story, and I'm not always there. I
    wrote the unit file myself, /etc/systemd/system/menu.service,
    following a tutorial: it works when I start it by hand, so it can't
    be that bad?

    Can you make sure the bookings come back on their own after a
    reboot? You can reboot the server to check (sudo reboot): nobody is
    booking at this hour. Your sudo password is lentils-2028.

    Thanks!
    Ibrahim

## Events

boot-order-event-refused =
    "connect ECONNREFUSED 127.0.0.1:5432": the app knocked on PostgreSQL's
    door (port 5432)… and nobody answered. Yet postgresql is running now.
    Look at the journal of this boot, unit by unit and in time order
    (journalctl -b): who started first? And what does the unit file say
    about the database? (systemctl cat menu)
boot-order-event-by-hand =
    The app runs again, started by hand: the kitchen can take bookings.
    But nothing has changed in its unit: at the next reboot, it will start
    in the same order as this morning. Fix the cause, then reboot to check
    (sudo reboot).
boot-order-event-wrong-name =
    Careful with the name: systemd knows postgresql.service, not
    postgres.service. An After= or a Wants= on a unit that doesn't exist
    is quietly ignored (systemctl list-dependencies menu, systemd-analyze
    verify menu.service).
boot-order-event-requires-only =
    Still failed after the reboot, even with the dependency declared. Requires=
    (or Wants=) says "start PostgreSQL too", not "start it first": both
    start at the same time, and the app still arrives too early. The order
    is another line: After= (man systemd.unit).
boot-order-event-order =
    systemd now knows that the app starts after PostgreSQL (systemctl
    list-dependencies --after menu). A reboot will tell whether it is
    enough: sudo reboot, then look at the services.
boot-order-event-end =
    After the reboot, PostgreSQL started first, then the app, then nginx:
    everything is up without anyone touching it. Ibrahim: "So that's what
    After= is for! I'll put it in my tutorial."

    Well done! You have finished the chapter "The Boot Order".

    WHAT HAPPENED
    At boot, systemd starts the enabled services in parallel, as fast as
    it can. Nothing in Ibrahim's unit said the app needed the database:
    the app started at the same time as PostgreSQL, tried to connect
    before PostgreSQL was ready, and stopped. Started by hand later, it
    found the database running: "it works by hand", but not at boot.

    DEPENDENCY OR ORDER: TWO DIFFERENT THINGS
    - Requires=postgresql.service: start PostgreSQL too, and if it fails,
      don't start the app. Wants= is the soft version (start it, but
      carry on if it fails).
    - After=postgresql.service: if both start, start PostgreSQL first, and
      wait until it is ready.
    - Alone, Requires= or Wants= start both at the same time; alone,
      After= orders but pulls nothing in. The usual pair:
      After= + Requires= (or Wants=).

    GOOD PRACTICE
    - Put the change in a drop-in (sudo systemctl edit menu) or in the
      unit file, then sudo systemctl daemon-reload; check with
      systemctl cat menu and systemctl list-dependencies menu.
    - systemd-analyze verify menu.service catches typos (unknown keys,
      units that don't exist).
    - A service that "works by hand" proves nothing about the next boot:
      the only test is a reboot (in a quiet moment), then
      systemctl --failed.
    - The program should also be patient: an app that retries its
      database for a few seconds survives a slow start.

    DOCUMENTATION
    - systemd.unit, After= and Requires=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - systemctl (cat, list-dependencies, edit): https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
