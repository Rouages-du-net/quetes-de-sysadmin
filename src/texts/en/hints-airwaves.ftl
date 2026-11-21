### Graded hints for The Airwaves (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Expiry Date

hint-expiry-date-expired =
    .lead = Look at the certificate the intranet really presents, and at its dates (man openssl: s_client, x509).
    .solution = openssl s_client -connect intranet.airwaves.internal:443 </dev/null | openssl x509 -noout -dates
hint-expiry-date-cn-only =
    .lead = What names does the certificate cover? Read all of it, in clear.
    .solution = openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -text
hint-expiry-date-readme =
    .lead = The authority lives in /srv/ca: Kwame left notes and a policy there.
    .solution = cat /srv/ca/README.txt /srv/ca/POLICY.txt
hint-expiry-date-key-open =
    .lead = Who may read the authority's private key? Look at the permissions of /srv/ca/private.
    .solution = ls -l /srv/ca/private
hint-expiry-date-key-closed =
    .lead = A CA's key is readable by root only (man chmod).
    .solution = sudo chmod 600 /srv/ca/private/ca.key; sudo chmod 700 /srv/ca/private
hint-expiry-date-renewed =
    .lead = A request for the intranet's key, then the root signs it for a year with both names in subjectAltName (-extfile, or -addext with -copy_extensions copy); install it where nginx looks, check, reload.
    .solution = openssl req -new -key KEY -subj /CN=intranet.airwaves.internal -out intranet.csr; printf 'subjectAltName = DNS:intranet.airwaves.internal, DNS:board.airwaves.internal\n' > san.ext; sudo openssl x509 -req -in intranet.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 365 -extfile san.ext -out intranet.crt; then copy it to /etc/nginx/ssl/intranet.crt, sudo nginx -t, sudo systemctl reload nginx
hint-expiry-date-end =
    .lead = Check like a client that trusts our root: both names, with curl and the authority's certificate.
    .solution = curl --cacert /srv/ca/ca.crt https://board.airwaves.internal/

## Chapter 2 — The Chain of Trust

hint-chain-of-trust-red =
    .lead = Read the monitoring's log, then try its request yourself.
    .solution = tail /var/log/check-sites.log; curl https://archive.airwaves.internal/
hint-chain-of-trust-mast-trusts =
    .lead = Debian trusts the authorities update-ca-certificates installs: the root's certificate (never its key) goes in /usr/local/share/ca-certificates, in a .crt file (man update-ca-certificates).
    .solution = sudo cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-still-red =
    .lead = Run the monitoring again, or curl the archive: what does the server send? Compare with the intranet.
    .solution = sudo /usr/local/bin/check-sites; tail -n 3 /var/log/check-sites.log
hint-chain-of-trust-chain =
    .lead = The server must send its certificate followed by the intermediate (the issuing CA's certificate), in one file for ssl_certificate.
    .solution = openssl s_client -connect archive.airwaves.internal:443 -showcerts </dev/null; sudo sh -c 'cat /etc/nginx/ssl/archive.crt /srv/ca/issuing/issuing.crt > /etc/nginx/ssl/archive-chain.crt', point ssl_certificate to it, sudo nginx -t, sudo systemctl reload nginx
hint-chain-of-trust-booth =
    .lead = booth needs the root's certificate too, installed the same way: copy it there over ssh (man scp).
    .solution = scp /srv/ca/ca.crt booth:; ssh booth; sudo cp ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-end =
    .lead = From booth and from mast, both sites must answer without -k.
    .solution = curl https://archive.airwaves.internal/ (on booth and on mast)

## Chapter 3 — The Stolen Laptop

hint-stolen-laptop-thief =
    .lead = Who has been connecting to the portal? nginx writes every request in its access log.
    .solution = sudo tail -n 20 /var/log/nginx/access.log
hint-stolen-laptop-revoked =
    .lead = Revoking is the authority's job, in its database: openssl ca, with the issuing CA's configuration and the certificate of Lindiwe's laptop (index.txt gives its serial number).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem -crl_reason keyCompromise
hint-stolen-laptop-crl =
    .lead = Servers don't read the database: they read a revocation list, which the authority writes (man openssl: ca -gencrl).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /srv/ca/issuing/crl/issuing.crl
hint-stolen-laptop-refused =
    .lead = Give nginx the CRLs with ssl_crl in contrib's server block; it checks the whole chain, so the root's CRL goes in the same file. Then check and reload.
    .solution = sudo sh -c 'cat /srv/ca/issuing/crl/issuing.crl /srv/ca/crl/root.crl > /etc/nginx/ssl/airwaves-crl.pem'; add ssl_crl /etc/nginx/ssl/airwaves-crl.pem; to /etc/nginx/sites-enabled/contrib; sudo nginx -t; sudo systemctl reload nginx
hint-stolen-laptop-watch =
    .lead = A script that loops over every certificate issued (/srv/ca/issued, /srv/ca/issuing/newcerts) and uses openssl x509 -checkend's exit code to report only those expiring within 30 days; run it every day from cron (or a timer).
    .solution = a script: for c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do openssl x509 -in "$c" -noout -checkend 2592000 >/dev/null || echo "expires within 30 days: $c"; done; then sudo crontab -e: 17 7 * * * /usr/local/bin/cert-expiry
hint-stolen-laptop-end =
    .lead = Run the watch by hand once: it must name the streaming server's certificate.
    .solution = sudo /usr/local/bin/cert-expiry
