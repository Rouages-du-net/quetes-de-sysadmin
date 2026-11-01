### Graded hints for The Archives (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in noms.ftl.

## Chapter 1 — The Archives

hint-archives-cleanup =
    .piste = The collection does not fit on the 64 MB stick. du shows where the space goes, and Rosa mentions temporary files (.tmp) that can be thrown away: find can track them down in every subdirectory, and delete them.
    .solution = find collection -name "*.tmp" to see them, then find collection -name "*.tmp" -delete (with the -name, or everything goes).
hint-archives-saved =
    .piste = The clean-up is done: now put the whole collection into ONE compressed archive, written straight onto the stick (/media/usb). See man tar: -c creates, -z compresses, -f names the archive.
    .solution = tar -czf /media/usb/collection.tar.gz collection (then tar -tzf /media/usb/collection.tar.gz to check).

## Chapter 2 — The versions

hint-versions-restored =
    .piste = Marie's diary was damaged a few nights ago; older snapshots still hold the good version. restic find --long shows when the file changed, snapshots gives the IDs, and dump (or restore) brings a file back out of a snapshot. Every command needs -r and --password-file (notes_restic.txt).
    .solution = restic -r /mnt/townhall/restic-library --password-file ~/.config/restic/password snapshots, then, with the same options and the ID of a snapshot from 1 February or earlier: restic … dump ID /home/you/collection/manuscripts/marie_diary.txt > ~/collection/manuscripts/marie_diary.txt
hint-versions-place =
    .piste = Thirty snapshots fill the town hall's disk. forget removes snapshots according to a policy (--keep-daily, --keep-weekly…), but only prune frees the space. Keep at least one snapshot with the good version, and try --dry-run first.
    .solution = restic (with -r and --password-file) forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune (then df -h /mnt/townhall to see the space freed).
hint-versions-end =
    .piste = Two more things: the password file can be read by every account (ls -l), and after a prune you check that the repository is intact (man restic).
    .solution = chmod 600 ~/.config/restic/password, then restic (with -r and --password-file) check (it should say "no errors were found").
