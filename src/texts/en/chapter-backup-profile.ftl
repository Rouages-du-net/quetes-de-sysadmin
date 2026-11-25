### Story "The Zine Library", chapter "A Profile of Our Own": a backup
### script that runs as root gets its own AppArmor profile: aa-autodep,
### complain mode, a run, aa-logprof, aa-enforce. Commands, options, paths,
### profile rules and outputs are not translated.

chapter-backup-profile = A Profile of Our Own
    .summary = The library's backup script runs as root and saves whatever its configuration lists: last month that included the passwords file. Give it its own AppArmor profile, learnt from what it really does, so that even as root it can reach the scans, the catalogue and its archive, and nothing else.

## Files

backup-profile-message-hinewai =
    From: Hinewai (The Zine Library)
    Tuesday 22 March, 19:10

    Hello! Thank you again for the fair. Now a worry of mine.

    My backup script, /usr/local/sbin/zine-backup, runs as root every night
    (cron) and saves what /etc/zine-backup.conf lists. In February somebody
    added /etc to SOURCES "to keep nginx's settings", and the archive copied
    to the volunteers' shared USB key contained /etc/shadow. I took /etc out
    and we changed every password, but nothing stops it from happening
    again: the script is root, it reads whatever it is told to.

    The board would like it confined by AppArmor, like php-fpm: the scans,
    the catalogue's database, its archive in /srv/backup, and nothing else,
    whatever its configuration says. Rahim installed auditd last week (the
    Debian wiki says the profile tools want it): AppArmor's lines now go to
    /var/log/audit/audit.log.

    You can run the backup whenever you like: sudo zine-backup, or sudo
    systemctl start zine-backup. Nobody uses the catalogue at this hour.

    Hinewai

## Events

backup-profile-event-script =
    The script reads its list from /etc/zine-backup.conf and hands it to
    tar, as root: one line in that file is enough to save anything. A
    profile will let it reach only what a backup needs. aa-autodep writes a
    first one (man aa-autodep).

backup-profile-event-profile-file =
    The script has a profile in /etc/apparmor.d, loaded in complain mode: it
    lets everything through and logs what its rules don't cover. Now run the
    backup, so that the kernel sees what it really does.

backup-profile-event-too-early =
    The profile, in enforce mode, refused something the backup needs, and
    the backup failed: the DENIED lines in /var/log/audit/audit.log say
    what. Either the program wasn't watched in complain mode first, or a
    rule is too narrow: the archive's name changes with every run, its
    rule must not name tonight's file.

backup-profile-event-not-attached =
    A profile is loaded, but the script ran unconfined: its attachment (the
    path after the profile's name, or the name itself when it starts with
    /) must match /usr/local/sbin/zine-backup.

backup-profile-event-observed =
    The run went through in complain mode, and audit.log got its
    apparmor="ALLOWED" lines: the configuration read, date, tar and gzip
    executed, the scans and the catalogue read (with capability
    dac_read_search: the catalogue belongs to www-data and others may not
    read it, so even root needs it), the archive written. aa-logprof turns
    them into rules, one question at a time (man aa-logprof).

backup-profile-event-too-wide =
    This profile still lets the backup reach { $path }: nothing a backup
    needs. A glob that climbs too high (/**), or tar run unconfined (ux),
    gives back what the profile was meant to take away.

backup-profile-event-rules =
    The profile now holds the backup's rules. It is still in complain mode:
    it protects nothing yet.

backup-profile-event-enforced =
    The profile is in enforce mode. Run the backup again: it must still go
    through.

backup-profile-event-shadow =
    tar: /etc/shadow: Cannot open: Permission denied, and an
    apparmor="DENIED" line: with /etc/shadow in SOURCES, the profile refuses
    it, root or not. Take it out of the configuration again: the backup
    should then succeed.

backup-profile-event-end =
    Hinewai: "The board is pleased. And I'll sleep better: whatever ends up
    in that file, the script can't take the passwords any more."

    Well done! You finished A Profile of Our Own.

    WHAT HAPPENED
    The backup script ran as root and read whatever its configuration
    listed. You gave it a profile of its own: aa-autodep started it in
    complain mode, a run let the kernel log what the script did (with
    auditd, in /var/log/audit/audit.log), aa-logprof turned those lines into
    rules (tar and gzip as ix, the directories globbed, capability
    dac_read_search for the catalogue), then aa-enforce. The script is a new
    process on every run: the profile attaches at its next exec, nothing to
    restart. Root or not, it can no longer read /etc/shadow.

    GOOD PRACTICE
    - Observe before you enforce: complain mode, a real run (the nightly
      job's usual path), then the rules.
    - Read each question of aa-logprof: allow what the program needs, glob a
      directory rather than list its files, never ux, never /**.
    - Check a profile both ways: the job succeeds, and what it must not
      touch is refused (DENIED).
    - Under AppArmor, root isn't all-powerful: capabilities are rules too
      (capability dac_read_search).
    - Keep complain mode short, and keep the profile with the machine's
      configuration (and in its backups).

    ANOTHER WAY
    systemd's sandboxing narrows what a service sees without a profile
    (ProtectSystem=strict, ReadWritePaths=, InaccessiblePaths=/etc/shadow).
    SELinux confines by labels: a domain for the script, types on its files;
    a stronger separation, but labelling everything a backup reads is more
    work.

    DOCUMENTATION
    - aa-logprof(8): https://manpages.debian.org/trixie/apparmor-utils/aa-logprof.8.en.html
    - aa-autodep(8): https://manpages.debian.org/trixie/apparmor-utils/aa-autodep.8.en.html
    - aa-enforce(8), aa-complain(8): https://manpages.debian.org/trixie/apparmor-utils/aa-enforce.8.en.html
    - apparmor.d(5): https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - Profiling with the tools: https://gitlab.com/apparmor/apparmor/-/wikis/Profiling_with_tools
