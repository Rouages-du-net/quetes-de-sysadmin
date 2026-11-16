### Story "The Other Unix", chapter "No systemd Here": install and start a
### service the FreeBSD way (pkg, rc.conf, service, sysrc, sockstat). Commands,
### options, paths and messages are not translated.

chapter-rc-services = No systemd Here
    .summary = The programme must be online tonight: install nginx with pkg, switch it on in rc.conf, start it with service, and check who listens.

## Files

rc-services-message-romy =
    From:  Romy
    To:    you

    Tonight's the monthly screening, and the programme still isn't online!
    Lucien's notes say the site was served by nginx, but there's no nginx
    on the server any more (we reinstalled it last spring, and nobody
    redid the web part). Can you put it back before 8 pm? The site itself
    is still in /usr/local/www/club.

    Romy

rc-services-notes-lucien =
    Lucien's notes (2024)
    - nginx from the packages; its configuration in /usr/local/etc/nginx.
    - Everything that starts at boot is in /etc/rc.conf.
    - Not systemd, not apt. man is your friend.

## Events

rc-services-event-no-systemd =
    Not found: FreeBSD has neither systemd nor apt. Packages come from
    pkg (man pkg), and services are rc scripts, driven by service (man
    service).
rc-services-event-ps-ef =
    ps -ef, on FreeBSD, isn't "every process, full format": -e shows each
    process's environment (those HOME=, PATH=…), and without a or x, ps
    only lists your own processes attached to a terminal. The BSD way:
    ps aux (or ps -ax), and ps -axj for the parents. man ps, on this
    machine.
rc-services-event-installed =
    nginx is installed, under /usr/local: its configuration in
    /usr/local/etc/nginx, its rc script in /usr/local/etc/rc.d/nginx.
    Installed doesn't mean running, nor started at boot.
rc-services-event-not-enabled =
    "Cannot 'start' nginx": on FreeBSD, a service only starts if
    /etc/rc.conf switches it on (nginx_enable="YES"). The message even
    names the variable. sysrc writes it without opening an editor (man
    sysrc).
rc-services-event-onestart =
    nginx is running… but with onestart, not because rc.conf says so: at
    the next reboot, it won't come back. The site would vanish one night
    without anyone touching anything.
rc-services-event-enabled =
    nginx_enable="YES" is in rc.conf: nginx will start at every boot.
rc-services-event-end =
    Romy: "The programme is online! Yanis checked from home, it works."

    Well done! You have finished the chapter "No systemd Here".

    WHAT HAPPENED
    nginx wasn't installed any more. pkg installed it under /usr/local,
    rc.conf now switches it on at boot (nginx_enable="YES"), and service
    started it; sockstat shows it listening on port 80.

    GOOD PRACTICE
    - On FreeBSD, a service runs because /etc/rc.conf says so: one line
      per service, NAME_enable="YES", the equivalent of systemctl enable.
    - sysrc edits rc.conf without risking a typo in the rest of the file.
    - Packages live under /usr/local: their configuration is in
      /usr/local/etc, not /etc.
    - Read what pkg prints after installing: packages leave useful
      messages there.

    ANOTHER WAY
    service nginx enable writes the same rc.conf line (FreeBSD 12 and
    later). Ports (/usr/ports) build the same software from source, with
    your choice of options: slower, more flexible. Jails can isolate a
    service in its own little system on the same machine.

    DOCUMENTATION
    - The Handbook, packages: https://docs.freebsd.org/en/books/handbook/ports/#pkgng-intro
    - The Handbook, starting services: https://docs.freebsd.org/en/books/handbook/config/#configtuning-starting-services
    - rc.conf(5): https://man.freebsd.org/cgi/man.cgi?query=rc.conf
    - sysrc(8): https://man.freebsd.org/cgi/man.cgi?query=sysrc
