### Story "The Tenants' Union", chapter "Out of the Open": a .env file
### committed in clear, encrypted with sops and age, its password rotated,
### decrypted at deploy time. Commands, options, paths, keys, variable
### names and the tools' outputs are not translated.

chapter-out-of-the-open = Out of the Open
    .summary = The tenants' union's repair app keeps its database password in a .env file, committed in clear, and the repository spent three days on a public forge by mistake. Encrypt it with sops and age so that it can stay in git, make the deploy decrypt it, and deal with the password that already got out.

## Shared by the story's chapters

tenants-union-readme =
    # Repairline

    The tenants of Larkspur report repairs (a leak, the heating, damp),
    and the Larkspur Tenants' Union follows them up with the landlord.

    - app.py: the app (Flask), run by gunicorn as the service repairline.
    - .env: its settings (the database and the mail).
    - deploy.sh: puts the settings in /etc/repairline/env and restarts
      the app. Run it as root on latch: sudo /srv/repairline/deploy.sh

    The server's own age key (its public key, for sops):
    { $key }

tenants-union-commit-1 = Repairline: the tenants report repairs, the union follows them up
tenants-union-commit-2 = Server settings, so that deploy.sh works
tenants-union-commit-3 = Photos of the damage: an 8 MB limit
tenants-union-commit-4 = Encrypt .env with sops and age, rotate the database password
tenants-union-commit-5 = Add Makoa's age key
tenants-union-commit-6 = Mail relay settings, encrypted

## Files

out-of-the-open-message-taslima =
    From: Taslima (secretary, Larkspur Tenants' Union)
    Tuesday 8 March, 19:05

    Hello, and welcome to the union's little tech team!

    Something embarrassing first. Last week, Makoa set up a mirror of
    Repairline's repository on a public forge, code.example, "so that other
    unions can reuse it". It stayed public for three days before he noticed
    and deleted it. The repository has a .env file with the database
    password in it, in clear, since January. Anyone could have cloned it.

    Makoa says the fix is sops and age: the .env stays in git, but
    encrypted, so that only the people (and the server) who hold a key can
    read it. The server already has its own age key, root's, in
    /etc/repairline/ (its public key is in the README). I'd like the .env
    encrypted for the server and for you, and a rule so that the next
    secrets file we add (the mail relay is coming) is encrypted the same
    way. And whatever needs to be done about the password that got out.

    The code is in /srv/repairline; the volunteers clone it from
    /srv/git/repairline.git, so please push there when you're done. The
    app must keep working: the tenants use it every evening.

    Thank you!
    Taslima

## Events

out-of-the-open-event-history-seen =
    There it is: git keeps every version of every file. The password has
    been in the history since Makoa's commit of 26 January, and every clone
    of the repository has its own copy of that history, the forge's
    visitors' included. Encrypting the file from now on protects the next
    versions, not the past ones.
out-of-the-open-event-base64 =
    base64 is an encoding, not encryption: anyone can reverse it with
    base64 -d, without any key. A secret in base64 is a secret in clear
    that takes one more command to read.
out-of-the-open-event-gitignore =
    A .gitignore file only keeps untracked files out of git: .env is tracked
    already, so it stays tracked, and git rm --cached would only remove it
    from the next commits. The password stays in the history either way,
    and the deploy, which reads .env from the repository, would lose its
    settings. Keep .env in git, but encrypted.
out-of-the-open-event-key-made =
    You have an age key of your own: the secret part stays in
    ~/.config/sops/age/keys.txt (where sops looks for it, readable by you
    only), the public part (age1…) is what you give to others so they can
    encrypt for you.
out-of-the-open-event-rule-written =
    The .sops.yaml file has a creation rule: every file whose path matches
    path_regex is encrypted for the keys listed under age, whoever runs
    sops. .env and the mail relay's mail.env will both match.
out-of-the-open-event-wrong-recipient =
    The .env file is encrypted, but not for the server: its key ({ $key }) isn't
    among the recipients, so root on latch can't decrypt it at deploy time.
    sops can only decrypt with a key it was encrypted for. Decrypt it back,
    or rebuild it with the right recipients.
out-of-the-open-event-not-yours =
    The .env file is encrypted for the server, but not for you: from now on, you
    couldn't read or edit it yourself. Add your own public key to the
    recipients.
out-of-the-open-event-encrypted =
    The .env file is now a SOPS file: the names of the variables are still
    readable (git diff stays useful), each value is an ENC[AES256_GCM,…]
    block, and the sops_ lines at the end hold the data key, encrypted once
    for each recipient, and a MAC over all the values.
out-of-the-open-event-rotated =
    The database has a new password. The old one is now worthless to
    whoever copied the history. Until the app gets the new one, it will
    fail at its next restart: the password must reach .env and the
    deployed settings.
out-of-the-open-event-ciphertext-deployed =
    /etc/repairline/env holds the encrypted values: deploy.sh copied .env
    as it is, ENC[…] included, and the app would read that as its
    password. The deploy must decrypt the file, with a key the server has.
out-of-the-open-event-root-without-key =
    sops ran as root and found no age key: it looks in
    ~/.config/sops/age/keys.txt of the account that runs it, and root's
    has none. The server's key is in /etc/repairline/age.key: the
    SOPS_AGE_KEY_FILE variable tells sops where to look (man sops).
out-of-the-open-event-app-down =
    Repairline failed to start: it can't connect to the database (journalctl
    -u repairline says why). The password in /etc/repairline/env and the
    database's must be the same.
