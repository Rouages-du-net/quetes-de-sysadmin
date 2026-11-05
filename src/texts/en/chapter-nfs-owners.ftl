### Story "The Photo Club", chapter 2 "Whose Files?": NFS carries numbers
### (uid, gid), root_squash, usermod -u, chown. Configuration, paths and the
### tools' outputs are not translated.

chapter-nfs-owners = Whose Files?
    .summary = Sam's scans, copied from the darkroom computer, belong to Nora on the NAS, and Sam can no longer change his own albums. Find out why, and fix it for good.

## Files

nfs-owners-message-margot =
    From:     Margot
    To:       you
    Subject:  Sam's scans belong to Nora??

    Hello,

    Since last week, Sam scans his films on the darkroom computer and
    copies them into /mnt/photos/2028-film-scans. But on the NAS, ls -l
    says they belong to Nora! Nora is puzzled, Sam is furious.

    And it's worse: from the darkroom computer, Sam can no longer touch
    up his own photos of 2028-outings. He tried with sudo, and got
    "Permission denied" anyway.

    Sam is still logged in on the darkroom computer, editing (darktable).
    Same sudo password: shutter-2028.

    Margot

## Events

nfs-owners-event-numbers =
    Over NFS (sec=sys), the server doesn't know names: the client sends
    numbers (uid, gid), and each machine shows them with its own names. Sam
    is 1001 on the darkroom computer, 1002 on the NAS; and 1001, on the NAS,
    is Nora. Compare: id sam on each machine (or ls -n, which shows the
    numbers).
nfs-owners-event-squash =
    sudo doesn't help: with root_squash (the default), root on a client
    becomes nobody (65534) on the NAS, and nobody can't write here. It's a
    protection: never no_root_squash for that. The way out is to have Sam
    be Sam everywhere.
nfs-owners-event-no-root-squash =
    no_root_squash gives root on the darkroom computer every right on the
    NAS's photos: anyone who is root on a client (or plugs in a laptop with
    that address) could erase or change everything. Put root_squash back,
    and give Sam the same uid on both machines instead.
nfs-owners-event-busy =
    usermod won't change the uid of an account that is in use: Sam is
    logged in on the darkroom computer (ps -u sam). Ask him to save and log
    out, or end his session yourself (pkill -u sam), then try again.
nfs-owners-event-taken =
    1001 is Nora's on the NAS: changing Sam's uid on the NAS would collide.
    The NAS has the most files and the most accounts; align the darkroom
    computer on it (Sam is 1002 there).
nfs-owners-event-uid =
    Sam has the same number on both machines now: from the darkroom
    computer, his albums are his again. What remains: the scans already
    copied, which carry 1001 on the NAS: Nora's number, and her group's.
    Give them back to Sam and the club, on the NAS (man chown: -R,
    owner:group).
nfs-owners-event-end =
    Sam is 1002 everywhere, his scans are his, and he can touch up his
    albums from the darkroom computer. root stays squashed. Margot: "Nora
    and Sam are friends again. I'll keep a list of the uids, promise."

    Well done! You have finished the chapter "Whose Files?".

    WHAT HAPPENED
    Sam's account was created first on the darkroom computer (1001), after
    Nora's on the NAS (1001 too). NFS with sec=sys only carries numbers:
    for the NAS, 1001 is Nora, whatever the client calls it.

    THE SAME NUMBERS EVERYWHERE
    - id sam on each machine, ls -n to see the numbers.
    - usermod -u 1002 sam (the account must not be in use; files of the
      home directory follow; groupmod -g for the group), then chown on
      the server for what was written with the wrong numbers.
    - For many machines: a directory (LDAP, see "The Directory") so that
      every machine has the same uids, or NFSv4 with Kerberos and idmapd
      (names instead of numbers).

    GOOD PRACTICE
    - Keep root_squash; no_root_squash only for a machine you trust
      completely, for a precise need (a backup server, diskless clients).
    - Plan the uids before the first account on each machine.

    DOCUMENTATION
    - exports(5), User ID Mapping: https://man7.org/linux/man-pages/man5/exports.5.html
    - usermod(8): https://man7.org/linux/man-pages/man8/usermod.8.html
