### Story "The Watch", chapter "No Proof, No Certainty": reprove that the
### fixes hold, look for an earlier attempt in the logs. The commands, the
### paths and nginx's access log format are not translated.

chapter-proof = No Proof, No Certainty
    .resume = Reprove that the fixes hold, and check whether the flaw had already been tried.

## Files

proof-email-salome =
    From:     Salomé
    To:       you
    Subject:  One last thing before closing the week

    Two CVEs fixed is good; it still has to be proven, not just believed.
    Confirm with apt (man apt) that nothing is left pending for nginx and
    rsync.

    And a habit worth building, even after the fact: had the nginx flaw
    (HTTP/2) already been tried before you fixed it? nginx's access log
    keeps a record of every request (man grep to search it). A failed
    attempt hurts nobody, but is worth noting: it means someone, out there,
    was already looking.

    Salomé

## Events

proof-event-versions =
    apt confirms: nothing left to update for nginx or rsync. It's only once
    checked that it's really fixed.
# { $adresse }: the address of the attempt that was found
proof-event-found =
    One line of the access log stands out: an empty HTTP/2 request, with no
    declared browser, refused by nginx (code 400), from { $adresse }, a few
    days before the fix. It isn't proof of a successful intrusion (nginx
    refused it), but it's a trace worth keeping: someone was already
    looking.
proof-event-end =
    Salomé: "That's what I mean by proof: not 'I think it's fixed', but
    'apt confirms it, and here's the attempt we spotted'."

    Well done! You have finished the chapter "No Proof, No Certainty".

    WHAT HAPPENED
    A fix applied without checking is only an intention. Checking
    afterwards (an empty apt list --upgradable) turns "I believe it's done"
    into an established fact. Searching the logs for an earlier attempt,
    even a failed one, gives an idea of who was already interested in this
    server, and since when.

    GOOD PRACTICE
    - Always reprove a fix after applying it: apt list --upgradable, or the
      fixed tool's own command.
    - Look for traces of an attempt before closing an incident, even
      without proof it succeeded: that's part of the watch, not only of
      responding to an incident already visible.
    - Keep logs long enough to reread them: an attempt is often only
      noticed afterwards, once you know the flaw.

    ANOTHER WAY
    An intrusion detection system (like fail2ban, already seen in "The
    Sentinel", or a fuller tool like Suricata) can spot this kind of
    attempt live rather than after the fact, and react on its own (ban the
    address). The two complement each other: live detection to react fast,
    rereading the logs to understand what was missed.

    DOCUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - nginx's access log format: https://nginx.org/en/docs/http/ngx_http_log_module.html
