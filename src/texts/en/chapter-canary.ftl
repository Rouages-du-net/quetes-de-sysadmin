### Story "The Gazette", chapter 4 "The canary": send a small share of the
### traffic to the new version, and look at the logs before going any
### further. Commands, paths and messages from nginx, curl and the logs
### are not translated.

chapter-canary = The canary
    .summary = A version that passes its health checks but crashes on one page: a canary (one visit in ten), the logs, and the switch only when everything is clean.

## Files

canary-message-samia =
    A message from Samia:

    "Kiosk 1.6.0 is out (/srv/kiosk/versions/1.6.0), with a new
    search in the archives. Green still serves 1.5.0; the new version
    will go on blue, as agreed.

    But this version changes a lot of things, and /health doesn't check
    everything. So this time, no switching all at once: first a canary.
    One visit in ten for blue, the rest for green, and we look at what
    readers get (/var/log/nginx/access.log) before going any further.
    man nginx explains how to split between two servers (upstream,
    weight).

    For sudo: gazette-2027."
canary-notes-160 =
    Kiosk 1.6.0 — release notes

    New: search in previous newsletters (/archives).
    Nothing to change in the configuration.
canary-notes-161 =
    Kiosk 1.6.1 — release notes

    Fix: the archives page (/archives) answered 500 when the search was
    empty. Thanks to the Gazette team for the report!

## Events

# { $visits }: the number of simulated visits
canary-one-time =
    An hour goes by: { $visits } visits to the Kiosk, through nginx.
    Everything is written in /var/log/nginx/access.log.
# { $errors }: the number of visits that got an error
canary-event-all-one-coup =
    All the traffic moved to 1.6.0 at once… and { $errors } visits
    in that hour got a 500 error: everyone gets to enjoy it. That's
    what the canary would have avoided. Go back to green (proxy_pass,
    nginx -t, reload), then try with a small share of the traffic.
canary-event-canary-160 =
    The canary is in place: blue (1.6.0) gets a small share of the visits.
    Now look at what readers received: the response codes are in
    access.log (the number after the request: 200, 404, 500…). grep or
    awk help you sort them.
canary-event-too-big =
    A large share of the traffic goes to the new version: if it has a
    problem, a lot of people will see it. A canary is a small share
    (one visit in ten, or less): weight=1 against weight=9.
canary-event-found =
    500s on /kiosk/archives! They must come from blue: green has been
    serving the same page for weeks. Try it directly on each instance
    (curl http://localhost:3001/archives, then 3002) to be sure.
    /health didn't check this page. Stop the canary: no more visits
    for blue (down, or remove the server).
canary-event-stopped =
    Canary stopped: only one visit in ten saw the error, for one hour,
    instead of everyone. Samia passes the problem on to the
    developers… who immediately release 1.6.1 (/srv/kiosk/versions/).
    Start again: blue, /health, canary, logs.
canary-event-canary-161 =
    One hour of canary with 1.6.1: no errors in this batch of visits.
    The new version can take all the traffic. Keep green running, just
    in case.
canary-event-end =
    The whole Kiosk goes through 1.6.1, without errors, and green waits
    in reserve. Samia: "The first try only bothered one visit in ten,
    for one hour. Without a canary, we would have served it to everyone."

    Well done! You have finished chapter 4 of The Gazette. (What comes
    next is waiting for you: ssh gazette.)

    WHAT HAPPENED
    1.6.0 answered fine on /health, but crashed on one specific page.
    An nginx upstream sent a small share of the visits to the new
    version (weight=1 against weight=9): the errors showed up in
    access.log, for only a few people. We stopped the canary, waited for
    the fix, ran a clean canary again, then switched everything over.

    GOOD PRACTICE
    - A canary: a small share of the traffic (a few %), for a set time,
      with stop criteria decided in advance (rate of 5xx).
    - Look at what users see (the access logs), not only /health.
    - Be able to stop the canary in one move (down, reload).
    - Increase in steps (10%, 50%, 100%); keep the old version running
      until the end.
    - To know which server handled each visit, add $upstream_addr to
      the log format (log_format).

    DOCUMENTATION
    - upstream and weight: https://nginx.org/en/docs/http/ngx_http_upstream_module.html
    - Canary release: https://martinfowler.com/bliki/CanaryRelease.html
    - Canarying releases (Google SRE): https://sre.google/workbook/canarying-releases/
