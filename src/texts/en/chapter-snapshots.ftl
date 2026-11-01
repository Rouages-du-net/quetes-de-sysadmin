### Story "The Game Library", chapter 2 "Snapshots": rsnapshot, hard
### links, daily and weekly rotation, cron. Commands, paths, directives and
### rsnapshot's messages are not translated.

chapter-snapshots = Snapshots
    .summary = Being able to go back to any day of the last two weeks: rsnapshot, its tabs, its hard links, and cron.

## Files

snapshots-message-berenice =
    A message from Bérénice:

    "After the attack, Malo would like us to be able to go back to any
    day of the last two weeks, without plugging in the USB drive every
    time. He installed rsnapshot; its configuration is still the one
    shipped by Debian (/etc/rsnapshot.conf).

    What we need:
      - back up /srv/share/;
      - on the server's second disk, mounted on /mnt/snapshots
        (not on the system disk!);
      - keep 7 daily snapshots and 4 weekly ones;
      - have it run on its own, every night and every week.

    Malo left a tip: "rsnapshot configtest before anything else, and
    watch out for tabs". For sudo: ludo-2027."
# { $number }: the number of the added game
snapshots-line-inventory = donated game no. { $number };1;new
snapshots-inventory-old =
    game;copies;condition
    snakes and ladders;3;good
    ludo;2;good

## Events

# { $mails }: the number of emails sent by cron
snapshots-two-weeks =
    Two weeks go by. Every day, Bérénice adds the donated games to the
    inventory; every night, cron runs what is scheduled. Look at what is
    now in /mnt/snapshots (and at cron's mail:
    { $mails ->
        [0] no message, everything went well)
        [one] one message; "nothing to copy" is normal for the first days,
            as long as there aren't enough daily snapshots)
       *[other] { $mails } messages; "nothing to copy" is normal for the
            first days, as long as there aren't enough daily snapshots)
    }.
snapshots-event-spaces =
    rsnapshot rejects its configuration: in /etc/rsnapshot.conf, the
    elements of a line are separated by TABS, never by spaces (even if
    they look the same on screen). In nano, the Tab key writes a tab.
snapshots-event-same-disk =
    The snapshots are stored on the system disk, next to the data: if
    that disk fails, everything goes with it. Malo wanted the second
    disk, /mnt/snapshots (snapshot_root).
# { $example }: the beginning of an email from cron
snapshots-event-mails =
    cron sent mail: its jobs wrote errors. For
    example:

    { $example }

    A job in an ordinary account's crontab doesn't have root's
    permissions; one in root's crontab does (sudo crontab -e).
snapshots-event-links =
    The first snapshot takes its full size, the next ones almost nothing:
    files that haven't changed are not copied again, but linked. ls
    -i shows the same inode number for the same file in two snapshots:
    one single file, two names. Yet each snapshot looks complete.
snapshots-event-error-berenice =
    The snapshots are rotating: seven daily ones, and the first weekly.
    And as it happens, Bérénice: "Oops… Last night, I replaced the
    inventory with an old copy lying around on my USB stick: all the
    donated games are gone! Can you put it back as it was the day before
    yesterday?" (Last night's snapshot already has the wrong version:
    look at the earlier ones, diff will help you.)
snapshots-event-wrong-version =
    The inventory on the share is still the old copy: the most recent
    snapshot (.0) was taken AFTER Bérénice's mistake. You need the one
    from the night before.
snapshots-event-end =
    The inventory is back, with all the donated games. Bérénice: "And
    every day of the last two weeks is there, without the disk being
    full!"

    Well done! You have finished chapter 2 of The Game Library. (The next
    one awaits you: ssh games.)

    WHAT HAPPENED
    Every night, rsnapshot rotated the daily snapshots: the old .0
    becomes .1, and so on; the oldest one is deleted. The new .0 is a
    copy of .1 made of hard links, which rsync updates: only modified
    files take up space. Once a week, the oldest daily becomes a weekly.
    To fix Bérénice's mistake, you just had to copy the file back from
    the snapshot taken before the mistake.

    GOOD PRACTICE
    - Snapshots on another disk (and an offline copy as well: a snapshot
      on the same machine doesn't protect against everything).
    - configtest after each change; tabs, not spaces.
    - The rarest level run a little before the most frequent one, in
      root's crontab.
    - Read cron's mail: that's where errors arrive.
    - Practise restoring a file, before you need to.

    ANOTHER WAY
    restic ("Versions", The Archives) or borg: deduplication (a modified
    file only copies its changed chunks), encryption, remote repository
    (sftp, object storage); but you restore with the tool (restic
    restore), not with cp. rsnapshot: plain directories you read with
    ls, but no encryption or fine-grained deduplication, and you need a
    file system that supports hard links.

    DOCUMENTATION
    - rsnapshot: https://rsnapshot.org/rsnapshot/docs/docs.html
    - rsnapshot(1): https://manpages.debian.org/bookworm/rsnapshot/rsnapshot.1.en.html
    - Hard links (ln): https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
