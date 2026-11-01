### Story "The Data Centre", chapter 5 "The certificate has expired":
### TLS, Let's Encrypt and certbot. Commands, paths, file names and the
### messages of certbot, openssl, curl and nginx are not translated.

chapter-certificate = The certificate has expired
    .summary = The padlock is gone: certbot, the HTTP challenge, openssl, and a renewal that works on its own.

## Files

certificate-email-awa =
    From:    Awa (operations manager)
    To:      you
    Subject: The website is scaring visitors

    Léa, at the media library's front desk, tells me the website has been
    showing a security warning since this morning (her message is in
    ~/message_from_lea.txt). The HTTPS certificate must have expired.

    I don't get it: certbot is supposed to renew it on its own, it tries
    twice a day. And since 2025, Let's Encrypt no longer sends an email
    before expiry: nobody saw it coming.

    Could you:
    1. find out why the automatic renewal doesn't work;
    2. renew the certificate, so the website is safe again;
    3. make sure it will work ALL BY ITSELF next time, all the way through.

    To check what a browser sees: curl https://medialibrary.example
    The rest is in man certbot and man openssl. The sudo password hasn't
    changed.
certificate-message-lea =
    Hello Awa,

    This morning, when I opened the media library's website, Firefox showed:

      Warning: Potential Security Risk Ahead
      The certificate for medialibrary.example expired on 01/21/2027.
      Error code: SEC_ERROR_EXPIRED_CERTIFICATE

    On my phone, Chrome says "Your connection is not private"
    (NET::ERR_CERT_DATE_INVALID). Two patrons have already called me to
    ask whether we'd been hacked. I told them not to type anything on the
    website for now.

    Léa
certificate-readme-live =
    This directory contains your keys and certificates.

    `privkey.pem`  : the private key for your certificate.
    `fullchain.pem`: the certificate file used in most server software.
    `chain.pem`    : used for OCSP stapling in Nginx >=1.3.7.
    `cert.pem`     : will break many server configurations, and should not be used
                     without reading further documentation (see link below).

    WARNING: DO NOT MOVE OR RENAME THESE FILES!
             Certbot expects these files to remain in this location in order
             to function properly!

    We recommend not moving these files. For more information, see the Certbot
    User Guide at https://certbot.eff.org/docs/using.html#where-are-my-certificates.

## The website

certificate-site-index =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Neighbourhood Media Library</title></head>
    <body>
    <h1>Neighbourhood Media Library</h1>
    <p>Open Tuesday to Saturday, 10 am to 6 pm.</p>
    <p>New: reserve your books online with your library card.</p>
    </body>
    </html>

## Events

certificate-event-expires =
    The certificate has indeed expired: that is exactly what browsers see.
    But why wasn't it renewed? certbot runs on its own, started by
    systemd: its journal knows (journalctl -u certbot, or systemctl
    --failed). To try a renewal without breaking anything, man certbot
    talks about a dry run.
certificate-event-challenge =
    Let's Encrypt only gives a certificate to whoever proves they control
    the website: certbot drops a small file (the "challenge") in a
    directory, then the authority fetches it from http://medialibrary.example/.well-known/acme-challenge/.
    Here, it gets a 404: the file isn't where nginx serves this website.

    In which directory does certbot drop the challenge (look at every line
    of /etc/letsencrypt/renewal/medialibrary.example.conf)? And which
    directory does nginx serve for medialibrary.example? man certbot tells
    you how to change the directory.
certificate-event-not-reload =
    The new certificate is on the disk… but curl still sees the old one.
    nginx reads its certificate when it starts or reloads its
    configuration, not on every visit: it is still serving October's.
    What do you need to tell nginx?
certificate-event-without-hook =
    The website is safe again, and certbot can now renew. But in 60 days,
    when it renews on its own, in the middle of the night, who will
    reload nginx? Nobody: the website will serve the old certificate until
    it expires, just like today. certbot can run a command after each
    successful renewal: look for "hook" in man certbot.
certificate-event-end =
    curl https://medialibrary.example answers without a warning: the
    padlock is back. And next time, certbot will renew on its own, then
    reload nginx on its own.

    Awa: "Thanks. I'm adding an alert that will warn us fifteen days
    before expiry: we can no longer count on Let's Encrypt's emails."

    Well done! You have finished chapter 5 of The Data Centre.

    WHAT HAPPENED
    On the day of the fire, the certificate was requested before the
    website was restored: certbot recorded Debian's default website
    directory, /var/www/html. For 60 days, no problem. Then, starting 30
    days before expiry, every automatic renewal dropped the challenge in
    that directory, which nginx doesn't serve for the media library: 404,
    failure, twice a day, silently. This morning, the certificate expired.

    GOOD PRACTICE
    - A Let's Encrypt certificate lasts 90 days; certbot tries to renew it
      30 days before the end. A failed renewal goes unnoticed: monitor the
      expiry date yourself (openssl x509 -checkend, a probe), and the
      certbot service (systemctl --failed).
    - certbot renew --dry-run after every change to the website or nginx.
    - The HTTP-01 challenge goes through port 80: the directory given to
      certbot (-w) must be the one nginx serves for that name.
    - nginx reads its certificate when it loads: a deploy hook (systemctl
      reload nginx) reloads it after each successful renewal.
    - Always check like a visitor: curl https://…, or openssl s_client.

    ANOTHER WAY
    Other ACME clients: acme.sh (a shell script, no dependencies) or lego;
    or a web server that handles it alone (Caddy obtains and renews its
    certificates with no configuration). And the DNS-01 challenge (a TXT
    record) instead of HTTP-01: the only one that gives a wildcard
    certificate (*.example), but you must be able to write to your DNS
    zone.

    DOCUMENTATION
    - certbot: https://eff-certbot.readthedocs.io/en/stable/using.html
    - Let's Encrypt challenges: https://letsencrypt.org/docs/challenge-types/
    - openssl x509: https://docs.openssl.org/3.5/man1/openssl-x509/
