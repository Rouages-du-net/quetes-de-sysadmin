### Story "The Hostel", chapter "Need to Know": an app reading its secrets
### with the root token; a policy for it alone, a token with that policy,
### the root token revoked. Commands, options, paths, policy and token
### names and OpenBao's outputs are not translated.

chapter-need-to-know = Need to Know
    .summary = The booking site reads its passwords from the vault with the root token, the all-powerful one printed at installation. Write a policy that lets it read its own secrets and nothing else, give it a token of its own, and get rid of the root token.

## Files

need-to-know-message-desta =
    From: Desta
    Tuesday 9 March, 10:15

    Hello again!

    Ruslan is back from his trek, and he sent his installation notes (they
    are in your home). One line worried me: "bunks.env: root token for now,
    to replace". He admits that "for now" means "until someone does it".

    Could you be that someone? As I understand it, Bunks should only be
    able to read its own two secrets: not Hiroko's bank details, not the
    guests' Wi-Fi, and it certainly shouldn't change anything. And then the
    root token should go: Ruslan says nobody should keep one lying around.

    Desta

need-to-know-notes-ruslan =
    Notes from Ruslan (padlock, OpenBao, February 2027)

    - OpenBao 2.7.3, from OpenBao's own .deb (it isn't in Debian's
      archive). Configuration: /etc/openbao/openbao.hcl; data in
      /opt/openbao/data; API on port 8200 (TLS, the package's self-signed
      certificate); audit log: /var/log/openbao/audit.log.
    - Initialised on 14 February: 5 shares, threshold 3. The root token of
      the init is the one in /etc/bunks/bunks.env (temporary!).
    - Secrets: a KV version 2 engine at secret/. Bunks: secret/bunks/db
      (username, password) and secret/bunks/payments (account, api_key).
      Also secret/treasurer/bank (Hiroko) and secret/wifi/guests.
    - KV version 2 keeps versions: the CLI says bao kv get secret/bunks/db,
      but the API, and so the policies, see secret/data/bunks/db (and the
      metadata under secret/metadata/).
    - Each admin has an orphan token with the admin policy (bao policy read
      admin), in ~/.vault-token. Orphan: it doesn't depend on the root token.
    - Bunks reads BAO_TOKEN from bunks.env when it starts (sudo systemctl
      restart bunks to make it read it again). Its health:
      curl http://127.0.0.1:8080/health
    - man bao.

## Events

need-to-know-event-resealed =
    OpenBao was restarted, so it came back sealed. Desta, Hiroko and Nnamdi
    came by and typed their shares: it is unsealed again. Policies and tokens
    take effect at once; OpenBao never needs a restart for them.
need-to-know-event-no-data =
    That policy has a rule on secret/... without data/: it matches none of
    Bunks's requests. With KV version 2, the API path of the secret bunks/db
    is secret/data/bunks/db (and its metadata, secret/metadata/bunks/db).
    The bao kv commands hide that prefix; policies don't.
need-to-know-event-too-wide =
    That policy gives more than Bunks needs. Check it with bao token
    capabilities: Bunks must read secret/data/bunks/*, and nothing else: no
    create, update or delete, nothing under treasurer or wifi, no policies,
    no tokens.
need-to-know-event-policy =
    The policy is stored in OpenBao (bao policy list, bao policy read). A
    policy does nothing by itself: it applies to the tokens that carry it.
need-to-know-event-from-root =
    That token was created with the root token: it is its child, and
    revoking a token revokes all its children. When the root token goes,
    this one will go with it. Create Bunks's token with your own admin
    token, which is an orphan.
need-to-know-event-token =
    A token carrying the policy. bao token lookup shows its policies, its
    lifetime (creation_ttl, expire_time); bao token capabilities TOKEN PATH
    shows what it may do on a path.
need-to-know-event-denied =
    Bunks failed to start: "permission denied" on its secret (journalctl -u
    bunks). The token in bunks.env isn't allowed to read that path: which
    policies does it carry, and what does bao token capabilities say about
    secret/data/bunks/db?
need-to-know-event-switched =
    Bunks restarted with its own token: it reads its two secrets, and
    nothing else.
need-to-know-event-wide-app =
    Bunks runs with a token that can do more than read its two secrets (bao
    token capabilities). Whoever steals it gets all of that.
need-to-know-event-checked =
    The health page answers, with the new token.
need-to-know-event-early-revoke =
    The root token is revoked, but Bunks started with it: it keeps its
    secrets in memory and notices nothing yet, but its next start will fail.
    Give it its own token now.
need-to-know-event-root-revoked =
    The root token is revoked: bao token lookup on it now says "bad token".
    If one is ever needed again, three share holders can generate a new one
    (bao operator generate-root), to be revoked right after.
need-to-know-event-end =
    Desta: "Ruslan read your policy and said: need to know, as it should
    be. He's crossing out 'for now'."

    Well done! You finished Need to Know.

    WHAT HAPPENED
    Bunks started with the root token of the init: unlimited, and without an
    expiry. You wrote a policy for Bunks alone (read on secret/data/bunks/*:
    the KV version 2 API puts data/ in the path), loaded it with bao policy
    write, created a token carrying it (with your orphan admin token, so it
    has a TTL and doesn't depend on root), put it in bunks.env and restarted
    Bunks; then you revoked the root token. bao token capabilities proves
    what a token may and may not do.

    GOOD PRACTICE
    - One policy per application, least privilege: the paths it reads, the
      capabilities it needs (read), nothing else; everything else is denied
      by default.
    - Tokens expire: a long-running app renews its token (renew-self) or
      gets a new one before the end of its TTL.
    - Mind the hierarchy: a child token dies with its parent; services get
      orphan tokens (or a role).
    - The root token: generated when needed (bao operator generate-root),
      revoked right after, never kept in a file.
    - An app's token file is readable by the app's account only (bunks.env
      is root:bunks, 0640).

    ANOTHER WAY
    Rather than a token in a file, an app can log in by itself: AppRole (a
    role ID and a secret ID delivered separately), or a machine identity
    (TLS certificate, JWT, Kubernetes); OpenBao Agent can log in and renew
    for the app and write its secrets to a file. More moving parts, fewer
    long-lived secrets.

    DOCUMENTATION
    - Policies: https://openbao.org/docs/concepts/policies/
    - Tokens: https://openbao.org/docs/concepts/tokens/
    - KV version 2 and its paths: https://openbao.org/docs/secrets/kv/kv-v2/
    - bao token create: https://openbao.org/docs/commands/token/create/
    - AppRole: https://openbao.org/docs/auth/approle/
