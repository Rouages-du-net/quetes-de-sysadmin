### Story "The Pantry", chapter "The Restore Drill": the loss of the
### server staged on a borrowed laptop (spare), with the disk and the
### treasurer's envelope only. cryptsetup open, restic check --read-data,
### restic restore, sha256sum -c, and the database the job forgot.
### Commands, options, paths and outputs are not translated.

chapter-restore-drill = The Restore Drill
    .summary = Saturday morning, the pantry stages the loss of its server: a borrowed laptop, the backup disk, and the treasurer's envelope, nothing else. Open the disk, read the repository down to its data, restore, prove the files are intact, and find out what the backup never contained.

## Files

restore-drill-message-fatou =
    From: Fatou (coordinator)
    Saturday 17 March, 9:45

    Today we pretend crate is gone: burned, stolen, whatever. Noor lent
    us her old laptop, which we're calling spare. Debian is freshly
    installed on it (with cryptsetup and restic), you can reach it from
    crate (ssh spare), and Joaquín has plugged the backup disk into it.

    The rule of the game: on spare, only the disk and what is in Mei's
    envelope. Nothing from crate: in a real disaster, crate's files
    would be ashes. Mei opened the envelope for us:

        Backup disk (LUKS):        { $disk }
        Backups (restic recovery): { $restic }

    (She'll seal a new one afterwards.) The checklist is in drill.txt.

    Fatou

restore-drill-checklist =
    RESTORE DRILL — checklist (Fatou, March 2029)

    1. On spare: find the backup disk, open it with the envelope's
       passphrase, mount it.
    2. Open the repository with the envelope's password; list the
       snapshots.
    3. Check the repository, all of it, data included.
    4. Restore the latest snapshot BESIDE (not over anything), for
       example under /srv/restore.
    5. Prove the files are intact: the job writes their SHA-256 in
       SHA256SUMS before each backup.
    6. Could the app start again from this? It needs its files AND its
       database (the nightly dump, pantry.sql).
    7. Fix what the drill revealed. Close the disk on spare.

## Events

restore-drill-event-log =
    "backup completed", every night. The log says the script reached its
    last line: it doesn't say what was backed up, nor whether it can be
    read back. That's what today is for.
restore-drill-event-plugged =
    There it is, on spare: sdb1, crypto_LUKS. spare has no key file, no
    crypttab, nothing: the passphrase in the envelope is the only way in
    (cryptsetup open).
restore-drill-event-copied-secret =
    That is a secret of crate's (its key file, or the job's restic
    password), copied onto spare. In a real disaster it would have burned
    with crate: the drill proves nothing this way. Delete it from spare
    and use the envelope.
restore-drill-event-opened-key =
    The disk was opened with crate's key file: that's the key that dies
    with crate. Close it, and open it again with Mei's passphrase.
restore-drill-event-opened =
    The disk opens with the envelope's passphrase alone: first half of
    Mei's question, answered for real. spare has no /mnt/offsite: any
    empty directory will do as a mount point (mkdir).
restore-drill-event-mounted =
    Mounted. The repository is in restic/: spare has no
    /root/.restic-pass, so restic will ask for the password (or give -r
    and type the envelope's).
restore-drill-event-nightly-key =
    That's the job's password, from crate: on a real disaster day, you
    wouldn't have it. Use the envelope's.
restore-drill-event-snapshots =
    The repository opens with the envelope's password: second half of
    the question. Before trusting it, check it, down to the data.
restore-drill-event-check-only =
    restic check, without options, checks the repository's structure
    (indexes, snapshots, trees): not the content of the packs. To read
    every byte back from the disk, it's --read-data (man restic).
restore-drill-event-read-data =
    Every pack read back and verified: the data on this disk is whole.
    Now restore the latest snapshot, beside: restore … --target DIRECTORY
    recreates the full path under it.
restore-drill-event-over-root =
    --target / writes the files where they were. On a blank spare it does
    no harm, but on a machine in service it would overwrite today's data
    with last night's. In a drill, restore beside and compare.
restore-drill-event-restored =
    The files are back, under the full path restic recreated. Restored
    is not the same as right: compare them with what the job recorded
    before the backup (SHA256SUMS, sha256sum -c, from their directory).
restore-drill-event-mismatch =
    sha256sum reports a file that doesn't match, or one it can't read.
    Run it from the directory where SHA256SUMS is: the names inside are
    relative.
restore-drill-event-verified =
    Every file matches its SHA-256: the restore is exact. The checklist
    has one more line: the database.
restore-drill-event-no-dump =
    No pantry.sql in any snapshot: the job only backs up /srv/pantry. The
    nightly dump is written on crate, in { $dump }, and nothing ever
    takes it away. Without it, the app would restart empty: no visits,
    no appointments. Fix the job on crate (its restic backup line).
restore-drill-event-fixed =
    The job now backs up the database's dump too: from tonight on, a
    restore brings the app back whole. (The dump is written at 23:30,
    the backup runs at 1:00: the order is right.)
restore-drill-event-closed =
    The disk is unmounted and closed on spare: Joaquín can take it.
restore-drill-event-end =
    Fatou: "So: the envelope opens everything, the files come back
    intact, and we found the hole before the fire. Same drill in six
    months?" Mei is already sealing a new envelope.

    Well done! You finished The Pantry.

    WHAT HAPPENED
    You staged crate's loss on a blank machine with the disk and the
    envelope only: the passphrase opened the disk, the recovery password
    opened the repository, check --read-data read every pack, the latest
    snapshot came back beside, and sha256sum -c proved the files exact.
    The drill also found what no log showed: the database dump was never
    backed up. The job now takes it.

    GOOD PRACTICE
    - A backup you haven't restored is a hope. Drill regularly, on
      another machine, with only what would survive a disaster.
    - "backup completed" proves the script ended, not that the right
      things are in it: list what a restore needs (files, database,
      configuration) and look for each one.
    - restic check --read-data reads every byte back: run it now and
      then (or --read-data-subset on big repositories).
    - Restore beside, then compare (checksums, diff): never over live data.
    - Write down how long the drill took: it's your real recovery time.
    - Database: back up a dump (pg_dump), made before the backup runs.

    DOCUMENTATION
    - restic, restoring: https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, checking: https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
    - sha256sum: https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html
    - PostgreSQL, backup and restore: https://www.postgresql.org/docs/current/backup-dump.html
