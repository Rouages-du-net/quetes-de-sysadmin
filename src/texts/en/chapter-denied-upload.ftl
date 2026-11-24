### Story "The Zine Library", chapter "Denied": the scans of a zine
### catalogue moved to a new disk, and php-fpm's AppArmor profile refuses
### them. The kernel's DENIED lines, the profile and its local/ file,
### apparmor_parser -r. Commands, options, paths, profile rules and outputs
### are not translated.

chapter-denied-upload = Denied
    .summary = The zine fair is tomorrow, and since the scans moved to a new disk the library's catalogue shows an error page and refuses every upload, though the files' rights look right. Find who says no, and let the app in without opening the whole machine.

## Files

denied-upload-message-nomvula =
    From: Nomvula (coordinator, The Zine Library)
    Friday 11 March, 17:40

    Hello, and thank you for coming in on a Friday evening!

    Tomorrow is our zine fair, and since this afternoon the online catalogue
    shows an error page. Worse: the volunteers scanning the new zines can't
    upload them, the page just says "Upload failed.".

    The only change today: at three o'clock Rahim moved the scans to the new
    disk (the old one was full) and changed the app's settings. He checked
    before leaving to fetch the tables: /srv/scans belongs to www-data, as
    the old directory did. He doesn't understand either.

    Bartek, who set up stapler in 2031, left notes in your home directory.
    sudo works with your password. And please: Bartek always said not to
    simply switch off the server's protection. Let's not do that the night
    before the fair.

    Nomvula

denied-upload-notes-bartek =
    Notes from Bartek (stapler, 2031)

    - stapler: Debian 13, nginx in front, PHP 8.4 behind it (the
      php8.4-fpm service). The catalogue app, zinecat, is in
      /var/www/zinecat; its settings in config.php.
    - AppArmor is on by default on Debian. I installed the
      apparmor-profiles package for its php-fpm profile: php-fpm runs
      confined, a hole in the app wouldn't give the whole machine away.
    - The profile is /etc/apparmor.d/php-fpm. It belongs to the package:
      I don't touch it. Our own rules are in /etc/apparmor.d/local/php-fpm.
    - sudo aa-status lists the profiles loaded and the processes they
      confine.
    - Debian 13 has no /var/log/syslog: the kernel's messages, AppArmor's
      included, are in the journal (sudo journalctl -k) and in sudo dmesg.
    - nginx's logs: /var/log/nginx/access.log and error.log.

## Events

denied-upload-event-denied =
    There it is. apparmor="DENIED" operation="open" profile="php-fpm"
    name="/srv/scans/": the kernel refused php-fpm (fsuid=33: www-data)
    reading the directory, although its rights allow it. AppArmor is asked
    after the rights, and decides by path, from the program's profile.
    requested_mask="r" is a read; operation="mknod" with "c" is creating a
    file, an upload. Which rules does the php-fpm profile have? (man
    apparmor.d)

denied-upload-event-profile =
    The php-fpm profile ends with include if exists <local/php-fpm>: the
    site's own rules, in a file no package update will ever overwrite.
    Bartek's lines there name /var/www/zinecat/scans, the old place.

denied-upload-event-disabled =
    php-fpm's profile is no longer loaded, or it is disabled: the catalogue
    may work again, but php-fpm now runs unconfined, and a hole in the app
    would reach the whole machine. Enable it again (man aa-enforce). Mind
    the processes already running: a profile attaches when a program is
    executed.

denied-upload-event-complain =
    Complain mode: AppArmor lets everything through and logs it as
    apparmor="ALLOWED". It is for watching a program for a while, not a
    fix: in complain mode the profile protects nothing. Put it back in
    enforce mode once the right rule is there.

denied-upload-event-vendor =
    /etc/apparmor.d/php-fpm belongs to the apparmor-profiles package (a
    configuration file dpkg tracks): at the next upgrade, dpkg will ask
    whether to keep your version or take the new one, and the next person
    may well take the new one. Take your lines out of it again: the site's
    rules go in the file the profile includes for that purpose.

denied-upload-event-chmod =
    /srv/scans is now writable by everyone. The rights weren't the problem
    (www-data owns the directory): AppArmor is asked after them, and still
    says no. Put the rights back as they were (chmod 755).

denied-upload-event-parser-local =
    local/php-fpm is a piece of a profile, not a profile: the parser can't
    load it alone. Reload the profile that includes it, the file in
    /etc/apparmor.d itself.

