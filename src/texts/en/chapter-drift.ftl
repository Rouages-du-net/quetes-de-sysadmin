### Story "The Mapping Party", chapter "Drift": records changed by hand
### during an incident, a forgotten apply holding the state lock, the drift
### shown by tofu plan, and tofu import. Commands, options, paths, resource
### addresses, record names and OpenTofu's outputs are not translated.

chapter-drift = Drift
    .summary = One evening the website's host died, and the volunteer on call fixed the DNS by hand, quickly and well. Now the code says one thing, the DNS server another, and OpenTofu won't even start. Bring them back into agreement without breaking the site.

## Files

drift-message-andile =
    From: Andile
    Friday 25 June, 9:10

    Good morning,

    Femi saved our evening yesterday: the old web host (198.51.100.40) died
    at nine, and he moved the site to the spare machine, 198.51.100.41. The
    hosting company confirmed this morning that the old one is gone for
    good: the site stays on .41.

    But Femi did it "the old way", by hand, and Yusra reminds us that the
    code must say what is true. And this morning tofu plan doesn't even
    start for me: something about a lock.

    Can you put things back in order? The site must keep working. Femi also
    added a record for Malalai's status page: keep it, but under OpenTofu
    like the others. His note is in your home.

    Andile

drift-message-femi =
    From: Femi
    Thursday 24 June, 22:05

    Sorry, a hurried note before I sleep.

    21:30: the site no longer answered, its host was dead. Malalai started
    the spare machine (198.51.100.41) and copied the site onto it.

    21:41: I started tofu apply in /srv/dns to change the address, but the
    plan wanted to change things I didn't understand, so I left it waiting
    at its question and used nsupdate, which I know, with the key from
    /etc/bind/tofu-key.key:
      update delete www.wayfinders.example A
      update add www.wayfinders.example 60 A 198.51.100.41
    (TTL 60, so that we could switch back fast.)

    21:51: Malalai's status page is up on 198.51.100.42, so I added
    status.wayfinders.example the same way, TTL 300.

    I didn't touch the code. My laptop's battery died before I could close
    anything.

    Femi

## Events

drift-event-locked =
    OpenTofu locks the state before reading it, so that two runs can't write
    it at the same time. Someone else's run holds the lock: Lock Info tells
    who, which operation and since when. Is that run still alive?
drift-event-force-unlock =
    tofu force-unlock can't help with a local state: the lock is held by the
    operating system for the process that took it, and only that process
    can release it. Find the process (ps), and decide what to do with it.
drift-event-no-lock =
    -lock=false while Femi's apply still waits: if someone answers yes in
    his session, it applies its old plan and writes its own state over
    yours. Locking is what prevents that; stop his run instead.
drift-event-freed =
    Femi's apply received the signal, cancelled its operation and released
    the lock as it stopped (its .terraform.tfstate.lock.info is gone). The
    state is free.
drift-event-freed-kill =
    Femi's apply is dead, killed without a chance to clean up: the operating
    system released the lock with the process, but its lock file
    (.terraform.tfstate.lock.info) stayed behind. It's harmless, the next
    run replaces it; a plain kill (TERM) lets OpenTofu stop properly.
drift-event-drift =
    "Objects have changed outside of OpenTofu": the refresh read www again
    and found Femi's changes, which the state didn't know. Read the plan
    below it: applying the code as it is would put www back on
    198.51.100.40, the dead host. The decision is yours: here, the hand
    change is the truth, so the code must follow.
drift-event-reverted =
    www points at 198.51.100.40 again, the host that died: the site is down
    for everyone whose resolver asks now. The code still had the old
    address, and the plan said so. Correct records.tf and apply again.
drift-event-hand-edit =
    terraform.tfstate was edited by hand. The state is OpenTofu's memory of
    the real objects, with a serial and a lineage, and a wrong edit makes it
    lie. To record what changed outside, tofu apply -refresh-only does it
    properly; to forget or rename something, tofu state rm and tofu state
    mv. The previous version is in terraform.tfstate.backup.
drift-event-state-rm =
    tofu state rm made OpenTofu forget a record, not the DNS: the record is
    still in named, and still in the code, so the next plan wants to create
    it. The diff didn't go away, it changed shape. Bring it back with tofu
    import.
drift-event-code =
    records.tf now says what is true: www on 198.51.100.41. Read the next
    plan: what about the TTL Femi lowered to 60? Keep 60 in the code, or go
    back to 300 (ttl forces a replacement of the record set: the plan says
    so).
drift-event-created-over =
    status.wayfinders.example was "created" over the record Femi had made:
    the dns provider adds addresses one by one, so it went through. With
    most providers, creating something that exists fails ("already
    exists"), and the way to adopt an object is tofu import.
drift-event-imported =
    status.wayfinders.example is now in OpenTofu's state, with the values it
    really has. From now on, a change to it goes through the code like the
    others.
drift-event-end =
    Andile: "tofu plan says No changes. That's the most beautiful sentence
    of the week." Femi: "Next time, I'll change the code, even at night."

    Well done! You finished Drift.

    WHAT HAPPENED
    During the incident, Femi left a tofu apply waiting for its "yes",
    which held the state lock, and changed www and added status with
    nsupdate. You stopped his run (OpenTofu released the lock), and tofu
    plan showed the drift: the real www differed from the state, and
    applying the old code would have put the site back on the dead host.
    You made the code follow the real change, applied, and adopted status
    with tofu import, until OpenTofu found nothing more to do.

    GOOD PRACTICE
    - Drift isn't automatically wrong: decide which side is true. If the
      hand change is right, update the code; if not, apply the code.
    - Read the plan before every apply, above all when it destroys or
      replaces: -auto-approve is for pipelines that have already been
      reviewed.
    - A lock means a run is (or was) in progress: find it, don't force it.
      Never -lock=false on a shared state.
    - Adopt what was made by hand with tofu import (or an import block),
      then make the code match until plan says No changes.
    - Don't edit terraform.tfstate, and don't use state rm to hide a
      difference; detect drift regularly with tofu plan -detailed-exitcode
      (exit code 2 when something differs).

    ANOTHER WAY
    An import block in the code (import with to and id) does the same as
    tofu import, but goes through plan and apply like any change, and can
    be reviewed. tofu apply -refresh-only records outside changes in the
    state without touching anything, when the code already follows them.

    DOCUMENTATION
    - State locking: https://opentofu.org/docs/language/state/locking/
    - tofu force-unlock: https://opentofu.org/docs/cli/commands/force-unlock/
    - Planning modes (refresh-only): https://opentofu.org/docs/cli/commands/plan/
    - Importing: https://opentofu.org/docs/cli/import/ and https://opentofu.org/docs/language/import/
    - BIND, dynamic updates: https://bind9.readthedocs.io/en/stable/reference.html#dynamic-update-policies
