### Story "The Co-op", chapter "The secret": a .env served by nginx.
### nginx directives, paths and tool output are not translated.

chapter-secret = The secret
    .summary = The payment key is lying around on the internet: find out how it got out, close the leak in nginx, block whoever took it, change the key.

## Files

# { $cle }: the new payment key
secret-email-awa =
    From:    Awa
    To:      you
    Subject: URGENT: our payment key

    The payment terminal provider just called: our secret key was seen on
    the internet last night. They disabled it, and gave us a new one:

      { $cle }

    As long as the till uses the old one, no more card payments!
    The key is in the .env file of the till app (/srv/till/app), which
    the app reads when it starts.

    But first: how did it get out? Try requesting it from the website
    yourself (curl http://coop.example/.env), look at the nginx log
    (/var/log/nginx/access.log), and shut the door. If you find out who took
    it, block them too (man nginx… and the documentation of deny).

    For sudo: radish-2027

## Events

secret-event-env-only =
    /.env no longer gets out… but /.git/config does (try curl). The .git
    directory contains the repository address, with an access token in it.
    It's not just .env files you need to hide, it's ALL hidden files: a
    location with a regular expression (location ~ /\. ),
    or a root that only contains what must be public.
secret-event-site-broken =
    Careful: the leak is closed, but the website (/) or the till (/till/)
    no longer answers normally. Check with curl, and reread your
    configuration (sudo nginx -t).
secret-event-closed =
    Hidden files no longer get out, and the website still answers.
# { $adresse }: the blocked address
secret-event-attacker =
    { $adresse } now gets 403: this is the address that downloaded
    the .env and .git/config files last night (python-requests, at 3:12 a.m.). It won't come back
    through this site… but what it took, it already has: the secrets have
    to be changed.
secret-event-key-written =
    The new key is in .env… but the till is still running with the old
    one: the app only reads its .env when it starts. Check with
    curl http://127.0.0.1:3000/health.
secret-event-end =
    No more leak, the address is blocked, and the till accepts cards
    again. Awa: "Phew. We'll talk about it at the next meeting."

    Well done! You have finished the chapter "The secret".

    WHAT HAPPENED
    The website was served from the app's directory: nginx handed out
    everything in it, including hidden files (.env, .git). Bots request
    these addresses from every website, every night. nginx's access log
    keeps a record of every request: the time, the address, the code
    (200: the file went out).

    GOOD PRACTICE
    - A root that contains ONLY what must be public; never an app's
      directory, with its code and secrets.
    - Deny hidden files everywhere: location ~ /\. {"{"} deny all; {"}"}.
    - Secrets readable by the app only (chmod 600, owned by the app's
      account), and never in git.
    - A secret that has leaked is lost: change it (the payment key, but
      also the database password and the git token, to do next!).
    - After a leak: read the access log (grep '\.env' access.log),
      note who, when, what.

    DOCUMENTATION
    - location: https://nginx.org/en/docs/http/ngx_http_core_module.html#location
    - deny: https://nginx.org/en/docs/http/ngx_http_access_module.html
