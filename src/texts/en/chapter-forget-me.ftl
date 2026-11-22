### Story "The Choir", chapter "Forget Me": a leaving member asks to be
### erased (GDPR article 17); the accounting records stay; then a purge
### that really runs (a systemd timer) and backups that age out (restic
### forget --prune). Commands, options, paths and outputs are not translated.

chapter-forget-me = Forget Me
    .summary = A tenor leaves the choir and asks to be forgotten. Erase him where the law lets you, keep what the law asks you to keep, then make the policy happen on its own: a nightly purge that really runs, and backups that don't remember forever.

## Files

forget-me-message-kenji =
    From: Kenji (treasurer)
    Monday 7 April, 9:30

    Good morning,

    Tomas Novak left us on Saturday, and he asks us to erase his data (his
    message is in your home directory). Fair enough. One thing, though,
    from the treasurer: his subscriptions are in our accounts, and the
    accounts must be kept for ten years. The policy says so too. Please
    don't make my books lie.

    While you're at it, Amara wonders whether the policy's "2 years after
    leaving" ever happened. Ruben wrote a purge script for it, I think, and
    the weekly backup has run since 2029. Does a backup forget anything?

    Kenji

forget-me-message-tomas =
    From: Tomas Novak
    To: the board of the Riverside Community Choir
    Sunday 6 April

    Hello,

    As you know, I've moved to Lisbon for work. It was a joy to sing with
    you for these years.

    I would like you to erase my personal data (article 17 of the GDPR):
    my profile, my photo, my attendance, the newsletter. I know you may
    have to keep some things for the accounts; just tell me what.

    Thank you all, and good luck for the spring concert!
    Tomas

## Events

forget-me-event-found =
    That's Tomas, member 41. He is in more than one table: the members
    table, the attendance, the subscriptions, the newsletter (by his
    email). Which ones does erasure reach, and which one does the law ask
    you to keep?
forget-me-event-payments-deleted =
    His subscriptions are gone from the payments table: those are the
    choir's accounting records, which the policy (and the law) keep for ten
    years. Erasure doesn't apply to data you are obliged to keep (GDPR,
    article 17(3)). Put them back: last night's dump has them
    (grep SUB-20 /var/backups/choir.sql | grep 041), and INSERT INTO
    payments VALUES (…) takes them back, one row per subscription.
forget-me-event-erased =
    Tomas is gone from members, attendance and the newsletter, and his
    subscriptions stay in the books with his name: that's what Kenji will
    write to him. What else holds his data on disk?
forget-me-event-uploads =
    His photo and consent form are gone from the uploads.
forget-me-event-purge-broken =
    Ruben's purge has never run: its timer was never enabled, and its
    service runs as www-data, which has no role in PostgreSQL ("role
    "www-data" does not exist"). And its script says "TODO attendance". Fix
    the service, the script and the timer (man systemd.timer,
    systemctl enable --now), or schedule the job another way.
forget-me-event-purge-too-much =
    Careful: the purge, as it will run tonight, would delete data the
    policy keeps (current members, people who left less than two years ago,
    recent attendance, the payments or the newsletter). Check its WHERE
    clauses before letting a timer run them every night.
forget-me-event-purge-partial =
    The purge, as it will run, does half the job: the policy also limits
    rehearsal attendance to two years, and former members' records to two
    years after they leave. Both lines belong in the job.
forget-me-event-purge-idle =
    A purge job is scheduled, but run as it will run, it deletes nothing:
    look at what it says when it runs (systemctl start, then journalctl -u),
    under which account it runs, and whether that account can reach the
    database.
forget-me-event-purge =
    Tonight, and every night, the purge will delete the former members who
    left more than two years ago and the attendance older than two years,
    and nothing else. Now the backups: what do they still hold?
forget-me-event-snapshots =
    { $count } weekly snapshots, back to September 2029: the backup has never
    forgotten anything. Everything erased today, and everything the purge
    deletes, lives on in them for ever. The policy says three months of
    weekly backups (man restic: forget, --keep-weekly, --keep-within,
    --prune).
forget-me-event-too-few =
    Too few backups are left: the policy says three months of weekly
    backups, so a bad backup tonight can still be recovered from an older
    one. Snapshots forgotten and pruned don't come back: on a real server
    they would be lost; here, restart the chapter (or use the rescue
    snapshot) and choose a policy that keeps about three months.
forget-me-event-no-prune =
    The old snapshots are forgotten, but their data is still in the
    repository: forget only removes the snapshots, prune deletes the data
    no snapshot uses any more (or forget --prune).
forget-me-event-trimmed =
    The repository now holds about three months of weekly backups, pruned.
    Next Sunday, the backup adds one more: will anything make the oldest
    one go?
forget-me-event-script-unchanged =
    You trimmed the repository by hand, but the weekly backup script doesn't
    forget anything: in a year, there will be fifty more snapshots. The
    policy belongs in the script (/usr/local/sbin/choir-backup), after the
    backup.
forget-me-event-script =
    The weekly backup now forgets what is older than about three months,
    and prunes: erased data leaves the backups on a known schedule.
forget-me-event-end =
    Kenji: "My books are intact, Tomas has his answer, and Amara says the
    policy finally runs by itself. I'll sleep better."

    Well done! You finished Forget Me.

    WHAT HAPPENED
    Tomas asked to be erased. You deleted his record, his attendance, his
    newsletter subscription and his uploads, and kept his subscriptions,
    which are accounting records the choir must keep. Then you made the
    policy run by itself: Ruben's purge had never run (a timer never
    enabled, an account without a database role, the attendance
    forgotten), and the weekly backup kept everything since 2029. The purge
    now runs every night, and the backups keep about three months, pruned.

    GOOD PRACTICE
    - The right to erasure (GDPR, article 17) has limits: data you are
      legally obliged to keep (accounting records) stays, and the answer
      tells the person what and why.
    - Erase everywhere the person is: every table that points to them, the
      files, then the copies.
    - A purge that isn't scheduled is a wish. Test it the way it will run
      (its account, its timer: systemctl start, journalctl -u), and check
      it deletes what the policy says, and nothing else.
    - Backups can't be edited one person at a time: they must age out on a
      known schedule (restic forget with a policy, and prune), and if one is
      ever restored, the erasures must be applied again.
    - Keep the record of the request itself (who, when, what was done), not
      the data it erased.

    ANOTHER WAY
    Pseudonymising instead of deleting (replacing the name with an
    identifier) keeps statistics, but pseudonymised data is still personal
    data under the GDPR (recital 26): it only counts as anonymous when
    nobody can link it back to the person.

    DOCUMENTATION
    - GDPR, articles 5, 17 and recital 26: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - The CNIL: https://www.cnil.fr/
    - systemd.timer(5): https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - restic, removing snapshots: https://restic.readthedocs.io/en/stable/060_forget.html
