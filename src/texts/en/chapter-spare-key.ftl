### Story "The Pantry", chapter "The Spare Key": the restic repository on
### the encrypted disk has a single key, whose password lives only on the
### server it backs up. restic key list/add, RESTIC_* variables, check.
### Commands, options, paths, variables and outputs are not translated.

chapter-spare-key = The Spare Key
    .summary = The nightly job now backs up to a restic repository on the encrypted disk. The treasurer asks whether her envelope would be enough to read the backups if the server burned: it wouldn't. Give the repository a second key that lives off the server, without breaking the nightly job.

spare-key-script-comment = Nightly backup to the offsite disk (Noor). Opens the disk with the key file, restic, closes.

## Files

spare-key-message-fatou =
    From: Fatou (coordinator)
    Monday 12 March, 8:50

    Good morning!

    The disk came back from Joaquín's this morning; it is plugged in, and
    closed, as it should be. Since last Monday Noor has moved the nightly
    job to restic (the script is /usr/local/sbin/nightly-backup): she
    says it keeps every night's version and only stores what changed.

    On Wednesday, Mei asked me a question I couldn't answer: "If crate
    burned tonight, with what is in my envelope, could we read the
    backups?" Could you check, and fix whatever needs fixing? She left
    you a note.

    Fatou

spare-key-note-mei =
    Note from Mei (treasurer)

    For the disk, I have the passphrase. But Noor tells me the backups
    inside have their own password, and that it is "in a file on the
    server". If the server is gone, so is the file, no?

    In case it helps, I have generated a password for the backups in the
    password manager ("Pantry backups — restic recovery"), and it is in
    the envelope too:

        { $password }

    Delete this note once you've used it.

## Events

spare-key-event-opened =
    The disk is open and mounted. Before touching anything, read how the
    nightly job reaches the repository: the script is in /usr/local/sbin.
spare-key-event-job =
    The job doesn't pass -r or a password: it exports two variables,
    RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE, which restic reads from
    its environment. The password is in /root/.restic-pass. You can do
    the same (export), or give -r and --password-file (-p) on the command
    line. And restic needs root here: the repository belongs to root.
spare-key-event-sudo-env =
    restic doesn't see your variables: sudo starts it with a clean
    environment (env_reset, see man sudoers). Write them after sudo
    (sudo RESTIC_REPOSITORY=… restic …), use sudo -E, or give -r and -p.
spare-key-event-snapshots =
    One snapshot per weeknight: the job works. Now the question Mei asked:
    who can open this repository? Each key is a way in (man restic, the
    key command).
spare-key-event-one-key =
    The key list: what restic's encryption accepts as a way in. Count
    them, and think about where each password lives.
spare-key-event-envelope-fails =
    "wrong password or no key found": Mei's password opens nothing today.
    Her envelope would let her open the disk, then stop at the
    repository's door. That door needs a second key.
spare-key-event-init =
    restic init creates a NEW repository: this one exists already, and
    holds the backups. Keep it: it's a key you're missing, not a repository.
spare-key-event-remove-current =
    restic refuses to remove the key you are using to talk to it: lucky,
    because that's the nightly job's key.
spare-key-event-nightly-broken =
    Careful: no key opens the repository with /root/.restic-pass any
    more. Tonight, the job will fail on "wrong password or no key found".
    The nightly key must stay; Mei's comes in addition to it (restic key
    add, not passwd). Put the job's key back (key add with the content of
    /root/.restic-pass).
spare-key-event-escrowed =
    Two keys now: the job's (its password on crate) and Mei's (its
    password in the password manager and the envelope). Either opens the
    same data: restic encrypts the data with a master key, and each key
    only unlocks that master key. Now check that the repository is sound.
spare-key-event-checked =
    restic check: no errors. The repository is sound, and it opens with
    a password that doesn't live on crate.
spare-key-event-written-down =
    Mei's password is now in a file on crate (or on the disk itself).
    That's the trap you're getting rid of: the password must live
    off this machine. Delete that file.
spare-key-event-note =
    Mei's note is gone: her password lives only in the password manager
    and in the envelope.
spare-key-event-note-early =
    You deleted Mei's note before her key was in the repository: she has
    sent it again (cat the note). Delete it once the key is added.
spare-key-event-closed =
    The disk is unmounted and closed, ready to leave on Friday.
spare-key-event-end =
    Mei: "So with my envelope alone, the disk opens, and the backups
    too? Even if crate is a heap of ashes?" Yes. Fatou: "Then let's try
    it for real, on Saturday."

    Well done! You finished chapter 2 of The Pantry. (What comes next is
    waiting for you: ssh crate.)

    WHAT HAPPENED
    The repository was encrypted, but its only key was a password stored
    on crate, the machine it backs up: if crate died, the backups died
    with it, unreadable. You read how the job reaches the repository
    (RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE), listed the keys, added a
    second one whose password Mei keeps off the server (restic key add),
    checked the repository, and closed the disk.

    GOOD PRACTICE
    - Every secret a restore needs must exist somewhere other than the
      machine being backed up: the disk's passphrase AND the repository's
      password.
    - One key per use: the job's key can be changed or removed without
      touching the recovery key (restic key list, key remove ID).
    - restic key add adds a way in; key passwd replaces the current key:
      the job would lose its own.
    - sudo resets the environment: variables go after sudo, or use -E.
    - restic check after a change; check --read-data from time to time
      reads every pack (slower, but it finds damaged data).
    - A password left in a file "for now" on the server is exactly the
      trap: delete the notes.

    DOCUMENTATION
    - restic, keys and encryption: https://restic.readthedocs.io/en/stable/070_encryption.html
    - restic, environment variables: https://restic.readthedocs.io/en/stable/040_backup.html#environment-variables
    - restic, checking a repository: https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
