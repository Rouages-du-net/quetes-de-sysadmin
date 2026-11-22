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

## What the three chapters share, kept here so that it loads with the
## story: the mail that arrives on slipway (subjects, bodies, the words each
## kind of mail is made of). A list is separated by |. rspamd's Bayes
## learns these words: the spam's and the ham's lists must not overlap.

lifeboat-month-names = January | February | March | April | May | June | July | August | September | October | November | December
lifeboat-visit-months = November | December | March | April
lifeboat-schools = Harbour Primary | St Brendan's | Northcliff Scouts | Seaholme Sea Cadets | Westbay Academy | the Rockpool Nursery | Cliffside Rangers
lifeboat-words-ham = visit | station | group | children | saturday | boathouse | crew | training | launch | rota | volunteers | donation | raffle | tour | teachers | lunch | parking | harbour | lifejackets | drill | tide | thanks | morning | afternoon | tickets | gift | shop | coffee | minibus
lifeboat-crew-whats = launch | training | drill | tractor practice
lifeboat-crew-days = Saturday | Sunday | Wednesday
lifeboat-mail-booking-subject = Visit request: { $school }, { $day } { $month }
lifeboat-mail-booking-body =
    Hello,

    We would love to bring a group from { $school } to visit the station and the boathouse, around { $children } children and four teachers. Could we book a tour on the { $day }th, in the morning if the tide allows? We can bring our own lunch.

    Notes: { $notes }.

    Thanks so much,
    { $name }
lifeboat-mail-crew-subject = Crew rota: { $what } on { $day }
lifeboat-mail-crew-body =
    Hi all,

    The rota for the next { $what } is up on the board at the station. Please check your lifejackets and tell me if you can't make it.

    Notes: { $notes }.

    { $name }

lifeboat-words-phish = verify | account | suspended | mailbox | password | immediately | confirm | login | security | deactivation | storage | quota | upgrade | validate | credentials | restore | access | expire
lifeboat-mail-phish-name = Mail Administrator
lifeboat-mail-phish-subjects = Action required: your mailbox will be suspended | Mailbox storage limit reached | Confirm your account to avoid deactivation
lifeboat-mail-phish-body = <html><body><p>Dear { $name },</p><p>Your { $domain } mailbox has reached its storage limit and will be suspended. { $words }.</p><p><a href="{ $link }">Verify your account</a></p><p>{ $domain } Mail Administrator</p></body></html>
lifeboat-words-invoice = invoice | payment | overdue | outstanding | remittance | transfer | settle | amount | balance | penalty | reference | urgent | accounts | final | notice
lifeboat-mail-invoice-name = Accounts
lifeboat-mail-invoice-subjects = INVOICE OVERDUE - FINAL NOTICE | PAYMENT REMINDER - URGENT ACTION | OUTSTANDING BALANCE NOTICE
lifeboat-mail-invoice-body = <html><body><p>Hello,</p><p>Please find attached the final notice for the overdue invoice { $number }. { $words }.</p><p>Accounts Department</p></body></html>
lifeboat-words-prize = winner | prize | claim | reward | crypto | wallet | bonus | jackpot | lucky | draw | selected | congratulations | exclusive | voucher | free
lifeboat-mail-prize-name = Lucky Draw
lifeboat-mail-prize-subjects = You have WON! | Claim your crypto bonus now! | Your exclusive reward is waiting!
lifeboat-mail-prize-body = <html><body><img src="{ $image }"><p>Congratulations! You were selected in our { $draw } draw.</p><p><a href="{ $claim }">Claim your reward now</a></p><p>{ $words }</p><p><a href="{ $unsubscribe }">Unsubscribe</a></p></body></html>

lifeboat-mail-bulletin-subject = Coastwatch safety bulletin: weather and tides, { $day } { $month }
lifeboat-mail-bulletin-body = <html><body><img src="{ $image }"><p>Coastwatch safety bulletin, { $day } { $month }: gale warning for the outer bay from tonight, spring tides at the weekend, the forecast for the harbour.</p><p><a href="{ $link }">Read the full bulletin</a></p><p><a href="{ $unsubscribe }">Unsubscribe</a></p></body></html>

lifeboat-list-topics = winter training dates | the new pagers | insurance renewal | the regional open day | fuel prices
lifeboat-mail-list-name = Federation of coastal stations
lifeboat-mail-list-subject = {"["}stations{"]"} About { $topic }
lifeboat-mail-list-body =
    Dear stations,

    A short note about { $topic }: details at the next meeting.

    --
    stations mailing list
    stations@lists.coastfed.example

lifeboat-mail-attachment-body =
    Hi Saoirse,

    { $subject }: the files are attached.

    Attachment: { $file }
lifeboat-mail-photos-subject = Open day photos, batch { $n }
lifeboat-mail-poster-subject = Draft poster { $n }
lifeboat-mail-saoirse-subjects = Sponsorship form | Raffle prizes | Summer fair photos | Grant application | Boat naming ceremony
lifeboat-mail-sent-subject = Re: Summer fair, part { $n }
lifeboat-mail-sponsor-0-subject = Your sponsorship pack for the winter appeal
lifeboat-mail-sponsor-1-subject = Signed form for the boat naming
lifeboat-mail-sponsor-2-subject = Photos from the summer fair
lifeboat-mail-sponsor-3-subject = Grant: the documents you asked for
lifeboat-mail-sponsor-4-subject = Raffle prizes from the chandlery
lifeboat-mail-sponsor-0-body =
    Hello Saoirse,

    { $subject }: attached, as promised.

    Attachment: { $file }
    { $name }
lifeboat-mail-sponsor-1-body =
    Hello Saoirse,

    { $subject }: attached, as promised.

    Attachment: { $file }
    { $name }
lifeboat-mail-sponsor-2-body =
    Hello Saoirse,

    { $subject }: attached, as promised.

    Attachment: { $file }
    { $name }
lifeboat-mail-sponsor-3-body =
    Hello Saoirse,

    { $subject }: attached, as promised.

    Attachment: { $file }
    { $name }
lifeboat-mail-sponsor-4-body =
    Hello Saoirse,

    { $subject }: attached, as promised.

    Attachment: { $file }
    { $name }
    { $subject }: attached, as promised.

    Attachment: { $file }
    { $name }

lifeboat-mail-raffle-subject = The raffle tickets
lifeboat-mail-raffle-body =
    Hi Leilani,

    The raffle tickets are printed: shall I bring them on Saturday?

    { $name }
lifeboat-mail-shop-subject = Saturday at the shop
lifeboat-mail-shop-body =
    Hi Leilani,

    Can you open the shop on Saturday morning?

    { $name }
lifeboat-mail-tyres-subject = Invoice for the new tractor tyres
lifeboat-mail-tyres-body =
    Dear Aziz,

    Please find our invoice for the tractor tyres.

    { $name }
lifeboat-mail-fuel-subject = Receipt for the fuel
lifeboat-mail-fuel-body =
    Hello Aziz,

    Here is the receipt for the fuel of the last launch.

    { $name }
lifeboat-mail-year-end-subject = Year-end accounts
lifeboat-mail-year-end-body =
    Hello,

    Could the treasurer send us the bank statements for the year-end accounts?

    { $name }
lifeboat-mail-gift-aid-subject = Gift Aid claim
lifeboat-mail-gift-aid-body =
    Dear treasurer,

    The Gift Aid claim form needs a signature this month.

    { $name }

lifeboat-holiday-comment = Aziz, August 2030 (written by Yerlan): "tell them I'm away"
lifeboat-holiday-reply = I am away until 25 August. For anything urgent, write to Marisol.
