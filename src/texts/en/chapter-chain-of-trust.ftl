### Story "The Airwaves", chapter "The Chain of Trust": an issuing CA, a
### server that sends its certificate without the intermediate, machines
### that don't trust the root. update-ca-certificates, nginx's chain,
### openssl s_client -showcerts and verify. Commands, options, paths and
### outputs are not translated.

chapter-chain-of-trust = The Chain of Trust
    .summary = Kwame put an intermediate authority under the root, Mateo wrote a monitoring check that has been red ever since, and the new studio PC refuses every site. The certificates are valid: what's missing is trust, and a link in the chain.

## Files

chain-of-trust-message-adaeze =
    From: Adaeze
    Monday 18 March, 9:15

    Two weeks of peace, and now this.

    Kwame came by last week to set up what he calls an "issuing CA"
    (see /srv/ca/README.txt), and signed the new archive's certificate
    with it: archive.airwaves.internal works fine in Firefox at the
    stations.

    But Mateo says his monitoring on mast has been red since he wrote it
    (/usr/local/bin/check-sites, its log in /var/log/check-sites.log),
    and the new studio PC he installed at Riverside, booth, refuses both
    the archive and the intranet. He suggested adding -k "to make it
    green"; I said I'd ask you first.

    You can reach booth from mast: ssh booth (your key is on it).

    Adaeze
chain-of-trust-note-mateo =
    Note from Mateo, Friday 15 March

    Fresh Debian 13 on this PC, for the studio's playout software. It
    fetches the schedule from https://intranet.airwaves.internal/ and the
    jingles from https://archive.airwaves.internal/, and refuses both:
    "SSL certificate problem: unable to get local issuer certificate".
    At the station, Firefox is fine. Kwame installed something on our old
    PCs, but I don't know what.

## Events

chain-of-trust-event-red =
    "unable to get local issuer certificate": the client couldn't link the
    certificate to an authority it trusts. A fresh machine only trusts the
    public authorities of its store (Debian's ca-certificates, in
    /etc/ssl/certs); our root is not one of them, and Kwame only installed
    it by hand on the stations' PCs. Where does Debian take the
    authorities it trusts from? (man update-ca-certificates)
chain-of-trust-event-insecure =
    -k (--insecure) in the monitoring would make it green... and blind: it
    would no longer notice an expired certificate, a wrong name, or a
    server that isn't ours. A check that can't fail checks nothing. Make
    mast trust our root instead.
chain-of-trust-event-pem-ignored =
    There's a .pem file in /usr/local/share/ca-certificates, and
    update-ca-certificates ignores it: it only takes files ending in .crt
    (the content is the same PEM). Rename it.
chain-of-trust-event-key-on-booth =
    A private key of the authority is on booth! A client needs the
    certificate only, the public part: whoever holds the key can sign
    certificates that every station would trust. Delete it from booth at
    once (in real life, a key that leaked means a new authority: here,
    booth isn't on the network yet, Adaeze lets it go this time).
chain-of-trust-event-mast-trusts =
    mast now trusts Airwaves Root CA: it is in /etc/ssl/certs and in the
    bundle ca-certificates.crt that curl and openssl read. Let's see what
    the monitoring says now.
chain-of-trust-event-still-red =
    Still red for the archive, but the intranet passes. The intranet's
    certificate is signed by the root directly; the archive's by the
    issuing CA, which the client doesn't know. A server must send, after
    its own certificate, the intermediates up to the root (not the root
    itself, which the client already has). What does the archive send?
    openssl s_client -showcerts lists the chain received.
chain-of-trust-event-intermediate-trusted =
    Trusting the issuing CA on the clients makes the archive work here,
    but on every other client the problem remains: the fix is on the
    server, which must send the intermediate with its certificate.
chain-of-trust-event-root-served =
    The archive now sends the root too. It works, but it's useless: a
    client only trusts a root it already has in its store, never one the
    server hands it; it's a few hundred bytes for nothing in each
    handshake.
chain-of-trust-event-chain =
    The archive now sends its certificate followed by the issuing CA's:
    any client that trusts the root can build the chain (leaf, issuing
    CA, root). Firefox at the stations was fine because it remembers the
    intermediates it has met; curl and a fresh machine don't.
chain-of-trust-event-booth =
    booth now trusts the federation's root (only its certificate is
    there, not its key).
chain-of-trust-event-end =
    Mateo: "Everything's green, and booth plays the jingles. I've taken
    -k out of my notes, promise."

    Well done! You finished The Chain of Trust.

    WHAT HAPPENED
    Two separate problems gave the same message, "unable to get local
    issuer certificate". First, neither mast nor booth trusted the
    federation's root: Debian trusts what update-ca-certificates puts in
    /etc/ssl/certs, from Mozilla's list and from the .crt files of
    /usr/local/share/ca-certificates. Then the archive sent its
    certificate alone, without the issuing CA that links it to the root;
    browsers that had already met that intermediate got by, other clients
    couldn't. You installed the root's certificate (and only it) on both
    machines, and gave nginx the chain: the leaf, then the intermediate.

    GOOD PRACTICE
    - Distribute the root's certificate, never a key: a client never needs
      a private key of the authority.
    - On Debian: /usr/local/share/ca-certificates/name.crt, then
      update-ca-certificates (a .pem is ignored).
    - A server sends its certificate and the intermediates, in order; not
      the root (cat leaf.crt issuing.crt > chain.crt for ssl_certificate).
    - openssl s_client -showcerts shows what is really sent; openssl
      verify -CAfile root.crt -untrusted issuing.crt checks the chain.
    - "Works in my browser" proves little: browsers cache intermediates.
    - Never disable verification in a monitoring check: it must be able
      to fail.

    DOCUMENTATION
    - update-ca-certificates: https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html
    - nginx, SSL certificate chains: https://nginx.org/en/docs/http/configuring_https_servers.html#chains
    - openssl-verify: https://docs.openssl.org/3.0/man1/openssl-verify/
    - openssl-s_client: https://docs.openssl.org/3.0/man1/openssl-s_client/
    - Mozilla's TLS guidelines: https://wiki.mozilla.org/Security/Server_Side_TLS
