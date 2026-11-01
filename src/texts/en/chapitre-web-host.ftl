### Story "The Community Centre", chapter "The web host":
### sftp, then publishing a site at a shared web host over FTPS with lftp.
### Commands, machine names, paths and HTML are not translated
### (the text of the pages is).

chapitre-web-host = The web host
    .resume = The new site is ready on the wiki: fetch it with sftp, then publish it at the web host, which no longer accepts plain FTP. FTPS, the right server name, and nothing old left lying around.

## Files

# { $compte }: the FTP account at the web host; { $motdepasse }: its password
web-host-courriel-yasmine =
    From:    Yasmine
    To:      you
    Subject: The new website

    The Centre's new website is ready! It's on the wiki, in
    /srv/wiki/site. It needs to go live at our web host, and above
    all the 2025 price page has to go, those prices are out of date.

    Gaspard used to handle it, with FileZilla; his notes are in
    notes-gaspard.txt. But the web host wrote to us (email_hosting.txt):
    since 1 March, no more plain FTP.

    His credentials, which the web host sent me again:
        account      : { $compte }
        password     : { $motdepasse }

    You get to the wiki as usual from your workstation (the shortcut
    ssh wiki); to look before you take: man sftp. For the web host,
    which only offers FTP: man lftp, installed on your
    workstation.

web-host-courriel-hebergeur =
    From:    Web host support <support@hosting.example>
    Subject: End of unencrypted FTP on 1 March

    Hello,

    To protect your credentials, our servers now refuse unencrypted
    FTP connections. Use FTPS (explicit FTP over TLS,
    port 21): most clients do this by default.

    Server: ftp.hosting.example
    Our certificate is issued for *.hosting.example: connect
    using that name so that it is recognised. Never disable
    certificate verification.

    Your site is in the public_html directory of your account.

    The technical team

web-host-notes-gaspard =
    GASPARD'S NOTES — publishing the site

    FileZilla:
      host         : ftp.community.example
      port         : 21
      encryption   : "Only use plain FTP (insecure)"
                     (with encryption I got a certificate
                     error, so I turned it off)
      directory    : public_html

    I drag the files from one side to the other. The old files, I
    leave them there, just in case.

## The site

web-host-ancien-index =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Community Centre</title></head>
    <body><h1>Community Centre</h1>
    <p>Welcome! See the calendar and the 2025 prices.</p></body></html>
web-host-ancien-agenda =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Calendar</title></head>
    <body><h1>Calendar 2025</h1><p>Neighbours' party: 23 May 2025.</p></body></html>
web-host-ancien-tarifs =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Prices 2025</title></head>
    <body><h1>Prices 2025</h1><p>Room hire: €15 per hour.</p></body></html>
web-host-index =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Community Centre</title>
    <link rel="stylesheet" href="style.css"></head>
    <body><header><img src="images/logo.svg" alt="" width="48"><h1>Community Centre</h1></header>
    <p>Welcome! The activities calendar and membership are online.</p>
    <p><a href="agenda.html">Calendar</a> · <a href="adhesion.html">Join</a></p></body></html>
web-host-agenda =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Calendar</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Calendar 2028</h1><p>General meeting: 12 April. Neighbours' party: 26 May.</p></body></html>
web-host-adhesion =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Join</title><link rel="stylesheet" href="style.css"></head>
    <body><h1>Join</h1><p>Membership is pay-what-you-can, at the front desk or by email.</p></body></html>

## Events

web-host-evenement-clair =
    The web host refuses: no more plain FTP, as announced. And
    that's a good thing: with plain FTP, the account password travels in
    clear text over the network, readable by anyone along the way (a
    café's Wi-Fi…). lftp encrypts on its own (FTPS), unless you tell it
    not to.
web-host-evenement-certificat =
    The connection is encrypted, but lftp rejects the certificate: it is
    issued for *.hosting.example, and you asked for ftp.community.example.
    That's the error Gaspard got. You don't fix it by turning off
    verification, but by asking for the server under the name its
    certificate carries (email_hosting.txt).
web-host-evenement-sans-verification =
    Careful: certificate verification is turned off
    (ssl:verify-certificate). The connection is encrypted… but with
    anyone at all: someone pretending to be the web host would
    receive the password without lftp complaining. Turn
    verification back on, and use the name the certificate covers.
web-host-evenement-mauvais-sens =
    Oops: mirror without -R copies FROM the hosting TO your workstation. You
    just fetched the old site (the 2025 price page has landed on your
    machine). -R (reverse) sends the other way. The new site is
    still on the wiki if you need it again.
web-host-evenement-mauvais-dossier =
    The site has reached the web host… but not in public_html: mirror
    -R site, with no target, creates a directory of the same name next to it.
    The directory the web server publishes is public_html (and the extra
    directory can be removed: rm -r).
web-host-evenement-reste =
    The new site is online… and so is the 2025 price page:
    mirror deletes nothing on the other side without --delete. (To see what
    it would do before doing it: --dry-run.)
web-host-evenement-fin =
    The new site is online, exactly the one from the wiki, and the 2025
    prices are gone. The password never travelled in clear text.
    Yasmine: "Gaspard is asking if you could show him, for next
    time."

    Well done! You've finished the chapter "The web host".

    WHAT HAPPENED
    sftp transfers files over SSH, like scp, but interactively: you
    look around (ls, cd), then take (get) or send (put). Shared web
    hosting, on the other hand, often only offers FTP: then you need FTPS,
    FTP encrypted with TLS, like a website over HTTPS. Encryption only
    protects you if the certificate is verified, and it only verifies
    under the name it carries: the web host's, not your own site's.

    GOOD PRACTICE
    - SFTP (or scp, rsync) whenever you have SSH; FTPS otherwise; never
      plain FTP.
    - Never turn off certificate verification: change the name, not
      the settings.
    - Publish with mirror -R --delete (after a --dry-run): the site
      online is exactly the one you prepared, with no old files.

    DOCUMENTATION
    - sftp: https://man.openbsd.org/sftp
    - lftp: https://lftp.yar.ru/lftp-man.html
    - FTP over TLS (RFC 4217): https://www.rfc-editor.org/rfc/rfc4217
