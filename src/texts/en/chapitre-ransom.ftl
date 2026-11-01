### Story "The Game Library", chapter 1 "The ransom": ransomware,
### stopping it, finding an offline backup and restoring. The
### commands, paths and messages of ps, mount, restic, crontab are not
### translated. The addresses and the wallet are fictitious.

chapter-ransom = The ransom
    .resume = Monday morning, all the game library's files are encrypted: stop the attack, understand why the NAS copy is useless, and restore from the offline disk.

## Files

ransom-message-berenice =
    A message from Bérénice, chair of the game library:

    "Disaster! This morning, not a single file on the share (/srv/share)
    will open: they all end in .locked, and a message is demanding
    money. We won't pay.

    We have a copy of everything on the NAS, every night (/mnt/nas). And Malo
    makes a backup every Sunday on the USB disk in the drawer,
    which he unplugs afterwards (it's plugged into the server this morning, but
    not mounted). The password for that backup is in the safe:
      pawn-knight-rook-27

    I'll leave it to you. For sudo: ludo-2027."
ransom-note =
    YOUR FILES ARE ENCRYPTED.
    To recover them, send 0.5 bitcoin to the address
    bc1q-exemple-adresse-fictive within 72 hours.
    After that, your files will be lost.
ransom-crontab-root = Copy of the share to the NAS, every night at 2:30
ransom-inventory =
    game;copies;condition
    snakes and ladders;3;good
    ludo;2;good
    draughts;4;one piece missing
    mikado;2;good
    dominoes;5;good
    animal memory;2;good
ransom-schedule =
    June opening hours
    Wednesday 2pm - 6pm: two volunteers
    Saturday 10am - 12pm: one volunteer and the game rules workshop
    Saturday 2pm - 6pm: three volunteers (games festival on the 26th)
ransom-shows =
    GAMES FESTIVAL — Saturday 26 June, market square
    Wooden games, draughts tournament, toddlers' corner.
    Free, open to everyone.
ransom-rules-goose =
    The game of the goose
    Each player rolls two dice and moves forward that many squares.
    A goose: move forward the same number again. The well: wait
    until another player comes to free you. First to square 63:
    wins (you must land on it exactly).
ransom-rules-horses =
    Ludo
    You need a 6 to bring a horse out of the stable. You go round the
    board, then climb the stairs to the centre. Rolling a 6 gives
    another throw.
ransom-rules-ladies =
    Draughts
    Pieces move diagonally, forwards. You capture by jumping over
    an opponent's piece; capturing is compulsory. A piece that reaches the
    last row becomes a king.

## Events

ransom-event-extent =
    Everything is encrypted, and a ransom demand waits in every directory.
    We don't pay: nothing guarantees we'll get anything back, and
    it funds the next attack. Before restoring anything, you
    need to know whether the attack is over: is a program still running
    (ps aux)? And last night's log (journalctl) may tell you how it
    got in.
ransom-event-encryptor-seen =
    A program hidden in /home/accueil/.cache, running under the accueil
    account and eating all the CPU: that's the encryptor. You have to
    stop it (it belongs to another account: man kill, and sudo). Then
    look for whatever could restart it.
ransom-event-nas =
    On the NAS too, everything is .locked: last night at 2:30, the
    automatic copy (rsync --delete, in root's crontab) faithfully
    copied the encrypted files, and deleted the good ones. A
    synchronised copy, always plugged in, is not a backup: it
    copies the damage too. That leaves the disk in the drawer (lsblk).
ransom-event-reencrypted =
    Some restored files have just been encrypted in turn: the
    encryptor is still running. You don't put out a fire by moving the
    furniture back into the house: first stop it, then restore.
ransom-event-key-too-early =
    Careful: the backup disk is plugged in while the encryptor is
    still running. This time, it isn't allowed to write to it (its files
    belong to root), but with another account, the last
    backup could have gone too. Stop the attack first, and mount
    a backup read-only (mount -o ro).
# The encryptor restarted by the accueil account's crontab
ransom-return =
    The encryptor is back (ps aux)! Something restarts it at
    regular intervals. Where are an account's scheduled tasks kept?
    (man crontab)
ransom-event-restored =
    The six files are back, in their Sunday evening version: whatever
    changed since then (almost nothing, this time) is lost. Now
    clean up the .locked files and the ransom notes, and take the backup
    disk offline again.
ransom-event-end =
    The share is clean, the attack stopped, the culprit account locked,
    and the backup offline again. Bérénice: "And not a penny
    paid. Malo was right to unplug that disk every Sunday."

    Well done! You've finished chapter 1 of The Game Library. (The rest awaits you:
    ssh games.)

    WHAT HAPPENED
    The accueil account's password was guessed (journalctl: three
    failures then a login, at 3 in the morning). A program encrypted everything
    that account could modify, and installed itself in its crontab
    to come back. The nightly copy to the NAS, always plugged in, copied
    the damage. Only the offline, unplugged backup survived.

    GOOD PRACTICE
    - Don't pay; report the attack (cybermalveillance.gouv.fr in France).
    - First stop the attack: the process, whatever restarts it
      (crontab, services), the account used (locked, password
      changed).
    - Only then restore, from a backup mounted read-only;
      check; then take it offline again.
    - The 3-2-1 rule: at least one offline or immutable copy. A
      synchronisation (rsync --delete) is not a backup.
    - Long passwords, no SSH password logins
      from the internet, and fail2ban.

    DOCUMENTATION
    - ANSSI guide (in French): https://cyber.gouv.fr/publications/attaques-par-rancongiciels-tous-concernes
    - CISA guide: https://www.cisa.gov/stopransomware/ransomware-guide
    - Restoring with restic: https://restic.readthedocs.io/en/stable/050_restore.html
    - mount: https://man7.org/linux/man-pages/man8/mount.8.html
