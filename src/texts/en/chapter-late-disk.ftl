### Story "The Canteen", chapter 4 "The Late Disk": a mount that comes
### after the service that needs it (RequiresMountsFor=, nofail, what a
### mount point hides). Unit names, paths and systemd's messages are not
### translated.

chapter-late-disk = The Late Disk
    .summary = This morning's bookings have vanished from the canteen's USB disk. They are not lost: they are hidden. Find them, and make the app wait for its disk.

## Files

late-disk-message-ibrahim =
    From:     Ibrahim
    To:       you
    Subject:  The morning's bookings have vanished!

    Hello,

    Disaster: the kitchen opens today's list (the app writes it in
    /srv/data/bookings/, one file per day) and this morning's bookings
    aren't there. People booked between 6:30 and 9:00, I saw them in the
    app, and the file of the day doesn't even exist on the disk.

    /srv/data is our old USB disk (in /etc/fstab, with nofail since the
    day it was unplugged and the server wouldn't boot, remember The Lab).
    There was a reboot early this morning, for the updates.

    Can you find the morning's bookings and put them back on the disk?
    And make sure it doesn't happen again at the next reboot. Password
    lentils-2028.

    Ibrahim

late-disk-header = time;name;guests
late-disk-bookings =
    06:41;Amadou;2
    06:58;Claire;1
    07:12;Rui;4
    07:30;Mei;2
    07:52;Youssef;3
    08:05;Hanna;1
    08:17;Kwame;2
    08:33;Lucia;5
    08:46;Tomasz;1
    08:59;Nadia;2
late-disk-old-bookings =
    10:02;Amadou;2
    10:45;Rui;3
    11:10;Hanna;1

## Events

late-disk-event-hidden =
    There it is: today's list, with the morning's bookings. It was right
    there, in /srv/data… but on the system disk, in the directory the USB
    disk is mounted on. A mount hides what the directory held (it's still
    there, untouched); unmounted, it shows again. Put it somewhere safe,
    then put it on the USB disk.
late-disk-event-order =
    "Mounted srv-data.mount": the USB disk arrived some 25 seconds into
    the boot, and the app had started long before. With nofail, nothing
    waits for this mount. Where did the app write this morning's list,
    then? (findmnt, and what does /srv/data hold without its disk?)
late-disk-event-recovered =
    The morning's bookings are back on the USB disk: the kitchen has its
    list. Now the cause: at the next reboot, the app will again start
    before the disk. Tell systemd that it needs /srv/data
    (man systemd.unit: RequiresMountsFor=), then reboot to check.
late-disk-event-no-nofail =
    Without nofail, the whole boot waits for the USB disk: the app starts
    after it, indeed. But the day the disk is missing, the server will
    stop in emergency mode, as it once did. RequiresMountsFor= on the app
    alone would have kept the server booting.
late-disk-event-end =
    After the reboot, the USB disk was mounted first, then the app started
    and wrote into it. Ibrahim: "And this morning's bookings are there. The
    kitchen can serve!"

    Well done! You have finished the chapter "The Late Disk".

    WHAT HAPPENED
    The USB disk takes about 25 seconds to appear at boot. Its fstab line
    has nofail (so that the server boots even without it), and with nofail
    nothing waits for the mount. The app started first and wrote today's
    list into /srv/data… the empty directory of the system disk. When the
    USB disk was mounted on top, it hid that file: for everyone, the list
    had vanished. It was only hidden.

    WHAT A MOUNT POINT HIDES
    - Mounting a disk on a directory hides that directory's content
      without erasing it; unmounting shows it again.
    - To look without unmounting: mount the system disk elsewhere
      (mount --bind / /mnt/root), then look in /mnt/root/srv/data.
    - A classic trap: a service that writes before its disk is there, or
      a backup that fills the system disk while the backup disk is absent.

    THE FIX
    - RequiresMountsFor=/srv/data in the app's [Unit]: the app requires the
      mount of /srv/data and starts after it. If the disk is missing, the app
      doesn't start (better than writing in the wrong place), and the
      server still boots.
    - Keep nofail for a disk that may be missing; removing it makes the whole
      boot wait, and stop in emergency mode if the disk isn't there.

    DOCUMENTATION
    - RequiresMountsFor=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#RequiresMountsFor=
    - nofail and the mounts at boot: https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - mount, umount: https://man7.org/linux/man-pages/man8/mount.8.html
