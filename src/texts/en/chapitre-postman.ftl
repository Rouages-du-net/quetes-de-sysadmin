### "Junk Mail" story, chapter 1 "The Postman": SPF.
### Commands, paths, DNS records and Postfix messages are not translated.

chapitre-postman = The Postman
    .resume = The Community Gardens' welcome emails are stuck: the published SPF is still the old hosting provider's.

## Files

postman-courriel-nour =
    From:    Nour
    To:      you
    Subject: The welcome emails don't arrive any more

    Hello, and thanks for lending us a hand!

    Last week we left our old hosting provider (old-hosting.example): the
    Community Gardens' website and mail now run on our own server, this
    one. Everything was fine… until five new members wrote to us: they
    never received the welcome email the website sends when you sign up.
    All five have an address at mailbox.example.

    I don't know much about this, but I saw a command, mailq, that shows
    the mail that's waiting. And there's /var/log/mail.log.

    The DNS for gardens.example is on this server too (BIND), with a copy
    at the registry (ns2.registry.example), just like before at the host.

    The sudo password: seeds-2027.

    Thanks!
    Nour

## Events

postman-evenement-differe =
    mailbox.example isn't refusing the mail forever: 451 is a "temporary"
    code (4xx), Postfix keeps the message and will try again. But the
    reason is clear: "neither SPF nor DKIM passed". Neither SPF (which says
    which machines may send for a domain) nor DKIM (a signature) proves
    that this server really speaks for gardens.example. Start with SPF:
    it's a TXT record of the domain, starting with v=spf1 (dig TXT
    gardens.example).
postman-evenement-ancien =
    Here's gardens.example's SPF: "include:_spf.old-hosting.example -all".
    It only authorizes the old host's servers (what
    _spf.old-hosting.example publishes), and -all refuses all others…
    including this server, 203.0.113.30. The record is in the zone, on this
    server: /etc/bind/zones/db.gardens.example.
postman-evenement-deux =
    Careful: the zone now contains two records starting with v=spf1. RFC
    7208 is strict: with two SPF records, the result is "permerror", as if
    none were valid. Replace the old one rather than adding another.
postman-evenement-serie =
    This server publishes the right SPF, but the rest of the internet also
    asks the registry's secondary, which keeps the old version: dig TXT
    gardens.example @ns2.registry.example. The secondary only copies the
    zone again if its serial number (serial, in the SOA) goes up.
postman-evenement-spf =
    The SPF the internet sees now authorizes 203.0.113.30 to send for
    gardens.example. The waiting emails will only leave at Postfix's next
    attempt (every few minutes); to avoid waiting: sudo postqueue -f, then
    mailq.
postman-evenement-fin =
    The queue is empty: mailbox.example accepted the five welcome emails.
    Nour: "Amina just answered, she got it! … in her junk folder, but she
    got it."

    Well done! You have finished the chapter "The Postman".

    WHAT HAPPENED
    A server receiving mail checks that the sender may send on behalf of
    its domain. SPF answers the question "may this IP address send for
    gardens.example?": it's a TXT record of the domain (v=spf1 …). After
    the move, it still authorized the old host, not this server. 451 is a
    temporary error: Postfix kept the messages and sent them again.

    GOOD PRACTICE
    - One SPF record per domain; change it when you change sending server
      (mx, a, ip4:…, include:… for a provider).
    - End with -all (refuse the rest) or ~all (flag it), never +all.
    - Changing the zone also means raising the serial, then checking what
      the internet sees: dig @ns2.registry.example.
    - mailq and /var/log/mail.log say why a message is waiting.

    DOCUMENTATION
    - SPF, RFC 7208: https://www.rfc-editor.org/rfc/rfc7208
    - postqueue: https://www.postfix.org/postqueue.1.html
    - BIND zone files: https://bind9.readthedocs.io/en/stable/chapter3.html
