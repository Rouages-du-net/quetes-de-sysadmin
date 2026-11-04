### Story "The Theatre", chapter 4 "The Failover": a streaming standby,
### its promotion, the app pointed at it. SQL, paths and the tools'
### outputs are not translated.

chapter-failover = The Failover
    .summary = The database's primary, on another server, is dead since dawn, and every page of the ticket office fails. This machine keeps a replica, up to the last second. Turn it into the primary, and bring the ticket office back.

## Files

failover-message-camille =
    From:     Camille
    To:       you
    Subject:  stage is dead

    Hello,

    Last month, our host's technician moved the database's primary to a
    second server, stage.internal, and set this machine up as a
    "replica" that copies everything in real time. "If stage fails,
    you switch to the replica," he said. He has left since.

    The host writes that stage's disk died at 6:47 this morning, and that
    it won't be back before tomorrow. The ticket office has been showing
    errors ever since, and the evening's show starts at 8 pm.

    Can you switch? The app's settings are in /srv/boxoffice/.env.

    Same sudo password: curtain-2028.

    Camille

## Events

failover-event-down =
    stage.internal (192.0.2.29) doesn't answer: "No route to host". The
    app's DATABASE_URL points at it, and so does this machine's
    PostgreSQL, which waits for it in its log. What is this machine's
    PostgreSQL, then? (man pg_lsclusters)
failover-event-standby =
    online,recovery: this PostgreSQL is a standby. It replays what its
    primary sends (primary_conninfo in postgresql.auto.conf; standby.signal
    in its data directory keeps it in recovery), and refuses every write.
    How far did it get before stage died? (man psql:
    pg_last_xact_replay_timestamp)
failover-event-lag =
    The last transaction replayed is from 06:47:14, one second before
    stage died: almost nothing is lost. A standby can't become the
    primary on its own; someone must decide it (man pg_ctlcluster:
    promote).
failover-event-restarted-standby =
    Restarted, still a standby: standby.signal is still there, and a
    restart doesn't change a role. Promotion does (pg_ctlcluster 16 main
    promote, or SELECT pg_promote()).
failover-event-read-only =
    The app now talks to this machine's PostgreSQL, but it is still a
    standby: "cannot execute INSERT in a read-only transaction". Promote
    it first.
failover-event-promoted =
    Promoted: this PostgreSQL leaves recovery, takes a new timeline, and
    accepts writes. It is the primary now. The app still has to come to
    it.
failover-event-restart-app =
    The .env points at this machine now, but the app reads it when it
    starts: restart it (sudo systemctl restart boxoffice).
failover-event-end =
    The ticket office answers again, on the database of this machine,
    which is now the primary. Camille: "Twelve Angry Jurors tonight: 64
    seats left, and people are booking!"

    Well done! You have finished the chapter "The Failover".

    WHAT HAPPENED
    The primary (stage) died at 06:47:15. The standby here had replayed
    everything up to 06:47:14, but a standby is read-only and waits for
    its primary forever: nothing switches by itself. You promoted it,
    then pointed the app at it and restarted the app.

    THE STEPS OF A FAILOVER
    - Check that the primary is really gone (pg_isready -h, ping): two
      primaries at once is the worst case (split brain).
    - Check how far the standby got: pg_last_xact_replay_timestamp().
    - Promote: pg_ctlcluster 16 main promote, or SELECT pg_promote().
    - Point the clients at the new primary, and restart them.

    AFTERWARDS
    - When stage comes back, it must not start as a primary: rebuild it
      as a standby of the new primary (pg_basebackup), or erase it.
    - Until then, you have no replica any more: plan the next one now.
    - Write the procedure down, and rehearse it: a failover is learnt on a
      calm day, not on the night of a show.

    DOCUMENTATION
    - Failover: https://www.postgresql.org/docs/16/warm-standby-failover.html
    - Recovery control functions: https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-RECOVERY-CONTROL
    - pg_ctlcluster: https://manpages.debian.org/bookworm/postgresql-common/pg_ctlcluster.1.en.html
