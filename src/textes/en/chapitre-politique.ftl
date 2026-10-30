### "Junk Mail" story, chapter 3 "The Policy": DMARC (aggregate reports,
### alignment, p=quarantine). Commands, paths, DNS records and tags are not
### translated.

chapitre-politique = The Policy
    .resume = Move DMARC to p=quarantine without losing the newsletter: read the reports, align the provider, then tighten the policy.

## Files

politique-courriel-nour =
    From:    Nour
    To:      you
    Subject: DMARC

    Hello!

    mailbox.example announces that senders who send a lot must publish a
    DMARC policy of at least "quarantine". Our newsletter goes out every
    week to almost 500 people…

    As their guide advises, last week I published a policy that blocks
    nothing (p=none) but asks for reports
    (rua=mailto:dmarc@gardens.example). The first ones have arrived, I put
    them in dmarc_reports. I don't understand a thing: it's XML.

    The newsletter is sent by newsmail.example, a provider: their help page
    on DKIM is in newsmail_letter.txt.

    Could you move DMARC to quarantine, without our newsletter ending up in
    junk folders?

    Nour

politique-lettre-newsmail =
    newsmail.example — Help — Signing with your own domain (DKIM)

    By default, our servers sign your campaigns with our domain
    (d=newsmail.example). Recipients check the signature, but for DMARC it
    doesn't match the domain of your sending address.

    To have us sign with your domain, delegate a selector to us. Add to
    your domain's DNS zone:

        nm1._domainkey.YOUR-DOMAIN.   CNAME   nm1.dkim.newsmail.example.

    Our servers check your DNS every hour: as soon as the CNAME is visible,
    your campaigns are signed with d=YOUR-DOMAIN.

    The return address (bounces) stays with us:
    bounces+…@bounce.newsmail.example.

## Events

politique-evenement-rapport =
    198.51.100.77: those are newsmail.example's servers, sending the
    newsletter (412 messages at mailbox.example). SPF passes, DKIM passes…
    but for bounce.newsmail.example and newsmail.example, not for
    gardens.example. DMARC requires alignment: the domain checked by SPF
    (the envelope) or by DKIM (d=) must be the one in the From: address.
    With p=quarantine, these 412 messages would end up in junk folders.
politique-evenement-usurpation =
    192.0.2.66 belongs to nobody in the association: 17 messages in the
    name of gardens.example, with no valid SPF or DKIM. Someone is
    impersonating the Gardens. That's exactly what p=quarantine (or reject)
    will stop.
politique-evenement-inclusion =
    Adding include:_spf.newsmail.example to gardens.example's SPF changes
    nothing for DMARC: recipients check SPF for the envelope's domain,
    bounce.newsmail.example, not for gardens.example. And each include
    costs DNS lookups (ten at most). It's DKIM that must be aligned: see
    newsmail_letter.txt.
politique-evenement-point =
    The CNAME for nm1._domainkey leads nowhere: in a zone, a name without a
    trailing dot is relative. nm1.dkim.newsmail.example becomes
    nm1.dkim.newsmail.example.gardens.example. It needs the trailing dot:
    nm1.dkim.newsmail.example.
politique-evenement-deux =
    There are now two DMARC records for gardens.example: RFC 7489 says to
    ignore DMARC in that case, as if there were no policy. Change the
    existing record instead of adding another.
politique-evenement-aligne =
    The internet sees the CNAME: newsmail.example now signs the newsletter
    with d=gardens.example, and the key is found by following the CNAME.
    The newsletter passes DMARC. The policy can be tightened.
politique-evenement-trop-tot =
    Careful: with this policy, the newsletter (not aligned) would be
    quarantined, or refused, by mail providers. Align newsmail.example's
    signature first.
politique-evenement-fin =
    gardens.example publishes p=quarantine (or stricter), the newsletter
    and the server's emails pass DMARC, and the messages from 192.0.2.66
    don't stand a chance any more. Nour: "I'll keep an eye on the reports
    every week."

    Well done! You have finished the chapter "The Policy", and the story
    "Junk Mail".

    WHAT HAPPENED
    DMARC ties SPF and DKIM to the address the person reads (From:): a
    message passes if SPF or DKIM passes for the same domain (alignment).
    The policy (p=) tells recipients what to do with the others: nothing
    (none), junk folder (quarantine), refusal (reject). The reports (rua=)
    show who sends on behalf of the domain: here, the newsletter provider,
    badly aligned, and an impersonator.

    GOOD PRACTICE
    - Start with p=none and rua=, read the reports, align every service
      that sends on behalf of the domain, only then quarantine, then
      reject.
    - A provider aligns through DKIM (a CNAME to its key, d=your domain) or
      through SPF (a return address in your domain).
    - A single DMARC record, under _dmarc.domain; raise the serial, check
      what the internet sees.
    - pct= lets you tighten gradually (pct=25, then 100).

    DOCUMENTATION
    - DMARC, RFC 7489: https://www.rfc-editor.org/rfc/rfc7489
    - The aggregate report format: https://www.rfc-editor.org/rfc/rfc7489#appendix-C
    - Alignment: https://www.rfc-editor.org/rfc/rfc7489#section-3.1
