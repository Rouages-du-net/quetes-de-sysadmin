### Story "The Hostel", chapter "Sealed": OpenBao sealed after a power cut
### (status, three key shares, the app restarted, its health checked).
### Commands, options, paths, policy and token names, key shares and
### OpenBao's outputs are not translated.

chapter-sealed = Sealed
    .summary = A storm cut the power in the night. The hostel's server came back on its own, but the secrets vault came back sealed, and the booking site gave up. Guests arrive at nine: rebuild the vault's key from the shares of three people, and bring the site back.

## Files

sealed-message-desta =
    From: Desta (hostel coordinator)
    Saturday 6 March, 07:40

    Good morning, and sorry for the early message!

    The storm cut the power at 03:12. padlock came back on its own at
    03:58, but the booking site, Bunks, is down, and twelve guests arrive at
    nine to check in.

    Ruslan set up padlock last month. Bunks keeps its passwords (the
    database, the payment provider) in OpenBao, a vault for secrets on the
    same machine. He told us that after a restart OpenBao is "sealed", and
    that three of us must each give our "key share" to open it. There are
    five shares: mine, Ruslan's, yours, Hiroko's and Nnamdi's.

    Ruslan is trekking without signal until Monday. My share is on paper in
    the hostel's safe; I'm on the train, but I took a photo of it last week.
    It's a bit blurred, here is what I read:

        { $share }

    I'm not sure of every character. Hiroko and Nnamdi sent theirs (their
    messages are in your home), and yours should be on your USB key.

    Can you open the vault and get Bunks back before nine?

    Desta

sealed-message-hiroko =
    From: Hiroko (treasurer)
    Saturday 6 March, 07:22

    Desta called me. I'm at my sister's, two hours away, so here is my
    share, typed from my envelope:

        { $share }

    Delete this message once the vault is open: Ruslan said that if a share
    ever travels, we must make new ones.

    Hiroko

sealed-message-nnamdi =
    From: Nnamdi
    Saturday 6 March, 07:31

    Up early for once! My share, from my password manager:

        { $share }

    I can't come in today; tell me if the site needs anything.

    Nnamdi

sealed-usb-comment = Your key share (number 3 of 5), handed out by Ruslan on 14 February. Keep it offline.

## Events

sealed-event-status =
    OpenBao answers, but it is sealed: its data is encrypted on disk, and it
    can't decrypt it until it rebuilds its root key from three of the five
    shares (Shamir's secret sharing). Unseal Progress 0/3: nobody has given a
    share yet. Every start of the server begins like this.
sealed-event-init =
    bao operator init is for a brand-new server: it creates the root key,
    the shares and the first root token. This one is already initialised
    (Initialized true): it only needs to be unsealed.
sealed-event-first-share =
    OpenBao counted one share: the progress moved, and an Unseal Nonce names
    this attempt. The shares given so far stay in memory until the threshold
    is reached. Typing a share at the prompt (bao operator unseal with no
    argument) keeps it out of the shell's history.
sealed-event-duplicate =
    The progress didn't move: that share was already counted. Three shares
    means three different holders; that's the point of the threshold: no
    single person can open the vault.
sealed-event-bad-format =
    OpenBao couldn't decode that share: a share is a base64 (or hex) string
    of fixed length. Copy it whole, without spaces or the comment line.
sealed-event-bad-share =
    The third share completed the threshold, OpenBao combined the three...
    and the result didn't decrypt its keyring: one of them was wrong. The
    whole attempt is lost and the progress is back to 0/3, because OpenBao
    can't tell which share was wrong. Was one of them read from a blurred
    photo?
sealed-event-restart-early =
    Bunks failed again: OpenBao is still sealed, so its secrets can't be read
    (journalctl -u bunks: "Vault is sealed"). Unseal first, then restart the
    app.
sealed-event-openbao-restarted =
    OpenBao was restarted: it comes back sealed, and the shares already
    given are forgotten. A restart never unseals; only the shares do.
sealed-event-unsealed =
    Sealed false: OpenBao rebuilt its root key in memory and opened its
    keyring. It stays unsealed until it stops (a restart, a power cut, bao
    operator seal). Bunks, though, gave up during the night: after five
    failed starts, systemd stopped trying (start-limit-hit).
sealed-event-restarted =
    Bunks is running again: at start it read its two secrets from OpenBao
    (journalctl -u bunks). Does it really answer?
sealed-event-checked =
    The health page answers: Bunks reaches OpenBao, its database and the
    payment provider.
sealed-event-end =
    Desta: "The first guests are checking in. Thank you!"

    Well done! You finished Sealed.

    WHAT HAPPENED
    The power cut restarted padlock, and OpenBao started sealed, as it always
    does: its data is encrypted with a key that is itself encrypted by the
    root key, and the root key is never written anywhere. bao status showed
    Sealed true and Unseal Progress 0/3. Three different shares given to bao
    operator unseal rebuilt it (Shamir's secret sharing: any three of the
    five, never fewer). Bunks had given up after five failed starts;
    restarted, it read its secrets and its health page answered.

    GOOD PRACTICE
    - The shares belong to different people, kept apart and offline; each
      holder types their own (bao operator unseal without an argument: the
      share isn't shown nor kept in the history).
    - A share that travelled (a message, a photo) is weakened: once the vault
      is open, make new shares (bao operator rekey) and destroy the old ones.
    - The root token printed by bao operator init is for the first setup
      only. Daily work uses tokens limited by policies; when a root token is
      really needed, three share holders generate one (bao operator
      generate-root), and it is revoked right after.
    - An app that depends on the vault must retry patiently
      (Restart=on-failure, a long enough RestartSec=), and monitoring should
      say "sealed" before the guests do.

    ANOTHER WAY
    Auto-unseal: the root key is protected by a key management service (a
    cloud KMS, an HSM through PKCS#11, the transit engine of another OpenBao)
    and the server unseals itself when it starts; the shares become recovery
    keys. No more early calls, but the trust moves to that service.

    DOCUMENTATION
    - Seal and unseal: https://openbao.org/docs/concepts/seal/
    - bao operator unseal: https://openbao.org/docs/commands/operator/unseal/
    - bao status: https://openbao.org/docs/commands/status/
    - Root tokens: https://openbao.org/docs/concepts/tokens/#root-tokens
