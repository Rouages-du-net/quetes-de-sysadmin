### Story "The Health Centre", chapter "The Cold Start": after a power
### cut, the accounting VM didn't come back; started by hand, it pauses on a
### full /var: a chain of forgotten external snapshots. virsh list, dominfo,
### domstate, domblkerror, qemu-img info, blockcommit, snapshot-delete,
### autostart. Commands, options, paths and outputs are not translated.

chapter-cold-start = The Cold Start
    .summary = Saturday night a storm cut the power in the valley. On Monday the reception's appointment book is back, but the accounting server isn't, and Priya has the payroll to send. Find out why one virtual machine stayed down, why it freezes as soon as it starts, and make room on the hypervisor without losing a year of accounts.

## Files

cold-start-message-grace =
    From: Grace (practice manager)
    Monday 11 March, 8:05

    Good morning, and welcome to Millbrook Health Centre!

    The storm on Saturday night cut the power for three hours, longer
    than the UPS lasts. hearth, the server in the back office, started
    again by itself when the power came back. The appointment book
    (agenda) and the medical records (records) are working; the
    accounting (ledger) isn't, and Priya must send the payroll on
    Wednesday.

    All our servers are virtual machines on hearth (KVM, with libvirt):
    you are in the libvirt group, and sudo works with your password.
    Ilse, who set everything up, has moved to the coast; she left a note
    in your home directory. Priya left one too.

    Please don't lose Priya's accounts.

    Grace

cold-start-note-ilse =
    Notes from Ilse (hearth)

    - virsh is your friend: virsh list --all shows every VM, running or
      not. ~/.config/libvirt/libvirt.conf points virsh at qemu:///system.
    - Images in /var/lib/libvirt/images (root only: use sudo).
    - Before anything risky on ledger I took a snapshot (virsh
      snapshot-create-as --disk-only): before the software update, before
      the year-end closing, before the upgrade to Debian 13. I meant to
      clean them up afterwards...
    - ledger-test-clone.qcow2 is a copy I made in January to test the new
      accounting version with Priya. Nothing uses it; it can go once she
      says the test is over.

    Ilse

cold-start-message-priya =
    From: Priya (accounts, Mondays and Wednesdays)

    Hi! The test of the new version Ilse ran in January is over: we
    stayed on the old one. Her test copy can be deleted, I don't need
    it.

    The real accounts are on ledger, and I need them by Wednesday.

    Priya

## Events

cold-start-event-list =
    ledger is "shut off": agenda and records came back with hearth, not
    ledger. A domain starts with its host only if it is marked autostart
    (virsh dominfo shows it). Before starting it, look at it: virsh dominfo
    ledger.
cold-start-event-autostart-off =
    Autostart: disable. ledger never came back by itself after a reboot:
    someone always started it by hand. That can be fixed (man virsh,
    autostart), but first, does it start at all? virsh start ledger.
cold-start-event-paused =
    ledger started... and froze a few seconds later: it is "paused" now
    (virsh list). A guest that
    can't write to its disk is paused by QEMU rather than left to corrupt
    its file system (its default werror=enospc policy). Why? virsh domstate
    ledger --reason, virsh domblkerror ledger, and what does the host's
    disk say (df -h)?
cold-start-event-no-space =
    "vda: no space", and /var is at 100 %: the guest wrote, its image
    grew, and the file system holding the images is full. What takes all
    that room? sudo ls -lh /var/lib/libvirt/images, and which images does
    ledger really use? virsh domblklist ledger, then qemu-img info on its
    disk (sudo).
cold-start-event-lock =
    qemu-img refuses: the image is in use, and QEMU holds a lock on it so
    that nobody writes behind its back. To only read it, ask for a shared
    open: qemu-img info -U (--force-share). Never write to an image a
    running guest uses.
cold-start-event-chain =
    ledger's disk is a chain: before-upgrade rests on before-yearend, which
    rests on before-update, which rests on ledger.qcow2. Each external
    snapshot froze the image below it and created a new file on top, where
    every write since has gone. Four files for one disk of 200 GiB
    (virtual: what the guest sees; disk size: what the host gives it). Look
    at the snapshots too: virsh snapshot-list ledger.
cold-start-event-acpi-paused =
    virsh shutdown presses the virtual power button (ACPI): the guest's
    system must hear it and shut down by itself. A paused guest hears
    nothing: ledger is still paused. Its disk is the problem, not its
    power.
cold-start-event-destroyed =
    virsh destroy pulls the plug: no shutdown, the guest stops dead, like
    the storm did to it. It was paused, so nothing was half written this
    time; on a running guest, destroy is the last resort. The chain and the
    full /var are still there.
