### Story "The Audit", chapter "The Scope": read the letter of engagement,
### take an inventory of the server as seen from the internet with nmap, stay
### inside the scope. The commands, options, paths and nmap's output are not
### translated.

chapter-scope = The Scope
    .summary = Before scanning: read the letter of engagement, take an inventory with nmap, and leave alone whatever is not in the scope.

## Files

scope-email-salome =
    From:     Salomé (auditor)
    To:       you
    Subject:  Bakery audit mission — where to start

    Hello,

    Nadia has entrusted me with the security audit of her server. I always
    start the same way, and I am asking you to do it with me: the letter of
    engagement first (engagement_letter.txt, signed by both of us), then the
    inventory. An audit starts with "what is visible, and what am I allowed to
    look at?".

    What I expect from you:
    1. Read the letter of engagement: it fixes the scope, and what is allowed.
    2. Take an inventory of the server as seen from the internet, with nmap
       (man nmap): the open ports AND the version of whatever answers. Keep
       the trace in a file (the -oN option): it is the proof of what you saw.
    3. Complete audit_notes.md: the scope, what you found, and what you
       spotted without touching it.

    One precaution: Nadia warned me that the pizzeria next door's server
    (voisin.internal, 192.0.2.24) is plugged into the same box. It is not in
    our mandate.

    Salomé
    (For sudo, your password is: flour-2028)

scope-letter-mission =
    LETTER OF ENGAGEMENT

    Between: the bakery Le Fournil, represented by Nadia, manager
             ("the client")
    And:     Salomé, independent auditor

    Subject: external security audit of the online ordering service.

    Authorised scope:
      - the server bakery.internal (192.0.2.22), which also carries the
        public website bakery.example.

    Out of scope (not to be probed, even if technically possible):
      - any other equipment, in particular that of neighbours who share the
        client's box.

    Allowed:
      - scanning the server's ports and reading service versions (nmap);
      - harmless requests (a response code, a header);
      - reading the configuration, with the administration's agreement.

    Forbidden:
      - exploiting a flaw, reading or copying customers' data;
      - guessing passwords;
      - disturbing the service;
      - probing anything outside the scope.

    Period: from 6 to 17 March 2028, 9 a.m. to 6 p.m.
    Findings are delivered to the client only.

    Signed: Nadia (manager) and Salomé, 3 March 2028.

scope-notes-template =
    # Audit notes — Le Fournil

    ## Scope
    (to complete: what the letter of engagement allows)

    ## What I found
    (to complete: the open ports seen from the internet, the services and their versions)

    ## Out of scope
    (to complete: what I spotted and did NOT probe, and why)

scope-section-scope = Scope
scope-section-found = What I found
scope-section-outside = Out of scope
scope-a-complete = (to complete
scope-words-outside = out of scope, not in the letter, not in the mandate, not probed, did not probe, not scanned, did not touch, without touching, left alone

## Review

scope-review = Salomé reads your notes:
scope-missing-template = Some "(to complete)" lines of the template are still there.
scope-missing-ports = Under "What I found", what has no business on the internet is missing: the port numbers of the database and of Redis (what nmap showed).
scope-missing-neighbour = The machine you spotted without touching it is missing: the neighbour's server (name or address).
scope-missing-outside = You mention the neighbour's server: also say that it is out of scope (and that you did not probe it).

## Events

scope-event-letter =
    The letter of engagement is the document that protects you as much as
    the client: it says where you may go. Remember two things: the scope
    (ONE machine: bakery, 192.0.2.22) and the list of what is forbidden.
    Without written authorisation, a port scan is at best frowned upon, at
    worst an offence.

    On to the inventory: nmap, with versions (man nmap).
scope-event-scan =
    That is what the internet sees of the Bakery. Read the STATE column:
    "open" means a program answers; "filtered", that a firewall drops the
    packet; "closed", that nobody listens. And the VERSION column: an
    outdated version is one more lead for an attacker.

    An auditor's question: among these open services, which ones have a
    reason to be reachable by anyone? Keep the trace in a file (the -oN
    option): a finding without proof is only an opinion.
# { $adresses }: the addresses probed outside the letter of engagement; { $voisin }: "oui" if the neighbour's server is one of them
scope-event-outside-scope =
    WARNING: you have just probed an address that is not in your letter of
    engagement ({ $adresses }{ $voisin ->
        [oui] , including the neighbour's server
       *[non] {""}
    }). Here nothing happened;
    for real, it is a professional fault, and depending on the country an
    offence: the client's authorisation does not cover other people's
    equipment. The right answer to a machine that looks "interesting": leave
    it alone, and report it.

    (Scanning a whole network, like 192.0.2.0/24, also probes everything in
    it: always give the exact addresses of the scope.)
scope-event-trace =
    You have proof: a file with the exact command, the date, the ports and
    the versions. In the report you can say "on 6 March, from the internet,
    the database answered on port 5432" and show it.

    Your notes remain to be written (audit_notes.md): what you found, and
    what you saw without touching it.
# { $faute }: "oui" if the scan went beyond the scope, "non" otherwise
scope-event-end =
    Salomé: "That is a clean inventory: a scope, proof, and honest notes. We
    can use it for the report."

    Well done! You have finished the chapter "The Scope".

    WHAT HAPPENED
    You read the letter of engagement before touching anything, then took an
    inventory of the Bakery as seen from the internet: SSH, the website, but
    also PostgreSQL and Redis, which nothing justifies exposing, and an SSH
    version that is not the latest. You kept the trace of the scan in a
    file. And you noted, without touching it, an "interesting" machine that is
    not yours: the neighbour's server.
    { $faute ->
        [oui] But your scan also probed the neighbour's address: the most common mistake, because scanning "the whole network" is a reflex. Here it costs nothing; for real, it is the fault that ends a mission, sometimes a career.
       *[non] Your scan stayed within the scope: that is what is expected of an auditor.
    }

    GOOD PRACTICE
    - No audit without written authorisation: who, what (the exact
      addresses), when, what is allowed, what is forbidden.
    - Stay in the scope, even when the rest of the network is within reach.
      What you see outside the scope is reported, not tested.
    - Write down the exact command and keep the output (nmap -oN): a finding
      is proven and can be replayed.
    - Observe, do not exploit: seeing that a database answers does not
      allow you to connect to it.
    - An open port is not necessarily a problem: it is a question ("is it
      intended?"). The report says which ones, and why.

    ANOTHER WAY
    Without nmap, ss -tlnp on the server lists the services that listen, but
    not what the outside sees: a firewall may hide some. The two complement
    each other: ss says what listens, nmap says what gets through.

    DOCUMENTATION
    - nmap: https://nmap.org/book/man.html
    - Legal issues: https://nmap.org/book/legal-issues.html
    - Hygiene and audit guides from national authorities: ANSSI (France, cyber.gouv.fr), BSI (Germany, bsi.bund.de), NCSC (United Kingdom, ncsc.gov.uk), CCN-CERT (Spain, ccn-cert.cni.es), CCB (Belgium, ccb.belgium.be), NCSC (Switzerland, ncsc.admin.ch), CISA (United States, cisa.gov)
