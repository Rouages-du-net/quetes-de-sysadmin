### Story "The Theatre", chapter 1 "Opening Night": max_connections,
### pg_stat_activity, idle in transaction, idle_in_transaction_session_timeout.
### SQL, paths and the tools' outputs are not translated.

chapter-too-many-clients = Opening Night
    .summary = Ticket sales for the opening night started at 10 am, and the ticket office has answered errors ever since: PostgreSQL refuses new connections. Find who holds them, and make sure it doesn't happen again.

## Files

too-many-clients-message-camille =
    From:     Camille
    To:       you
    Subject:  URGENT: ticket office down

    Hello,

    Sales for "The Lighthouse Keeper" (opening night, 28 February)
    opened at 10 am, and since about 10:05 the ticket office shows
    "Sorry! The ticket office is unavailable". People are calling the
    theatre. The site: curl -i http://localhost:3000/

    It's a small machine, so last year we lowered PostgreSQL's
    max_connections to 20. But we only have one app!

    The sudo password: curtain-2028. PostgreSQL's administrator is the
    postgres account: sudo -u postgres psql.

    Camille

## Events

too-many-clients-event-full =
    "remaining connection slots are reserved for roles with the SUPERUSER
    attribute": every ordinary connection is taken. PostgreSQL keeps 3
    of its max_connections for superusers: you can still get in with
    sudo -u postgres psql. Who holds the others? (man psql:
    pg_stat_activity)
too-many-clients-event-idle =
    "idle in transaction": the app opened a transaction (BEGIN, then
    SELECT … FOR UPDATE: the seat is held), and has been waiting since,
    without COMMIT nor ROLLBACK. Look at state_change: some since 10:00.
    Each visitor who picks a seat and leaves without paying keeps one
    connection forever.
too-many-clients-event-terminated =
    Some connections were ended, and the ticket office breathes… for a
    while: each new visitor who picks a seat holds another one. Ending
    them by hand is first aid. PostgreSQL can end them itself after a
    while (man psql: SHOW, ALTER SYSTEM; the setting is about sessions
    idle in a transaction).
too-many-clients-event-restart-needed =
    max_connections changed in the file, but SHOW max_connections still
    says the old value: this setting only changes with a restart of
    PostgreSQL ("change requires restart"), which closes every
    connection.
too-many-clients-event-more-room =
    More room: the ticket office works again, for now. But the leak is
    still there: each abandoned seat holds a connection, and the new
    slots will fill up the same way (and each connection costs memory on
    a small machine). What ends the abandoned transactions?
too-many-clients-event-reload-needed =
    The file says idle_in_transaction_session_timeout, but the server
    hasn't read it yet: SHOW shows the old value. This one doesn't need a
    restart: sudo systemctl reload postgresql (or SELECT pg_reload_conf();).
too-many-clients-event-too-long =
    A timeout is set, but a long one: a seat held for that long blocks
    the other buyers, and the connections still pile up during the rush.
    A few minutes at most (1min is plenty for a payment page).
too-many-clients-event-stopped =
    A service is stopped: PostgreSQL and the ticket office must run for
    the sales (sudo systemctl start …).
too-many-clients-event-end =
    The abandoned transactions now end on their own: the ticket office
    gets its connections again, and the sales go on. Camille: "Seven
    seats left in row A, and nobody waits any more!"

    Well done! You have finished the chapter "Opening Night".

    WHAT HAPPENED
    PostgreSQL accepts max_connections connections (20 here), and keeps 3
    for superusers. When a visitor picked a seat, the app opened a
    transaction to hold it (FOR UPDATE), and kept it, and its connection,
    until the payment. Visitors who left never paid: each one left a
    connection "idle in transaction". By 10:05, the app held all of them.

    THE TOOLS
    - pg_stat_activity: one row per connection; state and state_change
      tell who waits, and since when.
    - pg_terminate_backend(pid): ends one; first aid.
    - idle_in_transaction_session_timeout: the server ends any session
      idle in a transaction for longer than that. It applies on reload.
    - max_connections needs a restart, and more room only delays a leak.

    GOOD PRACTICE
    - Never keep a transaction open while waiting for a person: hold a
      seat with a row and an expiry date, not with a lock.
    - Set idle_in_transaction_session_timeout (and statement_timeout) on
      any server where an app can forget a transaction.
    - The superuser's reserved slots are what let you in during the
      incident: don't give the app the superuser role.

    DOCUMENTATION
    - The connection settings: https://www.postgresql.org/docs/16/runtime-config-connection.html
    - idle_in_transaction_session_timeout: https://www.postgresql.org/docs/16/runtime-config-client.html
    - pg_stat_activity: https://www.postgresql.org/docs/16/monitoring-stats.html
