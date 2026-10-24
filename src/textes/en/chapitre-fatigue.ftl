### Story "The Lab", chapter 1 "The tired disk": SMART, software RAID
### (mdadm), taking a disk out of its arrays. Commands, options, paths and
### outputs (smartctl, mdadm, /proc/mdstat) are not translated. Also holds
### the texts shared by the story (labo-…).

chapitre-fatigue = The tired disk
    .resume = smartd is worried about a disk: read what SMART really says, understand the server's RAID, take the sick disk out of its arrays and ask for its replacement by its serial number.

## Shared by the story

labo-procedure-hebergeur =
    Replacing a faulty disk — dedicated servers

    1. Before writing to us, remove the disk from your software RAID
       arrays (mdadm): we unplug it while the server runs, and a disk
       still in use could damage the array.
    2. Give us in your request the serial number (S/N) of the disk to
       replace, and only that one: the names sda or sdb can change from
       one boot to the next, the serial number does not
       (smartctl -i or lsblk -o show it).
    3. We step in within 24 hours. The new disk is delivered blank: it is
       up to you to partition it and rebuild your RAID.
labo-syslog =
    Nov 11 03:12:44 labo smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors
    Nov 11 03:42:44 labo smartd[588]: Device: /dev/sdb [SAT], 8 Offline uncorrectable sectors
    Nov 13 03:00:12 labo smartd[588]: Device: /dev/sdb [SAT], starting scheduled Short Self-Test.
    Nov 13 03:02:44 labo smartd[588]: Device: /dev/sdb [SAT], previous self-test completed with error (read test element)
    Nov 13 03:12:44 labo smartd[588]: Device: /dev/sdb [SAT], 8 Currently unreadable (pending) sectors

## Files

fatigue-message-d-odile =
    A message from Odile, president of the Lab, the neighbourhood photo
    club (Saturday, 7:30 am):

    "Hello, and thank you for taking over the club's server! I don't know
    much about it, but since Thursday I've been getting strange emails
    from "smartd" about a disk. I forwarded them to you: the mail command
    lists them, and they are in /var/mail/you. The gallery was very slow
    last night, too.

    The server is rented from a hosting company. According to the former
    volunteer, it has two disks "in RAID", so that we lose nothing if one
    fails. If a disk needs replacing, the host does it for free: their
    procedure is in host_procedure.txt. Write the request in ~/ticket.txt,
    I'll send it from our customer account.

    For sudo: argentique-2027."

## Events

fatigue-evenement-alerte =
    smartd and the kernel are talking about the same disk: sdb. Sectors it
    can no longer read (pending), and reads the RAID had to redo on the
    other disk (redirecting … to other mirror). Before concluding, look at
    how the disks are put together: cat /proc/mdstat.
fatigue-evenement-grappes =
    Two RAID 1 arrays: md0 (the system, /) with sda2 and sdb2, and md1 (the
    photos, /srv) with sda3 and sdb3. [UU]: for now, both copies are there.
    So each disk is in both arrays. What does SMART say about sdb, and
    about sda to compare? (man smartctl)
fatigue-evenement-smart =
    "PASSED"… and yet: over a thousand reallocated sectors, 8 pending, 37
    errors in its log. The overall verdict only flips at the
    manufacturer's threshold; a reallocated sector count that keeps
    climbing announces the failure. Compare with sda: zero everywhere. sdb
    has to leave both its arrays before it is replaced (man mdadm: --fail,
    then --remove).
fatigue-evenement-occupe =
    mdadm refuses: you don't remove an active member from an array
    ("Device or resource busy"). First declare it faulty (--fail), then
    remove it (--remove); both fit in the same command.
fatigue-evenement-sain =
    Careful: you just took a member of sda, the HEALTHY disk, out of its
    array! It now only stands on sdb, the one that is wearing out. Remove
    it (--remove), then put it back (--re-add): it will be brought up to
    date and the array will get its healthy copy back. Only then deal with
    sdb.
# { $partition }: the sdb partition still in place; { $grappe }: its array
fatigue-evenement-moitie =
    One array is done. But sdb is in the other one too: { $partition } is
    still part of { $grappe }. A disk being replaced leaves all its arrays.
fatigue-evenement-retire =
    sdb is no longer part of any array: /proc/mdstat shows [U_] for both.
    The server runs on sda alone, without a safety net: the disk must be
    replaced quickly. The ticket remains, ~/ticket.txt, with what the
    host's procedure asks for.
# { $fichier }: the ticket's name
fatigue-evenement-ticket-faux =
    The ticket contains sda's serial number: that's the HEALTHY disk! The
    host would unplug the only disk that still works. Fix { $fichier }:
    only sdb's serial number.
fatigue-evenement-ticket =
    The ticket gives the serial number of the disk to replace. Odile will
    send it as soon as the disk is out of its arrays.
fatigue-evenement-fin =
    Odile: "Sent! The host replies they'll swap the disk tonight."

    Well done! You finished chapter 1 of The Lab. (What comes next is
    waiting for you: ssh labo.)

    WHAT HAPPENED
    The sdb disk was wearing out: unreadable sectors, which smartd had
    been reporting for two days and which the RAID made up for by reading
    the other disk. Yet SMART said PASSED: its overall verdict only flips
    at the manufacturer's threshold, often too late. You compared the
    attributes of both disks, took sdb out of its two arrays, and asked
    for its replacement by its serial number.

    GOOD PRACTICE
    - Run smartd, and read its emails: root's mail has to reach someone
      (/etc/aliases).
    - Judge a disk by its attributes (5, 197, 198) and how they change,
      not by PASSED.
    - Before a replacement: --fail then --remove, in every array of the
      disk.
    - Refer to a disk by its serial number, never by sda or sdb, which can
      change from one boot to the next.
    - RAID is not a backup: it protects against a disk failure, not
      against a deletion, ransomware or a fire.

    DOCUMENTATION
    - smartctl: https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in
    - mdadm: https://man7.org/linux/man-pages/man8/mdadm.8.html
    - Linux software RAID (md): https://docs.kernel.org/admin-guide/md.html
