### Story "The Shelter", chapter "Switch and Learn": haven's firewall,
### a check from outside, www switched in the zone (serial, rndc reload,
### TTL), the blameless review, and the next restore drill scheduled.
### The last chapter of the series: its debrief closes the arc.
### Commands, options, paths and outputs are not translated.

chapter-switch-and-learn = Switch and Learn
    .summary = The site runs again on the spare, but the world still asks for the drowned server's address. Open the way, check it from outside, point the name at the new machine, and watch the old answer fade. Then the two lines of the plan everyone skips: the review, and the next drill.

## Files

switch-and-learn-message-teuila =
    From: Teuila
    Friday 14 November, 13:10

    haven works on the inside: Mirela browsed the animals' pages on it.
    Now the world. Visitors still ask for www.hillsideshelters.example
    and get Hillside's address, which is under water.

    Riverbend's router already forwards its public address,
    203.0.113.163, port 80, to haven (Wiremu did it at noon). meadow is
    our hidden primary DNS server for the zone (/etc/bind), the
    registrar's server copies it. Dariusz's plan had us lower www's TTL
    to five minutes a fortnight ago: the switch should be quick.

    Then the last two lines of the plan, the ones nobody does:
    - the review, in review.md here (the template is ready). No names to
      blame: what happened, what helped, what to change, and who does
      what next.
    - the next restore drill: Mirela started a script,
      /usr/local/sbin/restore-drill. It has to really restore and check,
      and run on its own, every month. Its key is in /root/.restic-drill.

    Teuila

switch-and-learn-review-template =
    # Post-incident review: the Hillside flood, 14 November 2031

    <!-- Blameless: describe what happened and why, not who is at fault. -->

    ## Summary

    (to be completed)

    ## Timeline

    <!-- The times, from the logs: meadow's /var/log/sitewatch.log, the restic snapshots, named's journal. -->
    (to be completed)

    ## Impact

    (to be completed)

    ## What went well

    (to be completed)

    ## What to improve

    (to be completed)

    ## Actions

    <!-- One per line, each with its owner: Teuila, Mirela, Rahel, Wiremu, or you. -->
    (to be completed)

switch-and-learn-section-summary = Summary
switch-and-learn-section-timeline = Timeline
switch-and-learn-section-impact = Impact
switch-and-learn-section-went-well = What went well
switch-and-learn-section-improve = What to improve
switch-and-learn-section-actions = Actions
switch-and-learn-placeholder = (to be completed)
# A regular expression: the words that point at a culprit.
switch-and-learn-blame-words = \b(fault|blame|blamed|careless|negligent|negligence|stupid|incompetent|should have known)\b
# A regular expression: the people who can own an action.
switch-and-learn-owners = \b(Teuila|Mirela|Rahel|Wiremu|you|me)\b

## Events

switch-and-learn-event-outside-closed =
    No answer from haven on port 80, from outside: the router forwards the
    port, but haven's firewall drops it (Wiremu enabled ufw this morning,
    with ssh only). Switching the name now would send every visitor into
    that wall.
switch-and-learn-event-opened =
    haven's firewall lets the web in (port 80). Check from here, through
    Riverbend's public address, before touching the name.
switch-and-learn-event-outside =
    From meadow, outside both shelters, Riverbend's public address answers
    with the shelters' site: haven is ready for the world. Now the name.
switch-and-learn-event-dark-switch =
    www now points at Riverbend, but visitors get nothing: haven doesn't
    answer from outside yet (its firewall, or nginx). In a real switch,
    the order is: it works from outside first, then the name.
switch-and-learn-event-serial =
    named loaded the new address, but the registrar's server still serves
    the old one: the serial in the SOA didn't go up, so the secondary
    doesn't copy the zone (journalctl -u named says it). Increase it, and
    rndc reload again.
switch-and-learn-event-zone =
    named on meadow serves the new address for www.
switch-and-learn-event-switched =
    The registrar's server answers 203.0.113.163 for www: visitors who
    ask now reach haven. Those whose resolver remembers the old answer
    follow within its TTL: five minutes, the plan's doing.
