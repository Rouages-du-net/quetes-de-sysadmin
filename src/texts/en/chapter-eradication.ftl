### Story "The Bastion", chapter "Eradication": remove the ways back the
### intruder left (crontab, key, files) without taking what is
### legitimate, find what was changed, and restore it from a release whose
### signature is checked. Commands, paths, keys and fingerprints are not
### translated.

chapter-eradication = Eradication
    .summary = Remove the ways back the intruder left, find what was changed, and restore it from a signed release you have checked.

## Files

# { $fingerprint }: Selma's ssh key fingerprint
eradication-email-selma =
    From:     Selma
    To:       you
    Subject:  Re: deploy account

    Nadia called me. I'm sorry, the password was meant to be temporary,
    just for my first deployments in March. My key is the only one that
    should be on deploy; its fingerprint is:

        { $fingerprint }

    The crontab has one job of mine, sync-orders, every quarter of an
    hour: please keep it, the shop's orders go through it.

    My releases are signed with my gpg key (already in the server's
    keyring, gpg --list-keys). The 2.3.1 release is in /srv/releases, with
    its signature. Don't trust anything else.

    Selma

eradication-incident =
    # Incident — oven (deliveries)

    ## Contained (14/04, 9:30)
    Pool and 203.0.113.66 blocked (iptables), miner and watchdog stopped,
    deploy expired.

    ## Still to do
    - What did they leave to come back? (crontab, keys, files)
    - What did they change? The app relaunched the miner on its start.
    - deploy's history (/home/deploy/.bash_history) may say a lot.

## Events

# { $line }: Selma's job
eradication-event-cron-all =
    Selma's job is gone from deploy's crontab ({ $line }): the shop's orders
    won't sync any more. Put it back (crontab -u deploy -e).
# { $line }: the line removed
eradication-event-cron =
    The @reboot line is gone ({ $line }): at the next start, nothing
    relaunches the watchdog. And Selma's job is still there.
eradication-event-key-all =
    Selma's key is gone too: she won't be able to deploy any more. Only the
    intruder's key had to go: compare the fingerprints (ssh-keygen -lf)
    with the one in her email.
eradication-event-key =
    The intruder's key is removed, Selma's is kept. Both said selma@studio: a
    comment is free text, only the fingerprint told them apart.
eradication-event-files =
    The miner and its watchdog are gone from /tmp/.cache.
eradication-event-bad-signature =
    BAD signature: this archive is not the one Selma signed. Its content was
    changed after the signature: it's the copy the intruder rebuilt, with
    their line inside. Don't restore from it.
eradication-event-verified =
    Good signature, from Selma's key: this archive is exactly the one she
    published. You can restore from it.
eradication-event-restored =
    server.js is identical to the release again: the added line is gone.
eradication-event-unverified =
    server.js looks like the release again, but nothing proves it: the
    intruder may have changed more than one line. Check the signature of
    Selma's release (gpg --verify) before trusting it.
eradication-event-relaunched =
    The app has started again, and with it the watchdog and the miner:
    server.js still relaunches them, and its script is still there. Stop
    them, then deal with the cause.
eradication-event-end =
    Selma: "Thank you. I'll change my habits: no more passwords, even
    'just for a week'."

    Well done! You have finished the chapter "Eradication".

    WHAT HAPPENED
    The intruder had left three ways back: a crontab line at each boot,
    their own key in deploy's authorized_keys, and a line in the app that
    relaunched the miner at each start. You removed each one without taking
    what was legitimate with it, and restored the app from a release whose
    signature you checked first, not from the copy left nearby.

    GOOD PRACTICE
    - Look for persistence everywhere an account can write: its crontab,
      its keys, its files, what its services run. deploy's history said a
      lot, but an intruder can erase it: don't rely on it alone.
    - Remove line by line: crontab -r or emptying authorized_keys takes
      the legitimate with the rest.
    - Restore from a source you trust and can check (a signed release, a
      backup older than the intrusion), never from a copy the intruder
      could have touched.

    ANOTHER WAY
    When in doubt about what else was changed, reinstall: a new server
    built from known sources (packages, signed release, backup of the
    data), then the data checked before it goes back. It's longer, but it's
    the only way to be sure. Here, the intruder never had root, which made
    a targeted cleanup reasonable.

    DOCUMENTATION
    - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
    - ssh-keygen (-l): https://man.openbsd.org/ssh-keygen
    - gpg --verify: https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html
    - NIST SP 800-61r2, eradication and recovery: https://csrc.nist.gov/pubs/sp/800/61/r2/final
