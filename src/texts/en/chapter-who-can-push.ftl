### Story "The Tool Library", chapter "Who Can Push": a force-push with an
### ex-maintainer's credentials; collaborators, tokens, protected branches.
### Commands, options, paths, API routes and outputs are not translated.

chapter-who-can-push = Who Can Push
    .summary = Someone rewrote the main branch of Lendshed, the lending software forty tool libraries run, in the middle of the night, with the credentials of a maintainer who left in March. Find what happened, close the doors he left open, and make main a branch nobody can rewrite.

## Files

who-can-push-message-wanjiru =
    From: Wanjiru (Lendshed's lead maintainer)
    Monday 4 November, 8:50

    Welcome to the team, and thank you for looking after our forge!

    Something has been bothering me. On 16 October Rosa found that her
    two commits from the week before had disappeared from main: someone
    had force-pushed it on the night of the 14th. She put her commits
    back the same day, but we never understood what happened. The bare
    repositories are in /var/lib/forgejo/data/forgejo-repositories (I
    turned on core.logAllRefUpdates after an accident last year), and
    Forgejo keeps its log in /var/lib/forgejo/log.

    Tomasz says it wasn't him (see his note). He stepped down as a
    maintainer in March: I took him out of the maintainers' team, so he
    shouldn't be able to push any more... should he?

    Please don't delete his account: his issues and reviews are years of
    our project's memory, and they must keep his name.

    Your forge account is you, an administrator, with the same password
    as on anvil for now; an API token for you is in ~/.forgejo-token. The
    API answers on https://forge.lendshed.example/api/v1 (man forgejo-api).
    Your clone of the repository is in ~/lendshed.

    Wanjiru

who-can-push-note-tomasz =
    From: Tomasz
    Sunday 3 November

    Hi! Wanjiru told me about main. It wasn't me, I promise: I haven't
    touched Lendshed since March, I work on a tram network's timetables
    now. But I did sell my old laptop in September... I'm afraid I only
    wiped it quickly. The release script I wrote in 2029 had my personal
    access token in its configuration, a token with every scope, because I
    was in a hurry. Please revoke whatever I still have. Sorry!

    Tomasz

## Events

who-can-push-event-history =
    There: in the bare repository's reflog, on 14 October at 02:13, main
    moved to a commit that doesn't descend from the one before: a forced
    push. Rosa's two commits were left behind (still in the object store,
    found by their ID), and on the 16th another forced push put them back.
    What did that night's commit change? git show tells you.
who-can-push-event-typosquat =
    The commit added a dependency to requirements.txt: requets, one letter
    away from the well-known requests library. A typosquatted package,
    published to be installed by mistake, is a classic way into a
    project's supply chain: every tool library that installed Lendshed
    between the 14th and the 16th ran pip install on it. Who could push
    to main? Ask the forge who collaborates on the repository.
who-can-push-event-collaborator =
    Tomasz is still a direct collaborator of lendshed/lendshed, with write
    access. Leaving the maintainers' team only took away what the team
    gave him; a collaborator added by name keeps their own access. Every
    door must be closed where it was opened.
who-can-push-event-removed =
    Tomasz is no longer a collaborator: his account can't push any more.
    But a personal access token carries its owner's rights, and the one in
    his old release script had every scope. Is it still valid? Tokens are
    listed per account (GET /users/NAME/tokens), with basic authentication.
who-can-push-event-delete-refused =
    Forgejo refuses: Tomasz still owns a repository (his old fork). Deleting
    an account is the hard way, and Wanjiru asked to keep his name on his
    issues and reviews. To stop an account from being used, block it from
    signing in (prohibit_login), or remove what gives it access.
who-can-push-event-purged =
    The account is gone, and with --purge everything it owned went too:
    his fork, his comments, his reviews. In the issues, years of his work
    now show as written by "Ghost". The door is closed, but the project
    lost a part of its memory; prohibit_login would have closed it while
    keeping his name.
who-can-push-event-password-only =
    A new password doesn't change anything for a token: a personal access
    token authenticates on its own, without the password. The token itself
    must go (or the account be blocked).
who-can-push-event-tokens-basic =
    Forgejo only lists and deletes tokens with basic authentication
    (curl -u user:password): a token may not manage tokens. As an
    administrator, the Sudo header lets you act as another account.
who-can-push-event-token-dead =
    Tomasz's old token no longer opens anything: whoever holds his laptop's
    copy gets a 401 or a 403 now. Now the branch itself: main isn't
    protected at all, which is why a force-push could rewrite it.
