### Story "The Neighbourhood Letters", chapter 6 "Concert night":
### reading logs with awk, rate limiting with nginx. Commands, paths,
### directives and log lines are not translated.

chapter-concert = Concert night
    .resume = The events calendar collapses on concert night: reading logs with awk, rate limiting with nginx (limit_req).

## Files

concert-message-kofi =
    A message from Kofi, sent at 8:02 pm:

    "Help! Tonight there's a concert at the café, and everyone is checking
    the calendar for the time… which won't load any more. People get a 504
    error. Rania says the calendar can only serve about twenty pages per
    second, but we've never had this many people!

    Could you look in the nginx logs at who is asking for what, and make
    sure the real visitors get through? Rania left a guide
    (help_logs.txt). And no quick hack that only works tonight: a rule
    that holds up."
concert-help-logs =
    LOG GUIDE — BY RANIA

    Each visit writes a line to /var/log/nginx/access.log ("combined"
    format):

      address - - [date] "GET path HTTP/1.1" code bytes "referring page" "browser"
      $1          $4 $5   $6  $7   $8        $9   $10

    awk splits each line into fields ($1, $7, $9…). A few recipes:
      awk '{"{"}print $9{"}"}' FILE | sort | uniq -c         the response codes
      awk '{"{"}print $1{"}"}' FILE | sort | uniq -c | sort -n the addresses
      awk '$9 == 504 {"{"}print $7{"}"}' FILE | head          what fails

    To limit the rate, nginx has limit_req (man nginx): a zone in the
    http block (limit_req_zone), then limit_req where you want to limit.
    After each reload, look at the next minute in the log.

## Events

# After each nginx reload: one minute of traffic.
concert-minute =
    A minute goes by. Visitors: { $servis } requests served out of { $humains }.
    Robot: { $refuses } requests refused out of { $robot }. Timeouts
    (504): { $depasses }. (The details are at the end of access.log.)
concert-event-robot =
    Three neighbouring addresses (198.51.100.23, .24, .25), the same
    "browser" (AgendaScraper), hundreds of calendar pages per minute: it's
    a robot scraping the website. On its own, it asks for more than the
    calendar can serve. Real people, on the other hand, ask for a page and
    its four files, then read.
concert-event-forbidden =
    Blocking the robot's addresses (deny) works… tonight. Kofi: "Rania
    says these robots change addresses every week. We're not going to keep
    a list by hand!" A rate limit per address would apply to every robot,
    known or not.
concert-event-humans-limits =
    The limit refuses real people too! A browser asks for a page and its
    files (stylesheet, script, images) almost at the same time: five
    requests in the same second. With no leeway, the limit refuses them.
    limit_req accepts a burst, and nodelay serves it right away (man
    nginx).
concert-event-still-too =
    The limit slows the robot down, but it still gets through too often,
    and the calendar can overflow (504). The rate allowed per address,
    multiplied by the robot's number of addresses, must stay well below
    what the calendar can serve (about twenty pages per second). And does
    the limit really apply to /agenda/?
concert-event-end =
    All human visits get through, the robot is slowed down, and the
    calendar can breathe. Kofi: "The time shows up! The concert starts at
    9 pm." The error the robot receives (429 Too Many Requests, or 503)
    tells it to slow down.

    Well done! You have finished chapter 6 of The Neighbourhood Letters.

    WHAT HAPPENED
    A robot was requesting the calendar three times faster than it could
    answer; human visits waited behind it, until nginx's timeout (504).
    The access logs, read with awk, sort and uniq -c, showed who was
    asking for what.

    GOOD PRACTICE
    - Read the logs before acting: response codes, addresses, paths
      (awk '{"{"}print $9{"}"}' | sort | uniq -c).
    - Limit the rate per address (limit_req_zone $binary_remote_addr),
      where it is costly (the app), not necessarily everywhere.
    - Allow a burst (burst=10 nodelay): one page means several requests
      at once.
    - limit_req_status 429 clearly tells the robot to slow down.
    - Blocking an address (deny) is a stopgap; a rate rule holds up over
      time.

    DOCUMENTATION
    - limit_req: https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
    - The access log format: https://nginx.org/en/docs/http/ngx_http_log_module.html
    - awk (POSIX): https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html
