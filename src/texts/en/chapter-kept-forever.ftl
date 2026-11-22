### Story "The Choir", chapter "Kept Forever": the logs of the choir's
### server go back years, against the retention policy. logrotate (rotate,
### maxage), find -mtime, nginx's map and log_format, journald's
### MaxRetentionSec=. Commands, options, paths and outputs are not
### translated.

chapter-kept-forever = Kept Forever
    .summary = The choir's board wrote down how long it keeps personal data, two years ago. The server never read it: its logs keep every visitor's address since 2027. Bring the logs in line with the policy, without throwing away what it asks to keep.

## Files

kept-forever-message-amara =
    From: Amara (chair, Riverside Community Choir)
    Tuesday 4 March, 9:10

    Hello, and thank you for taking over our little server!

    At last week's board meeting, someone asked whether we actually do
    what our retention policy says. We adopted it in 2029 (it's in
    /srv/choir/docs/retention-policy.txt), Ruben set up the server before
    that, and I'm afraid nobody ever checked. Ruben moved to Glasgow; he
    left you a note.

    Could you look at the server's logs and make them follow the policy?
    Keep what the policy says to keep, and nothing longer. I'd rather we
    find out ourselves than have a member find out for us.

    You're on baton, the choir's server; sudo works with your password.

    Amara

kept-forever-note-ruben =
    Notes from Ruben (baton, 2027)

    - nginx serves www.riversidechoir.example from /var/www/choir; the
      members' area (/members/) is the choir app (gunicorn, port 8000).
      Logs in /var/log/nginx.
    - I set logrotate to keep the web logs for ten years, "just in case"
      (/etc/logrotate.d/nginx). Disk is cheap.
    - The members' area writes its security log (logins, profile changes)
      to /var/log/choir/audit.log, rotated every month.
    - journalctl for everything else; the journal is persistent
      (/var/log/journal).

    Ruben

## Events

kept-forever-event-policy =
    That's the board's promise: web access logs for thirty days with the
    addresses truncated, the members' area's security log for twelve
    months, the system journal for thirty days. Now look at what the server
    really keeps: /var/log/nginx, /var/log/choir, the journal.
kept-forever-event-forever =
    { $weeks } weeks of access logs, back to September 2027, each line with
    a visitor's full IP address: under the GDPR, an IP address is personal
    data. Ruben's "rotate 520" keeps ten years of weekly logs. Where does
    logrotate decide how long a log lives? (man logrotate: rotate, maxage,
    daily, weekly.)
kept-forever-event-today-only =
    Today's log is gone, but the years of archives are still there: the
    problem was never today's file. And the policy asks to keep thirty days
    of logs, to look into an incident: delete what is older, not what is
    recent.
kept-forever-event-too-much =
    You deleted logs the policy asks to keep: the last weeks of web logs
    (thirty days, to look into an incident) or the security log of the last
    twelve months. A retention policy is a maximum and a minimum. On a real
    server, you would now restore them from a backup; here, restart the
    chapter (or use the rescue snapshot) and delete only what is older than
    the policy allows.
kept-forever-event-rotation =
    logrotate now keeps no more than thirty days of access logs. But
    logrotate only acts at the next rotation, and it only removes the log
    that passes its count: the years of archives a larger count left behind
    stay where they are. Look at them again (ls, or find -mtime).
kept-forever-event-leftovers =
    logrotate ran with the new count, and { $count } old archives are still
    there: it only removes the archive that passes the count (and, with
    maxage, the old ones within count + 1), never the hundreds of files left
    beyond it. Remove what is older than thirty days yourself, carefully:
    find /var/log/nginx -mtime +30 lists them before you delete anything.
kept-forever-event-purged =
    Nothing older than thirty days is left in /var/log/nginx, and the recent
    weeks are still there. The past is in line; now the present: every new
    line still carries the visitor's full address.
kept-forever-event-log-off =
    access_log off: nginx no longer writes any access log. No addresses,
    certainly, but no way to look into an incident either, and the policy
    asks for thirty days of them. Keep the log, with the address truncated
    (man nginx: map, log_format).
kept-forever-event-v6-whole =
    IPv4 addresses are truncated, but IPv6 visitors still appear with their
    full address: some of the choir's visitors come over IPv6
    (2001:db8:…). Your map must handle both, or fall back on a default that
    reveals nothing.
kept-forever-event-not-loaded =
    The configuration in the files truncates addresses, but the running
    nginx still uses the configuration it loaded: nginx -t, then reload it
    (systemctl reload nginx).
kept-forever-event-anonymised =
    New visitors appear in access.log with a truncated address (the last
    byte of an IPv4 address, everything after the second group of an IPv6
    one): enough to spot a network that floods the site, not enough to
    point at a household. Remains the system journal.
kept-forever-event-vacuum-only =
    The old journal files are gone, but nothing tells journald to keep the
    journal to thirty days: it will grow back. The policy belongs in its
    configuration (man journald.conf: MaxRetentionSec=).
kept-forever-event-journal-not-loaded =
    MaxRetentionSec= is in the file, but journald reads its configuration
    when it starts: restart it (systemctl restart systemd-journald).
kept-forever-event-journal =
    journald now keeps thirty days, and has removed the older archived files.
kept-forever-event-end =
    Amara: "Thank you! I'll tell the board we now do what we say. I wonder
    what else we keep without knowing it…"

    Well done! You finished Kept Forever.

    WHAT HAPPENED
    The board's policy promised thirty days of web logs with truncated
    addresses, and thirty days of journal. Ruben's logrotate kept ten years
    of weekly logs, with every visitor's full IP address, and the journal
    went back to 2027. You set logrotate to thirty days, removed the
    archives it would never have removed itself, truncated the addresses
    nginx writes with a map and a log_format, and gave journald a
    MaxRetentionSec=, keeping the members' area's security log, which was
    already right.

    GOOD PRACTICE
    - Storage limitation (GDPR, article 5(1)(e)): personal data is kept no
      longer than its purpose needs. An IP address is personal data.
    - A retention period is set in the tool that keeps the data
      (logrotate, journald), not in a reminder: it then happens every day.
    - Changing logrotate's count doesn't clean the past: it only removes
      the archive that passes the count. Check with find -mtime before
      deleting.
    - Minimise at the source: a truncated address in the log rather than a
      full one cleaned up later. The error log still holds full addresses:
      keep it short too, or at a level that logs less.
    - A policy is also a minimum: the security log of the last twelve
      months stays, to answer "who logged in?" after an incident.

    DOCUMENTATION
    - GDPR, article 5: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - The CNIL (France's data protection authority): https://www.cnil.fr/
    - nginx's log module: https://nginx.org/en/docs/http/ngx_http_log_module.html
    - nginx's map module: https://nginx.org/en/docs/http/ngx_http_map_module.html
    - logrotate(8): https://man7.org/linux/man-pages/man8/logrotate.8.html
    - journald.conf(5): https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html