denied-upload-event-parser-error =
    The parser refused the file and the kernel kept the profile it had. The
    message names the file and the line; each rule ends with a comma, and a
    missing comma is reported on the line after.

denied-upload-event-too-open =
    That rule gives php-fpm the whole machine: it could now read /etc/shadow
    or root's keys. A profile lists what the program needs: the scans'
    directory and what is in it, nothing more.

denied-upload-event-not-reloaded =
    The rule is in the file, but the kernel still has the old profile:
    AppArmor reads a profile when it is loaded, not when its files change.
    Reload it (man apparmor_parser).

denied-upload-event-read-only =
    The catalogue can read the scans again, but uploads still fail: the
    profile lets php-fpm read /srv/scans, not create files in it (mknod,
    requested_mask="c": that needs w).

denied-upload-event-unconfined =
    The profile is loaded, but php-fpm's workers run unconfined: they were
    executed while the profile wasn't loaded, and a profile attaches when a
    program is executed (sudo aa-status shows it). Restart php8.4-fpm.

denied-upload-event-fixed =
    The kernel lets php-fpm into /srv/scans again: the catalogue answers,
    and the last upload went through (ls -l /srv/scans). No restart needed:
    a profile replaced in the kernel applies at once to the processes it
    confines.

denied-upload-event-end =
    Nomvula: "riso-dreams-04 is in the catalogue, and the volunteers are
    uploading again. Rahim says he'll check AppArmor next time he moves
    anything. See you at the fair!"

    Well done! You finished Denied.

    WHAT HAPPENED
    php-fpm runs under AppArmor's php-fpm profile, which lists the files it
    may use by their path. Bartek's site rules, in local/php-fpm, named
    /var/www/zinecat/scans. When Rahim moved the scans to /srv/scans, the
    Unix rights were right, but the path was no longer in the profile: the
    kernel refused, and wrote it down (apparmor="DENIED" … name="/srv/scans/").
    You added the new place to local/php-fpm and reloaded the profile with
    apparmor_parser -r: the running workers got the new rules at once.

    GOOD PRACTICE
    - "Permission denied" while the rights look right: read the kernel's log
      (journalctl -k, dmesg; /var/log/audit/audit.log when auditd runs) for
      apparmor="DENIED": profile, operation, name and requested_mask say
      who was refused what.
    - A site's rules go in /etc/apparmor.d/local/NAME, never in the
      package's profile: an upgrade replaces the package's file.
    - Reload the profile itself (apparmor_parser -r /etc/apparmor.d/NAME,
      or systemctl reload apparmor), not its local piece.
    - Give the least: /srv/scans/ r and /srv/scans/** rw, not /** rw.
    - aa-disable, complain mode left on, chmod 777: they silence the
      message, the hole stays. And a profile enabled again only reaches
      programs executed after it.
    - When you move a service's data, move its confinement with it.

    ANOTHER WAY
    SELinux (Red Hat, Fedora, Rocky Linux) decides by labels, not by paths:
    a file is allowed by its type (httpd_sys_rw_content_t), wherever it is.
    There, a moved file must be relabelled (semanage fcontext, restorecon);
    with AppArmor, its new path must be named in the profile. A label follows
    a file renamed; a path is easier to read in a rule.

    DOCUMENTATION
    - apparmor.d(5): https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - apparmor_parser(8): https://manpages.debian.org/trixie/apparmor/apparmor_parser.8.en.html
    - aa-status(8): https://manpages.debian.org/trixie/apparmor/aa-status.8.en.html
    - AppArmor on Debian: https://wiki.debian.org/AppArmor/HowToUse
    - AppArmor: https://apparmor.net

## What the chapters of the story share: kept here so that they load with the story.

zine-library-local-comment = # Site-specific rules for php-fpm (Bartek, 2031): the zine catalogue.
zine-library-local-comment-scans = # The scans moved to the new disk (March 2033).
zine-library-local-readme =
    # Site-specific additions and overrides for a profile go in a file of
    # this directory named after the profile (local/php-fpm for php-fpm).
    # The profile includes it ("include if exists <local/php-fpm>"), and no
    # package update overwrites it. After a change, reload the profile
    # itself: apparmor_parser -r /etc/apparmor.d/php-fpm
zine-library-config-comment = // Where the scans are kept (Rahim, 11 March: moved to the new disk).
zine-library-script-comment = # zine-backup: the catalogue's nightly backup (Hinewai, 2032).
zine-library-conf-comment = # What zine-backup saves (SOURCES) and where (DEST).
zine-library-cron-comment = # Every night at 02:30 (Hinewai).