switch-and-learn-event-cache =
    Still the old address: the resolver answers from its cache until the
    TTL it was given runs out (dig shows the seconds left). Ask the
    registrar's server directly (dig @ns1.registrar.example) to see what
    it serves now; the resolver follows within five minutes.
switch-and-learn-event-resolver =
    The public resolver gives the new address too: the old answer has
    expired. Everyone gets haven now.
switch-and-learn-event-blame =
    The review points at someone. A blameless review describes what the
    system and the process allowed, so that people tell everything next
    time: write what happened, not whose fault it is.
switch-and-learn-event-no-owners =
    Each action needs an owner (Teuila, Mirela, Rahel, Wiremu, or you),
    one action per line: an action nobody owns is a wish.
switch-and-learn-event-no-timeline =
    The timeline needs the times from the logs: when the site went down
    ({ $time }, the first failed check in sitewatch.log), and at least two
    more (the last backup, the switch…).
switch-and-learn-event-review =
    The review is written: what happened, its impact, what helped, what
    to change, and who does what.
switch-and-learn-event-drill-list-only =
    The drill, run as it will run, only lists the snapshots: that proves
    the repository opens, not that a backup comes back. A drill restores
    (beside: --target), then checks what came back.
switch-and-learn-event-drill-over-root =
    The drill restores over /: on meadow, that would write paddock's /etc
    over meadow's. Restore beside, in a scratch directory.
switch-and-learn-event-drill-unchecked =
    The drill restores, but doesn't check what came back: the dump's
    SHA-256 is in shelter.sha256, next to it (sha256sum -c, from that
    directory).
switch-and-learn-event-drill-failed =
    The job runs, but restic never ran to the end: read what it prints
    (run the script by hand, as root).
switch-and-learn-event-drill =
    The drill, run as cron or the timer will run it, restores the latest
    snapshot beside and checks the dump against its SHA-256.
switch-and-learn-event-end =
    Teuila: "The site is back, the review is on the board's table, and
    the next drill is in the calendar. Thank you. Really."

    Well done! You finished The Shelter, and with it the last story of
    Sysadmin Quests.

    WHAT HAPPENED
    haven served the site on the inside; you opened its firewall to the
    web and checked it from outside before touching the name. Then www
    moved in the zone, with a serial that went up so the registrar's
    server would follow, and the five-minute TTL lowered in advance let
    the old answer fade quickly. The review tells the night without
    blame, with actions and owners, and the next drill will restore and
    check on its own every month.

    GOOD PRACTICE
    - Switch last: the new service works from outside first, then the
      name moves.
    - Lower the TTL long before you need to move (days, not minutes): the
      old TTL is what caches remember.
    - A zone change needs a higher serial, or the secondaries keep the
      old zone.
    - A blameless review: timeline from the logs, impact, what helped,
      what to change, actions with an owner and a date.
    - A drill that doesn't restore tests nothing: restore beside, check
      (checksums, counts), time it, and write the result in the plan.
    - The plan is a living document: every new service, every drill,
      every incident changes it.

    Since the first command of the Eraser, you have listed files, read
    logs, opened ports and closed them, signed, encrypted, restored. This
    last night put it all together: a plan, the backups it promised, a
    rebuild in the right order, a calm switch, and the lessons written
    down for the next person. That is the craft, more than any single
    command. Keep your plans true, keep drilling, and be kind in your
    reviews. Thank you for playing.

    DOCUMENTATION
    - NIST SP 800-34 Rev. 1 (testing, exercises and plan maintenance): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - BIND 9, zone files and the SOA serial: https://bind9.readthedocs.io/en/stable/chapter3.html
    - RFC 1034, caching and TTL: https://www.rfc-editor.org/rfc/rfc1034#section-4.3.5
    - ufw: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
    - Google SRE book, postmortem culture: https://sre.google/sre-book/postmortem-culture/
    - restic, restoring: https://restic.readthedocs.io/en/stable/050_restore.html
