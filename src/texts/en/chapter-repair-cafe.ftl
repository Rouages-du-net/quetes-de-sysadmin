### "The Neighbourhood Letters" story, chapter 9 "The Repair Café":
### Apache behind nginx (ports, virtual hosts, .htaccess, mod_rewrite).
### Apache's commands, paths, directives and messages are not translated.

chapter-repair-cafe = The Repair Café
    .summary = The repair café's site runs on Apache, with an .htaccess: make it live behind nginx, on the same server.

## Files

repair-cafe-email-kofi =
    From:    Kofi
    To:      you
    Subject: The repair café

    Hello!

    The repair café's old hosting provider closes at the end of the month.
    I offered to take their site on our server: the DNS for repair.example
    already points here.

    Their site ran on Apache, with an .htaccess file that makes the short
    addresses of their guides work: http://repair.example/guide/42 leads
    to guide 42. These addresses are printed as QR codes on all of the
    café's posters: they must keep working.

    Rather than rewriting everything for nginx right away, we keep Apache,
    behind nginx: nginx stays alone on port 80, for every site, and hands
    the café's visits to Apache. Rania started last night, read her note
    (note_from_rania.txt).

    What we need:
    - Apache runs, and will start again with the machine; but it only
      listens on 127.0.0.1 (port 8080), like the calendar: nobody should
      reach it without going through nginx;
    - http://repair.example/ shows the café's home page, and
      http://repair.example/guide/42 shows guide 42;
    - the Letters and the café stay online.

    Thanks!
    Kofi

repair-cafe-note-rania =
    I ran sudo apt install apache2 last night. At the end, apt printed
    "Job for apache2.service failed", and I didn't have time to look into
    why (systemctl status apache2, journalctl -u apache2…).

    I copied the site to /var/www/repair, with its .htaccess (the hidden
    file that makes the /guide/… addresses work), and the old provider's
    Apache configuration to /etc/apache2/sites-available/repair.conf. I
    enabled it like for nginx, with a link in sites-enabled.

    On the nginx side, the site is ready in
    /etc/nginx/sites-available/repair, not enabled yet: it hands
    everything to 127.0.0.1:8080.

    On Debian, Apache is configured in /etc/apache2: ports.conf for the
    ports, sites-available and sites-enabled like nginx, but with its own
    tools (man a2ensite, man a2enmod, man apache2ctl).

    Rania

repair-cafe-htaccess-comment =
    # Short addresses of the guides, printed on the posters:
    # /guide/42 leads to guides/42.html

repair-cafe-site-welcome =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Repair Café</title></head>
    <body>
    <h1>The Repair Café</h1>
    <p>Every Saturday, we fix things together: bikes, toasters, clothes.</p>
    <p>Guides: <a href="/guide/7">7, replacing an inner tube</a>, <a href="/guide/42">42, descaling a kettle</a>.</p>
    </body>
    </html>

repair-cafe-sheet-7 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Guide 7: replacing an inner tube</title></head>
    <body>
    <h1>Guide 7: replacing an inner tube</h1>
    <p>Take the wheel off, lever the tyre out with two tyre levers, find the hole in a bowl of water.</p>
    </body>
    </html>

repair-cafe-sheet-42 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Guide 42: descaling a kettle</title></head>
    <body>
    <h1>Guide 42: descaling a kettle</h1>
    <p>Half white vinegar, half water: boil, leave for an hour, rinse three times.</p>
    </body>
    </html>

## Events

repair-cafe-event-busy =
    "Address already in use": Apache wants to listen on port 80 (Listen 80,
    in /etc/apache2/ports.conf), but nginx is already there, for every
    site. Two programs cannot listen on the same port of the same address:
    sudo ss -tlnp shows who listens where. Here, nginx keeps port 80;
    Apache will go to 127.0.0.1:8080, where the nginx site Rania prepared
    expects it.
repair-cafe-event-ah00558 =
    "AH00558" is only a warning: Apache doesn't know a full name for the
    machine and uses its address. A global ServerName line silences it
    (for example ServerName localhost in
    /etc/apache2/conf-available/servername.conf, then sudo a2enconf
    servername). It is not what stops Apache from starting.
repair-cafe-event-listening =
    Apache is running! sudo ss -tlnp shows it, with its addresses. Check
    that it serves the café, giving the site's name:
    curl -H "Host: repair.example" http://127.0.0.1:8080/
