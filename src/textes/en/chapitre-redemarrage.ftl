### Story "The Data Centre", chapter "The night of the reboot":
### systemd services. The server rebooted last night and the website
### went down. Commands, service names, paths and messages
### from systemd or php-fpm (in English) are never translated.

chapitre-redemarrage = The night of the reboot
    .resume = Services that don't come back: systemctl, journalctl, enable, and checking after a reboot.

## Files

redemarrage-courriel-awa =
    From:    Awa (operations manager)
    To:      you
    Subject: The website went down last night

    Last night at 3:12 am, the server rebooted on its own: the automatic
    updates had installed a new kernel. Since then, the media library's
    website no longer responds.

    1. Find which services aren't running, and why. The systemd
       journal knows everything.
    2. Fix them.
    3. Most important: make sure everything will come back ON ITS OWN at
       the next reboot. The only way to be sure: reboot
       (sudo reboot), then check. You'll be disconnected during the
       reboot: reconnect with ssh datacenter.

    My notes are in ~/notes_awa.txt. The sudo password hasn't
    changed.
redemarrage-notes-awa =
    AWA'S NOTES — WHEN A SERVICE WON'T START

      systemctl --failed           the failed services
      systemctl status name        a service's state and its latest messages
      journalctl -u name           all the messages of a service
      journalctl -xeu name         the classic formula: the end, with explanations

    Read the FIRST error: the following ones are often just its
    consequence.

    Careful: "active" (it's running now) and "enabled" (it starts
    with the machine) are two different things. It's all in
    man systemctl.

## Events

# { $logs }: the catalogue's log directory
redemarrage-evenement-logs-ouverts =
    Careful: any account can now write to { $logs },
    and so delete the logs there… or slip in fake messages to cover
    tracks. A log directory must belong to the account of the service
    that writes to it, with no write permission for others.
redemarrage-evenement-nginx =
    nginx is running: the website responds again… for now.

    Look closely at the Loaded line of systemctl status nginx: "disabled".
    What will happen at the next reboot?
redemarrage-evenement-nginx-active =
    nginx is running, and it's enabled: it will come back on its own at
    the machine's next boot.
redemarrage-evenement-catalogue =
    The catalogue starts: php-fpm, which runs under the www-data account, can
    write its log again. Searches on the website work again.
redemarrage-evenement-oubli =
    The machine rebooted… and nginx isn't running: the website is down
    again. systemctl start only lasts until the next boot. For
    a service to start with the machine, reread man systemctl.
redemarrage-evenement-fin =
    After the reboot, everything came back on its own: nginx and the catalogue
    are running, and you checked it. Awa: "That's exactly what the job is:
    not just fixing, but making sure it will hold."

    Well done! You've finished chapter 3 of The Data Centre. (Next
    up: The great fire. Come back later with ssh datacenter.)

    WHAT HAPPENED
    Last night's reboot revealed two problems hidden since
    Friday: nginx had been disabled (disable) during a test, and a
    "chown -R root:" had given root the directory where php-fpm, which runs
    as www-data, writes its log. As long as the machine kept running, nothing
    showed.

    GOOD PRACTICE
    - After every reboot: systemctl --failed.
    - A service refuses to start: journalctl -xeu name, and read the
      first error.
    - start (now) is not enable (at every boot);
      enable --now does both.
    - A service's directory belongs to the service's account, never 777.
    - A server that has never been rebooted is a server you don't know
      will reboot: test a reboot during off-peak hours.

    DOCUMENTATION
    - systemctl: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
