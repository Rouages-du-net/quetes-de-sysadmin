### Story "The Gazette", chapter 3 "Blue and green": deploy without
### downtime, with two slots and a health check. Commands, paths,
### and messages from nginx, systemctl and curl are not translated.

chapitre-bleu-vert = Blue and green
    .resume = Update the subscriptions app without downtime: the new version next to the old one, its health checked, then nginx switches over.

## Files

bleu-vert-message-de-samia =
    A message from Samia:

    "The Gazette now has its Kiosk: the app for subscribing to the
    newsletter (curl http://gazette.example/kiosk/). It's
    a Node.js program, behind nginx.

    It can run as two copies, "blue" (blue) and "green" (green):
      - blue: the kiosk-blue service, port 3001, the code in
        /srv/kiosk/blue (a link to a version in /srv/kiosk/versions/);
      - green: the kiosk-green service, port 3002, /srv/kiosk/green (stopped).
    nginx sends /kiosk/ to one of the two
    (/etc/nginx/sites-available/gazette).

    Blue is running 1.4.2. We need to move to 1.5.0, already installed
    in /srv/kiosk/versions/, without readers seeing the
    slightest interruption. Each version answers on /health when it's fine.

    And keep the old version running until we're sure about the
    new one. For sudo: gazette-2027."
bleu-vert-conf-commentaire = The Kiosk (subscriptions): the slot that serves readers
bleu-vert-notes-150 =
    Kiosk 1.5.0 — release notes

    New: the newsletter is sent by the Kiosk itself.

    TO DO BEFORE GOING LIVE: set the mail server
    in the configuration (/etc/kiosk/kiosk.env), for example:
      KIOSK_SMTP=smtp.gazette.example
    Without it, /health answers 503 and sign-up fails.

## The Kiosk (pages served; { $version }: the app's version)

kiosque-accueil =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Gazette's Kiosk</title></head>
    <body>
    <h1>The Kiosk</h1>
    <p>Get the Gazette's newsletter every Monday.</p>
    <form method="post" action="inscription"><input name="courriel"><button>Subscribe</button></form>
    <footer>Kiosk { $version }</footer>
    </body>
    </html>
kiosque-archives =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Previous newsletters</title></head>
    <body>
    <h1>Previous newsletters</h1>
    <ul><li>Newsletter of 17 May</li><li>Newsletter of 10 May</li></ul>
    <footer>Kiosk { $version }</footer>
    </body>
    </html>

## Events

bleu-vert-evenement-sante-ko =
    /health answers 503: the version is running, but it's not in a state to
    serve. A version that fails its health check never gets
    any traffic. What it's missing is probably written in its release
    notes (/srv/kiosk/versions/1.5.0/).
bleu-vert-evenement-pas-redemarre =
    The link points to the new version, but the service still answers with
    the old one: a program reads its code (and its configuration) when it
    starts. It needs to be restarted (man systemctl).
bleu-vert-evenement-trop-tot =
    Ouch: readers are getting an error on /kiosk/. nginx is sending
    traffic to an instance that isn't answering, or not correctly. The
    rollback is immediate: put the other slot back in
    proxy_pass, nginx -t, reload. Check /health BEFORE switching over.
bleu-vert-evenement-pas-recharge =
    The nginx file does point to green (3002), but nginx is still serving
    blue: it only rereads its configuration on reload (nginx -t, then
    systemctl reload nginx).
bleu-vert-evenement-plus-de-filet =
    Blue is stopped: if 1.5.0 shows a problem tonight, there will be
    no instant rollback anymore. Keep the old version running
    for a while, until you're sure.
bleu-vert-evenement-fin =
    Readers have moved to 1.5.0 without noticing, and
    the old version is waiting, still running, just in case. Samia: "If things go
    wrong, we switch back with one command."

    Well done! You have finished chapter 3 of The Gazette. (What comes next awaits you:
    ssh gazette.)

    WHAT HAPPENED
    Two slots, blue and green: one serves the public, the other receives
    the new version. You start it, check its health (/health) before
    it gets a single visitor, fix what's missing (its
    configuration), then the proxy switches over in one go. Reloading nginx
    doesn't cut any connection: old requests finish, new
    ones go to green.

    GOOD PRACTICE
    - Read the release notes before deploying.
    - An automatic health check (/health) before any switchover.
    - nginx -t before every reload; reload, not restart.
    - Keep the old version running until the new one has proved
      itself: rolling back means switching the proxy back.
    - Blue and green take turns: the next version will go on blue.

    ANOTHER WAY
    The canary (next chapter) sends only a small share of visits to
    the new version, to judge it on real traffic; a rolling
    deployment replaces servers one by one. Blue-green:
    instant switchover and immediate rollback, at the cost of twice
    the resources during the switch.

    DOCUMENTATION
    - Blue-green deployment: https://martinfowler.com/bliki/BlueGreenDeployment.html
    - proxy_pass: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
    - Reloading nginx: https://nginx.org/en/docs/beginners_guide.html#control
