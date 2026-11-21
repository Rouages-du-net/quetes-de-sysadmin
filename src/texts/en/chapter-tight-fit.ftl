### Story "The Health Centre", chapter "The Tight Fit": the hypervisor
### swaps (its guests' memory is overcommitted), and a guest's disk is full.
### free, virsh dommemstat, setmem --live --config, snapshot-create-as,
### blockresize (or qemu-img resize while off), growpart, resize2fs,
### snapshot-delete. Commands, options, paths and outputs are not translated.

chapter-tight-fit = The Tight Fit
    .summary = Everything is slow at Millbrook, and the medical records refuse to save. The hypervisor has promised its guests more memory than it has, and one guest's disk is full of files the law says to keep. Share the memory sensibly, grow a disk safely with a snapshot as a safety net, and don't keep the net forever.

## Files

tight-fit-message-grace =
    From: Grace (practice manager)
    Thursday 18 April, 14:00

    Everything is so slow today: agenda takes ten seconds to open a day,
    the portal times out. And Joon says the records application refuses
    to save the notes of her consultations (her note is in your home
    directory).

    Before you change anything on records, please make sure we can go
    back if it goes wrong. Last night's backup is on the NAS as usual.

    Grace

tight-fit-note-joon =
    Note from Joon (nurse)

    The records application says "could not write to file". The IT
    company that installed it says the server's disk is full, and that
    the monthly exports in /srv/records/exports must NOT be deleted: we
    have to keep them (see RETENTION.txt on records).

    Joon

tight-fit-retention =
    RETENTION - records exports

    Monthly exports of the medical records application. Keep them in
    place for the retention period required by the practice's policy.
    Do not delete, do not move. Questions: Grace.

## Events

tight-fit-event-swap =
    hearth swaps: its RAM is full, and the kernel pushes memory pages to
    disk, then fetches them back. Every guest slows down. Who takes what?
    virsh list, virsh dominfo for each guest (Used memory), virsh nodeinfo
    for hearth, and from the inside: virsh dommemstat records.
tight-fit-event-memstat =
    records was given 16 GiB. What it really uses is "actual" minus what is
    "unused" and what is only cache (disk_caches): about 3.4 GiB. A guest
    fills the memory it is given with cache, and that memory is gone for
    the host. The balloon can give it back: virsh setmem (man virsh, its
    --live and --config).
tight-fit-event-too-high =
    setmem can't go above the domain's maximum memory (<memory>): that one
    changes with setmaxmem --config, and only applies at the next start.
tight-fit-event-config-only =
    --config changes the definition, for the next start: records still
    holds 16 GiB now, and hearth still swaps. --live changes the running
    guest (the balloon); both at once is the usual answer.
tight-fit-event-memory-fixed =
    hearth no longer swaps, and the definitions fit its RAM at the next
    boot too: the guests together get less than the host has, with room
    left for hearth itself.
tight-fit-event-guest-full =
    records' root file system is full: 20 GiB, and the exports must stay.
    The disk must grow: the image first (from hearth), then the partition
    and the file system (inside the guest). But Grace asked for a way back
    first.
tight-fit-event-lock =
    qemu-img refuses: records is running and QEMU holds a write lock on its
    image. Resizing an image behind a running guest's back would corrupt
    it. While it runs: virsh blockresize, through QEMU. Or shut it down,
    then qemu-img resize.
tight-fit-event-shrink-refused =
    Shrinking a disk cuts off its end, with whatever is written there:
    QEMU refuses unless told --shrink, and only after the file system and
    the partition have been shrunk first. Here the disk must grow.
tight-fit-event-shrunk =
    The image was shrunk below what records had written: the end of its
    disk is gone, file system included. If you took a snapshot before,
    virsh snapshot-revert brings the disk back; otherwise, restart the
    chapter (or use the rescue snapshot).
tight-fit-event-snapshot =
    A snapshot of records, taken before touching its disk: a way back if
    the resize goes wrong (virsh snapshot-revert). It lives inside
    records.qcow2: on the same disk, it protects from a mistake, not from
    losing the disk.
tight-fit-event-grown =
    records' image is bigger: the guest's kernel saw it at once (dmesg in
    the guest, lsblk). The partition and the file system haven't grown: in
    the guest, growpart, then resize2fs (man growpart).
tight-fit-event-grown-no-net =
    records' image is bigger. It went well, but without a snapshot first:
    had it gone wrong, last night's backup was the only way back. The
    partition and the file system are next: in the guest, growpart, then
    resize2fs.
tight-fit-event-partition =
    The partition fills the disk now (lsblk). The file system still has its
    old size: resize2fs grows an ext4 file system while it is mounted.
tight-fit-event-filesystem =
    records' file system has room (df -h in the guest): the application
    can write again, and the exports are still there. Check, then don't
    forget the snapshots: virsh snapshot-list records.
tight-fit-event-cleaned =
    No snapshot left on records: neither yours, now useless, nor Ilse's from
    October, which nobody would ever revert to (it would undo six months of
    medical records).
tight-fit-event-end =
    Grace: "agenda opens at once, and Joon's notes are saved. Thank you!"

    Well done! You finished The Tight Fit.

    WHAT HAPPENED
    hearth's guests had been promised more memory than hearth has; records
    alone held 16 GiB, filled with cache, for 3.4 GiB of real use, and
    hearth swapped. You gave records 6 GiB now and at its next start
    (setmem --live --config). Its disk was full of exports that must stay:
    you took a snapshot, grew the image (virsh blockresize while it runs,
    or qemu-img resize while it is off), grew the partition (growpart)
    and the file system (resize2fs) in the guest, checked, and deleted the
    snapshots.

    GOOD PRACTICE
    - Add up what the guests are given (their current memory) and keep it
      below what the host has, with room for the host itself. A guest
      fills its memory with cache: dommemstat says what it really uses.
    - setmem --live for now, --config for the next start; setmaxmem only
      while the domain is off.
    - Grow a disk in three steps: the image, the partition, the file
      system. Never resize an image a running QEMU uses behind its back,
      and never shrink without shrinking what is inside first.
    - A snapshot before a risky change, deleted right after: a snapshot is
      on the same disk, it is not a backup, and an old one weighs on the
      image forever.

    DOCUMENTATION
    - virsh (setmem, dommemstat, blockresize, snapshots): https://libvirt.org/manpages/virsh.html
    - qemu-img resize: https://www.qemu.org/docs/master/tools/qemu-img.html
    - growpart: https://manpages.debian.org/trixie/cloud-guest-utils/growpart.1.en.html
    - resize2fs: https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - Memory in a domain's XML: https://libvirt.org/formatdomain.html#memory-allocation
