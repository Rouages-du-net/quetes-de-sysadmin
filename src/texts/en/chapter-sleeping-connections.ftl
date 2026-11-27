### Story "The Allotments", chapter "Sleeping Connections": the
### allotments' site answers "Too many connections". MariaDB's connections
### (SHOW PROCESSLIST), wait_timeout, max_connections, KILL, the slow query
### log, EXPLAIN, CREATE INDEX. Commands, options, paths, SQL and outputs
### are not translated.

chapter-sleeping-connections = Sleeping Connections
    .summary = On a spring Saturday, the allotments' booking site answers "Too many connections" just as everyone wants a watering slot. Find out who holds the database's connections, why they never leave, and why each page takes forty seconds.

## Files

sleeping-connections-message-halima =
    From: Halima (chair, Greenholme Allotments Association)
    Saturday 10 May, 9:20

    Hello, and welcome aboard!

    It's the first sunny Saturday of the season and everyone is trying to
    book a watering slot or the rotavator on www.greenholme.example. Half of
    them get a page that says "Too many connections", the other half wait
    forever. Lwazi, who wrote Plotline (our booking app), is on a train
    until tonight; he says it's "the database" and left you a note.

    The database lives on trowel, where you are now. sudo works with your
    password. Could you have a look? Please don't just make the problem go
    away for an hour: next Saturday will be the same.

    Halima

sleeping-connections-note-lwazi =
    Notes from Lwazi (trowel, 2027, updated last spring)

    - trowel runs MariaDB (Debian's package, the mariadb service). The
      database is plots: members, plots, waitlist, bookings.
    - Plotline runs on shed (198.51.100.133) and connects to trowel over the
      back network, as plotline.
    - As root on trowel, sudo mariadb opens the database (Debian lets the
      system's root in through the socket, no password).
    - The configuration: /etc/mysql/mariadb.conf.d/50-server.cnf. The logs
      go to the journal: journalctl -u mariadb.
    - I know the app doesn't close its connections properly. It's on my
      list. MariaDB cleans them up eventually, I think?

    Lwazi

## Events

sleeping-connections-event-crowd =
    Look at the Command column: almost every connection is Sleep. They all
    come from shed (198.51.100.133) as plotline, and their Time keeps
    growing: thousands of seconds asleep. Each holds one of the 151 slots
    (max_connections); when they are all taken, the next visitor gets
    "Too many connections" (you only got in because root keeps one extra
    slot). How long does MariaDB let a connection sleep before closing it?
    (SHOW VARIABLES LIKE '%timeout%'; man mariadb.)
sleeping-connections-event-too-big =
    max_connections at that size only moves the wall: the app would fill
    ten thousand slots just as it fills 151, and each connection costs
    memory (buffers, a thread) until the server runs out of it. The limit
    is a safeguard; what is wrong is that nothing ever closes the sleeping
    connections. Bring it back to a sensible value (151 is the default).
sleeping-connections-event-restart-only =
    The restart closed every connection, and the site breathes again. But
    the app opens three new ones every half minute and never closes them,
    and wait_timeout still lets each sleep eight hours: in less than an hour
    the 151 slots are full again. What decides how long a sleeping
    connection may stay, at the next start too?
sleeping-connections-event-timeout =
    wait_timeout is shorter now for the server: the connections that open
    from now on will be closed after that much sleep ("Aborted connection
    … Got timeout reading communication packets" in the journal). Are the
    ones already there affected?
sleeping-connections-event-old-sessions =
    { $count } sleeping connections are still there, and their Time still
    grows past your new limit. SET GLOBAL only changes the default that new
    sessions copy when they connect: each existing session keeps the
    wait_timeout it got, eight hours. They must be closed (KILL id;, or
    mariadb-admin kill id,id,…; SELECT id FROM information_schema.PROCESSLIST
    WHERE … lists them).
sleeping-connections-event-cleared =
    The old sleeping connections are gone and the new ones only stay a few
    minutes: the slots are free, the site answers again.
sleeping-connections-event-persisted =
    The shorter wait_timeout is in 50-server.cnf now: the server will read
    it at every start, not only until the next reboot.
sleeping-connections-event-slow-log =
    The slow query log is on: each query longer than long_query_time is
    written there with its time and the rows it examined. Read it (the file
    is slow_query_log_file; SHOW VARIABLES LIKE 'slow_query%'): which query
    is slow, and how many rows does it read to answer?
sleeping-connections-event-explain =
    type ALL, key NULL, rows 1834212: to find one plot's bookings, MariaDB
    reads the whole table, every time a visitor opens a plot's page, and
    each of those connections stays busy forty seconds. An index on the
    column of the WHERE clause lets it go straight to the right rows (man
    mariadb: CREATE INDEX).
sleeping-connections-event-wrong-index =
    That index starts with another column: for WHERE plot_id = …, MariaDB
    can't use it (EXPLAIN still says type ALL). An index helps the queries
    whose WHERE (or ORDER BY) starts with its first column.
sleeping-connections-event-index =
    With the index, EXPLAIN says type ref, a few hundred rows: the plot page
    answers in a few milliseconds instead of forty seconds.
sleeping-connections-event-end =
    Halima: "It works! Someone has already booked the rotavator for 2 pm.
    Lwazi says he'll fix the app's connections tonight, and thanks you
    for the index."

    Well done! You finished Sleeping Connections.

    WHAT HAPPENED
    Plotline opened connections to MariaDB and never closed them. With
    wait_timeout at its default, 28800 seconds, the server kept each one
    asleep for eight hours, until the 151 slots of max_connections were all
    taken and visitors got "Too many connections". At the same time, each
    plot page read the 1.8 million rows of bookings, because no index
    covered plot_id. You shortened wait_timeout for the running server and
    in its configuration, closed the sessions that kept their old timeout,
    found the slow query and gave it its index.

    GOOD PRACTICE
    - SHOW PROCESSLIST first: who is connected, from where, doing what
      (Sleep, or a query and for how long).
    - SET GLOBAL changes the running server and only new sessions copy it;
      the configuration file is what the next start reads. Do both.
    - max_connections is a safeguard: raising it hides a leak until memory
      runs out. The real fix is in the app (close connections, or a
      connection pool), and wait_timeout cleans up behind it.
    - The slow query log and EXPLAIN tell you which query hurts and why;
      an index on the WHERE clause's column is often the whole answer.
    - Root keeps one extra connection (extra_max_connections): never let an
      app connect with an account that has that privilege.

    DOCUMENTATION
    - Server system variables (wait_timeout, max_connections): https://mariadb.com/kb/en/server-system-variables/
    - SHOW PROCESSLIST: https://mariadb.com/kb/en/show-processlist/
    - KILL: https://mariadb.com/kb/en/kill/
    - The slow query log: https://mariadb.com/kb/en/slow-query-log-overview/
    - EXPLAIN: https://mariadb.com/kb/en/explain/
    - CREATE INDEX: https://mariadb.com/kb/en/create-index/

## What the three chapters of the story share: kept here so that they load with the story.

allotments-plotline-readme =
    Plotline, the Greenholme Allotments' booking app (Lwazi).
    gunicorn on 0.0.0.0:8000, behind the site's nginx.
    Its settings are in /srv/plotline/.env, read when the plotline service
    starts: sudo systemctl restart plotline after a change.
    Its log: /var/log/plotline/app.log.
