### Story "The Gazette", chapter 1 "The bare repository": deploy a site
### with git push, a bare repository and a post-receive hook. Commands,
### paths and messages from git, nginx and diff are not translated.

chapter-bare-repo = The bare repository
    .summary = Publish the newspaper's website with git push: a bare repository on the server, a post-receive hook, and no more editing by hand.

## Files

bare-repo-message-samia =
    A message from Samia, editor-in-chief of The Gazette, the neighbourhood
    newspaper:

    "Welcome to the Gazette! Our site (curl http://gazette.example) is
    served by nginx from /var/www/gazette. Until now, everyone copied
    their files there by hand… and last week, an article was overwritten
    by an old version.

    The site is already tracked by git, in ~/gazette. From now on, we
    only publish through git:
      - a repository on the server: /srv/git/gazette.git (a "bare"
        repository);
      - as soon as commits are pushed to it (git push), the site updates
        itself.

    My article about the street party is ready in ~/gazette, but not
    online yet. Everything is in man git. For sudo: gazette-2027."
bare-repo-word-theo =
    A note from Théo, the intern:

    "Sorry again about the overwritten article! By the way: I fixed a typo
    in the site title, directly in /var/www/gazette/index.html. I didn't
    have time to put it in git…"

## The site (HTML; { $date }: YYYY-MM-DD, { $jour }: the day of the month)

bare-repo-title-mistake = The Neighbourhood Gazzette
bare-repo-site-index-v1 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Neighbourhood Gazzette</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>The Neighbourhood Gazzette</h1>
    <p>News from the street, by the people who live there.</p>
    <ul>
    <li><a href="agenda.html">This month's calendar</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-index-theo =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Neighbourhood Gazette</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>The Neighbourhood Gazette</h1>
    <p>News from the street, by the people who live there.</p>
    <ul>
    <li><a href="agenda.html">This month's calendar</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-index-v2 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Neighbourhood Gazzette</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>The Neighbourhood Gazzette</h1>
    <p>News from the street, by the people who live there.</p>
    <ul>
    <li><a href="fete-des-voisins.html">The street party, courtyard side</a></li>
    <li><a href="agenda.html">This month's calendar</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-article =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The street party, courtyard side</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>The street party, courtyard side</h1>
    <p>Three tables, two guitars and a pistachio cake: on Friday evening,
    the courtyard at number 12 partied into the night. By Samia.</p>
    </body>
    </html>
bare-repo-site-agenda =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>This month's calendar</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>This month's calendar</h1>
    <p>Street yard sale: Saturday <time datetime="{ $date }">June { $jour }</time>, from 8 a.m. to 6 p.m.</p>
    </body>
    </html>
bare-repo-commit-1 = First version of the site
bare-repo-commit-2 = Article: the street party

## Events

bare-repo-event-drift =
    There's Théo's fix: "Gazzette" turned into "Gazette", in the server's
    copy only. It isn't in git: if you deploy ~/gazette as it is, it will
    disappear. Better to carry it over to ~/gazette/index.html first,
    then git commit.
bare-repo-event-rights =
    The repository was created with sudo: it belongs to root, and git
    push, run under your name, isn't allowed to write to it. Look at
    ls -l /srv/git: who should own it? (man chown)
bare-repo-event-without-hook =
    The server's repository did receive your commits (git log --oneline
    in /srv/git/gazette.git), but the site hasn't changed: nothing
    extracts them into /var/www/gazette. That's the job of a hook,
    hooks/post-receive, run after each push is received (man git).
bare-repo-event-hook-ignore =
    The push went through, but git didn't run the hook: it isn't
    executable (ls -l /srv/git/gazette.git/hooks). A hook is a
    program; see man chmod.
bare-repo-event-not-tracked =
    git refuses to overwrite files it doesn't know about in
    /var/www/gazette: they were put there by hand, and it doesn't want to
    lose anything. With -f (force), it replaces them. Before forcing,
    look at what you would lose: diff -r ~/gazette /var/www/gazette.
bare-repo-event-correction-lost =
    Théo's fix has disappeared from the site: the deployment replaced
    index.html with the one from git, which didn't have it. From now on,
    what isn't in git doesn't exist. Redo the fix in ~/gazette
    ("Gazzette" becomes "Gazette", twice in index.html), then commit
    and push.
bare-repo-event-in-line =
    Samia: "My article is online, and the typo in the title is gone,
    thanks! One small thing: in agenda.html, the yard sale is on
    Saturday June 12, not the 21st. The date is written twice: in the
    text and in datetime="2027-06-21". Can you fix it, and publish it
    the proper way?"
bare-repo-event-a-main =
    The date is fixed on the server, but not in git: that's exactly
    what we wanted to stop. On the next push, the fix would be
    overwritten. Fix it in ~/gazette, then commit and push.
bare-repo-event-end =
    The site is up to date, and it only changes through git push. Samia:
    "Nobody overwrites anybody else's work anymore. And if a release
    goes wrong, the history is there."

    Well done! You have finished chapter 1 of The Gazette. (What comes
    next is waiting for you: ssh gazette.)

    WHAT HAPPENED
    The site lived in a directory edited by hand: no way of knowing who
    had changed what, and one copy could overwrite another. A bare
    repository (git init --bare) has no working copy: it is only there
    to receive pushes. Its post-receive hook, a script run after each
    push is received, extracts the latest commit into the site's
    directory (git --work-tree=… checkout -f). What was only on the
    server (Théo's fix) first had to go into git.

    GOOD PRACTICE
    - A single source: the repository. Never edit the site on the
      server; use diff -r to spot what has drifted before switching.
    - The server's repository belongs to the account that pushes (or to
      a group, with git init --bare --shared=group).
    - A hook is a program: chmod +x, and it starts with #!/bin/sh.
    - Deployment must be reproducible: the same commit gives the same
      site.

    DOCUMENTATION
    - Git on the server: https://git-scm.com/book/en/v2/Git-on-the-Server-Setting-Up-the-Server
    - Git hooks: https://git-scm.com/docs/githooks
    - --work-tree: https://git-scm.com/docs/git
