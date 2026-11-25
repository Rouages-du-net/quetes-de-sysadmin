### Graded hints for The Airwaves (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — The Expiry Date

hint-expiry-date-expired =
    .lead = Schau dir das Zertifikat an, das das Intranet wirklich präsentiert, und seine Daten (man openssl: s_client, x509).
    .solution = openssl s_client -connect intranet.airwaves.internal:443 </dev/null | openssl x509 -noout -dates
hint-expiry-date-cn-only =
    .lead = Welche Namen deckt das Zertifikat ab? Lies es ganz, im Klartext.
    .solution = openssl x509 -in /etc/nginx/ssl/intranet.crt -noout -text
hint-expiry-date-readme =
    .lead = Die Zertifizierungsstelle wohnt in /srv/ca: Kwame hat dort Notizen und eine Richtlinie hinterlassen.
    .solution = cat /srv/ca/README.txt /srv/ca/POLICY.txt
hint-expiry-date-key-open =
    .lead = Wer darf den privaten Schlüssel der Zertifizierungsstelle lesen? Schau dir die Rechte von /srv/ca/private an.
    .solution = ls -l /srv/ca/private
hint-expiry-date-key-closed =
    .lead = Der Schlüssel einer CA ist nur für root lesbar (man chmod).
    .solution = sudo chmod 600 /srv/ca/private/ca.key; sudo chmod 700 /srv/ca/private
hint-expiry-date-renewed =
    .lead = Eine Anfrage für den Schlüssel des Intranets, dann signiert die Root sie für ein Jahr mit beiden Namen in subjectAltName (-extfile, oder -addext mit -copy_extensions copy); installiere sie dort, wo nginx nachschaut, prüfe, lade neu.
    .solution = openssl req -new -key SCHLUESSEL -subj /CN=intranet.airwaves.internal -out intranet.csr; printf 'subjectAltName = DNS:intranet.airwaves.internal, DNS:board.airwaves.internal\n' > san.ext; sudo openssl x509 -req -in intranet.csr -CA /srv/ca/ca.crt -CAkey /srv/ca/private/ca.key -days 365 -extfile san.ext -out intranet.crt; dann nach /etc/nginx/ssl/intranet.crt kopieren, sudo nginx -t, sudo systemctl reload nginx
hint-expiry-date-end =
    .lead = Prüfe wie ein Client, der unserer Root vertraut: beide Namen, mit curl und dem Zertifikat der Zertifizierungsstelle.
    .solution = curl --cacert /srv/ca/ca.crt https://board.airwaves.internal/

## Chapter 2 — The Chain of Trust

hint-chain-of-trust-red =
    .lead = Lies das Log der Überwachung, dann probiere ihre Anfrage selbst.
    .solution = tail /var/log/check-sites.log; curl https://archive.airwaves.internal/
hint-chain-of-trust-mast-trusts =
    .lead = Debian vertraut den Zertifizierungsstellen, die update-ca-certificates installiert: das Zertifikat der Root (nie ihr Schlüssel) kommt nach /usr/local/share/ca-certificates, in eine .crt-Datei (man update-ca-certificates).
    .solution = sudo cp /srv/ca/ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-still-red =
    .lead = Lass die Überwachung noch einmal laufen, oder curl das Archiv: was schickt der Server? Vergleiche mit dem Intranet.
    .solution = sudo /usr/local/bin/check-sites; tail -n 3 /var/log/check-sites.log
hint-chain-of-trust-chain =
    .lead = Der Server muss sein Zertifikat gefolgt vom Zwischenzertifikat schicken (dem Zertifikat der ausstellenden CA), in einer einzigen Datei für ssl_certificate.
    .solution = openssl s_client -connect archive.airwaves.internal:443 -showcerts </dev/null; sudo sh -c 'cat /etc/nginx/ssl/archive.crt /srv/ca/issuing/issuing.crt > /etc/nginx/ssl/archive-chain.crt', ssl_certificate darauf zeigen lassen, sudo nginx -t, sudo systemctl reload nginx
hint-chain-of-trust-booth =
    .lead = booth braucht das Zertifikat der Root auch, auf dieselbe Art installiert: kopiere es über ssh dorthin (man scp).
    .solution = scp /srv/ca/ca.crt booth:; ssh booth; sudo cp ca.crt /usr/local/share/ca-certificates/airwaves-root.crt; sudo update-ca-certificates
hint-chain-of-trust-end =
    .lead = Von booth und von mast aus müssen beide Sites ohne -k antworten.
    .solution = curl https://archive.airwaves.internal/ (auf booth und auf mast)

## Chapter 3 — The Stolen Laptop

hint-stolen-laptop-thief =
    .lead = Wer hat sich mit dem Portal verbunden? nginx schreibt jede Anfrage in sein Access-Log.
    .solution = sudo tail -n 20 /var/log/nginx/access.log
hint-stolen-laptop-revoked =
    .lead = Sperren ist die Aufgabe der Zertifizierungsstelle, in ihrer Datenbank: openssl ca, mit der Konfiguration der ausstellenden CA und dem Zertifikat von Lindiwes Laptop (index.txt gibt seine Seriennummer).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -revoke /srv/ca/issuing/newcerts/1003.pem -crl_reason keyCompromise
hint-stolen-laptop-crl =
    .lead = Server lesen die Datenbank nicht: sie lesen eine Sperrliste, die die Zertifizierungsstelle schreibt (man openssl: ca -gencrl).
    .solution = sudo openssl ca -config /srv/ca/issuing/openssl.cnf -gencrl -out /srv/ca/issuing/crl/issuing.crl
hint-stolen-laptop-refused =
    .lead = Gib nginx die CRLs mit ssl_crl im server-Block von contrib; es prüft die ganze Kette, also kommt die CRL der Root in dieselbe Datei. Dann prüfen und neu laden.
    .solution = sudo sh -c 'cat /srv/ca/issuing/crl/issuing.crl /srv/ca/crl/root.crl > /etc/nginx/ssl/airwaves-crl.pem'; ssl_crl /etc/nginx/ssl/airwaves-crl.pem; zu /etc/nginx/sites-enabled/contrib hinzufügen; sudo nginx -t; sudo systemctl reload nginx
hint-stolen-laptop-watch =
    .lead = Ein Skript, das über jedes ausgestellte Zertifikat läuft (/srv/ca/issued, /srv/ca/issuing/newcerts) und den Rückgabewert von openssl x509 -checkend nutzt, um nur die zu melden, die innerhalb von 30 Tagen ablaufen; lass es jeden Tag von cron laufen (oder von einem Timer).
    .solution = ein Skript: for c in /srv/ca/issued/*.crt /srv/ca/issuing/newcerts/*.pem; do openssl x509 -in "$c" -noout -checkend 2592000 >/dev/null || echo "laeuft innerhalb von 30 Tagen ab: $c"; done; dann sudo crontab -e: 17 7 * * * /usr/local/bin/cert-expiry
hint-stolen-laptop-end =
    .lead = Lass die Überwachung einmal von Hand laufen: sie muss das Zertifikat des Streaming-Servers nennen.
    .solution = sudo /usr/local/bin/cert-expiry
