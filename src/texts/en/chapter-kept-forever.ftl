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

## What the three chapters of the story share (members, policy, pages): kept here so that they load with the story.

choir-list-locale = en
choir-policy-marker = HOW LONG WE KEEP PERSONAL DATA

# Invented people (Ofcom's drama range of phone numbers, .example domains): id|first_name|last_name|email|phone|voice|joined_on|left_on|address
choir-members =
    1|Amara|Okafor|amara.okafor@mail.example|07700 900101|alto|2025-09-01||3 Mill Row, Riverside
    2|Kenji|Watanabe|kenji.watanabe@mail.example|07700 900102|bass|2025-09-01||27 Orchard Way, Riverside
    3|Gwen|Hughes|gwen.hughes@mail.example|07700 900103|soprano|2024-09-02|2027-06-30|8 Weir Lane, Riverside
    4|Mateus|Silva|mateus.silva@mail.example|07700 900104|tenor|2025-09-01||41 Canal Street, Riverside
    5|Leila|Haddad|leila.haddad@mail.example|07700 900105|soprano|2026-01-12||12 Ferry Road, Riverside
    6|Oskar|Lindqvist|oskar.lindqvist@mail.example|07700 900106|bass|2026-09-07||5 Heron Close, Riverside
    7|Nadia|Petrova|nadia.petrova@mail.example|07700 900107|alto|2026-09-07||19 Lock Terrace, Riverside
    8|Samuel|Mensah|samuel.mensah@mail.example|07700 900108|tenor|2025-09-01|2028-06-30|2 Willow Bank, Riverside
    9|Chloe|Martin|chloe.martin@mail.example|07700 900109|soprano|2027-09-05||33 Station Hill, Riverside
    10|Arjun|Mehta|arjun.mehta@mail.example|07700 900110|bass|2027-09-05||7 Quay Street, Riverside
    11|Fatima|Idrissi|fatima.idrissi@mail.example|07700 900111|alto|2027-09-05||16 Barge Walk, Riverside
    12|Brendan|Walsh|brendan.walsh@mail.example|07700 900112|tenor|2026-09-07|2028-12-15|9 Reed Court, Riverside
    13|Yuki|Tanaka|yuki.tanaka@mail.example|07700 900113|soprano|2028-01-10||21 Meadow View, Riverside
    14|Rosa|Delgado|rosa.delgado@mail.example|07700 900114|alto|2028-09-03||4 Towpath Lane, Riverside
    15|Ivan|Horvat|ivan.horvat@mail.example|07700 900115|bass|2027-09-05|2029-06-30|11 Bridge End, Riverside
    16|Aisha|Bello|aisha.bello@mail.example|07700 900116|soprano|2028-09-03||28 Mill Row, Riverside
    17|Tom|Becker|tom.becker@mail.example|07700 900117|tenor|2028-09-03||6 Linden Avenue, Riverside
    18|Mei|Lin|mei.lin@mail.example|07700 900118|alto|2029-01-14||30 Kingfisher Rise, Riverside
    19|Pablo|Ortega|pablo.ortega@mail.example|07700 900119|bass|2028-09-03|2030-06-30|15 Sluice Road, Riverside
    20|Ingrid|Solberg|ingrid.solberg@mail.example|07700 900120|soprano|2029-09-08||2 Osier Lane, Riverside
    21|Kwabena|Asante|kwabena.asante@mail.example|07700 900121|tenor|2029-09-08||18 Wharf Street, Riverside
    22|Hannah|Weiss|hannah.weiss@mail.example|07700 900122|alto|2029-09-08|2030-12-20|23 Pike Street, Riverside
    23|Sofia|Rossi|sofia.rossi@mail.example|07700 900123|soprano|2029-09-08||10 Moorhen Way, Riverside
    24|Daniel|Cohen|daniel.cohen@mail.example|07700 900124|bass|2030-01-12||37 Canal Street, Riverside
    25|Lucia|Moreno|lucia.moreno@mail.example|07700 900125|alto|2030-01-12||1 Ferry Road, Riverside
    26|Omar|Farouk|omar.farouk@mail.example|07700 900126|tenor|2030-09-07||13 Heron Close, Riverside
    27|Priya|Raman|priya.raman@mail.example|07700 900127|alto|2030-09-07||14 Elm Court, Riverside
    28|Elif|Kaya|elif.kaya@mail.example|07700 900128|soprano|2030-09-07||9 Lock Terrace, Riverside
    33|Minh|Tran|minh.tran@mail.example|07700 900133|bass|2030-09-07||26 Quay Street, Riverside
    36|Grace|Mwangi|grace.mwangi@mail.example|07700 900136|soprano|2031-01-11||5 Weir Lane, Riverside
    41|Tomas|Novak|tomas.novak@mail.example|07700 900141|tenor|2029-09-08||22 Barge Walk, Riverside