cold-start-event-revert =
    Lucky refusal. Reverting to before-update would put ledger back as it
    was in March last year: a year of accounts gone. A snapshot is a point
    to return to, not a place to keep living from.
cold-start-event-undefine =
    libvirt refuses to undefine a domain that still has snapshots, and it
    is right: undefining ledger would not fix its disk, and with
    --remove-all-storage it would delete it.
cold-start-event-rm-held =
    You removed an image ledger is using. Look at df: no space came back.
    QEMU still holds the file open (sudo lsof shows it "(deleted)"): its
    blocks are freed only when the guest stops. And when it stops, the
    chain will point to a file that no longer exists. Don't stop ledger:
    while QEMU holds the file, a block commit can still read it and merge
    everything into the base.
cold-start-event-broken =
    ledger's chain is broken: an image it needs is gone, and QEMU no longer
    holds it. libvirt can't start the domain any more ("Cannot access
    backing file"). The data written in that image is lost. Restart the
    chapter (or use the rescue snapshot): never delete an image without
    checking what uses it (virsh domblklist, qemu-img info --backing-chain).
cold-start-event-commit-failed =
    The merge failed: committing an image into its base makes the base
    grow by what it receives, and /var has no room left. Make room first,
    with something nothing uses (Ilse's note, Priya's message), then merge.
cold-start-event-room =
    The test clone is gone: about 12 GiB free on /var. Not much: the chain
    still holds a year of writes on top of the base. Merge it: virsh
    blockcommit with --active --pivot merges the whole chain into the base
    while the guest runs (or is paused); virsh snapshot-delete merges one
    external snapshot at a time (man virsh).
cold-start-event-merged =
    The chain is merged: ledger's disk is ledger.qcow2 alone, with
    everything that was written on top. The overlays and the snapshots
    are gone with it.
cold-start-event-merged-leftovers =
    The chain is merged: ledger now writes to ledger.qcow2 alone. But the
    overlay files are still on /var (blockcommit doesn't delete them without
    --delete), and libvirt still lists the snapshots, which point to images
    that are no longer in the chain. Remove the files nothing uses any more
    (check with virsh domblklist ledger), and the stale metadata: virsh
    snapshot-delete --metadata.
cold-start-event-paused-again =
    Paused again: the guest kept writing, and /var was still full of the
    old overlays. A merge copies data into the base; it frees nothing as
    long as the old files stay on disk.
cold-start-event-cleaned =
    /var has room again: one image for ledger, no leftover overlay, and
    snapshot metadata that matches the disk.
cold-start-event-resumed =
    ledger is running again (virsh resume wakes a paused guest; it carries
    on from where it froze). Give it a few seconds to finish booting.
cold-start-event-autostart =
    ledger is marked autostart: /etc/libvirt/qemu/autostart/ledger.xml
    links to its definition, and the next storm won't leave it behind.
cold-start-event-ssh =
    You are on ledger: Priya's accounts are in /srv/ledger/books. Come back
    to hearth with exit.
cold-start-event-end =
    Grace: "Priya says the accounts are all there, payroll on Wednesday as
    planned. Thank you!"

    Well done! You finished The Cold Start.

    WHAT HAPPENED
    Saturday's power cut restarted hearth. agenda and records were marked
    autostart; ledger wasn't. Started by hand, it paused at once: over a
    year, Ilse had taken three external disk-only snapshots of it and never
    merged them. Each created a new overlay where every write went, and the
    chain of four images had filled /var. You made room with what nothing
    used (the test clone), merged the chain into its base, removed the
    leftovers and the stale metadata, resumed ledger, marked it autostart,
    and checked it from inside.

    GOOD PRACTICE
    - virsh list --all, not virsh list: a stopped domain doesn't show
      otherwise. virsh autostart for every guest that must come back with
      its host.
    - "paused (I/O error)" with "no space": look at the host's file system
      before touching the guest.
    - A thin image (qcow2) can grow up to its virtual size: the sum of the
      virtual sizes may well exceed the disk. Watch df on the host.
    - An external snapshot is a new file on top of the old one: merge it
      back (blockcommit, or snapshot-delete since libvirt 9) as soon as it
      is no longer needed. Never rm an image of a chain.
    - qemu-img info -U to read an image in use; never write to it.
    - A snapshot is a point to return to, on the same disk: it is not a
      backup.

    DOCUMENTATION
    - virsh: https://libvirt.org/manpages/virsh.html
    - Merging disk image chains: https://libvirt.org/kbase/merging_disk_image_chains.html
    - Snapshots in libvirt: https://libvirt.org/kbase/snapshots.html
    - qemu-img: https://www.qemu.org/docs/master/tools/qemu-img.html
    - KVM on Debian: https://wiki.debian.org/KVM
