### Story "The Neighbourhood Letters", chapter 4 "Sharing a home":
### virtual hosts and reverse proxy with nginx. Commands, paths,
### directives and nginx messages are never translated. The site pages
### (colocation-site-*, colocation-agenda-*) are translated.

chapter-sharing = Sharing a home
    .resume = Two sites and an app on a single server: virtual hosts, ln -s, reverse proxy with nginx.

## Files

sharing-email-kofi =
    From:    Kofi (Les Lettres du quartier association)
    To:      you
    Subject: The café is moving in with us

    Good news: the community café (remember, the one where the internet
    stopped working) is done paying for hosting. It's moving onto our
    server! One machine, two sites: apparently nginx can do that.
    I've already pointed the name cafe.example to our address.

    And Rania has finished the workshop calendar: a small program that should
    show up under http://letters.example/agenda/.

    So we need:
    1. http://cafe.example to show the café's site;
    2. http://letters.example to stay our site, of course;
    3. http://letters.example/agenda/ to show the calendar (and its pages,
       like /agenda/semaine);
    4. all of this to survive a reboot.

    Rania left her notes (note_from_rania.txt). For sudo, your
    password is still the same: ants-2026
sharing-note-rania =
    RANIA'S NOTES

    The café's pages are ready: /var/www/cafe/

    On Debian, each site has its file in /etc/nginx/sites-available/,
    and you enable it with a symbolic link in /etc/nginx/sites-enabled/
    (ls -l /etc/nginx/sites-enabled to see how ours is done).
    The simplest way: copy our file and adapt it.

    The calendar is in /opt/agenda (systemd service "agenda"). It listens
    on 127.0.0.1:3000, only on the machine itself: nginx has to
    pass visits on to it (reverse proxy, see proxy_pass in
    man nginx). Its pages start at /: /, /semaine, /ateliers.

    To test a site from the server, before the whole world sees it:
      curl -H "Host: cafe.example" http://127.0.0.1
    And always: sudo nginx -t before reloading.
sharing-agenda-readme =
    Workshop calendar — Node.js server

    Listens on 127.0.0.1:3000 (see serveur.js).
    Pages: /  /semaine  /ateliers
    systemd service: agenda
sharing-agenda-code =
    // Workshop calendar of Les Lettres du quartier.
    const express = require('express');
    const app = express();

    app.get('/', (req, res) => res.sendFile(__dirname + '/pages/accueil.html'));
    app.get('/semaine', (req, res) => res.sendFile(__dirname + '/pages/semaine.html'));
    app.get('/ateliers', (req, res) => res.sendFile(__dirname + '/pages/ateliers.html'));

    // Only on the machine itself: nginx is in front.
    app.listen(3000, '127.0.0.1');

## The sites

sharing-site-letters =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Les Lettres du quartier</title></head>
    <body>
    <h1>Les Lettres du quartier</h1>
    <p>Public letter writer, writing workshops, help with paperwork.</p>
    </body>
    </html>
sharing-site-cafe =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The community café</title></head>
    <body>
    <h1>The community café</h1>
    <p>Open Wednesday to Sunday. Soup of the day, pay what you can.</p>
    </body>
    </html>
sharing-agenda-welcome =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Workshop calendar</title></head>
    <body>
    <h1>Workshop calendar</h1>
    <p><a href="semaine">This week</a> · <a href="ateliers">All workshops</a></p>
    </body>
    </html>
sharing-agenda-week =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>This week</title></head>
    <body>
    <h1>This week</h1>
    <p>Tuesday 6 pm: writing workshop. Thursday 2 pm: help with online paperwork.</p>
    </body>
    </html>
sharing-agenda-workshops =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The workshops</title></head>
    <body>
    <h1>The workshops</h1>
    <p>Writing, reading aloud, online paperwork, letter writing.</p>
    </body>
    </html>

## Events

sharing-event-link-broken =
    nginx can't find a file in /etc/nginx/sites-enabled/: the link
    is broken. ls -l /etc/nginx/sites-enabled shows where it points. A
    relative path is read from the link's directory (sites-enabled), not
    from where you were when you created it: reread man ln, and delete the
    bad link with rm (the target file doesn't move).
sharing-event-conflict =
    "conflicting server name": two sites answer to the same name. nginx
    keeps the first one it reads and ignores the other for that name. The
    copied file probably kept the server_name of the Lettres site.
sharing-event-bad-site =
    You asked for cafe.example… and the Lettres site answers.
    nginx picks the site from the requested name (server_name); if none
    matches, it takes the port's default site (default_server).
    Is the café site enabled, and does it carry that name?
sharing-event-cafe =
    cafe.example answers with the café's page: two sites on the same
    machine, at the same address, told apart only by the requested name.
    That's a virtual host.
sharing-event-gateway =
    502 Bad Gateway: nginx did receive the visit, but nobody answers
    behind it. Its error log says why:
    sudo tail /var/log/nginx/error.log. And is the calendar running?
sharing-event-cannot-get =
    "Cannot GET /agenda/": this time it's the calendar answering… but it
    receives the path /agenda/, while its pages start at /. With
    proxy_pass, one detail matters enormously: the trailing slash. Reread
    proxy_pass in man nginx.
sharing-event-agenda-without-enable =
    The calendar answers. But it won't start with the machine: at the next
    reboot, 502 again. (man systemctl)
sharing-event-end =
    cafe.example, letters.example and the calendar all answer, each with its
    own pages, from a single server. Kofi: "We're throwing a party for
    the café moving in. You're invited!"

    Well done! You've finished chapter 4 of The Neighbourhood Letters. (Next
    up: Works on my machine.)

    WHAT HAPPENED
    One IP address, one nginx, several sites: each visit
    announces the name it's asking for (Host header), and nginx picks the
    server block whose server_name matches, or else the one marked
    default_server. In front of the calendar, nginx acts as a reverse proxy:
    it receives the visits and passes them to the program that only listens
    on 127.0.0.1.

    GOOD PRACTICE
    - One file per site in sites-available, enabled by a link in
      sites-enabled (ln -s, with an absolute path); you disable it by
      deleting the link, without losing the file.
    - A single default_server per port, and an explicit server_name everywhere.
    - Test a site before DNS: curl -H "Host: name" http://127.0.0.1
    - proxy_pass http://127.0.0.1:3000/; (with the slash) replaces the
      location prefix; without the slash, the path goes through as is.
    - 502: look at error.log, then at the service behind nginx.
    - An app behind a proxy listens on 127.0.0.1, never on all
      addresses.

    ANOTHER WAY
    Apache does the same thing (VirtualHost, a2ensite); so does Caddy, with
    automatic HTTPS. In front of containers, Traefik discovers the apps
    on its own. nginx is still the most widespread in front of an app, and
    its configuration is easy to reread.

    DOCUMENTATION
    - How nginx picks a site: https://nginx.org/en/docs/http/request_processing.html
    - server_name: https://nginx.org/en/docs/http/server_names.html
    - proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
