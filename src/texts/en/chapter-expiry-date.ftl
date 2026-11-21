### Story "The Airwaves", chapter "The Expiry Date": the intranet's
### certificate, signed by the federation's own authority, has expired.
### openssl s_client, x509, req, x509 -req with -CA, subjectAltName.
### Commands, options, paths and outputs are not translated.

chapter-expiry-date = The Expiry Date
    .summary = Monday morning, and every station's browser warns that the intranet is not secure. Its certificate comes from the federation's own authority, and it expired last night. Renew it the way a certificate should be made today, and look after the authority's key while you're there.

## Files

expiry-date-message-adaeze =
    From: Adaeze (federation coordinator)
    Monday 4 March, 8:40

    Hello, and thank you for taking over from Kwame!

    Since this morning, every station gets a big red warning on the
    intranet: "Your connection is not private". The presenters click
    through it (I've asked them not to...), and Mateo says his browser
    talks about an expired date and a wrong name for board.airwaves.internal.

    Everything runs on mast. Our names end in airwaves.internal, so
    Kwame made our own certificate authority two years ago: it's in
    /srv/ca, with his notes (README.txt) and our policy (POLICY.txt).

    Can you renew the intranet's certificate, properly this time?
    Kwame also said something about the authority's key that worried
    me, but I didn't understand what.

    Adaeze

## Events

expiry-date-event-expired =
    There it is: the certificate's notAfter date has passed (Sunday,
    23:59 Paris time). A certificate carries its own end date, and no
    client accepts it afterwards, whoever signed it. What does the
    certificate say about the names it covers? openssl x509 -text shows
    everything.
expiry-date-event-cn-only =
    The certificate has a subject (CN=intranet.airwaves.internal) and no
    extension at all: no subjectAltName. Since 2017, browsers (Chrome 58,
    then the others) ignore the Common Name and only look at
    subjectAltName, as RFC 2818 and the CA/Browser Forum ask. Without it,
    even a valid certificate gets a warning; and board.airwaves.internal
    was never covered. Kwame's notes in /srv/ca say how he made this one.
expiry-date-event-readme =
    Kwame's recipe works, but it makes the same certificate again: x509
    -req keeps none of the request's extensions by default (no
    subjectAltName), and -days 825 goes against the policy. The names go
    in an extension file (-extfile), or in the request with -addext and
    then copied with -copy_extensions copy. While you're in /srv/ca: who
    can read the authority's private key?
expiry-date-event-key-open =
    The root's private key is rw-r--r--: every account on mast can read
    it, and with it sign a certificate for any name, which every station
    would trust. A CA's key is readable by root only (chmod 600), in a
    directory nobody else can enter (chmod 700).
expiry-date-event-key-gone =
    The root's private key is no longer in /srv/ca/private/ca.key! Without
    it, the authority can't sign anything any more, and every station would
    have to trust a new root. Put it back where it was (the policy's second
    rule: only its permissions change).
expiry-date-event-key-closed =
    The authority's key is now readable by root only: to sign, you go
    through sudo, and that leaves a trace in the journal.
expiry-date-event-insecure =
    curl -k (--insecure) answers, but only because it no longer checks
    anything: neither the date, nor the name, nor who signed. It hides the
    problem without fixing it; never put it in a script or a monitoring
    check. To check against our authority: curl --cacert /srv/ca/ca.crt.
expiry-date-event-mismatch =
    nginx refuses to load: the certificate and the key don't go together
    (key values mismatch). A certificate holds the public half of one key
    pair; ssl_certificate_key must be its private half. openssl x509
    -noout -pubkey and openssl pkey -pubout, each piped into sha256sum,
    must give the same fingerprint.
expiry-date-event-self-signed =
    nginx now serves a certificate signed by its own key: self-signed. No
    station trusts it (the red warning stays, now for an unknown issuer),
    and with req -x509's default configuration it is even a CA
    certificate. It must be signed by Airwaves Root CA, which the stations
    already trust: x509 -req with -CA and -CAkey.
expiry-date-event-no-san =
    A new certificate, signed by our root, but still without
    subjectAltName: the browsers will keep warning. Careful: x509 -req
    drops the request's extensions unless you say otherwise
    (-copy_extensions copy, or the names in -extfile).
expiry-date-event-one-name =
    A subjectAltName at last, but it doesn't list both names the stations
    use: intranet.airwaves.internal and board.airwaves.internal (nginx's
    server_name).
expiry-date-event-too-long =
    This certificate is valid { $days } days: the policy says one year,
    never more than 398. Public authorities may not go beyond 398 days, and
    Apple's systems refuse more than 825 even from a private authority; a
    short validity limits the damage of a lost key and forces the renewal
    to stay a known routine.
expiry-date-event-short =
    This certificate is only valid for a month: without -days, x509 -req
    signs for 30 days. The intranet would be red again in April. The
    policy asks for a year.
expiry-date-event-ca-leaf =
    This certificate says CA:TRUE: whoever holds the intranet's key could
    sign certificates for any name. A server's certificate is not a CA
    (basicConstraints = CA:FALSE).
expiry-date-event-not-reloaded =
    The new certificate is in place on disk, but nginx still serves the
    old one: it reads its certificates when it starts or reloads. Check
    the configuration (sudo nginx -t), then reload.
expiry-date-event-renewed =
    nginx now presents a certificate from Airwaves Root CA, valid a year,
    with both names in subjectAltName. curl --cacert /srv/ca/ca.crt
    https://board.airwaves.internal/ agrees.
expiry-date-event-end =
    Adaeze: "No more red warning, at any station. And board works again
    for Mateo! Thank you. I've put a reminder in the calendar for next
    February..."

    Well done! You finished The Expiry Date.

    WHAT HAPPENED
    In 2028 Kwame signed the intranet's certificate with the federation's
    root, the way many tutorials did: the name in the Common Name only, and
    825 days. It expired on Sunday night; and even before, browsers had
    stopped reading the CN, which is why board.airwaves.internal warned.
    You read what the server presents (openssl s_client, x509 -dates,
    -checkend), made a request, had the root sign it with the names in
    subjectAltName for a year, installed it and reloaded nginx, then
    checked with curl --cacert. And the root's key, readable by all, is
    now root's alone.

    GOOD PRACTICE
    - Every name a client uses goes in subjectAltName; the CN is ignored.
    - x509 -req keeps no extension from the request by default: -extfile,
      or -copy_extensions copy (and check the result with x509 -text).
    - A validity of a year at most (398 days is the public ceiling), and
      a calendar reminder, or better, a watch on expiry dates.
    - A certificate and its key go together: compare their public keys
      (x509 -pubkey, pkey -pubout, sha256sum).
    - Never curl -k as a fix: --cacert with your authority's certificate.
    - A CA's private key is readable by root only, and its root ideally
      offline.

    DOCUMENTATION
    - openssl-x509: https://docs.openssl.org/3.0/man1/openssl-x509/
    - openssl-req: https://docs.openssl.org/3.0/man1/openssl-req/
    - subjectAltName (RFC 5280, 4.2.1.6): https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.6
    - Mozilla's TLS guidelines: https://wiki.mozilla.org/Security/Server_Side_TLS
