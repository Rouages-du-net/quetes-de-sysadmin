### Story "La Maison des associations", chapter "The keys": create your
### key pair, put it on the server, then refuse passwords.
### sshd_config keywords, commands, paths and OpenSSH messages
### (in English) are never translated.

chapitre-cles = The keys
    .resume = Your account has a temporary password (lilas-2027): ssh-keygen, ssh-copy-id, then no more passwords at all.

## Files

# { $motdepasse }: the account's temporary password
cles-courriel-yasmine =
    From:    Yasmine (coordinator of the Maison des associations)
    To:      you
    Subject: Welcome to the team!

    Thanks for agreeing to take over the Maison's IT! Gaspard,
    who looked after it for ten years, has moved to Lyon; he can still be
    reached, but he can't come by anymore.

    The "maison" machine is our gateway: it's the only one visible
    from the internet. Behind it are the associations' wiki and the
    archives server (you'll discover them soon).

    I've created an account for you (vous) with a temporary password:
    { $motdepasse }. That's how you get in, for now. Gaspard used to say
    that a password on a server open to the internet is a door left
    ajar. So before anything else:

    1. Create your own SSH key pair, on YOUR computer (man ssh-keygen).
    2. Put your public key on maison (man ssh-copy-id), then reconnect:
       ssh must no longer ask you for a password.
    3. Only then, make the SSH server refuse passwords
       (/etc/ssh/sshd_config, man sshd_config), and check that you can
       still get in.

    For sudo, it's the same temporary password: sudo will always ask
    for one, even when ssh no longer wants any.

## Events

# { $config }: the path of the configuration file
cles-evenement-erreur =
    There's an error in the SSH configuration. Before reloading,
    always check with  sudo sshd -t: it gives the file and the line
    at fault. As long as it's wrong, systemctl reload ssh refuses to
    apply it, and sshd keeps the old one.
cles-evenement-enferme =
    WARNING: sshd now refuses passwords… and no key is
    authorized for your account (~/.ssh/authorized_keys). Your current session
    stays open, but a new connection would be refused!

    Set PasswordAuthentication yes back and reload ssh, long enough to put your
    key in place. Order matters: first the key, then the door.
cles-evenement-cle-du-jeu =
    A key arrived in ~/.ssh/authorized_keys… but it's a key the
    game gave you for another machine (look at the end of the line, and
    ls -lt ~/.ssh on your computer). Without -i, ssh-copy-id takes the most
    recent public key in ~/.ssh; and ssh won't offer it to maison.

    First create your own pair (ssh-keygen), then run ssh-copy-id again.
cles-evenement-copiee =
    Your public key is in ~/.ssh/authorized_keys on maison. Look at the
    file (cat): a line "ssh-ed25519 AAAA…", the public half of
    your pair. The private half has never left your computer.

    Reconnect (exit, then ssh maison): this time, no password.
cles-evenement-par-cle =
    You got in with your key, no password! The server sent you a challenge
    that only your private key could sign.

    Now close the door to passwords: a bot could still
    try to guess one. In /etc/ssh/sshd_config, look for the
    PasswordAuthentication line (man sshd_config), then sudo sshd -t and sudo
    systemctl reload ssh.
cles-evenement-fermee =
    sshd now accepts only keys. Before closing this session, test:
    exit, then ssh maison. (On a real server, you keep the session open
    and test in a second terminal.)
cles-evenement-fin =
    In with your key, and passwords are refused: the gateway is
    closed to bots, but not to you. Yasmine: "Gaspard will be proud of you!"

    Well done! You've finished the chapter "The keys".

    WHAT HAPPENED
    A key pair is two files: the private key (~/.ssh/id_ed25519),
    which stays on your computer, and the public key (id_ed25519.pub), which
    you can give to anyone. The server keeps the authorized public keys in
    ~/.ssh/authorized_keys; when you connect, it asks you to sign a challenge
    with the private key. Nothing secret travels, and nothing can be guessed.

    GOOD PRACTICE
    - Generate your key on your own machine (ssh-keygen -t ed25519), with a
      passphrase; never copy a private key elsewhere.
    - Put the public key in place with ssh-copy-id: it creates ~/.ssh and
      authorized_keys with the right permissions (700 and 600).
    - In this order: the key, the test, then PasswordAuthentication no.
    - Keep a session open and test with a new connection.

    DOCUMENTATION
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
    - ssh-copy-id: https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html
    - sshd_config: https://man.openbsd.org/sshd_config
