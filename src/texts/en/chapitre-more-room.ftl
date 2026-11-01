### Story "The Lab", chapter 3 "Running out of room": a new array
### (mdadm --create), LVM (pvcreate, vgextend, lvextend), the file system
### (resize2fs), mdadm.conf and the initramfs. Commands, options, paths and
### outputs are not translated.

chapitre-more-room = Running out of room
    .resume = The photo disk is full and the winter contest is coming: make a RAID array of the two new disks, give it to LVM, grow the volume and its file system, and make the boot remember it.

## Files

more-room-message-d-odile =
    A message from Odile (Saturday 15 January, 9:50 am):

    "Happy New Year! The winter contest starts on Monday, and we expect
    about 1.5 TB of photos. But the gallery already says “disk almost
    full”: yesterday we uploaded all the autumn archives.

    I did as you told me: I asked the host for two more disks. They
    plugged them in this morning, two 4 TB disks. They say they are
    “blank, over to you”.

    Can we grow the space for the photos without breaking anything? And
    without losing the safety of the two disks, of course."

## Events

more-room-evenement-plein =
    /srv is 97% full. It is not on a partition, but on
    /dev/mapper/labo-photos: an LVM logical volume. What is left in its
    group? (man vgs, man lvs, man pvs)
more-room-evenement-lvm =
    LVM stacks three layers: physical volumes (PV, here the md1 array),
    gathered into a group (VG labo), where logical volumes are carved out
    (LV photos, mounted on /srv). The group has not a single free extent
    left. The two new disks, sdc and sdd, are waiting: first a RAID 1
    array with them, to keep the safety of two disks (man mdadm,
    --create).
# { $disque }: the lone disk in the group
more-room-evenement-seul =
    Careful: { $disque } joined the labo group as is, without RAID. If
    this disk dies, everything LVM put on it is lost, and with it the
    whole photos volume. Take it out of the group (man vgreduce). If data
    is already on it, move it first (man pvmove) to an array: an array can
    be born with a single disk and an empty slot ("missing", man mdadm),
    and get its second disk later.
# { $grappe }: the new array
more-room-evenement-grappe =
    { $grappe } is created, and already usable: its first
    synchronization (resync, in /proc/mdstat) runs in the background. It
    now becomes a physical volume of the labo group (man pvcreate, man
    vgextend).
more-room-evenement-etendu =
    The labo group has room: vgs shows it (VFree). The photos volume has
    not moved yet: grow it (man lvextend).
more-room-evenement-lv-seul =
    The logical volume grew (lvs), but df sees nothing: the file system it
    carries kept its size. It must be grown too (man resize2fs; next time,
    lvextend -r does both).
more-room-evenement-agrandi =
    /srv has room for the winter contest, still on two copies. The boot
    remains: the new array must be declared in /etc/mdadm/mdadm.conf (its
    ARRAY line: man mdadm, --detail --brief), or it may come back under
    another name.
more-room-evenement-doublons =
    mdadm.conf now describes an array twice: mdadm --detail --scan also
    gives md0 and md1, already there. At boot, mdadm would complain. Keep
    a single ARRAY line per array (sudo nano).
more-room-evenement-conf =
    The new array is in mdadm.conf. But at boot, the copy of that file in
    the initramfs is what counts: rebuild it (man update-initramfs).
more-room-evenement-fin =
    Odile: "3.6 TB more? Bring on the contest!"

    Well done! You finished chapter 3 of The Lab. (What comes next is
    waiting for you: ssh lab.)

    WHAT HAPPENED
    The photos volume (LVM, on the md1 array) was full. You made a RAID 1
    array of the two new disks, gave it to the volume group, then grew the
    logical volume and its file system, without unmounting anything.
    Finally, the new array is declared in mdadm.conf, and the initramfs
    knows it.

    GOOD PRACTICE
    - RAID first, LVM on top: every physical volume must be redundant; a
      lone disk in the group puts the whole volume at risk.
    - lvextend only grows the volume: resize2fs (or lvextend -r) for the
      file system; ext4 grows online, but doesn't shrink online.
    - Leave a little free space in the group: it will serve for a snapshot
      (lvcreate -s) or an emergency.
    - After a new array: its ARRAY line in mdadm.conf, only once, then
      update-initramfs -u.
    - RAID still does not replace a backup.

    DOCUMENTATION
    - LVM: https://man7.org/linux/man-pages/man8/lvm.8.html
    - lvextend: https://man7.org/linux/man-pages/man8/lvextend.8.html
    - resize2fs: https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - Software RAID on Debian: https://wiki.debian.org/SoftwareRAID