out-of-the-open-event-env-readable =
    /etc/repairline/env, the decrypted settings, can be read by every
    account on latch. Only root needs it (systemd reads it before starting
    the app): chmod 600.
out-of-the-open-event-deployed =
    The deploy decrypted .env with the server's key and restarted the app,
    which connects with the new password.
out-of-the-open-event-clear-commit =
    The new password is in a commit, in clear: it is in the history now,
    like the old one. Choose another one, and only ever commit .env once
    it is encrypted.
out-of-the-open-event-committed-old =
    The encrypted .env is committed, but it still holds the password that
    leaked: encrypting it doesn't make it secret again. Change it in the
    database, then in .env.
out-of-the-open-event-committed =
    The commit holds the encrypted .env, .sops.yaml and the new deploy.sh.
    git diff and git log stay readable: the names of the variables are in
    clear, only the values are encrypted.
out-of-the-open-event-pushed =
    origin has it too: the next volunteer who clones or pulls gets the
    encrypted file, and the rule that will encrypt the next ones.
out-of-the-open-event-end =
    Taslima: "The app works, the password that leaked is useless, and I
    can read the history without fear. Thank you!"

    Well done! You finished Out of the Open.

    WHAT HAPPENED
    The database password had been in the repository, in clear, since
    January, and the repository was public for three days. You made an
    age key, wrote .sops.yaml so that every .env file is encrypted for the
    server's key and yours, and encrypted .env with sops. Since the old
    password was in the history, and in every clone, you changed it in
    PostgreSQL and in the encrypted file. deploy.sh now decrypts .env with
    the server's own key at deploy time, and only root can read the
    result.

    GOOD PRACTICE
    - A secret that was ever committed in clear is compromised: rotate it.
      Rewriting the history (git filter-repo) only helps afterwards, and
      can't reach the copies already made.
    - base64 is not encryption, and .gitignore doesn't untrack a file nor
      clean the history.
    - With sops, each value is encrypted with a data key, itself encrypted
      for each recipient (age public keys): .sops.yaml decides who, for
      every new file.
    - Encrypt for the machines that deploy as well as for the people who
      edit: the server's private key never leaves it, yours never leaves
      you.
    - Decrypt at deploy time, into a file only the service's reader can
      read.

    ANOTHER WAY
    git-crypt encrypts whole files transparently in git, and ansible-vault
    encrypts files or values for Ansible; a secrets manager (OpenBao,
    Vault) keeps secrets out of git entirely, at the cost of a service to
    run. sops keeps the structure readable and works with age, PGP and the
    clouds' key services.

    DOCUMENTATION
    - SOPS: https://getsops.io/docs/
    - Encrypting with age: https://getsops.io/docs/#encrypting-using-age
    - .sops.yaml's creation rules: https://getsops.io/docs/#using-sops-yaml-conf-to-select-kms-pgp-and-age-for-new-files
    - age: https://age-encryption.org/
    - gitignore: https://git-scm.com/docs/gitignore
