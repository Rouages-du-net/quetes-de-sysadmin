### Story "The Tenants' Union", chapter "Keys Change Hands": a new
### volunteer's age key added, a leaving one's removed, the data key and
### the secret rotated. Commands, options, paths, keys, variable names and
### the tools' outputs are not translated.

chapter-keys-change-hands = Keys Change Hands
    .summary = Seven weeks later, the union's secrets are encrypted for the server, for you and for Makoa. Makoa is moving away and leaves the tech team; Ikenna joins it. Give Ikenna access, take Makoa's away for real, and make sure what he could read is no use any more.

## Files

keys-change-hands-message-taslima =
    From: Taslima (secretary, Larkspur Tenants' Union)
    Tuesday 26 April, 18:40

    Hello!

    Two pieces of news. Makoa is moving to his sister's, three hundred
    kilometres away, and leaves the tech team at the end of the week (he
    wrote you a word). And Ikenna, from block C, joins us: he'll look after
    Repairline's mails. He sent you his public key.

    Since March, .env and mail.env are encrypted for the server, for you
    and for Makoa (see .sops.yaml). Could you open them to Ikenna, and
    close them to Makoa? I trust Makoa completely, but his laptop goes
    with him, and his key with it.

    For the mail relay's password, I've asked the provider to change it:
    they'll do it tomorrow, and I'll put the new one in mail.env myself.
    The database's is yours.

    As always: commit, push, and the app must keep working.

    Taslima

keys-change-hands-message-ikenna =
    From: Ikenna
    Tuesday 26 April, 17:12

    Hi! Here is my age public key, made on my laptop with age-keygen:

    { $key }

    Taslima says you'll add it. If it's simpler, you could also just send
    me your keys.txt, then I'd have access straight away?

    Ikenna

keys-change-hands-message-makoa =
    From: Makoa
    Monday 25 April, 22:30

    It was a pleasure, all of you. My key is still in .sops.yaml and in
    the files: take it out, of course. And don't be shy about the rest: I
    read the database password every time I deployed, so change it too.
    I'll keep following the union from afar.

    Makoa

## Events

keys-change-hands-event-shared-key =
    Your private age key is somewhere other than your own keys.txt, or that
    file can be read by other accounts. A private key that is shared isn't
    yours any more: whoever has it can read everything encrypted for you,
    and nobody can tell you apart. Ikenna has his own key; delete the copy
    (or chmod 600 ~/.config/sops/age/keys.txt).
keys-change-hands-event-hand-edit =
    sops refuses the file: an ENC[…] value was changed outside sops. Each
    value has its own authentication tag, and the MAC covers all the
    values together: a value edited by hand, a line removed or moved, and
    sops can no longer trust the file. Take the file back from git (git
    checkout -- FILE), then change values with sops edit or sops set.
keys-change-hands-event-config-updated =
    The .sops.yaml file now names the server, you and Ikenna. That rule is what new
    files get; the files that are already encrypted keep the keys they were
    encrypted for until you update them.
keys-change-hands-event-config-only =
    The rule changed, but .env or mail.env are still encrypted for Makoa:
    sops doesn't rewrite existing files when .sops.yaml changes. sops
    updatekeys does, file by file.
keys-change-hands-event-keys-updated =
    Both files are now encrypted for the server, for you and for Ikenna,
    not for Makoa. But updatekeys only re-encrypts the same data key for
    the new list: the values themselves didn't change.
keys-change-hands-event-same-data-key =
    The data key that encrypts the values is the one Makoa's key could
    open: anyone who kept it (or an old copy of the file) can still decrypt
    what you commit. sops rotate makes a new data key and encrypts every
    value again.
keys-change-hands-event-data-rotated =
    New data keys for both files, encrypted for the server, you and Ikenna
    only. What Makoa could open was the old ones.
keys-change-hands-event-rotated =
    The database has a new password: the one Makoa read while deploying is
    worthless now. It must reach .env (with sops, never in clear) and the
    deployed settings.
keys-change-hands-event-app-down =
    Repairline failed to start: the password it read from
    /etc/repairline/env isn't the database's (journalctl -u repairline).
keys-change-hands-event-deployed =
    The deploy decrypted the new .env with the server's key, and the app
    connects with the new password.
keys-change-hands-event-clear-commit =
    The new password is in a commit, in clear. Choose another one, and put
    it in .env with sops edit or sops set.
keys-change-hands-event-committed =
    The commit has the new rule, both files for the new list of keys with
    new data keys, and the new password, encrypted.
keys-change-hands-event-pushed =
    origin has it: Ikenna can clone the repository and decrypt the files
    with his own key.
keys-change-hands-event-end =
    Ikenna: "sops -d .env works on my laptop. Welcome to me!"

    Well done! You finished Keys Change Hands.

    WHAT HAPPENED
    Ikenna's public key went into .sops.yaml and Makoa's came out; sops
    updatekeys re-encrypted each file's data key for the new list. Since
    Makoa could have kept the old data key, or simply the values, you
    rotated what mattered: a new data key for each file (sops rotate), and
    a new database password, set in .env with sops and deployed. Ikenna
    got access with his own key; nobody shared a private key.

    GOOD PRACTICE
    - One key per person (and per server): adding someone is adding a
      public key, removing someone is removing theirs.
    - .sops.yaml decides for new files; updatekeys brings existing files in
      line; neither changes the data key.
    - When someone leaves, assume they kept what they could read: rotate
      the data key (sops rotate) and the secrets themselves.
    - Never edit ENC[…] values by hand: sops edit, sops set, or decrypt and
      encrypt again.
    - Never send a private key; ask for a public one.

    ANOTHER WAY
    sops rotate --add-age and --rm-age change the recipients and the data
    key in one command, without touching .sops.yaml (which must then be
    changed too). With several key groups and shamir_threshold, a file can
    require keys from several people at once.

    DOCUMENTATION
    - sops updatekeys: https://getsops.io/docs/#updatekeys-command
    - Key rotation: https://getsops.io/docs/#key-rotation
    - Adding and removing keys: https://getsops.io/docs/#adding-and-removing-keys
    - age-keygen: https://github.com/FiloSottile/age#readme