# People who signed up for the newsletter on the site without being members: email|date.
choir-newsletter-public =
    jo.bright@post.example|2029-11-02
    sam.okonjo@post.example|2030-05-17
    lee.harper@post.example|2030-12-06

# Ruben's export for the phone tree, October 2030 (Priya lived elsewhere then).
choir-phone-tree =
    name,voice,phone,address
    Amara Okafor,alto,07700 900101,3 Mill Row
    Kenji Watanabe,bass,07700 900102,27 Orchard Way
    Mateus Silva,tenor,07700 900104,41 Canal Street
    Leila Haddad,soprano,07700 900105,12 Ferry Road
    Nadia Petrova,alto,07700 900107,19 Lock Terrace
    Arjun Mehta,bass,07700 900110,7 Quay Street
    Rosa Delgado,alto,07700 900114,4 Towpath Lane
    Tom Becker,tenor,07700 900117,6 Linden Avenue
    Ingrid Solberg,soprano,07700 900120,2 Osier Lane
    Omar Farouk,tenor,07700 900126,13 Heron Close
    Priya Raman,alto,07700 900127,3 Kingfisher Rise
    Elif Kaya,soprano,07700 900128,9 Lock Terrace

choir-purge-comment = Delete what our retention policy says is expired (Ruben, 2029).

choir-policy =
    RIVERSIDE COMMUNITY CHOIR
    HOW LONG WE KEEP PERSONAL DATA
    Adopted by the board on 14 September 2029. Reviewed every September.

    We keep personal data only as long as we need it for the purpose we
    collected it for (GDPR, article 5(1)(e)). When the time is up, it is
    deleted, or anonymised so that nobody can be identified from it.

    What                                  How long                         Why
    ------------------------------------  -------------------------------  ---------------------------------
    Members' records (profile, contacts)  while a member, then 2 years     to welcome back returning singers
    Rehearsal attendance                  2 years                          planning, the hall's insurance
    Subscriptions and payments            10 years                         accounting records (the law)
    Photo and its consent form            while a member                   consent
    Newsletter address                    until unsubscribed               consent
    Web server access logs                30 days, addresses truncated     security: long enough to look
                                                                           into an incident, no longer
    Members' area security log (audit)    12 months                        security investigations
    System journal                        30 days                          security, troubleshooting
    Backups                               3 months of weekly backups       recovery after an incident
                                          (erased data leaves them as
                                          they age out)

    Requests from members (a copy of their data, a correction, an
    erasure): answered within one month (GDPR, article 12(3)). Amara
    receives them and passes them on to whoever runs the server.

choir-page-index =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Riverside Community Choir</title></head>
    <body>
    <h1>Riverside Community Choir</h1>
    <p>Forty voices, no audition, rehearsals every Tuesday at 7.30 pm in the Lock Street hall.</p>
    <p><a href="/concerts.html">Concerts</a> · <a href="/join.html">Join us</a> · <a href="/members/login">Members' area</a></p>
    </body>
    </html>
choir-page-concerts =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Concerts — Riverside Community Choir</title></head>
    <body>
    <h1>Concerts</h1>
    <p>Spring concert: Saturday 12 April 2031, 7 pm, St Anne's church. Free entry, donations welcome.</p>
    </body>
    </html>
choir-page-join =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Join us — Riverside Community Choir</title></head>
    <body>
    <h1>Join us</h1>
    <p>Come to any Tuesday rehearsal: no audition, no need to read music. The subscription is 120 a season (60 reduced).</p>
    </body>
    </html>
choir-page-login =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Members' area</title></head>
    <body><h1>Members' area</h1><form method="post"><input name="email"><input name="password" type="password"><button>Log in</button></form></body>
    </html>
