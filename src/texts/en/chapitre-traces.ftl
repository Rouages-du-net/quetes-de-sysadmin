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
    4. That you look at what they may have READ: Nadia's command history
       (.bash_history) says what was typed during the session. A secret that
       was read is a secret to change, for real: the new one must work
       everywhere, and the orders app must not go down.

    Note: a comment in a key ("nadia@portable") proves nothing, anyone can
    write whatever they want. Compare the fingerprints.

    Salomé
    (For sudo, your password is still: flour-2028)

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
traces-evenement-secret-vu =
    There is what the person typed during their three minutes: they read
    /srv/commandes/.env. At the time, that file was readable by everyone
    ("The Report"): the database password is compromised, even though the key
    and the task are removed. Closing the door does not change a key that has
    already been copied.

    You must change that password, on both sides: in PostgreSQL (man psql;
    ALTER ROLE ... PASSWORD, from the postgres account) AND in the .env file,
    then restart the app. Pick a long password (twelve characters at least)
    and different from the old one.
traces-evenement-mot-de-passe-faible =
    The database password has changed, but it is too short: twelve characters
    at least, and a passphrase beats a word. A secret that can be guessed is
    as bad a replacement as the one you lost.
traces-evenement-a-redemarrer =
    The database and .env have the same new password, but the app still runs
    with the old one: it reads .env when it starts, not when the file
    changes. Restart it (systemctl restart commandes) then check that it
    stays active (systemctl status commandes).
traces-evenement-appli-tombee =
    The orders app is stopped: at startup, it read in .env a password the
    database does not accept (journalctl -u commandes: "password
    authentication failed"). Both sides must say the same thing: the
    password of the commandes role in PostgreSQL, and that of DATABASE_URL in
    the .env file. Fix the one that differs, then restart the app.
traces-evenement-mot-de-passe =
    The database password is changed end to end: the role in PostgreSQL, the
    file .env (still closed to the other accounts), and the restarted app
    that connects with it. The old one, which the intruder read, opens
    nothing any more.
traces-evenement-sauvegarde-perdue =
    Nadia's backup (sauvegarde.sh, at 4 a.m.) is no longer scheduled:
    crontab -r erases the WHOLE crontab. Put her line back:
      0 4 * * * /srv/commandes/bin/sauvegarde.sh
    and remove only the intruder's line.
traces-evenement-cron-nettoye =
    No more beacon, and Nadia's real backup is still there.
traces-evenement-fin =
    The intruder's key is removed, so is their task, the password they read
    is replaced everywhere, and Nadia can still log in and back up. Salomé: "My report is complete. I'll come back in six
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
      ("The Report"). Change it on both sides (the database AND the file),
      restart the app, check that it holds. A password typed in
      "psql -c "ALTER ROLE ... PASSWORD '...'"" stays in the shell history:
      psql's \password meta-command avoids that (it asks for it without
      echoing it).
    - Tell whoever must know: the insurer and, if personal data was
      involved, the data protection authority of your country, often under a
      short deadline (72 hours in Europe, under the GDPR). For example: the
      CNIL (France), the BfDI and the state authorities (Germany), the AEPD
      (Spain), the ICO (United Kingdom), the APD-GBA (Belgium), the CNPD
      (Luxembourg), the FDPIC (Switzerland), the Office of the Privacy
      Commissioner (Canada), the FTC and the state authorities (United
      States). The list of European authorities is kept by the European Data
      Protection Board (edpb.europa.eu).

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
    - ALTER ROLE: https://www.postgresql.org/docs/current/sql-alterrole.html
    - Notification of a personal data breach (GDPR, Article 33): https://gdpr-info.eu/art-33-gdpr/
