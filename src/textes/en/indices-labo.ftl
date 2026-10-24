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

## Chapter 3 — Running out of room

indice-agrandir-plein =
    .piste = Look at how full the file systems are (man df): which one is full, and on which device?
    .solution = df -h: /srv, on /dev/mapper/labo-photos, is 97% full.
indice-agrandir-lvm =
    .piste = /srv is an LVM logical volume: look at its three layers, physical volumes, groups and logical volumes (man pvs, man vgs, man lvs).
    .solution = sudo vgs (VFree at 0), sudo pvs (md1 alone), sudo lvs; then lsblk: sdc and sdd are new.
indice-agrandir-grappe =
    .piste = Before giving the new disks to LVM, make a RAID 1 array of them, to keep two copies (man mdadm, creating an array).
    .solution = sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd, then y to confirm.
indice-agrandir-etendu =
    .piste = The new array must become a physical volume, then join the labo group (man pvcreate, man vgextend).
    .solution = sudo pvcreate /dev/md2, then sudo vgextend labo /dev/md2 (sudo vgs: VFree has grown).
indice-agrandir-agrandi =
    .piste = Grow the photos logical volume, then the file system it carries (man lvextend, man resize2fs).
    .solution = sudo lvextend -r -l +100%FREE /dev/labo/photos (or lvextend without -r, then sudo resize2fs /dev/labo/photos); df -h /srv to check.
indice-agrandir-conf =
    .piste = The new array must be declared in /etc/mdadm/mdadm.conf, only once: mdadm can write its ARRAY line (man mdadm). Careful, the file belongs to root.
    .solution = sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf
indice-agrandir-fin =
    .piste = The boot reads a copy of mdadm.conf, kept in the initramfs: rebuild it (man update-initramfs). You also need at least 1.5 TB free on /srv, and no lone disk in the group.
    .solution = sudo update-initramfs -u

## Chapter 4 — The stuck reboot

indice-secours-journal =
    .piste = The emergency mode message says where to look: this boot's journal, with its explanations (man journalctl).
    .solution = journalctl -xb (or journalctl -b -p err): "Timed out waiting for device /dev/sdc1".
indice-secours-disques =
    .piste = Who is sdc today, and where did the USB disk go? Look at the disks with their file systems, labels and UUIDs (man lsblk, man blkid).
    .solution = lsblk -f (or blkid): sdc is in md2; the USB disk is sde, its partition sde1 carries the SCANS label and a UUID.
indice-secours-corrige =
    .piste = In /etc/fstab, the scans line must refer to the disk by what doesn't change, and not block the boot if it is missing (man fstab: UUID=, nofail).
    .solution = nano /etc/fstab: UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults,nofail  0  2 (the UUID from blkid), then findmnt --verify.
indice-secours-monte =
    .piste = Try fstab without rebooting: mount can mount everything the file describes (man mount). And systemd must reread the file (man systemctl).
    .solution = systemctl daemon-reload, then mount -a, then df -h /srv/scans.
indice-secours-fin =
    .piste = What's left is leaving emergency mode: resume the normal boot, as the console message says (man systemctl).
    .solution = systemctl default (or exit, or reboot)
