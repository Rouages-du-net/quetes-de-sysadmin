### Story "The Dance Troupe", chapter "The Offsite Copy": the nightly rclone
### backup to Garage fails since a power cut. The clock (Garage's 24-hour
### limit), the S3 region, a key without write, rclone sync made safe with
### --backup-dir, rclone check, a file restored. Commands, options, paths and
### outputs are not translated.

chapter-offsite-copy = The Offsite Copy
    .summary = Every night the office share is copied to the troupe's object store, and every night since the power cut it has failed. Find out why, one error after the other, make the copy safe, and bring back the treasurer's report from the last good copy.

## Files

offsite-copy-message-linh =
    From: Linh
    Monday 12 April, 8:50

    Hi! Bad news: the office backup hasn't worked since the power cut on
    Saturday 3 April. I only noticed yesterday.

    I tried a few things on Sunday, sorry if I made it worse:
    - a forum said "Date is too old" was about the region, so I put
      region = us-east-1 in /etc/rclone/office.conf, like in their example;
    - and I took write away from the key office-backup on the backups
      bucket (sudo garage bucket deny --write…), so that nothing can erase
      our backups while it's broken.

    The script is /usr/local/bin/office-backup, started every night by
    office-backup.timer. Anahera has a problem too, see her message.

    Linh

offsite-copy-message-anahera =
    From: Anahera (treasurer)
    Saturday 10 April

    I did something silly: I saved the empty template over our arts
    council report, /srv/office/grants/arts-council-report-2031.txt, and
    it's due on Thursday. The office backup must have the right one, from
    before the power cut. Can you get it back? Please don't lose the new
    files either (the gala's running order, the new joiners).

    Anahera

offsite-copy-notes-teodora =
    Notes from Teodora (wings, the office backup)

    - /usr/local/bin/office-backup runs rclone sync from /srv/office to
      garage:backups/office. sync makes the destination the same as the
      source: it copies what changed, and deletes what is no longer in the
      source. Its configuration: /etc/rclone/office.conf (sudo).
    - The timer starts office-backup.service every night at 2:30; its
      output goes to the journal: journalctl -u office-backup.
    - To look at the copy: sudo rclone --config /etc/rclone/office.conf
      ls garage:backups/office (or lsl, with the dates).
    - Garage checks the date of every request, and its region is called
      "garage" (s3_region in /etc/garage.toml).
    - To do: a dry run before changing the script (rclone's -n), and an
      rclone check once in a while.

## Events

offsite-copy-event-failing =
    Garage refuses the backup's requests: "Date is too old". Every S3
    request carries the date it was signed at, from the machine's own clock.
    Garage refuses a request dated more than 24 hours before its own clock
    (Amazon S3 allows 15 minutes: RequestTimeTooSkewed). What time does
    wings think it is?

offsite-copy-event-clock =
    The clock is right again: wings follows NTP. Garage will now accept the
    requests' dates; try the backup again (without changing anything else
    yet) and read the next error.

offsite-copy-event-region =
    The region is back to Garage's, "garage". The region is part of the
    signature's scope (date/region/s3/aws4_request): with another region,
    Garage answers AuthorizationHeaderMalformed and names the scope it
    expected.

offsite-copy-event-insecure =
    Turning off certificate checks doesn't help here: the errors come from
    Garage, which answered, over a TLS connection that worked. And it lets
    anyone between wings and vault pretend to be the store and read the
    backups. Leave the certificate checks on.

offsite-copy-event-write =
    office-backup can write to backups again. Garage's permissions are read,
    write and owner, per bucket: there is no "write but never delete", so
    taking write away only stops the backup. What protects old copies from a
    bad sync is keeping what it replaces and deletes.

offsite-copy-event-wrong-way =
    Some of the share's new files are gone: a sync makes its destination the
    same as its source, and here the destination was /srv/office. The bucket
    only had the copy of 2 April, so the files written since were deleted
    on wings. On a real server they would be lost; here, restart the chapter
    (or use the rescue snapshot), and run a sync with --dry-run first.

offsite-copy-event-overwritten =
    The good report is gone everywhere: the sync replaced the bucket's copy
    with the template, and nothing kept the old one. On a real server it
    would be lost; here, restart the chapter (or use the rescue snapshot).
    Before syncing, restore the report, or tell rclone where to keep what
    it replaces (rclone's manual: --backup-dir).

offsite-copy-event-restored =
    The report is back in /srv/office with its 2031 figures: Anahera can
    send it.

offsite-copy-event-safe =
    The script now keeps what it would destroy: with --backup-dir, every
    file sync replaces or deletes in garage:backups/office is moved to that
    folder instead. A dated folder keeps each night's changes apart.

offsite-copy-event-dry-run =
    A dry run: rclone says what it would copy, replace and delete, and
    touches nothing. Read the deletions twice before running it for real.

offsite-copy-event-synced =
    The bucket's office/ is the same as the share again, new files included.

offsite-copy-event-checked =
    rclone check compared both sides file by file (sizes and MD5s): no
    differences.

offsite-copy-event-end =
    Linh: "The backup is green again, and Anahera has sent her report.
    I'll leave the keys alone next time!"

    Well done! You finished The Offsite Copy.

    WHAT HAPPENED
    After the power cut, wings' clock was three days behind and NTP was
    off. Every S3 request is signed with its date: Garage refuses one dated
    more than 24 hours before its own clock ("Date is too old"), and the
    nightly rclone sync had failed ever since. Then two well-meant changes
    added their own errors: a region that isn't Garage's (the signature's
    scope didn't match) and a key without write (AccessDenied). You fixed
    the clock, the region and the key, brought back the report from the
    last good copy, and made the sync keep what it replaces or deletes.

    GOOD PRACTICE
    - Read the error, fix one cause at a time, try again: each fix showed
      the next error.
    - Keep clocks synchronised (NTP): signatures, certificates and logs
      all depend on it.
    - rclone sync deletes: run it with --dry-run first, check the
      direction (source, then destination), and give it --backup-dir on
      the same bucket, outside the destination, so that a mistake can be
      undone.
    - rclone check after a backup, and a restore from time to time: a copy
      nobody has read is a hope, not a backup.
    - A failed nightly job must be seen: a timer's failure in the journal
      helps no one if nobody looks (OnFailure= with a notification, or
      monitoring).

    ANOTHER WAY
    Garage has no versioning and no object lock, so the bucket can't keep
    old versions itself. A lifecycle rule (Garage supports Expiration) can
    clean the --backup-dir folders after a few months. For history and
    deduplication, restic or Borg can store encrypted snapshots in a
    bucket; since no Garage key can write without deleting, keep a second
    copy somewhere the backup's key can't reach.

    DOCUMENTATION
    - rclone sync: https://rclone.org/commands/rclone_sync/
    - --backup-dir: https://rclone.org/docs/#backup-dir-dir
    - rclone check: https://rclone.org/commands/rclone_check/
    - rclone and S3: https://rclone.org/s3/
    - Garage with rclone and the AWS CLI: https://garagehq.deuxfleurs.fr/documentation/connect/cli/
    - Garage's lifecycle rules: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
