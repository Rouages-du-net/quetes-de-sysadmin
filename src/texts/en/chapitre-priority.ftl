### Story "The Watch", chapter "The Priority": rank two CVEs by exposure as
### much as by CVSS score. The CVE identifiers are fictional; package
### names, commands and paths are not translated.

chapter-priority = The Priority
    .resume = Decide what to fix first: exposure matters as much as the CVSS score.

## Files

priority-email-salome =
    From:     Salomé
    To:       you
    Subject:  Two CVEs, in which order?

    Well done on the sort. Two CVEs remain to deal with: nginx (score 8.2)
    and rsync (score 9.8). If you stop at the score, rsync comes first,
    it's the highest. But the score alone doesn't tell the whole story.

    Ask yourself the question I always ask: who can reach this service, and
    how? Look at what is actually listening on this server (man ss, man
    nmap). A service reachable from the internet, even with a lower score,
    deserves to be dealt with before a tool that never runs unless you
    launch it yourself.

    Write your decision in priority.md, with why. And tell me what we do
    about the openssh-server CVE too: it applies to this server, but does
    it call for action?

    Salomé

priority-template =
    # Priority — The Bakery

    (to complete: the order to handle the two retained CVEs, with why;
    and what to do about the openssh-server CVE)

priority-a-complete = (to complete
priority-words-expose = internet, reachable, exposed, public, outside, 80, 443
priority-words-local = no port, not listening, doesn't listen, local, command line, tool, not a service, no service
priority-words-protected = already protected, already set to "no", already no, nothing to do, no action, kbdinteractiveauthentication

## Review

priority-review = Salomé reviews your decision:
priority-missing-template = The "(to complete)" line of the template is still there.
priority-missing-order = Both CVEs (nginx and rsync) must be named, nginx first.
priority-missing-exposure = Say why: what makes nginx reachable from the internet, and why isn't rsync (check ss -tlnp or nmap)?
priority-missing-ssh = Don't forget the openssh-server CVE: does it apply? Does it need action?

## Events

priority-event-score-only =
    You ranked rsync before nginx: that's the CVSS score order (9.8 against
    8.2), but look at the exposure. A score measures how bad things get IF
    the flaw is reached; it says nothing about how easy it is to reach.
    Rerun ss -tlnp or nmap -sV on this server: who can talk to each
    service?
priority-event-expose =
    Here is what actually listens: 80 and 443 answer any address. rsync
    never has an open port: it's a tool you run, not a service waiting for
    connections.
priority-event-order =
    Your ranking holds: nginx first (exposed), rsync next (a higher score,
    but no port, so no way to reach it remotely).
priority-event-end =
    Salomé: "That's exactly it. The score says 'if it hits', not 'can it
    hit me'."

    Well done! You have finished the chapter "The Priority".

    WHAT HAPPENED
    A CVSS score measures a flaw's impact once reached (data loss, system
    control…), not how easy it is to reach. A service reachable from the
    internet with a medium score is often more urgent than a local tool
    with a high score, because nobody but you can trigger the second flaw.

    GOOD PRACTICE
    - Cross the score with the real exposure (ss -tlnp, nmap -sV) before
      deciding on an order.
    - A flaw that needs access you already have (local, authenticated) is
      almost always less urgent than one reachable from outside, even at
      an equal or lower score.
    - Write down the decision and its reason: a priority order that cannot
      be explained cannot be defended.

    ANOTHER WAY
    CVSS version 4.0 actually adds exposure metrics ("Attack Requirements",
    "Attack Complexity") to the base score, to fold part of this reasoning
    straight into the number; it is still worth checking your own system's
    real exposure yourself, which the score does not know.

    DOCUMENTATION
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - nmap: https://nmap.org/book/man.html
    - CVSS: https://www.first.org/cvss/
