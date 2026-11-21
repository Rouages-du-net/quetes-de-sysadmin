### What the chapters of "The Airwaves" share: the files of the federation's
### certificate authority on mast (Kwame's notes, the policy) and the pages
### of its sites. Commands, options, paths and outputs are not translated.

airwaves-readme-ca-1 =
    The Airwaves Federation's certificate authority -- Kwame, February 2028

    Our names end in airwaves.internal: no public authority will certify
    them, so we have our own. The stations' PCs trust our root because I
    installed ca.crt on each of them (Firefox and the system).

      ca.crt            the root's certificate (Airwaves Root CA, 10 years)
      private/ca.key    the root's private key: the crown jewels
      ca.srl            the last serial number used
      issued/           a copy of every certificate signed

    How I made the intranet's certificate (8 February 2028):

      openssl req -new -key /etc/nginx/ssl/intranet.key -subj /CN=intranet.airwaves.internal -out intranet.csr
      openssl x509 -req -in intranet.csr -CA ca.crt -CAkey private/ca.key -days 825 -out intranet.crt

    Then copy it to /etc/nginx/ssl/ and reload nginx.
    Before signing anything, read POLICY.txt.
airwaves-readme-ca-2 =
    { airwaves-readme-ca-1 }

    March 2030 -- the issuing CA

    The root shouldn't sign every certificate: its key should sleep
    offline. On 11 March I made an intermediate authority, signed by the
    root: issuing/ (Airwaves Issuing CA 1). It runs with openssl ca and
    its own openssl.cnf (database index.txt, serial, newcerts/). From now
    on it signs the servers' and the laptops' certificates. The root's key
    leaves mast next week.
airwaves-readme-ca-3 =
    { airwaves-readme-ca-2 }

    April 2030

    The root's key is on a USB stick in Adaeze's safe; the root's
    revocation list (CRL), written at the same ceremony, is in
    crl/root.crl (valid a year). Laptops: one client certificate each,
    issued by issuing/ (copies in issuing/certs/ and issuing/newcerts/).
airwaves-policy =
    Airwaves Federation -- certificate policy (version 2, January 2030)

    1. Server certificates
       - every name a client uses goes in subjectAltName (DNS:...);
         browsers ignore the Common Name
       - validity: one year (365 days), never more than 398
       - not a CA (basicConstraints CA:FALSE)
       - key: EC P-256 or RSA of at least 2048 bits
    2. The CA's keys
       - readable by root only (chmod 600), never copied elsewhere
       - only the certificates are distributed, never the keys
    3. Revocation
       - a lost or stolen key: revoke its certificate the same day, and
         publish the revocation list
airwaves-site-intranet =
    <!DOCTYPE html>
    <html lang="en"><head><title>Airwaves intranet</title></head>
    <body><h1>Airwaves Federation</h1><p>This week's schedule, the presenters' rota, the shared jingles.</p></body></html>
airwaves-site-archive =
    <!DOCTYPE html>
    <html lang="en"><head><title>Airwaves archive</title></head>
    <body><h1>Programme archive</h1><p>Every show of the five stations since 2019.</p></body></html>
airwaves-site-contrib =
    <!DOCTYPE html>
    <html lang="en"><head><title>Airwaves contributions</title></head>
    <body><h1>Contributions</h1><p>Recordings from the field: the uploader sends them here.</p></body></html>
