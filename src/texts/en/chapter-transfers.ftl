### Story "The Community Centre", chapter "Transfers":
### copying files between machines (scp, rsync). The commands, the
### options, the paths and the tools' messages (in English) are not
### translated.

chapter-transfers = Transfers
    .summary = Fetch a file from the wiki onto your workstation (scp), then bring the backup on archives up to date (rsync).

## Files

transfers-email-yasmine =
    From:    Yasmine
    To:      you
    Subject: Before the general meeting

    The general meeting is on Saturday! Two things before that:

    1. The annual report is on the wiki:
       /srv/wiki/exports/report-2027.pdf. Could you fetch it onto YOUR
       workstation? I'll print it from your place. (man scp; the shortcut
       you wrote for the wiki works for scp too.)

    2. The backup of the shared directory (/srv/share, here on community) hasn't
       been done since last year. It goes on archives, in
       /srv/backups/share: the same files, in the same places.
       Gaspard used rsync, from community: it only copies what has
       changed (man rsync). He even created a key just for that,
       ~/.ssh/id_backup (look at ~/.ssh/config, here).

    Gaspard tells me on the phone: "Watch out for the trailing slash
    on the source, with rsync. And try with -n first."

transfers-minutes-agm-2026 =
    General meeting 2026 — minutes

    Present: 34 associations out of 41.
    Annual report adopted unanimously. Budget adopted (2 abstentions).
    Project of the year: a shared wiki for all the associations.
transfers-minutes-board-2027-09 =
    Board meeting — September 2027

    Item 1: the Centre's IT is taken over by a new
    volunteer. Gaspard can still be reached by phone.
    Item 2: the general meeting will take place on Saturday 9 October.
transfers-schedule =
    Room bookings — October 2027

    Room 1: choir (Tuesday 7pm), chess club (Thursday 6pm)
    Room 2: bike workshop (Saturday 10am)
    Main hall: general meeting (Saturday 9 October, 2pm)

## Events

transfers-event-report =
    The annual report is on your workstation: scp went through community (the
    ProxyJump of your shortcut), just like ssh.
# { $directory }: the extra directory that was created
transfers-event-nested =
    Look on archives: there is now a directory { $directory }. Without
    a trailing slash, rsync copied the DIRECTORY share into the
    backup, instead of its CONTENTS.

    Start again with /srv/share/. And to remove the extra directory,
    rsync can delete on the other side what doesn't exist at the source: the
    --delete option (man rsync). Powerful, so do a dry run first, with -n.
transfers-event-backup =
    The backup on archives is up to date: every file from /srv/share is
    there, in the same place. Run the same command again: rsync has nothing
    left to copy.
transfers-event-end =
    The report is on your workstation, and the backup on archives is up to date.
    Yasmine: "Thanks! Gaspard says well done too, he saw your backup."

    Well done! You've finished "The Community Centre".

    WHAT HAPPENED
    scp copies files over the same encrypted connection as ssh, with the
    same keys and the same shortcuts (~/.ssh/config, ProxyJump). rsync
    goes through ssh too; but it first compares both sides and only sends
    what has changed: ideal for a backup you redo often.

    GOOD PRACTICE
    - The trailing slash on the source matters, with rsync:
      /srv/share/ copies the contents, /srv/share copies the directory.
    - Always do a dry run first (rsync -n, or --dry-run), especially
      with --delete, which deletes on the other side what no longer exists at the source.
    - A dedicated key for each automated task (id_backup), not
      a person's key; on the server, you can restrict it further
      in authorized_keys (restrict option).
    - Never FTP or telnet: they send passwords in
      clear text over the network. scp, sftp and rsync go through ssh.

    DOCUMENTATION
    - scp: https://man.openbsd.org/scp
    - rsync: https://download.samba.org/pub/rsync/rsync.1
    - authorized_keys, restrict option: https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
