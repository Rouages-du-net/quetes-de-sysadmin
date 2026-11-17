### Story "Next Door Windows", chapter "The Share Next Door": a Windows
### server's SMB share mounted on Linux (mount -t cifs), its credentials,
### its owners and its line in /etc/fstab. Commands, options, paths and
### tool outputs are not translated.

chapter-smb-mount = The Share Next Door
    .summary = Plotter must save its PDFs on the Windows server's share: mount it on Linux with a credentials file, make it writable for the service, and write the fstab line that survives a boot without the server.

## Files

smb-mount-email-ifeoma =
    From:  Ifeoma
    To:    you

    Hello!

    Plotter, the service on compass that exports our drawings to PDF
    every morning (it runs as the account plotter), should put the PDFs
    on cabinet, in the "plans" share, folder exports: that's where
    everyone looks for them. Until now it kept them on compass, and we
    copied them by hand.

    Priya left her notes (notes-priya.txt): the share, the account she
    made for compass, the password. Could you mount the share on compass,
    in /mnt/plans, so that Plotter can write there, and so that it comes
    back by itself after a reboot? Careful: cabinet restarts some Tuesday
    nights for Windows Update, and compass must still boot if cabinet is
    down at that moment.

    Henrik says that on his old NAS he always had to add vers=1.0. No idea
    what it means.

    Ifeoma

smb-mount-notes-priya =
    For compass (Priya, 28 October 2029)

    File server: cabinet.internal (Windows Server 2022)
    Share for compass: plans  (D:\Shares\plans on the server)
    Account: compass-svc   password: Ruler-2029-cab
             (a local account of cabinet; it may change files in plans)
    The share also has a folder exports, for Plotter.

    SMB1 is disabled on cabinet, on purpose. SMB 3 is fine.
    Don't leave this password lying around once it's in place.

## Events

smb-mount-event-listed =
    cabinet's shares: plans and scans, and the ones ending with $ (ADMIN$,
    C$, D$, IPC$), which Windows creates for its administrators. "SMB1
    disabled": smbclient spoke SMB 3, and there's no NetBIOS browsing.
    Now, rather than smbclient's one-off session, a mount: man mount.cifs.
smb-mount-event-helper-missing =
    mount knows the type cifs, but it needs its helper, /sbin/mount.cifs,
    which reads the options, asks for the password and hands the rest to
    the kernel. It comes in a package that isn't installed: cifs-utils.
smb-mount-event-helper =
    cifs-utils is installed: mount -t cifs (and mount.cifs) can work now.
smb-mount-event-smb1 =
    "Host is down": cabinet didn't refuse with a message, it cut the
    connection. vers=1.0 asks for SMB1, the 1980s protocol behind the
    WannaCry worm in 2017; Windows Server no longer installs it since
    2019, and Priya keeps it off. Henrik's old NAS spoke only SMB1; cabinet
    speaks SMB 3. Leave vers= out (the kernel picks the best one), or ask
    for vers=3.0 or 3.1.1.
smb-mount-event-denied =
    "Permission denied" (error 13): cabinet refused the account or the
    password. Check username= and password (in Priya's notes), and that
    you are asking cabinet.
smb-mount-event-password-visible =
    It works, but that password is now in your shell's history (history),
    and for as long as mount.cifs ran, anyone on compass could read it in
    ps or /proc/PID/cmdline. Put the account and its password in a file
    that only root reads (man mount.cifs: credentials=), and refer to it.
smb-mount-event-mounted =
    The share is mounted: /mnt/plans is cabinet's D:\Shares\plans. Look at
    who owns what in it (ls -l), and ask yourself who Plotter runs as.
smb-mount-event-root-owned =
    Everything in /mnt/plans belongs to root, with rights 755: Plotter (the
    account plotter) can read, not write. A Windows server has no Unix
    owners to give: the Linux client shows those of the mount's options,
    root and 0755 by default. They are chosen when mounting (man
    mount.cifs: uid=, gid=, file_mode=, dir_mode=).
smb-mount-event-chown =
    chown and chmod said nothing, and nothing changed: on a share from a
    Windows server, the owner and the rights shown come from the mount's
    options, not from the files. Remount with uid= and gid= (umount, then
    mount again).
smb-mount-event-writable =
    plotter can write in /mnt/plans now: the mount presents the share as
    its own. On cabinet, it is still compass-svc that writes, with that
    account's rights on the share.
smb-mount-event-world-readable =
    That credentials file can be read by others than root: the password of
    compass-svc would be readable by every account on compass. chmod 600,
    owned by root.
smb-mount-event-credentials =
    The credentials file is right: root's, rw------- (600), with the account
    and its password, and nothing else on the command line.
smb-mount-event-no-nofail =
    Without nofail, a boot during which cabinet is unreachable waits for
    the mount and marks it failed (and what requires it with it). With
    nofail, compass boots anyway, and mount -a mounts it later. _netdev
    says it's a network file system: wait for the network first.
smb-mount-event-fstab-password =
    /etc/fstab can be read by every account on compass: no password in
    there. credentials= points to the file only root reads.
smb-mount-event-fstab =
    The fstab line is right: cabinet's plans share on /mnt/plans, the
    credentials file, the owners Plotter needs, _netdev and nofail. Try
    it: umount /mnt/plans, then mount -a (or mount /mnt/plans).
smb-mount-event-end =
    Ifeoma: "This morning's PDFs are in exports! And Henrik learnt what
    vers=1.0 meant. Thank you."

    Well done! You have finished the chapter "The Share Next Door".

    WHAT HAPPENED
    cabinet shares its folders over SMB, Windows' file-sharing protocol.
    Linux mounts them with the kernel's cifs client and its helper,
    mount.cifs (package cifs-utils). You listed the shares with smbclient,
    mounted plans with a credentials file rather than a password on the
    command line, gave the files the owner Plotter needed (uid=, gid=:
    a Windows server has no Unix owners to show), and wrote the fstab
    line with _netdev and nofail.

    GOOD PRACTICE
    - The password in a file of root's, mode 600 (credentials=), never in
      a command line (history, ps) nor in /etc/fstab (readable by all).
    - An account made for the server (compass-svc), with only the rights
      it needs on the share.
    - uid=, gid=, file_mode=, dir_mode=: who the files belong to on Linux
      is decided when mounting; chown and chmod change nothing there.
    - Never vers=1.0: SMB1 is obsolete and dangerous; let the kernel
      choose (SMB 3.1.1 with a recent Windows), or ask for vers=3.0.
    - In fstab, _netdev and nofail for a network share: the boot doesn't
      depend on another machine. Test the line with umount, then mount -a.

    ANOTHER WAY
    x-systemd.automount mounts the share on first access instead of at
    boot (and remounts it if cabinet came back later). For a share that
    several Linux users reach with their own Windows accounts, see the
    multiuser option and Kerberos (sec=krb5) in mount.cifs(8).

    DOCUMENTATION
    - mount.cifs(8): https://manpages.debian.org/mount.cifs.8
    - The kernel's cifs client: https://www.kernel.org/doc/html/latest/admin-guide/cifs/usage.html
    - SMBv1 on Windows: https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3
    - systemd.mount, _netdev and nofail: https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
