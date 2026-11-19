### Story "The Pantry", chapter "The Lost Disk": the backup disk, lost on
### the tram and found again, was not encrypted. LUKS (cryptsetup), a key
### file and a passphrase, /etc/crypttab and /etc/fstab. Commands, options,
### paths, device names and outputs are not translated.

chapter-lost-disk = The Lost Disk
    .summary = The pantry's backup disk spent a weekend in the tram's lost property, unencrypted, with the list of the households it helps. Encrypt it with LUKS, give the nightly job a key file and the treasurer a passphrase, describe it in crypttab and fstab, and put the backup back on it.

## Files

lost-disk-message-fatou =
    From: Fatou (coordinator)
    Monday, 9:02

    Hello, and thank you for coming so fast.

    On Friday evening Joaquín took the backup disk home, as every week
    (the disk that leaves the building, in case of fire). He left his bag
    on the tram. The lost-property office gave it back this morning, the
    disk inside, apparently untouched.

    Apparently. That disk holds a copy of everything: the list of the
    households we help (families.csv), with their notes. If someone had
    plugged it into a laptop, they could have read all of it.

    I want this to never be possible again. Joaquín has plugged the disk
    back into crate (it is mounted on /mnt/offsite, like every week).
    Mei, our treasurer, left you a note.

    Fatou

lost-disk-note-mei =
    Note from Mei (treasurer)

    I keep the association's passwords in our password manager, and a
    paper copy in a sealed envelope at the bank. For the backup disk I
    have generated this passphrase:

        { $passphrase }

    It is already in the password manager ("Backup disk — LUKS") and in
    the envelope. Use it for the disk, as a way in that doesn't depend on
    the server. Then delete this note: it has no business on crate.

lost-disk-last-sync =
    rsync to the offsite disk: Friday 2 March 2029, 18:40, OK.

## Events

lost-disk-event-disk =
    There it is: sdb, a removable disk (RM 1), and its partition sdb1, a
    plain ext4 file system labelled OFFSITE, mounted on /mnt/offsite.
    Anyone can read it on any computer. To encrypt it, it must first be
    free: nothing mounted, nobody using it.
lost-disk-event-system-disk =
    cryptsetup refused: that device is in use. Luckily, because sda is
    crate's own disk, the one the system runs from. Encrypting it would
    have wiped the server. The backup disk is the other one: check with
    lsblk (RM, SIZE, MOUNTPOINTS) before naming a device.
lost-disk-event-in-use =
    cryptsetup won't format a mounted device: unmount it first (umount).
    Don't worry about what is on it: it's last Friday's copy, and the
    originals are on crate, in /srv.
lost-disk-event-unmounted =
    The disk is free. Formatting it with LUKS wipes what it holds and
    writes a header with key slots at its start (man cryptsetup,
    luksFormat). Name the device carefully: the partition sdb1 (or the
    whole disk sdb).
lost-disk-event-lowercase =
    cryptsetup only goes ahead if you type YES, in capital letters:
    anything else, "yes" included, aborts. It's a speed bump on purpose:
    this is the last moment to check the device's name.
lost-disk-event-formatted =
    The device is now LUKS: a header (cryptsetup luksDump shows its key
    slots) and, after it, only encrypted data. Nothing can be mounted
    directly: it must be opened (cryptsetup open DEVICE NAME), which
    creates a clear device, /dev/mapper/NAME. Mind: the file system goes
    on that one.
lost-disk-event-mounted-luks =
    mount doesn't know what to do with crypto_LUKS: the encrypted device
    is never mounted itself. Open it (cryptsetup open DEVICE NAME), then
    mount /dev/mapper/NAME once it carries a file system.
lost-disk-event-mkfs-header =
    mkfs.ext4 wrote over the encrypted partition itself: the LUKS header is
    gone, and the disk is in clear again. The file system goes on the
    opened mapping, /dev/mapper/NAME, never on the device under it. Start
    again with luksFormat.
lost-disk-event-filesystem =
    An ext4 file system lives inside the encrypted device: what you write
    to /dev/mapper/NAME is encrypted on its way to the disk. Now the keys.
    The nightly job can't type a passphrase: it needs a key file (random
    bytes: dd from /dev/urandom), readable only by root, added to a
    second slot (luksAddKey).
lost-disk-event-keyfile-open =
    That key file opens the disk, and someone other than root can read it
    (ls -l: its rights, its owner). A key file is a password: chmod 400,
    owned by root, in a directory only root enters (/root).
