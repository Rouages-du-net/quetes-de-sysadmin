### Story "The Hostel", chapter "Leaked Token": an app's token posted on a
### public forum; lookup, the audit log, revoke, a new token, a secret
### rotated. Commands, options, paths, policy and token names, keys and
### OpenBao's outputs are not translated.

chapter-leaked-token = Leaked Token
    .summary = A volunteer asked for help on a public forum and pasted the booking site's configuration, token included. Find out whose token it is, what someone did with it, shut it, and change what was read, without breaking the site.

## Files

leaked-token-message-desta =
    From: Desta
    Monday 22 March, 16:45

    Bad news. This afternoon at 14:02, Nnamdi asked for help on the public
    forum of Bunks's developers, about a payments error, and he pasted the
    start of bunks.env, token included. I saw it at 16:40 and asked him to
    delete the post, but it was public for more than two hours. A copy is in
    your home.

    What could that token do, and did anyone use it?

    Hiroko has already asked the payment provider for a new API key, just
    in case:

        { $key }

    The old key keeps working until she revokes it in the provider's
    dashboard: she'll do it as soon as you tell her that Bunks uses the new
    one.

    Desta

leaked-token-forum-post =
    forum.bunks.example › Help › "payments page slow after the update"
    Posted by nnamdi_h, Monday 22 March, 14:02 (public)

    Hi all, since the last update the payments page of our hostel's Bunks
    is very slow. Here is the start of our configuration, in case it helps:

        { $env }

    Any idea? Thanks!

    Reply from a moderator, 14:20: please don't post tokens or passwords in
    public. Edit your post!

## Events

leaked-token-event-resealed =
    OpenBao was restarted, so it came back sealed. Desta, Hiroko and Nnamdi
    came by and typed their shares: it is unsealed again. Policies and tokens
    take effect at once; OpenBao never needs a restart for them.
leaked-token-event-identified =
    That is Bunks's token (display_name token-bunks, policies bunks and
    default), valid for weeks still (ttl). Its accessor names it without
    revealing it. Now, what did someone do with it?
leaked-token-event-hash =
    OpenBao computed the value's HMAC with the audit device's salt: the very
    string the audit log writes instead of the token. Look for it in the log
    (sudo grep, or jq).
leaked-token-event-traced =
    The audit log tells the story: from 203.0.113.77 at 14:31 (13:31 in the
    log, which counts in UTC), the leaked
    token looked itself up, tried to list secret/metadata/ (refused), read
    secret/data/bunks/payments (allowed: it's Bunks's own secret), and was
    refused the treasurer's bank details, the policies and a new token. The
    narrow policy held; the payment key, though, was read.
leaked-token-event-revoked =
    The leaked token is revoked: from now on it is refused everywhere. Bunks,
    still running, keeps its secrets in memory, but its next start would
    fail: it needs a new token.
leaked-token-event-still-leaked =
    Bunks failed: "permission denied". bunks.env still holds the revoked
    token. A new token for Bunks (the same policy), then bunks.env, then the
    restart.
leaked-token-event-lost-field =
    The payments secret's latest version has no account any more: bao kv put
    writes a whole new version with only the fields given. Bunks needs both.
    bao kv patch changes one field and keeps the others (or kv put with both;
    kv rollback brings an earlier version back).
leaked-token-event-wrong-key =
    The payments secret now holds a key the provider doesn't know. The new
    key is in Desta's message.
leaked-token-event-db-touched =
    The database password changed in OpenBao, not in the database: OpenBao
    only keeps it, and Bunks would fail to connect. And the audit log shows
    the leaked token never read it. Bring the previous version back (bao kv
    rollback -version=1, or kv patch with the old value).
leaked-token-event-rotated =
    The payments secret has a new version: the new key, with the account
    kept (bao kv metadata get lists the versions). Bunks still uses the old
    key, loaded when it started.
leaked-token-event-wide-app =
    Bunks runs with a token that can do more than read its two secrets (bao
    token capabilities). Whoever steals it next gets all of that.
leaked-token-event-old-key-loaded =
    Bunks restarted before the key changed: it still uses the old one.
    Restart it once more now that the secret holds the new key.
leaked-token-event-switched =
    Bunks restarted with a new token, and loaded the new key.
leaked-token-event-end =
    Hiroko: "The old key is revoked at the provider. Nothing was charged;
    they only tried this afternoon."

    Well done! You finished Leaked Token.

    WHAT HAPPENED
    Bunks's token was public for two hours. bao token lookup identified it
    (token-bunks, policies bunks and default, an accessor). The audit device
    had logged every request with the token HMAC'd: bao write
    sys/audit-hash/file input=TOKEN gave the same HMAC, and grep or jq found
    what 203.0.113.77 did at 14:31: it read secret/data/bunks/payments and
    was refused everything else, thanks to the policy of the previous
    chapter. The token was revoked, Bunks got a new one, the payment key
    that was read was rotated (a new version, the account kept), Bunks
    restarted to load it, and the old key could be revoked at the provider.
    The database password, never read, stayed as it was.

    GOOD PRACTICE
    - A leaked secret is revoked first, then investigated: the audit log
      says what must be rotated, and what needn't.
    - Keep audit devices (two in production), shipped to another machine:
      OpenBao refuses requests it can't audit.
    - Rotate at the source and in the vault: a new key from the provider, a
      new version in OpenBao, the app restarted, then the old key revoked.
    - kv put replaces the whole secret, kv patch changes fields, and
      versions allow a rollback.
    - Short TTLs reduce what a leak is worth; never paste an env file, and
      let a secret scanner watch your posts and commits.

    ANOTHER WAY
    Dynamic secrets: OpenBao's database engine creates an account for each
    lease and deletes it when it expires, so a leaked credential dies by
    itself. Response wrapping hands a secret over through a single-use token.

    DOCUMENTATION
    - bao token: https://openbao.org/docs/commands/token/
    - Audit devices: https://openbao.org/docs/audit/
    - /sys/audit-hash: https://openbao.org/docs/api/system/audit-hash/
    - bao kv patch: https://openbao.org/docs/commands/kv/patch/
    - Response wrapping: https://openbao.org/docs/concepts/response-wrapping/
