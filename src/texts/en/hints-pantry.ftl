### Graded hints for The Pantry (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer). Place names are those
### of names.ftl.

## Chapter 1 — The Lost Disk

hint-lost-disk-disk =
    .lead = Find the backup disk among the server's disks: which one is removable, what file system it carries, where it is mounted (man lsblk).
    .solution = lsblk, then lsblk -f: sdb1, ext4 labelled OFFSITE, mounted on /mnt/offsite.
hint-lost-disk-unmounted =
    .lead = A device can't be encrypted while it is mounted (man umount).
    .solution = sudo umount /mnt/offsite
hint-lost-disk-formatted =
    .lead = LUKS is set up with cryptsetup: its action that writes a new header on a device asks for YES in capitals, then a passphrase twice. Mei's passphrase is in her note (man cryptsetup).
    .solution = sudo cryptsetup luksFormat /dev/sdb1, then YES, then Mei's passphrase twice.
hint-lost-disk-filesystem =
    .lead = The encrypted device must be opened under a name, and the file system made on the clear device that appears in /dev/mapper (man cryptsetup, man mkfs.ext4).
    .solution = sudo cryptsetup open /dev/sdb1 offsite (Mei's passphrase), then sudo mkfs.ext4 /dev/mapper/offsite.
hint-lost-disk-keyfile =
    .lead = The nightly job needs a key file: random bytes (dd reads /dev/urandom), readable by root only, then added to another key slot (man dd, man chmod, man cryptsetup luksAddKey).
    .solution = sudo dd if=/dev/urandom of=/root/offsite.key bs=512 count=8, sudo chmod 400 /root/offsite.key, sudo cryptsetup luksAddKey /dev/sdb1 /root/offsite.key (Mei's passphrase).
hint-lost-disk-passphrase =
    .lead = One slot must open with the passphrase Mei keeps in the password manager: the one in her note (man cryptsetup luksAddKey).
    .solution = sudo cryptsetup luksAddKey /dev/sdb1 --key-file /root/offsite.key, then Mei's passphrase twice.
hint-lost-disk-crypttab =
    .lead = /etc/crypttab names the disk: the mapping's name, its LUKS UUID, the key file, and options for a removable disk (man crypttab; the UUID: cryptsetup luksUUID or blkid).
    .solution = sudo nano /etc/crypttab, add: offsite UUID=<the UUID of sdb1> /root/offsite.key luks,noauto
hint-lost-disk-fstab =
    .lead = The old fstab line mounts a label that no longer exists: it should mount the opened device instead, without making the boot wait (man fstab).
    .solution = sudo nano /etc/fstab, replace the LABEL=OFFSITE line with: /dev/mapper/offsite /mnt/offsite ext4 noauto,nofail 0 2
hint-lost-disk-copied =
    .lead = The disk is empty: open it, mount it, and copy the pantry's files from /srv onto it (man cryptdisks_start, man rsync).
    .solution = sudo cryptdisks_start offsite (if closed), sudo mount /mnt/offsite, sudo rsync -a /srv/pantry /mnt/offsite/
hint-lost-disk-closed =
    .lead = Before the disk leaves: unmount it, then close the encrypted device (man umount, man cryptsetup close or man cryptdisks_stop).
    .solution = cd (out of /mnt/offsite), sudo umount /mnt/offsite, sudo cryptsetup close offsite
hint-lost-disk-note =
    .lead = Mei's passphrase has no business on the server once it is in a slot.
    .solution = rm note_from_mei.txt
hint-lost-disk-end =
    .lead = Everything at once: LUKS with Mei's passphrase and a key file only root reads, crypttab (UUID, noauto) and fstab, the files on the disk, the disk closed, the note deleted.
    .solution = sudo cryptsetup luksDump /dev/sdb1 (two slots), cat /etc/crypttab /etc/fstab, sudo ls -l /root, lsblk (nothing open under sdb1), ls (no note).

## Chapter 2 — The Spare Key

hint-spare-key-opened =
    .lead = The disk is closed: open it the way crypttab describes it, then mount it as fstab does (man cryptdisks_start).
    .solution = sudo cryptdisks_start offsite, then sudo mount /mnt/offsite.
hint-spare-key-job =
    .lead = Read the nightly job: how does it tell restic where the repository is, and where the password is?
    .solution = sudo cat /usr/local/sbin/nightly-backup: RESTIC_REPOSITORY=/mnt/offsite/restic, RESTIC_PASSWORD_FILE=/root/.restic-pass.
hint-spare-key-snapshots =
    .lead = List the repository's snapshots, as root, with the repository and the password file the job uses (man restic; sudo resets the environment).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass snapshots (or sudo RESTIC_REPOSITORY=… RESTIC_PASSWORD_FILE=… restic snapshots).
hint-spare-key-one-key =
    .lead = restic has a command for the keys that open a repository (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key list: one key, its password on crate only.
hint-spare-key-escrowed =
    .lead = Add a way in whose password Mei keeps: the one in her note. Keep the job's key (man restic, key add).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key add, then Mei's password twice.
hint-spare-key-checked =
    .lead = After changing the repository's keys, check it (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass check
hint-spare-key-note =
    .lead = Mei's password must live off the server.
    .solution = rm note_from_mei.txt
hint-spare-key-closed =
    .lead = Leave the disk the way you found it: unmounted and closed (man cryptdisks_stop).
    .solution = sudo umount /mnt/offsite, then sudo cryptdisks_stop offsite.
hint-spare-key-end =
    .lead = Everything at once: two keys (the job's and Mei's), a check after adding hers, no copy of her password on crate, the disk closed.
    .solution = key list (two keys), check, rm the note, umount, cryptdisks_stop.

## Chapter 3 — The Restore Drill

hint-restore-drill-plugged =
    .lead = The drill happens on the borrowed laptop: connect to it, then find the disk and its type (man ssh, man lsblk).
    .solution = ssh spare, then lsblk -f: sdb1 crypto_LUKS.
hint-restore-drill-opened =
    .lead = Open the encrypted disk with the passphrase in Fatou's message, the envelope's (man cryptsetup open).
    .solution = sudo cryptsetup open /dev/sdb1 offsite, then the disk's passphrase.
hint-restore-drill-mounted =
    .lead = Mount the opened device on an empty directory of your choice (man mkdir, man mount).
    .solution = sudo mkdir /mnt/offsite, then sudo mount /dev/mapper/offsite /mnt/offsite.
hint-restore-drill-snapshots =
    .lead = Open the repository with the envelope's restic password, typed when restic asks (man restic).
    .solution = sudo restic -r /mnt/offsite/restic snapshots, then the restic recovery password.
hint-restore-drill-read-data =
    .lead = Check the repository, reading back every byte of its data, not only its structure (man restic, check).
    .solution = sudo restic -r /mnt/offsite/restic check --read-data
hint-restore-drill-restored =
    .lead = Restore the last snapshot beside, under a directory of your choice (man restic, restore).
    .solution = sudo restic -r /mnt/offsite/restic restore latest --target /srv/restore
hint-restore-drill-verified =
    .lead = The job wrote the files' fingerprints in SHA256SUMS: check them from the directory where it was restored (man sha256sum).
    .solution = cd /srv/restore/srv/pantry, then sha256sum -c SHA256SUMS.
hint-restore-drill-no-dump =
    .lead = The checklist's line 6: look for the database's dump in the backups (man restic, find).
    .solution = sudo restic -r /mnt/offsite/restic find pantry.sql: nothing.
hint-restore-drill-fixed =
    .lead = On crate, the job must back up the dump too: its restic backup line names only one directory.
    .solution = exit (back to crate), sudo nano /usr/local/sbin/nightly-backup: restic backup /srv/pantry /var/backups/pantry.sql
hint-restore-drill-closed =
    .lead = On spare, leave the disk unmounted and closed (man umount, man cryptsetup close).
    .solution = ssh spare, cd, sudo umount /mnt/offsite, sudo cryptsetup close offsite.
hint-restore-drill-end =
    .lead = Everything at once: on spare, the disk opened with the passphrase, the repository with the envelope's password, check --read-data, the files restored and verified, nothing copied from crate, the disk closed; on crate, the job backs up the dump.
    .solution = Redo what is missing on spare (ssh spare), and check /usr/local/sbin/nightly-backup on crate.
