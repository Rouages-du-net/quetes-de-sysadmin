### Story "The Airwaves", chapter "The Stolen Laptop": a reporter's laptop
### stolen with its client certificate; revocation, CRL, nginx's ssl_crl;
### then a watch on expiry dates (openssl x509 -checkend, cron or a timer).
### Commands, options, paths and outputs are not translated.

chapter-stolen-laptop = The Stolen Laptop
    .summary = A reporter's laptop has been stolen, and with it the certificate that opens the contribution portal. Someone is already using it. Shut that door without locking out the others, then make sure no certificate of the federation ever expires by surprise again.

## Files

stolen-laptop-message-adaeze =
    From: Adaeze
    Tuesday 16 April, 10:05

    Bad news: Lindiwe's laptop was stolen from her car on Sunday night,
    after the festival. Its disk isn't encrypted (I know...).

    On it, the uploader that sends her recordings to the contribution
    portal, https://contrib.airwaves.internal/. The portal only lets in
    the reporters' laptops: each has a client certificate from our
    issuing CA (Kwame's notes are in /srv/ca/README.txt). Amina and Ravi
    must keep working: Amina is sending the festival's interviews this
    morning.

    Lindiwe gets a new laptop next week; for now, nobody but us must be
    able to use hers.

    And one more thing, after the intranet's surprise in March: can we be
    warned, by ourselves, before a certificate expires? The policy says
    30 days ahead.

    Adaeze

## Events

stolen-laptop-event-thief =
    203.0.113.66: an address that is none of the stations', connecting to
    the portal at 2 a.m. and again this morning, and accepted (200). It
    presents a valid certificate signed by our CA: nginx can't tell it
    from Lindiwe. A certificate stays valid until its end date unless the
    authority revokes it and the servers learn about it.
stolen-laptop-event-deleted =
    The certificate's file is gone from newcerts, but that revokes
    nothing: the thief has his copy, with its key, and nginx only checks
    that it was signed by our CA. Revoking means telling the authority's
    database (openssl ca -revoke), then publishing the list. A copy of
    each laptop's certificate is also kept in /srv/ca/issuing/certs/.
stolen-laptop-event-new-ca =
    A whole new authority? Only one laptop's key was stolen, not the
    authority's: changing the root would mean installing it everywhere
    and reissuing every certificate, for nothing. Revoking the one
    certificate is enough.
stolen-laptop-event-revoked =
    Certificate 1003 is now marked R (revoked) in index.txt. But the
    database is the authority's: nginx never reads it. What servers read
    is the revocation list, the CRL, which the authority writes and signs
    (openssl ca -gencrl).
stolen-laptop-event-crl =
    The CRL lists serial number 1003, signed by the issuing CA, valid 30
    days (default_crl_days: it must be rewritten before then, even with
    nothing new). nginx must be given it: the ssl_crl directive, read at
    each reload.
stolen-laptop-event-stale-crl =
    nginx has a CRL, but one that doesn't list 1003: a CRL is a snapshot
    of the database when it was written. Write it again after each
    revocation, and reload nginx.
stolen-laptop-event-all-refused =
    Now nginx refuses everyone, Amina included! Its error log says why:
    "unable to get certificate CRL". With ssl_crl, nginx checks the
    revocation of every certificate of the chain, the issuing CA's too,
    and that one is in the root's CRL (/srv/ca/crl/root.crl): the file
    given to ssl_crl must hold both CRLs, one after the other.
stolen-laptop-event-not-loaded =
    The configuration mentions ssl_crl, but nginx hasn't loaded it yet:
    check it (sudo nginx -t), then reload.
stolen-laptop-event-refused =
    The stolen laptop is refused (400, "The SSL certificate error",
    certificate revoked in the error log), and Amina's uploads still pass.
    Now, the second request: a watch on the expiry dates.
stolen-laptop-event-watch-quiet =
    A job runs on its own, but it said nothing about the streaming
    server's certificate, which expires in 20 days
    (/srv/ca/issued/stream.crt). The certificates are in /srv/ca/issued
    and /srv/ca/issuing/newcerts; openssl x509 -checkend answers with its
    exit code.
stolen-laptop-event-watch-noisy =
    The job lists every certificate the same way: the one that expires is
    drowned among the healthy ones, and nobody will read a daily mail that
    always says the same thing. An alert speaks only when there's
    something to do.
stolen-laptop-event-watch =
    The watch works: run as it will be, it reports the streaming server's
    certificate, which expires on 6 May, and stays quiet about the others.
stolen-laptop-event-end =
    Adaeze: "The festival's interviews are in, and the stolen laptop
    can't send anything any more. I've already got the first alert in my
    mailbox: the streaming certificate. I'll ask Kwame to renew it this
    week!"

    Well done! You finished The Stolen Laptop.

    WHAT HAPPENED
    A client certificate proves "this laptop belongs to a reporter" for as
    long as it is valid: stolen, it works for whoever holds it. You found
    the thief's connections in nginx's access log, revoked the certificate
    in the issuing CA's database (openssl ca -revoke, keyCompromise),
    wrote the revocation list (openssl ca -gencrl), and gave nginx both
    CRLs (the issuing CA's and the root's, since nginx checks the whole
    chain) before reloading. Then you set up a watch that runs openssl
    x509 -checkend over every certificate issued and only speaks for those
    expiring within 30 days.

    GOOD PRACTICE
    - A lost or stolen key: revoke the certificate at once (openssl ca
      -revoke file -crl_reason keyCompromise); deleting a file revokes
      nothing.
    - Revoking is two steps: the database, then a new CRL (-gencrl) that
      the servers load (nginx: ssl_crl, then a reload).
    - A CRL expires (default_crl_days): rewrite it on a schedule, or every
      client is refused the day it lapses.
    - nginx checks the CRLs of the whole chain: the root's CRL too.
    - Watch the expiry dates: openssl x509 -checkend $((30*86400)) in a
      daily job (cron, or a systemd timer), which only reports what
      expires.
    - Encrypt laptops' disks: a stolen key is the start of every story.

    DOCUMENTATION
    - openssl-ca (-revoke, -gencrl): https://docs.openssl.org/3.0/man1/openssl-ca/
    - openssl-crl: https://docs.openssl.org/3.0/man1/openssl-crl/
    - nginx, ssl_crl and ssl_verify_client: https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_crl
    - CRLs (RFC 5280, section 5): https://www.rfc-editor.org/rfc/rfc5280#section-5
    - openssl-x509 (-checkend): https://docs.openssl.org/3.0/man1/openssl-x509/
