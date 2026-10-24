### Graded hints for The Lab (see src/moteur/indices.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a direction, without the
### exact command) and .solution (almost the answer). Place names are those
### of noms.ftl.

## Chapter 1 — The tired disk

indice-fatigue-alerte =
    .piste = Odile mentions emails from smartd: read them (man mail, and your mailbox file). The kernel, for its part, keeps track of read errors (man dmesg).
    .solution = mail, then cat /var/mail/you (or sudo dmesg): sdb has unreadable sectors.
indice-fatigue-grappes =
    .piste = Before touching a disk, look at what it's used for: software RAID shows the state of its arrays in a file under /proc (man mdadm).
    .solution = cat /proc/mdstat (or sudo mdadm --detail /dev/md0): md0 and md1, each with a partition of sda and one of sdb.
indice-fatigue-smart =
    .piste = Ask sdb about its health, in full: identity, verdict, attributes (man smartctl). Then compare with sda.
    .solution = sudo smartctl -a /dev/sdb (Reallocated_Sector_Ct, Current_Pending_Sector), then sudo smartctl -a /dev/sda.
indice-fatigue-retire =
    .piste = Each partition of sdb must leave its array: first declared faulty, then removed (man mdadm). There are two arrays.
    .solution = sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2, then the same for /dev/sdb3 in /dev/md1.
indice-fatigue-ticket =
    .piste = The host's procedure asks for a single piece of information about the disk: the one that never changes, even if the names sda and sdb do (man smartctl, or man lsblk).
    .solution = sudo smartctl -i /dev/sdb (Serial Number), then nano ~/ticket.txt: a replacement request with that number, and not sda's.
indice-fatigue-fin =
    .piste = You need everything at once: nothing left of sdb in the arrays, sda still active in both, and a ticket that only gives sdb's serial number.
    .solution = cat /proc/mdstat ([U_] for md0 and md1, without sdb) and cat ~/ticket.txt (sdb's number only).

## Chapter 2 — The new disk

indice-disque-neuf-neuf =
    .piste = Look at the disks and their partitions: what was delivered in place of the old sdb? (man lsblk)
    .solution = lsblk: sdb has no partition; cat /proc/mdstat: the arrays are [U_].
indice-disque-neuf-table =
    .piste = The new disk must be split exactly like sda: sfdisk can write a disk's table as a script, and another sfdisk can read it back (man sfdisk). Mind the direction.
    .solution = sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (then lsblk to check).
indice-disque-neuf-ajoutes =
    .piste = Each new partition joins the array of its twin on sda (man mdadm, adding a member).
    .solution = sudo mdadm --manage /dev/md0 --add /dev/sdb2, then sudo mdadm --manage /dev/md1 --add /dev/sdb3.
indice-disque-neuf-reconstruit =
    .piste = The rebuild takes time: follow it in the file that shows the state of the arrays, until they are complete.
    .solution = cat /proc/mdstat, several times, until [UU] for md0 and md1.
indice-disque-neuf-grub =
    .piste = The server must be able to boot from the new disk: the boot loader is installed on the whole disk (man grub-install).
    .solution = sudo grub-install /dev/sdb
indice-disque-neuf-fin =
    .piste = You need everything at once: sdb split like sda, both arrays complete and up to date, and GRUB on sdb.
    .solution = lsblk, cat /proc/mdstat ([UU] everywhere), sudo grub-install /dev/sdb if not done yet.
