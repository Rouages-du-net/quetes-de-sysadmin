### Story "The Gazette", chapter 2 "Rolling back": one version
### per directory, a current link, rolling back with ln -sfn, and
### tests before going live. The commands, paths and messages of
### git, ln, nginx and sh are not translated.

chapter-rollback = Rolling back
    .resume = A release that breaks the site: go back to the previous version in an instant, then make every publication pass tests first.

## Files

rollback-message-samia =
    A message from Samia, Monday 9:02 pm:

    "Help! The site has been showing an error ever since Théo pushed his
    new layout, and the newsletter goes out tomorrow morning
    with a link to the Gazette.

    Since last week, the server's hook
    (/srv/git/gazette.git/hooks/post-receive) publishes each push in its
    own directory, /srv/gazette/releases/, then points the link
    /srv/gazette/current at the new version. nginx serves current.
    So the old versions are all still there…

    In order:
      1. get the site working again, right now;
      2. make sure this can't happen again: I wrote tests.sh
         (in the repository), but nobody runs it before publishing;
      3. then publish Théo's layout, fixed.

    For sudo: gazette-2027."
rollback-hook-comment = Publishes each push in a new directory under releases/, then switches the current link.
rollback-hook-echo = Version $VERSION live
rollback-tests =
    #!/bin/sh
    # Checks before publishing (Samia).
    # Run from the site directory: sh tests.sh
    set -e
    echo "Checking the home page (index.html)..."
    test -f index.html
    grep -q "<title>" index.html
    echo "Checking the calendar (agenda.html)..."
    test -f agenda.html
    echo "Tests OK"

## The site

rollback-site-index =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Neighbourhood Gazette</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>The Neighbourhood Gazette</h1>
    <p>News from the street, by the people who live there.</p>
    <ul>
    <li><a href="fete-des-voisins.html">The neighbours' party, behind the scenes</a></li>
    <li><a href="agenda.html">This month's calendar</a></li>
    </ul>
    </body>
    </html>
rollback-site-welcome =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Neighbourhood Gazette</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <header><h1>The Neighbourhood Gazette</h1><p>News from the street, by the people who live there.</p></header>
    <section class="une">
    <h2><a href="fete-des-voisins.html">Top story: the neighbours' party, behind the scenes</a></h2>
    </section>
    <nav><a href="agenda.html">This month's calendar</a></nav>
    </body>
    </html>
rollback-commit-3 = Title: Gazette, spelled right
rollback-commit-4 = Calendar: the jumble sale is on 12 June
rollback-commit-5 = Add tests.sh: checks before publishing
rollback-commit-6 = New home page layout
# { $numero }: the attempt number
rollback-commit-theo = New layout, attempt { $numero }

## Events

# { $sortie }: what git showed Théo (indented lines)
rollback-theo-push =
    Théo, from home: "Trying my layout again…" He pushes
    (still without index.html). Here's what git tells him:

    { $sortie }
rollback-event-failure =
    403 Forbidden: nginx serves /srv/gazette/current, but finds no
    home page in it (index.html). Look at what current points to (ls -l
    /srv/gazette, or readlink), and at what's in each version under
    releases/. The previous version is intact: current just has to
    point to it again (man ln).
rollback-event-without-n =
    The new link was created INSIDE the broken version (ls -l
    /srv/gazette/releases/20270517203012): current points to a directory, so ln
    went into it instead of replacing the link. The -n option is what
    treats current as a plain file: ln -sfn target current.
rollback-event-restored =
    The site responds again. Samia: "Phew! And it took a second:
    the old version had never been deleted, we just changed the
    link. Now, let's make sure it doesn't happen again: the hook must run
    tests.sh on the new version, and not switch current if the
    tests fail." (Look at the hook, and man sh.)
rollback-event-kept-fou =
    Théo's push reached the server, but its tests failed and
    the hook stopped before switching current: the site didn't
    change. That's what a safeguard is for. Now publish his layout
    for real: fetch his commits (git pull), give the page the right name,
    commit and push.
rollback-event-kept-fou-pierced =
    Théo's broken push went live anyway: the hook didn't
    stop the publication. Restore the site, then look at the hook:
    are the tests run BEFORE switching current, from the directory
    of the new version, and does a failure stop the script (set -e,
    or || exit 1)? Théo will try again as soon as the hook changes.
rollback-event-tests-elsewhere =
    The latest version does contain index.html, but it wasn't put
    live: its tests failed anyway. tests.sh looks for index.html
    in the directory it's run from. Where does the hook run it from? (A
    hook starts in the repository, /srv/git/gazette.git; cd changes directory.)
rollback-event-end =
    The new layout is live, published by the hook after its
    tests. Samia: "This time, a mistake in the repository can no longer
    break the site. And if a version passes the tests but we don't like it, we
    know how to roll back in a second."

    Well done! You've finished chapter 2 of The Gazette. (The rest awaits you:
    ssh gazette.)

    WHAT HAPPENED
    Each publication goes into its own directory; the current link
    points to the one that's live. Rolling back means changing the
    link: ln -sfn replaces the link in one go (without -n, ln goes into the
    directory it points to). Then the hook learned to run the tests on the new
    version BEFORE switching, and to stop if they fail: a broken
    version reaches the server, but never goes live.

    GOOD PRACTICE
    - Keep previous versions; you switch, you don't copy over.
    - A rollback should be a single command, tried in advance.
    - Test before going live (continuous integration), and stop
      everything at the first failure: set -e, or command || exit 1.
    - post-receive can no longer reject the push (it's already received); to
      reject the commits themselves, use pre-receive.
    - Clean up old versions from time to time (keep
      a few).

    DOCUMENTATION
    - ln (coreutils): https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
    - Git hooks: https://git-scm.com/docs/githooks
    - dash, Debian's /bin/sh: https://manpages.debian.org/bookworm/dash/dash.1.en.html
