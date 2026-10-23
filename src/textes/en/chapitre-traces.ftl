### Story "The Audit", chapter "The Traces": a night login nobody expected.
### journalctl, last, key fingerprints (ssh-keygen -l), authorized_keys and a
### cron job left by the intruder. The commands, the paths and the tools'
### messages are not translated.

chapitre-traces = The Traces
    .resume = Trace an unexpected login: journal, last, a key's fingerprint, the intruder's key and cron job.

## Files

traces-courriel-salome =
    From:     Salomé (auditor)
    To:       you
    Subject:  Bakery audit — part three: the traces

    Hello,

    Thank you for part two: my scan now sees only SSH, the website and its
    secure port. One thing remains that I don't like, and it is no longer
    configuration: reading the ssh journal, I saw a login by Nadia's
    account in the night from Sunday to Monday, at 3:12 a.m., from an
    address she doesn't recognise.

    Nadia tells me: "I was asleep, and my key is only on the shop's
    computer."

    What I expect:
    1. That you find this login: when, from where, and with which key (the
       journal keeps its fingerprint).
    2. That you remove the key that is not Nadia's, without locking her out.
    3. That you look for what the person may have left behind, and clean
       up. Nadia's scheduled tasks are a classic place: but be careful not
       to erase her real backup.

    Note: a comment in a key ("nadia@portable") proves nothing, anyone can
    write whatever they want. Compare the fingerprints.

    Salomé
    (For sudo, your password is still: farine-2028)

## Events

# { $adresse }: the address the login came from
traces-evenement-trouve =
    There is the login: a session of the "nadia" account from { $adresse },
    at 3:12 a.m., whereas Nadia usually connects from the shop
    (198.51.100.7), in the evening. The ssh journal kept the fingerprint of
    the key used: "ED25519 SHA256:…".

    Which key in /home/nadia/.ssh/authorized_keys has that fingerprint?
    (man ssh-keygen, option -l)
traces-evenement-cle-identifiee =
    There is the fingerprint of each key in the file. Compare with the one
    in the journal: the second key is the one used that night, and yet it
    carries the comment "nadia@portable". The comment is only a label.

    Remove that line (and only that one) from authorized_keys.
traces-evenement-nadia-enfermee =
    Warning: Nadia's key is no longer in authorized_keys! She could no
    longer log in. Put her key back (the one whose fingerprint is in the
    evening logins, from the shop): we remove the intruder's key, not
    Nadia's.
traces-evenement-cle-revoquee =
    Only Nadia's key is left in authorized_keys: the intruder's key can no
    longer open a session.

    But removing the key only closes the door they came through. What did
    they leave inside during those three minutes? Look at what runs by
    itself for Nadia's account (man crontab).
traces-evenement-cron-decouvert =
    Two tasks for Nadia: sauvegarde.sh at 4 a.m. (that one is hers), and a
    line that, every ten minutes, downloads a program from 203.0.113.99 and
    runs it. That is the intruder's beacon: they can change what the server
    does remotely, even without a key.

    Remove that line, and only that one.
traces-evenement-sauvegarde-perdue =
    Nadia's backup (sauvegarde.sh, at 4 a.m.) is no longer scheduled:
    crontab -r erases the WHOLE crontab. Put her line back:
      0 4 * * * /srv/commandes/bin/sauvegarde.sh
    and remove only the intruder's line.
traces-evenement-cron-nettoye =
    No more beacon, and Nadia's real backup is still there.
traces-evenement-fin =
    The intruder's key is removed, so is their task, and Nadia can still log
    in and back up. Salomé: "My report is complete. I'll come back in six
    months to see whether everything holds."

    Well done! You have finished the chapter "The Traces", and the story
    "The Audit".

    WHAT HAPPENED
    Someone got in with a key added to Nadia's account (we don't know how
    yet: stolen access, an old secret…), and left a cron job to come back.
    A key in authorized_keys is a permanent door: it survives a password
    change. That is why, in an audit, you compare fingerprints rather than
    comments, and look for "persistence" after finding the way in.

    GOOD PRACTICE
    - Read the traces first (journalctl -u ssh, last) AND KEEP A COPY before
      cleaning up: the evidence helps you understand.
    - Identify a key by its fingerprint (ssh-keygen -l -f) and remove only
      that one. Reread each account's authorized_keys regularly.
    - Look for persistence: crontabs (sudo crontab -u account -l,
      /etc/cron.d), systemd timers and services, ~/.bashrc, authorized_keys.
    - Treat any secret that was readable during the intrusion as
      compromised: the orders' .env file was readable by everyone that night
      ("The Report"). The database password must be changed, outside the
      game, and whoever must know told (the insurer, and the data
      protection authority if personal data was involved).

    ANOTHER WAY
    To be warned earlier: fail2ban watches failures, not successes; an alert
    on any login from outside the known addresses (a script reading the
    journal and mail, as in "The Probe") or an allow list of addresses
    (AllowUsers nadia@198.51.100.7) would have flagged or blocked that
    session.

    DOCUMENTATION
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
    - sshd (authorized_keys): https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
    - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
    - last: https://man7.org/linux/man-pages/man1/last.1.html