lost-disk-event-keyfile-on-disk =
    That key file is on the backup disk itself: a key left in the lock.
    It would leave with the disk, and it can't open what it sits on
    anyway. Keep it on crate, in /root.
lost-disk-event-keyfile =
    The key file opens the disk, and only root can read it: the nightly
    job will be able to open it without anyone typing anything. But if
    crate dies, that key dies with it. The disk must also open with
    something kept elsewhere: Mei's passphrase.
lost-disk-event-own-passphrase =
    That passphrase is in a slot, but it isn't the one Mei keeps: if you
    forget it, nobody else can open the disk. Add hers too (luksAddKey),
    and you can remove yours afterwards (luksRemoveKey).
lost-disk-event-passphrase =
    Mei's passphrase opens the disk: if crate burns, her envelope is
    enough to read the backup on any Linux machine.
lost-disk-event-insecure =
    cryptdisks_start warns about the key file's rights: it should belong
    to root and be readable by nobody else (chmod 400 or 600).
lost-disk-event-crypttab-name =
    That crypttab line names the disk by /dev/sdX: a USB disk's name
    changes with the order disks are plugged in. Use its LUKS UUID
    (UUID=…, see blkid or cryptsetup luksUUID).
lost-disk-event-crypttab-auto =
    That crypttab line would make the boot wait for a disk that is away
    every weekend. A removable disk gets noauto (opened on demand,
    cryptdisks_start) or nofail.
lost-disk-event-crypttab =
    /etc/crypttab describes the disk: its name, its UUID, the key file,
    and noauto. cryptdisks_start NAME opens it with the key file, the way
    the nightly job will. Now /etc/fstab: the old line mounts a label
    that no longer exists.
lost-disk-event-fstab =
    /etc/fstab mounts /dev/mapper/NAME, not at boot (noauto or nofail):
    once the disk is open, mount /mnt/offsite is enough.
lost-disk-event-copied =
    The pantry's files are on the encrypted disk again: this week, at
    least, there is a backup.
lost-disk-event-busy =
    The mapping is still in use: something is mounted on it. Unmount
    first (umount), then close.
lost-disk-event-closed =
    The disk is closed: without a key, it is nothing but noise. Joaquín
    can take it on Friday.
lost-disk-event-note =
    Mei's note is gone from crate: the passphrase lives only where it
    should, in the password manager and in the envelope.
lost-disk-event-note-early =
    You deleted Mei's note before her passphrase was in a slot: she has
    just sent it again (cat the note). Delete it once the disk opens with it.
lost-disk-event-end =
    Fatou: "So if the bag is lost again, whoever finds it gets a brick?
    And if crate dies, Mei's envelope opens it? Perfect."

    Well done! You finished chapter 1 of The Pantry. (What comes next is
    waiting for you: ssh crate.)

    WHAT HAPPENED
    The backup disk travelled in clear. You unmounted it, encrypted it
    with LUKS (cryptsetup luksFormat, after a YES in capitals), opened it
    and made the file system on the mapping (/dev/mapper/NAME), gave it
    two keys: a key file only root reads, for the nightly job, and Mei's
    passphrase, kept off the server. crypttab and fstab describe it, the
    files are back on it, and it leaves the building closed.

    GOOD PRACTICE
    - Any disk that leaves the building is encrypted: a lost backup must
      be a lost object, not a data leak.
    - Check the device twice before luksFormat (lsblk: RM, SIZE, the model).
    - Never a single key: an automatic one (a key file, root only) and a
      human one kept elsewhere (password manager, sealed envelope).
    - A key file is never stored on the disk it opens, and never readable
      by anyone but root.
    - crypttab and fstab: the UUID rather than /dev/sdX, noauto or nofail
      for a removable disk, so the boot doesn't wait for it.
    - Back up the LUKS header too (cryptsetup luksHeaderBackup): a damaged
      header makes every key useless.
    - Encrypted is not backed up: copy the files back, and test opening it
      with each key.

    DOCUMENTATION
    - cryptsetup: https://man7.org/linux/man-pages/man8/cryptsetup.8.html
    - crypttab: https://man7.org/linux/man-pages/man5/crypttab.5.html
    - cryptsetup FAQ: https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions
    - Debian's crypttab and cryptdisks: https://cryptsetup-team.pages.debian.net/cryptsetup/README.Debian.html
