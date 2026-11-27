### Story "The Old Sun", chapter "Trust, Then Switch": point the catalogue at
### the new server, and keep the old one frozen. Commands, paths and
### settings are not translated.

chapter-switch-over = Trust, Then Switch
    .summary = Check both databases agree, point the catalogue at greenhouse, and keep the old one frozen rather than erased, until the new one has proved itself.

## Files

switch-over-email-inaya =
    From:  Inaya
    To:    you

    The lending desk reopens tomorrow. My nephew opened greenhouse's
    PostgreSQL to herbarium (listen_addresses and pg_hba.conf, he says).
    The catalogue's settings are in /etc/opt/seed-catalogue/catalogue.ini.

    Odette asks one thing: "don't throw the old one away straight away".

    Inaya

switch-over-migration =
    # Moving the catalogue off herbarium

    ## Done
    - Snapshot: data/postgres@before-migration.
    - Dump (LATIN1) restored on greenhouse (UTF8), accents checked.

    ## Still to do
    - Check: the same counts on both sides.
    - Point the catalogue at greenhouse, and start it again.
    - The old database: keep it, but make sure nothing writes to it.

## Events

switch-over-event-counted =
    Counted on greenhouse. The same query on herbarium should give the same
    numbers: that's the proof, before anyone writes to the new one.
switch-over-event-still-old =
    The catalogue is running again… but still on herbarium's database
    (db_host = localhost): new lendings would go to the old box. Change
    catalogue.ini, then restart it (svcadm restart).
switch-over-event-online =
    The catalogue is online, and writes to greenhouse.
switch-over-event-frozen =
    The old database can no longer be written to: if anything still points
    at it, it will fail loudly rather than quietly fill the wrong base.
switch-over-event-not-kept =
    Careful: the old data or its snapshot are gone. Until the new server
    has proved itself (a few weeks of use, a restored backup), the old box
    is the way back.
switch-over-event-uncounted =
    The catalogue now writes to greenhouse, and the old base is frozen. But
    nobody has checked that greenhouse holds every row: count them there
    (SELECT count(*)), the proof Inaya needs before the desk reopens.
switch-over-event-end =
    Inaya: "First lending on the new server: Bean 'Mère Hélène', to Zoë. And
    the Sun is still in the cupboard, quiet, just in case."

    Well done! You have finished the chapter "Trust, Then Switch" and the
    story "The Old Sun".

    WHAT HAPPENED
    You checked that both databases agree, pointed the catalogue at
    greenhouse and restarted it, and froze the old database without
    erasing it. If something goes wrong in the coming weeks, the way back
    is still there: herbarium's data, its ZFS snapshot, and Odette's
    notes.

    GOOD PRACTICE
    - Check before switching: counts on both sides, a few rows by hand.
    - Switch in one place (the application's configuration), then restart
      what reads it.
    - Freeze the old system rather than erase it: read-only
      (default_transaction_read_only) or stopped, but kept.
    - Decide in advance when the old box will really go: after the new
      one's first restored backup, for instance.

    ANOTHER WAY
    A DNS name for the database (db.seeds.internal) would let you switch
    by changing one record, without touching the application. For a
    service that can't stop, logical replication copies the changes
    continuously until the switch.

    DOCUMENTATION
    - default_transaction_read_only: https://www.postgresql.org/docs/16/runtime-config-client.html
    - svcadm(1M): https://docs.oracle.com/cd/E26505_01/html/816-5166/svcadm-1m.html
