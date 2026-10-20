### Story "The Game Library", chapter 2 "Snapshots": rsnapshot, hard
### links, daily and weekly rotation, cron. Commands, paths, directives and
### rsnapshot's messages are not translated.

chapitre-instantanes = Snapshots
    .resume = Being able to go back to any day of the last two weeks: rsnapshot, its tabs, its hard links, and cron.

## Files

instantanes-message-de-berenice =
    A message from Bérénice:

    "After the attack, Malo would like us to be able to go back to any
    day of the last two weeks, without plugging in the USB drive every
    time. He installed rsnapshot; its configuration is still the one
    shipped by Debian (/etc/rsnapshot.conf).

    What we need:
      - back up /srv/partage/;
      - on the server's second disk, mounted on /mnt/instantanes
        (not on the system disk!);
      - keep 7 daily snapshots and 4 weekly ones;
      - have it run on its own, every night and every week.

    Malo left a tip: "rsnapshot configtest before anything else, and
    watch out for tabs". For sudo: ludo-2027."
# { $numero }: the number of the added game
instantanes-ligne-inventaire = donated game no. { $numero };1;new
instantanes-inventaire-ancien =
    game;copies;condition
    snakes and ladders;3;good
    ludo;2;good

## Events

# { $mails }: the number of emails sent by cron
instantanes-deux-semaines =
    Two weeks go by. Every day, Bérénice adds the donated games to the
    inventory; every night, cron runs what is scheduled. Look at what is
    now in /mnt/instantanes (and at cron's mail:
    { $mails ->
        [0] no message, everything went well)
        [one] one message; "nothing to copy" is normal for the first days,
            as long as there aren't enough daily snapshots)
       *[other] { $mails } messages; "nothing to copy" is normal for the
            first days, as long as there aren't enough daily snapshots)
    }.
instantanes-evenement-espaces =
    rsnapshot rejects its configuration: in /etc/rsnapshot.conf, the
    elements of a line are separated by TABS, never by spaces (even if
    they look the same on screen). In nano, the Tab key writes a tab.
instantanes-evenement-meme-disque =
    The snapshots are stored on the system disk, next to the data: if
    that disk fails, everything goes with it. Malo wanted the second
    disk, /mnt/instantanes (snapshot_root).
# { $exemple }: the beginning of an email from cron
instantanes-evenement-mails =
    cron sent mail: its jobs wrote errors. For
    example:

    { $exemple }

    A job in an ordinary account's crontab doesn't have root's
    permissions; one in root's crontab does (sudo crontab -e).
instantanes-evenement-liens =
    The first snapshot takes its full size, the next ones almost nothing:
    files that haven't changed are not copied again, but linked. ls
    -i shows the same inode number for the same file in two snapshots:
    one single file, two names. Yet each snapshot looks complete.
instantanes-evenement-erreur-berenice =
    The snapshots are rotating: seven daily ones, and the first weekly.
    And as it happens, Bérénice: "Oops… Last night, I replaced the
    inventory with an old copy lying around on my USB stick: all the
    donated games are gone! Can you put it back as it was the day before
    yesterday?" (Last night's snapshot already has the wrong version:
    look at the earlier ones, diff will help you.)
instantanes-evenement-mauvaise-version =
    The inventory on the share is still the old copy: the most recent
    snapshot (.0) was taken AFTER Bérénice's mistake. You need the one
    from the night before.
instantanes-evenement-fin =
    The inventory is back, with all the donated games. Bérénice: "And
    every day of the last two weeks is there, without the disk being
    full!"

    Well done! You have finished chapter 2 of The Game Library. (The next
    one awaits you: ssh ludotheque.)

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
