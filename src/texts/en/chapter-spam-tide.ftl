### Story "The Lifeboat", chapter "Spam Tide": spam reaches the INBOX while
### a legitimate safety bulletin is rejected. rspamd's scores and actions
### (rspamc symbols, rspamd.log, actions.conf), a whitelist (multimap or
### settings), Bayes (rspamc learn_spam, learn_ham). Commands, options,
### paths, symbols and outputs are not translated.

chapter-spam-tide = Spam Tide
    .summary = A tide of phishing and fake invoices reaches the station's secretary, while the coastguard's safety bulletin, which the crew reads before every launch, has stopped arriving. Read how the spam filter scores each message, put its thresholds back where they belong, trust the bulletin and only the bulletin, and teach the filter what spam looks like.

## Files

spam-tide-message-leilani =
    From: Leilani (secretary, Seaholme Lifeboat)
    Monday 6 October, 8:40

    Hi,

    Two things, and the second one matters most.

    1. My inbox is drowning: "your mailbox will be suspended", invoices
       from companies we've never heard of, prizes. I move them to Junk by
       hand every morning (two hundred of them by now), and new ones keep
       coming.

    2. The Coastwatch safety bulletin (news@coastwatch.example) stopped
       arriving in May. The crew reads it before every launch: gale
       warnings, tides. Coastwatch says their mails to us are "rejected as
       spam". The bookings I archived last year are in my Archive folder.

    Yerlan changed something in the spam filter in May, I think.

    Leilani

spam-tide-note-yerlan =
    Notes from Yerlan (rspamd on slipway)

    - rspamd scores every incoming message: Postfix hands it over through
      the milter (smtpd_milters = inet:localhost:11332 in main.cf).
    - Each rule that matches adds a symbol with a score; the total decides
      the action: no action, greylist, add header (the message gets
      "X-Spam: Yes" and Dovecot's global Sieve script files it into Junk),
      reject.
    - Never edit /etc/rspamd/*.conf: local changes go in
      /etc/rspamd/local.d/ (merged with the defaults) or override.d/
      (replacing them). Then rspamadm configtest, and sudo systemctl reload
      rspamd.
    - May 2031: everyone complained about the [SPAM] tags, so I moved the
      thresholds in local.d/actions.conf. It's quieter now.
    - rspamc talks to the running rspamd: rspamc symbols FILE shows the
      score of a message, rspamc stat the counters. Its log:
      /var/log/rspamd/rspamd.log.
    - Bayes is set up (Redis), but I never trained it.

    Yerlan

## Events

spam-tide-event-scores =
    Each line is a symbol and its score; the total and the action are at
    the top (or in "(default: F (no action): [4.80/8.00] […])" in
    rspamd.log). The phishing scores about 4.8 and the fake invoices 6.9:
    under every threshold Yerlan left, so they pass untouched. The
    bulletin scores 8.89, over reject = 8: it is refused at the door. What
    do the thresholds say? (local.d/actions.conf; man rspamc, man rspamadm.)
spam-tide-event-milter-off =
    Postfix no longer asks rspamd anything: every message, spam or not,
    goes straight to the mailboxes, and nobody even sees a score any more.
    The milter is the filter's only way in; put smtpd_milters back (and
    postfix reload).
spam-tide-event-reject-low =
    With reject that low, almost everything is refused, the bookings and
    the crew's mail included: a message from a friend scores around zero,
    sometimes a little more. A threshold is a balance: reject only what is
    certainly spam (15 by default), mark what is probably spam.
spam-tide-event-thresholds =
    The thresholds are sensible again: greylist, add header, reject in
    ascending order, far enough apart. The fake invoices and the prizes now
    get "X-Spam: Yes" and go to Junk. The phishing (4.8) is only
    greylisted: deferred once, it comes back five minutes later and still
    reaches the INBOX. The bulletin is no longer rejected, but it lands in
    Junk with the spam.
spam-tide-event-bulletin-junk =
    The last bulletin went to Leilani's Junk: at 8.89 it is over
    add_header. Look at its symbols: most of them come from the mailing
    platform it is sent through (sendwave.example: listed in a blocklist,
    tracking links), the same platform as the prize spam. Trust the
    bulletin's own address rather than the platform (man rspamc; the
    multimap and settings modules: docs.rspamd.com).
spam-tide-event-leak =
    Careful: that rule also lowers the score of the spam. The prize spam
    comes from sendwave.example too, with an SMTP sender at sendwave.example:
    trusting the platform (its domain or its addresses) lets its spam
    through. Trust news@coastwatch.example, the address in the From: header
    (multimap: type = "from" with extract_from = "mime"; settings: from_mime),
    and nothing else.
spam-tide-event-whitelist =
    The bulletin passes with no action now, and the rule matches nothing
    else: the SMTP sender of a newsletter is often the platform's bounce
    address, which is why "from" maps look at the SMTP sender by default and
    extract_from = "mime" was needed.
spam-tide-event-poisoned =
    rspamd just learned bookings as spam: the Archive holds the messages
    Leilani keeps, the ones to learn as ham. A message learned in the wrong
    class can be learned again in the right one (rspamd relearns it).
spam-tide-event-bayes =
    Bayes has enough of both classes now (min_learns): it classifies each
    message from the words it learned, and adds BAYES_SPAM or BAYES_HAM.
spam-tide-event-caught =
    A fresh phishing, invoice and prize spam are all marked as spam now
    (rspamc symbols on new ones: BAYES_SPAM pushes the phishing over
    add_header).
spam-tide-event-end =
    Leilani: "This morning's Junk has forty messages, my INBOX has the
    bookings, and the crew got the gale warning before Saturday's launch.
    Thank you!"

    Well done! You finished Spam Tide.

    WHAT HAPPENED
    Thresholds moved in a hurry let the spam under 8 through untagged and
    rejected everything above, including a legitimate bulletin sent by a
    mailing platform that spammers use too. You read the scores, put the
    thresholds back (reject 15, add header 6, greylist 4), trusted the
    bulletin's own address rather than its platform, and trained Bayes with
    the spam Leilani had already sorted and the bookings she archived.

    GOOD PRACTICE
    - Look at the symbols before touching thresholds: rspamc symbols on a
      saved message, or the line of rspamd.log.
    - Thresholds: reject what is certainly spam, mark (add header) what is
      probably spam; the user's Junk folder is the safety net, a reject is
      not.
    - A whitelist as narrow as possible: one address, ideally checked
      (DKIM, SPF); never a whole mailing platform or a domain spammers can
      forge.
    - Train Bayes on mail people sorted themselves, both classes, with
      enough messages (min_learns); keep the filter in the path (milter).
    - Local changes in local.d/ or override.d/, checked with rspamadm
      configtest before a reload.

    DOCUMENTATION
    - Actions and scores: https://docs.rspamd.com/configuration/metrics/
    - The multimap module: https://docs.rspamd.com/modules/multimap/
    - Settings: https://docs.rspamd.com/configuration/settings/
    - Statistics (Bayes): https://docs.rspamd.com/configuration/statistic/
    - Postfix and milters: https://www.postfix.org/MILTER_README.html
