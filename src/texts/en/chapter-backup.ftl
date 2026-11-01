### Story "The Eraser", chapter 4 "The Backup": rsync and cron.
### Commands, system paths and the output of rsync and cron are not
### translated; place and file names (memories, /mnt/backup,
### note_from_maelle.txt…) come from names.ftl.

chapter-backup = The Backup
    .summary = Never again: back up with rsync, every night with cron, and know how to restore.

## Files

backup-word-maelle =
    A note from Maëlle, the keeper of the Lighthouse:

    "Since the Eraser stopped, the kingdom has got its memories back
    (they're in ~/memories). But I'm still afraid: what if something
    erased them again?

    Someone plugged in a backup disk for me, mounted on /mnt/backup.
    Could you:

    1. copy the memories to /mnt/backup/memories;
    2. make sure this copy is redone ALL BY ITSELF, every night;
    3. and show me that we know how to get them back, the day we need to?

    I was told about rsync and cron. You'll find everything in man rsync
    and man crontab."
backup-memory-first-letter =
    The first letter that reached the Harbour after the light came back. It
    begins: "Dear Maëlle, we saw the Lighthouse from out at sea…"
backup-memory-lighthouse =
    The evening the Lighthouse was lit again: a beam sweeping the sea, and
    Captain Ana hoisting the sail.
backup-memory-village =
    The Village celebrating: the sourdough saved, the clock running again,
    the school found again.
backup-memory-nour =
    Nour, found in the Tunnel, laughing as she eats cheese.
backup-memory-eraser =
    The Eraser finally emptying the Bin, as on the first day, and
    nothing else.
backup-memory-lighthouse-festival =
    The Lighthouse festival, today: the whole kingdom on the Pier, and
    paper lanterns all the way up to the Lantern.

## The night (cron)

# { $file }: the memory that arrived during the day
backup-night-start =
    Evening falls on the kingdom. During the day, a new memory
    arrived: ~/memories/{ $file }.

    The night goes by. Between midnight and 6 am, cron wakes up and runs
    what your crontab asks of it…
backup-night-still =
    Another night goes by. Between midnight and 6 am, cron runs what your
    crontab asks of it…
backup-night-ok =
    In the morning, the backup is up to date: { $file } is there,
    without you typing anything. That's an automatic backup.
backup-morning =
    But Maëlle arrives, distraught: "I wanted to tidy up… and I deleted
    ~/memories/{ $file }!" On Linux, rm doesn't go through a trash
    can. Luckily, you have a backup. Restore this memory.
backup-night-nothing =
    In the morning, nothing has changed: none of your crontab's jobs fell
    during the night, between midnight and 6 am. Read the five time fields
    again (man crontab): minute, hour, day of month, month, day of week.
# { $mail }: what the jobs wrote
backup-night-mail =
    In the morning, the backup isn't up to date. Cron left you this mail,
    with what your job wrote:

    { $mail }
backup-night-failure =
    In the morning, the backup isn't up to date: your job ran, but it
    didn't copy the memories to the right place. Check the command by
    hand, with rsync -n to try without touching anything.

## Events

# { $backup }: the backup directory
backup-event-nested =
    Look closely: you now have { $backup }/memories, a memories
    directory INSIDE the memories directory. For rsync, the source's
    trailing slash matters: "memories/" means "the contents of
    memories", "memories" means "the directory itself". This extra
    directory doesn't get in the way, but aim right from now on: rsync -a
    ~/memories/ followed by the destination.
backup-event-copy =
    The memories are copied to the backup disk. But a backup you have to
    remember to do by hand always ends up forgotten. Ask cron to redo it
    every night: crontab -e.
# { $file }: the deleted memory
backup-event-lost =
    { $file } has disappeared… from the backup too! With --delete,
    rsync copied the deletion: a mirror reproduces mistakes like
    everything else. That's why you keep several versions (rsnapshot,
    restic: that's for later). Here, restart the chapter to try again.
backup-event-end =
    The memory is back. Maëlle: "So that's a real backup: a copy
    somewhere else, redone on its own, that we've already managed to
    restore."

    Well done! You have finished chapter 4 of The Eraser.

    WHAT HAPPENED
    rsync copied the memories to another disk; cron redoes the copy
    every night; and in the morning, the backup was used, for real.

    GOOD PRACTICE
    - The trailing slash matters: rsync -a source/ destination/.
    - Try first with -n (--dry-run), especially with --delete.
    - A manual backup gets forgotten: schedule it (cron).
    - A backup that has never been restored isn't a backup: test the
      restore.
    - The 3-2-1 rule: three copies, on two media, one of them elsewhere;
      and several versions, because a mirror (--delete) also copies
      mistakes.

    ANOTHER WAY
    A systemd timer instead of cron: the result in journalctl, a missed
    run caught up at boot (Persistent=true). And rsync keeps a mirror: a
    deleted or damaged file will be deleted or damaged in the copy too on
    the next run. To keep several days, rsnapshot or restic (The
    Archives, The Game Library).

    DOCUMENTATION
    - rsync: https://download.samba.org/pub/rsync/rsync.1
    - crontab: https://manpages.debian.org/bookworm/cron/crontab.5.en.html