who-can-push-event-private =
    The repository is now private: Kwame and the forty tool libraries that
    install from it can't see it any more. And it doesn't change who can
    push: Tomasz's write access and token work on a private repository
    too. Make it public again (PATCH the repository with "private": false).
who-can-push-event-rewritten =
    main no longer leads to Rosa's last commit: a force-push rewrote its
    history again, this time from here. Put it back: your clone's reflog
    remembers where main was (git reflog), git reset --hard to it, then a
    push. Then protect the branch before trying anything else.
who-can-push-event-weak =
    There is a rule for main, but it doesn't do everything yet. Forgejo
    always refuses a force-push on a protected branch; the rule should also
    let only the maintainers push directly (enable_push_whitelist and
    push_whitelist_usernames, or enable_push false), and ask for at least
    one approval (required_approvals) and the CI's status check
    (enable_status_check, status_check_contexts) before a pull request is
    merged.
who-can-push-event-bad-context =
    The required status check names a context the CI never reports: no
    pull request could ever be merged. The contexts are "workflow / job
    (event)": look at what the forge recorded for a commit
    (GET …/commits/REF/statuses).
who-can-push-event-protected =
    main is protected: no force-push, direct pushes for the maintainers
    only, an approval and a green CI before a merge. Check it the way it
    failed: try to rewrite main yourself and see the forge refuse.
who-can-push-event-refused =
    "branch main is protected from force push": the forge's pre-receive
    hook refused, before anything was written. That's what was missing on
    the night of the 14th.
who-can-push-event-end =
    Wanjiru: "So the doors were the collaborator and the token, not the
    team. And now main can't be rewritten even by an administrator. Thank
    you. I'm writing to the tool libraries about requets."

    Well done! You finished Who Can Push.

    WHAT HAPPENED
    Tomasz left the maintainers' team in March, but he had also been added
    to the repository by name, years ago, and his personal access token
    with every scope sat in a release script on a laptop he sold. On the
    night of 14 October someone used it to force-push main, replacing two
    commits with one that added a typosquatted dependency. You found the
    forced push in the bare repository's reflog and in Forgejo's log,
    removed the direct collaborator, made the token unusable, and
    protected main: no force-push, direct pushes for the maintainers,
    reviews and the CI before merging; then you saw a force-push refused.

    GOOD PRACTICE
    - When someone leaves, list every way in: teams, direct
      collaborators, SSH keys, deploy keys, tokens. Block the account
      (prohibit_login) rather than delete it, to keep its history.
    - Tokens: the smallest scopes, an expiry, never in a script's
      configuration on a laptop; revoke what isn't used.
    - Protect the default branch: no force-push, pushes restricted, reviews
      and required status checks; keep a reflog on the server.
    - A dependency added in a commit nobody reviewed is a supply-chain
      incident: tell those who installed.

    DOCUMENTATION
    - Forgejo, protected branches: https://forgejo.org/docs/latest/user/protection/
    - Forgejo, API usage (tokens, Sudo): https://forgejo.org/docs/latest/user/api-usage/
    - git reflog: https://git-scm.com/docs/git-reflog
    - OpenSSF, source code management best practices: https://best.openssf.org/SCM-BestPractices/
who-can-push-event-end-purged =
    Wanjiru: "The doors are closed, thank you... but Tomasz's name is gone
    from four years of issues. I'll try to restore them from last week's
    backup."

    Well done! You finished Who Can Push, at a cost.

    WHAT HAPPENED
    Tomasz left the maintainers' team in March, but he was also a direct
    collaborator, and his personal access token with every scope sat in a
    release script on a laptop he sold. Someone used it to force-push main
    on 14 October. You found the forced push in the reflog, closed his
    access, and protected main. But deleting his account with --purge took
    his contributions' authorship with it: prohibit_login would have
    blocked the account and kept the project's memory.

    GOOD PRACTICE
    - When someone leaves, list every way in: teams, direct
      collaborators, SSH keys, tokens. Block (prohibit_login), don't purge.
    - Tokens: the smallest scopes, an expiry, never in a script on a laptop.
    - Protect the default branch: no force-push, pushes restricted, reviews
      and required status checks.

    DOCUMENTATION
    - Forgejo, protected branches: https://forgejo.org/docs/latest/user/protection/
    - Forgejo, admin user delete: https://forgejo.org/docs/latest/admin/command-line/
    - git reflog: https://git-scm.com/docs/git-reflog
