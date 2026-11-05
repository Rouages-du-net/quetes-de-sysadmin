### Story "The Photo Club", chapter 1 "The Shared Folder": an NFS export
### (/etc/exports, exportfs), the firewall, mount -t nfs and fstab.
### Configuration, paths and the tools' outputs are not translated.

chapter-nfs-export = The Shared Folder
    .summary = The club's photos live on the NAS. The darkroom computer should see them as one of its own folders, and still see them after a reboot.

## Files

nfs-export-message-margot =
    From:     Margot
    To:       you
    Subject:  The photos on the darkroom computer

    Hello,

    Welcome to the club's machines! The NAS (where you are) keeps all our
    photos in /srv/photos. In the darkroom, there is a computer
    (darkroom, you reach it with ssh darkroom from here) where we edit
    and print.

    Today, we copy the photos back and forth on USB sticks. I'd love the
    darkroom computer to see the NAS's folder in /mnt/photos, as if it
    were its own, and that it's still there after a reboot.

    Only the darkroom computer, please: the NAS is on the club's network,
    where the visitors' laptops are too.

    Your sudo password (on both machines): shutter-2028.

    Margot

## Events

nfs-export-event-exports =
    /etc/exports is the NAS's list of what it shares over NFS, and with
    whom: one line per folder, then each client with its options in
    parentheses, without a space before them (man exports):
    /srv/photos 192.0.2.32(rw,sync,no_subtree_check). Without rw, an
    export is read-only.
nfs-export-event-not-loaded =
    The line is in /etc/exports, but the NAS still serves its old list:
    the server reads the file when it starts, or when you ask it to
    (sudo exportfs -ra; exportfs -v shows what it serves).
nfs-export-event-loaded =
    The NAS now serves /srv/photos to the darkroom computer (exportfs -v).
    Over to the client: ssh darkroom, then mount (man mount, man nfs).
nfs-export-event-too-open =
    Careful: this export is for everyone (*), or with no_root_squash. The
    visitors' laptops could mount it, and root on a client would be root
    on the photos. Export to the darkroom computer only, and keep
    root_squash (the default).
nfs-export-event-no-mount-point =
    A mount needs an existing directory to attach to: create /mnt/photos
    first (sudo mkdir).
nfs-export-event-firewall =
    The mount waits, then gives up: nothing answers. The NAS's firewall
    only lets SSH in, and NFS (port 2049) is dropped. Open it for the
    darkroom computer only (man ufw). showmount also asks rpcbind (port
    111); mount alone, in NFSv4, only needs 2049.
nfs-export-event-denied =
    The NAS answers, and refuses: its export list doesn't include this
    client (or still the old one). Check what it serves: sudo exportfs -v
    on the NAS, and the address of the darkroom computer.
nfs-export-event-mounted =
    /mnt/photos shows the NAS's photos (df -h, mount | grep nfs). Until
    the next reboot: for it to come back, /etc/fstab on the darkroom
    computer must describe it (man fstab; _netdev waits for the network).
nfs-export-event-read-only =
    It's mounted, but read-only: an export without rw is ro. Add rw to the
    export's options on the NAS, then sudo exportfs -ra.
nfs-export-event-end =
    The darkroom computer sees the photos in /mnt/photos, and fstab will
    bring them back at every boot. Margot: "No more USB sticks! Sam is
    already printing from the NAS."

    Well done! You have finished the chapter "The Shared Folder".

    WHAT HAPPENED
    The NAS exported nothing (Debian's /etc/exports is all comments), and
    its firewall dropped NFS. An export for the darkroom computer only,
    the firewall opened to it, a mount, and a line in fstab.

    NFS IN SHORT
    - On the server: /etc/exports (folder, clients, options), then
      exportfs -ra; exportfs -v lists what is served.
    - On the client: mount -t nfs server:/folder /point; in /etc/fstab:
      server:/folder /point nfs defaults,_netdev 0 0.
    - NFSv4 needs only port 2049 (TCP).

    GOOD PRACTICE
    - Export to named clients or a small network, never to *.
    - Keep root_squash: root on a client becomes nobody on the server.
    - NFS with sec=sys trusts the client about who is who: only machines
      you manage. For more, Kerberos (sec=krb5).

    DOCUMENTATION
    - exports(5): https://man7.org/linux/man-pages/man5/exports.5.html
    - nfs(5): https://man7.org/linux/man-pages/man5/nfs.5.html
    - Debian: https://wiki.debian.org/NFSServerSetup
