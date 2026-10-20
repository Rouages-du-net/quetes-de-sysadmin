### Story "The Archives", chapter 2 "The versions": restic.
### Commands, paths, snapshot IDs and restic messages (in English) are
### not translated.

chapitre-versions = The versions
    .resume = A backup that keeps the mistake: find the right version with restic, then free up space without losing it.

## Files

versions-mot-de-rosa =
    A note from Rosa, the librarian:

    "Since January, the collection has lived on this new server, and I back
    it up every night with restic to the disk the town hall lends us
    (/mnt/mairie). The backups are encrypted: the town hall staff can't
    read our archives. The password is in ~/.config/restic/mot-de-passe
    (and on paper, in the safe).

    Disaster: this morning, the transcription of Marie's diary is full of
    absurd mistakes. The intern ran an "automatic correction" script a
    few nights ago. And every night's backup faithfully saved the damaged
    version…

    Two other worries: the town hall says our disk is almost full
    (df -h /mnt/mairie), and I'm no longer sure our repository is in good
    shape.

    Could you:
    1. find the right version of the diary and put it back in its place;
    2. free up space on the disk, without throwing away the right version;
    3. check that the repository is healthy?

    My usual commands are in notes_restic.txt."
versions-notes-restic =
    ROSA'S NOTES — RESTIC

    Every command needs the repository and the password:
      restic -r /mnt/mairie/restic-bibliotheque --password-file ~/.config/restic/mot-de-passe COMMAND

    The commands I've already used:
      snapshots      the list of backups (snapshots)
      ls ID          what a snapshot contains

    The others (dump, find, diff, restore, forget, prune, check…) are in
    man restic. ID: the first 8 characters are enough, or latest.
versions-journal =
    DIARY OF MARIE, SEAMSTRESS (1931-1940) — TRANSCRIPTION

    12 March 1931. The market burned down last night. The market women
    saved what they could; Fatou lost all her fabrics. We sewed until
    morning so that she would have something to sell on Saturday.

    3 June 1936. Strike at the workshop. We sang in the courtyard. The
    boss gave in: two weeks of paid holiday, the first time in my
    life.

    9 September 1939. Ahmed left this morning. I embroidered his name in
    the lining of his jacket, so that he won't forget it, over there.
versions-journal-abime =
    DIARY OF MARIE, SEAMSTRESS (1931-1940) — TRANSCRIPTION

    12 March 1931. The market burnt down last knight. The market woman
    saved what there could; Fatou lost all her fabric's. We sowed until
    mourning so that she would of had something to sell on Saturday.

    3 June 1936. Strike at the work shop. We sung in the courtyard. The
    boss gave in: two week of payed holiday, the first thyme in my
    live.

    9 September 1939. Ahmed leaved this morning. I embroidered his name in
    the lining of his jacket, so that he wont forget it, over their.
versions-recette-ajoutee = Added in January 2027: Fatou's mafé, dictated by her granddaughter.
versions-image-tiff = (TIFF image, raw scan)

## Events

# { $fichier }: the password file
versions-evenement-mot-de-passe =
    The repository is encrypted… but its password is in { $fichier },
    readable by every account on the machine (ls -l). Rosa has an account
    here, and tomorrow maybe one more intern. Who should be able to read it?
versions-evenement-mauvais-mot-de-passe =
    Wrong password: without it, restic can't decrypt anything, not even
    the list of backups. That's on purpose. Losing this password means
    losing all the backups: always keep a copy of it somewhere else
    (Rosa has hers in the safe).
versions-evenement-ailleurs =
    The right version of the diary is back… but not in its place: restic
    recreates the full path under the directory given to --target. You
    still have to put it back in ~/fonds/manuscrits/.
versions-evenement-restaure =
    Marie's diary is back, word for word. That's the whole point of
    having versions: a mirror copy (rsync --delete) would have copied the
    mistake over on the very first night.

    Think about tonight's backup too: as long as no recent snapshot
    contains the right version, keeping it depends on the old ones.
versions-evenement-perdu =
    No snapshot contains the right version of the diary anymore: the
    forget policy removed them all. On a real server, it would be lost
    (unless there's another copy elsewhere). Here, you can restart the
    chapter from the menu. Before deleting, forget --dry-run shows what
    would go.
versions-evenement-oublie-sans-prune =
    forget removed snapshots from the list… but df -h /mnt/mairie doesn't
    budge: forget only deletes the "labels". The data only goes away
    with prune (or forget --prune).
versions-evenement-place =
    The disk can breathe: prune deleted the data that no remaining
    snapshot uses (mostly the raw scans from January). df -h
    /mnt/mairie shows it.
versions-evenement-fin =
    Rosa reads Marie's diary again: "The market burned down last night",
    as in the original notebook. The town hall's disk has room, the
    repository is checked, and the password is no longer within
    everyone's reach.

    Well done! You have finished chapter 2 of The Archives.

    WHAT HAPPENED
    A script damaged a file; every night, the backup kept the damaged
    version. Since restic keeps snapshots, the right version was still
    in those from before 2 February. A mirror would have lost it on the
    very first night.

    GOOD PRACTICE
    - Keep versions, and a clear policy: for example 7 daily, 4 weekly,
      12 monthly (forget --keep-daily 7 --keep-weekly 4
      --keep-monthly 12 --prune). Try it with --dry-run.
    - A mistake can go unnoticed for days: you need versions older than
      the time it takes to notice.
    - forget removes snapshots; only prune gives the space back.
    - restic check regularly, and a real restore from time to time: a
      backup that has never been restored is only a hope.
    - Encrypt backups that sleep at someone else's place, and keep the
      password safe (file in 600, and a copy off the machine).

    ANOTHER WAY
    rsnapshot ("Snapshots", The Game Library): each snapshot is a plain
    directory that you read with ls and copy back with cp, with no tool
    needed to restore; but no encryption, and deduplication by whole
    file only. restic: encrypted, deduplicated by chunks, and a
    repository that can live elsewhere (sftp, object storage).

    DOCUMENTATION
    - Working with repositories: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - Restoring: https://restic.readthedocs.io/en/stable/050_restore.html
    - Removing snapshots: https://restic.readthedocs.io/en/stable/060_forget.html
