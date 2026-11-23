### Graded hints for The Lifeboat (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — Mailbox Full

hint-mailbox-full-bounces =
    .lead = What happened to the last messages sent to Saoirse? Postfix and Dovecot write every delivery to the mail log.
    .solution = sudo grep saoirse /var/log/mail.log | tail
hint-mailbox-full-quota-get =
    .lead = How much of her quota does she use? doveadm has a command for a user's quota (man doveadm).
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-trash =
    .lead = Which of her folders takes the room? Ask doveadm for each mailbox's size, or measure her Maildir.
    .solution = sudo doveadm mailbox status -u saoirse@lifeboat.example "messages vsize" "*" (or sudo du -sh /var/vmail/lifeboat.example/saoirse/Maildir/.[A-Z]*)
hint-mailbox-full-expunged =
    .lead = Expunge the old messages of her Trash through Dovecot, with a search query on their date (man doveadm, man doveadm-search-query); try the query with doveadm search first.
    .solution = sudo doveadm expunge -u saoirse@lifeboat.example mailbox Trash savedbefore 2031-01-01
hint-mailbox-full-raised =
    .lead = Give Saoirse, and only her, the 2 GB the board agreed: Dovecot's userdb can carry per-user settings.
    .solution = sudo nano /etc/dovecot/users: add userdb_quota_storage_size=2G at the end of Saoirse's line; check with sudo doveadm quota get -u saoirse@lifeboat.example
hint-mailbox-full-delivered =
    .lead = Once there is room, the next message to her is saved: watch the log.
    .solution = sudo tail -n 5 /var/log/mail.log (look for "stored mail into mailbox 'INBOX'")
hint-mailbox-full-warning =
    .lead = 90-quota.conf has an example of a quota warning, commented out, and the service it runs already exists. Enable it, check, reload Dovecot.
    .solution = sudo nano /etc/dovecot/conf.d/90-quota.conf (uncomment the quota_warning warn-90 block), then sudo doveconf -n | grep -A5 quota_warning and sudo doveadm reload
hint-mailbox-full-end =
    .lead = Check everything: her quota, the Trash, the count (doveadm quota recalc if files were removed by hand), the warning in the running configuration.
    .solution = sudo doveadm quota get -u saoirse@lifeboat.example; sudo doveadm quota recalc -u saoirse@lifeboat.example; sudo doveadm reload

## Chapter 2 — Spam Tide

hint-spam-tide-scores =
    .lead = How does rspamd score these messages? Its log has a line per message, and rspamc can scan a saved one (man rspamc).
    .solution = sudo tail -n 3 /var/log/rspamd/rspamd.log; or sudo rspamc symbols on a file of Leilani's INBOX (/var/vmail/lifeboat.example/leilani/Maildir/cur/…)
hint-spam-tide-thresholds =
    .lead = Look at the thresholds of the actions Yerlan changed, put them back to rspamd's defaults, check the configuration and reload rspamd.
    .solution = sudo nano /etc/rspamd/local.d/actions.conf (reject = 15; add_header = 6; greylist = 4;), sudo rspamadm configtest, sudo systemctl reload rspamd
hint-spam-tide-bulletin-junk =
    .lead = Why is the bulletin over add_header? Read its symbols, and see which ones come from the platform it is sent through.
    .solution = sudo grep coastwatch /var/log/rspamd/rspamd.log | tail -n 1
hint-spam-tide-whitelist =
    .lead = Trust the bulletin's own From: address, nothing wider: a multimap rule of type from (careful: SMTP sender by default) or a settings rule (from_mime), in local.d.
    .solution = local.d/multimap.conf: WHITELIST_COASTWATCH {"{"} type = "from"; extract_from = "mime"; map = "/etc/rspamd/local.d/coastwatch.map"; score = -6.0; {"}"}, the map holding news@coastwatch.example; rspamadm configtest; systemctl reload rspamd
hint-spam-tide-bayes =
    .lead = Bayes needs enough examples of both classes: Leilani already sorted spam into Junk, and kept her bookings in Archive.
    .solution = sudo rspamc learn_spam /var/vmail/lifeboat.example/leilani/Maildir/.Junk/cur/ and sudo rspamc learn_ham /var/vmail/lifeboat.example/leilani/Maildir/.Archive/cur/; then rspamc stat
hint-spam-tide-caught =
    .lead = Check on new messages: are the phishing, the invoices and the prizes now marked as spam? The log shows the action of each new one.
    .solution = sudo tail -n 4 /var/log/rspamd/rspamd.log (look for add header); sudo rspamc stat
hint-spam-tide-end =
    .lead = Everything at once: the milter in main.cf, sensible thresholds, Bayes trained, the bulletin with no action, nothing whitelisted that spam can use.
    .solution = postconf smtpd_milters; sudo rspamadm configdump actions multimap; sudo rspamc stat

## Chapter 3 — The Sorting Office

hint-sorting-office-read-old =
    .lead = Yerlan mentioned an old script of Aziz's: look at his Sieve scripts.
    .solution = sudo doveadm sieve list -u aziz@lifeboat.example; sudo cat /var/vmail/lifeboat.example/aziz/sieve/holiday.sieve
hint-sorting-office-folder =
    .lead = Write a script for Leilani that files the messages to bookings@ into Bookings (fileinto, :create), check it, and make it her active script.
    .solution = require ["fileinto", "mailbox", "envelope"]; if envelope :is "to" "bookings@lifeboat.example" {"{"} fileinto :create "Bookings"; {"}"} — sudo doveadm sieve put -a -u leilani@lifeboat.example sorting < sorting.sieve
hint-sorting-office-sorted-live =
    .lead = Wait for the next booking and look at what LMTP did with it.
    .solution = sudo grep -E "Bookings|bookings@" /var/log/mail.log | tail
hint-sorting-office-vacation =
    .lead = An out-of-office reply is the vacation extension (RFC 5230): write Aziz a script with it, test it on the samples (sieve-test), activate it.
    .solution = require ["vacation"]; vacation :days 7 :subject "Away until 24 November" "I'm away until 24 November; for anything urgent, write to marisol@lifeboat.example."; — then sudo sieve-test away.sieve sample-list.eml and doveadm sieve put -a
hint-sorting-office-alias =
    .lead = A message to treasurer@ gets no reply: vacation only answers mail addressed to the user. Tell it his other address.
    .solution = vacation :days 7 :addresses ["treasurer@lifeboat.example"] :subject "…" "…";
hint-sorting-office-replied-live =
    .lead = Wait for a real message to Aziz and look for the reply in the log.
    .solution = sudo grep "vacation response" /var/log/mail.log | tail
hint-sorting-office-end =
    .lead = Both scripts active, each tested, each seen at work on real mail.
    .solution = sudo doveadm sieve list -u leilani@lifeboat.example; sudo doveadm sieve list -u aziz@lifeboat.example; sudo tail /var/log/mail.log