repair-cafe-event-everywhere =
    Careful: Apache listens on every address of the machine (a Listen with
    just the port). The firewall protects it today, but Rania wants it to
    listen only on 127.0.0.1, like the calendar: only nginx should be able
    to reach it. Listen 127.0.0.1:8080, in ports.conf.
repair-cafe-event-default =
    That's Apache's default page (/var/www/html), not the café's. For a
    request, Apache first keeps the VirtualHosts that match the address
    and port, then the one whose ServerName matches the requested name
    (the Host header); if none does, it takes the first one read, or its
    main configuration. sudo apache2ctl -S shows who answers where. Is the
    café's site read at all (a file in sites-enabled ending in .conf)? Is
    its VirtualHost on the right port? And through nginx: which name does
    nginx pass on to Apache?
repair-cafe-event-site =
    Apache serves the café's home page on the loopback. Now publish it:
    nginx, in front, must hand it the visits for repair.example.
repair-cafe-event-gateway =
    502: nginx can't reach Apache (in /var/log/nginx/error.log: "connect()
    failed"). Is Apache running, and on the port where nginx expects it
    (proxy_pass http://127.0.0.1:8080)?
repair-cafe-event-proxy =
    http://repair.example/ shows the café's home page: nginx, then Apache.
    Now try an address from the posters:
    curl http://repair.example/guide/42
repair-cafe-event-ignore =
    404 on /guide/…: Apache looks for the file /var/www/repair/guide/42,
    which doesn't exist. The rule that transforms this address is in
    /var/www/repair/.htaccess… but Apache only reads .htaccess files if
    AllowOverride allows it, and apache2.conf says AllowOverride None for
    /var/www. Allow it for this site only, in a
    <Directory /var/www/repair> section of its VirtualHost.
repair-cafe-event-internal =
    500 Internal Server Error: Apache read the .htaccess, but something is
    wrong. The reason is in the site's error log:
    sudo tail /var/log/apache2/repair-error.log
repair-cafe-event-rewrite =
    /guide/42 leads to guide 42: the .htaccess rule (RewriteRule) turned
    the address into guides/42.html. Apache rereads the .htaccess on every
    visit: when you change it, nothing to reload.
repair-cafe-event-end =
    The posters' addresses work, through nginx then Apache. Rania: "The
    café's QR codes lead to the right guides again!"

    Well done! You have finished the chapter "The Repair Café".

    WHAT HAPPENED
    Apache wouldn't start: nginx held port 80. It now listens on
    127.0.0.1:8080 (Listen in ports.conf, and the VirtualHost's port), and
    nginx hands it the visits for repair.example. The site wasn't read:
    Apache only takes files ending in .conf from sites-enabled, which
    a2ensite creates. The short addresses go through the .htaccess, which
    Apache only reads with AllowOverride, and whose RewriteRule needs the
    rewrite module (a2enmod).

    NGINX AND APACHE, SIDE BY SIDE
      nginx                        Apache (Debian)
      sites-enabled, ln -s         sites-enabled, a2ensite (.conf)
      nginx -t                     apache2ctl configtest, apache2ctl -S
      listen, server_name, root    Listen, VirtualHost, ServerName, DocumentRoot
      location                     Directory, Location
      rewrite, try_files           RewriteRule (a2enmod rewrite)
      no .htaccess                 .htaccess, if AllowOverride

    GOOD PRACTICE
    - One program per port: one web server in front (reverse proxy), the
      others behind it, on 127.0.0.1.
    - apache2ctl configtest before reloading; apache2ctl -S to know which
      VirtualHost answers which name.
    - Behind a proxy, pass on the requested name (proxy_set_header Host
      $host; in nginx), otherwise Apache serves its default site.
    - .htaccess files help when you have no access to the configuration
      (shared hosting), but Apache rereads them on every visit. On your
      own server, the same rules are better in the VirtualHost, with
      AllowOverride None.

    DOCUMENTATION
    - How the virtual host is chosen: https://httpd.apache.org/docs/2.4/vhosts/details.html
    - .htaccess files: https://httpd.apache.org/docs/2.4/howto/htaccess.html
    - mod_rewrite: https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html
    - proxy_set_header (nginx): https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
