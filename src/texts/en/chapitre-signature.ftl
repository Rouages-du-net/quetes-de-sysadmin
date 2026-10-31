### "Junk Mail" story, chapter 2 "The Signature": DKIM with OpenDKIM.
### Commands, paths, directives and messages are not translated.

chapitre-signature = The Signature
    .resume = The emails arrive, but in junk folders: sign them with DKIM (OpenDKIM, Postfix's milter, the key in DNS).

## Files

signature-message-nour =
    Hello!

    The welcome emails arrive, thanks. But at mailbox.example, they land
    in the junk folder. Their help page says a serious sender must have
    SPF and DKIM.

    I installed opendkim yesterday (sudo apt install opendkim
    opendkim-tools), without configuring anything: the file is
    /etc/opendkim.conf, and Debian keeps the keys in /etc/dkimkeys.

    A friend gave me an address that answers with what it sees of an
    email (SPF, DKIM, DMARC):
    echo test | mail -s test check-auth@verifier.example
    The answer arrives in your mailbox, on this server (the mail command,
    with no argument, lists it; the mailbox itself is
    /var/mail/your_account).

    The sudo password is still seeds-2027.

    Nour

## Events

signature-evenement-verifier =
    The checker answered: SPF passes, but "DKIM check: none": the emails
    aren't signed. DKIM is a signature added to each message with a
    private key, which the recipient checks with the public key published
    in DNS (selector._domainkey.gardens.example). On Debian, opendkim does
    the signing, plugged into Postfix as a "milter". Start with the key
    pair: man opendkim-genkey.
signature-evenement-cle =
    A private key in /etc/dkimkeys. opendkim-genkey also wrote a .txt file
    next to it: the DNS record to publish, with the public key. Check who
    owns the private key (ls -l): opendkim runs as the opendkim account,
    and must be able to read it.
signature-evenement-illisible =
    opendkim won't start: "Permission denied" on the private key. It
    belongs to root (root created it), with rw------- permissions: the
    opendkim account can't read it. Give it to opendkim:
    sudo chown opendkim:opendkim /etc/dkimkeys/…private
signature-evenement-pas-sure =
    opendkim refuses the key: "key data is not secure". A private key that
    other accounts can read is no longer secret, and opendkim
    (RequireSafeKeys) refuses to use it. Make it readable by its owner
    only: sudo chmod 600 …
signature-evenement-opendkim =
    opendkim runs with the key and the domain. But it only signs what
    Postfix hands it: the milter must be plugged in /etc/postfix/main.cf
    (man postconf, and MILTER_README). The socket address must match the
    Socket in opendkim.conf, each with its own syntax.
signature-evenement-chroot =
    "connect to Milter service unix:…: No such file or directory": on
    Debian, Postfix runs locked inside /var/spool/postfix (chroot). A path
    like /run/opendkim/opendkim.sock is, for it,
    /var/spool/postfix/run/opendkim/opendkim.sock, which doesn't exist.
    The comment in opendkim.conf says so: either a socket inside
    /var/spool/postfix, or a network socket (Socket inet:8891@localhost,
    and inet:localhost:8891 on the Postfix side).
signature-evenement-prise =
    "connect to Milter service inet:…: Connection refused": Postfix finds
    nobody at that address. Is opendkim running, and listening on that
    port? Mind the two syntaxes: inet:8891@localhost in opendkim.conf,
    inet:localhost:8891 in main.cf.
signature-evenement-smtpd-seul =
    smtpd_milters only applies to mail arriving over the network (SMTP).
    The website's emails and the mail command are submitted on the
    machine: they go through non_smtpd_milters. To sign both:
    non_smtpd_milters = $smtpd_milters.
signature-evenement-milter =
    Postfix now hands the mail to opendkim, which signs it ("DKIM-Signature
    field added" in /var/log/mail.log). Now publish the public key in the
    zone, otherwise nobody can check the signature. opendkim-testkey checks
    the published key.
signature-evenement-pas-secure =
    "key not secure" isn't an error: opendkim-testkey only says the DNS
    answer isn't protected by DNSSEC. What matters is the next line: "key
    OK".
signature-evenement-serie =
    The machine's server publishes the key, but the registry's secondary
    doesn't have it: did you raise the zone's serial? dig TXT
    mail._domainkey.gardens.example @ns2.registry.example
signature-evenement-fin =
    The Gardens' emails are signed, and the internet can check the
    signature with the published key. Nour: "mailbox.example puts them in
    the inbox, at last!"

    Well done! You have finished the chapter "The Signature".

    WHAT HAPPENED
    DKIM adds a signature to each email, computed with a private key only
    the server knows; the recipient checks it with the public key,
    published in DNS under selector._domainkey.domain. A message modified
    on the way, or sent by someone else, fails. opendkim signs; Postfix
    hands it the mail (milter); DNS publishes the key.

    GOOD PRACTICE
    - The private key belongs to the service's account (opendkim),
      readable by it alone (600); never copied anywhere else.
    - non_smtpd_milters for mail submitted on the machine, smtpd_milters
      for mail arriving over SMTP; milter_default_action = accept so mail
      isn't blocked if opendkim stops.
    - One selector per key (mail, 2027…): to change keys, publish a new one
      alongside, then remove the old one.
    - opendkim-testkey, then a real email to a checker.

    DOCUMENTATION
    - DKIM, RFC 6376: https://www.rfc-editor.org/rfc/rfc6376
    - Postfix and milters: https://www.postfix.org/MILTER_README.html
    - OpenDKIM: http://www.opendkim.org/opendkim.conf.5.html
