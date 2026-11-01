### Story "The Canteen", chapter 2 "The Restart Loop": Restart=,
### RestartSec=, the start limit, PartOf=. Unit names, paths and systemd's
### messages are not translated.

chapter-restart-loop = The Restart Loop
    .summary = Restart=always was supposed to bring the app back by itself: last night it gave up after half a second. Make it survive PostgreSQL's restarts.

## Files

restart-loop-message-ibrahim =
    From:     Ibrahim
    To:       you
    Subject:  Restart=always didn't help

    Hello,

    Since your fix, the reboots are fine. But last night, the automatic
    updates upgraded PostgreSQL (they restart it when they do), and this
    morning the bookings were down again.

    I had read that Restart=always makes systemd restart a service that
    dies, so I had added it to /etc/systemd/system/menu.service a few days
    ago. Apparently systemd did try… and then gave up? I don't understand
    the journal.

    The updates will restart PostgreSQL again: can you make the app cope
    with it on its own? To test, you can do what the updates do:
    sudo systemctl restart postgresql. The bookings must come back without
    anyone starting the app by hand. Same sudo password: lentils-2028.

    Ibrahim

## Events

restart-loop-event-limit =
    "Start request repeated too quickly", Result: start-limit-hit. When
    PostgreSQL restarted, the app lost its connection and exited; Restart=
    restarted it after RestartSec=, 100 ms by default… while PostgreSQL
    was still restarting. Five failures in half a second: past the start
    limit (5 starts in 10 s by default), systemd gives up. Look at the
    times in journalctl -u menu.
restart-loop-event-too-often =
    "start of the service was attempted too often": systemd counts the
    starts, even yours, and refuses while the limit is reached. Once the
    cause is fixed, sudo systemctl reset-failed menu forgets the failures
    (systemctl start works again after StartLimitIntervalSec= too).
restart-loop-event-again =
    Same loop: PostgreSQL restarted, the app died, came back five times too
    soon, and systemd gave up again. As long as the app restarts before
    the database is back, Restart= alone won't help. Either give PostgreSQL
    time (RestartSec=), or tie the app to PostgreSQL so that it stops and
    restarts with it (man systemd.unit: PartOf=).
restart-loop-event-binds-to =
    BindsTo= did stop the app with PostgreSQL, cleanly this time. But
    nothing started it again: BindsTo= propagates the stop, not the start.
    For "restart with it", it's PartOf= (with After=, to come back after
    it).
restart-loop-event-end =
    PostgreSQL restarted, and the app came back by itself, after it. Ibrahim:
    "The kitchen didn't even notice. I'll let the updates run tonight."

    Well done! You have finished the chapter "The Restart Loop".

    WHAT HAPPENED
    When PostgreSQL restarts, the app loses its connection and exits in
    failure. Restart=always made systemd restart it after RestartSec=,
    100 ms by default: five times in half a second, while the database was
    still restarting. Past StartLimitBurst= starts (5) in
    StartLimitIntervalSec= (10 s), systemd stops trying: Result:
    start-limit-hit, and the app stayed down until morning.

    TWO WAYS OUT
    - PartOf=postgresql.service (with After=): when PostgreSQL stops or
      restarts, systemd stops the app first, then starts it again after
      the database. No failure at all.
    - Restart=on-failure with RestartSec=5s: the app dies, but systemd
      waits long enough for PostgreSQL to come back before trying again.
    - BindsTo= stops the app with PostgreSQL but doesn't bring it back.

    GOOD PRACTICE
    - Restart=on-failure rather than always (a clean stop is not a failure),
      and a RestartSec= of a few seconds: a loop of instant restarts only
      fills the journal.
    - After a start-limit-hit, fix the cause, then systemctl reset-failed
      and systemctl start.
    - Test what will happen at night by doing it during the day:
      sudo systemctl restart postgresql, then systemctl status menu.

    DOCUMENTATION
    - Restart=, RestartSec=: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=
    - StartLimitIntervalSec=, StartLimitBurst=, PartOf=, BindsTo=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
