### Story "The Lab", chapter 4 "The stuck reboot": emergency mode,
### /etc/fstab by UUID, nofail, findmnt --verify, mount -a, systemctl
### daemon-reload. Commands, options, paths and outputs are not translated.

chapter-stuck-boot = The stuck reboot
    .resume = The server no longer reboots: it is waiting for a disk that changed its name. Understand emergency mode, refer to the disk by its UUID, check fstab before resuming the boot.

## Files

# The line Théo added to /etc/fstab (a comment)
stuck-boot-fstab-comment = # USB disk for the scans (Theo, from a tutorial I followed on my laptop)
# { $banniere }: the emergency mode message, in English as on the real console
stuck-boot-message-odile =
    A message from Odile (Tuesday 25 January, 7:50 am):

    "The website has been down since last night! The host says the
    server rebooted for an update (a new kernel), and that it “stopped in
    emergency mode”. They opened their console for us: it's as if we were
    in front of the server's screen, as root. Here is what it says:

    { $banniere }

    Last week Théo plugged in his USB disk, the one with the scans of the
    old negatives, and added it “so that it mounts by itself”. He
    sometimes takes it to the club to scan. Is that related?"

## Events

stuck-boot-event-journal =
    systemd waited 90 seconds for /dev/sdc1, then gave up: without it,
    /srv/scans can't be mounted, and local-fs.target (all the local file
    systems) fails. The machine then stops in emergency mode, without
    starting its services. But who is sdc today? (lsblk -f, blkid)
stuck-boot-event-disks =
    sdc is one of the two 4 TB disks, which joined md2 in the previous
    chapter: it doesn't even have a partition any more. Théo's USB disk is
    now called sde (RM = 1: removable), and its partition carries the
    label SCANS. The sdX names follow the order in which the kernel finds
    the disks; the UUID does not change.
stuck-boot-event-name =
    /dev/sde1 would work today… until the next disk is added, or the next
    boot where the USB disk is found before another one. Like the first
    two lines of fstab, refer to it by what does not change: UUID=… (or
    LABEL=…).
stuck-boot-event-deleted =
    Without its line in fstab, the server would boot… but Théo's scans
    would never be mounted again. Keep the line, and fix it.
stuck-boot-event-read =
    fstab now has an unreadable line (it needs at least four fields:
    source, mount point, type, options): mount -a reports it, and the boot
    would ignore it. Read the file again.
stuck-boot-event-without-nofail =
    The UUID is right. But Théo sometimes takes the disk away: that day,
    the server would stop in emergency mode again. The nofail option (man
    fstab) tells systemd to carry on without it.
stuck-boot-event-fixed =
    fstab is right: the scans disk by its UUID, with nofail. Before
    resuming the boot, check it (findmnt --verify), try it (mount -a), and
    have systemd reread it: it derived its mount units from the old
    version (systemctl daemon-reload).
stuck-boot-event-relapse =
    The boot resumed… and stopped in emergency mode again: systemd is
    still waiting for a disk that can't be found. Fix fstab first.
stuck-boot-event-relapse-reload =
    The boot resumed… and stopped in emergency mode again: fstab is right,
    but systemd still uses the old version, the one it read at boot.
    systemctl daemon-reload makes it reread it.
stuck-boot-event-mounted =
    The scans disk is mounted on /srv/scans (df -h, findmnt). What's left
    is leaving emergency mode: resume the normal boot (man systemctl:
    default, or exit), or reboot.
stuck-boot-event-end =
    Odile: "The website is back! And Théo has his scans again. He says
    he'll never copy a tutorial again without understanding it."

    Well done! You finished chapter 4, and the story of The Lab.

    WHAT HAPPENED
    A line of /etc/fstab referred to the USB disk by its name, /dev/sdc1.
    The two 4 TB disks added in chapter 3 took the names sdc and sdd; the
    USB disk became sde. At reboot, systemd waited for /dev/sdc1, then
    stopped the machine in emergency mode. You found the disk by its UUID,
    fixed fstab with nofail, checked it, had systemd reread the file, and
    resumed the boot.

    GOOD PRACTICE
    - In fstab, UUID=… or LABEL=…, never /dev/sdX.
    - nofail for any disk that may be missing (USB, external disk);
      x-systemd.device-timeout=10s so as not to wait 90 seconds.
    - After every change: findmnt --verify, mount -a, then systemctl
      daemon-reload, before rebooting.
    - Emergency mode is not a breakdown: a root shell, the journal
      (journalctl -xb), and what you need to repair. Get the host's console
      access before you need it.
    - Keep a record of what you add to the server, and why.

    DOCUMENTATION
    - fstab: https://man7.org/linux/man-pages/man5/fstab.5.html
    - systemd.mount (nofail, x-systemd.*): https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - findmnt: https://man7.org/linux/man-pages/man8/findmnt.8.html
    - fstab on Debian: https://wiki.debian.org/fstab
