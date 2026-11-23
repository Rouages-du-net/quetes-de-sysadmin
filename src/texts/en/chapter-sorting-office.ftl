### Story "The Lifeboat", chapter "The Sorting Office": Sieve filters with
### Dovecot's Pigeonhole: fileinto for bookings@, a vacation reply that
### answers an alias but not a mailing list. sievec, sieve-test, doveadm
### sieve, the active script, delivery by LMTP. Commands, options, paths,
### Sieve code and outputs are not translated.

chapter-sorting-office = The Sorting Office
    .summary = The winter school visits start, and the secretary wants the bookings in their own folder; the treasurer leaves for three weeks and needs an out-of-office reply that answers people, not mailing lists. Write the Sieve scripts, check them, make them the active ones, and watch new mail go where it should.

## Files

sorting-office-message-marisol =
    From: Marisol (chair, Seaholme Lifeboat)
    Monday 3 November, 9:05

    Hello again!

    Two small things before the winter:

    1. Leilani: everything written to bookings@lifeboat.example arrives in
       her mailbox (it's an alias), mixed with the rest. She would like it
       in a folder called Bookings, and her other mail where it is now.

    2. Aziz, our treasurer, is away until 24 November. He would like an
       automatic reply ("I'm away until the 24th, write to Marisol for
       anything urgent"), to people who write to him, and also to the ones
       who write to treasurer@, which reaches him too. Last year his reply
       went to the federation's mailing list and two hundred stations got
       it, twice: never again, please. Yerlan says there is an old script
       of his somewhere.

    I put two sample messages in your home, to try things with.

    Marisol

sorting-office-note-yerlan =
    Notes from Yerlan (Sieve on slipway)

    - Dovecot runs Sieve scripts when it delivers mail (LMTP, plugin
      sieve): first the global ones (/etc/dovecot/sieve/before.d: spam to
      Junk), then the user's active script.
    - A user's scripts live in ~/sieve/NAME.sieve (home: /var/vmail/lifeboat.example/NAME);
      the active one is the one ~/.dovecot.sieve links to (90-sieve.conf).
      sudo doveadm sieve list -u USER shows them, doveadm sieve activate
      picks one.
    - sievec FILE checks and compiles a script; sieve-test SCRIPT MESSAGE
      says what it would do with a message, without delivering it.
    - Files under /var/vmail belong to vmail (5000): Dovecot must be able
      to read what you put there.
    - The language: RFC 5228 (if, header, address, envelope, fileinto,
      stop), RFC 5230 for vacation. man sievec, man sieve-test.

    Yerlan

## Events

sorting-office-event-read-old =
    That is last year's script: reject doesn't answer and keep the message,
    it refuses it. Every message to Aziz would be lost, and the refusal goes
    back to the envelope sender, the mailing list's address included. An
    out-of-office reply is what the vacation extension (RFC 5230) does: it
    keeps the message and answers each person once.
sorting-office-event-syntax =
    The compiler stopped at the line it gives: a missing semicolon, a
    misspelled command, or an extension used without its require. Pigeonhole
    reports the first error; fix it and compile again (sievec) before
    activating.
sorting-office-event-reject-live =
    A message to Aziz was refused, and the refusal answered its sender:
    that is how last year's reply reached the list. Deactivate that script
    (doveadm sieve deactivate, or another one activated) and use vacation.
sorting-office-event-not-active =
    The script is written, but no message goes through it: it isn't the
    active one (~/.dovecot.sieve doesn't point to it). doveadm sieve
    activate -u USER NAME makes it active (or, in the user's home,
    ln -s sieve/NAME.sieve .dovecot.sieve, owned by vmail).
sorting-office-event-folder =
    Leilani's script files a bookings@ message into Bookings and leaves a
    direct one in her INBOX (the same result as sieve-test would show).
    The folder exists, or fileinto :create makes it (require "mailbox").
sorting-office-event-sorted-live =
    A real booking came in: "fileinto action: stored mail into mailbox
    'Bookings'" in mail.log. The test was right, and LMTP did the same.
sorting-office-event-alias-missing =
    Aziz's script answers a message sent to aziz@, but not one sent to
    treasurer@: the vacation command only replies when one of the user's
    addresses is in To or Cc, and treasurer@ is an alias, not his address
    ("discarding vacation response for implicitly delivered message" in the
    log). The :addresses tag lists his other addresses.
sorting-office-event-vacation =
    Aziz's vacation answers a direct message and keeps it in his INBOX.
    Vacation also stays silent on its own where it should: mailing lists
    (List-Id…), automatic messages (Auto-Submitted), bulk mail, MAILER-DAEMON,
    and the same sender twice within :days.
sorting-office-event-alias =
    His reply covers treasurer@ too, and the list message gets none: the
    vacation command sees its List-Id header.
sorting-office-event-replied-live =
    A real message to Aziz got its reply: "sent vacation response to <…>"
    in mail.log. The next one from the same person will get none for
    :days days.
sorting-office-event-end =
    Marisol: "Leilani found three school bookings in her new folder this
    morning, and Aziz's reply went out to the boatyard and the accountant.
    Not a word to the federation. Thank you!"

    Well done! You finished The Sorting Office.

    WHAT HAPPENED
    Mail is sorted as it is delivered: Dovecot's LMTP runs the global Sieve
    scripts, then the user's active one. You wrote a script that files the
    bookings@ messages into their own folder and another that answers
    Aziz's correspondents while he is away, his alias included and the
    mailing lists left alone, checked them with sievec and sieve-test,
    activated them, and watched new mail go through them.

    GOOD PRACTICE
    - An out-of-office reply is vacation, never reject (which refuses the
      message) nor redirect: vacation keeps the mail, answers once per
      sender and :days, and stays silent on lists and automatic messages.
    - Give vacation the user's other addresses (:addresses) when mail
      arrives through aliases.
    - Check before activating: sievec for the syntax, sieve-test on real
      samples for the result; then watch the log on the next real message.
    - Only one personal script is active: doveadm sieve list shows which.

    DOCUMENTATION
    - Sieve (RFC 5228): https://www.rfc-editor.org/rfc/rfc5228
    - Vacation (RFC 5230): https://www.rfc-editor.org/rfc/rfc5230
    - Pigeonhole's Sieve plugin: https://doc.dovecot.org/2.4.1/core/plugins/sieve.html
    - Vacation in Pigeonhole: https://doc.dovecot.org/2.4.1/core/config/sieve/extensions/vacation.html
    - doveadm sieve: https://doc.dovecot.org/2.4.1/core/man/doveadm-sieve.1.html
