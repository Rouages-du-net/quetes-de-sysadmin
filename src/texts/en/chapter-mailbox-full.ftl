### Story "The Lifeboat", chapter "Mailbox Full": Saoirse's mailbox is over
### its quota and her mail bounces. Dovecot's quota (maildirsize, doveadm
### quota), the userdb, doveadm expunge with a search query, a quota
### warning. Commands, options, paths, settings and outputs are not
### translated.

chapter-mailbox-full = Mailbox Full
    .summary = Since Saturday, the lifeboat station's fundraiser receives nothing, and her sponsors get their messages back. Find out why the mail server refuses her mail, make room the right way, and make sure she is warned next time.

## Files

mailbox-full-message-marisol =
    From: Marisol (chair, Seaholme Lifeboat)
    Tuesday 16 September, 9:10

    Hello, and thank you for helping us!

    Saoirse, who runs our fundraising, hasn't received a single email
    since Saturday. Worse: Amara, from the chandlery that sponsors our
    winter appeal, forwarded me the message she got back, "Mail delivery
    failed". We are in the middle of the winter appeal.

    Our mail server is slipway, where you are now; sudo works with your
    password. Yerlan set it up years ago and left a note. The board agreed
    yesterday to give Saoirse 2 GB instead of 1, since she receives all the
    photos and the sponsors' documents; but please don't just open the
    floodgates for everyone.

    Marisol

mailbox-full-note-yerlan =
    Notes from Yerlan (slipway, 2028, some updates since)

    - Postfix receives the mail for lifeboat.example and gives it to
      Dovecot over LMTP (virtual_transport in /etc/postfix/main.cf).
      Everything is logged in /var/log/mail.log.
    - Dovecot stores each person's mail in /var/vmail/lifeboat.example/NAME/Maildir,
      owned by vmail. Folders are .Trash, .Sent… inside the Maildir.
    - The users are in /etc/dovecot/users (passwd-file: one line each, extra
      fields at the end, like userdb_something=value).
    - The configuration: /etc/dovecot/conf.d/*.conf. doveconf -n shows what
      Dovecot reads; after a change, sudo doveadm reload (or systemctl reload
      dovecot).
    - Everyone has 1G of quota (90-quota.conf). I used the Maildir++ quota,
      like the old server: the usage is kept in a file called maildirsize.
    - doveadm does everything as root: doveadm quota, doveadm mailbox,
      doveadm expunge… (man doveadm).

    Yerlan

## Events

mailbox-full-event-bounces =
    There it is: every message for saoirse@lifeboat.example ends with
    "552 5.2.2 … Quota exceeded (mailbox for user is full)", status=bounced,
    and Postfix sends a non-delivery notification back to the sender. Dovecot's
    LMTP refuses to save the message because her mailbox is over its quota.
    How full is it, and what takes the room? (man doveadm: quota get.)
mailbox-full-event-quota-get =
    The quota is counted in kilobytes: Value is what she uses, Limit what she
    may use. She is over 100 %. Once a mailbox is over its limit, Dovecot
    refuses every new message (the storage grace only lets one message
    cross the limit). Which of her folders take that room? (doveadm mailbox
    status with messages and vsize, or du on the Maildir.)
mailbox-full-event-trash =
    Her Trash holds hundreds of megabytes: the open day photos of 2029 and
    2030, deleted but never emptied. Doveadm can expunge the messages that
    match a search query, for one user and one mailbox (man doveadm,
    and man doveadm-search-query for the dates: savedbefore, before, 2w,
    YYYY-MM-DD…). Try the query with doveadm search first.
mailbox-full-event-lost =
    Her INBOX lost messages: deleting her mail wholesale is not making room,
    it is losing the sponsors' documents she still needs. Here, restart the
    chapter (or use the rescue snapshot) and remove only what is old and
    already in the Trash.
mailbox-full-event-unlimited =
    Someone now has no quota at all. An unlimited mailbox fills the disk one
    day, and then nobody receives anything. Marisol asked for 2 GB for
    Saoirse, not for everyone: keep a limit for each user.
mailbox-full-event-stale =
    The files are gone, but Dovecot still thinks the mailbox is full: with
    the Maildir++ quota, the usage lives in maildirsize, and Dovecot doesn't
    notice files removed behind its back. Deliveries keep bouncing. Ask
    Dovecot to count again (man doveadm: quota recalc), and next time remove
    mail through Dovecot (doveadm expunge), which keeps the count right.
mailbox-full-event-expunged =
    The old Trash is gone, her INBOX and Sent are whole, and the quota's
    count agrees with the files: there is room again. The next message to
    her will be saved.
mailbox-full-event-raised =
    Saoirse's limit is now what the board agreed, and only hers. A userdb
    extra field (userdb_quota_storage_size=2G in /etc/dovecot/users)
    overrides the configuration for one user; doveadm user and doveadm quota
    get show what Dovecot will apply.
mailbox-full-event-delivered =
    A message reached Saoirse's INBOX: "stored mail into mailbox 'INBOX'" in the log,
    status=sent on Postfix's side.
mailbox-full-event-warning =
    The quota warning is in the configuration Dovecot runs: when a mailbox
    crosses that percentage, Dovecot runs the quota-warning service, which
    writes to the user. It only fires at the moment the limit is crossed.
mailbox-full-event-end =
    Marisol: "Saoirse has twelve new messages, including Amara's sponsorship
    pack. I've told Amara to send it again; thank you!"

    Well done! You finished Mailbox Full.

    WHAT HAPPENED
    Saoirse's mailbox had reached its 1 GiB quota, mostly with an old Trash
    full of photos. Dovecot's LMTP refused every new message with "552 5.2.2
    Quota exceeded" and Postfix bounced them to their senders. You found the
    bounces in mail.log, measured the mailbox with doveadm, expunged the old
    Trash with a search query, gave Saoirse the agreed 2 GiB in the userdb
    rather than for everyone, and added a warning so that she is told before
    it is full again.

    GOOD PRACTICE
    - Read the log first: the reply code (552 5.2.2) and Dovecot's line say
      exactly who refused and why.
    - Remove mail through Dovecot (doveadm expunge -u USER mailbox Trash
      savedbefore 365d), test the query with doveadm search, and never delete
      files in a Maildir by hand: the quota and the indexes would be wrong
      (doveadm quota recalc fixes the count).
    - A quota per user, from the userdb; no unlimited mailboxes.
    - Warn before it is full (quota_warning), and consider quota_full_tempfail
      = yes: a full mailbox then defers mail (4.2.2) instead of bouncing it,
      giving you a few days to react.
    - For a new server, Dovecot recommends the count quota driver rather
      than Maildir++.

    DOCUMENTATION
    - The quota plugin: https://doc.dovecot.org/2.4.1/core/plugins/quota.html
    - doveadm quota: https://doc.dovecot.org/2.4.1/core/man/doveadm-quota.1.html
    - doveadm expunge: https://doc.dovecot.org/2.4.1/core/man/doveadm-expunge.1.html
    - Search queries: https://doc.dovecot.org/2.4.1/core/man/doveadm-search-query.7.html
    - passwd-file and its extra fields: https://doc.dovecot.org/2.4.1/core/config/auth/databases/passwd_file.html
