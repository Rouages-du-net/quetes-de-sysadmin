### Story "The Lab", chapter 2 "The new disk": copying a partition table
### (sfdisk), rebuilding the RAID (mdadm --add, /proc/mdstat), installing
### GRUB on the new disk. Commands, options, paths and outputs are not
### translated.

chapitre-disque-neuf = The new disk
    .resume = The new disk has arrived, blank: split it like the other one without getting the direction wrong, rebuild both RAID arrays, and make the server able to boot from either disk.

## Files

disque-neuf-message-d-odile =
    A message from Odile (Sunday, 8:05 am):

    "The host replied overnight: “The faulty disk has been replaced. The
    new disk is delivered blank: it is up to you to partition it and
    rebuild your RAID.” I must admit I don't know what that means… The
    website works, anyway.

    The former volunteer had left a note: “both disks are split the same
    way, and GRUB is on both, so the server boots even if one fails”."

## Events

disque-neuf-evenement-neuf =
    The new sdb: 1.8 T, no partition. The arrays run on sda alone ([U_] in
    /proc/mdstat). Before adding it to the RAID, it must be split exactly
    like sda: sfdisk can write a disk's table as a script, and read it
    back (man sfdisk).
disque-neuf-evenement-trop-tot =
    mdadm can't find this partition: sdb is still blank. First the
    partition table (the same as sda's), then the arrays.
disque-neuf-evenement-sens =
    sfdisk refused to write to a disk in use: luckily! That was sda, the
    disk running the server. In a pipe, the disk named last is the one
    overwritten: sfdisk -d /dev/sda reads sda, sfdisk /dev/sdb writes to
    sdb.
disque-neuf-evenement-disque-entier =
    You put the WHOLE sdb disk into an array: its RAID superblock
    overwrote its partition table, and there is no room left for GRUB or
    for the other array. Take it out again (--fail then --remove), copy
    sda's table, and add the right partition: sdb2 into md0, sdb3 into md1.
disque-neuf-evenement-table =
    sdb is split like sda: sdb1 (BIOS boot, GRUB's spot), sdb2 and sdb3
    (Linux RAID). Each partition now joins its twin's array: sdb2 into md0,
    sdb3 into md1.
disque-neuf-evenement-ajoutes =
    Both partitions have joined their array. Look at /proc/mdstat: one
    array rebuilds at a time (recovery), the other waits its turn
    (DELAYED). Meanwhile, the server keeps serving the photos. Time flies
    here: each command counts for half an hour.
disque-neuf-evenement-reconstruit =
    Everywhere [UU]: both arrays have their two copies again. What's left
    is what will matter the day sda dies: being able to boot from sdb.
disque-neuf-evenement-grub =
    GRUB is installed on sdb: if sda fails, the server can boot from the
    other disk.
disque-neuf-evenement-fin =
    Odile: "So if a disk fails again, we lose nothing, and the server still
    restarts? Great."

    Well done! You finished chapter 2 of The Lab. (What comes next is
    waiting for you: ssh lab.)

    WHAT HAPPENED
    The new disk was blank. You copied sda's partition table (sfdisk -d,
    then sfdisk on sdb: the direction matters), added each partition to
    its twin's array, followed the rebuild, and installed GRUB on the new
    disk.

    GOOD PRACTICE
    - Check the target disk twice before writing a table: lsblk, and its
      serial number.
    - Add partitions to the arrays, not the whole disk, when the disk also
      carries GRUB.
    - Follow the rebuild (cat /proc/mdstat) and don't reboot anything
      before [UU].
    - GRUB on every disk of a RAID 1, or the failure of the first one
      prevents booting.
    - The copied table keeps the other disk's identifiers (label-id, uuid):
      on a real server, sgdisk -G /dev/sdb draws new ones.
    - mdadm warns when an array degrades (MAILADDR in
      /etc/mdadm/mdadm.conf): someone still has to read root's mail.

    DOCUMENTATION
    - sfdisk: https://man7.org/linux/man-pages/man8/sfdisk.8.html
    - mdadm: https://man7.org/linux/man-pages/man8/mdadm.8.html
    - GRUB and the BIOS: https://www.gnu.org/software/grub/manual/grub/html_node/BIOS-installation.html
