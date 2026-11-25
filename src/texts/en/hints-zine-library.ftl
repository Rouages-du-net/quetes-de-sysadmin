### Graded hints for The Zine Library (see src/engine/hints.ts): one
### message per step, hint-<chapter>-<event>, with .lead (a direction,
### without the exact command) and .solution (almost the answer).

## Chapter 1 — Denied

hint-denied-upload-denied =
    .lead = "Permission denied" while the rights are right: something else refuses. The kernel writes down AppArmor's refusals (man journalctl, -k; Bartek's notes).
    .solution = sudo journalctl -k | grep DENIED (or sudo dmesg | grep DENIED)
hint-denied-upload-profile =
    .lead = Which profile confines php-fpm, and where does it take the site's own rules from? aa-status lists the profiles; read the profile's file.
    .solution = sudo aa-status; cat /etc/apparmor.d/php-fpm; cat /etc/apparmor.d/local/php-fpm
hint-denied-upload-fixed =
    .lead = Name the new place in the site's file, like the old one (the directory itself, and what is under it, read and write), then have the kernel reload the profile that includes it (man apparmor_parser).
    .solution = sudo nano /etc/apparmor.d/local/php-fpm: /srv/scans/ r, and /srv/scans/** rw, ; then sudo apparmor_parser -r /etc/apparmor.d/php-fpm
hint-denied-upload-end =
    .lead = Everything in place? The profile in enforce mode and confining php-fpm, the package's file untouched, the rights as they were, and an upload that went through.
    .solution = sudo aa-status; ls -ld /srv/scans; ls -l /srv/scans; sudo tail -3 /var/log/nginx/access.log

## Chapter 2 — A Profile of Our Own

hint-backup-profile-script =
    .lead = What does the backup do, and where does it take its list from? Read the script and its configuration.
    .solution = cat /usr/local/sbin/zine-backup; cat /etc/zine-backup.conf
hint-backup-profile-profile-file =
    .lead = A first profile for a program can be generated (man aa-autodep): in complain mode, it watches without refusing.
    .solution = sudo aa-autodep /usr/local/sbin/zine-backup; cat /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-observed =
    .lead = Let the kernel see the script at work: run the backup while its profile is in complain mode, then look at the audit log.
    .solution = sudo zine-backup; sudo grep ALLOWED /var/log/audit/audit.log
hint-backup-profile-rules =
    .lead = Turn the ALLOWED lines into rules: aa-logprof asks for each one (Inherit for programs, Glob for a directory's files and for the archive, Allow), then save. Or write them by hand (man apparmor.d).
    .solution = sudo aa-logprof: I for date, tar, gzip; A for the capability; G until /srv/backup/*, /srv/scans/** and /var/lib/zinecat/**, then A; S to save
hint-backup-profile-enforced =
    .lead = The rules are written: put the profile in enforce mode, in its file and in the kernel (man aa-enforce).
    .solution = sudo aa-enforce /etc/apparmor.d/usr.local.sbin.zine-backup
hint-backup-profile-end =
    .lead = Run the backup once more, confined: it must succeed, with the scans and the catalogue, and /etc/shadow must stay out of reach (try adding it to SOURCES, then take it out).
    .solution = sudo zine-backup; sudo aa-status; sudo grep DENIED /var/log/audit/audit.log
