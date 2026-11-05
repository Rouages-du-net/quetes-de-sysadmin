### The graduated hints of the story "The Photo Club": a lead, then almost
### the answer, for each step (see src/engine/hints.ts).

## Chapter 1 — The Shared Folder

hint-nfs-export-exports =
    .lead = What does the NAS share over NFS, and with whom? (/etc/exports, man exports)
    .solution = In /etc/exports: /srv/photos  192.0.2.32(rw,sync,no_subtree_check)
hint-nfs-export-loaded =
    .lead = The file is read when the server starts, or on request (man exportfs: -r, -a, -v).
    .solution = sudo exportfs -ra, then sudo exportfs -v.
hint-nfs-export-firewall =
    .lead = Does NFS get through the NAS's firewall? (man ufw; NFSv4: port 2049)
    .solution = sudo ufw allow from 192.0.2.32 to any port 2049 proto tcp
hint-nfs-export-mounted =
    .lead = On the darkroom computer (ssh darkroom): a mount point, then mount (man mount, man nfs).
    .solution = sudo mkdir /mnt/photos, then sudo mount -t nfs nas.internal:/srv/photos /mnt/photos
hint-nfs-export-end =
    .lead = For it to come back after a reboot: /etc/fstab on the darkroom computer (man fstab).
    .solution = nas.internal:/srv/photos  /mnt/photos  nfs  defaults,_netdev  0  0 (sudo mount -a to check)

## Chapter 2 — Whose Files?

hint-nfs-owners-numbers =
    .lead = Who is who, in numbers, on each machine? (man id, man ls: -n)
    .solution = id sam on the NAS (1002) and on the darkroom computer (1001); 1001 is nora on the NAS.
hint-nfs-owners-squash =
    .lead = Why doesn't sudo help on the darkroom computer? (man exports: root_squash)
    .solution = root becomes nobody on the NAS: that's root_squash, keep it.
hint-nfs-owners-uid =
    .lead = Give Sam the NAS's number on the darkroom computer (man usermod: -u); his session must be closed first.
    .solution = On darkroom: sudo pkill -u sam, then sudo usermod -u 1002 sam.
hint-nfs-owners-end =
    .lead = The scans copied before still carry Nora's number on the NAS (man chown: -R).
    .solution = On the NAS: sudo chown -R sam:club /srv/photos/2028-film-scans

## Chapter 3 — The Laptops

hint-samba-share-share =
    .lead = A share is a section of smb.conf (man smb.conf: path, read only, valid users).
    .solution = In /etc/samba/smb.conf: [photos], path = /srv/photos, read only = no, valid users = @club; then sudo testparm -s.
hint-samba-share-passwords =
    .lead = Samba has its own passwords (man smbpasswd: -a).
    .solution = sudo smbpasswd -a sam (negative-2028), sudo smbpasswd -a nora (slide-2028).
hint-samba-share-masks =
    .lead = With what rights does Samba create files? (man smb.conf: create mask, directory mask, force group)
    .solution = create mask = 0664, directory mask = 2775, force group = club in [photos].
hint-samba-share-end =
    .lead = And the laptops on the Wi-Fi: does SMB get through the firewall? (man ufw; port 445, application Samba)
    .solution = sudo ufw allow from 192.0.2.0/24 to any app Samba
